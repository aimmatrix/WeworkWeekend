export type Category =
  | "toilet"
  | "kitchen"
  | "bins"
  | "floor"
  | "desks"
  | "furniture_reset"

export type OfficeStatus = "draft" | "live"

export type TaskStatus = "open" | "claimed" | "done"

export type Office = {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  crew_size: number
  dirt_score: number
  status: OfficeStatus
}

export type Task = {
  id: string
  office_id: string
  room: string
  title: string
  category: string
  credit_hours: number
  before_url: string
  status: TaskStatus
  claimed_by: string | null
}

export type Verification = {
  id: string
  task_id: string
  after_url: string
  passed: boolean
  confidence: number
  reasons: string[]
  remaining_issues: string[]
  model: string
  created_at: string
}

export type Credit = {
  id: string
  founder: string
  hours: number
  verification_id: string
  supervisor_approved: boolean
  created_at: string
}

export type Database = {
  offices: Office[]
  tasks: Task[]
  verifications: Verification[]
  credits: Credit[]
}

export type AssessTask = {
  id: string
  room: string
  title: string
  category: string
  credit_hours: number
  before_url: string
}

export type AssessRequest = {
  officeId: string
  photoUrls: string[]
}

export type AssessResponse = {
  dirt_score: number
  crew_size: number
  tasks: AssessTask[]
}

export type VerifyRequest = {
  taskId: string
  afterUrl: string
}

export type VerifyResponse = {
  passed: boolean
  confidence: number
  reasons: string[]
  remaining_issues: string[]
  creditId?: string
}

export const EMPTY_DB: Database = {
  offices: [],
  tasks: [],
  verifications: [],
  credits: [],
}
