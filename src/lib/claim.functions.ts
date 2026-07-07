// Claims a guest investigation (stored in the browser's localStorage) into
// the signed-in user's account. Runs as the authenticated user via RLS.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  name: z.string().trim().min(1).max(200),
  input: z.object({
    urls: z.array(z.string()).default([]),
    emails: z.array(z.string()).default([]),
    text: z.string().default(""),
  }),
  result: z.object({
    trust_score: z.number(),
    risk_category: z.string(),
    confidence: z.number(),
    model_used: z.string(),
    fraud_probability: z.number(),
    kaggle_features: z.record(z.string(), z.number()),
    kaggle_contributions: z.record(z.string(), z.number()),
    weighted_features: z.record(z.string(), z.number()),
    weighted_score: z.number(),
    verifications: z.array(z.any()),
    domains: z.array(z.string()),
    emails: z.array(z.string()),
    summary: z.string(),
    positive_findings: z.array(z.string()),
    negative_findings: z.array(z.string()),
    missing_evidence: z.array(z.string()),
    recommendation: z.string(),
    model_metadata: z.any(),
  }),
});

export const claimGuestInvestigation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    const { data: inv, error: invErr } = await supabase.from("investigations").insert({
      user_id: userId,
      name: data.name,
      status: "completed" as any,
      progress: 100,
      trust_score: data.result.trust_score,
      risk_category: data.result.risk_category as any,
      best_model: data.result.model_used,
      completed_at: new Date().toISOString(),
    }).select("id").single();
    if (invErr) throw new Error(invErr.message);
    const invId = inv.id;

    // Evidence
    const evidenceRows = [
      ...data.input.urls.map((u) => ({ investigation_id: invId, user_id: userId, kind: "url" as const, content: u, label: null, storage_path: null, mime_type: null, size_bytes: null })),
      ...data.input.emails.map((e) => ({ investigation_id: invId, user_id: userId, kind: "text" as const, content: e, label: "email", storage_path: null, mime_type: null, size_bytes: null })),
      ...(data.input.text ? [{ investigation_id: invId, user_id: userId, kind: "text" as const, content: data.input.text, label: "description", storage_path: null, mime_type: null, size_bytes: null }] : []),
    ];
    if (evidenceRows.length) await supabase.from("evidence").insert(evidenceRows);

    // Verifications
    if (data.result.verifications.length) {
      await supabase.from("verifications").insert(
        data.result.verifications.map((v: any) => ({
          investigation_id: invId, user_id: userId,
          category: v.category, check_name: v.check_name,
          status: (v.status ?? "pass") as any,
          score: v.score, result: v as any, weight: 1,
        }))
      );
    }

    // ML prediction
    await supabase.from("ml_predictions").insert({
      investigation_id: invId, user_id: userId,
      model_used: data.result.model_used,
      prediction_score: data.result.trust_score,
      confidence: data.result.confidence,
      risk_category: data.result.risk_category as any,
      features: { kaggle: data.result.kaggle_features, weighted: data.result.weighted_features, fraud_probability: data.result.fraud_probability } as any,
      feature_importance: data.result.kaggle_contributions as any,
    });

    // Trust report
    await supabase.from("trust_reports").insert({
      investigation_id: invId, user_id: userId,
      summary: data.result.summary,
      positive_findings: data.result.positive_findings as any,
      negative_findings: data.result.negative_findings as any,
      missing_evidence: data.result.missing_evidence as any,
      recommendation: data.result.recommendation,
      full_report: {
        model: data.result.model_used,
        model_metadata: data.result.model_metadata,
        kaggle_features: data.result.kaggle_features,
        kaggle_contributions: data.result.kaggle_contributions,
        weighted_features: data.result.weighted_features,
        weighted_score: data.result.weighted_score,
        generated_at: new Date().toISOString(),
      } as any,
    });

    await supabase.from("activities").insert({
      investigation_id: invId, user_id: userId, level: "info",
      message: "Investigation claimed from guest session.",
      meta: {} as any,
    });

    return { id: invId };
  });
