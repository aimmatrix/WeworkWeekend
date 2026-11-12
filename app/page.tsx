import { DM_Sans, Unbounded } from "next/font/google";
import Link from "next/link";
import "./find/find.css";
import { Blob } from "./grok/blob";
import "./grok/grok.css";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });

const links = [
  ["/find", "find", "find a desk", "founders: pick an office, clean it, work there"],
  ["/capture", "scan", "scan an office", "landlords: photograph the mess, grok prices it"],
  ["/grok", "grok", "grok bot", "landlords: your chief of staff, live from every building"],
  ["/landlord", "office-0", "your offices", "landlords: who's coming, who's in, ask grok"],
  ["/checkin", "door", "door list", "on-site lead: let the cleaners in"],
  ["/ledger", "credits", "my credits", "every hour traced back to its photos"],
  ["/supervisor", "supervisor", "supervisor queue", "approve or overturn grok"],
] as const;

export default function Home() {
  return (
    <main
      className={`find ${display.variable} ${body.variable} mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 bg-cover bg-center px-4 pb-8 pt-14 text-[15px] text-[#0B0B0C]`}
      style={{ backgroundImage: "url(/stickers/sky.jpg)" }}
    >
      <div className="relative px-1 pb-4 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/stickers/spray.png" alt="" className="absolute -top-6 right-2 h-24 w-24 rotate-12 object-contain drop-shadow-[0_6px_10px_rgba(15,30,60,0.35)]" />
        <h1 className="display text-[34px] leading-none [text-shadow:0_2px_12px_rgba(15,30,60,0.35)]">
          wework
          <br />
          weekend
        </h1>
        <p className="mt-3 max-w-[15rem] font-medium [text-shadow:0_1px_8px_rgba(15,30,60,0.45)]">empty offices at weekends. clean one, get a desk.</p>
      </div>

      {links.map(([href, sticker, title, sub], i) => (
        <Link key={href} href={href} className="flex items-center gap-4 rounded-[28px] bg-white/90 p-3 pr-5 shadow-[0_8px_24px_rgba(15,30,60,0.18)] backdrop-blur-md">
          {sticker === "grok" ? (
            <span className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-[#141414]">
              <Blob shape="circle" color="#FFFFFF" badge="star" size={50} />
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/stickers/${sticker}.png`}
              alt=""
              className={`h-[72px] w-[72px] shrink-0 object-contain drop-shadow-[0_4px_6px_rgba(15,30,60,0.3)] ${i % 2 ? "rotate-6" : "-rotate-6"}`}
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="display block text-lg leading-tight">{title}</span>
            <span className="mt-0.5 block text-sm text-[#4E5967]">{sub}</span>
          </span>
          <span aria-hidden className="display text-xl">
            →
          </span>
        </Link>
      ))}
    </main>
  );
}
