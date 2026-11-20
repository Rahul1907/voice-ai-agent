'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient, ApiError } from '../../../lib/api-client';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get('expired') === '1';

  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      await apiClient.post('/auth/login', data);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.messages.join(' '));
      } else {
        setServerError('Invalid email or password. Please try again.');
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in to Voice AI</h1>
          <p className="text-sm text-muted-foreground">
            Manage your AI voice agents and monitor live calls
          </p>
        </div>

        {isExpired && (
          <div
            role="alert"
            className="p-3 text-sm rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400"
          >
            Your session has expired. Please log in again.
          </div>
        )}

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
            <label htmlFor="login-email" className="block text-sm font-medium text-foreground">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary"
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="text-xs text-destructive mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="login-password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary"
              {...register('password')}
            />
            {errors.password && (
              <p id="password-error" className="text-xs text-destructive mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
