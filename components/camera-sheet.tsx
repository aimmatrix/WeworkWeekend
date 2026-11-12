"use client"

import { useEffect, useRef, useState } from "react"
import { Photo } from "@/components/photo"

type CameraSheetProps = {
  beforeUrl?: string | null
  shotCount?: number
  maxShots?: number
  onCapture: (file: File) => void
  onClose: () => void
}

export function CameraSheet({ beforeUrl, shotCount = 0, maxShots = 1, onCapture, onClose }: CameraSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const full = shotCount >= maxShots

  useEffect(() => {
    const local = { stream: null as MediaStream | null, cancelled: false }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFailed(true)
        return
      }
      try {
        const stream = await openStream()
        if (local.cancelled) {
          stop(stream)
          return
        }
        local.stream = stream
        streamRef.current = stream
        setReady(true)
      } catch {
        if (!local.cancelled) setFailed(true)
      }
    }

    void start()
    return () => {
      local.cancelled = true
      stop(local.stream)
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => setFailed(true))
  }, [ready])

  async function shoot() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || full) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext("2d")
    if (!context) return
    context.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9))
    if (!blob) return
    navigator.vibrate?.(20)
    onCapture(new File([blob], `shot-${Date.now()}.jpg`, { type: "image/jpeg" }))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#16140f] text-[#f3efe6]" role="dialog" aria-label="Camera">
      <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.16em]">
          Close
        </button>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em]">
          {beforeUrl ? "Match the faint photo" : `${shotCount} of ${maxShots}`}
        </p>
        <span className="w-12" />
      </div>
      <div className="relative mx-4 flex-1 overflow-hidden bg-black">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-lg">The camera isn&apos;t available on this device.</p>
            <p className="mt-2 text-[#f3efe6]/70">Upload a photo instead.</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="h-full w-full object-contain" playsInline muted autoPlay />
            {beforeUrl ? (
              <Photo
                url={beforeUrl}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-30"
              />
            ) : null}
            <Viewfinder />
          </>
        )}
      </div>
      <div className="flex items-center justify-between px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <label className="font-mono text-[11px] uppercase tracking-[0.16em]">
          Upload
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file && !full) onCapture(file)
            }}
          />
        </label>
        <button
          type="button"
          aria-label="Take photo"
          disabled={failed || full || !ready}
          onClick={() => void shoot()}
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-paper disabled:opacity-40"
        >
          <span className="mx-auto block h-11 w-11 rounded-full bg-[#f3efe6]" />
        </button>
        <span className="w-12" />
      </div>
    </div>
  )
}

function Viewfinder() {
  const corner = "absolute h-8 w-8 border-paper"
  return (
    <>
      <span className={`${corner} left-3 top-3 border-l-2 border-t-2`} />
      <span className={`${corner} right-3 top-3 border-r-2 border-t-2`} />
      <span className={`${corner} bottom-3 left-3 border-b-2 border-l-2`} />
      <span className={`${corner} bottom-3 right-3 border-b-2 border-r-2`} />
    </>
  )
}

async function openStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    })
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: false, video: true })
  }
}

function stop(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}
