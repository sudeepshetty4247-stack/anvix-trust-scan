# ANVIX — Complete Project Walkthrough (for your lecture)

I'll create a single file `PROJECT_WALKTHROUGH.md` at the repo root that covers **everything**: tech stack, tools, folder-by-folder purpose, database, the full scoring math, the AI pieces, and the exact user journey from sign-in to trust report. Below is the full content you'll get — so you can review it before I write it.

---

## 1. What ANVIX is (one line)
A recruitment / payment fraud investigator: user uploads suspicious job offers, emails, URLs, screenshots → ANVIX runs domain/DNS/SSL/WHOIS + text NLP checks → a trained ML model + weighted engine produces a **Trust Score (0–100)**, a risk category, and a plain-English explanation with an action recommendation.

## 2. Tech Stack (what to say in the lecture)

| Layer | Tech | Why |
|---|---|---|
| Framework | **TanStack Start v1** (React 19 + Vite 7, SSR) | File-based routing, typed server functions |
| Language | TypeScript (strict) | Type safety end-to-end |
| Styling | **Tailwind v4** + shadcn/ui + Radix primitives | Design tokens in `src/styles.css` |
| Routing | `@tanstack/react-router` | File-based, type-safe links |
| Data fetching | `@tanstack/react-query` | Cache + loader integration |
| Backend runtime | Cloudflare Worker (edge) via `createServerFn` | Serverless RPC — no separate API server |
| Database / Auth / Storage | **Lovable Cloud** (Supabase under the hood — Postgres + RLS + Storage + Auth) | Managed |
| Auth methods | Email/password + **Google OAuth** (via Lovable broker) | |
| AI | **Lovable AI Gateway** → `google/gemini-2.5-flash` | Explanations, Ask ANVIX, trap replies |
| ML training | **Python** (`ml/train_ensemble.py`): scikit-learn — LogisticRegression, RandomForest, GradientBoosting | Trained offline on **EMSCAD / Kaggle Fake Job Postings** (17,880 rows, 866 fraud) |
| ML runtime | Pure TypeScript scorer (`src/lib/kaggle-model.ts` + `scoring.ts`) reads exported JSON coefficients | Runs at the edge, no Python in prod |
| PDF generation | `pdf-lib` | Trust report + Cybercrime FIR PDF |
| Validation | `zod` | Server function inputs |
| Icons | `lucide-react` | |

## 3. Folder map (what lives where)

```
src/
  routes/                       ← file-based routes (URL = filename)
    __root.tsx                  ← HTML shell, providers, auth listener
    index.tsx                   ← public landing page
    auth.tsx                    ← sign-in / sign-up (Email + Google)
    ask.tsx                     ← "Ask ANVIX" free-form chat
    investigate.tsx             ← create new investigation (guest OK)
    check-payment.tsx           ← UPI / payment scam scanner
    privacy.tsx
    r.$slug.tsx                 ← public shareable trust card
    api.public.card.$slug.tsx   ← public JSON API for shared cards
    _authenticated/             ← gated subtree (must be signed in)
      route.tsx                 ← auth gate (redirects to /auth)
      dashboard.tsx             ← list of user's investigations
      investigations.$id.tsx    ← single investigation view + live progress
  lib/                          ← business logic (server functions + pure utils)
    pipeline.functions.ts       ← THE core: runs the full investigation
    verification.server.ts      ← DNS / SSL / WHOIS / SPF / DMARC / text NLP
    scoring.ts                  ← weighted feature model → Trust Score
    kaggle-model.ts             ← loads trained ML coefficients (JSON)
    ask.functions.ts            ← Ask ANVIX (LLM Q&A)
    trap-reply.functions.ts     ← generates safe replies to scammers
    payment-scanner.functions.ts← UPI / QR / payment fraud checks
    fir-pdf.ts                  ← builds cybercrime FIR PDF
    report-pdf.ts               ← builds trust report PDF
    narrative.functions.ts      ← AI narrative generation
    forensics.functions.ts      ← image / metadata forensics
    global-signals.functions.ts ← cross-user threat intel
    evidence.functions.ts       ← upload + manage evidence
    investigations.functions.ts ← CRUD for investigations
    verification-live.functions.ts ← re-run individual checks
    playbooks.ts, verdict.ts, plain-language.ts ← presentation helpers
    ai-gateway.server.ts        ← Lovable AI provider factory
  components/                   ← React UI (AppShell, dialogs, cards, etc.)
  integrations/supabase/        ← auto-generated Cloud client + auth middleware
  hooks/                        ← useAuth, useHydrated, etc.
ml/                             ← OFFLINE model training (Python)
  train_ensemble.py             ← trains 3 models, picks best
  model_coefficients.json       ← exported LR weights → used in prod
  forest_model.json             ← exported RF trees → used in prod
  metrics.json                  ← precision / recall / F1 / AUC
  EVAL_REPORT.md
```

