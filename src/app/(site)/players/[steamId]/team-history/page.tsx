import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import { getRelatedSteamIds } from "@/lib/player-aliases";
import { getPlayerTeamHistory } from "@/lib/iosoccer-api";
import TeamHistoryClient, { type TeamHistoryEntry } from "./TeamHistoryClient";

// System/exhibition teams to exclude
const EXCLUDED_TEAMS = [
  "IOSoccer All",
  "IOSoccer Overlap",
  "IOSoccer Challenge",
  "IOSoccer Premier",
];

type TeamRow = {
  id: number;
  name: string;
  logo: string | null;
  color: string | null;
  team_type: number | null;
};

type StatsRow = {
  team_id: number;
  apps: bigint;
  goals: bigint;
  assists: bigint;
  wins: bigint;
  draws: bigint;
  losses: bigint;
};

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : null;

export default async function PlayerTeamHistoryPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);

  const player = await prisma.player.findUnique({ where: { steamId } });
  if (!player) return notFound();

  const steamIds = await getRelatedSteamIds(steamId);

  // --- API path: use IOSoccer API if the player has an iosoccerId ---
  // The API is the source of truth and matches the official hub. When it
  // succeeds we render exactly what the hub shows, even if the list is empty.
  // We only fall through to the scraped-transfers DB fallback when the API
  // call itself fails (so we still show *something* during outages).
  if (player.iosoccerId != null) {
    let apiEntries: Awaited<ReturnType<typeof getPlayerTeamHistory>> = [];
    let apiOk = false;
    try {
      apiEntries = await getPlayerTeamHistory(player.iosoccerId);
      apiOk = true;
    } catch {
      // fall through to DB path below
    }

    if (apiOk) {
      // Filter out system/exhibition teams
      const filtered = apiEntries.filter(
        (e) => !EXCLUDED_TEAMS.includes(e.playerTeam.team.name)
      );

      // Note: playerTeam.teamId is 0 on this endpoint — real id is on team.id.
      const teamIds = [...new Set(filtered.map((e) => e.playerTeam.team.id))];

      // Fetch team logos/colors from DB (API may have null badgeImage)
      const teamRows: TeamRow[] = teamIds.length > 0
        ? await prisma.$queryRaw<TeamRow[]>`
            SELECT id, name, logo, color, team_type
            FROM teams
            WHERE id = ANY(${teamIds})
          `
        : [];
      const teamMeta = new Map(teamRows.map((t) => [t.id, t]));

      // Aggregate match stats per team across all stints
      const statsRows: StatsRow[] = teamIds.length > 0
        ? await prisma.$queryRaw<StatsRow[]>`
            SELECT
              CASE
                WHEN mps.team_side = 'home' THEN m.home_team_id
                ELSE m.away_team_id
              END AS team_id,
              COUNT(DISTINCT mps.match_id) AS apps,
              COALESCE(SUM(mps.goals), 0) AS goals,
              COALESCE(SUM(mps.assists), 0) AS assists,
              COUNT(DISTINCT CASE WHEN
                (mps.team_side = 'home' AND m.home_score > m.away_score) OR
                (mps.team_side = 'away' AND m.away_score > m.home_score)
              THEN m.id END) AS wins,
              COUNT(DISTINCT CASE WHEN m.home_score = m.away_score THEN m.id END) AS draws,
              COUNT(DISTINCT CASE WHEN
                (mps.team_side = 'home' AND m.home_score < m.away_score) OR
                (mps.team_side = 'away' AND m.away_score < m.home_score)
              THEN m.id END) AS losses
            FROM match_player_stats mps
            JOIN matches m ON m.id = mps.match_id
            WHERE mps.player_steam_id = ANY(${steamIds})
              AND (
                (mps.team_side = 'home' AND m.home_team_id = ANY(${teamIds})) OR
                (mps.team_side = 'away' AND m.away_team_id = ANY(${teamIds}))
              )
            GROUP BY 1
          `
        : [];
      const statsMap = new Map(statsRows.map((s) => [s.team_id, s]));

      // Sort by joinDate DESC (most recent stints first)
      const sorted = [...filtered].sort((a, b) => {
        const da = a.playerTeam.joinDate ? new Date(a.playerTeam.joinDate).getTime() : 0;
        const db = b.playerTeam.joinDate ? new Date(b.playerTeam.joinDate).getTime() : 0;
        return db - da;
      });

      const entries: TeamHistoryEntry[] = sorted.map((e) => {
        const pt = e.playerTeam;
        const teamId = pt.team.id;
        const meta = teamMeta.get(teamId);
        const stats = statsMap.get(teamId);
        return {
          team_id: teamId,
          team_name: meta?.name ?? pt.team.name,
          team_logo: meta?.logo ? proxyImg(meta.logo) : null,
          team_color: meta?.color ?? pt.team.color,
          // The /team-history endpoint returns teamType=0 for every team — fall
          // back to our DB metadata for the Club/National/Draft filter.
          team_type_id: meta?.team_type ?? null,
          join_date: fmtDate(pt.joinDate),
          leave_date: pt.isCurrentTeam ? null : fmtDate(pt.leaveDate),
          is_current: pt.isCurrentTeam,
          apps: Number(stats?.apps ?? 0),
          goals: Number(stats?.goals ?? 0),
          assists: Number(stats?.assists ?? 0),
          wins: Number(stats?.wins ?? 0),
          draws: Number(stats?.draws ?? 0),
          losses: Number(stats?.losses ?? 0),
        };
      });

      return <TeamHistoryClient teams={entries} />;
    }
  }

  // --- DB fallback: use transfers table ---
  type TeamTransfer = {
    team_id: number;
    team_name: string;
    team_logo: string | null;
    team_color: string | null;
    team_type_id: number | null;
    join_date: Date | null;
    leave_date: Date | null;
    apps: bigint;
    goals: bigint;
    assists: bigint;
    wins: bigint;
    draws: bigint;
    losses: bigint;
  };

  const teams = await prisma.$queryRaw<TeamTransfer[]>`
    WITH team_stints AS (
      SELECT
        tr.to_team_id AS team_id,
        tr.date AS join_date,
        (
          SELECT MIN(tr2.date)
          FROM transfers tr2
          WHERE tr2.player_steam_id = ANY(${steamIds})
            AND tr2.from_team_id = tr.to_team_id
            AND tr2.type = 'leave'
            AND tr2.date > tr.date
        ) AS leave_date
      FROM transfers tr
      WHERE tr.player_steam_id = ANY(${steamIds})
        AND tr.type = 'join'
        AND tr.to_team_id IS NOT NULL
    ),
    stint_stats AS (
      SELECT
        ts.team_id,
        ts.join_date,
        ts.leave_date,
        COUNT(DISTINCT mps.match_id) AS apps,
        COALESCE(SUM(mps.goals), 0) AS goals,
        COALESCE(SUM(mps.assists), 0) AS assists,
        COUNT(DISTINCT CASE WHEN
          (mps.team_side = 'home' AND m.home_score > m.away_score) OR
          (mps.team_side = 'away' AND m.away_score > m.home_score)
        THEN m.id END) AS wins,
        COUNT(DISTINCT CASE WHEN m.home_score = m.away_score THEN m.id END) AS draws,
        COUNT(DISTINCT CASE WHEN
          (mps.team_side = 'home' AND m.home_score < m.away_score) OR
          (mps.team_side = 'away' AND m.away_score < m.home_score)
        THEN m.id END) AS losses
      FROM team_stints ts
      LEFT JOIN matches m ON (
        m.home_team_id = ts.team_id OR m.away_team_id = ts.team_id
      )
      LEFT JOIN match_player_stats mps ON mps.match_id = m.id
        AND mps.player_steam_id = ANY(${steamIds})
        AND (
          (mps.team_side = 'home' AND m.home_team_id = ts.team_id) OR
          (mps.team_side = 'away' AND m.away_team_id = ts.team_id)
        )
      WHERE mps.match_id IS NOT NULL
      GROUP BY ts.team_id, ts.join_date, ts.leave_date
    )
    SELECT
      t.id AS team_id,
      t.name AS team_name,
      t.logo AS team_logo,
      t.color AS team_color,
      t.team_type AS team_type_id,
      ss.join_date,
      ss.leave_date,
      COALESCE(ss.apps, 0) AS apps,
      COALESCE(ss.goals, 0) AS goals,
      COALESCE(ss.assists, 0) AS assists,
      COALESCE(ss.wins, 0) AS wins,
      COALESCE(ss.draws, 0) AS draws,
      COALESCE(ss.losses, 0) AS losses
    FROM stint_stats ss
    JOIN teams t ON t.id = ss.team_id
    WHERE t.name NOT IN ('IOSoccer All', 'IOSoccer Overlap', 'IOSoccer Challenge', 'IOSoccer Premier')
    ORDER BY ss.join_date DESC NULLS LAST
  `;

  const entries: TeamHistoryEntry[] = teams.map((t) => ({
    team_id: t.team_id,
    team_name: t.team_name,
    team_logo: t.team_logo ? proxyImg(t.team_logo) : null,
    team_color: t.team_color,
    team_type_id: t.team_type_id,
    join_date: t.join_date
      ? new Date(t.join_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
      : null,
    leave_date: t.leave_date
      ? new Date(t.leave_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
      : null,
    is_current: !t.leave_date,
    apps: Number(t.apps),
    goals: Number(t.goals),
    assists: Number(t.assists),
    wins: Number(t.wins),
    draws: Number(t.draws),
    losses: Number(t.losses),
  }));

  return <TeamHistoryClient teams={entries} />;
}
