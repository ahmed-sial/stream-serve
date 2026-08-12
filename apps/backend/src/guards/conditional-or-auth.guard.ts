import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { CustomSuperTokensAuthGuard } from './custom-super-token-auth-with-session.guard';

@Injectable()
export class OrAuthGuard implements CanActivate {
  constructor(
    private readonly authGuard: CustomSuperTokensAuthGuard,
    private readonly apiKeyGuard: ApiKeyAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result1 = await this.authGuard.canActivate(context);
      if (result1) return true;
      const result2 = await this.apiKeyGuard.canActivate(context);
      return result2;
    } catch (err) {
      try {
        return await this.apiKeyGuard.canActivate(context);
      } catch (err) {
        return false;
      }
    }
  }
}
