import { lookupEpc } from "@/lib/epc";
import { errMsg, fail, json } from "@/lib/http";

/** GET /api/epc?address=... -> the building's official energy certificate, with its certificate number as the source. */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address")?.trim();
  if (!address) return fail("address is required");
  try {
    const epc = await lookupEpc(address);
    return epc ? json(epc) : fail("No energy certificate found for that postcode", 404);
  } catch (e) {
    return fail(`Energy certificate lookup failed: ${errMsg(e)}`, 502);
  }
}
