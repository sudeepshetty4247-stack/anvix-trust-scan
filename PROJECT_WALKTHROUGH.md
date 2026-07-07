# ANVIX — Complete Project Walkthrough

> A single reference doc covering **everything** about this project: what it is, the tech stack, every folder, the database, how the fraud score is computed, the AI pieces, and the exact user journey from sign-in to trust report. Use this to prepare for your lecture.

---

## 1. What ANVIX is (in one sentence)

ANVIX is a **recruitment & payment fraud investigator**. A user uploads suspicious job offers, emails, URLs, or screenshots, and ANVIX runs a full battery of infrastructure checks (DNS, SSL, WHOIS, SPF/DMARC), text NLP checks (fraud keywords, urgency, payment requests, crypto mentions, grammar), and cross-source consistency checks. A trained ML model plus a transparent weighted engine then produces a **Trust Score (0–100)**, a risk category, a feature-importance breakdown, and a plain-English AI-written explanation with a clear recommendation.

---

## 2. Tech Stack

| Layer | Technology | Why we chose it |
|---|---|---|
| **Framework** | TanStack Start v1 (React 19 + Vite 7, SSR) | File-based routing + typed server functions in one framework |
| **Language** | TypeScript (strict mode) | Type safety across UI, RPC, and DB |
| **Styling** | Tailwind CSS v4 + shadcn/ui + Radix primitives | Design tokens in `src/styles.css`, accessible components |
| **Routing** | `@tanstack/react-router` | File-based, type-safe `<Link>` |
| **Data fetching** | `@tanstack/react-query` | Loader + cache integration |
| **Backend runtime** | Cloudflare Worker (edge) via `createServerFn` | Serverless RPC — no separate API server |
| **Database / Auth / Storage** | Lovable Cloud (managed Postgres + RLS + Storage + Auth) | Zero-ops backend |
| **Auth methods** | Email/password + **Google OAuth** (via Lovable broker) | Fast onboarding |
| **AI (LLM)** | Lovable AI Gateway → `google/gemini-2.5-flash` | Explanations, Ask ANVIX, safe-reply generator |
| **ML training (offline)** | Python + scikit-learn — Logistic Regression, Random Forest, Gradient Boosting | Trained on the EMSCAD / Kaggle Fake Job Postings dataset (17,880 rows, 866 labeled fraud) |
| **ML runtime (production)** | Pure TypeScript scorer (`src/lib/kaggle-model.ts` + `scoring.ts`) that reads exported JSON coefficients | Runs at the edge — no Python container needed |
| **PDF generation** | `pdf-lib` | Trust reports + cybercrime FIR PDF |
| **Validation** | `zod` | Server function input validation |
| **Icons** | `lucide-react` | |

---

## 3. Folder Map (what lives where)

```
src/
  routes/                       ← file-based routes (URL = filename)
    __root.tsx                  ← HTML shell, providers, auth listener
    index.tsx                   ← public landing page
    auth.tsx                    ← sign-in / sign-up (Email + Google)
    ask.tsx                     ← "Ask ANVIX" free-form LLM chat
    investigate.tsx             ← create a new investigation (guest OK)
    check-payment.tsx           ← UPI / payment scam scanner
    privacy.tsx                 ← privacy policy
    r.$slug.tsx                 ← public shareable trust card
    api.public.card.$slug.tsx   ← public JSON API for shared cards
    _authenticated/             ← gated subtree (must be signed in)
      route.tsx                 ← auth gate (redirects to /auth)
      dashboard.tsx             ← list of the user's investigations
      investigations.$id.tsx    ← single investigation + live progress

  lib/                          ← business logic (server functions + pure utils)
    pipeline.functions.ts       ← THE CORE — runs the full investigation pipeline
    verification.server.ts      ← DNS / SSL / WHOIS / SPF / DMARC / text NLP helpers
    scoring.ts                  ← weighted feature model → Trust Score
    kaggle-model.ts             ← loads trained ML coefficients (JSON)
    ask.functions.ts            ← Ask ANVIX (LLM Q&A)
    trap-reply.functions.ts     ← generates safe replies to scammers
    payment-scanner.functions.ts← UPI / QR / payment fraud checks
    fir-pdf.ts                  ← builds cybercrime FIR PDF
    report-pdf.ts               ← builds trust-report PDF
    narrative.functions.ts      ← AI narrative generation
    forensics.functions.ts      ← image / metadata forensics
    global-signals.functions.ts ← cross-user threat intel
    evidence.functions.ts       ← upload + manage evidence
    investigations.functions.ts ← CRUD for investigations
    verification-live.functions.ts ← re-run individual checks on demand
    playbooks.ts, verdict.ts, plain-language.ts ← presentation helpers
    ai-gateway.server.ts        ← Lovable AI provider factory

  components/                   ← React UI (AppShell, dialogs, cards, etc.)
  integrations/supabase/        ← auto-generated Cloud client + auth middleware
  hooks/                        ← useAuth, useHydrated, etc.

ml/                             ← OFFLINE model training (Python — not shipped to prod)
  train_ensemble.py             ← trains 3 models, picks the best
  model_coefficients.json       ← exported LR weights → used in prod
  forest_model.json             ← exported RF trees → used in prod
  metrics.json                  ← precision / recall / F1 / AUC
  EVAL_REPORT.md                ← evaluation writeup
```

