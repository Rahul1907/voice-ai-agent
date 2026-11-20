import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { WebhookEvent } from 'livekit-server-sdk';
import { Public } from '../common/decorators/public.decorator';
import { LIVEKIT_GATEWAY, LiveKitGateway } from '../livekit/livekit.interface';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Public()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    @Inject(LIVEKIT_GATEWAY)
    private readonly livekitGateway: LiveKitGateway,
    private readonly webhooksService: WebhooksService,
  ) {}

  @Post('livekit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle LiveKit room and participant webhooks' })
  @ApiHeader({
    name: 'authorization',
    description: 'LiveKit webhook authorization token (HMAC/SHA256 signature)',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Webhook received and processed' })
  @ApiResponse({ status: 401, description: 'Invalid or missing webhook signature' })
  async handleLiveKitWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('authorization') authHeader?: string,
  ): Promise<{ status: string; handled: boolean }> {
    // Extract raw body for HMAC verification
    let rawBody: string | Buffer;
    if (req.rawBody) {
      rawBody = req.rawBody;
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (req.body && typeof req.body === 'object') {
      rawBody = JSON.stringify(req.body);
    } else {
      rawBody = '';
    }

    let event: WebhookEvent;
    try {
      event = await this.livekitGateway.verifyWebhook(rawBody, authHeader);
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return this.webhooksService.handleLiveKitEvent(event);
  }
}
