"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { card, getFounder, loadAll, MOCK, muted, reward, type Office, type Task } from "../data";
import { Emoji, TopBar } from "../ui";

type Row = Task & { office?: Office };

export default function MyTasksPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const me = getFounder();
    loadAll().then(
      (d) => setRows(d.tasks.filter((x) => x.claimed_by === me).map((x) => ({ ...x, office: d.offices.find((o) => o.id === x.office_id) }))),
      () => setRows([]),
    );
  }, []);

  const todo = rows?.filter((x) => x.status !== "done") ?? [];
  const done = rows?.filter((x) => x.status === "done") ?? [];
  const label = `px-1 text-[13px] font-bold ${muted}`;

  return (
    <>
      <TopBar className="sticky top-0 bg-[#EEF3F9]" />
      <div className="flex flex-col gap-3 px-4 pb-8">
        <h1 className="display px-1 text-[30px] leading-tight">my tasks</h1>
        {!rows && <p className={`px-1 ${muted}`}>loading…</p>}
        {rows?.length === 0 && (
          <p className={`p-4 ${card}`}>
            nothing claimed yet. the toilets won&apos;t clean themselves.{" "}
            <Link href="/find" className="font-bold underline">
              find an office
            </Link>
          </p>
        )}

        {todo.length > 0 && <h2 className={label}>still to face</h2>}
        {todo.map((task) => (
          <article key={task.id} className={`flex flex-col gap-4 !rounded-[28px] p-4 ${card}`}>
            <div className="flex items-center gap-3">
              {task.before_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={task.before_url} alt="Before" className="h-[72px] w-[72px] shrink-0 rounded-[18px] object-cover" />
              ) : (
                <Emoji task={task} className="!h-[72px] !w-[72px] !rounded-[18px] !text-[32px]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-snug">{task.title}</p>
                <p className={`mt-1 truncate text-sm ${muted}`}>
                  {task.office?.name ?? "office"} · {task.room}
                </p>
              </div>
              <span className={`display flex shrink-0 items-center rounded-full tabular-nums ${reward(task.credit_hours)}`}>+{task.credit_hours}h</span>
            </div>
            <ol className="grid grid-cols-3 gap-1.5 text-[13px]">
              <li className="font-semibold before:mb-1.5 before:block before:h-[5px] before:rounded-full before:bg-[#0B0B0C]">claimed</li>
              <li className="font-bold before:mb-1.5 before:block before:h-[5px] before:rounded-full before:bg-[#FF5A1F]">after photo</li>
              <li className={`${muted} before:mb-1.5 before:block before:h-[5px] before:rounded-full before:bg-[#CDD7E2]`}>grok checks it</li>
            </ol>
            <div className="flex gap-2">
              <Link href={`/verify/${task.id}`} className="display flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-[#0B0B0C] text-sm font-medium text-white">
                <span aria-hidden>📸</span> after photo
              </Link>
              <Link href={`/find/pass/${task.id}`} className="display flex h-[52px] items-center justify-center gap-2 rounded-full border border-[#C9D3DF] px-5 text-sm font-medium">
                <span aria-hidden>🎟️</span> check in
              </Link>
            </div>
          </article>
        ))}

        {done.length > 0 && <h2 className={`mt-2 ${label}`}>earned</h2>}
        {done.map((task) => (
          <Link key={task.id} href={MOCK ? "/find/book" : "/ledger"} className={`flex min-h-[72px] items-center gap-3 py-2 pl-3.5 pr-4 ${card}`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#DDF3E6] font-bold text-[#0A6B3B]">✓</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{task.title}</p>
              <p className={`truncate text-[13px] ${muted}`}>{task.office?.name ?? "office"} · passed by grok</p>
            </div>
            <span className="display text-[17px] text-[#0A6B3B] tabular-nums">+{task.credit_hours}h</span>
          </Link>
        ))}

        {todo.length > 0 && <p className={`px-1 pt-2 text-sm leading-snug ${muted}`}>no photo, no hours. grok has seen things and cannot be bribed.</p>}
      </div>
    </>
  );
}
