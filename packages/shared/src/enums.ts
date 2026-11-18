export const AgentLanguage = {
  EN: 'en',
} as const;
export type AgentLanguage = (typeof AgentLanguage)[keyof typeof AgentLanguage];

export const CallStatus = {
  CREATED: 'CREATED',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  FAILED: 'FAILED',
} as const;
export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

export const CallEndReason = {
  USER_HANGUP: 'USER_HANGUP',
  AGENT_ENDED: 'AGENT_ENDED',
  IDLE: 'IDLE',
  TIMEOUT: 'TIMEOUT',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
} as const;
export type CallEndReason = (typeof CallEndReason)[keyof typeof CallEndReason];

export const SummaryStatus = {
  PENDING: 'PENDING',
  DONE: 'DONE',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;
export type SummaryStatus = (typeof SummaryStatus)[keyof typeof SummaryStatus];

export const TranscriptRole = {
  USER: 'USER',
  AGENT: 'AGENT',
} as const;
export type TranscriptRole = (typeof TranscriptRole)[keyof typeof TranscriptRole];

export const DocumentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const ProviderMode = {
  REAL: 'real',
  MOCK: 'mock',
} as const;
export type ProviderMode = (typeof ProviderMode)[keyof typeof ProviderMode];

export const TtsMode = {
  KOKORO: 'kokoro',
  MOCK: 'mock',
} as const;
export type TtsMode = (typeof TtsMode)[keyof typeof TtsMode];
