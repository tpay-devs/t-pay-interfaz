-- Step 1: Clean up duplicate notifications (keep the most recent one for each type per order)
DELETE FROM public.notifications 
WHERE id NOT IN (
  SELECT DISTINCT ON (order_id, type) id
  FROM public.notifications 
  WHERE order_id IS NOT NULL
  ORDER BY order_id, type, created_at DESC
);

-- Step 2: Create unique partial indexes to prevent duplicate notifications
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_new_order 
ON public.notifications (order_id) 
WHERE type = 'new_order';

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_payment_received 
ON public.notifications (order_id) 
WHERE type = 'payment_received';

-- Step 3: Enhanced create_order_item_notification function with advisory locking
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
  lock_key BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Create a unique lock key based on order_id
    SELECT ('x' || substr(md5(NEW.order_id::text), 1, 16))::bit(64)::bigint INTO lock_key;
    
    -- Acquire advisory lock to prevent race conditions during batch inserts
    PERFORM pg_advisory_lock(lock_key);
    
    BEGIN
      -- Get table, restaurant, mode, payment method and current order total
      SELECT t.table_number, t.restaurant_id, r.operation_mode, o.payment_method, o.total_amount
      INTO table_number, restaurant_id, operation_mode, payment_method, order_total
      FROM public.tables t
      JOIN public.orders o ON o.table_id = t.id
      JOIN public.restaurants r ON r.id = t.restaurant_id
      WHERE o.id = NEW.order_id;

      -- Check if a 'new_order' notification already exists for this order
      SELECT EXISTS(
        SELECT 1 FROM public.notifications
        WHERE order_id = NEW.order_id AND type = 'new_order'
      ) INTO has_new_order;

      -- Create the 'new_order' notification if missing and conditions apply
      IF NOT has_new_order AND (
           operation_mode = 'order_then_pay'
           OR (operation_mode = 'order_and_pay' AND payment_method = 'cash_pos')
         )
      THEN
        -- Aggregate all current order items to build details and compute total
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

        IF restaurant_id IS NOT NULL AND order_details IS NOT NULL THEN
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

      -- Create 'item_added' notifications ONLY for order_then_pay mode when order already exists
      IF operation_mode = 'order_then_pay' AND has_new_order THEN
        -- Get menu item name
        SELECT mi.name INTO item_name
        FROM public.menu_items mi
        WHERE mi.id = NEW.menu_item_id;

        -- Get latest order total
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
          'Mesa ' || COALESCE(table_number::text, '0') || ' agregó: ' || NEW.quantity || 'x ' || item_name || ' ($' 
            || (NEW.unit_price * NEW.quantity)::numeric(10,2) || ') - Nuevo total: $' 
            || COALESCE(order_total::numeric(10,2)::text, '0.00')
        );
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE NOTICE 'Error in create_order_item_notification: %', SQLERRM;
    END;

    -- Release the advisory lock
    PERFORM pg_advisory_unlock(lock_key);
  END IF;

  RETURN NEW;
END;
$function$;

-- Step 4: Create the missing triggers
-- Trigger for orders table (handles order creation and payment status changes)
DROP TRIGGER IF EXISTS orders_notifications ON public.orders;
CREATE TRIGGER orders_notifications
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_detailed_order_notification();

-- Trigger for order_items table (handles item insertion)
DROP TRIGGER IF EXISTS order_items_notifications ON public.order_items;
CREATE TRIGGER order_items_notifications
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_item_notification();

-- Step 5: Backfill missing notifications for recent cash/pos orders
INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
SELECT 
  o.restaurant_id,
  o.id,
  o.table_id,
  'new_order',
  'Nuevo Pedido - Efectivo/Posnet',
  'Mesa ' || COALESCE(t.table_number::text, '0') || ' pidió: ' || 
  COALESCE(
    (SELECT STRING_AGG(
      oi.quantity || 'x ' || mi.name || ' ($' || (oi.unit_price * oi.quantity)::numeric(10,2) || ')',
      ', ' ORDER BY mi.name
    )
    FROM public.order_items oi
    JOIN public.menu_items mi ON mi.id = oi.menu_item_id
    WHERE oi.order_id = o.id), 
    'Sin items'
  ) ||
  ' - Total: $' || COALESCE(o.total_amount::numeric(10,2)::text, '0.00') ||
  ' (Pago en efectivo/posnet)'
FROM public.orders o
JOIN public.tables t ON t.id = o.table_id
JOIN public.restaurants r ON r.id = o.restaurant_id
WHERE o.order_number IN (140, 141, 143, 144)
  AND o.payment_method = 'cash_pos'
  AND r.operation_mode = 'order_and_pay'
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n 
    WHERE n.order_id = o.id AND n.type = 'new_order'
  );