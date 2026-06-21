# Observable Agentic RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-shot RAG chat into an agentic system where the LLM autonomously calls tools (multi-step document search, web search, calculator), streams its reasoning steps, and reports token usage and estimated cost per message and per account.

**Architecture:** A provider-agnostic agent loop (`runAgent`) drives Gemini (Groq fallback) through up to 5 tool-calling turns. Tools are self-contained units behind a uniform `Tool` interface. Token usage is summed across turns; the reasoning trace is persisted as `MessageStep` rows and streamed live over the existing SSE channel.

**Tech Stack:** Node + Express + TypeScript (ESM/nodenext), Prisma + pgvector, `@google/generative-ai`, `groq-sdk`, Tavily REST API, Vitest (new), React + Vite frontend.

## Global Constraints

- TypeScript ESM with `module: nodenext`, `strict: true`, `noUncheckedIndexedAccess: true` — code must satisfy `npm run typecheck`.
- Existing model IDs: `GEMINI_MODEL = "gemini-2.0-flash"`, `GROQ_MODEL = "llama-3.1-8b-instant"`.
- Preserve the current fallback guarantee: fall back Gemini→Groq only if Gemini fails (429) **before** emitting output.
- `MAX_AGENT_STEPS = 5`.
- New env var `TAVILY_API_KEY` is **optional**; when unset, `web_search` degrades gracefully (it must not crash the app).
- Cost is **derived, never stored** — only token counts are persisted.
- All Prisma schema changes are additive and nullable; no data backfill.
- Run backend commands from `backend/`; frontend commands from `frontend/`.

---

## File Structure

**Backend — create:**
- `backend/vitest.config.ts` — test runner config.
- `backend/src/services/ai/tools/types.ts` — `Tool`, `ToolContext`, `ToolResult`.
- `backend/src/services/ai/tools/calculator.ts` — calculator tool.
- `backend/src/services/ai/tools/searchDocuments.ts` — document search tool.
- `backend/src/services/ai/tools/webSearch.ts` — Tavily web search tool.
- `backend/src/services/ai/tools/index.ts` — tool registry.
- `backend/src/services/ai/providers/types.ts` — provider abstraction + neutral message/turn types.
- `backend/src/services/ai/providers/geminiProvider.ts` — Gemini `ToolCallingProvider` + adapter.
- `backend/src/services/ai/providers/groqProvider.ts` — Groq `ToolCallingProvider` + adapter.
- `backend/src/services/ai/agent.ts` — `runAgent` loop.
- `backend/src/services/ai/cost.ts` — `estimateCost`.
- `backend/src/modules/usage/usage.service.ts` — account usage aggregation.
- `backend/src/modules/usage/usage.controller.ts` — `GET /api/usage`.
- `backend/src/modules/usage/usage.routes.ts` — usage router.
- Test files mirror the above under the same folders (`*.test.ts`).

**Backend — modify:**
- `backend/package.json` — add Vitest + test script.
- `backend/src/config/constants.ts` — `MAX_AGENT_STEPS`, `MODEL_PRICING`.
- `backend/src/config/env.ts` — optional `TAVILY_API_KEY`.
- `backend/.env.example` — document `TAVILY_API_KEY`.
- `backend/prisma/schema.prisma` — `Message` token columns + `MessageStep` model.
- `backend/src/modules/chat/chat.service.ts` — drive `runAgent`, persist steps/usage.
- `backend/src/modules/chat/chat.controller.ts` — emit `step`/`tool_result`; `done` carries usage.
- `backend/src/modules/conversations/conversations.service.ts` — select steps + token fields.
- `backend/src/routes.ts` — mount usage router.

**Frontend — create:**
- `frontend/src/api/usage.ts` — usage fetch.
- `frontend/src/components/chat/AgentSteps.tsx` — reasoning trace.

**Frontend — modify:**
- `frontend/src/types/index.ts` — `MessageStep`, `Usage`, message token fields.
- `frontend/src/api/conversations.ts` — `onStep`/`onToolResult`, usage in `onDone`.
- `frontend/src/pages/ChatPage.tsx` — wire new handlers, render steps + token footer.
- `frontend/src/components/chat/MessageBubble.tsx` — token/cost footer (if placed here).
- `frontend/src/pages/AccountPage.tsx` — usage card.

**Docs — modify:** `docs/SETUP.md`, `README.md`.

**Testing strategy:** Backend logic is built test-first with Vitest (pure functions, tools with mocked deps, the agent loop against a fake provider, aggregation). Provider SDK calls are covered via their pure message-adapter functions; the live SDK round-trips are verified manually. Frontend is verified via `npm run typecheck` (`tsc -b`/`tsc --noEmit`) and a manual smoke test — no React test runner is added, to keep scope focused.

---

## Task 1: Test infrastructure (Vitest)

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/services/ai/cost.test.ts` (temporary sanity test, replaced in Task 2)

**Interfaces:**
- Produces: a working `npm test` command in `backend/`.

- [ ] **Step 1: Install Vitest**

Run in `backend/`:
```bash
npm install -D vitest
```

- [ ] **Step 2: Add test script**

In `backend/package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest config**

Create `backend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add a sanity test**

Create `backend/src/services/ai/cost.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/vitest.config.ts backend/src/services/ai/cost.test.ts
git commit -m "test: add vitest test runner"
```

---

## Task 2: Pricing and estimateCost

**Files:**
- Modify: `backend/src/config/constants.ts`
- Create: `backend/src/services/ai/cost.ts`
- Modify: `backend/src/services/ai/cost.test.ts` (replace sanity test)

**Interfaces:**
- Consumes: `LlmModel` from `services/ai/llm.ts` (`'gemini' | 'groq'`).
- Produces: `MODEL_PRICING` (in constants); `estimateCost(model: LlmModel, promptTokens: number, completionTokens: number): number` returning USD.

- [ ] **Step 1: Write the failing test**

Replace contents of `backend/src/services/ai/cost.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { estimateCost } from './cost';

