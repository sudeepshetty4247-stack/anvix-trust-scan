// Narrative + scam-playbook match layer. Runs after the deterministic
// verification + Kaggle-LR scoring: takes the score result plus all
// extracted evidence and produces a human-grade explanation, playbook
// classification, and a prediction of what the scammer will ask for next.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callJSON } from "./ai-gateway.server";
import { PLAYBOOKS, type PlaybookMatch } from "./playbooks";
import type { ExtractedEvidence } from "./evidence.functions";

const Input = z.object({
  case_name: z.string(),
  trust_score: z.number(),
  risk_category: z.string(),
  fraud_probability: z.number(),
  weighted_score: z.number(),
  positive_findings: z.array(z.string()),
  negative_findings: z.array(z.string()),
  verifications_summary: z.string(),
  evidence: z.array(z.object({
    kind: z.string(),
    filename: z.string(),
    extracted_text: z.string(),
    channel: z.string(),
    urls: z.array(z.string()),
    emails: z.array(z.string()),
    phones: z.array(z.string()),
    payment_methods: z.array(z.string()),
    red_flag_notes: z.array(z.string()),
  })),
});

export type Narrative = {
  headline: string;
  narrative: string;      // 2-4 sentence human explanation
  key_evidence: string[]; // bullet points cited to specific evidence
  playbook: PlaybookMatch;
  next_predicted_asks: string[]; // ordered list of what the scammer will ask for next
  action_checklist: string[];    // concrete user actions
  disclaimer: string;
};

const PLAYBOOK_LIBRARY_TEXT = PLAYBOOKS.map((p, i) =>
  `#${i + 1} id=${p.id} name="${p.name}"
   summary: ${p.summary}
   signals: ${p.signals.join("; ")}
   steps: ${p.steps.map((s, si) => `${si}. ${s}`).join(" | ")}
   advice: ${p.advice}`
).join("\n\n");

const SYSTEM = `You are ANVIX, a senior recruitment-fraud investigator. You explain scam attempts in plain English so a candidate under time pressure can make a safe decision. You cite specific evidence. You never invent facts. You always ground playbook matches in the evidence provided. Output strict JSON only.`;

export const narrate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<Narrative> => {
    const evidenceBlock = data.evidence.map((e, i) =>
      `Evidence #${i + 1} — ${e.kind}${e.filename ? ` (${e.filename})` : ""}, channel: ${e.channel}
      urls: ${e.urls.join(", ") || "—"}
      emails: ${e.emails.join(", ") || "—"}
      phones: ${e.phones.join(", ") || "—"}
      payment_methods: ${e.payment_methods.join(", ") || "—"}
      red_flag_notes: ${e.red_flag_notes.join("; ") || "—"}
      text: ${e.extracted_text.slice(0, 3000)}`
    ).join("\n\n");

    const prompt = `Case: "${data.case_name}"
Trust score: ${data.trust_score}/100 (${data.risk_category})
Kaggle-LR fraud probability: ${(data.fraud_probability * 100).toFixed(1)}%
Weighted baseline: ${data.weighted_score}/100

Positive findings: ${data.positive_findings.join(" | ") || "—"}
Negative findings: ${data.negative_findings.join(" | ") || "—"}
Verifications summary: ${data.verifications_summary}

Evidence collected:
${evidenceBlock || "(no evidence supplied)"}

Known scam playbooks:
${PLAYBOOK_LIBRARY_TEXT}

Task:
1. Write a plain-English narrative (2-4 sentences) explaining what this recruitment attempt is and why.
2. Extract 3-6 key evidence bullets, each citing which evidence number and what it shows.
3. Match against the known playbooks. Pick the single best match and set current_step_index to the last step the evidence proves has already happened; if genuinely none apply, set playbook_id null.
4. If a playbook matched, list the next 2-4 things the scammer will likely ask for next, in order.
5. Provide a short action_checklist (3-5 concrete steps) the user should take right now.
6. Return this exact JSON:
{
  "headline": string,                            // one short punchy sentence
  "narrative": string,                           // 2-4 sentences, plain English
  "key_evidence": string[],                      // 3-6 bullets, each references "Evidence #N: ..."
  "playbook": {
    "playbook_id": string | null,
    "playbook_name": string | null,
    "confidence": number,                        // 0..1
    "matched_signals": string[],
    "current_step_index": number | null,
    "next_move": string | null,
    "what_to_do": string
  },
  "next_predicted_asks": string[],
  "action_checklist": string[],
  "disclaimer": string                           // one sentence — remind this is informational, not legal advice
}`;

    const out = await callJSON<Narrative>({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    // Defensive normalisation
    const pb = out.playbook ?? ({} as PlaybookMatch);
    return {
      headline: out.headline ?? "",
      narrative: out.narrative ?? "",
      key_evidence: Array.isArray(out.key_evidence) ? out.key_evidence : [],
      playbook: {
        playbook_id: pb.playbook_id ?? null,
        playbook_name: pb.playbook_name ?? null,
        confidence: typeof pb.confidence === "number" ? pb.confidence : 0,
        matched_signals: Array.isArray(pb.matched_signals) ? pb.matched_signals : [],
        current_step_index: typeof pb.current_step_index === "number" ? pb.current_step_index : null,
        next_move: pb.next_move ?? null,
        what_to_do: pb.what_to_do ?? "",
      },
      next_predicted_asks: Array.isArray(out.next_predicted_asks) ? out.next_predicted_asks : [],
      action_checklist: Array.isArray(out.action_checklist) ? out.action_checklist : [],
      disclaimer: out.disclaimer ?? "This report is informational and does not constitute legal advice.",
    };
  });
