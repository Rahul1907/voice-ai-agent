import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AgentLanguage } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { VoicesService } from '../voices/voices.service';
import { AgentsService } from './agents.service';

describe('AgentsService (Unit Tests)', () => {
  let service: AgentsService;
  let prisma: {
    agent: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let config: Partial<AppConfigService>;
  let voicesService: Partial<VoicesService>;

  const userId = '11111111-1111-1111-1111-111111111111';
  const mockAgent = {
    id: '22222222-2222-2222-2222-222222222222',
    userId,
    name: 'Support Agent',
    systemPrompt: 'You are a helpful customer support agent.',
    greeting: 'Hi! How can I help you today?',
    voice: 'af_heart',
    language: AgentLanguage.en,
    llmModel: 'meta/llama-3.1-8b-instruct',
    temperature: 0.6,
    maxCallDurationSec: 600,
    deletedAt: null,
    createdAt: new Date('2026-11-19T10:00:00Z'),
    updatedAt: new Date('2026-11-19T10:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      agent: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    config = {
      maxAgentsPerUser: 10,
      defaultLlmModel: 'meta/llama-3.1-8b-instruct',
      allowedLlmModels: ['meta/llama-3.1-8b-instruct', 'fallback-model'],
    };

    voicesService = {
      isValidVoice: jest.fn().mockImplementation((v) => v === 'af_heart'),
    };

    service = new AgentsService(
      prisma as unknown as PrismaService,
      config as unknown as AppConfigService,
      voicesService as unknown as VoicesService,
    );
  });

  describe('create', () => {
    it('creates an agent with applied defaults', async () => {
      prisma.agent.count.mockResolvedValue(2);
      prisma.agent.create.mockResolvedValue(mockAgent);

      const result = await service.create(userId, {
        name: 'Support Agent',
        systemPrompt: 'You are a helpful customer support agent.',
      });

      expect(prisma.agent.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: 'Support Agent',
          systemPrompt: 'You are a helpful customer support agent.',
          greeting: 'Hi! How can I help you today?',
          voice: 'af_heart',
          language: AgentLanguage.en,
          llmModel: 'meta/llama-3.1-8b-instruct',
          temperature: 0.6,
          maxCallDurationSec: 600,
        },
      });
      expect(result.id).toBe(mockAgent.id);
      expect(result.name).toBe('Support Agent');
    });

    it('throws ConflictException when maxAgentsPerUser is reached', async () => {
      prisma.agent.count.mockResolvedValue(10);

      await expect(
        service.create(userId, {
          name: '11th Agent',
          systemPrompt: 'Prompt instructions for agent.',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for unknown voice', async () => {
      prisma.agent.count.mockResolvedValue(1);

      await expect(
        service.create(userId, {
          name: 'Agent',
          systemPrompt: 'Prompt instructions for agent.',
          voice: 'unknown_voice',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for unapproved llmModel', async () => {
      prisma.agent.count.mockResolvedValue(1);

      await expect(
        service.create(userId, {
          name: 'Agent',
          systemPrompt: 'Prompt instructions for agent.',
          llmModel: 'gpt-fake-model',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('returns paginated items sorted and filtered by userId and non-deleted', async () => {
      prisma.agent.count.mockResolvedValue(1);
      prisma.agent.findMany.mockResolvedValue([mockAgent]);

      const result = await service.findAll(userId, { page: 1, pageSize: 20 });

      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns the agent when found', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);

      const result = await service.findOne(userId, mockAgent.id);
      expect(result.id).toBe(mockAgent.id);
    });

    it('throws NotFoundException when agent does not exist or belongs to another user', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates specified fields and updates updatedAt', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.agent.update.mockResolvedValue({
        ...mockAgent,
        name: 'Updated Name',
        updatedAt: new Date('2026-11-19T11:00:00Z'),
      });

      const result = await service.update(userId, mockAgent.id, {
        name: 'Updated Name',
      });

      expect(prisma.agent.update).toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
    });

    it('throws NotFoundException if updating non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(service.update(userId, 'non-existent-id', { name: 'New Name' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft deletes agent by setting deletedAt', async () => {
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.agent.update.mockResolvedValue({
        ...mockAgent,
        deletedAt: new Date(),
      });

      await service.remove(userId, mockAgent.id);

      expect(prisma.agent.update).toHaveBeenCalledWith({
        where: { id: mockAgent.id },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      });
    });

    it('throws NotFoundException if deleting non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, 'non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
