"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getTask, putPhoto, spotless as isSpotless, verify, type Verdict } from "../../capture/data";
import { useQuip } from "../../capture/quip";
import { arrivedAt, card, getSlot, MOCK, muted, reward, stayText, type Task } from "../../find/data";
import { Emoji, TopBar } from "../../find/ui";

const WAITING = [
  "grok is squinting at it…",
  "grok is playing spot the difference…",
  "grok is checking behind the bin…",
  "grok is sniffing the photo. somehow…",
];

const photo = "aspect-[4/3] w-full rounded-[22px] object-cover";
const tag = "absolute left-3 top-3 rounded-full bg-[#0B0B0C] px-3 py-1 text-[13px] font-bold text-white";

/** The sweeping line and grid drawn over a photo while the model is looking at it. */
const Scan = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]" aria-hidden>
    <div className="scan-grid" />
    <div className="scan-line" />
  </div>
);

function Before({ task, scanning = false }: { task: Task; scanning?: boolean }) {
  return (
    <div className="relative">
      {task.before_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={task.before_url} alt="Before cleaning" className={`${photo} bg-[#DCE5EF]`} />
      ) : (
        <div className={`${photo} grid place-items-center bg-[#DCE5EF]`}>
          <Emoji task={task} className="!bg-white" />
        </div>
      )}
      <span className={tag}>before</span>
      {scanning && <Scan />}
    </div>
  );
}

export default function VerifyPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | null | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [stay, setStay] = useState<number | null>(null); // ms between scanning in and taking the photo
  const [spotless, setSpotless] = useState(false);
  const quip = useQuip(WAITING, busy);
  const after = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => {
    getTask(taskId).then(setTask, () => setTask(null));
  }, [taskId]);

  async function send() {
    if (!task || !file) return;
    // The photo's own timestamp is the proof of when the work finished.
    const scannedIn = new Date(arrivedAt(task.office_id) ?? Date.now()).getTime();
    if (file.lastModified < scannedIn - 60_000)
      return setError("that photo was taken before you scanned in at the door. grok wants a fresh one.");
    setStay(file.lastModified - scannedIn);
    setBusy(true);
    setError("");
    try {
      const v = await verify(task, await putPhoto(file, `tasks/${task.id}`));
      if (v.passed) {
        // Bonus: every task at this office has now passed.
        setSpotless(await isSpotless(task).catch(() => false));
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

  // Nothing to prove yet, or nothing left to prove.
  if (!verdict && task.status !== "claimed")
    return (
      <>
        <TopBar className="sticky top-0 bg-[#EEF3F9]" />
        <div className="flex flex-col gap-4 px-4">
          <p className={`p-4 ${card}`}>
            {task.status === "done" ? "this one already passed. grok does not pay twice." : "nobody has claimed this one yet. claim it before you clean it."}
          </p>
          <Link
            href={task.status === "done" ? "/find/book" : `/find/${task.office_id}`}
            className="display flex h-14 items-center justify-center rounded-full bg-[#0B0B0C] text-[15px] text-white"
          >
            {task.status === "done" ? "see your wallet" : "go and claim it"}
          </Link>
        </div>
      </>
    );

  // The camera only opens once the founder has scanned in at the door.
  if (!verdict && !arrivedAt(task.office_id))
    return (
      <>
        <TopBar className="sticky top-0 bg-[#EEF3F9]" />
        <div className="flex flex-col gap-4 px-4">
          <p className={`p-4 ${card}`}>you haven&apos;t scanned in at the door yet. nice try, cleaning it from the sofa.</p>
          <Link href={`/find/job/${task.id}`} className="display flex h-14 items-center justify-center rounded-full bg-[#0B0B0C] text-[15px] text-white">
            get there and scan in
          </Link>
        </div>
      </>
    );

  if (verdict)
    return (
      <>
        <TopBar className="sticky top-0 bg-[#EEF3F9]" />
        <div className="flex flex-col gap-4 px-4 pb-8">
          {verdict.model ? (
            <p className="self-start rounded-full bg-[#DDF3E6] px-3 py-1 text-[13px] font-bold text-[#0A6B3B]">grok compared both photos</p>
          ) : (
            MOCK && <p className="self-start rounded-full bg-[#FFDCCB] px-3 py-1 text-[13px] font-bold">demo mode. not a real grok check</p>
          )}
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

          {stay !== null && (
            <div className={`flex items-center gap-3 p-4 ${card}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/stickers/credits.png" alt="" className="h-11 w-11 shrink-0 -rotate-6 object-contain drop-shadow-[0_3px_5px_rgba(15,30,60,0.25)]" />
              <p className="leading-snug">
                <span className="font-bold">on site for {stayText(stay)}.</span>{" "}
                <span className={muted}>
                  measured from your door scan to the photo&apos;s timestamp. you planned {getSlot(task).hours}h.
                  {stay < Number(task.credit_hours) * 5 * 60_000 ? " suspiciously quick. the supervisor may raise an eyebrow." : ""}
                </span>
              </p>
            </div>
          )}

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

        <Before task={task} scanning={busy} />
        <p className={`px-1 text-sm leading-snug ${muted}`}>stand where the landlord stood. same angle, less filth.</p>

        {after && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={after} alt="Your after photo" className={photo} />
            <span className={tag}>after</span>
            {busy && <Scan />}
          </div>
        )}

        {error && <p role="alert" className="px-1 font-bold text-[#B3261E]">{error}</p>}
        {busy && (
          <p role="status" className="display rounded-full bg-[#0B0B0C] px-5 py-4 text-center text-[15px] text-white">
            {quip}
          </p>
        )}
        <label
          hidden={busy}
          className={`display flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full text-[15px] focus-within:ring-2 focus-within:ring-[#FF5A1F] ${
            file ? "border border-[#C9D3DF] bg-white" : "bg-[#0B0B0C] text-white"
          }`}
        >
          <span aria-hidden>📸</span> {file ? "retake" : "shoot the after photo"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {file && !busy && (
          <button onClick={send} className="display h-14 rounded-full bg-[#FF5A1F] text-[15px]">
            send to grok
          </button>
        )}
      </div>
    </>
  );
}
