// Client-side photo upload: downscale to JPEG (fixes HEIC + slow uploads), push to the public bucket.
import { PHOTO_BUCKET, supabase } from "./supabase";

const MAX_EDGE = 1600;

async function toJpeg(file: File | Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
    );
  } catch {
    return file; // browser couldn't decode; upload as-is
  }
}

/**
 * Upload a photo and return its public URL.
 * @param folder e.g. "offices/<officeId>" or "tasks/<taskId>"
 */
export async function uploadPhoto(file: File | Blob, folder: string): Promise<string> {
  const blob = await toJpeg(file);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
