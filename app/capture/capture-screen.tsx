"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { CameraSheet } from "@/components/camera-sheet"
import { Checklist } from "@/components/checklist"
import { LiveOffice } from "@/components/live-office"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui"
import { assess as apiAssess, createOffice } from "@/lib/api"
import { deleteTask, getOffice as fetchOffice, publishOffice } from "@/lib/data"
import { uploadPhoto as uploadPublic } from "@/lib/photos"
import type { Office as ApiOffice, Task as ApiTask } from "@/lib/types"
import { crewForChecklist } from "@/track2/assess"
import { offlineFallback, supabaseConfigured } from "@/track2/backend"
import { uploadPhoto as storeLocal } from "@/track2/client"
import { mockAssess } from "@/track2/mock-server"
import { applyPublish } from "@/track2/reduce"
import { getOffice as localOffice, readDb, tasksForOffice, writeDb } from "@/track2/store"
import { sumHours } from "@/track2/tariff"
import { errorMessage, formatHours } from "@/track2/text"
import type { AssessTask, Office, Task } from "@/track2/types"

type Phase = "details" | "photos" | "review" | "live"
type Source = "api" | "offline"

type Shot = {
  key: string
  file: File
  preview: string
}

type Review = {
  mode: Source
  officeId: string
  dirtScore: number
  crewSize: number
  tasks: AssessTask[]
  baseline: AssessTask[]
  undo: AssessTask | null
}

const MAX_PHOTOS = 6
const MIN_PHOTOS = 4

