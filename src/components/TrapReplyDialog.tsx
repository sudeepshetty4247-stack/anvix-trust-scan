// Trap-Reply Generator dialog. Two modes: propose 3 replies to send to the
// scammer, and score the scammer's reply once the user pastes it back.

import { useState } from "react";
import { Loader2, X, Copy, Check, Sparkles, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  generateTrapReplies,
  scoreTrapReply,
  type TrapReplyBundle,
  type TrapScore,
} from "@/lib/trap-reply.functions";

export function TrapReplyDialog({
  open,
  onClose,
  caseName,
  caseSummary,
  recruiterName,
  companyClaimed,
}: {
  open: boolean;
  onClose: () => void;
  caseName: string;
  caseSummary: string;
  recruiterName?: string;
  companyClaimed?: string;
}) {
  const [bundle, setBundle] = useState<TrapReplyBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedTrap, setSelectedTrap] = useState<string>("");
  const [scammerReply, setScammerReply] = useState("");
  const [score, setScore] = useState<TrapScore | null>(null);
  const [scoring, setScoring] = useState(false);
  const genFn = useServerFn(generateTrapReplies);
  const scoreFn = useServerFn(scoreTrapReply);

  if (!open) return null;

  async function onGenerate() {
    setLoading(true);
    setBundle(null);
    setScore(null);
    try {
      const b = await genFn({
        data: {
          case_summary: caseSummary || caseName,
          recruiter_name: recruiterName,
          company_claimed: companyClaimed,
        },
      });
      setBundle(b);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate replies");
    } finally {
      setLoading(false);
    }
  }

  async function onCopy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(i);
      setSelectedTrap(text);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      /* noop */
    }
  }

  async function onScore() {
    if (!selectedTrap || scammerReply.trim().length < 3) return;
    setScoring(true);
    try {
      const s = await scoreFn({
        data: {
          original_case: caseSummary || caseName,
          trap_sent: selectedTrap,
          scammer_reply: scammerReply,
        },
      });
      setScore(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to score reply");
    } finally {
      setScoring(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="glass w-full max-w-2xl overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="mono text-[10px] uppercase tracking-widest text-primary">
              Trap-reply generator
            </div>
            <div className="text-base font-semibold">
              Extract more evidence — without spooking the scammer
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-auto px-5 py-4">
          {!bundle && (
            <div className="text-center">
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                ANVIX will propose 3 short, plausible messages you can send back to the
                recruiter. Each one is designed to make a scammer trip up while letting a real
                recruiter answer normally.
              </p>
              <button
                type="button"
                onClick={onGenerate}
                disabled={loading}
                className="mx-auto mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate 3 replies
              </button>
            </div>
          )}

          {bundle && (
            <div className="space-y-3">
              {bundle.replies.map((r, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-surface/50 p-4">
                  <div className="mono text-[10px] uppercase tracking-widest text-primary">
                    Goal: {r.goal}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap rounded-lg border border-border/60 bg-background/60 p-3 text-sm">
                    {r.message}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="italic">Watch for: {r.watch_for}</span>
                    <button
                      type="button"
                      onClick={() => onCopy(r.message, i)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-accent"
                    >
                      {copiedIndex === i ? (
                        <>
                          <Check className="h-3 w-3 text-primary" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy & use
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {bundle.safety_notes.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
                  <div className="mono mb-1 text-[10px] uppercase tracking-widest text-warning">
                    Safety notes
                  </div>
                  <ul className="space-y-1">
                    {bundle.safety_notes.map((n, i) => (
                      <li key={i}>• {n}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Score the reply */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <div className="text-sm font-semibold">
                    Paste the scammer's reply to grade it
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Once they respond, paste what they said here. ANVIX will extract any new
                  identifiers and tell you what it means.
                </p>
                <textarea
                  value={scammerReply}
                  onChange={(e) => setScammerReply(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="Paste the scammer's reply here…"
                  className="input mt-3"
                />
                <button
                  type="button"
                  onClick={onScore}
                  disabled={scoring || scammerReply.trim().length < 3 || !selectedTrap}
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {scoring ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Score the reply
                </button>
                {!selectedTrap && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Copy one of the trap messages first.
                  </p>
                )}

                {score && (
                  <div className="mt-4 rounded-lg border border-border/60 bg-background/60 p-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl leading-none">{score.emoji}</span>
                      <div className="text-base font-semibold">{score.headline}</div>
                    </div>
                    {score.new_red_flags.length > 0 && (
                      <div className="mt-3">
                        <div className="mono text-[10px] uppercase tracking-widest text-destructive">
                          New red flags
                        </div>
                        <ul className="mt-1 space-y-1 text-sm">
                          {score.new_red_flags.map((f, i) => (
                            <li key={i}>• {f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(score.new_evidence.emails.length > 0 ||
                      score.new_evidence.phones.length > 0 ||
                      score.new_evidence.payment_handles.length > 0 ||
                      score.new_evidence.domains.length > 0) && (
                      <div className="mt-3">
                        <div className="mono text-[10px] uppercase tracking-widest text-primary">
                          New identifiers captured
                        </div>
                        <ul className="mono mt-1 space-y-0.5 text-xs">
                          {score.new_evidence.emails.map((v, i) => (
                            <li key={"e" + i}>email: {v}</li>
                          ))}
                          {score.new_evidence.phones.map((v, i) => (
                            <li key={"p" + i}>phone: {v}</li>
                          ))}
                          {score.new_evidence.payment_handles.map((v, i) => (
                            <li key={"u" + i}>UPI/bank: {v}</li>
                          ))}
                          {score.new_evidence.domains.map((v, i) => (
                            <li key={"d" + i}>domain: {v}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="mt-3 rounded-md bg-primary/10 p-2 text-sm">
                      <span className="font-semibold">Next: </span>
                      {score.next_action}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
