// What the landlord screens and the ask-grok sheet know about each office.
import { getCheckins, getCheckouts } from "../checkin/door";
import { getSlot, slotText, type Office, type Task } from "../find/data";

export type Job = Task & { inSince?: string; leftAt?: string; when?: string };

/** Tasks for one office, with who has scanned in on this device and when they said they'd come. */
export function jobsAt(office: Office, tasks: Task[]): Job[] {
  const ins = getCheckins();
  const outs = getCheckouts();
  return tasks
    .filter((x) => x.office_id === office.id)
    .map((x) => {
      const key = `${office.id}:${x.claimed_by}`;
      const inSince = x.claimed_by ? ins[key] : undefined;
      return {
        ...x,
        inSince,
        // A check-out only counts if it came after the latest door scan.
        leftAt: inSince && outs[key] > inSince ? outs[key] : undefined,
        when: x.claimed_by ? slotText(getSlot(x)) : undefined,
      };
    });
}

export const tally = (jobs: Job[]) => ({
  total: jobs.length,
  claimed: jobs.filter((x) => x.status !== "open").length,
  done: jobs.filter((x) => x.status === "done").length,
  inside: new Set(jobs.filter((x) => x.inSince).map((x) => x.claimed_by)).size,
  openHours: jobs
    .filter((x) => x.status === "open")
    .reduce((s, x) => s + Number(x.credit_hours), 0),
});
