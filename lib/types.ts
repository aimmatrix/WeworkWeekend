// Shared contract types. Track 3 owns this file; mirror of supabase/migrations.

export type Category =
  | "toilet"
  | "kitchen"
  | "bins"
  | "floor"
  | "desks"
  | "furniture_reset";

export type OfficeStatus = "draft" | "live" | "closed";
export type TaskStatus = "open" | "claimed" | "done";
export type Review = "pending" | "approved" | "overturned";

export interface Office {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  crew_size: number;
  dirt_score: number; // 0 (spotless) .. 10 (filthy)
  status: OfficeStatus;
  photo_urls: string[];
  created_at: string;
}

export interface Task {
  id: string;
  office_id: string;
  room: string;
  title: string;
  category: Category;
  credit_hours: number;
  before_url: string;
  status: TaskStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
}

export interface Verification {
  id: string;
  task_id: string;
  founder: string | null;
  after_url: string;
  passed: boolean;
  confidence: number; // 0..1
  reasons: string[];
  remaining_issues: string[];
  same_place: boolean | null;
  model: string;
  model_call_id: string | null;
  review: Review;
  reviewed_at: string | null;
  created_at: string;
}

export interface Credit {
  id: string;
  founder: string;
  hours: number;
  verification_id: string;
  supervisor_approved: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  founder: string;
  office_id: string;
  hours: number;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export type OfficeWithTasks = Office & { tasks: Task[] };

/** A credit with its full evidence trail (what /ledger renders). */
export type CreditWithEvidence = Credit & {
  verification: Verification & { task: Task & { office: Office } };
};

// ---- API contract ------------------------------------------------------

export interface AssessRequest {
  officeId: string;
  photoUrls: string[];
}
export interface AssessResponse {
  dirt_score: number;
  crew_size: number;
  tasks: Task[];
}

export interface VerifyRequest {
  taskId: string;
  afterUrl: string;
}
export interface VerifyResponse {
  passed: boolean;
  confidence: number;
  reasons: string[];
  remaining_issues: string[];
  creditId?: string;
  verificationId?: string;
  hours?: number; // credit hours earned when passed
}

export interface CreateOfficeRequest {
  name: string;
  address: string;
}

export interface SupervisorRequest {
  verificationId: string;
  action: "approve" | "overturn";
}

export interface ApiError {
  error: string;
}
