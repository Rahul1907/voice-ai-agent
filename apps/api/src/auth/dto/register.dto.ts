import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { AUTH_LIMITS } from '@voice-ai/shared';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @Length(AUTH_LIMITS.MIN_PASSWORD_LENGTH, AUTH_LIMITS.MAX_PASSWORD_LENGTH, {
    message: `password must be between ${AUTH_LIMITS.MIN_PASSWORD_LENGTH} and ${AUTH_LIMITS.MAX_PASSWORD_LENGTH} characters`,
  })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;

  @ApiProperty({ example: 'John Doe' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100, { message: 'name must be between 1 and 100 characters' })
  name!: string;
}
