import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { forgotPassword } from '../api/auth';
import { ApiError } from '../lib/apiClient';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      heading="Forgot password"
      subheading="We'll email you a link to reset it"
    >
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface-2/60 p-4 text-sm text-ink">
            If an account exists for <span className="font-medium">{email}</span>, a reset
            link is on its way. The link expires in 1 hour.
          </div>
          <Link to="/login" className="block text-center text-sm text-accent hover:underline">
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full">
            Send reset link
          </Button>
          <p className="text-center text-sm text-muted">
            Remembered it?{' '}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Log in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
