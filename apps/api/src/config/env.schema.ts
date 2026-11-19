import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

    API_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.string().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_URL_TEST: z.string().optional(),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    REDIS_URL_TEST: z.string().optional(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('1d'),
    INTERNAL_API_KEY: z.string().min(16, 'INTERNAL_API_KEY must be at least 16 characters'),
    INTERNAL_API_URL: z.string().default('http://localhost:4000'),

    LIVEKIT_URL: z.string().min(1, 'LIVEKIT_URL is required'),
    LIVEKIT_API_KEY: z.string().min(1, 'LIVEKIT_API_KEY is required'),
    LIVEKIT_API_SECRET: z.string().min(1, 'LIVEKIT_API_SECRET is required'),
    LIVEKIT_AGENT_NAME: z.string().default('voice-agent'),

    PROVIDER_MODE: z.enum(['real', 'mock']).default('real'),

    GROQ_API_KEY: z.string().optional().default(''),
    GROQ_BASE_URL: z.string().default('https://api.groq.com/openai/v1'),
    GROQ_STT_MODEL: z.string().default('whisper-large-v3-turbo'),

    NVIDIA_API_KEY: z.string().optional().default(''),
    NVIDIA_BASE_URL: z.string().default('https://integrate.api.nvidia.com/v1'),
    NVIDIA_LLM_MODEL: z.string().default('meta/llama-3.1-8b-instruct'),
    NVIDIA_LLM_FALLBACK_MODEL: z.string().optional().default(''),
    NVIDIA_EMBED_MODEL: z.string().default('nvidia/nv-embedqa-e5-v5'),
    EMBED_DIM: z.coerce.number().int().positive().default(1024),
    LLM_MAX_TOKENS: z.coerce.number().int().positive().default(300),

    TTS_SERVER_URL: z.string().default('http://localhost:5100'),
    TTS_PORT: z.coerce.number().int().positive().default(5100),
    TTS_MODE: z.enum(['kokoro', 'mock']).default('kokoro'),
    KOKORO_DTYPE: z.string().default('q8'),

    MOCK_PROVIDERS_URL: z.string().default('http://localhost:5200'),

    MAX_CALL_DURATION_SEC: z.coerce.number().int().positive().default(600),
    IDLE_PROMPT_SEC: z.coerce.number().int().positive().default(30),
    IDLE_HANGUP_SEC: z.coerce.number().int().positive().default(60),
    MAX_CONCURRENT_CALLS: z.coerce.number().int().positive().default(3),
    MAX_AGENTS_PER_USER: z.coerce.number().int().positive().default(10),
    MAX_DOCS_PER_AGENT: z.coerce.number().int().positive().default(5),
    MAX_UPLOAD_MB: z.coerce.number().int().positive().default(5),
    DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
  })
  .superRefine((data, ctx) => {
    if (data.PROVIDER_MODE === 'real') {
      if (!data.GROQ_API_KEY || data.GROQ_API_KEY.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GROQ_API_KEY'],
          message: 'GROQ_API_KEY is required when PROVIDER_MODE is "real"',
        });
      }
      if (!data.NVIDIA_API_KEY || data.NVIDIA_API_KEY.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['NVIDIA_API_KEY'],
          message: 'NVIDIA_API_KEY is required when PROVIDER_MODE is "real"',
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: Record<string, unknown> = process.env): EnvConfig {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorMessages = result.error.errors.map(
      (err) => `  - ${err.path.join('.')}: ${err.message}`,
    );
    const formattedError = `Config validation error: Missing or invalid environment variables:\n${errorMessages.join('\n')}`;
    throw new Error(formattedError);
  }

  return result.data;
}
