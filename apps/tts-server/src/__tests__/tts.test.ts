import { DEFAULT_VOICES } from '@voice-ai/shared';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';
import { TTSEngine } from '../tts-engine.js';
import { float32ToInt16, generateMockSineWave } from '../utils/audio-converter.js';
import { normalizeText } from '../utils/text-normalizer.js';

describe('Phase 7 TTS Server (TTS-01 to TTS-10)', () => {
  let server: FastifyInstance;
  let ttsEngine: TTSEngine;

  beforeAll(async () => {
    ttsEngine = new TTSEngine({ mode: 'mock' });
    server = buildServer({ ttsEngine, logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('TTS-01: /health during load and after ready', () => {
    it('returns 503 loading when engine is not ready, then 200 ready once initialized', async () => {
      const freshEngine = new TTSEngine({ mode: 'mock' });
      const testServer = buildServer({ ttsEngine: freshEngine });

      // Before init
      const resLoading = await testServer.inject({
        method: 'GET',
        url: '/health',
      });
      expect(resLoading.statusCode).toBe(503);
      expect(JSON.parse(resLoading.payload)).toEqual({ status: 'loading' });

      // After init
      await freshEngine.init();
      const resReady = await testServer.inject({
        method: 'GET',
        url: '/health',
      });
      expect(resReady.statusCode).toBe(200);
      expect(JSON.parse(resReady.payload)).toEqual({ status: 'ready' });

      await testServer.close();
    });
  });

  describe('TTS-02: /voices endpoint', () => {
    it('returns non-empty voice list with valid voice ids', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/voices',
      });

      expect(res.statusCode).toBe(200);
      const voices = JSON.parse(res.payload);
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBe(DEFAULT_VOICES.length);
      expect(voices.some((v: { id: string }) => v.id === 'af_heart')).toBe(true);
    });
  });

  describe('TTS-03: Synthesize valid text', () => {
    it('returns 200, PCM audio bytes with even length, and x-sample-rate: 24000', async () => {
      await ttsEngine.init();

      const res = await server.inject({
        method: 'POST',
        url: '/synthesize',
        payload: {
          text: 'Hello, welcome to Voice AI Platform.',
          voice: 'af_heart',
          speed: 1.0,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/octet-stream');
      expect(res.headers['x-sample-rate']).toBe('24000');

      const rawBuffer = res.rawPayload;
      expect(rawBuffer.length).toBeGreaterThan(0);
      // 16-bit PCM has 2 bytes per sample, so length must be an even integer
      expect(rawBuffer.length % 2).toBe(0);
    });
  });

  describe('TTS-04: Empty text validation', () => {
    it('returns 400 Bad Request when text is empty', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/synthesize',
        payload: {
          text: '',
          voice: 'af_heart',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('TTS-05: Text exceeding 1000 characters', () => {
    it('returns 400 Bad Request when text exceeds 1000 characters', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/synthesize',
        payload: {
          text: 'a'.repeat(1001),
          voice: 'af_heart',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('TTS-06: Unknown voice validation', () => {
    it('returns 400 Bad Request when voice does not exist', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/synthesize',
        payload: {
          text: 'Valid text.',
          voice: 'completely_unknown_voice_id',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.payload).toContain('Unknown voice');
    });
  });

  describe('TTS-07: Text normalization', () => {
    it('strips markdown, URLs, and emojis, expands currency & symbols, and preserves numbers & Hindi words', () => {
      const raw = `
        # Heading 1
        Hello **world**! Check out [our docs](https://example.com/docs).
        Price is ₹500 or $50 with a 10% discount & bonus! 🎉🚀
        *Aapka* swagat hai dosto.
      `;

      const normalized = normalizeText(raw);

      // Markdown stripped
      expect(normalized).not.toContain('#');
      expect(normalized).not.toContain('**');
      expect(normalized).not.toContain('https://');
      // Emojis stripped
      expect(normalized).not.toContain('🎉');
      expect(normalized).not.toContain('🚀');
      // Symbols expanded
      expect(normalized).toContain('500 rupees');
      expect(normalized).toContain('50 dollars');
      expect(normalized).toContain('10 percent');
      expect(normalized).toContain('and');
      // Hindi words preserved
      expect(normalized).toContain('Aapka swagat hai dosto');
      // Valid words remain
      expect(normalized).toContain('Hello world! Check out our docs');
    });
  });

  describe('TTS-08: Concurrent synthesize requests', () => {
    it('processes 5 concurrent requests cleanly without crashing', async () => {
      await ttsEngine.init();

      const requests = Array.from({ length: 5 }, (_, i) =>
        server.inject({
          method: 'POST',
          url: '/synthesize',
          payload: {
            text: `Concurrent test message number ${i + 1}`,
            voice: 'af_heart',
          },
        }),
      );

      const results = await Promise.all(requests);

      for (const res of results) {
        expect(res.statusCode).toBe(200);
        expect(res.rawPayload.length).toBeGreaterThan(0);
        expect(res.rawPayload.length % 2).toBe(0);
      }
    });
  });

  describe('TTS-09: Mock mode deterministic duration', () => {
    it('returns deterministic tone whose duration and byte length grow with text length', () => {
      const shortSamples = generateMockSineWave('Short'.length);
      const longText =
        'This is a substantially longer sentence designed to verify that generated PCM audio duration scales proportionally with input length.';
      const longSamples = generateMockSineWave(longText.length);

      expect(longSamples.length).toBeGreaterThan(shortSamples.length);
      // Sample count at 24kHz matches duration
      expect(shortSamples.length).toBeGreaterThanOrEqual(24000 * 0.2);
    });
  });

  describe('TTS-10: Float32 to Int16 conversion with clamping', () => {
    it('strictly clamps values beyond -1.0 and 1.0 to -32768 and 32767', () => {
      const input = new Float32Array([-3.0, -1.5, -1.0, 0.0, 0.5, 1.0, 2.0, 5.0]);
      const converted = float32ToInt16(input);

      // -3.0 clamped to -1.0 -> -32768
      expect(converted[0]).toBe(-32768);
      // -1.5 clamped to -1.0 -> -32768
      expect(converted[1]).toBe(-32768);
      // -1.0 -> -32768
      expect(converted[2]).toBe(-32768);
      // 0.0 -> 0
      expect(converted[3]).toBe(0);
      // 0.5 -> 16384 (approx)
      expect(converted[4]).toBe(16384);
      // 1.0 -> 32767
      expect(converted[5]).toBe(32767);
      // 2.0 clamped to 1.0 -> 32767
      expect(converted[6]).toBe(32767);
      // 5.0 clamped to 1.0 -> 32767
      expect(converted[7]).toBe(32767);
    });
  });
});
