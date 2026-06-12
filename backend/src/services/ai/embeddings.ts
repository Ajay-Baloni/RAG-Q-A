import { env } from '../../config/env';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '../../config/constants';
import { logger } from '../../utils/logger';

/*
 * Embeddings are called over the REST API directly (not the @google/generative-ai
 * SDK) so we can pass `outputDimensionality` to force 768-dim vectors that match
 * the `vector(768)` DB column. The SDK's types lag behind this API parameter.
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL_PATH = `models/${EMBEDDING_MODEL}`;

interface EmbedValues {
  values: number[];
}

async function callEmbeddingApi<T>(method: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${MODEL_PATH}:${method}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Embedding API ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Embed a single piece of text (e.g. a user question). */
export async function embedText(text: string): Promise<number[]> {
  const data = await callEmbeddingApi<{ embedding: EmbedValues }>('embedContent', {
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMENSIONS,
  });
  return data.embedding.values;
}

/**
 * Embed many chunks in one request to minimise API calls, which matters under
 * the free-tier rate limit (15 req/min).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const data = await callEmbeddingApi<{ embeddings: EmbedValues[] }>('batchEmbedContents', {
    requests: texts.map((text) => ({
      model: MODEL_PATH,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    })),
  });

  logger.debug('Embedded batch', { count: texts.length });
  return data.embeddings.map((e) => e.values);
}
