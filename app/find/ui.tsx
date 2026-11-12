"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { card, catOf, claimTask, getBalance, getFounder, ICON, loadAll, muted, reward, type Task } from "./data";

export function Emoji({ task, className = "" }: { task: Task; className?: string }) {
  return (
    <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EEF3F9] text-[22px] leading-none ${className}`}>
      {ICON[catOf(task)] ?? "✨"}
    </span>
  );
}

const float = "shadow-[0_8px_20px_rgba(15,30,60,0.18)]";

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

/** Floating bar on every screen: a black pill (search or back), my tasks, and the wallet. */
export function TopBar({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [todo, setTodo] = useState(0);

  // Pages fire a "wallet" event when the balance or the task list may have changed.
  useEffect(() => {
    const me = getFounder();
    const load = () => {
      getBalance(me).then(setBalance, () => setBalance(null));
      loadAll().then((d) => setTodo(d.tasks.filter((x) => x.claimed_by === me && x.status === "claimed").length), () => {});
    };
    load();
    window.addEventListener("wallet", load);
    return () => window.removeEventListener("wallet", load);
  }, []);

  return (
    <div className={`z-20 flex items-center gap-2 p-4 ${className}`}>
      {children ?? (
        <Link href="/find" aria-label="Back to the map" className={`grid h-[52px] w-[52px] place-items-center rounded-full bg-[#0B0B0C] text-white ${float}`}>
          <BackIcon />
        </Link>
      )}
      <Link
        href="/find/tasks"
        aria-label={`My tasks, ${todo} waiting for a photo`}
        className={`relative ml-auto grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-white ${float}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6.5l1.5 1.5L8 5M4 12.5l1.5 1.5L8 11M4 18.5l1.5 1.5L8 17M12 7h8M12 13h8M12 19h8" />
        </svg>
        {todo > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF5A1F] px-1 text-[11px] font-bold">{todo}</span>
        )}
      </Link>
      <Link
        href="/find/book"
        aria-label={`Wallet: ${balance ?? 0} credit hours. Book a desk`}
        className={`flex h-[52px] shrink-0 items-center gap-2 rounded-full bg-white px-4 ${float}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span className="display tabular-nums">{balance === null ? "–" : balance}h</span>
      </Link>
    </div>
  );
}

export function TaskList({ tasks, onChange }: { tasks: Task[]; onChange?: () => void }) {
  const [busy, setBusy] = useState<Task["id"] | null>(null);
  const [mine, setMine] = useState<Task["id"][]>([]);
  const [lost, setLost] = useState<Task["id"][]>([]);
  const me = getFounder();

  async function claim(id: Task["id"]) {
    setBusy(id);
    const ok = await claimTask(id, me).catch(() => false);
    (ok ? setMine : setLost)((list) => [...list, id]);
    setBusy(null);
    window.dispatchEvent(new Event("wallet"));
    onChange?.();
  }

  const sorted = [...tasks].sort((a, b) => b.credit_hours - a.credit_hours);
  if (!sorted.length) return <p className={`py-4 ${muted}`}>suspiciously clean. nothing to do here.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((task) => {
        const isMine = mine.includes(task.id) || (task.status !== "open" && task.claimed_by === me);
        const taken = lost.includes(task.id) || (task.status !== "open" && !isMine);
        if (taken)
          return (
            <li key={task.id} className={`flex min-h-[68px] items-center gap-3 rounded-3xl border border-dashed border-[#B5C1CF] bg-[#F6F9FC] py-2 pl-3.5 pr-4 ${muted}`}>
              <Emoji task={task} className="!bg-[#E3EAF2] grayscale" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{task.title}</p>
                <p className="truncate text-[13px]">
                  {task.room} · +{task.credit_hours}h
                </p>
              </div>
              <span className="text-[13px] font-semibold">🔒 {task.claimed_by ? `${task.claimed_by} got there first` : "someone got there first"}</span>
            </li>
          );
        return (
          <li key={task.id} className={`flex min-h-[72px] items-center gap-3 py-2 pl-3.5 pr-3 ${card}`}>
            <Emoji task={task} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{task.title}</p>
              <p className={`truncate text-[13px] ${muted}`}>{task.room}</p>
            </div>
            <span className={`display flex shrink-0 items-center rounded-full tabular-nums ${reward(task.credit_hours)}`}>+{task.credit_hours}h</span>
            {isMine ? (
              <Link href="/find/tasks" className="display flex h-11 shrink-0 items-center rounded-full bg-[#DDF3E6] px-4 text-[13px] font-medium text-[#0A6B3B]">
                yours ✓
              </Link>
            ) : (
              <button
                onClick={() => claim(task.id)}
                disabled={busy !== null}
                className="display h-11 shrink-0 rounded-full bg-[#0B0B0C] px-4 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {busy === task.id ? "…" : "claim"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
