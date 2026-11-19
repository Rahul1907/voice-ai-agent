import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserResponseDto } from '../../auth/dto/user-response.dto';

export const CurrentUser = createParamDecorator(
  (data: keyof UserResponseDto | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserResponseDto | undefined;
    return data && user ? user[data] : user;
  },
);
