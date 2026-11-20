import { DEFAULT_VOICES } from '@voice-ai/shared';
import { NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { VoicesService } from './voices.service';

describe('VoicesService', () => {
  let service: VoicesService;
  let mockConfig: AppConfigService;

  beforeEach(() => {
    mockConfig = {
      ttsServerUrl: 'http://localhost:5100',
    } as unknown as AppConfigService;
    service = new VoicesService(mockConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns default voices list when TTS server is unreachable', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

    const voices = await service.getVoices();
    expect(voices).toEqual(DEFAULT_VOICES);
    expect(voices.length).toBeGreaterThan(0);
    expect(voices.some((v) => v.id === 'af_heart')).toBe(true);
  });

  it('caches voices for 10 minutes when TTS server responds', async () => {
    const mockServerVoices = [
      { id: 'af_heart', name: 'Heart', gender: 'female', accent: 'American' as const },
    ];
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockServerVoices,
    } as Response);

    const first = await service.getVoices();
    expect(first).toEqual(mockServerVoices);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call should hit in-memory cache without calling fetch
    const second = await service.getVoices();
    expect(second).toEqual(mockServerVoices);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('validates voice existence correctly', () => {
    expect(service.isValidVoice('af_heart')).toBe(true);
    expect(service.isValidVoice('am_adam')).toBe(true);
    expect(service.isValidVoice('unknown_voice')).toBe(false);
  });

  it('preview voice returns WAV audio buffer and caches it', async () => {
    // Fake 200 bytes of raw PCM
    const mockPcm = Buffer.alloc(200, 1);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => mockPcm.buffer,
    } as Response);

    const wavBuffer = await service.getVoicePreview('af_heart');
    expect(wavBuffer).toBeInstanceOf(Buffer);
    expect(wavBuffer.length).toBe(44 + 200);
    // RIFF header
    expect(wavBuffer.subarray(0, 4).toString()).toBe('RIFF');
    expect(wavBuffer.subarray(8, 12).toString()).toBe('WAVE');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call should hit previewCache
    const cachedWav = await service.getVoicePreview('af_heart');
    expect(cachedWav).toEqual(wavBuffer);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('preview voice returns fallback WAV when TTS server is offline', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection error'));

    const wavBuffer = await service.getVoicePreview('af_heart');
    expect(wavBuffer).toBeInstanceOf(Buffer);
    expect(wavBuffer.subarray(0, 4).toString()).toBe('RIFF');
    expect(wavBuffer.subarray(8, 12).toString()).toBe('WAVE');
  });

  it('preview voice throws NotFoundException for unknown voice', async () => {
    await expect(service.getVoicePreview('non_existent_voice')).rejects.toThrow(NotFoundException);
  });
});
