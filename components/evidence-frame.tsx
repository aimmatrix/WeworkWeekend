import type { ReactNode } from "react"
import { Fraunces, Outfit } from "next/font/google"
import { WalletHeader } from "@/components/wallet-header"

const sans = Outfit({ subsets: ["latin"], variable: "--font-evidence-sans", display: "swap" })
const serif = Fraunces({ subsets: ["latin"], variable: "--font-evidence-serif", display: "swap" })

export function EvidenceFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${sans.variable} ${serif.variable} evidence-root mx-auto flex min-h-dvh max-w-md flex-col bg-[#f3efe6] text-[#16140f]`}
    >
      <style>{`
        .evidence-root { font-family: var(--font-evidence-sans), system-ui, sans-serif; }
        .evidence-root [class*="font-evidence-serif"] { font-family: var(--font-evidence-serif), Georgia, serif; }
      `}</style>
      <WalletHeader />
      {children}
    </div>
  )
}
