import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
import { appUrl } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { sendPasswordResetEmail } from '../../services/email/email';
import { signToken } from './jwt';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

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

/** Change the password of a logged-in user after verifying the current one. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw AppError.badRequest('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

/**
 * Begin a password reset. Always resolves without revealing whether the email
 * exists (prevents account enumeration). Emails a one-hour, single-use link.
 */
export async function forgotPassword(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    logger.info('Password reset requested for unknown email');
    return;
  }

  // Invalidate any prior tokens, then issue a fresh one.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const rawToken = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

/** Complete a password reset using the emailed token. */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!record || record.expiresAt < new Date()) {
    throw AppError.badRequest('This reset link is invalid or has expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);
}
