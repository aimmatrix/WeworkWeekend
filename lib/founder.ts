// No auth: a founder is a name in localStorage under `founder`.
const KEY = "founder";

export function getFounder(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setFounder(name: string): void {
  try {
    window.localStorage.setItem(KEY, name.trim());
  } catch {
    /* private mode: ignore */
  }
}
