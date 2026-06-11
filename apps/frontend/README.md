# frontend — Next.js app

The Serious Shift UI: the trend map, thinker profiles, daily briefing, and
keynote. Built with Next.js (App Router) + Tailwind v4 + framer-motion; routing
is client-side (react-router `HashRouter`) mounted in a Next page with
`ssr: false`. It reads all data from the [backend API](../backend/README.md).

## Layout

```
app/            Next entry: layout.jsx, page.jsx (mounts the SPA client-side)
src/
  Spa.jsx       <HashRouter><App/></HashRouter>
  App.jsx       routes + nav
  views/        pages (map/, thinker, daily, …)
  components/   shared UI
  hooks/useData.js   fetches ${NEXT_PUBLIC_API_BASE}/api/<name>
```

## Configuration (env)

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_API_BASE` | Base URL of the backend (e.g. `http://localhost:8080` or the deployed URL). Empty = same-origin. |

## Run locally

```bash
cp .env.example .env.local        # set NEXT_PUBLIC_API_BASE to the backend
npm install
npm run dev                       # http://localhost:3000  (backend on :8080)
```

Build: `npm run build` (also run in `.github/workflows/frontend.yml`).

## Deploy (free tier) — Vercel

Vercel's Hobby plan hosts Next.js for free.

1. **Import the repo** at vercel.com → New Project.
2. **Root Directory:** `apps/frontend` (this is a monorepo — Vercel auto-detects Next.js from there).
3. **Environment Variable:** `NEXT_PUBLIC_API_BASE` = your deployed backend URL
   (e.g. `https://serious-shift-backend.fly.dev`).
4. Deploy. Every push to the branch gets a preview URL; production deploys on the
   production branch.

CLI alternative:
```bash
cd apps/frontend
npx vercel            # first run links the project; set Root Directory = apps/frontend
npx vercel env add NEXT_PUBLIC_API_BASE      # paste the backend URL
npx vercel --prod
```

Note: `NEXT_PUBLIC_*` vars are inlined at build time, so changing the backend URL
requires a redeploy. The backend currently allows any origin (CORS permissive),
so cross-origin calls from the Vercel domain work out of the box.
