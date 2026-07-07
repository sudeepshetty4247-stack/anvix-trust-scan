// Cybercrime FIR PDF generator. Client-side pdf-lib. Produces a
// pre-filled complaint the user attaches at cybercrime.gov.in.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const M = 48;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const LINE = 14;
const TITLE = rgb(0.08, 0.09, 0.12);
const TEXT = rgb(0.15, 0.16, 0.19);
const MUTED = rgb(0.42, 0.44, 0.48);
const ACCENT = rgb(0.72, 0.16, 0.16);
const DIVIDER = rgb(0.85, 0.86, 0.88);

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
};

function san(s: unknown): string {
  const t = String(s ?? "");
  return t
    .replace(/[\u2192\u21D2]/g, "->")
    .replace(/[\u2190\u21D0]/g, "<-")
    .replace(/[\u2713\u2714]/g, "OK")
    .replace(/[\u2717\u2718\u2715\u274C]/g, "X")
    .replace(/[\u2022\u25CF\u25AA\u25A0]/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00B7/g, "·")
    .replace(/\u20B9/g, "Rs.")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}
function patchPage(page: PDFPage): PDFPage {
  const orig = page.drawText.bind(page);
  (page as unknown as { drawText: (t: string, o: unknown) => void }).drawText = (t, o) =>
    orig(san(t), o as Parameters<typeof orig>[1]);
  return page;
}

function newPage(ctx: Ctx) {
  ctx.page = patchPage(ctx.doc.addPage([PAGE_W, PAGE_H]));
  ctx.y = PAGE_H - M;
}

function ensure(ctx: Ctx, need: number) {
  if (ctx.y - need < M) newPage(ctx);
}
function line(ctx: Ctx) {
  ctx.page.drawLine({
    start: { x: M, y: ctx.y },
    end: { x: PAGE_W - M, y: ctx.y },
    thickness: 0.5,
    color: DIVIDER,
  });
  ctx.y -= 10;
}
function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const paras = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const p of paras) {
    if (!p.trim()) {
      out.push("");
      continue;
    }
    const words = p.split(" ");
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > max) {
        if (cur) out.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) out.push(cur);
  }
  return out;
}
function drawText(ctx: Ctx, text: string, size: number, opts?: { font?: PDFFont; color?: ReturnType<typeof rgb> }) {
  const font = opts?.font ?? ctx.font;
  const color = opts?.color ?? TEXT;
  const lines = wrap(text, font, size, PAGE_W - 2 * M);
  for (const l of lines) {
    ensure(ctx, size + 4);
    ctx.page.drawText(l, { x: M, y: ctx.y - size, size, font, color });
    ctx.y -= size + 4;
  }
}
function h1(ctx: Ctx, text: string) {
  ensure(ctx, 28);
  ctx.page.drawText(text, { x: M, y: ctx.y - 22, size: 22, font: ctx.bold, color: TITLE });
  ctx.y -= 32;
}
function h2(ctx: Ctx, text: string) {
  ctx.y -= 6;
  ensure(ctx, 20);
  ctx.page.drawText(text, { x: M, y: ctx.y - 12, size: 12, font: ctx.bold, color: ACCENT });
  ctx.y -= 18;
  line(ctx);
}
function kv(ctx: Ctx, k: string, v: string) {
  ensure(ctx, LINE);
  ctx.page.drawText(k, { x: M, y: ctx.y - 10, size: 9, font: ctx.bold, color: MUTED });
  ctx.y -= 12;
  const lines = wrap(v || "—", ctx.font, 10, PAGE_W - 2 * M);
  for (const l of lines) {
    ensure(ctx, 12);
    ctx.page.drawText(l, { x: M, y: ctx.y - 10, size: 10, font: ctx.font, color: TEXT });
    ctx.y -= 12;
  }
  ctx.y -= 4;
}
function bullet(ctx: Ctx, text: string) {
  const lines = wrap(text, ctx.font, 10, PAGE_W - 2 * M - 14);
  ensure(ctx, 12);
  ctx.page.drawText("•", { x: M, y: ctx.y - 10, size: 10, font: ctx.font, color: TEXT });
  ctx.page.drawText(lines[0] ?? "", {
    x: M + 12,
    y: ctx.y - 10,
    size: 10,
    font: ctx.font,
    color: TEXT,
  });
  ctx.y -= 12;
  for (let i = 1; i < lines.length; i++) {
    ensure(ctx, 12);
    ctx.page.drawText(lines[i], { x: M + 12, y: ctx.y - 10, size: 10, font: ctx.font, color: TEXT });
    ctx.y -= 12;
  }
}

