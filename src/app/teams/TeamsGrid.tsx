"use client";

import { useState } from "react";
import Link from "next/link";
import { badgeUrl } from "@/lib/iosoccer-api";
import { proxyImg } from "@/lib/img";
import type { TeamWithRating } from "./page";

type SortMode = "name" | "rating-desc" | "rating-asc";

function sortTeams(teams: TeamWithRating[], sort: SortMode) {
  return [...teams].sort((a, b) => {
    if (sort === "rating-desc") {
      if (a.avgRating == null && b.avgRating == null) return a.name.localeCompare(b.name);
      if (a.avgRating == null) return 1;
      if (b.avgRating == null) return -1;
      return b.avgRating - a.avgRating;
    }
    if (sort === "rating-asc") {
      if (a.avgRating == null && b.avgRating == null) return a.name.localeCompare(b.name);
      if (a.avgRating == null) return 1;
      if (b.avgRating == null) return -1;
      return a.avgRating - b.avgRating;
    }
    return a.name.localeCompare(b.name);
  });
}

function TeamCard({ t }: { t: TeamWithRating }) {
  const bgColor = t.color || "#1a2d52";
  const logo = badgeUrl(t.badgeImageId) ?? (t.dbLogo ? proxyImg(t.dbLogo) : null);
  return (
    <Link
      href={`/teams/${t.id}`}
      className={`group relative rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-xl ${
        t.isInactive
          ? "border-chalk-100/10 hover:border-chalk-100/30 hover:shadow-chalk-100/5 opacity-60 hover:opacity-80"
          : "border-transparent hover:border-[#F4119E]/50 hover:shadow-[#F4119E]/20"
      }`}
    >
      <div className="aspect-[4/3] flex items-center justify-center p-4 relative" style={{ backgroundColor: bgColor }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        {logo ? (
          <img src={logo} alt={t.name} className="w-20 h-20 object-contain relative z-10 drop-shadow-lg group-hover:scale-110 transition-transform" />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center relative z-10">
            <span className="font-display font-900 text-2xl text-white/80">{t.name.slice(0, 3).toUpperCase()}</span>
          </div>
        )}
        {t.isInactive && (
          <span className="absolute top-1.5 right-1.5 text-[9px] font-mono bg-black/50 text-chalk-400 px-1.5 py-0.5 rounded z-10">
            INACTIVE
          </span>
        )}
      </div>
      <div className="bg-pitch-900 p-3 text-center">
        <div className="flex items-center justify-center gap-2 min-w-0">
          <div className="font-display font-700 text-sm text-chalk-100 uppercase tracking-wide truncate">{t.name}</div>
          {t.avgRating != null && (
            <span className="font-display font-700 text-sm text-[#F4119E] shrink-0">{t.avgRating.toFixed(2)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function TeamsGrid({
  activeTeams,
  inactiveTeams,
}: {
  activeTeams: TeamWithRating[];
  inactiveTeams: TeamWithRating[];
}) {
  const [sort, setSort] = useState<SortMode>("name");
  const [showInactive, setShowInactive] = useState(false);

  const sortedActive = sortTeams(activeTeams, sort);
  const sortedInactive = sortTeams(inactiveTeams, sort);

  if (activeTeams.length === 0 && inactiveTeams.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-chalk-400 font-body text-lg mb-2">No teams found</div>
        <p className="text-chalk-400/60 font-mono text-sm">Try changing the filters above.</p>
      </div>
    );
  }

  return (
    <>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 text-[10px] font-mono text-chalk-500 flex-wrap">
        <span className="uppercase tracking-wider">Sort</span>
        {(["name", "rating-desc", "rating-asc"] as SortMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setSort(mode)}
            className={`px-2.5 py-1 rounded border transition-colors ${
              sort === mode
                ? "bg-chalk-100/10 border-chalk-100/30 text-chalk-100"
                : "bg-transparent border-chalk-100/8 text-chalk-500 hover:text-chalk-300 hover:border-chalk-100/20"
            }`}
          >
            {mode === "name" ? "A–Z" : mode === "rating-desc" ? "Rating ↓" : "Rating ↑"}
          </button>
        ))}

        <div className="w-px h-3 bg-chalk-100/10 mx-1" />

        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`px-2.5 py-1 rounded border transition-colors ${
            showInactive
              ? "bg-chalk-100/10 border-chalk-100/30 text-chalk-300"
              : "bg-transparent border-chalk-100/8 text-chalk-500 hover:text-chalk-300 hover:border-chalk-100/20"
          }`}
        >
          Inactive {inactiveTeams.length > 0 && `(${inactiveTeams.length})`}
        </button>
      </div>

      {/* Active teams */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {sortedActive.map((t) => <TeamCard key={t.id} t={t} />)}
      </div>

      {/* Inactive teams */}
      {showInactive && inactiveTeams.length > 0 && (
        <>
          <div className="mt-8 mb-4 flex items-center gap-3">
            <span className="text-xs font-mono text-chalk-500 uppercase tracking-wider">Inactive teams</span>
            <div className="flex-1 h-px bg-chalk-100/8" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {sortedInactive.map((t) => <TeamCard key={t.id} t={t} />)}
          </div>
        </>
      )}
    </>
  );
}
