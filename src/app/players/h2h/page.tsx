import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { proxyImg } from "@/lib/img";
import { getSteamAvatar } from "@/lib/steam-avatar";
import { getRelatedSteamIds } from "@/lib/player-aliases";
import { PlayerH2HPicker } from "./PlayerH2HPicker";
import { H2HStatSlider, type StatPage } from "../../teams/h2h/H2HStatSlider";
import { PlayerAvatar } from "./PlayerAvatar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const P1_COLOR = "#4ade80";
const P2_COLOR = "#f87171";

type TeamColorRow = { color: string | null };

const SERVER_FLAGS: Record<string, string> = {
  fr: "\u{1F1EB}\u{1F1F7}", de: "\u{1F1E9}\u{1F1EA}", uk: "\u{1F1EC}\u{1F1E7}", gb: "\u{1F1EC}\u{1F1E7}",
  us: "\u{1F1FA}\u{1F1F8}", br: "\u{1F1E7}\u{1F1F7}", es: "\u{1F1EA}\u{1F1F8}", it: "\u{1F1EE}\u{1F1F9}",
  nl: "\u{1F1F3}\u{1F1F1}", pl: "\u{1F1F5}\u{1F1F1}", ru: "\u{1F1F7}\u{1F1FA}", ar: "\u{1F1E6}\u{1F1F7}",
  au: "\u{1F1E6}\u{1F1FA}", se: "\u{1F1F8}\u{1F1EA}", no: "\u{1F1F3}\u{1F1F4}", fi: "\u{1F1EB}\u{1F1EE}",
  pt: "\u{1F1F5}\u{1F1F9}", eu: "\u{1F1EA}\u{1F1FA}",
};

function getServerFlag(server: string | null): string {
  if (!server) return "-";
  const lower = server.toLowerCase();
  for (const [code, flag] of Object.entries(SERVER_FLAGS)) {
    if (lower.includes(`[${code}]`) || lower.includes(`[${code}/`) || lower.includes(`/${code}]`)) return flag;
  }
  return "-";
}

type PlayerInfo = {
  steam_id: string;
  username: string;
  avatar: string | null;
  avatar_updated_at: Date | null;
};

type PlayerH2HStats = {
  apps: bigint;
  wins: bigint;
  draws: bigint;
  losses: bigint;
  goals: bigint;
  assists: bigint;
  shots: bigint;
  shots_on_target: bigint;
  passes: bigint;
  passes_completed: bigint;
  key_passes: bigint;
  saves: bigint;
  goals_conceded: bigint;
  interceptions: bigint;
  yellow_cards: bigint;
  red_cards: bigint;
  fouls: bigint;
};

type H2HPlayerMatch = {
  match_id: number;
  date: Date;
  home_team: string;
  away_team: string;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  home_logo: string | null;
  away_logo: string | null;
  match_type: string;
  p1_side: string | null;
  potm: string | null;
  potm_steam_id: string | null;
  server: string | null;
};

