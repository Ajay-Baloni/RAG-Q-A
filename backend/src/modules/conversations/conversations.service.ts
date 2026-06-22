import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/AppError';
import { assertDocumentsReady } from '../documents/documents.service';
import { HISTORY_MESSAGE_LIMIT } from '../../config/constants';

export async function createConversation(
  userId: string,
  documentIds: string[],
  title?: string
) {
  await assertDocumentsReady(userId, documentIds);

  const conversation = await prisma.conversation.create({
    data: {
      userId,
      title: title?.trim() || 'New conversation',
      conversationDocuments: {
        create: documentIds.map((documentId) => ({ documentId })),
      },
    },
    select: { id: true, title: true, createdAt: true },
  });

  return { ...conversation, documentIds };
}

export async function listConversations(userId: string) {
  return prisma.conversation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      conversationDocuments: { select: { documentId: true } },
    },
  });
}

/** Load a conversation with its full message history and citations. */
export async function getConversation(userId: string, id: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      conversationDocuments: { select: { documentId: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          modelUsed: true,
          promptTokens: true,
          completionTokens: true,
          createdAt: true,
          steps: {
            orderBy: { order: 'asc' },
            select: {
              order: true,
              tool: true,
              input: true,
              outputSummary: true,
            },
          },
          citations: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              chunkId: true,
              documentId: true,
              order: true,
              chunk: { select: { content: true, chunkIndex: true } },
            },
          },
        },
      },
    },
  });
  if (!conversation) throw AppError.notFound('Conversation not found');
  return conversation;
}

export async function deleteConversation(userId: string, id: string): Promise<void> {
  const result = await prisma.conversation.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw AppError.notFound('Conversation not found');
}

/** Return the owned conversation plus its document ids, or throw. */
export async function getConversationContext(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, conversationDocuments: { select: { documentId: true } } },
  });
  if (!conversation) throw AppError.notFound('Conversation not found');
  return {
    id: conversation.id,
    documentIds: conversation.conversationDocuments.map((d) => d.documentId),
  };
}

/** Last N messages, oldest-first, for prompt context. */
export async function getRecentHistory(conversationId: string) {
  const recent = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_MESSAGE_LIMIT,
    select: { role: true, content: true },
  });
  return recent.reverse() as { role: 'USER' | 'ASSISTANT'; content: string }[];
}
