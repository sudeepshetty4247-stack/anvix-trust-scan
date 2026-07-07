# ANVIX V2 — Report Redesign Plan

Redesign the investigation report from a technical dashboard into a plain-English trust verdict. All existing backend logic (SPF/DMARC/DNS/WHOIS/SSL, Kaggle-LR, ensemble, playbooks, live verification, AI narrative) stays intact — we only restructure the UI on `src/routes/_authenticated/investigations.$id.tsx` and add a few presentation components.

## New report structure (top → bottom)

1. **Verdict Hero** — big colored banner
   - Emoji + label: 🟢 Trusted / 🟡 Needs Verification / 🟠 Suspicious / 🔴 Likely Scam
   - One-line human decision: "Do NOT continue" / "Verify first" / "Looks safe"
   - Emotional headline: "Stop." / "Be careful." / "Good news."
   - Small trust score chip underneath (e.g. `18/100`)

2. **Top 3 Reasons** — plain English, no jargon
   - Auto-translated from existing findings (SPF→"sender email couldn't be fully verified", WHOIS→"couldn't verify when this website was registered", etc.)

3. **What Should I Do Now?** — action checklist
   - ✓ Do / ❌ Don't columns
   - Uses existing `narrative.action_checklist` + a "Do NOT pay / share Aadhaar / share PAN / share bank details" default block for scam verdicts

4. **What Scammers Usually Do Next** — from existing `narrative.next_predicted_asks`

5. **Investigation Timeline** — animated checklist
   - Files uploaded → Text extracted → Recruiter analysed → Website checked → Domain verified → Scam DB compared → AI reasoning → Final score

6. **Explain Like I'm New to Job Hunting** — collapsible
   - Uses existing `narrative.narrative` (already plain English)

7. **Investigation Summary stats** — replaces "Confidence 98%"
   - Checks performed / Passed / Warnings / Failed (derived from existing verifications)

8. **Evidence** — kept, grouped by kind (Website/Email/Offer/Screenshot/WhatsApp)

9. **Technical Investigation** — collapsed by default
   - All current SPF/DMARC/DNS/MX/WHOIS/SSL/headers/ensemble/LR/GBM detail moves inside this accordion

10. **Final Recommendation** — sticky footer card with one decision + share/PDF buttons (existing ShareCompletionCard reused)

## New files

- `src/lib/plain-language.ts` — pure mapper: technical finding string → human sentence. Covers SPF, DMARC, DNS, MX, WHOIS, SSL, TLD, free-email-recruiter, payment_request, crypto, urgency, grammar, etc.
- `src/lib/verdict.ts` — maps `RiskCategory` + score → `{ emoji, label, headline, decision, tone, color }` for the hero.
- `src/components/report/VerdictHero.tsx`
- `src/components/report/TopReasons.tsx`
- `src/components/report/ActionChecklist.tsx`
- `src/components/report/NextSteps.tsx`
- `src/components/report/InvestigationTimeline.tsx`
- `src/components/report/ChecksSummary.tsx`
- `src/components/report/TechnicalAccordion.tsx` (wraps all current technical panels)

## Edited files

- `src/routes/_authenticated/investigations.$id.tsx` — reorder into the new structure; move current technical UI into `<TechnicalAccordion>`.
- `src/lib/report-pdf.ts` — rebuild PDF layout to mirror new order (Cover → Verdict → Reasons → Recommendations → Timeline → Evidence → Technical Appendix).

## Out of scope (keeps working as-is)

- Scoring engine, Kaggle LR, ensemble, playbooks, live verification, AI narrative generation, share cards, extension, ML pipeline.
- Auth, routing, database schema.
- No new AI calls — everything is a UI reorganization + a deterministic plain-language mapper.

## Success check

After build, open an existing investigation and confirm:
- Verdict + color visible above the fold
- Zero acronyms (SPF/DMARC/WHOIS/DNS/MX/SSL) visible before opening the technical accordion
- Timeline, next-steps, action checklist all render
- PDF export still works
