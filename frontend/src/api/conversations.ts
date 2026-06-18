import { apiFetch, ApiError, getToken } from "../lib/apiClient";
import { API_URL } from "../lib/constants";
import type {
  Conversation,
  ConversationSummary,
  RetrievedSource,
} from "../types";

export function createConversation(documentIds: string[], title?: string) {
  return apiFetch<{
    conversation: ConversationSummary & { documentIds: string[] };
  }>("/api/conversations", { method: "POST", body: { documentIds, title } });
}

export function listConversations() {
  return apiFetch<{ conversations: ConversationSummary[] }>(
    "/api/conversations",
  );
}

export function getConversation(id: string) {
  return apiFetch<{ conversation: Conversation }>(`/api/conversations/${id}`);
}

export function deleteConversation(id: string) {
  return apiFetch<void>(`/api/conversations/${id}`, { method: "DELETE" });
}

export interface StreamHandlers {
  onSources: (sources: RetrievedSource[]) => void;
  onToken: (text: string) => void;
  onDone: (result: { messageId: string; model: string }) => void;
  onError: (message: string) => void;
}

/**
 * Ask a question and consume the SSE stream via fetch + ReadableStream
 * (lets us send the Authorization header, unlike EventSource).
 */
export async function streamQuestion(
  conversationId: string,
  question: string,
  handlers: StreamHandlers,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken() ?? ""}`,
      },
      body: JSON.stringify({ question }),
    },
  );

  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, data.error ?? "Request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      dispatchEvent(rawEvent, handlers);
    }
  }
}

function dispatchEvent(raw: string, handlers: StreamHandlers) {
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;

  const payload = JSON.parse(data);
  switch (event) {
    case "sources":
      handlers.onSources(payload.sources as RetrievedSource[]);
      break;
    case "token":
      handlers.onToken(payload.text as string);
      break;
    case "done":
      handlers.onDone(payload as { messageId: string; model: string });
      break;
    case "error":
      handlers.onError(payload.message as string);
      break;
  }
}
