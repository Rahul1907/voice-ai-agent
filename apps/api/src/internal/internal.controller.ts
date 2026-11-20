import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WorkerCallConfigDto } from '@voice-ai/shared';
import { Public } from '../common/decorators/public.decorator';
import { EndCallInternalDto } from './dto/end-call-internal.dto';
import { IngestMetricsDto, IngestTurnMetricDto } from './dto/ingest-metrics.dto';
import { IngestTranscriptSegmentDto, IngestTranscriptsDto } from './dto/ingest-transcripts.dto';
import { InternalKeyGuard } from './guards/internal-key.guard';
import { InternalService } from './internal.service';

@ApiTags('Internal (Worker Only)')
@ApiSecurity('internal-key')
@ApiHeader({
  name: 'x-internal-key',
  description: 'Internal shared secret key for background voice workers',
  required: true,
})
@Public()
@UseGuards(InternalKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Get('calls/:id/config')
  @ApiOperation({ summary: 'Fetch sanitized agent configuration for worker call session' })
  @ApiResponse({
    status: 200,
    description: 'Sanitized call configuration with no secrets or sensitive data',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid internal API key' })
  @ApiNotFoundResponse({ description: 'Call not found' })
  async getCallConfig(@Param('id', ParseUUIDPipe) id: string): Promise<WorkerCallConfigDto> {
    return this.internalService.getCallConfig(id);
  }

  @Post('calls/:id/started')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark call session as ACTIVE once worker joins' })
  @ApiResponse({ status: 200, description: 'Call marked as ACTIVE' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid internal API key' })
  @ApiNotFoundResponse({ description: 'Call not found' })
  async markCallStarted(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ status: string; startedAt: Date }> {
    return this.internalService.markCallStarted(id);
  }

  @Post('calls/:id/ended')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report call end from worker' })
  @ApiResponse({ status: 200, description: 'Call marked as ENDED or FAILED' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid internal API key' })
  @ApiNotFoundResponse({ description: 'Call not found' })
  async markCallEnded(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndCallInternalDto,
  ): Promise<void> {
    return this.internalService.markCallEnded(id, dto);
  }

  @Post('calls/:id/transcripts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest batch of final transcript segments' })
  @ApiResponse({ status: 200, description: 'Transcript segments stored' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid internal API key' })
  @ApiNotFoundResponse({ description: 'Call not found' })
  async ingestTranscripts(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: IngestTranscriptsDto | IngestTranscriptSegmentDto[],
  ): Promise<{ inserted: number }> {
    const segments = Array.isArray(payload) ? payload : payload?.segments;
    if (!segments || !Array.isArray(segments)) {
      throw new BadRequestException('Payload must be an array or contain a segments array');
    }
    return this.internalService.ingestTranscripts(id, segments);
  }

  @Post('calls/:id/metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest batch of turn latency metrics' })
  @ApiResponse({ status: 200, description: 'Turn metrics stored' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid internal API key' })
  @ApiNotFoundResponse({ description: 'Call not found' })
  async ingestMetrics(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: IngestMetricsDto | IngestTurnMetricDto[],
  ): Promise<{ inserted: number }> {
    const metrics = Array.isArray(payload) ? payload : payload?.metrics;
    if (!metrics || !Array.isArray(metrics)) {
      throw new BadRequestException('Payload must be an array or contain a metrics array');
    }

    // Validate metrics: non-negative and numbers (INT-06)
    for (const m of metrics) {
      if (typeof m.turnIndex !== 'number' || isNaN(m.turnIndex) || m.turnIndex < 0) {
        throw new BadRequestException('turnIndex must be a non-negative number');
      }
      for (const field of ['eouDelayMs', 'sttMs', 'llmTtftMs', 'ttsTtfbMs', 'totalMs'] as const) {
        const val = m[field];
        if (val !== undefined && val !== null) {
          if (typeof val !== 'number' || isNaN(val) || val < 0) {
            throw new BadRequestException(`${field} must be a non-negative number`);
          }
        }
      }
    }

    return this.internalService.ingestMetrics(id, metrics);
  }
}
