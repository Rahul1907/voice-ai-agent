import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
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
  async getVoices(): Promise<readonly VoiceDto[]> {
    return this.voicesService.getVoices();
  }

  @Public()
  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview voice audio sample' })
  @ApiParam({ name: 'id', description: 'Voice ID to preview' })
  @ApiResponse({ status: 200, description: 'WAV audio sample' })
  @ApiResponse({ status: 404, description: 'Voice not found' })
  @Header('x-sample-rate', '24000')
  @Header('Cache-Control', 'public, max-age=86400')
  async previewVoice(@Param('id') id: string): Promise<StreamableFile> {
    const buffer = await this.voicesService.getVoicePreview(id);
    return new StreamableFile(buffer, {
      type: 'audio/wav',
      disposition: 'inline',
    });
  }
}
