"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { proxyImg } from "@/lib/img";

/* ── Types matching actual API response ──────────────────────────── */

interface BadgeImage {
  smallUrl: string;
  mediumUrl: string;
}

interface TeamInfo {
  id: number;
  name: string;
  teamCode: string;
  color: string;
  badgeImage: BadgeImage | null;
  inactive: boolean;
}

interface ServerInfo {
  id: number;
  name: string;
}

interface MatchEvent {
  second: number;
  event: string;
  period: string;
  team: string;
  player1SteamId: string;
  player1Name: string;
  player2SteamId: string;
  player2Name: string;
  bodyPart: number;
  startPosition: { x: number; y: number } | null;
}

interface PlayerSlot {
  position: string;
  name: string | null;
  steamId: string | null;
}

interface MatchMeta {
  id: number;
  teamHomeId: number;
  teamHome: TeamInfo;
  teamAwayId: number;
  teamAway: TeamInfo;
  serverId: number;
  server: ServerInfo;
  matchType: number; // 1 = Competition, 0 = Friendly
  format: number;
  tournamentId: number | null;
  createdDate: string;
}

interface LiveState {
  matchPeriod: string;
  startTime: number;
  matchSeconds: number;
  matchDisplaySeconds: string;
  mapName: string;
  serverPlayerCount: number;
  serverMaxPlayers: number;
  matchFormat: number;
  matchGoalsHome: number;
  matchGoalsAway: number;
  teamNameHome: string;
  teamNameAway: string;
  teamCodeHome: string;
  teamCodeAway: string;
  teamLineupHome: PlayerSlot[];
  teamLineupAway: PlayerSlot[];
  matchEvents: MatchEvent[];
  allPlayers: PlayerSlot[];
}

interface LiveMatch {
  item1: MatchMeta;
  item2: LiveState;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function periodLabel(period: string): string {
  const map: Record<string, string> = {
    "WARM-UP": "Warm-Up",
    "FIRST HALF": "First Half",
    "HALF TIME": "Half Time",
    "SECOND HALF": "Second Half",
    "FULL TIME": "Full Time",
    "EXTRA TIME FIRST HALF": "Extra Time 1H",
    "EXTRA TIME SECOND HALF": "Extra Time 2H",
    "PENALTIES": "Penalties",
  };
  return map[period] || period || "Warm-Up";
}

function periodColor(period: string): string {
  if (period === "FIRST HALF" || period === "SECOND HALF") return "text-grass-500";
  if (period === "HALF TIME") return "text-amber-400";
  if (period === "FULL TIME") return "text-chalk-400";
  return "text-chalk-400";
}

function isLivePeriod(period: string): boolean {
  return period === "FIRST HALF" || period === "SECOND HALF";
}

function matchTimeDisplay(displaySeconds: string, period: string): string {
  if (period === "WARM-UP") return "Pre-Match";
  if (period === "HALF TIME") return "HT";
  if (period === "FULL TIME") return "FT";
  return displaySeconds || "0:00";
}

const REFRESH_INTERVAL = 60_000;

/* ── Component ───────────────────────────────────────────────────── */

export default function LiveScoresPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [tabVisible, setTabVisible] = useState(true);
  const [hasLiveMatches, setHasLiveMatches] = useState(true);

