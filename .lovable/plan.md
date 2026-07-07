## Goal
Stop feature work. Ship what exists: fix Google sign-in, get the project on GitHub, and make it runnable on the user's laptop.

## 1. Fix Google authentication
- Verify the sign-in button calls `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` (managed Cloud OAuth) instead of raw `supabase.auth.signInWithOAuth`.
- Run `supabase--configure_social_auth` with `providers: ["google"]` so the Google provider is actually enabled on the backend (most common cause of "Unsupported provider" / silent failure).
- Confirm the auth page passes the intended-destination through a public callback, not a protected route.
- Test the flow end-to-end from the preview and share the result.

## 2. Push to GitHub
GitHub connection has to be authorized by you (Lovable can't do it for you):
1. In the editor, open the **+** menu (bottom-left of the chat) → **GitHub** → **Connect project**.
2. Authorize the Lovable GitHub App and pick the account/org.
3. Click **Create Repository**. Sync is two-way after that.

I'll confirm on my side that the repo shows all current code once you've done step 1–3.

## 3. Run locally
I'll add a short `README.md` with the exact steps:

```bash
git clone <your-repo-url>
cd <repo>
bun install       # or: npm install
bun dev           # or: npm run dev
```

Plus the two env vars needed for the frontend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) — I'll list the values from your project's `.env` so you can drop them into a local `.env` file.

Note: server-only secrets (`LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANVIX_SIGNAL_PEPPER`) are not exposed by Lovable Cloud. For features that use them (Ask ANVIX, FIR PDF, trap replies) to work locally, you'll need to set your own values in local `.env`. I'll document which var each feature needs.

## Out of scope
No new features. No UI redesign. No new tables or edge functions.
