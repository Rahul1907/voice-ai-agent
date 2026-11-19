import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail (AUTH-05)', () => {
    it('normalizes email (trims and converts to lowercase) before querying', async () => {
      const mockUser = {
        id: 'u1',
        email: 'test@domain.com',
        name: 'Test',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('  Test@Domain.COM  ');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@domain.com' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('queries user by id', async () => {
      const mockUser = {
        id: 'u123',
        email: 'user@example.com',
        name: 'User',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('u123');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u123' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('create (AUTH-05)', () => {
    it('normalizes email and trims name when creating user', async () => {
      const mockCreated = {
        id: 'u2',
        email: 'newuser@domain.com',
        name: 'New User',
        passwordHash: '$argon2id$...',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.create.mockResolvedValue(mockCreated);

      const result = await service.create({
        email: '  NewUser@Domain.COM  ',
        name: '  New User  ',
        passwordHash: '$argon2id$...',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@domain.com',
          name: 'New User',
          passwordHash: '$argon2id$...',
        },
      });
      expect(result).toEqual(mockCreated);
    });
  });
});
