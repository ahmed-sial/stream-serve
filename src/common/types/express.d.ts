import { RequestUser } from './request-user.type';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
export {};
