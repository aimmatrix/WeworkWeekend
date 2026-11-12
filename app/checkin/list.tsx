"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { card, loadAll, MOCK, muted, stayText, type Office, type Task } from "../find/data";
import { DoorCode } from "./code";
import { clock, doorKey, getCheckins, getCheckouts, setCheckin, shareDoor } from "./door";

/** The door list: who is coming to clean, and who has been let in. Anyone with the link can run it. */
export default function DoorList() {
  const officeId = useSearchParams().get("office");
  const [data, setData] = useState<{ offices: Office[]; tasks: Task[] } | null>(null);
  const [ins, setIns] = useState<Record<string, string>>({});
  const [outs, setOuts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = () => {
      loadAll().then(setData, () => setData({ offices: [], tasks: [] }));
      setIns(getCheckins());
      setOuts(getCheckouts());
    };
    load();
    // Guests claim tasks while the door is open, so keep the list fresh.
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  if (!data) return <p className={`p-5 ${muted}`}>finding the clipboard…</p>;

  const guestsAt = (id: Office["id"]) => [...new Set(data.tasks.filter((x) => x.office_id === id && x.claimed_by).map((x) => x.claimed_by!))];
  const office = data.offices.find((o) => String(o.id) === officeId);

  if (!office)
    return (
      <div className="flex min-h-full flex-col gap-4 p-4 pb-8">
        <div className="px-1 pt-2">
          <h1 className="display text-[28px] leading-[1.15]">which door are you on?</h1>
          <p className={`mt-2 ${muted}`}>pick an office. you get the clipboard and all the power.</p>
        </div>
        {data.offices.map((o) => {
          const n = guestsAt(o.id).length;
          return (
            <Link key={o.id} href={`/checkin?office=${o.id}`} className={`flex min-h-[72px] items-center gap-3 px-4 py-3 ${card}`}>
              <span aria-hidden className="text-[26px] leading-none">🚪</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{o.name}</p>
                <p className={`truncate text-[13px] ${muted}`}>{o.address}</p>
              </div>
              <span className="display shrink-0 text-[13px] tabular-nums">{n === 0 ? "no one yet" : `${n} coming`}</span>
            </Link>
          );
        })}
        {data.offices.length === 0 && <p className={`p-4 ${card}`}>no live offices. nothing to guard.</p>}
      </div>
    );

  const guests = guestsAt(office.id).map((name) => {
    const tasks = data.tasks.filter((x) => x.office_id === office.id && x.claimed_by === name);
    return { name, key: doorKey(office.id, name), jobs: tasks.map((x) => x.title).join(" · "), hours: tasks.reduce((s, x) => s + Number(x.credit_hours), 0) };
  });
  const inside = guests.filter((g) => ins[g.key]).length;
  const late = guests.length - inside;
  const shown = guests.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));
  const mood =
    guests.length === 0
      ? "nobody has signed up to clean yet. suspicious."
      : late === 0
        ? "full house. lock the snack cupboard."
        : `${late} still "five minutes away".`;

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 pb-8">
      <div className="px-1 pt-2">
        <Link href="/checkin" className={`text-sm underline ${muted}`}>
          all doors
        </Link>
        <h1 className="display mt-1 text-[26px] leading-tight">{office.name}</h1>
        <p className={muted}>door list · {office.address}</p>
      </div>

      <div className="flex flex-col gap-1.5 rounded-[32px] bg-[#0B0B0C] p-6 text-white">
        <p className="flex items-baseline gap-3">
          <span className="display text-[64px] leading-none tracking-tighter tabular-nums">
            {inside}/{guests.length}
          </span>
          <span className="text-[#C9D3DF]">let in</span>
        </p>
        <p className="mt-1 text-sm leading-snug text-[#C9D3DF]">{mood}</p>
      </div>

      <DoorCode office={office} />

      {guests.length > 3 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="find a name"
          aria-label="Find a guest by name"
          className="h-[52px] rounded-full bg-white px-5 text-[16px] outline-none focus:ring-2 focus:ring-[#0B0B0C]"
        />
      )}

      <ul className="flex flex-col gap-2">
        {shown.map((g) => {
          const at = ins[g.key];
          const left = at && outs[g.key] > at ? outs[g.key] : undefined;
          return (
            <li key={g.key} className={`flex min-h-[72px] items-center gap-3 py-2 pl-3.5 pr-3 ${card}`}>
              <span aria-hidden className={`display grid h-11 w-11 shrink-0 place-items-center rounded-full uppercase ${at ? "bg-[#DDF3E6] text-[#0A6B3B]" : "bg-[#EEF3F9]"}`}>
                {at ? "✓" : g.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{g.name}</p>
                <p className={`truncate text-[13px] ${muted}`}>
                  {left ? `left at ${clock(left)} · on site ${stayText(Date.parse(left) - Date.parse(at))}` : at ? `in since ${clock(at)}` : g.jobs} · +{g.hours}h
                </p>
              </div>
              <button
                onClick={() => setIns(setCheckin(g.key, !at))}
                className={`display h-11 shrink-0 rounded-full px-4 text-[13px] ${at ? "border border-[#C9D3DF] bg-white" : "bg-[#FF5A1F]"}`}
              >
                {at ? "undo" : "let in"}
              </button>
            </li>
          );
        })}
      </ul>
      {guests.length > 0 && shown.length === 0 && <p className={`px-1 ${muted}`}>nobody by that name. a likely story.</p>}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <p className={`px-1 text-sm leading-snug ${muted}`}>no scan, no mop. tick people off here as they come through the door.</p>
        <button
          onClick={async () => setCopied(await shareDoor(office.id, office.name))}
          className="display h-14 rounded-full bg-[#0B0B0C] text-[15px] text-white"
        >
          {copied ? "link copied. go and delegate" : "hand the door to someone else"}
        </button>
        {!MOCK && (
          <Link href="/supervisor" className="flex h-11 items-center justify-center font-bold underline">
            check grok&apos;s homework
          </Link>
        )}
      </div>
    </div>
  );
}
