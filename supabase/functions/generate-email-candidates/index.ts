import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced default email patterns with higher success rate
const DEFAULT_EMAIL_PATTERNS = [
  // Common corporate patterns
  '{first}.{last}',
  '{first}{last}',
  '{f}.{last}',
  '{f}{last}',
  '{first}.{l}',
  '{first}{l}',
  '{first}_{last}',
  '{f}_{last}',
  '{first}_{l}',
  '{f}_{l}',
  
  // Reverse patterns
  '{last}.{first}',
  '{last}{first}',
  '{last}.{f}',
  '{last}{f}',
  '{l}.{first}',
  '{l}{first}',
  '{l}.{f}',
  '{l}{f}',
  '{last}_{first}',
  '{last}_{f}',
  '{l}_{first}',
  '{l}_{f}',
  
  // Single name patterns
  '{first}',
  '{last}',
  '{f}.{l}',
  '{f}{l}',
  '{f}_{l}',
  '{l}_{f}',
  
  // With numbers (common variations)
  '{first}.{last}1',
  '{first}{last}1',
  '{f}{last}1',
  '{first}1',
  '{last}1',
  
  // With initials and numbers
  '{first}.{last}01',
  '{f}.{last}01',
  '{first}01',
  
  // Generic/role-based emails
  'info',
  'contact',
  'admin',
  'support',
  'hello',
  'team',
  'sales',
  'marketing',
  'hr',
  'finance',
  'office',
  'reception',
  'jobs',
  'careers',
  'help',
  'service',
  'business',
  'mail'
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
    console.log('Starting background verification for', emailAddresses.length, 'emails');
    EdgeRuntime.waitUntil(verifyEmailCandidatesUsingAdvancedAPI(supabase, testId, emailAddresses));

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

// Background verification using advanced API
async function verifyEmailCandidatesUsingAdvancedAPI(supabase: any, testId: string, emails: string[]) {
  console.log('Starting background verification using advanced API for', emails.length, 'emails');
  
  try {
    // Call the verify-email-advanced function
    const { data: verificationData, error: verificationError } = await supabase.functions.invoke('verify-email-advanced', {
      body: { emails }
    });

    if (verificationError) {
      console.error('Advanced verification failed:', verificationError);
      throw verificationError;
    }

    if (!verificationData?.results) {
      console.error('No verification results received');
      throw new Error('No verification results received');
    }

    console.log('Advanced verification completed, updating database...');

    // Update candidates with verification results
    for (const result of verificationData.results) {
      try {
        // Convert the result to our database format
        let status = 'invalid';
        if (result.isValid) {
          if (result.details.confidence === 'high') {
            status = 'valid';
          } else if (result.details.confidence === 'medium') {
            status = 'valid';
          } else {
            status = 'valid';
          }
        }

        await supabase
          .from('email_candidates')
          .update({
            verification_status: status,
            verification_result: result,
            updated_at: new Date().toISOString()
          })
          .eq('email_address', result.email)
          .eq('test_id', testId);

      } catch (updateError: any) {
        console.error(`Error updating candidate ${result.email}:`, updateError);
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
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', testId);
  }
}