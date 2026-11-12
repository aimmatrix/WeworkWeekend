"use client";

import { QRCodeSVG } from "qrcode.react";
import { arriveUrl, doorCode, muted, type Office } from "../find/data";

/** The code founders scan on arrival. Hold it up, or print it and stick it on the door. */
export function DoorCode({ office }: { office: Office }) {
  return (
    <div className="flex items-center gap-4 rounded-[26px] bg-white p-4 shadow-[0_2px_10px_rgba(15,30,60,0.06)]">
      <QRCodeSVG value={arriveUrl(office.id)} size={132} marginSize={0} fgColor="#0B0B0C" title={`Door code for ${office.name}`} className="shrink-0" />
      <div className="min-w-0">
        <p className="font-bold leading-snug">cleaners scan this to get in</p>
        <p className={`mt-1 text-[13px] leading-snug ${muted}`}>camera on strike? they can type</p>
        <p className="display mt-1 text-[30px] leading-none tracking-[0.12em] tabular-nums">{doorCode(office.id)}</p>
      </div>
    </div>
  );
}
