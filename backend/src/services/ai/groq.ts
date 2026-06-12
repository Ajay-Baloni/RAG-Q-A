import Groq from 'groq-sdk';
import { env } from '../../config/env';
import { GROQ_MODEL } from '../../config/constants';
import { SYSTEM_PROMPT } from './prompt';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

/** Stream a fallback answer from Groq/Llama3 token-by-token. */
export async function* streamAnswer(userPrompt: string): AsyncGenerator<string> {
  const stream = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) yield text;
  }
}
