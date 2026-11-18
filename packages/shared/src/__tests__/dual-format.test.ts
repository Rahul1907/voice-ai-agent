import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '../..');
const repoRoot = resolve(packageRoot, '../..');

describe('SH-01: @voice-ai/shared dual ESM and CJS builds', () => {
  const esmBundlePath = resolve(packageRoot, 'dist/index.js');
  const cjsBundlePath = resolve(packageRoot, 'dist/index.cjs');

  it('produces both ESM (.js) and CJS (.cjs) build artifacts and type definitions', () => {
    expect(existsSync(esmBundlePath)).toBe(true);
    expect(existsSync(cjsBundlePath)).toBe(true);
    expect(existsSync(resolve(packageRoot, 'dist/index.d.ts'))).toBe(true);
    expect(existsSync(resolve(packageRoot, 'dist/index.d.cts'))).toBe(true);
  });

  it('imports identically via ESM (agent/web) and CommonJS require (NestJS API)', async () => {
    const require = createRequire(import.meta.url);
    const cjsExports = require(cjsBundlePath) as Record<string, unknown>;
    const esmExports = (await import(pathToFileURL(esmBundlePath).href)) as Record<string, unknown>;

    expect(cjsExports['DEFAULT_VOICE_ID']).toBe('af_heart');
    expect(esmExports['DEFAULT_VOICE_ID']).toBe('af_heart');

    expect(cjsExports['AGENT_LIMITS']).toEqual(esmExports['AGENT_LIMITS']);
    expect(cjsExports['CALL_LIMITS']).toEqual(esmExports['CALL_LIMITS']);
    expect(cjsExports['TTS_LIMITS']).toEqual(esmExports['TTS_LIMITS']);
    expect(cjsExports['CallStatus']).toEqual(esmExports['CallStatus']);
    expect(cjsExports['CallEndReason']).toEqual(esmExports['CallEndReason']);
    expect(cjsExports['DEFAULT_VOICES']).toEqual(esmExports['DEFAULT_VOICES']);
  });
});

describe('SEC-05: .env.example contains placeholders only', () => {
  it('has no real API keys in .env.example', () => {
    const envExamplePath = resolve(repoRoot, '.env.example');
    expect(existsSync(envExamplePath)).toBe(true);

    const content = readFileSync(envExamplePath, 'utf-8');
    expect(content).not.toMatch(/nvapi-[A-Za-z0-9_-]{10,}/);
    expect(content).not.toMatch(/gsk_[A-Za-z0-9_-]{10,}/);
    expect(content).toContain('GROQ_API_KEY=');
    expect(content).toContain('NVIDIA_API_KEY=');
  });
});
