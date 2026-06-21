import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Observable } from 'rxjs';
import { DRIZZLE_DB } from 'src/database/database.module';
import * as schema from '../database/schema';
import { REDIS_CLIENT } from 'src/infrastructure/redis.module';
import Redis from 'ioredis';
import type { Request } from 'express';
import { hardLockRedisKey } from 'src/common/types/constants';

@Injectable()
export class UploadGaurd implements CanActivate {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NeonHttpDatabase<typeof schema>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async isHardLocked(userId: string): Promise<boolean> {
    return (await this.redis.exists(hardLockRedisKey(userId))) === 1;
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthorized');
    if (await this.isHardLocked(userId))
      throw new ForbiddenException(
        'Your account has been locked. You have exceeded the usage limit for you plan. Please upgrade your plan to continue uploading.',
      );
    // CONTINUE: 26:17
  }
}
