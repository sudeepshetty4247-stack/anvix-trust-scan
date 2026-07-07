// Public read-only report view. Anyone with the /r/$slug link can see
// the verdict + score + top reasons. No PII, no evidence, no PDF for anon.

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublicReport, type PublicReport } from "@/lib/share.functions";
import { ShieldCheck, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

const ORIGIN = "https://vetting-forge-ai.lovable.app";

function verdictTone(score: number) {
  if (score >= 70)
    return { fg: "hsl(142 76% 45%)", label: "Likely safe", Icon: CheckCircle2 };
  if (score >= 50)
    return { fg: "hsl(45 90% 55%)", label: "Caution", Icon: AlertTriangle };
  if (score >= 30)
    return { fg: "hsl(24 90% 55%)", label: "High risk", Icon: AlertTriangle };
  return { fg: "hsl(0 84% 60%)", label: "Likely fraud", Icon: AlertTriangle };
}

export const Route = createFileRoute("/r/$slug")({
  loader: async ({ params }) => {
    const report = await getPublicReport({ data: { slug: params.slug } });
    if (!report) throw notFound();
    return { report };
  },
  head: ({ loaderData, params }) => {
    const r = loaderData?.report as PublicReport | undefined;
    if (!r) return { meta: [{ title: "Report not found — ANVIX" }] };
    const tone = verdictTone(r.trust_score);
    const title = `${tone.label} · ${r.trust_score}/100 — ${r.case_name}`;
    const desc = `ANVIX verdict on "${r.case_name}": ${tone.label.toLowerCase()} (${r.trust_score}/100, ${r.confidence_low}–${r.confidence_high} confidence). Independent recruitment-fraud analysis.`;
    const url = `${ORIGIN}/r/${params.slug}`;
    const image = `${ORIGIN}/api/public/card/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { property: "og:image", content: image },
        { property: "twitter:card", content: "summary_large_image" },
        { property: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-sm text-muted-foreground">This report couldn't be loaded.</p>
      <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
        Go home
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Report expired or not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Public ANVIX reports expire 90 days after they're created.
      </p>
      <Link
        to="/investigate"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Run your own investigation <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  ),
  component: PublicReportView,
});

function PublicReportView() {
  const { report } = Route.useLoaderData();
  const tone = verdictTone(report.trust_score);
  const created = new Date(report.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ANVIX</span>
        </Link>
        <Link
          to="/investigate"
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-accent"
        >
          Run your own
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <div className="mono text-xs uppercase tracking-[0.22em] text-primary/80">
          Public report · {created}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {report.case_name}
        </h1>

        <section className="glass mt-6 rounded-2xl border border-border/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: `${tone.fg}18`, color: tone.fg }}
              >
                <tone.Icon className="h-3.5 w-3.5" />
                {tone.label}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className="text-6xl font-semibold tracking-tight"
                  style={{ color: tone.fg }}
                >
                  {report.trust_score}
                </span>
                <span className="text-lg text-muted-foreground">/100</span>
                <span
                  className="ml-3 rounded-md border px-2 py-0.5 text-xs text-muted-foreground"
                  style={{ borderColor: `${tone.fg}55` }}
                >
                  ± {Math.round((report.confidence_high - report.confidence_low) / 2)}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Confidence range: {report.confidence_low}–{report.confidence_high}
              </p>
              {report.band_reason && (
                <p className="mt-2 max-w-md text-xs text-muted-foreground">
                  {report.band_reason}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Verified by ANVIX</div>
              <div className="mono mt-1">/{report.slug}</div>
            </div>
          </div>
        </section>

        {report.top_reasons.length > 0 && (
          <section className="glass mt-4 rounded-2xl border border-border/50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top reasons
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {report.top_reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: tone.fg }}
                  />
                  {r}
                </li>
              ))}
            </ul>
          </section>
        )}

        {report.contact_fingerprints.length > 0 && (
          <section className="glass mt-4 rounded-2xl border border-border/50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Contacts referenced (masked)
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.contact_fingerprints.map((c, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border/60 bg-surface/60 px-3 py-1 text-xs"
                >
                  <span className="mr-1 text-muted-foreground">{c.kind}:</span>
                  {c.masked}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-sm">
          <p className="text-muted-foreground">
            This report was generated by running the offer, screenshot, or recruiter message through
            ANVIX's ML ensemble + live verification pipeline. To verify a message you received, run
            your own investigation — no account required.
          </p>
          <Link
            to="/investigate"
            className="mt-3 inline-flex items-center gap-2 text-primary"
          >
            Investigate a recruiter <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
