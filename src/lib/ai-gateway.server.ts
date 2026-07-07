// Server-only Lovable AI Gateway helper. Uses OpenAI-compatible chat
// completions surface. Never import from client code.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const body = {
    model: opts.model ?? "google/gemini-2.5-flash",
    messages: opts.messages,
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  };
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI Gateway ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = await res.json() as {
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
