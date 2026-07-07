# ANVIX v3 — The "nobody has this" upgrade

You picked all 4 leaps and "Pick 2-3". Ranking by *unique impact vs. college-project realism*, I'm proposing these three (the DistilBERT path is deferred — our current ensemble at ROC-AUC 0.87 is already defensible, and encoder upgrades give small user-visible wins for large engineering cost).

---

## Track 4 — Community Intelligence Layer *(the network-effect story)*

**The pitch:** Every investigation makes the next one smarter. If any past ANVIX user (or a curated seed set) has flagged this recruiter email, phone, WhatsApp number, domain, or salary-band offer, the next user sees it *before* they upload anything else.

**How:**
- New Supabase table `global_signals(hash, kind, first_seen, last_seen, report_count, severity, sample_context)`. Contacts are stored as SHA-256 hashes with a peppered secret — raw PII never persists.
- On every completed investigation, hash the extracted emails/phones/domains/recruiter-name+company pairs and upsert with `report_count += 1`.
- New pipeline step `checkGlobalSignals()` — for each candidate hash, query `global_signals`. If `report_count >= 2` (or seeded blacklist), raise a **"Previously reported"** card at the top of the report with the count and last-seen date.
- Seed the table with ~500 documented scam contacts from BBB, Trend Micro reports, r/Scams archives, and Indian TRAI DND registry (public CSVs).
- New "Signal Cloud" chart on the landing page: total reports, unique bad actors, top scam categories this week (live from `global_signals` aggregates).

**Judge story:** *"ANVIX is the only student project where the model improves as more people use it."*

---

## Track 5 — Live Recruiter & Company Verification *(answers "is this person real?")*

**The pitch:** Right now we score text. Users want to know *"does this recruiter and this company actually exist?"*.

**How, per checkable entity:**
- **LinkedIn recruiter check** — LinkedIn connector already in the workspace; call `/v2/userinfo` pattern to verify the connected member; use LinkedIn public search-style API to check whether a `name + company` pair returns a real profile. If no match → red flag *"Recruiter not found on LinkedIn."* (LinkedIn's `people search` API is scope-gated; fallback to Google `site:linkedin.com/in "Name" "Company"` via Semrush SERP or a plain fetch of LinkedIn's public HTML preview.)
- **Company registry check** (parallel, per detected company):
  - India → MCA21 free lookup (`www.mca.gov.in/mcafoportal/companyLLPMasterData.do`) scraped through a server function; parses CIN, incorporation date, status.
  - Global → OpenCorporates public API (`api.opencorporates.com/companies/search`) — free tier, 500 req/day, no key needed for basic search.
  - UK → Companies House public API (free, key-based; user provides via `add_secret` only if needed).
- **Recruiter photo forensics** — if a screenshot contains a profile picture, extract via Gemini vision (already wired), then compute a perceptual hash (`sharp` isn't available on Workers → use pure-JS `imghash`-style dHash). Compare against a small seed of known-scammer stock photos + cross-check with a Google Reverse Image lookup via SerpAPI-style fetch (Semrush already available; fallback to `images.google.com/searchbyimage` HTML scrape from server fn).
- **Salary-band plausibility** — send `(role, location, offered_salary)` to Gemini with structured output asking *"Is this offer within 25% of market median?"* Result becomes a forensic signal.

**New UI card:** *"Live Verification"* with pass/fail rows: LinkedIn profile ✓/✗, Company registry ✓/✗, Photo re-used ✓/✗, Salary plausible ✓/✗.

**Judge story:** *"We don't just analyze the message — we independently verify the recruiter and the company exist in the real world."*

---

## Track 6 — Chrome Extension *(the "you'll actually use this" moment)*

**The pitch:** On LinkedIn or Gmail, right-click a suspicious message → *"Investigate with ANVIX"* → new tab opens with evidence pre-filled → one click to run.

**How:**
- New folder `extension/` with Manifest V3, context-menu entry, and a tiny popup showing "last 5 investigations".
- Content script scrapes selected text + surrounding context (sender name/email if visible on LinkedIn/Gmail DOM) and posts it to `https://vetting-forge-ai.lovable.app/investigate?intake=<base64-json>`.
- Add a new URL param handler in `investigate.tsx` that hydrates the intake state from `?intake=` so the user lands with evidence already loaded.
- Package as ZIP via `nix run nixpkgs#zip`, expose in `public/anvix-extension.zip`, add a **"Install Chrome extension"** section on the landing page with the 4-step install guide and fetch+blob download button.
- (Stretch, if time) Firefox variant is manifest V2 — skip unless asked; MV3 works on Chrome/Edge/Brave/Arc/Opera.

**Judge story:** Live demo. Right-click a real LinkedIn scam DM, hit Investigate, boom — full report in 8 seconds. *No other student project can do this.*

---

## What we're deferring
- **DistilBERT + LightGBM** — deferred. Current ensemble (ROC-AUC 0.87, F1 0.49) is already presentable. Text-encoder upgrade is high engineering cost for small user-visible win. We can add a *"Roadmap"* slide in the report.
- **WhatsApp bot** — WhatsApp Business API needs Meta approval (weeks). If you want a messaging surface, we'd substitute a **Telegram bot** (Twilio also works but needs sandbox). Not in this plan — say the word and I'll add a Telegram bot as Track 6b.

---

## Order I'll build it
1. **Community intelligence** first — foundational, everything else feeds it (Track 5 verifications become future global signals too).
2. **Live verification** — LinkedIn connector link + OpenCorporates + MCA + salary plausibility.
3. **Chrome extension** — thin layer on top, mostly UI + intake URL handler.

## New files / changes summary
- `supabase migration` — `global_signals` table + GRANTs + RLS (public SELECT of aggregates only, service-role INSERT).
- `src/lib/global-signals.functions.ts` — hash-and-check + upsert on completion.
- `src/lib/verification-live.functions.ts` — LinkedIn, MCA, OpenCorporates, salary-plausibility calls.
- `src/lib/image-hash.ts` — pure-JS dHash for recruiter photos.
- `src/routes/investigate.tsx` — new "Previously reported" + "Live Verification" cards, `?intake=` handler.
- `src/routes/index.tsx` — Signal Cloud stats section + Chrome-extension install block.
- `extension/manifest.json`, `extension/background.js`, `extension/content.js`, `extension/popup.html`.
- `public/anvix-extension.zip` — packaged output.
- Data seed script `ml/seed_global_signals.py` — loads public scam contact lists.
- Report additions: new sections in DOCX (comes in Track 7).

## Open decisions before I start
- **LinkedIn recruiter check** — do you want me to link the LinkedIn connector now (needs your workspace to have it linked; if not, I'll fall back to the public-Google-scrape route which is scrappier but works with zero setup)?
- **Seed data** — OK to seed `global_signals` with public scam-contact CSVs I fetch from BBB / r/scams archives so the network-effect feels populated on Day 1?

I'll proceed with defaults if you just say "go".