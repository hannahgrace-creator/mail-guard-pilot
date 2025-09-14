-- Create email test results table to track delivery status
CREATE TABLE IF NOT EXISTS public.email_test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID,
  email VARCHAR(255) NOT NULL,
  message_id VARCHAR(255),
  delivery_status VARCHAR(50) DEFAULT 'pending',
  delivery_confirmed BOOLEAN DEFAULT false,
  bounce_details JSONB,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_test_results ENABLE ROW LEVEL SECURITY;

-- Create policies for email test results
CREATE POLICY "Users can view their own test results" 
ON public.email_test_results 
FOR SELECT 
USING (true);

CREATE POLICY "System can insert test results" 
ON public.email_test_results 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update test results" 
ON public.email_test_results 
FOR UPDATE 
USING (true);

-- Add bounce tracking to existing email_candidates table
ALTER TABLE public.email_candidates 
ADD COLUMN IF NOT EXISTS bounce_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_bounce_at TIMESTAMP WITH TIME ZONE;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_test_results_updated_at
BEFORE UPDATE ON public.email_test_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_test_results_message_id ON public.email_test_results(message_id);
CREATE INDEX IF NOT EXISTS idx_email_test_results_email ON public.email_test_results(email);
CREATE INDEX IF NOT EXISTS idx_email_candidates_bounce_count ON public.email_candidates(bounce_count);