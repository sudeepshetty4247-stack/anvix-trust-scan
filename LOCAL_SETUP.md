# ANVIX — Complete Local Setup Guide

Zero-assumption, step-by-step instructions to clone ANVIX and run it on your laptop (Windows / macOS / Linux). Follow this top-to-bottom and the app will be running at **http://localhost:5173** in under 10 minutes — identical to the Lovable preview.

---

## 1. Prerequisites

| Tool | Why | Verify |
|---|---|---|
| **Node.js 20+ (LTS)** | JavaScript runtime | `node -v` |
| **Bun** (recommended) | Fast package manager | `bun -v` |
| **Git** | Clone the repo | `git -v` |
| Modern browser | Open the app | — |

Install:
- **Node.js** → https://nodejs.org/en/download (LTS installer)
- **Bun**
  - macOS / Linux: `curl -fsSL https://bun.sh/install | bash`
  - Windows (PowerShell): `powershell -c "irm bun.sh/install.ps1 | iex"`
  - Restart your terminal, then `bun -v`
- **Git** → https://git-scm.com/downloads

> No Bun? `npm` (bundled with Node) works — replace every `bun` with `npm run`.

---

## 2. Get the code

**Option A — GitHub (recommended)**

In the Lovable editor: bottom-left **+** menu → **GitHub** → **Connect project** → authorize → **Create Repository**. Copy the URL, then:

```bash
git clone <your-repo-url>
cd anvix-trust-scan
```

**Option B — Download ZIP**

Lovable editor → **Download codebase** at the bottom of the file tree → unzip → `cd` into the folder.

---

## 3. Install dependencies

```bash
bun install
# or: npm install
```

Takes 30–90 seconds. If it fails:

```bash
rm -rf node_modules bun.lockb   # Windows: rmdir /s /q node_modules
bun install
```

---

## 4. Create your `.env` file

Create a file named exactly `.env` in the project root and paste:

```bash
# --- Client (publishable — safe to commit) ---
VITE_SUPABASE_URL="https://tycnbtycdjgwjmjfdwtm.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_SzeSzI_jL5nofnzd92Ds4A_jD4appqj"
VITE_SUPABASE_PROJECT_ID="tycnbtycdjgwjmjfdwtm"

# --- Server (same values, needed by server functions) ---
SUPABASE_URL="https://tycnbtycdjgwjmjfdwtm.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_SzeSzI_jL5nofnzd92Ds4A_jD4appqj"
SUPABASE_PROJECT_ID="tycnbtycdjgwjmjfdwtm"

# --- Server-only secrets ---
LOVABLE_API_KEY=""             # required for AI features (see step 5)
ANVIX_SIGNAL_PEPPER=""         # any random 32+ char string
```

| Env var | Purpose | If missing |
|---|---|---|
| `VITE_SUPABASE_*` | Client Supabase connection | App won't start |
| `SUPABASE_*` | Server functions (SSR) | Server calls fail |
| `LOVABLE_API_KEY` | Ask ANVIX, Trap-Reply, AI report explanations | AI features return 401; score still computes |
| `ANVIX_SIGNAL_PEPPER` | Hashing shared threat intel | Global-signal writes fail silently |

> `SUPABASE_SERVICE_ROLE_KEY` is **not** exposed on Lovable Cloud — leave it out. The app doesn't need it locally.

---

## 5. Get your `LOVABLE_API_KEY` (the only AI key you need)

ANVIX calls the **Lovable AI Gateway**, which internally routes to Gemini / OpenAI / other models. You do **not** need a separate Gemini or OpenAI API key.

1. Open your project in the Lovable editor.
2. Click **Cloud** (top bar) → **Settings** → **Secrets**.
3. Find `LOVABLE_API_KEY` in the list.
4. Click the **⋯** menu → **Rotate** → **Copy** the newly shown value.
5. Paste it into `.env` between the quotes on the `LOVABLE_API_KEY=""` line.
6. Save the file.

For `ANVIX_SIGNAL_PEPPER`, generate any random string:

```bash
openssl rand -hex 32
# or on Windows PowerShell:
[Convert]::ToHexString((1..32 | %{[byte](Get-Random -Max 256)}))
```

Paste the output into `ANVIX_SIGNAL_PEPPER=""`.

---

## 6. Start the dev server

```bash
bun dev
# or: npm run dev
```

Open **http://localhost:5173** in your browser. The ANVIX landing page loads.

> The Lovable preview URL and your localhost run share the **same** database, auth, and stored investigations — sign in with the same account on both.

---

## 7. Smoke test (60 seconds)

1. Landing page loads → click **Get started** (routes to `/auth`).
2. Sign up with **email + password** (Google note in step 8).
3. You land on `/dashboard`.
4. Click **New investigation** → paste a suspicious message → **Run investigation**.
5. Watch the activity log stream live; a Trust Score appears in 10–30 seconds.
6. Open `/ask` → ask ANVIX anything → you get a streaming answer.

All six pass → your setup is healthy.

---

## 8. Google sign-in on localhost

The managed Google OAuth client is registered for the deployed domain, not `http://localhost:5173`. Simplest fix: **use email + password locally**. Everything else works identically.

If you must have Google locally, open the Lovable editor → **Cloud → Users → Auth Settings → Google** and add `http://localhost:5173` to authorized redirect origins.

---

## 9. (Optional) Retrain the ML model

Coefficients are already exported to JSON and shipped with the app. To retrain:

```bash
cd ml
pip install scikit-learn pandas numpy
python train_ensemble.py
```

This regenerates `model_coefficients.json`, `forest_model.json`, `metrics.json`. Restart `bun dev` afterwards. Training needs the Kaggle *Fake Job Postings* (EMSCAD) dataset at `ml/fake_job_postings.csv`.

---

## 10. Useful scripts

| Command | What it does |
|---|---|
| `bun dev` | Dev server with hot reload (port 5173) |
| `bun run build` | Production build |
| `bun run preview` | Serve the production build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |

---

## 11. Common errors → fixes

| Symptom | Cause | Fix |
|---|---|---|
| `Failed to resolve import "..."` | Deps not installed | `bun install` again |
| `EADDRINUSE: port 5173` | Something else on 5173 | `PORT=5174 bun dev` |
| Blank page after sign-in | Stale session | DevTools → Application → Local Storage → clear `sb-*` keys → hard-refresh |
| AI features return 401 / "unauthorized" | `LOVABLE_API_KEY` missing/invalid | Redo step 5, restart `bun dev` |
| `Expected 3 parts in JWT; got 1` | Wrong Supabase key in `VITE_*` | Value must start with `sb_publishable_` |
| Windows: `bun` not recognized | PATH not refreshed | Close + reopen terminal, or reboot |
| `.env` values ignored | Wrong filename/location | Must be exactly `.env` in project root (not `.env.txt`) |
| Realtime activity log frozen | Ad-blocker blocking WebSockets | Whitelist `*.supabase.co` |

---

## 12. Codebase tour

See **`PROJECT_WALKTHROUGH.md`** for folders, database schema, scoring math, ML pipeline, and every route.

---

## 13. Push changes back to Lovable

**If cloned from GitHub:**

```bash
git add .
git commit -m "your changes"
git push
```

Lovable's GitHub sync is bidirectional — commits appear in the editor within seconds.

**If you downloaded a ZIP:** connect the project to GitHub first (Lovable editor → **+** → GitHub → Connect), then clone and copy your edits.

---

You're set. Run `bun dev`, open **http://localhost:5173**. 🎯

_Developed by **Swathi P R**._
