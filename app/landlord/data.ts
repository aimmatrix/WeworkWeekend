// What the landlord screens and the ask-grok sheet know about each office.
import { getCheckins } from "../checkin/door";
import { getSlot, slotText, type Office, type Task } from "../find/data";

export type Job = Task & { inSince?: string; when?: string };

/** Tasks for one office, with who has scanned in on this device and when they said they'd come. */
export function jobsAt(office: Office, tasks: Task[]): Job[] {
  const ins = getCheckins();
  return tasks
    .filter((x) => x.office_id === office.id)
    .map((x) => ({
      ...x,
      inSince: x.claimed_by ? ins[`${office.id}:${x.claimed_by}`] : undefined,
      when: x.claimed_by ? slotText(getSlot(x)) : undefined,
    }));
}

export const tally = (jobs: Job[]) => ({
  total: jobs.length,
  claimed: jobs.filter((x) => x.status !== "open").length,
  done: jobs.filter((x) => x.status === "done").length,
  inside: new Set(jobs.filter((x) => x.inSince).map((x) => x.claimed_by)).size,
  openHours: jobs.filter((x) => x.status === "open").reduce((s, x) => s + Number(x.credit_hours), 0),
});
