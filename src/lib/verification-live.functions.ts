// ANVIX Live Verification — independent, real-world checks that answer
// "does this recruiter and this company actually exist?".
//
// All calls are made server-side to keep API responses uncached in the
// browser and to avoid CORS. Every check is best-effort — a network
// failure never blocks the investigation; it degrades to `status: "skipped"`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callJSON } from "./ai-gateway.server";

export type LiveCheck = {
  name: string;
  status: "pass" | "fail" | "warning" | "skipped";
  detail: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
};

const Input = z.object({
  companies: z.array(z.string()).default([]),
  recruiter_names: z.array(z.string()).default([]),
  role: z.string().default(""),
  location: z.string().default(""),
  salary_text: z.string().default(""),
});

/** ---------- OpenCorporates: is the company registered anywhere? ---------- */
async function openCorporatesLookup(name: string): Promise<LiveCheck> {
  try {
    const q = encodeURIComponent(name);
    const res = await fetch(
      `https://api.opencorporates.com/v0.4/companies/search?q=${q}&per_page=3`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) {
      return {
        name: `Company registry — ${name}`,
        status: "skipped",
        detail: `OpenCorporates responded ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      results?: { companies?: Array<{ company: { name: string; jurisdiction_code: string; company_number: string; incorporation_date?: string; current_status?: string } }> };
    };
    const hits = json.results?.companies ?? [];
    if (hits.length === 0) {
      return {
        name: `Company registry — ${name}`,
        status: "fail",
        detail: `No company named "${name}" found on OpenCorporates (any jurisdiction).`,
      };
    }
    const top = hits[0].company;
    return {
      name: `Company registry — ${name}`,
      status: "pass",
      detail: `Registered in ${top.jurisdiction_code.toUpperCase()} as ${top.name} (${top.company_number})${top.incorporation_date ? ` since ${top.incorporation_date}` : ""}${top.current_status ? ` — ${top.current_status}` : ""}.`,
      data: hits.slice(0, 3).map((h) => h.company),
    };
  } catch (e) {
    return {
      name: `Company registry — ${name}`,
      status: "skipped",
      detail: `OpenCorporates lookup failed (${(e as Error).message}).`,
    };
  }
}

/** ---------- LinkedIn presence check via public search HTML ---------- */
async function linkedinPresence(name: string, company: string): Promise<LiveCheck> {
  const label = `LinkedIn presence — ${name}${company ? ` @ ${company}` : ""}`;
  try {
    const q = encodeURIComponent(`site:linkedin.com/in "${name}" "${company}"`);
    const res = await fetch(`https://duckduckgo.com/html/?q=${q}`, {
      headers: { "User-Agent": "Mozilla/5.0 ANVIX/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { name: label, status: "skipped", detail: `Search responded ${res.status}` };
    const html = await res.text();
    const matches = (html.match(/linkedin\.com\/in\/[a-z0-9\-_%]+/gi) ?? []).slice(0, 3);
    if (matches.length === 0) {
      return {
        name: label,
        status: "fail",
        detail: `No LinkedIn profile matches "${name}" at "${company}". Legitimate recruiters have public profiles.`,
      };
    }
    return {
      name: label,
      status: "pass",
      detail: `Found ${matches.length} LinkedIn profile hit(s) for this name+company.`,
      data: Array.from(new Set(matches)),
    };
  } catch (e) {
    return { name: label, status: "skipped", detail: `Search failed (${(e as Error).message}).` };
  }
}

/** ---------- Salary plausibility via Gemini structured output ---------- */
async function salaryPlausibility(role: string, location: string, salaryText: string): Promise<LiveCheck> {
  if (!salaryText.trim() || !role.trim()) {
    return { name: "Salary plausibility", status: "skipped", detail: "No salary or role provided." };
  }
  try {
    const schemaHint = {
      market_min: 0,
      market_max: 0,
      offered_estimate: 0,
      currency: "USD",
      verdict: "within_band",
      note: "one-line reason",
    };
    const out = await callJSON<{
      market_min: number;
      market_max: number;
      offered_estimate: number;
      currency: string;
      verdict: "within_band" | "high" | "very_high" | "low";
      note: string;
    }>({
      messages: [
        {
          role: "system",
          content:
            "You are a compensation analyst. Given a role, location and offered-salary text, estimate the market band and classify the offer. Reply with a single JSON object matching this shape: " +
            JSON.stringify(schemaHint),
        },
        { role: "user", content: JSON.stringify({ role, location, salary_text: salaryText }) },
      ],
      temperature: 0.2,
    });
    const status: LiveCheck["status"] =
      out.verdict === "within_band"
        ? "pass"
        : out.verdict === "very_high"
          ? "fail"
          : "warning";
    return {
      name: "Salary plausibility",
      status,
      detail: `Offered ~${out.offered_estimate.toLocaleString()} ${out.currency}; market band ${out.market_min.toLocaleString()}–${out.market_max.toLocaleString()} ${out.currency}. ${out.note}`,
      data: out,
    };
  } catch (e) {
    return {
      name: "Salary plausibility",
      status: "skipped",
      detail: `AI plausibility check failed (${(e as Error).message}).`,
    };
  }
}

export type LiveVerificationResult = {
  checks: LiveCheck[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
};

export type LiveVerificationInput = z.infer<typeof Input>;

export async function runLiveVerificationCore(
  data: LiveVerificationInput,
): Promise<LiveVerificationResult> {
  const uniqCompanies = Array.from(new Set(data.companies.map((c) => c.trim()).filter(Boolean))).slice(0, 3);
  const uniqPeople = Array.from(new Set(data.recruiter_names.map((c) => c.trim()).filter(Boolean))).slice(0, 3);

  const jobs: Array<Promise<LiveCheck>> = [];
  for (const c of uniqCompanies) jobs.push(openCorporatesLookup(c));
  for (const name of uniqPeople) {
    const company = uniqCompanies[0] ?? "";
    jobs.push(linkedinPresence(name, company));
  }
  jobs.push(salaryPlausibility(data.role, data.location, data.salary_text));

  const checks = await Promise.all(jobs);
  const summary = { passed: 0, failed: 0, warnings: 0, skipped: 0 };
  for (const c of checks) {
    if (c.status === "pass") summary.passed++;
    else if (c.status === "fail") summary.failed++;
    else if (c.status === "warning") summary.warnings++;
    else summary.skipped++;
  }
  return { checks, summary };
}

export const runLiveVerification = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => runLiveVerificationCore(data));
