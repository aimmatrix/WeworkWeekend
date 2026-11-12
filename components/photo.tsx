"use client"

import { useEffect, useState } from "react"
import { getPhoto, isAppPhoto, isSafePhotoUrl } from "@/track2/photos"

type PhotoProps = {
  url: string
  alt: string
  className?: string
}

export function Photo({ url, alt, className = "" }: PhotoProps) {
  if (!isSafePhotoUrl(url)) return <div className={`bg-[#ddd4c6] ${className}`} aria-hidden />
  if (!isAppPhoto(url)) return <SafeImage src={url} alt={alt} className={className} />
  return <StoredPhoto key={url} url={url} alt={alt} className={className} />
}

function SafeImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  )
}

function StoredPhoto({ url, alt, className }: PhotoProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const handle = { dead: false, revoke: null as string | null }
    getPhoto(url)
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob)
        if (handle.dead) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        handle.revoke = objectUrl
        setSrc(objectUrl)
      })
      .catch(() => {
        if (!handle.dead) setSrc(null)
      })
    return () => {
      handle.dead = true
      if (handle.revoke) URL.revokeObjectURL(handle.revoke)
    }
  }, [url])

  if (!src) return <div className={`bg-[#ddd4c6] ${className ?? ""}`} aria-hidden />
  return <SafeImage src={src} alt={alt} className={className ?? ""} />
}
