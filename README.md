# ANVIX — Trust Scanner

Investigate suspicious job offers, messages, and payment requests. Built on TanStack Start + Lovable Cloud (Supabase).

## Run locally

### 1. Clone
```bash
git clone <your-repo-url>
cd anvix-trust-scan
```

### 2. Install dependencies
```bash
bun install
# or: npm install
```

### 3. Create `.env` in the project root
Copy the block below. These are **publishable** keys — safe to commit if you want.

```bash
VITE_SUPABASE_URL="https://tycnbtycdjgwjmjfdwtm.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_SzeSzI_jL5nofnzd92Ds4A_jD4appqj"
VITE_SUPABASE_PROJECT_ID="tycnbtycdjgwjmjfdwtm"

# Same values, needed server-side too:
SUPABASE_URL="https://tycnbtycdjgwjmjfdwtm.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_SzeSzI_jL5nofnzd92Ds4A_jD4appqj"
SUPABASE_PROJECT_ID="tycnbtycdjgwjmjfdwtm"

# Server-only secrets (get your own values — not shared here):
# LOVABLE_API_KEY=...          # needed by Ask ANVIX, Trap-Reply, investigations AI
# SUPABASE_SERVICE_ROLE_KEY=... # needed for admin writes (get from Supabase dashboard)
# ANVIX_SIGNAL_PEPPER=...       # any random 32+ char string
```

### 4. Start the dev server
```bash
bun dev
# or: npm run dev
```

Open http://localhost:3000

## Notes

- **Google sign-in** works out of the box in the deployed app. Locally it needs the same Supabase project's OAuth config — sign-in with **email + password** is easiest for local dev.
- **AI-powered features** (Ask ANVIX, Trap-Reply, verdict summaries) need `LOVABLE_API_KEY`. Without it, those pages will show an error.
- The database, RLS, and auth all point at the same Lovable Cloud backend. Anything you create locally will appear in the deployed app too.

## Push to GitHub

In the Lovable editor: click **+** (bottom-left of the chat) → **GitHub** → **Connect project** → authorize → **Create Repository**. Sync is bidirectional after that.

## Tech stack

TanStack Start · React 19 · Tailwind v4 · shadcn/ui · Supabase (Lovable Cloud) · Lovable AI Gateway
