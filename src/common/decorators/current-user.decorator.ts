import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestUser } from '../types/request-user.type';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_: string, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.user?.id) throw new UnauthorizedException('Unauthorized');
    return request.user;
  },
);
