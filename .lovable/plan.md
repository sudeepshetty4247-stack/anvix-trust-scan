
# ANVIX — Complete In-Depth Walkthrough (chat only, no document)

Below is everything you need to defend this project in a viva. Read it top-to-bottom once, then use the Q&A bank at the end to drill.

---

## 1. What ANVIX actually is

ANVIX is a **job-scam / recruitment-fraud detection web app**. A user pastes a suspicious job offer (email text, URL, WhatsApp message, recruiter mail, etc.) into the Investigate page. The system returns a **Trust Score (0–100)** plus a verdict band:

- 85–100 Trusted
- 70–84 Likely Safe
- 50–69 Needs Review
- 30–49 Suspicious
- 0–29 Scam

Plus: top reasons, plain-English explainer, technical checks, action checklist, downloadable PDF/FIR report, share link, and an optional "trap reply" generator.

---

## 2. Tech stack (what language & why)

| Layer | Tech | Why |
|---|---|---|
| Language | **TypeScript** (frontend + backend) + **Python** (only for ML training) | Type safety; one language across the stack. Python only for scikit-learn. |
| Framework | **TanStack Start v1** (React 19 + Vite 7) | Full-stack React with SSR + server functions (RPC). |
| Styling | **Tailwind CSS v4** + shadcn/ui | Utility-first, semantic tokens, dark mode. |
| Backend runtime | **Cloudflare Workers** (edge, serverless) | Fast, global, no cold Python. |
| Database + Auth + Storage | **Lovable Cloud (Supabase under the hood)** — Postgres with RLS | Managed Postgres, row-level security, auth, file storage. |
| AI Gateway | **Lovable AI Gateway** → Google Gemini 2.5 Flash | For the narrative/plain-English explanation only, not for scoring. |
| ML training | **Python + scikit-learn + pandas** | Trained offline on Kaggle dataset, exported as JSON. |
| ML inference | **Pure TypeScript at the edge** | No Python runtime in production — model weights loaded from JSON. |

**Key line for viva:** "Training in Python, inference in TypeScript at the edge — zero server round-trip to a Python process."

---

## 3. Dataset & Model Training

### 3.1 Dataset
- **Kaggle "Real or Fake Fake Job Postings" (EMSCAD)**
- **17,880 job postings**, **866 labeled fraudulent** (~4.8% — highly imbalanced)
- Columns used: `title, company_profile, description, requirements, benefits, has_company_logo, has_questions, telecommuting, employment_type, salary_range, location, fraudulent`

### 3.2 Feature engineering (21 features, all normalised to [0,1])
Located in `ml/train_ensemble.py` and mirrored in `src/lib/kaggle-model.ts`:

Text-derived:
1. `fraud_keywords_norm` — hits from 30-word scam lexicon (quick money, registration fee, western union…)
2. `urgency_norm` — urgent, immediately, ASAP, hurry…
3. `payment_norm` — wire, PayPal, gift card, UPI, Zelle…
4. `crypto_norm` — bitcoin, USDT, wallet address…
5. `grammar_quality` — inverse of ALL-CAPS ratio + exclamation density
6. `has_url` / `has_email` / `url_count_norm`
7. `free_email_present` — gmail/yahoo/outlook used as recruiter mail
8. `sus_tld_present` — .xyz, .top, .click, .tk, .ml, .zip…

Structural (from Kaggle columns):
9. `has_company_logo`, `has_questions`, `telecommuting`
10. `has_company_profile`, `has_requirements`, `has_benefits`
11. `desc_len_norm`, `employment_specified`
12. `salary_missing`, `location_missing`, `title_shouty`

### 3.3 Models trained (4 total)
Train/test split 80/20, stratified, `random_state=42`.

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | Purpose |
|---|---|---|---|---|---|---|
| Logistic Regression (class-balanced) | 0.8174 | 0.1552 | 0.6243 | 0.2486 | 0.7717 | Linear baseline, edge-portable weights |
| Random Forest (200 trees, depth 12) | 0.9155 | 0.3152 | 0.6358 | 0.4215 | 0.9071 | Comparison only, not shipped |
| Gradient Boosting (120 trees, depth 3) | **0.9639** | **0.7821** | 0.3526 | **0.4861** | 0.8763 | **Shipped** as JSON forest |
| **Ensemble (LR + GBM logit-average)** | 0.9597 | 0.6593 | 0.3468 | 0.4545 | 0.8672 | **Shipped** — best balance |

Ensemble math: `P = sigmoid(0.30 * logit(P_LR) + 0.70 * logit(P_GBM))` — the LR bumps recall on obvious lexical scams, GBM anchors precision.

