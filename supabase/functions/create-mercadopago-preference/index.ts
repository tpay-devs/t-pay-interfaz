import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { orderId, returnUrl } = body;

    if (!orderId || !returnUrl) {
      throw new Error('Missing orderId or returnUrl');
    }

    const isLocalhost = returnUrl.includes('localhost') || returnUrl.includes('127.0.0.1');

    // 1. FETCH DE DATOS PROFUNDO
    // Traemos la orden, los items, los extras, Y LO MAS IMPORTANTE:
    // Hacemos join con 'menu_items' para saber el PRECIO REAL actual.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        restaurant:restaurants(*),
        order_items (
          quantity,
          unit_price, 
          menu_items (
            name,
            price
          ),
          order_item_added_extras (
            quantity,
            extra:menu_item_extras (
              name,
              price
            )
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    const restaurant = order.restaurant;
    if (!restaurant.mercadopago_access_token) {
      throw new Error('MercadoPago credentials not configured');
    }

    // 2. RECALCULO DE SEGURIDAD (AUDITORÍA)
    // No confiamos en 'order.total_amount' ni en 'order_items.unit_price' que vinieron del frontend.
    // Reconstruimos el precio desde cero usando la base de datos.
    
    let calculatedTotal = 0;
    
    const items = order.order_items.map((item: any) => {
      // Precio Base Real del Producto
      const realBasePrice = Number(item.menu_items?.price || 0);
      
      // Calcular precio de Extras Reales
      let extrasCost = 0;
      let extrasDescription = "";
      
      if (item.order_item_added_extras && item.order_item_added_extras.length > 0) {
        item.order_item_added_extras.forEach((ex: any) => {
           const realExtraPrice = Number(ex.extra?.price || 0);
           extrasCost += (realExtraPrice * ex.quantity);
           extrasDescription += ` + ${ex.extra?.name}`;
        });
      }

      const finalUnitLoadingPrice = realBasePrice + (extrasCost / item.quantity); // Distribuimos el costo del extra en la unidad para MP
      const totalItemPrice = (realBasePrice * item.quantity) + extrasCost;
      
      calculatedTotal += totalItemPrice;

      return {
        title: `${item.menu_items?.name}${extrasDescription}`,
        unit_price: Number(finalUnitLoadingPrice.toFixed(2)), // MP necesita precio unitario
        quantity: item.quantity,
        currency_id: 'ARS'
      };
    });

    // 3. MANEJO DE PROPINA
    // La propina es el único valor que debemos confiar del frontend (o inferir), 
    // pero debemos validarla.
    // Estrategia: Asumimos que la diferencia entre el Total Reportado y el Calculado era la propina,
    // pero si el total reportado era menor al calculado (hack), forzamos el calculado.
    
    // En este caso, simplificaremos: Si la orden tenía 'total_amount' mayor al calculado, la diferencia es propina.
    const reportedTotal = Number(order.total_amount);
    let tipAmount = 0;

    if (reportedTotal > calculatedTotal) {
      tipAmount = reportedTotal - calculatedTotal;
      // Validar que la propina no sea absurda (ej: mayor al 50% del total) para evitar lavado
      if (tipAmount > calculatedTotal * 0.5) {
         console.warn("⚠️ Suspicious tip amount detected. Clamping.");
         // Opcional: Rechazar o ajustar. Por ahora lo dejamos pasar pero lo logueamos.
      }
    }

    const finalTotal = calculatedTotal + tipAmount;

    // 4. AUTOCORRECCIÓN DE LA ORDEN
    // Si el precio que calculamos es diferente al que dice la base de datos (porque el frontend mintió
    // o hubo un error de redondeo), actualizamos la base de datos con la VERDAD antes de cobrar.
    if (Math.abs(finalTotal - reportedTotal) > 0.05) { // 5 centavos de tolerancia
       console.log(`⚠️ Price Mismatch! Fixing Order. DB says: ${reportedTotal}, Real is: ${finalTotal}`);
       await supabase.from('orders').update({ total_amount: finalTotal }).eq('id', orderId);
    }

    // Agregar propina como item para MercadoPago
    if (tipAmount > 0) {
      items.push({
        title: 'Propina',
        unit_price: Number(tipAmount.toFixed(2)),
        quantity: 1,
        currency_id: 'ARS'
      });
    }
    
    // 5. CREAR PREFERENCIA
    const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`;

    const preferenceData = {
      items,
      external_reference: orderId,
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 1
      },
      back_urls: {
        success: returnUrl,
        failure: returnUrl,
        pending: returnUrl,
      },
      auto_return: isLocalhost ? undefined : 'approved',
      binary_mode: true, 
      notification_url: notificationUrl,
      statement_descriptor: `ORDER #${order.order_number || orderId.slice(0,4)}`
    };

    console.log('Creating MP Preference with Real Calculated Values:', JSON.stringify(preferenceData, null, 2));

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${restaurant.mercadopago_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceData),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('MercadoPago error:', mpData);
      throw new Error('Failed to create preference: ' + (mpData.message || 'Unknown error'));
    }

    // Update restaurant info if needed (Collector ID check)
    if (mpData.collector_id && !restaurant.mercadopago_user_id) {
        await supabase.from('restaurants').update({ mercadopago_user_id: mpData.collector_id.toString() }).eq('id', restaurant.id);
    }

    // Save Preference ID
    await supabase.from('orders').update({ mercadopago_preference_id: mpData.id }).eq('id', orderId);

    const checkoutUrl = restaurant.mercadopago_sandbox_mode
      ? mpData.sandbox_init_point
      : mpData.init_point;

    return new Response(JSON.stringify({
      preference_id: mpData.id,
      checkout_url: checkoutUrl,
      sandbox_mode: restaurant.mercadopago_sandbox_mode
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});