export default async function PlayerH2HPage({
  searchParams,
}: {
  searchParams: Promise<{ p1?: string; p2?: string; page?: string }>;
}) {
  const { p1: p1Param, p2: p2Param, page: pageParam } = await searchParams;

  // ── PICKER VIEW ──────────────────────────────────────────────────────
  if (!p1Param || !p2Param) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            HEAD 2 HEAD
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            Select two players to compare their stats in shared matches
          </p>
        </div>
        <PlayerH2HPicker />
      </div>
    );
  }

  const p1SteamId = decodeURIComponent(p1Param);
  const p2SteamId = decodeURIComponent(p2Param);

  if (p1SteamId === p2SteamId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-chalk-400 font-mono text-sm">
        Cannot compare a player with themselves.{" "}
        <Link href="/players/h2h" className="text-[#F4119E] hover:underline">Go back</Link>
      </div>
    );
  }

  // ── RESULTS VIEW ──────────────────────────────────────────────────────
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Resolve aliases for both players in parallel
  const [p1Ids, p2Ids] = await Promise.all([
    getRelatedSteamIds(p1SteamId),
    getRelatedSteamIds(p2SteamId),
  ]);

  // Run all queries in parallel
  const [
    p1InfoArr,
    p2InfoArr,
    [{ total: totalRaw }],
    [p1Stats],
    [p2Stats],
    matches,
    p1TeamArr,
    p2TeamArr,
  ] = await Promise.all([
    prisma.$queryRaw<PlayerInfo[]>`
      SELECT steam_id, username, avatar, avatar_updated_at FROM players WHERE steam_id = ${p1SteamId} LIMIT 1
    `,
    prisma.$queryRaw<PlayerInfo[]>`
      SELECT steam_id, username, avatar, avatar_updated_at FROM players WHERE steam_id = ${p2SteamId} LIMIT 1
    `,
    prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(DISTINCT m.id) AS total
      FROM matches m
      WHERE EXISTS (
        SELECT 1 FROM match_player_stats mps1
        JOIN match_player_stats mps2
          ON mps2.match_id = mps1.match_id AND mps2.team_side != mps1.team_side
        WHERE mps1.match_id = m.id
          AND mps1.player_steam_id = ANY(${p1Ids})
          AND mps2.player_steam_id = ANY(${p2Ids})
      )
    `,
    prisma.$queryRaw<[PlayerH2HStats]>`
      SELECT
        COUNT(DISTINCT mps.match_id)::bigint AS apps,
        COUNT(CASE WHEN
          (mps.team_side = 'home' AND m.home_score > m.away_score) OR
          (mps.team_side = 'away' AND m.away_score > m.home_score)
        THEN 1 END)::bigint AS wins,
        COUNT(CASE WHEN m.home_score = m.away_score THEN 1 END)::bigint AS draws,
        COUNT(CASE WHEN
          (mps.team_side = 'home' AND m.home_score < m.away_score) OR
          (mps.team_side = 'away' AND m.away_score < m.home_score)
        THEN 1 END)::bigint AS losses,
        COALESCE(SUM(mps.goals), 0)::bigint AS goals,
        COALESCE(SUM(mps.assists), 0)::bigint AS assists,
        COALESCE(SUM(mps.shots), 0)::bigint AS shots,
        COALESCE(SUM(mps.shots_on_target), 0)::bigint AS shots_on_target,
        COALESCE(SUM(mps.passes), 0)::bigint AS passes,
        COALESCE(SUM(mps.passes_completed), 0)::bigint AS passes_completed,
        COALESCE(SUM(COALESCE(mps.key_passes, 0)), 0)::bigint AS key_passes,
        COALESCE(SUM(mps.saves), 0)::bigint AS saves,
        COALESCE(SUM(mps.goals_conceded), 0)::bigint AS goals_conceded,
        COALESCE(SUM(mps.interceptions), 0)::bigint AS interceptions,
        COALESCE(SUM(mps.yellow_cards), 0)::bigint AS yellow_cards,
        COALESCE(SUM(mps.red_cards), 0)::bigint AS red_cards,
        COALESCE(SUM(mps.fouls), 0)::bigint AS fouls
      FROM match_player_stats mps
      JOIN matches m ON m.id = mps.match_id
      WHERE mps.player_steam_id = ANY(${p1Ids})
        AND EXISTS (
          SELECT 1 FROM match_player_stats mps2
          WHERE mps2.match_id = mps.match_id
            AND mps2.player_steam_id = ANY(${p2Ids})
            AND mps2.team_side != mps.team_side
        )
    `,
    prisma.$queryRaw<[PlayerH2HStats]>`
      SELECT
        COUNT(DISTINCT mps.match_id)::bigint AS apps,
        COUNT(CASE WHEN
          (mps.team_side = 'home' AND m.home_score > m.away_score) OR
          (mps.team_side = 'away' AND m.away_score > m.home_score)
        THEN 1 END)::bigint AS wins,
        COUNT(CASE WHEN m.home_score = m.away_score THEN 1 END)::bigint AS draws,
        COUNT(CASE WHEN
          (mps.team_side = 'home' AND m.home_score < m.away_score) OR
          (mps.team_side = 'away' AND m.away_score < m.home_score)
        THEN 1 END)::bigint AS losses,
        COALESCE(SUM(mps.goals), 0)::bigint AS goals,
        COALESCE(SUM(mps.assists), 0)::bigint AS assists,
        COALESCE(SUM(mps.shots), 0)::bigint AS shots,
        COALESCE(SUM(mps.shots_on_target), 0)::bigint AS shots_on_target,
        COALESCE(SUM(mps.passes), 0)::bigint AS passes,
        COALESCE(SUM(mps.passes_completed), 0)::bigint AS passes_completed,
        COALESCE(SUM(COALESCE(mps.key_passes, 0)), 0)::bigint AS key_passes,
        COALESCE(SUM(mps.saves), 0)::bigint AS saves,
        COALESCE(SUM(mps.goals_conceded), 0)::bigint AS goals_conceded,
        COALESCE(SUM(mps.interceptions), 0)::bigint AS interceptions,
        COALESCE(SUM(mps.yellow_cards), 0)::bigint AS yellow_cards,
        COALESCE(SUM(mps.red_cards), 0)::bigint AS red_cards,
        COALESCE(SUM(mps.fouls), 0)::bigint AS fouls
      FROM match_player_stats mps
      JOIN matches m ON m.id = mps.match_id
      WHERE mps.player_steam_id = ANY(${p2Ids})
        AND EXISTS (
          SELECT 1 FROM match_player_stats mps2
          WHERE mps2.match_id = mps.match_id
            AND mps2.player_steam_id = ANY(${p1Ids})
            AND mps2.team_side != mps.team_side
        )
    `,
    prisma.$queryRaw<H2HPlayerMatch[]>`
      SELECT
        m.id AS match_id,
        m.date,
        th.name AS home_team,
        ta.name AS away_team,
        m.home_team_id,
        m.away_team_id,
        m.home_score,
        m.away_score,
        th.logo AS home_logo,
        ta.logo AS away_logo,
        m.match_type,
        (SELECT team_side FROM match_player_stats
         WHERE match_id = m.id AND player_steam_id = ANY(${p1Ids}) LIMIT 1) AS p1_side,
        m.potm,
        (SELECT p.steam_id FROM players p WHERE LOWER(p.username) = LOWER(m.potm) LIMIT 1) AS potm_steam_id,
        m.server
      FROM matches m
      JOIN teams th ON th.id = m.home_team_id
      JOIN teams ta ON ta.id = m.away_team_id
      WHERE EXISTS (
        SELECT 1 FROM match_player_stats mps1
        JOIN match_player_stats mps2
          ON mps2.match_id = mps1.match_id AND mps2.team_side != mps1.team_side
        WHERE mps1.match_id = m.id
          AND mps1.player_steam_id = ANY(${p1Ids})
          AND mps2.player_steam_id = ANY(${p2Ids})
      )
      ORDER BY m.date DESC, m.id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `,
    prisma.$queryRaw<TeamColorRow[]>`
      SELECT t.color FROM transfers tr
      JOIN teams t ON t.id = tr.to_team_id
      WHERE tr.player_steam_id = ANY(${p1Ids})
        AND tr.type = 'join'
        AND t.inactive = false
        AND t.team_type = 1
        AND t.name NOT IN ('IOSoccer All', 'IOSoccer Overlap', 'IOSoccer Challenge', 'IOSoccer Premier')
        AND NOT EXISTS (
          SELECT 1 FROM transfers tr2
          WHERE tr2.player_steam_id = tr.player_steam_id
            AND tr2.from_team_id = tr.to_team_id
            AND tr2.type = 'leave'
            AND tr2.date > tr.date
        )
      ORDER BY tr.date DESC LIMIT 1
    `,
    prisma.$queryRaw<TeamColorRow[]>`
      SELECT t.color FROM transfers tr
      JOIN teams t ON t.id = tr.to_team_id
      WHERE tr.player_steam_id = ANY(${p2Ids})
        AND tr.type = 'join'
        AND t.inactive = false
        AND t.team_type = 1
        AND t.name NOT IN ('IOSoccer All', 'IOSoccer Overlap', 'IOSoccer Challenge', 'IOSoccer Premier')
        AND NOT EXISTS (
          SELECT 1 FROM transfers tr2
          WHERE tr2.player_steam_id = tr.player_steam_id
            AND tr2.from_team_id = tr.to_team_id
            AND tr2.type = 'leave'
            AND tr2.date > tr.date
        )
      ORDER BY tr.date DESC LIMIT 1
    `,
  ]);

  const p1Info = p1InfoArr[0];
  const p2Info = p2InfoArr[0];

  if (!p1Info || !p2Info) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-chalk-400 font-mono text-sm">
        One or both players not found.{" "}
        <Link href="/players/h2h" className="text-[#F4119E] hover:underline">Go back</Link>
      </div>
    );
  }

  // P1/P2 colors are fixed (green/red) to ensure visual distinction even for same-team players

  const totalMatches = Number(totalRaw);
  const totalPages = Math.ceil(totalMatches / PAGE_SIZE);

  const n = (v: bigint) => Number(v);

  const p1Wins  = n(p1Stats.wins);
  const p2Wins  = n(p2Stats.wins);
  const p1Draws = n(p1Stats.draws);

  const statPages: StatPage[] = [
    {
      title: "Overview",
      bars: [
        { label: "Wins",    val1: p1Wins,            val2: p2Wins },
        { label: "Goals",   val1: n(p1Stats.goals),   val2: n(p2Stats.goals) },
        { label: "Assists", val1: n(p1Stats.assists),  val2: n(p2Stats.assists) },
      ],
    },
    {
      title: "Shooting",
      bars: [
        { label: "Goals",           val1: n(p1Stats.goals),           val2: n(p2Stats.goals) },
        { label: "Shots",           val1: n(p1Stats.shots),           val2: n(p2Stats.shots) },
        { label: "Shots on Target", val1: n(p1Stats.shots_on_target), val2: n(p2Stats.shots_on_target) },
      ],
    },
    {
      title: "Passing",
      bars: [
        { label: "Assists",           val1: n(p1Stats.assists),           val2: n(p2Stats.assists) },
        { label: "Passes",            val1: n(p1Stats.passes),            val2: n(p2Stats.passes) },
        { label: "Passes Completed",  val1: n(p1Stats.passes_completed),  val2: n(p2Stats.passes_completed) },
        { label: "Key Passes",        val1: n(p1Stats.key_passes),        val2: n(p2Stats.key_passes) },
      ],
    },
    {
      title: "Defending",
      bars: [
        { label: "Interceptions",  val1: n(p1Stats.interceptions),  val2: n(p2Stats.interceptions) },
        { label: "Saves",          val1: n(p1Stats.saves),          val2: n(p2Stats.saves) },
        { label: "Goals Conceded", val1: n(p1Stats.goals_conceded), val2: n(p2Stats.goals_conceded) },
      ],
    },
    {
      title: "Discipline",
      bars: [
        { label: "Yellow Cards", val1: n(p1Stats.yellow_cards), val2: n(p2Stats.yellow_cards) },
        { label: "Red Cards",    val1: n(p1Stats.red_cards),    val2: n(p2Stats.red_cards) },
        { label: "Fouls",        val1: n(p1Stats.fouls),        val2: n(p2Stats.fouls) },
      ],
    },
  ];

  const [avatar1, avatar2] = await Promise.all([
    getSteamAvatar(p1Info.steam_id, p1Info.avatar, p1Info.avatar_updated_at),
    getSteamAvatar(p2Info.steam_id, p2Info.avatar, p2Info.avatar_updated_at),
  ]);

  function paginationHref(p: number) {
    return `/players/h2h?p1=${encodeURIComponent(p1SteamId)}&p2=${encodeURIComponent(p2SteamId)}&page=${p}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-2">
        <Link
          href="/players/h2h"
          className="text-[10px] font-mono text-chalk-500 hover:text-[#F4119E] transition-colors uppercase tracking-widest"
        >
          ← Head 2 Head
        </Link>
      </div>

      {/* Player comparison header */}
      <div
        className="rounded-xl border border-chalk-100/8 overflow-hidden mb-6"
        style={{ background: `linear-gradient(to right, ${P1_COLOR}25, transparent 40%, transparent 60%, ${P2_COLOR}25)` }}
      >
        <div className="flex items-center justify-between p-6 gap-4">
          {/* Player 1 */}
          <Link href={`/players/${p1SteamId}`} className="flex flex-col items-center gap-2 flex-1 min-w-0 group">
            <PlayerAvatar src={avatar1} username={p1Info.username} color={P1_COLOR} />
            <span className="text-sm font-body font-600 text-chalk-100 text-center group-hover:text-[#F4119E] transition-colors truncate w-full px-2">
              {p1Info.username}
            </span>
          </Link>

          {/* Center score */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-display font-800 text-4xl" style={{ color: P1_COLOR }}>{p1Wins}</span>
              <span className="font-mono text-xl text-chalk-500">-</span>
              <span className="font-display font-800 text-4xl text-chalk-400">{p1Draws}</span>
              <span className="font-mono text-xl text-chalk-500">-</span>
              <span className="font-display font-800 text-4xl" style={{ color: P2_COLOR }}>{p2Wins}</span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-chalk-500">
              {totalMatches} {totalMatches === 1 ? "shared match" : "shared matches"}
            </span>
            <div className="flex items-center gap-3 text-[9px] font-mono text-chalk-500 uppercase tracking-wider">
              <span style={{ color: P1_COLOR }}>W</span>
              <span className="text-chalk-500">D</span>
              <span style={{ color: P2_COLOR }}>W</span>
            </div>
          </div>

          {/* Player 2 */}
          <Link href={`/players/${p2SteamId}`} className="flex flex-col items-center gap-2 flex-1 min-w-0 group">
            <PlayerAvatar src={avatar2} username={p2Info.username} color={P2_COLOR} />
            <span className="text-sm font-body font-600 text-chalk-100 text-center group-hover:text-[#56a3ff] transition-colors truncate w-full px-2">
              {p2Info.username}
            </span>
          </Link>
        </div>
      </div>

      {totalMatches === 0 ? (
        <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-8 text-center text-sm font-mono text-chalk-400">
          These two players have no shared matches.
        </div>
      ) : (
        <>
          {/* Stats slider */}
          <H2HStatSlider pages={statPages} color1={P1_COLOR} color2={P2_COLOR} />

          {/* Match list */}
          <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-hidden mb-4">
            <div className="grid grid-cols-[190px_1fr_95px_210px_90px] gap-2 px-4 py-3 border-b border-chalk-100/12 text-[11px] font-mono text-chalk-400 uppercase tracking-wide">
              <div>Date</div>
              <div>Match</div>
              <div>Type</div>
              <div>POTM</div>
              <div>Location</div>
            </div>
            <div className="divide-y divide-chalk-100/20">
              {matches.map((m) => {
                const isDraw = m.home_score === m.away_score;
                const p1Won = !isDraw && !!m.p1_side && (m.p1_side === "home" ? m.home_score > m.away_score : m.away_score > m.home_score);
                const p2Won = !isDraw && !p1Won;
                const rowBg = isDraw ? "#2B3443" : p1Won ? `${P1_COLOR}35` : `${P2_COLOR}35`;
                const rowBorderColor = isDraw ? "#666" : p1Won ? P1_COLOR : P2_COLOR;

                return (
                  <div
                    key={m.match_id}
                    className={`relative grid grid-cols-[190px_1fr_95px_210px_90px] items-center gap-2 px-4 py-2.5 hover:brightness-125 transition border-l-2`}
                    style={{ backgroundColor: rowBg, borderLeftColor: rowBorderColor }}
                  >
                    <Link href={`/matches/${m.match_id}`} className="absolute inset-0 z-0" />

                    {/* Date */}
                    <div className="relative z-10 flex items-center gap-2 pointer-events-none">
                      <span className="text-xs font-mono text-chalk-400">
                        {new Date(m.date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-[10px] font-mono text-chalk-500">
                        {new Date(m.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Match */}
                    <div className="relative z-10 font-body text-sm text-chalk-200 flex items-center gap-1.5 min-w-0">
                      <Link href={`/teams/${m.home_team_id}`} className="flex items-center gap-1 hover:text-[#F4119E] transition-colors min-w-0">
                        {m.home_logo && (
                          <img src={proxyImg(m.home_logo)!} alt="" className="w-5 h-5 object-contain inline-block shrink-0" />
                        )}
                        <span className="truncate">{m.home_team}</span>
                      </Link>
                      <span className="font-mono text-sm text-chalk-100 mx-1 whitespace-nowrap pointer-events-none shrink-0">
                        {m.home_score}&ndash;{m.away_score}
                      </span>
                      <Link href={`/teams/${m.away_team_id}`} className="flex items-center gap-1 hover:text-[#F4119E] transition-colors min-w-0">
                        {m.away_logo && (
                          <img src={proxyImg(m.away_logo)!} alt="" className="w-5 h-5 object-contain inline-block shrink-0" />
                        )}
                        <span className="truncate">{m.away_team}</span>
                      </Link>
                    </div>

                    {/* Type */}
                    <div className="relative z-10 text-xs font-mono uppercase pointer-events-none">
                      <span className={m.match_type === "competitive" ? "text-yellow-400" : "text-chalk-300"}>
                        {m.match_type === "competitive" ? "comp" : "friendly"}
                      </span>
                    </div>

                    {/* POTM */}
                    <div className="relative z-10 text-xs font-body truncate pointer-events-none">
                      {m.potm ? (
                        m.potm_steam_id ? (
                          <Link href={`/players/${m.potm_steam_id}`} className="text-[#56a3ff] hover:text-[#F4119E] transition-colors pointer-events-auto">
                            {m.potm}
                          </Link>
                        ) : (
                          <span className="text-[#56a3ff]">{m.potm}</span>
                        )
                      ) : "-"}
                    </div>

                    {/* Location */}
                    <div className="relative z-10 text-sm font-mono text-chalk-200 pointer-events-none">
                      {getServerFlag(m.server)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs font-mono text-chalk-400">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                {currentPage > 1 && (
                  <Link
                    href={paginationHref(1)}
                    className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                  >
                    &laquo;
                  </Link>
                )}
                {currentPage > 1 && (
                  <Link
                    href={paginationHref(Math.max(1, currentPage - 10))}
                    className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                  >
                    &lt;
                  </Link>
                )}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (currentPage <= 3) p = i + 1;
                  else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
                  else p = currentPage - 2 + i;
                  return (
                    <Link
                      key={p}
                      href={paginationHref(p)}
                      className={`w-8 h-8 rounded text-xs font-mono transition-colors flex items-center justify-center ${
                        p === currentPage
                          ? "bg-[#F4119E] text-white font-700"
                          : "text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30"
                      }`}
                    >
                      {p}
                    </Link>
                  );
                })}
                {currentPage < totalPages && (
                  <Link
                    href={paginationHref(Math.min(totalPages, currentPage + 10))}
                    className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                  >
                    &gt;
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={paginationHref(totalPages)}
                    className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                  >
                    &raquo;
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
