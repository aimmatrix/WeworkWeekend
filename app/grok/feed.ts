// Grok Bot's feed: everything that happened in the landlord's buildings, in order.
// Built from what the server already knows (claims, photo checks, door visits) plus,
// for door scans made before the visits table existed, what this device saw.

import { loadAll, MOCK, sb, stayText, type Office, type Task } from "../find/data";

export type Shape = "circle" | "flower" | "squircle" | "bean" | "tilt";

export type Thread = { id: string; name: string; shape: Shape; color: string; badge?: "star"; office?: Office };

export type Check = {
  id: string;
  task_id: string;
  founder: string | null;
  after_url: string;
  passed: boolean;
  confidence: number;
  reasons: string[];
  remaining_issues: string[];
  review: string;
  created_at: string;
};

export type Ev = {
  id: string;
  kind: "claimed" | "arrived" | "verified" | "left";
  at: string;
  office: Office;
  founder: string;
  task?: Task;
  check?: Check;
  /** For "left": when this visit started. */
  since?: string;
};

export type Feed = { offices: Office[]; tasks: Task[]; checks: Check[]; events: Ev[] };

type Visit = { id: string; office_id: string; founder: string; kind: "arrived" | "left"; at: string };

/** The landlord's own assistant. White, like the sponsor's bot, with the gold star. */
export const GROK: Thread = { id: "all", name: "Grok Bot", shape: "circle", color: "#FFFFFF", badge: "star" };

const SHAPES: Shape[] = ["squircle", "circle", "bean", "tilt", "flower"];
const COLORS = ["#FF3B3B", "#8B5CF6", "#FF9500", "#22C55E", "#FF2D9B", "#2DD4BF"];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);

export function officeThread(office: Office): Thread {
  const h = hash(String(office.id));
  return { id: String(office.id), name: office.name, shape: SHAPES[h % SHAPES.length], color: COLORS[h % COLORS.length], office };
}

export const nameOf = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : "Someone");

const local = (key: string): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
};

export async function loadFeed(): Promise<Feed> {
  const { offices, tasks } = await loadAll();
  const [checks, visits] = MOCK
    ? [[], []]
    : await Promise.all([
        sb<Check[]>("verifications?select=id,task_id,founder,after_url,passed,confidence,reasons,remaining_issues,review,created_at&order=created_at.asc").catch(() => [] as Check[]),
        // Missing until the visits migration is applied; the feed then relies on this device.
        sb<Visit[]>("visits?select=*&order=at.asc").catch(() => [] as Visit[]),
      ]);

  const officeById = new Map(offices.map((o) => [String(o.id), o]));
  const taskById = new Map(tasks.map((t) => [String(t.id), t]));
  const events: Ev[] = [];

  for (const task of tasks) {
    const office = officeById.get(String(task.office_id));
    if (office && task.claimed_by && task.claimed_at)
      events.push({ id: `c:${task.id}`, kind: "claimed", at: task.claimed_at, office, founder: task.claimed_by, task });
  }

  for (const check of checks) {
    const task = taskById.get(String(check.task_id));
    const office = task && officeById.get(String(task.office_id));
    if (task && office) events.push({ id: `v:${check.id}`, kind: "verified", at: check.created_at, office, founder: check.founder ?? task.claimed_by ?? "", task, check });
  }

  const doorEvents: Omit<Ev, "id">[] = visits.flatMap((v) => {
    const office = officeById.get(String(v.office_id));
    return office ? [{ kind: v.kind, at: v.at, office, founder: v.founder }] : [];
  });
  // Door scans this device made, unless the server already has one within two minutes.
  const near = (kind: string, office: string, founder: string, at: string) =>
    doorEvents.some((e) => e.kind === kind && String(e.office.id) === office && e.founder === founder && Math.abs(Date.parse(e.at) - Date.parse(at)) < 120_000);
  for (const [kind, key] of [
    ["arrived", "checkins"],
    ["left", "checkouts"],
  ] as const) {
    for (const [k, at] of Object.entries(local(key))) {
      const i = k.indexOf(":");
      const officeId = k.slice(0, i);
      const founder = k.slice(i + 1);
      const office = officeById.get(officeId);
      if (office && founder && !near(kind, officeId, founder, at)) doorEvents.push({ kind, at, office, founder });
    }
  }
  doorEvents.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const lastIn = new Map<string, string>();
  for (const e of doorEvents) {
    const who = `${e.office.id}:${e.founder}`;
    const ev: Ev = { ...e, id: `${e.kind[0]}:${who}:${e.at}` };
    if (e.kind === "arrived") lastIn.set(who, e.at);
    else ev.since = lastIn.get(who);
    events.push(ev);
  }

  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { offices, tasks, checks, events };
}

export const inThread = (thread: Thread, events: Ev[]) => (thread.office ? events.filter((e) => String(e.office.id) === thread.id) : events);

/** Who is inside right now: scanned in and not yet checked out. */
export function insideNow(events: Ev[]): Set<string> {
  const inside = new Set<string>();
  for (const e of events) {
    const who = `${e.office.id}:${e.founder}`;
    if (e.kind === "arrived") inside.add(who);
    if (e.kind === "left") inside.delete(who);
  }
  return inside;
}

