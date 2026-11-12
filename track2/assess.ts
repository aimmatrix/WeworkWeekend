import { crewSizeForHours, sumHours, TARIFF } from "./tariff"
import type { AssessResponse, AssessTask } from "./types"

export function dirtScoreFromClutter(clutters: readonly number[]): number {
  if (clutters.length === 0) return 0
  const average = clutters.reduce((sum, value) => sum + value, 0) / clutters.length
  return Math.max(0, Math.min(10, Math.round(average * 10)))
}

export function buildAssessment(photos: readonly { url: string; clutter: number }[]): AssessResponse {
  const tasks = photos.map((photo, index) => {
    const row = TARIFF[index % TARIFF.length]
    if (!row) throw new Error("The tariff is empty.")
    return {
      id: crypto.randomUUID(),
      room: row.room,
      title: row.title,
      category: row.category,
      credit_hours: row.credit_hours,
      before_url: photo.url,
    }
  })
  return {
    dirt_score: dirtScoreFromClutter(photos.map((photo) => photo.clutter)),
    crew_size: crewSizeForHours(sumHours(tasks.map((task) => task.credit_hours))),
    tasks,
  }
}

export function crewForChecklist(apiCrew: number, tasks: readonly AssessTask[], original: readonly AssessTask[]): number {
  const same =
    tasks.length === original.length &&
    tasks.every(
      (task, index) => task.category === original[index]?.category && task.credit_hours === original[index]?.credit_hours,
    )
  if (same) return apiCrew
  return crewSizeForHours(sumHours(tasks.map((task) => task.credit_hours)))
}
