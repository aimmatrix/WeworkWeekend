"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { Office, Task } from "../../find/data";
import { Blob, Thinking } from "../blob";
import { Compare } from "../compare";
import { brief, clock, dayStamp, GROK, inThread, insideNow, lastRead, loadFeed, markRead, nameOf, officeThread, plain, say, type Ev, type Feed, type Thread } from "../feed";

type Chip = { label: string; href?: string; compare?: Ev };
type Msg = {
  id: string;
  from: "grok" | "you" | "error" | "note";
  text: string;
  at: string;
  chips?: Chip[];
  compare?: Ev;
  /** Entrance delay in seconds; undefined means no entrance animation. */
  in?: number;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
let seq = 0;
const uid = (prefix: string) => `${prefix}-${++seq}`;

/** Black text on pale accents (Grok Bot's white), white on the rest. */
const ink = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.62 ? "#000" : "#fff";
};

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((para, i) => (
        <p key={i} className={i ? "mt-3" : ""}>
          {para.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <strong key={j} className="font-semibold">{part}</strong> : <Fragment key={j}>{part}</Fragment>))}
        </p>
      ))}
    </>
  );
}

function eventMsg(e: Ev, multi: boolean, delay?: number, live = false): Msg {
  const chips: Chip[] | undefined =
    e.kind === "verified" && e.task?.before_url && e.check?.after_url
      ? [{ label: e.check.passed ? "Show me the before & after" : "Show me what you saw", compare: e }]
      : undefined;
  return { id: e.id, from: "grok", text: say(e, multi, live), at: e.at, chips, in: delay };
}

/** A made-up weekend for the pitch: one founder, one kitchen, start to finish. Clearly labelled, never saved. */
function demoEvents(office: Office, tasks: Task[], checks: Feed["checks"]): Ev[] {
  const mine = tasks.filter((t) => String(t.office_id) === String(office.id));
  const kitchen =
    mine.find((t) => t.category === "kitchen" && t.before_url === "/seed/kitchen-before.jpg") ??
    mine.find((t) => t.category === "kitchen") ??
    mine.find((t) => t.before_url === "/seed/kitchen-before.jpg");
  const passed = kitchen && checks.find((c) => String(c.task_id) === String(kitchen.id) && c.passed);
  const task: Task =
    kitchen && (passed || kitchen.before_url === "/seed/kitchen-before.jpg")
      ? kitchen
      : { id: "demo", office_id: office.id, room: "Kitchen", title: "Clean the kitchen", category: "kitchen", credit_hours: 2, before_url: "/seed/kitchen-before.jpg", status: "claimed", claimed_by: "Muhammad" };
  const after = passed ? passed.after_url : "/seed/kitchen-after.jpg";
  const at = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const base = { office, founder: "Muhammad", task };
  return [
    { ...base, id: "demo-c", kind: "claimed", at: at(17, 12) },
    { ...base, id: "demo-a", kind: "arrived", at: at(18, 0) },
    {
      ...base,
      id: "demo-v",
      kind: "verified",
      at: at(18, 46),
      check: { id: "demo", task_id: String(task.id), founder: "Muhammad", after_url: after, passed: true, confidence: 0.94, reasons: ["Seen: sink emptied and counters wiped down"], remaining_issues: [], review: "pending", created_at: at(18, 46) },
    },
    { ...base, id: "demo-l", kind: "left", at: at(19, 5), since: at(18, 0) },
  ];
}

