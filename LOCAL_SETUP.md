# ANVIX — Complete Local Setup Guide

Zero-assumption, step-by-step instructions to clone ANVIX and run it on your own laptop (Windows / macOS / Linux). If a fresh laptop follows this doc top-to-bottom, ANVIX will be running at `http://localhost:3000` in under 10 minutes.

---

## 1. Prerequisites — install these first

| Tool | Why | Check it works |
|---|---|---|
| **Node.js 20+ (LTS)** | JavaScript runtime | `node -v` |
| **Bun** (recommended) | Fast package manager the project uses | `bun -v` |
| **Git** | To clone the repo | `git -v` |
| **VS Code** (optional) | Editor | — |
| A modern browser | To open the app | — |

**Install Node.js:** https://nodejs.org/en/download (pick the LTS installer).

**Install Bun:**
- macOS / Linux:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- Windows (PowerShell):
  ```powershell
  powershell -c "irm bun.sh/install.ps1 | iex"
  ```
- Restart your terminal after installing, then verify with `bun -v`.

**Install Git:** https://git-scm.com/downloads

> If you don't want to install Bun, `npm` (bundled with Node.js) works too — just swap `bun` for `npm run` in every command.

---

## 2. Get the code

**Option A — clone from GitHub** (recommended; requires the project connected to GitHub in the Lovable editor first):

```bash
git clone <your-repo-url>
cd anvix-trust-scan
```

To connect the project to GitHub: in the Lovable editor, click the **+** menu (bottom-left of the chat) → **GitHub** → **Connect project** → authorize → **Create Repository**. Then copy the repo URL.

**Option B — download a ZIP** from the Lovable code editor:
1. Open the Lovable code editor
2. Click **Download codebase** at the bottom of the file tree
3. Unzip, then `cd` into the folder

---

## 3. Install dependencies

```bash
bun install
# or, if you're using npm:
npm install
```

Expected time: 30–90 seconds.

**If install fails:**
```bash
rm -rf node_modules bun.lockb   # or "del /s /q node_modules" on Windows
bun install
```

---

## 4. Create your `.env` file

Create a file named `.env` in the project root and paste this block:

```bash
# --- Client-side (safe to commit — publishable keys only) ---
VITE_SUPABASE_URL="https://tycnbtycdjgwjmjfdwtm.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_SzeSzI_jL5nofnzd92Ds4A_jD4appqj"
VITE_SUPABASE_PROJECT_ID="tycnbtycdjgwjmjfdwtm"

# --- Server-side (same values, needed by server functions) ---
SUPABASE_URL="https://tycnbtycdjgwjmjfdwtm.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_SzeSzI_jL5nofnzd92Ds4A_jD4appqj"
SUPABASE_PROJECT_ID="tycnbtycdjgwjmjfdwtm"

# --- Server-only secrets (optional — see table below) ---
LOVABLE_API_KEY=""             # required for AI features
ANVIX_SIGNAL_PEPPER=""         # any random 32+ char string
# SUPABASE_SERVICE_ROLE_KEY=""  # not available on Lovable Cloud — leave empty
```

### Which secret does what?

| Env var | Required for | Where to get it | If missing… |
|---|---|---|---|
| `VITE_SUPABASE_URL` | everything | already filled above | app won't start |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | everything | already filled above | app won't start |
| `VITE_SUPABASE_PROJECT_ID` | everything | already filled above | app won't start |
| `SUPABASE_URL` / `_PUBLISHABLE_KEY` / `_PROJECT_ID` | server functions (SSR) | same values as `VITE_*` | server functions fail |
| `LOVABLE_API_KEY` | Ask ANVIX, trap-reply, AI trust-report explanations | Lovable editor → project Settings (auto-provisioned) | AI features return an error; the score itself still works |
| `ANVIX_SIGNAL_PEPPER` | Hashing shared threat intel (`global_signals`) | any random string; generate with `openssl rand -hex 32` | global-signal writes may fail silently |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-only writes (very rare in this app) | not exposed on Lovable Cloud | skip — not needed for normal local use |

