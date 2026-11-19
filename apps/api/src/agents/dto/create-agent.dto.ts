import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentLanguage } from '@prisma/client';
import { AGENT_LIMITS } from '@voice-ai/shared';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAgentDto {
  @ApiProperty({ description: 'Agent display name', example: 'Sales Assistant', maxLength: 60 })
  @IsString()
  @MinLength(AGENT_LIMITS.NAME_MIN_LENGTH, { message: 'name must not be empty' })
  @MaxLength(AGENT_LIMITS.NAME_MAX_LENGTH, {
    message: 'name must be shorter than or equal to 60 characters',
  })
  name!: string;

  @ApiProperty({
    description: 'System prompt instructions for the agent LLM',
    minLength: 10,
    maxLength: 4000,
    example: 'You are a helpful customer service representative. Be concise and friendly.',
  })
  @IsString()
  @MinLength(AGENT_LIMITS.SYSTEM_PROMPT_MIN_LENGTH, {
    message: 'systemPrompt must be at least 10 characters',
  })
  @MaxLength(AGENT_LIMITS.SYSTEM_PROMPT_MAX_LENGTH, {
    message: 'systemPrompt must be shorter than or equal to 4000 characters',
  })
  systemPrompt!: string;

  @ApiPropertyOptional({
    description: 'Initial greeting spoken when call connects',
    maxLength: 300,
    default: AGENT_LIMITS.DEFAULT_GREETING,
  })
  @IsOptional()
  @IsString()
  @MaxLength(AGENT_LIMITS.GREETING_MAX_LENGTH, {
    message: 'greeting must be shorter than or equal to 300 characters',
  })
  greeting?: string;

  @ApiPropertyOptional({
    description: 'TTS voice ID from /api/voices',
    default: AGENT_LIMITS.DEFAULT_VOICE,
    example: 'af_heart',
  })
  @IsOptional()
  @IsString()
  voice?: string;

  @ApiPropertyOptional({
    description: 'Agent spoken language',
    enum: AgentLanguage,
    default: AgentLanguage.en,
  })
  @IsOptional()
  @IsEnum(AgentLanguage, { message: 'language must be a valid language code' })
  language?: AgentLanguage;

  @ApiPropertyOptional({
    description: 'LLM model ID from allowed models list',
    example: 'meta/llama-3.1-8b-instruct',
  })
  @IsOptional()
  @IsString()
  llmModel?: string;

  @ApiPropertyOptional({
    description: 'Sampling temperature between 0 and 1',
    minimum: 0,
    maximum: 1,
    default: AGENT_LIMITS.DEFAULT_TEMPERATURE,
  })
  @IsOptional()
  @IsNumber({}, { message: 'temperature must be a number' })
  @Min(AGENT_LIMITS.TEMPERATURE_MIN, { message: 'temperature must be between 0 and 1' })
  @Max(AGENT_LIMITS.TEMPERATURE_MAX, { message: 'temperature must be between 0 and 1' })
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Maximum call duration in seconds (60 to 900)',
    minimum: 60,
    maximum: 900,
    default: AGENT_LIMITS.DEFAULT_MAX_CALL_DURATION_SEC,
  })
  @IsOptional()
  @IsInt({ message: 'maxCallDurationSec must be an integer' })
  @Min(AGENT_LIMITS.MAX_CALL_DURATION_MIN_SEC, {
    message: 'maxCallDurationSec must be at least 60 seconds',
  })
  @Max(AGENT_LIMITS.MAX_CALL_DURATION_MAX_SEC, {
    message: 'maxCallDurationSec must be at most 900 seconds',
  })
  maxCallDurationSec?: number;
}
