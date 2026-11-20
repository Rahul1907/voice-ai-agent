'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentDto, PaginatedResponse } from '@voice-ai/shared';
import { Bot, Loader2, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AgentCard } from '../../components/agents/agent-card';
import { DeleteAgentDialog } from '../../components/agents/delete-agent-dialog';
import { Navbar } from '../../components/layout/navbar';
import { apiClient } from '../../lib/api-client';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [deletingAgent, setDeletingAgent] = useState<AgentDto | null>(null);

  const { data, isLoading, isError, error } = useQuery<PaginatedResponse<AgentDto>>({
    queryKey: ['agents'],
    queryFn: () => apiClient.get<PaginatedResponse<AgentDto>>('/agents?pageSize=50'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setDeletingAgent(null);
    },
    onError: () => {
      setDeletingAgent(null);
    },
  });

  const agents = data?.items || [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Voice Agents</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure and test your conversational AI voice agents with real-time speech
            </p>
          </div>

          <Link
            href="/agents/new"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Agent</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading your agents...</p>
          </div>
        ) : isError ? (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            Failed to load agents: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : agents.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center space-y-4 max-w-lg mx-auto my-12 bg-card/40">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <Bot className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">No agents yet</h2>
              <p className="text-sm text-muted-foreground">
                Get started by creating your first voice assistant with custom persona and Kokoro
                speech.
              </p>
            </div>
            <Link
              href="/agents/new"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create your first agent</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onDelete={(target) => setDeletingAgent(target)}
              />
            ))}
          </div>
        )}
      </main>

      <DeleteAgentDialog
        isOpen={!!deletingAgent}
        agentName={deletingAgent?.name || ''}
        isDeleting={deleteMutation.isPending}
        onClose={() => setDeletingAgent(null)}
        onConfirm={() => {
          if (deletingAgent) {
            deleteMutation.mutate(deletingAgent.id);
          }
        }}
      />
    </div>
  );
}
