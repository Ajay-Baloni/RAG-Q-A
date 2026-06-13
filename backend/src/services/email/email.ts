import { Resend } from 'resend';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Send a password-reset email. If RESEND_API_KEY isn't configured, the link is
 * logged instead (handy in development / before wiring the key).
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!resend) {
    logger.warn('RESEND_API_KEY not set — password reset link (dev only)', { to, resetUrl });
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Reset your Lexica password',
    html: `
      <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1c1917;">
        <h2 style="font-weight: 600;">Reset your password</h2>
        <p style="color: #57534e; line-height: 1.6;">
          We received a request to reset your password. Click the button below to choose a
          new one. This link expires in 1 hour. If you didn't request this, you can ignore this email.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; margin: 16px 0; padding: 10px 20px; background: #b45309;
                  color: #fffbf5; text-decoration: none; border-radius: 8px; font-weight: 500;">
          Reset password
        </a>
        <p style="color: #a8a29e; font-size: 12px; word-break: break-all;">
          Or paste this link into your browser:<br />${resetUrl}
        </p>
      </div>
    `,
  });

  if (error) throw new Error(`Failed to send email: ${error.message}`);
  logger.info('Password reset email sent', { to });
}
