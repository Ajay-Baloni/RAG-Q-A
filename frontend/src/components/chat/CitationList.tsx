import type { Citation } from '../../types';

interface Props {
  citations: Citation[];
  activeOrder?: number | null;
  onHover?: (order: number | null) => void;
}

export function CitationList({ citations, activeOrder, onHover }: Props) {
  if (citations.length === 0) return null;
  return (
    <div className="max-w-[82%] rounded-xl border border-line bg-surface-2/60 p-3">
      <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-wider text-muted">
        Sources
      </p>
      <ul className="space-y-1.5">
        {citations.map((c) => {
          const active = activeOrder === c.order;
          return (
            <li
              key={c.id}
              onMouseEnter={() => onHover?.(c.order)}
              onMouseLeave={() => onHover?.(null)}
              className={`cursor-default rounded-lg border p-2 text-xs transition ${
                active
                  ? 'border-accent/40 bg-accent-soft'
                  : 'border-transparent bg-surface hover:border-line'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="grid h-4 min-w-4 place-items-center rounded bg-accent px-1 text-[10px] font-semibold text-accent-fg">
                  {c.order + 1}
                </span>
                {c.chunk?.chunkIndex !== undefined && (
                  <span className="font-mono text-[10px] text-muted">chunk #{c.chunk.chunkIndex}</span>
                )}
              </div>
              {c.chunk?.content && (
                <p className="mt-1 line-clamp-3 leading-relaxed text-muted">{c.chunk.content}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
