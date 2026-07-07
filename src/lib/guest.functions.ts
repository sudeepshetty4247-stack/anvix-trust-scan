// Public (unauthenticated) server function. Runs the full verification +
// Kaggle-LR scoring pipeline in-memory. Never touches the DB.
// Called from /investigate. Guest results live in localStorage only.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  analyzeText,
  checkDns,
  checkEmailAuth,
  checkWebsite,
  checkWhois,
  extractDomain,
  isFreeEmail,
  suspiciousTld,
  type CheckResult,
} from "./verification.server";
import {
  predictFraudProbability,
  predictEnsemble,
  featureContributions,
  KAGGLE_MODEL,
  type KaggleFeatures,
} from "./kaggle-model";
import { scoreFeatures, type RiskCategory } from "./scoring";

const EvidenceItem = z.object({
  kind: z.string(),
  filename: z.string().default(""),
  extracted_text: z.string().default(""),
  channel: z.string().default("unknown"),
  urls: z.array(z.string()).default([]),
  emails: z.array(z.string()).default([]),
  phones: z.array(z.string()).default([]),
  people: z.array(z.string()).default([]),
  companies: z.array(z.string()).default([]),
  amounts: z.array(z.string()).default([]),
  payment_methods: z.array(z.string()).default([]),
  red_flag_notes: z.array(z.string()).default([]),
});

const Input = z.object({
  name: z.string().trim().min(1).max(200),
  urls: z.array(z.string().trim()).max(20).default([]),
  emails: z.array(z.string().trim()).max(20).default([]),
  text: z.string().max(20000).default(""),
  evidence: z.array(EvidenceItem).max(20).default([]),
});

export type GuestVerification = {
  category: string;
  check_name: string;
  status: string;
  score: number | null;
  detail: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
};

export type GuestResult = {
  trust_score: number;
  risk_category: RiskCategory;
  confidence: number;
  model_used: string;
  fraud_probability: number;
  ensemble_breakdown: { lr: number; gbm: number; ensemble: number; threshold: number };
  kaggle_features: KaggleFeatures;
  kaggle_contributions: Record<string, number>;
  weighted_features: Record<string, number>;
  weighted_score: number;
  verifications: GuestVerification[];
  domains: string[];
  emails: string[];
  phones: string[];
  companies: string[];
  payment_methods: string[];
  summary: string;
  positive_findings: string[];
  negative_findings: string[];
  missing_evidence: string[];
  recommendation: string;
  verifications_summary: string;
  model_metadata: {
    trained_on: string;
    n_rows: number;
    n_fraud: number;
    best_model: string;
    metrics: typeof KAGGLE_MODEL.metrics;
  };
};

const FREE_EMAIL_DOMS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
  "live.com",
  "mail.com",
]);
const SUS_TLDS = [
  ".xyz",
  ".top",
  ".click",
  ".loan",
  ".work",
  ".zip",
  ".mov",
  ".country",
  ".stream",
  ".gq",
  ".ml",
  ".cf",
  ".tk",
];

