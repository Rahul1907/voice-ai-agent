import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { mockState, RecordedRequest } from './mock-state.js';
import { ChatMessage, evaluateChatRules, ToolDefinition } from './utils/chat-rules.js';
import { generateBagOfWordsEmbedding } from './utils/embeddings.js';

export async function createMockProvidersServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false,
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(multipart, {
    attachFieldsToBody: true,
  });

  // Global preHandler hook: failure injection and request recording
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Record request (avoid recording admin reset or requests endpoints to keep log clean)
    if (!request.url.startsWith('/__admin/requests')) {
      mockState.recordRequest({
        method: request.method,
        url: request.url,
        headers: request.headers as Record<string, unknown>,
        body: request.body,
        query: request.query,
      });
    }

    // Check for failure injection (excluding /__admin routes)
    if (!request.url.startsWith('/__admin')) {
      const failureStatus = mockState.checkFailure(request.url);
      if (failureStatus) {
        return reply.status(failureStatus).send({
          error: {
            message: `Injected mock failure: ${failureStatus}`,
            type: failureStatus === 429 ? 'rate_limit_error' : 'server_error',
            code: failureStatus,
          },
        });
      }
    }
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ready', service: 'mock-providers' };
  });

  // --- Admin Endpoints ---

  fastify.post('/__admin/script', async (request: FastifyRequest) => {
    const body = (request.body || {}) as { sttTexts?: string[]; llmReplies?: string[] };
    if (Array.isArray(body.sttTexts)) {
      mockState.enqueueSTT(body.sttTexts);
    }
    if (Array.isArray(body.llmReplies)) {
      mockState.enqueueLLM(body.llmReplies);
    }
    return { ok: true, message: 'Scripted entries enqueued' };
  });

  fastify.post('/__admin/fail', async (request: FastifyRequest) => {
    const body = (request.body || {}) as { endpoint?: string; status?: number; times?: number };
    const endpoint = body.endpoint || '/v1/';
    const status = body.status || 500;
    const times = body.times ?? 1;

    mockState.injectFailure(endpoint, status, times);
    return { ok: true, endpoint, status, times };
  });

  fastify.get('/__admin/requests', async (request: FastifyRequest) => {
    const query = (request.query || {}) as { endpoint?: string };
    const list: RecordedRequest[] = mockState.getRequests(query.endpoint);
    return list;
  });

  fastify.post('/__admin/reset', async () => {
    mockState.reset();
    return { ok: true, message: 'Mock state reset successfully' };
  });

  // --- OpenAI-Compatible Endpoints ---

  // STT / Whisper Transcription
  fastify.post('/v1/audio/transcriptions', async () => {
    const text = mockState.dequeueSTT();
    return { text };
  });

  // Models list
  fastify.get('/v1/models', async () => {
    return {
      object: 'list',
      data: [
        {
          id: 'meta/llama-3.1-8b-instruct',
          object: 'model',
          created: 1700000000,
          owned_by: 'mock-providers',
        },
        {
          id: 'whisper-large-v3-turbo',
          object: 'model',
          created: 1700000000,
          owned_by: 'mock-providers',
        },
        {
          id: 'nvidia/nv-embedqa-e5-v5',
          object: 'model',
          created: 1700000000,
          owned_by: 'mock-providers',
        },
      ],
    };
  });

  // Chat Completions
  fastify.post('/v1/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body || {}) as {
      model?: string;
      messages?: ChatMessage[];
      tools?: ToolDefinition[];
      stream?: boolean;
    };

    const model = body.model || 'meta/llama-3.1-8b-instruct';
    const messages = body.messages || [];
    const tools = body.tools;
    const stream = Boolean(body.stream);

    const scriptedReply = mockState.dequeueLLM();
    const result = evaluateChatRules(messages, tools, scriptedReply);
    const id = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    // Streaming SSE response
    if (stream) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      if (
        result.finish_reason === 'tool_calls' &&
        result.tool_calls &&
        result.tool_calls.length > 0
      ) {
        // Emit tool calls delta
        const toolCall = result.tool_calls[0];
        if (!toolCall) return;
        const chunk1 = {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id: toolCall.id,
                    type: 'function',
                    function: {
                      name: toolCall.function.name,
                      arguments: '',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
        reply.raw.write(`data: ${JSON.stringify(chunk1)}\n\n`);

        const chunk2 = {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: {
                      arguments: toolCall.function.arguments,
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
        reply.raw.write(`data: ${JSON.stringify(chunk2)}\n\n`);

        const chunk3 = {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'tool_calls',
            },
          ],
        };
        reply.raw.write(`data: ${JSON.stringify(chunk3)}\n\n`);
      } else {
        // Regular text response delta
        const text = result.content || '';
        const chunk1 = {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: { role: 'assistant', content: '' },
              finish_reason: null,
            },
          ],
        };
        reply.raw.write(`data: ${JSON.stringify(chunk1)}\n\n`);

        const chunk2 = {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: { content: text },
              finish_reason: null,
            },
          ],
        };
        reply.raw.write(`data: ${JSON.stringify(chunk2)}\n\n`);

        const chunk3 = {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
        };
        reply.raw.write(`data: ${JSON.stringify(chunk3)}\n\n`);
      }

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
      return;
    }

    // Non-streaming response
    return reply.status(200).send({
      id,
      object: 'chat.completion',
      created,
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content,
            tool_calls: result.tool_calls,
          },
          finish_reason: result.finish_reason,
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: result.content ? result.content.length : 10,
        total_tokens: 20,
      },
    });
  });

  // Embeddings
  fastify.post('/v1/embeddings', async (request: FastifyRequest) => {
    const body = (request.body || {}) as {
      input?: string | string[];
      model?: string;
      dimensions?: number;
    };

    const dim = body.dimensions || Number(process.env.EMBED_DIM) || 1024;
    const inputs: string[] = Array.isArray(body.input)
      ? body.input
      : typeof body.input === 'string'
        ? [body.input]
        : [''];

    const data = inputs.map((text, idx) => ({
      object: 'embedding' as const,
      index: idx,
      embedding: generateBagOfWordsEmbedding(text, dim),
    }));

    return {
      object: 'list',
      data,
      model: body.model || 'nvidia/nv-embedqa-e5-v5',
      usage: {
        prompt_tokens: 10,
        total_tokens: 10,
      },
    };
  });

  return fastify;
}
