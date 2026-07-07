import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateInput = z.object({ name: z.string().trim().min(1).max(120) });

export const createInvestigation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("investigations")
      .insert({ user_id: context.userId, name: data.name, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listInvestigations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("investigations")
      .select("id,name,status,trust_score,risk_category,created_at,completed_at,progress")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data;
  });

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [invRes, evRes] = await Promise.all([
      context.supabase.from("investigations").select("id,trust_score,risk_category,status", { count: "exact" }),
      context.supabase.from("evidence").select("id", { count: "exact", head: true }),
    ]);
    if (invRes.error) throw new Error(invRes.error.message);
    const invs = invRes.data ?? [];
    const completed = invs.filter((i) => i.status === "completed" && i.trust_score != null);
    const avg = completed.length
      ? Math.round(completed.reduce((s, i) => s + Number(i.trust_score), 0) / completed.length)
      : null;
    const dist: Record<string, number> = {};
    for (const i of completed) dist[i.risk_category ?? "unknown"] = (dist[i.risk_category ?? "unknown"] ?? 0) + 1;
    return {
      totalInvestigations: invRes.count ?? invs.length,
      evidenceCollected: evRes.count ?? 0,
      averageTrustScore: avg,
      riskDistribution: dist,
    };
  });

export const getInvestigation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [inv, evidence, verifications, activities, prediction, report] = await Promise.all([
      context.supabase.from("investigations").select("*").eq("id", data.id).single(),
      context.supabase.from("evidence").select("*").eq("investigation_id", data.id).order("created_at"),
      context.supabase.from("verifications").select("*").eq("investigation_id", data.id).order("created_at"),
      context.supabase.from("activities").select("*").eq("investigation_id", data.id).order("created_at"),
      context.supabase.from("ml_predictions").select("*").eq("investigation_id", data.id).maybeSingle(),
      context.supabase.from("trust_reports").select("*").eq("investigation_id", data.id).maybeSingle(),
    ]);
    if (inv.error) throw new Error(inv.error.message);
    return {
      investigation: inv.data,
      evidence: evidence.data ?? [],
      verifications: verifications.data ?? [],
      activities: activities.data ?? [],
      prediction: prediction.data,
      report: report.data,
    };
  });

const AddEvidenceInput = z.object({
  investigation_id: z.string().uuid(),
  items: z.array(z.object({
    kind: z.enum(["url", "text", "file"]),
    label: z.string().max(200).optional(),
    content: z.string().max(20000).optional(),      // url or text or file name
    storage_path: z.string().max(400).optional(),   // for file uploads
    mime_type: z.string().max(120).optional(),
    size_bytes: z.number().int().nonnegative().optional(),
  })).min(1).max(30),
});

export const addEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AddEvidenceInput.parse(d))
  .handler(async ({ data, context }) => {
    const rows = data.items.map((it) => ({
      investigation_id: data.investigation_id,
      user_id: context.userId,
      kind: it.kind,
      label: it.label ?? null,
      content: it.content ?? null,
      storage_path: it.storage_path ?? null,
      mime_type: it.mime_type ?? null,
      size_bytes: it.size_bytes ?? null,
    }));
    const { error } = await context.supabase.from("evidence").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });
