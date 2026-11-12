import type { ReactNode } from "react"

type ScreenProps = {
  eyebrow: string
  title: string
  children: ReactNode
  error?: string
  footer?: ReactNode
}

export function Screen({ eyebrow, title, children, error, footer }: ScreenProps) {
  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em]">{eyebrow}</p>
      <h1 className="mt-2 text-balance break-words [font-family:var(--font-evidence-serif)] text-4xl leading-[0.95] tracking-[-0.03em]">{title}</h1>
      {error ? (
        <p role="alert" className="mt-4 text-[#9f1d16]">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex-1">{children}</div>
      {footer ? (
        <div className="sticky bottom-0 -mx-5 mt-6 border-t border-[#ddd4c6] bg-[#f3efe6]/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      ) : null}
    </div>
  )
}
