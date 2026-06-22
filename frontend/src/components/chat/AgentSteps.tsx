import { useState } from "react";
import type { MessageStep } from "../../types";

const ICONS: Record<string, string> = {
  search_documents: "🔍",
  web_search: "🌐",
  calculator: "🧮",
};

export function AgentSteps({ steps }: { steps: MessageStep[] }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;

  return (
    <div className="px-2 text-xs text-muted">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:text-accent"
      >
        {open ? "▾" : "▸"} {steps.length} reasoning step
        {steps.length > 1 ? "s" : ""}
      </button>
      {open && (
        <ul className="mt-1 space-y-1 border-l border-line pl-3">
          {steps.map((s) => (
            <li key={s.order}>
              <span className="mr-1">{ICONS[s.tool] ?? "•"}</span>
              <span className="font-mono">{s.tool}</span>
              {": "}
              {s.outputSummary || "…"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
