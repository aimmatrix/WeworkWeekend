// Data for the founder app. Talks to Supabase over plain REST when the env vars
// are set, otherwise falls back to seed data kept in localStorage.

export type Office = {
  id: string | number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  crew_size: number;
  dirt_score: number;
  status: string;
  photo_urls?: string[];
};

export type Task = {
  id: string | number;
  office_id: string | number;
  room: string;
  title: string;
  category: string;
  credit_hours: number;
  before_url: string | null;
  status: "open" | "claimed" | "done";
  claimed_by: string | null;
};

export type Booking = { office: string; hours: number; at: string; id?: string };

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const MOCK = !URL || !KEY;

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const MAP_STYLE = "mapbox://styles/mapbox/light-v11";
export const WATER = "#cfe2f6"; // the pale style's grey water, tinted blue

const waterLayer = encodeURIComponent(
  JSON.stringify({ id: "w2", type: "fill", source: "composite", "source-layer": "water", paint: { "fill-color": WATER } }),
);
/** A still image of the same pale map, for screens that do not need a live one. */
export const staticMap = (lng: number, lat: number, zoom: number, w = 448, h = 400) =>
  MAPBOX_TOKEN &&
  `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${lng},${lat},${zoom}/${w}x${h}@2x?access_token=${MAPBOX_TOKEN}&addlayer=${waterLayer}&before_layer=land-structure-polygon`;

export async function sb<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---- mock seed -------------------------------------------------------------

const MOCK_OFFICES: Office[] = [
  { id: "o1", name: "Shoreditch Works", address: "12 Curtain Rd, EC2A 3NH", lat: 51.5246, lng: -0.0803, crew_size: 3, dirt_score: 7, status: "live" },
  { id: "o2", name: "King's Cross Studio", address: "4 Pancras Sq, N1C 4AG", lat: 51.5335, lng: -0.1262, crew_size: 2, dirt_score: 4, status: "live" },
  { id: "o3", name: "Southbank Loft", address: "99 Upper Ground, SE1 9PP", lat: 51.5075, lng: -0.1107, crew_size: 4, dirt_score: 9, status: "live" },
];

const t = (id: string, office_id: string, room: string, title: string, category: string, credit_hours: number, photo: string): Task =>
  ({ id, office_id, room, title, category, credit_hours, before_url: `/seed/${photo}-before.jpg`, status: "open", claimed_by: null });

const MOCK_TASKS: Task[] = [
  t("t1", "o1", "Kitchen", "De-crust the kitchen", "kitchen", 2, "kitchen"),
  t("t2", "o1", "Main floor", "Evict the bins", "bins", 1, "kitchen"),
  t("t3", "o1", "Main floor", "De-crumb the desks", "desks", 0.5, "openplan"),
  t("t4", "o2", "Washroom", "Face the toilet", "toilet", 3, "bathroom"),
  t("t5", "o2", "Meeting room", "Un-fort the meeting room", "furniture", 0.5, "meeting"),
  t("t6", "o3", "Washroom", "Face both toilets", "toilet", 3, "bathroom"),
  t("t7", "o3", "Kitchen", "Exorcise the kitchen", "kitchen", 2, "kitchen"),
  t("t8", "o3", "Open plan", "Hoover up the crumbs", "floor", 1, "studio"),
  t("t9", "o3", "Open plan", "Evict the bins", "bins", 1, "breakout"),
];

export function mockTasks(): Task[] {
  const saved = localStorage.getItem("mock_tasks");
  return saved ? JSON.parse(saved) : MOCK_TASKS;
}

// ---- API -------------------------------------------------------------------

export const getFounder = () => (typeof localStorage === "undefined" ? "" : (localStorage.getItem("founder") ?? ""));

export async function loadAll(): Promise<{ offices: Office[]; tasks: Task[] }> {
  // Offices a landlord published from /capture on this device join the seed ones.
  if (MOCK) return { offices: [...MOCK_OFFICES, ...JSON.parse(localStorage.getItem("mock_offices") ?? "[]")], tasks: mockTasks() };
  const [offices, tasks] = await Promise.all([
    sb<Office[]>("offices?status=eq.live&select=*"),
    sb<Task[]>("tasks?select=*"),
  ]);
  return { offices, tasks };
}

