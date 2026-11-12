"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getCredit } from "@/lib/data";
import { CATEGORY_LABEL } from "@/lib/tariff";
import type { CreditWithEvidence } from "@/lib/types";
import { Badge, hours, PhotoPair, when } from "../ui";

export default function CreditView() {
  const { creditId } = useParams<{ creditId: string }>();
  const [credit, setCredit] = useState<CreditWithEvidence | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCredit(creditId).then(setCredit).catch((e) => setError(e.message));
  }, [creditId]);

  if (error) return <p className="p-6 text-rose-700">{error}</p>;
  if (credit === undefined) return <p className="p-6 opacity-60">Loading evidence…</p>;
  if (credit === null) return <p className="p-6">Credit not found (it may have been overturned).</p>;

  const v = credit.verification;
  const t = v.task;
  const seen = v.reasons.filter((r) => r.startsWith("Seen: ")).map((r) => r.slice(6));
  const reasons = v.reasons.filter((r) => !r.startsWith("Seen: "));

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-12 pt-6">
      <Link href="/ledger" className="text-sm opacity-60">
        ← Ledger
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.title}</h1>
          <p className="text-sm opacity-60">
            {t.room} · {t.office.name}
          </p>
        </div>
        <div className="text-2xl font-bold text-emerald-600">+{hours(credit.hours)}</div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Badge tone="grey">{CATEGORY_LABEL[t.category]}</Badge>
        {v.passed ? <Badge tone="green">Passed</Badge> : <Badge tone="red">Failed</Badge>}
        {v.review === "approved" && <Badge tone="green">Supervisor approved</Badge>}
        {v.review === "pending" && <Badge tone="amber">Awaiting supervisor</Badge>}
        {v.review === "overturned" && <Badge tone="amber">Supervisor overturned Grok</Badge>}
      </div>

      <section className="mt-5">
        <PhotoPair before={t.before_url} after={v.after_url} />
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Grok&apos;s reasons</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      {seen.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Visual changes relied on</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {seen.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-black/10 p-4 text-sm dark:border-white/15">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-60">Evidence trail</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="opacity-60">Confidence</dt>
          <dd className="font-medium">{Math.round(Number(v.confidence) * 100)}%</dd>
          <dt className="opacity-60">Same place</dt>
          <dd className="font-medium">{v.same_place === null ? "—" : v.same_place ? "Yes" : "No"}</dd>
          <dt className="opacity-60">Model</dt>
          <dd className="font-mono text-xs leading-5">{v.model}</dd>
          <dt className="opacity-60">Verified</dt>
          <dd>{when(v.created_at)}</dd>
          <dt className="opacity-60">Founder</dt>
          <dd>{credit.founder}</dd>
          <dt className="opacity-60">Credit ID</dt>
          <dd className="truncate font-mono text-xs leading-5">{credit.id}</dd>
          <dt className="opacity-60">Verification</dt>
          <dd className="truncate font-mono text-xs leading-5">{v.id}</dd>
        </dl>
      </section>
    </main>
  );
}
