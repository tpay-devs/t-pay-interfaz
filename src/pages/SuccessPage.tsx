import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { X, Check, Utensils, PartyPopper, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRestaurant } from '@/context/RestaurantContext';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/context/CartContext';
import { getClientSessionId } from '@/utils/clientSession';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  extras?: { name: string; price: number }[];
}

interface OrderData {
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  tipAmount: number;
  total: number;
  tipPercentage: number;
  paymentMethod: string;
  paymentStatus?: string;
  mercadopagoPreferenceId?: string;
  isTakeaway?: boolean;
  pickupCode?: string;
  restaurantId?: string;
  tableId?: string;
}

const SuccessPage = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();

  // Restore session ID from URL params on mount (handles iOS Safari localStorage reset)
  useEffect(() => {
    getClientSessionId();
  }, []);

  const navState = location.state as OrderData | null;
  const [fetchedOrder, setFetchedOrder] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(!navState);

  const { isTakeaway: contextIsTakeaway, restaurantId: contextRestaurantId, tableId: contextTableId } = useRestaurant();

  // --- LÓGICA DE RETORNO (CON RESPALDO DE LOCALSTORAGE) ---
  const handleReturn = () => {
    // 1. Intentar obtener datos de la orden cargada o navegación (Lo más fiable)
    let targetRestId = fetchedOrder?.restaurantId || navState?.restaurantId || contextRestaurantId;
    let targetTableId = fetchedOrder?.tableId || navState?.tableId || contextTableId;

    // 2. Si fallan (son null/undefined), buscar en el "Bolsillo" (LocalStorage - Migas de Pan)
    if (!targetRestId) {
      targetRestId = localStorage.getItem('backup_restaurant_id') || undefined;
    }

    if (!targetTableId) {
      targetTableId = localStorage.getItem('backup_table_id') || undefined;
    }

    const targetIsTakeaway = navState?.isTakeaway ?? fetchedOrder?.isTakeaway ?? contextIsTakeaway ?? (!targetTableId);

    // 4. Construir URL
    let returnUrl = '/';

    if (targetRestId) {
      if (targetIsTakeaway) {
        // Volver a modo Takeaway
        returnUrl = `/?id=rst_${targetRestId}`;
      } else if (targetTableId) {
        const finalId = targetTableId.startsWith('tbl_') ? targetTableId : `tbl_${targetTableId}`;
        returnUrl = `/?id=${finalId}`;
      } else {
        // Fallback a restaurante si falla la mesa
        returnUrl = `/?id=rst_${targetRestId}`;
      }
    } else {
      // Fallback if no ID found
    }

    // 5. Hard Refresh para reiniciar el contexto limpio con el nuevo ID
    window.location.href = returnUrl;
  };

  const handleRetryPayment = () => {
    const prefId = fetchedOrder?.mercadopagoPreferenceId || navState?.mercadopagoPreferenceId;
    if (prefId) {
      window.location.href = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${prefId}`;
    }
  };

  useEffect(() => {
    const fetchOrder = async () => {
      if (navState) {
        setIsLoading(false);
        return;
      }

      let orderId = searchParams.get('external_reference');

      try {
        let query = supabase
          .from('orders')
          .select(`
            *,
            order_items (
              quantity,
              unit_price,
              menu_items (name)
            ),
            tables (       
              qr_code_id   
            )
          `);

        if (orderId) {
          query = query.eq('id', orderId);
        } else {
          const sessionId = getClientSessionId();
          if (!sessionId) throw new Error("No session ID");

          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

          query = query
            .eq('client_session_id', sessionId)
            .gte('created_at', fifteenMinutesAgo)
            .in('payment_status', ['paid', 'pending', 'unpaid'])
            .order('created_at', { ascending: false })
            .limit(1);
        }

        const { data: orders, error } = await query;
        const order = Array.isArray(orders) ? orders[0] : orders;

        if (error || !order) {
          setIsLoading(false);
          return;
        }

        const items = order.order_items.map((item: any) => ({
          name: item.menu_items?.name || "Item",
          quantity: item.quantity,
          price: item.unit_price,
          extras: []
        }));

        // Get real QR code ID from table relation for accurate return URL
        const realTableQrId = order.tables?.qr_code_id || (order.table_id ? order.table_id : undefined);

        setFetchedOrder({
          orderNumber: order.order_number.toString(),
          items,
          subtotal: order.total_amount,
          tipAmount: 0,
          total: order.total_amount,
          tipPercentage: 0,
          paymentMethod: order.payment_method || 'mercadopago',
          paymentStatus: order.payment_status || 'pending',
          mercadopagoPreferenceId: order.mercadopago_preference_id,
          isTakeaway: !!order.pickup_code,
          pickupCode: order.pickup_code,
          restaurantId: order.restaurant_id,
          tableId: realTableQrId
        });

        // Save backup IDs to localStorage for return navigation
        if (order.restaurant_id) localStorage.setItem('backup_restaurant_id', order.restaurant_id);
        if (realTableQrId) localStorage.setItem('backup_table_id', realTableQrId);

        if (order.payment_status === 'paid') {
          clearCart();
        }

      } catch (err) {
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [searchParams, navState, clearCart]);

  const activeData = navState || fetchedOrder;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // CASO 1: NO SE ENCONTRÓ NADA
  if (!activeData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No encontramos el pedido</h2>
          <p className="text-muted-foreground mb-6">
            Si pagaste, espera unos instantes y revisa tu correo.
          </p>
          <button onClick={() => window.location.href = '/'} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold shadow-lg">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // Desestructurar datos del pedido y utilidad de formateo
  const { orderNumber, items, subtotal, tipAmount, total, tipPercentage, isTakeaway: orderIsTakeaway, pickupCode, tableId } = activeData;

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  // Determinar si el pago fue completado
  // Checkeamos tanto el estado en la DB como el parámetro de URL de Mercado Pago
  // para manejar el caso donde el webhook aún no procesó pero MP ya aprobó
  const mpStatus = searchParams.get('collection_status') || searchParams.get('status');
  const isApprovedByMP = mpStatus === 'approved';
  const isPaymentCompleted = activeData.paymentStatus === 'paid' || isApprovedByMP;

  // CASO 2: PAGO NO COMPLETADO (rechazado, pendiente, o abandonado)
  if (!isPaymentCompleted && activeData.paymentStatus != null) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-grow flex flex-col px-6 pt-6 pb-10 max-w-md mx-auto w-full">
          {/* Status Header */}
          <section className="flex flex-col items-center text-center mt-6 mb-8">
            <div className="relative mb-6">
              <div className="bg-[#f59e0b] rounded-full flex items-center justify-center shadow-[0_15px_30px_-5px_rgba(245,158,11,0.3)] w-32 h-32">
                <svg className="text-white h-16 w-16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mt-6 mb-2 tracking-tight text-[#111827]">¡Pago Pendiente!</h1>
            <div className="bg-[#f3f4f6] px-4 py-2 rounded-full inline-flex items-center gap-2 mb-8">
              <svg className="h-5 w-5 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <span className="text-[#6b7280] text-sm font-medium">
                {orderIsTakeaway ? 'Para llevar' : 'En Mesa'} • Pendiente de Pago
              </span>
            </div>
            <p className="text-[#6b7280] text-sm leading-relaxed mx-auto max-w-[320px]">
              Tu pedido no fue pagado. Hasta que no pagues tu orden, el comercio no recibirá tu pedido.
            </p>
          </section>

          <hr className="border-[#f3f4f6] border-dashed mb-10" />

          {/* Order Summary */}
          <section className="space-y-6 mb-12">
            {items.map((item, index) => {
              const extrasTotal = item.extras?.reduce((sum, e) => sum + e.price, 0) || 0;
              const itemTotal = (item.price + extrasTotal) * item.quantity;
              return (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[#111827]">{item.quantity}x {item.name}</span>
                  <span className="text-sm font-medium text-[#111827]">{formatPrice(itemTotal)}</span>
                </div>
              );
            })}
            <div className="pt-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-[#6b7280] text-sm">Subtotal</span>
                <span className="text-[#6b7280] text-sm">{formatPrice(subtotal)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6b7280] text-sm">Propina ({tipPercentage}%)</span>
                  <span className="text-[#6b7280] text-sm">{formatPrice(tipAmount)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-4">
              <span className="text-sm font-semibold text-[#111827]">Total</span>
              <span className="text-2xl font-bold text-[#111827]">{formatPrice(total)}</span>
            </div>
          </section>

          {/* Order Number / Pickup Code */}
          <section className="bg-[#f3f4f6] rounded-[32px] p-10 flex flex-col items-center justify-center mb-12">
            <p className="text-[#6b7280] text-xs font-bold uppercase tracking-widest mb-2">
              {orderIsTakeaway ? 'CÓDIGO DE RETIRO' : 'TU NÚMERO DE ORDEN'}
            </p>
            <p className="text-4xl font-bold text-[#111827] leading-none break-all">
              {orderIsTakeaway ? pickupCode : orderNumber}
            </p>
          </section>

          {/* Actions */}
          <section className="mt-auto space-y-4">
            <button
              onClick={handleRetryPayment}
              className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl text-sm transition-colors duration-200 flex items-center justify-center gap-3"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
              Pagar ahora
            </button>
            <button
              onClick={handleReturn}
              className="w-full bg-[#111827] text-white font-semibold py-4 rounded-2xl text-sm transition-colors duration-200"
            >
              Volver al menú
            </button>
          </section>
        </main>
      </div>
    );
  }

  // CASO 3: ÉXITO (solo cuando el pago fue completado)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-center p-4 border-b border-border/30 relative"
      >
        <button
          onClick={handleReturn}
          className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Confirmación</span>
      </motion.header>

      <div className="flex flex-col items-center pt-10 pb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="relative"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute -top-2 -right-2"
          >
            <PartyPopper className="w-6 h-6 text-secondary" />
          </motion.div>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-success to-emerald-600 flex items-center justify-center shadow-xl shadow-success/30">
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold mt-6 mb-2"
        >
          ¡Pedido confirmado!
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-2 text-muted-foreground text-sm bg-muted px-4 py-2 rounded-full"
        >
          <Utensils className="w-4 h-4" />
          <span>
            {orderIsTakeaway ? 'Para llevar' : (tableId ? 'En Mesa' : 'Restaurante')} • Pedido Exitoso
          </span>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="px-6"
      >
        <div className="border-t border-dashed border-border/50 pt-5 space-y-3">
          {items.map((item, index) => {
            const extrasTotal = item.extras?.reduce((sum, e) => sum + e.price, 0) || 0;
            const itemTotal = (item.price + extrasTotal) * item.quantity;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 + index * 0.05 }}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{item.quantity}x {item.name}</span>
                <span className="font-medium">{formatPrice(itemTotal)}</span>
              </motion.div>
            );
          })}
        </div>

        <div className="border-t border-dashed border-border/50 mt-5 pt-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-sm">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {tipAmount > 0 && (
            <div className="flex items-center justify-between text-muted-foreground text-sm">
              <span>Propina ({tipPercentage}%)</span>
              <span>{formatPrice(tipAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-bold">{formatPrice(total)}</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-8 text-center"
        >
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
            {orderIsTakeaway ? 'CÓDIGO DE RETIRO' : 'TU NÚMERO DE ORDEN'}
          </p>
          <motion.p
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
            className="text-4xl font-bold break-all"
          >
            {orderIsTakeaway ? pickupCode : orderNumber}
          </motion.p>
          {orderIsTakeaway && orderNumber && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-sm text-muted-foreground mt-2"
            >
              Pedido #{orderNumber}
            </motion.p>
          )}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        className="px-6 mt-10 space-y-3 pb-10"
      >
        <button
          onClick={handleReturn}
          className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
        >
          Volver al menú
        </button>
      </motion.div>
    </motion.div>
  );
};

export default SuccessPage;