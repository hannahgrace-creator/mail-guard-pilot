import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/dashboard/Layout';
import { NewTestForm } from '@/components/email-hunter/NewTestForm';
import { TestResults } from '@/components/email-hunter/TestResults';
import { TestEmailForm } from '@/components/email-hunter/TestEmailForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, History, BarChart3, Mail, Target, TrendingUp, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('new-test');
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    testsThisMonth: 0,
    emailsVerified: 0,
    successRate: 0,
    deliveryConfirmed: 0,
    realDeliveryRate: 0
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

      // Get comprehensive email verification stats
      const { data: candidates, error: candidatesError } = await supabase
        .from('email_candidates')
        .select('verification_status, test_id')
        .in('test_id', tests?.map(t => t.id) || []);

      if (candidatesError) throw candidatesError;

      const totalEmails = candidates?.length || 0;
      const validEmails = candidates?.filter(c => c.verification_status === 'valid').length || 0;
      const deliveryConfirmed = candidates?.filter(c => c.verification_status === 'delivery_confirmed').length || 0;
      const successRateCalc = totalEmails > 0 ? Math.round((validEmails / totalEmails) * 100) : 0;
      const realDeliveryRate = validEmails > 0 ? Math.round((deliveryConfirmed / validEmails) * 100) : 0;

      setStats({
        testsThisMonth: tests?.length || 0,
        emailsVerified: totalEmails,
        successRate: successRateCalc,
        deliveryConfirmed,
        realDeliveryRate
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
        {/* Comprehensive Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.emailsVerified}</div>
              <p className="text-xs text-muted-foreground">Total email checks completed</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Technical Success</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.successRate}%</div>
              <p className="text-xs text-muted-foreground">
                DNS/SMTP verification rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivery Confirmed</CardTitle>
              <Mail className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.deliveryConfirmed}</div>
              <p className="text-xs text-muted-foreground">Real emails delivered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Real Delivery Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.realDeliveryRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.realDeliveryRate >= 80 ? 'Excellent!' : 'End-to-end success'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Success Rate Banner */}
        {stats.realDeliveryRate >= 80 && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-xl font-bold text-green-700 dark:text-green-300 mb-1">
                  🎯 {stats.realDeliveryRate}% Real Delivery Success Rate Achieved!
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Your email verification system is performing at excellence level with confirmed real-world delivery
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Navigation */}
        <div className="flex space-x-1 border-b border-border">
          <Button
            variant={activeTab === 'new-test' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('new-test')}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Test</span>
          </Button>
          <Button
            variant={activeTab === 'test-delivery' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('test-delivery')}
            className="flex items-center space-x-2"
          >
            <FlaskConical className="h-4 w-4" />
            <span>Test Delivery</span>
          </Button>
          <Button
            variant={activeTab === 'results' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('results')}
            className="flex items-center space-x-2"
          >
            <History className="h-4 w-4" />
            <span>Results</span>
          </Button>
        </div>

        {/* Enhanced Tab Content */}
        <div className="space-y-6">
          {activeTab === 'new-test' && (
            <div>
              <NewTestForm onTestCreated={handleTestCreated} />
            </div>
          )}

          {activeTab === 'test-delivery' && (
            <div>
              <TestEmailForm />
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
                    View and manage your comprehensive email verification test results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No tests yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first email verification test to see comprehensive results including real delivery confirmation.
                    </p>
                    <div className="space-x-2">
                      <Button onClick={() => setActiveTab('new-test')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Test
                      </Button>
                      <Button onClick={() => setActiveTab('test-delivery')} variant="outline">
                        <FlaskConical className="h-4 w-4 mr-2" />
                        Test Real Delivery
                      </Button>
                    </div>
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