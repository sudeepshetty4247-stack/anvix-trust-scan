// UPI / Bank Account / Phone scam scanner.
// Reuses the existing global_signals table + payment_handle/phone kinds.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkGlobalSignalsCore, reportSignalsCore } from "./global-signals.functions";

const Input = z.object({
  identifier: z.string().trim().min(3).max(200),
});

export type PaymentCheckResult = {
  kind: "upi" | "bank_account" | "phone" | "email" | "unknown";
  normalised: string;
  masked: string;
  reported: boolean;
  report_count: number;
  severity: "info" | "warning" | "high" | "critical" | null;
  first_seen: string | null;
  last_seen: string | null;
  verdict: "known_scam" | "no_reports";
  headline: string;
  action: string;
};

function classify(raw: string): { kind: PaymentCheckResult["kind"]; value: string } {
  const v = raw.trim();
  if (/^[a-z0-9._-]+@[a-z]+$/i.test(v)) return { kind: "upi", value: v.toLowerCase() };
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/i.test(v)) return { kind: "email", value: v.toLowerCase() };
  const digits = v.replace(/[\s-]/g, "");
  if (/^\+?\d{10,15}$/.test(digits)) return { kind: "phone", value: digits.replace(/^\+/, "") };
  if (/^\d{9,18}$/.test(digits)) return { kind: "bank_account", value: digits };
  return { kind: "unknown", value: v };
}

function mask(kind: PaymentCheckResult["kind"], v: string): string {
  if (kind === "upi") {
    const [u, d] = v.split("@");
    return `${u.slice(0, 2)}***@${d}`;
  }
  if (kind === "email") {
    const [u, d] = v.split("@");
    return `${u.slice(0, 2)}***@${d}`;
  }
  if (kind === "phone") return v.slice(0, 3) + "****" + v.slice(-2);
  if (kind === "bank_account") return "****" + v.slice(-4);
  return v.length > 20 ? v.slice(0, 8) + "…" : v;
}

// Look up an identifier against the community database.
export const checkPaymentIdentifier = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<PaymentCheckResult> => {
    const { kind, value } = classify(data.identifier);
    const masked = mask(kind, value);

    if (kind === "unknown") {
      return {
        kind,
        normalised: value,
        masked,
        reported: false,
        report_count: 0,
        severity: null,
        first_seen: null,
        last_seen: null,
        verdict: "no_reports",
        headline: "We couldn't recognise that as a UPI, bank account, or phone number.",
        action: "Double-check the format and try again. UPI looks like name@bank, phone is 10 digits, bank account is 9–18 digits.",
      };
    }

    // Map our scanner kinds to global_signals buckets.
    const matches = await checkGlobalSignalsCore({
      emails: kind === "email" ? [value] : [],
      phones: kind === "phone" ? [value] : [],
      domains: [],
      payment_handles: kind === "upi" || kind === "bank_account" ? [value] : [],
      offer_patterns: [],
    });

    const hit = matches[0];
    if (hit) {
      return {
        kind,
        normalised: value,
        masked,
        reported: true,
        report_count: hit.report_count,
        severity: hit.severity,
        first_seen: hit.first_seen,
        last_seen: hit.last_seen,
        verdict: "known_scam",
        headline: `🚨 Reported ${hit.report_count} time${hit.report_count === 1 ? "" : "s"} by other ANVIX users. Do NOT send money.`,
        action:
          "Do not pay. Screenshot everything. File a complaint at cybercrime.gov.in — the sooner you report, the higher the chance of freezing the scammer's account.",
      };
    }

    return {
      kind,
      normalised: value,
      masked,
      reported: false,
      report_count: 0,
      severity: null,
      first_seen: null,
      last_seen: null,
      verdict: "no_reports",
      headline: "No reports yet — but that doesn't mean it's safe.",
      action:
        "New scam accounts appear every day. Only pay if you have verified the recruiter directly through the company's official website or phone number. If they're pressuring you, that alone is a red flag.",
    };
  });

// Report a new scam identifier so future users are protected.
const ReportInput = z.object({
  identifier: z.string().trim().min(3).max(200),
  context: z.string().max(500).optional(),
  amount_lost: z.number().optional(),
});

export const reportPaymentIdentifier = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ReportInput.parse(d))
  .handler(async ({ data }) => {
    const { kind, value } = classify(data.identifier);
    if (kind === "unknown") {
      return { ok: false, error: "Unrecognised identifier format." };
    }
    const contextLine = data.amount_lost
      ? `${data.context ?? ""} · reported loss ₹${data.amount_lost}`.trim()
      : data.context ?? "";
    const result = await reportSignalsCore({
      emails: kind === "email" ? [value] : [],
      phones: kind === "phone" ? [value] : [],
      domains: [],
      payment_handles: kind === "upi" || kind === "bank_account" ? [value] : [],
      offer_patterns: [],
      severity: "high",
      sample_context: contextLine || undefined,
    });
    return { ok: true, ...result };
  });
