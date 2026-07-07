
## What we're building

Three tracks, delivered in one pass:

### Track A — Guest mode with optional login (browser-only storage)

- Landing → **"Start Investigation" opens directly**, no auth required.
- New guest routes (public, SSR-off): `/investigate` (create), `/investigate/live` (runs + shows progress + trust report). Guest state lives entirely in `localStorage` under `anvix:guest:current` and `anvix:guest:history` (up to 20 recent local-only runs).
- Verification engine + scoring already runs as unauthenticated server functions — I'll add a **`runGuestInvestigation` public server fn** that accepts raw evidence in the request body (never touches DB), returns full result JSON. No DB writes for guests.
- **"Save to history" button** on the guest trust report → opens an auth modal (email/password + Google). On sign-in, we replay the stored result into the user's DB (investigation + evidence + verifications + prediction + report rows) and redirect to `/investigations/:id`.
- Signed-in users still get the existing `/dashboard` with their full saved history. Header shows "Sign in / Save" (guest) or the user menu (signed in).
- **RLS unchanged** — all authenticated tables still owner-only.

### Track B — Real ML model trained on Kaggle Fraudulent Job Postings

The current weighted engine stays as the deterministic baseline. Alongside it:

1. **Offline training pipeline** (Python, one-shot in sandbox, committed to `ml/`):
   - Load Kaggle `fake_job_postings.csv` (17,880 rows, ~800 fraud-labeled — I'll fetch it in-sandbox).
   - Feature engineering aligned to the app's 17 runtime features (text-derived: fraud keywords, urgency, payment, crypto, grammar; metadata-derived: has_company_logo, has_questions, telecommuting, employment_type, required_experience).
   - Train **Logistic Regression, Random Forest, XGBoost, LightGBM**; pick best by F1 on stratified holdout.
   - Save: `ml/metrics.json` (accuracy/precision/recall/F1/ROC-AUC per model), `ml/confusion_matrices.png`, `ml/roc_curves.png`, `ml/feature_importance.png`, `ml/model_coefficients.json` (winning model weights in a shape the TS scorer can consume).
2. **Runtime integration** — `src/lib/scoring.ts` now has two modes:
   - `weighted-v1` (current) — kept for interpretability / fallback.
   - `kaggle-lr-v1` — loads `ml/model_coefficients.json` at build time, runs logistic-regression inference at request time (pure TS, edge-safe, no Python endpoint needed). Model badge and confidence reflect the real trained coefficients.
3. Every investigation records which model was used and its real training metrics (queryable from the report).

This gives the report **real accuracy/precision/recall/F1/ROC numbers** without needing to host a separate Python service.

### Track C — Full DOCX report (all 8 chapters)

Generated with `docx-js` per the drafting skill, saved to `/mnt/documents/ANVIX_Project_Report.docx`. Content driven from:
- Real architecture diagrams (component, DFD, use-case, activity, ER) rendered as PNGs with matplotlib/graphviz.
- Real screenshots of the running app (landing, guest flow, live investigation, trust report, dashboard) via Playwright.
- Real training metrics from Track B (`metrics.json` → tables + charts).
- All 40+ subsections from your TOC populated with project-specific content (not lorem ipsum).

Delivered as `<presentation-artifact>` you can download.

## Order of work

1. Guest-mode routes + `localStorage` state + public server fn + "Save to history" claim flow.
2. Kaggle training pipeline in `/tmp` → export `ml/model_coefficients.json` + metrics artifacts into repo.
3. TS logistic-regression scorer + wire into pipeline.
4. Verify: run guest investigation end-to-end via Playwright, confirm real model score matches Python offline prediction on same features.
5. Capture screenshots + generate architecture diagrams.
6. Generate DOCX, QA every page as images, deliver.

## Technical notes

- **Kaggle dataset access**: I'll fetch it in-sandbox from a public mirror (the dataset is CC0). If the mirror is blocked, I'll fall back to reconstructing a labeled subset from Kaggle's published API sample; if that also fails, I'll pause and ask before continuing Track B.
- **Model coefficients bundled in the app**: ~20KB JSON, no runtime training, no Python host required. This is a legitimate production deployment pattern (same approach Cloudflare Workers AI uses for small classical models).
- **Guest → account claim**: single server fn `claimGuestInvestigation({ snapshot })` that runs inside `requireSupabaseAuth`, inserts investigation + child rows in a transaction, returns the new investigation id.
- **No RLS or schema changes needed** — guest path bypasses DB entirely; claim path writes as the newly-authenticated user.
- **`.docx` report**: ~50–60 pages, matches your TOC exactly (Chapters 1–8 + References), uses your project's real name/architecture/metrics.

## Confirm to proceed

Reply "go" and I'll execute all three tracks in order. Total time: substantial (training + report generation are the long steps); I'll batch aggressively and report back with the downloadable DOCX + a working guest flow.
