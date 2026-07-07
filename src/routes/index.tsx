import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Search, FileSearch, Sparkles, ArrowRight } from "lucide-react";

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
        <Link to="/auth" className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-sm hover:bg-accent">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-20 pb-24">
          <div className="mono text-xs uppercase tracking-[0.22em] text-primary/80">Recruitment Trust & Fraud Intelligence</div>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            One upload.<br/>One investigation.<br/>
            <span className="text-primary">One trust score.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            ANVIX behaves like a professional digital investigator. Drop any evidence about a job,
            recruiter, or company. ANVIX verifies, correlates, scores, and explains — end to end.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Start investigating <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm hover:bg-accent">
              Sign in
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-3">
          {[
            { icon: FileSearch, title: "Evidence-first", body: "Everything you upload becomes evidence in a case file — URLs, emails, PDFs, screenshots, chats." },
            { icon: Search, title: "Automatic verification", body: "WHOIS, DNS, SSL, blacklists, fraud keywords, payment requests — checked in real time." },
            { icon: Sparkles, title: "Explainable AI", body: "The model predicts. The AI explains why. Every trust score is auditable." },
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
