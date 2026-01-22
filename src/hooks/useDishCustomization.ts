import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Ingredient {
  id: string;
  menu_item_id: string;
  name: string;
  included_by_default: boolean;
  created_at: string;
}

interface Extra {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  created_at: string;
}

interface DishCustomizationData {
  ingredients: Ingredient[];
  extras: Extra[];
  loading: boolean;
  error: string | null;
}

export const useDishCustomization = (menuItemId: string | null): DishCustomizationData => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!menuItemId) {
      setIngredients([]);
      setExtras([]);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchCustomizationData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [ingredientsResponse, extrasResponse] = await Promise.all([
          (supabase as any)
            .from('menu_item_ingredients')
            .select('*')
            .eq('menu_item_id', menuItemId)
            .order('name'),
          (supabase as any)
            .from('menu_item_extras')
            .select('*')
            .eq('menu_item_id', menuItemId)
            .order('name')
        ]);

        if (ingredientsResponse.error) {
          throw new Error(`Error fetching ingredients: ${ingredientsResponse.error.message}`);
        }

        if (extrasResponse.error) {
          throw new Error(`Error fetching extras: ${extrasResponse.error.message}`);
        }

        setIngredients(ingredientsResponse.data || []);
        setExtras(extrasResponse.data || []);
      } catch (err) {
        console.error('Error fetching dish customization data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setIngredients([]);
        setExtras([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomizationData();
  }, [menuItemId]);

  return {
    ingredients,
    extras,
    loading,
    error
  };
};