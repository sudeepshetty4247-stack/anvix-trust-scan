# Run Anvix locally on your system

Goal: get the whole project (frontend + server functions + database + AI) running on your laptop, using the same Lovable Cloud backend so nothing breaks.

## What you need installed (one time)
- Node.js 20+ (https://nodejs.org)
- Bun (https://bun.sh — `curl -fsSL https://bun.sh/install | bash`)
- Git
- VS Code (or any editor)

## Steps

### 1. Get the code
- In Lovable, click GitHub → Connect to GitHub → Create Repository.
- On your laptop: `git clone <your-repo-url>` then `cd <folder>`.

### 2. Install dependencies
```
bun install
```

### 3. Create a `.env` file in the project root
The project needs these variables. I will give you the exact names; values come from Lovable (Project → Settings → Cloud, or I can list the public ones for you):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
LOVABLE_API_KEY=...
ANVIX_SIGNAL_PEPPER=any-random-string
```

- The `VITE_*` and public URL/keys are safe to share — I can print them for you.
- `SUPABASE_SERVICE_ROLE_KEY` and `LOVABLE_API_KEY` are **not accessible** on Lovable Cloud, so for full local functionality (AI explanations, admin writes) you have two choices:
  - **Option A (easiest):** Run locally *without* those two — the app boots, landing page works, scans that only need public reads work. AI-generated explanation and privileged writes will fail.
  - **Option B (full parity):** Create your own free Supabase project + your own AI provider key (OpenAI/Gemini) and point the app at it. This is a bigger change.

### 4. Run the dev server
```
bun run dev
```
Open http://localhost:8080 — same app as the Lovable preview.

### 5. Database
- Stays on Lovable Cloud (no local Postgres needed).
- Your local app connects to it via the same URL/keys.
- No migration or data copy required.

### 6. Chrome extension (local test)
- Already built in `public/anvix-scanner-v1.0.0.zip`.
- Unzip → `chrome://extensions` → Developer mode → Load unpacked.
- It will call your local `http://localhost:8080` if you edit `extension/manifest.json` host, otherwise it hits the published URL.

## What I need from you before writing the final plan
1. Do you want **Option A** (quick local run, some AI features off) or **Option B** (full parity with your own Supabase + AI key)?
2. Are Node and Bun already installed on your laptop, or do you want install instructions for your OS (Windows / Mac / Linux)?

Once you answer, I will finalize the exact commands and `.env` contents for your machine.
