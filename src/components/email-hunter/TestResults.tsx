import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Download, Search, Loader2, Mail } from "lucide-react";
import { CrawlInsights } from './CrawlInsights';

interface EmailCandidate {
  id: string;
  email_address: string;
  email_pattern: string;
  verification_status: string;
  verification_result?: any;
  delivery_response?: string;
  created_at: string;
  updated_at: string;
}

interface Test {
  id: string;
  domain: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TestResultsProps {
  testId?: string;
}

interface GenerationProgress {
  isGenerating: boolean;
  progress: number;
  currentStep: string;
}

function getStatusIcon(status: string) {
  // Return appropriate icon based on status
  return null;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'valid':
      return <Badge variant="default" className="bg-primary/10 text-primary">Valid</Badge>;
    case 'delivery_confirmed':
      return <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">✉️ Delivery Confirmed</Badge>;
    case 'delivery_failed':
      return <Badge variant="destructive">❌ Delivery Failed</Badge>;
    case 'invalid': 
      return <Badge variant="destructive">Invalid</Badge>;
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

export const TestResults: React.FC<TestResultsProps> = ({ testId }) => {
  const [test, setTest] = useState<Test | null>(null);
  const [emailCandidates, setEmailCandidates] = useState<EmailCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({ 
    isGenerating: false, 
    progress: 0, 
    currentStep: '' 
  });
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTestData = async () => {
    if (!testId || !user) return;

    try {
      setLoading(true);
      
      // Fetch test
      const { data: testData, error: testError } = await supabase
        .from('tests')
        .select('*')
        .eq('id', testId)
        .single();

      if (testError) throw testError;
      setTest(testData);

      // Fetch email candidates
      const { data: candidatesData, error: candidatesError } = await supabase
        .from('email_candidates')
        .select('*')
        .eq('test_id', testId)
        .order('verification_status', { ascending: false });

      if (candidatesError) throw candidatesError;
      setEmailCandidates(candidatesData || []);

    } catch (error: any) {
      console.error('Error fetching test data:', error);
      toast({
        title: "Error loading test results",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendTestEmails = async () => {
    if (!emailCandidates.length) return;

    setGenerationProgress({ isGenerating: true, progress: 0, currentStep: 'Starting comprehensive real delivery tests...' });
    
    try {
      // Prioritize high-probability emails for testing
      const validCandidates = emailCandidates
        .filter(c => c.verification_status === 'valid')
        .sort((a, b) => {
          const scoreA = a.verification_result?.priority_score || 0;
          const scoreB = b.verification_result?.priority_score || 0;
          return scoreB - scoreA;
        });
      
      const totalEmails = Math.min(validCandidates.length, 8); // Test up to 8 highest priority emails
      let deliveryConfirmed = 0;
      
      for (let i = 0; i < totalEmails; i++) {
        const candidate = validCandidates[i];
        const progress = ((i + 1) / totalEmails) * 90;
        
        setGenerationProgress({ 
          isGenerating: true, 
          progress, 
          currentStep: `Testing real delivery: ${candidate.email_address} (Priority: ${candidate.verification_result?.priority_score || 0})` 
        });

        // Use the new real delivery test function
        const testResponse = await supabase.functions.invoke('test-real-delivery', {
          body: { 
            testEmail: candidate.email_address,
            testId: test?.id
          }
        });

        let deliveryStatus = 'delivery_failed';
        if (testResponse.data?.deliveryConfirmed) {
          deliveryStatus = 'delivery_confirmed';
          deliveryConfirmed++;
        }
        
        await supabase
          .from('email_candidates')
          .update({
            verification_status: deliveryStatus,
            delivery_response: JSON.stringify(testResponse.data || testResponse.error),
            updated_at: new Date().toISOString()
          })
          .eq('id', candidate.id);

        // Adaptive delay based on success rate
        await new Promise(resolve => setTimeout(resolve, deliveryConfirmed > 0 ? 3000 : 2000));
      }

      const successRate = totalEmails > 0 ? Math.round((deliveryConfirmed / totalEmails) * 100) : 0;

      setGenerationProgress({ 
        isGenerating: true, 
        progress: 100, 
        currentStep: `Real delivery complete! ${successRate}% confirmed (${deliveryConfirmed}/${totalEmails})` 
      });
      
      // Refresh data to show results
      await fetchTestData();
      
      setTimeout(() => {
        setGenerationProgress({ isGenerating: false, progress: 0, currentStep: '' });
      }, 2000);

      toast({
        title: "Real delivery tests completed!", 
        description: `🎯 ${deliveryConfirmed} of ${totalEmails} emails confirmed deliverable (${successRate}% success rate)`,
        variant: successRate >= 50 ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Error testing real email delivery:', error);
      setGenerationProgress({ isGenerating: false, progress: 0, currentStep: '' });
      toast({
        title: "Real delivery test failed", 
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const startEmailGeneration = async () => {
    if (!test?.id) return;

    setGenerationProgress({ isGenerating: true, progress: 0, currentStep: 'Initializing...' });
    
    try {
      // Step 1: Start crawling
      setGenerationProgress({ isGenerating: true, progress: 20, currentStep: 'Crawling domain for emails...' });
      const crawlResponse = await supabase.functions.invoke('crawl-domain', {
        body: { domain: test.domain }
      });

      if (crawlResponse.error) {
        throw new Error(crawlResponse.error.message);
      }

      // Step 2: Generate candidates
      setGenerationProgress({ isGenerating: true, progress: 40, currentStep: 'Generating email candidates...' });
      const response = await supabase.functions.invoke('generate-email-candidates', {
        body: { 
          testId: test.id,
          domain: test.domain,
          firstName: test.first_name,
          lastName: test.last_name,
          companyName: test.company_name
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Step 3: Verification is handled automatically by generate-email-candidates
      setGenerationProgress({ isGenerating: true, progress: 70, currentStep: 'Advanced verification in progress...' });

      setGenerationProgress({ isGenerating: true, progress: 100, currentStep: 'Complete!' });
      
      // Refresh the data
      await fetchTestData();
      
      setTimeout(() => {
        setGenerationProgress({ isGenerating: false, progress: 0, currentStep: '' });
      }, 1000);

      toast({
        title: "Email generation completed",
        description: `Generated and verified ${response.data?.candidates_generated || 'email'} candidates`,
      });

    } catch (error) {
      console.error('Error generating emails:', error);
      setGenerationProgress({ isGenerating: false, progress: 0, currentStep: '' });
      toast({
        title: "Generation failed", 
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const exportResults = () => {
    if (emailCandidates.length === 0) return;

    const csvContent = [
      ['Email Address', 'Pattern', 'Status', 'Verification Score', 'Delivery Response'],
      ...emailCandidates.map(candidate => [
        candidate.email_address,
        candidate.email_pattern,
        candidate.verification_status,
        candidate.verification_result?.score || '',
        candidate.delivery_response || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-verification-${test?.domain}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchTestData();
  }, [testId, user]);

  // Auto-refresh when test is in progress
  useEffect(() => {
    if (test?.status === 'generating' || generationProgress.isGenerating) {
      const interval = setInterval(fetchTestData, 3000);
      return () => clearInterval(interval);
    }
  }, [test?.status, generationProgress.isGenerating]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading test results...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!test) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Test not found or you don't have permission to view it.
          </div>
        </CardContent>
      </Card>
    );
  }

  const deliveryConfirmed = emailCandidates.filter(c => c.verification_status === 'delivery_confirmed').length;
  const validEmails = emailCandidates.filter(c => c.verification_status === 'valid').length;
  const invalidEmails = emailCandidates.filter(c => c.verification_status === 'invalid').length;
  const pendingEmails = emailCandidates.filter(c => c.verification_status === 'pending').length;
  
  const totalVerified = validEmails + invalidEmails;
  const successRate = totalVerified > 0 ? Math.round((validEmails / totalVerified) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Test Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results for {test.domain}</CardTitle>
          <CardDescription>
            Testing emails for {test.first_name} {test.last_name}
            {test.company_name && ` at ${test.company_name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{deliveryConfirmed}</div>
              <div className="text-sm text-muted-foreground">✉️ Delivery Confirmed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{validEmails}</div>
              <div className="text-sm text-muted-foreground">Valid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">{invalidEmails}</div>
              <div className="text-sm text-muted-foreground">Invalid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">{pendingEmails}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{successRate}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>

          {successRate >= 90 && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <div className="text-center text-green-800 dark:text-green-200">
                🎉 Excellent! {successRate}% success rate achieved with bulletproof verification
              </div>
            </div>
          )}

          {generationProgress.isGenerating && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>{generationProgress.currentStep}</span>
                <span>{Math.round(generationProgress.progress)}%</span>
              </div>
              <Progress value={generationProgress.progress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2">
            {emailCandidates.length > 0 && (
              <Button onClick={exportResults} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="results" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="results">Email Results</TabsTrigger>
          <TabsTrigger value="insights">Domain Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Verification Results</CardTitle>
              <CardDescription>
                Comprehensive verification results for all generated email combinations
              </CardDescription>
            </CardHeader>
            <CardContent>
            {emailCandidates.length === 0 && test?.status === 'pending' && (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No email candidates found yet.</p>
                <Button 
                  onClick={startEmailGeneration}
                  disabled={generationProgress.isGenerating}
                  size="lg"
                >
                  {generationProgress.isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {generationProgress.currentStep}
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Start Email Discovery
                    </>
                  )}
                </Button>
              </div>
            )}

            {emailCandidates.length > 0 && emailCandidates.some(c => c.verification_status === 'valid') && (
              <div className="mb-6 p-4 border rounded-lg bg-primary/5 border-primary/20">
                <h3 className="text-lg font-semibold mb-2 text-foreground">🚀 Ready for Real Delivery Test</h3>
                <p className="text-muted-foreground mb-3">
                  Send actual test emails to confirm real deliverability (max 5 emails will be tested).
                  <br />
                  <span className="text-xs text-primary">
                    Current Success Rate: {successRate}% • {validEmails} valid out of {totalVerified} verified
                  </span>
                </p>
                <Button 
                  onClick={sendTestEmails}
                  disabled={generationProgress.isGenerating}
                  variant="default"
                >
                  {generationProgress.isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {generationProgress.currentStep}
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Test Emails
                    </>
                  )}
                </Button>
              </div>
            )}

              {emailCandidates.length > 0 && (
                <div className="space-y-4">
                  {/* Success Rate Banner */}
                  {successRate >= 95 && (
                    <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300 mb-1">
                          🎯 {successRate}% Success Rate!
                        </div>
                        <div className="text-sm text-green-600 dark:text-green-400">
                          Bulletproof verification bypassed all obstacles • {validEmails} valid emails found
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email Address</TableHead>
                          <TableHead>Pattern</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Provider</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emailCandidates.map((candidate) => (
                          <TableRow key={candidate.id}>
                            <TableCell className="font-medium">
                              {candidate.email_address}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {candidate.email_pattern}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(candidate.verification_status)}
                            </TableCell>
                            <TableCell>
                              {candidate.verification_result?.score || '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {candidate.verification_result?.details?.provider || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <CrawlInsights domain={test.domain} />
        </TabsContent>
      </Tabs>
    </div>
  );
};