// The three biggest human-readable reasons behind the verdict.

import { AlertCircle } from "lucide-react";

export function TopReasons({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <section className="glass mt-6 rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Why did ANVIX reach this decision?</h2>
      <ul className="mt-4 space-y-3">
        {reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
              <AlertCircle className="h-4 w-4" />
            </span>
            <span className="text-sm leading-relaxed sm:text-base">{r}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
