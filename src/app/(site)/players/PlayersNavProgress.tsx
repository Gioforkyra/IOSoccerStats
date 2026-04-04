"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const START_EVENT = "players-nav-start";

export function emitPlayersNavStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(START_EVENT));
  }
}

export function PlayersNavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [progress, setProgress] = useState(0);
  const activeRef = useRef(false);
  const forceDoneRef = useRef<number | null>(null);

  useEffect(() => {
    const onStart = () => {
      activeRef.current = true;
      setProgress((p) => (p > 0 ? p : 8));

      // Hard failsafe: always complete shortly even if route signal is missed.
      if (forceDoneRef.current) window.clearTimeout(forceDoneRef.current);
      forceDoneRef.current = window.setTimeout(() => {
        if (!activeRef.current) return;
        setProgress(100);
        window.setTimeout(() => {
          activeRef.current = false;
          setProgress(0);
        }, 220);
      }, 1800);
    };

    window.addEventListener(START_EVENT, onStart as EventListener);
    return () => {
      window.removeEventListener(START_EVENT, onStart as EventListener);
      if (forceDoneRef.current) window.clearTimeout(forceDoneRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeRef.current) return;
    if (forceDoneRef.current) {
      window.clearTimeout(forceDoneRef.current);
      forceDoneRef.current = null;
    }
    setProgress(100);
    const done = setTimeout(() => {
      activeRef.current = false;
      setProgress(0);
    }, 220);
    return () => clearTimeout(done);
  }, [routeKey]);

  useEffect(() => {
    if (progress <= 0 || progress >= 95) return;
    const tick = setInterval(() => {
      setProgress((p) => {
        if (p >= 94) return 94;
        if (p < 40) return p + 5;
        if (p < 75) return p + 2;
        return p + 1;
      });
    }, 90);
    return () => clearInterval(tick);
  }, [progress]);

  if (progress <= 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-chalk-400">Loading player statistics...</span>
        <span className="text-[10px] font-mono text-[#F4119E]">{Math.min(progress, 100)}%</span>
      </div>
      <div className="h-1.5 w-full rounded bg-pitch-800 overflow-hidden">
        <div
          className="h-full bg-[#F4119E] transition-[width] duration-150 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}
