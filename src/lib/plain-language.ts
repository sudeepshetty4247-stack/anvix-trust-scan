// Deterministic mapper: technical verification finding → plain-English sentence.
// Zero acronyms leak out. Falls back to the original detail if we don't
// recognise the check name.

type VerificationLike = {
  category?: string | null;
  check_name?: string | null;
  status?: string | null;
  result?: unknown;
};

const RULES: Array<{
  match: RegExp;
  pass?: string;
  fail?: string;
  warn?: string;
}> = [
  {
    match: /spf/i,
    pass: "The sender's email address is properly authenticated by the company's mail server.",
    fail: "The sender's email couldn't be fully verified as coming from the company it claims to represent.",
    warn: "The sender's email is only partially verified.",
  },
  {
    match: /dmarc/i,
    pass: "The company enforces the security policy that stops others from faking their email.",
    fail: "This email lacks some of the security protections normally expected from a real company.",
    warn: "The company's anti-spoofing protection is weak.",
  },
  {
    match: /dkim/i,
    pass: "The email carries a valid cryptographic signature from the company.",
    fail: "The email is missing the cryptographic signature that proves it wasn't tampered with.",
  },
  {
    match: /mx/i,
    pass: "The email domain has real, working mail servers.",
    fail: "The email domain has no working mail servers — a strong sign it's not a real business.",
  },
  {
    match: /whois|domain[_ ]?age|registration/i,
    pass: "The website has been registered for a long time — a good sign.",
    fail: "We couldn't verify when this website was registered.",
    warn: "This website was registered very recently — common for scam sites.",
  },
  {
    match: /ssl|https|certificate/i,
    pass: "The website uses a valid secure connection.",
    fail: "The website is missing a proper secure connection.",
    warn: "The website's secure connection has issues.",
  },
  {
    match: /dns|reachable|website/i,
    pass: "The website is live and reachable.",
    fail: "The website couldn't be reached or doesn't exist.",
  },
  {
    match: /tld|suspicious.*domain/i,
    fail: "The website uses an unusual address extension often abused by scammers.",
    warn: "The website's address extension is uncommon for real employers.",
  },
  {
    match: /free.*email|gmail|yahoo|outlook.*recruiter/i,
    fail: "The recruiter is contacting you from a free personal email account, not a company address.",
    warn: "The recruiter uses a free email service instead of an official company address.",
  },
  {
    match: /payment|money|fee|deposit/i,
    fail: "The message asks you to pay money — a major scam warning sign.",
    warn: "The message mentions payments or fees.",
  },
  {
    match: /crypto|bitcoin|usdt|wallet/i,
    fail: "The message asks for cryptocurrency — real employers never do this.",
    warn: "The message mentions cryptocurrency.",
  },
  {
    match: /urgency|urgent|immediately|24 ?hours/i,
    fail: "The message pressures you to act immediately — a classic scam tactic.",
    warn: "The message uses time pressure.",
  },
  {
    match: /fraud[_ ]?keyword|scam[_ ]?keyword/i,
    fail: "The message contains language commonly found in known recruitment scams.",
    warn: "Some phrases in the message match patterns seen in past scams.",
  },
  {
    match: /grammar|typo|spelling/i,
    fail: "The message contains poor grammar or spelling — unusual for a real recruiter.",
    warn: "The writing quality is below what you'd expect from a corporate recruiter.",
  },
  {
    match: /brand|impersonat|logo/i,
    fail: "The message impersonates a well-known brand but isn't from them.",
    warn: "The message references a well-known brand — verify it directly.",
  },
  {
    match: /linkedin|social/i,
    pass: "The recruiter's professional profile checks out.",
    fail: "We couldn't confirm this recruiter exists as a real employee of the company.",
    warn: "The recruiter's professional profile couldn't be fully verified.",
  },
  {
    match: /email.*match|official.*email/i,
    pass: "The recruiter is emailing from the company's official domain.",
    fail: "The recruiter's email address does NOT match the company they claim to work for.",
  },
];

export function humaniseVerification(v: VerificationLike): string {
  const name = `${v.category ?? ""} ${v.check_name ?? ""}`.trim();
  const status = (v.status ?? "").toLowerCase();
  for (const rule of RULES) {
    if (!rule.match.test(name)) continue;
    if (status === "pass" && rule.pass) return rule.pass;
    if (status === "fail" && rule.fail) return rule.fail;
    if (status === "warning" && (rule.warn ?? rule.fail)) return (rule.warn ?? rule.fail)!;
  }
  // Fall back to original detail if we have it
  const detail =
    v.result && typeof v.result === "object" && "detail" in (v.result as Record<string, unknown>)
      ? String((v.result as Record<string, unknown>).detail ?? "")
      : "";
  return detail || `${v.check_name ?? "Check"} — ${status || "no result"}`;
}

// Translate raw finding strings (from AI positive/negative lists) into
// plainer English by replacing known acronyms.
export function humaniseFinding(text: string): string {
  return text
    .replace(/\bSPF\b/g, "sender authentication")
    .replace(/\bDMARC\b/g, "anti-spoofing policy")
    .replace(/\bDKIM\b/g, "email signature")
    .replace(/\bWHOIS\b/gi, "domain registration lookup")
    .replace(/\bMX\b/g, "mail server")
    .replace(/\bTLD\b/g, "domain extension")
    .replace(/\bSSL\b/g, "secure connection")
    .replace(/\bDNS\b/g, "domain records");
}

// Pick the N most important negative findings and translate them.
export function topReasons(
  verifications: VerificationLike[],
  negativeFindings: string[] = [],
  limit = 3,
): string[] {
  const reasons: string[] = [];
  // 1. Prefer verifications that outright failed
  const fails = verifications.filter((v) => (v.status ?? "").toLowerCase() === "fail");
  for (const v of fails) {
    const s = humaniseVerification(v);
    if (s && !reasons.includes(s)) reasons.push(s);
    if (reasons.length >= limit) return reasons;
  }
  // 2. Then AI negative findings
  for (const raw of negativeFindings) {
    const s = humaniseFinding(raw);
    if (s && !reasons.includes(s)) reasons.push(s);
    if (reasons.length >= limit) return reasons;
  }
  // 3. Then warnings
  const warns = verifications.filter((v) => (v.status ?? "").toLowerCase() === "warning");
  for (const v of warns) {
    const s = humaniseVerification(v);
    if (s && !reasons.includes(s)) reasons.push(s);
    if (reasons.length >= limit) return reasons;
  }
  return reasons;
}
