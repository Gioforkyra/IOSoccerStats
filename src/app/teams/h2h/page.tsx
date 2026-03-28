import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveTeams, badgeUrl } from "@/lib/iosoccer-api";
import { proxyImg } from "@/lib/img";
import { H2HPicker } from "./H2HPicker";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

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

type H2HMatch = {
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
  potm: string | null;
  potm_steam_id: string | null;
  server: string | null;
};

type H2HStats = {
  team1_wins: bigint;
  team2_wins: bigint;
  draws: bigint;
  team1_goals: bigint;
  team2_goals: bigint;
  team1_avg_possession: number | null;
  team2_avg_possession: number | null;
  team1_avg_passes: number | null;
  team2_avg_passes: number | null;
  team1_avg_passes_completed: number | null;
  team2_avg_passes_completed: number | null;
};

type TopPlayer = {
  steam_id: string;
  username: string;
  avatar: string | null;
  apps: bigint;
  goals: bigint;
  assists: bigint;
  wins: bigint;
};

type TeamRow = {
  id: number;
  name: string;
  logo: string | null;
  color: string | null;
};

function StatBar({
  label,
  val1,
  val2,
  color1,
  color2,
  format = (x: number) => x.toFixed(0),
}: {
  label: string;
  val1: number;
  val2: number;
  color1: string;
  color2: string;
  format?: (x: number) => string;
}) {
  const total = val1 + val2;
  const pct1 = total > 0 ? (val1 / total) * 100 : 50;
  const pct2 = total > 0 ? (val2 / total) * 100 : 50;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-sm font-700 text-chalk-100">{format(val1)}</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-chalk-400">{label}</span>
        <span className="font-mono text-sm font-700 text-chalk-100">{format(val2)}</span>
      </div>
      <div className="flex h-2 rounded overflow-hidden">
        <div style={{ width: `${pct1}%`, backgroundColor: color1 || "#F4119E" }} />
        <div style={{ width: `${pct2}%`, backgroundColor: color2 || "#56a3ff" }} />
      </div>
    </div>
  );
}

