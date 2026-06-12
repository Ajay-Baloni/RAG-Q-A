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

/** Stream an answer token-by-token. Throws RateLimitError on 429. */
export async function* streamAnswer(userPrompt: string): AsyncGenerator<string> {
  let stream: AsyncIterable<{ text: () => string }>;
  try {
    const result = await model.generateContentStream(userPrompt);
    stream = result.stream;
  } catch (err) {
    if (isRateLimit(err)) throw new RateLimitError('Gemini rate limited');
    throw err;
  }

  try {
    for await (const chunk of stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (err) {
    if (isRateLimit(err)) throw new RateLimitError('Gemini rate limited');
    throw err;
  }
}