## 4. Database (Lovable Cloud / Postgres)

Every table has **Row-Level Security** — a user can only see their own rows. Tables:

| Table | Purpose |
|---|---|
| `investigations` | one row per investigation (status, progress, trust_score, risk_category) |
| `evidence` | uploaded items (URL, text, email, image, file) linked to an investigation |
| `activities` | live activity log — streamed to UI via realtime |
| `verifications` | one row per check performed (DNS, SSL, WHOIS, keyword, etc.) |
| `ml_predictions` | model output + feature vector + feature importance |
| `trust_reports` | final AI-written summary, positives, negatives, recommendation |
| `global_signals` | shared threat intel (scam domains/emails seen across users) |
| `investigation_signals` | links investigations to matched global signals |
| `public_reports` | shareable public trust cards |

Storage bucket: `evidence` (private) for uploaded screenshots/files.

## 5. THE full user journey (this is the story to tell)

### Step 1 — Sign in (`/auth`)
- Email/password **or** **Google** OAuth.
- Google flow: button calls `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` → Lovable's iframe-safe broker → Supabase Auth stores session in `localStorage`.
- `src/routes/__root.tsx` subscribes to `onAuthStateChange` and refreshes the router.

### Step 2 — Create investigation (`/investigate`)
- User pastes suspicious text, URLs, emails, or uploads screenshots.
- `evidence.functions.ts` writes each item to the `evidence` table (files go to Storage bucket).
- An `investigations` row is created with `status = 'pending'`.

### Step 3 — Run the pipeline (`pipeline.functions.ts` — the heart)
Everything below happens in **one server function** called from the UI. Progress is written back to the DB; the UI subscribes with realtime and animates the progress bar.

**a. Collect (5% → 20%)**
Loads all evidence rows for the investigation.

**b. Extract identifiers**
Regex-extracts every URL, domain, and email from the evidence corpus.

**c. Verify each domain in parallel (`verification.server.ts`)**
For every domain found:
- `checkDns` — resolves A/MX records (via public DNS-over-HTTPS)
- `checkEmailAuth` — fetches SPF & DMARC TXT records
- `checkWebsite` — HTTP HEAD/GET + SSL/HTTPS validity
- `checkWhois` — domain age (young domains = suspicious)
- `suspiciousTld` — flags `.xyz`, `.top`, `.click`, etc.
Each check returns a `{status, score 0–1, detail}` object and is inserted into `verifications`.

**d. Email analysis**
Flags free-mail recruiters (`gmail.com`, `yahoo.com` recruiters — a strong scam signal).

**e. Text NLP (`analyzeText`)**
- **Fraud keyword scan** — dictionary of scam terms
- **Urgency language** — "act now", "24 hours", "limited spots"
- **Payment / fee request** — "registration fee", "processing charge"
- **Cryptocurrency mention** — BTC/USDT/wallet patterns
- **Grammar quality** — heuristic on typos, spacing, capitalization

**f. Cross-source consistency**
Does the recruiter's email domain match the company website domain? (Legit companies match; scammers don't.)
Evidence diversity — more evidence types = higher confidence.

**g. Feature vector (17 features, all normalized 0–1)**
```
domain_age, ssl_valid, dns_valid, spf, dmarc,
official_email_match, website_reachable,
fraud_keywords, payment_request, crypto_mention, urgency_score,
grammar_quality, evidence_count, evidence_diversity,
cross_source_consistency, suspicious_tld, free_email_recruiter
```

**h. Scoring (`scoring.ts`)**
Weighted linear model — start at 50, add `feature × weight` for each:
- Positive weights: `domain_age +8`, `ssl_valid +6`, `official_email_match +6`, `cross_source_consistency +6`, `dns_valid +5`, `website_reachable +5`, `evidence_count +5`, `evidence_diversity +4`, `grammar_quality +4`, `spf +3`, `dmarc +3`
- Negative weights: `payment_request -15`, `fraud_keywords -12`, `crypto_mention -8`, `urgency_score -6`, `suspicious_tld -5`, `free_email_recruiter -4`