export type FIRInputs = {
  complainant_name: string;
  complainant_phone: string;
  complainant_email?: string;
  complainant_address?: string;
  amount_lost_inr?: number;
  date_paid?: string; // ISO date
  case_name: string;
  case_summary: string;                  // 1-3 sentence description
  scammer_identifiers: {
    emails: string[];
    phones: string[];
    upi_or_bank: string[];
    websites: string[];
    names: string[];
  };
  evidence_items: Array<{
    label: string;
    kind: string;
  }>;
  incident_timeline?: string[]; // chronological events (optional)
};

export async function generateCybercrimeFIRPDF(inputs: FIRInputs): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - M, font, bold };

  // Header
  ctx.page.drawText("ANVIX", { x: M, y: PAGE_H - 30, size: 12, font: bold, color: ACCENT });
  ctx.page.drawText("Cybercrime Complaint — Ready to file at cybercrime.gov.in", {
    x: M + 46,
    y: PAGE_H - 30,
    size: 10,
    font,
    color: MUTED,
  });
  ctx.y = PAGE_H - M - 12;
  line(ctx);

  h1(ctx, "Complaint of Recruitment Fraud");
  drawText(
    ctx,
    `Filed by: ${inputs.complainant_name}   |   Date prepared: ${new Date().toLocaleDateString()}`,
    9,
    { color: MUTED },
  );
  ctx.y -= 6;

  // 1. Complainant details
  h2(ctx, "1. Complainant Details");
  kv(ctx, "Full name", inputs.complainant_name);
  kv(ctx, "Phone number", inputs.complainant_phone);
  if (inputs.complainant_email) kv(ctx, "Email", inputs.complainant_email);
  if (inputs.complainant_address) kv(ctx, "Address", inputs.complainant_address);

  // 2. Incident summary
  h2(ctx, "2. Nature of Complaint");
  drawText(
    ctx,
    "I wish to lodge a complaint against the below-mentioned person(s) / account(s) for the offence of online recruitment fraud, cheating, and impersonation.",
    10,
  );
  ctx.y -= 4;
  drawText(ctx, `Case reference: ${inputs.case_name}`, 10, { font: bold });
  ctx.y -= 4;
  drawText(ctx, inputs.case_summary, 10);

  if (inputs.amount_lost_inr && inputs.amount_lost_inr > 0) {
    ctx.y -= 6;
    kv(ctx, "Amount lost (INR)", `Rs. ${inputs.amount_lost_inr.toLocaleString("en-IN")}`);
    if (inputs.date_paid) kv(ctx, "Date of transaction", new Date(inputs.date_paid).toLocaleDateString());
  }

  // 3. Suspect identifiers
  h2(ctx, "3. Suspect Identifiers");
  const si = inputs.scammer_identifiers;
  if (si.names.length) kv(ctx, "Name(s) used", si.names.join(", "));
  if (si.emails.length) kv(ctx, "Email address(es)", si.emails.join(", "));
  if (si.phones.length) kv(ctx, "Phone number(s)", si.phones.join(", "));
  if (si.upi_or_bank.length) kv(ctx, "UPI / Bank account(s)", si.upi_or_bank.join(", "));
  if (si.websites.length) kv(ctx, "Website(s) used", si.websites.join(", "));
  if (
    !si.names.length &&
    !si.emails.length &&
    !si.phones.length &&
    !si.upi_or_bank.length &&
    !si.websites.length
  ) {
    drawText(ctx, "See attached evidence for suspect identifiers.", 10, { color: MUTED });
  }

  // 4. Timeline
  if (inputs.incident_timeline && inputs.incident_timeline.length > 0) {
    h2(ctx, "4. Timeline of Events");
    for (const step of inputs.incident_timeline) bullet(ctx, step);
  }

  // 5. Evidence
  h2(ctx, "5. Evidence Attached / Available");
  if (inputs.evidence_items.length === 0) {
    drawText(ctx, "No evidence items catalogued.", 10, { color: MUTED });
  } else {
    for (const e of inputs.evidence_items) bullet(ctx, `[${e.kind}] ${e.label}`);
  }

  // 6. Applicable sections
  h2(ctx, "6. Applicable Legal Sections");
  bullet(ctx, "IPC Section 419 — Cheating by personation");
  bullet(ctx, "IPC Section 420 — Cheating and dishonestly inducing delivery of property");
  bullet(ctx, "IT Act Section 66C — Identity theft (use of stolen identifiers)");
  bullet(ctx, "IT Act Section 66D — Cheating by personation using computer resource");

  // 7. Request
  h2(ctx, "7. Request to Authorities");
  drawText(
    ctx,
    "I request the authorities to register this complaint, initiate an investigation, freeze the identified bank account(s) / UPI ID(s) at the earliest, and take appropriate legal action against the suspect(s). I am willing to provide any further information or assistance required for the investigation.",
    10,
  );

  ctx.y -= 20;
  drawText(ctx, "Declaration:", 10, { font: bold });
  drawText(
    ctx,
    "I hereby declare that the information provided above is true and correct to the best of my knowledge and belief.",
    10,
  );
  ctx.y -= 30;
  drawText(ctx, "Signature: ______________________________", 10);
  ctx.y -= 6;
  drawText(ctx, `Name: ${inputs.complainant_name}`, 10);
  drawText(ctx, `Date: ${new Date().toLocaleDateString()}`, 10);

  // How to file page
  newPage(ctx);
  ctx.page.drawText("ANVIX", { x: M, y: PAGE_H - 30, size: 12, font: bold, color: ACCENT });
  ctx.page.drawText("How to file this complaint", {
    x: M + 46,
    y: PAGE_H - 30,
    size: 10,
    font,
    color: MUTED,
  });
  ctx.y = PAGE_H - M - 12;
  line(ctx);
  h1(ctx, "How to file this complaint");
  drawText(
    ctx,
    "File within 24 hours if money was transferred — early reporting greatly improves the chance of freezing the scammer's account.",
    11,
    { font: bold, color: ACCENT },
  );
  ctx.y -= 6;
  bullet(ctx, "Call the National Cybercrime Helpline: 1930 (available 24×7).");
  bullet(ctx, "Visit https://cybercrime.gov.in → 'File a Complaint' → 'Financial Fraud' → 'Report & Track'.");
  bullet(ctx, "Create an account with your mobile number (OTP-based login).");
  bullet(ctx, "In the complaint form, fill in the same information from this PDF.");
  bullet(ctx, "Under 'Upload Evidence', attach this PDF and all screenshots, emails, offer letters.");
  bullet(ctx, "Note down the acknowledgement number — you will need it to track the case.");
  ctx.y -= 6;
  drawText(ctx, "If your bank details or OTP were shared:", 10, { font: bold });
  bullet(ctx, "Immediately call your bank's fraud helpline.");
  bullet(ctx, "Block your debit/credit card via net banking or app.");
  bullet(ctx, "Reset your net-banking password.");
  ctx.y -= 6;
  drawText(
    ctx,
    "This document is a template prepared by ANVIX for your convenience. It is not a substitute for legal advice.",
    9,
    { color: MUTED },
  );

  const bytes = await doc.save();
  return bytes;
}

export function downloadFIRPDF(bytes: Uint8Array, filename = "anvix-cybercrime-complaint.pdf") {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
