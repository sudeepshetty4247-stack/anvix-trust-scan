// Dialog to collect complainant details and download the pre-filled
// cybercrime.gov.in complaint PDF.

import { useState } from "react";
import { Loader2, X, FileDown } from "lucide-react";
import { toast } from "sonner";
import { generateCybercrimeFIRPDF, downloadFIRPDF, type FIRInputs } from "@/lib/fir-pdf";

type EvidenceLike = {
  label?: string | null;
  content?: string | null;
  kind: string;
};

type Extracted = {
  emails: string[];
  phones: string[];
  upi_or_bank: string[];
  websites: string[];
  names: string[];
};

export function GenerateFIRDialog({
  open,
  onClose,
  caseName,
  caseSummary,
  evidence,
  extractedIdentifiers,
}: {
  open: boolean;
  onClose: () => void;
  caseName: string;
  caseSummary: string;
  evidence: EvidenceLike[];
  extractedIdentifiers: Extracted;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [datePaid, setDatePaid] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || phone.trim().length < 6) {
      toast.error("Please enter your name and phone number.");
      return;
    }
    setBusy(true);
    try {
      const inputs: FIRInputs = {
        complainant_name: name.trim(),
        complainant_phone: phone.trim(),
        complainant_email: email.trim() || undefined,
        complainant_address: address.trim() || undefined,
        amount_lost_inr: amount ? Number(amount) : undefined,
        date_paid: datePaid || undefined,
        case_name: caseName,
        case_summary: caseSummary,
        scammer_identifiers: extractedIdentifiers,
        evidence_items: evidence.slice(0, 30).map((e) => ({
          label: e.label ?? e.content ?? "(unnamed)",
          kind: e.kind,
        })),
      };
      const bytes = await generateCybercrimeFIRPDF(inputs);
      downloadFIRPDF(
        bytes,
        `anvix-cybercrime-complaint-${name.trim().split(" ")[0].toLowerCase()}.pdf`,
      );
      toast.success("Complaint PDF downloaded. Attach it at cybercrime.gov.in.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="glass w-full max-w-lg overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="mono text-[10px] uppercase tracking-widest text-primary">
              Cybercrime complaint
            </div>
            <div className="text-base font-semibold">Generate your ready-to-file complaint</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onGenerate} className="space-y-3 px-5 py-4">
          <p className="text-xs text-muted-foreground">
            We'll pre-fill the complaint with the evidence and scammer identifiers from this
            investigation. Only your name, phone, and (if applicable) the amount lost are
            needed from you.
          </p>
          <Field label="Your full name *">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              maxLength={120}
              required
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone number *">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                maxLength={20}
                required
              />
            </Field>
            <Field label="Email (optional)">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                maxLength={200}
              />
            </Field>
          </div>
          <Field label="Address (optional)">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input"
              maxLength={200}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount lost (₹, optional)">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input"
                min={0}
              />
            </Field>
            <Field label="Date paid (optional)">
              <input
                type="date"
                value={datePaid}
                onChange={(e) => setDatePaid(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Download complaint PDF
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
