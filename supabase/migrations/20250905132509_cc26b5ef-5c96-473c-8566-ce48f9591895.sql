
-- 1) Make trigger functions run with elevated privileges and fixed search_path

CREATE OR REPLACE FUNCTION public.create_detailed_order_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE 
  table_number INTEGER; 
  restaurant_id UUID; 
  order_details TEXT; 
  total_amount NUMERIC; 
  simple_order_details TEXT; 
  operation_mode TEXT; 
BEGIN
  -- Get table number, restaurant_id, and operation mode
  SELECT t.table_number, t.restaurant_id, r.operation_mode 
  INTO table_number, restaurant_id, operation_mode
  FROM public.tables t
  JOIN public.restaurants r ON r.id = t.restaurant_id
  WHERE t.id = NEW.table_id;

  -- Ensure we have the restaurant_id
  IF restaurant_id IS NULL THEN
    restaurant_id := NEW.restaurant_id;
  END IF;

  -- Set default values to prevent null concatenation issues
  IF table_number IS NULL THEN
    table_number := 0;
  END IF;

  IF operation_mode IS NULL THEN
    operation_mode := 'order_and_pay';
  END IF;

  -- For order_then_pay mode: create new_order notification when order is created
  IF TG_OP = 'INSERT' AND operation_mode = 'order_then_pay' THEN
    -- Get order details with items
    SELECT 
      STRING_AGG(
        oi.quantity || 'x ' || mi.name || ' ($' || (oi.unit_price * oi.quantity)::numeric(10,2) || ')',
        ', ' ORDER BY mi.name
      ),
      SUM(oi.unit_price * oi.quantity)
    INTO order_details, total_amount
    FROM public.order_items oi
    JOIN public.menu_items mi ON mi.id = oi.menu_item_id
    WHERE oi.order_id = NEW.id;

    IF order_details IS NOT NULL AND order_details != '' AND restaurant_id IS NOT NULL THEN
      INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
      VALUES (
        restaurant_id,
        NEW.id,
        NEW.table_id,
        'new_order',
        'Nuevo Pedido',
        'Mesa ' || COALESCE(table_number::text, '0') || ' pidió: ' || order_details || ' - Total: $' || COALESCE(total_amount::numeric(10,2)::text, '0.00')
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Create payment notification only when payment_status changes to 'paid'
  IF TG_OP = 'UPDATE' 
     AND OLD.payment_status IS DISTINCT FROM 'paid' 
     AND NEW.payment_status = 'paid' THEN

    -- Get detailed order information for payment notification
    SELECT 
      STRING_AGG(
        CASE 
          WHEN oi.quantity > 1 THEN oi.quantity || 'x ' || mi.name
          ELSE mi.name
        END,
        ', ' ORDER BY mi.name
      )
    INTO simple_order_details
    FROM public.order_items oi
    JOIN public.menu_items mi ON mi.id = oi.menu_item_id
    WHERE oi.order_id = NEW.id;

    -- Create payment notification with detailed order information
    IF simple_order_details IS NOT NULL AND simple_order_details != '' AND restaurant_id IS NOT NULL THEN
      INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
      VALUES (
        restaurant_id,
        NEW.id,
        NEW.table_id,
        'payment_received',
        'Pago Recibido',
        'Mesa ' || COALESCE(table_number::text, '0') || ' pagó – ' || simple_order_details || ' – $' || COALESCE(NEW.total_amount::numeric(10,2)::text, '0.00')
      )
      ON CONFLICT DO NOTHING;
    ELSE
      -- Fallback for orders without items
      IF restaurant_id IS NOT NULL THEN
        INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
        VALUES (
          restaurant_id,
          NEW.id,
          NEW.table_id,
          'payment_received',
          'Pago Recibido',
          'Mesa ' || COALESCE(table_number::text, '0') || ' pagó – Total: $' || COALESCE(NEW.total_amount::numeric(10,2)::text, '0.00')
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_order_item_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT ('x' || substr(md5(NEW.order_id::text), 1, 16))::bit(64)::bigint 
    INTO lock_key;
    
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

      -- Create the 'new_order' notification ONLY for order_and_pay + cash_pos
      IF NOT has_new_order AND operation_mode = 'order_and_pay' AND payment_method = 'cash_pos' THEN
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
            'Nuevo Pedido - Efectivo/Posnet',
            'Mesa ' || COALESCE(table_number::text, '0') || ' pidió: ' || COALESCE(order_details, '') 
            || ' - Total: $' || COALESCE(order_total::numeric(10,2)::text, '0.00')
            || ' (Pago en efectivo/posnet)'
          )
          ON CONFLICT DO NOTHING;
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

-- 2) Remove duplicate trigger on order_items; keep a single trigger

DROP TRIGGER IF EXISTS create_order_item_notification_trigger ON public.order_items;

-- Ensure the canonical trigger exists and points to the function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'order_items'
      AND t.tgname = 'order_items_notifications'
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER order_items_notifications
    AFTER INSERT ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.create_order_item_notification();
  END IF;
END$$;

-- Ensure orders trigger exists (for MercadoPago paid updates and order_then_pay new_order on insert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'orders'
      AND t.tgname = 'orders_notifications'
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER orders_notifications
    AFTER INSERT OR UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.create_detailed_order_notification();
  END IF;
END$$;

-- 3) Backfill: create missing 'new_order' for cash_pos orders that don't have one
INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
SELECT 
  o.restaurant_id,
  o.id AS order_id,
  o.table_id,
  'new_order' AS type,
  'Nuevo Pedido - Efectivo/Posnet' AS title,
  'Mesa ' || COALESCE(t.table_number::text, '0') || ' pidió: ' || det.details
  || ' - Total: $' || COALESCE(o.total_amount::numeric(10,2)::text, '0.00')
  || ' (Pago en efectivo/posnet)' AS message
FROM public.orders o
JOIN public.tables t ON t.id = o.table_id
JOIN (
  SELECT oi.order_id,
         STRING_AGG(oi.quantity || 'x ' || mi.name || ' ($' || (oi.unit_price * oi.quantity)::numeric(10,2) || ')', ', ' ORDER BY mi.name) AS details
  FROM public.order_items oi
  JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  GROUP BY oi.order_id
) det ON det.order_id = o.id
LEFT JOIN public.notifications n ON n.order_id = o.id AND n.type = 'new_order'
WHERE o.payment_method = 'cash_pos'
  AND n.id IS NULL;

-- Note: unique partial index on (order_id) where type='new_order' prevents duplicates
