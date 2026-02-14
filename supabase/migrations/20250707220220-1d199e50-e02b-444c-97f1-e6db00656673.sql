
-- Allow public access to active tables
CREATE POLICY "Public can view active tables" 
  ON public.tables 
  FOR SELECT 
  USING (qr_active = true);

-- Allow public access to categories for restaurants with active tables
CREATE POLICY "Public can view categories for active restaurants" 
  ON public.categories 
  FOR SELECT 
  USING (restaurant_id IN (
    SELECT DISTINCT restaurant_id 
    FROM public.tables 
    WHERE qr_active = true
  ));

-- Allow public access to available menu items for restaurants with active tables
CREATE POLICY "Public can view available menu items for active restaurants" 
  ON public.menu_items 
  FOR SELECT 
  USING (
    available = true 
    AND restaurant_id IN (
      SELECT DISTINCT restaurant_id 
      FROM public.tables 
      WHERE qr_active = true
    )
  );
