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
    if (disabled) return;
    
    if (!isTakeaway && !tableId) return;
    if (isTakeaway && !restaurantId) return;

    const currentSessionId = clientSessionIdRef.current;
    
    if (!currentSessionId) {
      console.error('usePaymentSuccess: No client session ID available, skipping subscription');
      return;
    }

    let filter: string;
    if (isTakeaway && restaurantId) {
      filter = `restaurant_id=eq.${restaurantId}`;
    } else if (tableId) {
      filter = `table_id=eq.${tableId}`;
    } else {
      return;
    }

    const handleOrderUpdate = async (payload: any) => {
      try {
        const order = payload.new;
        if (!order.client_session_id) {
          return;
        }
        
        if (order.client_session_id !== currentSessionId) {
          return;   
        }
        
        if (
          order.payment_status === 'paid' &&
          new Date(order.updated_at) >= new Date(pageLoadTimeRef.current)
        ) {
          const lastShown = localStorage.getItem(`payment_success_shown_${order.id}`);
          
          if (!lastShown) {
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

    const checkExistingPaidOrders = async () => {
      try {
        const minUpdatedAtISO = pageLoadTimeRef.current;
        
        let query = supabase
          .from('orders')
          .select('id, order_number, total_amount, payment_status, updated_at, pickup_code, pickup_time, client_session_id')
          .eq('payment_status', 'paid')
          .eq('client_session_id', currentSessionId) 
          .not('client_session_id', 'is', null)
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