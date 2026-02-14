import { Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductCardProps {
  item: {
    id: string;
    name: string;
    description?: string;
    price: number;
    image: string;
    originalPrice?: number;
  };
  index?: number;
}

const ProductCard = ({ item, index = 0 }: ProductCardProps) => {
  const navigate = useNavigate();
  const { addItem, getProductQuantity, items, updateQuantity, removeItem } = useCart();
  
  const quantityInCart = getProductQuantity(item.id);
  
  const existingCartItem = items.find((i) => i.originalProductId === item.id);

  const formatPrice = (price: number) => {
    return `$ ${price.toLocaleString('es-AR')}`;
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    addItem({
      id: `${item.id}-${Date.now()}`,
      originalProductId: item.id, 
      name: item.name,
      description: item.description || "",
      price: item.price,
      quantity: 1,
      image: item.image,
      extras: [],
      removedIngredients: [],
    });
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (existingCartItem) {
      if (existingCartItem.quantity > 1) {
        updateQuantity(existingCartItem.id, existingCartItem.quantity - 1);
      } else {
        removeItem(existingCartItem.id);
      }
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (existingCartItem) {
      updateQuantity(existingCartItem.id, existingCartItem.quantity + 1);
    } else {
      handleAddClick(e);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="group"
    >
      <motion.div 
        whileTap={{ scale: 0.98 }}
        className="relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-pointer shadow-sm"
        onClick={() => navigate(`/product/${item.id}`)}
      >
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="absolute bottom-3 right-3">
          <AnimatePresence mode="wait">
            {quantityInCart === 0 ? (
              <motion.button
                key="add"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleAddClick}
                className="w-11 h-11 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/30 transition-transform"
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
              </motion.button>
            ) : (
              <motion.div 
                key="quantity"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center glass rounded-full p-1.5 shadow-lg bg-white/90 backdrop-blur-sm"
              >
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleDecrement}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                >
                  <Minus className="w-4 h-4" />
                </motion.button>
                <motion.span 
                  key={quantityInCart}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className="w-8 text-center text-sm font-bold"
                >
                  {quantityInCart}
                </motion.span>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleIncrement}
                  className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      
      <div className="mt-3 px-0.5">
        <h3 
          className="font-semibold text-sm truncate cursor-pointer hover:text-primary transition-colors"
          onClick={() => navigate(`/product/${item.id}`)}
        >
          {item.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-bold text-base">{formatPrice(item.price)}</span>
          {item.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(item.originalPrice)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;