// ---- words --------------------------------------------------------------------

export const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "22:02" today, "Yesterday", or "Sep 18". */
export function when(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return clock(iso);
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" }).replace(/(\d+) (\w+)/, "$2 $1");
}

export function dayStamp(iso: string): string {
  const w = when(iso);
  return /^\d/.test(w) ? `Today ${w}` : `${w} ${clock(iso)}`;
}

const hrs = (h: number) => `${Number(h)}h`;
const pct = (c: number) => `${Math.round(Number(c) * 100)}%`;

/** What Grok Bot says about one event. **bold** is rendered as bold. */
export function say(e: Ev, multi: boolean, live = false): string {
  const who = `**${nameOf(e.founder)}**`;
  const where = multi ? ` at ${e.office.name}` : "";
  const job = e.task?.title ?? "a job";
  switch (e.kind) {
    case "claimed":
      return `${who} ${live || Date.now() - Date.parse(e.at) < 30 * 60_000 ? "just " : ""}accepted a job${where}: **${job}**. ${hrs(e.task?.credit_hours ?? 0)} of desk time on the line.`;
    case "arrived":
      return `${who} is at the door${where}. Scanned in and let in at **${clock(e.at)}**.`;
    case "verified":
      return e.check?.passed
        ? `${who} finished **${job}**${where} and uploaded the after photo. I checked it against the before shot: **passed**, ${pct(e.check.confidence)} sure. Want to see the before and after?`
        : `${who} uploaded an after photo for **${job}**${where}, but it **didn't pass** (${pct(e.check?.confidence ?? 0)} sure)${
            e.check?.remaining_issues?.[0] ? `: ${e.check.remaining_issues[0].replace(/\.$/, "")}` : ""
          }. They can have another go.`;
    case "left": {
      const stay = e.since ? ` after ${stayText(Date.parse(e.at) - Date.parse(e.since))} on site` : "";
      return `${who} checked out${where} at **${clock(e.at)}**${stay}. Door's shut behind them.`;
    }
  }
}

export const plain = (s: string) => s.replace(/\*\*/g, "");

/** Grok Bot's catch-up, written like a chief of staff: where things stand and what needs you. */
export function brief(thread: Thread, feed: Feed, since: string | null): { text: string; decision?: string } {
  const offices = thread.office ? [thread.office] : feed.offices;
  const ids = new Set(offices.map((o) => String(o.id)));
  const tasks = feed.tasks.filter((t) => ids.has(String(t.office_id)));
  const events = inThread(thread, feed.events);
  const claimed = tasks.filter((t) => t.status !== "open").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const open = tasks.filter((t) => t.status === "open");
  const openHours = open.reduce((s, t) => s + Number(t.credit_hours), 0);
  const inside = insideNow(events).size;
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const scope = thread.office ? thread.office.name : `your ${offices.length} ${offices.length === 1 ? "building" : "buildings"}`;

  const fresh = since ? events.filter((e) => Date.parse(e.at) > Date.parse(since)) : [];
  const recap = fresh.length
    ? ` Since you last looked: ${[
        ["claimed", "job accepted", "jobs accepted"],
        ["arrived", "door scan", "door scans"],
        ["verified", "photo check", "photo checks"],
        ["left", "check-out", "check-outs"],
      ]
        .map(([k, one, many]) => {
          const n = fresh.filter((e) => e.kind === k).length;
          return n ? `${n} ${n === 1 ? one : many}` : "";
        })
        .filter(Boolean)
        .join(", ")}.`
    : "";

  const text =
    tasks.length === 0
      ? `${hello}! Nothing listed at ${scope} yet. Scan an office and I'll keep you posted on who's cleaning it.`
      : `${hello}! Here's ${scope} right now: **${claimed}/${tasks.length} jobs claimed**, ${inside} ${inside === 1 ? "person" : "people"} inside, ${done} passed my photo check.${
          openHours ? ` ${hrs(openHours)} of cleaning still up for grabs.` : " Every job is taken."
        }${recap} I'll message you here when someone accepts a job, gets let in, uploads their after photo or checks out.`;

  // Failed checks on jobs that are still not done: the landlord may want to step in.
  const failing = feed.checks.filter((c) => !c.passed && c.review === "pending" && tasks.some((t) => String(t.id) === String(c.task_id) && t.status !== "done"));
  const decision = failing.length
    ? `**Decision needed from you:** ${failing.length} after ${failing.length === 1 ? "photo" : "photos"} didn't pass my check. Let them retry, or overrule me in the supervisor queue.`
    : undefined;
  return { text, decision };
}

// ---- read receipts (per device) -----------------------------------------------

export const lastRead = (threadId: string): string | null => local("grok_read")[threadId] ?? null;

export function markRead(threadId: string) {
  try {
    localStorage.setItem("grok_read", JSON.stringify({ ...local("grok_read"), [threadId]: new Date().toISOString() }));
  } catch {}
}
