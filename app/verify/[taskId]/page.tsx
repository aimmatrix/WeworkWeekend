"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { verify } from "@/lib/api";
import { getOffice, getTask } from "@/lib/data";
import { uploadPhoto } from "@/lib/photos";
import type { Task, VerifyResponse } from "@/lib/types";
import { card, muted, reward } from "../../find/data";
import { TopBar } from "../../find/ui";

const photo = "aspect-[4/3] w-full rounded-[22px] object-cover";
const tag = "absolute left-3 top-3 rounded-full bg-[#0B0B0C] px-3 py-1 text-[13px] font-bold text-white";

function Before({ task }: { task: Task }) {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={task.before_url} alt="Before cleaning" className={`${photo} bg-[#DCE5EF]`} />
      <span className={tag}>before</span>
    </div>
  );
}

export default function VerifyPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | null | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verdict, setVerdict] = useState<VerifyResponse | null>(null);
  const [spotless, setSpotless] = useState(false);
  const after = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => {
    getTask(taskId).then(setTask, () => setTask(null));
  }, [taskId]);

  async function send() {
    if (!task || !file) return;
    setBusy(true);
    setError("");
    try {
      const v = await verify({ taskId: task.id, afterUrl: await uploadPhoto(file, `tasks/${task.id}`) });
      if (v.passed) {
        // Bonus: every task at this office has now passed.
        const office = await getOffice(task.office_id).catch(() => null);
        setSpotless(!!office && office.tasks.every((x) => x.status === "done"));
        window.dispatchEvent(new Event("wallet"));
      }
      setVerdict(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : "grok dropped the photo. try again.");
    }
    setBusy(false);
  }

  if (task === undefined) return <p className={`p-5 ${muted}`}>loading…</p>;
  if (task === null)
    return (
      <>
        <TopBar />
        <p className="px-5">that task has vanished. someone may have binned it.</p>
      </>
    );

  if (verdict)
    return (
      <>
        <TopBar className="sticky top-0 bg-[#EEF3F9]" />
        <div className="flex flex-col gap-4 px-4 pb-8">
          <div className={`flex flex-col gap-1.5 rounded-[32px] p-6 ${verdict.passed ? "bg-[#0B0B0C] text-white" : "bg-white"}`}>
            <p className={`text-sm ${verdict.passed ? "text-[#C9D3DF]" : muted}`}>
              {task.title} · grok is {Math.round(verdict.confidence * 100)}% sure
            </p>
            {verdict.passed ? (
              <p className="flex items-baseline gap-3">
                <span className="display text-[72px] leading-none tracking-tighter tabular-nums">+{verdict.hours ?? task.credit_hours}h</span>
                <span className="text-[#C9D3DF]">earned</span>
              </p>
            ) : (
              <p className="display text-[40px] leading-none">not yet.</p>
            )}
            <p className={`mt-1.5 text-sm leading-snug ${verdict.passed ? "text-[#C9D3DF]" : muted}`}>
              {verdict.passed ? "passed. grok looked closely and found nothing to moan about." : "grok looked closely and found things to moan about."}
            </p>
          </div>

          {spotless && (
            <div className="flex items-center gap-3 rounded-[26px] bg-[#FF5A1F] p-4">
              <span aria-hidden className="text-[32px] leading-none">🏆</span>
              <p className="leading-snug">
                <span className="font-bold">cleaner than baseline.</span> every task here passed, so the grok pro reward is yours.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Before task={task} />
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={after} alt="After cleaning" className={photo} />
              <span className={tag}>after</span>
            </div>
          </div>

          {!verdict.passed && verdict.remaining_issues.length > 0 && (
            <section className={`p-4 ${card}`}>
              <h2 className="text-[13px] font-bold text-[#B3261E]">still dirty</h2>
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 normal-case">
                {verdict.remaining_issues.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
          )}

          <section className={`p-4 ${card}`}>
            <h2 className={`text-[13px] font-bold ${muted}`}>what grok saw</h2>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 normal-case">
              {verdict.reasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>

          {verdict.passed ? (
            <>
              <Link href="/find/book" className="display flex h-14 items-center justify-center rounded-full bg-[#FF5A1F] text-[15px]">
                see it in your wallet
              </Link>
              {verdict.creditId && (
                <Link href={`/ledger/${verdict.creditId}`} className="flex h-11 items-center justify-center font-bold underline">
                  see the evidence trail
                </Link>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                setVerdict(null);
                setFile(null);
              }}
              className="display h-14 rounded-full bg-[#0B0B0C] text-[15px] text-white"
            >
              clean it again, then retake
            </button>
          )}
        </div>
      </>
    );

  return (
    <>
      <TopBar className="sticky top-0 bg-[#EEF3F9]" />
      <div className="flex flex-col gap-4 px-4 pb-8">
        <div className="flex items-center gap-3 px-1">
          <div className="min-w-0 flex-1">
            <p className={`text-sm ${muted}`}>prove it</p>
            <h1 className="display text-[24px] leading-tight">{task.title}</h1>
          </div>
          <span className={`display flex shrink-0 items-center rounded-full tabular-nums ${reward(task.credit_hours)}`}>+{task.credit_hours}h</span>
        </div>

        <Before task={task} />
        <p className={`px-1 text-sm leading-snug ${muted}`}>stand where the landlord stood. same angle, less filth.</p>

        {after && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={after} alt="Your after photo" className={photo} />
            <span className={tag}>after</span>
          </div>
        )}

        {error && <p role="alert" className="px-1 font-bold text-[#B3261E]">{error}</p>}
        <label
          className={`display flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full text-[15px] focus-within:ring-2 focus-within:ring-[#FF5A1F] ${
            file ? "border border-[#C9D3DF] bg-white" : "bg-[#0B0B0C] text-white"
          }`}
        >
          <span aria-hidden>📸</span> {file ? "retake" : "shoot the after photo"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {file && (
          <button onClick={send} disabled={busy} className="display h-14 rounded-full bg-[#FF5A1F] text-[15px] disabled:opacity-40">
            {busy ? "grok is squinting at it…" : "send to grok"}
          </button>
        )}
      </div>
    </>
  );
}