describe('estimateCost', () => {
  it('prices gemini tokens using the per-million rates', () => {
    // gemini: $0.10 / 1M input, $0.40 / 1M output
    const cost = estimateCost('gemini', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.5, 6);
  });

  it('prices groq tokens', () => {
    // groq: $0.05 / 1M input, $0.08 / 1M output
    const cost = estimateCost('groq', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.13, 6);
  });

  it('returns 0 for zero tokens', () => {
    expect(estimateCost('gemini', 0, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cost`
Expected: FAIL (`estimateCost` not found).

- [ ] **Step 3: Add pricing constants**

In `backend/src/config/constants.ts`, append:
```ts
/** Maximum tool-calling turns per agent run. */
export const MAX_AGENT_STEPS = 5;

/**
 * USD price per 1,000,000 tokens. Update if provider pricing changes — cost is
 * recomputed from stored token counts, so history re-prices automatically.
 */
export const MODEL_PRICING = {
  gemini: { inputPerM: 0.1, outputPerM: 0.4 },
  groq: { inputPerM: 0.05, outputPerM: 0.08 },
} as const;
```

- [ ] **Step 4: Implement estimateCost**

Create `backend/src/services/ai/cost.ts`:
```ts
import { MODEL_PRICING } from '../../config/constants';
import type { LlmModel } from './llm';

/** Estimated USD cost for a completion, derived from token counts. */
export function estimateCost(
  model: LlmModel,
  promptTokens: number,
  completionTokens: number
): number {
  const price = MODEL_PRICING[model];
  if (!price) return 0;
  return (
    (promptTokens / 1_000_000) * price.inputPerM +
    (completionTokens / 1_000_000) * price.outputPerM
  );
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- cost`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/constants.ts backend/src/services/ai/cost.ts backend/src/services/ai/cost.test.ts
git commit -m "feat: add model pricing and estimateCost"
```

---

## Task 3: Tool types and calculator tool

**Files:**
- Create: `backend/src/services/ai/tools/types.ts`
- Create: `backend/src/services/ai/tools/calculator.ts`
- Create: `backend/src/services/ai/tools/calculator.test.ts`

**Interfaces:**
- Consumes: `RetrievedChunk` from `db/vectorSearch.ts`.
- Produces:
  - `ToolContext { userId: string; documentIds: string[] }`
  - `ToolResult { summary: string; chunks?: RetrievedChunk[] }`
  - `Tool { name: string; description: string; parameters: Record<string, unknown>; execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> }`
  - `calculatorTool: Tool`

- [ ] **Step 1: Create the tool types**

Create `backend/src/services/ai/tools/types.ts`:
```ts
import type { RetrievedChunk } from '../../../db/vectorSearch';

export interface ToolContext {
  userId: string;
  documentIds: string[];
}

export interface ToolResult {
  /** Short human-readable result, shown in the UI trace and fed back to the model. */
  summary: string;
  /** Only set by search_documents — retrieved chunks for citation accumulation. */
  chunks?: RetrievedChunk[];
}

export interface Tool {
  name: string;
  description: string;
  /** JSON Schema object describing the tool's arguments. */
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/services/ai/tools/calculator.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { calculatorTool } from './calculator';

const ctx = { userId: 'u1', documentIds: [] };

describe('calculatorTool', () => {
  it('evaluates a basic expression', async () => {
    const res = await calculatorTool.execute({ expression: '2 + 2 * 3' }, ctx);
    expect(res.summary).toBe('2 + 2 * 3 = 8');
  });

  it('handles decimals and parentheses', async () => {
    const res = await calculatorTool.execute({ expression: '(100 + 8) * 1.5' }, ctx);
    expect(res.summary).toBe('(100 + 8) * 1.5 = 162');
  });

  it('rejects non-math input safely', async () => {
    const res = await calculatorTool.execute({ expression: 'process.exit(1)' }, ctx);
    expect(res.summary).toMatch(/invalid/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- calculator`
Expected: FAIL (`calculatorTool` not found).

- [ ] **Step 4: Implement the calculator**

Create `backend/src/services/ai/tools/calculator.ts`:
```ts
import type { Tool } from './types';

// Only allow digits, whitespace, decimal points, and basic arithmetic operators.
const SAFE_EXPRESSION = /^[0-9+\-*/().%\s]+$/;

export const calculatorTool: Tool = {
  name: 'calculator',
  description:
    'Evaluate a basic arithmetic expression (e.g. "1234 * 0.08"). Use for any math; do not compute it yourself.',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Arithmetic expression to evaluate' },
    },
    required: ['expression'],
  },
  async execute(args) {
    const expression = String(args.expression ?? '').trim();
    if (!expression || !SAFE_EXPRESSION.test(expression)) {
      return { summary: `Invalid expression: "${expression}"` };
    }
    try {
      // Safe: input is restricted to math characters by SAFE_EXPRESSION above.
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expression});`)() as number;
      if (typeof result !== 'number' || !Number.isFinite(result)) {
        return { summary: `Invalid expression: "${expression}"` };
      }
      return { summary: `${expression} = ${result}` };
    } catch {
      return { summary: `Invalid expression: "${expression}"` };
    }
  },
};
```

- [ ] **Step 5: Run tests**

Run: `npm test -- calculator`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/ai/tools/types.ts backend/src/services/ai/tools/calculator.ts backend/src/services/ai/tools/calculator.test.ts
git commit -m "feat: add tool interface and calculator tool"
```

---

## Task 4: search_documents tool

**Files:**
- Create: `backend/src/services/ai/tools/searchDocuments.ts`
- Create: `backend/src/services/ai/tools/searchDocuments.test.ts`

**Interfaces:**
- Consumes: `embedText` (`services/ai/embeddings.ts`), `searchSimilarChunks` (`db/vectorSearch.ts`), `Tool`/`ToolContext`.
- Produces: `searchDocumentsTool: Tool` — returns `chunks` in its `ToolResult`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/services/ai/tools/searchDocuments.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../embeddings', () => ({ embedText: vi.fn() }));
vi.mock('../../../db/vectorSearch', () => ({ searchSimilarChunks: vi.fn() }));

import { embedText } from '../embeddings';
import { searchSimilarChunks } from '../../../db/vectorSearch';
import { searchDocumentsTool } from './searchDocuments';

const ctx = { userId: 'u1', documentIds: ['d1', 'd2'] };

describe('searchDocumentsTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('embeds the query and searches within the conversation documents', async () => {
    (embedText as ReturnType<typeof vi.fn>).mockResolvedValue([0.1, 0.2]);
    (searchSimilarChunks as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', documentId: 'd1', content: 'hello', chunkIndex: 0, similarity: 0.9 },
    ]);

    const res = await searchDocumentsTool.execute({ query: 'greeting' }, ctx);

    expect(embedText).toHaveBeenCalledWith('greeting');
    expect(searchSimilarChunks).toHaveBeenCalledWith([0.1, 0.2], ['d1', 'd2']);
    expect(res.chunks).toHaveLength(1);
    expect(res.summary).toMatch(/1 relevant/i);
  });

  it('reports when nothing is found', async () => {
    (embedText as ReturnType<typeof vi.fn>).mockResolvedValue([0.1]);
    (searchSimilarChunks as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = await searchDocumentsTool.execute({ query: 'x' }, ctx);
    expect(res.chunks).toEqual([]);
    expect(res.summary).toMatch(/no relevant/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- searchDocuments`
Expected: FAIL (`searchDocumentsTool` not found).

- [ ] **Step 3: Implement the tool**

Create `backend/src/services/ai/tools/searchDocuments.ts`:
```ts
import type { Tool } from './types';
import { embedText } from '../embeddings';
import { searchSimilarChunks } from '../../../db/vectorSearch';

export const searchDocumentsTool: Tool = {
  name: 'search_documents',
  description:
    "Search the user's uploaded documents for passages relevant to a query. " +
    'Returns the most relevant excerpts. Call multiple times with refined queries to gather more information.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural-language search query' },
    },
    required: ['query'],
  },
  async execute(args, ctx) {
    const query = String(args.query ?? '').trim();
    const embedding = await embedText(query);
    const chunks = await searchSimilarChunks(embedding, ctx.documentIds);
    const summary = chunks.length
      ? `Found ${chunks.length} relevant excerpt(s) for "${query}".`
      : `No relevant excerpts found for "${query}".`;
    return { summary, chunks };
  },
};
```

- [ ] **Step 4: Run tests**

Run: `npm test -- searchDocuments`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/ai/tools/searchDocuments.ts backend/src/services/ai/tools/searchDocuments.test.ts
git commit -m "feat: add search_documents tool"
```

---

## Task 5: web_search tool (Tavily) + env

**Files:**
- Modify: `backend/src/config/env.ts`
- Modify: `backend/.env.example`
- Create: `backend/src/services/ai/tools/webSearch.ts`
- Create: `backend/src/services/ai/tools/webSearch.test.ts`

**Interfaces:**
- Consumes: `env.TAVILY_API_KEY` (optional), `Tool`.
- Produces: `webSearchTool: Tool`.

- [ ] **Step 1: Add the optional env var**

In `backend/src/config/env.ts`, inside `envSchema`, after the `GROQ_API_KEY` line add:
```ts
  // Web search (agentic tool). Optional: if unset, the web_search tool is a no-op.
  TAVILY_API_KEY: z.string().optional(),
```

In `backend/.env.example` add a line:
```
TAVILY_API_KEY=
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/services/ai/tools/webSearch.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/env', () => ({ env: { TAVILY_API_KEY: 'test-key' } }));

import { webSearchTool } from './webSearch';

const ctx = { userId: 'u1', documentIds: [] };

describe('webSearchTool', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('summarizes Tavily results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          answer: 'Paris is the capital of France.',
          results: [
            { title: 'France', url: 'https://x.com', content: 'France details ...' },
          ],
        }),
      })
    );

    const res = await webSearchTool.execute({ query: 'capital of France' }, ctx);
    expect(res.summary).toMatch(/Paris is the capital/);
    expect(res.summary).toMatch(/https:\/\/x\.com/);
  });

  it('degrades gracefully on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const res = await webSearchTool.execute({ query: 'x' }, ctx);
    expect(res.summary).toMatch(/failed/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- webSearch`
Expected: FAIL (`webSearchTool` not found).

- [ ] **Step 4: Implement the tool**

Create `backend/src/services/ai/tools/webSearch.ts`:
```ts
import type { Tool } from './types';
import { env } from '../../../config/env';

interface TavilyResponse {
  answer?: string;
  results?: { title: string; url: string; content: string }[];
}

export const webSearchTool: Tool = {
  name: 'web_search',
  description:
    "Search the public web for current information NOT found in the user's documents. " +
    'Use only when the documents do not contain the answer.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Web search query' },
    },
    required: ['query'],
  },
  async execute(args) {
    const query = String(args.query ?? '').trim();
    if (!env.TAVILY_API_KEY) return { summary: 'Web search is not configured.' };

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: env.TAVILY_API_KEY,
          query,
          max_results: 3,
          include_answer: true,
        }),
      });
      if (!res.ok) return { summary: `Web search failed (HTTP ${res.status}).` };

      const data = (await res.json()) as TavilyResponse;
      const lines = (data.results ?? [])
        .map((r) => `- ${r.title} (${r.url}): ${r.content.slice(0, 200)}`)
        .join('\n');
      const answer = data.answer ? `${data.answer}\n` : '';
      return {
        summary: `Web results for "${query}":\n${answer}${lines || 'No results.'}`,
      };
    } catch {
      return { summary: 'Web search failed (network error).' };
    }
  },
};
```

- [ ] **Step 5: Run tests**

Run: `npm test -- webSearch`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/env.ts backend/.env.example backend/src/services/ai/tools/webSearch.ts backend/src/services/ai/tools/webSearch.test.ts
git commit -m "feat: add web_search tool via Tavily"
```

---

## Task 6: Tool registry

**Files:**
- Create: `backend/src/services/ai/tools/index.ts`
- Create: `backend/src/services/ai/tools/index.test.ts`

**Interfaces:**
- Produces: `TOOLS: Tool[]`, `getTool(name: string): Tool | undefined`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/services/ai/tools/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { TOOLS, getTool } from './index';

describe('tool registry', () => {
  it('registers the three tools', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      'calculator',
      'search_documents',
      'web_search',
    ]);
  });

  it('looks up a tool by name', () => {
    expect(getTool('calculator')?.name).toBe('calculator');
    expect(getTool('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tools/index`
Expected: FAIL (`TOOLS` not found).

- [ ] **Step 3: Implement the registry**

Create `backend/src/services/ai/tools/index.ts`:
```ts
import type { Tool } from './types';
import { searchDocumentsTool } from './searchDocuments';
import { webSearchTool } from './webSearch';
import { calculatorTool } from './calculator';

export type { Tool, ToolContext, ToolResult } from './types';

export const TOOLS: Tool[] = [searchDocumentsTool, webSearchTool, calculatorTool];

export function getTool(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tools/index`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/ai/tools/index.ts backend/src/services/ai/tools/index.test.ts
git commit -m "feat: add tool registry"
```

---

## Task 7: Provider abstraction types

**Files:**
- Create: `backend/src/services/ai/providers/types.ts`

**Interfaces:**
- Consumes: `LlmModel` from `services/ai/llm.ts`.
- Produces:
  - `ToolSpec { name; description; parameters: Record<string, unknown> }`
  - `ToolCall { id: string; name: string; args: Record<string, unknown> }`
  - `Usage { promptTokens: number; completionTokens: number }`
  - `TurnMessage { role: 'user' | 'assistant' | 'tool'; content: string; toolCalls?: ToolCall[]; toolCallId?: string; toolName?: string }`
  - `TurnResult { toolCalls: ToolCall[]; text: string; usage: Usage }`
  - `ToolCallingProvider { model: LlmModel; runTurn(messages: TurnMessage[], tools: ToolSpec[], system: string): Promise<TurnResult> }`

- [ ] **Step 1: Create the types (no test — type-only module)**

Create `backend/src/services/ai/providers/types.ts`:
```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/ai/providers/types.ts
git commit -m "feat: add tool-calling provider types"
```

---

## Task 8: Groq provider (adapter + runTurn)

**Files:**
- Create: `backend/src/services/ai/providers/groqProvider.ts`
- Create: `backend/src/services/ai/providers/groqProvider.test.ts`

**Interfaces:**
- Consumes: `groq-sdk`, `GROQ_MODEL`, `TurnMessage`/`ToolSpec`/`TurnResult`/`ToolCall`.
- Produces:
  - `toGroqMessages(system: string, messages: TurnMessage[]): unknown[]` (exported, pure, tested)
  - `groqProvider: ToolCallingProvider`

- [ ] **Step 1: Write the failing test for the adapter**

Create `backend/src/services/ai/providers/groqProvider.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toGroqMessages } from './groqProvider';

describe('toGroqMessages', () => {
  it('maps system, user, assistant tool-call, and tool-result messages', () => {
    const out = toGroqMessages('SYS', [
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 't1', name: 'calculator', args: { expression: '2+2' } }],
      },
      { role: 'tool', content: '2+2 = 4', toolCallId: 't1', toolName: 'calculator' },
    ]) as any[];

    expect(out[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(out[1]).toEqual({ role: 'user', content: 'hi' });
    expect(out[2].role).toBe('assistant');
    expect(out[2].tool_calls[0]).toMatchObject({
      id: 't1',
      type: 'function',
      function: { name: 'calculator', arguments: '{"expression":"2+2"}' },
    });
    expect(out[3]).toEqual({ role: 'tool', tool_call_id: 't1', content: '2+2 = 4' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- groqProvider`
Expected: FAIL (`toGroqMessages` not found).

- [ ] **Step 3: Implement the provider**

Create `backend/src/services/ai/providers/groqProvider.ts`:
```ts
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

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- groqProvider`
Expected: PASS (1 test).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/ai/providers/groqProvider.ts backend/src/services/ai/providers/groqProvider.test.ts
git commit -m "feat: add Groq tool-calling provider"
```

---

## Task 9: Gemini provider (adapter + runTurn)

**Files:**
- Create: `backend/src/services/ai/providers/geminiProvider.ts`
- Create: `backend/src/services/ai/providers/geminiProvider.test.ts`

**Interfaces:**
- Consumes: `@google/generative-ai`, `GEMINI_MODEL`, `RateLimitError`/`isRateLimit` from `../gemini`, neutral types.
- Produces:
  - `toGeminiContents(messages: TurnMessage[]): unknown[]` (exported, pure, tested)
  - `geminiProvider: ToolCallingProvider`
  - Re-export `RateLimitError` for the agent to detect fallback.

- [ ] **Step 1: Write the failing test for the adapter**

Create `backend/src/services/ai/providers/geminiProvider.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toGeminiContents } from './geminiProvider';

describe('toGeminiContents', () => {
  it('maps user, assistant functionCall, and tool functionResponse', () => {
    const out = toGeminiContents([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 't1', name: 'calculator', args: { expression: '2+2' } }],
      },
      { role: 'tool', content: '2+2 = 4', toolCallId: 't1', toolName: 'calculator' },
    ]) as any[];

    expect(out[0]).toEqual({ role: 'user', parts: [{ text: 'hi' }] });
    expect(out[1].role).toBe('model');
    expect(out[1].parts[0].functionCall).toMatchObject({
      name: 'calculator',
      args: { expression: '2+2' },
    });
    expect(out[2].role).toBe('user');
    expect(out[2].parts[0].functionResponse).toMatchObject({
      name: 'calculator',
      response: { result: '2+2 = 4' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- geminiProvider`
Expected: FAIL (`toGeminiContents` not found).

- [ ] **Step 3: Implement the provider**

Create `backend/src/services/ai/providers/geminiProvider.ts`:
```ts
import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { env } from '../../../config/env';
import { GEMINI_MODEL } from '../../../config/constants';
import { RateLimitError, isRateLimit } from '../gemini';
import type {
  ToolCallingProvider,
  ToolSpec,
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
    return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- geminiProvider`
Expected: PASS (1 test).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If `functionCalls()`/`functionResponse` typings complain, the `as never`/`as Content[]` casts above contain it; do not loosen tsconfig.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/ai/providers/geminiProvider.ts backend/src/services/ai/providers/geminiProvider.test.ts
git commit -m "feat: add Gemini tool-calling provider"
```

---

## Task 10: Agent loop

**Files:**
- Create: `backend/src/services/ai/agent.ts`
- Create: `backend/src/services/ai/agent.test.ts`

**Interfaces:**
- Consumes: `ToolCallingProvider`/`TurnMessage`/`ToolSpec`/`Usage` (providers/types), `Tool`/`ToolContext` (tools), `RetrievedChunk`, `geminiProvider`/`groqProvider`/`RateLimitError`, `MAX_AGENT_STEPS`.
- Produces:
  - `AgentStep { order: number; tool: string; input: Record<string, unknown>; outputSummary: string }`
  - `AgentResult { answer: string; model: LlmModel; usage: Usage; steps: AgentStep[]; sources: RetrievedChunk[] }`
  - `AgentCallbacks { onStep(step: AgentStep): void; onToolResult(order: number, summary: string): void; onToken(text: string): void }`
  - `runAgent(question: string, history: TurnMessage[], tools: Tool[], ctx: ToolContext, cb: AgentCallbacks, providers?: ToolCallingProvider[]): Promise<AgentResult>`

- [ ] **Step 1: Write the failing test (fake provider)**

Create `backend/src/services/ai/agent.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { runAgent, type AgentCallbacks } from './agent';
import type { ToolCallingProvider, TurnResult } from './providers/types';
import type { Tool } from './tools/types';

const calc: Tool = {
  name: 'calculator',
  description: 'calc',
  parameters: {},
  execute: vi.fn(async (args) => ({ summary: `= ${(args as any).expression}` })),
};

function provider(script: TurnResult[]): ToolCallingProvider {
  let i = 0;
  return { model: 'gemini', runTurn: vi.fn(async () => script[i++]!) };
}

function noopCb(): AgentCallbacks {
  return { onStep: vi.fn(), onToolResult: vi.fn(), onToken: vi.fn() };
}

const ctx = { userId: 'u1', documentIds: ['d1'] };

describe('runAgent', () => {
  it('runs a tool then returns the final answer with summed usage', async () => {
    const p = provider([
      {
        toolCalls: [{ id: 't1', name: 'calculator', args: { expression: '2+2' } }],
        text: '',
        usage: { promptTokens: 10, completionTokens: 5 },
      },
      { toolCalls: [], text: 'The answer is 4.', usage: { promptTokens: 20, completionTokens: 8 } },
    ]);
    const cb = noopCb();
    const res = await runAgent('what is 2+2', [], [calc], ctx, cb, [p]);

    expect(res.answer).toBe('The answer is 4.');
    expect(res.usage).toEqual({ promptTokens: 30, completionTokens: 13 });
    expect(res.steps).toHaveLength(1);
    expect(res.steps[0]).toMatchObject({ tool: 'calculator', order: 0 });
    expect(cb.onStep).toHaveBeenCalledTimes(1);
    expect(cb.onToken).toHaveBeenCalledWith('The answer is 4.');
  });

  it('stops after MAX_AGENT_STEPS and forces a final answer', async () => {
    // Always asks for a tool; loop must terminate.
    const always: ToolCallingProvider = {
      model: 'gemini',
      runTurn: vi.fn(async () => ({
        toolCalls: [{ id: 't', name: 'calculator', args: { expression: '1+1' } }],
        text: '',
        usage: { promptTokens: 1, completionTokens: 1 },
      })),
    };
    const res = await runAgent('loop', [], [calc], ctx, noopCb(), [always]);
    expect(res.steps.length).toBeLessThanOrEqual(5);
    expect(typeof res.answer).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- agent`
Expected: FAIL (`runAgent` not found).

- [ ] **Step 3: Implement the agent loop**

Create `backend/src/services/ai/agent.ts`:
```ts
import { MAX_AGENT_STEPS } from '../../config/constants';
import type { LlmModel } from './llm';
import type { RetrievedChunk } from '../../db/vectorSearch';
import type { Tool, ToolContext } from './tools/types';
import { SYSTEM_PROMPT } from './prompt';
import {
  geminiProvider,
  RateLimitError,
} from './providers/geminiProvider';
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

const AGENT_SYSTEM = `${SYSTEM_PROMPT}

You can call tools to gather information before answering. Use search_documents to
look inside the user's documents (call it multiple times with different queries if
needed). Use web_search only if the documents do not contain the answer. Use
calculator for any arithmetic. When you have enough information, write the final
answer with inline [n] citations referring to the document excerpts you used.`;

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

          steps.push({ order, tool: call.name, input: call.args, outputSummary: result.summary });
          cb.onToolResult(order, result.summary);

          messages.push({
            role: 'tool',
            content: result.summary,
            toolCallId: call.id,
            toolName: call.name,
          });
        }
      }

      // Loop exhausted without returning (should not happen — forceFinal guards it).
      return { answer: 'I was unable to produce an answer.', model: provider.model, usage, steps, sources };
    } catch (err) {
      lastErr = err;
      const canFallback = err instanceof RateLimitError && p < providers.length - 1;
      if (!canFallback) throw err;
      // else: continue to next provider
    }
  }

  throw lastErr ?? new Error('Agent failed');
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- agent`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/ai/agent.ts backend/src/services/ai/agent.test.ts
git commit -m "feat: add agentic tool-calling loop"
```

---

## Task 11: Prisma migration (tokens + MessageStep)

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `Message.promptTokens Int?`, `Message.completionTokens Int?`, `Message.steps MessageStep[]`; new `MessageStep` model.

- [ ] **Step 1: Edit the schema**

In `backend/prisma/schema.prisma`, in `model Message`, add after `modelUsed`:
```prisma
  promptTokens     Int?
  completionTokens Int?
```
And add to the relations block of `Message` (next to `citations`):
```prisma
  steps     MessageStep[]
```
Then add a new model at the end of the file:
```prisma
model MessageStep {
  id            String   @id @default(cuid())
  messageId     String
  order         Int
  type          String   @default("TOOL_CALL")
  tool          String
  input         String   // JSON-encoded args
  outputSummary String
  createdAt     DateTime @default(now())

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
}
```

- [ ] **Step 2: Create the migration**

Run in `backend/` (requires `DATABASE_URL`):
```bash
npx prisma migrate dev --name agent_usage_and_steps
```
Expected: migration created and applied; `prisma generate` runs.

- [ ] **Step 3: Typecheck (Prisma client picks up new fields)**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: add message token columns and MessageStep table"
```

---

## Task 12: Wire agent into chat.service

**Files:**
- Modify: `backend/src/modules/chat/chat.service.ts`

**Interfaces:**
- Consumes: `runAgent`, `AgentStep`, `TOOLS`, `getRecentHistory`, `getConversationContext`.
- Produces: updated `StreamCallbacks` and `StreamResult`:
  - `StreamCallbacks { onSources(sources: RetrievedChunk[]): void; onStep(step: AgentStep): void; onToolResult(order: number, summary: string): void; onToken(text: string): void }`
  - `StreamResult { messageId: string; model: LlmModel; usage: { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number } }`

- [ ] **Step 1: Rewrite askStream**

Replace the body of `backend/src/modules/chat/chat.service.ts` with:
```ts
import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import type { LlmModel } from '../../services/ai/llm';
import type { RetrievedChunk } from '../../db/vectorSearch';
import { runAgent, type AgentStep } from '../../services/ai/agent';
import { TOOLS } from '../../services/ai/tools';
import { estimateCost } from '../../services/ai/cost';
import {
  getConversationContext,
  getRecentHistory,
} from '../conversations/conversations.service';
import type { TurnMessage } from '../../services/ai/providers/types';

export interface StreamCallbacks {
  onSources: (sources: RetrievedChunk[]) => void;
  onStep: (step: AgentStep) => void;
  onToolResult: (order: number, summary: string) => void;
  onToken: (text: string) => void;
}

export interface StreamResult {
  messageId: string;
  model: LlmModel;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
  };
}

export async function askStream(
  userId: string,
  conversationId: string,
  question: string,
  cb: StreamCallbacks
): Promise<StreamResult> {
  const trimmed = question.trim();
  if (!trimmed) throw AppError.badRequest('Question must not be empty');

  const { documentIds } = await getConversationContext(userId, conversationId);

  await prisma.message.create({
    data: { conversationId, role: 'USER', content: trimmed },
  });

  const messageCount = await prisma.message.count({ where: { conversationId } });
  if (messageCount === 1) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: trimmed.slice(0, 60) },
    });
  }

  const history = await getRecentHistory(conversationId);
  const turnHistory: TurnMessage[] = history.map((m) => ({
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content,
  }));

  const result = await runAgent(trimmed, turnHistory, TOOLS, { userId, documentIds }, {
    onStep: (step) => cb.onStep(step),
    onToolResult: (order, summary) => cb.onToolResult(order, summary),
    onToken: (text) => cb.onToken(text),
  });

  cb.onSources(result.sources);

  const message = await prisma.message.create({
    data: {
      conversationId,
      role: 'ASSISTANT',
      content: result.answer,
      modelUsed: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      citations: {
        create: result.sources.map((s, index) => ({
          chunkId: s.id,
          documentId: s.documentId,
          order: index,
        })),
      },
      steps: {
        create: result.steps.map((s) => ({
          order: s.order,
          tool: s.tool,
          input: JSON.stringify(s.input),
          outputSummary: s.outputSummary,
        })),
      },
    },
    select: { id: true },
  });

  const totalTokens = result.usage.promptTokens + result.usage.completionTokens;
  const costUsd = estimateCost(
    result.model,
    result.usage.promptTokens,
    result.usage.completionTokens
  );

  logger.info('Agent answer generated', {
    conversationId,
    model: result.model,
    steps: result.steps.length,
    sources: result.sources.length,
    totalTokens,
  });

  return {
    messageId: message.id,
    model: result.model,
    usage: {
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens,
      costUsd,
    },
  };
}
```

> Note: `sources` are now emitted after the agent finishes (once all searches are accumulated), rather than before streaming. This is intentional — the live feel comes from the `step`/`tool_result` events.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run full backend test suite**

Run: `npm test`
Expected: PASS (all prior tests still green).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/chat/chat.service.ts
git commit -m "feat: drive chat through the agent loop and persist steps/usage"
```

---

## Task 13: SSE protocol — step/tool_result/usage

**Files:**
- Modify: `backend/src/modules/chat/chat.controller.ts`

**Interfaces:**
- Consumes: updated `StreamCallbacks`/`StreamResult`.
- Produces: SSE events `step` `{ order, tool, input }`, `tool_result` `{ order, summary }`; `done` payload now includes `usage`.

- [ ] **Step 1: Update the controller**

In `backend/src/modules/chat/chat.controller.ts`, replace the `chatService.askStream(...)` call's callbacks object and keep the rest:
```ts
    const result = await chatService.askStream(
      userId,
      conversationId,
      question,
      {
        onSources: (sources) => send("sources", { sources }),
        onStep: (step) =>
          send("step", { order: step.order, tool: step.tool, input: step.input }),
        onToolResult: (order, summary) => send("tool_result", { order, summary }),
        onToken: (text) => send("token", { text }),
      },
    );
    send("done", result);
```
Also update the JSDoc event list at the top of the file to include:
```
 *   event: step        → { order, tool, input }
 *   event: tool_result → { order, summary }
 *   event: done        → { messageId, model, usage }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/chat/chat.controller.ts
git commit -m "feat: stream agent step and usage SSE events"
```

---

## Task 14: getConversation returns steps + tokens

**Files:**
- Modify: `backend/src/modules/conversations/conversations.service.ts`

**Interfaces:**
- Produces: each message in `getConversation` now includes `promptTokens`, `completionTokens`, and `steps` (ordered).

- [ ] **Step 1: Extend the message select**

In `backend/src/modules/conversations/conversations.service.ts`, inside `getConversation`'s `messages.select`, add after `modelUsed: true,`:
```ts
          promptTokens: true,
          completionTokens: true,
          steps: {
            orderBy: { order: 'asc' },
            select: {
              order: true,
              tool: true,
              input: true,
              outputSummary: true,
            },
          },
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/conversations/conversations.service.ts
git commit -m "feat: include agent steps and token usage when loading a conversation"
```

---

## Task 15: Usage aggregation endpoint

**Files:**
- Create: `backend/src/modules/usage/usage.service.ts`
- Create: `backend/src/modules/usage/usage.service.test.ts`
- Create: `backend/src/modules/usage/usage.controller.ts`
- Create: `backend/src/modules/usage/usage.routes.ts`
- Modify: `backend/src/routes.ts`

**Interfaces:**
- Produces:
  - `summarizeUsage(rows: { modelUsed: string | null; promptTokens: number; completionTokens: number; count: number }[]): UsageSummary` (pure, tested)
  - `UsageSummary { totals: { promptTokens; completionTokens; totalTokens; costUsd; messages }; byModel: { model; promptTokens; completionTokens; totalTokens; costUsd; messages }[] }`
  - `getUsage(userId: string): Promise<UsageSummary>`
  - `GET /api/usage`

- [ ] **Step 1: Write the failing test for the pure aggregator**

Create `backend/src/modules/usage/usage.service.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { summarizeUsage } from './usage.service';

describe('summarizeUsage', () => {
  it('computes per-model and grand totals with cost', () => {
    const out = summarizeUsage([
      { modelUsed: 'gemini', promptTokens: 1_000_000, completionTokens: 1_000_000, count: 2 },
      { modelUsed: 'groq', promptTokens: 1_000_000, completionTokens: 1_000_000, count: 1 },
    ]);

    expect(out.totals.totalTokens).toBe(4_000_000);
    expect(out.totals.messages).toBe(3);
    // gemini 0.5 + groq 0.13
    expect(out.totals.costUsd).toBeCloseTo(0.63, 6);
    expect(out.byModel).toHaveLength(2);
  });

  it('ignores null/unknown models in cost but still counts tokens', () => {
    const out = summarizeUsage([
      { modelUsed: null, promptTokens: 100, completionTokens: 100, count: 1 },
    ]);
    expect(out.totals.totalTokens).toBe(200);
    expect(out.totals.costUsd).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- usage.service`
Expected: FAIL (`summarizeUsage` not found).

- [ ] **Step 3: Implement the service**

Create `backend/src/modules/usage/usage.service.ts`:
```ts
import { prisma } from '../../db/prisma';
import { estimateCost } from '../../services/ai/cost';
import type { LlmModel } from '../../services/ai/llm';

interface UsageRow {
  modelUsed: string | null;
  promptTokens: number;
  completionTokens: number;
  count: number;
}

export interface UsageModelSummary {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  messages: number;
}

export interface UsageSummary {
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    messages: number;
  };
  byModel: UsageModelSummary[];
}

const KNOWN_MODELS: LlmModel[] = ['gemini', 'groq'];

export function summarizeUsage(rows: UsageRow[]): UsageSummary {
  const byModel: UsageModelSummary[] = rows.map((r) => {
    const model = r.modelUsed ?? 'unknown';
    const costUsd = KNOWN_MODELS.includes(model as LlmModel)
      ? estimateCost(model as LlmModel, r.promptTokens, r.completionTokens)
      : 0;
    return {
      model,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.promptTokens + r.completionTokens,
      costUsd,
      messages: r.count,
    };
  });

  const totals = byModel.reduce(
    (acc, m) => ({
      promptTokens: acc.promptTokens + m.promptTokens,
      completionTokens: acc.completionTokens + m.completionTokens,
      totalTokens: acc.totalTokens + m.totalTokens,
      costUsd: acc.costUsd + m.costUsd,
      messages: acc.messages + m.messages,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, messages: 0 }
  );

  return { totals, byModel };
}

export async function getUsage(userId: string): Promise<UsageSummary> {
  const grouped = await prisma.message.groupBy({
    by: ['modelUsed'],
    where: { role: 'ASSISTANT', conversation: { userId } },
    _sum: { promptTokens: true, completionTokens: true },
    _count: { _all: true },
  });

  const rows: UsageRow[] = grouped.map((g) => ({
    modelUsed: g.modelUsed,
    promptTokens: g._sum.promptTokens ?? 0,
    completionTokens: g._sum.completionTokens ?? 0,
    count: g._count._all,
  }));

  return summarizeUsage(rows);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- usage.service`
Expected: PASS (2 tests).

- [ ] **Step 5: Add controller and routes**

Create `backend/src/modules/usage/usage.controller.ts`:
```ts
import type { Request, Response } from 'express';
import * as usageService from './usage.service';

export async function getUsage(req: Request, res: Response) {
  const usage = await usageService.getUsage(req.user!.id);
  res.json({ usage });
}
```

Create `backend/src/modules/usage/usage.routes.ts`:
```ts
import { Router } from 'express';
import * as usageController from './usage.controller';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';

export const usageRouter = Router();

usageRouter.use(requireAuth);
usageRouter.get('/', asyncHandler(usageController.getUsage));
```

In `backend/src/routes.ts`, add the import and mount:
```ts
import { usageRouter } from './modules/usage/usage.routes';
```
```ts
apiRouter.use('/usage', usageRouter);
```

- [ ] **Step 6: Typecheck + test**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/usage backend/src/routes.ts
git commit -m "feat: add GET /api/usage aggregation endpoint"
```

---

## Task 16: Frontend types + stream client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/conversations.ts`

**Interfaces:**
- Produces:
  - `MessageStep { order: number; tool: string; input: string; outputSummary: string }`
  - `Usage { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number }`
  - `Message` gains `promptTokens?: number | null; completionTokens?: number | null; steps?: MessageStep[]`
  - `StreamHandlers` gains `onStep` and `onToolResult`; `onDone` receives `{ messageId; model; usage }`.

- [ ] **Step 1: Extend types**

In `frontend/src/types/index.ts`, add:
```ts
export interface MessageStep {
  order: number;
  tool: string;
  input: string;
  outputSummary: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}
```
And extend the `Message` interface with:
```ts
  promptTokens?: number | null;
  completionTokens?: number | null;
  steps?: MessageStep[];
```

- [ ] **Step 2: Extend the stream client**

In `frontend/src/api/conversations.ts`, update `StreamHandlers`:
```ts
export interface StreamHandlers {
  onSources: (sources: RetrievedSource[]) => void;
  onStep: (step: { order: number; tool: string; input: Record<string, unknown> }) => void;
  onToolResult: (order: number, summary: string) => void;
  onToken: (text: string) => void;
  onDone: (result: { messageId: string; model: string; usage: import('../types').Usage }) => void;
  onError: (message: string) => void;
}
```
And add cases in `dispatchEvent`'s switch:
```ts
    case "step":
      handlers.onStep(payload as { order: number; tool: string; input: Record<string, unknown> });
      break;
    case "tool_result":
      handlers.onToolResult(payload.order as number, payload.summary as string);
      break;
```

- [ ] **Step 3: Typecheck**

Run in `frontend/`: `npm run typecheck` (or `npx tsc --noEmit`)
Expected: it will FAIL only in `ChatPage.tsx` (missing new handlers) — that's fixed in Task 17. If it fails elsewhere, fix here.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/conversations.ts
git commit -m "feat(web): add agent step and usage types to stream client"
```

---

## Task 17: AgentSteps component + ChatPage wiring + token footer

**Files:**
- Create: `frontend/src/components/chat/AgentSteps.tsx`
- Modify: `frontend/src/pages/ChatPage.tsx`

**Interfaces:**
- Consumes: `MessageStep`, `Message`, updated `StreamHandlers`.
- Produces: `AgentSteps` component; live + persisted step rendering; per-message token/cost footer.

- [ ] **Step 1: Create the AgentSteps component**

Create `frontend/src/components/chat/AgentSteps.tsx`:
```tsx
import { useState } from "react";
import type { MessageStep } from "../../types";

const ICONS: Record<string, string> = {
  search_documents: "🔍",
  web_search: "🌐",
  calculator: "🧮",
};

export function AgentSteps({ steps }: { steps: MessageStep[] }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;

  return (
    <div className="px-2 text-xs text-muted">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:text-accent"
      >
        {open ? "▾" : "▸"} {steps.length} reasoning step
        {steps.length > 1 ? "s" : ""}
      </button>
      {open && (
        <ul className="mt-1 space-y-1 border-l border-line pl-3">
          {steps.map((s) => (
            <li key={s.order}>
              <span className="mr-1">{ICONS[s.tool] ?? "•"}</span>
              <span className="font-mono">{s.tool}</span>
              {": "}
              {s.outputSummary || "…"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add a token-footer helper and render steps in ChatPage**

In `frontend/src/pages/ChatPage.tsx`:

(a) Add the import near the other component imports:
```tsx
import { AgentSteps } from "../components/chat/AgentSteps";
import type { MessageStep } from "../types";
```

(b) Replace the `onSubmit` optimistic assistant message + handlers. First, in the `assistantMsg` initializer add `steps: []`:
```tsx
    const assistantMsg: Message = {
      id: assistantId,
      role: "ASSISTANT",
      content: "",
      citations: [],
      steps: [],
      createdAt: new Date().toISOString(),
    };
```

(c) In the `streamQuestion` call, add the new handlers and usage in `onDone`:
```tsx
      await streamQuestion(targetId, q, {
        onSources: (sources) =>
          patch(assistantId, (m) => ({
            ...m,
            citations: sourcesToCitations(sources),
          })),
        onStep: (step) =>
          patch(assistantId, (m) => ({
            ...m,
            steps: [
              ...(m.steps ?? []),
              { order: step.order, tool: step.tool, input: JSON.stringify(step.input), outputSummary: "" },
            ],
          })),
        onToolResult: (order, summary) =>
          patch(assistantId, (m) => ({
            ...m,
            steps: (m.steps ?? []).map((s) =>
              s.order === order ? { ...s, outputSummary: summary } : s,
            ),
          })),
        onToken: (text) =>
          patch(assistantId, (m) => ({ ...m, content: m.content + text })),
        onDone: (res) => {
          patch(assistantId, (m) => ({
            ...m,
            id: res.messageId,
            modelUsed: res.model,
            promptTokens: res.usage.promptTokens,
            completionTokens: res.usage.completionTokens,
          }));
          refreshConversations();
        },
        onError: (msg) => setError(msg),
      });
```

(d) In the message render block, add `AgentSteps` and a token footer. Replace the assistant-only render section (the `MessageBubble` + spinner + citations block) so it reads:
```tsx
                <div key={m.id} className="space-y-1.5">
                  {m.role === "ASSISTANT" && m.steps && m.steps.length > 0 && (
                    <AgentSteps steps={m.steps as MessageStep[]} />
                  )}
                  <MessageBubble
                    message={m}
                    activeOrder={activeOrder}
                    onHoverCitation={onHover}
                  />
                  {m.role === "ASSISTANT" && m.content === "" && (
                    <div className="flex items-center gap-2 px-2 text-sm text-muted">
                      <Spinner className="h-4 w-4" /> Thinking…
                    </div>
                  )}
                  {m.role === "ASSISTANT" &&
                    m.citations &&
                    m.citations.length > 0 && (
                      <CitationList
                        citations={m.citations}
                        activeOrder={activeOrder}
                        onHover={onHover}
                      />
                    )}
                  {m.role === "ASSISTANT" &&
                    typeof m.promptTokens === "number" &&
                    typeof m.completionTokens === "number" && (
                      <p className="px-2 text-xs text-muted">
                        {(m.promptTokens + m.completionTokens).toLocaleString()} tokens
                        {m.modelUsed ? ` · ${m.modelUsed}` : ""}
                      </p>
                    )}
                </div>
```

(e) Remove the stray `console.log` / `debugger` lines already present in this file (lines logging `location.state`, `messages`, and the `debugger;` in `onSubmit`).

- [ ] **Step 3: Typecheck**

Run in `frontend/`: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run backend (`npm run dev` in `backend/`) and frontend (`npm run dev` in `frontend/`). Ask a question in a conversation with a ready document. Verify: reasoning steps appear and expand, the answer streams in, citations show, and a token line appears under the answer.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/AgentSteps.tsx frontend/src/pages/ChatPage.tsx
git commit -m "feat(web): render agent reasoning steps and per-message token usage"
```

---

## Task 18: Account usage card

**Files:**
- Create: `frontend/src/api/usage.ts`
- Modify: `frontend/src/pages/AccountPage.tsx`

**Interfaces:**
- Consumes: `Usage`-style summary from `GET /api/usage`, `apiFetch`.
- Produces: `getUsage()` API fn; usage card on the Account page.

- [ ] **Step 1: Add the usage API**

Create `frontend/src/api/usage.ts`:
```ts
import { apiFetch } from "../lib/apiClient";

export interface UsageModelSummary {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  messages: number;
}

export interface UsageSummary {
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    messages: number;
  };
  byModel: UsageModelSummary[];
}

export function getUsage() {
  return apiFetch<{ usage: UsageSummary }>("/api/usage");
}
```

- [ ] **Step 2: Add the usage card to AccountPage**

In `frontend/src/pages/AccountPage.tsx`:

(a) Add imports:
```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { getUsage, type UsageSummary } from '../api/usage';
```
(Replace the existing `import { useState, type FormEvent } from 'react';` line.)

(b) Inside the component, add state + effect:
```tsx
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  useEffect(() => {
    getUsage()
      .then((res) => setUsage(res.usage))
      .catch(() => undefined);
  }, []);
```

(c) Add a usage `<section>` right after the closing `</section>` of the change-password card:
```tsx
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">Usage</h2>
        <p className="mt-1 text-sm text-muted">
          Token usage and estimated cost across your conversations.
        </p>
        {!usage ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total tokens" value={usage.totals.totalTokens.toLocaleString()} />
              <Stat label="Est. cost" value={`$${usage.totals.costUsd.toFixed(4)}`} />
              <Stat label="Answers" value={usage.totals.messages.toLocaleString()} />
            </div>
            {usage.byModel.length > 0 && (
              <table className="w-full text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 font-medium">Model</th>
                    <th className="py-1 font-medium">Tokens</th>
                    <th className="py-1 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  {usage.byModel.map((m) => (
                    <tr key={m.model} className="border-t border-line">
                      <td className="py-1 font-mono">{m.model}</td>
                      <td className="py-1">{m.totalTokens.toLocaleString()}</td>
                      <td className="py-1">${m.costUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
```

(d) Add a small `Stat` helper component at the bottom of the file (outside `AccountPage`):
```tsx
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-lg text-ink">{value}</p>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run in `frontend/`: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual check**

Reload the Account page; verify the Usage card shows totals and a per-model row after asking at least one question.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/usage.ts frontend/src/pages/AccountPage.tsx
git commit -m "feat(web): add account usage card"
```

---

## Task 19: Docs

**Files:**
- Modify: `docs/SETUP.md`
- Modify: `README.md`

- [ ] **Step 1: Document Tavily key in SETUP.md**

Add a short subsection to `docs/SETUP.md` explaining: create a free Tavily account at https://tavily.com, copy the API key, set `TAVILY_API_KEY` in `backend/.env`. Note it's optional — `web_search` is disabled (a no-op) without it.

- [ ] **Step 2: Update README stack/features**

In `README.md`, update the intro/stack to mention: agentic tool-calling (multi-step document search, web search, calculator), live reasoning-step streaming, and per-message + account token/cost tracking. Add Tavily to the stack table (Web search row, optional).

- [ ] **Step 3: Commit**

```bash
git add docs/SETUP.md README.md
git commit -m "docs: document agentic tools, Tavily key, and usage tracking"
```

---

## Self-Review Notes (verification before done)

- **Final verification:** From `backend/`, run `npm test && npm run typecheck`; from `frontend/`, run `npm run typecheck`. All must pass.
- **Manual end-to-end:** ask a numeric question about a document → expect a `search_documents` step, possibly a `calculator` step, a cited answer, a token footer, and the Account card reflecting the new totals.
- **Fallback note:** the Groq fallback path (Gemini 429 before output) is covered by the agent loop's provider iteration; it is unit-tested via the fake-provider `RateLimitError` path indirectly — if you want explicit coverage, add a test where the first provider's `runTurn` throws `RateLimitError` and assert the second provider's answer is returned.
