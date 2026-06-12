/* Augment Express Request with the authenticated user (set by auth middleware). */
import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export {};
