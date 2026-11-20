'use client';

import { useMutation } from '@tanstack/react-query';
import { AgentDto } from '@voice-ai/shared';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AgentForm, AgentFormValues } from '../../../components/agents/agent-form';
import { Navbar } from '../../../components/layout/navbar';
import { apiClient, ApiError } from '../../../lib/api-client';

export default function NewAgentPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (values: AgentFormValues) => apiClient.post<AgentDto>('/agents', values),
    onSuccess: (newAgent) => {
      router.push(`/agents/${newAgent.id}`);
      router.refresh();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setErrorMsg(err.messages.join(' '));
      } else {
        setErrorMsg('Failed to create agent. Please check your inputs.');
      }
    },
  });

  const handleSubmit = async (values: AgentFormValues) => {
    setErrorMsg(null);
    await createMutation.mutateAsync(values);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4 space-x-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to agents</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Voice Agent</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure system persona, voice parameters, and model options for this agent
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm"
          >
            {errorMsg}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <AgentForm
            onSubmit={handleSubmit}
            submitLabel="Create Agent"
            isSubmitting={createMutation.isPending}
          />
        </div>
      </main>
    </div>
  );
}
