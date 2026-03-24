"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { MatchPlayer, MatchShot } from "./page";

type TeamInfo = { id: number; name: string; logo: string | null; color: string | null };

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

  const homeGoals = shots.filter((s) => s.team_side === "home" && s.is_goal).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  const awayGoals = shots.filter((s) => s.team_side === "away" && s.is_goal).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  const timeline = useMemo(() => {
    return [...shots].filter((s) => s.minute != null).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  }, [shots]);

  const hT = (key: keyof MatchPlayer) => homePlayers.reduce((s, p) => s + Number(p[key] || 0), 0);
  const aT = (key: keyof MatchPlayer) => awayPlayers.reduce((s, p) => s + Number(p[key] || 0), 0);

  // Find GKs for save attribution
  const homeGk = homePlayers.find((p) => (p.position || "").toUpperCase() === "GK");
  const awayGk = awayPlayers.find((p) => (p.position || "").toUpperCase() === "GK");

  // Possession: compute as % of total so they sum to 100%
  const rawHomePoss = hT("possession");
  const rawAwayPoss = aT("possession");
  const totalPoss = rawHomePoss + rawAwayPoss;
  const homePossPct = totalPoss > 0 ? (rawHomePoss / totalPoss) * 100 : 50;
  const awayPossPct = totalPoss > 0 ? (rawAwayPoss / totalPoss) * 100 : 50;


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

        <div className="flex items-center justify-center gap-8 md:gap-14">
          <div className="text-right flex-1">
            <Link href={`/teams/${match.homeTeam.id}`} className="group inline-flex flex-col items-end gap-3">
              {match.homeTeam.logo && <img src={match.homeTeam.logo} alt="" className="w-20 h-20 md:w-28 md:h-28 object-contain" />}
              <span className="font-display font-800 text-xl md:text-2xl text-chalk-100 group-hover:text-grass-400 transition-colors">{match.homeTeam.name}</span>
            </Link>
          </div>
          <div className="font-display font-900 text-5xl md:text-7xl flex items-center gap-4 shrink-0">
            <span className={match.homeScore > match.awayScore ? "text-grass-500" : "text-chalk-200"}>{match.homeScore}</span>
            <span className="text-chalk-400/30 text-2xl md:text-3xl">-</span>
            <span className={match.awayScore > match.homeScore ? "text-grass-500" : "text-chalk-200"}>{match.awayScore}</span>
          </div>
          <div className="flex-1">
            <Link href={`/teams/${match.awayTeam.id}`} className="group inline-flex flex-col items-start gap-3">
              {match.awayTeam.logo && <img src={match.awayTeam.logo} alt="" className="w-20 h-20 md:w-28 md:h-28 object-contain" />}
              <span className="font-display font-800 text-xl md:text-2xl text-chalk-100 group-hover:text-grass-400 transition-colors">{match.awayTeam.name}</span>
            </Link>
          </div>
        </div>

        {/* Goal scorers */}
        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <div className="flex items-start justify-center gap-4 md:gap-8 mt-4">
            <div className="flex-1 text-right">
              <div className="text-xs font-mono text-chalk-300 space-y-0.5">
                {homeGoals.map((g, i) => <div key={i}>{g.username} ({g.minute}&apos;)</div>)}
              </div>
            </div>
            <div className="shrink-0 w-16 text-center"><span className="text-[10px] font-mono text-chalk-400">FT</span></div>
            <div className="flex-1 text-left">
              <div className="text-xs font-mono text-chalk-300 space-y-0.5">
                {awayGoals.map((g, i) => <div key={i}>{g.username} ({g.minute}&apos;)</div>)}
              </div>
            </div>
          </div>
        )}

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
          <div className="text-center mt-4"><span className="text-xs font-mono text-amber-400">POTM: {match.potm}</span></div>
        )}
      </div>

      {/* Lineups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <LineupGraphic players={homePlayers} teamName={match.homeTeam.name} teamLogo={match.homeTeam.logo} teamColor={match.homeTeam.color} />
        <LineupGraphic players={awayPlayers} teamName={match.awayTeam.name} teamLogo={match.awayTeam.logo} teamColor={match.awayTeam.color} />
      </div>

      {/* Horizontal shot map — full width */}
      <div className="mb-6">
        <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">
          SHOT MAP <span className="text-xs text-grass-500 font-mono">· xG by IOStats</span>
        </h2>
        <div className="relative rounded-lg border border-chalk-100/8 overflow-hidden" style={{ aspectRatio: "105 / 50" }}>
          <div className="absolute inset-0 bg-[#0d1f0d]">
            {/* Horizontal pitch SVG stretched to fill */}
            <svg viewBox="0 0 105 68" className="w-full h-full" preserveAspectRatio="none">
              <rect x="0" y="0" width="105" height="68" fill="#0d1f0d" />
              {[0, 15, 30, 45, 60, 75, 90].map((x) => (
                <rect key={x} x={x} y="0" width="7.5" height="68" fill="rgba(255,255,255,0.015)" />
              ))}
              {/* Outer boundary */}
              <rect x="4" y="4" width="97" height="60" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
              {/* Center line */}
              <line x1="52.5" y1="4" x2="52.5" y2="64" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
              {/* Center circle */}
              <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
              <circle cx="52.5" cy="34" r="0.7" fill="rgba(255,255,255,0.3)" />
              {/* Left penalty box */}
              <rect x="4" y="14" width="16.5" height="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
              <rect x="4" y="22" width="5.5" height="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
              <circle cx="15" cy="34" r="0.5" fill="rgba(255,255,255,0.25)" />
              {/* Right penalty box */}
              <rect x="84.5" y="14" width="16.5" height="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
              <rect x="95.5" y="22" width="5.5" height="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
              <circle cx="90" cy="34" r="0.5" fill="rgba(255,255,255,0.25)" />
              {/* Goals */}
              <rect x="2" y="26" width="2" height="16" fill="rgba(255,255,255,0.35)" rx="0.5" />
              <rect x="101" y="26" width="2" height="16" fill="rgba(255,255,255,0.35)" rx="0.5" />
            </svg>
            {/* Team logos inside field, bottom near center line */}
            <div className="absolute" style={{ left: "40%", bottom: "8%", transform: "translateX(-50%)" }}>
              {match.homeTeam.logo ? (
                <img src={match.homeTeam.logo} alt="" className="w-28 h-28 md:w-40 md:h-40 object-contain opacity-20" />
              ) : (
                <span className="text-3xl font-display font-bold text-chalk-100/15">{match.homeTeam.name.slice(0, 3).toUpperCase()}</span>
              )}
            </div>
            <div className="absolute" style={{ left: "60%", bottom: "8%", transform: "translateX(-50%)" }}>
              {match.awayTeam.logo ? (
                <img src={match.awayTeam.logo} alt="" className="w-28 h-28 md:w-40 md:h-40 object-contain opacity-20" />
              ) : (
                <span className="text-3xl font-display font-bold text-chalk-100/15">{match.awayTeam.name.slice(0, 3).toUpperCase()}</span>
              )}
            </div>
            {/* Shot markers — horizontal: x maps to left-right, y maps to top-bottom */}
            {shots.map((s, i) => {
              // For horizontal: normalized_y becomes x (0=home goal left, 1=away goal right)
              // normalized_x becomes y (sideline)
              const px = Math.max(4, Math.min(96, s.normalized_y * 92 + 4));
              const py = Math.max(6, Math.min(94, s.normalized_x * 88 + 6));
              const isSelected = selectedShot === i;
              let emoji: string;
              if (s.is_goal) emoji = "\u26BD";
              else if (s.is_save) emoji = "\u{1F9E4}";
              else emoji = "\u274C";
              return (
                <button
                  key={i}
                  onClick={() => setSelectedShot(isSelected ? null : i)}
                  className={`absolute transition-all cursor-pointer select-none ${isSelected ? "z-20" : ""}`}
                  style={{
                    left: `${px}%`,
                    top: `${py}%`,
                    transform: `translate(-50%, -50%)${isSelected ? " scale(1.3)" : ""}`,
                    opacity: selectedShot !== null && !isSelected ? 0.4 : 1,
                    fontSize: "22px",
                    lineHeight: 1,
                  }}
                  title={`${s.is_goal ? `Goal by ${s.username}` : s.is_save ? `Shot by ${s.username}, Saved by ${s.team_side === "home" ? (awayGk?.username || "GK") : (homeGk?.username || "GK")}` : `Missed by ${s.username}`} (xG: ${s.xg.toFixed(2)})`}
                >
                  {emoji}
                </button>
              );
            })}
            {/* Tooltip */}
            {selectedShot !== null && shots[selectedShot] && (() => {
              const s = shots[selectedShot];
              const px = Math.max(4, Math.min(96, s.normalized_y * 92 + 4));
              const py = Math.max(6, Math.min(94, s.normalized_x * 88 + 6));
              const above = py > 50;
              return (
                <div className="absolute z-30 pointer-events-none" style={{
                  left: `${px}%`,
                  top: above ? `calc(${py}% - 12px)` : `calc(${py}% + 12px)`,
                  transform: `translate(-50%, ${above ? "-100%" : "0"})`,
                }}>
                  <div className="bg-pitch-950/95 border border-chalk-100/15 rounded-lg px-3 py-2 text-xs font-mono whitespace-nowrap shadow-lg">
                    <div className="font-medium text-chalk-100">{s.username}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={s.is_goal ? "text-green-400" : s.is_save ? "text-amber-400" : "text-red-400"}>
                        {s.is_goal ? "Goal" : s.is_save ? "Saved" : "Missed"}
                      </span>
                      <span className="text-chalk-400">xG: {s.xg.toFixed(2)}</span>
                      {s.minute != null && <span className="text-chalk-400">{s.minute}&apos;</span>}
                    </div>
                    {s.is_save && (
                      <div className="text-chalk-400 mt-0.5">
                        Shot by {s.username} · Saved by {s.team_side === "home" ? (awayGk?.username || "GK") : (homeGk?.username || "GK")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs font-mono text-chalk-400">
          <span className="flex items-center gap-1.5"><span>⚽</span> Goal</span>
          <span className="flex items-center gap-1.5"><span>🧤</span> Save</span>
          <span className="flex items-center gap-1.5"><span>❌</span> Miss</span>
          <span className="text-chalk-400/40 ml-2">Click for details</span>
        </div>
      </div>

      {/* H2H centered + Highlights on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <H2HStats
            homeName={match.homeTeam.name} homeLogo={match.homeTeam.logo} homeColor={match.homeTeam.color}
            awayName={match.awayTeam.name} awayLogo={match.awayTeam.logo} awayColor={match.awayTeam.color}
            rows={[
              { label: "Possession", home: homePossPct, away: awayPossPct, pct: true },
              { label: "Shots", home: hT("shots"), away: aT("shots") },
              { label: "Shots on Goal", home: hT("shots_on_target"), away: aT("shots_on_target") },
              { label: "Saves", home: hT("saves"), away: aT("saves") },
              { label: "Passes", home: hT("passes"), away: aT("passes") },
              { label: "Passes Completed", home: hT("passes_completed"), away: aT("passes_completed") },
              { label: "Interceptions", home: hT("interceptions"), away: aT("interceptions") },
              { label: "Corners", home: hT("corners"), away: aT("corners") },
              { label: "Fouls", home: hT("fouls"), away: aT("fouls") },
              { label: "Offsides", home: hT("offsides"), away: aT("offsides") },
              { label: "Yellow Cards", home: hT("yellow_cards"), away: aT("yellow_cards") },
              { label: "Red Cards", home: hT("red_cards"), away: aT("red_cards") },
            ]}
            homeXg={homeXg} awayXg={awayXg}
            homePassAcc={hT("passes") > 0 ? (hT("passes_completed") / hT("passes")) * 100 : 0}
            awayPassAcc={aT("passes") > 0 ? (aT("passes_completed") / aT("passes")) * 100 : 0}
            homeShotAcc={hT("shots") > 0 ? (hT("shots_on_target") / hT("shots")) * 100 : 0}
            awayShotAcc={aT("shots") > 0 ? (aT("shots_on_target") / aT("shots")) * 100 : 0}
          />
        </div>
        {/* Game Highlights on right — same height as H2H */}
        {timeline.length > 0 && (
          <div className="flex flex-col">
            <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">GAME HIGHLIGHTS</h2>
            <div className="bg-pitch-900/40 rounded-lg border border-chalk-100/8 divide-y divide-chalk-100/5 overflow-y-auto flex-1">
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
                      <img src={(isHome ? match.homeTeam.logo : match.awayTeam.logo)!} alt="" className="w-4 h-4 object-contain opacity-50 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

/* ─── H2H Stats ─── */
function H2HStats({
  homeName, homeLogo, homeColor, awayName, awayLogo, awayColor, rows, homeXg, awayXg,
  homePassAcc, awayPassAcc, homeShotAcc, awayShotAcc,
}: {
  homeName: string; homeLogo: string | null; homeColor: string | null;
  awayName: string; awayLogo: string | null; awayColor: string | null;
  rows: { label: string; home: number; away: number; pct?: boolean }[];
  homeXg: number; awayXg: number;
  homePassAcc: number; awayPassAcc: number;
  homeShotAcc: number; awayShotAcc: number;
}) {
  const hCol = homeColor || "#ef4444";
  const aCol = awayColor || "#3b82f6";
  return (
    <div>
      <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">HEAD TO HEAD</h2>
      <div className="bg-pitch-900/40 rounded-lg border border-chalk-100/8 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {homeLogo && <img src={homeLogo} alt="" className="w-10 h-10 object-contain" />}
            <span className="font-display font-700 text-lg text-chalk-100">{homeName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display font-700 text-lg text-chalk-100">{awayName}</span>
            {awayLogo && <img src={awayLogo} alt="" className="w-10 h-10 object-contain" />}
          </div>
        </div>
        <div className="flex justify-between items-center mb-6 px-2">
          <div className="flex gap-6">
            <AccuracyCircle value={homeShotAcc} label="Shot Acc" color={hCol} />
            <AccuracyCircle value={homePassAcc} label="Pass Acc" color={hCol} />
          </div>
          <div className="flex gap-6">
            <AccuracyCircle value={awayShotAcc} label="Shot Acc" color={aCol} />
            <AccuracyCircle value={awayPassAcc} label="Pass Acc" color={aCol} />
          </div>
        </div>
        <div className="space-y-4">
          {rows.map((r) => {
            const total = r.home + r.away;
            const homePct = total > 0 ? (r.home / total) * 100 : 50;
            const awayPct = total > 0 ? (r.away / total) * 100 : 50;
            const homeDisplay = r.pct ? `${Math.round(r.home)}%` : r.home.toString();
            const awayDisplay = r.pct ? `${Math.round(r.away)}%` : r.away.toString();
            return (
              <div key={r.label}>
                <div className="text-center text-[11px] font-mono text-chalk-400 uppercase tracking-wider mb-1.5">{r.label}</div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-bold w-12 text-right" style={{ color: hCol }}>{homeDisplay}</span>
                  <div className="flex-1 flex h-3.5 rounded-full overflow-hidden bg-pitch-700">
                    <div className="transition-all rounded-l-full" style={{ width: `${homePct}%`, backgroundColor: hCol }} />
                    <div className="transition-all rounded-r-full" style={{ width: `${awayPct}%`, backgroundColor: aCol }} />
                  </div>
                  <span className="text-sm font-mono font-bold w-12 text-left" style={{ color: aCol }}>{awayDisplay}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AccuracyCircle({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 38 38)" />
        <text x="38" y="38" textAnchor="middle" dominantBaseline="central"
          fill="white" fontSize="14" fontFamily="monospace" fontWeight="bold">{value.toFixed(0)}%</text>
      </svg>
      <span className="text-[10px] font-mono text-chalk-400 uppercase">{label}</span>
    </div>
  );
}

/* ─── Lineup Player Card ─── */
function PlayerCard({ p, shirtColor, isSub }: { p: MatchPlayer; shirtColor: string; isSub?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 w-16 md:w-20">
      <div className="relative">
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-md border border-white/10 ${isSub ? "opacity-70" : ""}`}
          style={{ backgroundColor: shirtColor }}>
          {p.position || "?"}
        </div>
        {/* Goals top-right */}
        {p.goals > 0 && (
          <span className="absolute -top-2.5 -right-3 flex items-center gap-px text-[11px] leading-none drop-shadow-md">
            <span className="text-sm">⚽</span><span className="text-white font-bold">{p.goals}</span>
          </span>
        )}
        {/* Assists top-left */}
        {p.assists > 0 && (
          <span className="absolute -top-2.5 -left-3 flex items-center gap-px text-[11px] leading-none drop-shadow-md">
            <span className="text-sm">👟</span><span className="text-white font-bold">{p.assists}</span>
          </span>
        )}
        {p.yellow_cards > 0 && <span className="absolute -bottom-1 -right-1 text-xs leading-none">🟨</span>}
        {p.red_cards > 0 && <span className="absolute -bottom-1 -left-1 text-xs leading-none">🟥</span>}
      </div>
      <Link href={`/players/${p.player_steam_id}`}
        className={`text-[10px] md:text-xs font-mono text-center truncate w-full hover:text-grass-400 transition-colors drop-shadow-md ${isSub ? "text-white/60" : "text-white"}`}>
        {p.username}
      </Link>
    </div>
  );
}

/* ─── Lineup Graphic ─── */
function LineupGraphic({
  players, teamName, teamLogo, teamColor,
}: {
  players: MatchPlayer[]; teamName: string; teamLogo: string | null; teamColor: string | null;
}) {
  const gk: MatchPlayer[] = [];
  const def: MatchPlayer[] = [];
  const mid: MatchPlayer[] = [];
  const att: MatchPlayer[] = [];

  // Sort by possession desc so starters (more playing time) come first
  const sorted = [...players].sort((a, b) => b.possession - a.possession);

  for (const p of sorted) {
    const pos = (p.position || "CM").toUpperCase();
    if (pos === "GK") gk.push(p);
    else if (["LB", "CB", "RB"].includes(pos)) def.push(p);
    else if (["CM", "CDM", "CAM", "LM", "RM"].includes(pos)) mid.push(p);
    else att.push(p);
  }

  const posOrderDef = ["LB", "CB", "RB"];
  const posOrderAtt = ["LW", "CF", "RW", "ST", "CAM"];

  // Split starters vs subs per group (3 att, 1 mid, 3 def, 1 gk)
  const attStarters = att.slice(0, 3).sort((a, b) => posOrderAtt.indexOf((a.position || "CF").toUpperCase()) - posOrderAtt.indexOf((b.position || "CF").toUpperCase()));
  const midStarters = mid.slice(0, 1);
  const defStarters = def.slice(0, 3).sort((a, b) => posOrderDef.indexOf((a.position || "CB").toUpperCase()) - posOrderDef.indexOf((b.position || "CB").toUpperCase()));
  const gkStarters = gk.slice(0, 1);

  const subs = [...att.slice(3), ...mid.slice(1), ...def.slice(3), ...gk.slice(1)];

  const formation = [attStarters, midStarters, defStarters, gkStarters];
  const shirtColor = teamColor || "#8b0000";

  return (
    <div className="bg-pitch-900/40 border border-chalk-100/8 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-chalk-100/8">
        {teamLogo && <img src={teamLogo} alt="" className="w-6 h-6 object-contain" />}
        <span className="font-display font-700 text-chalk-100 uppercase tracking-wider">{teamName}</span>
      </div>
      <div className="relative bg-[#1a5e1a] p-4" style={{ height: "400px" }}>
        <div className="absolute inset-4 border border-white/20 rounded" />
        <div className="absolute left-4 right-4 top-1/2 -translate-y-px h-px bg-white/15" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-white/15 rounded-full" />
        <div className="relative flex flex-col justify-between h-full py-6">
          {formation.map((row, rowIdx) => (
            <div key={rowIdx} className="flex justify-center items-center gap-6 md:gap-10">
              {row.map((p) => (
                <PlayerCard key={p.player_steam_id} p={p} shirtColor={shirtColor} />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Substitutes */}
      {subs.length > 0 && (
        <div className="px-4 py-3 border-t border-chalk-100/8 bg-pitch-900/60">
          <div className="text-[10px] font-mono text-chalk-400 uppercase tracking-wider mb-2">Subs</div>
          <div className="flex flex-wrap gap-4">
            {subs.map((p) => (
              <PlayerCard key={p.player_steam_id} p={p} shirtColor={shirtColor} isSub />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sortable Player Stats Table with row hover ─── */
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
    } else { setSortKey(key); setSortAsc(false); }
  };

  const playerXgMap = new Map<string, number>();
  for (const s of shots) playerXgMap.set(s.player_steam_id, (playerXgMap.get(s.player_steam_id) || 0) + s.xg);

  const getPassPct = (p: MatchPlayer) => p.passes > 0 ? (p.passes_completed / p.passes) * 100 : 0;

  const sorted = [...team.players].sort((a, b) => {
    if (!sortKey) return 0;
    let av: number, bv: number;
    if (sortKey === "xg") { av = playerXgMap.get(a.player_steam_id) || 0; bv = playerXgMap.get(b.player_steam_id) || 0; }
    else if (sortKey === "pass_pct") { av = getPassPct(a); bv = getPassPct(b); }
    else { av = Number(a[sortKey] || 0); bv = Number(b[sortKey] || 0); }
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
        <button onClick={() => setShowMore(!showMore)}
          className="text-xs font-mono text-grass-500 hover:text-grass-400 transition-colors cursor-pointer">
          {showMore ? "SHOW FEWER STATS" : "SHOW MORE STATS"}
        </button>
      </div>
      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-chalk-100/8">
              {cols.map((col, ci) => (
                <th key={ci}
                  className={`${ci === 0 ? "px-3" : "px-2"} py-2 font-mono text-chalk-400 ${col.align} ${col.key ? "cursor-pointer hover:text-chalk-200 select-none transition-colors" : ""}`}
                  onClick={col.key ? () => handleSort(col.key as SortKey) : undefined}>
                  {col.label}
                  {col.key && sortKey === col.key && <span className="ml-0.5 text-grass-500">{sortAsc ? "\u25B2" : "\u25BC"}</span>}
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
                <tr key={p.player_steam_id}
                  className={`${idx % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"} hover:bg-chalk-100/8 transition-colors`}>
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
