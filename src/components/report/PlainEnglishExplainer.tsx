// "Explain like I'm new to job hunting" — collapsible plain-English
// summary of the AI's reasoning. Uses the existing report.summary field.

import { useState } from "react";
import { ChevronDown, MessageSquare } from "lucide-react";

export function PlainEnglishExplainer({ summary }: { summary?: string }) {
  const [open, setOpen] = useState(true);
  if (!summary) return null;
  return (
    <section className="glass mt-6 overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-accent/40"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <MessageSquare className="h-4 w-4" />
          </span>
          <div>
            <div className="text-base font-semibold">Explain this like I'm new to job hunting</div>
            <div className="text-xs text-muted-foreground">
              The AI's reasoning in plain English — no jargon.
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-border px-5 py-4 text-sm leading-relaxed text-foreground/90">
          {summary}
        </div>
      )}
    </section>
  );
}
