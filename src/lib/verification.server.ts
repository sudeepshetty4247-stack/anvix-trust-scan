// Server-side verification helpers. DNS via Cloudflare DoH, WHOIS via RDAP,
// SSL via a fetch probe. All zero-config, no keys.

export type CheckResult = {
  status: "pass" | "fail" | "warning" | "skipped";
  score: number; // 0..1
  detail: string;
  data?: unknown;
};

const SUSPICIOUS_TLDS = new Set([
  "xyz",
  "top",
  "click",
  "quest",
  "cam",
  "tk",
  "ml",
  "ga",
  "cf",
  "gq",
  "work",
  "loan",
  "kim",
  "country",
  "stream",
  "download",
]);
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "aol.com",
  "protonmail.com",
  "icloud.com",
  "yandex.com",
  "mail.com",
]);
const FRAUD_KEYWORDS = [
  "registration fee",
  "processing fee",
  "training fee",
  "refundable deposit",
  "security deposit",
  "western union",
  "moneygram",
  "gift card",
  "bitcoin",
  "btc",
  "usdt",
  "crypto payment",
  "send payment",
  "pay to activate",
  "kyc fee",
  "laptop will be shipped",
  "work from home guaranteed",
  "no interview needed",
  "earn $",
  "earn ₹",
  "limited seats",
  "act fast",
  "urgent hiring",
  "immediate joining",
  "apply within 24",
  "confidential offer",
  "selected without interview",
];
const URGENCY_TERMS = [
  "urgent",
  "immediately",
  "asap",
  "today only",
  "last chance",
  "limited time",
  "act now",
  "final call",
  "expires",
];

export function extractDomain(input: string): string | null {
  try {
    const s = input.trim();
    const url = /^https?:\/\//i.test(s) ? new URL(s) : new URL(`https://${s.split(/[\s,;]/)[0]}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function extractEmails(text: string): string[] {
  return Array.from(new Set(text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [])).map((e) =>
    e.toLowerCase(),
  );
}

export function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(/https?:\/\/[^\s"'<>)]+/gi) ?? []));
}

async function doh(name: string, type: string): Promise<any> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    {
      headers: { accept: "application/dns-json" },
    },
  );
  if (!res.ok) throw new Error(`DoH ${type} ${res.status}`);
  return res.json();
}

export async function checkDns(domain: string): Promise<CheckResult> {
  try {
    const [a, mx] = await Promise.all([doh(domain, "A"), doh(domain, "MX")]);
    const hasA = Array.isArray(a.Answer) && a.Answer.length > 0;
    const hasMx = Array.isArray(mx.Answer) && mx.Answer.length > 0;
    if (hasA && hasMx)
      return {
        status: "pass",
        score: 1,
        detail: `Resolves A + MX (${mx.Answer.length} mail server(s))`,
        data: { a: a.Answer, mx: mx.Answer },
      };
    if (hasA)
      return {
        status: "warning",
        score: 0.5,
        detail: "Resolves A but no MX (cannot receive email)",
        data: { a: a.Answer },
      };
    return { status: "fail", score: 0, detail: "No DNS records found" };
  } catch (e) {
    return { status: "fail", score: 0, detail: `DNS lookup failed: ${(e as Error).message}` };
  }
}

export async function checkEmailAuth(
  domain: string,
): Promise<{ spf: CheckResult; dmarc: CheckResult }> {
  const txt = async (name: string) => {
    try {
      const r = await doh(name, "TXT");
      const strings: string[] = (r.Answer ?? []).map((a: any) =>
        String(a.data ?? "")
          .replace(/^"|"$/g, "")
          .replace(/"\s*"/g, ""),
      );
      return strings;
    } catch {
      return [];
    }
  };
  const [root, dmarc] = await Promise.all([txt(domain), txt(`_dmarc.${domain}`)]);
  const spfRec = root.find((t) => t.toLowerCase().startsWith("v=spf1"));
  const dmarcRec = dmarc.find((t) => t.toLowerCase().startsWith("v=dmarc1"));
  return {
    spf: spfRec
      ? { status: "pass", score: 1, detail: "SPF record present", data: spfRec }
      : { status: "fail", score: 0, detail: "No SPF record" },
    dmarc: dmarcRec
      ? { status: "pass", score: 1, detail: `DMARC policy present`, data: dmarcRec }
      : { status: "fail", score: 0, detail: "No DMARC record" },
  };
}

