"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { DoorCode } from "../checkin/code";
import { shareDoor } from "../checkin/door";
import { card, grim, MOCK, muted, reward, type Office, type Task } from "../find/data";
import { Emoji } from "../find/ui";
import { assess, createOffice, publish, putPhoto, removeTask, type Assessment } from "./data";
import { useQuip } from "./quip";

const MIN = 4;
const MAX = 6;
const field = "h-14 rounded-full bg-white px-6 text-[17px] outline-none focus:ring-2 focus:ring-[#0B0B0C]";
const WAITING = [
  "grok is having a look…",
  "grok is zooming in on the grout…",
  "grok has found the fridge. pray for grok…",
  "grok is counting mugs. so many mugs…",
  "grok is pricing the horror…",
];
const cta = "display h-14 rounded-full bg-[#FF5A1F] text-[15px] disabled:opacity-40";

export default function CapturePage() {
  const [photos, setPhotos] = useState<{ file: File; src: string }[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [office, setOffice] = useState<Office | null>(null);
  const [result, setResult] = useState<Assessment | null>(null);
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const quip = useQuip(WAITING, busy === "grok");
  const draft = useRef<Office | null>(null); // kept so a retry does not create a second office

  async function scan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    try {
      setBusy("uploading the evidence…");
      const made = (draft.current ??= await createOffice(String(form.get("name")).trim(), String(form.get("address")).trim()));
      const photoUrls = await Promise.all(photos.map((p) => putPhoto(p.file, `offices/${made.id}`)));
      setBusy("grok");
      setResult(await assess(made, photoUrls));
      setOffice(made);
    } catch (err) {
      setError(err instanceof Error ? err.message : "that didn't work. try again.");
    }
    setBusy("");
  }

  async function remove(id: Task["id"]) {
    await removeTask(id).catch(() => {});
    setResult((r) => r && { ...r, tasks: r.tasks.filter((x) => x.id !== id) });
  }

  async function goLive() {
    if (!office || !result) return;
    setBusy("publishing…");
    setError("");
    try {
      await publish(office, result);
      setLive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't publish. try again.");
    }
    setBusy("");
  }

  if (live && office)
    return (
      <div className="flex min-h-full flex-col justify-end gap-4 p-5">
        <span aria-hidden className="text-[64px] leading-none">🧽</span>
        <h1 className="display text-[32px] leading-[1.1]">{office.name} is live.</h1>
        <p className={muted}>founders can see it on the map now. expect people with bin bags on saturday.</p>
        <DoorCode office={office} />
        <p className={`mt-2 ${muted}`}>not planning to stand at the door yourself? hand the guest list to whoever drew the short straw.</p>
        <button onClick={async () => setCopied(await shareDoor(office.id, office.name))} className={cta}>
          {copied ? "link copied. go and delegate" : "send the door list to your supervisor"}
        </button>
        <Link href={`/checkin?office=${office.id}`} className="display flex h-14 items-center justify-center rounded-full bg-[#0B0B0C] text-[15px] text-white">
          do the door myself
        </Link>
        <Link href={`/find/${office.id}`} className="flex h-11 items-center justify-center font-bold underline">
          see what founders see
        </Link>
      </div>
    );

  if (office && result) {
    const rooms = [...new Set(result.tasks.map((x) => x.room))];
    const hours = result.tasks.reduce((s, x) => s + Number(x.credit_hours), 0);
    const stat = `!rounded-[20px] px-3.5 py-3 ${card}`;
    return (
      <div className="flex min-h-full flex-col gap-4 p-4 pb-8">
        <div className="px-1 pt-2">
          <p className={`text-sm ${muted}`}>grok&apos;s verdict on</p>
          <h1 className="display text-[26px] leading-tight">{office.name}</h1>
        </div>
        {result.model ? (
          <p className="self-start rounded-full bg-[#DDF3E6] px-3 py-1 text-[13px] font-bold text-[#0A6B3B]">grok looked at every photo</p>
        ) : (
          MOCK && <p className="self-start rounded-full bg-[#FFDCCB] px-3 py-1 text-[13px] font-bold">demo mode. not a real grok check</p>
        )}
        <dl className="grid grid-cols-3 gap-2">
          <div className={stat}>
            <dd className="display text-xl tabular-nums">{hours}h</dd>
            <dt className={`text-[13px] ${muted}`}>of desk credit</dt>
          </div>
          <div className={stat}>
            <dd className="display text-xl tabular-nums">{result.dirt_score}/10</dd>
            <dt className={`text-[13px] ${muted}`}>{grim(result.dirt_score)}</dt>
          </div>
          <div className={stat}>
            <dd className="display text-xl tabular-nums">{result.crew_size}</dd>
            <dt className={`text-[13px] ${muted}`}>crew needed</dt>
          </div>
        </dl>

        {rooms.map((room) => (
          <section key={room} className="flex flex-col gap-2">
            <h2 className={`px-1 text-[13px] font-bold ${muted}`}>{room}</h2>
            {result.tasks
              .filter((x) => x.room === room)
              .map((task) => (
                <div key={task.id} className={`flex min-h-[72px] items-center gap-3 py-2 pl-3.5 pr-3 ${card}`}>
                  {task.before_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={task.before_url} alt="" className="h-11 w-11 shrink-0 rounded-[14px] object-cover" />
                  ) : (
                    <Emoji task={task} />
                  )}
                  <p className="min-w-0 flex-1 font-bold">{task.title}</p>
                  <span className={`display flex shrink-0 items-center rounded-full tabular-nums ${reward(task.credit_hours)}`}>+{task.credit_hours}h</span>
                  <button
                    onClick={() => remove(task.id)}
                    aria-label={`Remove ${task.title}`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#C9D3DF] text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
          </section>
        ))}
        {result.tasks.length === 0 && <p className={`p-4 ${card}`}>no tasks left. either it&apos;s spotless or you&apos;re in denial.</p>}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {error && <p role="alert" className="px-1 font-bold text-[#B3261E]">{error}</p>}
          <p className={`px-1 text-sm ${muted}`}>remove anything you&apos;d rather founders left alone, then publish.</p>
          <button onClick={goLive} disabled={!!busy || result.tasks.length === 0} className={cta}>
            {busy || "publish. let the founders in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={scan} className="flex min-h-full flex-col gap-4 p-4 pb-8">
      <div className="px-1 pt-2">
        <h1 className="display text-[28px] leading-[1.15]">empty office this weekend? show us the mess.</h1>
        <p className={`mt-2 ${muted}`}>grok prices the cleaning. founders do it for desk time.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="name" className={`px-1 text-sm ${muted}`}>office name</label>
        <input id="name" name="name" required placeholder="shoreditch works" className={field} />
        <label htmlFor="address" className={`px-1 pt-1 text-sm ${muted}`}>address</label>
        <input id="address" name="address" required autoComplete="street-address" placeholder="12 curtain rd, ec2a 3nh" className={field} />
      </div>

      <div className="flex flex-col gap-2">
        <p className={`px-1 text-sm ${muted}`}>
          {MIN} to {MAX} photos of the worst bits · {photos.length} added
        </p>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.src} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={`Photo ${i + 1}`} className="h-full w-full rounded-[18px] object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-0 top-0 grid h-11 w-11 place-items-center"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0B0B0C] leading-none text-white">×</span>
              </button>
            </div>
          ))}
          {photos.length < MAX && (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-[18px] border border-dashed border-[#9AA7B6] bg-[#F6F9FC] text-center text-[13px] font-semibold focus-within:ring-2 focus-within:ring-[#0B0B0C]">
              <span>
                <span aria-hidden className="block text-[26px] leading-tight">📸</span>
                add photo
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const added = [...(e.target.files ?? [])].map((file) => ({ file, src: URL.createObjectURL(file) }));
                  setPhotos((list) => [...list, ...added].slice(0, MAX));
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {error && <p role="alert" className="px-1 font-bold text-[#B3261E]">{error}</p>}
        <button disabled={!!busy || photos.length < MIN} className={cta}>
          {busy === "grok" ? quip : busy || (photos.length < MIN ? `${MIN - photos.length} more to go. be brave` : "scan the mess")}
        </button>
      </div>
    </form>
  );
}
