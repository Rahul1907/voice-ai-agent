import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateCallDto {
  @ApiProperty({
    description: 'UUID of the agent to start a call with',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'agentId is required' })
  @IsUUID('4', { message: 'agentId must be a valid UUID' })
  agentId!: string;
}