export function CaptureScreen() {
  const router = useRouter()
  const search = useSearchParams()
  const queryOffice = search.get("office")
  const offlineQuery = search.get("mode") === "offline"
  const fileRef = useRef<HTMLInputElement>(null)
  const shotsRef = useRef<Shot[]>([])
  const draftRef = useRef<{ mode: Source; officeId: string } | null>(null)
  const [booted, setBooted] = useState(false)
  const [phase, setPhase] = useState<Phase>("details")
  const [source, setSource] = useState<Source | null>(null)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [shots, setShots] = useState<Shot[]>([])
  const [review, setReview] = useState<Review | null>(null)
  const [published, setPublished] = useState<Office | null>(null)
  const [liveTasks, setLiveTasks] = useState<Task[]>([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    return () => {
      for (const shot of shotsRef.current) URL.revokeObjectURL(shot.preview)
    }
  }, [])

  useEffect(() => {
    let dead = false
    async function boot() {
      if (!queryOffice) {
        if (!dead) setBooted(true)
        return
      }
      if (offlineQuery || !supabaseConfigured()) {
        const found = localOffice(queryOffice)
        if (found?.status === "live") {
          setSource("offline")
          setPublished(found)
          setLiveTasks(tasksForOffice(found.id))
          setPhase("live")
        }
        if (!dead) setBooted(true)
        return
      }
      try {
        const office = await fetchOffice(queryOffice)
        if (dead) return
        if (office && office.status !== "draft") {
          setSource("api")
          setPublished(asLocalOffice(office))
          setLiveTasks(office.tasks.map(asLocalTask))
          setPhase("live")
        }
      } catch (caught) {
        if (offlineFallback(caught)) {
          const found = localOffice(queryOffice)
          if (found?.status === "live") {
            setSource("offline")
            setPublished(found)
            setLiveTasks(tasksForOffice(found.id))
            setPhase("live")
          }
        }
      }
      if (!dead) setBooted(true)
    }
    void boot()
    return () => {
      dead = true
    }
  }, [offlineQuery, queryOffice])

  useEffect(() => {
    if (phase !== "live" || !published) return
    const officeId = published.id
    if (source !== "api") {
      const load = () => setLiveTasks(tasksForOffice(officeId))
      load()
      window.addEventListener("wew-db", load)
      window.addEventListener("storage", load)
      return () => {
        window.removeEventListener("wew-db", load)
        window.removeEventListener("storage", load)
      }
    }
    let dead = false
    async function loadApi() {
      try {
        const office = await fetchOffice(officeId)
        if (dead || !office) return
        setLiveTasks(office.tasks.map(asLocalTask))
      } catch {
        /* keep the list already on screen */
      }
    }
    void loadApi()
    const timer = window.setInterval(() => void loadApi(), 8000)
    return () => {
      dead = true
      window.clearInterval(timer)
    }
  }, [phase, published, source])

  function addFiles(list: File[]) {
    const images = list.filter((file) => file.type.startsWith("image/"))
    if (images.length === 0) {
      setError("That file isn't a photo.")
      return
    }
    const room = MAX_PHOTOS - shotsRef.current.length
    if (room <= 0) {
      setError("Six photos is the maximum.")
      return
    }
    const take = images.slice(0, room)
    const next = [
      ...shotsRef.current,
      ...take.map((file) => ({
        key: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      })),
    ]
    shotsRef.current = next
    setShots(next)
    setReview(null)
    setError(images.length > room ? "Six photos is the maximum. Extra shots were left out." : "")
  }

  function removeShot(key: string) {
    const shot = shotsRef.current.find((item) => item.key === key)
    if (shot) URL.revokeObjectURL(shot.preview)
    const next = shotsRef.current.filter((item) => item.key !== key)
    shotsRef.current = next
    setShots(next)
    setReview(null)
  }

  function reset() {
    for (const shot of shotsRef.current) URL.revokeObjectURL(shot.preview)
    shotsRef.current = []
    draftRef.current = null
    setShots([])
    setReview(null)
    setName("")
    setAddress("")
    setPublished(null)
    setLiveTasks([])
    setSource(null)
    setError("")
    setPhase("details")
    setCameraOpen(false)
    router.replace("/capture")
  }

  async function runAssess() {
    if (shots.length < MIN_PHOTOS) {
      setError("Add at least four photos.")
      return
    }
    setBusy(true)
    setError("")
    setProgress("Uploading photos")
    try {
      if (!draftRef.current) {
        if (supabaseConfigured()) {
          try {
            setProgress("Saving the office")
            const office = await createOffice({ name: name.trim(), address: address.trim() })
            draftRef.current = { mode: "api", officeId: office.id }
          } catch (caught) {
            if (!offlineFallback(caught)) throw caught
            draftRef.current = { mode: "offline", officeId: crypto.randomUUID() }
          }
        } else {
          draftRef.current = { mode: "offline", officeId: crypto.randomUUID() }
        }
      }
      const draft = draftRef.current
      if (!draft) throw new Error("The office didn't save.")
      if (draft.mode === "api") {
        setProgress("Uploading photos")
        const photoUrls = await Promise.all(shots.map((shot) => uploadPublic(shot.file, `offices/${draft.officeId}`)))
        setProgress("Assessing the mess")
        const result = await apiAssess({ officeId: draft.officeId, photoUrls })
        const tasks = result.tasks.map(asAssessTask)
        if (tasks.length === 0) throw new Error("No tasks came back.")
        setReview({
          mode: "api",
          officeId: draft.officeId,
          dirtScore: result.dirt_score,
          crewSize: result.crew_size,
          tasks,
          baseline: tasks.map((task) => ({ ...task })),
          undo: null,
        })
      } else {
        setProgress("Reading the photos")
        const photoUrls = await Promise.all(shots.map((shot) => storeLocal(shot.file)))
        setProgress("Assessing the mess")
        const result = await mockAssess({ officeId: draft.officeId, photoUrls })
        if (result.tasks.length === 0) throw new Error("No tasks came back.")
        setReview({
          mode: "offline",
          officeId: draft.officeId,
          dirtScore: result.dirt_score,
          crewSize: result.crew_size,
          tasks: result.tasks,
          baseline: result.tasks.map((task) => ({ ...task })),
          undo: null,
        })
      }
      setPhase("review")
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
      setProgress("")
    }
  }

  async function publish() {
    if (!review || review.tasks.length === 0) {
      setError("Keep at least one task.")
      return
    }
    if (review.tasks.some((task) => !task.before_url)) {
      setError("A task is missing its photo.")
      return
    }
    setBusy(true)
    setError("")
    try {
      if (review.mode === "api") {
        await publishOffice(review.officeId)
        const office = await fetchOffice(review.officeId)
        if (!office) throw new Error("The office didn't come back.")
        setSource("api")
        setPublished(asLocalOffice(office))
        setLiveTasks(office.tasks.map(asLocalTask))
        setPhase("live")
        router.replace(`/capture?office=${office.id}`)
        return
      }
      const location = await locate()
      const crew = crewForChecklist(review.crewSize, review.tasks, review.baseline)
      const office: Office = {
        id: review.officeId,
        name: name.trim(),
        address: address.trim(),
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        crew_size: crew,
        dirt_score: review.dirtScore,
        status: "live",
      }
      const tasks: Task[] = review.tasks.map((task) => ({
        id: task.id,
        office_id: office.id,
        room: task.room,
        title: task.title,
        category: task.category,
        credit_hours: task.credit_hours,
        before_url: task.before_url,
        status: "open",
        claimed_by: null,
      }))
      writeDb(applyPublish(readDb(), office, tasks))
      setSource("offline")
      setPublished(office)
      setLiveTasks(tasks)
      setPhase("live")
      router.replace(`/capture?office=${office.id}&mode=offline`)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function removeTask(id: string) {
    const current = review
    if (!current) return
    const task = current.tasks.find((item) => item.id === id)
    if (!task) return
    if (current.mode === "api") {
      setBusy(true)
      setError("")
      try {
        await deleteTask(id)
      } catch (caught) {
        setError(errorMessage(caught))
        return
      } finally {
        setBusy(false)
      }
      setReview((latest) => {
        if (!latest) return latest
        return { ...latest, undo: null, tasks: latest.tasks.filter((item) => item.id !== id) }
      })
      return
    }
    setReview({ ...current, undo: task, tasks: current.tasks.filter((item) => item.id !== id) })
  }

  function undoRemove() {
    setReview((current) => {
      if (!current?.undo || current.mode !== "offline") return current
      const present = new Map(current.tasks.map((task) => [task.id, task]))
      present.set(current.undo.id, current.undo)
      const tasks = current.baseline.flatMap((task) => {
        const item = present.get(task.id)
        return item ? [item] : []
      })
      return { ...current, tasks, undo: null }
    })
  }

  if (!booted) return <p className="px-5 py-8">Loading…</p>

  let body: ReactNode
  if (phase === "live" && published) {
    body = <LiveOffice office={published} tasks={liveTasks} onAnother={reset} />
  } else if (phase === "review" && review) {
    const hours = sumHours(review.tasks.map((task) => task.credit_hours))
    const crew = review.mode === "api" ? review.crewSize : crewForChecklist(review.crewSize, review.tasks, review.baseline)
    body = (
      <Screen
        eyebrow="Checklist"
        title={name.trim() || "Office"}
        error={error}
        footer={
          <Button onClick={() => void publish()} disabled={busy || review.tasks.length === 0}>
            {busy ? "Publishing…" : "Publish office"}
          </Button>
        }
      >
        <button type="button" onClick={() => setPhase("photos")} className="font-mono text-[11px] uppercase tracking-[0.16em]">
          Back
        </button>
        <div className="mt-4 grid grid-cols-3 border border-[#16140f]">
          <Stat label="Dirt" value={`${review.dirtScore}/10`} />
          <Stat label="Crew" value={String(crew)} />
          <Stat label="Hours" value={formatHours(hours)} />
        </div>
        {review.mode === "offline" && review.undo ? (
          <p className="mt-4 text-sm">
            Removed “{review.undo.title}”.{" "}
            <button type="button" onClick={undoRemove} className="underline underline-offset-4">
              Undo
            </button>
          </p>
        ) : null}
        {review.tasks.length === 0 ? <p className="mt-4">Put at least one task back.</p> : null}
        <Checklist tasks={review.tasks} onRemove={(id) => void removeTask(id)} />
      </Screen>
    )
  } else if (phase === "photos") {
    body = (
      <Screen
        eyebrow="The mess"
        title="Four to six photos"
        error={error}
        footer={
          review && shots.length >= MIN_PHOTOS ? (
            <Button onClick={() => setPhase("review")}>Back to checklist</Button>
          ) : (
            <Button onClick={() => void runAssess()} disabled={busy || shots.length < MIN_PHOTOS}>
              {busy ? progress || "Assessing…" : "Assess photos"}
            </Button>
          )
        }
      >
        <button type="button" onClick={() => setPhase("details")} className="font-mono text-[11px] uppercase tracking-[0.16em]">
          Back
        </button>
        <p className="mt-4 leading-snug">
          Shoot the toilet, kitchen, bins, and floor. Add desks and furniture if they&apos;re bad. The order becomes the checklist.
        </p>
        <p className="mt-3 font-mono text-sm" aria-live="polite">
          {shots.length} of {MIN_PHOTOS}–{MAX_PHOTOS}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {shots.map((shot, index) => (
            <div key={shot.key} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.preview} alt={`Office photo ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => removeShot(shot.key)}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center bg-[#16140f] text-[#f3efe6]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button tone="secondary" onClick={() => setCameraOpen(true)} disabled={shots.length >= MAX_PHOTOS}>
            Shoot
          </Button>
          <Button tone="secondary" onClick={() => fileRef.current?.click()} disabled={shots.length >= MAX_PHOTOS}>
            Upload
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
      </Screen>
    )
  } else {
    body = (
      <Screen
        eyebrow="Landlord"
        title="Which office?"
        error={error}
        footer={
          <Button type="submit" form="office-details">
            Add photos
          </Button>
        }
      >
        <form
          id="office-details"
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim() || !address.trim()) {
              setError("Add the office name and address.")
              return
            }
            setError("")
            setPhase("photos")
          }}
        >
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Office name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              name="office-name"
              autoComplete="organization"
              required
              maxLength={80}
              className="mt-2 h-14 w-full border border-[#16140f] bg-[#fffdf8] px-3 text-lg outline-none"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Address</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              name="address"
              autoComplete="street-address"
              required
              maxLength={180}
              className="mt-2 h-14 w-full border border-[#16140f] bg-[#fffdf8] px-3 text-lg outline-none"
            />
          </label>
        </form>
      </Screen>
    )
  }

  return (
    <>
      {body}
      {cameraOpen ? (
        <CameraSheet
          shotCount={shots.length}
          maxShots={MAX_PHOTOS}
          onCapture={(file) => addFiles([file])}
          onClose={() => setCameraOpen(false)}
        />
      ) : null}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-[#16140f] px-3 py-3 last:border-r-0">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#16140f]/60">{label}</p>
      <p className="mt-1 font-mono text-2xl leading-none">{value}</p>
    </div>
  )
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

function asAssessTask(task: ApiTask): AssessTask {
  return {
    id: task.id,
    room: task.room,
    title: task.title,
    category: task.category,
    credit_hours: Number(task.credit_hours),
    before_url: task.before_url,
  }
}

function locate(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 4000)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer)
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      () => {
        window.clearTimeout(timer)
        resolve(null)
      },
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 60_000 },
    )
  })
}
