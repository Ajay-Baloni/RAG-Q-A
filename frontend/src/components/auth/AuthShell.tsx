import type { ReactNode } from "react";
import { ThemeToggle } from "../ui/ThemeToggle";

interface Props {
  heading: string;
  subheading: string;
  children: ReactNode;
}

export function AuthShell({ heading, subheading, children }: Props) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Editorial panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-surface p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.6]"
          style={{
            backgroundImage:
              "radial-gradient(40rem 40rem at 80% -10%, rgb(var(--accent) / 0.14), transparent 60%), radial-gradient(30rem 30rem at -10% 110%, rgb(var(--accent) / 0.10), transparent 55%)",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-fg shadow-soft">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">
            Lexica
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight text-ink">
            Ask your documents.
            <br />
            <span className="text-accent">Get cited answers.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Upload PDFs or paste a URL, then chat with your sources. Every
            answer streams in with citations you can trace back to the exact
            passage.
          </p>
        </div>

        <div className="relative font-mono text-xs text-muted"></div>
      </aside>

      {/* Form panel */}
      <main className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm animate-fade-up">
          <h1 className="font-display text-2xl font-semibold text-ink">
            {heading}
          </h1>
          <p className="mt-1 text-sm text-muted">{subheading}</p>
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}
