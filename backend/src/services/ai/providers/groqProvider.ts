import Groq from 'groq-sdk';
import { env } from '../../../config/env';
import { GROQ_MODEL } from '../../../config/constants';
import type {
  ToolCallingProvider,
  ToolSpec,
  TurnMessage,
  TurnResult,
  ToolCall,
} from './types';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

/** Convert neutral messages into Groq (OpenAI-compatible) chat messages. */
export function toGroqMessages(system: string, messages: TurnMessage[]): unknown[] {
  const out: unknown[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      out.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      });
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

function toGroqTools(tools: ToolSpec[]): unknown[] {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const groqProvider: ToolCallingProvider = {
  model: 'groq',
  async runTurn(messages, tools, system): Promise<TurnResult> {
    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: toGroqMessages(system, messages) as never,
      tools: toGroqTools(tools) as never,
      tool_choice: 'auto',
    });

    const choice = res.choices[0]?.message;
    const toolCalls: ToolCall[] = (choice?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      args: safeParse(tc.function.arguments),
    }));

    return {
      toolCalls,
      text: choice?.content ?? '',
      usage: {
        promptTokens: res.usage?.prompt_tokens ?? 0,
        completionTokens: res.usage?.completion_tokens ?? 0,
      },
    };
  },
};
