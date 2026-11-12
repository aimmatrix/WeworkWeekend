"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** The jobs at an office, led by the photo of what needs cleaning. Claiming one opens its job screen. */
export function TaskList({ tasks, onChange }: { tasks: Task[]; onChange?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Task["id"] | null>(null);
  const [lost, setLost] = useState<Task["id"][]>([]);
  const me = getFounder();

  async function claim(id: Task["id"]) {
    setBusy(id);
    const ok = await claimTask(id, me).catch(() => false);
    window.dispatchEvent(new Event("wallet"));
    if (ok) return router.push(`/find/job/${id}`);
    setLost((list) => [...list, id]);
    setBusy(null);
    onChange?.();
  }

  const sorted = [...tasks].sort((a, b) => b.credit_hours - a.credit_hours);
  if (!sorted.length) return <p className={`py-4 ${muted}`}>suspiciously clean. nothing to do here.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((task) => {
        const isMine = task.status !== "open" && task.claimed_by === me;
        const taken = lost.includes(task.id) || (task.status !== "open" && !isMine);
        return (
          <li key={task.id} className={`overflow-hidden !rounded-[28px] ${card} ${taken ? "opacity-60" : ""}`}>
            <div className="relative">
              {task.before_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={task.before_url} alt={`What needs cleaning: ${task.title}`} className={`aspect-[16/10] w-full object-cover ${taken ? "grayscale" : ""}`} />
              ) : (
                <div className="grid aspect-[16/10] w-full place-items-center bg-[#DCE5EF] text-6xl" aria-hidden>
                  {ICON[catOf(task)] ?? "✨"}
                </div>
              )}
              <span className={`display absolute right-3 top-3 flex items-center rounded-full tabular-nums shadow-md ${reward(task.credit_hours)}`}>+{task.credit_hours}h</span>
            </div>
            <div className="flex items-center gap-3 p-3 pl-4">
              <Emoji task={task} />
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-snug">{task.title}</p>
                <p className={`truncate text-[13px] ${muted}`}>{task.room}</p>
              </div>
              {taken ? (
                <span className={`shrink-0 text-right text-[13px] font-semibold ${muted}`}>
                  🔒 {task.claimed_by && task.claimed_by !== me ? `${task.claimed_by} got` : "someone got"}
                  <br />
                  there first
                </span>
              ) : isMine ? (
                <Link
                  href={task.status === "done" ? "/find/tasks" : `/find/job/${task.id}`}
                  className="display flex h-11 shrink-0 items-center rounded-full bg-[#DDF3E6] px-4 text-[13px] font-medium text-[#0A6B3B]"
                >
                  {task.status === "done" ? "done ✓" : "yours →"}
                </Link>
              ) : (
                <button
                  onClick={() => claim(task.id)}
                  disabled={busy !== null}
                  className="display h-11 shrink-0 rounded-full bg-[#0B0B0C] px-5 text-[13px] font-medium text-white disabled:opacity-50"
                >
                  {busy === task.id ? "…" : "i'll do it"}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
