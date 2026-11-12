// The door list's check-ins. They are kept on the device doing the door, like a paper guest list.
// Move them to a checked_in_at column on tasks when two people need to work the same door.

type Checkins = Record<string, string>; // "<officeId>:<founder>" -> ISO time

export const doorKey = (officeId: string | number, founder: string) => `${officeId}:${founder}`;

export const getCheckins = (): Checkins => JSON.parse(localStorage.getItem("checkins") ?? "{}");

export function setCheckin(key: string, inside: boolean): Checkins {
  const all = getCheckins();
  if (!inside) delete all[key];
  else if (!all[key]) all[key] = new Date().toISOString();
  localStorage.setItem("checkins", JSON.stringify(all));
  return all;
}

export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Hands the door to someone else: opens the share sheet, or copies the link. Returns true when copied. */
export async function shareDoor(officeId: string | number, officeName: string): Promise<boolean> {
  const url = `${location.origin}/checkin?office=${encodeURIComponent(officeId)}`;
  if (navigator.share) {
    await navigator.share({ title: `Door list: ${officeName}`, text: `You're on the door at ${officeName}. Let the cleaners in.`, url }).catch(() => {});
    return false;
  }
  await navigator.clipboard.writeText(url);
  return true;
}