---

## 4. Database (Lovable Cloud / Postgres)

Every table has **Row-Level Security (RLS)** enabled — a user can only read/write their own rows.

| Table | Purpose |
|---|---|
| `investigations` | One row per investigation (status, progress, trust_score, risk_category, best_model) |
| `evidence` | Uploaded items (URL, text, email, image, file) linked to an investigation |
| `activities` | Live activity log — streamed to the UI via realtime subscription |
| `verifications` | One row per check performed (DNS, SSL, WHOIS, keyword, etc.) |
| `ml_predictions` | Model output + feature vector + feature-importance breakdown |
| `trust_reports` | Final AI-written summary, positives, negatives, recommendation |
| `global_signals` | Shared threat intel (scam domains/emails seen across users, peppered hash) |
| `investigation_signals` | Links investigations to matched global signals |
| `public_reports` | Publicly shareable trust cards |

**Storage bucket:** `evidence` (private) for uploaded screenshots and files.

---

## 5. The Full User Journey (this is the story to tell)

### Step 1 — Sign in (`/auth`)

- Choice of **Email/password** or **Google OAuth**.
- Google flow: the button calls
  `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`.
  This hits Lovable's iframe-safe OAuth broker, which returns to a public URL, hydrates the Supabase session in `localStorage`, and the router picks it up.
- `src/routes/__root.tsx` subscribes once to `supabase.auth.onAuthStateChange` and refreshes the router + query cache on `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED`.
- Protected routes live under `src/routes/_authenticated/`. Its `route.tsx` gate calls `supabase.auth.getUser()` client-side and redirects to `/auth` if unauthenticated.

### Step 2 — Create an investigation (`/investigate`)

- User pastes suspicious content: text, URLs, emails, or uploads screenshots.
- `evidence.functions.ts` writes each item to the `evidence` table. Files go to the private `evidence` storage bucket.
- An `investigations` row is created with `status = 'pending'`.

### Step 3 — Run the pipeline (`src/lib/pipeline.functions.ts` — the heart of ANVIX)

Everything below happens in **one server function** called from the UI. The function writes progress back to the DB continuously, and the UI subscribes via Postgres realtime to animate the progress bar and stream the activity log.

**a. Collect (5% → 20%)**
Loads all evidence rows for the investigation.

**b. Extract identifiers**
Regex-extracts every URL, domain, and email address from the combined evidence corpus.

**c. Verify each domain in parallel (`verification.server.ts`)**
For every domain found, run in parallel:
- `checkDns` — resolves A/MX records (via public DNS-over-HTTPS)
- `checkEmailAuth` — fetches SPF & DMARC TXT records
- `checkWebsite` — HTTP HEAD/GET + SSL/HTTPS validity check
- `checkWhois` — domain age (young domains = suspicious)
- `suspiciousTld` — flags low-reputation TLDs like `.xyz`, `.top`, `.click`, `.icu`

