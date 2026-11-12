"use client";

import { useEffect, useState } from "react";

/** Before and after, stacked: drag the handle to wipe between them. Sweeps once on arrival to show it can. */
export function Compare({ before, after, title }: { before: string; after: string; title: string }) {
  const [pos, setPos] = useState(100);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // 100 -> 18 -> 50: reveal most of the after shot, then settle in the middle.
    let raf = 0;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = still ? 1 : Math.min(1, (now - start) / 1700);
      const p = t < 0.55 ? 100 - 82 * ease(t / 0.55) : 18 + 32 * ease((t - 0.55) / 0.45);
      setPos(p);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const wait = setTimeout(() => (raf = requestAnimationFrame(tick)), 350);
    return () => {
      clearTimeout(wait);
      cancelAnimationFrame(raf);
    };
  }, [touched]);

  return (
    <figure className="w-full">
      <div className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-[18px] bg-[#1c1c1e]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={`After: ${title}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt={`Before: ${title}`}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          draggable={false}
        />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-semibold backdrop-blur" style={{ opacity: pos > 12 ? 1 : 0 }}>
          Before
        </span>
        <span className="absolute right-2.5 top-2.5 rounded-full bg-[#30D158] px-2.5 py-1 text-[12px] font-semibold text-black" style={{ opacity: pos < 88 ? 1 : 0 }}>
          After
        </span>
        <span className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-white" style={{ left: `${pos}%` }}>
          <span className="gb-handle absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(pos)}
          onChange={(e) => {
            setTouched(true);
            setPos(Number(e.target.value));
          }}
          aria-label="Drag to compare before and after"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
    </figure>
  );
}
