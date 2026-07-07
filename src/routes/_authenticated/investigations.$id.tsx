import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getInvestigation } from "@/lib/investigations.functions";
import { runInvestigation } from "@/lib/pipeline.functions";
import { supabase } from "@/integrations/supabase/client";
import { type RiskCategory } from "@/lib/scoring";
import { StatusPill } from "@/routes/_authenticated/dashboard";
import { getVerdict } from "@/lib/verdict";
import { topReasons } from "@/lib/plain-language";
import { VerdictHero } from "@/components/report/VerdictHero";
import { TopReasons } from "@/components/report/TopReasons";
import { ActionChecklist } from "@/components/report/ActionChecklist";
import { NextSteps } from "@/components/report/NextSteps";
import { InvestigationTimeline } from "@/components/report/InvestigationTimeline";
import { ChecksSummary } from "@/components/report/ChecksSummary";
import { PlainEnglishExplainer } from "@/components/report/PlainEnglishExplainer";
import { TechnicalAccordion } from "@/components/report/TechnicalAccordion";
import { GenerateFIRDialog } from "@/components/GenerateFIRDialog";
import { TrapReplyDialog } from "@/components/TrapReplyDialog";
import {
  Play,
  ArrowLeft,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Loader2,
  Download,
  FileWarning,
  MessagesSquare,
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
  const verdict = useMemo(() => {
    if (!data?.investigation?.risk_category) return null;
    return getVerdict(data.investigation.risk_category as RiskCategory);
  }, [data?.investigation?.risk_category]);

  const reasons = useMemo(() => {
    if (!data) return [];
    return topReasons(
      data.verifications ?? [],
      (data.report?.negative_findings as string[]) ?? [],
      3,
    );
  }, [data]);

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
  const completed = inv.status === "completed";

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-8">
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
            {completed && report && (
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

        {/* 1. VERDICT HERO — the one answer users care about */}
        {completed && verdict && (
          <VerdictHero
            verdict={verdict}
            score={Number(inv.trust_score)}
            caseName={inv.name}
          />
        )}

        {/* 2. TOP 3 REASONS */}
        {completed && <TopReasons reasons={reasons} />}

        {/* 3. WHAT SHOULD I DO NOW? */}
        {completed && verdict && <ActionChecklist verdict={verdict} />}

        {/* 4. WHAT SCAMMERS DO NEXT */}
        {completed && verdict && (
          <NextSteps isScam={verdict.shouldContinue === "no"} />
        )}

        {/* 5. TIMELINE */}
        {completed && (
          <InvestigationTimeline
            evidenceCount={evidence.length}
            verificationCount={verifications.length}
            hasPrediction={!!prediction}
            hasReport={!!report}
          />
        )}

        {/* 6. EXPLAIN LIKE I'M NEW */}
        {completed && report?.summary && <PlainEnglishExplainer summary={report.summary} />}

        {/* 7. STATS */}
        {completed && <ChecksSummary verifications={verifications} />}

        {/* 8. EVIDENCE */}
        {evidence.length > 0 && (
          <section className="glass mt-6 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-base font-semibold">Evidence you provided</h2>
              <span className="mono text-[11px] text-muted-foreground">{evidence.length}</span>
            </div>
            <ul className="divide-y divide-border/60">
              {evidence.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                  <EvidenceIcon kind={e.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{e.label ?? e.content ?? "(unnamed)"}</div>
                    <div className="mono text-[11px] text-muted-foreground">
                      {e.kind}
                      {e.mime_type ? ` · ${e.mime_type}` : ""}
                      {e.size_bytes ? ` · ${(e.size_bytes / 1024).toFixed(1)} KB` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 9. TECHNICAL DETAILS — collapsed by default */}
        {completed && (
          <TechnicalAccordion
            verifications={verifications}
            prediction={prediction}
            report={report}
          />
        )}

        {/* 10. LIVE LOG (only while running or if there are entries) */}
        {(running || activities.length > 0) && (
          <section className="glass mt-6 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-base font-semibold">Live log</h2>
              <span className="mono text-[11px] text-muted-foreground">{activities.length}</span>
            </div>
            <div className="max-h-72 overflow-auto px-5 py-3">
              {activities.length === 0 && (
                <div className="text-xs text-muted-foreground">Nothing yet.</div>
              )}
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
          </section>
        )}

        {/* Final recommendation footer */}
        {completed && verdict && (
          <div
            className="mt-8 rounded-2xl border-2 p-5 text-center"
            style={{ borderColor: verdict.colorVar }}
          >
            <div className="mono text-[11px] uppercase tracking-[0.22em]" style={{ color: verdict.colorVar }}>
              Final recommendation
            </div>
            <p className="mt-2 text-lg font-semibold">{verdict.decision}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This report is informational and does not constitute legal advice.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EvidenceIcon({ kind }: { kind: string }) {
  const Icon = kind === "url" ? LinkIcon : kind === "file" ? ImageIcon : FileText;
  return (
    <div className="grid h-8 w-8 place-items-center rounded-md bg-surface">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function downloadReport(
  inv: unknown,
  evidence: unknown,
  verifications: unknown,
  prediction: unknown,
  report: unknown,
) {
  const blob = new Blob(
    [JSON.stringify({ investigation: inv, evidence, verifications, prediction, report }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `anvix-report.json`;
  a.click();
  URL.revokeObjectURL(url);
}
