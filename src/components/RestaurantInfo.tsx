import { Utensils } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRestaurant } from '@/context/RestaurantContext';
import { Skeleton } from '@/components/ui/skeleton';

const RestaurantInfo = () => {
  const { restaurant, isLoading } = useRestaurant();

  if (isLoading) {
    return (
      <div className="mx-4 -mt-12 relative z-10">
        <div className="bg-card rounded-2xl p-4 shadow-xl border border-border/30">
          <div className="flex items-center gap-3">
            <Skeleton className="w-14 h-14 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5, ease: "easeOut" }} 
      className="bg-card rounded-2xl p-4 mx-4 -mt-12 relative z-10 shadow-xl shadow-black/5 border border-border/30"
    >
      <div className="flex items-start gap-3.5">
        <motion.div 
          initial={{ scale: 0.8 }} 
          animate={{ scale: 1 }} 
          transition={{ delay: 0.2, type: "spring", stiffness: 300 }} 
          className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
        >
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-bold text-amber-700 tracking-wide">RESTO</span>
          )}
        </motion.div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{restaurant?.name || "Cargando..."}</h1>
          <span className="text-xs text-muted-foreground font-medium mt-0.5">
            {restaurant?.address || ""}
          </span>
        </div>
      </div>
      
      {restaurant?.welcome_message && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.3 }} 
          className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50"
        >
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center">
              <Utensils className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground leading-tight">
              {restaurant.welcome_message}
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default RestaurantInfo;