# Design — AI Document Q&A with RAG

## Goal

A web app where a user uploads PDFs or pastes URLs, then asks questions and gets
answers grounded in those documents (retrieval-augmented generation), with source
citations. Must run entirely on free tiers.

## Architecture (Option A: monolith + synchronous processing)

```
┌────────────┐      REST + SSE      ┌──────────────────────────┐
│  Frontend  │  ───────────────────────────────▶ │  Backend (Express, TS)   │
│ React+Vite │  ◀─────────────────────────────── │                          │
│  (Vercel)  │         JSON / event-stream        │  auth · documents · chat │
└────────────┘                                    └─────────┬───────┬────────┘
   localStorage JWT (Bearer)                                 │       │
                                              Prisma + raw SQL│       │ HTTP
                                                              ▼       ▼
                                          ┌───────────────────────┐ ┌─────────────────┐
                                          │ Neon Postgres+pgvector │ │ Gemini / Groq   │
                                          │ users, docs, chunks,   │ │ Cloudinary      │
                                          │ conversations, messages│ │                 │
                                          └───────────────────────┘ └─────────────────┘
```

- **One Express service** handles auth, document processing, and chat. SSE streaming works natively.
- **Auth:** JWT as a Bearer token in `localStorage` (frontend and backend live on
  different domains, so cross-site cookies are avoided).
- **DB access:** Prisma for all modeling/CRUD; **raw SQL via `$queryRaw`** only for the
  pgvector cosine search and embedding inserts (the `embedding` column is a
  `vector(768)` type Prisma can't query natively).

## Data model

`User · Document · Chunk · Conversation · ConversationDocument · Message · MessageCitation`
(see `backend/prisma/schema.prisma`). Embeddings live in `Chunk.embedding vector(768)`,
indexed with HNSW (`vector_cosine_ops`).

## Document processing pipeline

1. Upload PDF (→ Cloudinary) or URL. Create `Document` with `status=PROCESSING`, respond `202`.
2. Background: extract text (pdf-parse / cheerio) → chunk (~500 tokens, 50 overlap) →
   embed in batches (`gemini-embedding-001` at 768 dims) → insert chunks + embeddings via raw SQL.
3. Set `status=READY` (or `FAILED` with an error). Frontend polls `GET /documents/:id`.

## RAG chat flow

1. User selects ≥1 READY documents → creates a `Conversation`.
2. Question → save `Message(USER)` → embed question → cosine top-5 over the conversation's
   documents → build prompt (system + last 6 messages + numbered excerpts + question) →
   call Gemini → save `Message(ASSISTANT)` + `MessageCitation` rows → return answer + sources.
