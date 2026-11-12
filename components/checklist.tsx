"use client"

import { Photo } from "@/components/photo"
import { groupByRoom } from "@/track2/group"
import { formatHours } from "@/track2/text"
import type { AssessTask } from "@/track2/types"

type ChecklistProps = {
  tasks: readonly AssessTask[]
  onRemove: (id: string) => void
}

export function Checklist({ tasks, onRemove }: ChecklistProps) {
  const groups = groupByRoom(tasks)
  return (
    <div>
      {groups.map((group) => (
        <section key={group.room} className="mt-6 first:mt-0">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#16140f]/60">{group.room}</h2>
          <ul>
            {group.items.map((task) => (
              <li key={task.id} className="flex items-start gap-3 border-t border-[#ddd4c6] py-3">
                <Photo url={task.before_url} alt="" className="h-14 w-14 shrink-0 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg leading-tight">{task.title}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono">{formatHours(task.credit_hours)}</p>
                  <button
                    type="button"
                    onClick={() => onRemove(task.id)}
                    className="mt-2 text-sm underline decoration-[#16140f]/30 underline-offset-4"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
