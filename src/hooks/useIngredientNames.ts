import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IngredientNameMap {
  [id: string]: string;
}

export const useIngredientNames = (ingredientIds: string[]): IngredientNameMap => {
  const [ingredientNames, setIngredientNames] = useState<IngredientNameMap>({});

  useEffect(() => {
    if (ingredientIds.length === 0) {
      setIngredientNames({});
      return;
    }

    const fetchIngredientNames = async () => {
      try {
        const { data, error } = await supabase
          .from('menu_item_ingredients')
          .select('id, name')
          .in('id', ingredientIds);

        if (error) {
          console.error('Error fetching ingredient names:', error);
          return;
        }

        const nameMap: IngredientNameMap = {};
        data.forEach(ingredient => {
          nameMap[ingredient.id] = ingredient.name;
        });
        setIngredientNames(nameMap);
      } catch (err) {
        console.error('Error fetching ingredient names:', err);
      }
    };

    fetchIngredientNames();
  }, [JSON.stringify(ingredientIds)]);

  return ingredientNames;
};