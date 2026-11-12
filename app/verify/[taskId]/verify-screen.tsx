"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { CameraSheet } from "@/components/camera-sheet"
import { Photo } from "@/components/photo"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui"
import { Verdict, type VerdictModel } from "@/components/verdict"
import { verify as apiVerify } from "@/lib/api"
import { claimTask, getOffice as fetchOffice, getTask as fetchTask, latestVerification as fetchLatest } from "@/lib/data"
import { uploadPhoto as uploadPublic } from "@/lib/photos"
import type { Office as ApiOffice, Task as ApiTask } from "@/lib/types"
import { offlineFallback, supabaseConfigured } from "@/track2/backend"
import { uploadPhoto as storeLocal } from "@/track2/client"
import { getFounder, setFounder } from "@/track2/founder"
import { mockVerify } from "@/track2/mock-server"
import { isCleanerThanBaseline } from "@/track2/reduce"
import { getOffice as localOffice, getTask as localTask, latestVerification as localLatest, tasksForOffice } from "@/track2/store"
import { errorMessage, formatHours } from "@/track2/text"
import type { Office, Task } from "@/track2/types"

type Step = "look" | "camera" | "confirm" | "checking" | "result"
type Source = "api" | "offline"

type Evidence = {
  passed: boolean
  confidence: number
  reasons: string[]
  remaining_issues: string[]
  after_url: string
  created_at: string
  model: string
}

