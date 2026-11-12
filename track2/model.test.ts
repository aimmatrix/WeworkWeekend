import assert from "node:assert/strict"
import test from "node:test"
import { buildAssessment, crewForChecklist, dirtScoreFromClutter } from "./assess"
import { offlineFallback } from "./backend"
import { normalizeAssess, normalizeVerify } from "./client"
import { groupByRoom } from "./group"
import { applyPublish, applyVerify, isCleanerThanBaseline } from "./reduce"
import { crewSizeForHours, sumHours, TARIFF } from "./tariff"
import { EMPTY_DB, type AssessTask, type Database, type Office, type Task } from "./types"

test("tariff hours and crew size", () => {
  assert.equal(TARIFF.length, 6)
  assert.deepEqual(
    TARIFF.map((row) => row.credit_hours),
    [3, 2, 1, 1, 0.5, 0.5],
  )
  assert.equal(sumHours(TARIFF.slice(0, 4).map((row) => row.credit_hours)), 7)
  assert.equal(sumHours(TARIFF.map((row) => row.credit_hours)), 8)
  assert.equal(crewSizeForHours(3), 1)
  assert.equal(crewSizeForHours(4), 1)
  assert.equal(crewSizeForHours(7), 2)
  assert.equal(crewSizeForHours(8), 2)
  assert.equal(crewSizeForHours(8.5), 3)
})

test("assessment follows photo order and the tariff", () => {
  const result = buildAssessment([
    { url: "a", clutter: 0.8 },
    { url: "b", clutter: 0.6 },
    { url: "c", clutter: 0.4 },
    { url: "d", clutter: 0.2 },
  ])
  assert.deepEqual(
    result.tasks.map((task) => task.category),
    ["toilet", "kitchen", "bins", "floor"],
  )
  assert.deepEqual(
    result.tasks.map((task) => task.credit_hours),
    [3, 2, 1, 1],
  )
  assert.deepEqual(
    result.tasks.map((task) => task.before_url),
    ["a", "b", "c", "d"],
  )
  assert.equal(result.crew_size, 2)
  assert.equal(result.dirt_score, 5)
  assert.equal(new Set(result.tasks.map((task) => task.id)).size, 4)
  assert.equal(dirtScoreFromClutter([1, 1]), 10)
  assert.equal(dirtScoreFromClutter([]), 0)
})

test("crew size stays with the API until the landlord edits the list", () => {
  const tasks = buildAssessment([
    { url: "a", clutter: 0.5 },
    { url: "b", clutter: 0.5 },
    { url: "c", clutter: 0.5 },
    { url: "d", clutter: 0.5 },
  ]).tasks
  assert.equal(crewForChecklist(9, tasks, tasks), 9)
  const kept = tasks.slice(0, 2)
  assert.equal(crewForChecklist(9, kept, tasks), 2)
})

test("normalize keeps the contract and fills missing task fields", () => {
  const custom = normalizeAssess(
    { dirt_score: 80.4, crew_size: 2, tasks: [{ category: "bins", title: "Custom bin job" }] },
    ["https://cdn.example/1.jpg"],
  )
  assert.equal(custom.dirt_score, 80)
  assert.equal(custom.crew_size, 2)
  assert.equal(custom.tasks[0]?.title, "Custom bin job")
  assert.equal(custom.tasks[0]?.credit_hours, 1)
  assert.equal(custom.tasks[0]?.room, "Kitchen")
  assert.equal(custom.tasks[0]?.before_url, "https://cdn.example/1.jpg")
  assert.ok(custom.tasks[0]?.id)

  const verified = normalizeVerify({
    passed: false,
    confidence: 2,
    reasons: ["  ", "The bin still looks full."],
    remaining_issues: ["Rubbish is still in the bin."],
    creditId: "",
  })
  assert.equal(verified.passed, false)
  assert.equal(verified.confidence, 1)
  assert.deepEqual(verified.reasons, ["The bin still looks full."])
  assert.deepEqual(verified.remaining_issues, ["Rubbish is still in the bin."])
  assert.equal("creditId" in verified, false)

  const passed = normalizeVerify({
    passed: true,
    confidence: 0.8,
    reasons: ["The bin looks empty."],
    remaining_issues: [],
    creditId: "credit-1",
  })
  assert.equal(passed.creditId, "credit-1")
})

test("rooms group into toilet, kitchen, then office", () => {
  const groups = groupByRoom([
    { room: "Office", id: 1 },
    { room: "Toilet", id: 2 },
    { room: "Kitchen", id: 3 },
    { room: "Office", id: 4 },
  ])
  assert.deepEqual(
    groups.map((group) => group.room),
    ["Toilet", "Kitchen", "Office"],
  )
  assert.deepEqual(
    groups[2]?.items.map((item) => item.id),
    [1, 4],
  )
})

