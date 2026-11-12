"use client";

import { useEffect, useState } from "react";
import { card, muted } from "./data";

type Epc = {
  certificate: string;
  address: string;
  rating: string;
  score: number | null;
  floor_area_m2: number | null;
  property_type: string | null;
  valid_until: string | null;
  url: string;
  matched: "address" | "postcode";
};

// The certificate's own colour bands, darkened enough for white text.
const BAND: Record<string, string> = { "A+": "#00703C", A: "#00703C", B: "#2E8540", C: "#5A7D00", D: "#8A6A00", E: "#B25A00", F: "#C4480C", G: "#B3261E" };

/** The building's official energy certificate, shown with where it came from. Renders nothing if there is none. */
export function EnergyCertificate({ address, crew }: { address: string; crew?: number }) {
  const [epc, setEpc] = useState<Epc | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/epc?address=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setEpc(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [address]);

  if (!epc) return null;
  const area = epc.floor_area_m2;

  return (
    <section className={`flex flex-col gap-2 p-4 ${card}`}>
      <div className="flex items-center gap-3">
        <span className="display grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl uppercase text-white" style={{ background: BAND[epc.rating] ?? "#4E5967" }}>
          {epc.rating}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="display text-base">energy rating {epc.rating}</h2>
          <p className={`text-sm ${muted}`}>
            {area ? `${area.toLocaleString()} m²` : "floor area unknown"}
            {epc.score !== null ? ` · score ${epc.score}` : ""}
            {epc.property_type ? ` · ${epc.property_type}` : ""}
          </p>
        </div>
      </div>
      {area && crew && epc.matched === "address" ? (
        <p className="text-sm">
          grok asked for a crew of {crew}. on {area.toLocaleString()} m² that is about {Math.round(area / crew).toLocaleString()} m² each.
        </p>
      ) : null}
      <p className={`text-[13px] leading-snug ${muted}`}>
        {epc.matched === "postcode" ? `nearest certificate in this postcode (${epc.address}). ` : ""}
        source:{" "}
        <a href={epc.url} target="_blank" rel="noreferrer" className="font-semibold text-[#0B0B0C] underline">
          gov.uk energy certificate {epc.certificate}
        </a>
        {epc.valid_until ? `, valid until ${epc.valid_until}` : ""}. heating this floor all weekend for nobody is the bit we fix.
      </p>
    </section>
  );
}
