## 1. Backend on Render

1. https://render.com → **New** → **Web Service** → connect your GitHub repo.
2. Configure the service:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npx prisma generate && npm run build && npx prisma migrate deploy`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
   - **Instance Type:** Free
3. Add environment variables:
   `NODE_ENV=production`, `JWT_EXPIRES_IN=30d`, and the secrets
   `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY`,
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
   Leave `CLIENT_ORIGIN` blank for now (set it after Vercel gives you a URL).
4. Deploy. The build runs `prisma migrate deploy`, so the Neon database gets its
   tables + pgvector extension automatically. Note the service URL, e.g.
   `https://ai-document-qa-backend.onrender.com`.

## 2. Frontend on Vercel

1. https://vercel.com → **Add New** → **Project** → import the repo.
2. Set **Root Directory** to `frontend`. Vercel auto-detects Vite (see
   [`frontend/vercel.json`](../frontend/vercel.json)).
3. Add an environment variable:
   `VITE_API_URL = https://ai-document-qa-backend.onrender.com` (your Render URL).
4. Deploy. Note the Vercel URL, e.g. `https://your-app.vercel.app`.

## 3. Connect them (CORS)

Back on Render, set `CLIENT_ORIGIN` to your Vercel URL
(`https://your-app.vercel.app`) and redeploy. Multiple origins can be
comma-separated. Done — the app is live.

## Updating

Both platforms redeploy automatically on every push to the default branch.
New Prisma migrations are applied by Render's build step (`prisma migrate deploy`).
