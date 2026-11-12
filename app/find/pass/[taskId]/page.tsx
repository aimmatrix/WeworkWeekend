"use client";

import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { getFounder, loadAll, muted, type Office, type Task } from "../../data";
import { Emoji, TopBar } from "../../ui";

/** The founder's door pass: the on-site lead scans it to check them in. */
export default function PassPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [pass, setPass] = useState<{ task: Task; office?: Office; url: string } | null | undefined>(undefined);

  useEffect(() => {
    loadAll().then(
      (d) => {
        const task = d.tasks.find((x) => String(x.id) === taskId && x.claimed_by === getFounder());
        setPass(task ? { task, office: d.offices.find((o) => o.id === task.office_id), url: `${location.origin}/checkin/${task.id}` } : null);
      },
      () => setPass(null),
    );
  }, [taskId]);

  return (
    <>
      <TopBar className="sticky top-0 bg-[#EEF3F9]" />
      <div className="px-4 pb-8">
        {pass === undefined && <p className={muted}>loading…</p>}
        {pass === null && <p className="rounded-[26px] bg-white p-4">no pass here. claim the task first.</p>}
        {pass && (
          <article className="overflow-hidden rounded-[32px] bg-white shadow-[0_8px_28px_rgba(15,30,60,0.12)]">
            <div className="flex flex-col gap-1 bg-[#0B0B0C] p-6 text-white">
              <p className="text-sm text-[#C9D3DF]">cleaning crew pass</p>
              <h1 className="display text-[26px] leading-tight">{pass.office?.name ?? "office"}</h1>
              <p className="text-sm text-[#C9D3DF]">{pass.office?.address}</p>
            </div>

            <div className="flex items-center gap-3 border-b border-dashed border-[#C9D3DF] p-5">
              <Emoji task={pass.task} />
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] ${muted}`}>guest</p>
                <p className="display truncate text-lg">{getFounder()}</p>
              </div>
              <div className="text-right">
                <p className={`text-[13px] ${muted}`}>worth</p>
                <p className="display text-lg tabular-nums">+{pass.task.credit_hours}h</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 p-6">
              <QRCodeSVG value={pass.url} size={220} marginSize={0} fgColor="#0B0B0C" title="Check-in code" />
              <p className="text-center font-bold">{pass.task.title}</p>
              <p className={`text-center text-sm leading-snug ${muted}`}>show this at the door. the on-site lead scans it and lets you at the mess.</p>
            </div>
          </article>
        )}
      </div>
    </>
  );
}
