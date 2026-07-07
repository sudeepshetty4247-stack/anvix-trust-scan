import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  checkPaymentIdentifier,
  reportPaymentIdentifier,
  type PaymentCheckResult,
} from "@/lib/payment-scanner.functions";
import {
  ArrowLeft,
  ShieldCheck,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Flag,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/check-payment")({
  component: CheckPaymentPage,
  head: () => ({
    meta: [
      { title: "Check a UPI or Bank Account for Scams — ANVIX" },
      {
        name: "description",
        content:
          "Before you pay, check any UPI ID, bank account, or phone number against ANVIX's community database of reported scam accounts.",
      },
    ],
  }),
});

function CheckPaymentPage() {
  const [identifier, setIdentifier] = useState("");
  const [result, setResult] = useState<PaymentCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const checkFn = useServerFn(checkPaymentIdentifier);
  const reportFn = useServerFn(reportPaymentIdentifier);

  async function onCheck(e: React.FormEvent) {
    e.preventDefault();
    if (identifier.trim().length < 3) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await checkFn({ data: { identifier: identifier.trim() } });
      setResult(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check failed");
    } finally {
      setLoading(false);
    }
  }

  async function onReport() {
    if (!result || result.kind === "unknown") return;
    setReporting(true);
    try {
      await reportFn({ data: { identifier: result.normalised } });
      toast.success("Reported. Thank you — this protects the next person.");
      const r = await checkFn({ data: { identifier: result.normalised } });
      setResult(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Report failed");
    } finally {
      setReporting(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Link
          to="/"
          className="mono inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight">ANVIX</span>
        </div>
      </header>

      <div className="mt-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warning/15 ring-1 ring-warning/30">
          <Search className="h-6 w-6 text-warning" />
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Before you pay — check it.
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
          Paste the UPI ID, bank account, or phone number they asked money to. We'll tell you
          in 2 seconds if other people have reported it.
        </p>
      </div>

      <form onSubmit={onCheck} className="mt-8">
        <div className="glass flex items-center gap-2 rounded-2xl p-2">
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="e.g. quickpay.hr@paytm  or  9876543210  or  02201234567890"
            className="mono flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            maxLength={200}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || identifier.trim().length < 3}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4" /> Check
              </>
            )}
          </button>
        </div>
        <p className="mono mt-2 text-center text-[11px] text-muted-foreground">
          Nothing is stored in plain text — we hash every value before checking.
        </p>
      </form>

      {result && <ResultCard result={result} onReport={onReport} reporting={reporting} />}

      <div className="mt-10 rounded-xl border border-border/60 bg-surface/40 p-4 text-sm">
        <div className="mono text-[11px] uppercase tracking-widest text-primary">Why this exists</div>
        <p className="mt-2 text-foreground/85">
          Scammers reuse the same UPI IDs and bank accounts across hundreds of victims. Every
          report here freezes the next one before they pay. If you've been scammed, please{" "}
          <button
            type="button"
            className="underline"
            onClick={() => document.querySelector("input")?.focus()}
          >
            report the account
          </button>
          .
        </p>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  onReport,
  reporting,
}: {
  result: PaymentCheckResult;
  onReport: () => void;
  reporting: boolean;
}) {
  const isScam = result.verdict === "known_scam";
  const isUnknownKind = result.kind === "unknown";
  const color = isScam
    ? "var(--risk-fraud)"
    : isUnknownKind
      ? "var(--muted-foreground)"
      : "var(--risk-caution)";
  const Icon = isScam ? AlertTriangle : isUnknownKind ? Search : CheckCircle2;

  return (
    <div
      className="mt-6 overflow-hidden rounded-2xl border p-5"
      style={{
        borderColor: color,
        background: `color-mix(in oklch, ${color} 8%, transparent)`,
      }}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-6 w-6 shrink-0" style={{ color }} />
        <div className="flex-1">
          <div className="mono text-[10px] uppercase tracking-widest" style={{ color }}>
            {result.kind === "upi"
              ? "UPI ID"
              : result.kind === "bank_account"
                ? "Bank account"
                : result.kind === "phone"
                  ? "Phone number"
                  : result.kind === "email"
                    ? "Email"
                    : "Input"}
            {" · "}
            <span>{result.masked}</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color }}>
            {result.headline}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{result.action}</p>

          {isScam && (
            <div className="mono mt-3 space-y-1 rounded-lg border border-border/60 bg-surface/50 p-3 text-[11px] text-muted-foreground">
              <div>
                Reports: <span className="text-foreground">{result.report_count}</span>
              </div>
              {result.first_seen && (
                <div>
                  First reported:{" "}
                  <span className="text-foreground">
                    {new Date(result.first_seen).toLocaleDateString()}
                  </span>
                </div>
              )}
              {result.last_seen && (
                <div>
                  Most recent report:{" "}
                  <span className="text-foreground">
                    {new Date(result.last_seen).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {!isScam && !isUnknownKind && (
            <button
              type="button"
              onClick={onReport}
              disabled={reporting}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              {reporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Flag className="h-4 w-4" />
              )}
              Report this as a scam
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
