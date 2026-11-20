import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CallDto,
  CallEndReason,
  CallStatus,
  SummaryStatus,
  TranscriptRole,
  TranscriptSegmentDto,
  TurnMetricDto,
} from '@voice-ai/shared';

export class StartCallResponseDto {
  @ApiProperty({ description: 'Unique call UUID' })
  callId!: string;

  @ApiProperty({ description: 'Unique LiveKit room name' })
  roomName!: string;

  @ApiProperty({ description: 'Room-specific participant JWT token' })
  token!: string;

  @ApiProperty({ description: 'LiveKit server URL to connect' })
  livekitUrl!: string;
}

export class TranscriptSegmentResponseDto implements TranscriptSegmentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  callId!: string;

  @ApiProperty()
  segmentId!: string;

  @ApiProperty({ enum: ['USER', 'AGENT'] })
  role!: TranscriptRole;

  @ApiProperty()
  text!: string;

  @ApiProperty()
  sequence!: number;

  @ApiProperty()
  spokenAt!: string;
}

export class TurnMetricResponseDto implements TurnMetricDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  callId!: string;

  @ApiProperty()
  turnIndex!: number;

  @ApiPropertyOptional({ nullable: true })
  eouDelayMs!: number | null;

  @ApiPropertyOptional({ nullable: true })
  sttMs!: number | null;

  @ApiPropertyOptional({ nullable: true })
  llmTtftMs!: number | null;

  @ApiPropertyOptional({ nullable: true })
  ttsTtfbMs!: number | null;

  @ApiPropertyOptional({ nullable: true })
  totalMs!: number | null;

  @ApiProperty()
  createdAt!: string;
}

export class CallAgentSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  voice!: string;
}

export class CallResponseDto implements CallDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  agentId!: string;

  @ApiPropertyOptional()
  agentName?: string;

  @ApiPropertyOptional({ type: () => CallAgentSummaryDto })
  agent?: CallAgentSummaryDto;

  @ApiProperty()
  roomName!: string;

  @ApiProperty({ enum: ['CREATED', 'ACTIVE', 'ENDED', 'FAILED'] })
  status!: CallStatus;

  @ApiPropertyOptional({
    enum: ['USER_HANGUP', 'AGENT_ENDED', 'IDLE', 'TIMEOUT', 'DISCONNECTED', 'ERROR'],
    nullable: true,
  })
  endReason!: CallEndReason | null;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({ nullable: true })
  startedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  endedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  durationSec!: number | null;

  @ApiPropertyOptional({ nullable: true })
  summary!: string | null;

  @ApiProperty({ enum: ['PENDING', 'DONE', 'FAILED', 'SKIPPED'] })
  summaryStatus!: SummaryStatus;

  @ApiPropertyOptional({ nullable: true })
  avgLatencyMs!: number | null;

  @ApiPropertyOptional({ nullable: true })
  p50LatencyMs!: number | null;

  @ApiPropertyOptional({ nullable: true })
  p95LatencyMs!: number | null;
}

export class CallDetailResponseDto extends CallResponseDto {
  @ApiProperty({ type: [TranscriptSegmentResponseDto] })
  transcripts!: TranscriptSegmentResponseDto[];

  @ApiProperty({ type: [TurnMetricResponseDto] })
  metrics!: TurnMetricResponseDto[];
}
