"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { card, grim, loadAll, MAP_STYLE, MAPBOX_TOKEN, muted, officeSticker, WATER, type Office, type Task } from "../find/data";
import { jobsAt, tally } from "./data";

const pill = "flex h-[52px] items-center rounded-full shadow-[0_8px_20px_rgba(15,30,60,0.18)]";

/** Landlord home: the same pale map as the founder app, showing how each office is filling up. */
export default function LandlordHome() {
  const router = useRouter();
  const mapEl = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ offices: Office[]; tasks: Task[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let dead = false;
    let cleanup = () => {};
    (async () => {
      const d = await loadAll();
      if (dead || !mapEl.current) return;
      setData(d);
      if (!MAPBOX_TOKEN) return setError("set NEXT_PUBLIC_MAPBOX_TOKEN to see the map");
      const mapboxgl = (await import("mapbox-gl")).default;
      if (dead) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const m = new mapboxgl.Map({ container: mapEl.current, style: MAP_STYLE, center: [-0.105, 51.5215], zoom: 11, attributionControl: false });
      m.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
      m.on("style.load", () => m.setPaintProperty("water", "fill-color", WATER));
      const fit = new ResizeObserver(() => m.resize());
      fit.observe(mapEl.current);
      cleanup = () => {
        fit.disconnect();
        m.remove();
      };

      const bounds = new mapboxgl.LngLatBounds();
      for (const office of d.offices) {
        const t = tally(jobsAt(office, d.tasks));
        // Built as DOM nodes, not an HTML string: office names are typed in by people.
        const pin = document.createElement("button");
        pin.className = "flex flex-col items-center gap-1 p-1.5 hover:scale-105";
        pin.setAttribute("aria-label", `${office.name}: ${t.claimed} of ${t.total} jobs claimed`);
        const art = document.createElement("img");
        art.src = officeSticker(office.id);
        art.alt = "";
        art.className = "-mb-3 h-14 w-14 object-contain drop-shadow-[0_4px_6px_rgba(15,30,60,0.3)]";
        const badge = document.createElement("span");
        badge.className = `display relative flex h-8 items-center rounded-full px-3 text-[13px] shadow-[0_4px_14px_rgba(15,30,60,0.2)] ${
          t.total > 0 && t.claimed === t.total ? "bg-[#0B0B0C] text-white" : "bg-white text-[#0B0B0C]"
        }`;
        badge.textContent = `${t.claimed}/${t.total}`;
        const name = document.createElement("span");
        name.className = "whitespace-nowrap text-xs font-bold lowercase text-[#0B0B0C] [text-shadow:0_0_3px_#fff,0_0_3px_#fff,0_0_6px_#fff]";
        name.textContent = office.name;
        pin.append(art, badge, name);
        pin.onclick = () => router.push(`/landlord/${office.id}`);
        const wrap = document.createElement("div");
        wrap.append(pin);
        new mapboxgl.Marker({ element: wrap, anchor: "bottom" }).setLngLat([office.lng, office.lat]).addTo(m);
        bounds.extend([office.lng, office.lat]);
      }
      if (d.offices.length) m.fitBounds(bounds, { padding: { top: 170, bottom: 60, left: 70, right: 70 }, maxZoom: 14, duration: 0 });
    })().catch((e) => setError(String(e.message ?? e)));
    return () => {
      dead = true;
      cleanup();
    };
  }, [router]);

  const offices = data?.offices ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-x-0 -bottom-6 top-0">
          <div ref={mapEl} className="h-full w-full" />
        </div>
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 p-4">
          <span className={`display min-w-0 flex-1 bg-[#0B0B0C] px-5 text-[15px] text-white ${pill}`}>your offices</span>
          <Link href="/capture" className={`display shrink-0 bg-[#FF5A1F] px-5 text-[13px] ${pill}`}>
            + scan one
          </Link>
        </div>
      </div>

      <section className="relative z-10 shrink-0 rounded-t-[32px] bg-[#EEF3F9] pb-24 shadow-[0_-8px_28px_rgba(15,30,60,0.12)]">
        <div className="mx-auto mt-2.5 h-[5px] w-11 rounded-full bg-[#9AA7B6]" />
        <div className="flex items-baseline justify-between px-5 pt-3.5">
          <h1 className="display text-lg">this weekend</h1>
          <span className={`text-sm ${muted}`}>
            {offices.length} {offices.length === 1 ? "office" : "offices"} being scrubbed
          </span>
        </div>
        {error && <p className="mx-4 mt-3 rounded-3xl bg-white p-4 text-sm text-red-700">{error}</p>}
        {data && offices.length === 0 && <p className={`px-5 pt-4 ${muted}`}>nothing listed yet. scan an office and let strangers clean it.</p>}

        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-3.5">
          {offices.map((office) => {
            const t = tally(jobsAt(office, data!.tasks));
            return (
              <Link key={office.id} href={`/landlord/${office.id}`} className={`flex w-[310px] shrink-0 snap-center flex-col gap-3.5 !rounded-[28px] p-5 ${card}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="display truncate text-[17px] leading-tight">{office.name}</h2>
                    <p className={`mt-1 truncate text-sm ${muted}`}>{office.address}</p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={officeSticker(office.id)} alt="" className="h-14 w-14 shrink-0 object-contain" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="display text-[52px] leading-none tracking-tight tabular-nums">
                    {t.claimed}/{t.total}
                  </span>
                  <span className={`text-sm leading-snug ${muted}`}>
                    jobs claimed
                    <br />
                    {t.inside} scanned in · {t.done} passed
                  </span>
                </div>
                <span className="display flex h-12 items-center justify-between rounded-full bg-[#0B0B0C] pl-5 pr-2 text-sm font-medium text-white">
                  run this office
                  <span className="flex h-8 items-center rounded-full bg-[#FF5A1F] px-3 text-[13px] font-bold text-[#0B0B0C]">{grim(office.dirt_score)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
