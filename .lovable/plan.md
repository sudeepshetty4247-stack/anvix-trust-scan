# Final Polish Sprint — Track 7 + Track 8

You chose "two tracks — winner + supporting." Picking the two highest-leverage gaps:

- **Winner → Track 7: Viral Share Flow** (fixes the "no distribution" gap — the single thing that keeps ANVIX from being useful to skeptics who wouldn't visit a website)
- **Supporting → Track 8: Community Cold-Start + Model Confidence** (fixes the "empty table on day 1" gap and adds the ±confidence band that makes the score defensible in viva)

Model upgrade to DistilBERT is deferred — it's a 2-day training job and the current ensemble is good enough. Instead, Track 8 adds **calibrated confidence intervals** on top of the existing model, which addresses the "how sure are you?" question without retraining.

---

## Track 7 — Viral Share Flow

**Goal:** every completed investigation produces a public, read-only report URL that can be pasted into WhatsApp / Telegram / SMS, plus a mobile-first "warning card" image and a QR on the PDF.

### 7.1 Public read-only report route
- New DB column `investigations.public_slug` (nullable, unique, 12-char nanoid). Set at completion for signed-in users; guest reports get an ephemeral slug stored in guest storage.
- New table `public_reports` (denormalized snapshot: slug, verdict, score, confidence_low, confidence_high, top_3_reasons, redacted_contact_fingerprints, created_at, expires_at). Snapshot avoids leaking evidence blobs and freezes the report so re-scoring later doesn't change what was shared. RLS: `TO anon SELECT USING (expires_at > now())`.
- Route `src/routes/r.$slug.tsx` — server-loaded via `createServerFn` using publishable-key client. Renders a stripped-down public view: verdict badge, score with confidence band, top 3 signals, "This was reported by ANVIX on <date>" watermark. No evidence, no PII, no PDF download for anonymous viewers.
- Route head sets og:title / og:description / og:image dynamically from the snapshot so link previews in WhatsApp/Telegram show the verdict + score.

### 7.2 Share card image (mobile-first)
- New server function `generateShareCard({slug})` — uses `@vercel/og`-style JSX-to-PNG (or a canvas fallback via the existing `imagegen--edit_image` tool at render time) to produce a 1200×630 PNG: red/amber/green verdict, score, one-line summary, ANVIX watermark.
- Stored in Supabase Storage bucket `share-cards` (new, public read). URL wired into og:image on the `/r/$slug` route.
- Completion screen shows the card inline with three buttons: **Copy link**, **Share on WhatsApp** (`https://wa.me/?text=...`), **Share on Telegram** (`https://t.me/share/url?url=...`).

### 7.3 QR on PDF
- In `src/lib/report-pdf.ts`, add a QR code (using `qrcode` npm package, pure-JS, Worker-safe) on the cover page pointing to the public `/r/$slug` URL. Caption: "Scan to verify this report online."
- Adds credibility: the recipient (parent / friend) can verify the PDF wasn't tampered with by scanning.

### 7.4 Landing page nudge
- New section on `src/routes/index.tsx` under Signal Cloud: "Recently shared warnings" — pulls the last 6 public reports (verdict + first 4 chars of slug), each linking to its `/r/$slug`. Turns the community layer visible and creates social proof.

---

## Track 8 — Community Cold-Start + Model Confidence

**Goal:** `global_signals` starts warm on day one, and every score ships with a ±confidence band.

### 8.1 Seed script for global_signals
- New file `ml/seed_global_signals.py` — pulls from three public sources:
  1. **CERT-In / MHA cybercrime alert bulletins** (publicly published scam phone numbers and payment handles for job-fraud advisories)
  2. **Public GitHub scam-blocklist repos** (e.g. `mitchellkrogza/Phishing.Database`, `PhishTank` domain dumps — filtered to job/recruitment keywords)
  3. **Kaggle "Fake Job Postings" dataset contact fields** (emails and domains from the label=fraud rows)
- Deduplicates, applies the same peppered SHA-256 hash as the live code path, upserts ~2000-5000 rows into `global_signals` with `source='seed_v1'` and `severity` calibrated per source.
- New Supabase migration inserts a marker row so future seeds are idempotent.
- Run once via `code--exec`; result: any investigation on day 1 has a real chance of hitting "previously reported."

### 8.2 Score confidence intervals
- New file `src/lib/confidence.ts` — computes a ±band from three inputs:
  1. **Ensemble disagreement**: `|LR_prob - GBM_prob|` mapped to 0-15 point band (models disagree → wider band).
  2. **Evidence completeness**: missing categories (no email, no offer letter, no company) each widen the band by 3 points.
  3. **Community signal density**: matches in `global_signals` narrow the band (real reports = higher certainty).
- Formula: `band = clamp(base(5) + 15*disagreement + 3*missing - 5*community_hits, min=3, max=25)`.
- Wired into scoring output: `{ score, confidence_low, confidence_high, band_reason }`.
- UI: score badge shows "42 ± 8" instead of "42"; hover/tap reveals `band_reason` ("Models agreed strongly. Missing email evidence widened band by 3.").
- Also written into `public_reports` snapshot and rendered on `/r/$slug`.

### 8.3 Adversarial sanity check (one-off, not shipped)
- Run 5 real known-legit offer letters (Google/Microsoft/TCS templates, publicly available) through the pipeline via `code--exec` script. Log scores. If any flag as scam (score < 40), tune the `verified_domain_bonus` weight to fix false positives. Document results in `.lovable/plan.md` for viva defense.

---

## Files (create/edit)

**Create:**
- `supabase/migrations/<ts>_public_reports.sql` (table + RLS + storage bucket `share-cards`)
- `supabase/migrations/<ts>_investigations_slug.sql` (add `public_slug` column)
- `src/routes/r.$slug.tsx` (public read-only report)
- `src/lib/share.functions.ts` (`createPublicReport`, `generateShareCard`)
- `src/lib/confidence.ts` (interval math)
- `src/components/ShareCompletionCard.tsx` (WhatsApp/Telegram/copy buttons)
- `ml/seed_global_signals.py` + generated `ml/seed_global_signals.json`

**Edit:**
- `src/lib/scoring.ts` (return confidence band)
- `src/lib/report-pdf.ts` (QR code + confidence band on cover)
- `src/routes/investigate.tsx` (show ShareCompletionCard on success)
- `src/routes/index.tsx` (Recently shared warnings strip)
- `src/lib/guest.functions.ts` + `src/lib/investigations.functions.ts` (write snapshot to `public_reports` on completion)
- `src/integrations/supabase/types.ts` (regenerated)
- `.lovable/plan.md` (adversarial test log)

## Deferred (called out for honesty)
- DistilBERT fine-tune (2-day GPU job, marginal for demo)
- Chrome Web Store submission (needs paid developer account)
- Telegram/WhatsApp bot (share links cover 80% of the value at 5% of the effort)
- Legitimate-offer false-positive dataset beyond 5 samples (needs human labelers)

## Open question before I build
- **Public report expiry**: 30 days, 90 days, or never? Longer = better for viva/portfolio ("here's a live link"), shorter = safer if a false positive slips through. Default proposal: **90 days**, extendable by owner if signed in.
- **Share card image**: PNG generated server-side (heavier, prettier) or SVG rendered client-side (lighter, might not preview in WhatsApp)? Default proposal: **server-side PNG via `satori` + `@resvg/resvg-wasm`** — both Worker-safe.

If both defaults are fine, say "go" and I'll build Track 7 then Track 8.
