"use client";
import { useState } from "react";
import Link from "next/link";

// Mock — sostituisci con fetch da /api/players?sort=goals&page=1
const MOCK_PLAYERS = [
  { name: "aryan",    nationality: "NL", rating: 9.2, apps: 3188, winPct: "61%", wins: 1945, losses: 874,  draws: 369, goals: 2155, goalsAvg: 0.68, shotAcc: "78.23%", assists: 1658, assistsAvg: 0.52, passesAvg: 38.32, passCompl: "83.69%", xg: 1823, xgAvg: 0.57 },
  { name: "Nuri",     nationality: "?",  rating: 7.9, apps: 2282, winPct: "45%", wins: 1017, losses: 990,  draws: 275, goals: 2310, goalsAvg: 1.01, shotAcc: "77.96%", assists: 1541, assistsAvg: 0.68, passesAvg: 23.75, passCompl: "67.73%", xg: 2011, xgAvg: 0.88 },
  { name: "Janir",    nationality: "PL", rating: 8.0, apps: 2128, winPct: "46%", wins: 985,  losses: 896,  draws: 247, goals: 1999, goalsAvg: 0.94, shotAcc: "76.97%", assists: 1235, assistsAvg: 0.58, passesAvg: 23.00, passCompl: "72.30%", xg: 1742, xgAvg: 0.82 },
  { name: "tet-",     nationality: "NP", rating: 8.2, apps: 3109, winPct: "45%", wins: 1402, losses: 1260, draws: 447, goals: 708,  goalsAvg: 0.23, shotAcc: "73.83%", assists: 1487, assistsAvg: 0.48, passesAvg: 29.75, passCompl: "76.46%", xg: 621,  xgAvg: 0.20 },
  { name: "Kobe",     nationality: "BE", rating: 8.3, apps: 967,  winPct: "51%", wins: 495,  losses: 339,  draws: 133, goals: 546,  goalsAvg: 0.56, shotAcc: "76.52%", assists: 640,  assistsAvg: 0.66, passesAvg: 29.04, passCompl: "76.58%", xg: 498,  xgAvg: 0.52 },
  { name: "NightFire",nationality: "BE", rating: 7.9, apps: 412,  winPct: "56%", wins: 229,  losses: 129,  draws: 54,  goals: 490,  goalsAvg: 1.19, shotAcc: "82.55%", assists: 231,  assistsAvg: 0.56, passesAvg: 25.14, passCompl: "72.19%", xg: 412,  xgAvg: 1.00 },
  { name: "Bas",      nationality: "GB", rating: 7.2, apps: 790,  winPct: "50%", wins: 392,  losses: 302,  draws: 96,  goals: 188,  goalsAvg: 0.24, shotAcc: "72.64%", assists: 318,  assistsAvg: 0.40, passesAvg: 28.31, passCompl: "69.37%", xg: 155,  xgAvg: 0.20 },
  { name: "Phenom",   nationality: "AR", rating: 7.0, apps: 564,  winPct: "39%", wins: 219,  losses: 261,  draws: 84,  goals: 313,  goalsAvg: 0.55, shotAcc: "77.87%", assists: 321,  assistsAvg: 0.57, passesAvg: 20.62, passCompl: "68.44%", xg: 271,  xgAvg: 0.48 },
];

const COLUMNS = [
  { key: "rating",    label: "RTG",      title: "Rating" },
  { key: "apps",      label: "APPS",     title: "Appearances" },
  { key: "winPct",    label: "WIN%",     title: "Win Percentage" },
  { key: "goals",     label: "GOALS",    title: "Total Goals" },
  { key: "goalsAvg",  label: "G/APP",    title: "Goals per App" },
  { key: "xg",        label: "xG",       title: "Expected Goals (IOStats exclusive)" },
  { key: "shotAcc",   label: "SHOT%",    title: "Shot Accuracy" },
  { key: "assists",   label: "AST",      title: "Assists" },
  { key: "passCompl", label: "PASS%",    title: "Pass Completion" },
];

export default function PlayersPage() {
  const [sortKey, setSortKey] = useState("goals");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...MOCK_PLAYERS].sort((a, b) => {
    const av = parseFloat(String((a as any)[sortKey])) || 0;
    const bv = parseFloat(String((b as any)[sortKey])) || 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            PLAYER STATS
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            6,790 players · sorted by{" "}
            <span className="text-grass-500 font-mono">{sortKey}</span>
          </p>
        </div>
        {/* xG badge */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-grass-500 border border-grass-500/30 rounded-full px-3 py-1">
          ◎ xG data exclusive to IOStats
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 text-xs font-mono flex-wrap">
        {["ALL TIME", "THIS MONTH", "THIS WEEK"].map(t => (
          <button key={t} className="px-3 py-1 rounded border border-chalk-100/10 text-chalk-400 hover:border-grass-500/40 hover:text-grass-500 transition-colors">
            {t}
          </button>
        ))}
        <div className="h-4 w-px bg-chalk-100/10" />
        {["ALL POSITIONS", "GK", "DEF", "MID", "ATT"].map(p => (
          <button key={p} className="px-3 py-1 rounded border border-chalk-100/10 text-chalk-400 hover:border-grass-500/40 hover:text-grass-500 transition-colors">
            {p}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chalk-100/8">
              <th className="text-left px-4 py-3 font-mono text-xs text-chalk-400 w-8">#</th>
              <th className="text-left px-4 py-3 font-mono text-xs text-chalk-400">PLAYER</th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-4 py-3 font-mono text-xs text-chalk-400 cursor-pointer hover:text-chalk-100 transition-colors text-right"
                  title={col.title}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="flex items-center justify-end gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-grass-500">
                        {sortDir === "desc" ? "↓" : "↑"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.name} className="stat-row group">
                <td className="px-4 py-3 font-display font-700 text-chalk-100/20 text-base">
                  {i + 1}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/players/${p.name}`}
                    className="flex items-center gap-2 hover:text-grass-400 transition-colors"
                  >
                    <div className="w-6 h-6 rounded bg-pitch-700 flex items-center justify-center text-xs font-display font-700 text-chalk-300 shrink-0">
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="font-body font-medium text-chalk-100 group-hover:text-grass-400 transition-colors">
                      {p.name}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono text-chalk-200">{p.rating}</td>
                <td className="px-4 py-3 text-right font-mono text-chalk-300">{p.apps.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-chalk-300">{p.winPct}</td>
                <td className={`px-4 py-3 text-right font-mono font-medium ${sortKey === "goals" ? "text-grass-400" : "text-chalk-200"}`}>
                  {p.goals.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-chalk-300">{p.goalsAvg}</td>
                {/* xG — our exclusive */}
                <td className={`px-4 py-3 text-right font-mono ${sortKey === "xg" ? "text-grass-400" : "text-grass-500/70"}`}>
                  {p.xg.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-chalk-300">{p.shotAcc}</td>
                <td className="px-4 py-3 text-right font-mono text-chalk-300">{p.assists.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-chalk-300">{p.passCompl}</td>
                <td className="px-4 py-3 text-right text-chalk-400/20 group-hover:text-grass-500 transition-colors">→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs font-mono text-chalk-400">Page 1 of 679</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, "...", 679].map((p, i) => (
            <button
              key={i}
              className={`w-8 h-8 rounded text-xs font-mono transition-colors ${
                p === 1
                  ? "bg-grass-500 text-pitch-950 font-700"
                  : "text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
