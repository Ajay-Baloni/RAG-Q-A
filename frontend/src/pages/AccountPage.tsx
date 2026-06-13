import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { changePassword } from '../api/auth';
import { ApiError } from '../lib/apiClient';

export function AccountPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-up space-y-6">
      <div>
        <Link to="/" className="text-sm text-accent hover:underline">
          ← Library
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Account</h1>
        <p className="font-mono text-sm text-muted">{user?.email}</p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">Change password</h2>
        <p className="mt-1 text-sm text-muted">Enter your current password and a new one.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Input
            id="current"
            label="Current password"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <Input
            id="new"
            label="New password"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            required
          />
          <Input
            id="confirm"
            label="Confirm new password"
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
          {done && (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              Password updated.
            </p>
          )}
          <Button type="submit" loading={loading}>
            Update password
          </Button>
        </form>
      </section>
    </div>
  );
}
