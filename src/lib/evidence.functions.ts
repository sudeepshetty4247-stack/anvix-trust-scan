// Extract text and entities from user-supplied evidence (screenshot, PDF,
// .eml, or raw text). Uses Gemini 2.5 Flash multimodal via the Lovable AI
// Gateway. Server-only.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callJSON } from "./ai-gateway.server";

const Input = z.object({
  kind: z.enum(["image", "pdf", "eml", "text"]),
  filename: z.string().default(""),
  // For image / pdf: base64 data URL. For eml / text: raw text.
  payload: z.string().min(1),
  mime_type: z.string().default(""),
});

export type ExtractedEvidence = {
  kind: string;
  filename: string;
  extracted_text: string;
  urls: string[];
  emails: string[];
  phones: string[];
  people: string[];
  companies: string[];
  amounts: string[];
  payment_methods: string[]; // 'bank account', 'UPI', 'crypto wallet', 'gift card', ...
  red_flag_notes: string[];
  channel: string; // 'linkedin' | 'whatsapp' | 'gmail' | 'offer letter pdf' | ...
};

const SYSTEM = `You are ANVIX, a recruitment-fraud investigator. You extract structured evidence from user-supplied recruitment materials. Return ONLY strict JSON matching the requested schema. Do not invent data — if a field is not present, return an empty string or empty array.`;

const SCHEMA_INSTRUCTION = `Return JSON with exactly these keys:
{
  "extracted_text": string,           // ALL recruitment-relevant text present in the evidence, cleanly transcribed
  "urls": string[],                   // every URL that appears
  "emails": string[],                 // every email address
  "phones": string[],                 // every phone / WhatsApp number
  "people": string[],                 // recruiter or contact names
  "companies": string[],              // company names mentioned
  "amounts": string[],                // salary / fee / deposit amounts as they appear
  "payment_methods": string[],        // 'personal bank account', 'UPI', 'crypto wallet', 'gift card', 'wire', 'moneygram', ...
  "red_flag_notes": string[],         // short observations about anything suspicious you noticed
  "channel": string                   // best guess: 'linkedin' | 'whatsapp' | 'telegram' | 'gmail' | 'outlook' | 'sms' | 'offer_letter_pdf' | 'company_email' | 'unknown'
}`;

export const extractEvidence = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<ExtractedEvidence> => {
    if (data.kind === "text" || data.kind === "eml") {
      const label =
        data.kind === "eml"
          ? "raw email (.eml) file including headers"
          : "plain text pasted by the user";
      const out = await callJSON<Omit<ExtractedEvidence, "kind" | "filename">>({
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Evidence type: ${label}\nFilename: ${data.filename || "(inline)"}\n\n---BEGIN EVIDENCE---\n${data.payload.slice(0, 60000)}\n---END EVIDENCE---\n\n${SCHEMA_INSTRUCTION}`,
          },
        ],
        temperature: 0,
      });
      return { kind: data.kind, filename: data.filename, ...normalise(out) };
    }

    // image or pdf — send as multimodal content
    const mime = data.mime_type || (data.kind === "image" ? "image/png" : "application/pdf");
    const dataUrl = data.payload.startsWith("data:")
      ? data.payload
      : `data:${mime};base64,${data.payload}`;

    const contentParts: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `Evidence type: ${data.kind === "image" ? "screenshot of a recruitment message, chat, or job posting" : "PDF (likely an offer letter, appointment letter, or job description)"}.\nFilename: ${data.filename || "(uploaded)"}.\n\nTranscribe and structure everything relevant. ${SCHEMA_INSTRUCTION}`,
      },
    ];
    if (data.kind === "image") {
      contentParts.push({ type: "image_url", image_url: { url: dataUrl } });
    } else {
      contentParts.push({
        type: "file",
        file: { filename: data.filename || "evidence.pdf", file_data: dataUrl },
      });
    }

    const out = await callJSON<Omit<ExtractedEvidence, "kind" | "filename">>({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: contentParts },
      ],
      temperature: 0,
    });
    return { kind: data.kind, filename: data.filename, ...normalise(out) };
  });

function normalise(o: Partial<ExtractedEvidence>): Omit<ExtractedEvidence, "kind" | "filename"> {
  const arr = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((s) => s.trim())
      : [];
  return {
    extracted_text: typeof o.extracted_text === "string" ? o.extracted_text : "",
    urls: arr(o.urls),
    emails: arr(o.emails).map((e) => e.toLowerCase()),
    phones: arr(o.phones),
    people: arr(o.people),
    companies: arr(o.companies),
    amounts: arr(o.amounts),
    payment_methods: arr(o.payment_methods),
    red_flag_notes: arr(o.red_flag_notes),
    channel: typeof o.channel === "string" ? o.channel : "unknown",
  };
}
