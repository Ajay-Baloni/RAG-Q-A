# Setup Guide — Accounts & Keys

You need four accounts. None require a credit card. Collect each value into `backend/.env` (copy from `backend/.env.example`).

---

## 1. Neon (PostgreSQL + pgvector) — free

1. Go to https://neon.tech and sign up (GitHub login is easiest).
2. Create a project (any name). Pick the region closest to you.
3. On the project dashboard, open **Connection Details** and copy the **connection string** (looks like `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`).
4. Paste it into `.env` as `DATABASE_URL`.

> pgvector is enabled automatically by our first migration (`CREATE EXTENSION vector`). Neon supports it on the free tier.

---

## 2. Google Gemini API (LLM + embeddings) — free

1. Go to https://aistudio.google.com/apikey
2. Click **Create API key** (in a new or existing Google Cloud project).
3. Copy the key into `.env` as `GEMINI_API_KEY`.

---

## 3. Groq (fallback LLM) — free

1. Go to https://console.groq.com and sign up.
2. Open **API Keys** → **Create API Key**.
3. Copy into `.env` as `GROQ_API_KEY`.

---

## 4. Cloudinary (PDF storage) — free

1. Go to https://cloudinary.com and sign up.
2. On the dashboard, copy **Cloud name**, **API Key**, and **API Secret**.
3. Put them in `.env` as `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

---

## 5. App secrets

- `JWT_SECRET` — any long random string. Generate one:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

---

## Final checklist (`backend/.env`)

```
DATABASE_URL=...
JWT_SECRET=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

`frontend/.env`:

```
VITE_API_URL=http://localhost:4000
```

Then run the migrations and start both apps (see the root README).
