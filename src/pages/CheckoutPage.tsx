import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Trash2, CreditCard, Banknote, ShieldCheck, Lock, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

type Step = 'cart' | 'payment';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const {
    items,
    tableNumber,
    subtotal,
    updateQuantity,
    removeItem,
    submitOrder,
    isSubmitting
  } = useCart();

  const { restaurantId, tableId, table, isTakeaway } = useRestaurant();

  const { toast } = useToast();

  const [step, setStep] = useState<Step>('cart');
  const [selectedTip, setSelectedTip] = useState<number | null>(10);
  const [paymentMethod, setPaymentMethod] = useState<'mercadopago' | 'cash'>('mercadopago');

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const tipPercentage = selectedTip ?? 0;
  const tipAmount = (subtotal * tipPercentage) / 100;
  const total = subtotal + tipAmount;

  const handlePayment = async () => {
    try {
      // 1. Submit Order to Backend
      const result = await submitOrder(paymentMethod, tipPercentage);

      // 2. Check Result
      if (result && result.success) {

        if (result.checkoutUrl) {
          console.log("🔗 Redirecting to Mercado Pago:", result.checkoutUrl);

          window.location.href = result.checkoutUrl;
          return; 
        }

        // 3. Normal Success (Cash)
        navigate('/success', {
          state: {
            orderNumber: result.orderData?.order_number?.toString() || result.orderData?.id.slice(0, 8),
            items,
            subtotal,
            tipAmount,
            total,
            tipPercentage,
            isTakeaway, 
            pickupCode: result.orderData?.pickup_code, 
            restaurantId 
          }
        });
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al procesar el pedido. Intenta nuevamente.",
        variant: "destructive"
      });
    }
  };

  const handleBack = () => {
    if (step === 'payment') {
      setStep('cart');
    } else {
      navigate(-1);
    }
  };

  const handleReturnToMenu = () => {
    if (isTakeaway && restaurantId) {
      navigate(`/?id=rst_${restaurantId}`); 
    } else if (table) {
      const qrId = (table as any).qr_code_id || (tableId ? `tbl_${tableId}` : null);
      if (qrId) navigate(`/?id=${qrId}`);
      else navigate('/');
    } else {
      navigate('/');
    }
  };

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-background flex flex-col items-center justify-center p-8"
      >
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <CreditCard className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground mb-6 text-center">Tu carrito está vacío</p>
        <button
          onClick={handleReturnToMenu}
          className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-medium"
        >
          Ver menú
        </button>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-background z-10 border-b border-border">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-semibold">
              {step === 'cart' ? 'Tu pedido' : 'Confirmar pago'}
            </h1>
            <span className="text-xs text-muted-foreground">Mesa {tableNumber}</span>
          </div>
          <div className="w-10" />
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 px-4 pb-3">
          <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'cart' ? 'bg-primary' : 'bg-primary'}`} />
          <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'payment' ? 'bg-primary' : 'bg-muted'}`} />
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === 'cart' ? (
          <motion.div
            key="cart"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col"
          >
            {/* Cart Items */}
            <div className="flex-1 p-4 space-y-3">
              {items.map((item) => {
                const extrasTotal = item.extras?.reduce((sum, e) => sum + e.price, 0) || 0;
                const itemTotal = (item.price + extrasTotal) * item.quantity;

                return (
                  <div
                    key={item.id}
                    className="flex gap-3 bg-card rounded-xl p-3 border border-border"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm">{item.name}</h3>
                          {item.extras && item.extras.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              + {item.extras.map((e) => e.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="font-semibold text-sm flex-shrink-0">
                          {formatPrice(itemTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cart Footer */}
            <div className="p-4 border-t border-border bg-background space-y-3">
              <button
                onClick={handleReturnToMenu}
                className="w-full py-3 rounded-xl font-medium border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar más productos</span>
              </button>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal ({items.length} productos)</span>
                <span className="text-lg font-bold">{formatPrice(subtotal)}</span>
              </div>
              <button
                onClick={() => setStep('payment')}
                className="w-full py-4 rounded-xl font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2"
              >
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col"
          >
            <div className="flex-1 p-4 space-y-4">
              {/* Tip Selection */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h2 className="text-sm font-semibold mb-3">Propina (opcional)</h2>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 5, 10, 15].map((tip) => (
                    <button
                      key={tip}
                      onClick={() => setSelectedTip(tip)}
                      className={`py-3 rounded-lg text-sm font-medium transition-all border ${selectedTip === tip
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:border-primary/50'
                        }`}
                    >
                      {tip === 0 ? 'Sin' : `${tip}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h2 className="text-sm font-semibold mb-3">Método de pago</h2>
                <div className="space-y-2">
                  {[
                    { id: 'mercadopago' as const, icon: CreditCard, label: 'Mercado Pago', sublabel: 'Paga con tu plata en cuenta o tarjetas agregadas a Mercado Pago' },
                    { id: 'cash' as const, icon: Banknote, label: 'Efectivo', sublabel: 'Pagar al mozo' },
                  ].map(({ id, icon: Icon, label, sublabel }) => (
                    <button
                      key={id}
                      onClick={() => setPaymentMethod(id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all border ${paymentMethod === id
                        ? 'bg-primary/5 border-primary'
                        : 'bg-background border-border hover:border-primary/50'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${paymentMethod === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left flex-1">
                        <span className="font-medium text-sm block">{label}</span>
                        <span className="text-xs text-muted-foreground">{sublabel}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === id ? 'border-primary' : 'border-muted-foreground/30'
                        }`}>
                        {paymentMethod === id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h2 className="text-sm font-semibold mb-3">Resumen</h2>
                <div className="space-y-2 text-sm">
                  {items.map((item) => {
                    const extrasTotal = item.extras?.reduce((sum, e) => sum + e.price, 0) || 0;
                    const itemTotal = (item.price + extrasTotal) * item.quantity;
                    return (
                      <div key={item.id} className="flex justify-between text-muted-foreground">
                        <span>{item.quantity}x {item.name}</span>
                        <span>{formatPrice(itemTotal)}</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatPrice(subtotal)}</span>
                    </div>
                    {tipAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Propina ({tipPercentage}%)</span>
                        <span className="font-medium">{formatPrice(tipAmount)}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border pt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl font-bold">{formatPrice(total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Footer */}
            <div className="p-4 border-t border-border bg-background">
              <button
                onClick={handlePayment}
                disabled={isSubmitting} 
                className="w-full py-4 rounded-xl font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                    />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pagar {formatPrice(total)}</span>
                  </>
                )}
              </button>
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Pago 100% seguro</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CheckoutPage;