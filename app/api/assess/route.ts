import { agentVisionEnabled, agentVisionJSON } from "@/lib/agent-vision";
import { GROK_ASSESS_MODEL, grokEnabled, grokVisionJSON } from "@/lib/grok";
import { errMsg, fail, json, readBody } from "@/lib/http";
import { ASSESS_SCHEMA, ASSESS_SYSTEM, type AssessModelOutput } from "@/lib/prompts";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CATEGORIES, TARIFF } from "@/lib/tariff";
import type { AssessRequest, AssessResponse, Category, Task } from "@/lib/types";

export const maxDuration = 120;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

function mockOutput(photoUrls: string[]): AssessModelOutput {
  const rooms = ["Kitchen", "Bathroom", "Open plan", "Meeting room"];
  return {
    dirt_score: 6,
    crew_size: 2,
    tasks: photoUrls.map((_, i) => ({
      room: rooms[i % rooms.length],
      title: `[mock] Clean up area in photo ${i + 1}`,
      category: CATEGORIES[i % CATEGORIES.length],
      photo_index: i,
      evidence: "mock mode: XAI_API_KEY not set",
    })),
  };
}

export async function POST(req: Request) {
  const body = await readBody<AssessRequest>(req);
  const officeId = body?.officeId;
  const photoUrls = (body?.photoUrls ?? []).filter((u) => typeof u === "string" && u.length > 0);
  if (!officeId) return fail("officeId is required");
  if (photoUrls.length === 0) return fail("photoUrls must contain at least one URL");
  if (photoUrls.length > 8) return fail("At most 8 photos");

  const db = supabaseAdmin();
  const { data: office, error: officeErr } = await db.from("offices").select("id").eq("id", officeId).maybeSingle();
  if (officeErr) return fail(officeErr.message, 500);
  if (!office) return fail("Office not found", 404);

  let out: AssessModelOutput;
  try {
    if (grokEnabled()) {
      const res = await grokVisionJSON<AssessModelOutput>({
        route: "assess",
        system: ASSESS_SYSTEM,
        prompt: `Inspect these ${photoUrls.length} photos of one office and list the visible cleaning jobs.`,
        images: photoUrls.map((url, i) => ({ label: `Photo ${i}`, url: new URL(url, req.url).toString() })),
        schemaName: "office_assessment",
        schema: ASSESS_SCHEMA,
        model: GROK_ASSESS_MODEL,
      });
      out = res.data;
    } else if (agentVisionEnabled()) {
      const res = await agentVisionJSON<AssessModelOutput>({
        system: ASSESS_SYSTEM,
        prompt: `Inspect these ${photoUrls.length} photos of one office and list the visible cleaning jobs. JSON shape: ${JSON.stringify(ASSESS_SCHEMA.properties)}`,
        images: photoUrls,
        origin: req.url,
      });
      out = res.data;
    } else {
      out = mockOutput(photoUrls);
    }
  } catch (e) {
    return fail(`Assessment failed: ${errMsg(e)}`, 502);
  }

  // Price from OUR tariff, never the model's. Drop anything malformed.
  // One job per room+category (each is paid per category): merge duplicates into one title.
  const merged = new Map<string, { office_id: string; room: string; title: string; category: Category; credit_hours: number; before_url: string }>();
  for (const t of out.tasks ?? []) {
    if (!(CATEGORIES as string[]).includes(t.category) || !t.title?.trim()) continue;
    const room = t.room?.trim() || "Office";
    const key = `${room.toLowerCase()}|${t.category}`;
    const prev = merged.get(key);
    if (prev) {
      prev.title = `${prev.title}; ${t.title.trim().replace(/^./, (c) => c.toLowerCase())}`;
      continue;
    }
    merged.set(key, {
      office_id: officeId,
      room,
      title: t.title.trim(),
      category: t.category as Category,
      credit_hours: TARIFF[t.category as Category],
      before_url: photoUrls[clamp(t.photo_index, 0, photoUrls.length - 1)],
    });
  }
  const rows = [...merged.values()].slice(0, 12);

  const dirt_score = clamp(out.dirt_score, 0, 10);
  const crew_size = clamp(out.crew_size, 1, 6);

  // Re-assessing replaces any still-open tasks from a previous scan.
  await db.from("tasks").delete().eq("office_id", officeId).eq("status", "open");

  let tasks: Task[] = [];
  if (rows.length) {
    const { data, error } = await db.from("tasks").insert(rows).select("*");
    if (error) return fail(error.message, 500);
    tasks = (data as Task[]).sort((a, b) => b.credit_hours - a.credit_hours);
  }

  const { error: updErr } = await db
    .from("offices")
    .update({ dirt_score, crew_size, photo_urls: photoUrls })
    .eq("id", officeId);
  if (updErr) return fail(updErr.message, 500);

  return json({ dirt_score, crew_size, tasks } satisfies AssessResponse);
}
