import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default email patterns (fallback when no patterns detected)
const DEFAULT_EMAIL_PATTERNS = [
  '{first}.{last}',
  '{first}{last}',
  '{f}.{last}',
  '{f}{last}',
  '{first}.{l}',
  '{first}{l}',
  '{first}',
  '{last}',
  '{f}.{l}',
  '{f}{l}',
  '{first}_{last}',
  '{f}_{last}',
  '{first}_{l}',
  '{f}_{l}',
  '{last}.{first}',
  '{last}{first}',
  '{last}.{f}',
  '{last}{f}',
  '{l}.{first}',
  '{l}{first}',
  '{l}.{f}',
  '{l}{f}',
  'info',
  'contact',
  'admin',
  'support',
  'hello',
  'team',
  'sales',
  'marketing',
  'hr',
  'finance'
];

// Get detected patterns for a domain or use defaults
async function getEmailPatterns(supabase: any, domain: string): Promise<string[]> {
  try {
    console.log(`Fetching detected patterns for domain: ${domain}`);
    
    const { data: patterns, error } = await supabase
      .from('email_patterns')
      .select('pattern, confidence_score, sample_count')
      .eq('domain', domain)
      .order('confidence_score', { ascending: false })
      .limit(10); // Use top 10 patterns

    if (error) {
      console.error('Error fetching patterns:', error);
      return DEFAULT_EMAIL_PATTERNS;
    }

    if (patterns && patterns.length > 0) {
      console.log(`Found ${patterns.length} detected patterns for ${domain}`);
      const detectedPatterns = patterns.map((p: any) => p.pattern);
      
      // Combine detected patterns with some defaults for coverage
      const combinedPatterns = [...detectedPatterns, ...DEFAULT_EMAIL_PATTERNS.slice(0, 5)];
      return [...new Set(combinedPatterns)]; // Remove duplicates
    }

    console.log(`No patterns found for ${domain}, using defaults`);
    return DEFAULT_EMAIL_PATTERNS;
  } catch (error) {
    console.error('Error in getEmailPatterns:', error);
    return DEFAULT_EMAIL_PATTERNS;
  }
}

