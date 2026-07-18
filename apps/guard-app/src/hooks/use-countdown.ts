import { useEffect, useState } from "react";

import { secondsUntil } from "@/utils/date";

export function useCountdown(expiresAt: string | null | undefined): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setTick((current) => current + 1), 1_000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return secondsUntil(expiresAt);
}

export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
