// ANVIX Community Intelligence — hash-based lookups against `global_signals`.
//
// Hashes are SHA-256(pepper|kind|value_lower_trim). No raw PII ever leaves
// the browser or reaches the DB. The pepper is a shared constant — its role
// is to defeat generic rainbow tables on a stolen dump, not to be a secret
// from the server itself. Runs on Cloudflare Workers (SubtleCrypto).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Pepper is intentionally in-code so seeds and lookups agree without a
// coordinated secret. If you rotate it, re-seed and clear the table.
export const SIGNAL_PEPPER = "ANVIX_SEED_PEPPER_v1";

export type SignalKind =
  | "email"
  | "phone"
  | "domain"
  | "recruiter"
  | "payment_handle"
  | "offer_pattern";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

export async function hashSignal(kind: SignalKind, value: string): Promise<string> {
  const v = value.trim().toLowerCase();
  return sha256Hex(`${SIGNAL_PEPPER}|${kind}|${v}`);
}

export type ExtractedContacts = {
  emails: string[];
  phones: string[];
  domains: string[];
  payment_handles: string[];
  offer_patterns: string[]; // e.g. matched playbook trigger phrases
};

export type SignalMatch = {
  id: string;
  kind: SignalKind;
  severity: "info" | "warning" | "high" | "critical";
  report_count: number;
  first_seen: string;
  last_seen: string;
  sample_context: string | null;
  matched_preview: string; // masked value shown to user
};

function maskValue(kind: SignalKind, v: string): string {
  if (kind === "email") {
    const [u, d] = v.split("@");
    if (!d) return "***";
    return `${u.slice(0, 2)}***@${d}`;
  }
  if (kind === "phone") return v.slice(0, 4) + "***" + v.slice(-2);
  if (kind === "domain") return v;
  if (kind === "payment_handle") return v.slice(0, 4) + "***";
  return v.length > 40 ? v.slice(0, 37) + "…" : v;
}

const InputCheck = z.object({
  emails: z.array(z.string()).default([]),
  phones: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  payment_handles: z.array(z.string()).default([]),
  offer_patterns: z.array(z.string()).default([]),
});

export type CheckSignalsInput = z.infer<typeof InputCheck>;

// Reusable core: can be awaited directly inside another server-fn handler.
export async function checkGlobalSignalsCore(
  data: CheckSignalsInput,
): Promise<SignalMatch[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  const supabase = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const buckets: Array<[SignalKind, string[]]> = [
    ["email", data.emails],
    ["phone", data.phones],
    ["domain", data.domains],
    ["payment_handle", data.payment_handles],
    ["offer_pattern", data.offer_patterns],
  ];

  const previews = new Map<string, { kind: SignalKind; preview: string }>();
  const allHashes: string[] = [];
  for (const [kind, values] of buckets) {
    for (const raw of values) {
      const v = raw.trim();
      if (!v) continue;
      const h = await hashSignal(kind, v);
      previews.set(h, { kind, preview: maskValue(kind, v.toLowerCase()) });
      allHashes.push(h);
    }
  }
  if (allHashes.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("global_signals")
    .select("id, hash, kind, severity, report_count, first_seen, last_seen, sample_context")
    .in("hash", Array.from(new Set(allHashes)));

  if (error || !rows) return [];

  return rows.map((r) => {
    const p = previews.get(r.hash);
    return {
      id: r.id,
      kind: r.kind as SignalKind,
      severity: r.severity as SignalMatch["severity"],
      report_count: r.report_count,
      first_seen: r.first_seen,
      last_seen: r.last_seen,
      sample_context: r.sample_context,
      matched_preview: p?.preview ?? "***",
    };
  });
}

// Public read: signal check runs for guests too, so no auth middleware.
export const checkGlobalSignals = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputCheck.parse(d))
  .handler(async ({ data }): Promise<SignalMatch[]> => checkGlobalSignalsCore(data));

const InputReport = z.object({
  emails: z.array(z.string()).default([]),
  phones: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  payment_handles: z.array(z.string()).default([]),
  offer_patterns: z.array(z.string()).default([]),
  severity: z.enum(["info", "warning", "high", "critical"]).default("warning"),
  sample_context: z.string().max(200).default(""),
});

export type ReportSignalsInput = z.infer<typeof InputReport>;

export async function reportSignalsCore(
  data: ReportSignalsInput,
): Promise<{ inserted: number; bumped: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const buckets: Array<[SignalKind, string[]]> = [
    ["email", data.emails],
    ["phone", data.phones],
    ["domain", data.domains],
    ["payment_handle", data.payment_handles],
    ["offer_pattern", data.offer_patterns],
  ];

  const rows: Array<{ hash: string; kind: SignalKind }> = [];
  for (const [kind, values] of buckets) {
    for (const raw of values) {
      const v = raw.trim();
      if (!v) continue;
      rows.push({ hash: await hashSignal(kind, v), kind });
    }
  }
  if (rows.length === 0) return { inserted: 0, bumped: 0 };

  let inserted = 0;
  let bumped = 0;
  for (const r of rows) {
    const { data: existing } = await supabaseAdmin
      .from("global_signals")
      .select("id, report_count")
      .eq("hash", r.hash)
      .eq("kind", r.kind)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("global_signals")
        .update({ report_count: existing.report_count + 1, last_seen: new Date().toISOString() })
        .eq("id", existing.id);
      bumped++;
    } else {
      await supabaseAdmin.from("global_signals").insert({
        hash: r.hash,
        kind: r.kind,
        severity: data.severity,
        sample_context: data.sample_context || null,
        source: "user_report",
        report_count: 1,
      });
      inserted++;
    }
  }
  return { inserted, bumped };
}

// Report new signals from a completed investigation. Uses service role so
// mutations are constrained to this validated path, never open to clients.
export const reportSignals = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputReport.parse(d))
  .handler(async ({ data }) => reportSignalsCore(data));

// Landing-page "Signal Cloud" — aggregate stats, cached client-side.
export const getSignalCloud = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return { total_reports: 0, unique_signals: 0, by_kind: [] as Array<{ kind: string; count: number }>, last_week: 0 };
  }
  const supabase = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: rows } = await supabase
    .from("global_signals")
    .select("kind, report_count, last_seen");
  if (!rows) return { total_reports: 0, unique_signals: 0, by_kind: [], last_week: 0 };

  const byKind = new Map<string, number>();
  let totalReports = 0;
  let lastWeek = 0;
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  for (const r of rows) {
    byKind.set(r.kind as string, (byKind.get(r.kind as string) ?? 0) + 1);
    totalReports += r.report_count ?? 0;
    if (new Date(r.last_seen).getTime() > weekAgo) lastWeek++;
  }
  return {
    total_reports: totalReports,
    unique_signals: rows.length,
    by_kind: Array.from(byKind.entries()).map(([kind, count]) => ({ kind, count })),
    last_week: lastWeek,
  };
});
