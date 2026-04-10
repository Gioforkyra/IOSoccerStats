"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect, useRef } from "react";
import type { Ref } from "react";
import type { MatchExtraEvent, MatchPlayer, MatchShot } from "./page";
import Jersey from "@/components/Jersey";

type MarkerType = "goal" | "save" | "miss" | "yellow_card" | "red_card" | "own_goal";

type TeamInfo = {
  id: number;
  name: string;
  logo: string | null;
  color: string | null;
  avgRating: number | null;
};

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

type SortKey = "goals" | "assists" | "second_assists" | "shots" | "shots_on_target" | "passes" | "passes_completed" | "pass_pct" | "key_passes" | "chances_created" | "interceptions" | "saves" | "offsides" | "fouls" | "fouls_suffered" | "yellow_cards" | "red_cards" | "own_goals" | "goals_conceded" | "corners" | "throw_ins" | "free_kicks" | "goal_kicks" | "penalties" | "distance_run" | "xg" | "possession";

type TeamAvgVisual = {
  badgeClass: string;
  hint: string | null;
};

function getTeamAvgVisuals(homeAvg: number | null, awayAvg: number | null): { home: TeamAvgVisual; away: TeamAvgVisual } {
  const neutral: TeamAvgVisual = {
    badgeClass: "border-slate-600/60 bg-slate-500/30 dark:border-slate-300/45 dark:bg-slate-300/20",
    hint: null,
  };

  if (homeAvg == null || awayAvg == null || !Number.isFinite(homeAvg) || !Number.isFinite(awayAvg)) {
    return { home: neutral, away: neutral };
  }

  const delta = Math.abs(homeAvg - awayAvg);
  const homeStronger = homeAvg > awayAvg;
  const awayStronger = awayAvg > homeAvg;

  if (delta >= 1) {
    return {
      home: {
        badgeClass: homeStronger
          ? "border-emerald-700/65 bg-emerald-600/30 dark:border-emerald-300/45 dark:bg-emerald-300/20"
          : "border-red-700/65 bg-red-600/30 dark:border-red-300/45 dark:bg-red-300/20",
        hint: homeStronger ? "Very likely to win" : null,
      },
      away: {
        badgeClass: awayStronger
          ? "border-emerald-700/65 bg-emerald-600/30 dark:border-emerald-300/45 dark:bg-emerald-300/20"
          : "border-red-700/65 bg-red-600/30 dark:border-red-300/45 dark:bg-red-300/20",
        hint: awayStronger ? "Very likely to win" : null,
      },
    };
  }

  if (delta >= 0.5) {
    return {
      home: {
        badgeClass: homeStronger
          ? "border-green-700/65 bg-green-600/30 dark:border-green-300/45 dark:bg-green-300/20"
          : "border-orange-700/65 bg-orange-600/30 dark:border-orange-300/45 dark:bg-orange-300/20",
        hint: homeStronger ? "Likely to win" : null,
      },
      away: {
        badgeClass: awayStronger
          ? "border-green-700/65 bg-green-600/30 dark:border-green-300/45 dark:bg-green-300/20"
          : "border-orange-700/65 bg-orange-600/30 dark:border-orange-300/45 dark:bg-orange-300/20",
        hint: awayStronger ? "Likely to win" : null,
      },
    };
  }

  return {
    home: {
      badgeClass: "border-amber-700/65 bg-amber-600/30 dark:border-amber-300/45 dark:bg-amber-300/20",
      hint: "Evenly Matched",
    },
    away: {
      badgeClass: "border-amber-700/65 bg-amber-600/30 dark:border-amber-300/45 dark:bg-amber-300/20",
      hint: "Evenly Matched",
    },
  };
}

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
  match, playerStats, shots, extraEvents,
}: {
  match: MatchInfo;
  playerStats: MatchPlayer[];
  shots: MatchShot[];
  extraEvents: MatchExtraEvent[];
}) {
  const [selectedMapEventId, setSelectedMapEventId] = useState<string | null>(null);
  const [lineupShowTitles, setLineupShowTitles] = useState(false);
  const [visibleMarkers, setVisibleMarkers] = useState<Record<MarkerType, boolean>>({
    goal: true,
    save: true,
    miss: true,
    yellow_card: true,
    red_card: true,
    own_goal: true,
  });
  const h2hCardRef = useRef<HTMLDivElement | null>(null);
  const [h2hCardHeight, setH2hCardHeight] = useState<number>(640);

  const homePlayers = playerStats.filter((p) => p.team_side === "home");
  const awayPlayers = playerStats.filter((p) => p.team_side === "away");
  // Find GKs for save attribution. This must be declared before timeline useMemo.
  const homeGk = homePlayers.find((p) => (p.position || "").toUpperCase() === "GK");
  const awayGk = awayPlayers.find((p) => (p.position || "").toUpperCase() === "GK");
  const getSaveKeeperName = (shot: MatchShot) =>
    shot.goalkeeper_username || (shot.team_side === "home" ? (awayGk?.username || "GK") : (homeGk?.username || "GK"));

  const homeXg = shots.filter((s) => s.team_side === "home").reduce((sum, s) => sum + s.xg, 0);
  const awayXg = shots.filter((s) => s.team_side === "away").reduce((sum, s) => sum + s.xg, 0);

  // Auto-detect attack direction: after second-half flip, compute mean ny for each team.
  // Home should appear on the LEFT of the shot map.
  // If home mean ny > 0.5, home attacks toward ny=1 → flip: px = (1-ny)*92+4 puts them left.
  // If home mean ny < 0.5, home attacks toward ny=0 → no flip: px = ny*92+4 puts them left.
  const shotMapFlip = (() => {
    const oriented = shots.map((s) => {
      const flip = s.period === "SECOND HALF";
      return { side: s.team_side, ny: flip ? 1 - s.normalized_y : s.normalized_y };
    });
    const homeShots = oriented.filter((s) => s.side === "home");
    if (homeShots.length === 0) return true; // default
    const homeMeanNy = homeShots.reduce((sum, s) => sum + s.ny, 0) / homeShots.length;
    return homeMeanNy > 0.5; // true = flip (home attacks right → show left)
  })();
  const serverFlag = match.server ? getServerFlag(match.server) : "";

  const homeGoals = shots.filter((s) => s.team_side === "home" && s.is_goal).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  const awayGoals = shots.filter((s) => s.team_side === "away" && s.is_goal).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  const timeline = useMemo(() => {
    const shotTimeline = shots
      .filter((s) => s.minute != null)
      .map((s, index) => ({
        id: `shot-${index}`,
        minute: s.minute,
        team_side: s.team_side,
        icon: s.is_goal ? "\u26BD" : s.is_save ? "\u{1F9E4}" : "\u274C",
        label: s.is_goal ? "GOAL" : s.is_save ? "SAVE" : "MISS",
        color: s.is_goal ? "text-green-400" : s.is_save ? "text-amber-400" : "text-red-400",
        actor: s.is_save ? getSaveKeeperName(s) : s.username,
        secondaryText: s.is_goal && s.assist_username
          ? `Assist by ${s.assist_username}`
          : s.is_save
            ? `Shot by ${s.username}`
            : null,
      }));

    const extraTimeline = extraEvents
      .map((ev, index) => ({
        id: `extra-${index}`,
        minute: ev.minute,
        team_side: ev.team_side,
        icon: ev.event_type === "OWN_GOAL" ? "\u26BD" : ev.event_type === "YELLOW_CARD" ? "\u{1F7E8}" : "\u{1F7E5}",
        label: ev.event_type === "OWN_GOAL" ? "OWN GOAL" : ev.event_type === "YELLOW_CARD" ? "YELLOW CARD" : "RED CARD",
        color: ev.event_type === "OWN_GOAL" ? "text-orange-400" : ev.event_type === "YELLOW_CARD" ? "text-yellow-400" : "text-red-400",
        actor: ev.username,
        secondaryText: null,
      }));

    return [...shotTimeline, ...extraTimeline].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
  }, [shots, extraEvents]);

  const mapEvents = useMemo(() => {
    const playerShotCenters = new Map<string, { x: number; y: number; n: number }>();
    for (const s of shots) {
      const curr = playerShotCenters.get(s.player_steam_id) || { x: 0, y: 0, n: 0 };
      curr.x += s.normalized_x;
      curr.y += s.normalized_y;
      curr.n += 1;
      playerShotCenters.set(s.player_steam_id, curr);
    }

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const spreadStep = (idx: number) => {
      if (idx <= 0) return 0;
      const n = Math.ceil(idx / 2);
      const sign = idx % 2 === 1 ? 1 : -1;
      return sign * n * 0.02;
    };
    const markerCounts = new Map<string, number>();

    const fallbackCoordsForEvent = (ev: MatchExtraEvent) => {
      const key = `${ev.player_steam_id || ev.username}|${ev.event_type}`;
      const currentCount = markerCounts.get(key) || 0;
      markerCounts.set(key, currentCount + 1);
      const dx = spreadStep(currentCount);
      const dy = spreadStep(currentCount + 1);

      if (ev.player_steam_id) {
        const center = playerShotCenters.get(ev.player_steam_id);
        if (center && center.n > 0) {
          return {
            x: clamp01(center.x / center.n + dx),
            y: clamp01(center.y / center.n + dy),
          };
        }
      }

      // Team-side fallback for events without coordinates/player shot samples.
      const baseY = ev.team_side === "home" ? 0.2 : 0.8;
      const baseX = ev.event_type === "YELLOW_CARD" ? 0.42 : ev.event_type === "RED_CARD" ? 0.5 : 0.58;
      return {
        x: clamp01(baseX + dx),
        y: clamp01(baseY + dy),
      };
    };

    const shotMapEvents = shots.map((s, index) => ({
      id: `shot-${index}`,
      kind: "shot" as const,
      team_side: s.team_side,
      minute: s.minute,
      period: s.period,
      normalized_x: s.normalized_x,
      normalized_y: s.normalized_y,
      shot: s,
      extra: null as MatchExtraEvent | null,
    }));

    const prelimExtras = extraEvents.map((ev, index) => {
      const hasNativeCoords = ev.normalized_x != null && ev.normalized_y != null;
      const resolved = hasNativeCoords
        ? { x: ev.normalized_x as number, y: ev.normalized_y as number }
        : fallbackCoordsForEvent(ev);
      return {
        ev,
        index,
        hasNativeCoords,
        x: resolved.x,
        y: resolved.y,
      };
    });

    const yellowByPlayer = new Map<string, Array<{ x: number; y: number; minute: number | null; period: "FIRST HALF" | "SECOND HALF" | null; index: number }>>();
    for (const item of prelimExtras) {
      if (item.ev.event_type !== "YELLOW_CARD") continue;
      const pid = item.ev.player_steam_id;
      if (!pid) continue;
      const arr = yellowByPlayer.get(pid) || [];
      arr.push({ x: item.x, y: item.y, minute: item.ev.minute, period: item.ev.period, index: item.index });
      yellowByPlayer.set(pid, arr);
    }
    for (const arr of yellowByPlayer.values()) {
      arr.sort((a, b) => {
        const am = a.minute ?? 999;
        const bm = b.minute ?? 999;
        if (am !== bm) return am - bm;
        return a.index - b.index;
      });
    }

    const redOffsetByPlayer = new Map<string, number>();
    const extraMapEvents = prelimExtras.map((item) => {
      let resolvedX = item.x;
      let resolvedY = item.y;
      let resolvedPeriod = item.ev.period;
      let resolvedMinute = item.ev.minute;

      // If red card has no native coordinates, pin it near the player's second yellow card.
      if (item.ev.event_type === "RED_CARD" && !item.hasNativeCoords && item.ev.player_steam_id) {
        const yellows = yellowByPlayer.get(item.ev.player_steam_id) || [];
        if (yellows.length > 0) {
          const anchor = yellows[Math.min(1, yellows.length - 1)];
          const redIdx = redOffsetByPlayer.get(item.ev.player_steam_id) || 0;
          redOffsetByPlayer.set(item.ev.player_steam_id, redIdx + 1);
          resolvedX = clamp01(anchor.x + 0.014 * (redIdx + 1));
          resolvedY = clamp01(anchor.y - 0.012 * (redIdx + 1));
          if (!resolvedPeriod) resolvedPeriod = anchor.period;
          if (resolvedMinute == null) resolvedMinute = anchor.minute;
        }
      }

      if (!resolvedPeriod && resolvedMinute != null) {
        resolvedPeriod = resolvedMinute >= 46 ? "SECOND HALF" : "FIRST HALF";
      }

      return {
        id: `extra-${item.index}`,
        kind: "extra" as const,
        team_side: item.ev.team_side,
        minute: resolvedMinute,
        period: resolvedPeriod,
        normalized_x: resolvedX,
        normalized_y: resolvedY,
        shot: null as MatchShot | null,
        extra: item.ev,
      };
    });

    return [...shotMapEvents, ...extraMapEvents];
  }, [shots, extraEvents]);

  const markerTypeForEvent = (evt: (typeof mapEvents)[number]): MarkerType => {
    if (evt.kind === "shot") {
      if (evt.shot!.is_goal) return "goal";
      if (evt.shot!.is_save) return "save";
      return "miss";
    }
    if (evt.extra!.event_type === "OWN_GOAL") return "own_goal";
    if (evt.extra!.event_type === "YELLOW_CARD") return "yellow_card";
    return "red_card";
  };

  const filteredMapEvents = useMemo(() => {
    return mapEvents.filter((evt) => visibleMarkers[markerTypeForEvent(evt)]);
  }, [mapEvents, visibleMarkers]);

  useEffect(() => {
    if (!selectedMapEventId) return;
    if (!filteredMapEvents.some((evt) => evt.id === selectedMapEventId)) {
      setSelectedMapEventId(null);
    }
  }, [filteredMapEvents, selectedMapEventId]);

  const hT = (key: keyof MatchPlayer) => homePlayers.reduce((s, p) => s + Number(p[key] || 0), 0);
  const aT = (key: keyof MatchPlayer) => awayPlayers.reduce((s, p) => s + Number(p[key] || 0), 0);

  // Possession: compute as % of total so they sum to 100%
  const rawHomePoss = hT("possession");
  const rawAwayPoss = aT("possession");
  const totalPoss = rawHomePoss + rawAwayPoss;
  const homePossPct = totalPoss > 0 ? (rawHomePoss / totalPoss) * 100 : 50;
  const awayPossPct = totalPoss > 0 ? (rawAwayPoss / totalPoss) * 100 : 50;

  useEffect(() => {
    const card = h2hCardRef.current;
    if (!card) return;

    const updateHeight = () => {
      const measured = card.getBoundingClientRect().height;
      if (measured > 0) setH2hCardHeight(Math.round(measured));
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  const avgVisuals = useMemo(
    () => getTeamAvgVisuals(match.homeTeam.avgRating, match.awayTeam.avgRating),
    [match.homeTeam.avgRating, match.awayTeam.avgRating]
  );


  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-chalk-400 mb-6">
        <Link href="/matches" className="hover:text-[#F4119E] transition-colors">Matches</Link>
        <span className="mx-2">/</span>
        <span className="text-chalk-200">Match #{match.id}</span>
      </div>

      {/* Score header */}
      <div className="bg-pitch-900/60 border border-chalk-100/8 rounded-xl p-6 md:p-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs font-mono text-chalk-400 mb-5">
          <span className="whitespace-nowrap">{match.date}{match.map && <> {" \u00B7 "}{match.map}</>}</span>
          {match.server && <span className="whitespace-nowrap">{serverFlag && <>{serverFlag} </>}{match.server}</span>}
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6">
          <Link href={`/teams/${match.homeTeam.id}`} className="group flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 justify-end min-w-0">
            {match.homeTeam.logo && <img src={match.homeTeam.logo} alt="" className="w-10 h-10 sm:w-16 sm:h-16 md:w-28 md:h-28 object-contain shrink-0" />}
            <span className="font-display font-800 text-sm sm:text-lg md:text-2xl text-chalk-100 group-hover:text-[#F4119E] transition-colors text-right truncate">{match.homeTeam.name}</span>
          </Link>
          <div className="font-display font-900 text-2xl sm:text-3xl md:text-5xl flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-chalk-100">{match.homeScore}</span>
            <span className="text-chalk-400/30 text-lg sm:text-xl md:text-2xl">:</span>
            <span className="text-chalk-100">{match.awayScore}</span>
          </div>
          <Link href={`/teams/${match.awayTeam.id}`} className="group flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
            <span className="font-display font-800 text-sm sm:text-lg md:text-2xl text-chalk-100 group-hover:text-[#F4119E] transition-colors truncate">{match.awayTeam.name}</span>
            {match.awayTeam.logo && <img src={match.awayTeam.logo} alt="" className="w-10 h-10 sm:w-16 sm:h-16 md:w-28 md:h-28 object-contain shrink-0" />}
          </Link>
        </div>

        {/* Goal scorers */}
        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <div className="flex items-start justify-center gap-2 sm:gap-4 md:gap-8 mt-4">
            <div className="flex-1 text-right min-w-0">
              <div className="text-[11px] sm:text-xs font-mono text-chalk-300 space-y-0.5">
                {homeGoals.map((g, i) => <div key={i} className="whitespace-nowrap">{g.username} ({g.minute}&apos;)</div>)}
              </div>
            </div>
            <div className="shrink-0 w-8 sm:w-16 text-center"><span className="text-[10px] font-mono text-chalk-400">FT</span></div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-[11px] sm:text-xs font-mono text-chalk-300 space-y-0.5">
                {awayGoals.map((g, i) => <div key={i} className="whitespace-nowrap">{g.username} ({g.minute}&apos;)</div>)}
              </div>
            </div>
          </div>
        )}

        {(homeXg > 0 || awayXg > 0) && (
          <div className="mt-5">
            <div className="flex justify-between text-xs font-mono mb-1">
              <span style={{ color: match.homeTeam.color || "#8ac5ff" }}>{homeXg.toFixed(1)} xG</span>
              <span style={{ color: match.awayTeam.color || "#ff8a8a" }}>{awayXg.toFixed(1)} xG</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-pitch-700">
              <div style={{ width: `${(homeXg / (homeXg + awayXg)) * 100}%`, backgroundColor: match.homeTeam.color || "#8ac5ff" }} />
              <div style={{ width: `${(awayXg / (homeXg + awayXg)) * 100}%`, backgroundColor: match.awayTeam.color || "#ff8a8a" }} />
            </div>
          </div>
        )}

        {match.potm && (
          <div className="text-center mt-4"><span className="text-xs font-mono text-amber-400">POTM: {playerStats.find((p) => p.profile_steam_id === match.potm || p.player_steam_id === match.potm)?.username ?? match.potm}</span></div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 shrink-0">LINEUPS</h2>
            {lineupShowTitles && (
              <span className="text-xs font-mono text-chalk-500">(titles to the right of each player)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-mono tracking-wider transition-colors ${!lineupShowTitles ? "text-[#F4119E] font-bold" : "text-chalk-500"}`}>Stats</span>
            <label className="lineup-switch">
              <input
                type="checkbox"
                checked={lineupShowTitles}
                onChange={() => setLineupShowTitles((v) => !v)}
                aria-label="Toggle titles"
              />
              <span className="lineup-slider" />
            </label>
            <span className={`text-sm font-mono tracking-wider transition-colors ${lineupShowTitles ? "text-[#F4119E] font-bold" : "text-chalk-500"}`}>Titles</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LineupGraphic players={homePlayers} teamName={match.homeTeam.name} teamLogo={match.homeTeam.logo} teamColor={match.homeTeam.color} showTitles={lineupShowTitles} shots={shots} potm={match.potm} totalPossession={playerStats.reduce((s, p) => s + p.possession, 0)} />
          <LineupGraphic players={awayPlayers} teamName={match.awayTeam.name} teamLogo={match.awayTeam.logo} teamColor={match.awayTeam.color} showTitles={lineupShowTitles} shots={shots} potm={match.potm} totalPossession={playerStats.reduce((s, p) => s + p.possession, 0)} />
        </div>
      </div>

      {/* Horizontal shot map ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â full width */}
      <div className="mb-6">
        <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">SHOT MAP</h2>
        <div className="relative rounded-lg border border-chalk-100/8 overflow-hidden" style={{ aspectRatio: "105 / 50" }}>
          <div
            className="absolute inset-0 bg-[#3d7a38]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 40px, transparent 40px, transparent 80px)",
            }}
          >
            {/* Horizontal pitch SVG stretched to fill */}
            <svg viewBox="0 0 105 68" className="w-full h-full" preserveAspectRatio="none">
              <rect x="0" y="0" width="105" height="68" fill="#3d7a38" fillOpacity="0.2" />
              {/* Outer boundary */}
              <rect x="4" y="4" width="97" height="60" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
              {/* Center line */}
              <line x1="52.5" y1="4" x2="52.5" y2="64" stroke="rgba(255,255,255,0.55)" strokeWidth="0.7" />
              {/* Center circle */}
              <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.7" />
              <circle cx="52.5" cy="34" r="0.7" fill="rgba(255,255,255,0.7)" />
              {/* Left penalty box */}
              <rect x="4" y="14" width="16.5" height="40" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.7" />
              <rect x="4" y="22" width="5.5" height="24" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="0.6" />
              <circle cx="15" cy="34" r="0.5" fill="rgba(255,255,255,0.55)" />
              {/* Right penalty box */}
              <rect x="84.5" y="14" width="16.5" height="40" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.7" />
              <rect x="95.5" y="22" width="5.5" height="24" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="0.6" />
              <circle cx="90" cy="34" r="0.5" fill="rgba(255,255,255,0.55)" />
              {/* Goals */}
              <rect x="2" y="26" width="2" height="16" fill="rgba(255,255,255,0.55)" rx="0.5" />
              <rect x="101" y="26" width="2" height="16" fill="rgba(255,255,255,0.55)" rx="0.5" />
            </svg>
            {/* Team logos inside field, bottom near center line */}
            {/* Home logo LEFT, away logo RIGHT — shots are flipped so home attacks LEFT */}
            <div className="absolute" style={{ left: "40%", bottom: "8%", transform: "translateX(-50%)" }}>
              {match.homeTeam.logo ? (
                <img src={match.homeTeam.logo} alt="" className="w-16 h-16 sm:w-28 sm:h-28 md:w-40 md:h-40 object-contain opacity-50 [filter:contrast(1.18)_brightness(1.08)]" />
              ) : (
                <span className="text-3xl font-display font-bold text-chalk-100/15">{match.homeTeam.name.slice(0, 3).toUpperCase()}</span>
              )}
            </div>
            <div className="absolute" style={{ left: "60%", bottom: "8%", transform: "translateX(-50%)" }}>
              {match.awayTeam.logo ? (
                <img src={match.awayTeam.logo} alt="" className="w-16 h-16 sm:w-28 sm:h-28 md:w-40 md:h-40 object-contain opacity-50 [filter:contrast(1.18)_brightness(1.08)]" />
              ) : (
                <span className="text-3xl font-display font-bold text-chalk-100/15">{match.awayTeam.name.slice(0, 3).toUpperCase()}</span>
              )}
            </div>
            {/* Shot markers ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â horizontal: x maps to left-right, y maps to top-bottom */}
            {filteredMapEvents.map((evt) => {
              // For horizontal: normalized_y becomes x (0=home goal left, 1=away goal right)
              // normalized_x becomes y (sideline)
              // Flip second-half shots because teams switch sides at half time.
              // Uses the period field from the API for accurate detection.
              const isSecondHalf = evt.period === "SECOND HALF";
              const ny = isSecondHalf ? 1 - evt.normalized_y : evt.normalized_y;
              const nx = isSecondHalf ? 1 - evt.normalized_x : evt.normalized_x;
              const px = Math.max(4, Math.min(96, (shotMapFlip ? 1 - ny : ny) * 92 + 4));
              const py = Math.max(6, Math.min(94, nx * 88 + 6));
              const isSelected = selectedMapEventId === evt.id;
              let marker: React.ReactNode;
              if (evt.kind === "shot") {
                if (evt.shot!.is_goal) marker = "\u26BD";
                else if (evt.shot!.is_save) marker = "\u{1F9E4}";
                else marker = "\u274C";
              } else {
                marker = evt.extra!.event_type === "OWN_GOAL"
                  ? "\u26BD"
                  : evt.extra!.event_type === "YELLOW_CARD"
                    ? "\u{1F7E8}"
                    : "\u{1F7E5}";
              }

              const title = evt.kind === "shot"
                ? `${evt.shot!.is_goal ? `Goal by ${evt.shot!.username}` : evt.shot!.is_save ? `Save by ${getSaveKeeperName(evt.shot!)} (shot by ${evt.shot!.username})` : `Missed by ${evt.shot!.username}`} (xG: ${evt.shot!.xg.toFixed(2)})`
                : `${evt.extra!.event_type === "OWN_GOAL" ? "Own goal" : evt.extra!.event_type === "YELLOW_CARD" ? "Yellow card" : "Red card"} by ${evt.extra!.username}`;

              return (
                <button
                  key={evt.id}
                  onClick={() => setSelectedMapEventId(isSelected ? null : evt.id)}
                  className={`absolute transition-all cursor-pointer select-none ${isSelected ? "z-20" : ""}`}
                  style={{
                    left: `${px}%`,
                    top: `${py}%`,
                    transform: `translate(-50%, -50%)${isSelected ? " scale(1.3)" : ""}`,
                    opacity: selectedMapEventId !== null && !isSelected ? 0.4 : 1,
                    fontSize: "clamp(12px, 2.6vw, 22px)",
                    lineHeight: 1,
                  }}
                  title={title}
                >
                  {marker}
                </button>
              );
            })}
            {/* Tooltip */}
            {selectedMapEventId && (() => {
              const evt = filteredMapEvents.find((e) => e.id === selectedMapEventId);
              if (!evt) return null;

              const isSecondHalf = evt.period === "SECOND HALF";
              const ny = isSecondHalf ? 1 - evt.normalized_y : evt.normalized_y;
              const nx = isSecondHalf ? 1 - evt.normalized_x : evt.normalized_x;
              const px = Math.max(4, Math.min(96, (shotMapFlip ? 1 - ny : ny) * 92 + 4));
              const py = Math.max(6, Math.min(94, nx * 88 + 6));
              const above = py > 50;
              const anchor = px > 70 ? 'right' : px < 30 ? 'left' : 'center';
              const left = anchor === 'right' ? `${px - 2}%` : anchor === 'left' ? `${px + 2}%` : `${px}%`;
              const transformX = anchor === 'right' ? '-100%' : anchor === 'left' ? '0' : '-50%';

              if (evt.kind === "extra") {
                const label = evt.extra!.event_type === "OWN_GOAL" ? "Own Goal" : evt.extra!.event_type === "YELLOW_CARD" ? "Yellow Card" : "Red Card";
                const color = evt.extra!.event_type === "OWN_GOAL" ? "text-orange-400" : evt.extra!.event_type === "YELLOW_CARD" ? "text-yellow-400" : "text-red-400";
                return (
                  <div className="absolute z-30 pointer-events-none" style={{
                    left,
                    top: above ? `calc(${py}% - 12px)` : `calc(${py}% + 12px)`,
                    transform: `translate(${transformX}, ${above ? "-100%" : "0"})`,
                  }}>
                    <div className="w-max max-w-[150px] sm:max-w-[260px] bg-pitch-950/95 border border-chalk-100/15 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs font-mono leading-snug whitespace-normal break-words shadow-lg">
                      <div className="font-medium text-chalk-100 break-all">{evt.extra!.username}</div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className={color}>{label}</span>
                        {evt.minute != null && <span className="text-chalk-400">{evt.minute}&apos;</span>}
                      </div>
                    </div>
                  </div>
                );
              }

              const s = evt.shot!;
              return (
                <div className="absolute z-30 pointer-events-none" style={{
                  left,
                  top: above ? `calc(${py}% - 12px)` : `calc(${py}% + 12px)`,
                  transform: `translate(${transformX}, ${above ? "-100%" : "0"})`,
                }}>
                  <div className="w-max max-w-[150px] sm:max-w-[260px] bg-pitch-950/95 border border-chalk-100/15 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs font-mono leading-snug whitespace-normal break-words shadow-lg">
                    <div className="font-medium text-chalk-100 break-all">{s.is_save ? getSaveKeeperName(s) : s.username}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className={s.is_goal ? "text-green-400" : s.is_save ? "text-amber-400" : "text-red-400"}>
                        {s.is_goal ? "Goal" : s.is_save ? "Saved" : "Missed"}
                      </span>
                      <span className="text-pink-400">xG: {s.xg.toFixed(2)}</span>
                      {s.minute != null && <span className="text-chalk-400">{s.minute}&apos;</span>}
                    </div>
                    {s.is_goal && s.assist_username && (
                      <div className="text-chalk-400 mt-0.5 break-words">
                        Assist by {s.assist_username}
                      </div>
                    )}
                    {s.is_save && (
                      <div className="text-chalk-400 mt-0.5 break-words">
                        Shot by {s.username} · Saved by {getSaveKeeperName(s)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono text-chalk-400">
          {([
            { key: "goal" as const, icon: "\u26BD", label: "Goal" },
            { key: "save" as const, icon: "\u{1F9E4}", label: "Save" },
            { key: "miss" as const, icon: "\u274C", label: "Miss" },
            { key: "yellow_card" as const, icon: "\u{1F7E8}", label: "Yellow Card" },
            { key: "red_card" as const, icon: "\u{1F7E5}", label: "Red Card" },
            { key: "own_goal" as const, icon: "\u26BD", label: "Own Goal" },
          ]).map((item) => {
            const enabled = visibleMarkers[item.key];
            return (
              <label key={item.key} className={`cl-checkbox flex items-center gap-0 transition-colors ${enabled ? "text-chalk-300" : "text-chalk-500/70"}`}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => setVisibleMarkers((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                />
                <span className="flex items-center gap-1">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Shot Zone Heatmaps */}
      {shots.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">SHOT ZONES</h2>
          <div className="grid grid-cols-2 gap-4">
            <ShotZoneHeatmap shots={shots} teamSide="home" teamColor={match.homeTeam.color} teamName={match.homeTeam.name} />
            <ShotZoneHeatmap shots={shots} teamSide="away" teamColor={match.awayTeam.color} teamName={match.awayTeam.name} />
          </div>
        </div>
      )}

      {/* H2H centered + Highlights on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <H2HStats
            cardRef={h2hCardRef}
            homeColor={match.homeTeam.color}
            awayColor={match.awayTeam.color}
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
            homePassAcc={hT("passes") > 0 ? (hT("passes_completed") / hT("passes")) * 100 : 0}
            awayPassAcc={aT("passes") > 0 ? (aT("passes_completed") / aT("passes")) * 100 : 0}
            homeShotAcc={hT("shots") > 0 ? (hT("shots_on_target") / hT("shots")) * 100 : 0}
            awayShotAcc={aT("shots") > 0 ? (aT("shots_on_target") / aT("shots")) * 100 : 0}
          />
        </div>
        {/* Game Highlights on right ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â same height as H2H */}
        {timeline.length > 0 && (
          <div className="flex flex-col">
            <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">GAME HIGHLIGHTS</h2>
            <div
              className="bg-pitch-900/40 rounded-lg border border-chalk-100/8 divide-y divide-chalk-100/5 overflow-y-scroll"
              style={{ maxHeight: `${h2hCardHeight}px` }}
            >
              {timeline.map((ev, i) => {
                const isHome = ev.team_side === "home";
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 0 ? "bg-pitch-600/15" : ""}`}>
                    <span className="text-xs font-mono text-chalk-400 w-8 shrink-0">{ev.minute != null ? `${ev.minute}'` : "-"}</span>
                    <span className="text-base shrink-0">{ev.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div>
                        <span className={`text-xs font-mono font-bold ${ev.color}`}>{ev.label}</span>
                        <span className="text-xs font-mono text-chalk-200 ml-2">{ev.actor}</span>
                      </div>
                      {ev.secondaryText && (
                        <div className="text-[10px] font-mono text-chalk-400">{ev.secondaryText}</div>
                      )}
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
        {
          label: match.homeTeam.name,
          logo: match.homeTeam.logo,
          avgRating: match.homeTeam.avgRating,
          avgBadgeClass: avgVisuals.home.badgeClass,
          avgHint: avgVisuals.home.hint,
          players: homePlayers,
          side: "home" as const,
        },
        {
          label: match.awayTeam.name,
          logo: match.awayTeam.logo,
          avgRating: match.awayTeam.avgRating,
          avgBadgeClass: avgVisuals.away.badgeClass,
          avgHint: avgVisuals.away.hint,
          players: awayPlayers,
          side: "away" as const,
        },
      ].map((team) => (
        <SortablePlayerTable key={team.side} team={team} shots={shots} potm={match.potm} totalPossession={playerStats.reduce((s, p) => s + p.possession, 0)} />
      ))}
    </div>
  );
}


/* ─── Shot Zone Heatmap ─── */
function ShotZoneHeatmap({ shots, teamSide, teamColor, teamName }: {
  shots: MatchShot[];
  teamSide: "home" | "away";
  teamColor: string | null;
  teamName: string;
}) {
  const COLS = 8;
  const ROWS = 3; // top 3 rows of attacking half (near goal)
  const VISIBLE_ATTACKING_HALF_RATIO = 0.6; // rendered SVG shows roughly top 3/5 of attacking half
  const MAX_VISIBLE_DIST_TO_GOAL = 0.5 * VISIBLE_ATTACKING_HALF_RATIO;

  const hex = teamColor?.match(/^#([0-9a-f]{6})$/i);
  const [cr, cg, cb] = hex
    ? [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16)]
    : teamSide === "home" ? [138, 197, 255] : [255, 138, 138];
  // Perceived luminance of team color: bright colors get black text, dark colors always get white
  const luminance = (0.2126 * cr + 0.7152 * cg + 0.0722 * cb) / 255;

  const teamShots = shots.filter((s) => s.team_side === teamSide);

  const corrected = teamShots.map((s) => {
    const isSecondHalf = s.period === "SECOND HALF";
    const ny = isSecondHalf ? 1 - s.normalized_y : s.normalized_y;
    const nx = isSecondHalf ? 1 - s.normalized_x : s.normalized_x;
    // Use absolute distance to nearest goal line: 0 = at goal, 0.5 = center.
    // This works regardless of which direction the team attacks in this match.
    const distToGoal = Math.min(ny, 1 - ny);
    return { x: nx, distToGoal, isGoal: s.is_goal };
  });

  // Row 0 = closest to goal (distToGoal ≈ 0), row ROWS-1 = farthest shown (center direction).
  const grid: { count: number; goals: number }[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ count: 0, goals: 0 }))
  );
  let visibleShotsCount = 0;
  for (const s of corrected) {
    if (s.distToGoal > MAX_VISIBLE_DIST_TO_GOAL) continue;

    const col = Math.min(COLS - 1, Math.floor(s.x * COLS));
    // map visible distToGoal [0 -> MAX_VISIBLE_DIST_TO_GOAL] to row [0 -> ROWS-1]
    const row = Math.min(ROWS - 1, Math.floor((s.distToGoal / MAX_VISIBLE_DIST_TO_GOAL) * ROWS));

    visibleShotsCount++;
    grid[row][col].count++;
    if (s.isGoal) grid[row][col].goals++;
  }

  const total = teamShots.length;
  const goals = teamShots.filter((s) => s.is_goal).length;
  const zoneTotal = Math.max(1, visibleShotsCount);
  const maxCount = Math.max(1, ...grid.flatMap((r) => r.map((c) => c.count)));

  // Row 0 = goal line (attackY≈1.0) displayed at top, row ROWS-1 = center at bottom
  const displayRows = grid;

  return (
    <div>
      <div className="text-xs font-mono text-chalk-300 mb-1.5 flex items-center gap-2 flex-wrap">
        <span className="font-semibold">{teamName}</span>
        <span className="text-chalk-600">·</span>
        <span className="text-chalk-500">{total} shots · {goals} goals{total > 0 ? ` · ${Math.round((goals / total) * 100)}% conv.` : ""}</span>
      </div>
      {/* aspectRatio 68:33 — shows top 3/5 of attacking half (goal area + penalty area + just beyond) */}
      <div className="relative rounded-lg overflow-hidden border border-chalk-100/8 bg-[#0d1f0d]" style={{ aspectRatio: "68/33" }}>
        {/* SVG shows goal at top (y=0) down to ~30m (y=32). Penalty box ends at y=18.5, arc peaks ~y=22 */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 68 32" preserveAspectRatio="none">
          {/* Side boundaries only (no bottom line — field continues) */}
          <line x1="2" y1="2" x2="2" y2="32" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
          <line x1="66" y1="2" x2="66" y2="32" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
          {/* Top boundary */}
          <line x1="2" y1="2" x2="66" y2="2" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
          {/* Penalty box */}
          <rect x="13.84" y="2" width="40.32" height="16.5" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="0.5" />
          {/* 6-yard box */}
          <rect x="24.84" y="2" width="18.32" height="5.5" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.4" />
          {/* Goal frame */}
          <rect x="30.34" y="0" width="7.32" height="2.5" fill="rgba(255,255,255,0.4)" rx="0.3" />
          {/* Penalty spot */}
          <circle cx="34" cy="13" r="0.6" fill="rgba(255,255,255,0.3)" />
          {/* Penalty arc — curves outside (below) penalty box */}
          <path d="M 41.31 18.5 A 9.15 9.15 0 0 1 26.69 18.5" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
        </svg>
        {/* Heatmap grid — aligned to field inner boundary (SVG viewBox 0 0 68 32, field from x=2,y=2 to x=66) */}
        <div
          className="absolute grid"
          style={{
            left: `${(2 / 68) * 100}%`,
            right: `${(2 / 68) * 100}%`,
            top: `${(2 / 32) * 100}%`,
            bottom: 0,
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          }}
        >
          {displayRows.map((row, ri) =>
            row.map((cell, ci) => {
              const pct = visibleShotsCount > 0 ? Math.round((cell.count / zoneTotal) * 100) : 0;
              const intensity = cell.count / maxCount;
              return (
                <div
                  key={`${ri}-${ci}`}
                  className="flex items-center justify-center border border-white/[0.02]"
                  style={{ backgroundColor: intensity > 0 ? `rgba(${cr},${cg},${cb},${(intensity * 0.68).toFixed(2)})` : "transparent" }}
                  title={`${cell.count} shot${cell.count !== 1 ? "s" : ""} (${pct}%)${cell.goals > 0 ? ` · ${cell.goals} goal${cell.goals > 1 ? "s" : ""}` : ""}`}
                >
                  {pct > 0 && (
                    <span
                      className="text-[9px] sm:text-[13px] md:text-[16px] font-mono font-bold select-none leading-none"
                      style={{ color: luminance > 0.55 && intensity > 0.5 ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.92)" }}
                    >
                      {pct}%
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ H2H Stats ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */
function H2HStats({
  cardRef, homeColor, awayColor, rows,
  homePassAcc, awayPassAcc, homeShotAcc, awayShotAcc,
}: {
  cardRef?: Ref<HTMLDivElement>;
  homeColor: string | null;
  awayColor: string | null;
  rows: { label: string; home: number; away: number; pct?: boolean }[];
  homePassAcc: number; awayPassAcc: number;
  homeShotAcc: number; awayShotAcc: number;
}) {
  const hCol = homeColor || "#ef4444";
  const aCol = awayColor || "#3b82f6";
  return (
    <div>
      <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">HEAD TO HEAD</h2>
      <div ref={cardRef} className="bg-pitch-900/40 rounded-lg border border-chalk-100/8 p-6">
        <div className="mb-8 flex justify-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-14 place-items-center">
            <AccuracyCircle value={homeShotAcc} label="Shot Acc" color={hCol} />
            <AccuracyCircle value={homePassAcc} label="Pass Acc" color={hCol} />
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
  const r = 48;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth="7" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 60 60)" />
        <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
          className="circle-label" fontSize="18" fontFamily="monospace" fontWeight="bold">{value.toFixed(0)}%</text>
      </svg>
      <span className="text-[11px] font-mono text-chalk-400 uppercase">{label}</span>
    </div>
  );
}

/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Lineup Player Card ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */
type LineupRows = {
  attack: LineupSlot[];
  midfield: LineupSlot[];
  defense: LineupSlot[];
  goalkeepers: LineupSlot[];
};

type CanonicalPosition = "LW" | "CF" | "RW" | "CM" | "LB" | "CB" | "RB" | "GK";

type LineupSubstitute = {
  player_steam_id: string;
  profile_steam_id: string;
  username: string;
};

type LineupSlot = {
  starter: MatchPlayer;
  substitutes: LineupSubstitute[];
};

function normalizeToCanonicalPosition(position: string | null): CanonicalPosition | null {
  const pos = (position || "").toUpperCase();
  if (pos === "LW" || pos === "LF") return "LW";
  if (pos === "CF" || pos === "ST" || pos === "RF") return "CF";
  if (pos === "RW") return "RW";
  if (["CM", "LCM", "RCM", "CDM", "CAM", "LM", "RM", "DM", "AM"].includes(pos)) return "CM";
  if (pos === "LB" || pos === "LWB") return "LB";
  if (pos === "CB" || pos === "LCB" || pos === "RCB") return "CB";
  if (pos === "RB" || pos === "RWB") return "RB";
  if (pos === "GK") return "GK";
  return null;
}

function getLineupRows(players: MatchPlayer[]): LineupRows {
  const canonicalSlots: CanonicalPosition[] = ["LW", "CF", "RW", "CM", "LB", "CB", "RB", "GK"];
  const bySlot = new Map<CanonicalPosition, MatchPlayer[]>(canonicalSlots.map((slot) => [slot, []]));

  const sorted = [...players].sort((a, b) => {
    if (b.minutes_played !== a.minutes_played) return b.minutes_played - a.minutes_played;
    return b.possession - a.possession;
  });

  for (const player of sorted) {
    const slot = normalizeToCanonicalPosition(player.position);
    if (!slot) continue;
    bySlot.get(slot)!.push(player);
  }

  const used = new Set<string>();
  const starterBySlot = new Map<CanonicalPosition, MatchPlayer | null>();

  for (const slot of canonicalSlots) {
    const candidates = bySlot.get(slot)!;
    const preferredStarter = candidates.find((candidate) => !candidate.is_sub && !used.has(candidate.player_steam_id));
    const fallbackStarter = candidates.find((candidate) => !used.has(candidate.player_steam_id));
    const starter = preferredStarter || fallbackStarter || null;
    if (starter) used.add(starter.player_steam_id);
    starterBySlot.set(slot, starter);
  }

  const remainingPool = sorted.filter((player) => !used.has(player.player_steam_id));
  for (const slot of canonicalSlots) {
    if (starterBySlot.get(slot)) continue;
    const replacement = remainingPool.shift() || null;
    if (replacement) {
      used.add(replacement.player_steam_id);
      starterBySlot.set(slot, replacement);
    }
  }

  const slotEntry = (slot: CanonicalPosition): LineupSlot | null => {
    const starter = starterBySlot.get(slot);
    if (!starter) return null;

    const substitutesRaw = bySlot
      .get(slot)!
      .filter((player) => player.player_steam_id !== starter.player_steam_id && player.is_sub)
      .sort((a, b) => b.minutes_played - a.minutes_played)
      .map((player) => ({
        player_steam_id: player.player_steam_id,
        profile_steam_id: player.profile_steam_id || player.player_steam_id,
        username: player.username,
      }));

    const substitutesById = new Map<string, LineupSubstitute>();
    for (const sub of substitutesRaw) {
      substitutesById.set(sub.player_steam_id, sub);
    }

    return {
      starter: { ...starter, position: slot },
      substitutes: Array.from(substitutesById.values()),
    };
  };

  return {
    attack: [slotEntry("LW"), slotEntry("CF"), slotEntry("RW")].filter((entry): entry is LineupSlot => entry != null),
    midfield: [slotEntry("CM")].filter((entry): entry is LineupSlot => entry != null),
    defense: [slotEntry("LB"), slotEntry("CB"), slotEntry("RB")].filter((entry): entry is LineupSlot => entry != null),
    goalkeepers: [slotEntry("GK")].filter((entry): entry is LineupSlot => entry != null),
  };
}

function StatChip({
  label,
  tone,
}: {
  label: string;
  tone: 'goal' | 'assist' | 'card' | 'danger';
}) {
  const toneClass =
    tone === 'goal'
      ? 'bg-grass-500/95 text-pitch-950'
      : tone === 'assist'
        ? 'bg-sky-400/95 text-slate-950'
        : tone === 'danger'
          ? 'bg-red-500/95 text-white'
          : 'bg-amber-400/95 text-slate-950';

  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-mono font-bold shadow-sm ${toneClass}`}>
      {label}
    </span>
  );
}


function ShoeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 495.911 495.911" fill="white">
      <path d="M444.679,320.672c60.387-17.744,65.879-54.018,24.439-73.301c-6.653-3.096-54.633-25.674-61.21-27.957l-1.89-0.656c-4.9-1.703-9.97-1.791-14.631-0.547c-2.886-3.867-6.919-6.939-11.819-8.641l-1.889-0.658c-4.9-1.701-9.97-1.789-14.631-0.545c-2.886-3.865-6.919-6.939-11.819-8.643l-1.889-0.656c-4.9-1.701-9.97-1.791-14.631-0.545c-2.886-3.867-6.919-6.939-11.819-8.643l-1.889-0.656c-4.9-1.701-9.971-1.791-14.631-0.547c-2.886-3.865-6.919-6.939-11.819-8.643l-1.889-0.654c-5.659-1.967-11.544-1.777-16.765,0.129c-0.182-0.115-0.379-0.234-0.544-0.346c-14.824-9.994-35.158-26.152-48.939-37.283c-43.333-35-57.647,1.104-73.656,18.482c-3.361,3.65-3.494,7.916-0.884,12.047c1.987,3.145,4.342,6.057,7.75,10.746c-12.025,1.246-22.703,2.32-33.373,3.469c-12.947,1.391-23.867-2.697-32.767-12.127c-4.546-4.814-8.502-10.287-13.512-14.535c-4.026-3.412-21.258-10.304-42.02-2.697C0.284,171.067-2.867,278.825,1.514,304.117c2.834,16.355,7.782,22.074,16.04,24.691l2.909,5.313l-1.239,12.289c-0.636,6.297,2.879,11.637,8.001,12.154c5.123,0.516,9.636-4.014,10.27-10.311l1.24-12.285l2.816-3.328c13.27,1.924,26.573,3.512,39.92,4.621l3.438,5.35l-0.378,12.346c-0.193,6.326,3.686,11.408,8.831,11.564c5.146,0.158,9.332-4.674,9.523-11l0.38-12.344l3.244-4.428c6.442,0.219,38.847-15.259,105.731-2.598c13.168,2.493,26.641,4.123,39.975,4.148c2.721,0.004,5.442-0.004,8.164-0.014l3.393,4.887l0.066,12.35c0.033,6.328,4.093,11.268,9.24,11.24c5.149-0.027,9.158-5.008,9.123-11.338l-0.064-12.348l3.472-5.113c15.932-0.344,31.859-0.949,47.763-1.82c2.788-0.154,5.576-0.318,8.363-0.492c0.09,0.125,0.179,0.248,0.282,0.365l4.744,5.314l1.565,12.25c0.803,6.279,5.432,10.688,10.538,10.035c5.107-0.654,8.481-6.082,7.679-12.361l-1.565-12.25l2.765-5.379c17.226-1.678,34.345-4.156,51.202-8.143c0.065,0.063,0.125,0.131,0.194,0.189l5.427,4.617l3.225,11.92c1.654,6.111,6.843,9.846,11.813,8.5s7.569-7.186,5.915-13.295l-3.226-11.922l2.359-6.721C444.664,320.74,444.668,320.705,444.679,320.672z" />
    </svg>
  );
}

function PlayerCard({
  p,
  shirtColor,
  substitutes,
  showTitles,
  playerXg,
  potm,
  totalPossession,
}: {
  p: MatchPlayer;
  shirtColor: string;
  substitutes: LineupSubstitute[];
  showTitles: boolean;
  playerXg: number;
  potm: string | null;
  totalPossession: number;
}) {
  // Manual tuning knobs for marker placement.
  const markerTop = "35%";
  const goalsAssistRight = "calc(100% - 4px)";
  const cardsLeft = "calc(100% - 4px)";
  const assistOffsetY = 24;

  const titleLabels = showTitles ? getPlayerLabels(p, playerXg, potm, totalPossession) : [];

  return (
    <div className="flex flex-col items-center gap-0 w-[72px]">
      <Link
        href={`/players/${encodeURIComponent(p.profile_steam_id || p.player_steam_id)}`}
        className="group flex flex-col items-center gap-0 w-full"
      >
        <div className="relative">
          <Jersey color={shirtColor} size={60} label={p.position || '?'} />

          {/* Title badges to the right of the shirt */}
          {showTitles && titleLabels.length > 0 && (
            <div className="absolute top-1/2 -translate-y-1/2 left-[calc(100%-8px)] flex flex-col gap-1 items-start" style={{ minWidth: "56px" }}>
              {titleLabels.map((lbl) => (
                lbl.text === "MVP"
                  ? (
                    <span
                      key={lbl.text}
                      className="rounded px-1.5 py-0.5 text-[12px] font-mono font-bold leading-tight text-slate-900 shadow-md"
                      style={{ background: "linear-gradient(90deg, hsla(141,81%,87%,1) 0%, hsla(41,88%,75%,1) 50%, hsla(358,82%,71%,1) 100%)" }}
                    >
                      {lbl.text}
                    </span>
                  ) : (
                    <span
                      key={lbl.text}
                      className={`rounded px-1.5 py-0.5 text-[12px] font-mono font-bold leading-tight ${labelClass(lbl.sentiment)}`}
                    >
                      {lbl.text}
                    </span>
                  )
              ))}
            </div>
          )}

          {!showTitles && (
            <>
              {/* Left side: goals + assists */}
              {(p.goals > 0 || p.assists > 0) && (
                <div className="absolute" style={{ top: markerTop, right: goalsAssistRight }}>
                  {p.goals > 0 && (
                    <div className="absolute right-1 -translate-y-1/2 flex items-center gap-0.5">
                      <span className="text-sm leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">⚽</span>
                      <span className="text-[12px] font-mono font-bold text-[#01dbff] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{p.goals}</span>
                    </div>
                  )}
                  {p.assists > 0 && (
                    <div
                      className="absolute right-1 -translate-y-1/2 flex items-center gap-0.5"
                      style={{ transform: `translateY(calc(-50% + ${assistOffsetY}px))` }}
                    >
                      <ShoeIcon />
                      <span className="text-[12px] font-mono font-bold text-[#f90c71] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{p.assists}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Right side: cards */}
              {(p.yellow_cards > 0 || p.red_cards > 0) && (
                <div
                  className="absolute -translate-y-1/2 flex flex-col gap-0.5 items-start"
                  style={{ top: markerTop, left: cardsLeft }}
                >
                  {p.yellow_cards > 0 && <span className="text-base leading-none">🟨</span>}
                  {p.red_cards > 0 && <span className="text-base leading-none">🟥</span>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="-mt-1 max-w-[88px] rounded-sm bg-slate-950/80 px-1.5 py-0.5 text-center group-hover:bg-slate-800">
          <div className="truncate text-[11px] font-mono font-bold text-white transition-colors group-hover:text-[#F4119E]">{p.username}</div>
        </div>
      </Link>

      {substitutes.length > 0 && (
        <div className="mt-1.5 flex flex-col items-center gap-1">
          {substitutes.map((sub) => (
            <Link
              key={sub.player_steam_id}
              href={`/players/${encodeURIComponent(sub.profile_steam_id || sub.player_steam_id)}`}
              className="group max-w-[88px] rounded-sm bg-slate-950/80 px-1.5 py-0.5 text-center transition-colors hover:bg-slate-800"
            >
              <div className="flex items-center justify-center gap-1 truncate text-[9px] font-mono font-bold text-white">
                <span className="shrink-0 text-[#F4119E]" title="Substitute">&#x25B6;</span>
                <span className="truncate transition-colors group-hover:text-[#F4119E]">{sub.username}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FormationRow({
  players,
  top,
  shirtColor,
  showTitles,
  playerXgMap,
  potm,
  totalPossession,
}: {
  players: LineupSlot[];
  top: string;
  shirtColor: string;
  showTitles: boolean;
  playerXgMap: Map<string, number>;
  potm: string | null;
  totalPossession: number;
}) {
  if (players.length === 0) return null;

  return (
    <div
      className="absolute left-0 right-0 flex -translate-y-1/2 justify-evenly gap-2 px-4"
      style={{ top }}
    >
      {players.map((slot, index) => {
        const spread = (index - (players.length - 1) / 2) * 6;
        return (
          <div key={slot.starter.player_steam_id} style={{ transform: `translateX(${spread}px)` }}>
            <PlayerCard
              p={slot.starter}
              shirtColor={shirtColor}
              substitutes={slot.substitutes}
              showTitles={showTitles}
              playerXg={playerXgMap.get(slot.starter.player_steam_id) || 0}
              potm={potm}
              totalPossession={totalPossession}
            />
          </div>
        );
      })}
    </div>
  );
}

function LineupGraphic({
  players, teamName, teamLogo, teamColor, showTitles, shots, potm, totalPossession,
}: {
  players: MatchPlayer[]; teamName: string; teamLogo: string | null; teamColor: string | null;
  showTitles: boolean; shots: MatchShot[]; potm: string | null; totalPossession: number;
}) {
  const lineup = getLineupRows(players);
  const shirtColor = teamColor || '#1e293b';

  const playerXgMap = new Map<string, number>();
  for (const s of shots) playerXgMap.set(s.player_steam_id, (playerXgMap.get(s.player_steam_id) || 0) + s.xg);

  return (
    <div
      className="relative overflow-hidden bg-[#3d7a38]"
      style={{
        aspectRatio: '3 / 3.3',
        backgroundImage:
          'repeating-linear-gradient(180deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 40px, transparent 40px, transparent 80px)',
      }}
    >
      {/* Field markings — outer lines flush with container edges */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 400" preserveAspectRatio="none">
        {/* Outer boundary flush with edges (stroke-width 2, inset 1px so line is fully visible) */}
        <rect x="1" y="1" width="298" height="398" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
        {/* Halfway line */}
        <line x1="1" y1="200" x2="299" y2="200" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
        {/* Center circle */}
        <circle cx="150" cy="200" r="40" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
        <circle cx="150" cy="200" r="3" fill="rgba(255,255,255,0.7)" />
        {/* Top penalty box (no top side — merges with boundary) */}
        <path d="M 61 1 L 61 68 L 239 68 L 239 1" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        {/* Top 6-yard box */}
        <path d="M 107 1 L 107 26 L 193 26 L 193 1" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1" />
        {/* Top penalty spot */}
        <circle cx="150" cy="50" r="2.5" fill="rgba(255,255,255,0.55)" />
        {/* Top penalty arc (outside penalty box) */}
        <path d="M 116 68 A 38 38 0 0 0 184 68" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1" />
        {/* Bottom penalty box */}
        <path d="M 61 399 L 61 332 L 239 332 L 239 399" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        {/* Bottom 6-yard box */}
        <path d="M 107 399 L 107 374 L 193 374 L 193 399" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1" />
        {/* Bottom penalty spot */}
        <circle cx="150" cy="350" r="2.5" fill="rgba(255,255,255,0.55)" />
        {/* Bottom penalty arc */}
        <path d="M 116 332 A 38 38 0 0 1 184 332" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1" />
        {/* Corner arcs */}
        <path d="M 1 12 A 11 11 0 0 0 12 1" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <path d="M 288 1 A 11 11 0 0 0 299 12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <path d="M 1 388 A 11 11 0 0 1 12 399" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <path d="M 299 388 A 11 11 0 0 0 288 399" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      </svg>

      <FormationRow players={lineup.attack} top="19%" shirtColor={shirtColor} showTitles={showTitles} playerXgMap={playerXgMap} potm={potm} totalPossession={totalPossession} />
      <FormationRow players={lineup.midfield} top="41%" shirtColor={shirtColor} showTitles={showTitles} playerXgMap={playerXgMap} potm={potm} totalPossession={totalPossession} />
      <FormationRow players={lineup.defense} top="65%" shirtColor={shirtColor} showTitles={showTitles} playerXgMap={playerXgMap} potm={potm} totalPossession={totalPossession} />
      <FormationRow players={lineup.goalkeepers} top="88%" shirtColor={shirtColor} showTitles={showTitles} playerXgMap={playerXgMap} potm={potm} totalPossession={totalPossession} />
    </div>
  );
}

type PlayerLabel = {
  text: string;
  sentiment: "positive" | "negative" | "neutral";
};

function getPlayerLabels(
  p: MatchPlayer,
  pxg: number,
  potm: string | null,
  totalPossession: number,
): PlayerLabel[] {
  const labels: PlayerLabel[] = [];
  const isGK = (p.position || "").toUpperCase() === "GK";

  // MVP → match by steamID for accuracy
  if (potm && (p.profile_steam_id === potm || p.player_steam_id === potm)) {
    labels.push({ text: "MVP", sentiment: "positive" });
  }

  if (isGK) {
    // Shot Stopper: saves >= 3 AND saves >= 2× goals conceded
    if (p.saves >= 3 && p.saves >= p.goals_conceded * 2) {
      labels.push({ text: "Shot Stopper", sentiment: "positive" });
    }
    // Exposed: goals conceded are double or above saves
    if (p.goals_conceded >= 2 && p.goals_conceded >= p.saves * 2) {
      labels.push({ text: "Exposed", sentiment: "negative" });
    }
    return labels.slice(0, 2);
  }

  // Hattrick: goals >= 3
  if (p.goals >= 3) {
    labels.push({ text: "Hattrick", sentiment: "positive" });
  }

  // Lethal: conversion rate ≥65% (need ≥1 goal and ≥1 shot, not already Hattrick)
  if (p.goals > 0 && p.shots > 0 && p.goals / p.shots >= 0.65 && !labels.some((l) => l.text === "Hattrick")) {
    labels.push({ text: "Lethal", sentiment: "positive" });
  }

  // Sniper: scored but very low xG (cold finisher)
  if (p.goals > 0 && pxg < 0.3 && !labels.some((l) => l.text === "Lethal" || l.text === "Hattrick")) {
    labels.push({ text: "Sniper", sentiment: "positive" });
  }

  // Playmaker: 2+ assists
  if (p.assists >= 2) {
    labels.push({ text: "Playmaker", sentiment: "positive" });
  }

  // Complete: offensive + defensive contribution
  if ((p.goals + p.assists) >= 1 && p.interceptions >= 4 && !labels.some((l) => l.text === "Playmaker")) {
    labels.push({ text: "Complete", sentiment: "positive" });
  }

  // Interceptor: high interceptions (12+)
  if (p.interceptions >= 12 && !labels.some((l) => l.text === "Complete")) {
    labels.push({ text: "Interceptor", sentiment: "positive" });
  }

  // Dictator: many passes + high accuracy (35+ passes, ≥80%)
  if (p.passes >= 35 && p.passes > 0 && p.passes_completed / p.passes >= 0.80) {
    labels.push({ text: "Dictator", sentiment: "positive" });
  }

  // Skip negative labels for MVP
  if (!labels.some((l) => l.text === "MVP")) {
    // Profligate: very high xG but no goals
    if (pxg >= 2 && p.goals === 0) {
      labels.push({ text: "Profligate", sentiment: "negative" });
    }

    // Off Target: many shots but no goals
    if (p.shots >= 4 && p.goals === 0) {
      labels.push({ text: "Off Target", sentiment: "negative" });
    }

    // Ghost: zero offensive and defensive contribution
    if (p.goals === 0 && p.assists === 0 && p.interceptions <= 2 && p.passes_completed <= 10) {
      labels.push({ text: "Ghost", sentiment: "negative" });
    }

    // Passenger: possession% > 8% but zero contributions
    const possessionPct = totalPossession > 0 ? (p.possession / totalPossession) * 100 : 0;
    if (
      possessionPct > 8 &&
      p.goals === 0 &&
      p.assists === 0 &&
      p.interceptions <= 4 &&
      !labels.some((l) => l.text === "Dictator")
    ) {
      labels.push({ text: "Passenger", sentiment: "negative" });
    }
  }

  return labels.slice(0, 2);
}

function labelClass(sentiment: PlayerLabel["sentiment"]) {
  if (sentiment === "positive")
    return "text-emerald-400 bg-emerald-950/70 border border-emerald-600/40";
  if (sentiment === "negative")
    return "text-red-400 bg-red-950/70 border border-red-600/40";
  return "text-amber-400 bg-amber-950/70 border border-amber-600/40";
}


function SortablePlayerTable({
  team, shots, potm, totalPossession,
}: {
  totalPossession: number;
  team: {
    label: string;
    logo: string | null;
    avgRating: number | null;
    avgBadgeClass: string;
    avgHint: string | null;
    players: MatchPlayer[];
    side: "home" | "away";
  };
  shots: MatchShot[];
  potm: string | null;
}) {
  const router = useRouter();
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
    else if (sortKey === "possession") { av = totalPossession > 0 ? a.possession / totalPossession : 0; bv = totalPossession > 0 ? b.possession / totalPossession : 0; }
    else { av = Number(a[sortKey] || 0); bv = Number(b[sortKey] || 0); }
    return sortAsc ? av - bv : bv - av;
  });

  const [showMore, setShowMore] = useState(false);

  const baseCols: { key: SortKey | null; label: string; align: string; tooltip: string }[] = [
    { key: null, label: "PLAYER", align: "text-left", tooltip: "Player" },
    { key: null, label: "POS", align: "text-center", tooltip: "Position" },
    { key: "goals", label: "G", align: "text-right", tooltip: "Goals" },
    { key: "shots", label: "SH", align: "text-right", tooltip: "Shots" },
    { key: "shots_on_target", label: "OT", align: "text-right", tooltip: "Shots on Target" },
    { key: "assists", label: "A", align: "text-right", tooltip: "Assists" },
    { key: "second_assists", label: "2ND", align: "text-right", tooltip: "Second Assists" },
    { key: "key_passes", label: "KP", align: "text-right", tooltip: "Key Passes" },
    { key: "chances_created", label: "CC", align: "text-right", tooltip: "Chances Created" },
    { key: "passes", label: "PAS", align: "text-right", tooltip: "Passes" },
    { key: "passes_completed", label: "CMP", align: "text-right", tooltip: "Passes Completed" },
    { key: "pass_pct", label: "%", align: "text-right", tooltip: "Pass Accuracy %" },
    { key: "possession", label: "POS%", align: "text-right", tooltip: "Ball Possession %" },
    { key: "interceptions", label: "INT", align: "text-right", tooltip: "Interceptions" },
    { key: "saves", label: "SVS", align: "text-right", tooltip: "Saves" },
    { key: "xg", label: "xG", align: "text-right", tooltip: "Expected Goals (xG)" },
  ];

  const extraCols: { key: SortKey | null; label: string; align: string; tooltip: string }[] = [
    { key: "offsides", label: "OFF", align: "text-right", tooltip: "Offsides" },
    { key: "distance_run", label: "DIST", align: "text-right", tooltip: "Distance Run" },
    { key: "fouls", label: "FLS", align: "text-right", tooltip: "Fouls Committed" },
    { key: "corners", label: "CRN", align: "text-right", tooltip: "Corners" },
    { key: "throw_ins", label: "TI", align: "text-right", tooltip: "Throw-ins" },
    { key: "free_kicks", label: "FK", align: "text-right", tooltip: "Free Kicks" },
    { key: "penalties", label: "PEN", align: "text-right", tooltip: "Penalties" },
    { key: "yellow_cards", label: "YC", align: "text-right", tooltip: "Yellow Cards" },
    { key: "red_cards", label: "RC", align: "text-right", tooltip: "Red Cards" },
  ];

  const cols = showMore ? [...baseCols, ...extraCols] : baseCols;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 flex flex-wrap items-center gap-x-2 gap-y-1">
          {team.logo && <img src={team.logo} alt="" className="w-5 h-5 object-contain" />}
          {team.label}
          {team.avgRating != null && Number.isFinite(team.avgRating) && (
            <span className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold text-black dark:text-chalk-100 ${team.avgBadgeClass}`}>
              AVG {team.avgRating.toFixed(2)}
            </span>
          )}
          {team.avgHint && (
            <span className="basis-full sm:basis-auto text-[10px] font-mono text-slate-600 dark:text-chalk-400 uppercase tracking-wide">
              {team.avgHint}
            </span>
          )}
        </h2>
        <button onClick={() => setShowMore(!showMore)}
          className="text-xs font-mono text-[#F4119E] hover:text-[#F4119E]/70 transition-colors cursor-pointer">
          {showMore ? "SHOW FEWER STATS" : "SHOW MORE STATS"}
        </button>
      </div>
      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-chalk-100/8">
              {cols.map((col, ci) => (
                <th key={ci}
                  title={col.tooltip}
                  className={`${ci === 0 ? "px-3 min-w-[120px]" : ci === 1 ? "px-2 min-w-[36px]" : "px-2"} py-2 font-mono text-chalk-400 ${col.align} ${col.key ? "cursor-pointer hover:text-chalk-200 select-none transition-colors" : ""}`}
                  onClick={col.key ? () => handleSort(col.key as SortKey) : undefined}>
                  {col.label}
                  {col.key && sortKey === col.key && <span className={`ml-0.5 ${sortAsc ? "text-grass-500" : "text-red-400"}`}>{sortAsc ? "\u25B2" : "\u25BC"}</span>}
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
                  case "possession": return <span className="text-chalk-300">{totalPossession > 0 && p.possession > 0 ? (p.possession / totalPossession * 100).toFixed(1) + "%" : "-"}</span>;
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
                  case "xg": return <span className={pxg > 0 ? "text-chalk-300" : "text-chalk-400"}>{pxg > 0 ? pxg.toFixed(2) : "-"}</span>;
                  default: return null;
                }
              };

              return (
                <tr key={p.player_steam_id}
                  className={`${idx % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"} hover:bg-chalk-100/8 transition-colors cursor-pointer`}
                  onClick={() => router.push(`/players/${encodeURIComponent(p.profile_steam_id || p.player_steam_id)}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/players/${encodeURIComponent(p.profile_steam_id || p.player_steam_id)}`);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open profile for ${p.username}`}
                >
                  <td className="px-3 py-2 overflow-hidden">
                    <div className="flex items-center gap-1 min-w-0">
                      <Link
                        href={`/players/${encodeURIComponent(p.profile_steam_id || p.player_steam_id)}`}
                        className="font-body font-medium text-chalk-100 hover:text-[#F4119E] transition-colors truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.username}
                      </Link>
                      {p.is_sub && (
                        <span className="shrink-0 text-[#F4119E] text-[11px]" title="Substitute">&#x25B6;</span>
                      )}
                    </div>
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
