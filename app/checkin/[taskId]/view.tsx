"use client";

import { DM_Sans, Unbounded } from "next/font/google";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadAll, muted, type Office, type Task } from "../../find/data";
import "../../find/find.css";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });

/** What the on-site lead sees after scanning a founder's pass. */
export default function CheckIn() {
  const { taskId } = useParams<{ taskId: string }>();
  const [found, setFound] = useState<{ task: Task; office?: Office } | null | undefined>(undefined);
  const [at] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

  useEffect(() => {
    loadAll().then(
      (d) => {
        const task = d.tasks.find((x) => String(x.id) === taskId);
        setFound(task ? { task, office: d.offices.find((o) => o.id === task.office_id) } : null);
      },
      () => setFound(null),
    );
  }, [taskId]);

  const task = found?.task;
  const valid = !!task && task.status === "claimed" && !!task.claimed_by;
  const tone = found === undefined ? "bg-[#EEF3F9]" : valid ? "bg-[#DDF3E6]" : "bg-[#FFDCCB]";

  return (
    <main className={`find ${display.variable} ${body.variable} mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 p-6 text-[15px] text-[#0B0B0C] ${tone}`}>
      {found === undefined && <p className={muted}>checking the pass…</p>}

      {found !== undefined && !valid && (
        <>
          <p className="text-6xl" aria-hidden>
            🚫
          </p>
          <h1 className="display text-[30px] leading-tight">not on the list</h1>
          <p>
            {!task
              ? "this pass does not match any task."
              : task.status === "done"
                ? `${task.claimed_by ?? "they"} already finished this one. no second helpings.`
                : "nobody has claimed this task yet."}
          </p>
        </>
      )}

      {valid && task && (
        <>
          <p className="text-6xl" aria-hidden>
            ✅
          </p>
          <h1 className="display text-[34px] leading-none">{task.claimed_by} is in</h1>
          <p className="text-[#0A6B3B]">checked in at {at}. hand over the marigolds.</p>
          <dl className="flex flex-col gap-3 rounded-[26px] bg-white p-5">
            <div>
              <dt className={`text-[13px] ${muted}`}>office</dt>
              <dd className="font-bold">{found?.office?.name ?? "office"}</dd>
            </div>
            <div>
              <dt className={`text-[13px] ${muted}`}>here to</dt>
              <dd className="font-bold">
                {task.title} · {task.room}
              </dd>
            </div>
            <div>
              <dt className={`text-[13px] ${muted}`}>earns</dt>
              <dd className="display tabular-nums">+{task.credit_hours}h</dd>
            </div>
          </dl>
        </>
      )}
    </main>
  );
}
