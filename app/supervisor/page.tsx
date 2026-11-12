"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supervise } from "@/lib/api";
import { listPendingVerifications } from "@/lib/data";
import type { Office, Task, Verification } from "@/lib/types";
import { Badge, hours, PhotoPair, when } from "../ledger/ui";

type Item = Verification & { task: Task & { office: Office } };

export default function SupervisorPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listPendingVerifications().then(setItems).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  async function act(v: Item, action: "approve" | "overturn") {
    setBusy(v.id);
    setError(null);
    try {
      await supervise({ verificationId: v.id, action });
      setItems((xs) => xs?.filter((x) => x.id !== v.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-12 pt-6">
      <Link href="/" className="text-sm opacity-60">
        ← Home
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Supervisor queue</h1>
      <p className="text-sm opacity-60">Approve Grok&apos;s verdict, or overturn it. Overturning a pass removes the credit.</p>

      {error && <p className="mt-4 rounded-xl bg-rose-100 p-3 text-sm text-rose-800">{error}</p>}
      {items === null && <p className="mt-6 opacity-60">Loading…</p>}
      {items?.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm opacity-70 dark:border-white/20">
          Queue is clear.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-6">
        {items?.map((v) => {
          const reasons = v.reasons.filter((r) => !r.startsWith("Seen: "));
          return (
            <li key={v.id} className="rounded-2xl border border-black/10 p-4 dark:border-white/15">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{v.task.title}</div>
                  <div className="text-xs opacity-60">
                    {v.task.office.name} · {v.founder} · {when(v.created_at)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {v.passed ? <Badge tone="green">Pass</Badge> : <Badge tone="red">Fail</Badge>}
                  <span className="text-xs opacity-60">
                    {Math.round(Number(v.confidence) * 100)}% · {hours(v.task.credit_hours)}
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <PhotoPair before={v.task.before_url} after={v.after_url} />
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
                {v.remaining_issues.map((r, i) => (
                  <li key={`r${i}`} className="text-rose-700 dark:text-rose-400">
                    Still dirty: {r}
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  disabled={busy === v.id}
                  onClick={() => act(v, "overturn")}
                  className="rounded-xl border border-black/15 py-3 font-semibold disabled:opacity-40 dark:border-white/20"
                >
                  {v.passed ? "Overturn (remove)" : "Overturn (award)"}
                </button>
                <button
                  disabled={busy === v.id}
                  onClick={() => act(v, "approve")}
                  className="rounded-xl bg-black py-3 font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
                >
                  Approve
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
