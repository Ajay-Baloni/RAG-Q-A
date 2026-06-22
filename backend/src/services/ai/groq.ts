import Groq from 'groq-sdk';
import { env } from '../../config/env';
import { GROQ_MODEL } from '../../config/constants';
import { SYSTEM_PROMPT } from './prompt';
import type { LlmUsage } from './gemini';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

/**
 * Stream a fallback answer from Groq/Llama3 token-by-token, returning token
 * usage when the stream ends (`include_usage` puts it on the final chunk).
 */
export async function* streamAnswer(
  userPrompt: string
): AsyncGenerator<string, LlmUsage> {
  // `stream_options` enables a final usage chunk; the installed groq-sdk types
  // lag behind the API, so the params and chunk usage are accessed via casts.
  const stream = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
    stream_options: { include_usage: true },
  } as never);

  let usage: LlmUsage = { promptTokens: 0, completionTokens: 0 };
  for await (const chunk of stream as unknown as AsyncIterable<{
    choices: { delta?: { content?: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  }>) {
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
      };
    }
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) yield text;
  }
  return usage;
}
