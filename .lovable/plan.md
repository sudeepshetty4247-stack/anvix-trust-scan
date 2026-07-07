## Goal
Close the three remaining gaps in one pass: (1) real signal-cloud data, (2) false-positive control for the "verified domain" bonus, (3) Chrome Web Store–ready extension package.

---

## Track 1 — Live data quality (Signal Cloud)

Move the cloud from "seed only" to "self-populating from real investigations" plus a curated real-world seed.

**Backend**
- Migration: add `contribution_count`, `first_seen_at`, `last_seen_at`, `source` (`user` | `seed` | `curated`) to `global_signals` if missing; add unique index on `(signal_type, signal_value_hash)`.
- Trigger `after insert on investigation_signals` → upsert into `global_signals`, incrementing `contribution_count` and updating `last_seen_at` (peppered hash, no raw PII).
- Backfill: one-shot SQL to roll existing `investigation_signals` into `global_signals`.

**Curated real seed**
- Replace `ml/seed_global_signals.mjs` output with a curated list drawn from public scam feeds (URLhaus, OpenPhish, FTC scam-job bulletins) — ~2–3k rows, tagged `source='curated'`, dated.
- Insert via `supabase--insert` (data, not schema).

**UI**
- Landing "Signal Cloud" stays removed (per your last request). Instead surface density inside the investigation result: a small "Seen by community: N reports in last 30d" chip next to each matched signal — pulled from `global_signals.contribution_count`.

---

## Track 2 — False-positive control (verified-domain bonus)

Give the ML score a real legitimate-offer benchmark so the domain bonus is tuned, not guessed.

**Dataset**
- New file `ml/legit_offers.jsonl`: ~200 hand-labeled real offers (LinkedIn, Greenhouse, Lever, Workday, company career pages). Fields: `text`, `domain`, `label='legit'`.
- Combine with existing Kaggle scam set → `ml/eval_mixed.jsonl`.

**Evaluation script**
- `ml/evaluate.mjs`: runs current scoring pipeline over `eval_mixed.jsonl`, outputs confusion matrix, precision/recall at score thresholds 40/60/80, and FP rate specifically on `label='legit'` rows.
- Sweep `verifiedDomainBonus` across {0, 5, 10, 15, 20} and pick the value minimizing FP while keeping recall ≥ current.

**Code changes**
- `src/lib/confidence.ts` (or wherever the bonus lives): move `VERIFIED_DOMAIN_BONUS` to a single named constant with the tuned value + a comment linking to the eval report.
- Add `ml/EVAL_REPORT.md` with the confusion matrix and chosen threshold — this is what you cite in the viva.

**UI**
- Result card: when the domain bonus fires, show "Verified employer domain (−N risk)" as an explicit line item so reviewers see why the score dropped.

---

## Track 3 — Chrome Web Store distribution

Make the extension store-submittable and swap the manual ZIP flow for a real listing.

**Extension polish (`/extension`)**
- `manifest.json`: bump to a clean `1.0.0`, add `homepage_url`, `author`, tighten `permissions` to only what's used (drop `tabs` if `activeTab` suffices), add `host_permissions` array instead of broad `<all_urls>` if possible.
- Icons: generate 16/32/48/128 PNGs (currently only one icon).
- `privacy.html` route in the app + link from manifest — Chrome Web Store requires a privacy policy URL.
- Store screenshots: 1280×800, 3–5 shots of the extension analyzing a real job page.
- `store-listing.md`: title, short description (132 chars), detailed description, category (`Productivity`), single-purpose declaration.

**Packaging**
- Update the zip script to exclude source maps and the icon source, produce `anvix-scanner-v1.0.0.zip`.
- Keep the "Load unpacked" flow as fallback; add a "Coming to Chrome Web Store" badge with a placeholder store URL constant (`CHROME_STORE_URL` in `src/lib/constants.ts`) — swap once approved.

**Submission checklist doc**
- `extension/SUBMISSION.md`: step-by-step of what you (the human) do in the Chrome Developer Dashboard — $5 fee, upload zip, paste description, screenshots, privacy URL, justification for each permission. This is the only step Lovable can't automate.

---

## Deliverables summary

| Track | New files | Edited files | Migrations |
|---|---|---|---|
| Signal cloud | `ml/curated_seed.mjs` | trigger via migration, result card chip | 1 |
| FP control | `ml/legit_offers.jsonl`, `ml/evaluate.mjs`, `ml/EVAL_REPORT.md` | `src/lib/confidence.ts`, result card | 0 |
| Extension | 4 icons, `privacy.html` route, `extension/SUBMISSION.md`, `store-listing.md`, screenshots | `manifest.json`, zip script, `src/lib/constants.ts`, extension download UI | 0 |

Total: 1 migration, ~10 new files, ~6 edits. All three tracks land in a single build pass.

Approve and I'll switch to build mode and ship it.
