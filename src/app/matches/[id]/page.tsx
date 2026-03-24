import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import MatchClient from "./MatchClient";

export type MatchPlayer = {
  player_steam_id: string;
  username: string;
  position: string | null;
  team_side: string;
  goals: number;
  assists: number;
  second_assists: number;
  shots: number;
  shots_on_target: number;
  passes: number;
  passes_completed: number;
  key_passes: number;
  chances_created: number;
  interceptions: number;
  saves: number;
  offsides: number;
  fouls: number;
  fouls_suffered: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
  goals_conceded: number;
  corners: number;
  throw_ins: number;
  free_kicks: number;
  goal_kicks: number;
  penalties: number;
  distance_run: number;
  possession: number;
};

export type MatchShot = {
  player_steam_id: string;
  username: string;
  team_side: string;
  normalized_x: number;
  normalized_y: number;
  is_goal: boolean;
  is_save: boolean;
  xg: number;
  minute: number | null;
};

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = parseInt(id, 10);
  if (isNaN(matchId)) return notFound();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  if (!match) return notFound();

  // Player stats for this match
  const playerStats = await prisma.$queryRaw<MatchPlayer[]>`
    SELECT
      mps.player_steam_id,
      p.username,
      mps.position,
      mps.team_side,
      mps.goals,
      mps.assists,
      mps.second_assists,
      mps.shots,
      mps.shots_on_target,
      mps.passes,
      mps.passes_completed,
      mps.key_passes,
      mps.chances_created,
      mps.interceptions,
      mps.saves,
      mps.offsides,
      mps.fouls,
      mps.fouls_suffered,
      mps.yellow_cards,
      mps.red_cards,
      mps.own_goals,
      mps.goals_conceded,
      mps.corners,
      mps.throw_ins,
      mps.free_kicks,
      mps.goal_kicks,
      mps.penalties,
      mps.distance_run,
      mps.possession
    FROM match_player_stats mps
    JOIN players p ON p.steam_id = mps.player_steam_id
    WHERE mps.match_id = ${matchId}
    ORDER BY mps.team_side ASC, mps.goals DESC, mps.assists DESC
  `;

  // Shots for this match
  const shots = await prisma.$queryRaw<MatchShot[]>`
    SELECT
      s.player_steam_id,
      p.username,
      mps.team_side,
      s.normalized_x,
      s.normalized_y,
      s.is_goal,
      s.is_save,
      s.xg,
      s.minute
    FROM shots s
    JOIN players p ON p.steam_id = s.player_steam_id
    JOIN match_player_stats mps ON mps.match_id = s.match_id AND mps.player_steam_id = s.player_steam_id
    WHERE s.match_id = ${matchId}
    ORDER BY s.id
  `;

  const matchDate = new Date(match.date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Proxy logos server-side
  const homeLogoUrl = match.homeTeam.logo ? proxyImg(match.homeTeam.logo) : null;
  const awayLogoUrl = match.awayTeam.logo ? proxyImg(match.awayTeam.logo) : null;

  return (
    <MatchClient
      match={{
        id: match.id,
        date: matchDate,
        map: match.map,
        server: match.server,
        potm: match.potm,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        homeTeam: { id: match.homeTeamId, name: match.homeTeam.name, logo: homeLogoUrl },
        awayTeam: { id: match.awayTeamId, name: match.awayTeam.name, logo: awayLogoUrl },
      }}
      playerStats={playerStats.map((p) => {
        const n: Record<string, unknown> = { ...p };
        for (const k of Object.keys(n)) {
          if (k !== "player_steam_id" && k !== "username" && k !== "position" && k !== "team_side") {
            n[k] = Number(n[k]);
          }
        }
        return n as unknown as MatchPlayer;
      })}
      shots={shots.map((s) => ({ ...s, xg: Number(s.xg), normalized_x: Number(s.normalized_x), normalized_y: Number(s.normalized_y), minute: s.minute != null ? Number(s.minute) : null }))}
    />
  );
}
