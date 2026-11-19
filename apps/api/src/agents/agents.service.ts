import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentLanguage } from '@prisma/client';
import { AGENT_LIMITS, PaginatedResponse } from '@voice-ai/shared';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { VoicesService } from '../voices/voices.service';
import { AgentResponseDto } from './dto/agent-response.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly voicesService: VoicesService,
  ) {}

  async create(userId: string, dto: CreateAgentDto): Promise<AgentResponseDto> {
    const activeCount = await this.prisma.agent.count({
      where: { userId, deletedAt: null },
    });

    if (activeCount >= this.config.maxAgentsPerUser) {
      throw new ConflictException(
        `Maximum number of agents reached (${this.config.maxAgentsPerUser})`,
      );
    }

    const voice = dto.voice ?? AGENT_LIMITS.DEFAULT_VOICE;
    if (!this.voicesService.isValidVoice(voice)) {
      throw new BadRequestException('Unknown voice');
    }

    const llmModel = dto.llmModel ?? this.config.defaultLlmModel;
    if (!this.config.allowedLlmModels.includes(llmModel)) {
      throw new BadRequestException(
        `Invalid LLM model. Allowed models: ${this.config.allowedLlmModels.join(', ')}`,
      );
    }

    const agent = await this.prisma.agent.create({
      data: {
        userId,
        name: dto.name,
        systemPrompt: dto.systemPrompt,
        greeting: dto.greeting ?? AGENT_LIMITS.DEFAULT_GREETING,
        voice,
        language: dto.language ?? AgentLanguage.en,
        llmModel,
        temperature: dto.temperature ?? AGENT_LIMITS.DEFAULT_TEMPERATURE,
        maxCallDurationSec: dto.maxCallDurationSec ?? AGENT_LIMITS.DEFAULT_MAX_CALL_DURATION_SEC,
      },
    });

    return AgentResponseDto.fromEntity(agent);
  }

  async findAll(
    userId: string,
    query: ListAgentsQueryDto,
  ): Promise<PaginatedResponse<AgentResponseDto>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 50);
    const where = { userId, deletedAt: null };

    const [total, items] = await Promise.all([
      this.prisma.agent.count({ where }),
      this.prisma.agent.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map(AgentResponseDto.fromEntity),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async findOne(userId: string, id: string): Promise<AgentResponseDto> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return AgentResponseDto.fromEntity(agent);
  }

  async update(userId: string, id: string, dto: UpdateAgentDto): Promise<AgentResponseDto> {
    await this.findOne(userId, id);

    if (dto.voice !== undefined && !this.voicesService.isValidVoice(dto.voice)) {
      throw new BadRequestException('Unknown voice');
    }

    if (dto.llmModel !== undefined && !this.config.allowedLlmModels.includes(dto.llmModel)) {
      throw new BadRequestException(
        `Invalid LLM model. Allowed models: ${this.config.allowedLlmModels.join(', ')}`,
      );
    }

    const updated = await this.prisma.agent.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });

    return AgentResponseDto.fromEntity(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);

    await this.prisma.agent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
