"use client";

import { useEffect, useRef, useState } from "react";

/** Live camera that reads a QR code and hands back its text. */
export function DoorScanner({ onRead, onClose }: { onRead: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const read = useRef(onRead);
  const [error, setError] = useState("");

  useEffect(() => {
    read.current = onRead;
  }, [onRead]);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    let last = "";

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
      const jsQR = (await import("jsqr")).default;
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play();

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const tick = () => {
        const v = video.current;
        if (stopped || !v) return;
        if (v.videoWidth) {
          // Half-size frames are plenty for a door-sized code and keep phones cool.
          canvas.width = v.videoWidth / 2;
          canvas.height = v.videoHeight / 2;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const hit = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
          if (hit?.data && hit.data !== last) {
            last = hit.data; // report each code once, so a wrong door does not spam
            read.current(hit.data);
          }
        }
        frame = requestAnimationFrame(tick);
      };
      tick();
    })().catch(() => setError("couldn't open the camera. allow camera access, or type the digits below."));

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[22px] bg-[#0B0B0C]">
      <video ref={video} playsInline muted className="aspect-square w-full object-cover" aria-label="Camera view for scanning the door code" />
      <div className="pointer-events-none absolute inset-10 rounded-[22px] border-4 border-white/80" />
      {error && <p className="absolute inset-x-4 top-4 rounded-2xl bg-white p-3 text-sm font-semibold text-red-700">{error}</p>}
      <button onClick={onClose} className="display absolute bottom-3 right-3 h-11 rounded-full bg-white px-4 text-[13px]">
        close
      </button>
    </div>
  );
}
