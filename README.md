# AI Document Q&A with RAG

Upload PDFs or paste URLs, then ask questions and get streamed, source-cited answers powered by retrieval-augmented generation (RAG).

## Stack

| Layer        | Tech                                                       |
| ------------ | ---------------------------------------------------------- |
| Frontend     | React + Vite + TypeScript + TailwindCSS → **Vercel**       |
| Backend      | Node + Express + TypeScript → **Render**                   |
| Database     | PostgreSQL + **pgvector** (Neon)                           |
| ORM          | Prisma (raw SQL via `$queryRaw` for vector search)         |
| File storage | Cloudinary (PDFs)                                          |
| Embeddings   | Google `gemini-embedding-001` (768-dim)                    |
| LLM          | Google Gemini 1.5 Flash (primary) → Groq Llama3 (fallback) |

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
