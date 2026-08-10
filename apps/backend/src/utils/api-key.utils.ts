import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_KEY_SECRET = process.env.REDIS_KEY_SECRET || '';

export const isApiKeySyntaxValid = (apiKey: string): boolean => {
  if (!apiKey || !apiKey.startsWith('srs_')) return false;
  const apiParts = apiKey.split('_');
  if (
    apiParts.length != 3 ||
    apiParts[0] !== 'srs' ||
    apiParts[1].length !== 32 ||
    apiParts[2].length !== 43 ||
    !/^[a-f0-9]{32}$/i.test(apiParts[1]) ||
    !/^[a-zA-Z0-9_-]{43}$/i.test(apiParts[2])
  ) {
    return false;
  }
  return true;
};

export const extractApiKeyId = (apiKey: string): string => {
  const apiParts = apiKey.split('_');
  return apiParts[1];
};

export const digestApiKey = (apiKey: string): string => {
  return crypto
    .createHmac('sha256', REDIS_KEY_SECRET)
    .update(apiKey)
    .digest('hex');
};

export function addUuidDashes(uuid: string): string {
  const cleanUuid = uuid.replace(/-/g, '');

  if (!/^[0-9a-fA-F]{32}$/.test(cleanUuid)) {
    throw new Error('Invalid UUID');
  }

  return [
    cleanUuid.slice(0, 8),
    cleanUuid.slice(8, 12),
    cleanUuid.slice(12, 16),
    cleanUuid.slice(16, 20),
    cleanUuid.slice(20, 32),
  ].join('-');
}
