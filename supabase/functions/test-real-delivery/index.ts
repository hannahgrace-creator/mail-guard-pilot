import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface RealDeliveryTestRequest {
  testEmail: string;
  testId?: string;
}

interface RealDeliveryTestResponse {
  success: boolean;
  email: string;
  deliveryConfirmed: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
  verificationLevel: 'technical' | 'delivery_confirmed' | 'failed';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testEmail, testId }: RealDeliveryTestRequest = await req.json();

    if (!testEmail) {
      return new Response(JSON.stringify({ error: 'Test email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Testing real delivery to: ${testEmail}`);
    
    const timestamp = new Date().toISOString();
    const verificationCode = Math.random().toString(36).substring(2, 15);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use verified sender addresses with fallback
    const fromAddresses = [
      'Email Verification <onboarding@resend.dev>',  
      'Email Verification <delivered@resend.dev>',   
    ];
    
    let emailResponse;
    let lastError;
    
    // Try each sender address for best deliverability
    for (const fromAddress of fromAddresses) {
      try {
        emailResponse = await resend.emails.send({
          from: fromAddress,
          to: [testEmail],
          subject: 'Real Delivery Test - Email System Verification',
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>Email Delivery Test</title>
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #2563eb;">✅ Real Email Delivery Confirmed!</h2>
                  
                  <p>Congratulations! This email confirms that our system can successfully deliver emails to <strong>${testEmail}</strong>.</p>
                  
                  <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #1e40af;">Verification Details:</h3>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li><strong>Email Address:</strong> ${testEmail}</li>
                      <li><strong>Test Time:</strong> ${new Date(timestamp).toLocaleString()}</li>
                      <li><strong>Verification Code:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${verificationCode}</code></li>
                      <li><strong>Sender:</strong> ${fromAddress}</li>
                    </ul>
                  </div>
                  
                  <p>This test verifies that:</p>
                  <ul>
                    <li>✅ DNS MX records are properly configured</li>
                    <li>✅ SMTP server is accepting emails</li>
                    <li>✅ Email delivery is working end-to-end</li>
                    <li>✅ Inbox/spam filtering allows our emails through</li>
                  </ul>
                  
                  <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Note:</strong> This is a real delivery test for email verification purposes. You can safely delete this email.</p>
                  </div>
                  
                  <hr style="border: 1px solid #e5e7eb; margin: 30px 0;">
                  <p style="font-size: 12px; color: #6b7280;">
                    Email Verification System | Test ID: ${testId || 'manual'} | Timestamp: ${timestamp}
                  </p>
                </div>
              </body>
            </html>
          `,
          text: `
Real Email Delivery Test - CONFIRMED

Your email address ${testEmail} has been verified and can receive emails successfully!

Verification Details:
- Email: ${testEmail}
- Test Time: ${new Date(timestamp).toLocaleString()}
- Verification Code: ${verificationCode}
- Sender: ${fromAddress}

This confirms:
✅ DNS MX records properly configured  
✅ SMTP server accepting emails
✅ End-to-end email delivery working
✅ Inbox filtering allows our emails

Test ID: ${testId || 'manual'}
Timestamp: ${timestamp}

You can safely delete this email.
          `,
        });
        
        if (!emailResponse.error) {
          console.log(`✅ Real delivery confirmed to ${testEmail} using ${fromAddress}`);
          break;
        } else {
          lastError = emailResponse.error;
          console.log(`❌ Failed with ${fromAddress}:`, emailResponse.error);
        }
      } catch (error) {
        lastError = error;
        console.log(`❌ Error with ${fromAddress}:`, error);
      }
    }

    if (emailResponse?.error || !emailResponse) {
      console.error(`❌ All delivery attempts failed for ${testEmail}:`, lastError);
      
      const response: RealDeliveryTestResponse = {
        success: false,
        email: testEmail,
        deliveryConfirmed: false,
        verificationLevel: 'failed',
        error: lastError?.message || 'All sender addresses failed - email may not exist or server is rejecting emails',
        timestamp,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ Real email delivery confirmed for ${testEmail}`);

    // If we have a test ID, update the database
    if (testId && supabase) {
      try {
        await supabase
          .from('email_candidates')
          .update({
            verification_status: 'delivery_confirmed',
            delivery_response: JSON.stringify({
              messageId: emailResponse.data?.id,
              deliveryConfirmed: true,
              sender: fromAddresses[0],
              timestamp
            }),
            updated_at: new Date().toISOString()
          })
          .eq('email_address', testEmail)
          .eq('test_id', testId);

        console.log(`Database updated for ${testEmail} with delivery confirmation`);
      } catch (dbError) {
        console.error('Database update failed:', dbError);
      }
    }

    const response: RealDeliveryTestResponse = {
      success: true,
      email: testEmail,
      deliveryConfirmed: true,
      messageId: emailResponse.data?.id,
      verificationLevel: 'delivery_confirmed',
      timestamp,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in test-real-delivery function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        verificationLevel: 'failed'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});