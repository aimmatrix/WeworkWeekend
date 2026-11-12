"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DoorCode } from "../../checkin/code";
import { clock } from "../../checkin/door";
import { card, grim, loadAll, muted, reward, staticMap, type Office } from "../../find/data";
import { Emoji } from "../../find/ui";
import { jobsAt, tally, type Job } from "../data";

type Epc = { rating?: string; score?: number; certificate?: string; url?: string; matched?: string };

export default function LandlordOffice() {
  const { officeId } = useParams<{ officeId: string }>();
  const [office, setOffice] = useState<Office | null | undefined>(undefined);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [epc, setEpc] = useState<Epc | null>(null);

  useEffect(() => {
    const load = () =>
      loadAll().then(
        (d) => {
          const found = d.offices.find((o) => String(o.id) === officeId) ?? null;
          setOffice(found);
          setJobs(found ? jobsAt(found, d.tasks) : []);
        },
        () => setOffice(null),
      );
    load();
    // Founders claim and scan in while this is open.
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [officeId]);

  // The building's official energy certificate, when the lookup knows the address.
  const address = office?.address;
  useEffect(() => {
    if (!address) return;
    fetch(`/api/epc?address=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEpc(d?.rating ? d : null), () => {});
  }, [address]);

  if (office === undefined) return <p className={`p-5 ${muted}`}>loading…</p>;
  if (office === null) return <p className="p-5">that office has vanished. possibly condemned.</p>;

  const t = tally(jobs);
  const map = staticMap(office.lng, office.lat, 14.3, 448, 300);
  const stat = `!rounded-[20px] px-3.5 py-3 ${card}`;

  return (
    <div className="flex min-h-full flex-col">
      <div className="relative h-[210px] shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {map && <img src={map} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-4">
          <Link href="/landlord" aria-label="Back to your offices" className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[#0B0B0C] text-white shadow-[0_8px_20px_rgba(15,30,60,0.18)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <Link href={`/checkin?office=${office.id}`} className="display ml-auto flex h-[52px] items-center rounded-full bg-white px-5 text-[13px] shadow-[0_8px_20px_rgba(15,30,60,0.18)]">
            door list
          </Link>
        </div>
      </div>

      <div className="relative -mt-4 flex flex-1 flex-col gap-4 rounded-t-[32px] bg-[#EEF3F9] px-4 pb-28 shadow-[0_-8px_28px_rgba(15,30,60,0.12)]">
        <div className="mx-auto -mb-1 mt-2.5 h-[5px] w-11 rounded-full bg-[#9AA7B6]" />
        <div className="px-1">
          <h1 className="display text-[22px] leading-tight">{office.name}</h1>
          <p className={`mt-1.5 ${muted}`}>{office.address}</p>
        </div>

        <dl className="grid grid-cols-3 gap-2">
          <div className={stat}>
            <dd className="display text-xl tabular-nums">
              {t.claimed}/{t.total}
            </dd>
            <dt className={`text-[13px] ${muted}`}>jobs claimed</dt>
          </div>
          <div className={stat}>
            <dd className="display text-xl tabular-nums">{t.inside}</dd>
            <dt className={`text-[13px] ${muted}`}>scanned in</dt>
          </div>
          <div className={stat}>
            <dd className="display text-xl tabular-nums">{office.dirt_score}/10</dd>
            <dt className={`text-[13px] ${muted}`}>{grim(office.dirt_score)}</dt>
          </div>
        </dl>

        {epc && (
          <p className={`px-4 py-3 text-sm leading-snug ${card}`}>
            <span className="display mr-2 text-lg">epc {epc.rating}</span>
            {epc.score != null && `score ${epc.score}. `}
            {epc.matched === "postcode" && "nearest certificate in this postcode, not necessarily this unit. "}
            {epc.certificate &&
              (epc.url ? (
                <a href={epc.url} target="_blank" rel="noreferrer" className="underline">
                  certificate {epc.certificate}
                </a>
              ) : (
                `certificate ${epc.certificate}`
              ))}
          </p>
        )}

        <DoorCode office={office} />

        <div className="flex flex-col gap-2">
          <h2 className={`px-1 text-[13px] font-bold ${muted}`}>who&apos;s doing what</h2>
          {jobs.length === 0 && <p className={`p-4 ${card}`}>no jobs here. suspiciously clean.</p>}
          {jobs.map((job) => (
            <div key={job.id} className={`flex min-h-[76px] items-center gap-3 py-2 pl-3 pr-3.5 ${card}`}>
              {job.before_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={job.before_url} alt="" className="h-14 w-14 shrink-0 rounded-[16px] object-cover" />
              ) : (
                <Emoji task={job} className="!h-14 !w-14" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{job.title}</p>
                <p className={`truncate text-[13px] ${job.status === "open" ? muted : "font-semibold"}`}>
                  {job.status === "open"
                    ? `${job.room} · nobody yet`
                    : job.status === "done"
                      ? `${job.claimed_by} · passed by grok`
                      : `${job.claimed_by} · ${job.inSince ? `in since ${clock(job.inSince)}` : job.when}`}
                </p>
              </div>
              <span className={`display flex shrink-0 items-center rounded-full tabular-nums ${job.status === "done" ? "h-8 bg-[#DDF3E6] px-2.5 text-[13px] text-[#0A6B3B]" : reward(job.credit_hours)}`}>
                {job.status === "done" ? "✓" : `+${job.credit_hours}h`}
              </span>
            </div>
          ))}
        </div>

        <Link href="/capture" className="display flex h-14 items-center justify-center rounded-full bg-[#0B0B0C] text-[15px] text-white">
          scan another office
        </Link>
      </div>
    </div>
  );
}
