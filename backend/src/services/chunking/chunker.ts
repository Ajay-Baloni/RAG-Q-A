import {
  CHARS_PER_TOKEN,
  CHUNK_OVERLAP_TOKENS,
  CHUNK_SIZE_TOKENS,
} from '../../config/constants';

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

/** Rough token estimate from character count (~4 chars/token for English). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

/**
 * Split text into ~CHUNK_SIZE_TOKENS chunks with ~CHUNK_OVERLAP_TOKENS overlap.
 * Splits on word boundaries so we never cut mid-word. Token counts are
 * estimated from characters (no tokenizer dependency).
 */
export function chunkText(input: string): TextChunk[] {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const maxChars = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN;

  const words = text.split(' ');
  const chunks: TextChunk[] = [];

  let current: string[] = [];
  let currentLen = 0;
  let chunkIndex = 0;

  const flush = () => {
    if (current.length === 0) return;
    const content = current.join(' ');
    chunks.push({ content, chunkIndex, tokenCount: estimateTokens(content) });
    chunkIndex += 1;
  };

  for (const word of words) {
    // +1 accounts for the joining space.
    if (currentLen + word.length + 1 > maxChars && current.length > 0) {
      flush();
      // Start the next chunk with a tail-overlap of the previous chunk.
      const overlapWords: string[] = [];
      let overlapLen = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const w = current[i]!;
        if (overlapLen + w.length + 1 > overlapChars) break;
        overlapWords.unshift(w);
        overlapLen += w.length + 1;
      }
      current = overlapWords;
      currentLen = overlapLen;
    }
    current.push(word);
    currentLen += word.length + 1;
  }
  flush();

  return chunks;
}
