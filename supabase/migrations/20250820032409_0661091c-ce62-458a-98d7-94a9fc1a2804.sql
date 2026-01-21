-- Unify order notification triggers to eliminate duplicates
-- Drop any existing conflicting triggers on public.orders
DROP TRIGGER IF EXISTS orders_notify_payment ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_create_notifications ON public.orders;
DROP TRIGGER IF EXISTS create_order_notification ON public.orders;
DROP TRIGGER IF EXISTS create_detailed_order_notification_trigger ON public.orders;

-- Create a single trigger that handles both INSERT (new_order for order_then_pay) and UPDATE (payment_received when becomes paid)
CREATE TRIGGER orders_notifications
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_detailed_order_notification();