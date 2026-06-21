import { Inject, Injectable } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/infrastructure/redis.module';
import * as schema from '../../database/schema';
import { DRIZZLE_DB } from 'src/database/database.module';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(DRIZZLE_DB) private readonly db: NeonHttpDatabase<typeof schema>,
    private readonly config: ConfigService,
  ) {}
}
