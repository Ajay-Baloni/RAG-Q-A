import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env';
import { GEMINI_MODEL } from '../../config/constants';
import { SYSTEM_PROMPT } from './prompt';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  systemInstruction: SYSTEM_PROMPT,
});

/** Error raised when Gemini is rate limited (HTTP 429). Triggers fallback. */
export class RateLimitError extends Error {}

export function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('429') || /rate limit|quota|resource[_ ]exhausted/i.test(msg);
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * Stream an answer token-by-token, returning token usage when the stream ends.
 * Throws RateLimitError on 429.
 */
export async function* streamAnswer(
  userPrompt: string
): AsyncGenerator<string, LlmUsage> {
  let result: Awaited<ReturnType<typeof model.generateContentStream>>;
  try {
    result = await model.generateContentStream(userPrompt);
  } catch (err) {
    if (isRateLimit(err)) throw new RateLimitError('Gemini rate limited');
    throw err;
  }

  try {
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (err) {
    if (isRateLimit(err)) throw new RateLimitError('Gemini rate limited');
    throw err;
  }

  const usage = (await result.response).usageMetadata;
  return {
    promptTokens: usage?.promptTokenCount ?? 0,
    completionTokens: usage?.candidatesTokenCount ?? 0,
  };
}
