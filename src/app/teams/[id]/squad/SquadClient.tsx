"use client";

import Link from "next/link";
import { useState } from "react";

export type SquadPlayer = {
  steam_id: string;
  username: string;
  position: string | null;
  role: number | null;
  rating: number | null;
  join_date: string | null;
  apps: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
};

const ROLE_LABELS: Record<number, string> = {
  1: "Reserve",
  2: "Manager",
  3: "Loaned",
  4: "Player",
  5: "Vice Captain",
  6: "Captain",
};

const ROLE_COLORS: Record<number, string> = {
  1: "text-chalk-400/60",
  2: "text-amber-400",
  3: "text-orange-400",
  4: "text-chalk-300",
  5: "text-grass-500/70",
  6: "text-grass-500",
};

type SortKey = "apps" | "goals" | "assists" | "yellow_cards" | "red_cards" | "role" | "rating";

export default function SquadClient({ squad }: { squad: SquadPlayer[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (!sortAsc) setSortAsc(true);
      else { setSortKey(null); setSortAsc(false); }
    } else { setSortKey(key); setSortAsc(false); }
  };

  // Role sort order: Captain(6)=0, Vice Captain(5)=1, Manager(2)=2, Player(4)=3, Loaned(3)=4, Reserve(1)=5
  const ROLE_SORT: Record<number, number> = { 6: 0, 5: 1, 2: 2, 4: 3, 3: 4, 1: 5 };

  const sorted = [...squad].sort((a, b) => {
    if (!sortKey) return 0;
    if (sortKey === "role") {
      const av = ROLE_SORT[a.role ?? 99] ?? 99;
      const bv = ROLE_SORT[b.role ?? 99] ?? 99;
      return sortAsc ? bv - av : av - bv;
    }
    const av = a[sortKey] ?? 99;
    const bv = b[sortKey] ?? 99;
    return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const cols: { key: SortKey | null; label: string; align: string; title: string }[] = [
    { key: null, label: "NAME", align: "text-left", title: "Player Name" },
    { key: "role", label: "ROLE", align: "text-left", title: "Team Role" },
    { key: null, label: "POS", align: "text-left", title: "Position" },
    { key: "rating", label: "RTG", align: "text-right", title: "Rating" },
    { key: null, label: "DATE JOINED", align: "text-left", title: "Date Joined" },
    { key: "apps", label: "APPS", align: "text-right", title: "Appearances" },
    { key: "goals", label: "GOALS", align: "text-right", title: "Goals" },
    { key: "assists", label: "ASSISTS", align: "text-right", title: "Assists" },
    { key: "yellow_cards", label: "YC", align: "text-right", title: "Yellow Cards" },
    { key: "red_cards", label: "RC", align: "text-right", title: "Red Cards" },
  ];

  return (
    <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-chalk-100/8">
            {cols.map((col, ci) => (
              <th
                key={ci}
                className={`px-4 py-3 font-mono text-[11px] text-chalk-400 ${col.align} ${col.key ? "cursor-pointer hover:text-chalk-200 select-none transition-colors" : ""}`}
                onClick={col.key ? () => handleSort(col.key as SortKey) : undefined}
                title={col.title}
              >
                {col.label}
                {col.key && sortKey === col.key && (
                  <span className="ml-1 text-grass-500">{sortAsc ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-sm font-mono text-chalk-400">
                No squad data available.
              </td>
            </tr>
          ) : (
            sorted.map((p, idx) => (
              <tr
                key={p.steam_id}
                className={`${idx % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"} hover:bg-chalk-100/8 transition-colors`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/players/${p.steam_id}`}
                    className="font-body text-chalk-100 hover:text-grass-400 transition-colors"
                  >
                    {p.username}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {p.role != null && ROLE_LABELS[p.role] ? (
                    <span className={`text-xs font-mono font-medium ${ROLE_COLORS[p.role] || "text-chalk-400"}`}>
                      {ROLE_LABELS[p.role]}
                    </span>
                  ) : (
                    <span className="text-chalk-400/50 text-xs font-mono">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.position ? (
                    <span className="text-[10px] font-mono text-chalk-400 bg-pitch-800 px-1.5 py-0.5 rounded">
                      {p.position}
                    </span>
                  ) : (
                    <span className="text-chalk-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-chalk-300">
                  {p.rating != null ? p.rating.toFixed(1) : "-"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-chalk-400">
                  {p.join_date || "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-chalk-300">
                  {p.apps.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-chalk-200 font-medium">
                  {p.goals.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-chalk-300">
                  {p.assists.toLocaleString()}
                </td>
                <td className={`px-4 py-3 text-right font-mono text-xs ${p.yellow_cards > 0 ? "text-amber-400" : "text-chalk-400"}`}>
                  {p.yellow_cards}
                </td>
                <td className={`px-4 py-3 text-right font-mono text-xs ${p.red_cards > 0 ? "text-red-400" : "text-chalk-400"}`}>
                  {p.red_cards}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