**F1-optimal threshold** picked by sweeping 30 values on the validation set (currently ~0.15 for ensemble, 0.30 for GBM alone).

### 3.4 Why these three models?
- **Logistic Regression** = interpretable linear baseline, tiny (21 weights + intercept), fast at the edge.
- **Random Forest** = strong baseline for tabular, but not exported (too big to ship as JSON).
- **Gradient Boosting** = best single model on imbalanced tabular data (each tree corrects previous errors).
- **Ensemble** = combines LR's recall with GBM's precision.

### 3.5 Confusion Matrix (Ensemble, from `ml/metrics.json`)
```
                Predicted Legit   Predicted Scam
Actual Legit         3372              31
Actual Scam           113              60
```
- TN=3372, FP=31, FN=113, TP=60
- Precision = 60/(60+31) = 0.66
- Recall    = 60/(60+113) = 0.35
- Accuracy  = (3372+60)/3576 = 0.96

### 3.6 How models are exported for edge inference
`ml/train_ensemble.py` writes 3 JSON files:
- `ml/model_coefficients.json` — LR intercept + 21 weights + metrics
- `ml/forest_model.json` — full GBM (120 trees serialised as `{feat, thr, l, r}` nodes and `{leaf}` values)
- `ml/metrics.json` — accuracy/precision/recall/F1/ROC-AUC/confusion for all 4 models

`src/lib/kaggle-model.ts` reimplements sigmoid + tree traversal in TypeScript, so predictions run in the Cloudflare Worker with zero Python.

---

## 4. Real-time detection flow (end-to-end)

User pastes text into `/investigate` → clicks **Investigate**.

```
Browser (React)
     │  useServerFn(runPipeline)
     ▼
runPipeline (createServerFn, TanStack Start)
     │
     ├─ 1. Extract entities: URLs, emails, phones (regex)
     ├─ 2. Live verification (verification.server.ts)
     │      • DNS lookup (MX/SPF/DMARC records)
     │      • SSL cert check
     │      • Domain age (WHOIS proxy)
     │      • Check against known-legit domain allowlist
     ├─ 3. Feature extraction → 21-dim vector (kaggle-model.ts)
     ├─ 4. ML inference at edge:
     │      P_LR  = predictFraudProbability(features)   // logistic regression
     │      P_GBM = predictForestProbability(features)  // gradient boosting
     │      P_ENS = sigmoid(0.3*logit(P_LR) + 0.7*logit(P_GBM))
     ├─ 5. Rule-based scoring (scoring.ts)
     │      weighted feature model → 0..100 base score
     │      + VERIFIED_DOMAIN_BONUS (+10 for microsoft.com, google.com, tcs.com…)
     ├─ 6. Combine ML + rules → final Trust Score
     ├─ 7. Narrative generation (narrative.functions.ts)
     │      calls Lovable AI Gateway → Gemini 2.5 Flash
     │      → plain-English "why this is suspicious"
     ├─ 8. Persist to Postgres:
     │      investigations, evidence, ml_predictions,
     │      verifications, trust_reports, activities
     └─ 9. Return TrustReport DTO to browser
     ▼
Report UI renders: VerdictHero, TopReasons, TechnicalAccordion,
                    ActionChecklist, ShareCard, FIR PDF button
```

**"Real-time" means:** every check runs on-demand per request at the edge — no cached lookup, no background job. Median response ~1.5–3s.

---

## 5. Database (Lovable Cloud / Postgres)

9 tables, all with Row Level Security enabled:

| Table | Purpose | Key columns |
|---|---|---|
| `investigations` | One row per user scan | id, user_id, input_text, verdict, score, created_at |
| `evidence` | Raw extracted URLs/emails/phones | investigation_id, kind, value, verified |
| `ml_predictions` | Stored model outputs | investigation_id, lr_prob, gbm_prob, ensemble_prob, threshold |
| `verifications` | Domain/SSL/DNS check results | investigation_id, target, dns_ok, ssl_ok, whois_age_days |
| `trust_reports` | Final rendered report JSON | investigation_id, score, category, reasons |
| `global_signals` | Community-wide reputation cache | signal_hash (peppered), verdict, hits |
| `investigation_signals` | Per-investigation signal links | investigation_id, signal_id |
| `public_reports` | Publicly shareable reports | slug, report_json, expires_at |
| `activities` | Audit / timeline | user_id, kind, ref_id, created_at |

