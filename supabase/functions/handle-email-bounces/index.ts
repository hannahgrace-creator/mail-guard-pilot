import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BounceWebhookData {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    to: string;
    from: string;
    subject: string;
    bounce_type?: string;
    bounce_reason?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData: BounceWebhookData = await req.json();
    
    console.log('Received webhook:', webhookData);

    // Handle different webhook types
    if (webhookData.type === 'email.bounced' || webhookData.type === 'email.delivery_delayed') {
      const { email_id, to: email, bounce_type, bounce_reason } = webhookData.data;
      
      console.log(`Processing bounce for email: ${email}, message ID: ${email_id}`);

      // Update email verification status in database
      const { error: updateError } = await supabase
        .from('email_candidates')
        .update({
          verification_status: 'bounced',
          verification_details: JSON.stringify({
            bounce_type,
            bounce_reason,
            bounced_at: new Date().toISOString(),
            message_id: email_id
          }),
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (updateError) {
        console.error('Error updating email status:', updateError);
      } else {
        console.log(`Successfully marked ${email} as bounced`);
      }

      // Also update any test results
      const { error: testUpdateError } = await supabase
        .from('email_test_results')
        .update({
          delivery_status: 'bounced',
          bounce_details: JSON.stringify({
            bounce_type,
            bounce_reason,
            bounced_at: new Date().toISOString()
          }),
          updated_at: new Date().toISOString()
        })
        .eq('message_id', email_id);

      if (testUpdateError) {
        console.error('Error updating test results:', testUpdateError);
      }
    }

    // Handle delivery confirmations
    if (webhookData.type === 'email.delivered') {
      const { email_id, to: email } = webhookData.data;
      
      console.log(`Email delivered successfully: ${email}, message ID: ${email_id}`);

      // Update to confirmed delivery
      const { error: updateError } = await supabase
        .from('email_candidates')
        .update({
          verification_status: 'valid',
          verification_details: JSON.stringify({
            delivered_at: new Date().toISOString(),
            message_id: email_id,
            delivery_confirmed: true
          }),
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (updateError) {
        console.error('Error updating delivery status:', updateError);
      }

      // Update test results
      const { error: testUpdateError } = await supabase
        .from('email_test_results')
        .update({
          delivery_status: 'delivered',
          delivery_confirmed: true,
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('message_id', email_id);

      if (testUpdateError) {
        console.error('Error updating test delivery status:', testUpdateError);
      }
    }

    return new Response('Webhook processed successfully', {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});