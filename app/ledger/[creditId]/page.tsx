import { Suspense } from "react";
import CreditView from "./view";

export default function CreditPage() {
  return (
    <Suspense fallback={<p className="p-6 opacity-60">Loading evidence…</p>}>
      <CreditView />
    </Suspense>
  );
}
