import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { CookieOptions } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { toUserResponseDto, UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigService,
  ) {}

  private parseDurationToMs(duration: string): number {
    const match = duration.match(/^(\d+)([dhms])?$/);
    if (!match || !match[1]) {
      return 24 * 60 * 60 * 1000; // default 1 day
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      case 's':
        return value * 1000;
      default:
        return value * 1000;
    }
  }

  getCookieOptions(): CookieOptions {
    const maxAge = this.parseDurationToMs(this.configService.jwtExpiresIn);
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.isProduction,
      maxAge,
      path: '/',
    };
  }

  getClearCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.isProduction,
      path: '/',
      maxAge: 0,
    };
  }

  async register(dto: RegisterDto): Promise<{ user: UserResponseDto; token: string }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    const userDto = toUserResponseDto(user);
    const token = this.jwtService.sign({ sub: userDto.id, email: userDto.email });
    return { user: userDto, token };
  }

  async login(dto: LoginDto): Promise<{ user: UserResponseDto; token: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const userDto = toUserResponseDto(user);
    const token = this.jwtService.sign({ sub: userDto.id, email: userDto.email });
    return { user: userDto, token };
  }
}
