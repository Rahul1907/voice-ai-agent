import { DEFAULT_VOICES } from '@voice-ai/shared';
import Fastify, { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TTSEngine } from './tts-engine.js';

const synthesizeSchema = z.object({
  text: z
    .string()
    .min(1, 'Text must not be empty')
    .max(1000, 'Text must be 1000 characters or less'),
  voice: z.string().min(1, 'Voice must be specified'),
  speed: z.number().min(0.5).max(2.0).optional().default(1.0),
});

export interface BuildServerOptions {
  ttsEngine?: TTSEngine;
  logger?: boolean;
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const server = Fastify({
    logger: options.logger ?? false,
  });

  const ttsEngine = options.ttsEngine || new TTSEngine();

  // GET /health
  server.get('/health', async (_req, reply) => {
    if (!ttsEngine.isReady) {
      return reply.status(503).send({ status: 'loading' });
    }
    return reply.status(200).send({ status: 'ready' });
  });

  // GET /voices
  server.get('/voices', async (_req, reply) => {
    return reply.status(200).send(DEFAULT_VOICES);
  });

  // POST /synthesize
  server.post('/synthesize', async (req, reply) => {
    const parseResult = synthesizeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { text, voice, speed } = parseResult.data;

    if (!ttsEngine.isValidVoice(voice)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: [`Unknown voice: ${voice}`],
      });
    }

    try {
      const pcmBuffer = await ttsEngine.synthesize(text, voice, speed);

      return reply
        .status(200)
        .header('Content-Type', 'application/octet-stream')
        .header('x-sample-rate', '24000')
        .send(pcmBuffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Synthesis failed';
      const statusCode =
        msg.includes('empty') || msg.includes('Unknown voice') || msg.includes('1000') ? 400 : 500;
      return reply.status(statusCode).send({
        statusCode,
        error: statusCode === 400 ? 'Bad Request' : 'Internal Server Error',
        message: [msg],
      });
    }
  });

  return server;
}
