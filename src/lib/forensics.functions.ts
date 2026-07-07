// Track 2 — Recruiter Identity Graph + Offer Letter Forensics.
// Server-only. All heavy analysis runs through Gemini 2.5 Flash for
// reasoning, plus deterministic parsing via pdf-lib for PDF metadata.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { callJSON } from "./ai-gateway.server";

// ---------- Types ----------

export type GraphNode = {
  id: string; // stable key
  kind: "person" | "email" | "phone" | "company" | "domain" | "url" | "payment";
  label: string;
  evidence_refs: number[]; // which evidence items surfaced this node
};

export type GraphEdge = {
  from: string;
  to: string;
  relation: string;
  weight: number; // 0..1
  suspicious: boolean;
  note?: string;
};

export type IdentityFinding = {
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  cited_evidence: number[];
};

export type IdentityGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  findings: IdentityFinding[];
  summary: string;
};

export type OfferForensics = {
  is_offer_letter: boolean;
  filename: string;
  pdf_metadata: {
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    creation_date?: string;
    modification_date?: string;
    page_count?: number;
    tampered_signals: string[]; // e.g. "mod date > creation date by 3y"
  };
  letterhead: {
    claimed_company?: string;
    signatory_name?: string;
    signatory_title?: string;
    logo_present: boolean;
  };
  compensation: {
    stated_amount?: string;
    currency?: string;
    period?: string; // annual / monthly
    market_band?: string; // LLM plausibility band
    salary_plausibility: "typical" | "high" | "extreme_outlier" | "below_market" | "unknown";
  };
  payment_red_flags: string[]; // "personal bank account listed", "USDT wallet", "training fee ..."
  template_reuse_score: number; // 0..1, LLM-estimated similarity to known scam templates
  template_reuse_notes: string;
  findings: IdentityFinding[];
  overall_verdict: "likely_authentic" | "suspicious" | "high_risk" | "unknown";
};

// ---------- Identity Graph ----------

