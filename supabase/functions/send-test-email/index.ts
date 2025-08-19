import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestEmailRequest {
  email: string;
  testId?: string;
}

interface TestEmailResponse {
  success: boolean;
  email: string;
  messageId?: string;
  deliveryStatus: 'sent' | 'failed' | 'bounced';
  error?: string;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, testId }: TestEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending test email to: ${email}`);

    // Generate a unique verification code for tracking
    const verificationCode = Math.random().toString(36).substring(2, 15);
    const timestamp = new Date().toISOString();

    // Try different verified domains for better deliverability
    const fromAddresses = [
      'Email Verification <onboarding@resend.dev>',  // Resend's verified domain
      'Email Verification <delivered@resend.dev>',   // Alternative verified domain
    ];
    
    let emailResponse;
    let lastError;
    
    // Try each from address until one succeeds
    for (const fromAddress of fromAddresses) {
      try {
        emailResponse = await resend.emails.send({
          from: fromAddress,
          to: [email],
          subject: 'Email Verification Test - Please Ignore',
          html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Email Verification Test</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">✅ Email Verification Test</h1>
            </div>
            
            <div style="padding: 30px 20px; background: #f9f9f9; border-radius: 10px; margin-top: 20px;">
              <h2 style="color: #333; margin-top: 0;">Test Successful!</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.5;">
                This is an automated email verification test. Your email address <strong>${email}</strong> 
                is working correctly and can receive emails.
              </p>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #888; font-size: 14px;">
                  <strong>Verification Code:</strong> ${verificationCode}<br>
                  <strong>Timestamp:</strong> ${timestamp}
                </p>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                You can safely ignore or delete this email. This test was conducted to verify 
                email deliverability for business email validation purposes.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; padding: 20px; color: #888; font-size: 12px;">
              <p>This email was sent by an automated email verification system.</p>
            </div>
          </body>
        </html>
          `,
          text: `
Email Verification Test

This is an automated email verification test. Your email address ${email} is working correctly and can receive emails.

Verification Code: ${verificationCode}
Timestamp: ${timestamp}

You can safely ignore or delete this email. This test was conducted to verify email deliverability for business email validation purposes.
          `,
        });
        
        // If successful, break out of the loop
        if (!emailResponse.error) {
          console.log(`Successfully sent email to ${email} using ${fromAddress}`);
          break;
        } else {
          lastError = emailResponse.error;
          console.log(`Failed with ${fromAddress}:`, emailResponse.error);
        }
      } catch (error) {
        lastError = error;
        console.log(`Error with ${fromAddress}:`, error);
      }
    }

    if (emailResponse?.error || !emailResponse) {
      console.error(`Failed to send test email to ${email}:`, lastError);
      
      const response: TestEmailResponse = {
        success: false,
        email,
        deliveryStatus: 'failed',
        error: lastError?.message || 'All sender addresses failed - domain verification may be required',
        timestamp,
      };

      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Test email sent successfully to ${email}. Message ID: ${emailResponse.data?.id}`);

    const response: TestEmailResponse = {
      success: true,
      email,
      messageId: emailResponse.data?.id,
      deliveryStatus: 'sent',
      timestamp,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-test-email function:', error);
    
    const response: TestEmailResponse = {
      success: false,
      email: 'unknown',
      deliveryStatus: 'failed',
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});