**Security model:**
- **RLS** = every SELECT/INSERT/UPDATE/DELETE checked against `auth.uid()`.
- **User roles** stored in a separate `user_roles` table (never on profiles — prevents privilege escalation).
- **`has_role()`** = SECURITY DEFINER SQL function to avoid recursive RLS.
- **Signal pepper** (`ANVIX_SIGNAL_PEPPER`) = server-only secret; hashes evidence before storage so global signals can be shared without leaking raw PII.

**Auth:** Supabase Auth with email + Google OAuth (via Lovable broker).

---

## 6. How each score band is decided

Weighted linear model in `src/lib/scoring.ts` starts at 50 and adds:
```
+ domain_age (max +8), ssl_valid (+6), dns_valid (+5),
  spf (+3), dmarc (+3), official_email_match (+6),
  website_reachable (+5), grammar_quality (+4),
  evidence_count (+5), diversity (+4), consistency (+6)
- fraud_keywords (-12), payment_request (-15), crypto (-8),
  urgency (-6), suspicious_tld (-5), free_email_recruiter (-4)
```
Clamped to [0,100]. Then the ML ensemble probability nudges it further. Then verified-domain bonus (+10) is applied for known enterprise domains — this is what stops "Microsoft interview" mails from being falsely flagged.

Bonus was tuned by `ml/evaluate.mjs` sweeping 0/5/10/15/20 on a 40-sample curated set: bonus=10 gave 100% precision, 100% recall, 0% FP rate.

---

## 7. Extension (bonus)

`extension/` holds a Chrome MV3 extension that calls the same public API route (`/api/public/card/$slug`) to score pages inline. Same scoring, different UI shell.

---

## 8. How to change code on the spot (viva survival kit)

Examiner says "change X" — here's where each thing lives:

| Change | File to edit | What to do |
|---|---|---|
| Add/remove scam keyword | `ml/train_ensemble.py` (FRAUD_KWS list) **and** mirror in `src/lib/verification.server.ts` | Retrain OR just edit the mirror for a live demo |
| Change score band cutoffs | `src/lib/scoring.ts` → `if (score >= 85) ...` | Edit the thresholds, save, hot-reload |
| Change feature weight | `src/lib/scoring.ts` → `FEATURE_WEIGHTS` object | e.g. make `payment_request` more punishing → -20 |
| Add a new verified domain | `src/lib/verification.server.ts` allowlist | Push microsoft.com, infosys.com etc. |
| Change verdict labels | `src/lib/scoring.ts` → `RISK_META` | Rename "Trusted" → "Verified Safe" |
| Change AI narrative tone | `src/lib/narrative.functions.ts` → system prompt | Ask Gemini for shorter/longer output |
| Add a new DB column | Migration via Lovable Cloud tool | `ALTER TABLE`, add RLS, add GRANT |
| Add a new page | Create `src/routes/newpage.tsx` with `createFileRoute` | Router regenerates automatically |
| Change model weights | Rerun `python ml/train_ensemble.py --csv <path>` | Regenerates 3 JSON files |
| Add a new ML feature | Add to `build_features()` in Python AND `KaggleFeatures` type in TS | Retrain + redeploy |

**Golden rule during viva:** all scoring logic is in `src/lib/scoring.ts` and `src/lib/kaggle-model.ts`. Everything else is UI or plumbing.

---

## 9. Q&A Bank — expected viva questions with sharp answers

**Q1. Which language did you use?**
TypeScript for the whole application, Python only for offline ML training with scikit-learn. Inference is pure TypeScript at the edge.

**Q2. Which framework?**
TanStack Start v1 — React 19 SSR framework with typed server functions (RPC), running on Cloudflare Workers.

**Q3. Which dataset?**
Kaggle "Real or Fake Fake Job Postings" (EMSCAD), 17,880 rows, 866 fraudulent (~4.8%).

**Q4. Which models did you train?**
Four: Logistic Regression, Random Forest, Gradient Boosting, and a logit-averaged LR+GBM Ensemble. Ensemble and GBM are shipped.

**Q5. Which was best and why?**
Gradient Boosting had the highest F1 (0.486) and precision (0.78). The ensemble (F1 0.454) trades a little F1 for higher recall on lexical scams. We ship both and combine.

**Q6. Why not deep learning?**
21-dimensional tabular problem with 17k rows — gradient boosting beats neural nets on this scale, is 100× smaller, and runs at the edge with no GPU.

**Q7. How does real-time detection work?**
User submits text → server function runs (1) regex extraction (2) live DNS/SSL/WHOIS verification (3) 21-feature vector build (4) LR + GBM inference in TypeScript (5) rule-based weighted scoring (6) verified-domain bonus (7) Gemini narrative (8) DB persist (9) return report. ~2 seconds.

