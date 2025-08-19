import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  email: string;
  deliveryConfirmed: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
  verificationLevel: 'technical' | 'delivery_confirmed' | 'failed';
}

export const TestEmailForm: React.FC = () => {
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const { toast } = useToast();

  const handleTestDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!testEmail || !testEmail.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log('Testing real delivery to:', testEmail);
      
      const response = await supabase.functions.invoke('test-real-delivery', {
        body: { 
          testEmail: testEmail.toLowerCase().trim(),
          testId: 'manual-test'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setResult(response.data);

      if (response.data?.deliveryConfirmed) {
        toast({
          title: "✅ Delivery Confirmed!",
          description: `Email successfully delivered to ${testEmail}`,
        });
      } else {
        toast({
          title: "❌ Delivery Failed",
          description: response.data?.error || "Email could not be delivered",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Test delivery error:', error);
      
      setResult({
        email: testEmail,
        deliveryConfirmed: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        verificationLevel: 'failed'
      });

      toast({
        title: "Test failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getResultIcon = (result: TestResult) => {
    if (result.deliveryConfirmed) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else if (result.verificationLevel === 'failed') {
      return <XCircle className="h-5 w-5 text-red-600" />;
    } else {
      return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getResultBadge = (result: TestResult) => {
    if (result.deliveryConfirmed) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">✅ Delivery Confirmed</Badge>;
    } else if (result.verificationLevel === 'failed') {
      return <Badge variant="destructive">❌ Delivery Failed</Badge>;
    } else {
      return <Badge variant="secondary">⚠️ Technical Only</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Test Real Email Delivery
        </CardTitle>
        <CardDescription>
          Verify that our system can actually deliver emails to a real email address.
          This sends a real test email to confirm end-to-end delivery.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleTestDelivery} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="testEmail">Email Address to Test</Label>
            <Input
              id="testEmail"
              type="email"
              placeholder="your.email@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Enter any email address you have access to - a real test email will be sent to verify delivery.
            </p>
          </div>
          
          <Button type="submit" disabled={loading || !testEmail}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Test Email...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Test Email
              </>
            )}
          </Button>
        </form>

        {result && (
          <div className="mt-6 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-3">
              {getResultIcon(result)}
              <span className="font-semibold">Test Result for {result.email}</span>
              {getResultBadge(result)}
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  {result.deliveryConfirmed ? (
                    <span className="text-green-600">✅ Email delivered successfully!</span>
                  ) : (
                    <span className="text-red-600">❌ Email delivery failed</span>
                  )}
                </div>
                
                <div>
                  <span className="font-medium">Test Time:</span>{' '}
                  {new Date(result.timestamp).toLocaleString()}
                </div>
                
                {result.messageId && (
                  <div>
                    <span className="font-medium">Message ID:</span>{' '}
                    <code className="text-xs bg-muted px-1 rounded">{result.messageId}</code>
                  </div>
                )}
                
                {result.error && (
                  <div>
                    <span className="font-medium">Error:</span>{' '}
                    <span className="text-red-600">{result.error}</span>
                  </div>
                )}
              </div>
              
              {result.deliveryConfirmed && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                  <p className="text-green-800 dark:text-green-200 text-sm">
                    🎉 <strong>Success!</strong> The email system is working perfectly. 
                    Check your inbox for the test email. This confirms 100% real delivery capability.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
          <strong>How it works:</strong> This test sends an actual email to verify real delivery. 
          It confirms DNS MX records, SMTP acceptance, and inbox delivery - giving you 100% confidence 
          in email deliverability rather than just technical validation.
        </div>
      </CardContent>
    </Card>
  );
};