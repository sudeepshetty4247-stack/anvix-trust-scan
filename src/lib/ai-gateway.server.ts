// Server-only AI Gateway helper. Uses OpenAI-compatible chat completions.
// - On Lovable Cloud: uses LOVABLE_API_KEY against Lovable's gateway.
// - On a local laptop: set GEMINI_API_KEY (from https://aistudio.google.com/apikey)
//   and it automatically falls back to Google's public Gemini endpoint.
// Never import from client code.

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: string | any[];
};

export async function callLovableAI(opts: {
  model?: string;
  messages: ChatMessage[];
  response_format?: { type: "json_object" };
  temperature?: number;
}): Promise<string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Pick provider automatically based on which key is present.
  const useGemini = !lovableKey && !!geminiKey;
  const key = useGemini ? geminiKey! : lovableKey;
  if (!key) {
    throw new Error(
      "No AI key configured. Set LOVABLE_API_KEY (on Lovable Cloud) or GEMINI_API_KEY (for local runs).",
    );
  }

  const requestedModel = opts.model ?? "google/gemini-2.5-flash";
  // Google's public endpoint expects the bare model id, e.g. "gemini-2.5-flash".
  const model = useGemini ? requestedModel.replace(/^google\//, "") : requestedModel;

  const body = {
    model,
    messages: opts.messages,
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  };

  const url = useGemini ? GEMINI_URL : LOVABLE_URL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (useGemini) {
    headers["Authorization"] = `Bearer ${key}`;
  } else {
    headers["Lovable-API-Key"] = key;
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const provider = useGemini ? "Gemini" : "Lovable AI Gateway";
    throw new Error(`${provider} ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

export async function callJSON<T>(opts: {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<T> {
  const text = await callLovableAI({ ...opts, response_format: { type: "json_object" } });
  try {
    return JSON.parse(text) as T;
  } catch {
    // Recover: extract first {...}
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI response was not valid JSON");
  }
}
