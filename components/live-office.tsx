"use client"

import Link from "next/link"
import { Button } from "@/components/ui"
import { groupByRoom } from "@/track2/group"
import { formatHours } from "@/track2/text"
import type { Office, Task, TaskStatus } from "@/track2/types"

type LiveOfficeProps = {
  office: Office
  tasks: readonly Task[]
  onAnother: () => void
}

export function LiveOffice({ office, tasks, onAnother }: LiveOfficeProps) {
  const groups = groupByRoom(tasks)
  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em]">Live</p>
      <h1 className="mt-2 text-balance break-words [font-family:var(--font-evidence-serif)] text-4xl leading-[0.95] tracking-[-0.03em]">{office.name}</h1>
      <p className="mt-3 text-lg leading-snug">{office.address}</p>
      <p className="mt-4 font-mono text-sm">
        Dirt {office.dirt_score}/10 · Crew {office.crew_size}
      </p>
      <p className="mt-4 leading-snug">Send a founder a task link. They shoot the after photo and get a verdict.</p>
      <div className="mt-6">
        {groups.map((group) => (
          <section key={group.room} className="mt-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#16140f]/60">{group.room}</h2>
            <ul>
              {group.items.map((task) => (
                <li key={task.id} className="border-t border-[#ddd4c6]">
                  <Link href={`/verify/${task.id}`} className="flex items-center justify-between gap-3 py-3">
                    <span>
                      <span className="block text-lg leading-tight">{task.title}</span>
                      <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.14em]">
                        {statusLabel(task.status)} · {formatHours(task.credit_hours)}
                      </span>
                    </span>
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-5 mt-6 border-t border-[#ddd4c6] bg-[#f3efe6]/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button tone="secondary" onClick={onAnother}>
          Scan another office
        </Button>
      </div>
    </div>
  )
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "open":
      return "Open"
    case "claimed":
      return "Claimed"
    case "done":
      return "Done"
    default: {
      const neverStatus: never = status
      return neverStatus
    }
  }
}