export default function GrokThread() {
  const { thread: threadId } = useParams<{ thread: string }>();
  const [thread, setThread] = useState<Thread | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(0);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState(false);
  const [ideas, setIdeas] = useState(false);
  const feed = useRef<Feed | null>(null);
  const seen = useRef(new Set<string>());
  const queue = useRef<Ev[]>([]);
  const draining = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const add = useCallback((m: Msg) => setMsgs((all) => [...all, { in: 0, ...m }]), []);

  /** New events arrive one at a time, each after a beat of "thinking", like someone typing them up. */
  const drain = useCallback(
    async (multi: boolean) => {
      if (draining.current) return;
      draining.current = true;
      while (queue.current.length) {
        const e = queue.current.shift()!;
        setBusy((n) => n + 1);
        await wait(1500);
        setBusy((n) => n - 1);
        add(eventMsg(e, multi, 0, true));
        await wait(700);
      }
      draining.current = false;
    },
    [add],
  );

  /** Plays the made-up weekend into the thread. Open a thread with ?demo to start it straight away. */
  const play = useCallback(
    (t: Thread, f: Feed) => {
      const office = t.office ?? f.offices.find((o) => f.tasks.some((x) => String(x.office_id) === String(o.id) && x.category === "kitchen")) ?? f.offices[0];
      if (!office) return;
      add({ id: uid("note"), from: "note", text: `Demo: replaying a weekend at ${office.name}. Nothing here is saved.`, at: now() });
      queue.current.push(...demoEvents(office, f.tasks, f.checks).map((e) => ({ ...e, id: uid(e.id) })));
      drain(!t.office);
    },
    [add, drain],
  );

  useEffect(() => {
    let dead = false;
    let resolved: Thread | null = null;
    const load = async () => {
      const f = await loadFeed();
      if (dead) return;
      feed.current = f;
      if (!resolved) {
        const office = f.offices.find((o) => String(o.id) === threadId);
        resolved = threadId === "all" ? GROK : office ? officeThread(office) : null;
        setThread(resolved);
        if (!resolved) return;
        const events = inThread(resolved, f.events);
        events.forEach((e) => seen.current.add(e.id));
        const multi = !resolved.office;
        const n = events.length;
        const b = brief(resolved, f, lastRead(resolved.id));
        const first: Msg[] = events.map((e, i) => eventMsg(e, multi, i >= n - 5 ? (i - (n - 5)) * 0.07 : undefined));
        first.push({ id: "brief", from: "grok", text: b.decision ? `${b.text}\n\n${b.decision}` : b.text, at: now(), in: Math.min(n, 5) * 0.07 + 0.1, chips: b.decision ? [{ label: "Open the supervisor queue", href: "/supervisor" }] : undefined });
        setMsgs(first);
        markRead(resolved.id);
        const t = resolved;
        if (new URLSearchParams(location.search).has("demo")) setTimeout(() => !dead && play(t, f), 1200);
        return;
      }
      const fresh = inThread(resolved, f.events).filter((e) => !seen.current.has(e.id));
      fresh.forEach((e) => seen.current.add(e.id));
      if (fresh.length) {
        queue.current.push(...fresh);
        markRead(resolved.id);
        drain(!resolved.office);
      }
    };
    load().catch(() => !dead && setThread((t) => (t === undefined ? null : t)));
    const id = setInterval(() => load().catch(() => {}), 8_000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [threadId, drain, play]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function onChip(msgId: string, chip: Chip) {
    if (!chip.compare) return;
    const e = chip.compare;
    setMsgs((all) => all.map((m) => (m.id === msgId ? { ...m, chips: undefined } : m)));
    add({ id: uid("you"), from: "you", text: chip.label, at: now() });
    setBusy((n) => n + 1);
    await wait(1100);
    setBusy((n) => n - 1);
    const seenLine = e.check?.reasons?.find((r) => r.startsWith("Seen:"))?.replace(/^Seen:\s*/, "");
    add({
      id: uid("cmp"),
      from: "grok",
      at: now(),
      compare: e,
      text: e.check?.passed
        ? `Here's **${e.task?.title}** at ${e.office.name}, before ${nameOf(e.founder)} got there and after. Drag to compare.${seenLine ? `\n\nWhat I saw: ${seenLine}.` : ""}`
        : `Here's what ${nameOf(e.founder)} sent for **${e.task?.title}**. Drag to compare.${e.check?.remaining_issues?.length ? `\n\nStill not right: ${e.check.remaining_issues.join(" ")}` : ""}`,
    });
  }

  async function ask(question: string) {
    question = question.trim();
    const f = feed.current;
    if (!question || !thread || !f) return;
    setDraft("");
    setIdeas(false);
    add({ id: uid("you"), from: "you", text: question, at: now() });
    setBusy((n) => n + 1);
    try {
      const offices = thread.office ? [thread.office] : f.offices;
      const events = inThread(thread, f.events);
      const inside = insideNow(events);
      const context = {
        now: now(),
        offices: offices.map((o) => ({
          office: o.name,
          address: o.address,
          mess_out_of_10: o.dirt_score,
          jobs: f.tasks
            .filter((t) => String(t.office_id) === String(o.id))
            .map((t) => ({ job: t.title, room: t.room, credit_hours: t.credit_hours, status: t.status, claimed_by: t.claimed_by, inside_now: t.claimed_by ? inside.has(`${o.id}:${t.claimed_by}`) : false })),
        })),
        timeline: events.slice(-60).map((e) => `${e.at} ${plain(say(e, true))}`),
      };
      const res = await fetch("/api/bot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, context }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.answer) throw new Error(out.error ?? `Grok Bot isn't answering (${res.status})`);
      add({ id: uid("a"), from: "grok", text: out.answer, at: now() });
    } catch (e) {
      add({ id: uid("e"), from: "error", text: e instanceof Error ? e.message : "Grok Bot isn't answering.", at: now() });
    }
    setBusy((n) => n - 1);
  }

  function replay() {
    setMenu(false);
    if (thread && feed.current) play(thread, feed.current);
  }

  if (thread === undefined)
    return (
      <div className="grid h-full place-items-center">
        <Thinking shape="circle" color="#fff" lines={["Waking up", "Reading the door list", "Finding your buildings"]} />
      </div>
    );
  if (thread === null)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <Blob shape="circle" color="#fff" size={80} />
        <p className="text-[#8e8e93]">Can&apos;t find that building. It may have been taken off the map.</p>
        <Link href="/grok" className="rounded-full bg-white px-5 py-3 font-semibold text-black">
          Back to inbox
        </Link>
      </div>
    );

  const accent = thread.color;
  const ideaList = [
    "Who's inside right now?",
    "What's still unclaimed?",
    thread.office ? "How's this building doing?" : "Which building needs the most help?",
    "Draft a thank-you to today's cleaners",
  ];

  return (
    <div className="relative flex h-full flex-col">
      {/* header */}
      <div className="gb-fade-top absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pb-6 pt-[max(env(safe-area-inset-top),12px)]">
        <Link href="/grok" aria-label="Back to inbox" className="gb-press gb-glass grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div className="gb-glass flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-full pl-3 pr-5">
          <Blob shape={thread.shape} color={thread.color} badge={thread.badge} size={32} live={busy > 0} ring="#2a2a2a" />
          <span className="truncate text-[18px] font-semibold">{thread.name}</span>
        </div>
        <div className="relative">
          <button onClick={() => setMenu(!menu)} aria-label="More" aria-expanded={menu} className="gb-press gb-glass grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {menu && (
            <div className="gb-pop gb-glass absolute right-0 top-[60px] flex w-64 flex-col overflow-hidden rounded-[22px] py-1.5 text-[16px]" style={{ transformOrigin: "100% 0" }}>
              <button onClick={replay} className="px-4 py-3 text-left hover:bg-white/5">
                ▶︎ Replay a weekend (demo)
              </button>
              {thread.office && (
                <Link href={`/landlord/${thread.id}`} className="px-4 py-3 hover:bg-white/5">
                  Building details
                </Link>
              )}
              <Link href={thread.office ? `/checkin?office=${thread.id}` : "/checkin"} className="px-4 py-3 hover:bg-white/5">
                Door list
              </Link>
              <Link href="/capture" className="px-4 py-3 hover:bg-white/5">
                Scan a new office
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* messages */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-24" aria-live="polite" onClick={() => menu && setMenu(false)}>
        <div className="flex flex-col gap-2.5">
          {msgs.map((m, i) => {
            const prev = msgs[i - 1];
            const stamp = !prev || Math.abs(Date.parse(m.at) - Date.parse(prev.at)) > 15 * 60_000;
            const anim = m.in === undefined ? "" : m.from === "you" ? "gb-pop gb-pop-right" : "gb-pop gb-pop-left";
            const style = m.in ? { ["--in" as string]: `${m.in}s` } : undefined;
            return (
              <Fragment key={m.id}>
                {stamp && m.from !== "note" && <p className="py-3 text-center text-[15px] text-[#8e8e93]">{dayStamp(m.at)}</p>}
                {m.from === "note" ? (
                  <p className={`${anim} mx-auto my-2 rounded-full bg-[#1f1f1f] px-4 py-2 text-center text-[13px] text-[#8e8e93]`} style={style}>
                    {m.text}
                  </p>
                ) : m.from === "you" ? (
                  <p className={`${anim} max-w-[80%] self-end whitespace-pre-wrap rounded-[24px] px-4 py-2.5 leading-snug`} style={{ ...style, background: accent, color: ink(accent) }}>
                    {m.text}
                  </p>
                ) : (
                  <div className={`${anim} flex max-w-[88%] flex-col gap-3 self-start`} style={style}>
                    <div className={`rounded-[24px] px-4 py-3 leading-[1.38] ${m.from === "error" ? "bg-[#3a1d1d] text-[#ffb4b4]" : "bg-[#262626]"} ${m.compare ? "w-[min(88vw,22rem)]" : ""}`}>
                      <Rich text={m.text} />
                      {m.compare?.task?.before_url && m.compare.check && (
                        <div className="mt-3">
                          <Compare before={m.compare.task.before_url} after={m.compare.check.after_url} title={m.compare.task.title} />
                          <p className="mt-2 text-[13px] text-[#8e8e93]">
                            {nameOf(m.compare.founder)} · uploaded {clock(m.compare.at)} · {m.compare.check.passed ? "passed" : "not passed"} {Math.round(m.compare.check.confidence * 100)}%
                          </p>
                        </div>
                      )}
                    </div>
                    {m.chips && (
                      <div className="flex flex-wrap gap-2">
                        {m.chips.map((c) =>
                          c.href ? (
                            <Link key={c.label} href={c.href} className="gb-chip rounded-full border border-[#3a3a3c] px-4 py-2.5 text-[15px] font-medium">
                              {c.label}
                            </Link>
                          ) : (
                            <button key={c.label} onClick={() => onChip(m.id, c)} className="gb-chip rounded-full px-4 py-2.5 text-[15px] font-semibold" style={{ background: accent, color: ink(accent) }}>
                              {c.label}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
          {busy > 0 && <Thinking shape={thread.shape} color={thread.color} />}
          <div ref={end} className="h-px" />
        </div>
      </div>

      {/* composer */}
      <div className="relative shrink-0 px-3 pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
        {ideas && (
          <div className="gb-pop no-scrollbar -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
            {ideaList.map((idea) => (
              <button key={idea} onClick={() => ask(idea)} className="gb-chip shrink-0 rounded-full border border-[#3a3a3c] bg-[#1c1c1e] px-4 py-2.5 text-[15px]">
                {idea}
              </button>
            ))}
          </div>
        )}
        <form
          className="gb-glass flex h-[60px] items-center gap-2 rounded-full pl-2 pr-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
        >
          <button type="button" onClick={() => setIdeas(!ideas)} aria-label="Suggested questions" aria-expanded={ideas} className="gb-press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#3a3a3c]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={`transition-transform ${ideas ? "rotate-45" : ""}`} aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Ask ${thread.name}…`}
            aria-label="Your question"
            maxLength={500}
            className="min-w-0 flex-1 bg-transparent px-1 text-[17px] outline-none placeholder:text-[#8e8e93]"
            style={{ caretColor: accent === "#FFFFFF" ? "#FF9F0A" : accent }}
          />
          <button
            type={draft.trim() ? "submit" : "button"}
            onClick={draft.trim() ? undefined : () => input.current?.focus()}
            aria-label={draft.trim() ? "Send" : "Type a question"}
            disabled={busy > 0 && !!draft.trim()}
            className="gb-press grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-50"
            style={{ background: accent, color: ink(accent) }}
          >
            {draft.trim() ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
