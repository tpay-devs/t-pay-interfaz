import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { getClientSessionId } from '@/utils/clientSession'
import type { Database } from '@/integrations/supabase/types'

type Tables = Database['public']['Tables']
type MenuItems = Tables['menu_items']['Row']

const PICKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PICKUP_CODE_LENGTH = 5

const generatePickupCode = () => {
  const alphabet = PICKUP_CODE_ALPHABET
  const length = PICKUP_CODE_LENGTH
  let fallbackCode = ''
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * alphabet.length)
    fallbackCode += alphabet[index]
  }
  return fallbackCode
}

interface OrderItem {
  menuItem: MenuItems
  quantity: number
  specialInstructions?: string
  removedIngredients?: string[]
  addedExtras?: { id: string; name: string; price: number; quantity: number }[]
  uniqueKey: string
}

const createOrderItemKey = (
  menuItemId: string,
  specialInstructions?: string,
  removedIngredients?: string[],
  addedExtras?: { id: string; name: string; price: number; quantity: number }[]
): string => {
  const sortedRemovedIngredients = removedIngredients?.sort().join(',') || ''
  const sortedAddedExtras = addedExtras
    ?.sort((a, b) => a.id.localeCompare(b.id))
    .map(extra => `${extra.id}:${extra.quantity}`)
    .join(',') || ''

  return `${menuItemId}|${specialInstructions || ''}|${sortedRemovedIngredients}|${sortedAddedExtras}`
}

