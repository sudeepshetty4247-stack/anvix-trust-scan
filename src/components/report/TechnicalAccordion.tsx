// Collapsible container for all cybersecurity-grade detail: raw
// verification results, ML model internals, feature importance, and the
// raw AI findings. Hidden by default — most users never need to open it.

import { useState } from "react";
import { ChevronDown, CheckCircle2, XCircle, AlertTriangle, MinusCircle } from "lucide-react";
import { RISK_META, type RiskCategory } from "@/lib/scoring";

type Verification = {
  id: string;
  category: string;
  check_name: string;
  status: string;
  result: unknown;
};

type Prediction = {
  model_used: string;
  prediction_score: number | string;
  confidence: number | string;
  risk_category: string;
  feature_importance?: unknown;
};

type Report = {
  positive_findings?: unknown;
  negative_findings?: unknown;
  missing_evidence?: unknown;
  summary?: string;
  recommendation?: string;
};

export function TechnicalAccordion({
  verifications,
  prediction,
  report,
}: {
  verifications: Verification[];
  prediction: Prediction | null;
  report: Report | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="glass mt-6 overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-accent/40"
        aria-expanded={open}
      >
        <div>
          <div className="text-base font-semibold">Technical investigation</div>
          <div className="text-xs text-muted-foreground">
            Raw checks, model internals, and cybersecurity signals. For advanced users.
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-6 border-t border-border px-5 py-5">
          {/* Raw verifications */}
          <div>
            <h3 className="mono mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              Verification results ({verifications.length})
            </h3>
            {verifications.length === 0 ? (
              <div className="text-xs text-muted-foreground">No verification data.</div>
            ) : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                {verifications.map((v) => {
                  const detail =
                    v.result && typeof v.result === "object" && "detail" in v.result
                      ? String((v.result as Record<string, unknown>).detail ?? "")
                      : "";
                  return (
                    <li key={v.id} className="flex items-start gap-3 px-3 py-2.5">
                      <VerifIcon status={v.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {v.category}
                          </span>
                          <span className="text-sm">{v.check_name}</span>
                        </div>
                        {detail && (
                          <div className="mono text-[11px] text-muted-foreground">{detail}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ML internals */}
          {prediction && (
            <div>
              <h3 className="mono mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Machine learning
              </h3>
              <div className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-2">
                <Row label="Model" value={prediction.model_used} />
                <Row label="Prediction" value={`${prediction.prediction_score}/100`} />
                <Row
                  label="Confidence"
                  value={`${(Number(prediction.confidence) * 100).toFixed(0)}%`}
                />
                <Row
                  label="Category"
                  value={
                    RISK_META[prediction.risk_category as RiskCategory]?.label ??
                    prediction.risk_category
                  }
                />
              </div>
              {prediction.feature_importance && typeof prediction.feature_importance === "object" && (
                <div className="mt-3 rounded-lg border border-border/60 p-3">
                  <div className="mono mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Top feature importance
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(prediction.feature_importance as Record<string, unknown>)
                      .map(([k, v]) => [k, Number(v)] as [string, number])
                      .filter(([, v]) => Number.isFinite(v))
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
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
              )}
            </div>
          )}

          {/* Raw AI findings */}
          {report && (
            <div>
              <h3 className="mono mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Raw AI findings
              </h3>
              <div className="space-y-3 rounded-lg border border-border/60 p-3 text-sm">
                {report.summary && <p className="leading-relaxed">{report.summary}</p>}
                <FindingList label="Positive" items={(report.positive_findings as string[]) ?? []} tone="pos" />
                <FindingList label="Negative" items={(report.negative_findings as string[]) ?? []} tone="neg" />
                <FindingList label="Missing evidence" items={(report.missing_evidence as string[]) ?? []} tone="warn" />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function VerifIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "pass") return <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />;
  if (s === "fail") return <XCircle className="mt-0.5 h-4 w-4 text-destructive" />;
  if (s === "warning") return <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />;
  return <MinusCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />;
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

function FindingList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "pos" | "neg" | "warn";
}) {
  if (!items || items.length === 0) return null;
  const color =
    tone === "pos" ? "text-success" : tone === "neg" ? "text-destructive" : "text-warning";
  return (
    <div>
      <div className="mono mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className={color}>•</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