Each returns a `{status, score 0–1, detail}` object that is inserted into `verifications`.

**d. Email analysis**
Flags **free-mail recruiters** (a Gmail/Yahoo/Outlook address claiming to be a corporate recruiter is a very strong scam signal).

**e. Text NLP (`analyzeText`)**
Five text-based checks on the evidence corpus:
- **Fraud keyword scan** — dictionary of scam terms
- **Urgency language** — "act now", "24 hours only", "limited spots"
- **Payment / fee request** — "registration fee", "processing charge", "security deposit"
- **Cryptocurrency mention** — BTC / USDT / wallet-address patterns
- **Grammar quality** — heuristic based on typos, spacing, capitalization

**f. Cross-source consistency**
- Does the recruiter's email domain match the company's website domain? (Legit companies match; scammers almost never do.)
- **Evidence diversity** — more distinct kinds of evidence = higher confidence.

**g. Feature vector (17 features, all normalized to 0–1)**

```
domain_age, ssl_valid, dns_valid, spf, dmarc,
official_email_match, website_reachable,
fraud_keywords, payment_request, crypto_mention, urgency_score,
grammar_quality, evidence_count, evidence_diversity,
cross_source_consistency, suspicious_tld, free_email_recruiter
```

**h. Scoring (`src/lib/scoring.ts`)**
Weighted linear model — start at 50, add `feature × weight` for each:

- **Positive weights:** `domain_age +8`, `ssl_valid +6`, `official_email_match +6`, `cross_source_consistency +6`, `dns_valid +5`, `website_reachable +5`, `evidence_count +5`, `evidence_diversity +4`, `grammar_quality +4`, `spf +3`, `dmarc +3`
- **Negative weights:** `payment_request -15`, `fraud_keywords -12`, `crypto_mention -8`, `urgency_score -6`, `suspicious_tld -5`, `free_email_recruiter -4`

Clamped to 0–100 → the **Trust Score**.

**Risk categories:**
| Score | Category |
|---|---|
| ≥ 85 | Trusted |
| ≥ 70 | Likely Safe |
| ≥ 55 | Caution |
| ≥ 45 | High Risk |
| < 45 | Fraudulent |

**Confidence (0.35 – 0.98):** based on how many of the 17 features actually had usable data.

**Feature importance:** `|contribution| / total|contributions|` — rendered as bars in the UI so the user sees exactly *why* the score is what it is.

The result is written to `ml_predictions` with model tag `ANVIX-Ensemble-v1`.

**i. AI explanation (Lovable AI Gateway → Gemini 2.5 Flash)**
The server function sends the score, features, and findings as JSON to the LLM and asks for a strict JSON reply with:
- `summary` (2–4 sentences)
- `positive` findings (up to 5)
- `negative` findings (up to 5)
- `missing` evidence categories
- `recommendation` (one action-oriented sentence)

If the LLM call fails, a deterministic fallback template is used so the report is never empty. Written to `trust_reports`.

**j. Done**
`investigations` is updated: `status = 'completed'`, `progress = 100`, `trust_score`, `risk_category`, `best_model`, `completed_at`.

### Step 4 — View the report (`/_authenticated/investigations/$id`)

- Live-updating activity log and verification checklist (Postgres realtime).
- Score dial, category chip, positive/negative bullets, recommendation.
- **Download PDF** trust report (`report-pdf.ts`).
- **Generate Cybercrime FIR** (`fir-pdf.ts`) — extracts scammer identifiers (emails, phones, UPIs, websites), suggests applicable IPC / IT Act sections, and generates a ready-to-file PDF with a cover page on how to file at `cybercrime.gov.in`.
- **Generate safe reply** (`trap-reply.functions.ts`) — the LLM writes 3 short reply messages the user can safely send to the scammer to extract more evidence; paste the scammer's reply back and ANVIX re-grades it.
- **Public share card** (`r.$slug.tsx` + `api.public.card.$slug.tsx`) — a shareable public link with a JSON API for embedding.

### Step 5 — Extras