export default async function H2HPage({
  searchParams,
}: {
  searchParams: Promise<{ team1?: string; team2?: string; page?: string }>;
}) {
  const { team1: t1Param, team2: t2Param, page: pageParam } = await searchParams;
  const team1Id = t1Param ? parseInt(t1Param, 10) : null;
  const team2Id = t2Param ? parseInt(t2Param, 10) : null;

  // ── PICKER VIEW ────────────────────────────────────────────────────
  if (!team1Id || !team2Id || isNaN(team1Id) || isNaN(team2Id) || team1Id === team2Id) {
    let apiTeams: { id: number; name: string; logo: string | null; color: string | null }[] = [];
    try {
      const raw = await getActiveTeams(1, 1);
      raw.sort((a, b) => a.name.localeCompare(b.name));
      apiTeams = raw.map((t) => ({
        id: t.id,
        name: t.name,
        logo: badgeUrl(t.badgeImageId),
        color: t.color ?? null,
      }));
    } catch {
      // API unavailable
    }

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            HEAD 2 HEAD
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            Select two club teams to compare their head-to-head record
          </p>
        </div>
        <H2HPicker teams={apiTeams} />
      </div>
    );
  }

  // ── H2H RESULTS VIEW ───────────────────────────────────────────────
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Load team info from DB
  const [team1Row] = await prisma.$queryRaw<[TeamRow]>`
    SELECT id, name, logo, color FROM teams WHERE id = ${team1Id} LIMIT 1
  `;
  const [team2Row] = await prisma.$queryRaw<[TeamRow]>`
    SELECT id, name, logo, color FROM teams WHERE id = ${team2Id} LIMIT 1
  `;

  if (!team1Row || !team2Row) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-chalk-400 font-mono text-sm">
        One or both teams not found.{" "}
        <Link href="/teams/h2h" className="text-[#F4119E] hover:underline">Go back</Link>
      </div>
    );
  }

  const color1 = team1Row.color || "#F4119E";
  const color2 = team2Row.color || "#56a3ff";

  // Match count
  const [{ total: totalRaw }] = await prisma.$queryRaw<[{ total: bigint }]>`
    SELECT COUNT(*) AS total FROM matches
    WHERE (home_team_id = ${team1Id} AND away_team_id = ${team2Id})
       OR (home_team_id = ${team2Id} AND away_team_id = ${team1Id})
  `;
  const totalMatches = Number(totalRaw);
  const totalPages = Math.ceil(totalMatches / PAGE_SIZE);

  // H2H aggregate stats
  const [stats] = await prisma.$queryRaw<[H2HStats]>`
    SELECT
      COUNT(CASE WHEN (home_team_id = ${team1Id} AND home_score > away_score)
                   OR (away_team_id = ${team1Id} AND away_score > home_score) THEN 1 END) AS team1_wins,
      COUNT(CASE WHEN (home_team_id = ${team2Id} AND home_score > away_score)
                   OR (away_team_id = ${team2Id} AND away_score > home_score) THEN 1 END) AS team2_wins,
      COUNT(CASE WHEN home_score = away_score THEN 1 END) AS draws,
      SUM(CASE WHEN home_team_id = ${team1Id} THEN home_score ELSE away_score END) AS team1_goals,
      SUM(CASE WHEN home_team_id = ${team2Id} THEN home_score ELSE away_score END) AS team2_goals,
      AVG(CASE WHEN home_team_id = ${team1Id} THEN (mps_home.poss)
               WHEN away_team_id = ${team1Id} THEN (mps_away.poss) END) AS team1_avg_possession,
      AVG(CASE WHEN home_team_id = ${team2Id} THEN (mps_home.poss)
               WHEN away_team_id = ${team2Id} THEN (mps_away.poss) END) AS team2_avg_possession,
      AVG(CASE WHEN home_team_id = ${team1Id} THEN (mps_home.passes)
               WHEN away_team_id = ${team1Id} THEN (mps_away.passes) END) AS team1_avg_passes,
      AVG(CASE WHEN home_team_id = ${team2Id} THEN (mps_home.passes)
               WHEN away_team_id = ${team2Id} THEN (mps_away.passes) END) AS team2_avg_passes,
      AVG(CASE WHEN home_team_id = ${team1Id} THEN (mps_home.passes_completed)
               WHEN away_team_id = ${team1Id} THEN (mps_away.passes_completed) END) AS team1_avg_passes_completed,
      AVG(CASE WHEN home_team_id = ${team2Id} THEN (mps_home.passes_completed)
               WHEN away_team_id = ${team2Id} THEN (mps_away.passes_completed) END) AS team2_avg_passes_completed
    FROM matches m
    LEFT JOIN LATERAL (
      SELECT AVG(possession) AS poss, AVG(passes) AS passes, AVG(passes_completed) AS passes_completed
      FROM match_player_stats WHERE match_id = m.id AND team_side = 'home'
    ) mps_home ON true
    LEFT JOIN LATERAL (
      SELECT AVG(possession) AS poss, AVG(passes) AS passes, AVG(passes_completed) AS passes_completed
      FROM match_player_stats WHERE match_id = m.id AND team_side = 'away'
    ) mps_away ON true
    WHERE (home_team_id = ${team1Id} AND away_team_id = ${team2Id})
       OR (home_team_id = ${team2Id} AND away_team_id = ${team1Id})
  `;

  // Top players
  const topByApps = await prisma.$queryRaw<TopPlayer[]>`
    SELECT p.steam_id, p.username, p.avatar,
      COUNT(*) AS apps,
      SUM(mps.goals)::bigint AS goals,
      SUM(mps.assists)::bigint AS assists,
      COUNT(CASE WHEN (mps.team_side = 'home' AND m.home_score > m.away_score)
                   OR (mps.team_side = 'away' AND m.away_score > m.home_score) THEN 1 END) AS wins
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    JOIN players p ON p.steam_id = mps.player_steam_id
    WHERE (m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
       OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id})
    GROUP BY p.steam_id, p.username, p.avatar
    ORDER BY apps DESC, goals DESC
    LIMIT 10
  `;

  const topByGoals = await prisma.$queryRaw<TopPlayer[]>`
    SELECT p.steam_id, p.username, p.avatar,
      COUNT(*) AS apps,
      SUM(mps.goals)::bigint AS goals,
      SUM(mps.assists)::bigint AS assists,
      COUNT(CASE WHEN (mps.team_side = 'home' AND m.home_score > m.away_score)
                   OR (mps.team_side = 'away' AND m.away_score > m.home_score) THEN 1 END) AS wins
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    JOIN players p ON p.steam_id = mps.player_steam_id
    WHERE (m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
       OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id})
    GROUP BY p.steam_id, p.username, p.avatar
    ORDER BY goals DESC, apps DESC
    LIMIT 10
  `;

  const topByAssists = await prisma.$queryRaw<TopPlayer[]>`
    SELECT p.steam_id, p.username, p.avatar,
      COUNT(*) AS apps,
      SUM(mps.goals)::bigint AS goals,
      SUM(mps.assists)::bigint AS assists,
      COUNT(CASE WHEN (mps.team_side = 'home' AND m.home_score > m.away_score)
                   OR (mps.team_side = 'away' AND m.away_score > m.home_score) THEN 1 END) AS wins
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    JOIN players p ON p.steam_id = mps.player_steam_id
    WHERE (m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
       OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id})
    GROUP BY p.steam_id, p.username, p.avatar
    ORDER BY assists DESC, apps DESC
    LIMIT 10
  `;

  const topByWins = await prisma.$queryRaw<TopPlayer[]>`
    SELECT p.steam_id, p.username, p.avatar,
      COUNT(*) AS apps,
      SUM(mps.goals)::bigint AS goals,
      SUM(mps.assists)::bigint AS assists,
      COUNT(CASE WHEN (mps.team_side = 'home' AND m.home_score > m.away_score)
                   OR (mps.team_side = 'away' AND m.away_score > m.home_score) THEN 1 END) AS wins
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    JOIN players p ON p.steam_id = mps.player_steam_id
    WHERE (m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
       OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id})
    GROUP BY p.steam_id, p.username, p.avatar
    ORDER BY wins DESC, apps DESC
    LIMIT 10
  `;

  // Match list
  const matches = await prisma.$queryRaw<H2HMatch[]>`
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
      m.potm,
      (SELECT p.steam_id FROM players p WHERE LOWER(p.username) = LOWER(m.potm) LIMIT 1) AS potm_steam_id,
      m.server
    FROM matches m
    JOIN teams th ON th.id = m.home_team_id
    JOIN teams ta ON ta.id = m.away_team_id
    WHERE (m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
       OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id})
    ORDER BY m.date DESC, m.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  const t1Wins = Number(stats.team1_wins);
  const t2Wins = Number(stats.team2_wins);
  const draws = Number(stats.draws);
  const t1Goals = Number(stats.team1_goals ?? 0);
  const t2Goals = Number(stats.team2_goals ?? 0);
  const t1Poss = stats.team1_avg_possession ? Number(stats.team1_avg_possession) : 0;
  const t2Poss = stats.team2_avg_possession ? Number(stats.team2_avg_possession) : 0;
  const t1Passes = stats.team1_avg_passes ? Number(stats.team1_avg_passes) : 0;
  const t2Passes = stats.team2_avg_passes ? Number(stats.team2_avg_passes) : 0;
  const t1PC = stats.team1_avg_passes_completed ? Number(stats.team1_avg_passes_completed) : 0;
  const t2PC = stats.team2_avg_passes_completed ? Number(stats.team2_avg_passes_completed) : 0;

  const logo1 = proxyImg(team1Row.logo);
  const logo2 = proxyImg(team2Row.logo);

  function paginationHref(p: number) {
    return `/teams/h2h?team1=${team1Id}&team2=${team2Id}&page=${p}`;
  }

  function PlayerLeaderboard({
    title,
    players,
    valueKey,
    valueLabel,
  }: {
    title: string;
    players: TopPlayer[];
    valueKey: "apps" | "goals" | "assists" | "wins";
    valueLabel: string;
  }) {
    return (
      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-chalk-100/8 text-[10px] font-mono uppercase tracking-[0.2em] text-chalk-400">
          {title}
        </div>
        <div className="divide-y divide-chalk-100/5">
          {players.slice(0, 10).map((p, i) => (
            <div key={p.steam_id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="text-[10px] font-mono text-chalk-500 w-4 shrink-0">{i + 1}</span>
              {p.avatar ? (
                <img src={p.avatar} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded bg-pitch-700 shrink-0" />
              )}
              <Link
                href={`/players/${p.steam_id}`}
                className="flex-1 text-xs font-body text-chalk-200 truncate hover:text-[#F4119E] transition-colors"
              >
                {p.username}
              </Link>
              <span className="font-mono text-xs font-700 text-chalk-100 shrink-0">
                {String(p[valueKey])}
              </span>
              <span className="text-[9px] font-mono text-chalk-500 shrink-0">{valueLabel}</span>
            </div>
          ))}
          {players.length === 0 && (
            <div className="px-3 py-4 text-xs font-mono text-chalk-500 text-center">No data</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-2">
        <Link href="/teams/h2h" className="text-[10px] font-mono text-chalk-500 hover:text-[#F4119E] transition-colors uppercase tracking-widest">
          ← Head 2 Head
        </Link>
      </div>

      {/* Team comparison header */}
      <div
        className="rounded-xl border border-chalk-100/8 overflow-hidden mb-6"
        style={{ background: `linear-gradient(to right, ${color1}25, transparent 40%, transparent 60%, ${color2}25)` }}
      >
        <div className="flex items-center justify-between p-6 gap-4">
          {/* Team 1 */}
          <Link href={`/teams/${team1Id}`} className="flex flex-col items-center gap-2 flex-1 group">
            {logo1 ? (
              <img src={logo1} alt={team1Row.name} className="w-20 h-20 object-contain group-hover:scale-105 transition-transform" />
            ) : (
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center text-lg font-display font-700 text-chalk-300"
                style={{ backgroundColor: `${color1}40` }}
              >
                {team1Row.name.slice(0, 3).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-body font-600 text-chalk-100 text-center group-hover:text-[#F4119E] transition-colors">
              {team1Row.name}
            </span>
          </Link>

          {/* Center */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-display font-800 text-4xl" style={{ color: color1 }}>{t1Wins}</span>
              <span className="font-mono text-xl text-chalk-500">-</span>
              <span className="font-display font-800 text-4xl text-chalk-400">{draws}</span>
              <span className="font-mono text-xl text-chalk-500">-</span>
              <span className="font-display font-800 text-4xl" style={{ color: color2 }}>{t2Wins}</span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-chalk-500">
              {totalMatches} {totalMatches === 1 ? "match" : "matches"}
            </span>
            <div className="flex items-center gap-3 text-[9px] font-mono text-chalk-500 uppercase tracking-wider">
              <span style={{ color: color1 }}>W</span>
              <span className="text-chalk-500">D</span>
              <span style={{ color: color2 }}>W</span>
            </div>
          </div>

          {/* Team 2 */}
          <Link href={`/teams/${team2Id}`} className="flex flex-col items-center gap-2 flex-1 group">
            {logo2 ? (
              <img src={logo2} alt={team2Row.name} className="w-20 h-20 object-contain group-hover:scale-105 transition-transform" />
            ) : (
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center text-lg font-display font-700 text-chalk-300"
                style={{ backgroundColor: `${color2}40` }}
              >
                {team2Row.name.slice(0, 3).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-body font-600 text-chalk-100 text-center group-hover:text-[#F4119E] transition-colors">
              {team2Row.name}
            </span>
          </Link>
        </div>
      </div>

      {totalMatches === 0 ? (
        <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-8 text-center text-sm font-mono text-chalk-400">
          No matches found between these two teams.
        </div>
      ) : (
        <>
          {/* Stats bars */}
          <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-5 mb-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-4">
              H2H Statistics
            </div>
            <StatBar label="Match Wins" val1={t1Wins} val2={t2Wins} color1={color1} color2={color2} />
            <StatBar label="Total Goals" val1={t1Goals} val2={t2Goals} color1={color1} color2={color2} />
            {(t1Poss > 0 || t2Poss > 0) && (
              <StatBar label="Avg Possession %" val1={t1Poss} val2={t2Poss} color1={color1} color2={color2} format={(x) => x.toFixed(1) + "%"} />
            )}
            {(t1Passes > 0 || t2Passes > 0) && (
              <StatBar label="Avg Passes" val1={t1Passes} val2={t2Passes} color1={color1} color2={color2} format={(x) => x.toFixed(1)} />
            )}
            {(t1PC > 0 || t2PC > 0) && (
              <StatBar label="Avg Passes Completed" val1={t1PC} val2={t2PC} color1={color1} color2={color2} format={(x) => x.toFixed(1)} />
            )}
          </div>

          {/* Top players */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <PlayerLeaderboard title="Appearances" players={topByApps} valueKey="apps" valueLabel="apps" />
            <PlayerLeaderboard title="Goals" players={topByGoals} valueKey="goals" valueLabel="gls" />
            <PlayerLeaderboard title="Assists" players={topByAssists} valueKey="assists" valueLabel="ast" />
            <PlayerLeaderboard title="Wins" players={topByWins} valueKey="wins" valueLabel="w" />
          </div>

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
                const t1IsHome = m.home_team_id === team1Id;
                const t1Score = t1IsHome ? m.home_score : m.away_score;
                const t2Score = t1IsHome ? m.away_score : m.home_score;
                const t1Won = t1Score > t2Score;
                const isDraw = t1Score === t2Score;
                const rowTone = isDraw ? "bg-[#2B3443]" : t1Won ? "bg-[#1F5A42]" : "bg-[#5A2730]";
                const rowBorder = isDraw
                  ? "border-l-2 border-l-chalk-400"
                  : t1Won
                    ? "border-l-2 border-l-green-500"
                    : "border-l-2 border-l-red-500";

                return (
                  <div
                    key={m.match_id}
                    className={`relative grid grid-cols-[190px_1fr_95px_210px_90px] items-center gap-2 px-4 py-2.5 hover:brightness-125 transition ${rowTone} ${rowBorder}`}
                  >
                    <Link href={`/matches/${m.match_id}`} className="absolute inset-0 z-0" />

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

                    <div className="relative z-10 font-body text-sm text-chalk-200 flex items-center gap-1.5">
                      <Link href={`/teams/${m.home_team_id}`} className="flex items-center gap-1.5 hover:text-[#F4119E] transition-colors">
                        {m.home_logo && (
                          <img src={proxyImg(m.home_logo)!} alt="" className="w-5 h-5 object-contain inline-block shrink-0" />
                        )}
                        <span>{m.home_team}</span>
                      </Link>
                      <span className="font-mono text-sm text-chalk-100 mx-2 whitespace-nowrap pointer-events-none">
                        {m.home_score} - {m.away_score}
                      </span>
                      <Link href={`/teams/${m.away_team_id}`} className="flex items-center gap-1.5 hover:text-[#F4119E] transition-colors">
                        {m.away_logo && (
                          <img src={proxyImg(m.away_logo)!} alt="" className="w-5 h-5 object-contain inline-block shrink-0" />
                        )}
                        <span>{m.away_team}</span>
                      </Link>
                    </div>

                    <div className="relative z-10 text-xs font-mono uppercase pointer-events-none">
                      <span className={m.match_type === "competitive" ? "text-yellow-400" : "text-chalk-300"}>
                        {m.match_type === "competitive" ? "comp" : "friendly"}
                      </span>
                    </div>

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
