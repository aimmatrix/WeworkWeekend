"use client";

import { DM_Sans, Unbounded } from "next/font/google";
import { Suspense, useSyncExternalStore } from "react";
import { staticMap } from "./data";
import "./find.css";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });

// The founder name lives in localStorage. The server snapshot is null ("not known yet").
const subscribe = (cb: () => void) => {
  window.addEventListener("founder", cb);
  return () => window.removeEventListener("founder", cb);
};

const STEPS = [
  ["🗺️", "find a grim office near you"],
  ["💩", "claim a job. toilets pay best, sorry"],
  ["📸", "snap the after photo, get paid in desk hours"],
];

export default function FindLayout({ children }: { children: React.ReactNode }) {
  const founder = useSyncExternalStore<string | null>(subscribe, () => localStorage.getItem("founder") ?? "", () => null);
  const frame = `find ${display.variable} ${body.variable} relative mx-auto h-dvh w-full max-w-md overflow-y-auto bg-[#EEF3F9] text-[15px] text-[#0B0B0C]`;
  const map = staticMap(-0.105, 51.5215, 11.6, 448, 420);

  if (founder === "")
    return (
      <div className={`${frame} flex flex-col`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {map && <img src={map} alt="" className="absolute inset-x-0 top-0 h-[420px] w-full object-cover" />}
        <form
          className="relative mt-auto flex min-h-[62%] flex-col gap-5 rounded-t-[32px] bg-[#EEF3F9] px-5 pb-5 pt-7 shadow-[0_-8px_28px_rgba(15,30,60,0.12)]"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name")).trim();
            if (!name) return;
            localStorage.setItem("founder", name);
            window.dispatchEvent(new Event("founder"));
          }}
        >
          <h1 className="display text-[28px] leading-[1.15]">free desk this weekend. you just have to clean it.</h1>
          <ul className="flex flex-col gap-2.5">
            {STEPS.map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[22px] leading-none">
                  {icon}
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-2.5">
            <label className="px-1 text-sm text-[#4E5967]" htmlFor="name">
              what do we call you?
            </label>
            <input
              id="name"
              name="name"
              required
              autoComplete="given-name"
              placeholder="your name"
              className="h-14 rounded-full bg-[#0B0B0C] px-6 text-[17px] text-white outline-none placeholder:text-neutral-400"
            />
            <button className="display h-14 rounded-full bg-[#FF5A1F] text-[15px]">show me the mess</button>
          </div>
        </form>
      </div>
    );

  return (
    <div className={frame}>
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
