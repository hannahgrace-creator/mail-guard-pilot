import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail, 
  Server, 
  Globe, 
  Send,
  RefreshCw,
  Download
} from 'lucide-react';

interface EmailCandidate {
  id: string;
  email_address: string;
  email_pattern: string;
  verification_status: 'pending' | 'syntax_valid' | 'syntax_invalid' | 'dns_valid' | 'dns_invalid' | 'deliverable' | 'undeliverable' | 'delivered' | 'bounced';
  verification_result: {
    syntax_check?: boolean;
    dns_check?: boolean;
    smtp_check?: boolean;
    delivery_test?: boolean;
    mx_records?: string[];
    error_message?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface Test {
  id: string;
  domain: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  status: 'pending' | 'generating' | 'verifying' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

interface TestResultsProps {
  testId?: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'syntax_valid':
    case 'dns_valid':
    case 'deliverable':
    case 'delivered':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'syntax_invalid':
    case 'dns_invalid':
    case 'undeliverable':
    case 'bounced':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    'syntax_valid': 'default',
    'dns_valid': 'default',
    'deliverable': 'default',
    'delivered': 'default',
    'syntax_invalid': 'destructive',
    'dns_invalid': 'destructive',
    'undeliverable': 'destructive',
    'bounced': 'destructive',
    'pending': 'secondary',
  };

  return (
    <Badge variant={variants[status] || 'outline'}>
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );
};

export const TestResults: React.FC<TestResultsProps> = ({ testId }) => {
  const [test, setTest] = useState<Test | null>(null);
  const [candidates, setCandidates] = useState<EmailCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTestData = async () => {
    if (!testId || !user) return;

    try {
      // Fetch test details
      const { data: testData, error: testError } = await (supabase as any)
        .from('tests')
        .select('*')
        .eq('id', testId)
        .single();

      if (testError) throw testError;
      setTest(testData);

      // Fetch email candidates
      const { data: candidatesData, error: candidatesError } = await (supabase as any)
        .from('email_candidates')
        .select('*')
        .eq('test_id', testId)
        .order('created_at', { ascending: false });

      if (candidatesError) throw candidatesError;
      setCandidates(candidatesData || []);

      // Calculate progress
      if (candidatesData && candidatesData.length > 0) {
        const completed = candidatesData.filter((c: EmailCandidate) => 
          c.verification_status !== 'pending'
        ).length;
        setVerificationProgress((completed / candidatesData.length) * 100);
      }

    } catch (error: any) {
      console.error('Error fetching test data:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading test results',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const startEmailGeneration = async () => {
    if (!testId || !user) return;

    try {
      // Call edge function to start email generation and verification
      const { data, error } = await supabase.functions.invoke('generate-email-candidates', {
        body: { testId }
      });

      if (error) throw error;

      toast({
        title: 'Email generation started',
        description: 'Generating email combinations and starting verification...',
      });

      // Refresh data
      fetchTestData();
    } catch (error: any) {
      console.error('Error starting email generation:', error);
      toast({
        variant: 'destructive',
        title: 'Error starting generation',
        description: error.message,
      });
    }
  };

  const exportResults = () => {
    if (candidates.length === 0) return;

    const csvContent = [
      ['Email Address', 'Pattern', 'Status', 'Syntax Check', 'DNS Check', 'SMTP Check', 'Delivery Test', 'MX Records', 'Error Message'],
      ...candidates.map(candidate => [
        candidate.email_address,
        candidate.email_pattern,
        candidate.verification_status,
        candidate.verification_result?.syntax_check ? 'Pass' : 'Fail',
        candidate.verification_result?.dns_check ? 'Pass' : 'Fail',
        candidate.verification_result?.smtp_check ? 'Pass' : 'Fail',
        candidate.verification_result?.delivery_test ? 'Pass' : 'Fail',
        candidate.verification_result?.mx_records?.join('; ') || '',
        candidate.verification_result?.error_message || ''
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

  // Auto-refresh every 5 seconds if verification is in progress
  useEffect(() => {
    if (test?.status === 'verifying' || test?.status === 'generating') {
      const interval = setInterval(fetchTestData, 5000);
      return () => clearInterval(interval);
    }
  }, [test?.status]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
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

  return (
    <div className="space-y-6">
      {/* Test Overview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {test.domain}
              </CardTitle>
              <CardDescription>
                Testing emails for {test.first_name} {test.last_name}
                {test.company_name && ` at ${test.company_name}`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchTestData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {candidates.length > 0 && (
                <Button onClick={exportResults} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{candidates.length}</div>
              <div className="text-sm text-muted-foreground">Email Candidates</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {candidates.filter(c => ['delivered', 'deliverable'].includes(c.verification_status)).length}
              </div>
              <div className="text-sm text-muted-foreground">Deliverable</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {candidates.filter(c => ['bounced', 'undeliverable'].includes(c.verification_status)).length}
              </div>
              <div className="text-sm text-muted-foreground">Undeliverable</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">
                {candidates.filter(c => c.verification_status === 'pending').length}
              </div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>

          {verificationProgress > 0 && verificationProgress < 100 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Verification Progress</span>
                <span>{Math.round(verificationProgress)}%</span>
              </div>
              <Progress value={verificationProgress} className="w-full" />
            </div>
          )}

          {candidates.length === 0 && test.status === 'pending' && (
            <div className="text-center mt-4">
              <Button onClick={startEmailGeneration}>
                <Send className="h-4 w-4 mr-2" />
                Start Email Generation & Verification
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Candidates Table */}
      {candidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Email Verification Results</CardTitle>
            <CardDescription>
              Comprehensive verification results for all generated email combinations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">
                      <Mail className="h-4 w-4 inline mr-1" />
                      Syntax
                    </TableHead>
                    <TableHead className="text-center">
                      <Server className="h-4 w-4 inline mr-1" />
                      DNS
                    </TableHead>
                    <TableHead className="text-center">
                      <Globe className="h-4 w-4 inline mr-1" />
                      SMTP
                    </TableHead>
                    <TableHead className="text-center">
                      <Send className="h-4 w-4 inline mr-1" />
                      Delivery
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="font-medium">
                        {candidate.email_address}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {candidate.email_pattern}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(candidate.verification_status)}
                          {getStatusBadge(candidate.verification_status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {candidate.verification_result?.syntax_check === true ? (
                          <CheckCircle className="h-4 w-4 text-green-500 inline" />
                        ) : candidate.verification_result?.syntax_check === false ? (
                          <XCircle className="h-4 w-4 text-red-500 inline" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-500 inline" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {candidate.verification_result?.dns_check === true ? (
                          <CheckCircle className="h-4 w-4 text-green-500 inline" />
                        ) : candidate.verification_result?.dns_check === false ? (
                          <XCircle className="h-4 w-4 text-red-500 inline" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-500 inline" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {candidate.verification_result?.smtp_check === true ? (
                          <CheckCircle className="h-4 w-4 text-green-500 inline" />
                        ) : candidate.verification_result?.smtp_check === false ? (
                          <XCircle className="h-4 w-4 text-red-500 inline" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-500 inline" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {candidate.verification_result?.delivery_test === true ? (
                          <CheckCircle className="h-4 w-4 text-green-500 inline" />
                        ) : candidate.verification_result?.delivery_test === false ? (
                          <XCircle className="h-4 w-4 text-red-500 inline" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-500 inline" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};