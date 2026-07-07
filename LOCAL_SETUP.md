# Run Anvix Locally

Follow these steps to run the full project on your laptop, using the same Lovable Cloud backend (no separate database needed).

## 1. Install prerequisites (one time)

- **Node.js 20+** → https://nodejs.org
- **Bun** → https://bun.sh
  - macOS/Linux: `curl -fsSL https://bun.sh/install | bash`
  - Windows: `powershell -c "irm bun.sh/install.ps1 | iex"`
- **Git** → https://git-scm.com

## 2. Get the code

In Lovable: **GitHub → Connect to GitHub → Create Repository**.

Then on your laptop:

```bash
git clone <your-repo-url>
cd <your-repo-folder>
```

## 3. Install dependencies

```bash
bun install
```

## 4. Create a `.env` file in the project root

Copy this exactly:

```env
# Public (safe) keys — same as Lovable Cloud
VITE_SUPABASE_URL=https://tycnbtycdjgwjmjfdwtm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SzeSzI_jL5nofnzd92Ds4A_jD4appqj
VITE_SUPABASE_PROJECT_ID=tycnbtycdjgwjmjfdwtm

SUPABASE_URL=https://tycnbtycdjgwjmjfdwtm.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_SzeSzI_jL5nofnzd92Ds4A_jD4appqj
SUPABASE_PROJECT_ID=tycnbtycdjgwjmjfdwtm

# Any random string — used to hash signals
ANVIX_SIGNAL_PEPPER=change-me-to-any-random-string-123

# Optional — leave empty for basic local run
# LOVABLE_API_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
```

### About the two optional keys

- `LOVABLE_API_KEY` — powers the AI-generated explanation. Not accessible outside Lovable Cloud. If empty, scans still work; only the AI summary line won't render.
- `SUPABASE_SERVICE_ROLE_KEY` — used for a few privileged writes. Not accessible outside Lovable Cloud. If empty, the app still runs; most user flows are fine.

**For a college demo, run without them — everything visible in the UI still works.** If you need full parity, create your own free Supabase project + your own AI provider key later.

## 5. Start the dev server

```bash
bun run dev
```

Open **http://localhost:8080** — you'll see the same app as the Lovable preview, connected to the same database.

## 6. Chrome extension (test locally)

1. In the project, the ZIP is at `public/anvix-scanner-v1.0.0.zip`.
2. Unzip it.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the unzipped folder.
6. Right-click any job posting text on a website → **Scan with Anvix**.

## 7. Deploy to Vercel (optional)

Not recommended — the project targets Cloudflare Workers. If you want Vercel, it needs a separate migration (change build preset, edit `src/server.ts`, retest). Keep it on Lovable for the demo.

## Troubleshooting

- **`bun: command not found`** → restart your terminal after installing Bun.
- **Port 8080 in use** → run `bun run dev -- --port 3000`.
- **Blank page / auth errors** → double-check `.env` values are exact, no quotes needed.
- **Never commit `.env`** to GitHub — it's already in `.gitignore`.
