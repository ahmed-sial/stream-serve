import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { IApiKeyContext } from 'src/types/api-key-context.interface';

export const ApiKeyContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IApiKeyContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.apiKey) throw new UnauthorizedException('Unauthorized');
    return request.apiKey;
  },
);
