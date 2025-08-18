import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building, User, Globe, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

const testSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  companyName: z.string().optional(),
  domain: z.string()
    .min(1, 'Domain is required')
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/, 'Invalid domain format'),
});

type TestFormData = z.infer<typeof testSchema>;

interface NewTestFormProps {
  onTestCreated?: (testId: string) => void;
}

export const NewTestForm: React.FC<NewTestFormProps> = ({ onTestCreated }) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TestFormData>({
    resolver: zodResolver(testSchema),
  });

  const onSubmit = async (data: TestFormData) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Authentication required',
        description: 'Please sign in to create a test.',
      });
      return;
    }

    setLoading(true);
    try {
      // Create the test record
      const { data: testData, error: testError } = await (supabase as any)
        .from('tests')
        .insert({
          user_id: user.id,
          domain: data.domain.toLowerCase(),
          company_name: data.companyName || null,
          first_name: data.firstName,
          last_name: data.lastName,
          status: 'pending',
        })
        .select()
        .single();

      if (testError || !testData) {
        throw new Error(testError?.message || 'Failed to create test');
      }

      // Log the action
      await (supabase as any).from('audit_logs').insert({
        user_id: user.id,
        action: 'test_created',
        metadata: {
          test_id: testData.id,
          domain: data.domain,
        },
      });

      // Automatically start email generation
      try {
        await supabase.functions.invoke('generate-email-candidates', {
          body: { testId: testData.id }
        });
      } catch (genError) {
        console.error('Auto-generation failed:', genError);
      }

      toast({
        title: 'Test created successfully!',
        description: `Email verification started automatically for ${data.domain}`,
      });

      if (onTestCreated) {
        onTestCreated(testData.id);
      }
    } catch (error: any) {
      console.error('Error creating test:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create test',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Email Verification Test</CardTitle>
        <CardDescription>
          Generate unlimited email permutations and perform comprehensive verification tests including syntax, DNS, deliverability, and delivery testing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="firstName"
                  placeholder="John"
                  className="pl-10"
                  {...register('firstName')}
                />
              </div>
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lastName"
                  placeholder="Doe"
                  className="pl-10"
                  {...register('lastName')}
                />
              </div>
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name (Optional)</Label>
            <div className="relative">
              <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="companyName"
                placeholder="Acme Corporation"
                className="pl-10"
                {...register('companyName')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Domain *</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="domain"
                placeholder="example.com"
                className="pl-10"
                {...register('domain')}
              />
            </div>
            {errors.domain && (
              <p className="text-sm text-destructive">{errors.domain.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter the domain without protocol (e.g., example.com, not https://example.com)
            </p>
          </div>

          <div className="space-y-4 p-4 border border-border rounded-md bg-gradient-to-br from-primary/5 to-secondary/5">
            <div className="text-sm font-medium text-foreground">
              Comprehensive Email Verification
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>✓ Unlimited email permutation generation</p>
              <p>✓ Syntax validation for all combinations</p>
              <p>✓ DNS MX record verification</p>
              <p>✓ SMTP deliverability testing</p>
              <p>✓ Live delivery confirmation tests</p>
              <p>✓ Real-time results display</p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Test...
              </>
            ) : (
              'Start Email Verification Test'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};