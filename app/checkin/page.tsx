import { Suspense } from "react";
import DoorList from "./list";

export default function DoorPage() {
  return (
    <Suspense fallback={null}>
      <DoorList />
    </Suspense>
  );
}
