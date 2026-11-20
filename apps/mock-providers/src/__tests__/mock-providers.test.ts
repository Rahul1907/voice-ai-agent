import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMockProvidersServer } from '../server.js';
import { cosineSimilarity } from '../utils/embeddings.js';

describe('Phase 8 Mock Providers Server (MOCK-01 to MOCK-05)', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createMockProvidersServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Reset mock state between tests
    await server.inject({
      method: 'POST',
      url: '/__admin/reset',
    });
  });

  describe('MOCK-01: Transcription with scripted queue', () => {
    it('returns queued texts in order, then defaults to "Hello, can you hear me?"', async () => {
      // Enqueue two scripted transcripts
      await server.inject({
        method: 'POST',
        url: '/__admin/script',
        payload: {
          sttTexts: ['I need help with my account.', 'What are your support hours?'],
        },
      });

      // 1st request
      const res1 = await server.inject({
        method: 'POST',
        url: '/v1/audio/transcriptions',
      });
      expect(res1.statusCode).toBe(200);
      expect(res1.json()).toEqual({ text: 'I need help with my account.' });

      // 2nd request
      const res2 = await server.inject({
        method: 'POST',
        url: '/v1/audio/transcriptions',
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json()).toEqual({ text: 'What are your support hours?' });

      // 3rd request (queue exhausted -> fallback default)
      const res3 = await server.inject({
        method: 'POST',
        url: '/v1/audio/transcriptions',
      });
      expect(res3.statusCode).toBe(200);
      expect(res3.json()).toEqual({ text: 'Hello, can you hear me?' });
    });
  });

  describe('MOCK-02: Chat rules (refund, goodbye, tool result, default, streaming SSE)', () => {
    const tools = [
      {
        type: 'function' as const,
        function: {
          name: 'searchKnowledgeBase',
          description: 'Search knowledge base',
          parameters: { type: 'object', properties: { query: { type: 'string' } } },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'endCall',
          description: 'End the phone call',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];

    it('returns searchKnowledgeBase tool call when user message mentions refund', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          messages: [{ role: 'user', content: 'Can I get a refund for my recent transaction?' }],
          tools,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.choices[0].finish_reason).toBe('tool_calls');
      expect(body.choices[0].message.tool_calls[0].function.name).toBe('searchKnowledgeBase');
      const args = JSON.parse(body.choices[0].message.tool_calls[0].function.arguments);
      expect(args.query).toBe('refund');
    });

    it('returns endCall tool call when user message mentions goodbye', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          messages: [{ role: 'user', content: 'That is all, goodbye!' }],
          tools,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.choices[0].finish_reason).toBe('tool_calls');
      expect(body.choices[0].message.tool_calls[0].function.name).toBe('endCall');
    });

    it('replies with truncated tool result when the last message is a tool output', async () => {
      const toolOutput =
        'Your refund for order #9876 was approved and will appear in 3-5 business days on your bank statement.';
      const res = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          messages: [
            { role: 'user', content: 'Where is my refund?' },
            {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'searchKnowledgeBase', arguments: '{"query":"refund"}' },
                },
              ],
            },
            {
              role: 'tool',
              tool_call_id: 'call_1',
              content: toolOutput,
            },
          ],
          tools,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.choices[0].finish_reason).toBe('stop');
      expect(body.choices[0].message.content).toBe(
        `Based on our records: ${toolOutput.slice(0, 100)}`,
      );
    });

    it('returns default mock reply when no specific rules trigger', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          messages: [{ role: 'user', content: 'What is the weather today?' }],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.choices[0].finish_reason).toBe('stop');
      expect(body.choices[0].message.content).toBe('This is a mock reply.');
    });

    it('streams response in valid OpenAI SSE format when stream: true', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          messages: [{ role: 'user', content: 'Tell me something.' }],
          stream: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      const text = res.payload;
      expect(text).toContain('data: {');
      expect(text).toContain('"chat.completion.chunk"');
      expect(text).toContain('data: [DONE]');
    });

    it('streams tool call chunks in valid SSE format when stream: true', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          messages: [{ role: 'user', content: 'goodbye now' }],
          tools,
          stream: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      const text = res.payload;
      expect(text).toContain('endCall');
      expect(text).toContain('data: [DONE]');
    });
  });

  describe('MOCK-03: Embeddings', () => {
    it('returns deterministic, normalized embeddings where keyword overlap yields higher cosine similarity', async () => {
      const textA = 'refund policy for return goods and customer requests';
      const textB = 'refund policy guidelines and customer return policy';
      const textC = 'planetary orbits quantum physics astrophysics galaxy stars';

      const res = await server.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: {
          input: [textA, textB, textC],
          dimensions: 1024,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.object).toBe('list');
      expect(body.data.length).toBe(3);

      const embA: number[] = body.data[0].embedding;
      const embB: number[] = body.data[1].embedding;
      const embC: number[] = body.data[2].embedding;

      // 1. Vector length matches requested EMBED_DIM
      expect(embA.length).toBe(1024);
      expect(embB.length).toBe(1024);
      expect(embC.length).toBe(1024);

      // 2. Vectors are normalized (L2 norm ≈ 1.0)
      const normA = Math.sqrt(embA.reduce((sum, v) => sum + v * v, 0));
      expect(normA).toBeCloseTo(1.0, 4);

      // 3. Determinism
      const resA2 = await server.inject({
        method: 'POST',
        url: '/v1/embeddings',
        payload: { input: textA, dimensions: 1024 },
      });
      expect(resA2.json().data[0].embedding).toEqual(embA);

      // 4. Keyword overlap property (A and B share 'refund', 'policy', 'customer', 'return')
      const simAB = cosineSimilarity(embA, embB);
      const simAC = cosineSimilarity(embA, embC);

      expect(simAB).toBeGreaterThan(0.5);
      expect(simAC).toBeLessThan(0.1);
      expect(simAB).toBeGreaterThan(simAC);
    });
  });

  describe('MOCK-04: Failure injection', () => {
    it('injects status 429 twice then succeeds on third attempt', async () => {
      // Inject 429 for /v1/chat/completions twice
      await server.inject({
        method: 'POST',
        url: '/__admin/fail',
        payload: {
          endpoint: '/v1/chat/completions',
          status: 429,
          times: 2,
        },
      });

      // 1st call -> 429
      const res1 = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: { messages: [{ role: 'user', content: 'test' }] },
      });
      expect(res1.statusCode).toBe(429);
      expect(res1.json().error.code).toBe(429);

      // 2nd call -> 429
      const res2 = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: { messages: [{ role: 'user', content: 'test' }] },
      });
      expect(res2.statusCode).toBe(429);

      // 3rd call -> 200 OK
      const res3 = await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: { messages: [{ role: 'user', content: 'test' }] },
      });
      expect(res3.statusCode).toBe(200);
      expect(res3.json().choices[0].message.content).toBe('This is a mock reply.');
    });
  });

  describe('MOCK-05: /__admin/requests and reset', () => {
    it('records incoming requests with full details and clears them on reset', async () => {
      // Send a few requests
      await server.inject({
        method: 'POST',
        url: '/v1/audio/transcriptions',
        payload: { sample: 'audio' },
      });

      await server.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: { messages: [{ role: 'user', content: 'ping' }] },
      });

      // Inspect recorded requests
      const resRequests = await server.inject({
        method: 'GET',
        url: '/__admin/requests',
      });
      expect(resRequests.statusCode).toBe(200);
      const requests = resRequests.json() as Array<{ url: string }>;
      expect(requests.length).toBeGreaterThanOrEqual(2);
      expect(requests.some((r) => r.url === '/v1/audio/transcriptions')).toBe(true);
      expect(requests.some((r) => r.url === '/v1/chat/completions')).toBe(true);

      // Reset
      const resReset = await server.inject({
        method: 'POST',
        url: '/__admin/reset',
      });
      expect(resReset.statusCode).toBe(200);

      // Inspect again -> should be empty
      const resAfterReset = await server.inject({
        method: 'GET',
        url: '/__admin/requests',
      });
      expect(resAfterReset.json()).toEqual([]);
    });
  });
});
