import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldCheck,
  Search,
  FileSearch,
  Sparkles,
  ArrowRight,
  BrainCircuit,
  Chrome,
  Download,
} from "lucide-react";
import { listRecentPublicReports } from "@/lib/share.functions";
import { CHROME_STORE_URL, CHROME_EXTENSION_ZIP_PATH } from "@/lib/constants";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Landing,
});

function Landing() {
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthed(Boolean(data.session));
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session));
    });
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

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
          {isAuthed ? (
            <Link
              to="/dashboard"
              className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-sm hover:bg-accent"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/auth"
              className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-sm hover:bg-accent"
            >
              Sign in
            </Link>
          )}
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
          <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
            <Link
              to="/ask"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Ask ANVIX — 5-second check <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/investigate"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium hover:bg-accent"
            >
              Run a full investigation
            </Link>
            <Link
              to="/check-payment"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-5 py-3 text-sm font-medium text-warning hover:bg-warning/20"
            >
              Before you pay — check UPI / account
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            No account required. Sign in only to save history or download the full PDF report.
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
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="mono text-xs uppercase tracking-[0.22em] text-primary/80">
            Recently shared
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Latest community verdicts
          </h2>
        </div>
        <p className="hidden max-w-xs text-right text-xs text-muted-foreground sm:block">
          Read-only snapshots. No evidence, no PII — just the verdict.
        </p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {reports.map((r) => {
          const c = tone(r.trust_score);
          return (
            <Link
              key={r.slug}
              to="/r/$slug"
              params={{ slug: r.slug }}
              className="glass group relative flex items-center gap-4 overflow-hidden rounded-xl border border-border/60 p-4 transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-xl font-semibold tracking-tight"
                style={{ background: `${c}15`, color: c, boxShadow: `inset 0 0 0 1px ${c}55` }}
              >
                {r.trust_score}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[10px] font-medium uppercase tracking-wide"
                  style={{ color: c }}
                >
                  {r.verdict.replace(/_/g, " ")}
                </div>
                <div className="mt-0.5 truncate text-sm font-medium">{r.case_name}</div>
                <div className="mono mt-0.5 truncate text-[10px] text-muted-foreground">
                  /r/{r.slug}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ChromeExtensionSection() {
  const storeUrl = CHROME_STORE_URL;
  const download = () => {
    fetch(CHROME_EXTENSION_ZIP_PATH)
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "anvix-scanner-v1.1.0.zip";
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
            {!storeUrl && (
              <ol className="mt-4 space-y-1 text-sm text-muted-foreground">
                <li>1. Download the ZIP below.</li>
                <li>2. Open <span className="mono">chrome://extensions</span>, toggle Developer mode.</li>
                <li>3. Click <span className="text-foreground">Load unpacked</span> and select the unzipped folder.</li>
                <li>4. Highlight any suspicious message and right-click.</li>
              </ol>
            )}
          </div>
          <div className="flex flex-col items-start gap-3">
            <div className="grid h-16 w-16 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
              <Chrome className="h-8 w-8 text-primary" />
            </div>
            {storeUrl ? (
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Chrome className="h-4 w-4" /> Add to Chrome
              </a>
            ) : (
              <>
                <button
                  type="button"
                  onClick={download}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <Download className="h-4 w-4" /> Download extension
                </button>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary/80">
                  Chrome Web Store review pending
                </span>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Works in Chrome, Edge, Brave, Arc, Opera.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

