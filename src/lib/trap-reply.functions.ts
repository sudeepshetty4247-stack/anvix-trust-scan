// Trap-Reply Generator — proposes safe replies the user can send back to the
// scammer to extract more evidence without spooking them. Then scores the
// scammer's reply once the user pastes it.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callJSON } from "./ai-gateway.server";

const GenInput = z.object({
  case_summary: z.string().min(10).max(4000),
  recruiter_name: z.string().max(120).optional(),
  company_claimed: z.string().max(120).optional(),
});

export type TrapReply = {
  goal: string;      // what evidence this reply is trying to extract
  message: string;   // the exact text the user should send
  tone: string;      // e.g. "polite and inquisitive"
  watch_for: string; // what the scammer's response will reveal
};

export type TrapReplyBundle = {
  replies: TrapReply[];
  safety_notes: string[];
};

const GEN_SYSTEM = `You are ANVIX, a cybercrime investigator coaching a scam victim.
Your job: propose 3 short WhatsApp/email replies the victim can send to a suspected recruitment scammer.

GOALS of each reply (pick different goals across the 3):
1. Force the scammer to prove they have an official company email address.
2. Extract more evidence (UPI ID, bank account, phone number, offer letter PDF, company registration number).
3. Buy the victim time and shift the balance (e.g. "let me consult my parents / HR at the company").

CONSTRAINTS:
- Under 40 words each.
- Polite, plausibly written by a nervous fresh graduate. NEVER threatening or accusatory — that just makes the scammer disappear.
- Never ask a question that reveals the victim suspects a scam.
- Never share personal documents, OTPs, or money.
- Write in the same language mix the user seems to speak (English by default; use simple Hinglish if the case summary shows it).

Return strict JSON:
{
  "replies": [
    { "goal": string, "message": string, "tone": string, "watch_for": string }
  ],
  "safety_notes": string[]
}`;

export const generateTrapReplies = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GenInput.parse(d))
  .handler(async ({ data }): Promise<TrapReplyBundle> => {
    const prompt = `Case summary: ${data.case_summary}
Recruiter name: ${data.recruiter_name ?? "unknown"}
Company they claim to represent: ${data.company_claimed ?? "unknown"}

Generate 3 trap replies now.`;
    const out = await callJSON<TrapReplyBundle>({
      messages: [
        { role: "system", content: GEN_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });
    return {
      replies: Array.isArray(out.replies) ? out.replies.slice(0, 3) : [],
      safety_notes: Array.isArray(out.safety_notes) ? out.safety_notes : [],
    };
  });

// Score the scammer's reply to the trap.
const ScoreInput = z.object({
  original_case: z.string().min(10).max(4000),
  trap_sent: z.string().min(1).max(2000),
  scammer_reply: z.string().min(1).max(4000),
});

export type TrapScore = {
  verdict: "confirmed_scam" | "still_suspicious" | "possibly_legit";
  emoji: string;
  headline: string;
  new_red_flags: string[];
  new_evidence: {
    emails: string[];
    phones: string[];
    payment_handles: string[];
    domains: string[];
  };
  next_action: string;
};

const SCORE_SYSTEM = `You are ANVIX, evaluating a scammer's reply to a trap message.
Read the reply and decide:
- Did they refuse the reasonable request? (huge red flag)
- Did they escalate pressure or urgency? (red flag)
- Did they provide new identifiers (UPI, bank, phone, email, website)? Extract them.
- Did they actually answer the question with verifiable info? (softens verdict)

Return strict JSON:
{
  "verdict": "confirmed_scam" | "still_suspicious" | "possibly_legit",
  "emoji": string,
  "headline": string,
  "new_red_flags": string[],
  "new_evidence": {
    "emails": string[], "phones": string[], "payment_handles": string[], "domains": string[]
  },
  "next_action": string
}`;

export const scoreTrapReply = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ScoreInput.parse(d))
  .handler(async ({ data }): Promise<TrapScore> => {
    const out = await callJSON<TrapScore>({
      messages: [
        { role: "system", content: SCORE_SYSTEM },
        {
          role: "user",
          content: `Original case:\n${data.original_case}\n\nTrap message we sent:\n${data.trap_sent}\n\nScammer replied with:\n${data.scammer_reply}`,
        },
      ],
      temperature: 0.2,
    });
    return {
      verdict: out.verdict ?? "still_suspicious",
      emoji: out.emoji ?? "🟠",
      headline: out.headline ?? "",
      new_red_flags: Array.isArray(out.new_red_flags) ? out.new_red_flags : [],
      new_evidence: {
        emails: out.new_evidence?.emails ?? [],
        phones: out.new_evidence?.phones ?? [],
        payment_handles: out.new_evidence?.payment_handles ?? [],
        domains: out.new_evidence?.domains ?? [],
      },
      next_action: out.next_action ?? "",
    };
  });
