# ANVIX Rescue Kit

Four new features that together turn ANVIX from "a scam scanner" into "the thing every job seeker in India actually needs before, during, and after a scam". Plus one small removal.

## 0. Remove the broken WhatsApp share button

Chrome now blocks `api.whatsapp.com/send` links on desktop (`ERR_BLOCKED_BY_RESPONSE`). Remove the WhatsApp button from `ShareCompletionCard`. Keep Copy link, Telegram, and native Share — those work.

---

## 1. "Ask ANVIX" — the 5-second check (the easy one you asked for)

**The problem it solves:** Most users don't have a PDF, a screenshot, or an email. They just have a message on WhatsApp and a bad feeling. Filling out a form is too much friction.

**How it feels:**
- New route `/ask` + a big floating "Ask ANVIX" button on every page.
- One giant textbox: *"Paste any message or ask anything — 'Amazon recruiter asking ₹500 joining fee, real or scam?'"*
- Hit send → 3-second reply in plain English: verdict emoji + one-line reason + one action ("Do not pay. This is a scam.").
- If ANVIX needs more info, it asks one follow-up question, not a form.
- Full investigation is offered as an optional "Want a full report?" button underneath.

**Why nobody has this:** every scam-checker forces you into a form. Ours is a conversation.

**Tech:** new `src/routes/ask.tsx` + `src/lib/ask.functions.ts` calling the AI gateway with the same Kaggle model + verification signals, but tuned for one-shot conversational input. Reuses existing scoring.

---

## 2. UPI / Bank Account Scanner — the "before you pay" check

**Problem:** Scammers reuse the same UPI IDs and bank accounts across hundreds of victims.

**How it feels:**
- New route `/check-upi` + prominent card on the home page.
- One textbox: *"Paste the UPI ID, bank account, or phone number they asked you to pay"*.
- Instant verdict: *"🚨 This UPI has been flagged by 12 ANVIX users. Total reported losses: ₹47,000. Do NOT pay."* or *"No reports yet — but always verify before sending money."*
- If not found, user can report it in one tap — grows the community database.

**Tech:** reuses the existing `global_signals` table (already stores `kind`, `value_hash`, `report_count`, `last_seen`). Adds `kind` values `upi`, `bank_account`, `phone_number`. New server fns `checkPaymentIdentifier` and `reportPaymentIdentifier`. Uses the existing `ANVIX_SIGNAL_PEPPER` secret for hashing.

---

## 3. One-Click Cybercrime FIR

**Problem:** If someone already lost money, they have 24–72 hours to file a complaint at cybercrime.gov.in to freeze the scammer's account. But the portal is confusing and most people give up.

**How it feels:**
- Button on any completed investigation: **"Generate cybercrime complaint (PDF)"**.
- One dialog asks: your name, phone, amount lost (₹), date paid.
- Downloads a ready-to-submit PDF pre-filled with:
  - Complainant details
  - Incident summary (auto-written from the investigation)
  - Scammer identifiers pulled from evidence (UPI, email, phone, website)
  - Timeline of events
  - Applicable IPC sections (419, 420, 66C, 66D)
  - Evidence list
  - Signature line
- Includes a mini step-by-step guide: "Go to cybercrime.gov.in → Report → File a Complaint → Upload this PDF as attachment."

**Tech:** new `src/lib/fir-pdf.ts` reusing pdf-lib (already installed). Reads existing investigation + evidence + extracted URLs/emails/phones. New dialog component `<GenerateFIRDialog>`.

---

## 4. Trap-Reply Generator — turn the victim into an investigator

**Problem:** After a scan, users want to keep talking to the scammer to extract more proof — but don't know what to say without spooking them.

**How it feels:**
- Button on any high-risk investigation: **"Generate a safe reply"**.
- ANVIX proposes 2–3 messages tuned to extract more evidence, e.g.:
  - "Can you send me the offer letter on your @microsoft.com email? I don't accept scans from personal accounts."
  - "Please share the company registration number so my parents can verify."
- User picks one → copies to clipboard → sends to scammer.
- When the scammer replies, user pastes the reply back into ANVIX → it re-scores the case and updates the verdict with the new evidence.

**Tech:** new `src/lib/trap-reply.functions.ts` calling the AI gateway with existing evidence context. New component `<TrapReplyDialog>` on the investigation detail route.

---

## Order of build

1. Remove broken WhatsApp button (2 min)
2. Ask ANVIX chat — biggest UX win, users see it first
3. UPI Scanner — biggest social-impact win, shareable link
4. Cybercrime FIR generator — the "after the scam" service
5. Trap-Reply Generator — the deep-user feature

Each ships as a working feature on its own; if you want to stop after any step, ANVIX is already noticeably better.

## Out of scope

- No new AI provider needed (Lovable AI Gateway covers all four).
- No new database tables — reuses `global_signals`, `investigations`, `evidence`.
- No auth changes.
- No voice-call feature (you said no).
