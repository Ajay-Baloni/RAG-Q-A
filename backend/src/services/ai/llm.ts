import { logger } from '../../utils/logger';
import * as gemini from './gemini';
import * as groq from './groq';

export type LlmModel = 'gemini' | 'groq';

export interface LlmToken {
  text: string;
  model: LlmModel;
}

/**
 * Stream an answer from Gemini, falling back to Groq if Gemini is rate limited
 * (HTTP 429) *before* it has emitted any tokens. If Gemini fails mid-stream we
 * surface the error rather than producing a spliced answer.
 */
export async function* streamWithFallback(prompt: string): AsyncGenerator<LlmToken> {
  let emitted = 0;
  try {
    for await (const text of gemini.streamAnswer(prompt)) {
      emitted += 1;
      yield { text, model: 'gemini' };
    }
    return;
  } catch (err) {
    if (!(err instanceof gemini.RateLimitError) || emitted > 0) throw err;
    logger.warn('Gemini rate limited — falling back to Groq');
  }

  for await (const text of groq.streamAnswer(prompt)) {
    yield { text, model: 'groq' };
  }
}
