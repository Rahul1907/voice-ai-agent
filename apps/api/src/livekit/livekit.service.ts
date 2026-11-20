import { Injectable, Logger } from '@nestjs/common';
import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
  WebhookEvent,
  WebhookReceiver,
} from 'livekit-server-sdk';
import { AppConfigService } from '../config/app-config.service';
import {
  CreateRoomOptions,
  CreateTokenOptions,
  DispatchAgentOptions,
  LiveKitGateway,
} from './livekit.interface';

@Injectable()
export class LiveKitService implements LiveKitGateway {
  private readonly logger = new Logger(LiveKitService.name);

  constructor(private readonly config: AppConfigService) {}

  private getRoomClient(): RoomServiceClient {
    return new RoomServiceClient(
      this.config.livekitUrl,
      this.config.livekitApiKey,
      this.config.livekitApiSecret,
    );
  }

  private getDispatchClient(): AgentDispatchClient {
    return new AgentDispatchClient(
      this.config.livekitUrl,
      this.config.livekitApiKey,
      this.config.livekitApiSecret,
    );
  }

  private getWebhookReceiver(): WebhookReceiver {
    return new WebhookReceiver(this.config.livekitApiKey, this.config.livekitApiSecret);
  }

  async createRoom(options: CreateRoomOptions): Promise<void> {
    const roomClient = this.getRoomClient();
    await roomClient.createRoom({
      name: options.name,
      emptyTimeout: options.emptyTimeout ?? 300,
    });
  }

  async dispatchAgent(options: DispatchAgentOptions): Promise<void> {
    const dispatchClient = this.getDispatchClient();
    await dispatchClient.createDispatch(options.room, options.agentName, {
      metadata: options.metadata,
    });
  }

  async deleteRoom(roomName: string): Promise<void> {
    const roomClient = this.getRoomClient();
    await roomClient.deleteRoom(roomName);
  }

  async createToken(options: CreateTokenOptions): Promise<string> {
    const at = new AccessToken(this.config.livekitApiKey, this.config.livekitApiSecret, {
      identity: options.identity,
      name: options.name,
      ttl: options.ttl ?? '15m',
    });

    at.addGrant({
      roomJoin: true,
      room: options.room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return at.toJwt();
  }

  async verifyWebhook(rawBody: string | Buffer, authHeader?: string): Promise<WebhookEvent> {
    const receiver = this.getWebhookReceiver();
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    return receiver.receive(bodyStr, authHeader);
  }
}