export const runGuestInvestigation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    // Aggregate all inputs — free-typed and extracted-from-evidence
    const aggregatedUrls = Array.from(
      new Set(
        [...data.urls, ...data.evidence.flatMap((e) => e.urls)]
          .map((u) => u.trim())
          .filter(Boolean),
      ),
    );
    const aggregatedEmails = Array.from(
      new Set(
        [...data.emails, ...data.evidence.flatMap((e) => e.emails)]
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    const aggregatedText = [data.text, ...data.evidence.map((e) => e.extracted_text)]
      .filter(Boolean)
      .join("\n\n");
    const aggregatedPhones = Array.from(new Set(data.evidence.flatMap((e) => e.phones)));
    const aggregatedCompanies = Array.from(new Set(data.evidence.flatMap((e) => e.companies)));
    const aggregatedPayments = Array.from(new Set(data.evidence.flatMap((e) => e.payment_methods)));

    const corpus = [data.name, aggregatedText, ...aggregatedUrls, ...aggregatedEmails].join("\n");
    const domains = Array.from(
      new Set([
        ...aggregatedUrls.map(extractDomain).filter((d): d is string => !!d),
        ...aggregatedEmails
          .map((e) => e.split("@")[1]?.toLowerCase())
          .filter((d): d is string => !!d),
      ]),
    );

    const verifications: GuestVerification[] = [];
    const push = (category: string, name: string, r: CheckResult) => {
      verifications.push({
        category,
        check_name: name,
        status: r.status,
        score: r.score,
        detail: r.detail,
        data: r.data,
      });
    };

    // -- Domain / email / website checks --
    let dnsScore = 0.5,
      spf = 0,
      dmarc = 0,
      web = 0.5,
      ssl = 0.5,
      age = 0.5;
    let anySusTld = false;
    for (const [i, domain] of domains.entries()) {
      const [d, ma, w, wh] = await Promise.all([
        checkDns(domain),
        checkEmailAuth(domain),
        checkWebsite(domain),
        checkWhois(domain),
      ]);
      push("domain", `DNS resolution — ${domain}`, d);
      push("email", `SPF record — ${domain}`, ma.spf);
      push("email", `DMARC policy — ${domain}`, ma.dmarc);
      push("website", `Website reachability — ${domain}`, w);
      push("website", `SSL / HTTPS — ${domain}`, w.ssl);
      push("domain", `WHOIS / domain age — ${domain}`, wh);
      if (suspiciousTld(domain)) {
        anySusTld = true;
        push("domain", `Suspicious TLD — ${domain}`, {
          status: "warning",
          score: 1,
          detail: `.${domain.split(".").pop()} is common in low-reputation registrations`,
        });
      }
      const n = i + 1;
      dnsScore = (dnsScore * i + d.score) / n;
      spf = (spf * i + ma.spf.score) / n;
      dmarc = (dmarc * i + ma.dmarc.score) / n;
      web = (web * i + w.score) / n;
      ssl = (ssl * i + w.ssl.score) / n;
      age = (age * i + wh.score) / n;
    }

    // -- Free-email recruiter --
    let freeEmailCount = 0;
    for (const em of aggregatedEmails) {
      if (isFreeEmail(em)) {
        freeEmailCount++;
        push("recruiter", `Free-email recruiter — ${em}`, {
          status: "warning",
          score: 1,
          detail: "Legitimate recruiters rarely use free mailbox providers.",
        });
      }
    }

    // -- Text analysis --
    const tx = analyzeText(corpus);
    push("content", "Fraud keyword scan", tx.fraud);
    push("content", "Urgency language", tx.urgency);
    push("content", "Payment / fee request", tx.payment);
    push("content", "Cryptocurrency mention", tx.crypto);
    push("content", "Grammar quality", tx.grammar);

    // -- Evidence-derived signals --
    const suspiciousPayments = aggregatedPayments.filter((p) =>
      /crypto|usdt|bitcoin|btc|gift card|western union|moneygram|upi|personal bank/i.test(p),
    );
    if (suspiciousPayments.length > 0) {
      push("payment", `Suspicious payment method(s)`, {
        status: "fail",
        score: 1,
        detail: `Evidence mentions: ${suspiciousPayments.join(", ")}`,
      });
    }
    for (const ev of data.evidence) {
      for (const note of ev.red_flag_notes.slice(0, 2)) {
        push("evidence", `Observation — ${ev.kind}${ev.filename ? ` (${ev.filename})` : ""}`, {
          status: "warning",
          score: 1,
          detail: note,
        });
      }
    }

    // -- Cross-source --
    const officialMatch =
      aggregatedEmails.length && domains.length
        ? aggregatedEmails.some((e) => domains.includes(e.split("@")[1]?.toLowerCase() ?? ""))
          ? 1
          : 0
        : 0.5;
    push("evidence", "Cross-source consistency", {
      status: officialMatch === 1 ? "pass" : "warning",
      score: officialMatch,
      detail:
        officialMatch === 1
          ? "Recruiter email domain matches website domain"
          : "Email domain does not match website domain",
    });

    // -- Kaggle-LR features --
    const kf: KaggleFeatures = {
      fraud_keywords_norm: Math.min(1, ((tx.fraud.data as string[] | undefined)?.length ?? 0) / 5),
      urgency_norm: Math.min(1, ((tx.urgency.data as string[] | undefined)?.length ?? 0) / 3),
      payment_norm: tx.payment.status === "fail" || suspiciousPayments.length > 0 ? 1 : 0,
      crypto_norm: tx.crypto.status === "fail" ? 1 : 0,
      grammar_quality: tx.grammar.score,
      has_url: aggregatedUrls.length > 0 ? 1 : 0,
      has_email: aggregatedEmails.length > 0 ? 1 : 0,
      free_email_present: aggregatedEmails.some((e) => FREE_EMAIL_DOMS.has(e.split("@")[1] ?? ""))
        ? 1
        : 0,
      sus_tld_present: anySusTld || SUS_TLDS.some((t) => corpus.toLowerCase().includes(t)) ? 1 : 0,
      has_company_logo: 0,
      has_questions: 0,
      telecommuting: /remote|work.from.home|telecommut/i.test(corpus) ? 1 : 0,
      has_company_profile: domains.length > 0 && web > 0.5 ? 1 : 0,
      has_requirements: /require|requirement|qualification|must have/i.test(corpus) ? 1 : 0,
      has_benefits: /benefit|salary|compensation|bonus|perk/i.test(corpus) ? 1 : 0,
      desc_len_norm: Math.min(1, corpus.trim().split(/\s+/).length / 500),
      employment_specified: /full.?time|part.?time|contract|internship|freelance/i.test(corpus)
        ? 1
        : 0,
      salary_missing: /\b(salary|compensation|pay|ctc|package|per\s*(year|month|annum))\b/i.test(corpus) ? 0 : 1,
      location_missing: /\b(remote|onsite|hybrid|bengaluru|bangalore|mumbai|delhi|chennai|london|new\s*york|san\s*francisco|city|address|location)\b/i.test(corpus) ? 0 : 1,
      title_shouty: (() => {
        const name = data.name ?? "";
        const upper = [...name].filter((c) => c >= "A" && c <= "Z").length;
        return name.length > 4 && upper / name.length > 0.6 ? 1 : 0;
      })(),
      url_count_norm: Math.min(aggregatedUrls.length, 5) / 5,
    };
    // (predictFraudProbability is exported for tests / report — Ensemble covers scoring below.)
    const ens = predictEnsemble(kf);
    const kaggleContribs = featureContributions(kf);

    // -- Weighted-baseline for comparison + explainability --
    const wf = {
      domain_age: age,
      ssl_valid: ssl,
      dns_valid: dnsScore,
      spf,
      dmarc,
      official_email_match: officialMatch,
      website_reachable: web,
      fraud_keywords: 1 - tx.fraud.score,
      payment_request: tx.payment.status === "fail" || suspiciousPayments.length > 0 ? 0 : 1,
      crypto_mention: 1 - tx.crypto.score,
      urgency_score: 1 - tx.urgency.score,
      grammar_quality: tx.grammar.score,
      evidence_count: Math.min(
        1,
        (aggregatedUrls.length +
          aggregatedEmails.length +
          data.evidence.length +
          (data.text ? 1 : 0)) /
          5,
      ),
      evidence_diversity: Math.min(
        1,
        (Number(aggregatedUrls.length > 0) +
          Number(aggregatedEmails.length > 0) +
          Number(!!data.text) +
          Number(data.evidence.length > 0)) /
          4,
      ),
      cross_source_consistency: officialMatch,
      suspicious_tld: anySusTld ? 0 : 1,
      free_email_recruiter: aggregatedEmails.length
        ? 1 - Math.min(1, freeEmailCount / aggregatedEmails.length)
        : 0.5,
    };
    const weighted = scoreFeatures(wf);

    // -- Final score: blend Kaggle Ensemble (LR+GBM) probability (65%) with weighted baseline (35%) --
    const trust_from_ml = Math.round((1 - ens.ensemble) * 100);
    const trust = Math.round(trust_from_ml * 0.65 + weighted.score * 0.35);
    const category: RiskCategory =
      trust >= 85
        ? "trusted"
        : trust >= 70
          ? "likely_safe"
          : trust >= 50
            ? "caution"
            : trust >= 30
              ? "high_risk"
              : "fraudulent";

    // -- Explainability text --
    const negatives: string[] = [];
    const positives: string[] = [];
    const missing: string[] = [];
    if (tx.fraud.status === "fail")
      negatives.push(
        `Fraud keywords detected: ${((tx.fraud.data as string[]) ?? []).slice(0, 3).join(", ")}`,
      );
    if (tx.payment.status === "fail")
      negatives.push("Text asks the candidate for money — classic fraud signal.");
    if (suspiciousPayments.length > 0)
      negatives.push(`Suspicious payment methods present: ${suspiciousPayments.join(", ")}`);
    if (tx.crypto.status === "fail")
      negatives.push("Cryptocurrency mentioned in a recruitment context.");
    if (tx.urgency.status === "warning")
      negatives.push("Multiple urgency terms — pressure tactic.");
    if (anySusTld) negatives.push("Domain uses a TLD frequent in scam registrations.");
    if (kf.free_email_present) negatives.push("Recruiter uses a free-mail provider.");
    if (age > 0.7) positives.push("Domain is well-established (aged).");
    if (ssl > 0.7) positives.push("Valid SSL / HTTPS.");
    if (dnsScore > 0.7) positives.push("Full DNS + MX records present.");
    if (spf > 0.5) positives.push("SPF configured.");
    if (dmarc > 0.5) positives.push("DMARC policy present.");
    if (officialMatch === 1) positives.push("Recruiter email domain matches company website.");
    if (domains.length === 0) missing.push("No verifiable website / company domain in evidence.");
    if (aggregatedEmails.length === 0) missing.push("No recruiter email in evidence.");
    if (aggregatedText.length < 200)
      missing.push("Longer job description / message would improve model confidence.");
    if (data.evidence.length === 0)
      missing.push(
        "Add a screenshot, offer letter, or forwarded email to strengthen the investigation.",
      );

    const recommendation =
      trust >= 70
        ? "Likely legitimate — proceed with normal caution. Verify identity via a video call on the company's official platform."
        : trust >= 50
          ? "Caution: some signals are weak. Confirm the recruiter through LinkedIn and the company's official careers page before sharing personal data."
          : trust >= 30
            ? "High risk. Do not send ID, bank details, or payments. Independently verify via the company's public HR contact."
            : "Likely fraud. Cease contact, do not send documents or money, and report to the platform where you found it.";

    const summary = `ANVIX analyzed "${data.name}" using the Kaggle-Ensemble-v2 model (Logistic Regression + Gradient Boosting, trained on ${KAGGLE_MODEL.n_rows.toLocaleString()} labeled job postings) plus a rule-weighted verification engine. The blended trust score is ${trust}/100 (${category.replace("_", " ")}). Ensemble P(fraud) = ${(ens.ensemble * 100).toFixed(1)}% (LR ${(ens.lr * 100).toFixed(1)}%, GBM ${(ens.gbm * 100).toFixed(1)}%) across ${KAGGLE_MODEL.feature_names.length} engineered features; the verification engine ran ${verifications.length} live checks against ${domains.length} domain(s) and ${aggregatedEmails.length} email(s).`;

    const verifications_summary =
      verifications
        .filter((v) => v.status === "fail" || v.status === "warning")
        .slice(0, 6)
        .map((v) => `${v.status.toUpperCase()}: ${v.check_name} — ${v.detail}`)
        .join(" | ") || "All checks passed.";

    const result: GuestResult = {
      trust_score: trust,
      risk_category: category,
      confidence: weighted.confidence,
      model_used: `ANVIX-Blend-v2 (Kaggle-Ensemble LR+GBM 65% + Weighted-Baseline 35%)`,
      fraud_probability: Math.round(ens.ensemble * 10000) / 10000,
      ensemble_breakdown: {
        lr: Math.round(ens.lr * 10000) / 10000,
        gbm: Math.round(ens.gbm * 10000) / 10000,
        ensemble: Math.round(ens.ensemble * 10000) / 10000,
        threshold: ens.threshold,
      },
      kaggle_features: kf,
      kaggle_contributions: Object.fromEntries(
        Object.entries(kaggleContribs).map(([k, v]) => [k, Math.round(v * 1000) / 1000]),
      ),
      weighted_features: wf,
      weighted_score: weighted.score,
      verifications,
      domains,
      emails: aggregatedEmails,
      phones: aggregatedPhones,
      companies: aggregatedCompanies,
      payment_methods: aggregatedPayments,
      summary,
      positive_findings: positives,
      negative_findings: negatives,
      missing_evidence: missing,
      recommendation,
      verifications_summary,
      model_metadata: {
        trained_on: KAGGLE_MODEL.trained_on,
        n_rows: KAGGLE_MODEL.n_rows,
        n_fraud: KAGGLE_MODEL.n_fraud,
        best_model: KAGGLE_MODEL.best_model_name,
        metrics: KAGGLE_MODEL.metrics,
      },
    };
    return result;
  });
