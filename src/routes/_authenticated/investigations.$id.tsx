import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getInvestigation } from "@/lib/investigations.functions";
import { runInvestigation } from "@/lib/pipeline.functions";
import { supabase } from "@/integrations/supabase/client";
import { RISK_META, type RiskCategory } from "@/lib/scoring";
import { StatusPill } from "@/routes/_authenticated/dashboard";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Play,
  ArrowLeft,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Loader2,
  Download,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/investigations/$id")({
  component: InvestigationDetail,
});

function InvestigationDetail() {
  const { id } = useParams({ from: "/_authenticated/investigations/$id" });
  const qc = useQueryClient();
  const fetchFn = useServerFn(getInvestigation);
  const runFn = useServerFn(runInvestigation);

  const q = useQuery({
    queryKey: ["investigation", id],
    queryFn: () => fetchFn({ data: { id } }),
    refetchInterval: (query) => {
      const s = query.state.data?.investigation?.status;
      return s && s !== "completed" && s !== "failed" && s !== "draft" ? 1500 : false;
    },
  });

  // Realtime: subscribe to activities + investigation row
  useEffect(() => {
    const ch = supabase
      .channel(`inv-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "investigations", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["investigation", id] }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activities",
          filter: `investigation_id=eq.${id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["investigation", id] }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "verifications",
          filter: `investigation_id=eq.${id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["investigation", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const run = useMutation({
    mutationFn: () => runFn({ data: { investigation_id: id } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Investigation failed"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investigation", id] }),
  });

  const data = q.data;
  if (!data) {
    return (
      <AppShell>
        <div className="grid h-full place-items-center p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const { investigation: inv, evidence, verifications, activities, prediction, report } = data;
  const canRun = inv.status === "draft" || inv.status === "failed";
  const running = ["collecting", "verifying", "scoring", "explaining"].includes(inv.status);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link
          to="/dashboard"
          className="mono inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{inv.name}</h1>
              <StatusPill status={inv.status} />
            </div>
            <div className="mono mt-1 text-xs text-muted-foreground">
              Case ID {inv.id.slice(0, 8)} · {evidence.length} evidence · {verifications.length}{" "}
              checks
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canRun && (
              <button
                onClick={() => run.mutate()}
                disabled={run.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {run.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run investigation
              </button>
            )}
            {inv.status === "completed" && report && (
              <button
                onClick={() => downloadReport(inv, evidence, verifications, prediction, report)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-accent"
              >
                <Download className="h-4 w-4" /> Export JSON
              </button>
            )}
          </div>
        </div>

        {running && (
          <div className="glass mt-6 overflow-hidden rounded-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="mono text-[11px] uppercase tracking-wider text-primary">
                Live · {inv.status}
              </div>
              <div className="mono text-xs text-muted-foreground">{inv.progress}%</div>
            </div>
            <div className="h-1 bg-surface">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${inv.progress}%` }}
              />
            </div>
          </div>
        )}

        {inv.status === "completed" && prediction && (
          <TrustHeadline
            score={Number(inv.trust_score)}
            category={inv.risk_category as RiskCategory}
            confidence={Number(prediction.confidence)}
            model={prediction.model_used}
          />
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Left: evidence + verifications */}
          <div className="space-y-6 lg:col-span-2">
            <Section title="Evidence library" count={evidence.length}>
              {evidence.length === 0 ? (
                <Empty>No evidence yet.</Empty>
              ) : (
                <ul className="divide-y divide-border/60">
                  {evidence.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                      <EvidenceIcon kind={e.kind} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          {e.label ?? e.content ?? "(unnamed)"}
                        </div>
                        <div className="mono text-[11px] text-muted-foreground">
                          {e.kind}
                          {e.mime_type ? ` · ${e.mime_type}` : ""}
                          {e.size_bytes ? ` · ${(e.size_bytes / 1024).toFixed(1)} KB` : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Verification results" count={verifications.length}>
              {verifications.length === 0 ? (
                <Empty>Run the investigation to collect verifications.</Empty>
              ) : (
                <ul className="divide-y divide-border/60">
                  {verifications.map((v) => (
                    <li key={v.id} className="flex items-start gap-3 px-4 py-3">
                      <VerifIcon status={v.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {v.category}
                          </span>
                          <span className="text-sm">{v.check_name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(v.result as any)?.detail ?? ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {report && (
              <Section title="AI investigation summary">
                <div className="space-y-4 px-4 py-4">
                  <p className="text-sm leading-relaxed">{report.summary}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FindingList
                      label="Positive findings"
                      items={report.positive_findings as string[]}
                      tone="pos"
                    />
                    <FindingList
                      label="Negative findings"
                      items={report.negative_findings as string[]}
                      tone="neg"
                    />
                  </div>
                  {(report.missing_evidence as string[])?.length > 0 && (
                    <FindingList
                      label="Missing evidence"
                      items={report.missing_evidence as string[]}
                      tone="warn"
                    />
                  )}
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <div className="mono text-[10px] uppercase tracking-wider text-primary">
                      Recommendation
                    </div>
                    <div className="mt-1 text-sm">{report.recommendation}</div>
                  </div>
                </div>
              </Section>
            )}
          </div>

          {/* Right: ML + live log */}
          <div className="space-y-6">
            {prediction && (
              <Section title="Machine learning">
                <div className="space-y-3 px-4 py-4">
                  <Row label="Model" value={prediction.model_used} />
                  <Row label="Prediction" value={`${prediction.prediction_score}/100`} />
                  <Row
                    label="Confidence"
                    value={`${(Number(prediction.confidence) * 100).toFixed(0)}%`}
                  />
                  <Row
                    label="Category"
                    value={RISK_META[prediction.risk_category as RiskCategory].label}
                  />
                  <div>
                    <div className="mono mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Top feature importance
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(
                        (prediction.feature_importance ?? {}) as Record<string, number>,
                      )
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 6)
                        .map(([k, v]) => (
                          <div key={k}>
                            <div className="mono flex justify-between text-[11px] text-muted-foreground">
                              <span>{k.replace(/_/g, " ")}</span>
                              <span>{(v * 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-1 rounded bg-surface">
                              <div
                                className="h-full rounded bg-primary"
                                style={{ width: `${Math.min(100, v * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </Section>
            )}

            <Section title="Live log" count={activities.length}>
              <div className="max-h-96 space-y-0.5 overflow-auto px-4 py-3">
                {activities.length === 0 && <Empty>Nothing yet.</Empty>}
                {activities.map((a) => (
                  <div key={a.id} className="mono flex gap-2 py-0.5 text-[11px]">
                    <span className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </span>
                    <span
                      className={
                        a.level === "error"
                          ? "text-destructive"
                          : a.level === "warn"
                            ? "text-warning"
                            : "text-foreground/90"
                      }
                    >
                      {a.message}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function TrustHeadline({
  score,
  category,
  confidence,
  model,
}: {
  score: number;
  category: RiskCategory;
  confidence: number;
  model: string;
}) {
  const meta = RISK_META[category];
  return (
    <div className="glass mt-6 overflow-hidden rounded-xl">
      <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr_auto]">
        <div className="text-center">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Trust score
          </div>
          <div
            className="mono mt-1 text-6xl font-semibold tabular-nums"
            style={{ color: meta.color }}
          >
            {score}
          </div>
          <div className="mono text-xs text-muted-foreground">/ 100</div>
        </div>
        <div className="border-l border-border/60 pl-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: meta.color }} />
            <div className="text-xl font-semibold" style={{ color: meta.color }}>
              {meta.label}
            </div>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Model {model} · confidence {(confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="glass overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="text-sm font-medium">{title}</div>
        {count != null && <div className="mono text-[11px] text-muted-foreground">{count}</div>}
      </div>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-center text-xs text-muted-foreground">{children}</div>;
}
function EvidenceIcon({ kind }: { kind: string }) {
  const Icon = kind === "url" ? LinkIcon : kind === "file" ? ImageIcon : FileText;
  return (
    <div className="grid h-8 w-8 place-items-center rounded-md bg-surface">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
function VerifIcon({ status }: { status: string }) {
  if (status === "pass") return <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />;
  if (status === "fail") return <XCircle className="mt-0.5 h-4 w-4 text-destructive" />;
  if (status === "warning") return <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />;
  return <MinusCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />;
}
function FindingList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "pos" | "neg" | "warn";
}) {
  const color =
    tone === "pos" ? "text-success" : tone === "neg" ? "text-destructive" : "text-warning";
  return (
    <div>
      <div className="mono mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-1 text-sm">
        {(items ?? []).map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className={color}>•</span>
            {s}
          </li>
        ))}
        {(items ?? []).length === 0 && <li className="text-xs text-muted-foreground">None</li>}
      </ul>
    </div>
  );
}

function downloadReport(inv: any, evidence: any, verifications: any, prediction: any, report: any) {
  const blob = new Blob(
    [JSON.stringify({ investigation: inv, evidence, verifications, prediction, report }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `anvix-report-${inv.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