  // Track tab visibility
  useEffect(() => {
    const onVisChange = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/live");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveMatch[] = await res.json();
      const list = Array.isArray(data) ? data : [];
      setMatches(list);
      setHasLiveMatches(list.length > 0);
      setError(null);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => { fetchLive(); }, [fetchLive]);

  // Fetch immediately when tab becomes visible again
  useEffect(() => {
    if (tabVisible && autoRefresh) fetchLive();
  }, [tabVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling interval — only when tab is visible and auto-refresh is on
  useEffect(() => {
    if (!autoRefresh || !tabVisible) return;
    const interval = hasLiveMatches ? REFRESH_INTERVAL : REFRESH_INTERVAL * 5;
    const id = setInterval(fetchLive, interval);
    return () => clearInterval(id);
  }, [fetchLive, autoRefresh, tabVisible, hasLiveMatches]);

  useEffect(() => {
    const id = setInterval(() => {
      if (lastUpdated) setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            LIVE SCORES
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            Europe region
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className="flex items-center gap-2 text-xs font-mono text-chalk-400 hover:text-chalk-100 transition-colors"
          >
            <span className={`inline-block w-2 h-2 rounded-full ${autoRefresh ? "bg-grass-500 animate-pulse" : "bg-chalk-400/30"}`} />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </button>
          <button
            onClick={fetchLive}
            className="text-xs font-mono px-2.5 py-1 rounded border border-chalk-100/10 text-chalk-400 hover:text-chalk-100 hover:border-chalk-100/30 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-[11px] font-mono text-chalk-400/60 mb-4">
          Last updated {secondsAgo}s ago
        </p>
      )}

      {loading && (
        <div className="text-center py-20">
          <div className="inline-block w-6 h-6 border-2 border-[#F4119E] border-t-transparent rounded-full animate-spin" />
          <p className="text-chalk-400 font-body text-sm mt-3">Fetching live scores...</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm font-body text-red-400">
          Failed to load live scores: {error}
        </div>
      )}

      {!loading && !error && matches.length === 0 && (
        <div className="text-center py-20">
          <div className="text-4xl mb-3 opacity-30">&#9917;</div>
          <p className="text-chalk-400 font-body">No live matches right now</p>
          <p className="text-chalk-400/50 font-mono text-xs mt-2">Check back later or enable auto-refresh</p>
        </div>
      )}

      {!loading && !error && matches.length > 0 && (
        <div className="grid gap-4">
          {matches.map((m) => {
            const meta = m.item1;
            const live = m.item2;
            const homeBadge = meta.teamHome.badgeImage?.mediumUrl
              ? proxyImg(meta.teamHome.badgeImage.mediumUrl)
              : null;
            const awayBadge = meta.teamAway.badgeImage?.mediumUrl
              ? proxyImg(meta.teamAway.badgeImage.mediumUrl)
              : null;
            const isLive = isLivePeriod(live.matchPeriod);
            const isExpanded = expandedMatch === meta.id;
            const isTournament = meta.tournamentId != null;

            // Filter goal events for display
            const goalEvents = live.matchEvents.filter((e) => e.event === "GOAL");

            return (
              <div
                key={meta.id}
                className="rounded-lg border border-chalk-100/8 bg-pitch-900/60 overflow-hidden cursor-pointer hover:border-[#F4119E]/30 hover:bg-[#F4119E]/3 transition-colors"
                onClick={() => setExpandedMatch(isExpanded ? null : meta.id)}
              >
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-pitch-800/60 border-b border-chalk-100/5">
                  <div className="flex items-center gap-2">
                    {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-grass-500 animate-pulse" />}
                    <span className={`text-xs font-mono font-700 uppercase tracking-wide ${periodColor(live.matchPeriod)}`}>
                      {matchTimeDisplay(live.matchDisplaySeconds, live.matchPeriod)}
                    </span>
                    {isLive && (
                      <span className={`text-[10px] font-mono ${periodColor(live.matchPeriod)}`}>
                        {periodLabel(live.matchPeriod)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isTournament ? "text-amber-400 bg-amber-400/10" : "text-chalk-400 bg-pitch-800"
                    }`}>
                      {isTournament ? "Competition" : "Friendly"}
                    </span>
                    <span className="text-[10px] font-mono text-chalk-400 bg-pitch-800 px-1.5 py-0.5 rounded">
                      {live.matchFormat}v{live.matchFormat}
                    </span>
                  </div>
                </div>

                {/* Score area */}
                <div className="flex items-center justify-center px-4 py-6">
                  {/* Home: logo + name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                    {homeBadge ? (
                      <img src={homeBadge} alt={meta.teamHome.name} className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0" />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded bg-pitch-700 flex items-center justify-center text-xs font-display font-700 text-chalk-300 shrink-0">
                        {live.teamCodeHome}
                      </div>
                    )}
                    <span className="font-body text-sm text-chalk-100 text-right leading-tight truncate">
                      {meta.teamHome.name}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-4 shrink-0 mx-6 sm:mx-10">
                    <span className="font-display font-800 text-5xl sm:text-6xl tabular-nums text-chalk-100">
                      {live.matchGoalsHome}
                    </span>
                    <span className="text-chalk-400/30 font-display text-3xl">:</span>
                    <span className="font-display font-800 text-5xl sm:text-6xl tabular-nums text-chalk-100">
                      {live.matchGoalsAway}
                    </span>
                  </div>

                  {/* Away: name + logo */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-body text-sm text-chalk-100 leading-tight truncate">
                      {meta.teamAway.name}
                    </span>
                    {awayBadge ? (
                      <img src={awayBadge} alt={meta.teamAway.name} className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0" />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded bg-pitch-700 flex items-center justify-center text-xs font-display font-700 text-chalk-300 shrink-0">
                        {live.teamCodeAway}
                      </div>
                    )}
                  </div>
                </div>

                {/* Goal scorers summary */}
                {goalEvents.length > 0 && (
                  <div className="px-4 pb-3 flex flex-col gap-1">
                    {goalEvents.map((g, i) => {
                      const min = Math.floor(g.second / 60);
                      const isHome = g.team === "home";
                      return (
                        <div key={i} className={`flex items-center gap-2 text-xs font-mono ${isHome ? "justify-start" : "justify-end"}`}>
                          {isHome && <span className="text-grass-400">&#9917;</span>}
                          <span className="text-chalk-300">
                            {g.player1Name} {min}&apos;
                          </span>
                          {g.player2Name && <span className="text-chalk-400/60">(ast. {g.player2Name})</span>}
                          {!isHome && <span className="text-grass-400">&#9917;</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-chalk-100/5 bg-pitch-800/30 px-4 py-4">
                    {/* Lineups */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <h4 className="text-[10px] font-mono text-chalk-400 uppercase mb-2">{meta.teamHome.name}</h4>
                        <div className="space-y-1">
                          {live.teamLineupHome.filter(p => p.name).map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="font-body text-chalk-200">{p.name}</span>
                              <span className="font-mono text-chalk-400 text-[10px] bg-pitch-700 px-1.5 py-0.5 rounded">{p.position}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-mono text-chalk-400 uppercase mb-2">{meta.teamAway.name}</h4>
                        <div className="space-y-1">
                          {live.teamLineupAway.filter(p => p.name).map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="font-body text-chalk-200">{p.name}</span>
                              <span className="font-mono text-chalk-400 text-[10px] bg-pitch-700 px-1.5 py-0.5 rounded">{p.position}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Events timeline */}
                    {live.matchEvents.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-mono text-chalk-400 uppercase mb-2">Match Events</h4>
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {live.matchEvents
                            .filter((e) => ["GOAL", "SAVE", "MISS", "YELLOW CARD", "RED CARD"].includes(e.event))
                            .map((e, i) => {
                              const min = Math.floor(e.second / 60);
                              const icon = e.event === "GOAL" ? "\u26BD" : e.event === "SAVE" ? "\u{1F9E4}" : e.event === "MISS" ? "\u274C" : e.event === "YELLOW CARD" ? "\u{1F7E8}" : e.event === "RED CARD" ? "\u{1F7E5}" : "\u2022";
                              return (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <span className="font-mono text-chalk-400 w-8 text-right shrink-0">{min}&apos;</span>
                                  <span>{icon}</span>
                                  <span className={`font-body ${e.event === "GOAL" ? "text-grass-400 font-medium" : "text-chalk-300"}`}>
                                    {e.player1Name}
                                  </span>
                                  {e.event === "GOAL" && e.player2Name && (
                                    <span className="text-chalk-400/60">(ast. {e.player2Name})</span>
                                  )}
                                  {e.event === "SAVE" && e.player2Name && (
                                    <span className="text-chalk-400/60">(shot: {e.player2Name})</span>
                                  )}
                                  {e.event !== "GOAL" && e.event !== "SAVE" && e.player2Name && (
                                    <span className="text-chalk-400/60">({e.player2Name})</span>
                                  )}
                                  <span className="text-chalk-400/40 ml-auto text-[10px] font-mono">{e.team}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Map + Server info */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-chalk-100/5 text-[10px] font-mono text-chalk-400/60">
                      <span>Map: {live.mapName}</span>
                      <span>Server: {meta.server.name}</span>
                      <span>Players: {live.serverPlayerCount}/{live.serverMaxPlayers}</span>
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
