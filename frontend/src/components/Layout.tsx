import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { ThemeToggle } from './ui/ThemeToggle';

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg shadow-soft">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-ink">
              Lexica
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="mr-1 hidden font-mono text-xs text-muted sm:inline">
              {user?.email}
            </span>
            <ThemeToggle />
            <Button variant="secondary" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-hidden px-5 py-7">
        <Outlet />
      </main>
    </div>
  );
}
