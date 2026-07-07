import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Search, FileSearch, Sparkles, ArrowRight, BrainCircuit } from "lucide-react";

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
          <Link to="/investigate" className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-sm hover:bg-accent">
            Try without signing in
          </Link>
          <Link to="/auth" className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-sm hover:bg-accent">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-20 pb-16">
          <div className="mono text-xs uppercase tracking-[0.22em] text-primary/80">Recruitment Trust & Fraud Intelligence</div>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            One upload.<br/>One investigation.<br/>
            <span className="text-primary">One trust score.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            ANVIX behaves like a professional digital investigator. Drop any evidence about a job,
            recruiter, or company. ANVIX verifies, correlates, scores with a model trained on
            <span className="text-foreground"> 17,880 real job postings</span>, and explains — end to end.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/investigate" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Start investigating — no login needed <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm hover:bg-accent">
              Sign in to save history
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Guest results live in your browser. Log in only when you want to save an investigation to your history.
          </p>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-4">
          {[
            { icon: FileSearch, title: "Evidence-first", body: "Paste any URL, recruiter email, or job description. ANVIX turns it into a case file." },
            { icon: Search, title: "Live verification", body: "DNS · MX · SPF · DMARC · SSL · WHOIS · fraud keywords — checked in real time." },
            { icon: BrainCircuit, title: "Real trained model", body: "Logistic regression trained on the EMSCAD / Kaggle Fake Job Postings dataset (17,880 rows)." },
            { icon: Sparkles, title: "Explainable AI", body: "Every trust score cites the exact features that produced it. Auditable, not a black box." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-xl p-5">
              <Icon className="h-5 w-5 text-primary" />
              <div className="mt-3 font-medium">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
