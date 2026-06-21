# Observable Agentic RAG — Design Spec

**Date:** 2026-06-21
**Status:** Approved, ready for implementation planning

## Goal

Upgrade the existing single-shot RAG chat into an **agentic RAG** system where the
LLM autonomously decides which tools to call, can take multiple reasoning steps,
and streams those steps to the UI before producing a final, source-cited answer.
Per-message token usage and estimated cost are tracked across the entire tool-calling
chain and surfaced both per-message and as an account-level total.

This is a resume-focused feature. The defensible bullet it produces:

> Built an agentic RAG system where an LLM autonomously plans and calls tools
> (multi-step document search, web-search fallback, calculator), streaming its
> reasoning steps — with per-call token/cost tracking and a Gemini→Groq fallback.

## Current state (what exists)

- `chat.service.askStream`: `save question → embed → vector search (TOP_K) →
  emit sources → stream answer (Gemini, Groq fallback on 429) → persist answer +
  ordered citations`.
- Streaming layer: `services/ai/llm.ts` (`streamWithFallback`), `gemini.ts`,
  `groq.ts` — all yield plain text tokens; usage data is discarded.
- SSE protocol (`chat.controller.ts`): events `sources`, `token`, `done`, `error`.
- Prisma `Message` already has `modelUsed String?`; citations via `MessageCitation`.
- Frontend consumes SSE via `streamQuestion` (fetch + ReadableStream) with
  `onSources` / `onToken` / `onDone` / `onError`.

## Scope

### In scope
1. Tool layer: `search_documents`, `web_search` (Tavily), `calculator`.
2. Agent loop with a provider-agnostic tool-calling abstraction (Gemini primary,
   Groq fallback preserved).
3. Token usage capture across all agent turns; `MODEL_PRICING` + `estimateCost`.
4. Persisted reasoning trace (`MessageStep`) so reloads replay the agent's steps.
5. Extended SSE protocol (`step`, `tool_result`; `done` carries usage).
6. Frontend: `AgentSteps` trace component, per-message token/cost footer, Account
   usage card, `GET /api/usage` aggregation endpoint.
7. TDD unit tests for tools, `estimateCost`, the agent loop, and aggregation.

### Out of scope (YAGNI)
- Parallel tool calls; human-in-the-loop tool approval.
- Embedding-call token accounting.
- Usage charts/graphs; budget enforcement / rate limiting.

## Architecture

### 1. Tools — `backend/src/services/ai/tools/`

Each tool is a self-contained unit with a uniform shape:

```ts
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;            // provider-neutral param schema
  execute(args: unknown, ctx: ToolContext): Promise<ToolResult>;
}
interface ToolContext { userId: string; documentIds: string[]; }
interface ToolResult { summary: string; data: unknown; chunks?: RetrievedChunk[]; }
```

- **`search_documents(query: string)`** — wraps `embedText` + `searchSimilarChunks`,
  scoped to `ctx.documentIds`. Returns `chunks` (with ids) so accumulated results
  feed the citation pipeline. Agent may call it multiple times with refined queries.
- **`web_search(query: string)`** — calls Tavily (`/search`, free tier). Returns
  top snippets + source URLs in `summary`/`data`. Requires `TAVILY_API_KEY`.
- **`calculator(expression: string)`** — safe arithmetic evaluation (no `eval`;
  use a constrained evaluator). Returns the numeric result.

Tools are registered in a single `tools/index.ts` registry consumed by the agent
and by the provider schema converters.

### 2. Agent loop — `backend/src/services/ai/agent.ts`

```
runAgent(prompt, tools, ctx, callbacks) → AgentResult
```

- Multi-turn loop, **MAX_AGENT_STEPS = 5**.
- Each turn: call provider with the message history + tool schemas.
  - If the model returns tool call(s): emit `onStep(toolName, args)`, execute the
    tool, emit `onToolResult(summary)`, append the result to history, continue.
  - If the model returns prose: stream it via `onToken`, then stop.
- Accumulates across turns: all `chunks` from `search_documents` (deduped, for
  citations), token usage (`promptTokens`/`completionTokens` summed), and the
  ordered step trace.
- Returns `AgentResult { answer, model, usage, steps, sources }`.
- Guardrail: if `MAX_AGENT_STEPS` is hit without a final answer, force a final
  answer turn (no tools) so the user always gets a response.

### 3. Provider abstraction — preserves Gemini→Groq fallback

```ts
interface ToolCallingProvider {
  model: LlmModel;
  // One agent turn. Returns either tool calls or a (streamable) final answer,
  // plus token usage for the turn.
  runTurn(history: Turn[], tools: ToolSchema[]): Promise<ProviderTurnResult>;
}
```

- `gemini.ts` and `groq.ts` each implement `ToolCallingProvider` and convert the
  neutral tool schema into their native function-calling format.
- The agent runs against Gemini; if Gemini throws `RateLimitError` before emitting
  any output, the loop restarts against Groq (same pre-output fallback guarantee
  as today, lifted to the agent level).
- Usage capture: `gemini` reads `(await result.response).usageMetadata`; `groq`
  uses `stream_options: { include_usage: true }` (final chunk) for the streamed
  final turn and the standard `usage` field for tool-deciding turns.

### 4. Token tracking & pricing

