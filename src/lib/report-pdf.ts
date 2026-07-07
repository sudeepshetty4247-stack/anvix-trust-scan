// Client-side PDF report generation using pdf-lib. Runs in browser; no
// server round-trip required. Sign-in is enforced BEFORE this is called
// (see /investigate download flow).

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { GuestRecord } from "./guest-storage";

const M = 48; // page margin
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const LINE = 14;
const PRIMARY = rgb(0.28, 0.72, 0.52);
const MUTED = rgb(0.5, 0.52, 0.55);
const TEXT = rgb(0.12, 0.13, 0.15);
const DIVIDER = rgb(0.85, 0.86, 0.88);

type Ctx = { doc: PDFDocument; page: PDFPage; y: number; font: PDFFont; bold: PDFFont };

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - M;
  header(ctx);
}
function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < M + 30) newPage(ctx);
}
function header(ctx: Ctx) {
  ctx.page.drawText("ANVIX", { x: M, y: PAGE_H - 30, size: 12, font: ctx.bold, color: PRIMARY });
  ctx.page.drawText("Recruitment Trust & Fraud Report", {
    x: M + 46,
    y: PAGE_H - 30,
    size: 10,
    font: ctx.font,
    color: MUTED,
  });
  ctx.page.drawLine({
    start: { x: M, y: PAGE_H - 40 },
    end: { x: PAGE_W - M, y: PAGE_H - 40 },
    thickness: 0.5,
    color: DIVIDER,
  });
  ctx.y = PAGE_H - M - 12;
}
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const para of words) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    const w = para.split(/\s+/);
    let line = "";
    for (const word of w) {
      const trial = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(trial, size) <= maxW) line = trial;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}
function drawParagraph(
  ctx: Ctx,
  text: string,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {},
) {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.bold : ctx.font;
  const color = opts.color ?? TEXT;
  const indent = opts.indent ?? 0;
  const maxW = PAGE_W - M * 2 - indent;
  const lines = wrap(text, font, size, maxW);
  for (const l of lines) {
    ensure(ctx, size + 4);
    ctx.page.drawText(l, { x: M + indent, y: ctx.y, size, font, color });
    ctx.y -= size + 4;
  }
}
function drawH1(ctx: Ctx, text: string) {
  ensure(ctx, 30);
  ctx.y -= 4;
  ctx.page.drawText(text, { x: M, y: ctx.y, size: 18, font: ctx.bold, color: TEXT });
  ctx.y -= 22;
}
function drawH2(ctx: Ctx, text: string) {
  ensure(ctx, 24);
  ctx.y -= 6;
  ctx.page.drawText(text, { x: M, y: ctx.y, size: 12, font: ctx.bold, color: PRIMARY });
  ctx.y -= 16;
  ctx.page.drawLine({
    start: { x: M, y: ctx.y + 4 },
    end: { x: PAGE_W - M, y: ctx.y + 4 },
    thickness: 0.4,
    color: DIVIDER,
  });
  ctx.y -= 4;
}
function drawKV(ctx: Ctx, key: string, value: string) {
  ensure(ctx, LINE);
  ctx.page.drawText(key, { x: M, y: ctx.y, size: 9, font: ctx.bold, color: MUTED });
  const vlines = wrap(value, ctx.font, 10, PAGE_W - M * 2 - 140);
  ctx.page.drawText(vlines[0] ?? "", {
    x: M + 140,
    y: ctx.y,
    size: 10,
    font: ctx.font,
    color: TEXT,
  });
  ctx.y -= LINE;
  for (let i = 1; i < vlines.length; i++) {
    ensure(ctx, LINE);
    ctx.page.drawText(vlines[i], { x: M + 140, y: ctx.y, size: 10, font: ctx.font, color: TEXT });
    ctx.y -= LINE;
  }
}
function drawBullet(ctx: Ctx, text: string) {
  ensure(ctx, LINE);
  ctx.page.drawText("•", { x: M, y: ctx.y, size: 10, font: ctx.bold, color: PRIMARY });
  drawParagraph(ctx, text, { indent: 14 });
}

