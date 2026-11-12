import type { ReactNode } from "react"
import { EvidenceFrame } from "@/components/evidence-frame"

export default function CaptureLayout({ children }: { children: ReactNode }) {
  return <EvidenceFrame>{children}</EvidenceFrame>
}
