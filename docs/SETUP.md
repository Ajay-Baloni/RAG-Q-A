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

## 5. Resend (password-reset emails)

Needed only for the **forgot-password** flow. If you skip it, reset links are printed to the backend console instead of emailed (fine for local testing); change-password works without it.

1. Go to https://resend.com and sign up.
2. **API Keys** → **Create API Key**. Copy it into `.env` as `RESEND_API_KEY`.
3. Leave `EMAIL_FROM=Lexica <onboarding@resend.dev>` to start.

Free tier: 3,000 emails/month, 100/day. Without a verified domain, Resend's test mode only delivers to the email you signed up with — verify a domain later to send to anyone.

---

## 6. App secrets

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
