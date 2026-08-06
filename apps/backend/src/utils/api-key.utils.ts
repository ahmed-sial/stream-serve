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
    apiParts[2].length !== 32 ||
    !/^[a-f0-9]{32}$/i.test(apiParts[1]) ||
    !/^[a-f0-9]{32}$/i.test(apiParts[2])
  )
    return false;
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
