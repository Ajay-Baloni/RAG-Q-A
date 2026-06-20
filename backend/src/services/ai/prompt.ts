import type { RetrievedChunk } from "../../db/vectorSearch";

export interface HistoryMessage {
  role: "USER" | "ASSISTANT";
  content: string;
}

export const SYSTEM_PROMPT = `You are a helpful assistant that answers questions strictly using the provided document excerpts.

Rules:
- Answer ONLY from the excerpts below. If the answer is not contained in them, say you don't have enough information in the provided documents.
- Be concise and accurate.
- When you use information from an excerpt, cite it inline using its number in square brackets, e.g. [1] or [2].
- Do not invent sources or facts.`;

/** Render retrieved chunks into a numbered context block. */
export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "(no relevant excerpts found)";
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] (document ${c.documentId}, chunk ${c.chunkIndex})\n${c.content}`,
    )
    .join("\n\n");
}

/** Assemble the full user-facing prompt: history + context + question. */
export function buildUserPrompt(
  question: string,
  chunks: RetrievedChunk[],
  history: HistoryMessage[],
): string {
  const historyBlock =
    history.length > 0
      ? `Conversation so far:\n${history
          .map(
            (m) => `${m.role === "USER" ? "User" : "Assistant"}: ${m.content}`,
          )
          .join("\n")}\n\n`
      : "";

  return `${historyBlock}Document excerpts:\n${formatContext(chunks)}\n\nQuestion: ${question}`;
}
