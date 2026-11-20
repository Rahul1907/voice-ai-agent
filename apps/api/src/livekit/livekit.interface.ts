import type { WebhookEvent } from 'livekit-server-sdk';

export interface CreateRoomOptions {
  name: string;
  emptyTimeout?: number;
}

export interface DispatchAgentOptions {
  room: string;
  agentName: string;
  metadata: string;
}

export interface CreateTokenOptions {
  identity: string;
  name?: string;
  room: string;
  ttl?: string;
}

export interface LiveKitGateway {
  createRoom(options: CreateRoomOptions): Promise<void>;
  dispatchAgent(options: DispatchAgentOptions): Promise<void>;
  deleteRoom(roomName: string): Promise<void>;
  createToken(options: CreateTokenOptions): Promise<string>;
  verifyWebhook(rawBody: string | Buffer, authHeader?: string): Promise<WebhookEvent>;
}

export const LIVEKIT_GATEWAY = Symbol('LIVEKIT_GATEWAY');
