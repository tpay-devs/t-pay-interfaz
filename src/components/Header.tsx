import { ShoppingCart, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRestaurant } from '@/context/RestaurantContext'; 
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
  const { tableNumber, totalItems } = useCart();
  const { isTakeaway } = useRestaurant(); 
  const navigate = useNavigate();

  return (
    <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex items-center gap-3 glass rounded-full px-4 py-2.5 shadow-lg shadow-black/5"
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isTakeaway ? 'bg-orange-500' : 'bg-primary'}`}>
          {isTakeaway ? (
            <ShoppingBag className="w-4 h-4 text-white" />
          ) : (
            <span className="text-primary-foreground font-semibold text-sm">{tableNumber}</span>
          )}
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">
            {isTakeaway ? 'Modo' : 'Tu mesa'}
          </p>
          <p className="text-sm font-semibold leading-tight">
            {isTakeaway ? 'PARA LLEVAR' : `MESA ${tableNumber}`}
          </p>
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileTap={{ scale: 0.92 }}
        onClick={() => navigate('/checkout')}
        className="relative glass rounded-full p-3.5 shadow-lg shadow-black/5"
      >
        <ShoppingCart className="w-5 h-5" />
        <AnimatePresence mode="wait">
          {totalItems > 0 && (
            <motion.span
              key={totalItems}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="absolute -top-1 -right-1 min-w-[22px] h-[22px] bg-secondary text-secondary-foreground text-[11px] font-bold rounded-full flex items-center justify-center px-1.5 shadow-md"
            >
              {totalItems}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </header>
  );
};

export default Header;