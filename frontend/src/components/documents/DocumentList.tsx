import type { Document, DocumentStatus } from '../../types';

const statusStyles: Record<DocumentStatus, string> = {
  PROCESSING: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  READY: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  FAILED: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

interface Props {
  documents: Document[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function SourceIcon({ type }: { type: 'PDF' | 'URL' }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
      {type === 'PDF' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </svg>
      )}
    </span>
  );
}

export function DocumentList({ documents, selected, onToggle, onDelete }: Props) {
  if (documents.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center">
        <p className="font-display text-lg text-ink">Your library is empty</p>
        <p className="mt-1 text-sm text-muted">Upload a PDF or add a URL to get started.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {documents.map((doc) => {
        const ready = doc.status === 'READY';
        const isSelected = selected.has(doc.id);
        return (
          <li
            key={doc.id}
            onClick={() => ready && onToggle(doc.id)}
            className={`group flex items-center gap-3 rounded-xl border bg-surface p-3 transition ${
              isSelected ? 'border-accent ring-1 ring-accent/30' : 'border-line hover:border-accent/40'
            } ${ready ? 'cursor-pointer' : ''}`}
          >
            <input
              type="checkbox"
              disabled={!ready}
              checked={isSelected}
              onChange={() => onToggle(doc.id)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 shrink-0 accent-accent disabled:opacity-30"
            />
            <SourceIcon type={doc.sourceType} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{doc.title}</p>
              <p className="truncate font-mono text-xs text-muted">
                {doc.sourceType} · {new Date(doc.createdAt).toLocaleDateString()}
              </p>
              {doc.status === 'FAILED' && doc.error && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{doc.error}</p>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[doc.status]}`}>
              {doc.status === 'PROCESSING' ? 'Processing…' : doc.status === 'READY' ? 'Ready' : 'Failed'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(doc.id);
              }}
              className="shrink-0 rounded-md p-1.5 text-muted opacity-0 transition hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400"
              aria-label="Delete document"
              title="Delete document"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