/** Returns false if another founder got there first. */
export async function claimTask(id: Task["id"], founder: string): Promise<boolean> {
  if (MOCK) {
    const tasks = mockTasks();
    const task = tasks.find((x) => x.id === id);
    if (!task || task.status !== "open") return false;
    task.status = "claimed";
    task.claimed_by = founder;
    localStorage.setItem("mock_tasks", JSON.stringify(tasks));
    return true;
  }
  // claim_task only updates a task that is still open, so the loser gets no rows back.
  const rows = await sb<Task[]>("rpc/claim_task", { method: "POST", body: JSON.stringify({ p_task_id: id, p_founder: founder }) });
  return rows.length > 0;
}

// Without a backend, bookings are kept in localStorage.
export const getBookings = (): Booking[] => JSON.parse(localStorage.getItem("bookings") ?? "[]");

/** A founder's desk bookings, newest first. */
export async function listBookings(founder: string): Promise<Booking[]> {
  if (MOCK) return [...getBookings()].reverse();
  const rows = await sb<{ id: string; hours: number; created_at: string; office: { name: string } | null }[]>(
    `bookings?founder=eq.${encodeURIComponent(founder)}&select=id,hours,created_at,office:offices(name)&order=created_at.desc`,
  );
  return rows.map((b) => ({ id: b.id, office: b.office?.name ?? "office", hours: Number(b.hours), at: b.created_at }));
}

export async function getBalance(founder: string): Promise<number> {
  if (!MOCK) return Number(await sb<number>("rpc/founder_balance", { method: "POST", body: JSON.stringify({ p_founder: founder }) }));
  const credits = MOCK
    ? [{ hours: 4, supervisor_approved: true as boolean | null }, ...JSON.parse(localStorage.getItem("mock_credits") ?? "[]")] // mock: a starter balance plus anything earned on /verify
    : await sb<{ hours: number; supervisor_approved: boolean | null }[]>(
        `credits?founder=eq.${encodeURIComponent(founder)}&select=hours,supervisor_approved`,
      );
  const earned = credits.filter((c) => c.supervisor_approved !== false).reduce((s, c) => s + Number(c.hours), 0);
  const spent = getBookings().reduce((s, b) => s + b.hours, 0);
  return earned - spent;
}

export async function bookDesk(founder: string, office: Office, hours: number): Promise<boolean> {
  if (hours <= 0 || hours > (await getBalance(founder))) return false;
  if (MOCK) localStorage.setItem("bookings", JSON.stringify([...getBookings(), { office: office.name, hours, at: new Date().toISOString() }]));
  else
    await sb("bookings", {
      method: "POST",
      body: JSON.stringify({ founder, office_id: office.id, hours, date: new Date().toISOString().slice(0, 10) }),
    });
  return true;
}

/** "Furniture reset" and "furniture_reset" -> "furniture", so categories match the tariff keys. */
export const catOf = (task: Task) => (task.category ?? "").toLowerCase().split(/[ _]/)[0];

export const openHours = (tasks: Task[], officeId: Office["id"]) =>
  tasks.filter((x) => x.office_id === officeId && x.status === "open").reduce((s, x) => s + Number(x.credit_hours), 0);

// ---- arriving at the door ---------------------------------------------------
// The landlord shows a door code (as a QR and as four digits). A founder has to scan
// or type it on site before the after-photo step opens. Kept on the founder's device.

/** Four digits derived from the office id, printed under the door QR for phones that will not scan. */
export function doorCode(officeId: Office["id"]): string {
  let h = 0;
  for (const c of String(officeId)) h = (h * 31 + c.charCodeAt(0)) % 10000;
  return String(h).padStart(4, "0");
}

/** What the door QR encodes. Opening it in a phone camera also checks the founder in. */
export const arriveUrl = (officeId: Office["id"]) => `${location.origin}/find/arrive/${encodeURIComponent(String(officeId))}`;

/** True when scanned text or typed digits belong to this office's door. */
export const isDoor = (officeId: Office["id"], text: string) =>
  text.trim() === doorCode(officeId) || text.includes(`/find/arrive/${encodeURIComponent(String(officeId))}`);

const arrivals = (): Record<string, string> =>
  typeof localStorage === "undefined" ? {} : JSON.parse(localStorage.getItem("arrived") ?? "{}");

export const arrivedAt = (officeId: Office["id"]): string | undefined => arrivals()[String(officeId)];

