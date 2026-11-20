import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { InternalKeyGuard } from './internal-key.guard';

describe('InternalKeyGuard (Unit Tests)', () => {
  let guard: InternalKeyGuard;
  const validKey = 'correct-internal-key-12345678';
  let mockConfig: Partial<AppConfigService>;

  beforeEach(() => {
    mockConfig = {
      internalApiKey: validKey,
    };
    guard = new InternalKeyGuard(mockConfig as AppConfigService);
  });

  function createMockContext(
    headers: Record<string, string | undefined>,
    cookies: Record<string, string> = {},
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          cookies,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('INT-01: throws 401 Unauthorized if no internal key header is provided', () => {
    const context = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('INT-01: throws 401 Unauthorized if internal key is incorrect', () => {
    const context = createMockContext({ 'x-internal-key': 'wrong-key-value-00000000' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('INT-01: allows request if valid key is passed in x-internal-key header', () => {
    const context = createMockContext({ 'x-internal-key': validKey });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('INT-01: allows request if valid key is passed in Authorization Bearer header', () => {
    const context = createMockContext({ authorization: `Bearer ${validKey}` });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('INT-08: throws 401 Unauthorized when request has user cookie only without internal key', () => {
    const context = createMockContext({}, { access_token: 'valid.user.jwt.cookie' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
