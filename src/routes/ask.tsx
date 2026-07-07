import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAnvix, type AskAnvixReply } from "@/lib/ask.functions";
import {
  ArrowLeft,
  Send,
  Loader2,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/ask")({
  component: AskAnvixPage,
  head: () => ({
    meta: [
      { title: "Ask ANVIX — 5-second scam check" },
      {
        name: "description",
        content:
          "Paste any suspicious message and ANVIX tells you in seconds whether it's a scam. No forms, no signup, plain English.",
      },
    ],
  }),
});

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; reply: AskAnvixReply };

const EXAMPLES = [
  "Amazon HR called and asked me to pay ₹499 registration fee. Real or scam?",
  "Got a WhatsApp offer letter from 'Google India Careers' from a Gmail address. Legit?",
  "Recruiter wants my Aadhaar and PAN before the interview. Should I share?",
  "Is this UPI safe: quickpay.hr@paytm ?",
];

function AskAnvixPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const askFn = useServerFn(askAnvix);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setError(null);
    setInput("");
    const nextTurns: Turn[] = [...turns, { role: "user", text: q }];
    setTurns(nextTurns);
    setLoading(true);
    try {
      const history = nextTurns
        .slice(0, -1)
        .map((t) =>
          t.role === "user"
            ? { role: "user" as const, content: t.text }
            : {
                role: "assistant" as const,
                content: `${t.reply.headline}\n${t.reply.reason}\n${t.reply.action}`,
              },
        );
      const reply = await askFn({ data: { question: q, history } });
      setTurns((t) => [...t, { role: "assistant", reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6 sm:px-6">
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

      {turns.length === 0 && (
        <div className="mt-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Ask ANVIX
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Paste any suspicious message, UPI ID, or job offer. Get a plain-English answer
            in 3 seconds. No forms. No signup.
          </p>
          <div className="mt-8 grid gap-2 text-left sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => send(ex)}
                className="glass rounded-xl p-3 text-left text-sm text-foreground/85 transition hover:border-primary/40 hover:bg-accent/40"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex-1 space-y-4">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {t.text}
              </div>
            </div>
          ) : (
            <ReplyCard key={i} reply={t.reply} onFollowUp={(q) => send(q)} />
          ),
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> ANVIX is investigating…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 mt-6 pb-4 pt-2"
      >
        <div className="glass flex items-end gap-2 rounded-2xl p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Paste a message or ask anything…"
            rows={2}
            maxLength={4000}
            className="min-h-[52px] flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={loading || input.trim().length < 3}
            className="mb-1 mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
            aria-label="Send"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mono mt-2 text-center text-[11px] text-muted-foreground">
          Informational only. Not legal advice. In an emergency, call cybercrime helpline 1930.
        </p>
      </form>
    </div>
  );
}

function verdictColor(v: AskAnvixReply["verdict"]) {
  switch (v) {
    case "scam":
      return "var(--risk-fraud)";
    case "suspicious":
      return "var(--risk-high)";
    case "verify":
      return "var(--risk-caution)";
    case "safe":
      return "var(--risk-safe)";
    default:
      return "var(--muted-foreground)";
  }
}

function ReplyCard({
  reply,
  onFollowUp,
}: {
  reply: AskAnvixReply;
  onFollowUp: (q: string) => void;
}) {
  const color = verdictColor(reply.verdict);
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[92%] rounded-2xl rounded-bl-sm border p-4"
        style={{
          borderColor: color,
          background: `color-mix(in oklch, ${color} 8%, transparent)`,
        }}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-2xl leading-none">{reply.emoji}</span>
          <div className="text-base font-semibold" style={{ color }}>
            {reply.headline}
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{reply.reason}</p>
        <div
          className="mt-3 rounded-lg border p-3 text-sm"
          style={{ borderColor: color, background: `color-mix(in oklch, ${color} 5%, transparent)` }}
        >
          <div className="mono text-[10px] uppercase tracking-widest" style={{ color }}>
            What to do now
          </div>
          <div className="mt-1">{reply.action}</div>
        </div>

        {reply.community_hits && reply.community_hits.length > 0 && (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <div className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-destructive">
              <AlertTriangle className="h-3 w-3" /> Community intelligence
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {reply.community_hits.map((h, i) => (
                <li key={i}>
                  <span className="mono">{h.matched_preview}</span> — reported{" "}
                  <span className="font-semibold">{h.report_count}×</span> ({h.kind})
                </li>
              ))}
            </ul>
          </div>
        )}

        {reply.follow_up && (
          <button
            type="button"
            onClick={() => onFollowUp(reply.follow_up!)}
            className="mt-3 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-accent"
          >
            {reply.follow_up}
          </button>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/investigate"
            className="mono rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] hover:bg-accent"
          >
            Want a full report? →
          </Link>
          <Link
            to="/check-payment"
            className="mono rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] hover:bg-accent"
          >
            Check a UPI / bank account →
          </Link>
        </div>
      </div>
    </div>
  );
}
