"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap } from "mapbox-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { card, catOf, grim, ICON, loadAll, MAP_STYLE, MAPBOX_TOKEN, MOCK, muted, officeSticker, openHours, STICKER, TARIFF, WATER, type Office, type Task } from "./data";
import { TopBar } from "./ui";

export default function MapPage() {
  const router = useRouter();
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const pins = useRef(new Map<Office["id"], HTMLElement>());
  const [offices, setOffices] = useState<Office[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let dead = false;
    const made = pins.current;
    (async () => {
      const data = await loadAll();
      if (dead || !mapEl.current) return;
      setOffices(data.offices);
      setTasks(data.tasks);
      setLoaded(true);
      if (!MAPBOX_TOKEN) return setError("set NEXT_PUBLIC_MAPBOX_TOKEN to see the map");

      const mapboxgl = (await import("mapbox-gl")).default;
      if (dead) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const m = (map.current = new mapboxgl.Map({
        container: mapEl.current,
        style: MAP_STYLE,
        center: [-0.105, 51.5215], // central London
        zoom: 11,
        attributionControl: false,
      }));
      m.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
      m.on("style.load", () => m.setPaintProperty("water", "fill-color", WATER));
      // The sheet below changes height with the filters; Mapbox only follows window resizes on its own.
      const fit = new ResizeObserver(() => m.resize());
      fit.observe(mapEl.current);
      m.on("remove", () => fit.disconnect());

      const best = Math.max(0, ...data.offices.map((o) => openHours(data.tasks, o.id)));
      const bounds = new mapboxgl.LngLatBounds();
      for (const office of data.offices) {
        const hours = openHours(data.tasks, office.id);
        // Built as DOM nodes, not an HTML string: office names are landlord input.
        const pin = document.createElement("button");
        pin.className = "flex flex-col items-center gap-1 p-1.5 transition-opacity hover:scale-105";
        pin.setAttribute("aria-label", `${office.name}: ${hours} credit hours up for grabs`);
        const badge = document.createElement("span");
        badge.className = `display relative flex items-center rounded-full shadow-[0_4px_14px_rgba(15,30,60,0.2)] ${
          hours > 0 && hours === best ? "h-9 bg-[#0B0B0C] px-3.5 text-[15px] text-white" : "h-8 bg-white px-3 text-[13px] text-[#0B0B0C]"
        }`;
        badge.textContent = `${hours}h`;
        const art = document.createElement("img");
        art.src = officeSticker(office.id);
        art.alt = "";
        art.className = "-mb-3 h-14 w-14 object-contain drop-shadow-[0_4px_6px_rgba(15,30,60,0.3)]";
        const name = document.createElement("span");
        name.className = "whitespace-nowrap text-xs font-bold lowercase text-[#0B0B0C] [text-shadow:0_0_3px_#fff,0_0_3px_#fff,0_0_6px_#fff]";
        name.textContent = office.name;
        pin.append(art, badge, name);
        pin.onclick = () => router.push(`/find/${office.id}`);
        // Mapbox positions the wrapper itself, so the pin sits inside one.
        const wrap = document.createElement("div");
        wrap.append(pin);
        new mapboxgl.Marker({ element: wrap, anchor: "bottom" }).setLngLat([office.lng, office.lat]).addTo(m);
        made.set(office.id, pin);
        bounds.extend([office.lng, office.lat]);
      }
      if (data.offices.length) m.fitBounds(bounds, { padding: { top: 170, bottom: 90, left: 70, right: 70 }, maxZoom: 14, duration: 0 });
    })().catch((e) => setError(String(e.message ?? e)));
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
      made.clear();
    };
  }, [router]);

  const q = query.trim().toLowerCase();
  const shown = offices
    .filter(
      (o) =>
        (!q || `${o.name} ${o.address}`.toLowerCase().includes(q)) &&
        (!cat || tasks.some((x) => x.office_id === o.id && x.status === "open" && catOf(x) === cat)),
    )
    .sort((a, b) => openHours(tasks, b.id) - openHours(tasks, a.id));
  const shownIds = shown.map((o) => String(o.id)).join();

  // Dim the pins that the search or the chips have filtered out.
  useEffect(() => {
    for (const [id, pin] of pins.current) pin.classList.toggle("opacity-30", !shownIds.split(",").includes(String(id)));
  }, [shownIds, offices]);

  const locate = () =>
    navigator.geolocation?.getCurrentPosition((p) => map.current?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 13 }));

  const chip = "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5";

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        {/* Mapbox makes its container position: relative, so it gets a positioned parent. */}
        <div className="absolute inset-x-0 -bottom-6 top-0">
          <div ref={mapEl} className="h-full w-full" />
        </div>

        <TopBar className="absolute inset-x-0 top-0">
          <label className="flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-full bg-[#0B0B0C] px-[18px] text-white shadow-[0_8px_20px_rgba(15,30,60,0.22)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="shrink-0" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search grim offices"
              aria-label="Search offices"
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400"
            />
          </label>
        </TopBar>

        <button
          onClick={locate}
          aria-label="Centre the map on me"
          className="absolute bottom-[68px] right-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-[#0B0B0C] text-white shadow-[0_6px_16px_rgba(15,30,60,0.25)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M21 3L3 10.5l7.5 3L13.5 21z" />
          </svg>
        </button>

        <div className="no-scrollbar absolute inset-x-0 bottom-3 z-10 flex gap-2 overflow-x-auto px-4">
          <button onClick={() => setCat("")} aria-pressed={!cat} className={`${chip} font-semibold ${cat ? "border border-[#C9D3DF] bg-white" : "bg-[#0B0B0C] text-white"}`}>
            all tasks
          </button>
          {Object.entries(ICON).map(([key, icon]) => (
            <button
              key={key}
              onClick={() => setCat(cat === key ? "" : key)}
              aria-pressed={cat === key}
              className={`${chip} ${cat === key ? "bg-[#0B0B0C] text-white" : "border border-[#C9D3DF] bg-white"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {STICKER[key] ? <img src={STICKER[key]} alt="" className="h-7 w-7 object-contain" /> : <span aria-hidden>{icon}</span>}
              {key} <b>{TARIFF[key]}h</b>
            </button>
          ))}
        </div>
      </div>

      <section className="relative z-10 shrink-0 rounded-t-[32px] bg-[#EEF3F9] pb-5 shadow-[0_-8px_28px_rgba(15,30,60,0.12)]">
        <div className="mx-auto mt-2.5 h-[5px] w-11 rounded-full bg-[#9AA7B6]" />
        <div className="flex items-baseline justify-between px-5 pt-3.5">
          <h1 className="display text-lg">open this weekend</h1>
          <span className={`text-sm ${muted}`}>
            {shown.length} {shown.length === 1 ? "office" : "offices"} {MOCK ? "(demo)" : "need you"}
          </span>
        </div>
        {error && <p className="mx-4 mt-3 rounded-3xl bg-white p-4 text-sm text-red-700">{error}</p>}
        {loaded && shown.length === 0 && <p className={`px-5 pt-4 ${muted}`}>nothing that filthy right now. try another filter.</p>}

        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-3.5">
          {shown.map((office) => (
            <OfficeCard key={office.id} office={office} tasks={tasks.filter((x) => x.office_id === office.id && x.status === "open" && (!cat || catOf(x) === cat))} />
          ))}
        </div>
      </section>
    </div>
  );
}

function OfficeCard({ office, tasks }: { office: Office; tasks: Task[] }) {
  const hours = tasks.reduce((s, x) => s + Number(x.credit_hours), 0);
  const best = [...tasks].sort((a, b) => b.credit_hours - a.credit_hours)[0];
  const mess = Math.max(0, Math.min(10, Math.round(office.dirt_score)));

  return (
    <Link href={`/find/${office.id}`} className={`flex w-[310px] shrink-0 snap-center flex-col gap-3.5 !rounded-[28px] p-5 ${card}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="display truncate text-[17px] leading-tight">{office.name}</h2>
          <p className={`mt-1 truncate text-sm ${muted}`}>{office.address}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={officeSticker(office.id)} alt="" className="h-14 w-14 shrink-0 rotate-6 object-contain drop-shadow-[0_3px_5px_rgba(15,30,60,0.25)]" />
      </div>

      <div className="flex items-center gap-3">
        <span className="display text-[52px] leading-none tracking-tight tabular-nums">{hours}h</span>
        <span className={`text-sm leading-snug ${muted}`}>
          of desk credit up for
          <br />
          grabs · crew of {office.crew_size}
        </span>
      </div>

      <div className="flex items-center gap-2.5 text-sm">
        <span className={muted}>{grim(mess)}</span>
        <span role="img" aria-label={`Mess level ${mess} out of 10`} className="flex gap-[3px]">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`h-3.5 w-1.5 rounded-full ${i < mess ? "bg-[#0B0B0C]" : "bg-[#CDD7E2]"}`} />
          ))}
        </span>
        <b className="ml-auto">{mess}/10</b>
      </div>

      <span className="display flex h-12 items-center justify-between rounded-full bg-[#0B0B0C] pl-5 pr-2 text-sm font-medium text-white">
        {tasks.length ? `see ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}` : "all taken"}
        {best && (
          <span className="flex h-8 items-center gap-1 rounded-full bg-[#FF5A1F] px-3 text-[13px] font-bold text-[#0B0B0C]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {STICKER[catOf(best)] ? <img src={STICKER[catOf(best)]} alt="" className="h-6 w-6 object-contain" /> : (ICON[catOf(best)] ?? "✨")} +{best.credit_hours}h
          </span>
        )}
      </span>
    </Link>
  );
}
