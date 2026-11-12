import { agentVisionEnabled, agentVisionJSON } from "@/lib/agent-vision";
import { errMsg, fail, json, readBody } from "@/lib/http";
import { PASS_CONFIDENCE, VERIFY_SYSTEM, type VerifyModelOutput } from "@/lib/prompts";

export const maxDuration = 180;

const SHAPE =
  '{"same_place": boolean, "changes_observed": string[], "remaining_issues": string[], "passed": boolean, "confidence": number 0-1, "reasons": string[]}';

/**
 * Compares a before and an after photo for one job, without touching the database.
 * /verify uses it when there is no Supabase project to save the verdict to.
 */
export async function POST(req: Request) {
  const body = await readBody<{ before?: string; after?: string; title?: string; room?: string; category?: string }>(req);
  if (!body?.before || !body.after) return fail("before and after photos are required");
  if (body.before === body.after) return fail("After photo is the same file as the before photo");
  if (!agentVisionEnabled()) return fail("No vision model is configured", 503);

  let out: VerifyModelOutput;
  let model: string;
  try {
    const res = await agentVisionJSON<VerifyModelOutput>({
      system: VERIFY_SYSTEM,
      prompt: `Job (${body.room ?? "office"}, category ${body.category ?? "cleaning"}): "${String(body.title ?? "").slice(0, 300)}". photo0.jpg is BEFORE and photo1.jpg is AFTER. Compare them and give your verdict. JSON shape: ${SHAPE}`,
      images: [body.before, body.after],
      origin: `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host")}`,
    });
    out = res.data;
    model = res.model;
  } catch (e) {
    return fail(`Verification failed: ${errMsg(e)}`, 502);
  }

  // Same guardrails as /api/verify: fail closed.
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

  return json({ passed, confidence, reasons: [...reasons, ...(out.changes_observed ?? []).map((c) => `Seen: ${c}`)], remaining_issues: remaining, model });
}
