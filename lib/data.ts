// Client-side data helpers (anon key). Safe to import from any client component.
import { supabase } from "./supabase";
import type {
  Booking,
  CreditWithEvidence,
  Office,
  OfficeWithTasks,
  Task,
  Verification,
} from "./types";

function check<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** Live offices with their tasks (for the map). */
export async function listLiveOffices(): Promise<OfficeWithTasks[]> {
  const { data, error } = await supabase
    .from("offices")
    .select("*, tasks(*)")
    .eq("status", "live")
    .order("created_at", { ascending: false });
  return check(data, error) as OfficeWithTasks[];
}

/** Credit hours still up for grabs at an office (open tasks only). */
export function openHours(office: OfficeWithTasks): number {
  return office.tasks.filter((t) => t.status === "open").reduce((s, t) => s + Number(t.credit_hours), 0);
}

export async function getOffice(id: string): Promise<OfficeWithTasks | null> {
  const { data, error } = await supabase
    .from("offices")
    .select("*, tasks(*)")
    .eq("id", id)
    .order("credit_hours", { referencedTable: "tasks", ascending: false })
    .maybeSingle();
  return check(data, error) as OfficeWithTasks | null;
}

export async function getTask(id: string): Promise<(Task & { office: Office }) | null> {
  const { data, error } = await supabase.from("tasks").select("*, office:offices(*)").eq("id", id).maybeSingle();
  return check(data, error) as (Task & { office: Office }) | null;
}

/** Atomically claim a task. Returns the task, or null if someone else got it first. */
export async function claimTask(taskId: string, founder: string): Promise<Task | null> {
  const { data, error } = await supabase.rpc("claim_task", { p_task_id: taskId, p_founder: founder });
  const rows = check(data, error) as Task[];
  return rows?.[0] ?? null;
}

/** Tasks claimed by this founder (claimed + done), newest first. */
export async function myTasks(founder: string): Promise<(Task & { office: Office })[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, office:offices(*)")
    .eq("claimed_by", founder)
    .order("claimed_at", { ascending: false });
  return check(data, error) as (Task & { office: Office })[];
}

/** Credit hours earned minus hours spent on bookings. */
export async function getBalance(founder: string): Promise<number> {
  const { data, error } = await supabase.rpc("founder_balance", { p_founder: founder });
  return Number(check(data, error) ?? 0);
}

export async function bookDesk(founder: string, officeId: string, hours: number, date: string): Promise<Booking> {
  const balance = await getBalance(founder);
  if (balance < hours) throw new Error(`Not enough credit: you have ${balance}h`);
  const { data, error } = await supabase
    .from("bookings")
    .insert({ founder, office_id: officeId, hours, date })
    .select()
    .single();
  return check(data, error) as Booking;
}

export async function myBookings(founder: string): Promise<(Booking & { office: Office })[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, office:offices(*)")
    .eq("founder", founder)
    .order("date", { ascending: false });
  return check(data, error) as (Booking & { office: Office })[];
}

/** Landlord: drop a task from the assessment before publishing. */
export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
}

/** Landlord: make the office visible on the map. */
export async function publishOffice(officeId: string): Promise<void> {
  const { error } = await supabase.from("offices").update({ status: "live" }).eq("id", officeId);
  if (error) throw new Error(error.message);
}

/** Latest verification for a task (result screen / retry). */
export async function latestVerification(taskId: string): Promise<Verification | null> {
  const { data, error } = await supabase
    .from("verifications")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return check(data, error) as Verification | null;
}

const EVIDENCE = "*, verification:verifications(*, task:tasks(*, office:offices(*)))";

/** A founder's credits with evidence, newest first. */
export async function listCredits(founder: string): Promise<CreditWithEvidence[]> {
  const { data, error } = await supabase
    .from("credits")
    .select(EVIDENCE)
    .eq("founder", founder)
    .order("created_at", { ascending: false });
  return check(data, error) as CreditWithEvidence[];
}

export async function getCredit(id: string): Promise<CreditWithEvidence | null> {
  const { data, error } = await supabase.from("credits").select(EVIDENCE).eq("id", id).maybeSingle();
  return check(data, error) as CreditWithEvidence | null;
}

/** Supervisor queue: verdicts awaiting review, oldest first. */
export async function listPendingVerifications(): Promise<(Verification & { task: Task & { office: Office } })[]> {
  const { data, error } = await supabase
    .from("verifications")
    .select("*, task:tasks(*, office:offices(*))")
    .eq("review", "pending")
    .order("created_at", { ascending: true });
  return check(data, error) as (Verification & { task: Task & { office: Office } })[];
}
