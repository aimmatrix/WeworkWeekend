import { mockAssess, mockVerify } from "./mock-server"
import { preparePhoto, putPhoto } from "./photos"
import { TARIFF, tariffFor } from "./tariff"
import type { AssessRequest, AssessResponse, AssessTask, VerifyRequest, VerifyResponse } from "./types"

/**
 * Local stand-in used when Supabase is not configured or the API cannot be reached.
 * Capture and verify call @/lib/api first, and these functions only for that fallback.
 */
export const USE_MOCK_API = true

type RawTask = Partial<AssessTask>
type RawAssess = {
  dirt_score?: number
  crew_size?: number
  tasks?: RawTask[]
}
type RawVerify = {
  passed?: boolean
  confidence?: number
  reasons?: unknown
  remaining_issues?: unknown
  creditId?: string
}

export async function uploadPhoto(file: File): Promise<string> {
  const prepared = await preparePhoto(file)
  return putPhoto(prepared)
}

export async function assess(body: AssessRequest): Promise<AssessResponse> {
  const raw = USE_MOCK_API ? await mockAssess(body) : await postJson<RawAssess>("/api/assess", body)
  return normalizeAssess(raw, body.photoUrls)
}

export async function verify(body: VerifyRequest): Promise<VerifyResponse> {
  const raw = USE_MOCK_API ? await mockVerify(body) : await postJson<RawVerify>("/api/verify", body)
  return normalizeVerify(raw)
}

export function normalizeAssess(raw: RawAssess, photoUrls: readonly string[]): AssessResponse {
  return {
    dirt_score: clampScore(raw.dirt_score),
    crew_size: clampCrew(raw.crew_size),
    tasks: (raw.tasks ?? []).map((task, index) => normalizeTask(task, index, photoUrls)),
  }
}

export function normalizeVerify(raw: RawVerify): VerifyResponse {
  const response: VerifyResponse = {
    passed: Boolean(raw.passed),
    confidence: clamp01(typeof raw.confidence === "number" ? raw.confidence : 0),
    reasons: asStrings(raw.reasons),
    remaining_issues: asStrings(raw.remaining_issues),
  }
  if (raw.creditId) response.creditId = String(raw.creditId)
  return response
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`The check failed (${response.status}).`)
  try {
    return (await response.json()) as T
  } catch {
    throw new Error("The check returned something we couldn't read.")
  }
}

function normalizeTask(task: RawTask, index: number, photoUrls: readonly string[]): AssessTask {
  const fallback = TARIFF[index % TARIFF.length]
  if (!fallback) throw new Error("The tariff is empty.")
  const known = task.category ? tariffFor(task.category) : null
  const row = known ?? fallback
  return {
    id: task.id || crypto.randomUUID(),
    room: task.room || row.room,
    title: task.title || row.title,
    category: known?.category || task.category || row.category,
    credit_hours: typeof task.credit_hours === "number" ? task.credit_hours : row.credit_hours,
    before_url: task.before_url || photoUrls[index] || "",
  }
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item)).filter((item) => item.trim().length > 0)
}

function clampScore(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function clampCrew(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 1
  return Math.max(1, Math.round(value))
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}
