import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { verifyToken } from '../modules/auth/jwt';

/** Requires a valid `Authorization: Bearer <token>` header. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or malformed Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }
}
