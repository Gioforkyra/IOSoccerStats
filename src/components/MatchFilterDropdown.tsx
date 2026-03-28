"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type FilterVal = "all" | "friendly" | "competitive";

export function MatchFilterDropdown({
  current,
  hrefAll,
  hrefFriendly,
  hrefCompetitive,
}: {
  current: FilterVal;
  hrefAll: string;
  hrefFriendly: string;
  hrefCompetitive: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label =
    current === "competitive" ? "COMPETITIVE" :
    current === "friendly" ? "FRIENDLIES" : "ALL MATCHES";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 rounded px-2 py-1 transition-colors"
      >
        {label} <span className="text-[8px] opacity-60">▼</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#0f1923] border border-chalk-100/15 rounded shadow-xl min-w-[130px]">
          <Link
            href={hrefAll}
            onClick={() => setOpen(false)}
            className={`block px-3 py-2 text-xs font-mono hover:bg-white/5 transition-colors ${current === "all" ? "text-chalk-100" : "text-chalk-400"}`}
          >
            All
          </Link>
          <Link
            href={hrefFriendly}
            onClick={() => setOpen(false)}
            className={`block px-3 py-2 text-xs font-mono hover:bg-white/5 transition-colors ${current === "friendly" ? "text-chalk-100" : "text-chalk-400"}`}
          >
            Friendlies
          </Link>
          <Link
            href={hrefCompetitive}
            onClick={() => setOpen(false)}
            className={`block px-3 py-2 text-xs font-mono hover:bg-white/5 transition-colors ${current === "competitive" ? "text-yellow-400" : "text-chalk-400"}`}
          >
            Competitive
          </Link>
        </div>
      )}
    </div>
  );
}