- **Ask ANVIX** (`/ask`) — paste any suspicious message and get an instant LLM-graded verdict without creating a full investigation.
- **Payment scanner** (`/check-payment`) — checks UPI IDs and QR-code text for scam patterns.
- **Global signals** — scam identifiers seen in any investigation are hashed (peppered with `ANVIX_SIGNAL_PEPPER`) and stored in `global_signals`. Future investigations can match repeat scammers without leaking any user's private data.

---

## 6. ML — Offline Training vs Runtime Inference (important for the lecture)

**Offline (Python, run once):**
- Dataset: **EMSCAD / Kaggle Fake Job Postings** — 17,880 postings, 866 labeled as fraud.
- `ml/train_ensemble.py` trains three models with scikit-learn:
  1. Logistic Regression
  2. Random Forest
  3. Gradient Boosting
- Evaluated on precision, recall, F1, ROC-AUC — see `ml/metrics.json` and `ml/EVAL_REPORT.md`.
- The **best model's coefficients / trees are exported to JSON** (`model_coefficients.json`, `forest_model.json`).

**Runtime (production, TypeScript, edge):**
- `src/lib/kaggle-model.ts` loads the exported JSON at boot — no Python container in production.
- Combined with the deterministic weighted engine in `scoring.ts` for full interpretability.
- Result: <10 ms scoring, no cold starts, no ML server bill.

**Why this hybrid?** Cloudflare Workers (our edge runtime) can't run Python. Exporting trained coefficients to JSON and re-implementing inference in TS gives us production ML at edge latency.

---

## 7. Security Posture

- **RLS on every table** — a user cannot read another user's investigation even by guessing the ID.
- Server secrets (`LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANVIX_SIGNAL_PEPPER`) live only in the Worker environment and are never sent to the browser.
- `ANVIX_SIGNAL_PEPPER` — a random pepper hashed into `global_signals` so shared threat intel doesn't leak the raw scammer identifier tied to any specific user.
- The Google OAuth `redirect_uri` is always a public same-origin URL, never a protected route — protected routes hydrate the session client-side.
- File uploads go to a **private** storage bucket; access is mediated by signed URLs and RLS.

---

## 8. Q&A Cheat Sheet (likely lecturer / audience questions)

- **"Is it real ML or just rules?"**
  Both. We trained real scikit-learn models offline on 17k+ real fraud postings from Kaggle, *and* we run a transparent weighted engine on top so every score is fully explainable.

- **"Why not run Python in production?"**
  We deploy to Cloudflare Workers (edge) — no Python runtime available. So we export the trained model's coefficients to JSON and re-implement inference in TypeScript. That gives <10 ms scoring, no cold starts, no ML server bill.

- **"What if the AI hallucinates?"**
  The Trust Score itself is computed deterministically from features — the LLM never touches it. The LLM only writes the *explanation prose*, and it's constrained by a strict JSON schema plus a deterministic fallback template.

- **"How do you get domain age / SSL without paid APIs?"**
  DNS-over-HTTPS + a direct HTTPS handshake + public WHOIS endpoints, all callable from the Worker with plain `fetch`.

- **"How is this different from a spam filter?"**
  Spam filters look at text alone. ANVIX combines **infrastructure** (DNS/SSL/WHOIS), **content** (NLP), **behavior** (payment/urgency/crypto), and **cross-source consistency** — plus it produces an actionable report and an FIR-ready PDF.

- **"What happens if a check times out?"**
  Each check returns `{status: 'skipped', score: 0}` and the confidence value drops accordingly. The pipeline never blocks on a single flaky external service.

- **"Where does the training data come from?"**
  The EMSCAD (Employment Scam Aegean Dataset), also known as the Kaggle *Fake Job Postings* dataset — 17,880 real job listings with 866 verified fraudulent examples, curated by researchers.

- **"Can two users share threat intel without leaking data?"**
  Yes — that's the `global_signals` table. Scam identifiers are hashed with a server-side pepper so the raw email/UPI/domain is never exposed cross-user; only exact-match hits light up.

---

## 9. Running Locally

See `README.md` for the exact `git clone` / `bun install` / `bun dev` steps and the environment variables you need (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANVIX_SIGNAL_PEPPER`).

---

*You're ready. Good luck with the lecture.*
