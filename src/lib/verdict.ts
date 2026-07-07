// Turns a RiskCategory + trust score into a human verdict:
// emoji, label, one-line decision, emotional headline, and color token.
// Pure — no side effects, safe on server and client.

import type { RiskCategory } from "./scoring";

export type Verdict = {
  emoji: string;
  label: string;             // 🟢 Trusted / 🟡 Needs verification / 🟠 Suspicious / 🔴 Likely scam
  headline: string;          // Emotional one-liner: "Good news." / "Be careful." / "Stop."
  decision: string;          // Should you continue? "Yes." / "Verify first." / "Do NOT continue."
  shouldContinue: "yes" | "verify" | "no";
  tone: "success" | "warning" | "danger" | "critical";
  colorVar: string;          // CSS variable name for the accent color
};

export function getVerdict(category: RiskCategory): Verdict {
  switch (category) {
    case "trusted":
      return {
        emoji: "🟢",
        label: "Trusted",
        headline: "Good news.",
        decision: "This recruiter looks safe to continue with.",
        shouldContinue: "yes",
        tone: "success",
        colorVar: "var(--risk-trusted)",
      };
    case "likely_safe":
      return {
        emoji: "🟢",
        label: "Likely safe",
        headline: "Looks legitimate.",
        decision: "You can continue — but still verify the recruiter through the company's official careers page.",
        shouldContinue: "verify",
        tone: "success",
        colorVar: "var(--risk-safe)",
      };
    case "caution":
      return {
        emoji: "🟡",
        label: "Needs verification",
        headline: "Be careful.",
        decision: "Verify this recruiter before sharing any personal information.",
        shouldContinue: "verify",
        tone: "warning",
        colorVar: "var(--risk-caution)",
      };
    case "high_risk":
      return {
        emoji: "🟠",
        label: "Suspicious",
        headline: "Warning.",
        decision: "Do NOT continue. Several serious red flags detected.",
        shouldContinue: "no",
        tone: "danger",
        colorVar: "var(--risk-high)",
      };
    case "fraudulent":
    default:
      return {
        emoji: "🔴",
        label: "Likely scam",
        headline: "Stop.",
        decision: "Do NOT continue. Do not pay money or share personal documents.",
        shouldContinue: "no",
        tone: "critical",
        colorVar: "var(--risk-fraud)",
      };
  }
}
