"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { MatchPlayer, MatchShot } from "./page";

type TeamInfo = { id: number; name: string; logo: string | null };

type MatchInfo = {
  id: number;
  date: string;
  map: string | null;
  server: string | null;
  potm: string | null;
  homeScore: number;
  awayScore: number;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
};

type SortKey = "goals" | "assists" | "second_assists" | "shots" | "shots_on_target" | "passes" | "passes_completed" | "pass_pct" | "key_passes" | "chances_created" | "interceptions" | "saves" | "offsides" | "fouls" | "fouls_suffered" | "yellow_cards" | "red_cards" | "own_goals" | "goals_conceded" | "corners" | "throw_ins" | "free_kicks" | "goal_kicks" | "penalties" | "distance_run" | "xg";

const SERVER_FLAGS: Record<string, string> = {
  fr: "\u{1F1EB}\u{1F1F7}", de: "\u{1F1E9}\u{1F1EA}", uk: "\u{1F1EC}\u{1F1E7}", gb: "\u{1F1EC}\u{1F1E7}",
  us: "\u{1F1FA}\u{1F1F8}", br: "\u{1F1E7}\u{1F1F7}", es: "\u{1F1EA}\u{1F1F8}", it: "\u{1F1EE}\u{1F1F9}",
  nl: "\u{1F1F3}\u{1F1F1}", pl: "\u{1F1F5}\u{1F1F1}", ru: "\u{1F1F7}\u{1F1FA}", ar: "\u{1F1E6}\u{1F1F7}",
  au: "\u{1F1E6}\u{1F1FA}", se: "\u{1F1F8}\u{1F1EA}", no: "\u{1F1F3}\u{1F1F4}", fi: "\u{1F1EB}\u{1F1EE}",
  pt: "\u{1F1F5}\u{1F1F9}", eu: "\u{1F1EA}\u{1F1FA}",
};

function getServerFlag(server: string): string {
  const lower = server.toLowerCase();
  for (const [code, flag] of Object.entries(SERVER_FLAGS)) {
    if (lower.includes(`[${code}]`) || lower.includes(`[${code}/`) || lower.includes(`/${code}]`)) return flag;
  }
  return "";
}