> The `VITE_*` values are **publishable** keys. RLS still protects every table, so committing them is safe.

---

## 5. Start the dev server

```bash
bun dev
# or: npm run dev
```

Open **http://localhost:3000** in your browser. You should see the ANVIX landing page.

---

## 6. First-run smoke test (make sure it actually works)

1. Landing page loads → click **Get started** or go to `/auth`.
2. Sign up with **email + password** (fastest path locally — see the Google note in section 7).
3. You land on `/dashboard`.
4. Click **New investigation**, paste a suspicious message (e.g. a fake job offer with a Gmail recruiter and a payment request), and hit **Run investigation**.
5. Watch the activity log stream live and the progress bar climb — a Trust Score appears within 10–30 seconds.
6. Try **Ask ANVIX** at `/ask` (needs `LOVABLE_API_KEY`).

If all six steps pass, your local setup is healthy.

---

## 7. Google sign-in on localhost

Managed Google OAuth is pre-configured for the deployed URL, not `http://localhost:3000`.

**Simplest fix:** use email + password locally.

**If you really want Google locally:** in the Lovable editor open **Cloud → Users → Auth Settings → Google** and add `http://localhost:3000` to the list of authorized redirect origins. (Custom OAuth clients need the same URL added in the Google Cloud Console.)

---

## 8. (Optional) Retrain the ML model

The trained model lives in `ml/`. Coefficients are already exported to JSON and shipped with the app, so you never *need* to retrain — but if you want to:

```bash
cd ml
pip install scikit-learn pandas numpy
python train_ensemble.py
```

This regenerates `model_coefficients.json`, `forest_model.json`, and `metrics.json`. Restart `bun dev` afterwards so the new coefficients are loaded.

You'll also need the training dataset (Kaggle *Fake Job Postings* — EMSCAD). Place it as `ml/fake_job_postings.csv` before running the script.

---

## 9. Useful scripts

| Command | What it does |
|---|---|
| `bun dev` | Dev server with hot reload (default port 3000) |
| `bun run build` | Production build |
| `bun run preview` | Serve the production build locally |
| `bun run lint` | Run ESLint |
| `bun run format` | Format everything with Prettier |

---

## 10. Common errors + fixes

| Symptom | Cause | Fix |
|---|---|---|
| `Failed to resolve import "..."` | Dependencies not installed | `bun install` again |
| `EADDRINUSE: port 3000` | Another app is on port 3000 | `PORT=3001 bun dev` (or kill the other process) |
| Blank page after sign-in | Stale session in localStorage | Open DevTools → Application → Local Storage → clear the `sb-*` keys → hard-refresh |
| AI features return 401 / "unauthorized" | `LOVABLE_API_KEY` missing or invalid | Fill it in `.env`, restart dev server |
| `Expected 3 parts in JWT; got 1` | Wrong Supabase key in a `VITE_*` var | Make sure it starts with `sb_publishable_` — never paste the service-role key into a `VITE_*` var |
| Windows: `bun` not recognized | PATH not refreshed | Close and reopen the terminal, or reboot |
| `.env` values ignored | File in wrong location or wrong name | Must be exactly `.env` in the **project root**, not `.env.txt` |
| Realtime activity log not updating | Ad-blocker blocking WebSockets | Whitelist `*.supabase.co` |

---

## 11. Architecture / codebase tour

For a full walkthrough of the folders, database, scoring math, ML pipeline, and every route — see **`PROJECT_WALKTHROUGH.md`** in the repo root. That's the doc to skim before your lecture.

---

## 12. Pushing your local changes back to Lovable

- **If you cloned from GitHub:** normal Git workflow.
  ```bash
  git add .
  git commit -m "your changes"
  git push
  ```
  Lovable's GitHub sync is bidirectional — your commits appear in the Lovable editor within seconds.

- **If you downloaded a ZIP:** you can't push back until you connect the project to GitHub first. Do that (Lovable editor → **+** → GitHub → Connect project), then `git clone` the new repo and copy your edits over.

---

You're set. Run `bun dev` and open http://localhost:3000. 🎯
