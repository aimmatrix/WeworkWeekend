import type { Metadata } from "next"
import { Suspense } from "react"
import { CaptureScreen } from "./capture-screen"

export const metadata: Metadata = {
  title: "Capture",
}

export default function CapturePage() {
  return (
    <Suspense fallback={<p className="px-5 py-8">Loading…</p>}>
      <CaptureScreen />
    </Suspense>
  )
}
