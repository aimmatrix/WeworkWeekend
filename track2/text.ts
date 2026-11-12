export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10
  return `${rounded}h`
}

export function formatStamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return "Something went wrong. Try again."
}
