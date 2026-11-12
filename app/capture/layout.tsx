import { DM_Sans, Unbounded } from "next/font/google";
import "../find/find.css";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });

export default function CaptureLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`find ${display.variable} ${body.variable} relative mx-auto h-dvh w-full max-w-md overflow-y-auto bg-[#EEF3F9] text-[15px] text-[#0B0B0C]`}>
      {children}
    </div>
  );
}
