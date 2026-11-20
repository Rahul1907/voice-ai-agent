import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallEndReason } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EndCallInternalDto {
  @ApiProperty({
    enum: ['USER_HANGUP', 'AGENT_ENDED', 'IDLE', 'TIMEOUT', 'DISCONNECTED', 'ERROR'],
    description: 'Reason why the call ended',
  })
  @IsNotEmpty({ message: 'reason is required' })
  @IsEnum(CallEndReason, { message: 'reason must be a valid CallEndReason' })
  reason!: CallEndReason;

  @ApiPropertyOptional({ description: 'Optional error message if reason is ERROR' })
  @IsOptional()
  @IsString()
  errorMessage?: string;
}
