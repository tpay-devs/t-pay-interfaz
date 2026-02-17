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

    // Return 200 immediately to keep MercadoPago happy
    const response = new Response('OK', { status: 200 });

    if (body.type !== 'payment') return response;

    const paymentId = body.data?.id;
    if (!paymentId) return response;

    console.log(`🔍 Processing Payment ID: ${paymentId}`);

    // 1. Find Restaurant
    const { data: restaurants, error: rError } = await supabase
      .from('restaurants')
      .select('id, name, logo_url, cover_image_url, primary_color, mercadopago_sandbox_mode, mercadopago_access_token')
      .eq('mercadopago_user_id', body.user_id?.toString() || '');

    if (rError || !restaurants?.length) {
      console.error('❌ Restaurant not found for MP User ID:', body.user_id);
      return response;
    }
    const restaurant = restaurants[0];

    // 2. Fetch Payment Details from MP
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${restaurant.mercadopago_access_token}`,
      },
    });

    if (!mpResponse.ok) {
      console.error('❌ Failed to fetch payment details from MP');
      return response;
    }

    const paymentData = await mpResponse.json();

    const orderId = paymentData.external_reference;
    const status = paymentData.status; // 'approved', 'rejected', etc.
    const paymentMethod = paymentData.payment_method_id;
    const payerEmail = paymentData.payer?.email || paymentData.additional_info?.payer?.email;
    const payerName = paymentData.payer?.first_name
      ? `${paymentData.payer.first_name} ${paymentData.payer.last_name || ''}`.trim()
      : null;

    console.log(`✅ Payment ${paymentId} for Order ${orderId} is: ${status}`);

    if (orderId) {
      const { data: currentOrder, error: currentOrderError } = await supabase
        .from('orders')
        .select('id, restaurant_id, table_id, pickup_code, order_number, total_amount, payment_status')
        .eq('id', orderId)
        .single();

      if (currentOrderError || !currentOrder) {
        console.error('❌ Order not found:', orderId, currentOrderError);
        return response;
      }

      // 3. Update Database based on Status
      const updateData: any = {
        mercadopago_payment_id: paymentId.toString(),
        mercadopago_payment_method: paymentMethod,
        payer_email: payerEmail,
        payer_name: payerName
      };

      // Si fue APROBADO
      if (status === 'approved') {
        updateData.payment_status = 'paid';
        // status stays 'pending' — kitchen picks it up from the kanban
      }
      // Si fue RECHAZADO
      else if (status === 'rejected' || status === 'cancelled') {
        updateData.payment_status = 'unpaid';
        // Keep as unpaid so the user can retry payment
      }

      const updateQuery = supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .neq('payment_status', 'paid')
        .select('id, table_id, pickup_code, order_number, total_amount, payment_status')
        .maybeSingle();

      const { data: updatedOrder, error: updateError } = await updateQuery;

      if (updateError) {
        console.error('❌ Database Update Failed:', updateError);
      } else {
        console.log(`🎉 Database updated: Order ${orderId} is now ${status}`);

        if (status === 'approved' && updatedOrder?.payment_status === 'paid' && payerEmail) {
          try {
            const isTakeaway = !updatedOrder.table_id;
            const pickupCode = updatedOrder.pickup_code || null;
            const emailRecipient = restaurant.mercadopago_sandbox_mode
              ? 'simonabelleyra@gmail.com'
              : payerEmail;

            console.log(`📧 Sending confirmation email to ${emailRecipient} for order ${updatedOrder.order_number}`);

            const emailResponse = await supabase.functions.invoke('send-order-confirmation', {
              body: {
                orderId: updatedOrder.id,
                orderNumber: updatedOrder.order_number || 0,
                totalAmount: updatedOrder.total_amount,
                payerEmail: emailRecipient,
                payerName: payerName,
                restaurantName: restaurant.name || 'Restaurant',
                restaurantLogo: restaurant.logo_url,
                coverImageUrl: restaurant.cover_image_url,
                primaryColor: restaurant.primary_color || '#059669',
                isTestEmail: restaurant.mercadopago_sandbox_mode,
                originalCustomerEmail: restaurant.mercadopago_sandbox_mode ? payerEmail : undefined,
                pickupCode: isTakeaway ? pickupCode : null,
                isTakeaway
              }
            });

            if (emailResponse.error) {
              console.error('❌ Failed to send confirmation email:', emailResponse.error);
            } else {
              console.log('✅ Confirmation email sent successfully');
            }
          } catch (emailError) {
            console.error('❌ Error sending confirmation email:', emailError);
          }
        } else if (status === 'approved' && !payerEmail) {
          console.log(`ℹ️ Skipping confirmation email for order ${orderId}: payer email missing`);
        }
      }
    }

    return response;

  } catch (error) {
    console.error('🔥 Webhook Error:', error);
    return new Response('Error', { status: 500 });
  }
});