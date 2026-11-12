"use client";

import { useEffect, useState } from "react";
import type { Shape } from "./feed";

type Mood = "idle" | "thinking" | "still";

function Body({ shape }: { shape: Shape }) {
  switch (shape) {
    case "circle":
      return <circle cx="50" cy="52" r="44" />;
    case "squircle":
      return <path d="M22 16C42 4 80 8 90 32c10 24 2 52-24 58-26 6-54-2-58-28-4-22 0-38 14-46Z" />;
    case "bean":
      return <rect x="5" y="25" width="90" height="56" rx="28" transform="rotate(-7 50 53)" />;
    case "tilt":
      return <rect x="11" y="12" width="78" height="78" rx="28" transform="rotate(-14 50 51)" />;
    case "flower":
      return (
        <g>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <circle key={a} cx={Math.round((50 + 25 * Math.cos((a * Math.PI) / 180)) * 100) / 100} cy={Math.round((52 + 25 * Math.sin((a * Math.PI) / 180)) * 100) / 100} r="21" />
          ))}
          <circle cx="50" cy="52" r="30" />
        </g>
      );
  }
}

/**
 * A bot mascot: a soft shape with two slanted eyes. Idle, it breathes and blinks.
 * Thinking, it squashes and hops while its eyes dart about, like it's chewing on the problem.
 */
export function Blob({
  shape,
  color,
  size,
  mood = "idle",
  badge,
  live,
  ring = "#141414",
  delay = 0,
}: {
  shape: Shape;
  color: string;
  size: number;
  mood?: Mood;
  badge?: "star";
  live?: boolean;
  ring?: string;
  delay?: number;
}) {
  return (
    <span className={`gb-blob gb-${mood} relative inline-block shrink-0`} style={{ width: size, height: size, ["--d" as string]: `${delay}s` }} aria-hidden>
      <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
        <g className="gb-body" fill={color}>
          <Body shape={shape} />
          <g className="gb-eyes" fill="#111">
            <rect x="38" y="30" width="10" height="22" rx="5" transform="rotate(-24 43 41)" />
            <rect x="58" y="27" width="10" height="22" rx="5" transform="rotate(-24 63 38)" />
          </g>
        </g>
      </svg>
      {badge === "star" && (
        <span className="gb-star absolute grid place-items-center rounded-full bg-[#FF9F0A]" style={{ width: size * 0.32, height: size * 0.32, right: -size * 0.04, bottom: size * 0.0, boxShadow: `0 0 0 ${Math.max(2, size * 0.035)}px ${ring}` }}>
          <svg viewBox="0 0 24 24" width={size * 0.17} height={size * 0.17} fill="#fff">
            <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" />
          </svg>
        </span>
      )}
      {live && (
        <span
          className="gb-live absolute rounded-full bg-[#30D158]"
          style={{ width: size * 0.36, height: size * 0.36, right: -size * 0.08, bottom: -size * 0.06, boxShadow: `0 0 0 ${Math.max(2, size * 0.06)}px ${ring}` }}
        />
      )}
    </span>
  );
}

const VERBS = ["Chipping away", "Checking the door list", "Squinting at the photos", "Counting desk hours", "Reading the room", "Tallying the mop work"];

/** The "bot is thinking" row: a squashing blob and a shimmering verb that keeps changing. */
export function Thinking({ shape, color, lines = VERBS }: { shape: Shape; color: string; lines?: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="gb-pop flex items-center gap-3 py-1 pl-1" role="status" aria-label="Grok Bot is thinking">
      <Blob shape={shape} color={color} size={38} mood="thinking" />
      <span key={i} className="gb-shimmer gb-verb text-[17px]">
        {lines[i % lines.length]}
      </span>
    </div>
  );
}
