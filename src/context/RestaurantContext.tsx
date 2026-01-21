import React, { createContext, useContext, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTableData } from '@/hooks/useSupabaseData';
import { useRestaurantData } from '@/hooks/useRestaurantData';
import { Tables } from '@/integrations/supabase/types';

type Restaurant = Tables<'restaurants'>;
type Table = Tables<'tables'>;

interface RestaurantContextType {
  restaurantId: string | null;
  tableId: string | null;
  isTakeaway: boolean;
  restaurant: Restaurant | null;
  table: Table | null;
  isLoading: boolean;
  error: Error | null;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

export const RestaurantProvider = ({ children }: { children: React.ReactNode }) => {
  const [searchParams] = useSearchParams();

  // 1. Parse URL
  const idParam = searchParams.get("id");
  const isTakeaway = idParam?.startsWith("rst_") ?? false;

  // Extract the raw UUID from the URL
  const resourceId = idParam
    ? (isTakeaway ? idParam.slice(4) : idParam)
    : "";

  // 2. Fetch Table Data (Only runs if we have a resourceId and it's NOT takeaway)
  const { table, loading: tableLoading, error: tableError } = useTableData(
    (!isTakeaway && resourceId) ? resourceId : ""
  );

  // 3. CALCULATE THE RESTAURANT ID
  // This is the fix: If we are in Table Mode, we wait for 'table' to load and use its restaurant_id.
  // If we are in Takeaway Mode, we just use the ID from the URL.
  const effectiveRestaurantId = isTakeaway
    ? resourceId
    : (table?.restaurant_id || "");

  // 4. Fetch Restaurant Data (Using the calculated ID)
  const { restaurant: restaurantData, loading: restaurantLoading, error: restaurantError } = useRestaurantData(
    effectiveRestaurantId
  );

  // 5. Global Loading State
  // We are loading if the specific mode's main fetch is loading, OR if we are waiting for the dependent fetch
  const isLoading = isTakeaway
    ? restaurantLoading
    : (tableLoading || (table && restaurantLoading)); // If table loaded, wait for restaurant

  const missingIdError = !idParam ? new Error("No ID provided in URL") : null;
  const error = missingIdError || tableError || restaurantError;

  const value = useMemo(() => ({
    restaurantId: effectiveRestaurantId || null,
    tableId: isTakeaway ? null : (table?.id || null),
    isTakeaway,
    restaurant: restaurantData as Restaurant | null,
    table: table as Table | null,
    isLoading: Boolean(isLoading), // Ensure boolean
    error: error ? (error as Error) : null
  }), [effectiveRestaurantId, table, isTakeaway, restaurantData, isLoading, error]);

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (context === undefined) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
};