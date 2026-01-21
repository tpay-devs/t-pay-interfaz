
-- 1) Allow 'pending' as a valid payment_status so creating a preference can update safely
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_status_check
CHECK (payment_status IS NULL OR payment_status IN ('unpaid','pending','paid'));

-- 2) Add MercadoPago user id column to restaurants (used to match webhooks to the right token)
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS mercadopago_user_id text;

-- 3) Create a table to store raw webhook logs for debugging and traceability
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL,
  live_mode boolean NOT NULL DEFAULT false,
  event_type text,
  action text,
  payment_id text,
  merchant_order_id text,
  user_id text,
  external_reference text,
  order_id uuid,
  restaurant_id uuid,
  status text,
  http_status integer,
  processed boolean NOT NULL DEFAULT false,
  processing_notes text,
  body jsonb
);

-- Optional but helpful indexes
CREATE INDEX IF NOT EXISTS webhook_logs_created_at_idx ON public.webhook_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_logs_payment_id_idx ON public.webhook_logs (payment_id);
CREATE INDEX IF NOT EXISTS webhook_logs_merchant_order_id_idx ON public.webhook_logs (merchant_order_id);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Allow the application (service role) to insert logs freely (service role bypasses RLS anyway, but explicit policy keeps intent clear)
DROP POLICY IF EXISTS "System can insert webhook logs" ON public.webhook_logs;
CREATE POLICY "System can insert webhook logs"
  ON public.webhook_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow restaurant owners to view only their own logs
DROP POLICY IF EXISTS "Owners can view their webhook logs" ON public.webhook_logs;
CREATE POLICY "Owners can view their webhook logs"
  ON public.webhook_logs
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT r.id FROM public.restaurants r
      WHERE r.user_id = auth.uid()
    )
  );
