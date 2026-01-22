import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom'; // Quitamos useNavigate
import { X, Check, Utensils, PartyPopper, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
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
  // const navigate = useNavigate(); // <-- ELIMINADO: No usaremos navegación SPA
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();

  const navState = location.state as OrderData | null;
  const [fetchedOrder, setFetchedOrder] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(!navState);

  const { isTakeaway: contextIsTakeaway, restaurantId: contextRestaurantId, tableId: contextTableId } = useRestaurant();

  // --- LÓGICA DE RETORNO BLINDADA (CON RECARGA) ---
  const handleReturn = () => {
    // 1. Recopilar IDs de donde sea posible (Contexto, Estado o Base de Datos)
    const targetRestId = navState?.restaurantId || fetchedOrder?.restaurantId || contextRestaurantId;
    const targetTableId = navState?.tableId || fetchedOrder?.tableId || contextTableId;
    const targetIsTakeaway = navState?.isTakeaway ?? fetchedOrder?.isTakeaway ?? contextIsTakeaway;

    console.log("📍 Returning to:", { targetRestId, targetTableId, targetIsTakeaway });

    // 2. Construir la URL de destino
    let returnUrl = '/';

    if (targetIsTakeaway && targetRestId) {
       // Volver a modo Takeaway
       returnUrl = `/?id=rst_${targetRestId}`;
    } else if (targetTableId) {
      // Volver a la Mesa específica
      returnUrl = `/?id=tbl_${targetTableId}`;
    } else if (targetRestId) {
      // Fallback: Volver al restaurante genérico
      returnUrl = `/?id=rst_${targetRestId}`;
    }

    // 3. 🔥 HARD REFRESH: Forzamos la recarga real del navegador.
    // Esto obliga a que el Contexto de Restaurante se reinicie y lea el ID nuevo.
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
            )
          `);

        if (orderId) {
          query = query.eq('id', orderId);
        } else {
          // Buscamos por sesión si no hay ID directo
          const sessionId = getClientSessionId();
          if (!sessionId) throw new Error("No session ID");

          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

          query = query
            .eq('client_session_id', sessionId)
            .gte('created_at', fifteenMinutesAgo)
            .in('payment_status', ['paid', 'pending', 'rejected'])
            .order('created_at', { ascending: false })
            .limit(1);
        }

        const { data: orders, error } = await query;
        const order = Array.isArray(orders) ? orders[0] : orders;

        if (error || !order) {
          console.error("Error fetching order:", error);
          setIsLoading(false);
          return;
        }

        // Mapeamos los datos para tenerlos listos en el botón de retorno
        const items = order.order_items.map((item: any) => ({
          name: item.menu_items?.name || "Item",
          quantity: item.quantity,
          price: item.unit_price,
          extras: []
        }));

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
          restaurantId: order.restaurant_id, // Vital para el retorno
          tableId: order.table_id            // Vital para el retorno
        });

        if (order.payment_status === 'paid') {
          clearCart();
        }

      } catch (err) {
        console.error("Crash fetching order:", err);
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

  // CASO 2: PAGO RECHAZADO
  if (activeData.paymentStatus === 'rejected') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-6"
        >
          <X className="w-12 h-12 text-red-600" />
        </motion.div>
        <h1 className="text-2xl font-bold mb-2 text-destructive">Pago Rechazado</h1>
        <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
          Hubo un problema con tu tarjeta.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
          <button
            onClick={handleRetryPayment}
            className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar Pago
          </button>
          <button
            onClick={handleReturn}
            className="w-full py-4 rounded-xl font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Volver al menú
          </button>
        </div>
      </div>
    );
  }

  // CASO 3: ÉXITO
  const { orderNumber, items, subtotal, tipAmount, total, tipPercentage, isTakeaway: orderIsTakeaway, pickupCode, tableId } = activeData;

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

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