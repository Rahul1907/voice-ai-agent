'use client';

import { AgentDto } from '@voice-ai/shared';
import { Bot, Clock, Cpu, Mic, Settings, Trash2, Volume2 } from 'lucide-react';
import Link from 'next/link';

interface AgentCardProps {
  agent: AgentDto;
  onDelete: (agent: AgentDto) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3
                className="font-semibold text-foreground text-base tracking-tight truncate max-w-[200px]"
                title={agent.name}
              >
                {agent.name}
              </h3>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-0.5">
                <span className="uppercase font-semibold tracking-wider bg-muted px-1.5 py-0.5 rounded text-[10px]">
                  {agent.language}
                </span>
                <span>•</span>
                <span className="flex items-center">
                  <Volume2 className="w-3 h-3 mr-1" />
                  {agent.voice}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {agent.systemPrompt}
        </p>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1.5 truncate" title={agent.llmModel}>
            <Cpu className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="truncate">{agent.llmModel.split('/').pop()}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span>{Math.round(agent.maxCallDurationSec / 60)} min limit</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border space-x-2">
        <button
          type="button"
          onClick={() => onDelete(agent)}
          className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Delete agent ${agent.name}`}
          title="Delete agent"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-2">
          <Link
            href={`/agents/${agent.id}`}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configure</span>
          </Link>
          <Link
            href={`/agents/${agent.id}?tab=calls`}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover text-xs font-medium transition-colors shadow-sm"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Call</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
