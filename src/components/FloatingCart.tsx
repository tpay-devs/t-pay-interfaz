import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, ArrowRight, X, Minus, Plus, Trash2 } from 'lucide-react';
const FloatingCart = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const {
    items,
    totalItems,
    subtotal,
    updateQuantity,
    removeItem
  } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const formatPrice = (price: number) => {
    return `$${price.toLocaleString('es-AR', {
      minimumFractionDigits: 2
    })}`;
  };
  const handleGoToCheckout = () => {
    setIsCartOpen(false);
    navigate({
      pathname: '/checkout',
      search: location.search
    });
  };
  return createPortal(<>
    {/* Floating Cart Button - Rendered in Portal for true fixed positioning */}
    <AnimatePresence>
      {totalItems > 0 && <motion.div initial={{
        y: 100,
        opacity: 0
      }} animate={{
        y: 0,
        opacity: 1
      }} exit={{
        y: 100,
        opacity: 0
      }} transition={{
        type: "spring",
        stiffness: 300,
        damping: 30
      }} className="fixed bottom-0 left-0 right-0 z-[100] p-4" style={{
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
      }}>
        <button onClick={() => setIsCartOpen(true)} className="w-full text-white py-4 px-5 rounded-2xl shadow-2xl flex items-center justify-between transition-colors bg-primary">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 px-3 py-2 rounded-xl flex items-center gap-1.5 min-w-fit">
              <ShoppingBag className="w-5 h-5" />
              <span className="font-bold">{totalItems}</span>
            </div>
            <span className="font-bold text-lg">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex items-center gap-2 bg-white/25 px-5 py-2.5 rounded-xl">
            <span className="font-semibold">Ver carrito</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </motion.div>}
    </AnimatePresence>

    {/* Cart Dropdown */}
    <AnimatePresence>
      {isCartOpen && <>
        {/* Backdrop */}
        <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} exit={{
          opacity: 0
        }} onClick={() => setIsCartOpen(false)} className="fixed inset-0 bg-black/40 z-[100]" />

        {/* Cart Panel */}
        <motion.div initial={{
          y: "100%"
        }} animate={{
          y: 0
        }} exit={{
          y: "100%"
        }} transition={{
          type: "spring",
          stiffness: 300,
          damping: 30
        }} className="fixed bottom-0 left-0 right-0 z-[101] bg-card rounded-t-2xl border-t border-border max-h-[75vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="font-semibold">Tu carrito</h2>
              <p className="text-xs text-muted-foreground">{totalItems} productos</p>
            </div>
            <button onClick={() => setIsCartOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.map(item => {
              const extrasTotal = item.extras?.reduce((sum, e) => sum + e.price, 0) || 0;
              const itemTotal = (item.price + extrasTotal) * item.quantity;
              return <div key={item.id} className="flex gap-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    <span className="font-semibold text-sm flex-shrink-0">{formatPrice(itemTotal)}</span>
                  </div>
                  {item.extras && item.extras.length > 0 && <p className="text-xs text-muted-foreground truncate">
                    + {item.extras.map(e => e.name).join(', ')}
                  </p>}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center hover:bg-muted transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center hover:bg-muted transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>;
            })}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-lg font-bold">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsCartOpen(false)} className="flex-1 py-3 rounded-xl font-medium border border-border hover:bg-muted transition-colors">
                Seguir pidiendo
              </button>
              <button onClick={handleGoToCheckout} className="flex-1 py-3 rounded-xl font-medium bg-primary text-primary-foreground flex items-center justify-center gap-2">
                <span>Pagar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </>}
    </AnimatePresence>
  </>, document.body);
};
export default FloatingCart;