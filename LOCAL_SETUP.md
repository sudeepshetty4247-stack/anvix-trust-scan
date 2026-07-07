# Run Anvix Locally — Honest Guide

This project runs on **Lovable Cloud** (database, auth, storage) + **Lovable AI Gateway** (the AI explanation feature). Two of those keys (`LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) only exist inside Lovable and cannot be exported. So there is no "clone and run with 100% features and zero signup" path. Pick one of the three options below.

---

## Option 1 — Just use the live URL (recommended for college demo)

Nothing to install. Everything works.

- Live app: **https://anvix-trust-scan.lovable.app**
- Full AI, full database, full extension backend — already live.
- For your submission: share this URL + your GitHub repo link + a screen recording.

**This is what most Lovable college projects do.** No local setup risk on demo day.

---

## Option 2 — Run locally (AI features off, everything else works)

No third-party signup needed. You lose only the AI-generated explanation paragraph and evidence auto-extraction from screenshots/PDFs. Landing page, sign-in, dashboard, scans, database, extension — all work.

### Steps

**1. Install once**
- Node.js 20+ → https://nodejs.org
- Bun → https://bun.sh
  - macOS/Linux: `curl -fsSL https://bun.sh/install | bash`
  - Windows: `powershell -c "irm bun.sh/install.ps1 | iex"`
- Git → https://git-scm.com

**2. Get the code from GitHub**
```bash
git clone https://github.com/sudeepshetty4247-stack/anvix-lovable.git
cd anvix-lovable
bun install
```

**3. Create `.env` in the project root**
```env
VITE_SUPABASE_URL=https://tycnbtycdjgwjmjfdwtm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SzeSzI_jL5nofnzd92Ds4A_jD4appqj
VITE_SUPABASE_PROJECT_ID=tycnbtycdjgwjmjfdwtm

SUPABASE_URL=https://tycnbtycdjgwjmjfdwtm.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_SzeSzI_jL5nofnzd92Ds4A_jD4appqj
SUPABASE_PROJECT_ID=tycnbtycdjgwjmjfdwtm

ANVIX_SIGNAL_PEPPER=change-me-to-any-random-string-123
```

**4. Run**
```bash
bun run dev
```
Open **http://localhost:8080**.

Your local app talks to the same Lovable Cloud database as the live site.

---

## Option 3 — Run locally with full AI (2-minute free signup)

Same as Option 2, plus a free Google Gemini key so AI works.

**Extra steps after Option 2:**

**a.** Go to **https://aistudio.google.com/apikey** → sign in with Google → **Create API key**. No credit card. Copy the key.

**b.** Add it to `.env`:
```env
LOVABLE_API_KEY=<your Gemini key>
```

**c.** Open `src/lib/ai-gateway.server.ts` and change two things at the top:

Change:
```ts
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
```
to:
```ts
const GATEWAY_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
```

And in the `fetch` call, change the header:
```ts
"Lovable-API-Key": key,
```
to:
```ts
"Authorization": `Bearer ${key}`,
```

Also change the default model from `google/gemini-2.5-flash` to `gemini-2.5-flash` (drop the `google/` prefix for direct Gemini).

**d.** Restart `bun run dev`. Now AI works too.

Note: some **admin writes** still need `SUPABASE_SERVICE_ROLE_KEY` which you can't get. 95% of user-visible flows are fine without it. For 100% parity you'd have to spin up your own Supabase project (`supabase link` + `supabase db push` all migrations) — a much bigger project. Not worth it for a demo.

---

## Chrome extension (works in all three options)

1. Find `public/anvix-scanner-v1.0.0.zip` in the project → unzip it.
2. Chrome → `chrome://extensions` → enable **Developer mode** (top right).
3. Click **Load unpacked** → pick the unzipped folder.
4. Right-click any suspicious message on LinkedIn / Gmail / WhatsApp Web → **Scan with Anvix**.

By default the extension calls the live URL. To point it at your local server, edit `extension/background.js` and replace the base URL with `http://localhost:8080`, then reload the extension.

---

## Troubleshooting

- `bun: command not found` → restart your terminal after installing Bun.
- Port 8080 in use → `bun run dev -- --port 3000`.
- Blank page / auth errors → double-check `.env` values (no quotes).
- AI 401 error → in Option 3, you didn't change the auth header in step (c).
- **Never commit `.env`** — it's already in `.gitignore`.

## Deploy elsewhere?

Not recommended for a demo. This project targets Cloudflare Workers via Lovable's build. Moving to Vercel needs a build-preset swap + server.ts edits + retesting. Keep it hosted on Lovable — the URL is free and permanent.
