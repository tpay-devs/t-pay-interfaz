
-- Create trigger to send admin notification when payment_status changes to 'paid'
-- (uses existing function public.create_detailed_order_notification)

-- Drop existing trigger if present to avoid duplicates
DROP TRIGGER IF EXISTS orders_notify_payment ON public.orders;

-- Create AFTER UPDATE trigger on payment_status
CREATE TRIGGER orders_notify_payment
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW
WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
EXECUTE FUNCTION public.create_detailed_order_notification();
