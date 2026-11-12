import { grokEnabled, grokVisionJSON } from "@/lib/grok";
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
  const photoUrls = (body?.photoUrls ?? []).filter((u) => typeof u === "string" && u.startsWith("http"));
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
        images: photoUrls.map((url, i) => ({ label: `Photo ${i}`, url })),
        schemaName: "office_assessment",
        schema: ASSESS_SCHEMA,
      });
      out = res.data;
    } else {
      out = mockOutput(photoUrls);
    }
  } catch (e) {
    return fail(`Assessment failed: ${errMsg(e)}`, 502);
  }

  // Price from OUR tariff, never the model's. Drop anything malformed.
  const rows = (out.tasks ?? [])
    .filter((t) => (CATEGORIES as string[]).includes(t.category) && t.title?.trim())
    .slice(0, 12)
    .map((t) => {
      const idx = clamp(t.photo_index, 0, photoUrls.length - 1);
      return {
        office_id: officeId,
        room: t.room?.trim() || "Office",
        title: t.title.trim(),
        category: t.category as Category,
        credit_hours: TARIFF[t.category as Category],
        before_url: photoUrls[idx],
      };
    });

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
