import { VISION_SIZE, rgbaToGray, type Gray } from "./vision"

const DB_NAME = "wew"
const STORE = "photos"
const PREFIX = "wew-photo://"
const MAX_EDGE = 2000
const MAX_BYTES = 3_000_000

export function photoUrl(id: string): string {
  return `${PREFIX}${id}`
}

export function isAppPhoto(url: string): boolean {
  return url.startsWith(PREFIX)
}

export function isSafePhotoUrl(url: string): boolean {
  return (
    url.startsWith(PREFIX) ||
    url.startsWith("blob:") ||
    url.startsWith("data:image/") ||
    url.startsWith("https://") ||
    url.startsWith("http://")
  )
}

export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Use a photo, not another kind of file.")
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("Couldn't read that photo. Use a JPEG or PNG.")
  }
  const edge = Math.max(bitmap.width, bitmap.height)
  if (edge <= MAX_EDGE && file.size <= MAX_BYTES) {
    bitmap.close()
    return file
  }
  const scale = Math.min(1, MAX_EDGE / edge)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    throw new Error("Couldn't read that photo.")
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9))
  if (!blob) throw new Error("Couldn't read that photo.")
  return blob
}

export async function putPhoto(file: Blob): Promise<string> {
  const id = crypto.randomUUID()
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).put(file, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Could not store that photo."))
    })
  } finally {
    db.close()
  }
  return photoUrl(id)
}

export async function getPhoto(url: string): Promise<Blob> {
  if (!isAppPhoto(url)) {
    const response = await fetch(url)
    if (!response.ok) throw new Error("Could not load that photo.")
    return response.blob()
  }
  const id = url.slice(PREFIX.length)
  const db = await openDb()
  try {
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      const request = tx.objectStore(STORE).get(id)
      request.onsuccess = () => resolve(request.result as Blob | undefined)
      request.onerror = () => reject(request.error ?? new Error("Could not read that photo."))
    })
    if (!blob) throw new Error("That photo isn't on this phone anymore.")
    return blob
  } finally {
    db.close()
  }
}

export async function blobToGray(blob: Blob): Promise<Gray> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement("canvas")
    canvas.width = VISION_SIZE
    canvas.height = VISION_SIZE
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("Could not read that photo.")
    const scaleDown = bitmap.width > VISION_SIZE || bitmap.height > VISION_SIZE
    context.imageSmoothingEnabled = scaleDown
    if (scaleDown) context.imageSmoothingQuality = "high"
    context.drawImage(bitmap, 0, 0, VISION_SIZE, VISION_SIZE)
    const image = context.getImageData(0, 0, VISION_SIZE, VISION_SIZE)
    return rgbaToGray(image.data, image.width, image.height)
  } finally {
    bitmap.close()
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Could not open photo storage."))
  })
}
