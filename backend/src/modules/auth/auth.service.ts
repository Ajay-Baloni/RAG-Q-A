import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/AppError';
import { signToken } from './jwt';

export interface PublicUser {
  id: string;
  email: string;
  createdAt: Date;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

function toPublicUser(u: { id: string; email: string; createdAt: Date }): PublicUser {
  return { id: u.id, email: u.email, createdAt: u.createdAt };
}

export async function register(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw AppError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: normalizedEmail, passwordHash },
  });

  const token = signToken({ sub: user.id, email: user.email });
  return { token, user: toPublicUser(user) };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw AppError.unauthorized('Invalid email or password');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw AppError.unauthorized('Invalid email or password');

  const token = signToken({ sub: user.id, email: user.email });
  return { token, user: toPublicUser(user) };
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound('User not found');
  return toPublicUser(user);
}
