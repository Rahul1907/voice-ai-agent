import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';

export class IngestTurnMetricDto {
  @ApiProperty({ description: 'Turn index (0-based)', minimum: 0 })
  @Type(() => Number)
  @IsInt({ message: 'turnIndex must be an integer' })
  @Min(0, { message: 'turnIndex must be non-negative' })
  turnIndex!: number;

  @ApiPropertyOptional({ description: 'End-of-utterance delay in milliseconds', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'eouDelayMs must be a number' })
  @Min(0, { message: 'eouDelayMs must be non-negative' })
  eouDelayMs?: number;

  @ApiPropertyOptional({ description: 'STT duration in milliseconds', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'sttMs must be a number' })
  @Min(0, { message: 'sttMs must be non-negative' })
  sttMs?: number;

  @ApiPropertyOptional({ description: 'LLM time-to-first-token in milliseconds', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'llmTtftMs must be a number' })
  @Min(0, { message: 'llmTtftMs must be non-negative' })
  llmTtftMs?: number;

  @ApiPropertyOptional({ description: 'TTS time-to-first-byte in milliseconds', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'ttsTtfbMs must be a number' })
  @Min(0, { message: 'ttsTtfbMs must be non-negative' })
  ttsTtfbMs?: number;

  @ApiPropertyOptional({ description: 'Total turn latency in milliseconds', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'totalMs must be a number' })
  @Min(0, { message: 'totalMs must be non-negative' })
  totalMs?: number;
}

export class IngestMetricsDto {
  @ApiProperty({ type: [IngestTurnMetricDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestTurnMetricDto)
  metrics!: IngestTurnMetricDto[];
}