export default function MatchClient({
  match, playerStats, shots,
}: {
  match: MatchInfo;
  playerStats: MatchPlayer[];
  shots: MatchShot[];
}) {
  const [selectedShot, setSelectedShot] = useState<number | null>(null);

  const homePlayers = playerStats.filter((p) => p.team_side === "home");
  const awayPlayers = playerStats.filter((p) => p.team_side === "away");
  const homeXg = shots.filter((s) => s.team_side === "home").reduce((sum, s) => sum + s.xg, 0);
  const awayXg = shots.filter((s) => s.team_side === "away").reduce((sum, s) => sum + s.xg, 0);
  const serverFlag = match.server ? getServerFlag(match.server) : "";

  // Build timeline from shots (sorted by minute)
  const timeline = useMemo(() => {
    return [...shots]
      .filter((s) => s.minute != null)
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  }, [shots]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-chalk-400 mb-6">
        <Link href="/matches" className="hover:text-grass-500 transition-colors">Matches</Link>
        <span className="mx-2">/</span>
        <span className="text-chalk-200">Match #{match.id}</span>
      </div>

      {/* Score header */}
      <div className="bg-pitch-900/60 border border-chalk-100/8 rounded-xl p-6 md:p-8 mb-6">
        <div className="text-xs font-mono text-chalk-400 text-center mb-5">
          {match.date}
          {match.map && <> · {match.map}</>}
          {match.server && <> · {serverFlag && <>{serverFlag} </>}{match.server}</>}
        </div>

        <div className="flex items-center justify-center gap-4 md:gap-8">
          <div className="text-right flex-1">
            <Link href={`/teams/${match.homeTeam.id}`} className="group inline-flex flex-col items-end gap-1">
              <div className="flex items-center gap-3">
                <span className="font-display font-800 text-2xl md:text-3xl text-chalk-100 group-hover:text-grass-400 transition-colors">
                  {match.homeTeam.name}
                </span>
                {match.homeTeam.logo && <img src={match.homeTeam.logo} alt="" className="w-8 h-8 object-contain" />}
              </div>
            </Link>
          </div>

          <div className="font-display font-900 text-5xl md:text-6xl flex items-center gap-3 shrink-0">
            <span className={match.homeScore > match.awayScore ? "text-grass-500" : "text-chalk-200"}>{match.homeScore}</span>
            <span className="text-chalk-400/30 text-2xl md:text-3xl">-</span>
            <span className={match.awayScore > match.homeScore ? "text-grass-500" : "text-chalk-200"}>{match.awayScore}</span>
          </div>

          <div className="flex-1">
            <Link href={`/teams/${match.awayTeam.id}`} className="group inline-flex flex-col items-start gap-1">
              <div className="flex items-center gap-3">
                {match.awayTeam.logo && <img src={match.awayTeam.logo} alt="" className="w-8 h-8 object-contain" />}
                <span className="font-display font-800 text-2xl md:text-3xl text-chalk-100 group-hover:text-grass-400 transition-colors">
                  {match.awayTeam.name}
                </span>
              </div>
            </Link>
          </div>
        </div>

        {(homeXg > 0 || awayXg > 0) && (
          <div className="mt-5">
            <div className="flex justify-between text-xs font-mono text-grass-500 mb-1">
              <span>{homeXg.toFixed(1)} xG</span>
              <span>{awayXg.toFixed(1)} xG</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-pitch-700">
              <div className="bg-grass-500/60" style={{ width: `${(homeXg / (homeXg + awayXg)) * 100}%` }} />
              <div className="bg-chalk-400/40" style={{ width: `${(awayXg / (homeXg + awayXg)) * 100}%` }} />
            </div>
          </div>
        )}

        {match.potm && (
          <div className="text-center mt-4">
            <span className="text-xs font-mono text-amber-400">POTM: {match.potm}</span>
          </div>
        )}
      </div>

      {/* Shot map + Team stats + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Shot map — left aligned, portrait, logos in center */}
        <div className="lg:col-span-2">
          <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">
            SHOT MAP <span className="text-xs text-grass-500 font-mono">· xG by IOStats</span>
          </h2>
          <div className="max-w-md">
            <div
              className="relative rounded-lg border border-chalk-100/8 overflow-hidden"
              style={{ paddingTop: "154%" }}
            >
              <div className="absolute inset-0 bg-[#0d1f0d]">
                <svg viewBox="0 0 68 105" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="68" height="105" fill="#0d1f0d" />
                  {[0, 15, 30, 45, 60, 75, 90].map((y) => (
                    <rect key={y} x="0" y={y} width="68" height="7.5" fill="rgba(255,255,255,0.015)" />
                  ))}
                  <rect x="4" y="4" width="60" height="97" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
                  <line x1="4" y1="52.5" x2="64" y2="52.5" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                  <circle cx="34" cy="52.5" r="9.15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                  <circle cx="34" cy="52.5" r="0.7" fill="rgba(255,255,255,0.3)" />
                  <rect x="14" y="4" width="40" height="16.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                  <rect x="22" y="4" width="24" height="5.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <circle cx="34" cy="15" r="0.5" fill="rgba(255,255,255,0.25)" />
                  <rect x="14" y="84.5" width="40" height="16.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                  <rect x="22" y="95.5" width="24" height="5.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <circle cx="34" cy="90" r="0.5" fill="rgba(255,255,255,0.25)" />
                  <rect x="26" y="2" width="16" height="2" fill="rgba(255,255,255,0.35)" rx="0.5" />
                  <rect x="26" y="101" width="16" height="2" fill="rgba(255,255,255,0.35)" rx="0.5" />
                </svg>
                {/* Team logos in center */}
                <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "42%" }}>
                  {match.homeTeam.logo ? (
                    <img src={match.homeTeam.logo} alt="" className="w-8 h-8 object-contain opacity-20" />
                  ) : (
                    <span className="text-[10px] font-mono text-chalk-100/15">{match.homeTeam.name.slice(0, 3).toUpperCase()}</span>
                  )}
                </div>
                <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "54%" }}>
                  {match.awayTeam.logo ? (
                    <img src={match.awayTeam.logo} alt="" className="w-8 h-8 object-contain opacity-20" />
                  ) : (
                    <span className="text-[10px] font-mono text-chalk-100/15">{match.awayTeam.name.slice(0, 3).toUpperCase()}</span>
                  )}
                </div>
                {/* Shot dots */}
                {shots.map((s, i) => {
                  const x = Math.max(6, Math.min(94, s.normalized_x * 88 + 6));
                  const y = Math.max(4, Math.min(96, (1 - s.normalized_y) * 92 + 4));
                  const color = s.is_goal ? "#00e676" : s.is_save ? "#ffb300" : "#ef5350";
                  const size = Math.max(8, Math.min(18, s.xg * 30 + 8));
                  const isSelected = selectedShot === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedShot(isSelected ? null : i)}
                      className={`absolute rounded-full border-2 transition-all cursor-pointer ${isSelected ? "border-white z-20" : "border-pitch-950/60"}`}
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        width: `${size}px`,
                        height: `${size}px`,
                        background: color,
                        transform: `translate(-50%, -50%)${isSelected ? " scale(1.3)" : ""}`,
                        opacity: selectedShot !== null && !isSelected ? 0.4 : 0.9,
                      }}
                    />
                  );
                })}
                {/* Shot tooltip */}
                {selectedShot !== null && shots[selectedShot] && (() => {
                  const s = shots[selectedShot];
                  const x = Math.max(6, Math.min(94, s.normalized_x * 88 + 6));
                  const y = Math.max(4, Math.min(96, (1 - s.normalized_y) * 92 + 4));
                  const above = y > 50;
                  return (
                    <div
                      className="absolute z-30 pointer-events-none"
                      style={{
                        left: `${x}%`,
                        top: above ? `calc(${y}% - 12px)` : `calc(${y}% + 12px)`,
                        transform: `translate(-50%, ${above ? "-100%" : "0"})`,
                      }}
                    >
                      <div className="bg-pitch-950/95 border border-chalk-100/15 rounded-lg px-3 py-2 text-xs font-mono whitespace-nowrap shadow-lg">
                        <div className="font-medium text-chalk-100">{s.username}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={s.is_goal ? "text-green-400" : s.is_save ? "text-amber-400" : "text-red-400"}>
                            {s.is_goal ? "Goal" : s.is_save ? "Saved" : "Missed"}
                          </span>
                          <span className="text-chalk-400">xG: {s.xg.toFixed(2)}</span>
                          {s.minute != null && <span className="text-chalk-400">{s.minute}&apos;</span>}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs font-mono text-chalk-400">
              {[["#00e676", "Goal"], ["#ffb300", "Save"], ["#ef5350", "Miss"]].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                  {l}
                </span>
              ))}
              <span className="text-chalk-400/40 ml-2">Click dots for details</span>
            </div>
          </div>
        </div>

        {/* Team stats + Timeline stacked */}
        <div className="space-y-6">
          {/* Team comparison */}
          <div>
            <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">TEAM STATS</h2>
            <div className="bg-pitch-900/40 rounded-lg border border-chalk-100/8 p-4">
              {(() => {
                const hT = (key: keyof MatchPlayer) => homePlayers.reduce((s, p) => s + Number(p[key] || 0), 0);
                const aT = (key: keyof MatchPlayer) => awayPlayers.reduce((s, p) => s + Number(p[key] || 0), 0);
                const rows = [
                  { label: "Goals", home: match.homeScore, away: match.awayScore },
                  { label: "xG", home: homeXg.toFixed(1), away: awayXg.toFixed(1) },
                  { label: "Shots", home: hT("shots"), away: aT("shots") },
                  { label: "On Target", home: hT("shots_on_target"), away: aT("shots_on_target") },
                  { label: "Passes", home: hT("passes"), away: aT("passes") },
                  { label: "Pass Acc", home: hT("passes") > 0 ? `${((hT("passes_completed") / hT("passes")) * 100).toFixed(0)}%` : "0%", away: aT("passes") > 0 ? `${((aT("passes_completed") / aT("passes")) * 100).toFixed(0)}%` : "0%" },
                  { label: "Saves", home: hT("saves"), away: aT("saves") },
                  { label: "Intercept.", home: hT("interceptions"), away: aT("interceptions") },
                  { label: "Corners", home: hT("corners"), away: aT("corners") },
                  { label: "Fouls", home: hT("fouls"), away: aT("fouls") },
                  { label: "Offsides", home: hT("offsides"), away: aT("offsides") },
                  { label: "Yellows", home: hT("yellow_cards"), away: aT("yellow_cards") },
                  { label: "Reds", home: hT("red_cards"), away: aT("red_cards") },
                ];
                return rows.map((r, i) => (
                  <div key={r.label} className={`flex items-center text-sm py-2 px-2 rounded ${i % 2 === 0 ? "bg-pitch-600/15" : ""}`}>
                    <span className="w-12 text-right font-mono text-chalk-200">{r.home}</span>
                    <span className="flex-1 text-center text-xs font-mono text-chalk-400">{r.label}</span>
                    <span className="w-12 text-left font-mono text-chalk-200">{r.away}</span>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Game Timeline */}
          {timeline.length > 0 && (
            <div>
              <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">GAME HIGHLIGHTS</h2>
              <div className="bg-pitch-900/40 rounded-lg border border-chalk-100/8 divide-y divide-chalk-100/5 max-h-[500px] overflow-y-auto">
                {timeline.map((ev, i) => {
                  const icon = ev.is_goal ? "\u26BD" : ev.is_save ? "\u{1F9E4}" : "\u274C";
                  const label = ev.is_goal ? "GOAL" : ev.is_save ? "SAVE" : "MISS";
                  const color = ev.is_goal ? "text-green-400" : ev.is_save ? "text-amber-400" : "text-red-400";
                  const isHome = ev.team_side === "home";
                  return (
                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 0 ? "bg-pitch-600/15" : ""}`}>
                      <span className="text-xs font-mono text-chalk-400 w-8 shrink-0">{ev.minute}&apos;</span>
                      <span className="text-base shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-mono font-bold ${color}`}>{label}</span>
                        <span className="text-xs font-mono text-chalk-200 ml-2">{ev.username}</span>
                      </div>
                      {(isHome ? match.homeTeam.logo : match.awayTeam.logo) && (
                        <img
                          src={(isHome ? match.homeTeam.logo : match.awayTeam.logo)!}
                          alt=""
                          className="w-4 h-4 object-contain opacity-50 shrink-0"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Player stats tables */}
      {[
        { label: match.homeTeam.name, logo: match.homeTeam.logo, players: homePlayers, side: "home" as const },
        { label: match.awayTeam.name, logo: match.awayTeam.logo, players: awayPlayers, side: "away" as const },
      ].map((team) => (
        <SortablePlayerTable key={team.side} team={team} shots={shots} />
      ))}
    </div>
  );
}

function SortablePlayerTable({
  team, shots,
}: {
  team: { label: string; logo: string | null; players: MatchPlayer[]; side: "home" | "away" };
  shots: MatchShot[];
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (!sortAsc) setSortAsc(true);
      else { setSortKey(null); setSortAsc(false); }
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const playerXgMap = new Map<string, number>();
  for (const s of shots) {
    playerXgMap.set(s.player_steam_id, (playerXgMap.get(s.player_steam_id) || 0) + s.xg);
  }

  const getPassPct = (p: MatchPlayer) => p.passes > 0 ? (p.passes_completed / p.passes) * 100 : 0;

  const sorted = [...team.players].sort((a, b) => {
    if (!sortKey) return 0;
    let av: number, bv: number;
    if (sortKey === "xg") {
      av = playerXgMap.get(a.player_steam_id) || 0;
      bv = playerXgMap.get(b.player_steam_id) || 0;
    } else if (sortKey === "pass_pct") {
      av = getPassPct(a);
      bv = getPassPct(b);
    } else {
      av = Number(a[sortKey] || 0);
      bv = Number(b[sortKey] || 0);
    }
    return sortAsc ? av - bv : bv - av;
  });

  const [showMore, setShowMore] = useState(false);

  const baseCols: { key: SortKey | null; label: string; align: string }[] = [
    { key: null, label: "PLAYER", align: "text-left" },
    { key: null, label: "POS", align: "text-center" },
    { key: "goals", label: "G", align: "text-right" },
    { key: "shots", label: "SH", align: "text-right" },
    { key: "shots_on_target", label: "OT", align: "text-right" },
    { key: "assists", label: "A", align: "text-right" },
    { key: "second_assists", label: "2ND", align: "text-right" },
    { key: "key_passes", label: "KP", align: "text-right" },
    { key: "chances_created", label: "CC", align: "text-right" },
    { key: "passes", label: "PAS", align: "text-right" },
    { key: "passes_completed", label: "CMP", align: "text-right" },
    { key: "pass_pct", label: "%", align: "text-right" },
    { key: "interceptions", label: "INT", align: "text-right" },
    { key: "saves", label: "SVS", align: "text-right" },
    { key: "xg", label: "xG", align: "text-right" },
  ];

  const extraCols: { key: SortKey | null; label: string; align: string }[] = [
    { key: "offsides", label: "OFF", align: "text-right" },
    { key: "distance_run", label: "DIST", align: "text-right" },
    { key: "fouls", label: "FLS", align: "text-right" },
    { key: "fouls_suffered", label: "FS", align: "text-right" },
    { key: "own_goals", label: "OG", align: "text-right" },
    { key: "goals_conceded", label: "GC", align: "text-right" },
    { key: "corners", label: "CRN", align: "text-right" },
    { key: "throw_ins", label: "TI", align: "text-right" },
    { key: "free_kicks", label: "FK", align: "text-right" },
    { key: "goal_kicks", label: "GK", align: "text-right" },
    { key: "penalties", label: "PEN", align: "text-right" },
    { key: "yellow_cards", label: "YC", align: "text-right" },
    { key: "red_cards", label: "RC", align: "text-right" },
  ];

  const cols = showMore ? [...baseCols, ...extraCols] : baseCols;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 flex items-center gap-2">
          {team.logo && <img src={team.logo} alt="" className="w-5 h-5 object-contain" />}
          {team.label}
        </h2>
        <button
          onClick={() => setShowMore(!showMore)}
          className="text-xs font-mono text-grass-500 hover:text-grass-400 transition-colors cursor-pointer"
        >
          {showMore ? "SHOW FEWER STATS" : "SHOW MORE STATS"}
        </button>
      </div>
      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-chalk-100/8">
              {cols.map((col, ci) => (
                <th
                  key={ci}
                  className={`${ci === 0 ? "px-3" : "px-2"} py-2 font-mono text-chalk-400 ${col.align} ${col.key ? "cursor-pointer hover:text-chalk-200 select-none transition-colors" : ""}`}
                  onClick={col.key ? () => handleSort(col.key as SortKey) : undefined}
                >
                  {col.label}
                  {col.key && sortKey === col.key && (
                    <span className="ml-0.5 text-grass-500">{sortAsc ? "\u25B2" : "\u25BC"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => {
              const passAcc = p.passes > 0 ? ((p.passes_completed / p.passes) * 100).toFixed(0) : "0";
              const pxg = playerXgMap.get(p.player_steam_id) || 0;
              const dist = p.distance_run > 0 ? (p.distance_run / 1000).toFixed(2) + "km" : "-";

              const cellValue = (key: SortKey | null): React.ReactNode => {
                switch (key) {
                  case "goals": return <span className={p.goals > 0 ? "text-grass-400 font-medium" : "text-chalk-400"}>{p.goals}</span>;
                  case "assists": return <span className={p.assists > 0 ? "text-grass-400" : "text-chalk-400"}>{p.assists}</span>;
                  case "second_assists": return <span className="text-chalk-300">{p.second_assists}</span>;
                  case "shots": return <span className="text-chalk-300">{p.shots}</span>;
                  case "shots_on_target": return <span className="text-chalk-300">{p.shots_on_target}</span>;
                  case "passes": return <span className="text-chalk-300">{p.passes}</span>;
                  case "passes_completed": return <span className="text-chalk-300">{p.passes_completed}</span>;
                  case "pass_pct": return <span className="text-chalk-300">{passAcc}%</span>;
                  case "key_passes": return <span className="text-chalk-300">{p.key_passes}</span>;
                  case "chances_created": return <span className="text-chalk-300">{p.chances_created}</span>;
                  case "interceptions": return <span className="text-chalk-300">{p.interceptions}</span>;
                  case "saves": return <span className={p.saves > 0 ? "text-amber-400" : "text-chalk-400"}>{p.saves > 0 ? p.saves : p.position === "GK" ? "0" : "-"}</span>;
                  case "offsides": return <span className="text-chalk-300">{p.offsides}</span>;
                  case "distance_run": return <span className="text-chalk-300">{dist}</span>;
                  case "fouls": return <span className="text-chalk-300">{p.fouls}</span>;
                  case "fouls_suffered": return <span className="text-chalk-300">{p.fouls_suffered}</span>;
                  case "own_goals": return <span className={p.own_goals > 0 ? "text-red-400" : "text-chalk-400"}>{p.own_goals}</span>;
                  case "goals_conceded": return <span className="text-chalk-300">{p.goals_conceded}</span>;
                  case "corners": return <span className="text-chalk-300">{p.corners}</span>;
                  case "throw_ins": return <span className="text-chalk-300">{p.throw_ins}</span>;
                  case "free_kicks": return <span className="text-chalk-300">{p.free_kicks}</span>;
                  case "goal_kicks": return <span className="text-chalk-300">{p.goal_kicks}</span>;
                  case "penalties": return <span className="text-chalk-300">{p.penalties}</span>;
                  case "yellow_cards": return <span className={p.yellow_cards > 0 ? "text-yellow-400" : "text-chalk-400"}>{p.yellow_cards}</span>;
                  case "red_cards": return <span className={p.red_cards > 0 ? "text-red-400" : "text-chalk-400"}>{p.red_cards}</span>;
                  case "xg": return <span className={pxg > 0 ? "text-grass-500/80" : "text-chalk-400"}>{pxg > 0 ? pxg.toFixed(2) : "-"}</span>;
                  default: return null;
                }
              };

              return (
                <tr key={p.player_steam_id} className={idx % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}>
                  <td className="px-3 py-2">
                    <Link href={`/players/${p.player_steam_id}`} className="font-body font-medium text-chalk-100 hover:text-grass-400 transition-colors">
                      {p.username}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="text-[10px] font-mono text-chalk-400 bg-pitch-800 px-1.5 py-0.5 rounded">{p.position || "-"}</span>
                  </td>
                  {cols.slice(2).map((col, ci) => (
                    <td key={ci} className="px-2 py-2 text-right font-mono">{cellValue(col.key)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
