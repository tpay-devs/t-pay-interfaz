import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getClientSessionId } from '@/utils/clientSession';

interface PaymentSuccessData {
  orderNumber: number;
  totalAmount: number;
  orderId: string;
  pickupCode: string | null;
  pickupTime: string | null;
}

export const usePaymentSuccess = (tableId: string | null, isTakeaway: boolean = false, restaurantId?: string, disabled: boolean = false) => {
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccessData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const pageLoadTimeRef = useRef<string>(new Date().toISOString());
  const clientSessionIdRef = useRef<string>(getClientSessionId());

  useEffect(() => {
    // Don't run if disabled (e.g., when order confirmation is showing)
    if (disabled) return;
    
    // For takeaway orders, tableId is null, but we need restaurantId
    // For table orders, we need tableId
    if (!isTakeaway && !tableId) return;
    if (isTakeaway && !restaurantId) return;

    // Get current client session ID for filtering
    const currentSessionId = clientSessionIdRef.current;
    
    // Validate that we have a session ID - critical for proper filtering
    if (!currentSessionId) {
      console.error('usePaymentSuccess: No client session ID available, skipping subscription');
      return;
    }

    // Build filter for realtime subscription based on order type
    let filter: string;
    if (isTakeaway && restaurantId) {
      // For takeaway orders: filter by restaurant_id, client_session_id, and payment_status
      // Note: Supabase realtime filters don't support multiple conditions easily, so we'll filter in the handler
      filter = `restaurant_id=eq.${restaurantId}`;
    } else if (tableId) {
      // For table orders: filter by table_id (client_session_id filtering happens in handler)
      filter = `table_id=eq.${tableId}`;
    } else {
      return; // No tableId and not takeaway, or missing restaurantId for takeaway
    }

    // Handler for order updates
    const handleOrderUpdate = async (payload: any) => {
      try {
        const order = payload.new;
        
        // CRITICAL: Early return if order doesn't have client_session_id
        // This prevents processing orders from other sessions or legacy orders
        if (!order.client_session_id) {
          return; // Ignore orders without session ID
        }
        
        // CRITICAL: Early return if session IDs don't match
        // This is the primary filter to prevent cross-session notifications
        if (order.client_session_id !== currentSessionId) {
          return; // Ignore orders from other sessions
        }
        
        // Only process orders that:
        // 1. Have payment_status = 'paid'
        // 2. Were updated after this page loaded (additional safeguard)
        if (
          order.payment_status === 'paid' &&
          new Date(order.updated_at) >= new Date(pageLoadTimeRef.current)
        ) {
          // Check if we've already shown this order
          const lastShown = localStorage.getItem(`payment_success_shown_${order.id}`);
          
          if (!lastShown) {
            // Fetch full order details including pickup_code and pickup_time
            const { data: orderData, error } = await supabase
              .from('orders')
              .select('id, order_number, total_amount, pickup_code, pickup_time')
              .eq('id', order.id)
              .single();

            if (error) {
              console.error('Error fetching order details:', error);
              return;
            }

            setPaymentSuccess({
              orderNumber: orderData.order_number,
              totalAmount: Number(orderData.total_amount),
              orderId: orderData.id,
              pickupCode: orderData.pickup_code,
              pickupTime: orderData.pickup_time || null
            });
            setIsVisible(true);
            localStorage.setItem(`payment_success_shown_${order.id}`, 'true');
          }
        }
      } catch (error) {
        console.error('Error handling order update:', error);
      }
    };

    // Set up realtime subscription for order updates
    const channel = supabase
      .channel(`payment-success-${isTakeaway ? `restaurant-${restaurantId}` : `table-${tableId}`}-${currentSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: filter
        },
        handleOrderUpdate
      )
      .subscribe();

    // Also do an initial check for orders that might have been paid before the subscription was set up
    const checkExistingPaidOrders = async () => {
      try {
        const minUpdatedAtISO = pageLoadTimeRef.current;
        
        // CRITICAL: Always filter by client_session_id to ensure we only check orders from this session
        let query = supabase
          .from('orders')
          .select('id, order_number, total_amount, payment_status, updated_at, pickup_code, pickup_time, client_session_id')
          .eq('payment_status', 'paid')
          .eq('client_session_id', currentSessionId) // CRITICAL: Filter by session ID
          .not('client_session_id', 'is', null) // Additional safeguard: exclude null session IDs
          .gte('updated_at', minUpdatedAtISO)
          .order('updated_at', { ascending: false })
          .limit(1);
        
        if (isTakeaway && restaurantId) {
          query = query.is('table_id', null).eq('restaurant_id', restaurantId);
        } else if (tableId) {
          query = query.eq('table_id', tableId);
        } else {
          return;
        }
        
        const { data: orders, error } = await query;

        if (error) {
          console.error('Error checking existing paid orders:', error);
          return;
        }

        if (orders && orders.length > 0) {
          const order = orders[0];
          
          // Additional validation: ensure session ID matches (defensive check)
          if (order.client_session_id !== currentSessionId) {
            console.warn('checkExistingPaidOrders: Order session ID mismatch, ignoring');
            return;
          }
          
          const lastShown = localStorage.getItem(`payment_success_shown_${order.id}`);
          
          if (!lastShown) {
            setPaymentSuccess({
              orderNumber: order.order_number,
              totalAmount: Number(order.total_amount),
              orderId: order.id,
              pickupCode: order.pickup_code,
              pickupTime: order.pickup_time || null
            });
            setIsVisible(true);
            localStorage.setItem(`payment_success_shown_${order.id}`, 'true');
          }
        }
      } catch (error) {
        console.error('Error checking existing paid orders:', error);
      }
    };

    // Check for existing paid orders immediately
    checkExistingPaidOrders();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, isTakeaway, restaurantId, disabled]);

  const hidePaymentSuccess = () => {
    setIsVisible(false);
    setTimeout(() => setPaymentSuccess(null), 300);
  };

  return {
    paymentSuccess,
    isVisible,
    hidePaymentSuccess
  };
};