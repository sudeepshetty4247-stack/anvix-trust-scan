import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { listInvestigations, dashboardStats } from "@/lib/investigations.functions";
import { Plus, ArrowUpRight, FileSearch, ShieldCheck, TrendingUp, FolderOpen } from "lucide-react";
import { RISK_META, type RiskCategory } from "@/lib/scoring";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const listFn = useServerFn(listInvestigations);
  const statsFn = useServerFn(dashboardStats);

  const list = useQuery({ queryKey: ["investigations"], queryFn: () => listFn() });
  const stats = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => statsFn() });

  const investigations = list.data ?? [];
  const hasAny = investigations.length > 0;
  const startInvestigation = () => navigate({ to: "/investigate" });

  return (
    <AppShell onNewInvestigation={startInvestigation}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Every case you run appears here.</p>
          </div>
          <button
            onClick={startInvestigation}
            className="hidden items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Start investigation
          </button>
        </div>

        {!list.isLoading && !hasAny && <EmptyState onStart={startInvestigation} />}

        {hasAny && (
          <>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={FolderOpen}
                label="Total investigations"
                value={String(stats.data?.totalInvestigations ?? investigations.length)}
              />
              <StatCard
                icon={FileSearch}
                label="Evidence collected"
                value={String(stats.data?.evidenceCollected ?? 0)}
              />
              <StatCard
                icon={TrendingUp}
                label="Average trust score"
                value={
                  stats.data?.averageTrustScore != null
                    ? `${stats.data.averageTrustScore}/100`
                    : "—"
                }
              />
              <StatCard
                icon={ShieldCheck}
                label="Completed"
                value={String(investigations.filter((i) => i.status === "completed").length)}
              />
            </div>

            <div className="mt-10">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Recent cases
                </h2>
              </div>
              <div className="glass overflow-hidden rounded-xl">
                {investigations.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => navigate({ to: "/investigations/$id", params: { id: inv.id } })}
                    className="group flex w-full items-center justify-between border-b border-border/60 px-5 py-4 text-left last:border-b-0 hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{inv.name}</span>
                        <StatusPill status={inv.status} />
                      </div>
                      <div className="mono mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-4">
                      {inv.trust_score != null && inv.risk_category && (
                        <TrustBadge
                          score={Number(inv.trust_score)}
                          category={inv.risk_category as RiskCategory}
                        />
                      )}
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="mt-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/30">
        <ShieldCheck className="h-6 w-6 text-primary" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">Welcome to ANVIX</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        No investigations yet. Drop evidence — a job URL, offer letter, recruiter email, screenshot
        — and ANVIX takes it from there.
      </p>
      <button
        onClick={onStart}
        className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Start your first investigation
      </button>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mono mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    collecting: "bg-info/15 text-info",
    verifying: "bg-info/15 text-info",
    scoring: "bg-info/15 text-info",
    explaining: "bg-info/15 text-info",
    completed: "bg-primary/15 text-primary",
    failed: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={`mono rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

export function TrustBadge({ score, category }: { score: number; category: RiskCategory }) {
  const meta = RISK_META[category];
  return (
    <div className="flex items-center gap-2">
      <div className="mono text-lg font-semibold tabular-nums" style={{ color: meta.color }}>
        {score}
      </div>
      <div className="text-xs text-muted-foreground">{meta.label}</div>
    </div>
  );
}
