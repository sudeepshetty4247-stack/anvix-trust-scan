// Two-column "Do / Don't" panel — the most important section for real users.

import { Check, X } from "lucide-react";
import type { Verdict } from "@/lib/verdict";

const SCAM_DONTS = [
  "Pay any money, joining fee, or deposit",
  "Share your Aadhaar, PAN, or ID documents",
  "Share your bank account or UPI details",
  "Send a copy of your passport or driving licence",
  "Continue chatting on WhatsApp or Telegram with this recruiter",
];

const SCAM_DOS = [
  "Apply directly through the company's official careers page",
  "Search the recruiter's name on the company's LinkedIn page",
  "Call the company's official HR number to confirm the offer",
  "Report the message to your local cybercrime portal",
];

const CAUTION_DOS = [
  "Verify the recruiter on the company's official LinkedIn page",
  "Reply only from the company's official domain, not a personal account",
  "Ask for a video call from the recruiter's official email",
  "Cross-check the job on the company's careers page",
];

const CAUTION_DONTS = [
  "Share personal documents before verifying",
  "Pay any 'processing' or 'training' fee",
  "Rush your decision because of a deadline",
];

const SAFE_DOS = [
  "Continue with the process through official channels",
  "Keep records of every email and offer letter",
  "Ask the recruiter for the official careers-page listing",
];

const SAFE_DONTS = [
  "Share bank details until you have signed an official offer",
  "Pay any fee — real employers never charge candidates",
];

export function ActionChecklist({
  verdict,
  aiActions,
}: {
  verdict: Verdict;
  aiActions?: string[];
}) {
  const isScam = verdict.shouldContinue === "no";
  const isCaution = verdict.shouldContinue === "verify";
  const dos = isScam ? SCAM_DOS : isCaution ? CAUTION_DOS : SAFE_DOS;
  const donts = isScam ? SCAM_DONTS : isCaution ? CAUTION_DONTS : SAFE_DONTS;

  // Merge AI-provided actions into the "do" list, up to 3 extras.
  const mergedDos = [...dos];
  for (const a of aiActions ?? []) {
    if (mergedDos.length >= dos.length + 3) break;
    if (!mergedDos.some((d) => d.toLowerCase() === a.toLowerCase())) mergedDos.push(a);
  }

  return (
    <section className="glass mt-6 rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">What should I do now?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Simple actions to protect yourself, based on this verdict.
      </p>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="mono mb-3 inline-flex items-center gap-2 rounded-md bg-destructive/15 px-2 py-1 text-[11px] uppercase tracking-wider text-destructive">
            Do NOT
          </div>
          <ul className="space-y-2">
            {donts.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mono mb-3 inline-flex items-center gap-2 rounded-md bg-success/15 px-2 py-1 text-[11px] uppercase tracking-wider text-success">
            Instead, do this
          </div>
          <ul className="space-y-2">
            {mergedDos.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