export async function checkWebsite(domain: string): Promise<CheckResult & { ssl: CheckResult }> {
  const url = `https://${domain}`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { redirect: "follow", signal: controller.signal });
    clearTimeout(t);
    const ok = res.status < 500;
    return {
      status: ok ? "pass" : "warning",
      score: ok ? 1 : 0.4,
      detail: `Reachable via HTTPS (status ${res.status})`,
      data: { status: res.status, finalUrl: res.url },
      ssl: { status: "pass", score: 1, detail: "TLS handshake succeeded" },
    };
  } catch (e) {
    return {
      status: "fail",
      score: 0,
      detail: `Website unreachable: ${(e as Error).message}`,
      ssl: { status: "fail", score: 0, detail: "TLS/HTTPS handshake failed" },
    };
  }
}

export async function checkWhois(
  domain: string,
): Promise<CheckResult & { ageDays: number | null }> {
  // RDAP is free, no key, JSON.
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
    if (!res.ok)
      return {
        status: "warning",
        score: 0.4,
        detail: `WHOIS lookup returned ${res.status}`,
        ageDays: null,
      };
    const j: any = await res.json();
    const reg = (j.events ?? []).find((e: any) => e.eventAction === "registration");
    if (!reg?.eventDate)
      return {
        status: "warning",
        score: 0.4,
        detail: "WHOIS present but no registration date",
        ageDays: null,
      };
    const created = new Date(reg.eventDate);
    const days = Math.floor((Date.now() - created.getTime()) / 86400000);
    if (days > 365 * 2)
      return {
        status: "pass",
        score: 1,
        detail: `Domain registered ${Math.round(days / 365)}y ago`,
        ageDays: days,
        data: { created: reg.eventDate },
      };
    if (days > 180)
      return {
        status: "warning",
        score: 0.6,
        detail: `Domain is ${days} days old`,
        ageDays: days,
        data: { created: reg.eventDate },
      };
    return {
      status: "fail",
      score: 0.1,
      detail: `Very young domain: ${days} days old`,
      ageDays: days,
      data: { created: reg.eventDate },
    };
  } catch (e) {
    return {
      status: "warning",
      score: 0.3,
      detail: `WHOIS failed: ${(e as Error).message}`,
      ageDays: null,
    };
  }
}

export function analyzeText(text: string): {
  fraud: CheckResult;
  urgency: CheckResult;
  payment: CheckResult;
  crypto: CheckResult;
  grammar: CheckResult;
} {
  const t = text.toLowerCase();
  const foundFraud = FRAUD_KEYWORDS.filter((k) => t.includes(k));
  const foundUrg = URGENCY_TERMS.filter((k) => t.includes(k));
  const paymentHit =
    /\b(pay|deposit|transfer|wire|remit|fee)\b/.test(t) &&
    /\b(\$|₹|usd|inr|eur|gbp|bitcoin|btc)\b/.test(t);
  const cryptoHit = /(bitcoin|btc|usdt|ethereum|eth|crypto\s*(wallet|payment))/.test(t);

  // very rough grammar heuristic: proportion of ALL CAPS words + exclamations
  const words = text.split(/\s+/).filter(Boolean);
  const upper = words.filter(
    (w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w),
  ).length;
  const excl = (text.match(/!/g) ?? []).length;
  const noise = words.length ? (upper * 1.5 + excl) / words.length : 0;
  const grammarQuality = Math.max(0, Math.min(1, 1 - noise * 3));

  return {
    fraud: foundFraud.length
      ? {
          status: "fail",
          score: Math.min(1, foundFraud.length / 3),
          detail: `${foundFraud.length} fraud keyword(s) detected`,
          data: foundFraud,
        }
      : { status: "pass", score: 0, detail: "No fraud keywords detected" },
    urgency:
      foundUrg.length >= 2
        ? {
            status: "warning",
            score: Math.min(1, foundUrg.length / 4),
            detail: `${foundUrg.length} urgency term(s)`,
            data: foundUrg,
          }
        : { status: "pass", score: foundUrg.length / 10, detail: "Low urgency language" },
    payment: paymentHit
      ? {
          status: "fail",
          score: 1,
          detail: "Text mentions payment / fees from candidate",
          data: {},
        }
      : { status: "pass", score: 0, detail: "No payment request detected" },
    crypto: cryptoHit
      ? { status: "fail", score: 1, detail: "Cryptocurrency mentioned in a recruitment context" }
      : { status: "pass", score: 0, detail: "No cryptocurrency mentions" },
    grammar: {
      status: grammarQuality > 0.7 ? "pass" : grammarQuality > 0.4 ? "warning" : "fail",
      score: grammarQuality,
      detail: `Grammar quality index ${(grammarQuality * 100).toFixed(0)}/100`,
    },
  };
}

export function suspiciousTld(domain: string): boolean {
  const tld = domain.split(".").pop() ?? "";
  return SUSPICIOUS_TLDS.has(tld);
}

export function isFreeEmail(email: string): boolean {
  const d = email.split("@")[1];
  return !!d && FREE_EMAIL_DOMAINS.has(d);
}
