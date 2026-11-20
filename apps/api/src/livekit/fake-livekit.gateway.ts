import { Injectable } from '@nestjs/common';
import { AccessToken, WebhookEvent, WebhookReceiver } from 'livekit-server-sdk';
import { AppConfigService } from '../config/app-config.service';
import {
  CreateRoomOptions,
  CreateTokenOptions,
  DispatchAgentOptions,
  LiveKitGateway,
} from './livekit.interface';

@Injectable()
export class FakeLiveKitGateway implements LiveKitGateway {
  public rooms: Set<string> = new Set();
  public dispatches: Array<{ room: string; agentName: string; metadata: string }> = [];
  public deletedRooms: Set<string> = new Set();
  public generatedTokens: Array<{ identity: string; name?: string; room: string; token: string }> =
    [];

  public shouldFailCreateRoom = false;
  public shouldFailDispatch = false;
  public shouldFailWebhook = false;

  constructor(private readonly config: AppConfigService) {}

  async createRoom(options: CreateRoomOptions): Promise<void> {
    if (this.shouldFailCreateRoom) {
      throw new Error('LiveKit room creation simulated failure');
    }
    this.rooms.add(options.name);
  }

  async dispatchAgent(options: DispatchAgentOptions): Promise<void> {
    if (this.shouldFailDispatch) {
      throw new Error('LiveKit agent dispatch simulated failure');
    }
    this.dispatches.push(options);
  }

  async deleteRoom(roomName: string): Promise<void> {
    this.rooms.delete(roomName);
    this.deletedRooms.add(roomName);
  }

  async createToken(options: CreateTokenOptions): Promise<string> {
    const apiKey = this.config.livekitApiKey || 'devkey';
    const apiSecret = this.config.livekitApiSecret || 'secret123456789012345678901234567890';

    const at = new AccessToken(apiKey, apiSecret, {
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

    const token = await at.toJwt();
    this.generatedTokens.push({
      identity: options.identity,
      name: options.name,
      room: options.room,
      token,
    });
    return token;
  }

  async verifyWebhook(rawBody: string | Buffer, authHeader?: string): Promise<WebhookEvent> {
    if (this.shouldFailWebhook) {
      throw new Error('LiveKit mock webhook verification simulated failure');
    }
    const apiKey = this.config.livekitApiKey || 'devkey';
    const apiSecret = this.config.livekitApiSecret || 'secret123456789012345678901234567890';
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    return receiver.receive(bodyStr, authHeader);
  }

  reset(): void {
    this.rooms.clear();
    this.dispatches = [];
    this.deletedRooms.clear();
    this.generatedTokens = [];
    this.shouldFailCreateRoom = false;
    this.shouldFailDispatch = false;
    this.shouldFailWebhook = false;
  }
}
