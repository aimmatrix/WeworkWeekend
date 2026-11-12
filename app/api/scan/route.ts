import { agentVisionEnabled, agentVisionJSON } from "@/lib/agent-vision";
import { errMsg, fail, json, readBody } from "@/lib/http";
import { ASSESS_SYSTEM, type AssessModelOutput } from "@/lib/prompts";
import { CATEGORIES, TARIFF } from "@/lib/tariff";
import type { Category } from "@/lib/types";

export const maxDuration = 180;

const SHAPE =
  '{"dirt_score": integer 0-10, "crew_size": integer 1-6, "tasks": [{"room": string, "title": string, "category": string, "photo_index": integer, "evidence": string}]}';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

/**
 * Looks at a landlord's photos and prices the cleaning jobs, without touching the database.
 * /capture uses it when there is no Supabase project to save to.
 */
export async function POST(req: Request) {
  const body = await readBody<{ photos?: unknown[] }>(req);
  const photos = (body?.photos ?? []).filter((p): p is string => typeof p === "string" && p.length > 0);
  if (photos.length === 0) return fail("photos must contain at least one image");
  if (photos.length > 8) return fail("At most 8 photos");
  if (!agentVisionEnabled()) return fail("No vision model is configured", 503);

  let out: AssessModelOutput;
  let model: string;
  try {
    const res = await agentVisionJSON<AssessModelOutput>({
      system: ASSESS_SYSTEM,
      prompt: `Inspect these ${photos.length} photos of one office and list the visible cleaning jobs. JSON shape: ${SHAPE}`,
      images: photos,
      // Behind a proxy req.url is the internal address, so rebuild the public one for relative photo paths.
      origin: `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host")}`,
    });
    out = res.data;
    model = res.model;
  } catch (e) {
    return fail(`Assessment failed: ${errMsg(e)}`, 502);
  }

  // Price from our tariff, never the model's. One job per room and category.
  const seen = new Map<string, { room: string; title: string; category: Category; credit_hours: number; photo_index: number; evidence: string }>();
  for (const t of out.tasks ?? []) {
    if (!(CATEGORIES as string[]).includes(t.category) || !t.title?.trim()) continue;
    const room = t.room?.trim() || "Office";
    const key = `${room.toLowerCase()}|${t.category}`;
    const prev = seen.get(key);
    if (prev) {
      prev.title = `${prev.title}; ${t.title.trim().replace(/^./, (c) => c.toLowerCase())}`;
      continue;
    }
    seen.set(key, {
      room,
      title: t.title.trim(),
      category: t.category as Category,
      credit_hours: TARIFF[t.category as Category],
      photo_index: clamp(t.photo_index, 0, photos.length - 1),
      evidence: String(t.evidence ?? ""),
    });
  }

  return json({
    dirt_score: clamp(out.dirt_score, 0, 10),
    crew_size: clamp(out.crew_size, 1, 6),
    tasks: [...seen.values()].slice(0, 12).sort((a, b) => b.credit_hours - a.credit_hours),
    model,
  });
}
