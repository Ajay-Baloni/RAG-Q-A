import type { LlmModel } from '../llm';

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

export interface TurnMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  /** Set on assistant turns that requested tools. */
  toolCalls?: ToolCall[];
  /** Set on tool-result turns (role: 'tool'). */
  toolCallId?: string;
  toolName?: string;
}

/** One agent turn: either tool calls to run, or a final text answer. */
export interface TurnResult {
  toolCalls: ToolCall[];
  text: string;
  usage: Usage;
}

export interface ToolCallingProvider {
  model: LlmModel;
  runTurn(
    messages: TurnMessage[],
    tools: ToolSpec[],
    system: string
  ): Promise<TurnResult>;
}
