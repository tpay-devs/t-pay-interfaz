-- Add commission fields to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN commission_percentage NUMERIC DEFAULT 3.0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100);

-- Add comment to clarify the field
COMMENT ON COLUMN public.restaurants.commission_percentage IS 'Platform commission percentage (0-100) charged on payments';