Clamp to 0–100 → **Trust Score**.

**Categories:** ≥85 Trusted · ≥70 Likely Safe · ≥55 Caution · ≥45 High Risk · <45 Fraudulent.

**Confidence:** based on how many of the 17 features had usable data (0.35–0.98).

**Feature importance:** `|contribution| / total` — shown as bars in the UI so the user sees *why*.

Result is written to `ml_predictions` (model tag: `ANVIX-Ensemble-v1`).

**i. AI explanation (Lovable AI Gateway → Gemini 2.5 Flash)**
Sends the score + features + findings as JSON, gets back:
- `summary` (2–4 sentences)
- `positive` findings
- `negative` findings
- `missing` evidence categories
- `recommendation` (one action sentence)
Falls back to a deterministic template if the LLM fails.
Written to `trust_reports`.

**j. Done**
`investigations.status = 'completed'`, `progress = 100`, trust_score & category saved.

### Step 4 — View the report (`/_authenticated/investigations/$id`)
- Live-updating list of activities and verifications (realtime).
- Score dial, category chip, positive/negative bullets, recommendation.
- **Download PDF** trust report (`report-pdf.ts`).
- **Generate cybercrime FIR** (`fir-pdf.ts`) — extracts scammer identifiers, applicable IPC/IT Act sections, `cybercrime.gov.in` filing guide.
- **Generate safe reply** (`trap-reply.functions.ts`) — LLM writes 3 short reply messages to safely extract more evidence.
- **Public share card** (`r.$slug.tsx`) — shareable link with a public JSON API.

### Step 5 — Extras
- **Ask ANVIX** (`/ask`) — paste any message, get instant LLM-graded verdict.
- **Payment scanner** (`/check-payment`) — checks UPI IDs / QR text for scam patterns.
- **Global signals** — matched scam identifiers propagate anonymously so future investigations spot repeat scammers.

## 6. ML — offline vs runtime (important for the lecture)

**Offline (Python, one-time):**
- Dataset: **EMSCAD / Kaggle Fake Job Postings** — 17,880 postings, 866 labeled fraud.
- Trained three models in `ml/train_ensemble.py`:
  1. Logistic Regression
  2. Random Forest
  3. Gradient Boosting
- Evaluated on precision, recall, F1, ROC-AUC (see `ml/metrics.json` + `EVAL_REPORT.md`).
- **Best model's coefficients exported to JSON** (`model_coefficients.json`, `forest_model.json`).

**Runtime (production, TypeScript, edge):**
- `kaggle-model.ts` loads the JSON at boot — no Python container needed.
- Combined with the deterministic weighted engine in `scoring.ts` for interpretability.
- This hybrid = fast (~ms), explainable, and cheap to host.

## 7. Security posture (worth mentioning)
- **RLS on every table** — a user cannot read another user's investigation even if they try.
- Server secrets (`LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANVIX_SIGNAL_PEPPER`) live only in the Worker env.
- `ANVIX_SIGNAL_PEPPER` — hashes global signals so scam identifiers are shared without leaking user data.
- Cybercrime FIR / trap replies gated to high-risk investigations only.

## 8. Q&A cheat sheet (likely questions)

- **"Is it real ML or just rules?"** — Both. Offline-trained scikit-learn models on 17k+ real fraud postings, plus a transparent weighted engine so every score is explainable.
- **"Why not run Python in production?"** — Edge deployment (Cloudflare Workers) = no Python runtime; we export trained coefficients to JSON and re-implement inference in TS. Result: <10ms scoring, no cold starts, no ML server bill.
- **"What if the AI hallucinates?"** — The score is computed deterministically from features. The LLM only writes the *explanation*, and it's constrained by JSON schema + a fallback template.
- **"How do you get domain age / SSL without paid APIs?"** — DNS-over-HTTPS + direct HTTPS handshake + public WHOIS endpoints, all callable from the edge Worker.
- **"How is it different from a spam filter?"** — Multi-signal: infrastructure (DNS/SSL/WHOIS) + content (NLP) + behavior (payment/urgency) + cross-source consistency, not just text.

---

## What I'll do when you approve

Create **one file**: `PROJECT_WALKTHROUGH.md` at the repo root, containing exactly the sections above (fleshed out into full prose with the tables and code-style diagrams). No code changes, no new features — pure documentation for your lecture.