const IdentityInput = z.object({
  evidence: z
    .array(
      z.object({
        kind: z.string(),
        filename: z.string().default(""),
        extracted_text: z.string().default(""),
        channel: z.string().default("unknown"),
        urls: z.array(z.string()).default([]),
        emails: z.array(z.string()).default([]),
        phones: z.array(z.string()).default([]),
        people: z.array(z.string()).default([]),
        companies: z.array(z.string()).default([]),
        payment_methods: z.array(z.string()).default([]),
        red_flag_notes: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const normPhone = (s: string) => s.replace(/[^\d+]/g, "");

export const analyzeIdentityGraph = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => IdentityInput.parse(d))
  .handler(async ({ data }): Promise<IdentityGraph> => {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const addNode = (n: GraphNode) => {
      const cur = nodes.get(n.id);
      if (cur) {
        cur.evidence_refs = Array.from(new Set([...cur.evidence_refs, ...n.evidence_refs]));
      } else {
        nodes.set(n.id, n);
      }
    };
    const addEdge = (e: GraphEdge) => edges.push(e);

    data.evidence.forEach((ev, i) => {
      const evRef = i + 1;
      const personIds: string[] = [];
      const emailIds: string[] = [];
      const phoneIds: string[] = [];
      const companyIds: string[] = [];
      const domainIds: string[] = [];

      ev.people.forEach((p) => {
        const id = `person:${norm(p)}`;
        addNode({ id, kind: "person", label: p, evidence_refs: [evRef] });
        personIds.push(id);
      });
      ev.emails.forEach((e) => {
        const em = norm(e);
        const id = `email:${em}`;
        addNode({ id, kind: "email", label: em, evidence_refs: [evRef] });
        emailIds.push(id);
        const dom = em.split("@")[1];
        if (dom) {
          const did = `domain:${dom}`;
          addNode({ id: did, kind: "domain", label: dom, evidence_refs: [evRef] });
          domainIds.push(did);
          addEdge({ from: id, to: did, relation: "hosted-on", weight: 1, suspicious: false });
        }
      });
      ev.phones.forEach((p) => {
        const np = normPhone(p);
        if (!np) return;
        const id = `phone:${np}`;
        addNode({ id, kind: "phone", label: p, evidence_refs: [evRef] });
        phoneIds.push(id);
      });
      ev.companies.forEach((c) => {
        const id = `company:${norm(c)}`;
        addNode({ id, kind: "company", label: c, evidence_refs: [evRef] });
        companyIds.push(id);
      });
      ev.payment_methods.forEach((pm) => {
        const id = `payment:${norm(pm)}`;
        addNode({ id, kind: "payment", label: pm, evidence_refs: [evRef] });
        personIds.forEach((pid) =>
          addEdge({
            from: pid,
            to: id,
            relation: "requested",
            weight: 1,
            suspicious: /crypto|usdt|btc|gift|western|moneygram|upi|personal/i.test(pm),
            note: "payment method requested by this identity",
          }),
        );
      });

      // Bind person ↔ email ↔ phone ↔ company within one evidence item
      personIds.forEach((pid) => {
        emailIds.forEach((eid) =>
          addEdge({ from: pid, to: eid, relation: "uses", weight: 0.9, suspicious: false }),
        );
        phoneIds.forEach((phid) =>
          addEdge({ from: pid, to: phid, relation: "uses", weight: 0.9, suspicious: false }),
        );
        companyIds.forEach((cid) =>
          addEdge({ from: pid, to: cid, relation: "claims-affiliation", weight: 0.7, suspicious: false }),
        );
      });
    });

    // ---- Deterministic cross-evidence findings ----
    const findings: IdentityFinding[] = [];

    const groupByNode = (kind: GraphNode["kind"]) => {
      const map = new Map<string, GraphNode>();
      nodes.forEach((n) => {
        if (n.kind === kind) map.set(n.id, n);
      });
      return map;
    };

    // 1) Same phone / email across multiple evidence items with DIFFERENT person names → alias.
    const emails = groupByNode("email");
    const phones = groupByNode("phone");
    const persons = groupByNode("person");
    const linksPerNode = new Map<string, Set<string>>();
    edges.forEach((e) => {
      if (e.relation !== "uses") return;
      const s = linksPerNode.get(e.to) ?? new Set<string>();
      s.add(e.from);
      linksPerNode.set(e.to, s);
    });
    linksPerNode.forEach((personSet, contactId) => {
      if (personSet.size >= 2) {
        const names = Array.from(personSet)
          .map((pid) => persons.get(pid)?.label)
          .filter(Boolean) as string[];
        const contact = emails.get(contactId) ?? phones.get(contactId);
        if (contact) {
          findings.push({
            severity: "critical",
            title: "One contact, multiple names",
            detail: `${contact.label} is used by ${names.length} different names (${names.join(", ")}). Classic alias / persona-swapping pattern.`,
            cited_evidence: contact.evidence_refs,
          });
          // Mark edges suspicious
          edges
            .filter((e) => e.to === contactId && e.relation === "uses")
            .forEach((e) => (e.suspicious = true));
        }
      }
    });

    // 2) Email domain ≠ claimed company domain heuristic
    const companies = groupByNode("company");
    const domains = groupByNode("domain");
    if (companies.size > 0 && domains.size > 0) {
      const companyTokens = Array.from(companies.values()).map((c) =>
        norm(c.label).replace(/[^a-z0-9]/g, ""),
      );
      const suspiciousDomains = Array.from(domains.values()).filter((d) => {
        const root = d.label.split(".").slice(-2, -1)[0]?.toLowerCase() ?? "";
        return companyTokens.length > 0 && !companyTokens.some((t) => t.includes(root) || root.includes(t));
      });
      if (suspiciousDomains.length > 0) {
        findings.push({
          severity: "warning",
          title: "Recruiter domain doesn't match claimed employer",
          detail: `Domain(s) ${suspiciousDomains.map((d) => d.label).join(", ")} do not visibly match company name(s) ${Array.from(companies.values()).map((c) => c.label).join(", ")}. Verify via official careers page.`,
          cited_evidence: suspiciousDomains.flatMap((d) => d.evidence_refs),
        });
      }
    }

    // 3) Free-mail recruiter
    const freeSet = new Set([
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
    Array.from(emails.values()).forEach((e) => {
      const dom = e.label.split("@")[1] ?? "";
      if (freeSet.has(dom)) {
        findings.push({
          severity: "warning",
          title: `Recruiter using free mailbox (${dom})`,
          detail: `${e.label} is on a consumer mail provider. Legitimate corporate recruiters overwhelmingly use their company domain.`,
          cited_evidence: e.evidence_refs,
        });
      }
    });

    // 4) LLM overlay: quick reasoning on nodes + edges to catch soft signals
    let summary = "";
    let llmFindings: IdentityFinding[] = [];
    try {
      const compact = {
        nodes: Array.from(nodes.values()),
        edges: edges.slice(0, 60),
        deterministic_findings: findings,
      };
      const out = await callJSON<{ summary: string; findings: IdentityFinding[] }>({
        messages: [
          {
            role: "system",
            content:
              "You are ANVIX Identity Graph analyst. Given a small identity graph extracted from user evidence, add 0-4 SOFT findings a human analyst would notice (alias risk, jurisdictional flags, communication-channel mismatch, profile-photo reuse cues). Never invent facts. Ground each finding in specific evidence numbers. Return strict JSON.",
          },
          {
            role: "user",
            content: `Graph JSON:\n${JSON.stringify(compact).slice(0, 15000)}\n\nReturn: {"summary": string (2 sentences, plain English), "findings": [{"severity":"info|warning|critical","title":string,"detail":string,"cited_evidence":number[]}]}`,
          },
        ],
        temperature: 0.2,
      });
      summary = out.summary ?? "";
      llmFindings = Array.isArray(out.findings) ? out.findings.slice(0, 4) : [];
    } catch (e) {
      console.warn("Identity graph LLM overlay failed:", e);
    }

    if (!summary) {
      summary = `${nodes.size} identity node(s) across ${data.evidence.length} evidence item(s); ${findings.length} cross-evidence signal(s).`;
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
      findings: [...findings, ...llmFindings],
      summary,
    };
  });

// ---------- Offer Letter Forensics ----------

const OfferInput = z.object({
  filename: z.string().default("offer.pdf"),
  pdf_base64: z.string().min(1), // raw base64 (no data URL prefix) OR data URL
  extracted_text: z.string().default(""),
  companies: z.array(z.string()).default([]),
  amounts: z.array(z.string()).default([]),
  payment_methods: z.array(z.string()).default([]),
  role_hint: z.string().default(""),
  location_hint: z.string().default(""),
});

const KNOWN_SCAM_TEMPLATES = [
  "we selected your resume from our online database",
  "you have been shortlisted for a work-from-home position",
  "you must purchase a laptop through our approved vendor",
  "kindly deposit the refundable security amount",
  "training fee will be refunded in your first salary",
  "your onboarding kit will be couriered upon payment",
  "we operate strictly through whatsapp and telegram",
  "payment can be made via usdt / bitcoin / gift cards",
];

export const analyzeOfferLetter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OfferInput.parse(d))
  .handler(async ({ data }): Promise<OfferForensics> => {
    // 1) Deterministic PDF metadata via pdf-lib (workers-safe)
    const b64 = data.pdf_base64.startsWith("data:")
      ? data.pdf_base64.slice(data.pdf_base64.indexOf(",") + 1)
      : data.pdf_base64;

    let title: string | undefined,
      author: string | undefined,
      creator: string | undefined,
      producer: string | undefined,
      creationDate: string | undefined,
      modificationDate: string | undefined,
      pageCount: number | undefined;
    const tampered: string[] = [];

    try {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const pdf = await PDFDocument.load(bin, { ignoreEncryption: true, updateMetadata: false });
      title = pdf.getTitle() || undefined;
      author = pdf.getAuthor() || undefined;
      creator = pdf.getCreator() || undefined;
      producer = pdf.getProducer() || undefined;
      creationDate = pdf.getCreationDate()?.toISOString();
      modificationDate = pdf.getModificationDate()?.toISOString();
      pageCount = pdf.getPageCount();

      if (creationDate && modificationDate) {
        const c = new Date(creationDate).getTime();
        const m = new Date(modificationDate).getTime();
        const diffDays = Math.round((m - c) / (1000 * 60 * 60 * 24));
        if (diffDays > 365)
          tampered.push(
            `Modified ${diffDays} days after creation — heavy post-hoc edits on an offer letter are unusual.`,
          );
        if (m < c) tampered.push("Modification date is BEFORE creation date — metadata was tampered.");
      }
      const susTools = ["ilovepdf", "smallpdf", "pdf24", "sejda", "microsoft® word", "libreoffice"];
      const prodLc = (producer ?? "").toLowerCase();
      const creatorLc = (creator ?? "").toLowerCase();
      if (susTools.some((t) => prodLc.includes(t) || creatorLc.includes(t))) {
        tampered.push(
          `Produced by "${producer ?? creator}" — a consumer editor, unusual for HR-issued offer letters (typically Adobe / DocuSign / SAP SuccessFactors).`,
        );
      }
      if (!author && !producer) tampered.push("All PDF metadata stripped — deliberate anonymization.");
    } catch (e) {
      tampered.push(`Could not parse PDF metadata: ${(e as Error).message}`);
    }

    // 2) Template-reuse Jaccard against known scam phrases
    const text = data.extracted_text.toLowerCase();
    const hits = KNOWN_SCAM_TEMPLATES.filter((p) => text.includes(p));
    const templateReuseScore = Math.min(1, hits.length / 4);
    const templateReuseNotes =
      hits.length > 0
        ? `Matches ${hits.length} known scam-template phrase(s): "${hits.slice(0, 3).join('", "')}"`
        : "No exact matches against known scam-template phrase library.";

    // 3) LLM reasoning: salary plausibility, letterhead reading, payment red flags
    let llmOut: {
      is_offer_letter: boolean;
      letterhead: OfferForensics["letterhead"];
      compensation: OfferForensics["compensation"];
      payment_red_flags: string[];
      findings: IdentityFinding[];
      overall_verdict: OfferForensics["overall_verdict"];
    } = {
      is_offer_letter: /offer|appointment|employment|joining/i.test(text),
      letterhead: { logo_present: false },
      compensation: { salary_plausibility: "unknown" },
      payment_red_flags: [],
      findings: [],
      overall_verdict: "unknown",
    };

    try {
      const out = await callJSON<typeof llmOut>({
        messages: [
          {
            role: "system",
            content:
              "You are ANVIX Offer-Letter Forensics. Analyze the extracted text of a purported job offer letter. Judge salary plausibility for the role/location context, spot payment red flags (personal bank, UPI, crypto, gift cards, training fee, laptop deposit), read letterhead (claimed company + signatory), and give an overall verdict. Never invent numbers. Return strict JSON.",
          },
          {
            role: "user",
            content: `Filename: ${data.filename}
Claimed companies (from extraction): ${data.companies.join(", ") || "—"}
Amounts spotted: ${data.amounts.join(", ") || "—"}
Payment methods spotted: ${data.payment_methods.join(", ") || "—"}
Role hint: ${data.role_hint || "—"}
Location hint: ${data.location_hint || "—"}

--- OFFER LETTER TEXT ---
${data.extracted_text.slice(0, 12000)}
--- END TEXT ---

Return this exact JSON:
{
  "is_offer_letter": boolean,
  "letterhead": { "claimed_company": string|null, "signatory_name": string|null, "signatory_title": string|null, "logo_present": boolean },
  "compensation": { "stated_amount": string|null, "currency": string|null, "period": string|null, "market_band": string|null, "salary_plausibility": "typical"|"high"|"extreme_outlier"|"below_market"|"unknown" },
  "payment_red_flags": string[],
  "findings": [{ "severity": "info"|"warning"|"critical", "title": string, "detail": string, "cited_evidence": number[] }],
  "overall_verdict": "likely_authentic"|"suspicious"|"high_risk"|"unknown"
}`,
          },
        ],
        temperature: 0.2,
      });
      llmOut = { ...llmOut, ...out };
    } catch (e) {
      console.warn("Offer-letter LLM analysis failed:", e);
    }

    // Merge deterministic tampered signals into findings
    const findings: IdentityFinding[] = [...(llmOut.findings ?? [])];
    tampered.forEach((t) =>
      findings.push({
        severity: t.toLowerCase().includes("tampered") ? "critical" : "warning",
        title: "PDF metadata signal",
        detail: t,
        cited_evidence: [1],
      }),
    );
    if (templateReuseScore > 0.25) {
      findings.push({
        severity: templateReuseScore > 0.6 ? "critical" : "warning",
        title: "Template reuse detected",
        detail: templateReuseNotes,
        cited_evidence: [1],
      });
    }

    // Verdict escalation from deterministic signals
    let verdict = llmOut.overall_verdict;
    if (tampered.some((t) => t.includes("tampered")) || templateReuseScore >= 0.5) verdict = "high_risk";
    else if (tampered.length > 0 && verdict === "likely_authentic") verdict = "suspicious";

    return {
      is_offer_letter: !!llmOut.is_offer_letter,
      filename: data.filename,
      pdf_metadata: {
        title,
        author,
        creator,
        producer,
        creation_date: creationDate,
        modification_date: modificationDate,
        page_count: pageCount,
        tampered_signals: tampered,
      },
      letterhead: llmOut.letterhead ?? { logo_present: false },
      compensation: llmOut.compensation ?? { salary_plausibility: "unknown" },
      payment_red_flags: llmOut.payment_red_flags ?? [],
      template_reuse_score: templateReuseScore,
      template_reuse_notes: templateReuseNotes,
      findings,
      overall_verdict: verdict,
    };
  });
