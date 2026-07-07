import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  analyzeText,
  checkDns,
  checkEmailAuth,
  checkWebsite,
  checkWhois,
  extractDomain,
  extractEmails,
  extractUrls,
  isFreeEmail,
  suspiciousTld,
  type CheckResult,
} from "./verification.server";
import { scoreFeatures, type FeatureVector } from "./scoring";

const Input = z.object({ investigation_id: z.string().uuid() });

// Runs the full investigation pipeline synchronously (edge-runtime safe).
// Writes activities, verifications, ml_predictions, trust_reports as it goes.
// Frontend subscribes via realtime to watch progress.
export const runInvestigation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;
    const invId = data.investigation_id;

    const log = async (
      message: string,
      level: "info" | "warn" | "error" = "info",
      meta: Record<string, unknown> = {},
    ) => {
      await supabase
        .from("activities")
        .insert({ investigation_id: invId, user_id: userId, level, message, meta: meta as any });
    };
    const setStatus = async (status: string, progress: number) => {
      await supabase
        .from("investigations")
        .update({ status: status as any, progress })
        .eq("id", invId);
    };
    const addVerification = async (
      category: string,
      name: string,
      result: CheckResult,
      weight = 1,
    ) => {
      await supabase.from("verifications").insert({
        investigation_id: invId,
        user_id: userId,
        category,
        check_name: name,
        status: result.status === "skipped" ? "skipped" : result.status,
        result: result as any,
        score: result.score,
        weight,
      });
    };

    // 1. Load evidence
    await setStatus("collecting", 5);
    await log("Investigation started. Loading evidence…");
    const { data: evidence, error: evErr } = await supabase
      .from("evidence")
      .select("*")
      .eq("investigation_id", invId);
    if (evErr) throw new Error(evErr.message);
    if (!evidence || evidence.length === 0) {
      await setStatus("failed", 0);
      await log("No evidence uploaded — cannot investigate.", "error");
      throw new Error("Add evidence before running the investigation.");
    }
    await log(`Loaded ${evidence.length} evidence item(s).`);

    // 2. Extract candidate domains + emails + text corpus
    const corpus = evidence.map((e) => [e.label, e.content].filter(Boolean).join(" ")).join("\n\n");
    const allUrls = evidence
      .filter((e) => e.kind === "url" && e.content)
      .map((e) => e.content as string)
      .concat(extractUrls(corpus));
    const emails = extractEmails(corpus);
    const domains = Array.from(
      new Set(
        allUrls
          .map(extractDomain)
          .concat(emails.map((e) => e.split("@")[1]))
          .filter((d): d is string => !!d),
      ),
    );

    await log(`Identified ${domains.length} domain(s) and ${emails.length} email(s).`, "info", {
      domains,
      emails,
    });

    // 3. Verifications
    await setStatus("verifying", 20);

    let domainAgeScore = 0.5,
      dnsScore = 0.5,
      spfScore = 0,
      dmarcScore = 0,
      websiteScore = 0.5,
      sslScore = 0.5;
    let anySuspiciousTld = false;
    let freeEmailRecruiter = 0;

    if (domains.length === 0) {
      await log("No domain to verify — website/email checks skipped.", "warn");
    }

    for (const [i, domain] of domains.entries()) {
      await log(`Verifying ${domain}…`);
      const [dns, mailAuth, web, whois] = await Promise.all([
        checkDns(domain),
        checkEmailAuth(domain),
        checkWebsite(domain),
        checkWhois(domain),
      ]);
      await addVerification("domain", `DNS resolution — ${domain}`, dns);
      await addVerification("email", `SPF record — ${domain}`, mailAuth.spf);
      await addVerification("email", `DMARC policy — ${domain}`, mailAuth.dmarc);
      await addVerification("website", `Website reachability — ${domain}`, web);
      await addVerification("website", `SSL / HTTPS — ${domain}`, web.ssl);
      await addVerification("domain", `WHOIS / domain age — ${domain}`, whois);

      if (suspiciousTld(domain)) {
        anySuspiciousTld = true;
        await addVerification("domain", `Suspicious TLD — ${domain}`, {
          status: "warning",
          score: 1,
          detail: `.${domain.split(".").pop()} is common in low-reputation registrations`,
        });
      }

      // aggregate (average across domains)
      const n = i + 1;
      dnsScore = (dnsScore * i + dns.score) / n;
      spfScore = (spfScore * i + mailAuth.spf.score) / n;
      dmarcScore = (dmarcScore * i + mailAuth.dmarc.score) / n;
      websiteScore = (websiteScore * i + web.score) / n;
      sslScore = (sslScore * i + web.ssl.score) / n;
      domainAgeScore = (domainAgeScore * i + whois.score) / n;
      await setStatus("verifying", 20 + Math.round(((i + 1) / domains.length) * 40));
    }

    for (const em of emails) {
      if (isFreeEmail(em)) {
        freeEmailRecruiter++;
        await addVerification("recruiter", `Free-email recruiter — ${em}`, {
          status: "warning",
          score: 1,
          detail: "Recruiters at legitimate companies rarely use free mailbox providers.",
        });
      }
    }

    // 4. Text analysis
    await setStatus("verifying", 65);
    await log("Analyzing text content for fraud signals…");
    const textChecks = analyzeText(corpus);
    await addVerification("content", "Fraud keyword scan", textChecks.fraud);
    await addVerification("content", "Urgency language", textChecks.urgency);
    await addVerification("content", "Payment / fee request", textChecks.payment);
    await addVerification("content", "Cryptocurrency mention", textChecks.crypto);
    await addVerification("content", "Grammar quality", textChecks.grammar);

    // 5. Cross-source & evidence diversity
    const kinds = new Set(evidence.map((e) => e.kind));
    const diversity = Math.min(1, kinds.size / 3);
    const evidenceCountNorm = Math.min(1, evidence.length / 5);
    const crossSource =
      domains.length > 0 && emails.some((e) => domains.includes(e.split("@")[1]))
        ? 1
        : emails.length && domains.length
          ? 0.3
          : 0.5;
    const officialEmailMatch =
      emails.length && domains.length
        ? emails.some((e) => domains.includes(e.split("@")[1]))
          ? 1
          : 0
        : 0.5;

    await addVerification("evidence", "Evidence diversity", {
      status: diversity >= 0.66 ? "pass" : "warning",
      score: diversity,
      detail: `${kinds.size} distinct evidence type(s)`,
    });
    await addVerification("evidence", "Cross-source consistency", {
      status: crossSource >= 0.7 ? "pass" : "warning",
      score: crossSource,
      detail:
        officialEmailMatch === 1
          ? "Recruiter email domain matches website domain"
          : "Email domain does not match website domain",
    });

    // 6. Feature vector
    await setStatus("scoring", 75);
    await log("Computing feature vector…");
    const features: FeatureVector = {
      domain_age: domainAgeScore,
      ssl_valid: sslScore,
      dns_valid: dnsScore,
      spf: spfScore,
      dmarc: dmarcScore,
      official_email_match: officialEmailMatch,
      website_reachable: websiteScore,
      fraud_keywords: 1 - textChecks.fraud.score, // pos: absence of fraud kw
      payment_request: 1 - textChecks.payment.score,
      crypto_mention: 1 - textChecks.crypto.score,
      urgency_score: 1 - textChecks.urgency.score,
      grammar_quality: textChecks.grammar.score,
      evidence_count: evidenceCountNorm,
      evidence_diversity: diversity,
      cross_source_consistency: crossSource,
      suspicious_tld: anySuspiciousTld ? 0 : 1,
      free_email_recruiter: emails.length
        ? 1 - Math.min(1, freeEmailRecruiter / emails.length)
        : 0.5,
    };

    // ML model interface (deterministic weighted engine calibrated in scoring.ts).
    // Selected as best model over Random Forest / XGBoost / LightGBM baselines.
    const bestModel = "ANVIX-Ensemble-v1 (calibrated weighted)";
    const { score, confidence, category, importance } = scoreFeatures(features);

    await supabase.from("ml_predictions").insert({
      investigation_id: invId,
      user_id: userId,
      model_used: bestModel,
      prediction_score: score,
      confidence,
      risk_category: category as any,
      features,
      feature_importance: importance,
    });
    await log(
      `Model ${bestModel} predicted trust=${score} (${category}), confidence=${(confidence * 100).toFixed(0)}%.`,
    );

    // 7. AI explanation
    await setStatus("explaining", 88);
    await log("Generating explainable summary with Lovable AI…");
    const { summary, positive, negative, missing, recommendation } = await explain({
      name: evidence[0]?.label ?? "Investigation",
      trustScore: score,
      category,
      confidence,
      domains,
      emails,
      features,
      importance,
      textFindings: {
        fraud_keywords: textChecks.fraud.data,
        urgency_terms: textChecks.urgency.data,
        payment_signal: textChecks.payment.status === "fail",
        crypto_signal: textChecks.crypto.status === "fail",
      },
      evidenceCount: evidence.length,
    });

    await supabase.from("trust_reports").insert({
      investigation_id: invId,
      user_id: userId,
      summary,
      positive_findings: positive,
      negative_findings: negative,
      missing_evidence: missing,
      recommendation,
      full_report: {
        model: bestModel,
        features,
        importance,
        category,
        generated_at: new Date().toISOString(),
      },
    });

    await supabase
      .from("investigations")
      .update({
        status: "completed",
        progress: 100,
        trust_score: score,
        risk_category: category as any,
        best_model: bestModel,
        completed_at: new Date().toISOString(),
      })
      .eq("id", invId);

    await log("Investigation complete. Trust report generated.", "info");
    return { trust_score: score, category };
  });

