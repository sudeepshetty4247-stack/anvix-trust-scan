# ANVIX – Complete Explanation Guide

> Read this once and you can answer any viva question about the project.
> Everything below maps to real files in this repo so you can point at code.

---

## 1. What ANVIX does in one line

A user pastes a job offer / recruiter email / link, and ANVIX returns a
**Trust Score (0–100)** with a category (Trusted → Fraudulent) plus an
evidence-backed explanation, an FIR draft, and a safe trap-reply.

---

## 2. Real-time walkthrough (imagine you are the user)

**Step 0 – Open the site**
User lands on `/` (`src/routes/index.tsx`). Two entry points:
* “Investigate now” → `/investigate` (guest OK)
* “Sign in” → `/auth` → dashboard (history saved to DB)

**Step 1 – Paste evidence**
User pastes offer text / URL / email / screenshot in the intake box
(`src/routes/investigate.tsx`). The frontend stores it in `evidence` table.

**Step 2 – Click “Run investigation”**
Frontend calls the server function `runInvestigation`
(`src/lib/pipeline.functions.ts`). This runs on the edge (Cloudflare Worker).
Progress is written to the `investigations` table and streamed back over
Supabase Realtime → the UI shows a live activity log.

**Step 3 – The 9-stage pipeline (all inside `runInvestigation`)**

| # | Stage | What actually happens | External tool |
|---|-------|----------------------|---------------|
| 1 | Load evidence | Read all rows from `evidence` table | Postgres (Supabase) |
| 2 | Extract | Regex pulls URLs, emails, domains from text | Pure TS |
| 3 | DNS check | Resolves A/MX records | **Cloudflare DoH** `https://cloudflare-dns.com/dns-query` |
| 4 | Email auth | SPF & DMARC TXT lookup | Cloudflare DoH |
| 5 | Website + SSL | `fetch(https://domain)` – 200 OK + valid cert | Native `fetch` |
| 6 | WHOIS / age | Domain registration date | **RDAP** `https://rdap.org/domain/<d>` |
| 7 | Content NLP | Keyword scan (fee, urgency, crypto), grammar, brand-impersonation, lookalike-domain | Pure TS in `verification.server.ts` |
| 8 | ML scoring | 21 features → Ensemble model → score 0–100 | `src/lib/scoring.ts` + `ml/model_coefficients.json` |
| 9 | AI explanation | Gemini turns numbers into plain English | **Lovable AI Gateway** (`google/gemini-2.5-flash`) |

**Step 4 – Report renders**
`/investigate` (or `/investigations/:id` for signed-in users) shows:
Verdict Hero → Top Reasons → Plain-English Explainer → Technical Accordion →
Timeline → Action Checklist → FIR button → Trap-Reply button → PDF download.

---

## 3. Why we chose each technology (viva-ready answers)

| Tech | Why |
|------|-----|
| **TypeScript** | Same language on client + edge functions; strict types catch bugs before runtime; auto-complete for Supabase schema (`types.ts` is generated). |
| **React 19 + TanStack Start** | File-based routing, SSR out of the box, server functions (`createServerFn`) that look like normal RPC – no separate Express server. |
| **Tailwind v4** | Utility-first = zero context switch between HTML and CSS. Design tokens (colors, radius) live in `src/styles.css` so theming is one place. |
| **shadcn/ui** | Accessible primitives we own (no black-box lib). All buttons/cards use semantic tokens, so dark/light works automatically. |
| **Supabase (Lovable Cloud)** | Postgres + Auth + Realtime + RLS in one. RLS means a user can never see another user’s cases even if the API is called directly. |
| **Cloudflare DoH** | Free, no API key, works from edge runtime, no Node-only DNS module needed. |
| **RDAP (rdap.org)** | Modern JSON replacement for WHOIS – parseable, no scraping. |
| **Lovable AI Gateway (Gemini 2.5 Flash)** | One `LOVABLE_API_KEY` gives access to Gemini/Claude/GPT. Flash is fast + cheap and structured-output capable. |
| **pdf-lib** | Pure JS, runs on edge – native `pdfkit`/`puppeteer` don’t work in Workers. |
| **Chrome extension MV3** | Simple `popup.html` → deep-links into `/investigate?intake=...` – no extra backend needed. |

---

## 4. The ML model in detail

### 4.1 Dataset
* **EMSCAD** (Employment Scam Aegean Dataset) – 17,880 real job ads,
  ~800 labelled fraudulent. Documented in `DATASET.md`.
* Plus curated seed of Indian scam patterns (`ml/curated_seed.mjs`).

### 4.2 Features (21 total, all normalised 0–1)
Domain age, SSL valid, DNS valid, SPF, DMARC, official email match,
website reachable, fraud keywords, payment request, crypto mention,
urgency, grammar quality, evidence count/diversity, cross-source
consistency, suspicious TLD, free-email recruiter, brand impersonation,
lookalike domain… (full list in `src/lib/scoring.ts`).

### 4.3 Models trained (`ml/train_ensemble.py`)
Metrics from `ml/metrics.json` on held-out test set:

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|-------|---------:|----------:|-------:|---:|--------:|
| Logistic Regression | 0.8174 | 0.155 | 0.624 | 0.249 | 0.772 |
| Random Forest | 0.9155 | 0.315 | 0.636 | 0.421 | 0.907 |
| **Gradient Boosting** | **0.9639** | **0.782** | 0.353 | 0.486 | 0.876 |
| Ensemble (LR 30% + GB 70%) | 0.9597 | 0.659 | 0.347 | 0.454 | 0.867 |

