// "Ask ANVIX" — the 5-second scam check. User pastes any message or
// asks any question. Returns a verdict, one-line reason, and one action.
// Uses the existing Lovable AI Gateway helper (no new keys).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callJSON } from "./ai-gateway.server";
import { checkGlobalSignalsCore } from "./global-signals.functions";

const Input = z.object({
  question: z.string().trim().min(3).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .default([]),
});

export type AskAnvixReply = {
  verdict: "safe" | "verify" | "suspicious" | "scam" | "unknown";
  emoji: string;
  headline: string;      // one-line human answer
  reason: string;        // 1-2 sentences why
  action: string;        // one concrete next step
  follow_up?: string;    // optional single question to clarify
  extracted?: {
    emails: string[];
    phones: string[];
    domains: string[];
    payment_handles: string[];
  };
  community_hits?: Array<{ kind: string; matched_preview: string; report_count: number }>;
};

const SYSTEM = `You are ANVIX, an experienced Indian cybercrime investigator that answers job-scam questions from students and fresh graduates in plain English.

STYLE:
- Talk like a trusted older sibling. Never use jargon. Never say SPF, DMARC, DNS, WHOIS, TLD.
- Assume the user is stressed and short on time. Keep answers under 60 words unless they ask for detail.
- Be direct. If it's a scam, say "This is a scam" — do not hedge.
- If you're not sure, say so and ask ONE follow-up question.

TASK:
Read the user's message (which may include quoted recruiter text, screenshots described, or a plain question). Decide:
- verdict: "scam" (clearly fraudulent), "suspicious" (many red flags), "verify" (looks ok but confirm), "safe" (legitimate), "unknown" (need more info).
- emoji: 🔴 for scam, 🟠 for suspicious, 🟡 for verify, 🟢 for safe, ❓ for unknown.
- headline: 1 sentence — the human answer they want.
- reason: 1-2 sentences citing the specific red flags you see.
- action: 1 concrete step they should take right now (e.g. "Do not pay. Apply through microsoft.com/careers instead.").
- follow_up: only if verdict is "unknown" — one question to disambiguate.

Also extract any emails, phone numbers, domains, or payment handles (UPI IDs, bank accounts) mentioned in the message so we can check them against the community database.

Return STRICT JSON matching this shape:
{
  "verdict": "scam" | "suspicious" | "verify" | "safe" | "unknown",
  "emoji": string,
  "headline": string,
  "reason": string,
  "action": string,
  "follow_up": string | null,
  "extracted": {
    "emails": string[],
    "phones": string[],
    "domains": string[],
    "payment_handles": string[]
  }
}`;

export const askAnvix = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<AskAnvixReply> => {
    const messages = [
      { role: "system" as const, content: SYSTEM },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: data.question },
    ];

    const out = await callJSON<AskAnvixReply & { follow_up: string | null }>({
      messages,
      temperature: 0.2,
    });

    // Cross-check extracted identifiers against the community database.
    let community_hits: AskAnvixReply["community_hits"] = [];
    const ex = out.extracted;
    if (ex && (ex.emails.length || ex.phones.length || ex.domains.length || ex.payment_handles.length)) {
      try {
        const matches = await checkGlobalSignalsCore({
          emails: ex.emails ?? [],
          phones: ex.phones ?? [],
          domains: ex.domains ?? [],
          payment_handles: ex.payment_handles ?? [],
          offer_patterns: [],
        });
        community_hits = matches.map((m) => ({
          kind: m.kind,
          matched_preview: m.matched_preview,
          report_count: m.report_count,
        }));
      } catch {
        /* non-fatal */
      }
    }

    // If community hits found and the model was lenient, escalate.
    let verdict = out.verdict;
    let emoji = out.emoji;
    if (community_hits && community_hits.length > 0 && verdict !== "scam") {
      verdict = "scam";
      emoji = "🔴";
    }

    return {
      verdict,
      emoji,
      headline: out.headline ?? "",
      reason: out.reason ?? "",
      action: out.action ?? "",
      follow_up: out.follow_up ?? undefined,
      extracted: out.extracted,
      community_hits,
    };
  });
