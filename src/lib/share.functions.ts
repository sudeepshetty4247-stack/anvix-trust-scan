// ANVIX Track 7 — Viral share flow.
// Creates a public, read-only snapshot of a completed investigation so the
// verdict can be shared via a stable /r/<slug> link (WhatsApp, Telegram, PDF QR).
// Snapshot is denormalized and PII-free.

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const slugId = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 12);

function serverPublishableClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// ------- Types -------

export type PublicReport = {
  slug: string;
  case_name: string;
  verdict: string;
  trust_score: number;
  confidence_low: number;
  confidence_high: number;
  band_reason: string;
  top_reasons: string[];
  contact_fingerprints: { kind: string; masked: string }[];
  created_at: string;
  expires_at: string;
};

// ------- Create -------

const CreateInput = z.object({
  investigation_id: z.string().uuid().nullable().optional(),
  case_name: z.string().min(1).max(200),
  verdict: z.string().min(1).max(40),
  trust_score: z.number().int().min(0).max(100),
  confidence_low: z.number().int().min(0).max(100),
  confidence_high: z.number().int().min(0).max(100),
  band_reason: z.string().max(400).default(""),
  top_reasons: z.array(z.string().max(200)).max(6).default([]),
  contact_fingerprints: z
    .array(z.object({ kind: z.string().max(20), masked: z.string().max(80) }))
    .max(8)
    .default([]),
  source: z.enum(["guest", "authed"]).default("guest"),
});

export type CreatePublicReportInput = z.infer<typeof CreateInput>;

export const createPublicReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data }): Promise<{ slug: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Retry on slug collision (extremely unlikely with 12-char alphabet-31)
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = slugId();
      const { error } = await supabaseAdmin.from("public_reports").insert({
        slug,
        investigation_id: data.investigation_id ?? null,
        case_name: data.case_name,
        verdict: data.verdict,
        trust_score: data.trust_score,
        confidence_low: data.confidence_low,
        confidence_high: data.confidence_high,
        band_reason: data.band_reason,
        top_reasons: data.top_reasons,
        contact_fingerprints: data.contact_fingerprints,
        source: data.source,
      });
      if (!error) {
        if (data.investigation_id) {
          await supabaseAdmin
            .from("investigations")
            .update({ public_slug: slug })
            .eq("id", data.investigation_id);
        }
        return { slug };
      }
      if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    }
    throw new Error("Could not allocate a unique share slug");
  });

// ------- Read -------

export const getPublicReport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(4).max(30) }).parse(d))
  .handler(async ({ data }): Promise<PublicReport | null> => {
    const sb = serverPublishableClient();
    if (!sb) return null;
    const { data: row } = await sb
      .from("public_reports")
      .select(
        "slug, case_name, verdict, trust_score, confidence_low, confidence_high, band_reason, top_reasons, contact_fingerprints, created_at, expires_at",
      )
      .eq("slug", data.slug)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!row) return null;
    return {
      slug: row.slug,
      case_name: row.case_name,
      verdict: row.verdict,
      trust_score: row.trust_score,
      confidence_low: row.confidence_low,
      confidence_high: row.confidence_high,
      band_reason: row.band_reason ?? "",
      top_reasons: (row.top_reasons as string[] | null) ?? [],
      contact_fingerprints:
        (row.contact_fingerprints as { kind: string; masked: string }[] | null) ?? [],
      created_at: row.created_at,
      expires_at: row.expires_at,
    };
  });

// ------- Recently-shared strip (landing page) -------

export const listRecentPublicReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    Array<{ slug: string; verdict: string; trust_score: number; case_name: string; created_at: string }>
  > => {
    const sb = serverPublishableClient();
    if (!sb) return [];
    const { data } = await sb
      .from("public_reports")
      .select("slug, verdict, trust_score, case_name, created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(24);
    // Hide placeholder/empty runs — only surface real named cases.
    const cleaned = (data ?? []).filter((r) => {
      const name = (r.case_name ?? "").trim().toLowerCase();
      return name.length > 0 && name !== "untitled investigation" && name !== "untitled";
    });
    return cleaned.slice(0, 6);
  },
);
