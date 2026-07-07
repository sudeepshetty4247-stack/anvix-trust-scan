
## The honest diagnosis

You're right on every point. Right now ANVIX is a fancy form that outputs a score — nothing a scam victim, a candidate rushing between interviews, or a recruiter would actually pull out on a Tuesday night. It doesn't *explain the crime*, it doesn't *meet the user where the evidence lives* (screenshots, offer PDFs, forwarded emails), and 17k rows of one Kaggle dataset is a toy. This plan fixes all of that.

## What ANVIX becomes

**"Drop anything you got — a screenshot, an offer letter, a link, a WhatsApp text, an email you forwarded to yourself — and ANVIX will tell you exactly how the scam works, who's behind it, and what they'll ask you for next."**

Three pillars:

1. **Evidence-first UX** — zero mandatory fields, just an "Add evidence" surface that accepts *whatever the user has*.
2. **Wow triad** — the three differentiators from your answer, unified into one report.
3. **Real ML** — bigger corpus + transformer embeddings + LLM reasoning layer.

---

## Track 1 — Evidence-first conversational UX

Replaces the current URL/email/text form with a **single drop zone + chat**:

- One page (`/investigate`) with a big "Add anything you have" area. Accepts:
  - **Screenshots** of LinkedIn/WhatsApp/Instagram/email → OCR (server-side, `tesseract.js` + Gemini vision fallback for hard cases) extracts sender, company, URLs, phone, salary.
  - **Offer letter PDF / DOCX** → parsed for letterhead, signature image, bank/UPI/crypto details, salary, joining date, HR email.
  - **Forwarded .eml** or raw email headers → SPF/DKIM/DMARC verdict, return-path mismatch, display-name spoofing.
  - **Just a URL, company name, or recruiter name** → we enrich everything server-side.
  - **Plain text** paste (WhatsApp thread, JD copy).
- After the first drop, an inline chat prompts *only* what would raise confidence: "Got the recruiter's LinkedIn? Drop it." "Any bank account they asked you to pay?" — never a wall of required fields. Skippable.
- Live "Confidence meter" fills as evidence is added — user sees investigation getting stronger with each drop.
- Guest can do everything on-screen. **Download PDF report → sign-in modal → download.** Same gate for "Save to history".

---

## Track 2 — The wow triad (all three, unified)

Three modules run in parallel on every investigation and feed into one narrative report.

### 2a. Recruiter Identity Graph
- Extract every identity signal from the evidence: name, email, phone, LinkedIn URL, company, profile photo.
- Build a graph node per identity, edges per shared attribute (same phone across 3 recruiters = red edge).
- Cross-check against:
  - Prior ANVIX investigations (anonymized global signal DB — new table `global_signals`, no PII, hashed identifiers).
  - Public breach indicators (HaveIBeenPwned k-anon API for email).
  - Reverse-image on the profile photo (Gemini vision: "does this face appear in known-scam corpora / stock photo sites").
- Output: *"This recruiter's phone number appeared in 4 prior flagged investigations under 2 different names."*

### 2b. Offer Letter Forensics
- PDF metadata (author, producer, creation tool, modification history — tampering giveaway).
- Signature/logo image lifted from PDF → perceptual hash → matched against known legit company assets (built a small library at build time for top 500 employers).
- Salary vs. market band check (LLM with role + city → outputs plausibility band; extreme outliers flagged).
- Payment method extraction — any personal bank account, UPI, or crypto wallet in an offer letter is an instant red flag with explanation.
- Template reuse detector — Levenshtein against a corpus of known scam templates.

### 2c. Live Scam Playbook Match
- A curated library of ~40 known scam scripts (fee-for-laptop, crypto-payroll onboarding, WhatsApp-only recruiter, fake HR portal, task-scam pyramid, visa-processing fee, etc.), each with the ordered steps scammers take.
- Match user's evidence against the library using embedding similarity + LLM classification.
- Output the matched playbook with a **"what they'll ask you next"** prediction — this is the emotional gut-punch that makes users trust the tool: *"You're at step 3 of the 'Equipment Advance' scam. Next they'll ask you to pay ₹12k–₹45k for a company laptop and promise reimbursement in the first paycheck. Do not send money."*

All three modules feed the trust report; each finding is cited to the specific evidence item.

---

## Track 3 — Real ML upgrade

Move beyond the 17k-row Kaggle baseline.

