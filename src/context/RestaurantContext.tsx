import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTableData } from '@/hooks/useSupabaseData';
import { useRestaurantData } from '@/hooks/useRestaurantData';
import { Tables } from '@/integrations/supabase/types';

type Restaurant = Tables<'restaurants'>;
type Table = Tables<'tables'>;

const CONTEXT_STORAGE_KEY = 'restaurant_context_id';

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

  // Get ID from URL, or fallback to localStorage for routes like /product/:id
  const urlIdParam = searchParams.get("id");
  const storedIdParam = typeof window !== 'undefined' ? localStorage.getItem(CONTEXT_STORAGE_KEY) : null;
  const idParam = urlIdParam || storedIdParam;

  // Persist valid ID to localStorage when present in URL
  useEffect(() => {
    if (urlIdParam && typeof window !== 'undefined') {
      localStorage.setItem(CONTEXT_STORAGE_KEY, urlIdParam);
    }
  }, [urlIdParam]);

  const isTakeaway = idParam?.startsWith("rst_") ?? false;
  const isTable = idParam?.startsWith("tbl_") ?? false;

  const resourceId = idParam
    ? (isTakeaway
      ? idParam.slice(4)
      : (isTable ? idParam.slice(4) : idParam))
    : "";

  // Use the FULL idParam (with tbl_ prefix) since qr_code_id stores "tbl_xxxxx"
  const tableQrIdToFetch = (!isTakeaway && isTable && idParam) ? idParam : "";

  const { table, loading: tableLoading, error: tableError } = useTableData(tableQrIdToFetch);

  const effectiveRestaurantId = isTakeaway
    ? resourceId
    : (table?.restaurant_id || "");

  const { restaurant: restaurantData, loading: restaurantLoading, error: restaurantError } = useRestaurantData(
    effectiveRestaurantId
  );

  const isLoading = isTakeaway
    ? restaurantLoading
    : (tableLoading || (table && restaurantLoading));

  const missingIdError = !idParam ? new Error("No ID provided in URL") : null;
  const error = missingIdError || tableError || restaurantError;

  const value = useMemo(() => ({
    restaurantId: effectiveRestaurantId || null,
    tableId: isTakeaway ? null : (table?.id || null),
    isTakeaway,
    restaurant: restaurantData as Restaurant | null,
    table: table as Table | null,
    isLoading: Boolean(isLoading),
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