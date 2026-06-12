import { prisma } from './prisma';
import { TOP_K } from '../config/constants';

/** A pgvector literal: "[0.1,0.2,...]". */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
}

/**
 * Cosine similarity search over chunk embeddings, scoped to the given documents.
 * This is the one query Prisma can't express, so it uses raw SQL with the
 * pgvector `<=>` (cosine distance) operator. `similarity = 1 - distance`.
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  documentIds: string[],
  topK: number = TOP_K
): Promise<RetrievedChunk[]> {
  if (documentIds.length === 0) return [];

  const vector = toVectorLiteral(queryEmbedding);

  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      "id",
      "documentId",
      "content",
      "chunkIndex",
      1 - ("embedding" <=> ${vector}::vector) AS "similarity"
    FROM "Chunk"
    WHERE "documentId" = ANY(${documentIds}::text[])
      AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${vector}::vector
    LIMIT ${topK};
  `;

  return rows;
}

/**
 * Insert a chunk row including its embedding. Embeddings must be written with
 * raw SQL because the column is a pgvector type Prisma treats as Unsupported.
 */
export async function insertChunkWithEmbedding(params: {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  embedding: number[];
}): Promise<void> {
  const vector = toVectorLiteral(params.embedding);
  await prisma.$executeRaw`
    INSERT INTO "Chunk" ("id", "documentId", "content", "chunkIndex", "tokenCount", "embedding")
    VALUES (
      ${params.id},
      ${params.documentId},
      ${params.content},
      ${params.chunkIndex},
      ${params.tokenCount},
      ${vector}::vector
    );
  `;
}
