import { ApiKeyContext } from './api-key-context.interface';

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyContext;
      userId?: string;
    }
  }
}
