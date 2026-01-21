import React, { createContext, useContext, useMemo } from 'react';
import { useOrderManagement } from '@/hooks/useOrderManagement';
import { useRestaurant } from './RestaurantContext';
import { Tables } from '@/integrations/supabase/types';

export interface CartItem {
  id: string;
  originalProductId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  image: string;
  extras?: { id: string; name: string; price: number }[];
  removedIngredients?: string[];
  notes?: string;
}

interface CartContextType {
  items: CartItem[];
  tableNumber: number;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getProductQuantity: (productId: string) => number;
  totalItems: number;
  subtotal: number;
  submitOrder: (paymentMethod: 'mercadopago' | 'cash', tip?: number) => Promise<any>;
  isSubmitting: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { restaurantId, tableId, table, isTakeaway } = useRestaurant(); // Ensure isTakeaway is grabbed here

  const orderManager = useOrderManagement(tableId, restaurantId || "", isTakeaway);

  const cartItems: CartItem[] = useMemo(() => {
    return orderManager.orderItems.map((backendItem) => ({
      id: backendItem.uniqueKey,
      originalProductId: backendItem.menuItem.id,
      name: backendItem.menuItem.name,
      description: "",
      price: backendItem.menuItem.price,
      quantity: backendItem.quantity,
      image: backendItem.menuItem.image_url || "",
      extras: backendItem.addedExtras?.map(ext => ({
        id: ext.id,
        name: ext.name,
        price: ext.price
      })) || [],
      removedIngredients: backendItem.removedIngredients || [],
      notes: backendItem.specialInstructions
    }));
  }, [orderManager.orderItems]);

  const addItem = (uiItem: CartItem) => {
    if (!restaurantId) return;

    const fakeMenuItem = {
      id: uiItem.originalProductId,
      name: uiItem.name,
      price: uiItem.price,
      description: uiItem.description,
      image_url: uiItem.image,
      category_id: "",
      restaurant_id: restaurantId,
      available: true
    } as Tables<"menu_items">;

    const hookExtras = uiItem.extras?.map(e => ({
      id: e.id,
      name: e.name,
      price: e.price,
      quantity: 1
    }));

    orderManager.addToOrder(
      fakeMenuItem,
      uiItem.quantity,
      uiItem.notes || "",
      uiItem.removedIngredients,
      hookExtras
    );
  };

  const removeItem = (uniqueKey: string) => {
    orderManager.removeFromOrder(uniqueKey);
  };

  const updateQuantity = (uniqueKey: string, quantity: number) => {
    orderManager.updateQuantity(uniqueKey, quantity);
  };

  const clearCart = () => {
    orderManager.clearCart();
  };

  const getProductQuantity = (productId: string) => {
    return cartItems
      .filter((item) => item.originalProductId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const totalItems = orderManager.getItemCount();
  const subtotal = orderManager.getTotalAmount();

  const submitOrder = async (paymentMethod: 'mercadopago' | 'cash', tip: number = 0) => {
    // CRITICAL FIX: Allow if tableId exists OR if it is takeaway
    if (!tableId && !isTakeaway) {
      console.error("Submission Blocked: No table ID found and not in Takeaway mode.");
      return;
    }

    const isMercadoPago = paymentMethod === 'mercadopago';
    const backendMethod = isMercadoPago ? 'mercadopago' : 'cash_pos';

    return await orderManager.submitOrder(
      "",
      true,
      tip,
      isMercadoPago,
      backendMethod
    );
  };

  return (
    <CartContext.Provider
      value={{
        items: cartItems,
        tableNumber: table?.table_number || 0,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getProductQuantity,
        totalItems,
        subtotal,
        submitOrder,
        isSubmitting: orderManager.isSubmitting
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};