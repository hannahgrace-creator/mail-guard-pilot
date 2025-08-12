import React, { useState } from 'react';
import { Layout } from '@/components/dashboard/Layout';
import { NewTestForm } from '@/components/email-hunter/NewTestForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, History, BarChart3 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('new-test');

  const handleTestCreated = (testId: string) => {
    // Navigate to test results or update UI
    setActiveTab('results');
    console.log('Test created with ID:', testId);
  };

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
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">No tests yet</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Verified</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Total email checks</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--%</div>
              <p className="text-xs text-muted-foreground">Deliverability rate</p>
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
          )}
        </div>
      </div>
    </Layout>
  );
};