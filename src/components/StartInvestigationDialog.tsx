import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createInvestigation, addEvidence } from "@/lib/investigations.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, Link as LinkIcon, FileText, Loader2 } from "lucide-react";

type PendingItem =
  | { kind: "url"; content: string }
  | { kind: "text"; content: string; label?: string }
  | { kind: "file"; file: File };

export function StartInvestigationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [items, setItems] = useState<PendingItem[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createFn = useServerFn(createInvestigation);
  const addFn = useServerFn(addEvidence);

  if (!open) return null;

  function close() {
    if (busy) return;
    setName("");
    setUrlInput("");
    setTextInput("");
    setItems([]);
    onOpenChange(false);
  }

  function addUrl() {
    const v = urlInput.trim();
    if (!v) return;
    setItems((s) => [...s, { kind: "url", content: v }]);
    setUrlInput("");
  }
  function addText() {
    const v = textInput.trim();
    if (!v) return;
    setItems((s) => [...s, { kind: "text", content: v }]);
    setTextInput("");
  }
  function addFiles(fl: FileList | null) {
    if (!fl) return;
    const arr = Array.from(fl).slice(0, 20);
    setItems((s) => [...s, ...arr.map((f) => ({ kind: "file" as const, file: f }))]);
  }

  async function start() {
    if (!name.trim()) {
      toast.error("Give your investigation a name.");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one piece of evidence.");
      return;
    }
    setBusy(true);
    try {
      const { id } = await createFn({ data: { name: name.trim() } });
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user!.id;

      // Upload files first
      const uploads = await Promise.all(
        items.map(async (it) => {
          if (it.kind !== "file") return null;
          const path = `${uid}/${id}/${crypto.randomUUID()}-${it.file.name}`;
          const { error } = await supabase.storage.from("evidence").upload(path, it.file, {
            contentType: it.file.type || "application/octet-stream",
          });
          if (error) throw new Error(`Upload failed for ${it.file.name}: ${error.message}`);
          return { path, file: it.file };
        }),
      );

      const payload = items.map((it, i) => {
        if (it.kind === "url")
          return { kind: "url" as const, content: it.content, label: it.content };
        if (it.kind === "text")
          return { kind: "text" as const, content: it.content, label: "Text note" };
        const u = uploads[i]!;
        return {
          kind: "file" as const,
          label: u.file.name,
          content: u.file.name,
          storage_path: u.path,
          mime_type: u.file.type || (null as unknown as string),
          size_bytes: u.file.size,
        };
      });

      await addFn({ data: { investigation_id: id, items: payload } });
      onCreated(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start investigation");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="glass w-full max-w-xl overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <div className="mono text-[10px] uppercase tracking-widest text-primary">
              New investigation
            </div>
            <div className="text-sm text-muted-foreground">
              Name it, drop evidence, and ANVIX takes over.
            </div>
          </div>
          <button
            onClick={close}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Investigation name, e.g. Acme Corp offer letter"
            className="w-full rounded-md border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
            maxLength={120}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="cursor-pointer rounded-lg border border-dashed border-border/80 bg-surface/50 p-6 text-center hover:border-primary/50 hover:bg-surface"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
            <div className="mt-2 text-sm">Drop files or click to upload</div>
            <div className="mono mt-1 text-[11px] text-muted-foreground">
              PDF · Images · Docs · Screenshots · Emails
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
                placeholder="Paste URL and press Enter"
                className="flex-1 rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addText())}
                placeholder="Paste text (chat, email) and press Enter"
                className="flex-1 rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
          </div>

          {items.length > 0 && (
            <div className="max-h-40 space-y-1.5 overflow-auto rounded-md border border-border/60 p-2">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded bg-surface/60 px-2 py-1.5 text-xs"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <span className="mono mr-2 text-[10px] uppercase text-muted-foreground">
                      {it.kind}
                    </span>
                    {it.kind === "file" ? it.file.name : it.content}
                  </div>
                  <button
                    onClick={() => setItems((s) => s.filter((_, k) => k !== i))}
                    className="ml-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="mono text-[11px] text-muted-foreground">
            {items.length} evidence item(s)
          </div>
          <div className="flex gap-2">
            <button
              onClick={close}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              onClick={start}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Start investigation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
