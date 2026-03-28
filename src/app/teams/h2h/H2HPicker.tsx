"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TeamOption {
  id: number;
  name: string;
  logo: string | null;
  color: string | null;
  typeLabel: string;
}

const TYPE_FILTERS = ["All", "Club", "National", "Mix"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

export function H2HPicker({ teams }: { teams: TeamOption[] }) {
  const router = useRouter();
  const [team1, setTeam1] = useState<number | null>(null);
  const [team2, setTeam2] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");

  const filteredTeams = typeFilter === "All"
    ? teams
    : teams.filter((t) => t.typeLabel === typeFilter);

  function handleCompare() {
    if (!team1 || !team2) return;
    router.push(`/teams/h2h?team1=${team1}&team2=${team2}`);
  }

  function TeamList({
    label,
    selected,
    onSelect,
    exclude,
  }: {
    label: string;
    selected: number | null;
    onSelect: (id: number) => void;
    exclude: number | null;
  }) {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-2 px-1">
          {label}
        </div>
        <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-y-auto h-[480px]">
          {filteredTeams.map((t) => {
            const isSelected = selected === t.id;
            const isExcluded = exclude === t.id;
            return (
              <button
                key={t.id}
                onClick={() => !isExcluded && onSelect(t.id)}
                disabled={isExcluded}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors border-b border-chalk-100/5 last:border-b-0
                  ${isExcluded
                    ? "opacity-30 cursor-not-allowed"
                    : isSelected
                      ? "bg-[#F4119E]/15 border-l-2 border-l-[#F4119E]"
                      : "hover:bg-chalk-100/5 cursor-pointer"
                  }`}
              >
                {t.logo ? (
                  <img src={t.logo} alt="" className="w-7 h-7 object-contain shrink-0" />
                ) : (
                  <div
                    className="w-7 h-7 rounded shrink-0 flex items-center justify-center text-[9px] font-display font-700 text-chalk-300"
                    style={{ backgroundColor: t.color ? `${t.color}40` : "#1c1c1c" }}
                  >
                    {t.name.slice(0, 3).toUpperCase()}
                  </div>
                )}
                <span
                  className={`text-sm font-body truncate ${isSelected ? "text-[#F4119E]" : "text-chalk-200"}`}
                >
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Type filter tabs */}
      <div className="flex items-center gap-1 text-xs font-mono">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`px-3 py-1.5 rounded border transition-colors ${
              typeFilter === f
                ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10"
                : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <TeamList
          label="Pick Team One"
          selected={team1}
          onSelect={setTeam1}
          exclude={team2}
        />
        <TeamList
          label="Pick Team Two"
          selected={team2}
          onSelect={setTeam2}
          exclude={team1}
        />
      </div>
      <div className="flex items-center justify-center gap-6">
        {team1 && (
          <div className="flex items-center gap-2 text-sm font-body text-chalk-200">
            {teams.find((t) => t.id === team1)?.logo && (
              <img src={teams.find((t) => t.id === team1)!.logo!} alt="" className="w-6 h-6 object-contain" />
            )}
            <span>{teams.find((t) => t.id === team1)?.name}</span>
          </div>
        )}
        <button
          onClick={handleCompare}
          disabled={!team1 || !team2}
          className={`px-6 py-2 rounded font-mono text-xs uppercase tracking-wider font-700 transition-all
            ${team1 && team2
              ? "bg-[#F4119E] text-white hover:bg-[#F4119E]/80 cursor-pointer"
              : "bg-chalk-100/5 text-chalk-500 cursor-not-allowed border border-chalk-100/10"
            }`}
        >
          Compare Teams
        </button>
        {team2 && (
          <div className="flex items-center gap-2 text-sm font-body text-chalk-200">
            {teams.find((t) => t.id === team2)?.logo && (
              <img src={teams.find((t) => t.id === team2)!.logo!} alt="" className="w-6 h-6 object-contain" />
            )}
            <span>{teams.find((t) => t.id === team2)?.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
