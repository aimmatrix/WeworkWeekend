const KEY = "founder"

export function getFounder(): string {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(KEY)?.trim() ?? ""
}

export function setFounder(name: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, name.trim().slice(0, 80))
  window.dispatchEvent(new Event("wew-founder"))
}
