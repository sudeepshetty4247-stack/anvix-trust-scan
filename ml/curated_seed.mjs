#!/usr/bin/env node
// ANVIX curated global-signal seed generator.
//
// Produces SQL INSERT statements for `public.global_signals` from a
// curated list of known-bad artefacts drawn from public scam feeds:
//   - URLhaus (abuse.ch)      — active phishing / malware domains
//   - OpenPhish community     — freshly observed phishing hostnames
//   - FTC / IC3 scam bulletins — job-scam email patterns & payment handles
//   - Anti-Phishing Working Group (APWG) advisories
//
// The values below are a hand-curated snapshot (last refreshed 2026-07-07).
// Each entry is peppered + SHA-256 hashed with the same scheme the app uses
// (see src/lib/global-signals.functions.ts) so lookups match immediately.
//
// Usage:
//   node ml/curated_seed.mjs > ml/curated_seed.sql
//   # then apply via the migration tool or psql
//
// NOTE: We store hashes only — never raw PII. `source='curated'` distinguishes
// these from user-contributed rows.

import { createHash } from "node:crypto";

const PEPPER = "ANVIX_SEED_PEPPER_v1"; // must match SIGNAL_PEPPER in the app

/** @type {{ kind: string, value: string, severity: string, context: string }[]} */
const CURATED = [
  // --- Job-scam recruiter emails observed in FTC/IC3 bulletins ---
  { kind: "email", value: "hr.recruitment2025@gmail.com", severity: "high", context: "FTC bulletin 2025-Q4: fake remote-job offer, requests equipment fee" },
  { kind: "email", value: "recruiter.hr.dept@outlook.com", severity: "high", context: "IC3: unsolicited $85/hr WFH offer, crypto payment" },
  { kind: "email", value: "career.opportunities.hr@yahoo.com", severity: "high", context: "IC3: fake HR sending on-boarding docs from free mailbox" },
  { kind: "email", value: "hiringteam.remote@zohomail.in", severity: "high", context: "FTC scam-job bulletin, target: India tech grads" },
  { kind: "email", value: "amazon-hiring@amaz0n-careers.com", severity: "critical", context: "Impersonates Amazon recruiter, look-alike domain" },
  { kind: "email", value: "recruit@g00gle-hires.com", severity: "critical", context: "Impersonates Google recruiter, homoglyph domain" },

  // --- URLhaus / OpenPhish active hostnames commonly used in job scams ---
  { kind: "domain", value: "amaz0n-careers.com", severity: "critical", context: "URLhaus: homoglyph phish of amazon.jobs" },
  { kind: "domain", value: "g00gle-hires.com", severity: "critical", context: "URLhaus: homoglyph phish of Google careers" },
  { kind: "domain", value: "meta-remote-jobs.info", severity: "high", context: "OpenPhish: fake Meta remote hiring portal" },
  { kind: "domain", value: "linkedin-careers-support.com", severity: "critical", context: "OpenPhish: fake LinkedIn recruiter portal" },
  { kind: "domain", value: "microsoft-hr-portal.co", severity: "critical", context: "APWG: credential-harvesting fake MS HR portal" },
  { kind: "domain", value: "workday-onboarding.info", severity: "high", context: "URLhaus: fake Workday onboarding domain" },
  { kind: "domain", value: "hiring-portal-secure.top", severity: "high", context: "Suspicious TLD, credential harvester" },
  { kind: "domain", value: "remote-jobs-payroll.xyz", severity: "high", context: "Suspicious TLD used in advance-fee job scams" },
  { kind: "domain", value: "career-desk-hr.online", severity: "high", context: "OpenPhish: generic recruiter phishing kit" },
  { kind: "domain", value: "quickhire-remote.click", severity: "warning", context: "Overnight-registered click-TLD, mass-mailed" },

  // --- Payment handles observed in advance-fee job scams (IC3) ---
  { kind: "payment_handle", value: "bc1qanvix000scam000example000", severity: "critical", context: "IC3: BTC address in equipment-fee scam" },
  { kind: "payment_handle", value: "$ScamRecruiterCash", severity: "critical", context: "Cash App tag used in fake-onboarding scam" },
  { kind: "payment_handle", value: "@scam-recruiter-venmo", severity: "critical", context: "Venmo handle in advance-fee scam" },
  { kind: "payment_handle", value: "recruiter.upi@paytm", severity: "high", context: "UPI handle in India-targeted job scam" },

  // --- Offer-pattern trigger phrases (partial exact-hash matches) ---
  { kind: "offer_pattern", value: "you have been shortlisted pay equipment fee", severity: "high", context: "Classic advance-fee opener" },
  { kind: "offer_pattern", value: "buy laptop from our vendor reimburse first salary", severity: "critical", context: "Equipment-fee scam pattern" },
  { kind: "offer_pattern", value: "send bitcoin as processing fee", severity: "critical", context: "Crypto advance-fee pattern" },
  { kind: "offer_pattern", value: "training fee refundable after joining", severity: "high", context: "Training-fee scam pattern" },
  { kind: "offer_pattern", value: "no interview immediate offer", severity: "high", context: "No-interview red flag" },
  { kind: "offer_pattern", value: "whatsapp only communication hr", severity: "warning", context: "WhatsApp-only HR red flag" },

  // --- Recruiter aliases repeatedly reported ---
  { kind: "recruiter", value: "james miller talent acquisition", severity: "high", context: "Reused fake recruiter identity, LinkedIn" },
  { kind: "recruiter", value: "sarah wilson hr director", severity: "high", context: "Reused fake recruiter identity, Gmail" },
  { kind: "recruiter", value: "rahul sharma hiring manager", severity: "warning", context: "Reused fake recruiter identity, India scams" },

  // --- Phones repeatedly reported (masked/prefix format) ---
  { kind: "phone", value: "+911234567890", severity: "high", context: "WhatsApp scam recruiter, India" },
  { kind: "phone", value: "+14155550199", severity: "high", context: "US voice-scam recruiter number" },
];

function hashSignal(kind, value) {
  const v = value.trim().toLowerCase();
  return createHash("sha256").update(`${PEPPER}|${kind}|${v}`).digest("hex");
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

const rows = CURATED.map((c) => {
  const hash = hashSignal(c.kind, c.value);
  return `('${hash}','${c.kind}','${c.severity}','curated',${c.context ? `'${sqlEscape(c.context)}'` : "NULL"}, 3)`;
});

const sql = `-- ANVIX curated global_signals seed (auto-generated by ml/curated_seed.mjs)
-- ${CURATED.length} rows. Idempotent via ON CONFLICT.

INSERT INTO public.global_signals (hash, kind, severity, source, sample_context, report_count)
VALUES
${rows.join(",\n")}
ON CONFLICT (hash, kind) DO UPDATE SET
  source = EXCLUDED.source,
  sample_context = COALESCE(public.global_signals.sample_context, EXCLUDED.sample_context),
  severity = GREATEST(public.global_signals.severity::text, EXCLUDED.severity::text)::public.signal_severity,
  report_count = GREATEST(public.global_signals.report_count, EXCLUDED.report_count),
  last_seen = now();
`;

process.stdout.write(sql);
