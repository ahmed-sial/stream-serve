import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/decorators/global/public.decorator';
import { SuperTokensAuthGuard } from 'supertokens-nestjs';
import { SessionRequest } from 'supertokens-node/framework/express';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

@Injectable()
export class CustomSuperTokensAuthGuard extends SuperTokensAuthGuard {
  constructor(
    private readonly ref: Reflector,
    private readonly apikeyAuthGuard: ApiKeyAuthGuard,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.ref.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<SessionRequest>();

    if (req.headers.authorization) {
      const session = await super.canActivate(context);
      if (!session) return false;
      const sessionContainer = req.session;
      if (!sessionContainer) return false;
      req.userId = sessionContainer.getUserId();
      return true;
    } else if (req.headers['x-api-key']) {
      const result = await this.apikeyAuthGuard.canActivate(context);
      return result;
    }
    return false;
  }
}
