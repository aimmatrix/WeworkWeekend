"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBalance, listCredits } from "@/lib/data";
import type { CreditWithEvidence } from "@/lib/types";
import { Badge, hours, NamePrompt, useFounder, when } from "./ui";

export default function LedgerPage() {
  const [founder, saveFounder, ready] = useFounder();
  const [credits, setCredits] = useState<CreditWithEvidence[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!founder) return;
    Promise.all([listCredits(founder), getBalance(founder)])
      .then(([c, b]) => {
        setCredits(c);
        setBalance(b);
      })
      .catch((e) => setError(e.message));
  }, [founder]);

  if (!ready) return null;
  if (!founder) return <NamePrompt onSave={saveFounder} />;

  const earned = credits?.reduce((s, c) => s + Number(c.hours), 0) ?? 0;

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-12 pt-6">
      <Link href="/find" className="text-sm opacity-60">
        ← Map
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Credit ledger</h1>
      <p className="text-sm opacity-60">{founder}&apos;s hours, each one traced to its photos.</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-black p-4 text-white dark:bg-white dark:text-black">
          <div className="text-xs uppercase opacity-70">Balance</div>
          <div className="text-3xl font-bold">{balance === null ? "…" : hours(balance)}</div>
        </div>
        <div className="rounded-2xl border border-black/10 p-4 dark:border-white/15">
          <div className="text-xs uppercase opacity-60">Earned</div>
          <div className="text-3xl font-bold">{hours(earned)}</div>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-rose-100 p-3 text-sm text-rose-800">{error}</p>}

      <ul className="mt-6 flex flex-col gap-3">
        {credits?.length === 0 && (
          <li className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm opacity-70 dark:border-white/20">
            No credits yet. Claim a task on the <Link href="/find" className="underline">map</Link>.
          </li>
        )}
        {credits?.map((c) => {
          const t = c.verification.task;
          return (
            <li key={c.id}>
              <Link
                href={`/ledger/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-black/10 p-3 active:scale-[0.99] dark:border-white/15"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.verification.after_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover bg-black/5" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.title}</div>
                  <div className="truncate text-xs opacity-60">
                    {t.office.name} · {when(c.created_at)}
                  </div>
                  <div className="mt-1">
                    {c.supervisor_approved ? <Badge tone="green">Supervisor approved</Badge> : <Badge tone="grey">Grok verified</Badge>}
                  </div>
                </div>
                <div className="text-lg font-bold text-emerald-600">+{hours(c.hours)}</div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
