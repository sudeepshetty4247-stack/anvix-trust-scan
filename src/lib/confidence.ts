// ANVIX confidence bands — turn a single trust score into "42 ± 8"
// with a plain-English reason. Deterministic, pure, runs anywhere.
//
// Inputs:
//   trust_score        final 0..100 score
//   lr, gbm            two ensemble member probabilities (0..1)
//   evidence_present   { url, email, offer_pdf, screenshot, text }
//   community_hits     number of global_signals matches (0..N)
//
// Formula:
//   band = clamp(5 + 15*|lr-gbm| + 3*missing - 5*community_hits, 3, 25)

export type ConfidenceInput = {
  trust_score: number;
  lr: number;
  gbm: number;
  evidence_present: {
    url: boolean;
    email: boolean;
    offer_pdf: boolean;
    screenshot: boolean;
    text: boolean;
  };
  community_hits: number;
};

export type ConfidenceResult = {
  low: number;
  high: number;
  band: number;
  reason: string;
};

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const disagree = Math.abs(input.lr - input.gbm);
  const ep = input.evidence_present;
  const missing =
    Number(!ep.url) +
    Number(!ep.email) +
    Number(!ep.offer_pdf) +
    Number(!ep.screenshot) +
    Number(!ep.text);
  const communityBonus = Math.min(3, input.community_hits) * 5; // hard cap

  const rawBand = 5 + 15 * disagree + 3 * missing - communityBonus;
  const band = Math.max(3, Math.min(25, Math.round(rawBand)));

  const low = Math.max(0, input.trust_score - band);
  const high = Math.min(100, input.trust_score + band);

  const parts: string[] = [];
  if (disagree > 0.15)
    parts.push(
      `Ensemble members disagree (LR ${(input.lr * 100).toFixed(0)}% vs GBM ${(input.gbm * 100).toFixed(0)}%) — widened band by ${Math.round(15 * disagree)}.`,
    );
  else parts.push("Ensemble members agreed strongly.");
  if (missing > 0)
    parts.push(
      `Missing ${missing} evidence category${missing === 1 ? "" : "ies"} widened the band by ${missing * 3}.`,
    );
  if (input.community_hits > 0)
    parts.push(
      `${Math.min(3, input.community_hits)} community-signal match(es) narrowed the band by ${communityBonus}.`,
    );

  return { low, high, band, reason: parts.join(" ") };
}
