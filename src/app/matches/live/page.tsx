"use client";

import { useEffect, useState, useCallback } from "react";
import { proxyImg } from "@/lib/img";

/* ── Types ─────────────────────────────────────────────────────────── */

interface TeamInfo {
  id: number;
  name: string;
  teamCode: string;
  color: string;
  badgeImage: { smallUrl: string } | null;
}

interface MatchInfo {
  id: number;
  teamHomeId: number;
  teamHome: TeamInfo;
  teamAwayId: number;
  teamAway: TeamInfo;
  matchType: number; // 0 = RankedFriendly, 1 = Competition
  format: number; // 8 = 8v8, 11 = 11v11
  serverName: string;
}

interface LiveData {
  matchDataToken: string | null;
  period: number; // 0=NotStarted 1=FirstHalf 2=HalfTime 3=SecondHalf 4=FullTime
  homeGoals: number;
  awayGoals: number;
}

interface LiveMatch {
  item1: MatchInfo;
  item2: LiveData;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

const PERIOD_LABELS: Record<number, string> = {
  0: "Not Started",
  1: "First Half",
  2: "Half Time",
  3: "Second Half",
  4: "Full Time",
};

function periodLabel(period: number) {
  return PERIOD_LABELS[period] ?? `Period ${period}`;
}

function matchTypeLabel(type: number) {
  return type === 1 ? "Competition" : "Ranked Friendly";
}

function formatLabel(format: number) {
  return `${format}v${format}`;
}

function periodColor(period: number) {
  if (period === 1 || period === 3) return "text-grass-500"; // live
  if (period === 2) return "text-amber-400"; // half time
  if (period === 4) return "text-chalk-400"; // finished
  return "text-chalk-400";
}

const REFRESH_INTERVAL = 30_000;

/* ── Component ─────────────────────────────────────────────────────── */

export default function LiveScoresPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/live");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveMatch[] = await res.json();
      setMatches(Array.isArray(data) ? data : []);
      setError(null);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // initial + auto-refresh
  useEffect(() => {
    fetchLive();
    if (!autoRefresh) return;
    const id = setInterval(fetchLive, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchLive, autoRefresh]);

  // tick "seconds ago" counter
  useEffect(() => {
    const id = setInterval(() => {
      if (lastUpdated) {
        setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            LIVE SCORES
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            Europe region &middot; auto-refreshing every 30s
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className="flex items-center gap-2 text-xs font-mono text-chalk-400 hover:text-chalk-100 transition-colors"
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                autoRefresh ? "bg-grass-500 animate-pulse" : "bg-chalk-400/30"
              }`}
            />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </button>

          {/* Manual refresh */}
          <button
            onClick={fetchLive}
            className="text-xs font-mono px-2.5 py-1 rounded border border-chalk-100/10 text-chalk-400 hover:text-chalk-100 hover:border-chalk-100/30 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Updated indicator */}
      {lastUpdated && (
        <p className="text-[11px] font-mono text-chalk-400/60 mb-4">
          Last updated {secondsAgo}s ago
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-20">
          <div className="inline-block w-6 h-6 border-2 border-grass-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-chalk-400 font-body text-sm mt-3">
            Fetching live scores...
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm font-body text-red-400">
          Failed to load live scores: {error}
        </div>
      )}

      {/* No matches */}
      {!loading && !error && matches.length === 0 && (
        <div className="text-center py-20">
          <div className="text-4xl mb-3 opacity-30">&#9917;</div>
          <p className="text-chalk-400 font-body">
            No live matches right now
          </p>
          <p className="text-chalk-400/50 font-mono text-xs mt-2">
            Check back later or enable auto-refresh
          </p>
        </div>
      )}

      {/* Match cards */}
      {!loading && !error && matches.length > 0 && (
        <div className="grid gap-4">
          {matches.map((m) => {
            const match = m.item1;
            const live = m.item2;
            const homeBadge = match.teamHome.badgeImage?.smallUrl
              ? proxyImg(match.teamHome.badgeImage.smallUrl)
              : null;
            const awayBadge = match.teamAway.badgeImage?.smallUrl
              ? proxyImg(match.teamAway.badgeImage.smallUrl)
              : null;
            const isLive = live.period === 1 || live.period === 3;

            return (
              <div
                key={match.id}
                className="rounded-lg border border-chalk-100/8 bg-pitch-900/60 overflow-hidden"
              >
                {/* Top bar: period + meta */}
                <div className="flex items-center justify-between px-4 py-2 bg-pitch-800/60 border-b border-chalk-100/5">
                  <div className="flex items-center gap-2">
                    {isLive && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-grass-500 animate-pulse" />
                    )}
                    <span
                      className={`text-xs font-mono font-700 uppercase tracking-wide ${periodColor(
                        live.period,
                      )}`}
                    >
                      {periodLabel(live.period)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        match.matchType === 1
                          ? "text-amber-400 bg-amber-400/10"
                          : "text-chalk-400 bg-pitch-800"
                      }`}
                    >
                      {matchTypeLabel(match.matchType)}
                    </span>
                    <span className="text-[10px] font-mono text-chalk-400 bg-pitch-800 px-1.5 py-0.5 rounded">
                      {formatLabel(match.format)}
                    </span>
                  </div>
                </div>

                {/* Main score area */}
                <div className="flex items-center justify-center gap-4 sm:gap-8 px-4 py-6">
                  {/* Home team */}
                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    {homeBadge ? (
                      <img
                        src={homeBadge}
                        alt={match.teamHome.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded bg-pitch-700" />
                    )}
                    <span className="font-body text-sm text-chalk-100 text-center truncate max-w-[120px]">
                      {match.teamHome.name}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`font-display font-800 text-5xl sm:text-6xl tabular-nums ${
                        live.homeGoals > live.awayGoals
                          ? "text-grass-400"
                          : "text-chalk-100"
                      }`}
                    >
                      {live.homeGoals}
                    </span>
                    <span className="text-chalk-400/30 font-display text-3xl">
                      :
                    </span>
                    <span
                      className={`font-display font-800 text-5xl sm:text-6xl tabular-nums ${
                        live.awayGoals > live.homeGoals
                          ? "text-grass-400"
                          : "text-chalk-100"
                      }`}
                    >
                      {live.awayGoals}
                    </span>
                  </div>

                  {/* Away team */}
                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    {awayBadge ? (
                      <img
                        src={awayBadge}
                        alt={match.teamAway.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded bg-pitch-700" />
                    )}
                    <span className="font-body text-sm text-chalk-100 text-center truncate max-w-[120px]">
                      {match.teamAway.name}
                    </span>
                  </div>
                </div>

                {/* Footer: server name */}
                <div className="px-4 py-2 border-t border-chalk-100/5 bg-pitch-800/30">
                  <span className="text-[11px] font-mono text-chalk-400/50 truncate block">
                    {match.serverName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
