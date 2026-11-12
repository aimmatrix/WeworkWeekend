import { useEffect, useState } from "react";

/** Cycles through waiting lines while something slow is happening. */
export function useQuip(lines: string[], on: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setI((n) => n + 1), 1600);
    return () => clearInterval(id);
  }, [on]);
  return lines[i % lines.length];
}
