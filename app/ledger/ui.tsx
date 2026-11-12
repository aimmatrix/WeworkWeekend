"use client";

import { useEffect, useState } from "react";
import { getFounder, setFounder } from "@/lib/founder";

/** Reads the founder name from localStorage; asks once if missing. */
export function useFounder(): [string | null, (n: string) => void, boolean] {
  const [founder, setF] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setF(getFounder());
    setReady(true);
  }, []);
  return [
    founder,
    (n: string) => {
      setFounder(n);
      setF(n.trim());
    },
    ready,
  ];
}

export function NamePrompt({ onSave }: { onSave: (n: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex flex-col gap-3 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name);
      }}
    >
      <label className="text-lg font-semibold">What&apos;s your name?</label>
      <input
        className="rounded-xl border border-black/15 bg-transparent px-4 py-3 text-base"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ada"
        autoFocus
      />
      <button className="rounded-xl bg-black py-3 font-semibold text-white dark:bg-white dark:text-black">Continue</button>
    </form>
  );
}

export function hours(n: number) {
  const v = Number(n);
  return `${Number.isInteger(v) ? v : v.toFixed(1)}h`;
}

export function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Badge({ tone, children }: { tone: "green" | "red" | "amber" | "grey"; children: React.ReactNode }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    red: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    grey: "bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function PhotoPair({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        ["Before", before],
        ["After", after],
      ].map(([label, src]) => (
        <a key={label} href={src} target="_blank" rel="noreferrer" className="block">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide opacity-60">{label}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${label} photo`} className="aspect-[3/4] w-full rounded-xl object-cover bg-black/5" />
        </a>
      ))}
    </div>
  );
}
