// "What scammers usually do next" — ANVIX's differentiator. Predicts the
// scammer's next asks so the user recognises the pattern before it happens.

import { ArrowRight } from "lucide-react";

const DEFAULT_SCAM_SEQUENCE = [
  "Send a fake offer letter with a real company's logo",
  "Ask you to share your Aadhaar and PAN for 'background verification'",
  "Request a small 'registration' or 'joining' fee (₹500–₹5,000)",
  "Ask for your bank details to 'set up salary'",
  "Escalate to a larger 'equipment deposit' for a laptop or ID card",
];

export function NextSteps({
  predicted,
  isScam,
}: {
  predicted?: string[];
  isScam: boolean;
}) {
  const steps =
    predicted && predicted.length > 0 ? predicted : isScam ? DEFAULT_SCAM_SEQUENCE : [];
  if (steps.length === 0) return null;

  return (
    <section className="glass mt-6 rounded-2xl border border-destructive/25 p-5 sm:p-6">
      <div className="mono text-[11px] uppercase tracking-[0.22em] text-destructive">
        Watch out — what happens next
      </div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">
        What scammers usually ask for next
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        If this recruiter follows the pattern we detected, the next messages will likely be:
      </p>
      <ol className="mt-4 space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="mono grid h-6 w-6 shrink-0 place-items-center rounded-full bg-destructive/15 text-xs font-semibold text-destructive">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
            <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
          </li>
        ))}
      </ol>
    </section>
  );
}
