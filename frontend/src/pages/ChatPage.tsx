import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { MessageBubble } from "../components/chat/MessageBubble";
import { CitationList } from "../components/chat/CitationList";
import { ConversationSidebar } from "../components/chat/ConversationSidebar";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  streamQuestion,
} from "../api/conversations";
import { ApiError } from "../lib/apiClient";
import type {
  Citation,
  ConversationSummary,
  Message,
  RetrievedSource,
} from "../types";

interface HoverState {
  messageId: string;
  order: number;
}

function sourcesToCitations(sources: RetrievedSource[]): Citation[] {
  return sources.map((s, i) => ({
    id: s.id,
    chunkId: s.id,
    documentId: s.documentId,
    order: i,
    chunk: { content: s.content, chunkIndex: s.chunkIndex },
  }));
}

export function ChatPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  console.log("location.state", location.state);
  const state = location.state as {
    documentIds?: string[];
    skipLoad?: boolean;
  } | null;
  const isDraft = id === "new";

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    console.log("messages", messages);
  }, [messages]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(!isDraft);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(() => {
    listConversations()
      .then((res) => setConversations(res.conversations))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (isDraft) {
      // A draft chat needs the selected documents passed via navigation state.
      if (!state?.documentIds?.length) {
        navigate("/", { replace: true });
        return;
      }
      setMessages([]);
      setLoading(false);
      return;
    }
    // Coming from draft → real id: messages are already streaming in state.
    if (state?.skipLoad) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getConversation(id)
      .then((res) => setMessages(res.conversation.messages))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load chat"),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleDeleteConversation(cid: string) {
    try {
      await deleteConversation(cid);
      setConversations((prev) => prev.filter((c) => c.id !== cid));
      if (cid === id) navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to delete conversation",
      );
    }
  }

  async function onSubmit(e: FormEvent) {
    debugger;
    e.preventDefault();
    const q = question.trim();
    if (!q || sending) return;

    setError(null);
    setSending(true);
    setQuestion("");

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "USER",
      content: q,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: "ASSISTANT",
      content: "",
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const patch = (mid: string, fn: (m: Message) => Message) =>
      setMessages((prev) => prev.map((m) => (m.id === mid ? fn(m) : m)));

    try {
      // Lazily create the conversation on the first message of a draft.
      let targetId = id;
      if (isDraft) {
        const { conversation } = await createConversation(state!.documentIds!);
        targetId = conversation.id;
        navigate(`/chat/${targetId}`, {
          replace: true,
          state: { skipLoad: true, documentIds: state!.documentIds },
        });
      }

      await streamQuestion(targetId, q, {
        onSources: (sources) =>
          patch(assistantId, (m) => ({
            ...m,
            citations: sourcesToCitations(sources),
          })),
        onToken: (text) =>
          patch(assistantId, (m) => ({ ...m, content: m.content + text })),
        onDone: (res) => {
          patch(assistantId, (m) => ({
            ...m,
            id: res.messageId,
            modelUsed: res.model,
          }));
          refreshConversations();
        },
        onError: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-1 gap-5 md:grid-cols-[230px_1fr]">
      <div className="hidden md:block">
        <ConversationSidebar
          conversations={conversations}
          activeId={id}
          onDelete={handleDeleteConversation}
        />
      </div>

      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface/40">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 md:hidden">
          <Link to="/" className="text-sm text-accent hover:underline">
            ← Library
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <div className="scroll-slim flex-1 space-y-2.5 overflow-auto p-5">
            {messages.length === 0 && (
              <div className="grid h-full place-items-center text-center">
                <div className="max-w-xs">
                  <p className="font-display text-xl text-ink">Ask away</p>
                  <p className="mt-1 text-sm text-muted">
                    Ask a question about your selected documents — answers
                    stream in with citations.
                  </p>
                </div>
              </div>
            )}
            {messages.map((m) => {
              const activeOrder =
                hovered?.messageId === m.id ? hovered.order : null;
              const onHover = (order: number | null) =>
                setHovered(order === null ? null : { messageId: m.id, order });
              return (
                <div key={m.id} className="space-y-1.5">
                  <MessageBubble
                    message={m}
                    activeOrder={activeOrder}
                    onHoverCitation={onHover}
                  />
                  {m.role === "ASSISTANT" && m.content === "" && (
                    <div className="flex items-center gap-2 px-2 text-sm text-muted">
                      <Spinner className="h-4 w-4" /> Thinking…
                    </div>
                  )}
                  {m.role === "ASSISTANT" &&
                    m.citations &&
                    m.citations.length > 0 && (
                      <CitationList
                        citations={m.citations}
                        activeOrder={activeOrder}
                        onHover={onHover}
                      />
                    )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {error && (
          <p className="px-5 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <form
          onSubmit={onSubmit}
          className="flex gap-2 border-t border-line p-3"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question…"
            className="flex-1 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <Button type="submit" loading={sending} disabled={!question.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
