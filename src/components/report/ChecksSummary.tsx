// Human-friendly stats — replaces the raw "confidence 98%" number.

type Props = {
  verifications: Array<{ status?: string | null }>;
};

export function ChecksSummary({ verifications }: Props) {
  const total = verifications.length;
  const passed = verifications.filter((v) => (v.status ?? "").toLowerCase() === "pass").length;
  const warnings = verifications.filter((v) => (v.status ?? "").toLowerCase() === "warning").length;
  const failed = verifications.filter((v) => (v.status ?? "").toLowerCase() === "fail").length;

  if (total === 0) return null;

  return (
    <section className="glass mt-6 rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Investigation summary</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Checks performed" value={total} />
        <Stat label="Passed" value={passed} tone="success" />
        <Stat label="Warnings" value={warnings} tone="warning" />
        <Stat label="Failed" value={failed} tone="danger" />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-surface/60 p-4">
      <div className={`mono text-3xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="mono mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
