import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SquadClient, { type SquadPlayer } from "./SquadClient";

type RawSquadPlayer = {
  steam_id: string;
  username: string;
  position: string | null;
  role: number | null;
  rating: number | null;
  join_date: Date | null;
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

  const raw = await prisma.$queryRaw<RawSquadPlayer[]>`
    WITH current_members AS (
      SELECT
        tr.player_steam_id AS steam_id,
        tr.date AS join_date,
        tr.role,
        ROW_NUMBER() OVER (PARTITION BY tr.player_steam_id ORDER BY tr.date DESC) AS rn,
        (
          SELECT MIN(tr2.date)
          FROM transfers tr2
          WHERE tr2.player_steam_id = tr.player_steam_id
            AND tr2.from_team_id = tr.to_team_id
            AND tr2.type = 'leave'
            AND tr2.date > tr.date
        ) AS leave_date
      FROM transfers tr
      WHERE tr.to_team_id = ${teamId}
        AND tr.type = 'join'
    ),
    active_members AS (
      SELECT steam_id, join_date, COALESCE(role, 4) AS role
      FROM current_members
      WHERE leave_date IS NULL AND rn = 1
    ),
    member_positions AS (
      SELECT
        am.steam_id,
        mps.position,
        COUNT(*) AS pos_count,
        ROW_NUMBER() OVER (PARTITION BY am.steam_id ORDER BY COUNT(*) DESC) AS rn
      FROM active_members am
      JOIN match_player_stats mps ON mps.player_steam_id = am.steam_id
      JOIN matches m ON m.id = mps.match_id
        AND (
          (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
          (mps.team_side = 'away' AND m.away_team_id = ${teamId})
        )
      WHERE mps.position IS NOT NULL
      GROUP BY am.steam_id, mps.position
    ),
    team_stats AS (
      SELECT
        mps.player_steam_id,
        COUNT(DISTINCT mps.match_id) AS apps,
        COALESCE(SUM(mps.goals), 0) AS goals,
        COALESCE(SUM(mps.assists), 0) AS assists,
        COALESCE(SUM(mps.yellow_cards), 0) AS yellow_cards,
        COALESCE(SUM(mps.red_cards), 0) AS red_cards
      FROM match_player_stats mps
      JOIN matches m ON m.id = mps.match_id
        AND (
          (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
          (mps.team_side = 'away' AND m.away_team_id = ${teamId})
        )
      GROUP BY mps.player_steam_id
    )
    SELECT
      p.steam_id,
      p.username,
      mp.position,
      am.role,
      p.rating,
      am.join_date,
      COALESCE(ts.apps, 0) AS apps,
      COALESCE(ts.goals, 0) AS goals,
      COALESCE(ts.assists, 0) AS assists,
      COALESCE(ts.yellow_cards, 0) AS yellow_cards,
      COALESCE(ts.red_cards, 0) AS red_cards
    FROM active_members am
    JOIN players p ON p.steam_id = am.steam_id
    LEFT JOIN member_positions mp ON mp.steam_id = am.steam_id AND mp.rn = 1
    LEFT JOIN team_stats ts ON ts.player_steam_id = am.steam_id
    ORDER BY
      CASE am.role WHEN 6 THEN 0 WHEN 5 THEN 1 WHEN 2 THEN 2 WHEN 4 THEN 3 WHEN 3 THEN 4 WHEN 1 THEN 5 ELSE 6 END ASC,
      apps DESC
  `;

  const squad: SquadPlayer[] = raw.map((p) => ({
    steam_id: p.steam_id,
    username: p.username,
    position: p.position,
    role: p.role,
    rating: p.rating ? Number(p.rating) : null,
    join_date: p.join_date
      ? new Date(p.join_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : null,
    apps: Number(p.apps),
    goals: Number(p.goals),
    assists: Number(p.assists),
    yellow_cards: Number(p.yellow_cards),
    red_cards: Number(p.red_cards),
  }));

  return (
    <div>
      <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase mb-4">
        Current Squad
      </h3>
      <SquadClient squad={squad} />
    </div>
  );
}
