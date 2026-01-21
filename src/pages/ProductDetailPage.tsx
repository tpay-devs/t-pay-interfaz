import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useDishCustomization } from '@/hooks/useDishCustomization';
import { Tables } from '@/integrations/supabase/types';
import { Skeleton } from '@/components/ui/skeleton';

// Helper type for the UI
interface UIProduct extends Tables<'menu_items'> {
  rating?: number;
  badge?: string;
}

// Helper type for Extras (We strictly need the ID now)
interface UIExtra {
  id: string;
  name: string;
  price: number;
}

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { restaurantId, tableId, table, isTakeaway } = useRestaurant();

  const [product, setProduct] = useState<UIProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);

  // Fetch Ingredients & Extras
  const {
    ingredients: dbIngredients,
    extras: dbExtras,
    loading: loadingCustomization
  } = useDishCustomization(id || null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setProduct(data);
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoadingProduct(false);
      }
    };
    fetchProduct();
  }, [id]);

  const [quantity, setQuantity] = useState(1);
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);
  // CHANGED: We now store the full UIExtra object (with ID)
  const [selectedExtras, setSelectedExtras] = useState<UIExtra[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  if (loadingProduct || loadingCustomization) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col gap-6">
        <Skeleton className="w-full h-80 rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="w-2/3 h-8" />
          <Skeleton className="w-full h-20" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Producto no encontrado</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium">
          Volver al menú
        </button>
      </div>
    );
  }

  const formatPrice = (price: number) => `$${price.toLocaleString('es-AR')}`;

  const toggleIngredient = (ingredientName: string) => {
    setRemovedIngredients((prev) =>
      prev.includes(ingredientName) ? prev.filter((i) => i !== ingredientName) : [...prev, ingredientName]
    );
  };

  // CHANGED: Toggle logic now compares IDs to be safe
  const toggleExtra = (extra: UIExtra) => {
    setSelectedExtras((prev) =>
      prev.some((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const totalPrice = (product.price + extrasTotal) * quantity;

  const handleAddToCart = () => {
    setIsAdding(true);

    // We pass the full extra objects (with IDs) to the cart
    addItem({
      id: `${product.id}-${Date.now()}`,
      originalProductId: product.id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      quantity,
      image: product.image_url || "/placeholder.svg",
      extras: selectedExtras, // This now includes IDs!
      removedIngredients,
    });

    setTimeout(() => {
      setIsAdding(false);
      if (isTakeaway && restaurantId) {
        navigate(`/?id=rst_${restaurantId}`);
      } else if (table) {
        navigate(`/?id=${(table as any).qr_code_id || (tableId ? `tbl_${tableId}` : '')}`);
      } else {
        navigate(-1);
      }
    }, 600);
  };

  const handleBack = () => {
    if (isTakeaway && restaurantId) {
      navigate(`/?id=rst_${restaurantId}`);
    } else if (table) {
      navigate(`/?id=${(table as any).qr_code_id || (tableId ? `tbl_${tableId}` : '')}`);
    } else {
      navigate(-1);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background flex flex-col">
      <div className="relative h-80">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleBack}
          className="absolute top-4 left-4 z-10 w-11 h-11 glass rounded-full flex items-center justify-center shadow-lg bg-white/20 backdrop-blur-sm text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6 }}
          src={product.image_url || "/placeholder.svg"}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div >

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="flex-1 bg-background rounded-t-3xl -mt-6 relative z-10 px-5 pt-6 pb-32"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="text-right ml-auto">
            <motion.p key={totalPrice} initial={{ scale: 1.1 }} animate={{ scale: 1 }} className="text-2xl font-bold">
              {formatPrice(product.price)}
            </motion.p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Precio base</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">{product.description}</p>

        {dbIngredients.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Ingredientes</h2>
              <span className="text-[11px] text-muted-foreground">Toca para quitar</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {dbIngredients.map((ingredient, index) => (
                <motion.button
                  key={ingredient.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleIngredient(ingredient.name)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${removedIngredients.includes(ingredient.name) ? 'bg-destructive/10 text-destructive line-through' : 'bg-muted text-foreground'
                    }`}
                >
                  {ingredient.name}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {dbExtras.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Extras</h2>
              <span className="text-[11px] text-muted-foreground">Toca para añadir</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {dbExtras.map((extra, index) => (
                <motion.button
                  key={extra.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 + index * 0.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleExtra({ id: extra.id, name: extra.name, price: extra.price })}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${selectedExtras.some((e) => e.id === extra.id) ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-foreground'
                    }`}
                >
                  {extra.name} <span className="opacity-70">+{formatPrice(extra.price)}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 30 }} className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/30 p-4 flex items-center gap-4">
        <div className="flex items-center bg-muted rounded-2xl overflow-hidden">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-14 h-14 flex items-center justify-center"><Minus className="w-5 h-5" /></motion.button>
          <motion.span key={quantity} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="w-8 text-center font-bold text-lg">{quantity}</motion.span>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setQuantity(q => q + 1)} className="w-14 h-14 flex items-center justify-center"><Plus className="w-5 h-5" /></motion.button>
        </div>
        <motion.button whileTap={{ scale: 0.98 }} onClick={handleAddToCart} disabled={isAdding} className={`flex-1 py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all shadow-lg ${isAdding ? 'bg-success text-success-foreground shadow-success/30' : 'bg-primary text-primary-foreground shadow-primary/30'}`}>
          <AnimatePresence mode="wait">
            {isAdding ? <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2"><Check className="w-5 h-5" /><span>¡Agregado!</span></motion.div> : <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2"><span>Agregar</span><span className="font-bold">{formatPrice(totalPrice)}</span></motion.div>}
          </AnimatePresence>
        </motion.button>
      </motion.div>
    </motion.div >
  );
};

export default ProductDetailPage;