export async function generateReportPDF(rec: GuestRecord): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`ANVIX Report — ${rec.name}`);
  doc.setAuthor("ANVIX");
  doc.setSubject("Recruitment Trust & Fraud Intelligence Report");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - M, font, bold };
  header(ctx);

  // Title block
  drawH1(ctx, rec.name);
  drawParagraph(ctx, `Generated ${new Date().toLocaleString()} · ANVIX-Blend-v1`, {
    size: 9,
    color: MUTED,
  });
  ctx.y -= 6;

  // Score block
  const r = rec.result;
  drawH2(ctx, "Trust Score");
  ensure(ctx, 40);
  ctx.page.drawText(`${r.trust_score}`, {
    x: M,
    y: ctx.y - 20,
    size: 48,
    font: bold,
    color: PRIMARY,
  });
  ctx.page.drawText(`/100`, { x: M + 90, y: ctx.y - 16, size: 14, font, color: MUTED });
  ctx.page.drawText(r.risk_category.replace("_", " ").toUpperCase(), {
    x: M + 140,
    y: ctx.y - 10,
    size: 12,
    font: bold,
    color: TEXT,
  });
  ctx.page.drawText(
    `Ensemble P(fraud): ${(r.ensemble_breakdown.ensemble * 100).toFixed(1)}%  (LR ${(r.ensemble_breakdown.lr * 100).toFixed(0)}% · GBM ${(r.ensemble_breakdown.gbm * 100).toFixed(0)}%)`,
    { x: M + 140, y: ctx.y - 26, size: 9, font, color: MUTED },
  );
  ctx.page.drawText(
    `Weighted baseline: ${r.weighted_score}/100  ·  Confidence: ${(r.confidence * 100).toFixed(0)}%`,
    { x: M + 140, y: ctx.y - 40, size: 9, font, color: MUTED },
  );
  ctx.y -= 60;

  drawParagraph(ctx, r.summary);
  ctx.y -= 6;
  drawParagraph(ctx, `Recommendation: ${r.recommendation}`, { bold: true });

  // Narrative + Playbook
  if (rec.narrative) {
    drawH2(ctx, "Investigator Narrative");
    if (rec.narrative.headline)
      drawParagraph(ctx, rec.narrative.headline, { bold: true, size: 11 });
    drawParagraph(ctx, rec.narrative.narrative);
    if (rec.narrative.key_evidence.length) {
      ctx.y -= 4;
      drawParagraph(ctx, "Key evidence:", { bold: true });
      rec.narrative.key_evidence.forEach((e) => drawBullet(ctx, e));
    }

    const pb = rec.narrative.playbook;
    if (pb.playbook_id) {
      drawH2(ctx, "Scam Playbook Match");
      drawKV(
        ctx,
        "Playbook",
        `${pb.playbook_name}  (confidence ${(pb.confidence * 100).toFixed(0)}%)`,
      );
      if (pb.current_step_index !== null) drawKV(ctx, "Current step", `#${pb.current_step_index}`);
      if (pb.matched_signals.length) drawKV(ctx, "Matched signals", pb.matched_signals.join(", "));
      if (pb.next_move) drawKV(ctx, "Likely next move", pb.next_move);
      if (rec.narrative.next_predicted_asks.length) {
        ctx.y -= 4;
        drawParagraph(ctx, "What they will likely ask for next:", { bold: true });
        rec.narrative.next_predicted_asks.forEach((a, i) => drawBullet(ctx, `Step ${i + 1}: ${a}`));
      }
      if (pb.what_to_do) {
        ctx.y -= 4;
        drawParagraph(ctx, "What to do:", { bold: true });
        drawParagraph(ctx, pb.what_to_do);
      }
    }

    if (rec.narrative.action_checklist.length) {
      drawH2(ctx, "Action Checklist");
      rec.narrative.action_checklist.forEach((a) => drawBullet(ctx, a));
    }
  }

  // Identity Graph
  if (rec.identity_graph && rec.identity_graph.nodes.length > 0) {
    drawH2(ctx, "Recruiter Identity Graph");
    drawParagraph(ctx, rec.identity_graph.summary);
    ctx.y -= 4;
    const g = rec.identity_graph;
    const grouped: Record<string, string[]> = {};
    g.nodes.forEach((n) => {
      (grouped[n.kind] ??= []).push(n.label);
    });
    Object.entries(grouped).forEach(([kind, labels]) => {
      drawKV(ctx, kind, labels.join(", "));
    });
    const suspicious = g.edges.filter((e) => e.suspicious);
    if (suspicious.length) {
      ctx.y -= 4;
      drawParagraph(ctx, `Suspicious links (${suspicious.length}):`, { bold: true, size: 9 });
      suspicious.slice(0, 10).forEach((e) =>
        drawBullet(
          ctx,
          `${e.from.split(":")[1]}  →  ${e.relation}  →  ${e.to.split(":")[1]}${e.note ? ` — ${e.note}` : ""}`,
        ),
      );
    }
    if (g.findings.length) {
      ctx.y -= 4;
      drawParagraph(ctx, "Findings:", { bold: true, size: 9 });
      g.findings.forEach((f) =>
        drawBullet(ctx, `[${f.severity.toUpperCase()}] ${f.title} — ${f.detail}`),
      );
    }
  }

  // Offer Letter Forensics
  if (rec.offer_forensics && rec.offer_forensics.length > 0) {
    drawH2(ctx, "Offer Letter Forensics");
    rec.offer_forensics.forEach((f) => {
      drawParagraph(
        ctx,
        `${f.filename} — verdict: ${f.overall_verdict.replace("_", " ").toUpperCase()}`,
        { bold: true },
      );
      if (f.letterhead.claimed_company)
        drawKV(ctx, "Claimed company", f.letterhead.claimed_company);
      if (f.letterhead.signatory_name)
        drawKV(
          ctx,
          "Signatory",
          `${f.letterhead.signatory_name}${f.letterhead.signatory_title ? ` · ${f.letterhead.signatory_title}` : ""}`,
        );
      if (f.compensation.stated_amount)
        drawKV(
          ctx,
          "Compensation",
          `${f.compensation.stated_amount}${f.compensation.currency ? ` ${f.compensation.currency}` : ""}${f.compensation.period ? ` / ${f.compensation.period}` : ""} — plausibility: ${f.compensation.salary_plausibility}${f.compensation.market_band ? ` (${f.compensation.market_band})` : ""}`,
        );
      if (f.pdf_metadata.producer) drawKV(ctx, "PDF producer", f.pdf_metadata.producer);
      if (f.pdf_metadata.creator) drawKV(ctx, "PDF creator", f.pdf_metadata.creator);
      if (f.pdf_metadata.creation_date)
        drawKV(ctx, "Created", new Date(f.pdf_metadata.creation_date).toLocaleString());
      if (f.pdf_metadata.modification_date)
        drawKV(ctx, "Modified", new Date(f.pdf_metadata.modification_date).toLocaleString());
      drawKV(ctx, "Template reuse", `${(f.template_reuse_score * 100).toFixed(0)}%`);
      if (f.template_reuse_notes)
        drawParagraph(ctx, f.template_reuse_notes, { size: 9, color: MUTED });
      if (f.pdf_metadata.tampered_signals.length) {
        ctx.y -= 2;
        drawParagraph(ctx, "PDF metadata signals:", { bold: true, size: 9 });
        f.pdf_metadata.tampered_signals.forEach((s) => drawBullet(ctx, s));
      }
      if (f.payment_red_flags.length) {
        ctx.y -= 2;
        drawParagraph(ctx, "Payment red flags:", { bold: true, size: 9 });
        f.payment_red_flags.forEach((s) => drawBullet(ctx, s));
      }
      if (f.findings.length) {
        ctx.y -= 2;
        drawParagraph(ctx, "Findings:", { bold: true, size: 9 });
        f.findings.forEach((fi) =>
          drawBullet(ctx, `[${fi.severity.toUpperCase()}] ${fi.title} — ${fi.detail}`),
        );
      }
      ctx.y -= 6;
    });
  }
  drawH2(ctx, "Positive Findings");
  if (r.positive_findings.length === 0) drawParagraph(ctx, "None.", { color: MUTED });
  else r.positive_findings.forEach((f) => drawBullet(ctx, f));

  drawH2(ctx, "Red Flags");
  if (r.negative_findings.length === 0) drawParagraph(ctx, "None detected.", { color: MUTED });
  else r.negative_findings.forEach((f) => drawBullet(ctx, f));

  // Evidence
  drawH2(ctx, "Evidence Collected");
  if (rec.input.evidence.length === 0) {
    drawParagraph(ctx, "No structured evidence uploaded.", { color: MUTED });
  } else {
    rec.input.evidence.forEach((ev, i) => {
      drawParagraph(
        ctx,
        `#${i + 1}  ${ev.kind.toUpperCase()}${ev.filename ? "  ·  " + ev.filename : ""}  ·  channel: ${ev.channel}`,
        { bold: true, size: 10 },
      );
      if (ev.people.length) drawKV(ctx, "People", ev.people.join(", "));
      if (ev.companies.length) drawKV(ctx, "Companies", ev.companies.join(", "));
      if (ev.emails.length) drawKV(ctx, "Emails", ev.emails.join(", "));
      if (ev.phones.length) drawKV(ctx, "Phones", ev.phones.join(", "));
      if (ev.urls.length) drawKV(ctx, "URLs", ev.urls.join(", "));
      if (ev.amounts.length) drawKV(ctx, "Amounts", ev.amounts.join(", "));
      if (ev.payment_methods.length) drawKV(ctx, "Payment methods", ev.payment_methods.join(", "));
      if (ev.red_flag_notes.length) {
        drawParagraph(ctx, "Observations:", { bold: true, size: 9 });
        ev.red_flag_notes.forEach((n) => drawBullet(ctx, n));
      }
      if (ev.extracted_text) {
        drawParagraph(ctx, "Excerpt:", { bold: true, size: 9 });
        drawParagraph(
          ctx,
          ev.extracted_text.slice(0, 800) + (ev.extracted_text.length > 800 ? "…" : ""),
          { size: 9, color: MUTED },
        );
      }
      ctx.y -= 4;
    });
  }

  // Verifications
  drawH2(ctx, "Verifications");
  r.verifications.forEach((v) => {
    ensure(ctx, LINE);
    const icon = v.status === "pass" ? "✓" : v.status === "fail" ? "✗" : "!";
    const color =
      v.status === "pass"
        ? PRIMARY
        : v.status === "fail"
          ? rgb(0.85, 0.28, 0.28)
          : rgb(0.85, 0.65, 0.2);
    ctx.page.drawText(icon, { x: M, y: ctx.y, size: 10, font: bold, color });
    ctx.page.drawText(v.check_name, { x: M + 14, y: ctx.y, size: 9, font: bold, color: TEXT });
    ctx.y -= LINE;
    drawParagraph(ctx, v.detail, { size: 9, color: MUTED, indent: 14 });
  });

  // Model info
  drawH2(ctx, "Model & Methodology");
  drawKV(ctx, "Model", r.model_used);
  drawKV(
    ctx,
    "Trained on",
    `${r.model_metadata.trained_on} — ${r.model_metadata.n_rows.toLocaleString()} rows (${r.model_metadata.n_fraud.toLocaleString()} fraud-labeled)`,
  );
  drawKV(ctx, "Best model (offline)", r.model_metadata.best_model);
  ctx.y -= 4;
  drawParagraph(ctx, "Model comparison (test-set holdout):", { bold: true, size: 9 });
  Object.entries(r.model_metadata.metrics).forEach(([n, m]) => {
    drawKV(
      ctx,
      n,
      `acc ${m.accuracy.toFixed(3)}  ·  prec ${m.precision.toFixed(3)}  ·  rec ${m.recall.toFixed(3)}  ·  F1 ${m.f1.toFixed(3)}  ·  ROC-AUC ${m.roc_auc.toFixed(3)}`,
    );
  });

  // Disclaimer
  drawH2(ctx, "Disclaimer");
  drawParagraph(
    ctx,
    rec.narrative?.disclaimer ??
      "This report is informational and does not constitute legal advice. Verify all findings independently before making decisions.",
    { size: 9, color: MUTED },
  );

  // Footer page numbers
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`ANVIX · ${rec.name} · page ${i + 1} of ${pages.length}`, {
      x: M,
      y: 24,
      size: 8,
      font,
      color: MUTED,
    });
  });

  return doc.save();
}

export function downloadPDF(bytes: Uint8Array, filename: string) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
