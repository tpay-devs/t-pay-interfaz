
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
    const { orderId, paymentId, merchantOrderId, tableId, paymentStatus } = body;

    console.log('Confirming payment with params:', { orderId, paymentId, merchantOrderId, tableId, paymentStatus });

    let resolvedOrderId: string | null = orderId || null;
    let resolvedPaymentId: string | null = paymentId || null;

    // Do NOT trust URL params alone; require API/webhook confirmation
    if (paymentStatus === 'approved' && resolvedOrderId && resolvedPaymentId) {
      console.log('Ignoring URL-only approved status; will verify via MercadoPago API/webhook');
    }


    // If we have paymentId but no orderId, and we have tableId, try to resolve the order
    if (paymentId && !resolvedOrderId && tableId) {
      console.log('Attempting to resolve orderId from paymentId and tableId');

      // Get restaurant info from table
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('restaurant_id')
        .eq('id', tableId)
        .single();

      if (tableError || !tableData) {
        console.error('Table not found:', tableError);
        return new Response(JSON.stringify({ error: 'Table not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('mercadopago_access_token, mercadopago_sandbox_mode')
        .eq('id', tableData.restaurant_id)
        .single();

      if (restaurantError || !restaurantData?.mercadopago_access_token) {
        console.error('Restaurant or token not found:', restaurantError);
        return new Response(JSON.stringify({ error: 'Restaurant credentials not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Try to get payment details to find external_reference (orderId)
      try {
        const mpApiUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;

        console.log('Fetching payment details from MercadoPago:', mpApiUrl);

        const mpResponse = await fetch(mpApiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${restaurantData.mercadopago_access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (mpResponse.ok) {
          const paymentData = await mpResponse.json();
          resolvedOrderId = paymentData.external_reference || null;
          console.log('Resolved orderId from payment:', resolvedOrderId);
        } else {
          console.log('Failed to fetch payment details, status:', mpResponse.status);
        }
      } catch (error) {
        console.error('Error fetching payment details:', error);
      }
    }

    // If we still don't have an orderId, we can't proceed
    if (!resolvedOrderId) {
      console.log('No orderId could be resolved');
      return new Response(JSON.stringify({ error: 'Order ID could not be determined' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Confirming payment for order:', resolvedOrderId, 'payment:', resolvedPaymentId);

    // Get order details including pickup_code for takeaway orders
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, pickup_code')
      .eq('id', resolvedOrderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If already paid, return success with pickup code for takeaway orders
    if (order.payment_status === 'paid') {
      return new Response(JSON.stringify({
        status: 'paid',
        message: 'Payment already confirmed',
        orderId: order.id,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        pickupCode: order.pickup_code || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get restaurant credentials
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('mercadopago_access_token, mercadopago_sandbox_mode')
      .eq('id', order.restaurant_id)
      .single();

    if (restaurantError || !restaurant?.mercadopago_access_token) {
      console.error('MercadoPago credentials not configured');
      return new Response(JSON.stringify({ error: 'Payment credentials not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to verify payment - with fallback logic
    let paymentData: any = null;
    const paymentIdToCheck = resolvedPaymentId;

    // First try: direct payment ID lookup
    if (paymentIdToCheck) {
      try {
        const mpApiUrl = `https://api.mercadopago.com/v1/payments/${paymentIdToCheck}`;

        console.log('Checking payment status with MercadoPago:', mpApiUrl);

        const mpResponse = await fetch(mpApiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${restaurant.mercadopago_access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (mpResponse.ok) {
          paymentData = await mpResponse.json();
          console.log('Found payment by ID:', paymentData.status);
        } else {
          console.log('Payment ID not found or invalid, trying fallback search');
        }
      } catch (error) {
        console.error('Error fetching payment by ID:', error);
      }
    }

    // Second try: search by external_reference if direct lookup failed
    if (!paymentData) {
      try {
        const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${resolvedOrderId}&sort=date_created&criteria=desc&range=date_created&begin_date=NOW-7DAYS&end_date=NOW`;

        console.log('Searching payments by external_reference:', resolvedOrderId);

        const searchResponse = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${restaurant.mercadopago_access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();

          // Find the most recent approved payment
          const approvedPayment = searchData.results?.find((payment: any) => payment.status === 'approved');

          if (approvedPayment) {
            paymentData = approvedPayment;
            console.log('Found approved payment by search:', approvedPayment.id);
          } else {
            console.log('No approved payments found in search results');
          }
        }
      } catch (error) {
        console.error('Error searching payments:', error);
      }
    }

    // Process payment if found
    if (paymentData) {
      console.log('Processing payment with status:', paymentData.status);

      if (paymentData.status === 'approved') {
        
        // Extract payer information (consistent with webhook logic)
        let payerEmail = paymentData.payer?.email;
        if (!payerEmail && paymentData.additional_info?.payer?.email) {
          payerEmail = paymentData.additional_info.payer.email;
        }

        let payerName = paymentData.payer ? 
          `${paymentData.payer.first_name || ''} ${paymentData.payer.last_name || ''}`.trim() || null 
          : null;
        
        if (!payerName && paymentData.additional_info?.payer) {
           const { first_name, last_name } = paymentData.additional_info.payer;
           if (first_name || last_name) {
               payerName = `${first_name || ''} ${last_name || ''}`.trim();
           }
        }

        console.log(`Payment confirmed. Payer info: Email=${payerEmail}, Name=${payerName}`);

        // Also update status to 'paid' when payment is confirmed (for both table and takeaway orders)
        const updateData: any = {
          payment_status: 'paid',
          mercadopago_payment_id: paymentData.id?.toString(),
          mercadopago_payment_method: paymentData.payment_method_id,
          mercadopago_collection_id: paymentData.collection_id?.toString(),
          payer_email: payerEmail,
          payer_name: payerName
        };
        
        // Update status to 'paid' when payment is confirmed (for both table and takeaway orders)
        if (order.status === 'pending') {
          updateData.status = 'paid';
          console.log(`Also updating status to 'paid' for order ${resolvedOrderId}`);
        }
        
        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', resolvedOrderId)
          .in('payment_status', ['unpaid', 'pending'])
          .select('id, payment_status, order_number, pickup_code, table_id, payer_email')
          .single();

        if (updateError) {
          console.error('Error updating order payment status:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update order status' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Send confirmation email if payment was successfully updated and email is available
        // Always send if we have payerEmail - the email function will verify order is paid
        if (updatedOrder && updatedOrder.payment_status === 'paid' && payerEmail) {
          try {
            // Get restaurant details for email
            const { data: restaurantDetails } = await supabase
              .from('restaurants')
              .select('name, logo_url, cover_image_url, primary_color, mercadopago_sandbox_mode')
              .eq('id', order.restaurant_id)
              .single();

            const isTakeaway = !updatedOrder.table_id;
            const pickupCode = updatedOrder.pickup_code || null;
            
            // Override email recipient for sandbox mode testing
            const emailRecipient = restaurantDetails?.mercadopago_sandbox_mode ? 'simonabelleyra@gmail.com' : payerEmail;
            
            console.log(`Sending confirmation email to ${emailRecipient} for order ${updatedOrder.order_number}`);

            // Call email service
            const emailResponse = await supabase.functions.invoke('send-order-confirmation', {
              body: {
                orderId: resolvedOrderId,
                orderNumber: updatedOrder.order_number || 0,
                totalAmount: order.total_amount,
                payerEmail: emailRecipient,
                payerName: payerName, // May be null, email template handles it
                restaurantName: restaurantDetails?.name || 'Restaurant',
                restaurantLogo: restaurantDetails?.logo_url,
                coverImageUrl: restaurantDetails?.cover_image_url,
                primaryColor: restaurantDetails?.primary_color || '#059669',
                isTestEmail: restaurantDetails?.mercadopago_sandbox_mode,
                originalCustomerEmail: restaurantDetails?.mercadopago_sandbox_mode ? payerEmail : undefined,
                pickupCode: isTakeaway ? pickupCode : null,
                isTakeaway: isTakeaway
              }
            });

            if (emailResponse.error) {
              console.error('Failed to send confirmation email:', emailResponse.error);
              // Don't fail the payment confirmation if email fails
            } else {
              console.log('Confirmation email sent successfully');
            }
          } catch (emailError) {
            console.error('Error sending confirmation email:', emailError);
            // Don't fail the payment confirmation if email fails
          }
        } else if (!payerEmail) {
          console.log(`Cannot send email for order ${resolvedOrderId} - payer email not available`);
        } else if (updatedOrder && updatedOrder.payment_status !== 'paid') {
          console.log(`Cannot send email for order ${resolvedOrderId} - payment status is ${updatedOrder.payment_status}`);
        }

        return new Response(JSON.stringify({
          status: 'paid',
          payment_method: paymentData.payment_method_id,
          message: 'Payment confirmed via API verification',
          orderId: order.id,
          orderNumber: order.order_number,
          totalAmount: order.total_amount,
          pickupCode: order.pickup_code || null // Include pickup code for takeaway orders
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (paymentData.status === 'pending') {
        return new Response(JSON.stringify({
          status: 'pending',
          message: 'Payment is still pending'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
        // Mark order as customer_cancelled for rejected or cancelled payments
        const { error: cancelUpdateError } = await supabase
          .from('orders')
          .update({ status: 'customer_cancelled' })
          .eq('id', resolvedOrderId)
          .eq('status', 'pending'); // Idempotency: only update if still pending

        if (cancelUpdateError) {
          console.error('Error marking order as customer_cancelled:', cancelUpdateError);
          return new Response(JSON.stringify({
            status: 'cancelled',
            message: 'Payment was cancelled but failed to update order status',
            orderId: order.id,
            orderNumber: order.order_number,
            totalAmount: order.total_amount
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Order ${resolvedOrderId} marked as customer_cancelled due to payment status '${paymentData.status}'`);
        
        return new Response(JSON.stringify({
          status: 'cancelled',
          message: 'Payment was not approved',
          orderId: order.id,
          orderNumber: order.order_number,
          totalAmount: order.total_amount
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({
          status: 'failed',
          message: 'Payment was not approved'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Do not mark as paid based solely on URL params. Await API/webhook confirmation.
    if (paymentStatus === 'approved' && resolvedOrderId && resolvedPaymentId) {
      console.log('API verification not confirmed; returning pending_verification');
    }


    // If verification couldn't confirm approval, return pending_verification (webhook will finalize)
    return new Response(JSON.stringify({
      status: order.payment_status === 'paid' ? 'paid' : 'pending_verification',
      message: order.payment_status === 'paid'
        ? 'Payment already confirmed'
        : 'Awaiting webhook/API confirmation'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in confirm-mercadopago-payment function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
