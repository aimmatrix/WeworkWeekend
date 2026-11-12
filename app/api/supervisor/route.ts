import { fail, json, readBody } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { SupervisorRequest, Task, Verification } from "@/lib/types";

/**
 * On-site lead approves or overturns a Grok verdict.
 * - approve:   mark reviewed; credit (if any) becomes supervisor_approved.
 * - overturn a pass: credit is removed, task goes back to "claimed" so the founder can redo it.
 * - overturn a fail: the founder is awarded the credit and the task is done.
 */
export async function POST(req: Request) {
  const body = await readBody<SupervisorRequest>(req);
  if (!body?.verificationId || !["approve", "overturn"].includes(body.action)) {
    return fail("verificationId and action (approve|overturn) are required");
  }
  const db = supabaseAdmin();
  const { data: v, error } = await db
    .from("verifications")
    .select("*, task:tasks(*)")
    .eq("id", body.verificationId)
    .maybeSingle<Verification & { task: Task }>();
  if (error) return fail(error.message, 500);
  if (!v) return fail("Verification not found", 404);
  if (v.review !== "pending") return fail(`Already ${v.review}`, 409);

  const now = new Date().toISOString();

  if (body.action === "approve") {
    await db.from("verifications").update({ review: "approved", reviewed_at: now }).eq("id", v.id);
    if (v.passed) await db.from("credits").update({ supervisor_approved: true }).eq("verification_id", v.id);
    return json({ ok: true });
  }

  // overturn
  await db.from("verifications").update({ review: "overturned", reviewed_at: now }).eq("id", v.id);
  if (v.passed) {
    await db.from("credits").delete().eq("verification_id", v.id);
    await db.from("tasks").update({ status: "claimed" }).eq("id", v.task_id);
  } else if (v.task.status !== "done" && v.founder) {
    await db.from("tasks").update({ status: "done" }).eq("id", v.task_id);
    await db.from("credits").insert({
      founder: v.founder,
      hours: v.task.credit_hours,
      verification_id: v.id,
      supervisor_approved: true,
    });
  }
  return json({ ok: true });
}
