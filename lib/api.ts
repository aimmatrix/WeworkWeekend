// Typed client wrappers for our API routes.
import type {
  AssessRequest,
  AssessResponse,
  CreateOfficeRequest,
  Office,
  SupervisorRequest,
  VerifyRequest,
  VerifyResponse,
} from "./types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `${path} failed (${res.status})`);
  return json as T;
}

/** Landlord: create a draft office (address is geocoded server-side). */
export const createOffice = (req: CreateOfficeRequest) => post<Office>("/api/offices", req);

/** Grok looks at the mess and prices tasks from the tariff. Saves tasks on the office. */
export const assess = (req: AssessRequest) => post<AssessResponse>("/api/assess", req);

/** Grok compares before/after. On pass, a credit is created for the task's claimer. */
export const verify = (req: VerifyRequest) => post<VerifyResponse>("/api/verify", req);

export const supervise = (req: SupervisorRequest) => post<{ ok: true }>("/api/supervisor", req);
