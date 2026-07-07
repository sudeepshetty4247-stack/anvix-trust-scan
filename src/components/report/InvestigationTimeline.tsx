// A human-readable checklist of what ANVIX did to reach the verdict.
// Makes the process feel alive and transparent.

import { Check } from "lucide-react";

type Props = {
  evidenceCount: number;
  verificationCount: number;
  hasPrediction: boolean;
  hasReport: boolean;
};

export function InvestigationTimeline({
  evidenceCount,
  verificationCount,
  hasPrediction,
  hasReport,
}: Props) {
  const steps: Array<{ label: string; done: boolean }> = [
    { label: "Evidence collected", done: evidenceCount > 0 },
    { label: "Text extracted from files and links", done: evidenceCount > 0 },
    { label: "Recruiter and company identity checked", done: verificationCount > 0 },
    { label: "Website registration and security checked", done: verificationCount > 0 },
    { label: "Known scam patterns compared", done: verificationCount > 0 },
    { label: "AI reasoning completed", done: hasReport },
    { label: "Final trust score generated", done: hasPrediction },
  ];

  return (
    <section className="glass mt-6 rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Investigation timeline</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Here's exactly what ANVIX checked, in order.
      </p>
      <ol className="mt-4 space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                s.done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className={s.done ? "" : "text-muted-foreground line-through"}>{s.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
