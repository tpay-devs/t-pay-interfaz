
-- 1) Harden create_order_item_notification with per-order advisory lock
CREATE OR REPLACE FUNCTION public.create_order_item_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  table_number INTEGER;
  restaurant_id UUID;
  item_name TEXT;
  order_total NUMERIC;
  operation_mode TEXT;
  payment_method TEXT;
  has_new_order BOOLEAN;
  order_details TEXT;
  aggregated_total NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Serialize notifications per order to avoid duplicates under concurrent inserts
    PERFORM pg_advisory_xact_lock(hashtext(NEW.order_id::text));

    -- Get table, restaurant, mode, payment method and current order total
    SELECT t.table_number, t.restaurant_id, r.operation_mode, o.payment_method, o.total_amount
    INTO table_number, restaurant_id, operation_mode, payment_method, order_total
    FROM public.tables t
    JOIN public.orders o ON o.table_id = t.id
    JOIN public.restaurants r ON r.id = t.restaurant_id
    WHERE o.id = NEW.order_id;

    -- Does a 'new_order' notification already exist for this order?
    SELECT EXISTS(
      SELECT 1 FROM public.notifications
      WHERE order_id = NEW.order_id AND type = 'new_order'
    ) INTO has_new_order;

    -- Create the 'new_order' if it's missing and conditions apply
    IF NOT has_new_order AND (
         operation_mode = 'order_then_pay'
         OR (operation_mode = 'order_and_pay' AND payment_method = 'cash_pos')
       )
    THEN
      -- Aggregate order items to build details and compute total
      SELECT 
        STRING_AGG(
          oi.quantity || 'x ' || mi.name || ' ($' || (oi.unit_price * oi.quantity)::numeric(10,2) || ')',
          ', ' ORDER BY mi.name
        ),
        SUM(oi.unit_price * oi.quantity)
      INTO order_details, aggregated_total
      FROM public.order_items oi
      JOIN public.menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = NEW.order_id;

      IF restaurant_id IS NOT NULL THEN
        INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
        VALUES (
          restaurant_id,
          NEW.order_id,
          (SELECT table_id FROM public.orders WHERE id = NEW.order_id),
          'new_order',
          CASE WHEN payment_method = 'cash_pos' THEN 'Nuevo Pedido - Efectivo/Posnet' ELSE 'Nuevo Pedido' END,
          'Mesa ' || COALESCE(table_number::text, '0') || ' pidió: ' || COALESCE(order_details, '') 
          || ' - Total: $' || COALESCE(
               (CASE WHEN payment_method = 'cash_pos' THEN order_total ELSE aggregated_total END)::numeric(10,2)::text,
               '0.00'
             )
          || CASE WHEN payment_method = 'cash_pos' THEN ' (Pago en efectivo/posnet)' ELSE '' END
        );
      END IF;
    END IF;

    -- Only create 'item_added' notifications for order_then_pay mode
    IF operation_mode = 'order_then_pay' AND has_new_order THEN
      -- Get menu item name
      SELECT mi.name INTO item_name
      FROM public.menu_items mi
      WHERE mi.id = NEW.menu_item_id;

      -- Fetch latest order total
      SELECT o.total_amount INTO order_total
      FROM public.orders o
      WHERE o.id = NEW.order_id;

      INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
      VALUES (
        restaurant_id,
        NEW.order_id,
        (SELECT table_id FROM public.orders WHERE id = NEW.order_id),
        'item_added',
        'Plato Agregado',
        'Mesa ' || table_number || ' agregó: ' || NEW.quantity || 'x ' || item_name || ' ($' 
          || (NEW.unit_price * NEW.quantity)::numeric(10,2) || ') - Nuevo total: $' 
          || COALESCE(order_total::numeric(10,2)::text, '0.00')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Triggers to actually fire the functions

-- Orders trigger: on insert (new order) and on payment_status update (to 'paid')
DROP TRIGGER IF EXISTS trg_orders_notifications ON public.orders;
CREATE TRIGGER trg_orders_notifications
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_detailed_order_notification();

-- Order items trigger: on insert of each item
DROP TRIGGER IF EXISTS trg_order_items_notifications ON public.order_items;
CREATE TRIGGER trg_order_items_notifications
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.create_order_item_notification();

-- 3) Partial unique indexes to prevent duplicates

-- Only one 'new_order' notification per order
CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_new_order_per_order
ON public.notifications (order_id)
WHERE type = 'new_order';

-- Only one 'payment_received' notification per order
CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_payment_received_per_order
ON public.notifications (order_id)
WHERE type = 'payment_received';

-- 4) Backfill a single 'new_order' notification for order_number = 143 if missing
WITH ctx AS (
  SELECT o.id AS order_id, o.table_id, t.table_number, o.restaurant_id, o.payment_method
  FROM public.orders o
  JOIN public.tables t ON t.id = o.table_id
  WHERE o.order_number = 143
),
agg AS (
  SELECT oi.order_id,
         STRING_AGG(
           oi.quantity || 'x ' || mi.name || ' ($' || (oi.unit_price * oi.quantity)::numeric(10,2) || ')',
           ', ' ORDER BY mi.name
         ) AS order_details,
         SUM(oi.unit_price * oi.quantity) AS aggregated_total
  FROM public.order_items oi
  JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  WHERE oi.order_id = (SELECT order_id FROM ctx)
  GROUP BY oi.order_id
)
INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
SELECT c.restaurant_id,
       c.order_id,
       c.table_id,
       'new_order',
       CASE WHEN c.payment_method = 'cash_pos' THEN 'Nuevo Pedido - Efectivo/Posnet' ELSE 'Nuevo Pedido' END,
       'Mesa ' || COALESCE(c.table_number::text, '0') || ' pidió: ' || COALESCE(a.order_details, '') ||
       ' - Total: $' || COALESCE(a.aggregated_total::numeric(10,2)::text, '0.00') ||
       CASE WHEN c.payment_method = 'cash_pos' THEN ' (Pago en efectivo/posnet)' ELSE '' END
FROM ctx c
LEFT JOIN agg a ON a.order_id = c.order_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.notifications n
  WHERE n.order_id = c.order_id AND n.type = 'new_order'
);
