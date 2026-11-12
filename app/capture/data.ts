// Landlord capture and founder verification.
// With Supabase keys this is the real backend. Without them everything is kept in
// localStorage next to the founder app's seed data, so the whole loop can be run on one device.

import * as api from "@/lib/api";
import { deleteTask, publishOffice } from "@/lib/data";
import { uploadPhoto } from "@/lib/photos";
import type { VerifyResponse } from "@/lib/types";
import { MOCK, loadAll, mockTasks, type Office, type Task } from "../find/data";

export type Assessment = { dirt_score: number; crew_size: number; tasks: Task[] };

const stored = (key: string) => JSON.parse(localStorage.getItem(key) ?? "[]");

export async function putPhoto(file: File, folder: string): Promise<string> {
  if (!MOCK) return uploadPhoto(file, folder);
  // Offline photos live in localStorage, so they are kept small.
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}

export async function createOffice(name: string, address: string): Promise<Office> {
  if (!MOCK) return api.createOffice({ name, address });
  const near = (centre: number, spread: number) => centre + (Math.random() - 0.5) * spread;
  return { id: `o${Date.now()}`, name, address, lat: near(51.5154, 0.03), lng: near(-0.1, 0.05), crew_size: 1, dirt_score: 0, status: "draft" };
}

// Offline assessment: one job per photo, priced from the tariff.
const JOBS: [category: string, room: string, title: string, hours: number][] = [
  ["toilet", "Washroom", "Face the toilet", 3],
  ["kitchen", "Kitchen", "De-crust the kitchen", 2],
  ["bins", "Main floor", "Evict the bins", 1],
  ["floor", "Main floor", "Hoover up the crumbs", 1],
  ["desks", "Main floor", "De-crumb the desks", 0.5],
  ["furniture_reset", "Meeting room", "Un-fort the meeting room", 0.5],
];

export async function assess(office: Office, photoUrls: string[]): Promise<Assessment> {
  if (!MOCK) return api.assess({ officeId: String(office.id), photoUrls });
  const tasks = photoUrls.map((before_url, i): Task => {
    const [category, room, title, credit_hours] = JOBS[i % JOBS.length];
    return { id: `${office.id}-t${i}`, office_id: office.id, room, title, category, credit_hours, before_url, status: "open", claimed_by: null };
  });
  return { dirt_score: Math.min(10, 3 + photoUrls.length), crew_size: Math.ceil(photoUrls.length / 2), tasks };
}

export async function removeTask(id: Task["id"]): Promise<void> {
  // Offline tasks are only written at publish, so there is nothing to delete yet.
  if (!MOCK) await deleteTask(String(id));
}

export async function publish(office: Office, a: Assessment): Promise<void> {
  if (!MOCK) return publishOffice(String(office.id));
  const live = { ...office, dirt_score: a.dirt_score, crew_size: a.crew_size, status: "live" };
  localStorage.setItem("mock_offices", JSON.stringify([...stored("mock_offices"), live]));
  localStorage.setItem("mock_tasks", JSON.stringify([...mockTasks(), ...a.tasks]));
}

export async function getTask(id: string): Promise<Task | null> {
  return (await loadAll()).tasks.find((x) => String(x.id) === id) ?? null;
}

export async function verify(task: Task, afterUrl: string): Promise<VerifyResponse> {
  if (!MOCK) return api.verify({ taskId: String(task.id), afterUrl });
  // Offline verdict: a pass, or a fail when the page is opened with ?fail, so both screens can be shown.
  if (new URLSearchParams(location.search).has("fail"))
    return {
      passed: false,
      confidence: 0.81,
      reasons: ["Both photos show the same spot from the same angle.", "Most of the mess is gone."],
      remaining_issues: ["There is still rubbish on the left of the frame.", "The surface has not been wiped."],
    };
  localStorage.setItem("mock_tasks", JSON.stringify(mockTasks().map((x) => (x.id === task.id ? { ...x, status: "done" } : x))));
  localStorage.setItem("mock_credits", JSON.stringify([...stored("mock_credits"), { hours: task.credit_hours, supervisor_approved: null }]));
  return {
    passed: true,
    confidence: 0.93,
    reasons: ["Both photos show the same spot from the same angle.", "The mess in the before photo is gone.", "Surfaces look wiped down."],
    remaining_issues: [],
    hours: task.credit_hours,
  };
}

/** True when every task at the task's office has passed. */
export async function spotless(task: Task): Promise<boolean> {
  const all = (await loadAll()).tasks.filter((x) => x.office_id === task.office_id);
  return all.every((x) => x.status === "done" || x.id === task.id);
}
