'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentDto } from '@voice-ai/shared';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  FileText,
  Loader2,
  Mic,
  Phone,
  Settings,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AgentForm, AgentFormValues } from '../../../components/agents/agent-form';
import { DeleteAgentDialog } from '../../../components/agents/delete-agent-dialog';
import { Navbar } from '../../../components/layout/navbar';
import { apiClient, ApiError } from '../../../lib/api-client';

function AgentDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const id = params?.id as string;
  const initialTab = (searchParams.get('tab') as 'settings' | 'knowledge' | 'calls') || 'settings';
  const [activeTab, setActiveTab] = useState<'settings' | 'knowledge' | 'calls'>(initialTab);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    data: agent,
    isLoading,
    isError,
    error,
  } = useQuery<AgentDto>({
    queryKey: ['agents', id],
    queryFn: () => apiClient.get<AgentDto>(`/agents/${id}`),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (values: Partial<AgentFormValues>) =>
      apiClient.patch<AgentDto>(`/agents/${id}`, values),
    onSuccess: (updated) => {
      queryClient.setQueryData(['agents', id], updated);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setErrorMsg(err.messages.join(' '));
      } else {
        setErrorMsg('Failed to update agent.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      router.push('/dashboard');
    },
  });

  const handleUpdate = async (values: AgentFormValues) => {
    setErrorMsg(null);
    await updateMutation.mutateAsync(values);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading agent details...</p>
      </div>
    );
  }

  if (isError || !agent) {
    return (
      <div className="flex-1 max-w-4xl mx-auto px-4 py-12">
        <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive space-y-3">
          <h2 className="font-semibold text-lg">Agent not found</h2>
          <p className="text-sm">
            {error instanceof Error
              ? error.message
              : 'This agent does not exist or has been deleted.'}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium underline mt-2"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to agents</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground truncate max-w-md">
                {agent.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                ID: <span className="font-mono">{agent.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsDeleting(true)}
              className="p-2.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Delete agent"
              title="Delete agent"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calls')}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-hover transition-colors shadow-sm"
            >
              <Mic className="w-4 h-4" />
              <span>Start Call</span>
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-border flex space-x-6 text-sm font-medium" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-2 pb-3 border-b-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'knowledge'}
          onClick={() => setActiveTab('knowledge')}
          className={`flex items-center space-x-2 pb-3 border-b-2 transition-colors ${
            activeTab === 'knowledge'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Knowledge</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'calls'}
          onClick={() => setActiveTab('calls')}
          className={`flex items-center space-x-2 pb-3 border-b-2 transition-colors ${
            activeTab === 'calls'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Phone className="w-4 h-4" />
          <span>Call History</span>
        </button>
      </div>

      {saveSuccess && (
        <div
          role="status"
          className="p-3 text-sm rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center space-x-2"
        >
          <Check className="w-4 h-4" />
          <span>Agent settings saved successfully!</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-3 text-sm rounded-lg bg-destructive/10 border border-destructive/20 text-destructive"
        >
          {errorMsg}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <AgentForm
            initialValues={agent}
            onSubmit={handleUpdate}
            submitLabel="Update Agent"
            isSubmitting={updateMutation.isPending}
          />
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="border border-border rounded-2xl p-12 text-center space-y-4 bg-card shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Knowledge Base</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Upload PDF and TXT documents for RAG retrieval during live agent calls. Document
              vector chunking & indexing arrives in Phase 9.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'calls' && (
        <div className="border border-border rounded-2xl p-12 text-center space-y-4 bg-card shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Phone className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Live Calls & Transcripts</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Interactive WebRTC live calls, audio playback, real-time transcripts, and latency turn
              metrics arrive in Phase 10.
            </p>
          </div>
        </div>
      )}

      <DeleteAgentDialog
        isOpen={isDeleting}
        agentName={agent.name}
        isDeleting={deleteMutation.isPending}
        onClose={() => setIsDeleting(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </main>
  );
}

export default function AgentDetailPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <AgentDetailContent />
      </Suspense>
    </div>
  );
}
