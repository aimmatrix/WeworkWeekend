import { fail, json, readBody } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { CreateOfficeRequest, Office } from "@/lib/types";

const LONDON = { lat: 51.5074, lng: -0.1278 };
const UK_POSTCODE = /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i;

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  // 1. UK postcode -> postcodes.io (fast, free, precise enough)
  const pc = address.match(UK_POSTCODE)?.[0];
  if (pc) {
    try {
      const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, {
        signal: AbortSignal.timeout(5000),
      });
      const j = await r.json();
      if (j?.result?.latitude) return { lat: j.result.latitude, lng: j.result.longitude };
    } catch {}
  }
  // 2. Free-text -> Nominatim
  try {
    const q = encodeURIComponent(/london/i.test(address) ? address : `${address}, London`);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=${q}`, {
      headers: { "user-agent": "weworkweekend-hackathon/0.1" },
      signal: AbortSignal.timeout(5000),
    });
    const j = await r.json();
    if (j?.[0]?.lat) return { lat: Number(j[0].lat), lng: Number(j[0].lon) };
  } catch {}
  return null;
}

/** Create a draft office. Goes live when the landlord publishes (lib/data.publishOffice). */
export async function POST(req: Request) {
  const body = await readBody<CreateOfficeRequest>(req);
  const name = body?.name?.trim();
  const address = body?.address?.trim();
  if (!name || !address) return fail("name and address are required");

  // Never block the demo on geocoding: fall back to central London with a little jitter.
  const pos = (await geocode(address)) ?? {
    lat: LONDON.lat + (Math.random() - 0.5) * 0.04,
    lng: LONDON.lng + (Math.random() - 0.5) * 0.06,
  };

  const { data, error } = await supabaseAdmin()
    .from("offices")
    .insert({ name, address, lat: pos.lat, lng: pos.lng, status: "draft" })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return json(data as Office);
}
