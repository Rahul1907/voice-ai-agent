import { DEFAULT_VOICES } from '@voice-ai/shared';
import { VoicesService } from './voices.service';

describe('VoicesService', () => {
  let service: VoicesService;

  beforeEach(() => {
    service = new VoicesService();
  });

  it('returns default voices list', () => {
    const voices = service.getVoices();
    expect(voices).toEqual(DEFAULT_VOICES);
    expect(voices.length).toBeGreaterThan(0);
    expect(voices.some((v) => v.id === 'af_heart')).toBe(true);
  });

  it('validates voice existence correctly', () => {
    expect(service.isValidVoice('af_heart')).toBe(true);
    expect(service.isValidVoice('am_adam')).toBe(true);
    expect(service.isValidVoice('unknown_voice')).toBe(false);
  });
});
