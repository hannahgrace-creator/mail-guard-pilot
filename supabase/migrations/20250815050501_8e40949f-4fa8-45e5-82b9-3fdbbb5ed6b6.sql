-- Add tables for enhanced email discovery system

-- Table to store found emails from crawling
CREATE TABLE public.found_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  email_address TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT, -- 'webpage', 'pdf', 'social', etc.
  found_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  first_name TEXT,
  last_name TEXT,
  confidence_score FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email_address, domain)
);

-- Table to store detected email patterns per domain
CREATE TABLE public.email_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  pattern TEXT NOT NULL, -- e.g., '{first}.{last}', '{first}{last}', etc.
  confidence_score FLOAT NOT NULL DEFAULT 0,
  sample_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(domain, pattern)
);

-- Table to store crawl sessions and results
CREATE TABLE public.crawl_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'crawling', 'completed', 'failed'
  pages_crawled INTEGER DEFAULT 0,
  emails_found INTEGER DEFAULT 0,
  patterns_detected INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.found_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for found_emails (public read access for pattern detection)
CREATE POLICY "Anyone can view found emails for pattern detection"
ON public.found_emails
FOR SELECT
USING (true);

CREATE POLICY "System can insert found emails"
ON public.found_emails
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update found emails"
ON public.found_emails
FOR UPDATE
USING (true);

-- RLS policies for email_patterns (public read access)
CREATE POLICY "Anyone can view email patterns"
ON public.email_patterns
FOR SELECT
USING (true);

CREATE POLICY "System can manage email patterns"
ON public.email_patterns
FOR ALL
USING (true);

-- RLS policies for crawl_sessions (public read access)
CREATE POLICY "Anyone can view crawl sessions"
ON public.crawl_sessions
FOR SELECT
USING (true);

CREATE POLICY "System can manage crawl sessions"
ON public.crawl_sessions
FOR ALL
USING (true);

-- Add indexes for performance
CREATE INDEX idx_found_emails_domain ON public.found_emails(domain);
CREATE INDEX idx_found_emails_email ON public.found_emails(email_address);
CREATE INDEX idx_email_patterns_domain ON public.email_patterns(domain);
CREATE INDEX idx_crawl_sessions_domain ON public.crawl_sessions(domain);
CREATE INDEX idx_crawl_sessions_status ON public.crawl_sessions(status);

-- Add triggers for updated_at
CREATE TRIGGER update_found_emails_updated_at
  BEFORE UPDATE ON public.found_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_patterns_updated_at
  BEFORE UPDATE ON public.email_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crawl_sessions_updated_at
  BEFORE UPDATE ON public.crawl_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();