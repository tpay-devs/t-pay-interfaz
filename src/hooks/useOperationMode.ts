import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useOperationMode = (restaurantId: string) => {
  const [operationMode, setOperationMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchOperationMode = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('operation_mode')
          .eq('id', restaurantId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching operation mode:', error);
          setError(error.message);
        } else {
          const mode = data?.operation_mode || 'order_and_pay';
          setOperationMode(mode);
        }
      } catch (err) {
        console.error('Error in fetchOperationMode:', err);
        setError('Failed to fetch operation mode');
      } finally {
        setLoading(false);
      }
    };

    fetchOperationMode();

    const channel = supabase
      .channel(`operation-mode-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${restaurantId}`
        },
        (payload) => {
          const newMode = payload.new.operation_mode || 'order_and_pay';
          setOperationMode(newMode);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return { operationMode, loading, error };
};