import { useState, useEffect } from 'react';

export const useTableAvailability = (tableId: string | null, disabled: boolean = false) => {
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Always allow table ordering - tables are never blocked
    // This allows multiple orders for the same table
    setLoading(false);
    setIsAvailable(true);
    setError(null);
  }, [tableId, disabled]);

  return { isAvailable, loading, error };
};

