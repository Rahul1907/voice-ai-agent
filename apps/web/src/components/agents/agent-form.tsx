'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AGENT_LIMITS, AgentLanguage, DEFAULT_VOICES, VoiceDto } from '@voice-ai/shared';
import { Loader2, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client';

const agentSchema = z.object({
  name: z
    .string()
    .min(AGENT_LIMITS.NAME_MIN_LENGTH, 'Name must not be empty')
    .max(AGENT_LIMITS.NAME_MAX_LENGTH, 'Name must be 60 characters or less'),
  systemPrompt: z
    .string()
    .min(AGENT_LIMITS.SYSTEM_PROMPT_MIN_LENGTH, 'System prompt must be at least 10 characters')
    .max(AGENT_LIMITS.SYSTEM_PROMPT_MAX_LENGTH, 'System prompt must be 4000 characters or less'),
  greeting: z
    .string()
    .max(AGENT_LIMITS.GREETING_MAX_LENGTH, 'Greeting must be 300 characters or less')
    .optional(),
  voice: z.string().min(1, 'Voice is required'),
  language: z.enum(['en']).default('en'),
  llmModel: z.string().min(1, 'LLM model is required'),
  temperature: z.coerce
    .number()
    .min(0, 'Temperature must be at least 0')
    .max(1, 'Temperature must be at most 1'),
  maxCallDurationSec: z.coerce
    .number()
    .min(60, 'Duration must be at least 60 seconds')
    .max(900, 'Duration must be at most 900 seconds'),
});

export type AgentFormValues = z.infer<typeof agentSchema>;

interface AgentFormProps {
  initialValues?: Partial<AgentFormValues>;
  onSubmit: (values: AgentFormValues) => Promise<void>;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export function AgentForm({
  initialValues,
  onSubmit,
  submitLabel = 'Save Agent',
  isSubmitting = false,
}: AgentFormProps) {
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const { data: voices = DEFAULT_VOICES } = useQuery<VoiceDto[]>({
    queryKey: ['voices'],
    queryFn: () => apiClient.get<VoiceDto[]>('/voices'),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: initialValues?.name || '',
      systemPrompt: initialValues?.systemPrompt || '',
      greeting: initialValues?.greeting || AGENT_LIMITS.DEFAULT_GREETING,
      voice: initialValues?.voice || AGENT_LIMITS.DEFAULT_VOICE,
      language: initialValues?.language || AgentLanguage.EN,
      llmModel: initialValues?.llmModel || 'meta/llama-3.1-8b-instruct',
      temperature: initialValues?.temperature ?? AGENT_LIMITS.DEFAULT_TEMPERATURE,
      maxCallDurationSec:
        initialValues?.maxCallDurationSec ?? AGENT_LIMITS.DEFAULT_MAX_CALL_DURATION_SEC,
    },
  });

  const selectedVoiceId = watch('voice');

  const fallbackSpeechSynthesis = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        watch('greeting') || 'Hi! How can I help you today?',
      );
      utterance.onend = () => setIsPlayingVoice(false);
      utterance.onerror = () => setIsPlayingVoice(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsPlayingVoice(false), 1500);
    }
  };

  const handlePreviewVoice = () => {
    if (!selectedVoiceId || isPlayingVoice) return;
    setIsPlayingVoice(true);

    try {
      if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        const audio = new Audio(`/api/voices/${encodeURIComponent(selectedVoiceId)}/preview`);
        audio.onended = () => setIsPlayingVoice(false);
        audio.onerror = () => {
          fallbackSpeechSynthesis();
        };
        audio.play().catch(() => {
          fallbackSpeechSynthesis();
        });
      } else {
        fallbackSpeechSynthesis();
      }
    } catch {
      fallbackSpeechSynthesis();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1">
        <label htmlFor="agent-name" className="block text-sm font-medium text-foreground">
          Agent Name *
        </label>
        <input
          id="agent-name"
          type="text"
          placeholder="e.g. Support Specialist"
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
        <label htmlFor="agent-prompt" className="block text-sm font-medium text-foreground">
          System Instructions (Prompt) *
        </label>
        <textarea
          id="agent-prompt"
          rows={5}
          placeholder="Instructions guiding how the agent communicates, its persona, and task goals..."
          aria-invalid={!!errors.systemPrompt}
          aria-describedby={errors.systemPrompt ? 'prompt-error' : undefined}
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary leading-relaxed font-mono text-xs"
          {...register('systemPrompt')}
        />
        {errors.systemPrompt && (
          <p id="prompt-error" className="text-xs text-destructive mt-1">
            {errors.systemPrompt.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="agent-greeting" className="block text-sm font-medium text-foreground">
          Initial Greeting
        </label>
        <input
          id="agent-greeting"
          type="text"
          placeholder="First sentence spoken when connected"
          aria-invalid={!!errors.greeting}
          aria-describedby={errors.greeting ? 'greeting-error' : undefined}
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary"
          {...register('greeting')}
        />
        {errors.greeting && (
          <p id="greeting-error" className="text-xs text-destructive mt-1">
            {errors.greeting.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="agent-voice" className="block text-sm font-medium text-foreground">
            Voice
          </label>
          <div className="flex space-x-2">
            <select
              id="agent-voice"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary"
              {...register('voice')}
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.gender}, {v.accent})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handlePreviewVoice}
              disabled={isPlayingVoice}
              className="px-3 py-2 rounded-md border border-border bg-card hover:bg-muted text-xs font-medium text-foreground flex items-center space-x-1.5 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Preview voice audio"
            >
              <Volume2 className="w-4 h-4 text-primary" />
              <span>{isPlayingVoice ? 'Playing...' : 'Preview'}</span>
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="agent-model" className="block text-sm font-medium text-foreground">
            LLM Model
          </label>
          <select
            id="agent-model"
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary"
            {...register('llmModel')}
          >
            <option value="meta/llama-3.1-8b-instruct">Llama 3.1 8B Instruct (Fastest)</option>
            <option value="meta/llama-3.1-70b-instruct">
              Llama 3.1 70B Instruct (High Quality)
            </option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="agent-temperature" className="block text-sm font-medium text-foreground">
            Creativity / Temperature (0.0 to 1.0)
          </label>
          <input
            id="agent-temperature"
            type="number"
            step="0.1"
            min="0"
            max="1"
            aria-invalid={!!errors.temperature}
            aria-describedby={errors.temperature ? 'temp-error' : undefined}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary"
            {...register('temperature')}
          />
          {errors.temperature && (
            <p id="temp-error" className="text-xs text-destructive mt-1">
              {errors.temperature.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="agent-duration" className="block text-sm font-medium text-foreground">
            Max Duration Seconds (60 to 900)
          </label>
          <input
            id="agent-duration"
            type="number"
            step="30"
            min="60"
            max="900"
            aria-invalid={!!errors.maxCallDurationSec}
            aria-describedby={errors.maxCallDurationSec ? 'duration-error' : undefined}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary"
            {...register('maxCallDurationSec')}
          />
          {errors.maxCallDurationSec && (
            <p id="duration-error" className="text-xs text-destructive mt-1">
              {errors.maxCallDurationSec.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50 flex items-center space-x-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>{submitLabel}</span>
          )}
        </button>
      </div>
    </form>
  );
}
