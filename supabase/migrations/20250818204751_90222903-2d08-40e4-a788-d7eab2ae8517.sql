-- Create triggers to generate notifications when orders are created/updated and when items are added

-- Orders: create 'new_order' in order_then_pay mode on INSERT and 'payment_received' when payment_status changes to 'paid' on UPDATE
DROP TRIGGER IF EXISTS trg_orders_create_notifications ON public.orders;
CREATE TRIGGER trg_orders_create_notifications
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_detailed_order_notification();

-- Order items: create 'item_added' notifications when new items are inserted
DROP TRIGGER IF EXISTS trg_order_items_notifications ON public.order_items;
CREATE TRIGGER trg_order_items_notifications
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.create_order_item_notification();