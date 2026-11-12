"use client"

import { Photo } from "@/components/photo"
import { Button, PrimaryLink } from "@/components/ui"
import { MOCK_MODEL } from "@/track2/reduce"
import { formatConfidence, formatHours, formatStamp } from "@/track2/text"

export type VerdictModel = {
  passed: boolean
  confidence: number
  reasons: string[]
  remaining: string[]
  beforeUrl: string
  afterUrl: string
  createdAt: string
  model: string
  hours: number
  title: string
  allClear: boolean
  walletHref?: string
}

type VerdictProps = {
  result: VerdictModel
  onRetry?: () => void
}

export function Verdict({ result, onRetry }: VerdictProps) {
  const grok = result.model.toLowerCase().includes("grok")
  return (
    <div className="px-5 py-6">
      <h1
        className={`inline-block border-[3px] px-3 py-1 [font-family:var(--font-evidence-serif)] text-5xl uppercase leading-none tracking-[0.12em] motion-safe:-rotate-2 ${result.passed ? "border-[#1c6b43] text-[#1c6b43]" : "border-[#9f1d16] text-[#9f1d16]"}`}
      >
        {result.passed ? "Pass" : "Fail"}
      </h1>
      <p className="mt-4 text-lg leading-snug">{result.title}</p>
      {result.passed ? (
        <p className="mt-6 font-mono text-6xl leading-none">{formatHours(result.hours)}</p>
      ) : null}
      {result.passed ? <p className="mt-2">earned for this task</p> : null}
      {!result.passed && result.remaining.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em]">Still dirty</h2>
          <ul className="mt-3 space-y-2 text-lg leading-snug">
            {result.remaining.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <figure>
          <Photo url={result.beforeUrl} alt="Before" className="aspect-[3/4] w-full object-cover" />
          <figcaption className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em]">Before</figcaption>
        </figure>
        <figure>
          <Photo url={result.afterUrl} alt="After" className="aspect-[3/4] w-full object-cover" />
          <figcaption className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em]">After</figcaption>
        </figure>
      </div>
      <section className="mt-6" aria-live="polite">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em]">{grok ? "What Grok saw" : "What we saw"}</h2>
        {result.reasons.length === 0 ? (
          <p className="mt-3 text-lg">No notes came back.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-lg leading-snug">
            {result.reasons.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        )}
      </section>
      {result.passed && result.allClear ? (
        <section className="mt-6 border border-[#16140f] bg-[#16140f] px-4 py-4 text-[#f3efe6]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#f0c14a]">Grok Pro reward</p>
          <h2 className="mt-2 [font-family:var(--font-evidence-serif)] text-3xl leading-none">Cleaner than baseline</h2>
          <p className="mt-3 leading-snug">Every task in this office passed. The place is cleaner than the morning photos.</p>
        </section>
      ) : null}
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-[#16140f]/60">
        {formatStamp(result.createdAt)} · London
      </p>
      <p className="mt-1 font-mono text-[11px] text-[#16140f]/50">
        Confidence {formatConfidence(result.confidence)}
        {result.model ? ` · ${result.model}` : ""}
      </p>
      <div className="mt-6">
        {result.passed ? <PrimaryLink href={result.walletHref || "/ledger"}>Wallet</PrimaryLink> : null}
        {!result.passed && onRetry ? (
          <Button onClick={onRetry} className="mt-3">
            Try again
          </Button>
        ) : null}
      </div>
      {result.passed && result.model === MOCK_MODEL ? (
        <p className="mt-3 text-sm leading-snug">These hours are saved on this phone. The shared ledger fills in once the office is online.</p>
      ) : null}
    </div>
  )
}
