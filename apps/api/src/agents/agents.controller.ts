import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResponse } from '@voice-ai/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AgentsService } from './agents.service';
import { AgentResponseDto } from './dto/agent-response.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@ApiTags('agents')
@ApiBearerAuth()
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new AI voice agent' })
  @ApiResponse({ status: 201, description: 'Agent successfully created', type: AgentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed or invalid voice/model' })
  @ApiResponse({ status: 409, description: 'Maximum agents limit per user reached' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAgentDto,
  ): Promise<AgentResponseDto> {
    return this.agentsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List current user agents (paginated, sorted by updatedAt desc)' })
  @ApiResponse({ status: 200, description: 'Paginated list of agents' })
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: ListAgentsQueryDto,
  ): Promise<PaginatedResponse<AgentResponseDto>> {
    return this.agentsService.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an agent by ID' })
  @ApiParam({ name: 'id', description: 'Agent UUID' })
  @ApiResponse({ status: 200, description: 'Agent found', type: AgentResponseDto })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AgentResponseDto> {
    return this.agentsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update an agent' })
  @ApiParam({ name: 'id', description: 'Agent UUID' })
  @ApiResponse({ status: 200, description: 'Agent updated successfully', type: AgentResponseDto })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<AgentResponseDto> {
    return this.agentsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete an agent' })
  @ApiParam({ name: 'id', description: 'Agent UUID' })
  @ApiResponse({ status: 204, description: 'Agent soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  remove(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.agentsService.remove(userId, id);
  }
}
