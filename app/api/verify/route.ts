import { grokEnabled, grokVisionJSON } from "@/lib/grok";
import { errMsg, fail, json, readBody } from "@/lib/http";
import { PASS_CONFIDENCE, VERIFY_SCHEMA, VERIFY_SYSTEM, type VerifyModelOutput } from "@/lib/prompts";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Task, VerifyRequest, VerifyResponse } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await readBody<VerifyRequest>(req);
  const taskId = body?.taskId;
  const afterUrl = body?.afterUrl;
  if (!taskId) return fail("taskId is required");
  if (!afterUrl) return fail("afterUrl is required");
  const abs = (u: string) => new URL(u, req.url).toString(); // seed photos are relative (/seed/...)

  const db = supabaseAdmin();
  const { data: task, error: taskErr } = await db.from("tasks").select("*").eq("id", taskId).maybeSingle<Task>();
  if (taskErr) return fail(taskErr.message, 500);
  if (!task) return fail("Task not found", 404);
  if (task.status === "done") return fail("Task already verified", 409);
  if (task.status !== "claimed" || !task.claimed_by) return fail("Claim the task before verifying it", 409);
  if (afterUrl === task.before_url) return fail("After photo is the same file as the before photo");

  let out: VerifyModelOutput;
  let model = "mock";
  let callId: string | null = null;
  try {
    if (grokEnabled()) {
      const res = await grokVisionJSON<VerifyModelOutput>({
        route: "verify",
        system: VERIFY_SYSTEM,
        prompt: `Job (${task.room}, category ${task.category}): "${task.title}". Compare BEFORE and AFTER and give your verdict.`,
        images: [
          { label: "BEFORE", url: abs(task.before_url) },
          { label: "AFTER", url: abs(afterUrl) },
        ],
        schemaName: "cleaning_verdict",
        schema: VERIFY_SCHEMA,
      });
      out = res.data;
      model = res.model;
      callId = res.callId;
    } else {
      out = {
        same_place: true,
        changes_observed: ["[mock] surface looks clear"],
        remaining_issues: [],
        passed: true,
        confidence: 0.9,
        reasons: ["[mock] XAI_API_KEY not set, auto-pass for development."],
      };
    }
  } catch (e) {
    return fail(`Verification failed: ${errMsg(e)}`, 502);
  }

  // Server-side guardrails: fail closed.
  const confidence = Math.max(0, Math.min(1, Number(out.confidence) || 0));
  const reasons = [...(out.reasons ?? [])];
  const remaining = [...(out.remaining_issues ?? [])];
  let passed = Boolean(out.passed);
  if (!out.same_place) {
    passed = false;
    if (!remaining.length) remaining.push("Retake the after photo from the same spot as the before photo.");
    reasons.push("The two photos don't look like the same place.");
  } else if (passed && confidence < PASS_CONFIDENCE) {
    passed = false;
    reasons.push(`Not confident enough to pay out (${Math.round(confidence * 100)}%). Try a clearer photo.`);
  }
  // Keep the visual evidence in the record so the ledger can show it.
  const evidence = (out.changes_observed ?? []).map((c) => `Seen: ${c}`);

  const { data: ver, error: verErr } = await db
    .from("verifications")
    .insert({
      task_id: task.id,
      founder: task.claimed_by,
      after_url: afterUrl,
      passed,
      confidence,
      reasons: [...reasons, ...evidence],
      remaining_issues: remaining,
      same_place: out.same_place,
      model,
      model_call_id: callId,
    })
    .select("id")
    .single();
  if (verErr) return fail(verErr.message, 500);

  let creditId: string | undefined;
  if (passed) {
    // Guard against double-pay: only flip claimed -> done once.
    const { data: flipped } = await db
      .from("tasks")
      .update({ status: "done" })
      .eq("id", task.id)
      .eq("status", "claimed")
      .select("id");
    if (flipped?.length) {
      const { data: credit, error: credErr } = await db
        .from("credits")
        .insert({ founder: task.claimed_by, hours: task.credit_hours, verification_id: ver.id })
        .select("id")
        .single();
      if (credErr) return fail(credErr.message, 500);
      creditId = credit.id;
    }
  }

  return json({
    passed,
    confidence,
    reasons: [...reasons, ...evidence],
    remaining_issues: remaining,
    creditId,
    verificationId: ver.id,
    hours: passed ? Number(task.credit_hours) : undefined,
  } satisfies VerifyResponse);
}
