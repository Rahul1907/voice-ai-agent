import type { VoiceDto } from './types';

export const DEFAULT_VOICE_ID = 'af_heart' as const;

export const DEFAULT_VOICES: readonly VoiceDto[] = [
  { id: 'af_heart', name: 'Heart', gender: 'female', accent: 'American' },
  { id: 'af_bella', name: 'Bella', gender: 'female', accent: 'American' },
  { id: 'af_sarah', name: 'Sarah', gender: 'female', accent: 'American' },
  { id: 'am_adam', name: 'Adam', gender: 'male', accent: 'American' },
  { id: 'am_michael', name: 'Michael', gender: 'male', accent: 'American' },
  { id: 'bf_emma', name: 'Emma', gender: 'female', accent: 'British' },
  { id: 'bm_george', name: 'George', gender: 'male', accent: 'British' },
] as const;

export const AUTH_LIMITS = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 72,
  COOKIE_NAME: 'access_token',
  THROTTLE_TTL_MS: 60_000,
  THROTTLE_LIMIT: 5,
} as const;

export const AGENT_LIMITS = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 60,
  SYSTEM_PROMPT_MIN_LENGTH: 10,
  SYSTEM_PROMPT_MAX_LENGTH: 4000,
  GREETING_MIN_LENGTH: 0,
  GREETING_MAX_LENGTH: 300,
  DEFAULT_GREETING: 'Hi! How can I help you today?',
  DEFAULT_VOICE: DEFAULT_VOICE_ID,
  TEMPERATURE_MIN: 0,
  TEMPERATURE_MAX: 1,
  DEFAULT_TEMPERATURE: 0.6,
  MAX_CALL_DURATION_MIN_SEC: 60,
  MAX_CALL_DURATION_MAX_SEC: 900,
  DEFAULT_MAX_CALL_DURATION_SEC: 600,
  DEFAULT_MAX_AGENTS_PER_USER: 10,
} as const;

export const CALL_LIMITS = {
  DEFAULT_MAX_CONCURRENT_CALLS: 3,
  DEFAULT_IDLE_PROMPT_SEC: 30,
  DEFAULT_IDLE_HANGUP_SEC: 60,
  STALE_CREATED_TIMEOUT_SEC: 120,
  STALE_ACTIVE_GRACE_SEC: 60,
  POST_END_TRANSCRIPT_GRACE_SEC: 30,
  TOKEN_TTL_SEC: 900,
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
} as const;

export const PAGINATION_LIMITS = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,
} as const;

export const KNOWLEDGE_LIMITS = {
  DEFAULT_MAX_DOCS_PER_AGENT: 5,
  DEFAULT_MAX_UPLOAD_MB: 5,
  MAX_FILENAME_LENGTH: 100,
  CHUNK_SIZE_CHARS: 800,
  CHUNK_OVERLAP_CHARS: 100,
  DEFAULT_TOP_K: 4,
  MAX_SEARCH_RESULT_CHARS: 2000,
  DEFAULT_EMBED_DIM: 1024,
  ALLOWED_EXTENSIONS: ['.txt', '.md', '.pdf'] as readonly string[],
} as const;

export const TTS_LIMITS = {
  SAMPLE_RATE_HZ: 24_000,
  CHANNELS: 1,
  BIT_DEPTH: 16,
  TEXT_MIN_LENGTH: 1,
  TEXT_MAX_LENGTH: 1000,
  SPEED_MIN: 0.5,
  SPEED_MAX: 2.0,
  DEFAULT_SPEED: 1.0,
} as const;
