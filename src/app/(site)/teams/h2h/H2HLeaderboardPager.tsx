"use client";

import { useState, type ReactNode } from "react";

export function H2HLeaderboardPager({
  pages,
  labels,
}: {
  pages: ReactNode[];
  labels: string[];
}) {
  const [idx, setIdx] = useState(0);
  const total = pages.length;
  const next = () => setIdx((i) => (i + 1) % total);
  const prev = () => setIdx((i) => (i - 1 + total) % total);

  return (
    <div className="relative mb-6">
      {total > 1 && (
        <button
          onClick={prev}
          aria-label="Previous leaderboards"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-1/2 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-pitch-900/95 border border-chalk-100/15 text-chalk-300 hover:text-[#F4119E] hover:border-[#F4119E]/40 transition-colors flex items-center justify-center text-xl sm:text-2xl leading-none shadow-lg cursor-pointer pb-0.5"
        >
          ‹
        </button>
      )}
      {pages[idx]}
      {total > 1 && (
        <button
          onClick={next}
          aria-label="Next leaderboards"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-1/2 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-pitch-900/95 border border-chalk-100/15 text-chalk-300 hover:text-[#F4119E] hover:border-[#F4119E]/40 transition-colors flex items-center justify-center text-xl sm:text-2xl leading-none shadow-lg cursor-pointer pb-0.5"
        >
          ›
        </button>
      )}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              title={labels[i]}
              className={`rounded-full transition-all ${
                i === idx
                  ? "w-4 h-1.5 bg-[#F4119E]"
                  : "w-1.5 h-1.5 bg-chalk-100/20 hover:bg-chalk-100/40"
              }`}
            />
          ))}
          <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-chalk-500">
            {labels[idx]}
          </span>
        </div>
      )}
    </div>
  );
}
