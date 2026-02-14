-- Allow anonymous users to SELECT unpaid orders for active tables so insert().select() works
DROP POLICY IF EXISTS "Anyone can view unpaid orders for active tables" ON public.orders;

CREATE POLICY "Anyone can view unpaid orders for active tables"
ON public.orders
FOR SELECT
USING (
  payment_status = 'unpaid'
  AND table_id IN (
    SELECT t.id FROM public.tables t WHERE t.qr_active = true
  )
);