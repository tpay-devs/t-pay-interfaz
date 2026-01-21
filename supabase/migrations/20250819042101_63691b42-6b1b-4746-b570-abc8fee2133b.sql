
-- 1) Add MercadoPago user id on restaurants to map webhooks quickly
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS mercadopago_user_id text;

-- 2) Webhook logs table to persist raw payloads and processing results
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL DEFAULT 'mercadopago',
  live_mode boolean,
  event_type text,
  action text,
  payment_id text,
  merchant_order_id text,
  external_reference text,
  user_id text,
  restaurant_id uuid,
  order_id uuid,
  status text,
  http_status integer,
  body jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processing_notes text
);

-- Helpful indexes for debugging / lookups
CREATE INDEX IF NOT EXISTS webhook_logs_created_at_idx ON public.webhook_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_logs_payment_id_idx ON public.webhook_logs (payment_id);
CREATE INDEX IF NOT EXISTS webhook_logs_merchant_order_id_idx ON public.webhook_logs (merchant_order_id);
CREATE INDEX IF NOT EXISTS webhook_logs_external_reference_idx ON public.webhook_logs (external_reference);
CREATE INDEX IF NOT EXISTS webhook_logs_user_id_idx ON public.webhook_logs (user_id);
CREATE INDEX IF NOT EXISTS webhook_logs_restaurant_id_idx ON public.webhook_logs (restaurant_id);

-- Enable RLS and allow restaurant owners to view their logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Owners can view logs associated with their restaurant
CREATE POLICY "Owners can view their webhook logs"
  ON public.webhook_logs
  FOR SELECT
  USING (
    restaurant_id IN (
      SELECT r.id FROM public.restaurants r
      WHERE r.user_id = auth.uid()
    )
  );

-- (No public access; inserts are done by edge functions under service role and bypass RLS)

-- 3) Allow clients to view paid orders for active tables (optional but recommended)
CREATE POLICY IF NOT EXISTS "Anyone can view paid orders for active tables"
  ON public.orders
  FOR SELECT
  USING (
    payment_status = 'paid'
    AND table_id IN (
      SELECT t.id FROM public.tables t
      WHERE t.qr_active = true
    )
  );
