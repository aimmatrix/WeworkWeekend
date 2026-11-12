import "server-only";

// Official energy certificates for non-domestic buildings, read from the public GOV.UK service.
const BASE = "https://find-energy-certificate.service.gov.uk";

export interface Epc {
  certificate: string;
  address: string;
  rating: string; // A+ .. G
  score: number | null;
  floor_area_m2: number | null;
  property_type: string | null;
  valid_until: string | null;
  url: string;
  /** "address" when the certificate's address matches the one asked for, "postcode" when it is only the nearest in the postcode. */
  matched: "address" | "postcode";
  source: string;
}

const cache = new Map<string, Epc | null>();
const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

const text = (html: string) =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const words = (s: string) => new Set(s.toLowerCase().replace(POSTCODE, " ").match(/[a-z0-9]+/g)?.filter((w) => w !== "london") ?? []);

async function get(path: string): Promise<string> {
  const res = await fetch(BASE + path, { headers: { "user-agent": "Mozilla/5.0 (WeWorkWeekend)" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Energy certificate service returned ${res.status}`);
  return res.text();
}

/** The energy certificate for an address, or null when the postcode has none. */
export async function lookupEpc(address: string): Promise<Epc | null> {
  const pc = address.match(POSTCODE);
  if (!pc) return null;
  const postcode = `${pc[1]} ${pc[2]}`.toUpperCase();
  const key = `${postcode}|${address.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;

  const list = await get(`/find-a-non-domestic-certificate/search-by-postcode?postcode=${encodeURIComponent(postcode)}`);
  // Each building is a row header followed by its certificates; we want the CEPC, not the recommendation report.
  const wanted = words(address);
  let best: { href: string; score: number; sameBuilding: boolean } | null = null;
  for (const block of list.split('<th scope="row"').slice(1)) {
    const rowAddress = text(block.slice(block.indexOf(">") + 1, block.indexOf("</th>")));
    const link = block.match(/href="(\/energy-certificate\/[0-9-]+)">\s*CEPC\s*</);
    if (!link) continue;
    const shared = [...words(rowAddress)].filter((w) => wanted.has(w));
    // A shared building number is what makes it the same address rather than a neighbour.
    const sameBuilding = shared.some((w) => /\d/.test(w));
    const score = shared.length + (sameBuilding ? 5 : 0) - (/Expired/.test(block) ? 0.5 : 0);
    if (!best || score > best.score) best = { href: link[1], score, sameBuilding };
  }
  if (!best) {
    cache.set(key, null);
    return null;
  }

  const page = text(await get(best.href));
  const head = page.match(/Print (.+?) Energy rating ([A-G]\+?) Valid until (.+?) Certificate number ([0-9-]+)(?: Property type (.+?))? Total floor area ([\d,]+) square metres/);
  if (!head) throw new Error("Could not read the energy certificate");
  const score = page.match(/with a score of (-?\d+)/);
  const epc: Epc = {
    certificate: head[4],
    address: head[1],
    rating: head[2],
    score: score ? Number(score[1]) : null,
    floor_area_m2: Number(head[6].replace(/,/g, "")),
    property_type: head[5] ?? null,
    valid_until: head[3],
    url: BASE + best.href,
    matched: best.sameBuilding ? "address" : "postcode",
    source: "GOV.UK Find an energy certificate",
  };
  cache.set(key, epc);
  return epc;
}
