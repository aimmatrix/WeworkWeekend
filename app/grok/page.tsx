"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Blob } from "./blob";
import { GROK, inThread, lastRead, loadFeed, officeThread, plain, say, when, type Feed, type Thread } from "./feed";

/** The landlord's inbox: Grok Bot pinned on top, one thread per building below. */
export default function GrokInbox() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [folded, setFolded] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => loadFeed().then(setFeed, (e) => setError(String(e?.message ?? e)));
    load();
    const id = setInterval(load, 8_000);
    return () => clearInterval(id);
  }, []);

  const threads = (feed?.offices ?? []).map(officeThread);
  const unreadIn = (t: Thread) => {
    if (!feed) return 0;
    const seen = lastRead(t.id);
    return inThread(t, feed.events).filter((e) => !seen || Date.parse(e.at) > Date.parse(seen)).length;
  };
  const last = (t: Thread) => (feed ? inThread(t, feed.events).at(-1) : undefined);
  const rows = threads
    .filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Date.parse(last(b)?.at ?? "0") - Date.parse(last(a)?.at ?? "0"));
  const unreadRows = rows.filter((t) => unreadIn(t) > 0).length;
  const grokUnread = unreadIn(GROK) > 0;

  return (
    <div className="flex h-full flex-col">
      <div ref={list} className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-32">
        <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),16px)]">
          <Link href="/landlord" aria-label="Your offices" className="gb-press relative grid h-[52px] w-[52px] place-items-center rounded-full bg-[#2c2c2e] text-[20px] font-semibold text-[#c7c7cc]">
            L
            <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-[#141414] bg-[#0A84FF]" />
          </Link>
          <Link href="/capture" aria-label="Scan a new office" className="gb-press gb-glass grid h-[52px] w-[52px] place-items-center rounded-full">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M12 4v16M4 12h16" />
            </svg>
          </Link>
        </div>

        {/* pinned bots */}
        <div className="flex justify-center gap-10 pb-6 pt-5">
          <Link href="/grok/all" className="gb-press flex flex-col items-center gap-3">
            <Blob shape={GROK.shape} color={GROK.color} badge={GROK.badge} size={104} />
            <span className="flex items-center gap-1.5 text-[17px]">
              Grok Bot {grokUnread && <span className="h-2.5 w-2.5 rounded-full bg-[#0A84FF]" aria-label="unread" />}
            </span>
          </Link>
          <Link href="/checkin" className="gb-press flex flex-col items-center gap-3">
            <Blob shape="flower" color="#8B5CF6" size={104} delay={1.3} />
            <span className="text-[17px]">Door Bot</span>
          </Link>
        </div>

        <button onClick={() => setFolded(!folded)} aria-expanded={!folded} className="flex items-center gap-2 px-5 pb-2 text-[17px] text-[#8e8e93]">
          Your buildings
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${folded ? "-rotate-90" : ""}`} aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {error && <p className="mx-4 rounded-2xl bg-[#3a1d1d] p-4 text-[15px] text-[#ff9f9f]">{error}</p>}
        {!feed && !error && <p className="px-5 py-4 text-[#8e8e93]">Grok Bot is waking up…</p>}
        {feed && rows.length === 0 && <p className="px-5 py-4 text-[#8e8e93]">No buildings yet. Tap + to scan one.</p>}

        {!folded &&
          rows.map((t, i) => {
            const e = last(t);
            const unread = unreadIn(t) > 0;
            return (
              <Link key={t.id} href={`/grok/${t.id}`} data-unread={unread || undefined} className="gb-pop gb-press flex items-center gap-4 px-4 py-3" style={{ ["--in" as string]: `${i * 0.05}s` }}>
                <Blob shape={t.shape} color={t.color} size={60} delay={i * 0.7} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[19px] font-medium">{t.name}</span>
                    <span className="shrink-0 text-[15px] text-[#8e8e93]">{e ? when(e.at) : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[16px] text-[#8e8e93]">{e ? plain(say(e, false)) : "Quiet so far. Nobody's claimed a job yet."}</span>
                    {unread && <span className="h-3 w-3 shrink-0 rounded-full bg-[#0A84FF]" aria-label="unread" />}
                  </div>
                </div>
              </Link>
            );
          })}
      </div>

      {unreadRows > 0 && (
        <button
          onClick={() => list.current?.querySelector("[data-unread]")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="gb-nudge absolute bottom-[104px] left-1/2 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-[#0A84FF] px-5 text-[17px] font-medium shadow-[0_8px_24px_rgba(10,132,255,0.35)]"
        >
          {unreadRows} unread
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}

      <div className="gb-fade-bottom absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-8">
        <Link href="/" aria-label="All WeWorkWeekend screens" className="gb-press gb-glass grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
            <path d="M17 13.5v7M13.5 17h7" strokeLinecap="round" />
          </svg>
        </Link>
        <label className="gb-glass flex h-[56px] min-w-0 flex-1 items-center gap-3 rounded-full px-5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search buildings" className="min-w-0 flex-1 bg-transparent text-[18px] outline-none placeholder:text-[#8e8e93]" />
        </label>
      </div>
    </div>
  );
}
