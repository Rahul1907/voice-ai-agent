import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DEFAULT_VOICES, VoiceDto } from '@voice-ai/shared';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class VoicesService {
  private readonly logger = new Logger(VoicesService.name);
  private cachedVoices: readonly VoiceDto[] | null = null;
  private cachedVoicesExpiresAt = 0;
  private readonly previewCache = new Map<string, Buffer>();

  constructor(private readonly configService: AppConfigService) {}

  async getVoices(): Promise<readonly VoiceDto[]> {
    const now = Date.now();
    if (this.cachedVoices && now < this.cachedVoicesExpiresAt) {
      return this.cachedVoices;
    }

    try {
      const res = await fetch(`${this.configService.ttsServerUrl}/voices`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as VoiceDto[];
        if (Array.isArray(data) && data.length > 0) {
          this.cachedVoices = data;
          this.cachedVoicesExpiresAt = now + 10 * 60 * 1000; // 10 minutes cache
          return data;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to fetch voices from TTS server (${this.configService.ttsServerUrl}), falling back to DEFAULT_VOICES: ${(err as Error).message}`,
      );
    }

    return DEFAULT_VOICES;
  }

  isValidVoice(voiceId: string): boolean {
    const voices = this.cachedVoices || DEFAULT_VOICES;
    return voices.some((voice) => voice.id === voiceId);
  }

  async getVoicePreview(voiceId: string): Promise<Buffer> {
    if (!this.isValidVoice(voiceId)) {
      throw new NotFoundException(`Unknown voice ID: ${voiceId}`);
    }

    if (this.previewCache.has(voiceId)) {
      return this.previewCache.get(voiceId)!;
    }

    const voices = this.cachedVoices || DEFAULT_VOICES;
    const voice = voices.find((v) => v.id === voiceId);

    try {
      const res = await fetch(`${this.configService.ttsServerUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Hello! I am ${voice?.name || voiceId}, ready to assist you.`,
          voice: voiceId,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        throw new Error(`TTS server returned HTTP ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const rawPcm = Buffer.from(arrayBuffer);
      const wav = this.pcmToWav(rawPcm, 24000);
      this.previewCache.set(voiceId, wav);
      return wav;
    } catch (err) {
      this.logger.warn(
        `TTS synthesis failed for voice preview (${voiceId}): ${(err as Error).message}. Generating fallback preview audio.`,
      );
      const fallbackWav = this.generateFallbackWav();
      this.previewCache.set(voiceId, fallbackWav);
      return fallbackWav;
    }
  }

  private pcmToWav(
    pcmData: Buffer,
    sampleRate = 24000,
    numChannels = 1,
    bitsPerSample = 16,
  ): Buffer {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmData.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmData.length, 40);

    return Buffer.concat([header, pcmData]);
  }

  private generateFallbackWav(): Buffer {
    const sampleRate = 24000;
    const durationSec = 1.0;
    const numSamples = Math.floor(sampleRate * durationSec);
    const pcm = Buffer.alloc(numSamples * 2);
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
      const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
      pcm.writeInt16LE(intSample, i * 2);
    }
    return this.pcmToWav(pcm, sampleRate);
  }
}
