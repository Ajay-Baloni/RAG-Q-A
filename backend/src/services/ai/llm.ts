import { logger } from '../../utils/logger';
import * as gemini from './gemini';
import * as groq from './groq';
import type { LlmUsage } from './gemini';

export type LlmModel = 'gemini' | 'groq';

export interface LlmToken {
  text: string;
  model: LlmModel;
}

export interface LlmStreamResult {
  model: LlmModel;
  usage: LlmUsage;
}

/**
 * Stream an answer from Gemini, falling back to Groq if Gemini is rate limited
 * (HTTP 429) *before* it has emitted any tokens. If Gemini fails mid-stream we
 * surface the error rather than producing a spliced answer. The generator's
 * return value carries the model that produced the answer and its token usage.
 */
export async function* streamWithFallback(
  prompt: string
): AsyncGenerator<LlmToken, LlmStreamResult> {
  let emitted = 0;
  try {
    const gen = gemini.streamAnswer(prompt);
    let res = await gen.next();
    while (!res.done) {
      emitted += 1;
      yield { text: res.value, model: 'gemini' };
      res = await gen.next();
    }
    return { model: 'gemini', usage: res.value };
  } catch (err) {
    if (!(err instanceof gemini.RateLimitError) || emitted > 0) throw err;
    logger.warn('Gemini rate limited — falling back to Groq');
  }

  const gen = groq.streamAnswer(prompt);
  let res = await gen.next();
  while (!res.done) {
    yield { text: res.value, model: 'groq' };
    res = await gen.next();
  }
  return { model: 'groq', usage: res.value };
}
