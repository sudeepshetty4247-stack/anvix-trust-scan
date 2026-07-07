# Running Anvix locally — the honest truth

You're right. Let me be straight with you instead of over-promising.

## What the project uses right now

- **Database + Auth + Storage** → Lovable Cloud (which is Supabase under the hood)
- **AI (the "why is this a scam" explanation, evidence extraction)** → Lovable AI Gateway, using the `LOVABLE_API_KEY` that Lovable auto-provisions
- **Everything else** → normal frontend + server functions

## The hard fact about keys

Two secrets **cannot be exported** from Lovable Cloud, no matter what:

1. `LOVABLE_API_KEY` — this is what powers the AI. It only works on Lovable's own servers.
2. `SUPABASE_SERVICE_ROLE_KEY` — used for a few admin writes.

So "run 100% locally with zero setup" is **not possible**. Any local run needs at least one thing from outside.

## Your three realistic options

### Option 1 — Best for a college demo (recommended)
**Don't run it locally. Keep it on Lovable and just show the live URL.**

- Live URL: `https://anvix-trust-scan.lovable.app`
- Zero setup, zero keys, everything already works — AI, database, extension backend.
- For your college submission: screen-record a walkthrough + share the URL + show the code on GitHub.
- This is what 90% of Lovable college projects do.

### Option 2 — Run locally, AI features off
- Clone the repo, `bun install`, use the public keys from `.env`, `bun run dev`.
- Landing page, sign-in, dashboard, scan submission, database reads/writes — **all work**.
- What breaks: the AI-generated "explanation" line inside a scan report, and evidence auto-extraction from screenshots/PDFs.
- No third-party accounts needed.

### Option 3 — Run locally with full AI (one free signup)
- Same as Option 2, plus:
- Sign up at **Google AI Studio** (`aistudio.google.com/apikey`) — free, no credit card, takes 2 minutes. This gives you a Gemini API key.
- Change one file (`src/lib/ai-gateway.server.ts`) to point at Google's endpoint instead of Lovable's.
- Everything works, including AI.
- This is the only way to get 100% parity locally.

## What I recommend for you

Go with **Option 1**. Reasons:
- It's a college project — the goal is to show it works, not to prove you can deploy it.
- Lovable already hosts it for free on a public URL.
- No local setup risk on your laptop the night before the demo.
- You still show the full source code on GitHub if the college wants it.

If your college specifically requires it to run on your laptop during evaluation, then go with **Option 2** (no external accounts needed — you just lose the AI paragraph, which is one line of text).

Only go with **Option 3** if you specifically want the AI running locally and don't mind the 2-minute Google signup.

## What I'll do next (if you approve)

Rewrite `LOCAL_SETUP.md` to reflect this reality — remove the "full parity, no compromise" promise, and clearly present Options 1, 2, 3 so future-you (or your evaluator) isn't confused.

**Tell me which option you want and I'll finalize the doc.**
