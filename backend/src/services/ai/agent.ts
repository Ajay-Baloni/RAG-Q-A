import { MAX_AGENT_STEPS } from '../../config/constants';
import type { LlmModel } from './llm';
import type { RetrievedChunk } from '../../db/vectorSearch';
import type { Tool, ToolContext } from './tools/types';
import { geminiProvider, RateLimitError } from './providers/geminiProvider';
import { groqProvider } from './providers/groqProvider';
import type {
  ToolCallingProvider,
  ToolSpec,
  TurnMessage,
  Usage,
} from './providers/types';

export interface AgentStep {
  order: number;
  tool: string;
  input: Record<string, unknown>;
  outputSummary: string;
}

export interface AgentResult {
  answer: string;
  model: LlmModel;
  usage: Usage;
  steps: AgentStep[];
  sources: RetrievedChunk[];
}

export interface AgentCallbacks {
  onStep(step: AgentStep): void;
  onToolResult(order: number, summary: string): void;
  onToken(text: string): void;
}

const AGENT_SYSTEM = `You are a research assistant that answers the user's question using the available tools.

Guidelines:
- Prefer search_documents to ground answers in the user's uploaded documents. Call it (multiple times with refined queries if useful) whenever the question could relate to their documents.
- If a web_search tool is available, use it for current events, general knowledge, or anything the documents do not cover. Do NOT refuse just because the documents lack the answer — use web_search instead when it is available.
- Use calculator for any arithmetic.
- When you have enough information, write a clear, accurate final answer. Cite document excerpts you used with inline [n] markers, and do not invent citations.`;

function toSpecs(tools: Tool[]): ToolSpec[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export async function runAgent(
  question: string,
  history: TurnMessage[],
  tools: Tool[],
  ctx: ToolContext,
  cb: AgentCallbacks,
  providers: ToolCallingProvider[] = [geminiProvider, groqProvider]
): Promise<AgentResult> {
  const specs = toSpecs(tools);
  const byName = new Map(tools.map((t) => [t.name, t]));
  const messages: TurnMessage[] = [...history, { role: 'user', content: question }];

  const steps: AgentStep[] = [];
  const sources: RetrievedChunk[] = [];
  const seenChunkIds = new Set<string>();
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };

  // Try each provider in order; fall back only on a pre-output rate limit.
  let lastErr: unknown;
  for (let p = 0; p < providers.length; p++) {
    const provider = providers[p]!;
    // Reset per-provider accumulators (fallback restarts the loop).
    steps.length = 0;
    sources.length = 0;
    seenChunkIds.clear();
    usage.promptTokens = 0;
    usage.completionTokens = 0;
    messages.length = history.length + 1;

    try {
      for (let i = 0; i < MAX_AGENT_STEPS; i++) {
        const forceFinal = i === MAX_AGENT_STEPS - 1;
        const turn = await provider.runTurn(
          messages,
          forceFinal ? [] : specs,
          AGENT_SYSTEM
        );
        usage.promptTokens += turn.usage.promptTokens;
        usage.completionTokens += turn.usage.completionTokens;

        if (turn.toolCalls.length === 0 || forceFinal) {
          const answer = turn.text || 'I was unable to produce an answer.';
          cb.onToken(answer);
          return { answer, model: provider.model, usage, steps, sources };
        }

        // Record the assistant's tool-call turn in history.
        messages.push({ role: 'assistant', content: '', toolCalls: turn.toolCalls });

        for (const call of turn.toolCalls) {
          const order = steps.length;
          cb.onStep({ order, tool: call.name, input: call.args, outputSummary: '' });

          const tool = byName.get(call.name);
          const result = tool
            ? await tool.execute(call.args, ctx)
            : { summary: `Unknown tool: ${call.name}` };

          if (result.chunks) {
            for (const c of result.chunks) {
              if (!seenChunkIds.has(c.id)) {
                seenChunkIds.add(c.id);
                sources.push(c);
              }
            }
          }

          steps.push({
            order,
            tool: call.name,
            input: call.args,
            outputSummary: result.summary,
          });
          cb.onToolResult(order, result.summary);

          messages.push({
            role: 'tool',
            content: result.summary,
            toolCallId: call.id,
            toolName: call.name,
          });
        }
      }

      // Loop exhausted without returning (forceFinal guards against this).
      return {
        answer: 'I was unable to produce an answer.',
        model: provider.model,
        usage,
        steps,
        sources,
      };
    } catch (err) {
      lastErr = err;
      const canFallback = err instanceof RateLimitError && p < providers.length - 1;
      if (!canFallback) throw err;
      // else: continue to next provider
    }
  }

  throw lastErr ?? new Error('Agent failed');
}
