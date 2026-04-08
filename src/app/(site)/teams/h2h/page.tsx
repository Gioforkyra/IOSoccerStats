import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveTeams, badgeUrl } from "@/lib/iosoccer-api";

export const metadata: Metadata = {
  title: "Team Head to Head — IOSHUBv2",
  description: "Compare two IOSoccer teams head to head — results, goals and win rates.",
};
import { proxyImg } from "@/lib/img";
import { H2HPicker } from "./H2HPicker";
import { H2HStatSlider, type StatPage } from "./H2HStatSlider";
import { Prisma } from "@/generated/prisma/client";
import { MatchFilterDropdown } from "@/components/MatchFilterDropdown";

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
};

type H2HPlayerStats = {
  team1_avg_possession: number | null;
  team2_avg_possession: number | null;
  team1_avg_passes: number | null;
  team2_avg_passes: number | null;
  team1_avg_passes_completed: number | null;
  team2_avg_passes_completed: number | null;
  team1_avg_shots: number | null;
  team2_avg_shots: number | null;
  team1_avg_shots_on_target: number | null;
  team2_avg_shots_on_target: number | null;
  team1_avg_interceptions: number | null;
  team2_avg_interceptions: number | null;
  team1_avg_saves: number | null;
  team2_avg_saves: number | null;
  team1_avg_offsides: number | null;
  team2_avg_offsides: number | null;
  team1_yellow_cards: bigint | null;
  team2_yellow_cards: bigint | null;
  team1_red_cards: bigint | null;
  team2_red_cards: bigint | null;
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

export default async function H2HPage({
  searchParams,
}: {
  searchParams: Promise<{ team1?: string; team2?: string; page?: string; filter?: string }>;
}) {
  const { team1: t1Param, team2: t2Param, page: pageParam, filter: filterParam } = await searchParams;
  const team1Id = t1Param ? parseInt(t1Param, 10) : null;
  const team2Id = t2Param ? parseInt(t2Param, 10) : null;

  // ── PICKER VIEW ────────────────────────────────────────────────────
  if (!team1Id || !team2Id || isNaN(team1Id) || isNaN(team2Id) || team1Id === team2Id) {
    let apiTeams: { id: number; name: string; logo: string | null; color: string | null; typeLabel: string }[] = [];
    try {
      const [clubs, nationals, mixes] = await Promise.allSettled([
        getActiveTeams(1, 1),
        getActiveTeams(1, 2),
        getActiveTeams(1, 3),
      ]);
      const map = [
        { result: clubs,   label: "Club" },
        { result: nationals, label: "National" },
        { result: mixes,   label: "Mix" },
      ];
      for (const { result, label } of map) {
        if (result.status === "fulfilled") {
          for (const t of result.value) {
            apiTeams.push({
              id: t.id,
              name: t.name,
              logo: badgeUrl(t.badgeImageId),
              color: t.color ?? null,
              typeLabel: label,
            });
          }
        }
      }
      apiTeams.sort((a, b) => a.name.localeCompare(b.name));
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
            Select two teams to compare their head-to-head record
          </p>
        </div>
        <H2HPicker teams={apiTeams} />
      </div>
    );
  }

  // ── H2H RESULTS VIEW ───────────────────────────────────────────────
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const filter = filterParam === "friendly" || filterParam === "competitive" ? filterParam : "all";
  const typeFilter = filter === "competitive" ? Prisma.sql`AND match_type = 'competitive'` : filter === "friendly" ? Prisma.sql`AND match_type = 'friendly'` : Prisma.empty;
  const typeFilterM = filter === "competitive" ? Prisma.sql`AND m.match_type = 'competitive'` : filter === "friendly" ? Prisma.sql`AND m.match_type = 'friendly'` : Prisma.empty;

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
    WHERE ((home_team_id = ${team1Id} AND away_team_id = ${team2Id})
       OR (home_team_id = ${team2Id} AND away_team_id = ${team1Id}))
      ${typeFilter}
  `;
  const totalMatches = Number(totalRaw);
  const totalPages = Math.ceil(totalMatches / PAGE_SIZE);

  // H2H aggregate stats (wins / draws / goals)
  const [stats] = await prisma.$queryRaw<[H2HStats]>`
    SELECT
      COUNT(CASE WHEN (home_team_id = ${team1Id} AND home_score > away_score)
                   OR (away_team_id = ${team1Id} AND away_score > home_score) THEN 1 END) AS team1_wins,
      COUNT(CASE WHEN (home_team_id = ${team2Id} AND home_score > away_score)
                   OR (away_team_id = ${team2Id} AND away_score > home_score) THEN 1 END) AS team2_wins,
      COUNT(CASE WHEN home_score = away_score THEN 1 END) AS draws,
      SUM(CASE WHEN home_team_id = ${team1Id} THEN home_score ELSE away_score END) AS team1_goals,
      SUM(CASE WHEN home_team_id = ${team2Id} THEN home_score ELSE away_score END) AS team2_goals
    FROM matches
    WHERE ((home_team_id = ${team1Id} AND away_team_id = ${team2Id})
       OR (home_team_id = ${team2Id} AND away_team_id = ${team1Id}))
      ${typeFilter}
  `;

  // H2H player stats averages (per match, normalised)
  const [playerStats] = await prisma.$queryRaw<[H2HPlayerStats]>`
    WITH per_match AS (
      SELECT
        (m.home_team_id = ${team1Id}) AS t1_is_home,
        SUM(CASE WHEN mps.team_side = 'home' THEN mps.possession ELSE 0 END)::float AS home_poss,
        SUM(CASE WHEN mps.team_side = 'away' THEN mps.possession ELSE 0 END)::float AS away_poss,
        SUM(CASE WHEN mps.team_side = 'home' THEN mps.shots ELSE 0 END) AS home_shots,
        SUM(CASE WHEN mps.team_side = 'away' THEN mps.shots ELSE 0 END) AS away_shots,
        SUM(CASE WHEN mps.team_side = 'home' THEN mps.shots_on_target ELSE 0 END) AS home_sot,
        SUM(CASE WHEN mps.team_side = 'away' THEN mps.shots_on_target ELSE 0 END) AS away_sot,
        SUM(CASE WHEN mps.team_side = 'home' THEN mps.passes ELSE 0 END) AS home_passes,
        SUM(CASE WHEN mps.team_side = 'away' THEN mps.passes ELSE 0 END) AS away_passes,
        SUM(CASE WHEN mps.team_side = 'home' THEN mps.passes_completed ELSE 0 END) AS home_pc,
        SUM(CASE WHEN mps.team_side = 'away' THEN mps.passes_completed ELSE 0 END) AS away_pc,
        SUM(CASE WHEN mps.team_side = 'home' THEN mps.interceptions ELSE 0 END) AS home_int,
        SUM(CASE WHEN mps.team_side = 'away' THEN mps.interceptions ELSE 0 END) AS away_int,
        SUM(CASE WHEN mps.team_side = 'home' THEN mps.saves ELSE 0 END) AS home_saves,
        SUM(CASE WHEN mps.team_side = 'away' THEN mps.saves ELSE 0 END) AS away_saves,
        SUM(CASE WHEN mps.team_side = 'home' THEN mps.offsides ELSE 0 END) AS home_off,
        SUM(CASE WHEN mps.team_side = 'away' THEN mps.offsides ELSE 0 END) AS away_off,
        SUM(CASE WHEN mps.team_side = 'home' THEN mps.yellow_cards ELSE 0 END) AS home_yc,
        SUM(CASE WHEN mps.team_side = 'away' THEN mps.yellow_cards ELSE 0 END) AS away_yc,
        SUM(CASE WHEN mps.team_side = 'home' THEN mps.red_cards ELSE 0 END) AS home_rc,
        SUM(CASE WHEN mps.team_side = 'away' THEN mps.red_cards ELSE 0 END) AS away_rc
      FROM matches m
      JOIN match_player_stats mps ON mps.match_id = m.id
      WHERE ((m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
         OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id}))
        ${typeFilterM}
      GROUP BY m.id, m.home_team_id
    )
    SELECT
      AVG(CASE WHEN t1_is_home THEN
        CASE WHEN home_poss+away_poss > 0 THEN home_poss/(home_poss+away_poss)*100 ELSE 50 END
        ELSE CASE WHEN home_poss+away_poss > 0 THEN away_poss/(home_poss+away_poss)*100 ELSE 50 END
      END) AS team1_avg_possession,
      AVG(CASE WHEN t1_is_home THEN
        CASE WHEN home_poss+away_poss > 0 THEN away_poss/(home_poss+away_poss)*100 ELSE 50 END
        ELSE CASE WHEN home_poss+away_poss > 0 THEN home_poss/(home_poss+away_poss)*100 ELSE 50 END
      END) AS team2_avg_possession,
      AVG(CASE WHEN t1_is_home THEN home_shots  ELSE away_shots  END) AS team1_avg_shots,
      AVG(CASE WHEN t1_is_home THEN away_shots  ELSE home_shots  END) AS team2_avg_shots,
      AVG(CASE WHEN t1_is_home THEN home_sot    ELSE away_sot    END) AS team1_avg_shots_on_target,
      AVG(CASE WHEN t1_is_home THEN away_sot    ELSE home_sot    END) AS team2_avg_shots_on_target,
      AVG(CASE WHEN t1_is_home THEN home_passes ELSE away_passes END) AS team1_avg_passes,
      AVG(CASE WHEN t1_is_home THEN away_passes ELSE home_passes END) AS team2_avg_passes,
      AVG(CASE WHEN t1_is_home THEN home_pc     ELSE away_pc     END) AS team1_avg_passes_completed,
      AVG(CASE WHEN t1_is_home THEN away_pc     ELSE home_pc     END) AS team2_avg_passes_completed,
      AVG(CASE WHEN t1_is_home THEN home_int    ELSE away_int    END) AS team1_avg_interceptions,
      AVG(CASE WHEN t1_is_home THEN away_int    ELSE home_int    END) AS team2_avg_interceptions,
      AVG(CASE WHEN t1_is_home THEN home_saves  ELSE away_saves  END) AS team1_avg_saves,
      AVG(CASE WHEN t1_is_home THEN away_saves  ELSE home_saves  END) AS team2_avg_saves,
      AVG(CASE WHEN t1_is_home THEN home_off    ELSE away_off    END) AS team1_avg_offsides,
      AVG(CASE WHEN t1_is_home THEN away_off    ELSE home_off    END) AS team2_avg_offsides,
      SUM(CASE WHEN t1_is_home THEN home_yc     ELSE away_yc     END) AS team1_yellow_cards,
      SUM(CASE WHEN t1_is_home THEN away_yc     ELSE home_yc     END) AS team2_yellow_cards,
      SUM(CASE WHEN t1_is_home THEN home_rc     ELSE away_rc     END) AS team1_red_cards,
      SUM(CASE WHEN t1_is_home THEN away_rc     ELSE home_rc     END) AS team2_red_cards
    FROM per_match
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
    WHERE ((m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
       OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id}))
      ${typeFilterM}
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
    WHERE ((m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
       OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id}))
      ${typeFilterM}
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
    WHERE ((m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
       OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id}))
      ${typeFilterM}
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
    WHERE ((m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
       OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id}))
      ${typeFilterM}
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
    WHERE ((m.home_team_id = ${team1Id} AND m.away_team_id = ${team2Id})
       OR (m.home_team_id = ${team2Id} AND m.away_team_id = ${team1Id}))
      ${typeFilterM}
    ORDER BY m.date DESC, m.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  const t1Wins = Number(stats.team1_wins);
  const t2Wins = Number(stats.team2_wins);
  const draws = Number(stats.draws);
  const t1Goals = Number(stats.team1_goals ?? 0);
  const t2Goals = Number(stats.team2_goals ?? 0);

  const n = (v: number | null) => (v ? Number(v) : 0);
  const t1Poss   = n(playerStats.team1_avg_possession);
  const t2Poss   = n(playerStats.team2_avg_possession);
  const t1Passes = n(playerStats.team1_avg_passes);
  const t2Passes = n(playerStats.team2_avg_passes);
  const t1PC     = n(playerStats.team1_avg_passes_completed);
  const t2PC     = n(playerStats.team2_avg_passes_completed);
  const t1Shots  = n(playerStats.team1_avg_shots);
  const t2Shots  = n(playerStats.team2_avg_shots);
  const t1SOT    = n(playerStats.team1_avg_shots_on_target);
  const t2SOT    = n(playerStats.team2_avg_shots_on_target);
  const t1Int    = n(playerStats.team1_avg_interceptions);
  const t2Int    = n(playerStats.team2_avg_interceptions);
  const t1Saves  = n(playerStats.team1_avg_saves);
  const t2Saves  = n(playerStats.team2_avg_saves);
  const t1Off    = n(playerStats.team1_avg_offsides);
  const t2Off    = n(playerStats.team2_avg_offsides);
  const t1YC     = playerStats.team1_yellow_cards ? Number(playerStats.team1_yellow_cards) : 0;
  const t2YC     = playerStats.team2_yellow_cards ? Number(playerStats.team2_yellow_cards) : 0;
  const t1RC     = playerStats.team1_red_cards ? Number(playerStats.team1_red_cards) : 0;
  const t2RC     = playerStats.team2_red_cards ? Number(playerStats.team2_red_cards) : 0;

  const statPages: StatPage[] = [
    {
      title: "Match Outcomes",
      bars: [
        { label: "Match Wins",  val1: t1Wins,  val2: t2Wins },
        { label: "Total Goals", val1: t1Goals, val2: t2Goals },
        { label: "Avg Goals",   val1: totalMatches > 0 ? t1Goals / totalMatches : 0, val2: totalMatches > 0 ? t2Goals / totalMatches : 0, format: "dec" },
      ],
    },
    {
      title: "Possession & Passing",
      bars: [
        { label: "Avg Possession",        val1: t1Poss,   val2: t2Poss,   format: "pct" },
        { label: "Avg Passes",            val1: t1Passes, val2: t2Passes, format: "dec" },
        { label: "Avg Passes Completed",  val1: t1PC,     val2: t2PC,     format: "dec" },
      ],
    },
    {
      title: "Attack",
      bars: [
        { label: "Avg Shots",           val1: t1Shots, val2: t2Shots, format: "dec" },
        { label: "Avg Shots on Target", val1: t1SOT,   val2: t2SOT,   format: "dec" },
      ],
    },
    {
      title: "Defending",
      bars: [
        { label: "Avg Interceptions", val1: t1Int,   val2: t2Int,   format: "dec" },
        { label: "Avg Keeper Saves",  val1: t1Saves, val2: t2Saves, format: "dec" },
        { label: "Avg Offsides",      val1: t1Off,   val2: t2Off,   format: "dec" },
      ],
    },
    {
      title: "Discipline",
      bars: [
        { label: "Yellow Cards", val1: t1YC, val2: t2YC },
        { label: "Red Cards",    val1: t1RC, val2: t2RC },
      ],
    },
  ];

  const logo1 = proxyImg(team1Row.logo);
  const logo2 = proxyImg(team2Row.logo);

  function paginationHref(p: number) {
    return `/teams/h2h?team1=${team1Id}&team2=${team2Id}&page=${p}&filter=${filter}`;
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
        className="rounded-xl border border-chalk-100/8 overflow-hidden mb-6 relative"
        style={{ background: `linear-gradient(to right, ${color1}25, transparent 40%, transparent 60%, ${color2}25)` }}
      >
        <div className="absolute top-3 right-3 z-10">
          <MatchFilterDropdown
            current={filter}
            hrefAll={`/teams/h2h?team1=${team1Id}&team2=${team2Id}&page=1&filter=all`}
            hrefFriendly={`/teams/h2h?team1=${team1Id}&team2=${team2Id}&page=1&filter=friendly`}
            hrefCompetitive={`/teams/h2h?team1=${team1Id}&team2=${team2Id}&page=1&filter=competitive`}
          />
        </div>
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
          {/* Stats slider */}
          <H2HStatSlider pages={statPages} color1={color1} color2={color2} />

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
