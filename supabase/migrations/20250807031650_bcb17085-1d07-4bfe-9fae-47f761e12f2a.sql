-- Create table for storing removed ingredients per order item
CREATE TABLE public.order_item_removed_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_item_id UUID NOT NULL,
  ingredient_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_item_id, ingredient_id)
);

-- Create table for storing added extras per order item
CREATE TABLE public.order_item_added_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_item_id UUID NOT NULL,
  extra_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_item_id, extra_id)
);

-- Enable Row Level Security
ALTER TABLE public.order_item_removed_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_added_extras ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_item_removed_ingredients
CREATE POLICY "Anyone can create removed ingredients" 
ON public.order_item_removed_ingredients 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view removed ingredients for active orders" 
ON public.order_item_removed_ingredients 
FOR SELECT 
USING (
  order_item_id IN (
    SELECT oi.id 
    FROM order_items oi 
    JOIN orders o ON o.id = oi.order_id 
    JOIN tables t ON t.id = o.table_id 
    WHERE t.qr_active = true
  )
);

CREATE POLICY "Users can view their restaurant removed ingredients" 
ON public.order_item_removed_ingredients 
FOR SELECT 
USING (
  order_item_id IN (
    SELECT oi.id 
    FROM order_items oi 
    JOIN orders o ON o.id = oi.order_id 
    JOIN restaurants r ON r.id = o.restaurant_id 
    WHERE r.user_id = auth.uid()
  )
);

-- RLS policies for order_item_added_extras
CREATE POLICY "Anyone can create added extras" 
ON public.order_item_added_extras 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view added extras for active orders" 
ON public.order_item_added_extras 
FOR SELECT 
USING (
  order_item_id IN (
    SELECT oi.id 
    FROM order_items oi 
    JOIN orders o ON o.id = oi.order_id 
    JOIN tables t ON t.id = o.table_id 
    WHERE t.qr_active = true
  )
);

CREATE POLICY "Users can view their restaurant added extras" 
ON public.order_item_added_extras 
FOR SELECT 
USING (
  order_item_id IN (
    SELECT oi.id 
    FROM order_items oi 
    JOIN orders o ON o.id = oi.order_id 
    JOIN restaurants r ON r.id = o.restaurant_id 
    WHERE r.user_id = auth.uid()
  )
);