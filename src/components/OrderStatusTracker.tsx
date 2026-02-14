import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Clock, Receipt, ChefHat, CheckCircle2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/context/RestaurantContext";
import { getClientSessionId } from "@/utils/clientSession";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OrderStatus {
    id: string;
    status: string;
    payment_status: string;
    payment_method: string;
    mercadopago_preference_id: string | null;
    order_number: number;
    total_amount: number;
    pickup_code?: string;
    created_at: string;
}

export const OrderStatusTracker = () => {
    const { restaurantId } = useRestaurant();
    const [activeOrders, setActiveOrders] = useState<OrderStatus[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const handleRetryPayment = (preferenceId: string) => {
        const checkoutUrl = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${preferenceId}`;
        window.location.href = checkoutUrl;
    };

    useEffect(() => {
        const sessionId = getClientSessionId();

        if (!restaurantId) {
            return;
        }

        const fetchActiveOrders = async () => {
            if (!sessionId) {
                return;
            }

            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000 * 4).toISOString();

            const { data, error } = await supabase
                .from('orders')
                .select('id, status, payment_status, payment_method, mercadopago_preference_id, order_number, total_amount, pickup_code, created_at')
                .eq('restaurant_id', restaurantId)
                .eq('client_session_id', sessionId)
                .neq('status', 'cancelled')
                .neq('status', 'delivered')
                .neq('status', 'completed')
                .gte('created_at', fifteenMinutesAgo)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setActiveOrders(data.map(d => ({
                    id: d.id,
                    status: d.status || 'pending',
                    payment_status: d.payment_status || 'unpaid',
                    payment_method: d.payment_method || 'unknown',
                    mercadopago_preference_id: d.mercadopago_preference_id,
                    order_number: d.order_number,
                    total_amount: d.total_amount,
                    pickup_code: d.pickup_code || undefined,
                    created_at: d.created_at
                })));
            } else {
                setActiveOrders([]);
            }
        };

        fetchActiveOrders();

        const interval = setInterval(fetchActiveOrders, 30000);
        return () => clearInterval(interval);
    }, [restaurantId]);

    if (activeOrders.length === 0) return null;

    const getStatusLabel = (status: string, paymentStatus: string) => {
        if (paymentStatus === 'pending' || paymentStatus === 'unpaid') return "Pendiente de pago";
        if (status === 'pending') return "Enviado a cocina";
        if (status === 'paid') return "Pagado";
        if (status === 'preparation') return "Preparando";
        if (status === 'ready_to_deliver') return "Listo para retirar";
        return "En proceso";
    };

    const getStatusIcon = (status: string, paymentStatus: string) => {
        if (paymentStatus === 'unpaid') return <CreditCard className="w-5 h-5" />;
        if (status === 'preparation') return <ChefHat className="w-5 h-5" />;
        if (status === 'ready_to_deliver') return <CheckCircle2 className="w-5 h-5" />;
        return <Clock className="w-5 h-5" />;
    };

    const primaryOrder = activeOrders.find(o => o.status === 'ready_to_deliver') || activeOrders[0];

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-24 right-4 z-40 md:bottom-8"
                >
                    <Button
                        variant="default"
                        size="lg"
                        className="shadow-xl rounded-full px-5 h-12 bg-primary text-primary-foreground border-2 border-primary-foreground/20 animate-in fade-in zoom-in duration-300 relative"
                    >
                        {/* Badge for multiple orders */}
                        {activeOrders.length > 1 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white">
                                {activeOrders.length}
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            {getStatusIcon(primaryOrder.status, primaryOrder.payment_status)}
                            <div className="flex flex-col items-start leading-tight">
                                <span className="text-xs font-medium opacity-90">
                                    {activeOrders.length > 1 ? 'Pedidos Activos' : 'Tu Pedido'}
                                </span>
                                <span className="font-bold text-sm">
                                    {getStatusLabel(primaryOrder.status, primaryOrder.payment_status)}
                                </span>
                            </div>
                        </div>
                    </Button>
                </motion.div>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[20px] h-[60vh] flex flex-col p-0">
                <SheetHeader className="p-6 pb-2">
                    <SheetTitle className="flex items-center gap-2 text-xl">
                        <Receipt className="w-5 h-5 text-primary" />
                        Tus Pedidos ({activeOrders.length})
                    </SheetTitle>
                </SheetHeader>

                <ScrollArea className="flex-1 p-6 pt-2">
                    <div className="space-y-4 pb-8">
                        {activeOrders.map((order) => {

                            const isUnpaidMP =
                                order.payment_status === 'unpaid' &&
                                order.payment_method === 'mercadopago' &&
                                order.mercadopago_preference_id;

                            return (
                                <div key={order.id} className="bg-muted/30 border border-border rounded-xl p-4 relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                                                {order.pickup_code ? 'CÓDIGO' : 'ORDEN #'}
                                            </p>
                                            <p className="text-2xl font-bold tracking-tight">
                                                {order.pickup_code || order.order_number}
                                            </p>
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold ${order.status === 'ready' ? 'bg-green-100 text-green-700' :
                                            order.status === 'preparing' ? 'bg-amber-100 text-amber-700' :
                                                isUnpaidMP ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-primary/10 text-primary'
                                            }`}>
                                            {getStatusIcon(order.status, order.payment_status)}
                                            {getStatusLabel(order.status, order.payment_status)}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-sm border-t border-border/50 pt-3">
                                        <span className="text-muted-foreground">Total</span>
                                        <span className="font-bold">${order.total_amount.toLocaleString()}</span>
                                    </div>

                                    {/* BOTÓN DE PAGO INYECTADO AQUÍ */}
                                    {isUnpaidMP && (
                                        <div className="mt-3 pt-2">
                                            <Button
                                                className="w-full bg-primary font-bold shadow-md"
                                                onClick={() => handleRetryPayment(order.mercadopago_preference_id!)}
                                            >
                                                Pagar Ahora
                                            </Button>
                                        </div>
                                    )}

                                    <div className="absolute top-0 right-0 p-2 opacity-5">
                                        <Receipt className="w-24 h-24" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 pt-0">
                        <Button className="w-full h-12 rounded-xl text-base" onClick={() => setIsOpen(false)}>
                            Cerrar
                        </Button>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
};