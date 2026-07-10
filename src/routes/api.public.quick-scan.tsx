// Public quick-scan endpoint used by the ANVIX browser extension so the
// verdict renders INSIDE the popup — no redirect to the website.
// Pure heuristic scoring (keywords + URL/email/domain signals). No DB,
// no auth, no external network calls — safe to run on the edge under load.

import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const FRAUD_KEYWORDS: Array<{ w: string; p: number; why: string }> = [
  { w: "registration fee", p: 22, why: "Asks for an upfront fee" },
  { w: "processing fee", p: 20, why: "Asks for a processing fee" },
  { w: "training fee", p: 18, why: "Asks for a training fee" },
  { w: "security deposit", p: 20, why: "Asks for a refundable deposit" },
  { w: "refundable", p: 10, why: "Uses 'refundable' to justify a fee" },
  { w: "kyc fee", p: 22, why: "Fake KYC fee request" },
  { w: "activation fee", p: 20, why: "Asks for an activation fee" },
  { w: "western union", p: 25, why: "Requests Western Union transfer" },
  { w: "moneygram", p: 25, why: "Requests MoneyGram transfer" },
  { w: "gift card", p: 22, why: "Payment via gift cards" },
  { w: "bitcoin", p: 18, why: "Crypto payment mention" },
  { w: "usdt", p: 18, why: "Crypto (USDT) payment mention" },
  { w: "upi", p: 8, why: "UPI payment mentioned" },
  { w: "paytm", p: 8, why: "Paytm handle mentioned" },
  { w: "no interview", p: 15, why: "Claims 'no interview needed'" },
  { w: "guaranteed", p: 8, why: "Uses word 'guaranteed'" },
  { w: "work from home", p: 4, why: "Generic WFH pitch" },
  { w: "congratulations", p: 4, why: "Unsolicited 'Congratulations!'" },
  { w: "urgent", p: 6, why: "Creates urgency" },
  { w: "immediately", p: 4, why: "Pressure to act immediately" },
  { w: "selected", p: 3, why: "Claims you are already 'selected'" },
  { w: "shortlisted", p: 3, why: "Claims you are 'shortlisted'" },
  { w: "whatsapp", p: 5, why: "Wants to move to WhatsApp" },
  { w: "telegram", p: 8, why: "Wants to move to Telegram" },
  { w: "aadhaar", p: 6, why: "Requests Aadhaar" },
  { w: "pan card", p: 6, why: "Requests PAN card" },
];

const SAFE_SIGNALS: Array<{ w: string; p: number; why: string }> = [
  { w: "interview", p: 6, why: "Mentions an interview process" },
  { w: "offer letter", p: 4, why: "References a formal offer letter" },
  { w: "hr@", p: 6, why: "Corporate-style HR contact" },
  { w: "careers@", p: 6, why: "Corporate-style careers contact" },
  { w: "background check", p: 6, why: "Mentions background verification" },
  { w: "reference check", p: 5, why: "Mentions reference check" },
];

const SUSPICIOUS_TLDS = new Set([
  "xyz", "top", "click", "quest", "cam", "tk", "ml", "ga", "cf", "gq",
  "work", "loan", "country", "stream", "download", "online", "site",
]);
const FREE_EMAIL = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com",
  "protonmail.com", "icloud.com", "yandex.com", "mail.com",
]);
const BIG_BRANDS = ["google", "microsoft", "amazon", "meta", "apple", "netflix", "flipkart", "tcs", "infosys", "wipro"];

function verdictFor(score: number): { label: string; category: string } {
  if (score >= 75) return { label: "Likely safe", category: "likely_safe" };
  if (score >= 55) return { label: "Caution", category: "caution" };
  if (score >= 35) return { label: "High risk", category: "high_risk" };
  return { label: "Likely fraud", category: "likely_fraud" };
}

function scan(text: string) {
  const t = (text || "").toLowerCase();
  let score = 70;
  const reasons: string[] = [];
  const positives: string[] = [];

  for (const k of FRAUD_KEYWORDS) {
    if (t.includes(k.w)) { score -= k.p; if (reasons.length < 8) reasons.push(k.why); }
  }
  for (const s of SAFE_SIGNALS) {
    if (t.includes(s.w)) { score += s.p; if (positives.length < 4) positives.push(s.why); }
  }

  // Rupee amounts / dollar amounts that look like fees
  if (/(rs\.?|₹|inr)\s?\d{2,6}/i.test(text) && /(fee|deposit|pay|activate|register)/i.test(t)) {
    score -= 15; reasons.push("Small money amount tied to fee/registration");
  }

  // Emails
  const emails = Array.from(text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)).map((m) => m[0]);
  for (const e of emails) {
    const dom = e.split("@")[1].toLowerCase();
    const brandInText = BIG_BRANDS.find((b) => t.includes(b));
    if (FREE_EMAIL.has(dom) && brandInText) {
      score -= 20;
      reasons.push(`Claims to be ${brandInText} but writes from a free ${dom} address`);
    }
    const tld = dom.split(".").pop() || "";
    if (SUSPICIOUS_TLDS.has(tld)) { score -= 12; reasons.push(`Sender domain uses low-trust .${tld} TLD`); }
    if (brandInText && !dom.includes(brandInText)) {
      score -= 15;
      reasons.push(`Mentions ${brandInText} but the sender domain is ${dom}`);
    }
  }

  // URLs
  const urls = Array.from(text.matchAll(/https?:\/\/[^\s)]+/gi)).map((m) => m[0]);
  for (const u of urls) {
    try {
      const host = new URL(u).hostname.toLowerCase();
      const tld = host.split(".").pop() || "";
      if (SUSPICIOUS_TLDS.has(tld)) { score -= 10; reasons.push(`Link uses low-trust .${tld} domain`); }
      for (const b of BIG_BRANDS) {
        if (host.includes(b) && !host.endsWith(`${b}.com`) && !host.endsWith(`${b}.in`)) {
          score -= 18;
          reasons.push(`Look-alike domain impersonating ${b}: ${host}`);
        }
      }
    } catch { /* ignore */ }
  }

  // Phone numbers with WhatsApp
  if (/\+?\d[\d\s-]{8,}\d/.test(text) && /whatsapp|telegram/i.test(t)) {
    score -= 8;
    reasons.push("Pushes you to a personal WhatsApp/Telegram number");
  }

  // Very short input = low confidence, drag score toward neutral
  if (text.trim().length < 40) score = Math.round((score + 60) / 2);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const v = verdictFor(score);

  return {
    score,
    label: v.label,
    category: v.category,
    reasons: reasons.slice(0, 6),
    positives: positives.slice(0, 3),
    checklist: [
      "Verify the recruiter on the company's official careers page.",
      "Never pay any fee to receive a job — legitimate employers never ask.",
      "Cross-check the sender's email domain against the real company domain.",
      "Search the exact message text online — scams are usually copy-pasted.",
    ],
  };
}

export const Route = createFileRoute("/api/public/quick-scan")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: { text?: string } = {};
        try { body = await request.json(); } catch { /* ignore */ }
        const text = (body.text || "").slice(0, 20000);
        if (!text.trim()) {
          return new Response(JSON.stringify({ error: "empty" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        const result = scan(text);
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
