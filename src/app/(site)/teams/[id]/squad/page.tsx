import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getTeamRoster } from "@/lib/iosoccer-api";
import SquadClient, { type SquadPlayer } from "./SquadClient";
import ApiUnavailableNotice from "@/components/ApiUnavailableNotice";

type PlayerMeta = {
  steam_id: string;
  username: string;
  position: string | null;
  rating: number | null;
  apps: bigint;
  goals: bigint;
  assists: bigint;
  yellow_cards: bigint;
  red_cards: bigint;
};

export default async function TeamSquadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  // 1. Get current squad from IOSoccer API (live, authoritative)
  let rosterEntries: Awaited<ReturnType<typeof getTeamRoster>> = [];
  let apiUnavailable = false;
  try {
    rosterEntries = await getTeamRoster(teamId, false);
  } catch {
    apiUnavailable = true;
  }

  const steamIds = rosterEntries.map((e) => e.player.steamID).filter(Boolean);

  // 2. Get player details + per-team stats from DB
  const metaRows: PlayerMeta[] = steamIds.length > 0
    ? await prisma.$queryRaw<PlayerMeta[]>`
        SELECT
          p.steam_id,
          p.username,
          p.position,
          p.rating,
          COALESCE(ts.apps, 0)         AS apps,
          COALESCE(ts.goals, 0)        AS goals,
          COALESCE(ts.assists, 0)      AS assists,
          COALESCE(ts.yellow_cards, 0) AS yellow_cards,
          COALESCE(ts.red_cards, 0)    AS red_cards
        FROM players p
        LEFT JOIN (
          SELECT
            mps.player_steam_id,
            COUNT(DISTINCT mps.match_id)       AS apps,
            COALESCE(SUM(mps.goals), 0)        AS goals,
            COALESCE(SUM(mps.assists), 0)      AS assists,
            COALESCE(SUM(mps.yellow_cards), 0) AS yellow_cards,
            COALESCE(SUM(mps.red_cards), 0)    AS red_cards
          FROM match_player_stats mps
          JOIN matches m ON m.id = mps.match_id
          WHERE mps.player_steam_id = ANY(${steamIds})
            AND (
              (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
              (mps.team_side = 'away' AND m.away_team_id = ${teamId})
            )
          GROUP BY mps.player_steam_id
        ) ts ON ts.player_steam_id = p.steam_id
        WHERE p.steam_id = ANY(${steamIds})
      `
    : [];

  const metaMap = new Map(metaRows.map((r) => [r.steam_id, r]));

  const ROLE_ORDER: Record<number, number> = { 6: 0, 5: 1, 4: 2, 2: 3, 3: 4, 1: 5 };

  let squad: SquadPlayer[] = rosterEntries
    .map((entry) => {
      const meta = metaMap.get(entry.player.steamID);
      return {
        steam_id: entry.player.steamID,
        username: meta?.username ?? entry.player.name,
        position: meta?.position ?? null,
        role: entry.teamRole,
        rating: meta?.rating != null ? Number(meta.rating) : null,
        join_date: entry.joinDate
          ? new Date(entry.joinDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : null,
        apps: Number(meta?.apps ?? 0),
        goals: Number(meta?.goals ?? 0),
        assists: Number(meta?.assists ?? 0),
        yellow_cards: Number(meta?.yellow_cards ?? 0),
        red_cards: Number(meta?.red_cards ?? 0),
      };
    })
    .sort((a, b) => {
      const ar = ROLE_ORDER[a.role ?? 99] ?? 99;
      const br = ROLE_ORDER[b.role ?? 99] ?? 99;
      if (ar !== br) return ar - br;
      return b.apps - a.apps;
    });

  // Live API is down — approximate the current squad from players who have
  // appeared for this team in the last 90 days (the DB has no roster table).
  // Roles/join dates aren't available in this mode.
  if (apiUnavailable) {
    const dbSquad = await prisma.$queryRaw<(PlayerMeta & { last_played: Date })[]>`
      SELECT
        p.steam_id,
        p.username,
        p.position,
        p.rating,
        COUNT(DISTINCT mps.match_id)       AS apps,
        COALESCE(SUM(mps.goals), 0)        AS goals,
        COALESCE(SUM(mps.assists), 0)      AS assists,
        COALESCE(SUM(mps.yellow_cards), 0) AS yellow_cards,
        COALESCE(SUM(mps.red_cards), 0)    AS red_cards,
        MAX(m.date)                        AS last_played
      FROM match_player_stats mps
      JOIN matches m ON m.id = mps.match_id
      JOIN players p ON p.steam_id = mps.player_steam_id
      WHERE (
        (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
        (mps.team_side = 'away' AND m.away_team_id = ${teamId})
      )
      GROUP BY p.steam_id, p.username, p.position, p.rating
      HAVING MAX(m.date) >= NOW() - INTERVAL '90 days'
      ORDER BY apps DESC
    `;

    if (dbSquad.length > 0) {
      squad = dbSquad.map((r) => ({
        steam_id: r.steam_id,
        username: r.username,
        position: r.position,
        role: null,
        rating: r.rating != null ? Number(r.rating) : null,
        join_date: null,
        apps: Number(r.apps),
        goals: Number(r.goals),
        assists: Number(r.assists),
        yellow_cards: Number(r.yellow_cards),
        red_cards: Number(r.red_cards),
      }));
      apiUnavailable = false;
    }
  }

  return (
    <div>
      <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase mb-4">
        Current Squad
      </h3>
      {apiUnavailable && <ApiUnavailableNotice />}
      <SquadClient squad={squad} />
    </div>
  );
}