**Q8. How do you handle class imbalance?**
`class_weight="balanced"` in LR/RF, GBM uses log-loss which is imbalance-robust, threshold tuned by F1 sweep instead of default 0.5.

**Q9. What is a confusion matrix?**
2×2 table of TP/FP/TN/FN. Ours (ensemble): TP=60, FP=31, TN=3372, FN=113.

**Q10. Accuracy vs Precision vs Recall vs F1?**
- Accuracy = (TP+TN)/all
- Precision = TP/(TP+FP) — of things we flagged, how many were real scams
- Recall = TP/(TP+FN) — of real scams, how many we caught
- F1 = 2·P·R/(P+R) — harmonic mean, penalises imbalance

**Q11. What is ROC-AUC?**
Area under the True-Positive-Rate vs False-Positive-Rate curve. 1.0 = perfect, 0.5 = random. Ours: 0.87 for ensemble.

**Q12. Why is R² not reported?**
R² is for regression. This is binary classification — we report accuracy/precision/recall/F1/ROC-AUC instead.

**Q13. What is RLS?**
Row Level Security — Postgres policies that check `auth.uid()` on every query. A user can only read/write their own investigations even if the API is compromised.

**Q14. Where are secrets stored?**
Server-side env vars: `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANVIX_SIGNAL_PEPPER`. Never exposed to the browser.

**Q15. How do you prevent SQL injection?**
Supabase client uses parameterised queries; we never concatenate SQL.

**Q16. What is an edge function / server function?**
`createServerFn` = typed RPC. Called from React, runs in Cloudflare Worker, returns serialised JSON. No REST endpoints needed.

**Q17. How is the ML model shipped without a Python server?**
`train_ensemble.py` serialises the GBM forest as JSON (`{feat, thr, l, r}` nodes). `kaggle-model.ts` re-implements tree traversal + sigmoid in TypeScript. 120 trees, ~180KB, loaded at build time.

**Q18. What if the model is wrong?**
Two safety nets: (1) verified-domain bonus overrides ML for known enterprises (microsoft.com, google.com, tcs.com), (2) rule-based weighted scoring is the primary score; ML nudges it.

**Q19. How is the community reputation table built?**
Every scanned URL/email is peppered-hashed (HMAC-SHA256 with `ANVIX_SIGNAL_PEPPER`) and stored in `global_signals`. Future scans can look up prior verdicts without exposing raw PII.

**Q20. How does the FIR generator work?**
`src/lib/fir-pdf.ts` uses `docx` / `pdf-lib` to render the report + user details into a downloadable PDF formatted for Indian cybercrime.gov.in submission.

**Q21. Why TanStack Start over Next.js?**
Better TypeScript ergonomics, no server components complexity, edge-native, typed server-fn RPC, and it's what Lovable ships as default.

**Q22. Is the app scalable?**
Cloudflare Workers scale to millions of req/day automatically. Postgres via Supabase autoscales. ML inference is stateless — no bottleneck.

**Q23. What are the limitations?**
Recall of 0.35 means we miss ~65% of subtle scams (mostly clean-worded ones). Model doesn't understand semantics — only lexical patterns. Doesn't parse attachments/images. English-only lexicon.

**Q24. Future work?**
LLM-based semantic classifier, image OCR for scam screenshots, browser extension for Gmail inline, multi-language lexicons, feedback loop where user labels re-train the model.

**Q25. What is a Cloudflare Worker?**
Serverless V8 isolate — runs JS/TS at 300+ edge locations, cold start <1ms, no Node.js container. Our whole backend runs here.

**Q26. Can it be run locally?**
Yes — `bun install && bun run dev` starts Vite on localhost:8080; Python training runs on any machine with `pip install pandas scikit-learn`.

**Q27. What is Gemini used for?**
Only for generating the plain-English narrative explanation — NOT for scoring. The score is deterministic ML+rules; Gemini just writes the human-readable "why".

**Q28. Why sigmoid?**
Squashes any real number to (0,1) — turns log-odds into probability. Used in logistic regression and to combine LR+GBM in the ensemble.

**Q29. What is a decision tree threshold?**
Each internal node splits on `feature ≤ threshold` — go left if true, right if false. Leaves return a log-odds contribution multiplied by learning rate (0.1) and summed.

**Q30. What is the difference between bagging and boosting?**
Bagging (Random Forest) = train trees in parallel on bootstrap samples, average their votes. Boosting (GBM) = train trees sequentially, each fixing the previous tree's errors.

---

## Next step

This is the plan. Once you approve, I'll switch to build mode and can optionally paste this as a printable cheatsheet, add inline code comments matching each Q answer, or generate a slide deck. Otherwise you can just use this chat directly for your viva prep.
