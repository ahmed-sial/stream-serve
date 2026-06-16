import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyRequestUser } from '../types/api-key-request-user.type';

export const CurrentUser = createParamDecorator(
  (_: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<ApiKeyRequestUser>();
    return request.user;
  },
);
