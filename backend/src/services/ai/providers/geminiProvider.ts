import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { env } from '../../../config/env';
import { GEMINI_MODEL } from '../../../config/constants';
import { RateLimitError, isRateLimit } from '../gemini';
import type {
  ToolCallingProvider,
  TurnMessage,
  TurnResult,
  ToolCall,
} from './types';

export { RateLimitError } from '../gemini';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

/** Convert neutral messages into Gemini `Content[]`. */
export function toGeminiContents(messages: TurnMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'model',
        parts: m.toolCalls.map((tc) => ({
          functionCall: { name: tc.name, args: tc.args },
        })),
      };
    }
    if (m.role === 'tool') {
      return {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: m.toolName ?? '',
              response: { result: m.content },
            },
          },
        ],
      };
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    };
  });
}

export const geminiProvider: ToolCallingProvider = {
  model: 'gemini',
  async runTurn(messages, tools, system): Promise<TurnResult> {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: system,
      tools: [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters as never,
          })),
        },
      ],
    });

    try {
      const result = await model.generateContent({
        contents: toGeminiContents(messages) as Content[],
      });
      const response = result.response;
      const calls = response.functionCalls() ?? [];
      const toolCalls: ToolCall[] = calls.map((c, i) => ({
        id: `gem-${i}-${c.name}`,
        name: c.name,
        args: (c.args ?? {}) as Record<string, unknown>,
      }));
      const usage = response.usageMetadata;
      return {
        toolCalls,
        text: toolCalls.length ? '' : response.text(),
        usage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
        },
      };
    } catch (err) {
      if (isRateLimit(err)) throw new RateLimitError('Gemini rate limited');
      throw err;
    }
  },
};
