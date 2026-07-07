# Final local setup — one clean guide

The existing `LOCAL_SETUP.md` is mostly correct, but two things need fixing so it matches reality exactly (what you see in the preview is what you'll get locally):

1. **Dev port is 5173, not 3000.** `bun dev` runs Vite, which defaults to `http://localhost:5173`. Every "open localhost:3000" line will be corrected.
2. **`LOVABLE_API_KEY` for local use.** It's auto-provisioned in the Lovable project but not injected into your laptop's shell. I'll add a one-paragraph explanation: rotate it once from the Lovable editor (Project Settings → Secrets → LOVABLE_API_KEY → rotate/copy) and paste the value into `.env`. No Gemini/OpenAI key needed — Lovable AI Gateway routes to Gemini behind the scenes.

## What the rewritten `LOCAL_SETUP.md` will contain (single source of truth)

1. **Prerequisites** — Node 20+, Bun (or npm), Git. Copy-paste install commands for macOS/Linux/Windows.
2. **Get the code** — Option A: GitHub sync from Lovable (`+` → GitHub → Connect → clone). Option B: Download ZIP.
3. **Install** — `bun install` (or `npm install`).
4. **Create `.env`** — exact block to paste, with the publishable Supabase values already filled in and clear notes on `LOVABLE_API_KEY` + `ANVIX_SIGNAL_PEPPER`.
5. **How to get `LOVABLE_API_KEY`** — step-by-step: open Lovable editor → Project Settings → Secrets → find `LOVABLE_API_KEY` → rotate → copy the new value → paste into `.env`. Explain it powers Ask ANVIX, Trap-Reply, and AI report explanations.
6. **Run** — `bun dev`, open `http://localhost:5173`.
7. **Smoke test** — 6 steps: landing → sign up with email+password → dashboard → new investigation → watch live activity + score → try Ask ANVIX.
8. **Google sign-in note** — use email/password locally; Google OAuth is registered for the deployed domain only.
9. **Optional ML retrain** — `cd ml && pip install ... && python train_ensemble.py`.
10. **Scripts table** — dev/build/preview/lint/format.
11. **Common errors table** — port in use, blank page after login, AI 401, JWT error, Windows PATH, `.env` naming, WebSocket blocked.
12. **Push changes back** — Git via Lovable GitHub sync.

## Files touched

- `LOCAL_SETUP.md` — rewritten end-to-end with the two corrections above; structure and useful tables preserved.

No app code changes. The preview UI you're seeing is already the final polished version from the previous turns.
