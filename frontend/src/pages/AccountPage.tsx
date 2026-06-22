import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { changePassword } from '../api/auth';
import { getUsage, type UsageSummary } from '../api/usage';
import { ApiError } from '../lib/apiClient';

export function AccountPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    getUsage()
      .then((res) => setUsage(res.usage))
      .catch(() => undefined);
  }, []);

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

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">Usage</h2>
        <p className="mt-1 text-sm text-muted">
          Token usage across your conversations.
        </p>
        {!usage ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="Total tokens"
                value={usage.totals.totalTokens.toLocaleString()}
              />
              <Stat
                label="Input"
                value={usage.totals.promptTokens.toLocaleString()}
              />
              <Stat
                label="Answers"
                value={usage.totals.messages.toLocaleString()}
              />
            </div>
            {usage.byModel.length > 0 && (
              <table className="w-full text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 font-medium">Model</th>
                    <th className="py-1 font-medium">Input</th>
                    <th className="py-1 font-medium">Output</th>
                    <th className="py-1 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  {usage.byModel.map((m) => (
                    <tr key={m.model} className="border-t border-line">
                      <td className="py-1 font-mono">{m.model}</td>
                      <td className="py-1">{m.promptTokens.toLocaleString()}</td>
                      <td className="py-1">
                        {m.completionTokens.toLocaleString()}
                      </td>
                      <td className="py-1">{m.totalTokens.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-lg text-ink">{value}</p>
    </div>
  );
}
