import crypto from 'crypto';

const REDIS_KEY_SECRET = process.env.REDIS_KEY_SECRET || '';

export function digestApiKey(apiKey: string) {
  return crypto
    .createHmac('sha256', REDIS_KEY_SECRET)
    .update(apiKey)
    .digest('hex');
}
