import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { resetPassword } from '../api/auth';
import { ApiError } from '../lib/apiClient';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(token, password);
      navigate('/login', { replace: true, state: { reset: true } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell heading="Invalid link" subheading="This reset link is missing or malformed">
        <Link to="/forgot-password" className="block text-center text-sm text-accent hover:underline">
          Request a new reset link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Set a new password" subheading="Choose a strong password you'll remember">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          id="password"
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <Input
          id="confirm"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" loading={loading} className="w-full">
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
