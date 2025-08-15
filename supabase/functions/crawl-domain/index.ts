import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

interface CrawlResult {
  emails: string[];
  source: string;
  type: 'webpage' | 'pdf' | 'social';
}

// Extract emails from text content
function extractEmails(text: string, domain: string): string[] {
  const emails = text.match(EMAIL_REGEX) || [];
  return emails
    .map(email => email.toLowerCase())
    .filter(email => email.endsWith(`@${domain.toLowerCase()}`))
    .filter((email, index, arr) => arr.indexOf(email) === index); // Remove duplicates
}

// Crawl a webpage and extract emails
async function crawlWebpage(url: string, domain: string): Promise<CrawlResult> {
  try {
    console.log(`Crawling webpage: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EmailBot/1.0; +https://emailhunter.com/bot)',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.log(`Failed to crawl ${url}: ${response.status}`);
      return { emails: [], source: url, type: 'webpage' };
    }

    const text = await response.text();
    const emails = extractEmails(text, domain);
    
    console.log(`Found ${emails.length} emails from ${url}`);
    return { emails, source: url, type: 'webpage' };
  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
    return { emails: [], source: url, type: 'webpage' };
  }
}

// Search for emails using a basic web search simulation
async function searchEmails(domain: string): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  
  // Common pages that might contain email addresses
  const commonPaths = [
    '',
    '/about',
    '/team',
    '/contact',
    '/careers',
    '/staff',
    '/leadership',
    '/management',
    '/directory',
    '/people'
  ];

  for (const path of commonPaths) {
    const url = `https://${domain}${path}`;
    try {
      const result = await crawlWebpage(url, domain);
      if (result.emails.length > 0) {
        results.push(result);
      }
    } catch (error) {
      console.error(`Failed to crawl ${url}:`, error);
    }
  }

  return results;
}

// Detect name patterns from found emails
function detectNamePatterns(emails: string[], domain: string): { pattern: string; confidence: number; samples: string[] }[] {
  const patterns: { [key: string]: string[] } = {};
  
  for (const email of emails) {
    const localPart = email.split('@')[0];
    
    // Analyze different pattern possibilities
    if (localPart.includes('.')) {
      const parts = localPart.split('.');
      if (parts.length === 2) {
        patterns['{first}.{last}'] = patterns['{first}.{last}'] || [];
        patterns['{first}.{last}'].push(email);
      }
    }
    
    if (localPart.includes('_')) {
      const parts = localPart.split('_');
      if (parts.length === 2) {
        patterns['{first}_{last}'] = patterns['{first}_{last}'] || [];
        patterns['{first}_{last}'].push(email);
      }
    }
    
    // Check for first initial + last name
    if (localPart.length > 1 && !localPart.includes('.') && !localPart.includes('_')) {
      // Could be firstlast or flast pattern
      patterns['{first}{last}'] = patterns['{first}{last}'] || [];
      patterns['{first}{last}'].push(email);
    }
  }
  
  // Calculate confidence based on sample size
  return Object.entries(patterns).map(([pattern, samples]) => ({
    pattern,
    confidence: Math.min(samples.length / 3, 1), // Higher confidence with more samples
    samples
  })).sort((a, b) => b.confidence - a.confidence);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting domain crawl for: ${domain}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create crawl session
    const { data: crawlSession, error: sessionError } = await supabase
      .from('crawl_sessions')
      .insert({
        domain,
        status: 'crawling',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating crawl session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create crawl session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Start background crawling process
    EdgeRuntime.waitUntil(performCrawl(supabase, crawlSession.id, domain));

    return new Response(
      JSON.stringify({ 
        success: true, 
        crawlSessionId: crawlSession.id,
        status: 'crawling',
        message: 'Domain crawling started'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in crawl-domain function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function performCrawl(supabase: any, crawlSessionId: string, domain: string) {
  try {
    console.log(`Performing crawl for domain: ${domain}`);
    
    // Search for emails across the domain
    const crawlResults = await searchEmails(domain);
    
    let totalEmailsFound = 0;
    const allEmails: string[] = [];
    
    // Store found emails in database
    for (const result of crawlResults) {
      for (const email of result.emails) {
        try {
          await supabase.from('found_emails').upsert({
            domain,
            email_address: email,
            source_url: result.source,
            source_type: result.type,
            found_date: new Date().toISOString()
          }, {
            onConflict: 'email_address,domain'
          });
          
          allEmails.push(email);
          totalEmailsFound++;
        } catch (error) {
          console.error(`Error storing email ${email}:`, error);
        }
      }
    }
    
    // Detect patterns from found emails
    const detectedPatterns = detectNamePatterns(allEmails, domain);
    let patternsStored = 0;
    
    for (const { pattern, confidence, samples } of detectedPatterns) {
      try {
        await supabase.from('email_patterns').upsert({
          domain,
          pattern,
          confidence_score: confidence,
          sample_count: samples.length,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'domain,pattern'
        });
        
        patternsStored++;
      } catch (error) {
        console.error(`Error storing pattern ${pattern}:`, error);
      }
    }
    
    // Update crawl session with results
    await supabase
      .from('crawl_sessions')
      .update({
        status: 'completed',
        emails_found: totalEmailsFound,
        patterns_detected: patternsStored,
        pages_crawled: crawlResults.length,
        completed_at: new Date().toISOString(),
        metadata: {
          patterns: detectedPatterns,
          sources: crawlResults.map(r => ({ source: r.source, emails: r.emails.length }))
        }
      })
      .eq('id', crawlSessionId);
    
    console.log(`Crawl completed for ${domain}: ${totalEmailsFound} emails, ${patternsStored} patterns`);
    
  } catch (error) {
    console.error('Error during crawl:', error);
    
    // Update crawl session with error
    await supabase
      .from('crawl_sessions')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', crawlSessionId);
  }
}