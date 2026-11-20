import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract key from x-internal-key header or Authorization: Bearer <key>
    let providedKey: string | undefined;

    const xKey = request.headers['x-internal-key'];
    if (typeof xKey === 'string' && xKey.trim() !== '') {
      providedKey = xKey.trim();
    } else {
      const authHeader = request.headers['authorization'];
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token) {
          providedKey = token;
        }
      }
    }

    if (!providedKey) {
      throw new UnauthorizedException('Internal API key is required');
    }

    const expectedKey = this.config.internalApiKey;
    const providedBuffer = Buffer.from(providedKey);
    const expectedBuffer = Buffer.from(expectedKey);

    // Constant-time comparison to prevent timing attacks
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }
}
