"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bookDesk, card, getBalance, getFounder, listBookings, loadAll, muted, type Booking, type Office } from "../data";
import { TopBar } from "../ui";

export default function BookPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hours, setHours] = useState(1);
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  const refresh = () =>
    Promise.all([getBalance(getFounder()).catch(() => 0), listBookings(getFounder()).catch(() => [])]).then(([b, list]) => {
      setBalance(b);
      setName(getFounder());
      setBookings(list);
    });

  useEffect(() => {
    loadAll().then((d) => setOffices(d.offices), () => {});
    refresh();
  }, []);

  const max = balance ?? 0;
  const pick = Math.min(hours, max);
  const step = "grid h-11 w-11 place-items-center rounded-full border border-[#C9D3DF] bg-white text-[22px] leading-none disabled:opacity-40";

  return (
    <>
      <TopBar className="sticky top-0 bg-[#EEF3F9]" />
      <div className="flex flex-col gap-4 px-4 pb-8">
        <div className="flex flex-col gap-1.5 rounded-[32px] bg-[#0B0B0C] p-6 text-white">
          <p className="text-sm text-[#C9D3DF]">{name ? `${name}'s wallet` : "wallet"}</p>
          <p className="flex items-baseline gap-3">
            <span className="display text-[72px] leading-none tracking-tighter tabular-nums">{balance === null ? "–" : balance}h</span>
            <span className="text-[#C9D3DF]">of desk time</span>
          </p>
          <p className="mt-1.5 text-sm leading-snug text-[#C9D3DF]">{max > 0 ? "paid for in bleach. spend it on a desk." : "empty. go and face a toilet."}</p>
        </div>

        {balance !== null && max < 0.5 && (
          <p className={`p-4 ${card}`}>
            no hours yet.{" "}
            <Link href="/find" className="font-bold underline">
              find something filthy
            </Link>
          </p>
        )}

        {max >= 0.5 && (
          <form
            className={`flex flex-col gap-3.5 !rounded-[28px] p-[18px] ${card}`}
            onSubmit={async (e) => {
              e.preventDefault();
              const id = String(new FormData(e.currentTarget).get("office") ?? "");
              const office = offices.find((o) => String(o.id) === id);
              const ok = !!office && (await bookDesk(getFounder(), office, pick).catch(() => false));
              setError(ok ? "" : "pick an office and an amount you can afford.");
              if (ok) {
                await refresh();
                window.dispatchEvent(new Event("wallet"));
              }
            }}
          >
            <h1 className="display text-lg">book a desk</h1>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">Office</legend>
              {offices.map((o, i) => (
                <label key={o.id}>
                  <input type="radio" name="office" value={String(o.id)} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="flex h-11 items-center rounded-full border border-[#C9D3DF] px-4 font-medium peer-checked:border-[#0B0B0C] peer-checked:bg-[#0B0B0C] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF5A1F]">
                    {o.name}
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex items-center justify-between">
              <span className={muted}>how long?</span>
              <div className="flex items-center gap-3.5">
                <button type="button" aria-label="Fewer hours" disabled={pick <= 0.5} onClick={() => setHours(pick - 0.5)} className={step}>
                  −
                </button>
                <span className="display min-w-14 text-center text-[22px] tabular-nums" aria-live="polite">
                  {pick}h
                </span>
                <button type="button" aria-label="More hours" disabled={pick + 0.5 > max} onClick={() => setHours(pick + 0.5)} className={step}>
                  +
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button className="display h-[52px] rounded-full bg-[#FF5A1F] text-sm">spend {pick}h on a desk</button>
          </form>
        )}

        {bookings.length > 0 && (
          <>
            <h2 className={`px-1 text-[13px] font-bold ${muted}`}>desks you&apos;ve earned</h2>
            {bookings.map((b) => (
              <div key={b.id ?? b.at} className={`flex min-h-[64px] items-center gap-3 py-2 pl-3.5 pr-4 ${card}`}>
                <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EEF3F9] text-[22px] leading-none">
                  🪑
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">{b.office}</span>
                <span className="display tabular-nums">−{b.hours}h</span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
