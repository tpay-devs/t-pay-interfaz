-- Add payer email and name fields to orders table
ALTER TABLE public.orders 
ADD COLUMN payer_email text,
ADD COLUMN payer_name text;