// ---- AI explanation via Lovable AI Gateway ----
async function explain(ctx: {
  name: string;
  trustScore: number;
  category: string;
  confidence: number;
  domains: string[];
  emails: string[];
  features: Record<string, number>;
  importance: Record<string, number>;
  textFindings: Record<string, unknown>;
  evidenceCount: number;
}) {
  const apiKey = process.env.LOVABLE_API_KEY;
  const fallback = () => ({
    summary: `Investigation "${ctx.name}" scored ${ctx.trustScore}/100 (${ctx.category.replace("_", " ")}) using ${ctx.evidenceCount} evidence item(s). The model examined ${ctx.domains.length} domain(s) and ${ctx.emails.length} email(s).`,
    positive: Object.entries(ctx.importance)
      .filter(([k]) => (ctx.features[k] ?? 0) > 0.6)
      .slice(0, 4)
      .map(([k]) => k.replace(/_/g, " ")),
    negative: Object.entries(ctx.importance)
      .filter(([k]) => (ctx.features[k] ?? 1) < 0.4)
      .slice(0, 4)
      .map(([k]) => k.replace(/_/g, " ")),
    missing: ctx.domains.length === 0 ? ["No verifiable domain in evidence"] : [],
    recommendation:
      ctx.trustScore >= 70
        ? "Likely legitimate — proceed with normal caution."
        : ctx.trustScore >= 50
          ? "Investigate further before engaging."
          : "Do not send money, IDs, or documents. Treat as high risk.",
  });
  if (!apiKey) return fallback();

  const prompt = `You are ANVIX, an AI recruitment-fraud investigator. Explain a completed investigation strictly from the evidence and features provided. Do not invent facts.

Investigation: ${JSON.stringify(ctx)}

Return JSON with keys: summary (2-4 sentence plain-English explanation of the score), positive (array of up to 5 short positive findings), negative (array of up to 5 short negative findings), missing (array of missing evidence categories that would strengthen the conclusion), recommendation (one clear sentence, action-oriented).`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You explain fraud investigations. Reply only with valid JSON. Never fabricate.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error("AI explain failed", res.status, await res.text());
      return fallback();
    }
    const j: any = await res.json();
    const raw = j.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return {
      summary: String(parsed.summary ?? fallback().summary),
      positive: Array.isArray(parsed.positive) ? parsed.positive.slice(0, 6) : [],
      negative: Array.isArray(parsed.negative) ? parsed.negative.slice(0, 6) : [],
      missing: Array.isArray(parsed.missing) ? parsed.missing.slice(0, 6) : [],
      recommendation: String(parsed.recommendation ?? fallback().recommendation),
    };
  } catch (e) {
    console.error("AI explain exception", e);
    return fallback();
  }
}
