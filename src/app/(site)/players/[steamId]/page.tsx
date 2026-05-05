import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRelatedSteamIds } from "@/lib/player-aliases";
import { getPastTournaments, badgeSmallUrl } from "@/lib/iosoccer-api";
import RatingChart from "@/components/RatingChart";

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ steamId: string }>;
}): Promise<Metadata> {
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);
  const player = await prisma.player.findUnique({ where: { steamId }, select: { username: true } });
  if (!player) return { title: "Player — IOSHUBv2" };
  return {
    title: `${player.username} — IOSHUBv2`,
    description: `Stats, ratings, match history and team career for ${player.username} on IOSoccer.`,
  };
}

const FORMAT_LABELS: Record<number, string> = {
  1: "League", 2: "Knockout", 3: "Group + Knockout",
  4: "Custom", 5: "Swiss", 6: "Round Robin",
  7: "Double Elimination", 8: "League",
};
const TEAM_TYPES: Record<number, string> = { 1: "Club", 2: "National", 3: "Mix", 4: "Draft" };

export default async function PlayerOverallPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);

  const player = await prisma.player.findUnique({ where: { steamId } });
  if (!player) return notFound();

  const steamIds = await getRelatedSteamIds(steamId);

  // (tournament_id, team_id) pairs where the player has at least one appearance
  const appearances = await prisma.$queryRaw<{ tournament_id: number; team_id: number }[]>`
    SELECT DISTINCT
      m.tournament_id,
      CASE WHEN mps.team_side = 'home' THEN m.home_team_id ELSE m.away_team_id END AS team_id
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    WHERE mps.player_steam_id = ANY(${steamIds})
      AND m.tournament_id IS NOT NULL
  `;
  const appearanceKeys = new Set(
    appearances.map((a) => `${a.tournament_id}:${a.team_id}`)
  );

  // Fetch all past tournaments from the live API (no scraper needed)
  const pastTournaments = await getPastTournaments().catch(() => []);

  // A title counts only if the player has at least one appearance in that tournament for the winning team.
  const titles = pastTournaments.filter((t) => {
    if (!t.winningTeamId) return false;
    return appearanceKeys.has(`${t.id}:${t.winningTeamId}`);
  });

  // Sort by end date descending
  titles.sort((a, b) => {
    const da = a.endDate ? new Date(a.endDate).getTime() : 0;
    const db = b.endDate ? new Date(b.endDate).getTime() : 0;
    return db - da;
  });

  // Rating history — only if player has rating
  const ratingHistory = player.rating != null
    ? await prisma.$queryRaw<{ date: string; rating: number }[]>`
        SELECT recorded_at::date::text AS date, AVG(rating) AS rating
        FROM player_rating_history
        WHERE steam_id = ${steamId}
        GROUP BY recorded_at::date
        ORDER BY recorded_at::date ASC
      `
    : [];

  return (
    <>
      {ratingHistory.length > 0 && (
        <RatingChart points={ratingHistory.map((p) => ({ date: p.date, rating: Number(p.rating) }))} />
      )}

      <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase mb-4">
        Titles <span className="text-chalk-400">[{titles.length}]</span>
      </h3>

      {titles.length === 0 ? (
        <div className="text-center py-12 text-chalk-400 font-body">
          No titles found for this player.
        </div>
      ) : (
        <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chalk-100/8">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">ORG</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">TOURNAMENT</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">FORMAT</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">TEAM TYPE</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">WINNING TEAM</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">DATE</th>
              </tr>
            </thead>
            <tbody>
              {titles.map((t, i) => {
                const logo = badgeSmallUrl(t.winningTeam?.badgeImage ?? null);
                const org = t.tournamentSeries?.organisation?.acronym ?? null;
                return (
                <tr
                  key={t.id}
                  className={`stat-row ${i % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}`}
                >
                  <td className="px-4 py-1.5 font-mono text-xs text-chalk-400">
                    {org || "-"}
                  </td>
                  <td className="px-4 py-1.5 font-body text-chalk-200">
                    <Link href={`/tournaments/${t.id}`} className="hover:text-[#F4119E] transition-colors">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-1.5 font-mono text-xs text-chalk-400">
                    {FORMAT_LABELS[t.format] || "-"}
                  </td>
                  <td className="px-4 py-1.5 font-mono text-xs text-chalk-400">
                    {TEAM_TYPES[t.teamType] || "-"}
                  </td>
                  <td className="px-4 py-1.5">
                    {t.winningTeam ? (
                      <Link href={`/teams/${t.winningTeamId}`} className="flex items-center gap-1.5 hover:text-grass-400 transition-colors">
                        {logo && (
                          <img src={logo} alt="" className="w-4 h-4 object-contain" />
                        )}
                        <span className="font-body text-xs text-grass-400 font-medium">
                          {t.winningTeam.name}
                        </span>
                      </Link>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-1.5 font-mono text-xs text-chalk-400">
                    {t.endDate
                      ? new Date(t.endDate).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })
                      : "-"}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}