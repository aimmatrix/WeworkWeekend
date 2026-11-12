import "server-only";
import { supabaseAdmin } from "./supabase-admin";

const XAI_URL = "https://api.x.ai/v1/chat/completions";
export const GROK_MODEL = process.env.GROK_MODEL || "grok-4";
export const grokEnabled = () => Boolean(process.env.XAI_API_KEY);

type Part =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" } };

export interface GrokImage {
  label: string; // shown to the model before the image, e.g. "Photo 0" or "BEFORE"
  url: string;
}

/** Fetch an image server-side and inline it, so Grok never has to reach our storage. */
async function inline(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Could not fetch image ${url} (${res.status})`);
  let type = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  if (type !== "image/png") type = "image/jpeg"; // xAI accepts jpeg/png
  const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  return `data:${type};base64,${b64}`;
}

async function logCall(row: {
  route: string;
  model: string;
  request: unknown;
  response?: unknown;
  raw?: string;
  latency_ms: number;
  error?: string;
}): Promise<string | null> {
  console.log(
    `[grok] ${row.route} model=${row.model} ${row.latency_ms}ms ${row.error ? "ERROR " + row.error : "ok"}`,
  );
  try {
    const { data } = await supabaseAdmin().from("model_calls").insert(row).select("id").single();
    return data?.id ?? null;
  } catch (e) {
    console.error("[grok] failed to log model call", e);
    return null;
  }
}

function parseJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  return JSON.parse(cleaned);
}

/**
 * One vision call that must return JSON matching `schema`. Every call is logged to model_calls
 * (images are logged by URL, not by bytes).
 */
export async function grokVisionJSON<T>(opts: {
  route: string;
  system: string;
  prompt: string;
  images: GrokImage[];
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<{ data: T; model: string; callId: string | null }> {
  const started = Date.now();
  const logRequest = {
    system: opts.system,
    prompt: opts.prompt,
    images: opts.images,
    schema: opts.schemaName,
  };

  try {
    const content: Part[] = [{ type: "text", text: opts.prompt }];
    const inlined = await Promise.all(opts.images.map((i) => inline(i.url)));
    opts.images.forEach((img, i) => {
      content.push({ type: "text", text: img.label });
      content.push({ type: "image_url", image_url: { url: inlined[i], detail: "high" } });
    });

    const res = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, schema: opts.schema, strict: true },
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`xAI ${res.status}: ${JSON.stringify(body?.error ?? body)}`);

    const raw: string = body?.choices?.[0]?.message?.content ?? "";
    const model: string = body?.model ?? GROK_MODEL;
    const data = parseJson(raw) as T;
    const callId = await logCall({
      route: opts.route,
      model,
      request: logRequest,
      response: data as unknown,
      raw,
      latency_ms: Date.now() - started,
    });
    return { data, model, callId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCall({ route: opts.route, model: GROK_MODEL, request: logRequest, latency_ms: Date.now() - started, error: msg });
    throw e;
  }
}
