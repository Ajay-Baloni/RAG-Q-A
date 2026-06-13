/**
 * Embedding model + dimensionality. gemini-embedding-001 defaults to 3072 dims;
 * we request 768 (`outputDimensionality`) to match the `vector(768)` DB column.
 */
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

/** LLMs. */
export const GEMINI_MODEL = "gemini-2.0-flash";
export const GROQ_MODEL = "llama-3.1-8b-instant";

/** Chunking: ~500 token chunks with ~50 token overlap. */
export const CHUNK_SIZE_TOKENS = 500;
export const CHUNK_OVERLAP_TOKENS = 50;
/** Rough heuristic: ~4 characters per token for English text. */
export const CHARS_PER_TOKEN = 4;

/** Retrieval: top-K most similar chunks per query. */
export const TOP_K = 5;

/** Conversation context: how many prior messages to include with each query. */
export const HISTORY_MESSAGE_LIMIT = 6;

/** Upload limits (keep within free-tier + request-time budgets). */
export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
