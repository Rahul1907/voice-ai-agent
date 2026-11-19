import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: { email: string; name: string; passwordHash: string }): Promise<User> {
    const normalizedEmail = data.email.trim().toLowerCase();
    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: data.name.trim(),
        passwordHash: data.passwordHash,
      },
    });
  }
}