test("verify writes a credit only when the photo passes", () => {
  const db = database()
  const failed = applyVerify(db, input({ passed: false, reasons: ["The bin still looks full."], remaining: ["Rubbish is still in the bin."] }))
  assert.equal(failed.response.passed, false)
  assert.equal("creditId" in failed.response, false)
  assert.equal(failed.db.credits.length, 0)
  assert.equal(failed.db.verifications.length, 1)
  assert.equal(failed.db.tasks[0]?.status, "claimed")
  assert.equal(failed.db.tasks[0]?.claimed_by, "Ada")
  assert.deepEqual(failed.response.reasons, ["The bin still looks full."])

  const passed = applyVerify(failed.db, input({ passed: true, reasons: ["The bin looks empty."], remaining: [], creditId: "c1", verificationId: "v2" }))
  assert.equal(passed.response.passed, true)
  assert.equal(passed.response.creditId, "c1")
  assert.equal(passed.db.credits.length, 1)
  assert.equal(passed.db.credits[0]?.hours, 1)
  assert.equal(passed.db.credits[0]?.founder, "Ada")
  assert.equal(passed.db.credits[0]?.supervisor_approved, false)
  assert.equal(passed.db.tasks[0]?.status, "done")
  assert.equal(passed.db.verifications.length, 2)

  const again = applyVerify(passed.db, input({ passed: true, reasons: ["ignore"], remaining: ["ignore"], creditId: "c2", verificationId: "v3" }))
  assert.equal(again.response.creditId, "c1")
  assert.equal(again.db.credits.length, 1)
  assert.equal(again.db.verifications.length, 2)
  assert.equal(isCleanerThanBaseline(again.db.tasks), true)
  assert.equal(isCleanerThanBaseline(failed.db.tasks), false)
  assert.equal(isCleanerThanBaseline([]), false)
})

test("publish stores a live office and open tasks", () => {
  const office: Office = {
    id: "office-1",
    name: "Harbour",
    address: "1 Quay",
    lat: 51.5,
    lng: -0.07,
    crew_size: 2,
    dirt_score: 70,
    status: "live",
  }
  const task = makeTask()
  const next = applyPublish(EMPTY_DB, office, [task])
  assert.equal(next.offices[0]?.status, "live")
  assert.equal(next.tasks[0]?.status, "open")
  assert.equal(next.tasks[0]?.before_url, "wew-photo://before")
})

function database(): Database {
  return { ...EMPTY_DB, offices: [], tasks: [makeTask()], verifications: [], credits: [] }
}

function makeTask(): Task {
  return {
    id: "task-1",
    office_id: "office-1",
    room: "Kitchen",
    title: "Empty the bins",
    category: "bins",
    credit_hours: 1,
    before_url: "wew-photo://before",
    status: "open",
    claimed_by: null,
  }
}

function input(options: {
  passed: boolean
  reasons: string[]
  remaining: string[]
  creditId?: string
  verificationId?: string
}) {
  return {
    taskId: "task-1",
    afterUrl: "wew-photo://after",
    decision: {
      passed: options.passed,
      confidence: options.passed ? 0.86 : 0.7,
      reasons: options.reasons,
      remaining_issues: options.remaining,
    },
    founder: "Ada",
    now: "2026-11-12T19:42:00.000Z",
    model: "mock-vision-v1",
    verificationId: options.verificationId ?? "v1",
    creditId: options.creditId ?? "c0",
  }
}

test("offline fallback ignores a real API rejection", () => {
  assert.equal(offlineFallback(new Error("Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")), true)
  assert.equal(offlineFallback(new Error("/api/offices failed (500)")), true)
  assert.equal(offlineFallback(new Error("TypeError Failed to fetch")), true)
  assert.equal(offlineFallback(new Error("Office not found")), false)
  assert.equal(offlineFallback(new Error("Task not found")), false)
  assert.equal(offlineFallback(new Error("name and address are required")), false)
  assert.equal(offlineFallback(new Error("This task is claimed by Ada.")), false)
})

test("checklist edits keep task identity", () => {
  const tasks: AssessTask[] = buildAssessment([
    { url: "a", clutter: 0.2 },
    { url: "b", clutter: 0.2 },
  ]).tasks
  assert.equal(tasks[0]?.category, "toilet")
  assert.equal(tasks[1]?.category, "kitchen")
})
