import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getTeamRoster } from "@/lib/iosoccer-api";
import SquadClient, { type SquadPlayer } from "./SquadClient";

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
  try {
    rosterEntries = await getTeamRoster(teamId, false);
  } catch {
    // API unavailable – show empty squad
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

  const ROLE_ORDER: Record<number, number> = { 6: 0, 5: 1, 2: 2, 4: 3, 3: 4, 1: 5 };

  const squad: SquadPlayer[] = rosterEntries
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

  return (
    <div>
      <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase mb-4">
        Current Squad
      </h3>
      <SquadClient squad={squad} />
    </div>
  );
}
