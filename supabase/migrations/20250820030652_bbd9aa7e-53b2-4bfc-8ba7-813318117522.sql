-- Remove duplicate notification triggers that are causing 4 notifications per order
-- Keep only the create_detailed_order_notification_trigger as it's the most comprehensive

-- Drop the duplicate triggers
DROP TRIGGER IF EXISTS create_order_notification ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_create_notifications ON public.orders;

-- Also drop their associated functions if they exist
DROP FUNCTION IF EXISTS public.create_order_notification();
DROP FUNCTION IF EXISTS public.trg_orders_create_notifications();

-- Verify the main trigger and function remain intact
-- The create_detailed_order_notification_trigger should remain active