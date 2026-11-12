"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { card, grim, loadAll, muted, openHours, staticMap, type Office, type Task } from "../data";
import { TaskList, TopBar } from "../ui";

export default function OfficePage() {
  const { officeId } = useParams<{ officeId: string }>();
  const [office, setOffice] = useState<Office | null | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    loadAll().then(
      (d) => {
        setOffice(d.offices.find((o) => String(o.id) === officeId) ?? null);
        setTasks(d.tasks.filter((x) => String(x.office_id) === officeId));
      },
      () => setOffice(null),
    );
  }, [officeId]);

  const photos = [...new Set(tasks.map((x) => x.before_url).filter(Boolean))] as string[];
  // Assumes dirt_score is 0-10; rescale here if the backend picks another range.
  const mess = office ? Math.max(0, Math.min(10, Math.round(office.dirt_score))) : 0;
  const hours = office ? openHours(tasks, office.id) : 0;
  const map = office && staticMap(office.lng, office.lat, 14.3, 448, 300);
  const stat = `!rounded-[20px] px-3.5 py-3 ${card}`;

  return (
    <div className="flex min-h-full flex-col">
      <div className="relative h-[250px] shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {map && <img src={map} alt="" className="h-full w-full object-cover" />}
        {office && (
          <div className="absolute left-1/2 top-[55%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
            <span className="display flex h-9 items-center rounded-full bg-[#0B0B0C] px-3.5 text-[15px] text-white shadow-[0_6px_16px_rgba(15,30,60,0.3)]">{hours}h</span>
            <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-[#0B0B0C]" />
          </div>
        )}
        <TopBar className="absolute inset-x-0 top-0" />
      </div>

      <div className="relative -mt-4 flex flex-1 flex-col gap-4 rounded-t-[32px] bg-[#EEF3F9] px-4 pb-8 shadow-[0_-8px_28px_rgba(15,30,60,0.12)]">
        <div className="mx-auto -mb-1 mt-2.5 h-[5px] w-11 rounded-full bg-[#9AA7B6]" />
        {office === undefined && <p className={muted}>loading…</p>}
        {office === null && <p>that office has vanished. possibly condemned.</p>}
        {office && (
          <>
            <div className="px-1">
              <h1 className="display text-[22px] leading-tight">{office.name}</h1>
              <p className={`mt-1.5 ${muted}`}>{office.address}</p>
            </div>

            <dl className="grid grid-cols-3 gap-2">
              <div className={stat}>
                <dd className="display text-xl tabular-nums">{hours}h</dd>
                <dt className={`text-[13px] ${muted}`}>up for grabs</dt>
              </div>
              <div className={stat}>
                <dd className="display text-xl tabular-nums">{mess}/10</dd>
                <dt className={`text-[13px] ${muted}`}>{grim(mess)}</dt>
              </div>
              <div className={stat}>
                <dd className="display text-xl tabular-nums">{office.crew_size}</dd>
                <dt className={`text-[13px] ${muted}`}>crew needed</dt>
              </div>
            </dl>

            {photos.length > 0 && (
              <div>
                <h2 className={`mb-2 px-1 text-[13px] font-bold ${muted}`}>the crime scene</h2>
                <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4">
                  {photos.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="The office before cleaning" className="h-28 w-36 shrink-0 snap-start rounded-[18px] object-cover" />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className={`mb-2 px-1 text-[13px] font-bold ${muted}`}>pick your poison</h2>
              <TaskList tasks={tasks} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
