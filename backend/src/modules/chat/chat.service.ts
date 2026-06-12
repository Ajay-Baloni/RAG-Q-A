import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { embedText } from '../../services/ai/embeddings';
import { streamWithFallback, type LlmModel } from '../../services/ai/llm';
import { buildUserPrompt } from '../../services/ai/prompt';
import { searchSimilarChunks, type RetrievedChunk } from '../../db/vectorSearch';
import {
  getConversationContext,
  getRecentHistory,
} from '../conversations/conversations.service';

export interface StreamCallbacks {
  /** Retrieved sources, sent once before token streaming begins. */
  onSources: (sources: RetrievedChunk[]) => void;
  /** Each generated token delta. */
  onToken: (text: string) => void;
}

export interface StreamResult {
  messageId: string;
  model: LlmModel;
}

/**
 * Phase 2/3 streaming RAG flow:
 *   save question → embed → retrieve → emit sources → stream answer (Gemini,
 *   falling back to Groq on 429) → persist answer + ordered citations.
 */
export async function askStream(
  userId: string,
  conversationId: string,
  question: string,
  cb: StreamCallbacks
): Promise<StreamResult> {
  const trimmed = question.trim();
  if (!trimmed) throw AppError.badRequest('Question must not be empty');

  const { documentIds } = await getConversationContext(userId, conversationId);

  await prisma.message.create({
    data: { conversationId, role: 'USER', content: trimmed },
  });

  // Title the conversation after its first question.
  const messageCount = await prisma.message.count({ where: { conversationId } });
  if (messageCount === 1) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: trimmed.slice(0, 60) },
    });
  }

  const history = await getRecentHistory(conversationId);

  const questionEmbedding = await embedText(trimmed);
  const sources = await searchSimilarChunks(questionEmbedding, documentIds);
  cb.onSources(sources);

  const prompt = buildUserPrompt(trimmed, sources, history);

  let answer = '';
  let model: LlmModel = 'gemini';
  for await (const token of streamWithFallback(prompt)) {
    answer += token.text;
    model = token.model;
    cb.onToken(token.text);
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      role: 'ASSISTANT',
      content: answer,
      modelUsed: model,
      citations: {
        create: sources.map((s, index) => ({
          chunkId: s.id,
          documentId: s.documentId,
          order: index,
        })),
      },
    },
    select: { id: true },
  });

  logger.info('Answer generated', { conversationId, model, sources: sources.length });
  return { messageId: message.id, model };
}
