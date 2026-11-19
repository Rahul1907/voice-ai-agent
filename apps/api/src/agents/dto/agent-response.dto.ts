import { ApiProperty } from '@nestjs/swagger';
import { Agent as PrismaAgent, AgentLanguage } from '@prisma/client';
import { AgentDto } from '@voice-ai/shared';

export class AgentResponseDto implements AgentDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  userId!: string;

  @ApiProperty({ example: 'Customer Support' })
  name!: string;

  @ApiProperty({ example: 'You are a helpful assistant.' })
  systemPrompt!: string;

  @ApiProperty({ example: 'Hi! How can I help you today?' })
  greeting!: string;

  @ApiProperty({ example: 'af_heart' })
  voice!: string;

  @ApiProperty({ enum: AgentLanguage, example: AgentLanguage.en })
  language!: AgentLanguage;

  @ApiProperty({ example: 'meta/llama-3.1-8b-instruct' })
  llmModel!: string;

  @ApiProperty({ example: 0.6 })
  temperature!: number;

  @ApiProperty({ example: 600 })
  maxCallDurationSec!: number;

  @ApiProperty({ example: '2026-11-19T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-19T10:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: PrismaAgent): AgentResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      name: entity.name,
      systemPrompt: entity.systemPrompt,
      greeting: entity.greeting,
      voice: entity.voice,
      language: entity.language,
      llmModel: entity.llmModel,
      temperature: entity.temperature,
      maxCallDurationSec: entity.maxCallDurationSec,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
