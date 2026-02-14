-- Fix the notification trigger to only send notifications when payment is actually completed
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
      );
    END IF;
  END IF;
  
  -- Create notification for payment status changes (for ALL modes when payment is confirmed)
  IF TG_OP = 'UPDATE' AND OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
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
          'Mesa ' || COALESCE(table_number::text, '0') || ' pagó – Total: $' || COALESCE(NEW.total_amount::numeric(10,2)::text, '0.00')
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;