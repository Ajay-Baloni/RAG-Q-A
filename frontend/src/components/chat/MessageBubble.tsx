import { Fragment } from 'react';
import type { Message } from '../../types';

interface Props {
  message: Message;
  activeOrder?: number | null;
  onHoverCitation?: (order: number | null) => void;
}

/** Split assistant text on [n] markers and render them as hoverable chips. */
function renderWithCitations(
  text: string,
  activeOrder: number | null | undefined,
  onHover?: (order: number | null) => void
) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return <Fragment key={i}>{part}</Fragment>;
    const order = Number(match[1]) - 1;
    const active = activeOrder === order;
    return (
      <sup
        key={i}
        onMouseEnter={() => onHover?.(order)}
        onMouseLeave={() => onHover?.(null)}
        className={`mx-0.5 cursor-pointer rounded px-1 py-0.5 text-[10px] font-semibold transition ${
          active ? 'bg-accent text-accent-fg' : 'bg-accent-soft text-accent'
        }`}
      >
        {match[1]}
      </sup>
    );
  });
}

export function MessageBubble({ message, activeOrder, onHoverCitation }: Props) {
  const isUser = message.role === 'USER';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-up`}>
      <div
        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-soft ${
          isUser
            ? 'rounded-br-sm bg-accent text-accent-fg'
            : 'rounded-bl-sm border border-line bg-surface text-ink'
        }`}
      >
        {isUser
          ? message.content
          : renderWithCitations(message.content, activeOrder, onHoverCitation)}
        {!isUser && message.modelUsed && (
          <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-wide text-muted">
            via {message.modelUsed}
          </span>
        )}
      </div>
    </div>
  );
}
