import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { insertChunkWithEmbedding } from '../../db/vectorSearch';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { chunkText } from '../../services/chunking/chunker';
import { embedBatch } from '../../services/ai/embeddings';
import { extractPdfText } from '../../services/extraction/pdf';
import { extractUrlText } from '../../services/extraction/url';
import { deletePdf, uploadPdf } from '../../services/storage/cloudinary';

const EMBED_SUB_BATCH = 100;

/** Create a document from an uploaded PDF and kick off background processing. */
export async function createPdfDocument(
  userId: string,
  file: Express.Multer.File
): Promise<{ id: string; status: string }> {
  const title = file.originalname.replace(/\.[^.]+$/, '');
  const extracted = await extractPdfText(file.buffer);
  const uploaded = await uploadPdf(file.buffer, file.originalname);

  const doc = await prisma.document.create({
    data: {
      userId,
      title,
      sourceType: 'PDF',
      sourceRef: uploaded.url,
      storageKey: uploaded.publicId,
      status: 'PROCESSING',
    },
  });

  void processInBackground(doc.id, extracted.text);
  return { id: doc.id, status: doc.status };
}

/** Create a document from a URL and kick off background processing. */
export async function createUrlDocument(
  userId: string,
  url: string
): Promise<{ id: string; status: string }> {
  const extracted = await extractUrlText(url);

  const doc = await prisma.document.create({
    data: {
      userId,
      title: extracted.title,
      sourceType: 'URL',
      sourceRef: url,
      status: 'PROCESSING',
    },
  });

  void processInBackground(doc.id, extracted.text);
  return { id: doc.id, status: doc.status };
}

/** Extract → chunk → embed → store. Runs detached; updates status on finish. */
async function processInBackground(documentId: string, text: string): Promise<void> {
  try {
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error('No chunks produced from document text');

    for (let i = 0; i < chunks.length; i += EMBED_SUB_BATCH) {
      const slice = chunks.slice(i, i + EMBED_SUB_BATCH);
      const embeddings = await embedBatch(slice.map((c) => c.content));

      for (let j = 0; j < slice.length; j++) {
        const chunk = slice[j]!;
        await insertChunkWithEmbedding({
          id: randomUUID(),
          documentId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          tokenCount: chunk.tokenCount,
          embedding: embeddings[j]!,
        });
      }
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'READY', error: null },
    });
    logger.info('Document processed', { documentId, chunks: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    logger.error('Document processing failed', { documentId, message });
    await prisma.document
      .update({ where: { id: documentId }, data: { status: 'FAILED', error: message } })
      .catch(() => undefined);
  }
}

export async function listDocuments(userId: string) {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      sourceType: true,
      sourceRef: true,
      status: true,
      error: true,
      createdAt: true,
    },
  });
}

export async function getDocument(userId: string, id: string) {
  const doc = await prisma.document.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      sourceType: true,
      sourceRef: true,
      status: true,
      error: true,
      createdAt: true,
      _count: { select: { chunks: true } },
    },
  });
  if (!doc) throw AppError.notFound('Document not found');
  return doc;
}

export async function deleteDocument(userId: string, id: string): Promise<void> {
  const doc = await prisma.document.findFirst({
    where: { id, userId },
    select: { id: true, sourceType: true, storageKey: true },
  });
  if (!doc) throw AppError.notFound('Document not found');

  // Remove the stored PDF from Cloudinary first; don't block deletion if it fails.
  if (doc.sourceType === 'PDF' && doc.storageKey) {
    try {
      await deletePdf(doc.storageKey);
    } catch (err) {
      logger.warn('Failed to delete Cloudinary asset', {
        documentId: id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Cascades to chunks (and any citations referencing them).
  await prisma.document.delete({ where: { id: doc.id } });
}

/** Verify the user owns all given documents and they are READY. */
export async function assertDocumentsReady(userId: string, documentIds: string[]): Promise<void> {
  const docs = await prisma.document.findMany({
    where: { id: { in: documentIds }, userId },
    select: { id: true, status: true },
  });
  if (docs.length !== documentIds.length) {
    throw AppError.badRequest('One or more documents were not found');
  }
  if (docs.some((d) => d.status !== 'READY')) {
    throw AppError.badRequest('One or more documents are still processing or failed');
  }
}
