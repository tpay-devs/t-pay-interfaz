
-- 1) Update the function to create a 'new_order' notification on first item insert
--    for order_then_pay OR order_and_pay with cash_pos, then add 'item_added' normally.

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

    -- Re-check to decide if we can add 'item_added'
    SELECT EXISTS(
      SELECT 1 FROM public.notifications 
      WHERE order_id = NEW.order_id AND type = 'new_order'
    ) INTO has_new_order;

    IF has_new_order THEN
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

-- 2) Clean up duplicate triggers on order_items (keep a single trigger)

DROP TRIGGER IF EXISTS create_order_item_notification ON public.order_items;
DROP TRIGGER IF EXISTS trg_order_items_notifications ON public.order_items;

-- Ensure one consistent trigger exists (idempotent recreate)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'create_order_item_notification_trigger'
      AND tgrelid = 'public.order_items'::regclass
  ) THEN
    CREATE TRIGGER create_order_item_notification_trigger
    AFTER INSERT ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.create_order_item_notification();
  END IF;
END$$;
