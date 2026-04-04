"use client";

import { useEffect, useMemo, useState } from "react";

export function PlayersLoadingProgress() {
  const [progress, setProgress] = useState(0);

  const label = useMemo(() => {
    if (progress < 25) return "Connecting to official API...";
    if (progress < 55) return "Fetching player statistics...";
    if (progress < 85) return "Sorting and shaping results...";
    return "Finalizing...";
  }, [progress]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) return 96;
        if (prev < 40) return prev + 4;
        if (prev < 75) return prev + 2;
        return prev + 1;
      });
    }, 90);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-[900px] mx-auto px-4 py-16">
      <div className="rounded-xl border border-chalk-100/12 bg-pitch-900/40 p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-2 rounded border border-[#F4119E]/35 bg-[#F4119E]/10 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F4119E] animate-pulse" />
            <span className="text-xs font-mono text-chalk-100">{label}</span>
          </div>
          <span className="text-xs font-mono text-[#F4119E]">{progress}%</span>
        </div>

        <div className="h-2 w-full rounded bg-pitch-800 overflow-hidden">
          <div
            className="h-full bg-[#F4119E] transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-3 text-[11px] font-mono text-chalk-500">
          Loading Player Stats view...
        </p>
      </div>
    </div>
  );
}