### 3a. Bigger, better corpus
- Kaggle EMSCAD (17,880) — kept as base.
- **Indeed / LinkedIn scam-report scrapes** — public archives + FTC Consumer Sentinel job-scam narratives.
- **BBB scam-tracker** job-fraud category exports.
- **Our own labeled synthetic set** — generate 20k additional edge cases with an LLM under a fixed rubric (crypto payroll, task scams, visa fee, courier-package scam) and hand-audit a stratified sample.
- Target: **~100k rows, ~15k fraud-labeled**, stratified by scam family.

### 3b. Transformer text encoder + tabular ensemble
- Fine-tune **distilbert-base-uncased** (or MiniLM) on the corpus for `P(fraud | job_text)`.
- Export to **ONNX**, quantize to int8 (~30–50 MB), served from a small Python endpoint (Cloudflare Worker for tabular, one lightweight Python service — you already accepted external Python ML API in the original scope).
- LightGBM on top of `[transformer_embedding, tabular_17_features, forensics_features]` — this is the production model.
- Report the honest before/after: current LR (ROC-AUC 0.76) → new ensemble (target ROC-AUC 0.92+).

### 3c. LLM reasoning layer
- Gemini 2.5 Flash gets `{evidence, ML score, forensics findings, playbook match}` and produces the *narrative* explanation and the **"what they'll ask next"** prediction.
- Structured output so the UI can render each claim with its evidence citation.

### 3d. Everything published in the report
Chapter 4 (Methodology), 5 (Implementation), and 7 (Results) of the DOCX get rewritten with the new dataset stats, new model comparisons (LR vs RF vs XGBoost vs LightGBM vs DistilBERT-only vs Ensemble), new confusion matrices, new ROC curves, new SHAP feature-importance plots.

---

## Track 4 — Report download gate

- Download button visible to guests.
- Click → sign-in modal (email/password + Google).
- On sign-in: the current guest investigation is claimed into their account (already built), then the PDF is generated server-side and streamed back.
- PDF (not just DOCX) — branded ANVIX report with the trust score, evidence gallery, identity graph, forensics findings, playbook match, and citation list. Same content DOCX for the university report deliverable.

---

## Technical section

**New/changed files (high level)**
- `src/routes/investigate.tsx` — rewrite to evidence-drop + chat.
- `src/components/evidence/*` — `DropZone`, `ScreenshotOCR`, `PDFPreview`, `EmailHeaderParser`, `EvidenceChat`.
- `src/lib/ocr.functions.ts` — Tesseract wasm + Gemini vision fallback.
- `src/lib/offer-forensics.functions.ts` — pdf-lib parse, image hash, metadata inspection.
- `src/lib/identity-graph.functions.ts` — build/query the graph.
- `src/lib/playbook-match.functions.ts` — embedding + LLM classification.
- `src/lib/ml-ensemble.functions.ts` — calls the Python inference endpoint; falls back to Kaggle-LR bundled model if endpoint down.
- `src/lib/report-pdf.functions.ts` — server-rendered PDF via `@react-pdf/renderer` (edge-safe).
- `ml/train_ensemble.py`, `ml/build_corpus.py`, `ml/playbook_library.json`, `ml/onnx/model.onnx`.
- Python inference service (FastAPI, minimal) — one endpoint `/predict`, deployed anywhere the user prefers (Fly.io/Render/Cloud Run). If user doesn't want a Python host, we degrade to the bundled LR + LLM reasoning (still a large upgrade).
- New tables: `global_signals` (hashed phone/email/domain, occurrence count, first_seen, last_seen — no PII), `evidence_files` (storage_path, kind, extracted JSON), `playbook_matches`. All with RLS + GRANTs.
- `evidence` bucket already exists — used for screenshots + offer PDFs.

**Ordering**
1. Evidence-first UX + OCR + PDF/email parsing + download-gate. (User-visible, biggest immediate impact.)
2. Wow triad modules 2a/2b/2c — each ships behind a "beta" tag as it comes online.
3. ML corpus build + ensemble training + ONNX export + Python inference endpoint.
4. Rewrite the DOCX/PDF report with the real new numbers, ship the university-grade deliverable.

**Open confirmation before I start:**
- Python inference host — happy for me to spin up a free-tier Fly.io service and give you the deploy command, or do you want inference to stay bundled (LR only) and skip the transformer? Everything else in the plan works either way.

Reply "go" and I'll execute Track 1 first (biggest UX shift), report back, then continue through 2 → 3 → 4.
