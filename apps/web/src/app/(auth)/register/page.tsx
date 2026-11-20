'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient, ApiError } from '../../../lib/api-client';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60, 'Name must be 60 characters or less'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or less'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setServerError(null);
    try {
      await apiClient.post('/auth/register', data);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.messages.join(' '));
      } else {
        setServerError('Registration failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-md">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-primary items-center justify-center text-primary-foreground shadow-sm">
            <Bot className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Get started building real-time voice AI agents
          </p>
        </div>

        {serverError && (
          <div
            role="alert"
            className="p-3 text-sm rounded-lg bg-destructive/10 border border-destructive/20 text-destructive"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="reg-name" className="block text-sm font-medium text-foreground">
              Full name
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary"
              {...register('name')}
            />
            {errors.name && (
              <p id="name-error" className="text-xs text-destructive mt-1">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="reg-email" className="block text-sm font-medium text-foreground">
              Email address
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'reg-email-error' : undefined}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary"
              {...register('email')}
            />
            {errors.email && (
              <p id="reg-email-error" className="text-xs text-destructive mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="reg-password" className="block text-sm font-medium text-foreground">
              Password (min. 8 characters)
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'reg-password-error' : undefined}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary"
              {...register('password')}
            />
            {errors.password && (
              <p id="reg-password-error" className="text-xs text-destructive mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              <span>Create account</span>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
