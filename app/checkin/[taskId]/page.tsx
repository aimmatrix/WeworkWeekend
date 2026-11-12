import { Suspense } from "react";
import CheckIn from "./view";

export default function CheckInPage() {
  return (
    <Suspense fallback={null}>
      <CheckIn />
    </Suspense>
  );
}
