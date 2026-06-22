# AI Document Q&A with RAG

Upload PDFs or paste URLs, then ask questions and get streamed, source-cited answers powered by **agentic** retrieval-augmented generation (RAG).

Instead of a single fixed retrieval step, an LLM agent autonomously decides which tools to call — **multi-step document search**, **web search** (when the docs don't cover it), and a **calculator** — and streams its reasoning steps live before the final cited answer. Each answer reports its **token usage**, aggregated per model on the Account page.

## Stack

| Layer        | Tech                                                       |
| ------------ | ---------------------------------------------------------- |
| Frontend     | React + Vite + TypeScript + TailwindCSS → **Vercel**       |
| Backend      | Node + Express + TypeScript → **Render**                   |
| Database     | PostgreSQL + **pgvector** (Neon)                           |
| ORM          | Prisma (raw SQL via `$queryRaw` for vector search)         |
| File storage | Cloudinary (PDFs)                                          |
| Embeddings   | Google `gemini-embedding-001` (768-dim)                    |
| LLM          | Google Gemini 2.5 Flash (primary) → Groq Llama3 (fallback) |
| Agent tools  | Document search · Web search (Tavily) · Calculator         |
| Web search   | Tavily API (optional, free tier)                           |

## Monorepo layout

```
backend/   Express API (auth, documents, RAG chat)
frontend/  React SPA
docs/      Setup guide + design spec
```

## Quick start

1. Follow **[docs/SETUP.md](docs/SETUP.md)** to create accounts and collect API keys.
2. Backend:
   ```bash
   cd backend
   cp .env.example .env      # fill in keys
   npm install
   npm run prisma:migrate    # creates tables + pgvector extension/index
   npm run dev
   ```
3. Frontend:
   ```bash
   cd frontend
   cp .env.example .env      # set VITE_API_URL
   npm install
   npm run dev
   ```