export function markArrived(officeId: Office["id"]): void {
  const now = new Date().toISOString();
  localStorage.setItem("arrived", JSON.stringify({ ...arrivals(), [String(officeId)]: now }));
  // A fresh door scan starts a new visit, so any earlier check-out no longer applies.
  const out = departures();
  delete out[String(officeId)];
  localStorage.setItem("left", JSON.stringify(out));
  // Tick the founder off the landlord's door list too, when it lives on this device.
  const key = `${officeId}:${getFounder()}`;
  const list = JSON.parse(localStorage.getItem("checkins") ?? "{}");
  if (!list[key]) localStorage.setItem("checkins", JSON.stringify({ ...list, [key]: now }));
}

const departures = (): Record<string, string> =>
  typeof localStorage === "undefined" ? {} : JSON.parse(localStorage.getItem("left") ?? "{}");

/** When the founder checked out of this office, if they have. */
export const leftAt = (officeId: Office["id"]): string | undefined => departures()[String(officeId)];

/** Checks the founder out. The landlord's door list reads the `checkouts` key, like `checkins`. */
export function markLeft(officeId: Office["id"]): string {
  const now = new Date().toISOString();
  localStorage.setItem("left", JSON.stringify({ ...departures(), [String(officeId)]: now }));
  const list = JSON.parse(localStorage.getItem("checkouts") ?? "{}");
  localStorage.setItem("checkouts", JSON.stringify({ ...list, [`${officeId}:${getFounder()}`]: now }));
  return now;
}

/** Opens turn-by-turn directions in the phone's maps app. */
export const directionsUrl = (office: Office) =>
  `https://www.google.com/maps/dir/?api=1&destination=${office.lat},${office.lng}&travelmode=transit`;

/** "1h 12m" or "3 min", for time spent on site. */
export function stayText(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ---- when the founder is coming ----------------------------------------------
// Kept on the founder's device, like the arrival. A column on tasks would let the landlord see it.

export type Slot = { day: "saturday" | "sunday"; from: string; hours: number };

const slots = (): Record<string, Slot> => (typeof localStorage === "undefined" ? {} : JSON.parse(localStorage.getItem("slots") ?? "{}"));

/** The founder's chosen time for a task, or a sensible default sized to the job. */
export const getSlot = (task: Task): Slot => slots()[String(task.id)] ?? { day: "saturday", from: "10:00", hours: Math.max(1, Number(task.credit_hours)) };

export const setSlot = (taskId: Task["id"], slot: Slot) => localStorage.setItem("slots", JSON.stringify({ ...slots(), [String(taskId)]: slot }));

export const slotText = (slot: Slot) => `${slot.day} · ${slot.from} · ${slot.hours}h`;

// ---- shared look and copy ---------------------------------------------------

export const ICON: Record<string, string> = { toilet: "💩", kitchen: "🍳", bins: "🗑️", floor: "🧹", desks: "🖥️", furniture: "🪑" };
/** Photo-sticker art per category (generated once, kept in /public/stickers). */
export const STICKER: Record<string, string> = {
  toilet: "/stickers/toilet.png",
  kitchen: "/stickers/kitchen.png",
  bins: "/stickers/bins.png",
  floor: "/stickers/floor.png",
  desks: "/stickers/desks.png",
  furniture: "/stickers/furniture_reset.png",
};
/** Each office gets one of six coworking stickers, picked from its id so it never changes. */
export function officeSticker(officeId: Office["id"]): string {
  let h = 0;
  for (const c of String(officeId)) h = (h * 31 + c.charCodeAt(0)) % 997;
  return `/stickers/office-${h % 6}.png`;
}

export const TARIFF: Record<string, number> = { toilet: 3, kitchen: 2, bins: 1, floor: 1, desks: 0.5, furniture: 0.5 };

export const muted = "text-[#4E5967]";
export const card = "rounded-[26px] bg-white shadow-[0_2px_10px_rgba(15,30,60,0.06)]";

export const grim = (score: number) => (score <= 3 ? "basically fine" : score <= 6 ? "bit grim" : score <= 8 ? "proper grim" : "yikes");

// Bigger jobs get a louder badge so the reward is obvious at a glance.
export const reward = (h: number) =>
  h >= 2 ? "bg-[#FF5A1F] h-9 px-3 text-[15px]" : h >= 1 ? "bg-[#FFDCCB] h-8 px-2.5 text-[13px]" : "bg-[#EEF3F9] h-8 px-2.5 text-[13px]";
