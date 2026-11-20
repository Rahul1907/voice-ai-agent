import { DEFAULT_VOICES } from '@voice-ai/shared';
import { float32ToInt16, generateMockSineWave, int16ToBuffer } from './utils/audio-converter.js';
import { normalizeText } from './utils/text-normalizer.js';

class TaskQueue {
  private running = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly concurrency: number = 2) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
}

export type KokoroDtype = 'q8' | 'fp32' | 'fp16' | 'q4' | 'q4f16';

export interface TTSEngineOptions {
  mode?: 'kokoro' | 'mock';
  dtype?: KokoroDtype;
  concurrency?: number;
}

export interface KokoroModelInstance {
  generate(
    text: string,
    options?: { voice?: string; speed?: number },
  ): Promise<{ audio: Float32Array }>;
}

export class TTSEngine {
  private mode: 'kokoro' | 'mock';
  private dtype: KokoroDtype;
  private queue: TaskQueue;
  private ready: boolean = false;
  private loading: boolean = false;
  private kokoroModel: KokoroModelInstance | null = null;

  constructor(options: TTSEngineOptions = {}) {
    this.mode = options.mode || (process.env.TTS_MODE === 'kokoro' ? 'kokoro' : 'mock');
    this.dtype = options.dtype || (process.env.KOKORO_DTYPE as KokoroDtype) || 'q8';
    this.queue = new TaskQueue(options.concurrency || 2);
  }

  get isReady(): boolean {
    return this.ready;
  }

  get isLoading(): boolean {
    return this.loading;
  }

  get currentMode(): 'kokoro' | 'mock' {
    return this.mode;
  }

  async init(): Promise<void> {
    if (this.ready) return;

    if (this.mode === 'mock') {
      this.ready = true;
      return;
    }

    this.loading = true;
    try {
      // Dynamic import to allow running in mock mode without ONNX binary initialized
      const { KokoroTTS } = await import('kokoro-js');
      const modelId = 'onnx-community/Kokoro-82M-v1.0-ONNX';
      this.kokoroModel = await KokoroTTS.from_pretrained(modelId, {
        dtype: this.dtype,
        device: 'cpu',
      });
      this.ready = true;
    } catch (err) {
      this.ready = false;
      throw err;
    } finally {
      this.loading = false;
    }
  }

  isValidVoice(voiceId: string): boolean {
    return DEFAULT_VOICES.some((v) => v.id === voiceId);
  }

  async synthesize(text: string, voice: string, speed: number = 1.0): Promise<Buffer> {
    if (!this.isValidVoice(voice)) {
      throw new Error(`Unknown voice: ${voice}`);
    }

    const normalized = normalizeText(text);
    if (!normalized || normalized.length === 0) {
      throw new Error('Text must not be empty');
    }
    if (normalized.length > 1000) {
      throw new Error('Text must be 1000 characters or less');
    }

    return this.queue.run(async () => {
      if (this.mode === 'mock' || !this.kokoroModel) {
        const samples = generateMockSineWave(normalized.length);
        return int16ToBuffer(samples);
      }

      // Real Kokoro ONNX model synthesis
      const result = await this.kokoroModel.generate(normalized, {
        voice,
        speed,
      });

      // result.audio is Float32Array at 24000 Hz
      const float32Data: Float32Array = result.audio;
      const int16Data = float32ToInt16(float32Data);
      return int16ToBuffer(int16Data);
    });
  }
}
