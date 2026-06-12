import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

/** 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // next is required for Express to treat this as an error handler
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.flatten().fieldErrors,
    });
  }

  if (err instanceof AppError) {
    if (!err.isOperational) logger.error('Non-operational error', { message: err.message });
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error('Unhandled error', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return res.status(500).json({ error: 'Internal server error' });
}
