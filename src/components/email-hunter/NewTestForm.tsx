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
  maxPermutations: z.number().min(1).max(2000).default(2000),
  consent: z.boolean().refine(val => val === true, 'You must confirm you have permission to test this domain'),
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
    setValue,
    watch,
  } = useForm<TestFormData>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      maxPermutations: 2000,
      consent: false,
    },
  });

  const consent = watch('consent');

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
      const { data: testData, error: testError } = await supabase
        .from('tests')
        .insert({
          user_id: user.id,
          domain: data.domain.toLowerCase(),
          company_name: data.companyName || null,
          first_name: data.firstName,
          last_name: data.lastName,
          consent: data.consent,
          max_permutations: data.maxPermutations,
          status: 'pending',
        })
        .select()
        .single();

      if (testError) {
        throw testError;
      }

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'test_created',
        metadata: {
          test_id: testData.id,
          domain: data.domain,
          max_permutations: data.maxPermutations,
        },
      });

      toast({
        title: 'Test created successfully!',
        description: `Email verification test started for ${data.domain}`,
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
          Generate email permutations and test deliverability for a domain. 
          Only proceed if you have permission to test the specified domain.
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

          <div className="space-y-2">
            <Label htmlFor="maxPermutations">Maximum Permutations</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="maxPermutations"
                type="number"
                min="1"
                max="2000"
                placeholder="2000"
                className="pl-10"
                {...register('maxPermutations', { valueAsNumber: true })}
              />
            </div>
            {errors.maxPermutations && (
              <p className="text-sm text-destructive">{errors.maxPermutations.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Maximum number of email permutations to generate (1-2000)
            </p>
          </div>

          <div className="space-y-4 p-4 border border-border rounded-md bg-muted/50">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(checked) => setValue('consent', checked as boolean)}
              />
              <div className="space-y-2">
                <Label htmlFor="consent" className="text-sm font-medium leading-5">
                  I confirm I have permission to test the specified domain and any addresses generated.
                  I will not use this tool for spam or unauthorized access.
                </Label>
                {errors.consent && (
                  <p className="text-sm text-destructive">{errors.consent.message}</p>
                )}
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• This tool performs DNS MX lookups and SMTP connection tests</p>
              <p>• All activity is logged for compliance and audit purposes</p>
              <p>• Rate limits apply: max 200 test emails per day, 10 per minute</p>
              <p>• Test emails will only be sent to verified deliverable addresses</p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !consent}>
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