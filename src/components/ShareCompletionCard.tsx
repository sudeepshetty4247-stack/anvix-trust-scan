// Renders after an investigation completes. Turns the verdict into a
// one-tap shareable card (WhatsApp / Telegram / copy link).

import { useState } from "react";
import { Check, Copy, MessageCircle, Send, Share2 } from "lucide-react";

type Props = {
  slug: string;
  caseName: string;
  trustScore: number;
  verdict: string;
  origin: string;
};

export function ShareCompletionCard({ slug, caseName, trustScore, verdict, origin }: Props) {
  const [copied, setCopied] = useState(false);
  const url = `${origin}/r/${slug}`;
  const shareText = `ANVIX verdict on "${caseName}": ${verdict.toUpperCase()} — trust ${trustScore}/100. Full report: ${url}`;
  const cardUrl = `${origin}/api/public/card/${slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  const nativeShare = async () => {
    if (typeof navigator === "undefined" || !("share" in navigator)) return copy();
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
        title: `ANVIX: ${verdict.toUpperCase()} — ${caseName}`,
        text: shareText,
        url,
      });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="glass rounded-2xl border border-primary/30 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mono text-xs uppercase tracking-[0.22em] text-primary/80">
            Share this report
          </div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">
            Warn someone before they lose money
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            A public read-only version lives for 90 days. No evidence or personal info is shared —
            just the verdict, score, and top reasons.
          </p>
        </div>
        <Share2 className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-black/20">
        <img
          src={cardUrl}
          alt="ANVIX shareable verdict card"
          className="w-full"
          loading="lazy"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3.5 py-2 text-sm hover:bg-accent"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-primary" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copy link
            </>
          )}
        </button>
        {/* WhatsApp share removed — Chrome blocks api.whatsapp.com/send links on desktop.
            Telegram + Copy link + native share cover the mobile case. */}
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-[#0088cc] px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Send className="h-4 w-4" /> Telegram
        </a>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            type="button"
            onClick={nativeShare}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3.5 py-2 text-sm hover:bg-accent sm:hidden"
          >
            <Share2 className="h-4 w-4" /> Share…
          </button>
        )}
        <span className="mono ml-auto text-xs text-muted-foreground">
          /r/{slug}
        </span>
      </div>
    </div>
  );
}
