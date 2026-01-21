-- Fix the notification trigger function to properly handle restaurant_id
CREATE OR REPLACE FUNCTION public.create_detailed_order_notification()
 RETURNS trigger
 LANGUAGE plpgsql
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
  
  -- For new orders, create notification based on operation mode
  IF TG_OP = 'INSERT' THEN
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
    
    -- For order_and_pay mode, create payment notification immediately
    IF operation_mode = 'order_and_pay' THEN
      -- Get simplified order details for payment notification
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
      IF simple_order_details IS NOT NULL AND restaurant_id IS NOT NULL THEN
        INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
        VALUES (
          restaurant_id,
          NEW.id,
          NEW.table_id,
          'payment_received',
          'Pago Recibido',
          'Mesa ' || table_number || ' pagó – ' || simple_order_details || ' – $' || NEW.total_amount::numeric(10,2)
        );
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
            'Mesa ' || table_number || ' pagó – Total: $' || NEW.total_amount::numeric(10,2)
          );
        END IF;
      END IF;
    -- For menu_only mode, create payment notification immediately (no ordering system)
    ELSIF operation_mode = 'menu_only' THEN
      IF restaurant_id IS NOT NULL THEN
        INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
        VALUES (
          restaurant_id,
          NEW.id,
          NEW.table_id,
          'payment_received',
          'Pago Recibido',
          'Mesa ' || table_number || ' pagó – $' || NEW.total_amount::numeric(10,2)
        );
      END IF;
    ELSE
      -- For other modes, create new_order notification
      IF order_details IS NOT NULL AND restaurant_id IS NOT NULL THEN
        INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
        VALUES (
          restaurant_id,
          NEW.id,
          NEW.table_id,
          'new_order',
          'Nuevo Pedido',
          'Mesa ' || table_number || ' pidió: ' || order_details || ' - Total: $' || total_amount::numeric(10,2)
        );
      ELSE
        -- Fallback for empty orders
        IF restaurant_id IS NOT NULL THEN
          INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
          VALUES (
            restaurant_id,
            NEW.id,
            NEW.table_id,
            'new_order',
            'Nuevo Pedido',
            'Mesa ' || table_number || ' realizó un pedido - Total: $' || NEW.total_amount::numeric(10,2)
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- Create notification for payment status changes with order details (for non order_and_pay and non menu_only modes)
  IF TG_OP = 'UPDATE' AND OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' AND operation_mode NOT IN ('order_and_pay', 'menu_only') THEN
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
    IF simple_order_details IS NOT NULL AND restaurant_id IS NOT NULL THEN
      INSERT INTO public.notifications (restaurant_id, order_id, table_id, type, title, message)
      VALUES (
        restaurant_id,
        NEW.id,
        NEW.table_id,
        'payment_received',
        'Pago Recibido',
        'Mesa ' || table_number || ' pagó – ' || simple_order_details || ' – $' || NEW.total_amount::numeric(10,2)
      );
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
          'Mesa ' || table_number || ' pagó – Total: $' || NEW.total_amount::numeric(10,2)
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;