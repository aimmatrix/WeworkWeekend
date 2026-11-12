import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./grok.css";

export const metadata: Metadata = { title: "Grok Bot · WeWorkWeekend", description: "Your buildings' chief of staff." };
export const viewport: Viewport = { themeColor: "#141414", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function GrokLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gb relative mx-auto h-dvh w-full max-w-md overflow-hidden text-[17px]">
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
