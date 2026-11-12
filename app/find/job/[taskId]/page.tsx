"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { arrivedAt, card, directionsUrl, getFounder, isDoor, loadAll, markArrived, muted, reward, staticMap, type Office, type Task } from "../../data";
import { TopBar } from "../../ui";
import { DoorScanner } from "./scanner";

type Job = { task: Task; office: Office };

/** One claimed task, walked through in order: get there, scan the door, clean and prove it. */
export default function JobPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [arrived, setArrived] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [typed, setTyped] = useState("");
  const [wrong, setWrong] = useState("");

  useEffect(() => {
    loadAll().then(
      (d) => {
        const task = d.tasks.find((x) => String(x.id) === taskId && x.claimed_by === getFounder());
        const office = task && d.offices.find((o) => o.id === task.office_id);
        setJob(task && office ? { task, office } : null);
        if (office) setArrived(!!arrivedAt(office.id));
      },
      () => setJob(null),
    );
  }, [taskId]);

  function tryDoor(text: string) {
    if (!job) return;
    if (!isDoor(job.office.id, text)) return setWrong("wrong door. that code belongs to somewhere else.");
    markArrived(job.office.id);
    setArrived(true);
    setScanning(false);
    setWrong("");
  }

  if (job === undefined) return <p className={`p-4 ${muted}`}>loading…</p>;
  if (job === null)
    return (
      <>
        <TopBar className="sticky top-0 bg-[#EEF3F9]" />
        <p className={`mx-4 p-4 ${card}`}>
          this one isn&apos;t yours.{" "}
          <Link href="/find" className="font-bold underline">
            find a task
          </Link>
        </p>
      </>
    );

  const { task, office } = job;
  const done = task.status === "done";
  const map = staticMap(office.lng, office.lat, 14.3, 448, 220);
  const num = (n: number, state: "done" | "now" | "later") => (
    <span
      className={`display grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ${
        state === "done" ? "bg-[#DDF3E6] text-[#0A6B3B]" : state === "now" ? "bg-[#FF5A1F]" : "bg-[#DCE5EF] text-[#4E5967]"
      }`}
    >
      {state === "done" ? "✓" : n}
    </span>
  );

  return (
    <>
      <TopBar className="sticky top-0 bg-[#EEF3F9]" />
      <div className="flex flex-col gap-3 px-4 pb-8">
        <div className={`overflow-hidden !rounded-[28px] ${card}`}>
          {task.before_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={task.before_url} alt={`What needs cleaning: ${task.title}`} className="aspect-[16/9] w-full object-cover" />
          )}
          <div className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] ${muted}`}>your job at {office.name}</p>
              <h1 className="display text-xl leading-tight">{task.title}</h1>
            </div>
            <span className={`display flex shrink-0 items-center rounded-full tabular-nums ${reward(task.credit_hours)}`}>+{task.credit_hours}h</span>
          </div>
        </div>

        {/* 1. directions */}
        <section className={`flex flex-col gap-3 p-4 ${card} ${arrived ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-3">
            {num(1, arrived ? "done" : "now")}
            <div className="min-w-0 flex-1">
              <h2 className="display text-base">get there</h2>
              <p className={`truncate text-sm ${muted}`}>{office.address}</p>
            </div>
          </div>
          {!arrived && (
            <>
              {map && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={map} alt={`Map of ${office.address}`} className="h-36 w-full rounded-[18px] object-cover" />
                  <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#FF5A1F] shadow-md" />
                </div>
              )}
              <a
                href={directionsUrl(office)}
                target="_blank"
                rel="noreferrer"
                className="display flex h-[52px] items-center justify-center gap-2 rounded-full bg-[#0B0B0C] text-sm font-medium text-white"
              >
                <span aria-hidden>🧭</span> send me directions
              </a>
            </>
          )}
        </section>

        {/* 2. the door */}
        <section className={`flex flex-col gap-3 p-4 ${card}`}>
          <div className="flex items-center gap-3">
            {num(2, arrived ? "done" : "now")}
            <div className="min-w-0 flex-1">
              <h2 className="display text-base">{arrived ? "you're in" : "scan the door code"}</h2>
              <p className={`text-sm ${muted}`}>
                {arrived ? "scanned in. the mess is all yours." : "no scan, no cleaning. find the code at the door when you arrive."}
              </p>
            </div>
          </div>
          {!arrived && !scanning && (
            <button onClick={() => setScanning(true)} className="display h-[52px] rounded-full bg-[#FF5A1F] text-sm">
              <span aria-hidden>📷</span> i&apos;m here. scan the code
            </button>
          )}
          {!arrived && scanning && <DoorScanner onRead={tryDoor} onClose={() => setScanning(false)} />}
          {!arrived && (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                tryDoor(typed);
              }}
            >
              <label htmlFor="code" className={`flex-1 text-sm ${muted}`}>
                camera sulking? type the 4 digits under the code
              </label>
              <input
                id="code"
                value={typed}
                onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="0000"
                aria-describedby={wrong ? "wrong" : undefined}
                className="display h-11 w-24 rounded-full border border-[#C9D3DF] bg-white text-center tracking-widest"
              />
              <button disabled={typed.length !== 4} className="display h-11 rounded-full bg-[#0B0B0C] px-4 text-[13px] font-medium text-white disabled:opacity-40">
                go
              </button>
            </form>
          )}
          {wrong && (
            <p id="wrong" role="alert" className="text-sm font-semibold text-red-700">
              {wrong}
            </p>
          )}
        </section>

        {/* 3. clean and prove it */}
        <section className={`flex flex-col gap-3 p-4 ${card} ${arrived ? "" : "opacity-60"}`}>
          <div className="flex items-center gap-3">
            {num(3, done ? "done" : arrived ? "now" : "later")}
            <div className="min-w-0 flex-1">
              <h2 className="display text-base">clean it, then prove it</h2>
              <p className={`text-sm ${muted}`}>
                {done ? "passed. the hours are in your wallet." : arrived ? "same angle as the photo above, less filth." : "locked until you scan in at the door."}
              </p>
            </div>
          </div>
          {arrived && !done && (
            <Link href={`/verify/${task.id}`} className="display flex h-[52px] items-center justify-center gap-2 rounded-full bg-[#0B0B0C] text-sm font-medium text-white">
              <span aria-hidden>📸</span> add the after photo
            </Link>
          )}
        </section>
      </div>
    </>
  );
}