export function VerifyScreen() {
  const params = useParams()
  const taskId = one(params.taskId)
  const [source, setSource] = useState<Source | null>(null)
  const [task, setTask] = useState<Task | null | undefined>(undefined)
  const [office, setOffice] = useState<Office | null>(null)
  const [step, setStep] = useState<Step>("look")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<VerdictModel | null>(null)
  const [founder, setFounderName] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  useEffect(() => {
    function syncName() {
      setFounderName(getFounder())
    }
    window.addEventListener("wew-founder", syncName)
    return () => window.removeEventListener("wew-founder", syncName)
  }, [])

  useEffect(() => {
    let dead = false
    async function load() {
      setTask(undefined)
      setResult(null)
      setStep("look")
      setError("")
      setFounderName(getFounder())
      if (!taskId) {
        setTask(null)
        return
      }
      if (!supabaseConfigured()) {
        loadLocal()
        return
      }
      try {
        const found = await fetchTask(taskId)
        if (dead) return
        if (!found) {
          loadLocal()
          return
        }
        const mapped = asLocalTask(found)
        setSource("api")
        setTask(mapped)
        setOffice(asLocalOffice(found.office))
        const latest = await fetchLatest(taskId)
        if (dead || !latest) return
        let allClear = false
        if (latest.passed) {
          try {
            const live = await fetchOffice(found.office_id)
            allClear = !!live && live.tasks.length > 0 && live.tasks.every((item) => item.status === "done")
          } catch {
            allClear = false
          }
        }
        if (dead) return
        setResult(verdictFrom(mapped, latest, allClear, "/ledger"))
        setStep("result")
      } catch (caught) {
        if (dead) return
        if (offlineFallback(caught)) {
          loadLocal()
          return
        }
        setError(errorMessage(caught))
        setTask(null)
      }
    }

    function loadLocal() {
      if (dead) return
      const found = localTask(taskId)
      setSource("offline")
      setTask(found)
      if (!found) return
      setOffice(localOffice(found.office_id))
      const latest = localLatest(taskId)
      if (!latest) return
      const clear = latest.passed && isCleanerThanBaseline(tasksForOffice(found.office_id))
      setResult(verdictFrom(found, latest, clear, "/ledger"))
      setStep("result")
    }

    void load()
    return () => {
      dead = true
    }
  }, [taskId])

  function hold(next: File) {
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setError("")
    setStep("confirm")
  }

  async function submit(name: string) {
    if (!task || !file || !source) return
    const founderName = name.trim()
    if (!founderName) {
      setError("Add your name so the hours have somewhere to go.")
      return
    }
    setFounder(founderName)
    setFounderName(founderName)
    setStep("checking")
    setError("")
    try {
      switch (source) {
        case "api":
          await submitApi(task, file, founderName)
          return
        case "offline":
          break
        default: {
          const neverSource: never = source
          throw new Error(neverSource)
        }
      }
      const afterUrl = await storeLocal(file)
      const response = await mockVerify({ taskId: task.id, afterUrl })
      const fresh = localTask(task.id) ?? task
      const saved = localLatest(task.id)
      const clear = response.passed && isCleanerThanBaseline(tasksForOffice(fresh.office_id))
      setTask(fresh)
      setResult({
        passed: response.passed,
        confidence: response.confidence,
        reasons: response.reasons,
        remaining: response.remaining_issues,
        beforeUrl: fresh.before_url,
        afterUrl,
        createdAt: saved?.created_at ?? new Date().toISOString(),
        model: saved?.model ?? "",
        hours: fresh.credit_hours,
        title: fresh.title,
        allClear: clear,
        walletHref: "/ledger",
      })
      setStep("result")
    } catch (caught) {
      setError(errorMessage(caught))
      setStep("confirm")
    }
  }

  async function submitApi(current: Task, photo: File, founderName: string) {
    if (current.status === "done") throw new Error("This task is already verified.")
    if (current.status === "open") {
      const claimed = await claimTask(current.id, founderName)
      if (!claimed) throw new Error("Someone else claimed this task.")
    } else if (current.claimed_by && current.claimed_by !== founderName) {
      throw new Error(`This task is claimed by ${current.claimed_by}.`)
    }
    const afterUrl = await uploadPublic(photo, `tasks/${current.id}`)
    const response = await apiVerify({ taskId: current.id, afterUrl })
    let createdAt = new Date().toISOString()
    let model = ""
    try {
      const saved = await fetchLatest(current.id)
      if (saved) {
        createdAt = saved.created_at
        model = saved.model
      }
    } catch {
      /* the verdict itself is already in the response */
    }
    let allClear = false
    if (response.passed) {
      try {
        const live = await fetchOffice(current.office_id)
        allClear = !!live && live.tasks.length > 0 && live.tasks.every((item) => item.status === "done")
      } catch {
        allClear = false
      }
    }
    setTask({
      ...current,
      status: response.passed ? "done" : "claimed",
      claimed_by: founderName,
    })
    setResult({
      passed: response.passed,
      confidence: response.confidence,
      reasons: response.reasons,
      remaining: response.remaining_issues,
      beforeUrl: current.before_url,
      afterUrl,
      createdAt,
      model,
      hours: typeof response.hours === "number" ? response.hours : current.credit_hours,
      title: current.title,
      allClear,
      walletHref: response.creditId ? `/ledger/${response.creditId}` : "/ledger",
    })
    setStep("result")
  }

  if (task === undefined) return <p className="px-5 py-8">Loading…</p>

  if (!task) {
    return (
      <Screen
        eyebrow="Verify"
        title="Task not on this phone"
        error={error}
        footer={
          <Link href="/capture" className="flex h-14 items-center justify-center bg-[#16140f] text-lg text-[#f3efe6]">
            Go to capture
          </Link>
        }
      >
        <p className="text-lg leading-snug">Publish the office, then open the task from the live list.</p>
      </Screen>
    )
  }

  if (step === "result" && result) {
    return (
      <Verdict
        result={result}
        onRetry={
          result.passed
            ? undefined
            : () => {
                setError("")
                setStep("look")
              }
        }
      />
    )
  }

  if (step === "checking") {
    return (
      <Screen eyebrow={task.room} title="Checking the after photo">
        <p className="text-lg" aria-live="polite">
          Comparing it with the before shot.
        </p>
      </Screen>
    )
  }

  if (step === "confirm" && preview) {
    return (
      <Screen
        eyebrow={task.room}
        title="Use this after photo?"
        error={error}
        footer={
          <div className="space-y-3">
            <Button onClick={() => void submit(founder)} disabled={!founder.trim()}>
              Check photo
            </Button>
            <Button tone="secondary" onClick={() => setStep("camera")}>
              Retake
            </Button>
          </div>
        }
      >
        <label className="mb-4 block">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Your name</span>
          <input
            value={founder}
            onChange={(event) => setFounderName(event.target.value)}
            maxLength={80}
            autoComplete="name"
            className="mt-2 h-14 w-full border border-[#16140f] bg-[#fffdf8] px-3 text-lg outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <figure>
            <Photo url={task.before_url} alt="Before" className="aspect-[3/4] w-full object-cover" />
            <figcaption className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em]">Before</figcaption>
          </figure>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="After preview" className="aspect-[3/4] w-full object-cover" />
            <figcaption className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em]">After</figcaption>
          </figure>
        </div>
      </Screen>
    )
  }

  return (
    <>
      <Screen
        eyebrow={office ? office.name : task.room}
        title={task.title}
        error={error}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setStep("camera")}>Use the camera</Button>
            <label className="flex h-14 cursor-pointer items-center justify-center border border-[#16140f] bg-[#fffdf8] text-lg">
              Upload
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const next = event.target.files?.[0]
                  event.target.value = ""
                  if (next) hold(next)
                }}
              />
            </label>
          </div>
        }
      >
        <p className="font-mono text-sm">
          {task.room} · {formatHours(task.credit_hours)}
          {task.claimed_by ? ` · ${task.claimed_by}` : ""}
        </p>
        <p className="mt-3 leading-snug">Shoot the after photo from the same angle. The before shot sits faintly on the camera.</p>
        <Photo url={task.before_url} alt="Before the clean" className="mt-4 aspect-[3/4] w-full object-cover" />
      </Screen>
      {step === "camera" ? (
        <CameraSheet
          beforeUrl={task.before_url}
          shotCount={0}
          maxShots={1}
          onCapture={(next) => {
            hold(next)
          }}
          onClose={() => setStep("look")}
        />
      ) : null}
    </>
  )
}

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

function verdictFrom(task: Task, evidence: Evidence, allClear: boolean, walletHref: string): VerdictModel {
  return {
    passed: evidence.passed,
    confidence: evidence.confidence,
    reasons: evidence.reasons,
    remaining: evidence.remaining_issues,
    beforeUrl: task.before_url,
    afterUrl: evidence.after_url,
    createdAt: evidence.created_at,
    model: evidence.model,
    hours: task.credit_hours,
    title: task.title,
    allClear,
    walletHref,
  }
}

function asLocalOffice(office: ApiOffice): Office {
  return {
    id: office.id,
    name: office.name,
    address: office.address,
    lat: office.lat,
    lng: office.lng,
    crew_size: office.crew_size,
    dirt_score: office.dirt_score,
    status: office.status === "draft" ? "draft" : "live",
  }
}

function asLocalTask(task: ApiTask): Task {
  return {
    id: task.id,
    office_id: task.office_id,
    room: task.room,
    title: task.title,
    category: task.category,
    credit_hours: Number(task.credit_hours),
    before_url: task.before_url,
    status: task.status,
    claimed_by: task.claimed_by,
  }
}
