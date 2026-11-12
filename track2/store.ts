import { EMPTY_DB, type Credit, type Database, type Office, type Task, type Verification } from "./types"

const KEY = "wew.db.v1"

export function readDb(): Database {
  if (typeof window === "undefined") return structuredClone(EMPTY_DB)
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return structuredClone(EMPTY_DB)
    const parsed = JSON.parse(raw) as Partial<Database>
    return {
      offices: Array.isArray(parsed.offices) ? parsed.offices : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      verifications: Array.isArray(parsed.verifications) ? parsed.verifications : [],
      credits: Array.isArray(parsed.credits) ? parsed.credits : [],
    }
  } catch {
    return structuredClone(EMPTY_DB)
  }
}

export function writeDb(db: Database): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, JSON.stringify(db))
  window.dispatchEvent(new Event("wew-db"))
}

export function getOffice(id: string): Office | null {
  return readDb().offices.find((office) => office.id === id) ?? null
}

export function getTask(id: string): Task | null {
  return readDb().tasks.find((task) => task.id === id) ?? null
}

export function tasksForOffice(officeId: string): Task[] {
  return readDb().tasks.filter((task) => task.office_id === officeId)
}

export function latestVerification(taskId: string): Verification | null {
  const list = readDb().verifications.filter((item) => item.task_id === taskId)
  return list.length === 0 ? null : (list[list.length - 1] ?? null)
}

export function listCredits(): Credit[] {
  return [...readDb().credits].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function totalHours(): number {
  const total = listCredits().reduce((sum, credit) => sum + credit.hours, 0)
  return Math.round(total * 10) / 10
}
