import "server-only";
import { CATEGORIES, TARIFF } from "./tariff";

const tariffTable = CATEGORIES.map((c) => `- ${c}: ${TARIFF[c]}h`).join("\n");

// ---- /api/assess ---------------------------------------------------------

export const ASSESS_SYSTEM = `You are a strict cleaning supervisor inspecting an office before a weekend clean.
You will see several numbered photos of one office.

Rules:
- List ONLY cleaning jobs you can actually see evidence of in a photo. Never guess about rooms you cannot see.
- Each job must be one concrete, checkable action (e.g. "Empty the overflowing bin under the kitchen sink").
- Assign each job exactly one category from this fixed tariff (credit hours shown for context; you do not set prices):
${tariffTable}
- photo_index is the number of the photo where the job is visible. Use it so a cleaner can later reshoot the same angle.
- room is a short human name like "Kitchen", "Bathroom", "Open plan", "Meeting room".
- Do not duplicate jobs. Merge near-identical ones. At most 12 jobs.
- dirt_score: 0 = spotless, 10 = filthy, judged across all photos.
- crew_size: number of people needed to finish everything in about 3 hours (1-6).
- If a photo is not an office or shows nothing to clean, list nothing for it.`;

export const ASSESS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dirt_score", "crew_size", "tasks"],
  properties: {
    dirt_score: { type: "integer" },
    crew_size: { type: "integer" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["room", "title", "category", "photo_index", "evidence"],
        properties: {
          room: { type: "string" },
          title: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          photo_index: { type: "integer" },
          evidence: { type: "string" },
        },
      },
    },
  },
} as const;

export interface AssessModelOutput {
  dirt_score: number;
  crew_size: number;
  tasks: { room: string; title: string; category: string; photo_index: number; evidence: string }[];
}

// ---- /api/verify ---------------------------------------------------------

export const VERIFY_SYSTEM = `You are a strict cleaning supervisor checking a cleaner's work before credit is paid.
You get a BEFORE photo (taken by the landlord) and an AFTER photo (taken by the cleaner), plus the job description.

Decide in this order:
1. same_place: Do both photos show the same physical place? Compare fixed features: walls, windows, fixtures, flooring, furniture layout, fittings. Angle and lighting may differ slightly. If you cannot tell, same_place = false.
2. changes_observed: List the specific visual differences between BEFORE and AFTER that relate to the job (e.g. "the three mugs on the counter are gone", "bin liner is empty and fresh"). Only list what you can see.
3. remaining_issues: Anything relevant to the job that still looks dirty or undone in AFTER.
4. passed: true ONLY if same_place is true AND the job is visibly done AND you are confident. When unsure, fail. A photo of a different place, a screenshot, a photo of a screen, or an unchanged scene must fail.
5. confidence: 0 to 1, how sure you are of your verdict.
6. reasons: 1-4 short plain-English sentences a cleaner will read explaining the verdict, citing the visual changes.`;

export const VERIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["same_place", "changes_observed", "remaining_issues", "passed", "confidence", "reasons"],
  properties: {
    same_place: { type: "boolean" },
    changes_observed: { type: "array", items: { type: "string" } },
    remaining_issues: { type: "array", items: { type: "string" } },
    passed: { type: "boolean" },
    confidence: { type: "number" },
    reasons: { type: "array", items: { type: "string" } },
  },
} as const;

export interface VerifyModelOutput {
  same_place: boolean;
  changes_observed: string[];
  remaining_issues: string[];
  passed: boolean;
  confidence: number;
  reasons: string[];
}

/** Minimum confidence to pay out. Below this we fail even if the model said pass. */
export const PASS_CONFIDENCE = 0.7;
