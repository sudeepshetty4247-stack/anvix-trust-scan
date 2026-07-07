// Guest investigations live entirely in localStorage. No DB, no auth, no cookies.
// When the user clicks "Save to history", the current record is claimed into
// their account via the authenticated claimGuestInvestigation server fn.

import type { GuestResult } from "./guest.functions";
import type { ExtractedEvidence } from "./evidence.functions";
import type { Narrative } from "./narrative.functions";
import type { IdentityGraph, OfferForensics } from "./forensics.functions";

const CURRENT = "anvix:guest:current";
const HISTORY = "anvix:guest:history";
const MAX_HISTORY = 20;

export type GuestEvidenceItem = ExtractedEvidence & {
  id: string;
  preview_data_url?: string;
  original_size?: number;
  // Kept transiently for offer-letter forensics; stripped before persistence.
  pdf_base64?: string;
};

export type GuestRecord = {
  id: string;
  name: string;
  createdAt: string;
  input: {
    urls: string[];
    emails: string[];
    text: string;
    evidence: GuestEvidenceItem[];
  };
  result: GuestResult;
  narrative?: Narrative;
  identity_graph?: IdentityGraph;
  offer_forensics?: OfferForensics[];
  public_slug?: string;
};

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export function saveGuestCurrent(rec: GuestRecord) {
  if (typeof window === "undefined") return;
  const slim: GuestRecord = {
    ...rec,
    input: {
      ...rec.input,
      evidence: rec.input.evidence.map(({ pdf_base64, ...e }) => e),
    },
  };
  safe(() => localStorage.setItem(CURRENT, JSON.stringify(slim)), undefined);
  const hist = readGuestHistory();
  const next = [slim, ...hist.filter((h) => h.id !== slim.id)].slice(0, MAX_HISTORY);
  safe(() => localStorage.setItem(HISTORY, JSON.stringify(next)), undefined);
}

export function readGuestCurrent(): GuestRecord | null {
  if (typeof window === "undefined") return null;
  return safe(() => {
    const raw = localStorage.getItem(CURRENT);
    return raw ? (JSON.parse(raw) as GuestRecord) : null;
  }, null);
}

export function clearGuestCurrent() {
  if (typeof window === "undefined") return;
  safe(() => localStorage.removeItem(CURRENT), undefined);
}

export function readGuestHistory(): GuestRecord[] {
  if (typeof window === "undefined") return [];
  return safe(() => {
    const raw = localStorage.getItem(HISTORY);
    return raw ? (JSON.parse(raw) as GuestRecord[]) : [];
  }, []);
}

export function removeGuestHistory(id: string) {
  if (typeof window === "undefined") return;
  const next = readGuestHistory().filter((h) => h.id !== id);
  safe(() => localStorage.setItem(HISTORY, JSON.stringify(next)), undefined);
}
