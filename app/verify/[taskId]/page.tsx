import type { Metadata } from "next"
import { Suspense } from "react"
import { VerifyScreen } from "./verify-screen"

export const metadata: Metadata = {
  title: "Verify",
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<p className="px-5 py-8">Loading…</p>}>
      <VerifyScreen />
    </Suspense>
  )
}
