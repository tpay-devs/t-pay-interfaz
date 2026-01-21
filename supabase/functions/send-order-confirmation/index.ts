import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderConfirmationRequest {
  orderId: string;
  orderNumber: number;
  totalAmount: number;
  payerEmail: string;
  payerName?: string;
  restaurantName: string;
  restaurantLogo?: string;
  coverImageUrl?: string;
  primaryColor?: string;
  isTestEmail?: boolean;
  originalCustomerEmail?: string;
  pickupCode?: string | null;
  isTakeaway?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const {
      orderId,
      orderNumber,
      totalAmount,
      payerEmail,
      payerName,
      restaurantName,
      restaurantLogo,
      coverImageUrl,
      primaryColor = "#059669",
      isTestEmail = false,
      originalCustomerEmail,
      pickupCode,
      isTakeaway = false
    }: OrderConfirmationRequest = await req.json();

    const emailRequestTime = new Date().toISOString();
    console.log(`[${emailRequestTime}] Sending order confirmation email for order ${orderNumber} to ${payerEmail}`);

    // CRITICAL: Verify order payment_status is 'paid' before sending email
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, payment_status, total_amount')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error(`[${emailRequestTime}] Error fetching order ${orderId}:`, orderError);
      throw new Error(`Failed to fetch order: ${orderError.message}`);
    }

    if (!order) {
      console.error(`[${emailRequestTime}] Order ${orderId} not found`);
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.payment_status !== 'paid') {
      const errorMsg = `Order ${orderId} payment_status is '${order.payment_status}', not 'paid'. Email will not be sent.`;
      console.error(`[${emailRequestTime}] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`[${emailRequestTime}] Order ${orderId} verified as paid. Proceeding with email.`);

    // Get order items for detailed information
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        quantity,
        unit_price,
        special_instructions,
        menu_items!inner(name, description)
      `)
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      throw new Error('Failed to fetch order details');
    }

    // Format order items for email
    const itemsList = orderItems?.map(item => 
      `• ${item.quantity}x ${item.menu_items.name} - $${(item.unit_price * item.quantity).toFixed(2)}${
        item.special_instructions ? ` (${item.special_instructions})` : ''
      }`
    ).join('\n') || '';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="
          background-color: #ffffff;
          padding: 20px;
          text-align: center;
          position: relative;
          min-height: 200px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        ">
          <div style="position: relative; z-index: 2; width: 100%; text-align: center;">
            ${restaurantLogo ? 
              `<img src="${restaurantLogo}" alt="${restaurantName}" style="max-height: 60px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">` : 
              ''
            }
            <h1 style="color: #333; margin: 0; font-size: 24px; background-color: transparent; text-align: center;">¡Pago Confirmado!</h1>
            <p style="color: #333; margin: 10px 0 0 0; background-color: transparent; text-align: center;">Pedido #${orderNumber}</p>
          </div>
        </div>
        
        <div style="padding: 30px 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">¡Hola!</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Tu pago ha sido procesado exitosamente. Aquí tienes los detalles de tu pedido:
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">Detalles del Pedido</h3>
            <p style="margin: 5px 0;"><strong>Número de Pedido:</strong> ${orderNumber}</p>
            <p style="margin: 5px 0;"><strong>Restaurant:</strong> ${restaurantName}</p>
            <p style="margin: 5px 0;"><strong>Total Pagado:</strong> $${totalAmount.toFixed(2)}</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">Artículos Pedidos</h3>
            <div style="white-space: pre-line; color: #666; line-height: 1.6;">
${itemsList}
            </div>
          </div>
          
          ${isTakeaway && pickupCode ? `
          <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; border-left: 4px solid ${primaryColor}; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">Código de Retiro</h3>
            <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; border: 2px dashed ${primaryColor};">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Tu código de retiro es:</p>
              <div style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: ${primaryColor}; margin: 10px 0;">
                ${pickupCode}
              </div>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">
                Presentá este código al personal del restaurante para retirar tu pedido.
              </p>
            </div>
          </div>
          ` : ''}
          
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid ${primaryColor};">
            <p style="margin: 0; color: #1976d2; font-weight: 500;">
              💡 <strong>Importante:</strong> Guarda este número de pedido (${orderNumber})${isTakeaway && pickupCode ? ' y tu código de retiro' : ''} para cualquier consulta.
            </p>
          </div>
          
          ${isTestEmail ? `
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border: 1px solid #ffeaa7; margin-top: 20px;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              🧪 <strong>Modo Prueba:</strong> Este email fue enviado en modo sandbox. El cliente original era: ${originalCustomerEmail}
            </p>
          </div>
          ` : ''}
          
          <p style="color: #666; line-height: 1.6; margin-top: 30px;">
            ¡Gracias por tu pedido! El equipo de ${restaurantName} se encargará de preparar todo con el mayor cuidado.
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; color: #6c757d; font-size: 14px;">
            Este es un correo automático, por favor no respondas a este mensaje.
          </p>
        </div>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: `${restaurantName} <noreply@customer.tpaydigital.com>`,
      to: [payerEmail],
      subject: `¡Pago confirmado! Pedido #${orderNumber} - ${restaurantName}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json", 
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error("Error sending order confirmation email:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json", 
        ...corsHeaders 
      },
    });
  }
};

serve(handler);