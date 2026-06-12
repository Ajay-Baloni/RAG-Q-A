import type { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import { AppError } from '../../utils/AppError';

const credentialsSchema = z.object({
  email: z.string().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function register(req: Request, res: Response) {
  const { email, password } = credentialsSchema.parse(req.body);
  const result = await authService.register(email, password);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const { email, password } = credentialsSchema.parse(req.body);
  const result = await authService.login(email, password);
  res.json(result);
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const user = await authService.getUserById(req.user.id);
  res.json({ user });
}
