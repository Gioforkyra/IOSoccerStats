"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export type TeamHistoryEntry = {
  team_id: number;
  team_name: string;
  team_logo: string | null;
  team_color: string | null;
  team_type_id: number | null;
  join_date: string | null;
  leave_date: string | null;
  is_current: boolean;
  apps: number;
  goals: number;
  assists: number;
  wins: number;
  draws: number;
  losses: number;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "club", label: "Club", typeId: 1 },
  { key: "national", label: "National", typeId: 2 },
  { key: "draft", label: "Draft", typeId: 4 },
] as const;

export default function TeamHistoryClient({ teams }: { teams: TeamHistoryEntry[] }) {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = filter === "all"
    ? teams
    : teams.filter((t) => {
        const f = FILTERS.find((f) => f.key === filter);
        return f && "typeId" in f && t.team_type_id === f.typeId;
      });

  const activeLabel = FILTERS.find((f) => f.key === filter)?.label || "All";

  return (
    <>
      <div className="flex items-center gap-2.5 mb-4">
        <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase">
          Team History
        </h3>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(!open)}
            className="bg-pitch-800 border border-chalk-100/10 rounded px-3 py-1.5 text-xs font-mono text-chalk-300 focus:outline-none hover:border-[#F4119E]/50 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            {activeLabel}
            <svg className={`w-3 h-3 text-chalk-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open && (
            <div className="absolute top-full left-0 mt-1 bg-pitch-800 border border-chalk-100/10 rounded shadow-lg z-20 min-w-[100px] py-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer ${
                    filter === f.key
                      ? "text-[#F4119E] bg-[#F4119E]/10"
                      : "text-chalk-300 hover:bg-[#F4119E]/15 hover:text-[#F4119E]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-chalk-400 font-body">No team history found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t, i) => {
            const winPct = t.apps > 0 ? ((t.wins / t.apps) * 100).toFixed(0) : "0";

            return (
              <Link
                key={`${t.team_id}-${i}`}
                href={`/teams/${t.team_id}`}
                className="block border border-chalk-100/30 rounded-lg px-4 py-2 relative overflow-hidden transition-colors hover:border-[#F4119E]"
                style={{
                  backgroundColor: t.team_color ? `${t.team_color}25` : "rgba(28,28,28,0.4)",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-pitch-950/60 to-transparent pointer-events-none" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="shrink-0">
                    {t.team_logo ? (
                      <img src={t.team_logo} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-pitch-700 flex items-center justify-center text-xs font-display font-700 text-chalk-300">
                        {t.team_name.slice(0, 3).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <span className="font-display font-700 text-sm text-chalk-100 min-w-[120px]">{t.team_name}</span>
                  {t.is_current && (
                    <span className="text-[10px] font-mono bg-grass-500/20 text-grass-400 px-2 py-0.5 rounded">CURRENT</span>
                  )}
                  <span className="text-xs font-mono text-chalk-400">{t.join_date || "?"} – {t.leave_date || "Present"}</span>
                  <div className="flex items-center gap-x-4 text-xs font-mono ml-auto">
                    <span className="text-chalk-300">APPS <span className="text-chalk-100 font-medium">{t.apps}</span></span>
                    <span className="text-chalk-300">G <span className="text-chalk-100">{t.goals}</span></span>
                    <span className="text-chalk-300">A <span className="text-chalk-100">{t.assists}</span></span>
                    <span className="text-grass-500">{t.wins}W</span><span className="text-chalk-400">{t.draws}D</span><span className="text-red-400">{t.losses}L</span>
                    <span className="text-chalk-300">WIN% <span className="text-chalk-100">{winPct}%</span></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
