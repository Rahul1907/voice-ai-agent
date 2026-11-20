import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaginatedResponse } from '@voice-ai/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CallsService } from './calls.service';
import {
  CallDetailResponseDto,
  CallResponseDto,
  StartCallResponseDto,
} from './dto/call-response.dto';
import { CreateCallDto } from './dto/create-call.dto';
import { ListCallsQueryDto } from './dto/list-calls-query.dto';

@ApiTags('Calls')
@ApiCookieAuth('access_token')
@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a voice call with an agent' })
  @ApiResponse({
    status: 201,
    description: 'Call created and LiveKit session initialized',
    type: StartCallResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Agent not found or soft-deleted' })
  @ApiConflictResponse({ description: 'User already has an active call in progress' })
  @ApiServiceUnavailableResponse({ description: 'Global concurrency limit reached' })
  async startCall(
    @CurrentUser() user: { id: string; name: string },
    @Body() dto: CreateCallDto,
  ): Promise<StartCallResponseDto> {
    return this.callsService.startCall(user, dto);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End an ongoing call (idempotent)' })
  @ApiResponse({
    status: 200,
    description: 'Call successfully ended',
    type: CallResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Call not found' })
  async endCall(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CallResponseDto> {
    return this.callsService.endCall(id, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List calls for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of calls',
  })
  async listCalls(
    @CurrentUser('id') userId: string,
    @Query() query: ListCallsQueryDto,
  ): Promise<PaginatedResponse<CallResponseDto>> {
    return this.callsService.listCalls(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get call details with transcripts and latency metrics' })
  @ApiResponse({
    status: 200,
    description: 'Call detail with transcripts and metrics',
    type: CallDetailResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Call not found' })
  async getCall(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CallDetailResponseDto> {
    return this.callsService.getCall(id, userId);
  }
}
