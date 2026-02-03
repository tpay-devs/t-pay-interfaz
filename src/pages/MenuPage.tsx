import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import RestaurantInfo from '@/components/RestaurantInfo';
import CategoryTabs from '@/components/CategoryTabs';
import ProductSection from '@/components/ProductSection';
import FloatingCart from '@/components/FloatingCart';
import { OrderStatusTracker } from "@/components/OrderStatusTracker";
import { motion, AnimatePresence } from 'framer-motion';
import { useRestaurant } from '@/context/RestaurantContext';
import { useMenuData } from '@/hooks/useSupabaseData';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { getClientSessionId } from '@/utils/clientSession';

const MenuPage = () => {
  const { restaurantId, isTakeaway, isLoading: isContextLoading, error } = useRestaurant();

  // Aseguramos pasar un string vacío si es null para que el hook no falle, 
  // pero la validación de abajo nos protegerá.
  const { categories, menuItems, loading: isMenuLoading } = useMenuData(restaurantId || "");

  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  // Cleanup abandoned draft orders (takeaway + MP that weren't paid)
  useEffect(() => {
    const cleanupDraftOrders = async () => {
      if (!isTakeaway || !restaurantId) return;

      const sessionId = getClientSessionId();
      if (!sessionId) return;

      const { data: draftOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('client_session_id', sessionId)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'draft');

      if (draftOrders && draftOrders.length > 0) {
        for (const order of draftOrders) {
          await supabase.from('orders').delete().eq('id', order.id);
        }
      }
    };

    cleanupDraftOrders();
  }, [isTakeaway, restaurantId]);

  // --- 🔥 CAMBIO 1: VALIDACIÓN DE ERROR PRIMERO ---
  // Si ya terminó de cargar el contexto y (hay error O falta el ID), mostramos error.
  // Esto evita que se quede mostrando Skeletons eternamente si el ID es undefined.
  if (!isContextLoading && (error || !restaurantId)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Restaurante no encontrado</h1>
        <p className="text-muted-foreground mb-6 max-w-[300px] mx-auto">
          {error?.message || "No pudimos identificar el restaurante. Por favor escanea el código QR nuevamente."}
        </p>
        <div className="p-4 bg-muted/50 rounded-xl text-xs text-muted-foreground break-all">
          ID Estado: {restaurantId ? "Inválido" : "No detectado"}
        </div>
      </div>
    );
  }

  // --- 🔥 CAMBIO 2: SKELETONS DESPUÉS ---
  // Solo mostramos carga si tenemos un ID válido y estamos esperando datos.
  if (isContextLoading || isMenuLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-8">
        <Skeleton className="h-72 w-full rounded-b-3xl" />
        <div className="space-y-4 px-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  const mappedItems = menuItems.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description || "",
    price: item.price,
    image: item.image_url || "/placeholder.svg",
    category: item.category_id || "uncategorized",
    rating: 5.0,
    ingredients: [],
    extras: []
  }));

  const filteredItems = mappedItems.filter((item) => item.category === activeCategory);

  const getCategoryTitle = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : 'Menú';
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Hero Section */}
      <div className="relative h-72">
        <Header />
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.8 }}
          src={"/hero-burger.jpg"}
          alt="Hero"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      {/* Restaurant Info Card */}
      <RestaurantInfo />

      {/* Category Tabs (Mapped from DB) */}
      <CategoryTabs
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      {/* Products */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <ProductSection
            title={getCategoryTitle(activeCategory)}
            items={filteredItems}
          />
        </motion.div>
      </AnimatePresence>

      <FloatingCart />
      <OrderStatusTracker />
    </div>
  );
};

export default MenuPage;