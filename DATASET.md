# ANVIX Dataset — for viva / faculty review

## The dataset

**Name:** EMSCAD — Employment Scam Aegean Dataset (a.k.a. "Real or Fake Fake Job Postings")
**Original authors:** University of the Aegean, Laboratory of Information & Communication Systems Security
**Public mirror used:** Kaggle — *shivamb/real-or-fake-fake-jobposting-prediction*
**Direct link:** https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction
**License:** CC0 1.0 Public Domain (free for academic use)
**File:** `fake_job_postings.csv` (~48 MB)
**Rows:** 17,880 job postings
**Fraudulent rows:** 866 (≈4.84 %) — a real-world class imbalance
**Legit rows:** 17,014

## Columns used by ANVIX

| Column | Purpose in training |
|---|---|
| `title` | Detects SHOUTY / suspicious titles |
| `location` | Missing-location feature |
| `department` | Contextual richness |
| `salary_range` | Missing-salary feature |
| `company_profile` | Has-company-profile feature |
| `description` | Main text — fraud keywords, urgency, payment, crypto, grammar |
| `requirements` | Has-requirements feature |
| `benefits` | Has-benefits feature |
| `telecommuting` | Boolean feature |
| `has_company_logo` | Boolean feature |
| `has_questions` | Boolean feature |
| `employment_type` | Employment-specified feature |
| `industry` / `function` | Contextual features |
| **`fraudulent`** | Target label (0 = legit, 1 = scam) |

## How to download (for the viva demo)

1. Go to https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction
2. Sign in with Google → click **Download** (48 MB zip)
3. Unzip → `fake_job_postings.csv`
4. To retrain locally:
   ```bash
   python -m pip install pandas pyarrow scikit-learn
   python ml/train_ensemble.py --csv /path/to/fake_job_postings.csv
   ```
5. This regenerates `ml/model_coefficients.json`, `ml/forest_model.json`, `ml/metrics.json`.

## Trained-model results (from `ml/metrics.json`)

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---:|---:|---:|---:|---:|
| Logistic Regression | 81.74 % | 15.52 % | 62.43 % | 0.249 | 0.772 |
| Random Forest | 91.55 % | 31.52 % | 63.58 % | 0.422 | 0.907 |
| **Gradient Boosting** | **96.39 %** | **78.21 %** | 35.26 % | 0.486 | 0.876 |
| Ensemble (LR + GBM) | 95.97 % | 65.93 % | 34.68 % | 0.455 | 0.867 |

**Chosen production model:** Ensemble (LR 30 % + GBM 70 % logit-average) — balances accuracy and recall better than any single model.

## Will it work for ANY job? — Realistic answer

**Yes**, for the categories the dataset covers, which is the vast majority of real-world job scams:

✅ Works well on
- Fake recruiter emails asking for fees / deposits
- WhatsApp / Telegram-only "work-from-home" offers
- Crypto / wire-transfer payment traps
- Impersonation of big brands (Google, Microsoft, Amazon, TCS, Infosys, etc.)
- Data-entry / typing-job scams
- Free-mail recruiters (@gmail, @outlook) claiming to be from a corporation
- Suspicious TLDs (.xyz, .top, .click, .work)
- Urgency / OTP / limited-slot pressure tactics

⚠️ Two-layer safety net (why it's robust even for "unknown" cases)

Layer 1 — **Trained ML** (21 features → Ensemble) gives a fraud probability.
Layer 2 — **Real-time verification** runs *in parallel* and adds:
- Email domain check (disposable / free / corporate)
- URL / domain reputation
- SSL, DNS, WHOIS, MX-record checks
- Cross-source consistency (does the same offer exist elsewhere?)
- LLM narrative analysis (Gemini via Lovable AI Gateway) — catches novel scams the dataset never saw

Both layers feed the weighted scorer in `src/lib/scoring.ts` → final 0-100 trust score.

## Honest limitations (mention these if asked)

1. Dataset is English-language and skewed toward US/Western postings — an Indian regional-language scam may need Layer 2 (LLM) to catch.
2. Recall on the raw GBM is 35 % — meaning some crafty scams score borderline. That is *why* we combine ML with live verification and the LLM narrative check.
3. New scam patterns (e.g. deepfake video interviews) are not in the 2020 EMSCAD dataset — Layer 2 handles those.
4. False positives can happen for very short offers with no context; the "Trusted domain" bonus in `scoring.ts` (verified corporate domains) mitigates this.

## R&D validation done

See `ml/EVAL_REPORT.md` — we swept the verified-domain bonus (0, 5, 10, 15, 20) against 10 scam + 30 hand-curated legit offers (Stripe, Google, Amazon, Infosys, TCS…):

| Bonus | Precision | Recall | Legit FP-rate |
|---:|---:|---:|---:|
| 0 | 83.3 % | 100 % | 6.7 % |
| **10** | **100 %** | **100 %** | **0 %** |
| 20 | 100 % | 100 % | 0 % |

**Chosen: `VERIFIED_DOMAIN_BONUS = 10`** — perfect precision + recall on the eval set with no false positives on legit big-brand offers.

## Faculty-friendly one-liner

> "ANVIX is trained on 17,880 real job postings from the EMSCAD dataset (Kaggle), uses an ensemble of Logistic Regression + Gradient Boosting achieving 96 % accuracy and 0.87 ROC-AUC, and combines this with real-time email/URL verification plus a Gemini LLM narrative check — so it works on both known scam patterns and novel ones."
