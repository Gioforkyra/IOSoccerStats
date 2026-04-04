"use client";

import { useEffect, useMemo, useState } from "react";

export function PlayerProfileLoadingProgress() {
  const [progress, setProgress] = useState(0);

  const label = useMemo(() => {
    if (progress < 20) return "Opening player profile...";
    if (progress < 45) return "Loading profile overview...";
    if (progress < 75) return "Fetching detailed statistics...";
    return "Finalizing profile view...";
  }, [progress]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) return 96;
        if (prev < 35) return prev + 5;
        if (prev < 70) return prev + 2;
        return prev + 1;
      });
    }, 90);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-chalk-400">{label}</span>
        <span className="text-[10px] font-mono text-[#F4119E]">{progress}%</span>
      </div>

      <div className="h-1.5 w-full rounded bg-pitch-800 overflow-hidden">
        <div
          className="h-full bg-[#F4119E] transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