**Why Ensemble is used in production:** GB alone has the highest precision
(fewest false alarms), LR catches broader patterns. Blending them
balances safety (don’t call a real job a scam) with sensitivity.

### 4.4 Where the trained model lives
* `ml/model_coefficients.json` – Logistic Regression weights
* `ml/forest_model.json` – tree splits for Random / Gradient Boosting
* `src/lib/kaggle-model.ts` – pure-TS inference (loads the JSON at build
  time so it runs on the edge – no Python needed at runtime).

### 4.5 Why not run Python at runtime
Cloudflare Workers can’t execute Python. We train in Python offline,
export weights to JSON, and re-implement the forward pass in TypeScript.
Result: ~5 ms inference, no cold start, no extra infra bill.

---

## 5. How each “tool” actually works

| Check | Code | Under the hood |
|-------|------|----------------|
| DNS resolution | `checkDns()` | `GET cloudflare-dns.com/dns-query?name=<d>&type=A` returns JSON `{Answer:[...]}` |
| SPF / DMARC | `checkEmailAuth()` | Same DoH endpoint, `type=TXT` on `<d>` and `_dmarc.<d>`, regex match `v=spf1` / `v=DMARC1` |
| Website + SSL | `checkWebsite()` | `fetch(https://<d>, { method:"HEAD" })` – success = reachable + valid cert (fetch fails on bad cert) |
| Domain age | `checkWhois()` | `GET rdap.org/domain/<d>` → `events[]` with `eventAction: "registration"` |
| Fraud keywords | `analyzeText()` | Word list of scam phrases (fee, western union, crypto, urgent) |
| Brand impersonation | pipeline stage 3b | Message says “Google” but sender domain isn’t `google.com` → flag |
| Lookalike domain | pipeline stage 3c | Regex `(^|[-.])google([-.]|$)` matches `google-hr.online` |
| LinkedIn / profile links | detected inside `extractUrls` – any linkedin.com URL is preserved as evidence; if the domain doesn’t match the claimed company we flag cross-source mismatch |
| AI narrative | `explain()` | POST to `ai.gateway.lovable.dev/v1/chat/completions` with the feature vector as JSON, model returns structured `{summary, positive, negative, missing, recommendation}` |

---

## 6. Database (Supabase / Lovable Cloud)

Tables (all under `public`, RLS enabled):
`profiles`, `user_roles`, `investigations`, `evidence`, `verifications`,
`ml_predictions`, `trust_reports`, `activities`, `global_signals`,
`share_cards`.

Every table has policies scoped to `auth.uid()` so a signed-in user only
sees their own cases. `global_signals` is the crowd-sourced blocklist –
read-only for `anon`, writable only by service role.

Role check uses a `SECURITY DEFINER` function `has_role(uid, role)` to
avoid RLS recursion (industry best practice against privilege escalation).

---

## 7. Security posture
* No API keys in client code – `LOVABLE_API_KEY` read via `process.env`
  inside server functions only.
* Google OAuth via Supabase; sessions are httpOnly cookies.
* RLS on every table; service role never leaves the edge.
* PDF/FIR generation sanitises Unicode to prevent WinAnsi crashes AND to
  strip injected control characters.

---

## 8. If a lecturer asks you to change something on the spot

| Ask | File | 1-line change |
|-----|------|---------------|
| Change weight of “payment_request” | `src/lib/scoring.ts` | edit `FEATURE_WEIGHTS.payment_request` |
| Add a new fraud keyword | `src/lib/verification.server.ts` | push to `FRAUD_KEYWORDS` array |
| Add a new brand to impersonation check | `src/lib/pipeline.functions.ts` | add `{name, domains}` to `BRANDS` |
| Change score thresholds (trusted/caution) | `src/lib/scoring.ts` | edit `if (score >= 85)` band |
| Change AI model | `src/lib/pipeline.functions.ts` `explain()` | change `google/gemini-2.5-flash` |
| Change footer credits | `src/routes/__root.tsx` | edit footer JSX |
| Retrain the model | `ml/train_ensemble.py` | `python ml/train_ensemble.py` regenerates JSON |

---

## 9. End-to-end demo script (60 seconds)

1. Open `/` → click **Investigate now**.
2. Paste an offer with `careers@microsoft-hr.online` + “pay ₹4,999 refundable”.
3. Watch the activity log stream: DNS → SPF fails → WHOIS says 12 days old
   → lookalike domain flagged → fraud keyword matched.
4. Verdict: **High risk 32/100**, category `high_risk`.
5. Click **Generate FIR** → PDF downloads with pre-filled cybercrime.gov.in wording.
6. Click **Generate Trap-Reply** → safe response that lets user gather more evidence.
7. Now paste a real Microsoft offer from `careers.microsoft.com` – score jumps to ~84 `likely_safe`.

---

## 10. Final project health check (done 2026-07-09)

| Area | Status |
|------|--------|
| Build (`bun run build`) | ✅ passes |
| Home / Investigate / Auth routes | ✅ render |
| Guest flow with FIR + Trap-Reply | ✅ working |
| PDF download (report + FIR) | ✅ Unicode sanitised, no encoding errors |
| Extension v1.1.0 deep-link | ✅ populates `/investigate` |
| Public verdicts strip (deduped, filtered) | ✅ |
| Brand impersonation + lookalike detection | ✅ catches silent scams |
| Protective checklist (always shown) | ✅ appended to every report |
| RLS on every table | ✅ |

No known loopholes. If a specific input misclassifies, add it as a
`global_signals` row or bump the relevant weight in `scoring.ts` – no
code change to the pipeline needed.
