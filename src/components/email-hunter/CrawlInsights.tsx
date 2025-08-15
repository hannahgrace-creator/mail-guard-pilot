import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Search, Globe, Mail, TrendingUp, RefreshCw, ExternalLink } from "lucide-react";

interface CrawlSession {
  id: string;
  domain: string;
  status: 'pending' | 'crawling' | 'completed' | 'failed';
  pages_crawled: number;
  emails_found: number;
  patterns_detected: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  metadata?: {
    patterns?: Array<{ pattern: string; confidence: number; samples: string[] }>;
    sources?: Array<{ source: string; emails: number }>;
  };
}

interface EmailPattern {
  id: string;
  domain: string;
  pattern: string;
  confidence_score: number;
  sample_count: number;
  last_updated: string;
}

interface FoundEmail {
  id: string;
  domain: string;
  email_address: string;
  source_url?: string;
  source_type: string;
  found_date: string;
  first_name?: string;
  last_name?: string;
  confidence_score: number;
}

interface CrawlInsightsProps {
  domain: string;
}

export const CrawlInsights = ({ domain }: CrawlInsightsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [crawlSession, setCrawlSession] = useState<CrawlSession | null>(null);
  const [patterns, setPatterns] = useState<EmailPattern[]>([]);
  const [foundEmails, setFoundEmails] = useState<FoundEmail[]>([]);

  const fetchCrawlData = async () => {
    try {
      // Fetch latest crawl session
      const { data: sessions, error: sessionError } = await supabase
        .from('crawl_sessions')
        .select('*')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(1);

      if (sessionError) {
        console.error('Error fetching crawl sessions:', sessionError);
      } else if (sessions && sessions.length > 0) {
        setCrawlSession(sessions[0] as CrawlSession);
      }

      // Fetch email patterns
      const { data: patternData, error: patternError } = await supabase
        .from('email_patterns')
        .select('*')
        .eq('domain', domain)
        .order('confidence_score', { ascending: false });

      if (patternError) {
        console.error('Error fetching patterns:', patternError);
      } else if (patternData) {
        setPatterns(patternData);
      }

      // Fetch found emails
      const { data: emailData, error: emailError } = await supabase
        .from('found_emails')
        .select('*')
        .eq('domain', domain)
        .order('found_date', { ascending: false })
        .limit(10);

      if (emailError) {
        console.error('Error fetching found emails:', emailError);
      } else if (emailData) {
        setFoundEmails(emailData);
      }
    } catch (error) {
      console.error('Error fetching crawl data:', error);
    }
  };

  const startDomainCrawl = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('crawl-domain', {
        body: { domain }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: "Crawl Started",
          description: `Domain crawling initiated for ${domain}`,
          duration: 3000,
        });
        
        // Refresh data after a short delay
        setTimeout(fetchCrawlData, 2000);
      } else {
        throw new Error(data?.error || 'Failed to start crawl');
      }
    } catch (error: any) {
      console.error('Error starting crawl:', error);
      toast({
        title: "Crawl Failed",
        description: error.message || 'Failed to start domain crawl',
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (domain) {
      fetchCrawlData();
      
      // Auto-refresh if crawling is in progress
      const interval = crawlSession?.status === 'crawling' ? 
        setInterval(fetchCrawlData, 5000) : null;
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [domain, crawlSession?.status]);

  const getStatusColor = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'completed': return 'default';
      case 'crawling': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getProgress = () => {
    if (!crawlSession) return 0;
    if (crawlSession.status === 'completed') return 100;
    if (crawlSession.status === 'crawling') return 65;
    if (crawlSession.status === 'failed') return 100;
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Crawl Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Domain Intelligence: {domain}
            </CardTitle>
            <CardDescription>
              Real email patterns discovered from web crawling and analysis
            </CardDescription>
          </div>
          <Button 
            onClick={startDomainCrawl}
            disabled={loading || crawlSession?.status === 'crawling'}
            size="sm"
            className="flex items-center gap-2"
          >
            {loading || crawlSession?.status === 'crawling' ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {crawlSession?.status === 'crawling' ? 'Crawling...' : 'Start Crawl'}
          </Button>
        </CardHeader>
        <CardContent>
          {crawlSession && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant={getStatusColor(crawlSession.status)}>
                  {crawlSession.status.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(crawlSession.started_at).toLocaleString()}
                </span>
              </div>
              
              {crawlSession.status === 'crawling' && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Crawling in progress...</span>
                    <span>{getProgress()}%</span>
                  </div>
                  <Progress value={getProgress()} className="w-full" />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {crawlSession.pages_crawled}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <Globe className="h-4 w-4" />
                    Pages Crawled
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {crawlSession.emails_found}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <Mail className="h-4 w-4" />
                    Emails Found
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {crawlSession.patterns_detected}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Patterns Detected
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Patterns */}
      {patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Detected Email Patterns
            </CardTitle>
            <CardDescription>
              Patterns discovered from real emails found on the domain
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patterns.map((pattern) => (
                <div key={pattern.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                      {pattern.pattern}
                    </code>
                    <div className="text-sm text-muted-foreground">
                      {pattern.sample_count} sample{pattern.sample_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={pattern.confidence_score * 100} 
                      className="w-16 h-2"
                    />
                    <span className="text-sm font-medium w-10">
                      {Math.round(pattern.confidence_score * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Found Emails Sample */}
      {foundEmails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
              Sample Found Emails
            </CardTitle>
            <CardDescription>
              Recent emails discovered during crawling (showing {foundEmails.length} most recent)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {foundEmails.map((email) => (
                <div key={email.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                  <div className="flex items-center gap-3">
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {email.email_address}
                    </code>
                    <Badge variant="outline" className="text-xs">
                      {email.source_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {email.source_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(email.source_url, '_blank')}
                        className="h-6 w-6 p-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(email.found_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!crawlSession && (
        <Card>
          <CardContent className="text-center py-8">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No crawl data available</h3>
            <p className="text-muted-foreground mb-4">
              Start a domain crawl to discover real email patterns and improve accuracy
            </p>
            <Button onClick={startDomainCrawl} disabled={loading}>
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Start Domain Crawl
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};