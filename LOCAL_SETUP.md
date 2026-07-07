# Run Anvix Locally — Full Parity (nothing disabled)

Goal: every feature that works on the live site works on your laptop — AI explanations, scans, admin writes, uploads, extension, everything.

Because two of the keys (`LOVABLE_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`) are managed by Lovable Cloud and cannot be exported, "full parity locally" means you bring your **own** Supabase project + your **own** AI provider key. This guide walks through it end-to-end.

---

## 1. Install prerequisites (one time)

- **Node.js 20+** → https://nodejs.org
- **Bun** → https://bun.sh
  - macOS/Linux: `curl -fsSL https://bun.sh/install | bash`
  - Windows: `powershell -c "irm bun.sh/install.ps1 | iex"`
- **Git** → https://git-scm.com
- **Supabase CLI** → https://supabase.com/docs/guides/local-development/cli/getting-started

## 2. Get the code

In Lovable: **GitHub → Connect to GitHub → Create Repository**, then:

```bash
git clone <your-repo-url>
cd <your-repo-folder>
bun install
```

## 3. Create your own Supabase project (free tier is fine)

1. Sign up at https://supabase.com → **New project**.
2. Wait for it to provision (~2 minutes).
3. From **Project Settings → API**, copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `anon public` key → this is your `SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → this is your `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
   - Project ref (the string in the URL) → `SUPABASE_PROJECT_ID`

## 4. Apply the database schema to your Supabase project

All migrations live in `supabase/migrations/`. Push them:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates every table, RLS policy, function, and the `evidence` storage bucket exactly like production.

## 5. Get an AI provider key

The app uses the Lovable AI Gateway (`https://ai.gateway.lovable.dev`). Since that key isn't exportable, point the app at **Google Gemini** directly (same underlying model, free tier available):

1. Go to https://aistudio.google.com/apikey → **Create API key**.
2. Copy the key.

You will need one tiny code change (Step 7) to swap the endpoint. Or, if you have an OpenRouter / OpenAI key, use that — same OpenAI-compatible shape.

## 6. Create `.env` in the project root

```env
# --- Your own Supabase project ---
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your anon key>
VITE_SUPABASE_PROJECT_ID=<your-ref>

SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your anon key>
SUPABASE_PROJECT_ID=<your-ref>
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>

# --- AI ---
# Use your Gemini key here (or OpenRouter/OpenAI key)
LOVABLE_API_KEY=<your Gemini or OpenRouter key>

# --- App secret (any random string, keep it consistent) ---
ANVIX_SIGNAL_PEPPER=change-me-to-any-long-random-string
```

## 7. Point the AI helper at your provider

Open `src/lib/ai-gateway.server.ts`. Change the top constant:

**If using Google Gemini directly:**
```ts
const GATEWAY_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
```

**If using OpenRouter:**
```ts
const GATEWAY_URL = "https://openrouter.ai/api/v1/chat/completions";
```

**If using OpenAI:**
```ts
const GATEWAY_URL = "https://api.openai.com/v1/chat/completions";
```
And in the same file change the auth header from `"Lovable-API-Key": key` to `"Authorization": \`Bearer ${key}\``.

The default model id `google/gemini-2.5-flash` works for OpenRouter. For direct Gemini use `gemini-2.5-flash`. For OpenAI use e.g. `gpt-4o-mini`.

## 8. Start the app

```bash
bun run dev
```

Open **http://localhost:8080** — full app, full features, running against your own database + your own AI key. Nothing disabled.

## 9. Seed the ML signals (optional, matches production)

```bash
node ml/seed_global_signals.mjs
node ml/curated_seed.mjs
```

## 10. Chrome extension (local)

1. `public/anvix-scanner-v1.0.0.zip` → unzip.
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the unzipped folder.
3. To make it hit your local server instead of the published URL, edit `extension/background.js` and change the base URL to `http://localhost:8080`, then reload the extension.

---

## Troubleshooting

- **`bun: command not found`** → restart terminal.
- **Port 8080 busy** → `bun run dev -- --port 3000`.
- **Auth errors / blank page** → re-check every `.env` value; no quotes needed.
- **AI call returns 401** → provider key wrong, or you didn't switch the auth header in Step 7.
- **`Missing Supabase environment variable`** → `.env` not loaded; restart `bun run dev`.
- **Never commit `.env`** — it's already in `.gitignore`.

## Deploy to Vercel (later)

Possible but non-trivial: the project targets Cloudflare Workers today. To move to Vercel you'd switch the Vite build preset, edit `src/server.ts`, and retest server functions. Keep it on Lovable or Cloudflare Workers for the smoothest path.
