import { DM_Sans, Unbounded } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "../find/find.css";
import "../grok/grok.css";
import { Blob } from "../grok/blob";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });

export default function LandlordLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`find ${display.variable} ${body.variable} relative mx-auto h-dvh w-full max-w-md overflow-y-auto bg-[#EEF3F9] text-[15px] text-[#0B0B0C]`}>
      <Suspense fallback={null}>{children}</Suspense>
      {/* Grok Bot, the landlord's chief of staff: live updates on every building, and questions answered. */}
      <Link
        href="/grok/all"
        className="gb-press display fixed bottom-5 left-1/2 z-30 flex h-[56px] translate-x-[calc(min(100vw,28rem)/2-100%-16px)] items-center gap-2.5 rounded-full bg-[#141414] pl-2 pr-5 text-[13px] text-white shadow-[0_8px_20px_rgba(15,30,60,0.3)]"
      >
        <Blob shape="circle" color="#FFFFFF" badge="star" size={40} />
        grok bot
      </Link>
    </div>
  );
}
