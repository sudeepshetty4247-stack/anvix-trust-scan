import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { runGuestInvestigation, type GuestResult } from "@/lib/guest.functions";
import { claimGuestInvestigation } from "@/lib/claim.functions";
import { saveGuestCurrent, readGuestCurrent, clearGuestCurrent, type GuestRecord } from "@/lib/guest-storage";
import { RISK_META } from "@/lib/scoring";
import { ShieldCheck, ArrowLeft, Loader2, Save, Sparkles, CheckCircle2, XCircle, AlertTriangle, MinusCircle, BrainCircuit, Info, Trash2, LogIn } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/investigate")({
  ssr: false,
  component: GuestInvestigate,
});

function GuestInvestigate() {
  const navigate = useNavigate();
  const runFn = useServerFn(runGuestInvestigation);
  const claimFn = useServerFn(claimGuestInvestigation);

  const [name, setName] = useState("");
  const [urls, setUrls] = useState("");
  const [emails, setEmails] = useState("");
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [record, setRecord] = useState<GuestRecord | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const r = readGuestCurrent();
    if (r) setRecord(r);
  }, []);

  const run = async () => {
    if (!name.trim()) return toast.error("Give the investigation a name");
    setRunning(true);
    try {
      const parsedUrls = urls.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
      const parsedEmails = emails.split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const result = await runFn({ data: { name: name.trim(), urls: parsedUrls, emails: parsedEmails, text: text.trim() } }) as GuestResult;
      const rec: GuestRecord = {
        id: crypto.randomUUID(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        input: { urls: parsedUrls, emails: parsedEmails, text: text.trim() },
        result,
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
    setName(""); setUrls(""); setEmails(""); setText("");
  };

  const saveToAccount = async () => {
    if (!record) return;
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      setAuthOpen(true);
      return;
    }
    setClaiming(true);
    try {
      const { id } = await claimFn({ data: { name: record.name, input: record.input, result: record.result } });
      toast.success("Saved to your account");
      clearGuestCurrent();
      navigate({ to: "/investigations/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message || "Save failed");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold">ANVIX <span className="text-xs text-muted-foreground">· guest mode</span></span>
        </div>
        <Link to="/auth" className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-accent">Sign in</Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        {!record && (
          <div className="glass rounded-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Start a new investigation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste anything suspicious — the job URL, recruiter email, the pitch they sent you.
              ANVIX runs live domain / DNS / SSL checks and scores it with a model trained on
              the Kaggle Fake Job Postings dataset (17,880 postings, 866 fraud-labeled).
            </p>

            <div className="mt-6 grid gap-4">
              <Field label="Case name" hint="e.g. 'Google recruiter Alex — LinkedIn DM'">
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Google recruiter Alex" />
              </Field>
              <Field label="URLs" hint="Job posting URL, company website, LinkedIn profile — one per line or comma-separated">
                <textarea value={urls} onChange={(e) => setUrls(e.target.value)} className="input min-h-[76px]" placeholder="https://careers.example.com/apply/12345&#10;https://example.com" />
              </Field>
              <Field label="Recruiter email(s)" hint="e.g. alex.recruiter@gmail.com">
                <textarea value={emails} onChange={(e) => setEmails(e.target.value)} className="input min-h-[60px]" placeholder="recruiter@company.com" />
              </Field>
              <Field label="Job description / message text" hint="Paste the pitch, DM, or description">
                <textarea value={text} onChange={(e) => setText(e.target.value)} className="input min-h-[140px]" placeholder="Hi! We are hiring for a work-from-home role. We just need a small $50 registration fee to activate your training portal..." />
              </Field>

              <button onClick={run} disabled={running} className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Investigating…</> : <><Sparkles className="h-4 w-4" /> Run investigation</>}
              </button>
              <p className="text-xs text-muted-foreground">No account required. Results live in your browser until you save them.</p>
            </div>
          </div>
        )}

        {record && <ReportView record={record} onReset={reset} onSave={saveToAccount} saving={claiming} />}
      </main>

      {authOpen && <AuthPrompt onClose={() => setAuthOpen(false)} onAuthed={saveToAccount} />}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function ReportView({ record, onReset, onSave, saving }: { record: GuestRecord; onReset: () => void; onSave: () => void; saving: boolean }) {
  const r = record.result;
  const meta = RISK_META[r.risk_category];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Trust report</div>
          <h1 className="mt-1 text-2xl font-semibold">{record.name}</h1>
          <div className="mt-1 text-xs text-muted-foreground">Ran {new Date(record.createdAt).toLocaleString()} · guest session</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onReset} className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-accent">
            <Trash2 className="h-4 w-4" /> Discard & new
          </button>
          <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save to history
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Trust score</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-6xl font-semibold tracking-tight" style={{ color: meta.color }}>{r.trust_score}</span>
              <span className="text-lg text-muted-foreground">/100</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium" style={{ background: `${meta.color}18`, color: meta.color }}>
              {meta.label}
            </div>
          </div>
          <div className="grid gap-2 text-sm">
            <Stat label="Model" value={r.model_used} />
            <Stat label="Kaggle-LR fraud probability" value={`${(r.fraud_probability * 100).toFixed(1)}%`} />
            <Stat label="Weighted baseline score" value={`${r.weighted_score}/100`} />
            <Stat label="Confidence" value={`${(r.confidence * 100).toFixed(0)}%`} />
          </div>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{r.summary}</p>
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <span className="font-medium text-primary">Recommendation:</span> {r.recommendation}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FindingsCard title="What looks good" items={r.positive_findings} tone="pass" empty="No strong positive signals." />
        <FindingsCard title="Red flags" items={r.negative_findings} tone="fail" empty="No red flags detected." />
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-sm font-medium"><BrainCircuit className="h-4 w-4 text-primary" /> Model details</div>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <Stat label="Training dataset" value={r.model_metadata.trained_on} />
          <Stat label="Rows" value={r.model_metadata.n_rows.toLocaleString()} />
          <Stat label="Fraud-labeled rows" value={r.model_metadata.n_fraud.toLocaleString()} />
          <Stat label="Best baseline" value={r.model_metadata.best_model} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left py-1.5 pr-3">Model</th><th className="text-right py-1.5 pr-3">Accuracy</th><th className="text-right py-1.5 pr-3">Precision</th><th className="text-right py-1.5 pr-3">Recall</th><th className="text-right py-1.5 pr-3">F1</th><th className="text-right py-1.5">ROC-AUC</th></tr>
            </thead>
            <tbody>
              {Object.entries(r.model_metadata.metrics).map(([n, m]) => (
                <tr key={n} className="border-t border-border/50">
                  <td className="py-1.5 pr-3 font-medium">{n}</td>
                  <td className="py-1.5 pr-3 text-right">{m.accuracy.toFixed(3)}</td>
                  <td className="py-1.5 pr-3 text-right">{m.precision.toFixed(3)}</td>
                  <td className="py-1.5 pr-3 text-right">{m.recall.toFixed(3)}</td>
                  <td className="py-1.5 pr-3 text-right">{m.f1.toFixed(3)}</td>
                  <td className="py-1.5 text-right">{m.roc_auc.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="mb-3 text-sm font-medium">Live verifications ({r.verifications.length})</div>
        <ul className="divide-y divide-border/60">
          {r.verifications.map((v, i) => <VItem key={i} v={v} />)}
        </ul>
      </div>

      {r.missing_evidence.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Info className="h-4 w-4 text-primary" /> Would strengthen this investigation</div>
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">{r.missing_evidence.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
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

function FindingsCard({ title, items, tone, empty }: { title: string; items: string[]; tone: "pass" | "fail"; empty: string }) {
  const Icon = tone === "pass" ? CheckCircle2 : XCircle;
  const color = tone === "pass" ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-3 text-sm font-medium">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul className="space-y-2">{items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} /><span>{it}</span></li>
        ))}</ul>
      )}
    </div>
  );
}

function VItem({ v }: { v: { category: string; check_name: string; status: string; score: number | null; detail: string } }) {
  const Icon = v.status === "pass" ? CheckCircle2 : v.status === "fail" ? XCircle : v.status === "warning" ? AlertTriangle : MinusCircle;
  const color = v.status === "pass" ? "text-emerald-400" : v.status === "fail" ? "text-rose-400" : v.status === "warning" ? "text-amber-400" : "text-muted-foreground";
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
        <div className="text-xs text-muted-foreground shrink-0">{v.category}</div>
      </div>
    </li>
  );
}

function AuthPrompt({ onClose, onAuthed }: { onClose: () => void; onAuthed: () => void }) {
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
      onClose();
      setTimeout(onAuthed, 300);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    try {
      const { lovable } = await import("@/integrations/lovable");
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/investigate" });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur">
      <div className="glass w-full max-w-sm rounded-2xl p-6">
        <div className="flex items-center gap-2 text-sm font-medium"><LogIn className="h-4 w-4 text-primary" /> Sign in to save this investigation</div>
        <p className="mt-1 text-xs text-muted-foreground">Your report will be added to your account's history and stay available across devices.</p>
        <div className="mt-4 space-y-3">
          <input className="input" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={submit} disabled={busy || !email || !password} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in & save" : "Create account & save"}
          </button>
          <button onClick={google} className="w-full rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-accent">Continue with Google</button>
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="w-full text-xs text-muted-foreground hover:text-foreground">
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
          <button onClick={onClose} className="w-full text-xs text-muted-foreground hover:text-foreground">Cancel — keep result local only</button>
        </div>
      </div>
    </div>
  );
}
