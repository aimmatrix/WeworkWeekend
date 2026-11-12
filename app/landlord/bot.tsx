"use client";

import { useEffect, useRef, useState } from "react";
import { useQuip } from "../capture/quip";
import { loadAll, muted } from "../find/data";
import { jobsAt } from "./data";

const WAITING = ["grok is reading the clipboard…", "grok is counting who actually turned up…", "grok is judging the kitchen…", "grok is thinking. it does that slowly…"];
const IDEAS = ["who is coming this weekend?", "what is still unclaimed?", "who has scanned in?", "draft a note to the cleaners"];

type Line = { from: "you" | "grok" | "error"; text: string };

/** Floating ask-grok button and chat sheet. Every answer comes from the server; nothing is made up here. */
export function Bot() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const quip = useQuip(WAITING, busy);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines, busy]);

  async function ask(question: string) {
    question = question.trim();
    if (!question || busy) return;
    setDraft("");
    setLines((l) => [...l, { from: "you", text: question }]);
    setBusy(true);
    try {
      const { offices, tasks } = await loadAll();
      // Photos are left out: they are large and the question is about people and jobs.
      const context = offices.map((o) => ({
        office: o.name,
        address: o.address,
        mess_out_of_10: o.dirt_score,
        crew_needed: o.crew_size,
        jobs: jobsAt(o, tasks).map((j) => ({ job: j.title, room: j.room, credit_hours: j.credit_hours, status: j.status, claimed_by: j.claimed_by, visit: j.when, scanned_in_at: j.inSince, left_at: j.leftAt })),
      }));
      const res = await fetch("/api/bot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, context }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.answer) throw new Error(out.error ?? `grok is not answering (${res.status})`);
      setLines((l) => [...l, { from: "grok", text: out.answer }]);
    } catch (e) {
      setLines((l) => [...l, { from: "error", text: e instanceof Error ? e.message : "grok is not answering." }]);
    }
    setBusy(false);
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="display fixed bottom-5 left-1/2 z-30 flex h-[52px] translate-x-[calc(min(100vw,28rem)/2-100%-16px)] items-center gap-2 rounded-full bg-[#0B0B0C] px-5 text-[13px] text-white shadow-[0_8px_20px_rgba(15,30,60,0.3)]"
      >
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#FF5A1F]" /> ask grok
      </button>
    );

  return (
    <div role="dialog" aria-label="Ask Grok" className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[78dvh] w-full max-w-md flex-col rounded-t-[32px] bg-white shadow-[0_-12px_40px_rgba(15,30,60,0.25)]">
      <div className="flex items-center gap-3 px-5 pb-2 pt-4">
        <div className="min-w-0 flex-1">
          <h2 className="display text-lg">ask grok</h2>
          <p className={`text-[13px] ${muted}`}>knows your offices, jobs and who turned up. takes about half a minute.</p>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EEF3F9] text-xl leading-none">
          ×
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-2 normal-case" aria-live="polite">
        {lines.length === 0 && (
          <div className="flex flex-wrap gap-2 lowercase">
            {IDEAS.map((idea) => (
              <button key={idea} onClick={() => ask(idea)} className="flex min-h-11 items-center rounded-full border border-[#C9D3DF] px-4 text-left font-medium">
                {idea}
              </button>
            ))}
          </div>
        )}
        {lines.map((line, i) => (
          <p
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-[22px] px-4 py-3 leading-snug ${
              line.from === "you" ? "self-end bg-[#0B0B0C] text-white" : line.from === "grok" ? "self-start bg-[#EEF3F9]" : "self-start bg-[#FFDCCB] font-medium"
            }`}
          >
            {line.text}
          </p>
        ))}
        {busy && <p className={`self-start rounded-[22px] bg-[#EEF3F9] px-4 py-3 lowercase ${muted}`}>{quip}</p>}
        <div ref={end} />
      </div>

      <form
        className="flex gap-2 p-4 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ask about your offices"
          aria-label="Your question"
          maxLength={500}
          className="h-[52px] min-w-0 flex-1 rounded-full bg-[#EEF3F9] px-5 text-[16px] outline-none focus:ring-2 focus:ring-[#0B0B0C]"
        />
        <button disabled={busy || !draft.trim()} className="display h-[52px] shrink-0 rounded-full bg-[#FF5A1F] px-5 text-[13px] disabled:opacity-40">
          ask
        </button>
      </form>
    </div>
  );
}
