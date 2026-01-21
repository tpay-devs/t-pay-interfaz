import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import RestaurantInfo from '@/components/RestaurantInfo';
import CategoryTabs from '@/components/CategoryTabs';
import ProductSection from '@/components/ProductSection';
import FloatingCart from '@/components/FloatingCart';
import { OrderStatusTracker } from "@/components/OrderStatusTracker";import { motion, AnimatePresence } from 'framer-motion';
import { useRestaurant } from '@/context/RestaurantContext';
import { useMenuData } from '@/hooks/useSupabaseData';
import { Skeleton } from '@/components/ui/skeleton';

const MenuPage = () => {
  // 1. Get the Restaurant ID from our Context
  const { restaurantId, isLoading: isContextLoading, error } = useRestaurant();

  // 2. Fetch Real Menu Data using the ID
  const { categories, menuItems, loading: isMenuLoading } = useMenuData(restaurantId || "");

  const [activeCategory, setActiveCategory] = useState('');

  // 3. Set default category once data loads
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  // 4. Loading State
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

  // 5. Error State (No ID or ID not found)
  if (error || !restaurantId) {
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
          ID: {restaurantId || "Desconocido"}
        </div>
      </div>
    );
  }

  // 6. Data Mapping (Database -> UI Format)
  // The UI components expect specific fields like 'image' and 'rating' that might be named differently in DB
  const mappedItems = menuItems.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description || "",
    price: item.price,
    image: item.image_url || "/placeholder.svg", // Handle missing images
    category: item.category_id || "uncategorized",
    rating: 5.0, // Default rating as DB doesn't have it yet
    ingredients: [], // Details are loaded in ProductPage
    extras: []
  }));

  // Filter items by the active category tab
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
          // Use real cover image if available, else fallback
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
        categories={categories.map(c => ({ id: c.id, name: c.name }))} // Pass real categories
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