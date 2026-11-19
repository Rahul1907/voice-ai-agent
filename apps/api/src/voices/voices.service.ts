import { Injectable } from '@nestjs/common';
import { DEFAULT_VOICES, VoiceDto } from '@voice-ai/shared';

@Injectable()
export class VoicesService {
  getVoices(): readonly VoiceDto[] {
    return DEFAULT_VOICES;
  }

  isValidVoice(voiceId: string): boolean {
    return DEFAULT_VOICES.some((voice) => voice.id === voiceId);
  }
}
