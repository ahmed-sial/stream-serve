import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Kysely } from 'kysely';
import { Database } from 'src/database/database.interface';
import { KYSELY_DB } from 'src/modules/database.module';
import * as argon2 from 'argon2';

@Injectable()
export class ApiKeyService {
  constructor(@Inject(KYSELY_DB) private readonly db: Kysely<Database>) {}

  private generateApiKey(): { plainTextKey: string; keyId: string } {
    const keyId = crypto.randomUUID().replace(/-/g, '');
    const secretKey = randomBytes(32).toString('base64url');
    const plainTextKey = `srs_${keyId}_${secretKey}`;
    return { plainTextKey, keyId };
  }

  async createApiKey(userId: string, apiKeyName: string) {
    const [result] = await this.db
      .selectFrom('api_keys')
      .where('user_id', '=', userId)
      .select(({ fn }) => [fn.count<number>('id').as('api_count')])
      .execute();

    if (result.api_count >= 5)
      throw new BadRequestException(
        'You have reached the maximum limit of 5 API keys.',
      );

    const { keyId, plainTextKey } = this.generateApiKey();
    const hashedKey = await argon2.hash(plainTextKey, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 1 << 16,
      parallelism: 1,
    });
    const prefix = plainTextKey.substring(0, 10) + '...';
    await this.db
      .insertInto('api_keys')
      .values({
        id: keyId,
        prefix,
        api_name: apiKeyName,
        user_id: userId,
        hashed_key: hashedKey,
      })
      .executeTakeFirst();
    return { apiKey: plainTextKey };
  }

  async getAllApiKeys(userId: string) {
    const apiKeys = await this.db
      .selectFrom('api_keys')
      .where('user_id', '=', userId)
      .select([
        'id',
        'api_name',
        'prefix',
        'created_at',
        'last_used_at',
        'revoked_at',
      ])
      .execute();
    return { apiKeys };
  }
}
