"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const START_EVENT = "players-nav-start";

export function LeaderboardsLoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [progress, setProgress] = useState(0);
  const activeRef = useRef(false);
  const startRef = useRef(0);
  const failsafeRef = useRef<number | null>(null);

  useEffect(() => {
    const onStart = () => {
      activeRef.current = true;
      startRef.current = Date.now();
      setProgress((p) => (p > 0 ? p : 4));

      // Absolute failsafe at 90s (matches the fetch AbortSignal timeout).
      if (failsafeRef.current) window.clearTimeout(failsafeRef.current);
      failsafeRef.current = window.setTimeout(() => {
        if (!activeRef.current) return;
        setProgress(100);
        window.setTimeout(() => {
          activeRef.current = false;
          setProgress(0);
        }, 250);
      }, 90_000);
    };

    window.addEventListener(START_EVENT, onStart as EventListener);
    return () => {
      window.removeEventListener(START_EVENT, onStart as EventListener);
      if (failsafeRef.current) window.clearTimeout(failsafeRef.current);
    };
  }, []);

  // Complete when the server returns the new route.
  useEffect(() => {
    if (!activeRef.current) return;
    if (failsafeRef.current) {
      window.clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
    setProgress(100);
    const done = setTimeout(() => {
      activeRef.current = false;
      setProgress(0);
    }, 250);
    return () => clearTimeout(done);
  }, [routeKey]);

  // Asymptotic progress — never reaches 95% on its own. Tuned so it takes
  // ~45s to reach 90%, matching the expected 30–60s upstream response window.
  useEffect(() => {
    if (progress <= 0 || progress >= 95) return;
    const tick = setInterval(() => {
      setProgress((p) => {
        if (p >= 94) return 94;
        const elapsed = (Date.now() - startRef.current) / 1000;
        // target = 95 * (1 - e^(-elapsed / 15)) — slow asymptote
        const target = 95 * (1 - Math.exp(-elapsed / 15));
        return Math.max(p, Math.min(94, target));
      });
    }, 200);
    return () => clearInterval(tick);
  }, [progress]);

  if (progress <= 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-mono text-chalk-400">
          Loading leaderboard... (upstream API is slow)
        </span>
        <span className="text-[11px] font-mono text-[#F4119E]">
          {Math.min(Math.round(progress), 100)}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded bg-pitch-800 overflow-hidden">
        <div
          className="h-full bg-[#F4119E] transition-[width] duration-200 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}
