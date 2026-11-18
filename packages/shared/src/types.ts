import type {
  AgentLanguage,
  CallEndReason,
  CallStatus,
  DocumentStatus,
  SummaryStatus,
  TranscriptRole,
} from './enums';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceDto {
  id: string;
  name: string;
  gender: 'female' | 'male';
  accent: string;
}

export interface AgentDto {
  id: string;
  userId: string;
  name: string;
  systemPrompt: string;
  greeting: string;
  voice: string;
  language: AgentLanguage;
  llmModel: string;
  temperature: number;
  maxCallDurationSec: number;
  createdAt: string;
  updatedAt: string;
}

export interface CallDto {
  id: string;
  userId: string;
  agentId: string;
  agentName?: string;
  roomName: string;
  status: CallStatus;
  endReason: CallEndReason | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  summary: string | null;
  summaryStatus: SummaryStatus;
  avgLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
}

export interface TranscriptSegmentDto {
  id: string;
  callId: string;
  segmentId: string;
  role: TranscriptRole;
  text: string;
  sequence: number;
  spokenAt: string;
}

export interface TurnMetricDto {
  id: string;
  callId: string;
  turnIndex: number;
  eouDelayMs: number | null;
  sttMs: number | null;
  llmTtftMs: number | null;
  ttsTtfbMs: number | null;
  totalMs: number | null;
  createdAt: string;
}

export interface CallDetailDto extends CallDto {
  transcripts: TranscriptSegmentDto[];
  metrics: TurnMetricDto[];
}

export interface StartCallResponseDto {
  callId: string;
  roomName: string;
  token: string;
  livekitUrl: string;
}

export interface WorkerCallConfigDto {
  callId: string;
  agentId: string;
  agentName: string;
  systemPrompt: string;
  greeting: string;
  voice: string;
  llmModel: string;
  temperature: number;
  maxCallDurationSec: number;
  hasKnowledgeBase: boolean;
  timezone: string;
}

export interface KnowledgeDocumentDto {
  id: string;
  agentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  error: string | null;
  chunkCount: number;
  createdAt: string;
}

export interface KnowledgeSearchResultDto {
  documentId: string;
  content: string;
  score: number;
}

export interface LatencyAnalyticsDto {
  agentId: string;
  callCount: number;
  avgLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string[];
  requestId: string;
}