- Prisma `Message` gains `promptTokens Int?`, `completionTokens Int?` (nullable;
  pre-existing rows render as "—"). `modelUsed` already present.
- `constants.ts`: `MODEL_PRICING` — USD per 1M input/output tokens for
  `gemini-2.0-flash` and `llama-3.1-8b-instant`.
- `estimateCost(model, promptTokens, completionTokens): number` — single source of
  truth, used by the per-message footer and the account aggregation. Cost is
  **derived, never stored**, so price-table changes re-price history correctly.

### 5. Persisted reasoning trace — `MessageStep`

```prisma
model MessageStep {
  id            String   @id @default(cuid())
  messageId     String
  order         Int
  type          String   // "TOOL_CALL"
  tool          String   // "search_documents" | "web_search" | "calculator"
  input         String   // JSON args
  outputSummary String   // short human-readable result summary
  createdAt     DateTime @default(now())
  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  @@index([messageId])
}
```

`Message` gets a `steps MessageStep[]` relation. Persisted on completion alongside
the assistant message and citations. `getConversation` selects steps (ordered) so a
reloaded conversation replays the trace.

### 6. SSE protocol (extends existing)

| event | payload | when |
| --- | --- | --- |
| `sources` | `{ sources }` | (kept) accumulated retrieved chunks |
| `step` | `{ order, tool, input }` | each tool call begins |
| `tool_result` | `{ order, summary }` | each tool call returns |
| `token` | `{ text }` | (kept) final-answer token deltas |
| `done` | `{ messageId, model, usage }` | completion; `usage` = `{promptTokens, completionTokens, totalTokens, costUsd}` |
| `error` | `{ message }` | (kept) |

`chat.service.askStream` callbacks gain `onStep` / `onToolResult`; the controller
maps them to the new events. `streamQuestion` (frontend) gains `onStep` /
`onToolResult` handlers and `onDone` receives `usage`.

### 7. Frontend

- **`AgentSteps`** (`components/chat/AgentSteps.tsx`): collapsible trace rendered
  under an assistant message — e.g. `🔍 Searched "revenue 2023" → 5 hits ·
  🧮 Calculated 42 · 🌐 Web: "latest filing"`. Driven live by `step`/`tool_result`
  during streaming and from persisted `steps` on reload.
- **Token footer**: small line under each assistant message —
  `1,247 tokens · ~$0.0002 · gemini`. Hidden when tokens are null.
- **Account usage card** (`AccountPage`): total tokens, estimated cost, per-model
  breakdown (Gemini vs Groq), assistant-message count. Fed by `GET /api/usage`.
- **`api/usage.ts`** + new types for `MessageStep`, `Usage`, and message token fields.

### 8. Backend usage endpoint

`GET /api/usage` → aggregates assistant messages for the authenticated user via
Prisma `groupBy({ by: ['modelUsed'], where: { role: 'ASSISTANT', conversation: {
userId } }, _sum: { promptTokens, completionTokens }, _count: true })`. Response:
per-model rows + computed `costUsd` (via `estimateCost`) + grand totals.

## Data flow (happy path)

1. User asks a question → `askStream` saves the user message, builds context.
2. `runAgent` drives the loop against Gemini:
   - turn 1 → `search_documents("...")` → emit `step` + `tool_result`, accumulate chunks.
   - turn 2 → maybe `calculator` / `web_search` → emit step/result.
   - turn 3 → final prose → stream `token`s.
3. Accumulated chunks → `sources` event + persisted `MessageCitation`s.
4. Steps → persisted `MessageStep`s. Summed usage → `Message.promptTokens/
   completionTokens` + `done` event.
5. Frontend renders trace, answer, citations, and token/cost footer; Account card
   reflects new totals on next load.

## Error handling

- Tool execution errors are caught, surfaced to the model as a tool error result
  (so it can recover), and emitted as a `tool_result` with an error summary.
- `web_search` network/key failure degrades gracefully: the tool returns an error
  result; the agent proceeds with document context.
- Gemini 429 before any output → fall back to Groq for the whole loop.
- `MAX_AGENT_STEPS` exhausted → forced final-answer turn.
- Mid-stream provider error after tokens emitted → surfaced via `error` event
  (no spliced answers), matching current behavior.

## Testing (TDD)

- **Tools**: `calculator` (correctness + rejects unsafe input); `search_documents`
  (scopes to documentIds, returns chunks); `web_search` (mocked Tavily, parses
  snippets, handles failure).
- **`estimateCost`**: known token counts → expected USD per model; unknown model
  handled.
- **Agent loop** (mocked `ToolCallingProvider`): calls a tool then finalizes;
  respects `MAX_AGENT_STEPS`; accumulates usage and dedupes chunks; forced final
  answer on exhaustion; Groq fallback on pre-output 429.
- **Usage aggregation**: seeded messages → correct per-model and grand totals.

## New environment / config

- `TAVILY_API_KEY` — add to `backend/.env.example`, `config/env.ts`, and SETUP.md.
- `constants.ts`: `MAX_AGENT_STEPS = 5`, `MODEL_PRICING`.

## Migration

Single Prisma migration: add `promptTokens`/`completionTokens` to `Message`, create
`MessageStep` table + relation. All additive and nullable — no backfill required;
existing messages render without token/step data.
