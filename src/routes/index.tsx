import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldCheck,
  Search,
  FileSearch,
  Sparkles,
  ArrowRight,
  BrainCircuit,
  Users,
  Chrome,
  Download,
} from "lucide-react";
import { getSignalCloud } from "@/lib/global-signals.functions";
import { listRecentPublicReports } from "@/lib/share.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ANVIX</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/investigate"
            className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-sm hover:bg-accent"
          >
            Try without signing in
          </Link>
          <Link
            to="/auth"
            className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-sm hover:bg-accent"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-20 pb-16">
          <div className="mono text-xs uppercase tracking-[0.22em] text-primary/80">
            Recruitment Trust & Fraud Intelligence
          </div>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Drop the offer.
            <br />
            Drop the screenshot.
            <br />
            <span className="text-primary">Know if it's a scam.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            A recruiter DM'd you on LinkedIn. An "offer letter" landed in your inbox. Drop any of it
            — screenshot, PDF, forwarded email, or a link — and ANVIX reads it, cross-checks it
            live, matches it to <span className="text-foreground">known scam playbooks</span>, and
            tells you exactly what they'll ask for next.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/investigate"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Start investigating — no login needed <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm hover:bg-accent"
            >
              Sign in to save history
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            No account required. Sign in only to download the PDF report or save to history.
          </p>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-4">
          {[
            {
              icon: FileSearch,
              title: "Drop any evidence",
              body: "Screenshots, PDFs, forwarded .eml, links, text — Gemini vision reads all of it.",
            },
            {
              icon: Search,
              title: "Live verification",
              body: "DNS · MX · SPF · DMARC · SSL · WHOIS — checked in real time against the recruiter's domain.",
            },
            {
              icon: BrainCircuit,
              title: "Trained ML model",
              body: "Kaggle EMSCAD-trained model + rule-weighted baseline. Real ROC-AUC, real recall, published.",
            },
            {
              icon: Sparkles,
              title: "Scam playbook match",
              body: "Matches your case to 12 known scam scripts and predicts what the scammer will ask for next.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-xl p-5">
              <Icon className="h-5 w-5 text-primary" />
              <div className="mt-3 font-medium">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        <SignalCloudSection />
        <RecentlySharedSection />
        <ChromeExtensionSection />
      </main>
    </div>
  );
}

function RecentlySharedSection() {
  const [reports, setReports] = useState<
    Array<{ slug: string; verdict: string; trust_score: number; case_name: string; created_at: string }>
  >([]);
  useEffect(() => {
    listRecentPublicReports().then(setReports).catch(() => setReports([]));
  }, []);
  if (reports.length === 0) return null;
  const tone = (s: number) =>
    s >= 70 ? "hsl(142 76% 45%)" : s >= 50 ? "hsl(45 90% 55%)" : s >= 30 ? "hsl(24 90% 55%)" : "hsl(0 84% 60%)";
  return (
    <section className="pb-16">
      <div className="mono text-xs uppercase tracking-[0.22em] text-primary/80">
        Recently shared
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        Public verdicts from the community
      </h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Every ANVIX report can be shared as a read-only link — no evidence, no PII, just the verdict.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link
            key={r.slug}
            to="/r/$slug"
            params={{ slug: r.slug }}
            className="glass block rounded-xl border border-border/60 p-4 transition hover:border-primary/40"
          >
            <div className="flex items-center justify-between">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                style={{ background: `${tone(r.trust_score)}18`, color: tone(r.trust_score) }}
              >
                {r.verdict.replace("_", " ")}
              </span>
              <span
                className="text-2xl font-semibold tracking-tight"
                style={{ color: tone(r.trust_score) }}
              >
                {r.trust_score}
              </span>
            </div>
            <div className="mt-2 truncate text-sm font-medium">{r.case_name}</div>
            <div className="mono mt-1 text-[10px] text-muted-foreground">/r/{r.slug}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SignalCloudSection() {
  const [stats, setStats] = useState<{
    total_reports: number;
    unique_signals: number;
    by_kind: Array<{ kind: string; count: number }>;
    last_week: number;
  } | null>(null);
  useEffect(() => {
    getSignalCloud().then(setStats).catch(() => setStats(null));
  }, []);
  if (!stats || stats.unique_signals === 0) return null;
  return (
    <section className="pb-16">
      <div className="glass rounded-2xl border border-primary/20 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mono text-xs uppercase tracking-[0.22em] text-primary/80">
              Community intelligence
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              The signal cloud
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Every investigation makes the next one smarter. When ANVIX users flag a scam
              recruiter, that identifier is hashed and shared so future users see the warning
              before uploading anything else.
            </p>
          </div>
          <Users className="hidden h-6 w-6 shrink-0 text-primary sm:block" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <Stat label="Total reports" value={stats.total_reports.toLocaleString()} />
          <Stat label="Unique bad actors" value={stats.unique_signals.toLocaleString()} />
          <Stat label="Reported in last 7 days" value={stats.last_week.toLocaleString()} />
          <Stat label="Signal categories" value={String(stats.by_kind.length)} />
        </div>
        {stats.by_kind.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {stats.by_kind
              .sort((a, b) => b.count - a.count)
              .map((k) => (
                <span
                  key={k.kind}
                  className="rounded-full border border-border/60 bg-surface/60 px-2.5 py-1 text-xs"
                >
                  {k.kind.replace("_", " ")} · {k.count}
                </span>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function ChromeExtensionSection() {
  const download = () => {
    fetch("/anvix-extension.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "anvix-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert(err.message));
  };
  return (
    <section className="pb-20">
      <div className="glass rounded-2xl border border-primary/20 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <div className="mono text-xs uppercase tracking-[0.22em] text-primary/80">
              Chrome extension
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Investigate any message with one right-click
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              On LinkedIn, Gmail, WhatsApp Web, or any page — select the suspicious message,
              right-click, and pick <span className="text-foreground">"Investigate with ANVIX"</span>.
              A new tab opens with the evidence already loaded.
            </p>
            <ol className="mt-4 space-y-1 text-sm text-muted-foreground">
              <li>1. Download the ZIP below.</li>
              <li>2. Open <span className="mono">chrome://extensions</span>, toggle Developer mode.</li>
              <li>3. Click <span className="text-foreground">Load unpacked</span> and select the unzipped folder.</li>
              <li>4. Highlight any suspicious message and right-click.</li>
            </ol>
          </div>
          <div className="flex flex-col items-start gap-3">
            <div className="grid h-16 w-16 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
              <Chrome className="h-8 w-8 text-primary" />
            </div>
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Download className="h-4 w-4" /> Download extension
            </button>
            <p className="text-xs text-muted-foreground">
              Works in Chrome, Edge, Brave, Arc, Opera.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