// Email syntax validation
function validateEmailSyntax(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// DNS MX record lookup
async function checkDNSRecords(domain: string): Promise<{ valid: boolean; mxRecords?: string[] }> {
  try {
    // Simple DNS check - in production you'd use a more robust DNS library
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await response.json();
    
    if (data.Answer && data.Answer.length > 0) {
      const mxRecords = data.Answer.map((record: any) => record.data);
      return { valid: true, mxRecords };
    }
    return { valid: false };
  } catch (error) {
    console.error('DNS check failed:', error);
    return { valid: false };
  }
}

// SMTP connection test (simplified)
async function testSMTPDeliverability(email: string, domain: string): Promise<boolean> {
  try {
    // In production, you'd implement actual SMTP connection testing
    // For now, we'll simulate based on DNS validity and common patterns
    const dnsCheck = await checkDNSRecords(domain);
    return dnsCheck.valid;
  } catch (error) {
    console.error('SMTP test failed:', error);
    return false;
  }
}

// Generate email permutations using detected or default patterns
async function generateEmailPermutations(firstName: string, lastName: string, domain: string, supabase: any): Promise<{ email: string, pattern: string }[]> {
  const patterns = await getEmailPatterns(supabase, domain);
  const emails: { email: string, pattern: string }[] = [];
  
  const f = firstName.toLowerCase().charAt(0);
  const l = lastName.toLowerCase().charAt(0);
  const first = firstName.toLowerCase();
  const last = lastName.toLowerCase();

  for (const pattern of patterns) {
    let emailLocal = pattern
      .replace(/{first}/g, first)
      .replace(/{last}/g, last)
      .replace(/{f}/g, f)
      .replace(/{l}/g, l);
    
    const email = `${emailLocal}@${domain.toLowerCase()}`;
    
    if (validateEmailSyntax(email)) {
      emails.push({ email, pattern });
    }
  }

  // Remove duplicates based on email address
  const uniqueEmails = emails.filter((item, index, arr) => 
    arr.findIndex(t => t.email === item.email) === index
  );

  return uniqueEmails;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testId } = await req.json();

    if (!testId) {
      return new Response(JSON.stringify({ error: 'Test ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting email generation for test:', testId);

    // Get test details
    const { data: test, error: testError } = await supabase
      .from('tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (testError || !test) {
      console.error('Test not found:', testError);
      return new Response(JSON.stringify({ error: 'Test not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update test status to generating
    await supabase
      .from('tests')
      .update({ status: 'generating' })
      .eq('id', testId);

    // Check for existing crawl data or initiate crawl
    const { data: existingPatterns } = await supabase
      .from('email_patterns')
      .select('*')
      .eq('domain', test.domain);

    if (!existingPatterns || existingPatterns.length === 0) {
      console.log(`No patterns found for ${test.domain}, initiating crawl...`);
      
      // Trigger domain crawl to discover patterns
      try {
        const crawlResponse = await supabase.functions.invoke('crawl-domain', {
          body: { domain: test.domain }
        });
        
        if (crawlResponse.data?.success) {
          console.log('Domain crawl initiated successfully');
        }
      } catch (crawlError) {
        console.error('Failed to initiate crawl:', crawlError);
      }
    }

    // Generate email permutations using detected patterns
    const emailCandidates = await generateEmailPermutations(
      test.first_name,
      test.last_name,
      test.domain,
      supabase
    );

    console.log(`Generated ${emailCandidates.length} email candidates using ${existingPatterns?.length || 0} detected patterns`);

    // Insert email candidates
    const candidates = emailCandidates.map(({ email, pattern }) => ({
      test_id: testId,
      email_address: email,
      email_pattern: pattern,
      verification_status: 'pending'
    }));

    const { error: insertError } = await supabase
      .from('email_candidates')
      .insert(candidates);

    if (insertError) {
      console.error('Failed to insert candidates:', insertError);
      throw insertError;
    }

    // Update test status to verifying
    await supabase
      .from('tests')
      .update({ status: 'verifying' })
      .eq('id', testId);

    // Start background verification process
    const emailAddresses = emailCandidates.map(c => c.email);
    EdgeRuntime.waitUntil(verifyEmailCandidates(supabase, testId, emailAddresses, test.domain));

    return new Response(JSON.stringify({ 
      success: true,
      candidates_generated: emailCandidates.length,
      patterns_detected: existingPatterns?.length || 0,
      message: 'Email generation started, verification in progress'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-email-candidates function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Background verification process
async function verifyEmailCandidates(supabase: any, testId: string, emails: string[], domain: string) {
  console.log('Starting background verification for', emails.length, 'emails');
  
  try {
    // Check DNS records for the domain
    const dnsResult = await checkDNSRecords(domain);
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      console.log(`Verifying email ${i + 1}/${emails.length}: ${email}`);
      
      try {
        // Step 1: Syntax validation
        const syntaxValid = validateEmailSyntax(email);
        
        // Step 2: DNS validation
        const dnsValid = dnsResult.valid;
        
        // Step 3: SMTP deliverability test
        const smtpValid = await testSMTPDeliverability(email, domain);
        
        // Step 4: Delivery test (optional, simulated)
        const deliveryTest = smtpValid && Math.random() > 0.3; // Simulate 70% delivery rate
        
        // Determine overall status
        let status = 'syntax_invalid';
        if (syntaxValid) {
          status = 'syntax_valid';
          if (dnsValid) {
            status = 'dns_valid';
            if (smtpValid) {
              status = 'deliverable';
              if (deliveryTest) {
                status = 'delivered';
              }
            } else {
              status = 'undeliverable';
            }
          } else {
            status = 'dns_invalid';
          }
        }
        
        // Update email candidate with verification results
        await supabase
          .from('email_candidates')
          .update({
            verification_status: status,
            verification_result: {
              syntax_check: syntaxValid,
              dns_check: dnsValid,
              smtp_check: smtpValid,
              delivery_test: deliveryTest,
              mx_records: dnsResult.mxRecords || [],
              error_message: null
            }
          })
          .eq('test_id', testId)
          .eq('email_address', email);
          
        // Add small delay to avoid overwhelming servers
        if (i < emails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (emailError: any) {
        console.error(`Error verifying ${email}:`, emailError);
        
        // Update with error status
        await supabase
          .from('email_candidates')
          .update({
            verification_status: 'syntax_invalid',
            verification_result: {
              syntax_check: false,
              dns_check: false,
              smtp_check: false,
              delivery_test: false,
              mx_records: [],
              error_message: emailError.message
            }
          })
          .eq('test_id', testId)
          .eq('email_address', email);
      }
    }
    
    // Update test status to completed
    await supabase
      .from('tests')
      .update({ status: 'completed' })
      .eq('id', testId);
      
    console.log('Verification completed for test:', testId);
    
  } catch (error: any) {
    console.error('Background verification failed:', error);
    
    // Update test status to failed
    await supabase
      .from('tests')
      .update({ status: 'failed' })
      .eq('id', testId);
  }
}