import { prisma } from "../../db/prisma";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { embedText } from "../../services/ai/embeddings";
import { streamWithFallback, type LlmModel } from "../../services/ai/llm";
import { buildUserPrompt } from "../../services/ai/prompt";
import {
  searchSimilarChunks,
  type RetrievedChunk,
} from "../../db/vectorSearch";
import { runAgent, type AgentStep } from "../../services/ai/agent";
import { getTool, type Tool } from "../../services/ai/tools";
import {
  getConversationContext,
  getRecentHistory,
} from "../conversations/conversations.service";
import type { TurnMessage } from "../../services/ai/providers/types";

export interface StreamCallbacks {
  /** Retrieved sources. */
  onSources: (sources: RetrievedChunk[]) => void;
  /** A tool call has begun (agent mode only). */
  onStep: (step: AgentStep) => void;
  /** A tool call has returned (agent mode only). */
  onToolResult: (order: number, summary: string) => void;
  /** Answer text delta. */
  onToken: (text: string) => void;
}

export interface StreamResult {
  messageId: string;
  model: LlmModel;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Optional agentic tools the user enabled for this question. */
const SELECTABLE_TOOLS = ["web_search", "calculator"] as const;

/**
 * RAG chat. With no tools selected it runs classic streamed document RAG
 * (embed → vector search → answer). When the user enables tools (web search,
 * calculator) it runs the tool-calling agent with document search plus those
 * tools. Either way the assistant message is persisted with token usage.
 */
export async function askStream(
  userId: string,
  conversationId: string,
  question: string,
  enabledTools: string[],
  cb: StreamCallbacks,
): Promise<StreamResult> {
  const trimmed = question.trim();
  if (!trimmed) throw AppError.badRequest("Question must not be empty");

  const { documentIds } = await getConversationContext(userId, conversationId);

  await prisma.message.create({
    data: { conversationId, role: "USER", content: trimmed },
  });

  // Title the conversation after its first question.
  const messageCount = await prisma.message.count({
    where: { conversationId },
  });
  if (messageCount === 1) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: trimmed.slice(0, 60) },
    });
  }

  const history = await getRecentHistory(conversationId);

  const agentTools = enabledTools.filter((t) =>
    SELECTABLE_TOOLS.includes(t as (typeof SELECTABLE_TOOLS)[number]),
  );

  const persisted =
    agentTools.length === 0
      ? await runPlainRag(conversationId, trimmed, documentIds, history, cb)
      : await runAgentic(
          conversationId,
          userId,
          trimmed,
          documentIds,
          history,
          agentTools,
          cb,
        );

  return persisted;
}

/** Classic streamed RAG: vector search then answer from the excerpts. */
async function runPlainRag(
  conversationId: string,
  question: string,
  documentIds: string[],
  history: { role: "USER" | "ASSISTANT"; content: string }[],
  cb: StreamCallbacks,
): Promise<StreamResult> {
  const questionEmbedding = await embedText(question);
  const sources = await searchSimilarChunks(questionEmbedding, documentIds);
  cb.onSources(sources);

  const prompt = buildUserPrompt(question, sources, history);

  let answer = "";
  const gen = streamWithFallback(prompt);
  let res = await gen.next();
  while (!res.done) {
    answer += res.value.text;
    cb.onToken(res.value.text);
    res = await gen.next();
  }
  const { model, usage } = res.value;

  const message = await persistAssistant(conversationId, {
    answer,
    model,
    usage,
    sources,
    steps: [],
  });

  logger.info("Answer generated (plain RAG)", {
    conversationId,
    model,
    sources: sources.length,
  });

  return finalize(message.id, model, usage);
}

/** Agentic RAG: the LLM calls document search plus the user-enabled tools. */
async function runAgentic(
  conversationId: string,
  userId: string,
  question: string,
  documentIds: string[],
  history: { role: "USER" | "ASSISTANT"; content: string }[],
  agentTools: string[],
  cb: StreamCallbacks,
): Promise<StreamResult> {
  const turnHistory: TurnMessage[] = history.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));

  // Document search is always available in agent mode; add the enabled extras.
  const tools: Tool[] = [getTool("search_documents")!];
  for (const name of agentTools) {
    const tool = getTool(name);
    if (tool) tools.push(tool);
  }

  const result = await runAgent(
    question,
    turnHistory,
    tools,
    { userId, documentIds },
    {
      onStep: (step) => cb.onStep(step),
      onToolResult: (order, summary) => cb.onToolResult(order, summary),
      onToken: (text) => cb.onToken(text),
    },
  );

  cb.onSources(result.sources);

  const message = await persistAssistant(conversationId, {
    answer: result.answer,
    model: result.model,
    usage: result.usage,
    sources: result.sources,
    steps: result.steps,
  });

  logger.info("Answer generated (agent)", {
    conversationId,
    model: result.model,
    steps: result.steps.length,
    sources: result.sources.length,
  });

  return finalize(message.id, result.model, result.usage);
}

interface PersistInput {
  answer: string;
  model: LlmModel;
  usage: { promptTokens: number; completionTokens: number };
  sources: RetrievedChunk[];
  steps: AgentStep[];
}

function persistAssistant(conversationId: string, input: PersistInput) {
  return prisma.message.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content: input.answer,
      modelUsed: input.model,
      promptTokens: input.usage.promptTokens,
      completionTokens: input.usage.completionTokens,
      citations: {
        create: input.sources.map((s, index) => ({
          chunkId: s.id,
          documentId: s.documentId,
          order: index,
        })),
      },
      steps: {
        create: input.steps.map((s) => ({
          order: s.order,
          tool: s.tool,
          input: JSON.stringify(s.input),
          outputSummary: s.outputSummary,
        })),
      },
    },
    select: { id: true },
  });
}

function finalize(
  messageId: string,
  model: LlmModel,
  usage: { promptTokens: number; completionTokens: number },
): StreamResult {
  return {
    messageId,
    model,
    usage: {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.promptTokens + usage.completionTokens,
    },
  };
}
