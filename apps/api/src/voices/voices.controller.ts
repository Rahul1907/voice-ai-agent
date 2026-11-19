import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VoiceDto } from '@voice-ai/shared';
import { Public } from '../common/decorators/public.decorator';
import { VoicesService } from './voices.service';

@ApiTags('voices')
@Controller('voices')
export class VoicesController {
  constructor(private readonly voicesService: VoicesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get available TTS voices' })
  @ApiResponse({ status: 200, description: 'List of available voices' })
  getVoices(): readonly VoiceDto[] {
    return this.voicesService.getVoices();
  }
}
