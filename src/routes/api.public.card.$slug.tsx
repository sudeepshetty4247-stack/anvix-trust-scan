// Server route — dynamic SVG share card. WhatsApp/Telegram preview og:image
// scrape this URL. Kept as pure-string SVG (no satori/wasm dep) so it stays
// fast on Cloudflare Workers.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function verdictColor(score: number): { fg: string; bg: string; label: string } {
  if (score >= 70) return { fg: "#16a34a", bg: "#052e1a", label: "LIKELY SAFE" };
  if (score >= 50) return { fg: "#eab308", bg: "#2a1f04", label: "CAUTION" };
  if (score >= 30) return { fg: "#f97316", bg: "#2a1305", label: "HIGH RISK" };
  return { fg: "#dc2626", bg: "#2a0808", label: "LIKELY FRAUD" };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export const Route = createFileRoute("/api/public/card/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return new Response("service unavailable", { status: 503 });
        const sb = createClient<Database>(url, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: row } = await sb
          .from("public_reports")
          .select("case_name, verdict, trust_score, confidence_low, confidence_high, top_reasons")
          .eq("slug", params.slug)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (!row) return new Response("not found", { status: 404 });

        const c = verdictColor(row.trust_score);
        const name = truncate(row.case_name, 46);
        const reasons = ((row.top_reasons as string[] | null) ?? []).slice(0, 3);

        const reasonLines = reasons
          .map(
            (r, i) =>
              `<text x="60" y="${470 + i * 34}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="20" fill="#e2e8f0">• ${escape(truncate(r, 78))}</text>`,
          )
          .join("");

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0f1e"/>
      <stop offset="100%" stop-color="${c.bg}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="8" fill="${c.fg}"/>
  <text x="60" y="80" font-family="ui-monospace,monospace" font-size="18" fill="#93c5fd" letter-spacing="4">ANVIX · RECRUITMENT FRAUD INTELLIGENCE</text>
  <text x="60" y="180" font-family="ui-sans-serif,system-ui,sans-serif" font-size="42" font-weight="600" fill="#f8fafc">${escape(name)}</text>
  <rect x="60" y="220" width="240" height="46" rx="23" fill="${c.fg}" opacity="0.15" stroke="${c.fg}" stroke-width="1.5"/>
  <text x="180" y="251" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="18" font-weight="700" fill="${c.fg}" letter-spacing="2">${c.label}</text>
  <text x="60" y="380" font-family="ui-sans-serif,system-ui,sans-serif" font-size="150" font-weight="700" fill="${c.fg}">${row.trust_score}</text>
  <text x="${60 + String(row.trust_score).length * 84}" y="380" font-family="ui-sans-serif,system-ui,sans-serif" font-size="40" fill="#94a3b8">/100 trust</text>
  <text x="60" y="420" font-family="ui-sans-serif,system-ui,sans-serif" font-size="20" fill="#cbd5e1">${row.confidence_low}–${row.confidence_high} confidence range</text>
  ${reasonLines}
  <text x="60" y="600" font-family="ui-monospace,monospace" font-size="16" fill="#64748b">Scan the QR on the ANVIX report to verify · vetting-forge-ai.lovable.app/r/${escape(params.slug)}</text>
</svg>`;
        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
