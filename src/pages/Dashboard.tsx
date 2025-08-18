import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/dashboard/Layout';
import { NewTestForm } from '@/components/email-hunter/NewTestForm';
import { TestResults } from '@/components/email-hunter/TestResults';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, History, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('new-test');
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    testsThisMonth: 0,
    emailsVerified: 0,
    successRate: 0
  });
  const { user } = useAuth();

  const handleTestCreated = (testId: string) => {
    setCurrentTestId(testId);
    setActiveTab('results');
    fetchStats(); // Refresh stats
  };

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Get tests this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: tests, error: testsError } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString());

      if (testsError) throw testsError;

      // Get email verification stats
      const { data: candidates, error: candidatesError } = await supabase
        .from('email_candidates')
        .select('verification_status, test_id')
        .in('test_id', tests?.map(t => t.id) || []);

      if (candidatesError) throw candidatesError;

      const totalEmails = candidates?.length || 0;
      const validEmails = candidates?.filter(c => c.verification_status === 'valid').length || 0;
      const successRateCalc = totalEmails > 0 ? Math.round((validEmails / totalEmails) * 100) : 0;

      setStats({
        testsThisMonth: tests?.length || 0,
        emailsVerified: totalEmails,
        successRate: successRateCalc
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tests This Month</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.testsThisMonth}</div>
              <p className="text-xs text-muted-foreground">
                {stats.testsThisMonth === 0 ? 'No tests yet' : 'Active verification tests'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Verified</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.emailsVerified}</div>
              <p className="text-xs text-muted-foreground">Total email checks completed</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.successRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.successRate >= 95 ? 'Excellent bulletproof verification!' : 'Deliverability accuracy rate'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Navigation */}
        <div className="flex space-x-4 border-b border-border">
          <Button
            variant={activeTab === 'new-test' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('new-test')}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Test</span>
          </Button>
          <Button
            variant={activeTab === 'results' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('results')}
            className="flex items-center space-x-2"
          >
            <History className="h-4 w-4" />
            <span>Test Results</span>
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'new-test' && (
            <div>
              <NewTestForm onTestCreated={handleTestCreated} />
            </div>
          )}

          {activeTab === 'results' && (
            currentTestId ? (
              <TestResults testId={currentTestId} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                  <CardDescription>
                    View and manage your email verification test results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No tests yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first email verification test to see results here.
                    </p>
                    <Button onClick={() => setActiveTab('new-test')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </Layout>
  );
};