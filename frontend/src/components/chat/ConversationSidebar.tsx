import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { ConversationSummary } from '../../types';

interface Props {
  conversations: ConversationSummary[];
  activeId: string;
  onDelete: (id: string) => Promise<void>;
}

export function ConversationSidebar({ conversations, activeId, onDelete }: Props) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      await onDelete(pending.id);
      setPending(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <aside className="flex h-full flex-col gap-3 overflow-hidden">
      <Button variant="secondary" className="w-full justify-start" onClick={() => navigate('/')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New chat
      </Button>

      <p className="px-1 font-mono text-[10px] uppercase tracking-wider text-muted">History</p>

      <nav className="scroll-slim flex-1 space-y-0.5 overflow-auto pr-1">
        {conversations.map((c) => {
          const active = c.id === activeId;
          return (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
                active ? 'bg-accent-soft' : 'hover:bg-surface-2'
              }`}
            >
              <Link
                to={`/chat/${c.id}`}
                title={c.title}
                className={`flex-1 truncate px-3 py-2 text-sm ${
                  active ? 'font-medium text-accent' : 'text-ink/80'
                }`}
              >
                {c.title}
              </Link>
              <button
                onClick={() => setPending(c)}
                aria-label="Delete conversation"
                title="Delete conversation"
                className="shrink-0 rounded-md p-1.5 text-muted opacity-0 transition hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </div>
          );
        })}
        {conversations.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted">No conversations yet.</p>
        )}
      </nav>

      <ConfirmDialog
        open={pending !== null}
        title="Delete conversation"
        message={`"${pending?.title ?? ''}" and its messages will be permanently removed.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setPending(null)}
      />
    </aside>
  );
}
