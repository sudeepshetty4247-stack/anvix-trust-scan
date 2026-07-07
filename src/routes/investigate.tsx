import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { runGuestInvestigation, type GuestResult } from "@/lib/guest.functions";
import { extractEvidence, type ExtractedEvidence } from "@/lib/evidence.functions";
import { narrate, type Narrative } from "@/lib/narrative.functions";
import {
  analyzeIdentityGraph,
  analyzeOfferLetter,
  type IdentityGraph,
  type OfferForensics,
} from "@/lib/forensics.functions";
import { claimGuestInvestigation } from "@/lib/claim.functions";
import {
  saveGuestCurrent,
  readGuestCurrent,
  clearGuestCurrent,
  type GuestRecord,
  type GuestEvidenceItem,
} from "@/lib/guest-storage";
import { generateReportPDF, downloadPDF } from "@/lib/report-pdf";
import { RISK_META } from "@/lib/scoring";
import {
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Save,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Trash2,
  LogIn,
  Upload,
  Image as ImageIcon,
  FileText,
  Mail,
  Type,
  Link2,
  Download,
  X,
  Paperclip,
  Brain,
  TargetIcon,
  PlayCircle,
  Users,
  FileWarning,
  Network,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/investigate")({
  ssr: false,
  component: GuestInvestigate,
});

type UploadStatus = "extracting" | "ready" | "error";

