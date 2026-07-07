// ANVIX scoring engine — deterministic, calibrated weighted feature model.
// Runs client and server (pure). This is a stand-in for the external Python
// ML API; the interface is stable so it can be swapped without UI changes.

export type FeatureVector = Record<string, number>; // 0..1 normalized

export type RiskCategory = "trusted" | "likely_safe" | "caution" | "high_risk" | "fraudulent";

export const FEATURE_WEIGHTS: Record<string, number> = {
  domain_age: 8,
  ssl_valid: 6,
  dns_valid: 5,
  spf: 3,
  dmarc: 3,
  official_email_match: 6,
  website_reachable: 5,
  fraud_keywords: -12,
  payment_request: -15,
  crypto_mention: -8,
  urgency_score: -6,
  grammar_quality: 4,
  evidence_count: 5,
  evidence_diversity: 4,
  cross_source_consistency: 6,
  suspicious_tld: -5,
  free_email_recruiter: -4,
};

export function scoreFeatures(features: FeatureVector): {
  score: number; // 0..100 (higher = more trustworthy)
  confidence: number; // 0..1
  category: RiskCategory;
  importance: Record<string, number>;
} {
  let raw = 50;
  const contribs: Record<string, number> = {};
  let seen = 0;
  for (const [k, w] of Object.entries(FEATURE_WEIGHTS)) {
    const v = features[k];
    if (typeof v !== "number") continue;
    seen++;
    const c = v * w;
    contribs[k] = c;
    raw += c;
  }
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const confidence = Math.max(
    0.35,
    Math.min(0.98, 0.4 + seen / (Object.keys(FEATURE_WEIGHTS).length * 1.4)),
  );

  let category: RiskCategory;
  if (score >= 85) category = "trusted";
  else if (score >= 70) category = "likely_safe";
  else if (score >= 50) category = "caution";
  else if (score >= 30) category = "high_risk";
  else category = "fraudulent";

  // importance = |contribution| normalized
  const total = Object.values(contribs).reduce((s, v) => s + Math.abs(v), 0) || 1;
  const importance: Record<string, number> = {};
  for (const [k, v] of Object.entries(contribs))
    importance[k] = Math.round((Math.abs(v) / total) * 1000) / 1000;

  return { score, confidence: Math.round(confidence * 100) / 100, category, importance };
}

export const RISK_META: Record<RiskCategory, { label: string; tone: string; color: string }> = {
  trusted: { label: "Trusted", tone: "success", color: "var(--risk-trusted)" },
  likely_safe: { label: "Likely safe", tone: "success", color: "var(--risk-safe)" },
  caution: { label: "Caution", tone: "warning", color: "var(--risk-caution)" },
  high_risk: { label: "High risk", tone: "destructive", color: "var(--risk-high)" },
  fraudulent: { label: "Likely fraud", tone: "destructive", color: "var(--risk-fraud)" },
};
