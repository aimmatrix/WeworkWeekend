"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { card, getFounder, loadAll, markArrived, muted } from "../../data";
import { TopBar } from "../../ui";

/** Where the door QR lands when it is opened with the phone's own camera. */
export default function ArrivePage() {
  const { officeId } = useParams<{ officeId: string }>();
  const router = useRouter();
  const [nothing, setNothing] = useState(false);

  useEffect(() => {
    loadAll().then(
      (d) => {
        const mine = d.tasks.find((x) => String(x.office_id) === officeId && x.claimed_by === getFounder() && x.status === "claimed");
        if (!mine) return setNothing(true);
        markArrived(officeId);
        router.replace(`/find/job/${mine.id}`);
      },
      () => setNothing(true),
    );
  }, [officeId, router]);

  return (
    <>
      <TopBar className="sticky top-0 bg-[#EEF3F9]" />
      {nothing ? (
        <p className={`mx-4 p-4 ${card}`}>
          right door, but you have no task here yet.{" "}
          <Link href={`/find/${officeId}`} className="font-bold underline">
            pick one
          </Link>
        </p>
      ) : (
        <p className={`px-5 ${muted}`}>checking you in…</p>
      )}
    </>
  );
}