function GuestInvestigate() {
  const navigate = useNavigate();
  const runFn = useServerFn(runGuestInvestigation);
  const extractFn = useServerFn(extractEvidence);
  const narrateFn = useServerFn(narrate);
  const identityFn = useServerFn(analyzeIdentityGraph);
  const offerFn = useServerFn(analyzeOfferLetter);
  const claimFn = useServerFn(claimGuestInvestigation);

  const [evidence, setEvidence] = useState<
    Array<GuestEvidenceItem & { status: UploadStatus; error?: string }>
  >([]);
  const [freeUrl, setFreeUrl] = useState("");
  const [freeEmail, setFreeEmail] = useState("");
  const [freeText, setFreeText] = useState("");
  const [caseName, setCaseName] = useState("");

  const [running, setRunning] = useState(false);
  const [record, setRecord] = useState<GuestRecord | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [authOpen, setAuthOpen] = useState<null | "save" | "download">(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const r = readGuestCurrent();
    if (r) setRecord(r);
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        const id = crypto.randomUUID();
        const kind = detectKind(file);
        if (!kind) {
          toast.error(`Unsupported file type: ${file.name}`);
          continue;
        }
        const previewUrl = kind === "image" ? await fileToDataURL(file) : undefined;
        const placeholder: GuestEvidenceItem & { status: UploadStatus } = {
          id,
          kind,
          filename: file.name,
          extracted_text: "",
          channel: "unknown",
          urls: [],
          emails: [],
          phones: [],
          people: [],
          companies: [],
          amounts: [],
          payment_methods: [],
          red_flag_notes: [],
          preview_data_url: previewUrl,
          original_size: file.size,
          status: "extracting",
        };
        setEvidence((prev) => [...prev, placeholder]);
        try {
          let payload: string;
          if (kind === "image" || kind === "pdf") {
            payload = await fileToDataURL(file);
          } else {
            payload = await file.text();
          }
          const extracted = (await extractFn({
            data: { kind, filename: file.name, payload, mime_type: file.type || "" },
          })) as ExtractedEvidence;
          setEvidence((prev) =>
            prev.map((e) => (e.id === id ? { ...e, ...extracted, status: "ready" } : e)),
          );
          if (!caseName) {
            const guess = extracted.companies[0] || extracted.people[0] || file.name;
            setCaseName(guess.slice(0, 100));
          }
        } catch (err) {
          setEvidence((prev) =>
            prev.map((e) =>
              e.id === id ? { ...e, status: "error", error: (err as Error).message } : e,
            ),
          );
          toast.error(`Could not read ${file.name}: ${(err as Error).message}`);
        }
      }
    },
    [extractFn, caseName],
  );

  const addFreeText = async () => {
    const text = freeText.trim();
    if (!text) return;
    setFreeText("");
    const id = crypto.randomUUID();
    const placeholder: GuestEvidenceItem & { status: UploadStatus } = {
      id,
      kind: "text",
      filename: "",
      extracted_text: "",
      channel: "unknown",
      urls: [],
      emails: [],
      phones: [],
      people: [],
      companies: [],
      amounts: [],
      payment_methods: [],
      red_flag_notes: [],
      status: "extracting",
    };
    setEvidence((prev) => [...prev, placeholder]);
    try {
      const extracted = (await extractFn({
        data: { kind: "text", filename: "", payload: text, mime_type: "text/plain" },
      })) as ExtractedEvidence;
      setEvidence((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...extracted, status: "ready" } : e)),
      );
    } catch (err) {
      setEvidence((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, status: "error", error: (err as Error).message } : e,
        ),
      );
    }
  };

  const removeEvidence = (id: string) => setEvidence((prev) => prev.filter((e) => e.id !== id));

  const hasAnyEvidence =
    evidence.length > 0 || freeUrl.trim() || freeEmail.trim() || freeText.trim();
  const readyEvidence = evidence.filter((e) => e.status === "ready");
  const anyExtracting = evidence.some((e) => e.status === "extracting");

  const run = async () => {
    if (!hasAnyEvidence) return toast.error("Drop at least one piece of evidence first.");
    if (anyExtracting) return toast.error("Wait for evidence extraction to finish.");
    const finalName = caseName.trim() || "Untitled investigation";
    setRunning(true);
    try {
      const urls = freeUrl
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const emails = freeEmail
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      // include any typed free text as an inline evidence item too
      const evidencePayload: GuestEvidenceItem[] = readyEvidence.map(
        ({ status, error, ...rest }) => rest,
      );
      const result = (await runFn({
        data: { name: finalName, urls, emails, text: freeText.trim(), evidence: evidencePayload },
      })) as GuestResult;
      // Narrative + playbook match
      let narrative: Narrative | undefined;
      try {
        narrative = (await narrateFn({
          data: {
            case_name: finalName,
            trust_score: result.trust_score,
            risk_category: result.risk_category,
            fraud_probability: result.fraud_probability,
            weighted_score: result.weighted_score,
            positive_findings: result.positive_findings,
            negative_findings: result.negative_findings,
            verifications_summary: result.verifications_summary,
            evidence: evidencePayload.map((e) => ({
              kind: e.kind,
              filename: e.filename,
              extracted_text: e.extracted_text,
              channel: e.channel,
              urls: e.urls,
              emails: e.emails,
              phones: e.phones,
              payment_methods: e.payment_methods,
              red_flag_notes: e.red_flag_notes,
            })),
          },
        })) as Narrative;
      } catch (e) {
        console.warn("Narrative failed:", e);
      }
      const rec: GuestRecord = {
        id: crypto.randomUUID(),
        name: finalName,
        createdAt: new Date().toISOString(),
        input: { urls, emails, text: freeText.trim(), evidence: evidencePayload },
        result,
        narrative,
      };
      saveGuestCurrent(rec);
      setRecord(rec);
    } catch (e) {
      toast.error((e as Error).message || "Investigation failed");
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    clearGuestCurrent();
    setRecord(null);
    setEvidence([]);
    setFreeUrl("");
    setFreeEmail("");
    setFreeText("");
    setCaseName("");
  };

  const requireAuth = async (intent: "save" | "download"): Promise<boolean> => {
    const { data: sess } = await supabase.auth.getSession();
    if (sess.session) return true;
    setAuthOpen(intent);
    return false;
  };

  const doSave = async () => {
    if (!record) return;
    if (!(await requireAuth("save"))) return;
    setClaiming(true);
    try {
      const { id } = await claimFn({
        data: {
          name: record.name,
          input: { urls: record.input.urls, emails: record.input.emails, text: record.input.text },
          result: record.result,
        },
      });
      toast.success("Saved to your account");
      clearGuestCurrent();
      navigate({ to: "/investigations/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message || "Save failed");
    } finally {
      setClaiming(false);
    }
  };

  const doDownload = async () => {
    if (!record) return;
    if (!(await requireAuth("download"))) return;
    setDownloading(true);
    try {
      const bytes = await generateReportPDF(record);
      downloadPDF(bytes, `ANVIX_${record.name.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
      toast.success("Report downloaded");
    } catch (e) {
      toast.error((e as Error).message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div
      className="min-h-screen"
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current++;
        setDragOver(true);
      }}
      onDragLeave={() => {
        dragCounter.current--;
        if (dragCounter.current <= 0) setDragOver(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-primary/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary/60 bg-background/80 px-10 py-8 text-center">
            <Upload className="mx-auto h-8 w-8 text-primary" />
            <div className="mt-3 text-lg font-medium">Drop evidence to add it</div>
            <div className="text-xs text-muted-foreground">
              Screenshots · PDFs · Email files · Text
            </div>
          </div>
        </div>
      )}

      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold">
            ANVIX <span className="text-xs text-muted-foreground">· guest mode</span>
          </span>
        </div>
        <Link
          to="/auth"
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-accent"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        {!record && (
          <div className="space-y-6">
            <div>
              <div className="mono text-xs uppercase tracking-[0.22em] text-primary/80">
                Investigation intake
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Drop anything you have.
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                A screenshot of the recruiter's DM. The offer letter PDF. The forwarded email. A
                link. Even just a WhatsApp text you copied. ANVIX reads all of it, cross-checks it
                live, and tells you what scam pattern it matches and what they'll ask you for next.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              className="glass group cursor-pointer rounded-2xl border border-dashed border-border/70 p-8 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                <Upload className="h-5 w-5" />
              </div>
              <div className="mt-3 text-base font-medium">Click, or drop files here</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Screenshots · PDF offer letters · Forwarded .eml · Plain .txt — up to 20 items
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                accept="image/*,application/pdf,message/rfc822,.eml,text/plain,.txt"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Quick input strips */}
            <div className="grid gap-4 sm:grid-cols-3">
              <QuickInput
                icon={Link2}
                label="Add URL"
                placeholder="https://..."
                value={freeUrl}
                onChange={setFreeUrl}
              />
              <QuickInput
                icon={Mail}
                label="Add recruiter email"
                placeholder="alex@company.com"
                value={freeEmail}
                onChange={setFreeEmail}
              />
              <QuickPasteText value={freeText} onChange={setFreeText} onSubmit={addFreeText} />
            </div>

            {/* Evidence list */}
            {evidence.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium">Evidence collected · {evidence.length}</div>
                  <div className="text-xs text-muted-foreground">
                    {readyEvidence.length} ready · {anyExtracting ? "extracting…" : "all processed"}
                  </div>
                </div>
                <ul className="space-y-2">
                  {evidence.map((ev) => (
                    <EvidenceRow key={ev.id} ev={ev} onRemove={() => removeEvidence(ev.id)} />
                  ))}
                </ul>
              </div>
            )}

            {/* Run */}
            <div className="glass rounded-2xl p-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block">
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Case name (optional)
                  </div>
                  <input
                    className="input"
                    placeholder="e.g. 'Google recruiter Alex — LinkedIn DM'"
                    value={caseName}
                    onChange={(e) => setCaseName(e.target.value)}
                  />
                </label>
                <button
                  onClick={run}
                  disabled={running || anyExtracting || !hasAnyEvidence}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {running ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Investigating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Run investigation
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                No account required to investigate. Sign in only when you want to download the PDF
                or save history.
              </p>
            </div>
          </div>
        )}

        {record && (
          <ReportView
            record={record}
            onReset={reset}
            onSave={doSave}
            onDownload={doDownload}
            saving={claiming}
            downloading={downloading}
          />
        )}
      </main>

      {authOpen && (
        <AuthPrompt
          intent={authOpen}
          onClose={() => setAuthOpen(null)}
          onAuthed={() => {
            const i = authOpen;
            setAuthOpen(null);
            setTimeout(() => (i === "download" ? doDownload() : doSave()), 200);
          }}
        />
      )}
    </div>
  );
}

function detectKind(f: File): "image" | "pdf" | "eml" | "text" | null {
  const t = f.type.toLowerCase();
  const n = f.name.toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (t === "message/rfc822" || n.endsWith(".eml")) return "eml";
  if (t.startsWith("text/") || n.endsWith(".txt")) return "text";
  return null;
}

async function fileToDataURL(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

function QuickInput({
  icon: Icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  placeholder: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="glass block rounded-xl p-3">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <input
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function QuickPasteText({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Type className="h-3.5 w-3.5" /> Paste message / description
      </div>
      <textarea
        className="input min-h-[46px] resize-none"
        placeholder="Paste the WhatsApp thread, DM, or JD text…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value.trim().length > 0 && (
        <button
          onClick={onSubmit}
          className="mt-1.5 text-xs font-medium text-primary hover:underline"
        >
          + Extract entities from this text
        </button>
      )}
    </div>
  );
}

function EvidenceRow({
  ev,
  onRemove,
}: {
  ev: GuestEvidenceItem & { status: UploadStatus; error?: string };
  onRemove: () => void;
}) {
  const Icon =
    ev.kind === "image"
      ? ImageIcon
      : ev.kind === "pdf"
        ? FileText
        : ev.kind === "eml"
          ? Mail
          : Type;
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/50 p-3">
      {ev.preview_data_url ? (
        <img
          src={ev.preview_data_url}
          alt=""
          className="h-12 w-12 shrink-0 rounded-md object-cover ring-1 ring-border"
        />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/30">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium">{ev.filename || `${ev.kind} evidence`}</div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {ev.kind}
          </span>
          {ev.channel !== "unknown" && (
            <span className="text-[10px] text-muted-foreground">· {ev.channel}</span>
          )}
        </div>
        {ev.status === "extracting" && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-primary">
            <Loader2 className="h-3 w-3 animate-spin" /> Reading with AI…
          </div>
        )}
        {ev.status === "error" && (
          <div className="mt-1 text-xs text-destructive">Failed: {ev.error}</div>
        )}
        {ev.status === "ready" && (
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {ev.people.length > 0 && (
              <div>
                People: <span className="text-foreground">{ev.people.slice(0, 3).join(", ")}</span>
              </div>
            )}
            {ev.companies.length > 0 && (
              <div>
                Companies:{" "}
                <span className="text-foreground">{ev.companies.slice(0, 3).join(", ")}</span>
              </div>
            )}
            {ev.emails.length > 0 && (
              <div>
                Emails: <span className="text-foreground">{ev.emails.slice(0, 3).join(", ")}</span>
              </div>
            )}
            {ev.phones.length > 0 && (
              <div>
                Phones: <span className="text-foreground">{ev.phones.slice(0, 3).join(", ")}</span>
              </div>
            )}
            {ev.payment_methods.length > 0 && (
              <div className="text-destructive/90">
                Payment methods: {ev.payment_methods.join(", ")}
              </div>
            )}
            {ev.red_flag_notes.length > 0 && (
              <div className="text-warning">⚑ {ev.red_flag_notes[0]}</div>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function ReportView({
  record,
  onReset,
  onSave,
  onDownload,
  saving,
  downloading,
}: {
  record: GuestRecord;
  onReset: () => void;
  onSave: () => void;
  onDownload: () => void;
  saving: boolean;
  downloading: boolean;
}) {
  const r = record.result;
  const meta = RISK_META[r.risk_category];
  const n = record.narrative;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Trust report
          </div>
          <h1 className="mt-1 text-2xl font-semibold">{record.name}</h1>
          <div className="mt-1 text-xs text-muted-foreground">
            Ran {new Date(record.createdAt).toLocaleString()} · guest session ·{" "}
            {record.input.evidence.length} evidence item(s)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-accent"
          >
            <Trash2 className="h-4 w-4" /> New investigation
          </button>
          <button
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}{" "}
            Download PDF
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
            Save to history
          </button>
        </div>
      </div>

      {/* Headline card */}
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Trust score
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-6xl font-semibold tracking-tight" style={{ color: meta.color }}>
                {r.trust_score}
              </span>
              <span className="text-lg text-muted-foreground">/100</span>
            </div>
            <div
              className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: `${meta.color}18`, color: meta.color }}
            >
              {meta.label}
            </div>
          </div>
          <div className="grid gap-2 text-sm">
            <Stat
              label="ML fraud probability"
              value={`${(r.fraud_probability * 100).toFixed(1)}%`}
            />
            <Stat label="Weighted baseline" value={`${r.weighted_score}/100`} />
            <Stat label="Confidence" value={`${(r.confidence * 100).toFixed(0)}%`} />
            <Stat label="Evidence items" value={String(record.input.evidence.length)} />
          </div>
        </div>
        {n?.headline && (
          <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4 text-base font-medium">
            {n.headline}
          </div>
        )}
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {n?.narrative || r.summary}
        </p>
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <span className="font-medium text-primary">Recommendation:</span> {r.recommendation}
        </div>
      </div>

      {/* Playbook match — the wow moment */}
      {n?.playbook.playbook_id && (
        <div className="glass overflow-hidden rounded-2xl border border-warning/30 bg-warning/5">
          <div className="border-b border-warning/20 bg-warning/10 px-6 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-warning">
              <TargetIcon className="h-4 w-4" /> Scam playbook detected
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="text-xl font-semibold">{n.playbook.playbook_name}</div>
              <div className="text-xs text-muted-foreground">
                Confidence {(n.playbook.confidence * 100).toFixed(0)}%
                {n.playbook.current_step_index !== null
                  ? ` · at step ${n.playbook.current_step_index}`
                  : ""}
              </div>
            </div>
            {n.playbook.matched_signals.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {n.playbook.matched_signals.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            {n.next_predicted_asks.length > 0 && (
              <div className="mt-5">
                <div className="text-sm font-medium">What they'll likely ask you next</div>
                <ol className="mt-2 space-y-2">
                  {n.next_predicted_asks.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-md border border-border/60 bg-surface/60 p-3 text-sm"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-warning/20 text-xs font-semibold text-warning">
                        {i + 1}
                      </span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {n.playbook.what_to_do && (
              <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
                <span className="font-medium text-warning">What to do: </span>
                {n.playbook.what_to_do}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key evidence + Action */}
      <div className="grid gap-6 lg:grid-cols-2">
        {n?.key_evidence?.length ? (
          <div className="glass rounded-2xl p-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Brain className="h-4 w-4 text-primary" /> Key evidence cited
            </div>
            <ul className="space-y-2 text-sm">
              {n.key_evidence.map((e, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <FindingsCard
            title="What looks good"
            items={r.positive_findings}
            tone="pass"
            empty="No strong positive signals."
          />
        )}
        {n?.action_checklist?.length ? (
          <div className="glass rounded-2xl p-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <PlayCircle className="h-4 w-4 text-primary" /> Do this now
            </div>
            <ol className="space-y-2 text-sm">
              {n.action_checklist.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-xs text-primary">
                    {i + 1}
                  </span>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <FindingsCard
            title="Red flags"
            items={r.negative_findings}
            tone="fail"
            empty="No red flags detected."
          />
        )}
      </div>

      {n && (
        <div className="grid gap-6 lg:grid-cols-2">
          <FindingsCard
            title="What looks good"
            items={r.positive_findings}
            tone="pass"
            empty="No strong positive signals."
          />
          <FindingsCard
            title="Red flags"
            items={r.negative_findings}
            tone="fail"
            empty="No red flags detected."
          />
        </div>
      )}

      {/* Verifications */}
      <div className="glass rounded-2xl p-6">
        <div className="mb-3 text-sm font-medium">
          Live verifications ({r.verifications.length})
        </div>
        <ul className="divide-y divide-border/60">
          {r.verifications.map((v, i) => (
            <VItem key={i} v={v} />
          ))}
        </ul>
      </div>

      {/* Missing */}
      {r.missing_evidence.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 text-primary" /> Would strengthen this investigation
          </div>
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
            {r.missing_evidence.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {n?.disclaimer && (
        <div className="text-center text-xs text-muted-foreground">{n.disclaimer}</div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-surface/60 px-3 py-1.5 ring-1 ring-border/60">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function FindingsCard({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: string[];
  tone: "pass" | "fail";
  empty: string;
}) {
  const Icon = tone === "pass" ? CheckCircle2 : XCircle;
  const color = tone === "pass" ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-3 text-sm font-medium">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VItem({
  v,
}: {
  v: { category: string; check_name: string; status: string; score: number | null; detail: string };
}) {
  const Icon =
    v.status === "pass"
      ? CheckCircle2
      : v.status === "fail"
        ? XCircle
        : v.status === "warning"
          ? AlertTriangle
          : Paperclip;
  const color =
    v.status === "pass"
      ? "text-emerald-400"
      : v.status === "fail"
        ? "text-rose-400"
        : v.status === "warning"
          ? "text-amber-400"
          : "text-muted-foreground";
  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
          <div>
            <div className="text-sm font-medium">{v.check_name}</div>
            <div className="text-xs text-muted-foreground">{v.detail}</div>
          </div>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">{v.category}</div>
      </div>
    </li>
  );
}

function AuthPrompt({
  intent,
  onClose,
  onAuthed,
}: {
  intent: "save" | "download";
  onClose: () => void;
  onAuthed: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const fn = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error } = await fn.call(supabase.auth, { email, password });
      if (error) throw error;
      toast.success(mode === "signin" ? "Signed in" : "Account created");
      onAuthed();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    try {
      const { lovable } = await import("@/integrations/lovable");
      await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/investigate",
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const title =
    intent === "download"
      ? "Sign in to download your report"
      : "Sign in to save this investigation";
  const sub =
    intent === "download"
      ? "Your PDF report is generated instantly once you're signed in. It stays yours."
      : "Your report will be added to your account's history and stay available across devices.";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="glass w-full max-w-sm rounded-2xl p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <LogIn className="h-4 w-4 text-primary" /> {title}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        <div className="mt-4 space-y-3">
          <input
            className="input"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            onClick={submit}
            disabled={busy || !email || !password}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : mode === "signin" ? (
              "Sign in & continue"
            ) : (
              "Create account & continue"
            )}
          </button>
          <button
            onClick={google}
            className="w-full rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-accent"
          >
            Continue with Google
          </button>
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
          <button
            onClick={onClose}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
