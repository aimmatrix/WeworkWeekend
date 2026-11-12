/** True when the public Supabase env was present at build time. */
export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * The backend never answered, so capture can keep the demo on this phone.
 * A real "not found" or validation error must not take that path.
 */
export function offlineFallback(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  if (/not found|already verified|claimed by|someone else|name and address|are required/i.test(message)) return false
  return /supabase env missing|missing-anon-key|failed to fetch|networkerror|load failed|econnrefused|fetch failed|enotfound|getaddrinfo|network request failed|failed \(5\d\d\)/i.test(
    message,
  )
}
