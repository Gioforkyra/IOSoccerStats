"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect, useRef } from "react";
import type { Ref } from "react";
import type { MatchExtraEvent, MatchPlayer, MatchShot } from "./page";

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

type SortKey = "goals" | "assists" | "second_assists" | "shots" | "shots_on_target" | "passes" | "passes_completed" | "pass_pct" | "key_passes" | "chances_created" | "interceptions" | "saves" | "offsides" | "fouls" | "fouls_suffered" | "yellow_cards" | "red_cards" | "own_goals" | "goals_conceded" | "corners" | "throw_ins" | "free_kicks" | "goal_kicks" | "penalties" | "distance_run" | "xg";

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
  const showLineups = false;

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
        <div className="flex items-center justify-between text-xs font-mono text-chalk-400 mb-5">
          <span>{match.date}{match.map && <> {" \u00B7 "}{match.map}</>}</span>
          {match.server && <span>{serverFlag && <>{serverFlag} </>}{match.server}</span>}
        </div>

        <div className="flex items-center justify-center gap-4 md:gap-6">
          <Link href={`/teams/${match.homeTeam.id}`} className="group flex items-center gap-3 md:gap-4 flex-1 justify-end">
            {match.homeTeam.logo && <img src={match.homeTeam.logo} alt="" className="w-20 h-20 md:w-28 md:h-28 object-contain shrink-0" />}
            <span className="font-display font-800 text-lg md:text-2xl text-chalk-100 group-hover:text-[#F4119E] transition-colors text-right">{match.homeTeam.name}</span>
          </Link>
          <div className="font-display font-900 text-3xl md:text-5xl flex items-center gap-3 shrink-0">
            <span className="text-chalk-100">{match.homeScore}</span>
            <span className="text-chalk-400/30 text-xl md:text-2xl">:</span>
            <span className="text-chalk-100">{match.awayScore}</span>
          </div>
          <Link href={`/teams/${match.awayTeam.id}`} className="group flex items-center gap-3 md:gap-4 flex-1">
            <span className="font-display font-800 text-lg md:text-2xl text-chalk-100 group-hover:text-[#F4119E] transition-colors">{match.awayTeam.name}</span>
            {match.awayTeam.logo && <img src={match.awayTeam.logo} alt="" className="w-20 h-20 md:w-28 md:h-28 object-contain shrink-0" />}
          </Link>
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
          <div className="text-center mt-4"><span className="text-xs font-mono text-amber-400">POTM: {match.potm}</span></div>
        )}
      </div>

      {showLineups && (
        <div className="mb-8">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-700 tracking-wider text-chalk-100">
                STARTING LINEUPS
              </h2>
              <p className="mt-1 text-xs font-body text-chalk-400">
                Vertical pitch view with starters separated from the bench.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <LineupGraphic players={homePlayers} teamName={match.homeTeam.name} teamLogo={match.homeTeam.logo} teamColor={match.homeTeam.color} />
            <LineupGraphic players={awayPlayers} teamName={match.awayTeam.name} teamLogo={match.awayTeam.logo} teamColor={match.awayTeam.color} />
          </div>
        </div>
      )}

      {/* Horizontal shot map ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â full width */}
      <div className="mb-6">
        <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">
          SHOT MAP <span className="text-xs text-pink-400 font-mono">{" \u00B7 "}xG by IOStats</span>
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
                <img src={match.homeTeam.logo} alt="" className="w-28 h-28 md:w-40 md:h-40 object-contain opacity-50 [filter:contrast(1.18)_brightness(1.08)]" />
              ) : (
                <span className="text-3xl font-display font-bold text-chalk-100/15">{match.homeTeam.name.slice(0, 3).toUpperCase()}</span>
              )}
            </div>
            <div className="absolute" style={{ left: "60%", bottom: "8%", transform: "translateX(-50%)" }}>
              {match.awayTeam.logo ? (
                <img src={match.awayTeam.logo} alt="" className="w-28 h-28 md:w-40 md:h-40 object-contain opacity-50 [filter:contrast(1.18)_brightness(1.08)]" />
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
              const px = Math.max(4, Math.min(96, ny * 92 + 4));
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
                    fontSize: "22px",
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
              const px = Math.max(4, Math.min(96, ny * 92 + 4));
              const py = Math.max(6, Math.min(94, nx * 88 + 6));
              const above = py > 50;
              const anchor = px > 84 ? 'right' : px < 16 ? 'left' : 'center';
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
                    <div className="max-w-[260px] bg-pitch-950/95 border border-chalk-100/15 rounded-lg px-3 py-2 text-xs font-mono whitespace-normal break-words shadow-lg">
                      <div className="font-medium text-chalk-100">{evt.extra!.username}</div>
                      <div className="flex items-center gap-2 mt-0.5">
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
                  <div className="max-w-[260px] bg-pitch-950/95 border border-chalk-100/15 rounded-lg px-3 py-2 text-xs font-mono whitespace-normal break-words shadow-lg">
                    <div className="font-medium text-chalk-100">{s.is_save ? getSaveKeeperName(s) : s.username}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={s.is_goal ? "text-green-400" : s.is_save ? "text-amber-400" : "text-red-400"}>
                        {s.is_goal ? "Goal" : s.is_save ? "Saved" : "Missed"}
                      </span>
                      <span className="text-pink-400">xG: {s.xg.toFixed(2)}</span>
                      {s.minute != null && <span className="text-chalk-400">{s.minute}&apos;</span>}
                    </div>
                    {s.is_goal && s.assist_username && (
                      <div className="text-chalk-400 mt-0.5">
                        Assist by {s.assist_username}
                      </div>
                    )}
                    {s.is_save && (
                      <div className="text-chalk-400 mt-0.5">
                        Shot by {s.username} - Saved by {getSaveKeeperName(s)}
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
              <button
                key={item.key}
                type="button"
                onClick={() => setVisibleMarkers((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors ${enabled ? "text-chalk-300" : "text-chalk-500/70"}`}
                title={`${enabled ? "Hide" : "Show"} ${item.label}`}
              >
                <span
                  className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${enabled ? "border-grass-400 bg-grass-500/20" : "border-chalk-500/70 bg-transparent"}`}
                  aria-hidden="true"
                >
                  <span className={`text-[10px] leading-none ${enabled ? "text-grass-400 opacity-100" : "opacity-0"}`}>{"✓"}</span>
                </span>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
          <span className="text-chalk-400/40 ml-2">Click for details</span>
        </div>
      </div>

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
        <SortablePlayerTable key={team.side} team={team} shots={shots} />
      ))}
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
  attack: MatchPlayer[];
  midfield: MatchPlayer[];
  defense: MatchPlayer[];
  goalkeepers: MatchPlayer[];
  substitutes: MatchPlayer[];
};

function getLineupRows(players: MatchPlayer[]): LineupRows {
  const goalkeepers: MatchPlayer[] = [];
  const defense: MatchPlayer[] = [];
  const midfield: MatchPlayer[] = [];
  const attack: MatchPlayer[] = [];
  const extra: MatchPlayer[] = [];

  const sorted = [...players].sort((a, b) => b.possession - a.possession);

  for (const player of sorted) {
    const position = (player.position || '').toUpperCase();

    if (position === 'GK') goalkeepers.push(player);
    else if (['LB', 'LCB', 'CB', 'RCB', 'RB', 'LWB', 'RWB'].includes(position)) defense.push(player);
    else if (['LM', 'LCM', 'CM', 'RCM', 'RM', 'CDM', 'CAM', 'DM', 'AM'].includes(position)) midfield.push(player);
    else if (position) attack.push(player);
    else extra.push(player);
  }

  const orderPlayers = (group: MatchPlayer[], order: string[], fallback: string) =>
    [...group].sort((left, right) => {
      const leftIndex = order.indexOf((left.position || fallback).toUpperCase());
      const rightIndex = order.indexOf((right.position || fallback).toUpperCase());
      const safeLeft = leftIndex === -1 ? order.length : leftIndex;
      const safeRight = rightIndex === -1 ? order.length : rightIndex;
      return safeLeft - safeRight;
    });

  const orderedAttack = orderPlayers(attack, ['LW', 'LF', 'ST', 'CF', 'RF', 'RW', 'CAM'], 'CF');
  const orderedMidfield = orderPlayers(midfield, ['LM', 'LCM', 'CM', 'CDM', 'CAM', 'RCM', 'RM'], 'CM');
  const orderedDefense = orderPlayers(defense, ['LWB', 'LB', 'LCB', 'CB', 'RCB', 'RB', 'RWB'], 'CB');

  const attackRow = orderedAttack.slice(0, 3);
  const midfieldRow = orderedMidfield.slice(0, Math.max(1, Math.min(3, orderedMidfield.length)));
  const defenseRow = orderedDefense.slice(0, 3);
  const goalkeeperRow = goalkeepers.slice(0, 1);

  const substitutes = [
    ...orderedAttack.slice(attackRow.length),
    ...orderedMidfield.slice(midfieldRow.length),
    ...orderedDefense.slice(defenseRow.length),
    ...goalkeepers.slice(goalkeeperRow.length),
    ...extra,
  ];

  if (goalkeeperRow.length === 0 && substitutes.length > 0) goalkeeperRow.push(substitutes.shift()!);
  if (defenseRow.length === 0 && substitutes.length > 0) defenseRow.push(substitutes.shift()!);
  if (midfieldRow.length === 0 && substitutes.length > 0) midfieldRow.push(substitutes.shift()!);
  if (attackRow.length === 0 && substitutes.length > 0) attackRow.push(substitutes.shift()!);

  return {
    attack: attackRow,
    midfield: midfieldRow,
    defense: defenseRow,
    goalkeepers: goalkeeperRow,
    substitutes,
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

function ShirtIcon({
  color,
  label,
  faded,
}: {
  color: string;
  label: string;
  faded?: boolean;
}) {
  return (
    <div className={`relative h-[60px] w-[72px] ${faded ? 'opacity-70' : ''}`}>
      <svg viewBox="0 0 88 70" className="h-full w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.24)]">
        <path
          d="M25 8 37 2h14l12 6 13 17-10 8-9-6v38H31V27l-9 6-10-8Z"
          fill={color}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="pointer-events-none absolute inset-x-0 top-[22px] text-center font-display text-sm font-700 uppercase tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">
        {label}
      </span>
    </div>
  );
}

function PlayerCard({ p, shirtColor, isSub }: { p: MatchPlayer; shirtColor: string; isSub?: boolean }) {
  return (
    <Link
      href={`/players/${encodeURIComponent(p.profile_steam_id || p.player_steam_id)}`}
      className="group relative flex w-[92px] flex-col items-center"
    >
      <div className="relative">
        <ShirtIcon color={shirtColor} label={p.position || '?'} faded={isSub} />
        <div className="absolute -left-2 top-0 flex flex-col gap-1">
          {p.goals > 0 && <StatChip label={`G${p.goals}`} tone="goal" />}
          {p.red_cards > 0 && <StatChip label={`RC${p.red_cards}`} tone="danger" />}
        </div>
        <div className="absolute -right-2 top-0 flex flex-col gap-1">
          {p.assists > 0 && <StatChip label={`A${p.assists}`} tone="assist" />}
          {p.yellow_cards > 0 && <StatChip label={`YC${p.yellow_cards}`} tone="card" />}
        </div>
      </div>
      <span className="mt-2 max-w-full rounded-full bg-slate-950/88 px-2.5 py-1 text-center text-[10px] font-mono font-bold leading-tight text-white shadow-[0_8px_18px_rgba(0,0,0,0.24)] transition-colors group-hover:bg-slate-900">
        {p.username}
      </span>
    </Link>
  );
}

function FormationRow({
  players,
  top,
  shirtColor,
}: {
  players: MatchPlayer[];
  top: string;
  shirtColor: string;
}) {
  if (players.length === 0) return null;

  return (
    <div
      className="absolute left-0 right-0 flex -translate-y-1/2 justify-evenly gap-2 px-4"
      style={{ top }}
    >
      {players.map((player) => (
        <PlayerCard key={player.player_steam_id} p={player} shirtColor={shirtColor} />
      ))}
    </div>
  );
}

function LineupGraphic({
  players, teamName, teamLogo, teamColor,
}: {
  players: MatchPlayer[]; teamName: string; teamLogo: string | null; teamColor: string | null;
}) {
  const lineup = getLineupRows(players);
  const shirtColor = teamColor || '#111827';

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#f3f5f7] shadow-[0_28px_70px_rgba(0,0,0,0.24)]">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-4">
        {teamLogo ? (
          <img src={teamLogo} alt="" className="h-10 w-10 object-contain" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-display text-sm font-700 uppercase text-slate-700">
            {teamName.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">
            Starting Lineup
          </div>
          <div className="truncate font-display text-2xl font-700 uppercase tracking-wide text-slate-900">
            {teamName}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate-500">
            Bench
          </div>
          <div className="font-display text-xl font-700 text-slate-900">
            {lineup.substitutes.length}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div
          className="relative h-[620px] overflow-hidden rounded-[24px] border-4 border-white/90 bg-[#4b8b3f]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 56px, rgba(255,255,255,0.03) 56px, rgba(255,255,255,0.03) 112px)',
          }}
        >
          <div className="absolute inset-[10px] rounded-[18px] border-[3px] border-white/90" />
          <div className="absolute left-[10px] right-[10px] top-1/2 h-[3px] -translate-y-1/2 bg-white/90" />
          <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/90" />
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />
          <div className="absolute left-1/2 top-[10px] h-[96px] w-[150px] -translate-x-1/2 rounded-b-[18px] border-[3px] border-t-0 border-white/90" />
          <div className="absolute left-1/2 top-[10px] h-[44px] w-[70px] -translate-x-1/2 rounded-b-[10px] border-[3px] border-t-0 border-white/90" />
          <div className="absolute left-1/2 top-[98px] h-12 w-24 -translate-x-1/2 rounded-full border-[3px] border-white/90 border-t-0 opacity-90" />
          <div className="absolute left-1/2 bottom-[10px] h-[96px] w-[150px] -translate-x-1/2 rounded-t-[18px] border-[3px] border-b-0 border-white/90" />
          <div className="absolute left-1/2 bottom-[10px] h-[44px] w-[70px] -translate-x-1/2 rounded-t-[10px] border-[3px] border-b-0 border-white/90" />
          <div className="absolute left-1/2 bottom-[98px] h-12 w-24 -translate-x-1/2 rounded-full border-[3px] border-white/90 border-b-0 opacity-90" />
          <div className="absolute left-0 top-0 h-5 w-5 rounded-br-[18px] border-b-[3px] border-r-[3px] border-white/90" />
          <div className="absolute right-0 top-0 h-5 w-5 rounded-bl-[18px] border-b-[3px] border-l-[3px] border-white/90" />
          <div className="absolute bottom-0 left-0 h-5 w-5 rounded-tr-[18px] border-r-[3px] border-t-[3px] border-white/90" />
          <div className="absolute bottom-0 right-0 h-5 w-5 rounded-tl-[18px] border-l-[3px] border-t-[3px] border-white/90" />

          <FormationRow players={lineup.attack} top="18%" shirtColor={shirtColor} />
          <FormationRow players={lineup.midfield} top="40%" shirtColor={shirtColor} />
          <FormationRow players={lineup.defense} top="63%" shirtColor={shirtColor} />
          <FormationRow players={lineup.goalkeepers} top="86%" shirtColor={shirtColor} />
        </div>

        {lineup.substitutes.length > 0 && (
          <div className="mt-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
              Substitutes
            </div>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {lineup.substitutes.map((player) => (
                <Link
                  key={player.player_steam_id}
                  href={`/players/${encodeURIComponent(player.profile_steam_id || player.player_steam_id)}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-body text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100"
                >
                  <span className="font-medium">{player.username}</span>
                  <span className="ml-2 font-mono text-[10px] uppercase text-slate-500">
                    {player.position || 'SUB'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortablePlayerTable({
  team, shots,
}: {
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
          {team.avgRating != null && Number.isFinite(team.avgRating) && (
            <span className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold text-black dark:text-chalk-100 ${team.avgBadgeClass}`}>
              AVG {team.avgRating.toFixed(2)}
            </span>
          )}
          {team.avgHint && (
            <span className="text-[10px] font-mono text-slate-600 dark:text-chalk-400 uppercase tracking-wide">
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
        <table className="w-full text-xs table-fixed">
          <thead>
            <tr className="border-b border-chalk-100/8">
              {cols.map((col, ci) => (
                <th key={ci}
                  className={`${ci === 0 ? "px-3 w-[140px]" : ci === 1 ? "px-2 w-[40px]" : "px-2"} py-2 font-mono text-chalk-400 ${col.align} ${col.key ? "cursor-pointer hover:text-chalk-200 select-none transition-colors" : ""}`}
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
