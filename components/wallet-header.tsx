"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { getBalance } from "@/lib/data"
import { supabaseConfigured } from "@/track2/backend"
import { getFounder, setFounder } from "@/track2/founder"
import { readDb } from "@/track2/store"
import { formatHours } from "@/track2/text"

export function WalletHeader() {
  const [name, setName] = useState("")
  const [draft, setDraft] = useState("")
  const [hours, setHours] = useState(0)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let dead = false
    async function load() {
      const founder = getFounder()
      if (dead) return
      setName(founder)
      const local = localHours(founder)
      if (!founder || !supabaseConfigured()) {
        setHours(local)
        return
      }
      try {
        const remote = await getBalance(founder)
        if (!dead) setHours(Number.isFinite(remote) ? remote : local)
      } catch {
        if (!dead) setHours(local)
      }
    }
    void load()
    window.addEventListener("wew-founder", load)
    window.addEventListener("wew-db", load)
    window.addEventListener("storage", load)
    return () => {
      dead = true
      window.removeEventListener("wew-founder", load)
      window.removeEventListener("wew-db", load)
      window.removeEventListener("storage", load)
    }
  }, [])

  function save(next: string) {
    setFounder(next)
    setName(next.trim().slice(0, 80))
    setEditing(false)
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#ddd4c6] bg-[#f3efe6]/95 px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      <Link href="/" className="[font-family:var(--font-evidence-serif)] text-xl leading-none tracking-[-0.03em]">
        WeWork<span className="italic text-[#e4461b]">Weekend</span>
      </Link>
      <div className="flex items-center gap-3">
        {editing ? (
          <input
            aria-label="Your name"
            autoFocus
            value={draft}
            maxLength={80}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => save(draft)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
              if (event.key === "Escape") {
                setDraft(name)
                setEditing(false)
              }
            }}
            className="h-9 w-28 border border-[#16140f] bg-[#fffdf8] px-2 text-sm outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(name)
              setEditing(true)
            }}
            className="max-w-[8.5rem] truncate text-sm underline decoration-[#16140f]/30 underline-offset-4"
          >
            {name || "Your name"}
          </button>
        )}
        <Link href="/ledger" aria-label={`Wallet, ${formatHours(hours)}`} className="font-mono text-sm">
          {formatHours(hours)}
        </Link>
      </div>
    </header>
  )
}

function localHours(founder: string): number {
  const credits = readDb().credits.filter((credit) => !founder || credit.founder === founder)
  const total = credits.reduce((sum, credit) => sum + credit.hours, 0)
  return Math.round(total * 10) / 10
}