export const useOrderManagement = (tableId: string | null, restaurantId: string, isTakeaway = false) => {
  const [orderItems, setOrderItems] = useState<OrderItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(`cart_${restaurantId}`)
      return saved ? JSON.parse(saved) : []
    } catch (e) {
      console.error('Error loading cart:', e)
      return []
    }
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const cartClearedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!restaurantId) return;
    localStorage.setItem(`cart_${restaurantId}`, JSON.stringify(orderItems));
  }, [orderItems, restaurantId]);

  const addToOrder = (
    menuItem: MenuItems,
    quantity = 1,
    specialInstructions?: string,
    removedIngredients?: string[],
    addedExtras?: { id: string; name: string; price: number; quantity: number }[]
  ) => {
    const uniqueKey = createOrderItemKey(menuItem.id, specialInstructions, removedIngredients, addedExtras)

    setOrderItems(prev => {
      const existingItem = prev.find(item => item.uniqueKey === uniqueKey)
      if (existingItem) {
        return prev.map(item =>
          item.uniqueKey === uniqueKey
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, { menuItem, quantity, specialInstructions, removedIngredients, addedExtras, uniqueKey }]
    })

    toast({
      title: "¡Agregado al pedido!",
      description: `${menuItem.name} se agregó a tu pedido`,
    })
  }

  const removeFromOrder = (uniqueKey: string) => {
    setOrderItems(prev => prev.filter(item => item.uniqueKey !== uniqueKey))
  }

  const updateQuantity = (uniqueKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromOrder(uniqueKey)
      return
    }
    setOrderItems(prev =>
      prev.map(item => item.uniqueKey === uniqueKey ? { ...item, quantity } : item)
    )
  }

  const getTotalAmount = () => {
    return orderItems.reduce((total, item) => {
      const basePrice = item.menuItem.price * item.quantity
      const extrasPrice = item.addedExtras?.reduce((extrasTotal, extra) =>
        extrasTotal + (extra.price * extra.quantity), 0) || 0
      return total + basePrice + extrasPrice
    }, 0)
  }

  const getItemCount = () => {
    return orderItems.reduce((total, item) => total + item.quantity, 0)
  }

  const submitOrder = async (notes?: string, clearCart = true, tipPercentage = 0, createPayment = false, paymentMethod = 'mercadopago', pickupTime?: string) => {
    if (orderItems.length === 0) {
      toast({ title: "Error", description: "No hay items en el pedido", variant: "destructive" })
      return { success: false, orderData: null }
    }

    if (!restaurantId) {
      toast({ title: "Error", description: "Restaurante no identificado.", variant: "destructive" })
      return { success: false, orderData: null }
    }

    setIsSubmitting(true)

    try {
      const subtotal = getTotalAmount()
      const tipAmount = subtotal * (tipPercentage / 100)
      const totalAmount = subtotal + tipAmount

      const orderData: any = {
        restaurant_id: restaurantId,
        total_amount: totalAmount,
        notes: notes || null,
        status: 'pending',
        payment_status: 'unpaid',
        payment_method: paymentMethod
      }

      if (isTakeaway) {
        orderData.table_id = null
        orderData.pickup_code = generatePickupCode()
      } else {
        orderData.table_id = tableId
      }

      const sessionId = getClientSessionId()
      orderData.client_session_id = sessionId

      const { count, error: countError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('client_session_id', sessionId)
        .neq('status', 'cancelled')
        .neq('status', 'delivered')
        .neq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) 

      if (countError) throw countError

      if (count !== null && count >= 5) {
        alert("Has alcanzado el límite de 5 pedidos activos.\n\nPor favor, espera a que tus pedidos anteriores sean entregados o completados antes de realizar uno nuevo.")
        setIsSubmitting(false) 
        return { success: false, orderData: null }
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single()

      if (orderError) throw orderError

      const orderItemsData = orderItems.map(item => ({
        order_id: order.id,
        menu_item_id: item.menuItem.id,
        quantity: item.quantity,
        unit_price: item.menuItem.price,
        special_instructions: item.specialInstructions || null
      }))

      const { data: createdOrderItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData)
        .select()

      if (itemsError) throw itemsError

      for (let i = 0; i < orderItems.length; i++) {
        const item = orderItems[i]
        const orderItemId = createdOrderItems[i].id

        if (item.addedExtras && item.addedExtras.length > 0) {
          const addedExtrasData = item.addedExtras.map(extra => ({
            order_item_id: orderItemId,
            extra_id: extra.id,
            quantity: extra.quantity,
            unit_price: extra.price
          }))

          const { error: extrasError } = await supabase
            .from('order_item_added_extras')
            .insert(addedExtrasData)

          if (extrasError) throw extrasError
        }
      }

      let checkoutUrl = null;

      if (createPayment && paymentMethod === 'mercadopago') {
        try {
          console.log("💳 Initiating MercadoPago Preference...");

          const { data: mpData, error: mpError } = await supabase.functions.invoke('create-mercadopago-preference', {
            body: {
              orderId: order.id,
              returnUrl: `${window.location.origin}/success`
            }
          });

          if (mpError) {
            console.error("❌ MercadoPago Function Error:", mpError);
            throw new Error("No se pudo conectar con el servicio de pagos.");
          }

          if (!mpData?.checkout_url) {
            console.error("❌ No checkout_url in response:", mpData);
            throw new Error("La respuesta del pago fue inválida.");
          }

          console.log("✅ Payment Link Created:", mpData.checkout_url);
          checkoutUrl = mpData.checkout_url;


        } catch (mpException: any) {
          console.error("❌ MercadoPago Exception:", mpException);
          await supabase.from('orders').delete().eq('id', order.id);
          
          toast({
            title: "Error de Pago",
            description: mpException.message || "Error generando el pago. Intente nuevamente.",
            variant: "destructive"
          });

          return { success: false, orderData: null };
        }
      }

      if (clearCart && !checkoutUrl) {
        setOrderItems([]);
        cartClearedAtRef.current = Date.now();
      }

      if (paymentMethod === 'cash' && !checkoutUrl) {
        toast({
          title: "¡Pedido enviado!",
          description: "Tu pedido ha sido enviado al restaurante",
        })
      }

      return { success: true, orderData: order, checkoutUrl }

    } catch (error: any) {
      console.error('Error submitting order:', error)
      toast({
        title: "Error",
        description: `Error: ${error?.message || 'No se pudo enviar el pedido.'}`,
        variant: "destructive"
      })
      return { success: false, orderData: null }
    } finally {
      setIsSubmitting(false)
    }
  }

  const refreshCart = async () => { };
  const clearCart = () => setOrderItems([]);

  return {
    orderItems,
    addToOrder,
    removeFromOrder,
    updateQuantity,
    getTotalAmount,
    getItemCount,
    submitOrder,
    isSubmitting,
    refreshCart,
    clearCart
  }
}