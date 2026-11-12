import type { Database, Office, Task, Verification, VerifyResponse } from "./types"

export const MOCK_MODEL = "mock-vision-v1"

export type DecisionInput = {
  passed: boolean
  confidence: number
  reasons: string[]
  remaining_issues: string[]
}

export function isCleanerThanBaseline(tasks: readonly { status: string }[]): boolean {
  return tasks.length > 0 && tasks.every((task) => task.status === "done")
}

export function applyPublish(db: Database, office: Office, tasks: readonly Task[]): Database {
  return {
    ...db,
    offices: [...db.offices.filter((item) => item.id !== office.id), office],
    tasks: [...db.tasks.filter((item) => item.office_id !== office.id), ...tasks],
  }
}

export function applyVerify(
  db: Database,
  input: {
    taskId: string
    afterUrl: string
    decision: DecisionInput
    founder: string
    now: string
    model: string
    verificationId: string
    creditId: string
  },
): { db: Database; response: VerifyResponse } {
  const task = db.tasks.find((item) => item.id === input.taskId)
  if (!task) throw new Error("That task isn't on this phone.")

  if (task.status === "done") {
    const existing = latestPassed(db, task.id)
    if (existing) {
      const credit = db.credits.find((item) => item.verification_id === existing.id)
      return {
        db,
        response: {
          passed: true,
          confidence: existing.confidence,
          reasons: existing.reasons,
          remaining_issues: existing.remaining_issues,
          ...(credit ? { creditId: credit.id } : {}),
        },
      }
    }
  }

  const verification: Verification = {
    id: input.verificationId,
    task_id: task.id,
    after_url: input.afterUrl,
    passed: input.decision.passed,
    confidence: input.decision.confidence,
    reasons: input.decision.reasons,
    remaining_issues: input.decision.passed ? [] : input.decision.remaining_issues,
    model: input.model,
    created_at: input.now,
  }

  const nextTask: Task = {
    ...task,
    claimed_by: task.claimed_by || input.founder,
    status: input.decision.passed ? "done" : "claimed",
  }

  if (!input.decision.passed) {
    return {
      db: {
        ...db,
        tasks: replaceTask(db.tasks, nextTask),
        verifications: [...db.verifications, verification],
      },
      response: {
        passed: false,
        confidence: input.decision.confidence,
        reasons: input.decision.reasons,
        remaining_issues: input.decision.remaining_issues,
      },
    }
  }

  return {
    db: {
      ...db,
      tasks: replaceTask(db.tasks, nextTask),
      verifications: [...db.verifications, verification],
      credits: [
        ...db.credits,
        {
          id: input.creditId,
          founder: input.founder,
          hours: task.credit_hours,
          verification_id: verification.id,
          supervisor_approved: false,
          created_at: input.now,
        },
      ],
    },
    response: {
      passed: true,
      confidence: input.decision.confidence,
      reasons: input.decision.reasons,
      remaining_issues: [],
      creditId: input.creditId,
    },
  }
}

function latestPassed(db: Database, taskId: string): Verification | null {
  const list = db.verifications.filter((item) => item.task_id === taskId && item.passed)
  return list.length === 0 ? null : (list[list.length - 1] ?? null)
}

function replaceTask(tasks: readonly Task[], next: Task): Task[] {
  return tasks.map((item) => (item.id === next.id ? next : item))
}
