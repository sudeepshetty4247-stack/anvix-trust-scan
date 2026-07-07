// Above-the-fold hero: colored verdict banner + score chip.
// The single question users care about, answered in 5 seconds.

import type { Verdict } from "@/lib/verdict";

type Props = {
  verdict: Verdict;
  score: number;
  caseName: string;
};

export function VerdictHero({ verdict, score, caseName }: Props) {
  return (
    <div
      className="relative mt-6 overflow-hidden rounded-2xl border p-6 sm:p-8"
      style={{
        borderColor: verdict.colorVar,
        background: `linear-gradient(135deg, color-mix(in oklch, ${verdict.colorVar} 22%, transparent), color-mix(in oklch, ${verdict.colorVar} 6%, transparent))`,
      }}
    >
      <div className="mono text-[11px] uppercase tracking-[0.22em]" style={{ color: verdict.colorVar }}>
        Investigation result — {caseName}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <span className="text-4xl leading-none">{verdict.emoji}</span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: verdict.colorVar }}>
          {verdict.label}
        </h1>
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        {verdict.headline}
      </p>
      <p className="mt-2 max-w-2xl text-base text-foreground/85 sm:text-lg">
        {verdict.decision}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div
          className="mono inline-flex items-baseline gap-1 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: verdict.colorVar, color: verdict.colorVar }}
        >
          <span className="text-lg font-semibold tabular-nums">{score}</span>
          <span className="text-xs opacity-70">/ 100 trust</span>
        </div>
        <ShouldContinueChip verdict={verdict} />
      </div>
    </div>
  );
}

function ShouldContinueChip({ verdict }: { verdict: Verdict }) {
  const label =
    verdict.shouldContinue === "no"
      ? "❌ Should you continue? No."
      : verdict.shouldContinue === "verify"
        ? "⚠ Should you continue? Verify first."
        : "✓ Should you continue? Yes.";
  return (
    <div
      className="rounded-lg border px-3 py-1.5 text-sm font-medium"
      style={{ borderColor: verdict.colorVar, color: verdict.colorVar }}
    >
      {label}
    </div>
  );
}
