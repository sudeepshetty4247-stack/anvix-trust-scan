# Complete Local Setup Guide — `LOCAL_SETUP.md`

I'll create **`LOCAL_SETUP.md`** at the repo root — a step-by-step, zero-assumption guide so you (or anyone) can clone the repo and run ANVIX on a fresh laptop. It expands on the existing short `README.md` with full detail, common errors, and the exact commands for Windows / macOS / Linux.

## What the file will cover

### 1. Prerequisites (what to install first)
- **Node.js 20+** (LTS) — check with `node -v`
- **Bun** (recommended — the project uses it) — install command for macOS/Linux (`curl -fsSL https://bun.sh/install | bash`) and Windows (`powershell -c "irm bun.sh/install.ps1 | iex"`)
- **Git** — check with `git -v`
- **VS Code** (optional, recommended editor)
- A modern browser (Chrome / Edge / Firefox)

### 2. Get the code (two options)
- **Option A — from GitHub** (after you connect the project to GitHub in the Lovable editor): `git clone <your-repo-url>` then `cd anvix-trust-scan`
- **Option B — download ZIP** from Lovable code editor → Download codebase, then unzip

### 3. Install dependencies
```bash
bun install
# or if you don't want Bun:
npm install
```
Expected time: 30–90 seconds. Common fix if it fails: delete `node_modules` + `bun.lockb`, retry.

### 4. Create the `.env` file
Full ready-to-paste block with the project's publishable keys (safe to commit) plus placeholders for server-only secrets. Explains **which feature breaks if you skip which secret** so you know what's optional:

| Env var | Required for | Where to get it |
|---|---|---|
| `VITE_SUPABASE_URL` | everything | already known — copy from guide |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | everything | already known |
| `VITE_SUPABASE_PROJECT_ID` | everything | already known |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PROJECT_ID` | server functions | same values as above |
| `LOVABLE_API_KEY` | Ask ANVIX, trap-reply, AI explanations | Lovable editor → Settings (skip = those features error out gracefully) |
| `SUPABASE_SERVICE_ROLE_KEY` | admin writes (rare, skip for local) | not available on Lovable Cloud — leave blank locally |
| `ANVIX_SIGNAL_PEPPER` | global-signals hashing | any random 32+ char string (or run `openssl rand -hex 32`) |

### 5. Start the dev server
```bash
bun dev
# or: npm run dev
```
Open `http://localhost:3000`.

### 6. First-run smoke test (verify it actually works)
- Homepage loads → visit `/auth`
- Sign up with **email + password** (recommended for local; Google OAuth explained below)
- Land on `/dashboard`
- Click **New investigation**, paste a test message, run pipeline
- Watch the live progress + activity log — trust score appears

### 7. Google sign-in locally (troubleshooting section)
- Managed Google OAuth is configured for the deployed origin. For localhost, either:
  - Use email/password locally (simplest), OR
  - Add `http://localhost:3000` as an authorized redirect origin (explained in Lovable Cloud → Users → Auth Settings → Google)

### 8. Optional: retrain the ML model
```bash
cd ml
pip install scikit-learn pandas numpy
python train_ensemble.py
```
Regenerates `model_coefficients.json`, `forest_model.json`, `metrics.json`.

### 9. Useful scripts
| Command | What it does |
|---|---|
| `bun dev` | dev server with hot reload |
| `bun run build` | production build |
| `bun run preview` | preview the production build |
| `bun run lint` | run ESLint |
| `bun run format` | format all files with Prettier |

### 10. Common errors + fixes
- **"Failed to resolve import"** → run `bun install` again
- **Port 3000 in use** → `PORT=3001 bun dev`
- **Blank page after sign-in** → clear `localStorage` in DevTools, hard-refresh
- **AI features throwing 401** → `LOVABLE_API_KEY` missing or invalid
- **`Invalid JWT / Expected 3 parts`** → wrong Supabase key type; make sure you're using the **publishable** key, not the service role key, in `VITE_*` vars
- **Windows PowerShell script errors** → run the terminal as admin the first time; use PowerShell 7+

### 11. Folder tour (quick reminder)
One-paragraph pointer to `PROJECT_WALKTHROUGH.md` for the full architecture.

### 12. Pushing your local changes back
- If you cloned from GitHub: standard `git add / commit / push`; changes auto-sync to Lovable.
- If you downloaded ZIP: connect the project to GitHub first (Lovable editor → **+** → GitHub → Connect project), then clone that repo and start over.

---

## What I'll do when you approve
- Create **one new file**: `LOCAL_SETUP.md` at the repo root, with the sections above written out in full prose (no code changes, no dependency changes).
- Leave the existing short `README.md` untouched.
