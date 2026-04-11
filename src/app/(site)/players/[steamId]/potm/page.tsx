import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import { getRelatedSteamIds } from "@/lib/player-aliases";

const MATCHES_PER_PAGE = 10;

type MatchRow = {
  match_id: number;
  date: Date;
  team_name: string;
  team_logo: string | null;
  team_side: string;
  home_score: number;
  away_score: number;
  position: string | null;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  passes: number;
  passes_completed: number;
  interceptions: number;
  possession: number;
  saves: number;
  goals_conceded: number;
  offsides: number;
  yellow_cards: number;
  red_cards: number;
  distance_run: number;
  is_substitute: boolean;
};

export default async function PlayerPotmPage({
  params,
  searchParams,
}: {
  params: Promise<{ steamId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);
  const steamIdParam = encodeURIComponent(steamId);
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10));
  const offset = (page - 1) * MATCHES_PER_PAGE;

  const player = await prisma.player.findUnique({ where: { steamId } });
  if (!player) return notFound();

  const steamIds = await getRelatedSteamIds(steamId);

  const [countResult] = await prisma.$queryRaw<[{ total: bigint }]>`
    SELECT COUNT(*) AS total FROM match_player_stats
    WHERE player_steam_id = ANY(${steamIds}) AND is_potm = true
  `;
  const totalMatches = Number(countResult?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalMatches / MATCHES_PER_PAGE));

  const matches = await prisma.$queryRaw<MatchRow[]>`
    SELECT
      sub.match_id, sub.date, sub.team_name, sub.team_logo, sub.team_side,
      sub.home_score, sub.away_score, sub.position,
      sub.goals, sub.assists, sub.shots, sub.shots_on_target,
      sub.passes, sub.passes_completed, sub.interceptions, sub.possession,
      sub.saves, sub.goals_conceded, sub.offsides, sub.yellow_cards,
      sub.red_cards, sub.distance_run, sub.is_substitute
    FROM (
      SELECT
        m.id AS match_id,
        m.date,
        t.name AS team_name,
        t.logo AS team_logo,
        mps.team_side,
        m.home_score,
        m.away_score,
        mps.position,
        mps.goals,
        mps.assists,
        mps.shots,
        mps.shots_on_target,
        mps.passes,
        mps.passes_completed,
        mps.interceptions,
        mps.possession,
        mps.saves,
        mps.goals_conceded,
        mps.offsides,
        mps.yellow_cards,
        mps.red_cards,
        mps.distance_run,
        CASE
          WHEN mps.is_substitute THEN true
          WHEN COUNT(*) OVER (PARTITION BY mps.match_id) > 1
            AND MAX(mps.is_substitute::int) OVER (PARTITION BY mps.match_id) = 0
            AND ROW_NUMBER() OVER (PARTITION BY mps.match_id ORDER BY mps.team_side) > 1
          THEN true
          ELSE false
        END AS is_substitute
      FROM match_player_stats mps
      JOIN matches m ON m.id = mps.match_id
      JOIN teams t ON t.id = CASE
        WHEN mps.team_side = 'home' THEN m.home_team_id
        WHEN mps.team_side = 'away' THEN m.away_team_id
      END
      WHERE mps.player_steam_id = ANY(${steamIds}) AND mps.is_potm = true
      ORDER BY m.date DESC, m.id DESC, mps.team_side
    ) sub
    ORDER BY sub.date DESC, sub.match_id DESC, sub.team_side
    LIMIT ${MATCHES_PER_PAGE} OFFSET ${offset}
  `;

  const pageW = matches.filter((m) => {
    const isHome = m.team_side === "home";
    return isHome ? m.home_score > m.away_score : m.away_score > m.home_score;
  }).length;
  const pageD = matches.filter((m) => m.home_score === m.away_score).length;
  const pageL = matches.length - pageW - pageD;

  const COLS = [
    { key: "goals", label: "G", title: "Goals" },
    { key: "assists", label: "A", title: "Assists" },
    { key: "shots", label: "SH", title: "Shots" },
    { key: "shots_on_target", label: "SOT", title: "Shots on Target" },
    { key: "passes", label: "PAS", title: "Passes" },
    { key: "passes_completed", label: "CMP", title: "Passes Completed" },
    { key: "interceptions", label: "INT", title: "Interceptions" },
    { key: "possession", label: "POS%", title: "Possession %" },
    { key: "saves", label: "SAV", title: "Saves" },
    { key: "goals_conceded", label: "CON", title: "Goals Conceded" },
    { key: "offsides", label: "OFF", title: "Offsides" },
    { key: "yellow_cards", label: "YC", title: "Yellow Cards" },
    { key: "red_cards", label: "RC", title: "Red Cards" },
    { key: "distance_run", label: "DIST", title: "Distance Run" },
  ] as const;

  if (totalMatches === 0) {
    return (
      <>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-4">
          <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase">
            Player of the Match
          </h3>
        </div>
        <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-10 text-center text-chalk-400 font-body">
          No POTM awards yet.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-4">
        <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase">
          Player of the Match
        </h3>
        <div className="flex items-center gap-3 text-sm font-mono">
          <span className="text-grass-500">{pageW}W</span>
          <span className="text-chalk-400">{pageD}D</span>
          <span className="text-red-400">{pageL}L</span>
          <span className="text-chalk-300 text-xs">({totalMatches} total)</span>
        </div>
      </div>

      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="matches-table w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-chalk-100/8 bg-pitch-900">
              <th className="text-left px-3 py-3 font-mono text-[10px] text-chalk-400" title="Date">DATE</th>
              <th className="text-center px-2 py-3 font-mono text-[10px] text-chalk-400" title="Position">POS</th>
              <th className="text-left px-3 py-3 font-mono text-[10px] text-chalk-400" title="Team">TEAM</th>
              <th className="text-center px-2 py-3 font-mono text-[10px] text-chalk-400" title="Result">RES</th>
              {COLS.map((c) => (
                <th key={c.key} className="text-center px-2 py-3 font-mono text-[10px] text-chalk-400 cursor-help" title={c.title}>
                  {c.label}
                </th>
              ))}
              <th className="text-center px-2 py-3 font-mono text-[10px] text-chalk-400" title="Open Match Detail">VIEW</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m, rowIdx) => {
              const isHome = m.team_side === "home";
              const won = isHome ? m.home_score > m.away_score : m.away_score > m.home_score;
              const draw = m.home_score === m.away_score;
              const passAcc = m.passes > 0 ? ((m.passes_completed / m.passes) * 100).toFixed(0) : "0";
              const dist = (m.distance_run / 1000).toFixed(2);

              return (
                <tr key={`${m.match_id}-${m.team_side}`} className={rowIdx % 2 === 0 ? "bg-pitch-600/15" : ""}>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-chalk-400">
                    {new Date(m.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Rome" })}
                    <span className="text-[11px] text-chalk-100 font-700 ml-5">
                      {new Date(m.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}
                    </span>
                    {m.is_substitute && (
                      <span className="ml-1.5 text-[#F4119E] text-[11px]" title="Substitute">▶</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="text-[10px] font-mono text-chalk-400">{m.position || "-"}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/matches/${m.match_id}`} className="flex items-center gap-1.5 hover:text-grass-400 transition-colors">
                      {m.team_logo && <img src={proxyImg(m.team_logo)!} alt="" className="w-4 h-4 object-contain" />}
                      <span className="font-body text-xs text-chalk-200">{m.team_name}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-mono font-700 ${
                      won ? "bg-green-500/20 text-green-400" : draw ? "bg-chalk-400/20 text-chalk-400" : "bg-red-500/20 text-red-400"
                    }`}>
                      {won ? "W" : draw ? "D" : "L"}
                    </span>
                  </td>
                  <td className={`px-2 py-2.5 text-center font-mono text-xs ${m.goals > 0 ? "text-grass-400 font-medium" : "text-chalk-300"}`}>{m.goals}</td>
                  <td className={`px-2 py-2.5 text-center font-mono text-xs ${m.assists > 0 ? "text-grass-400" : "text-chalk-300"}`}>{m.assists}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-xs text-chalk-300">{m.shots}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-xs text-chalk-300">{m.shots_on_target}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-xs text-chalk-300">{m.passes}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-xs text-chalk-300">{m.passes_completed}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-xs text-chalk-300">{m.interceptions}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-xs text-chalk-300">{passAcc}%</td>
                  <td className={`px-2 py-2.5 text-center font-mono text-xs ${m.saves > 0 ? "text-cyan-400" : "text-chalk-300"}`}>{m.saves}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-xs text-chalk-300">{m.goals_conceded}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-xs text-chalk-300">{m.offsides}</td>
                  <td className={`px-2 py-2.5 text-center font-mono text-xs ${m.yellow_cards > 0 ? "text-amber-400" : "text-chalk-300"}`}>{m.yellow_cards}</td>
                  <td className={`px-2 py-2.5 text-center font-mono text-xs ${m.red_cards > 0 ? "text-red-400 font-medium" : "text-chalk-300"}`}>{m.red_cards}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-xs text-chalk-300">{dist}km</td>
                  <td className="px-2 py-2.5 text-center font-mono text-xs">
                    <Link
                      href={`/matches/${m.match_id}`}
                      className="inline-flex items-center justify-center rounded-md border border-[#F4119E] bg-transparent px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#F4119E] transition-colors hover:bg-[#F4119E] hover:text-white"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs font-mono text-chalk-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={`/players/${steamIdParam}/potm?page=1`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="First page"
              >
                &laquo;
              </Link>
            )}
            {page > 1 && (
              <Link
                href={`/players/${steamIdParam}/potm?page=${Math.max(1, page - 10)}`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="Back 10 pages"
              >
                &lt;
              </Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) {
                p = i + 1;
              } else if (page <= 3) {
                p = i + 1;
              } else if (page >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = page - 2 + i;
              }
              return (
                <Link
                  key={p}
                  href={`/players/${steamIdParam}/potm?page=${p}`}
                  className={`w-8 h-8 rounded text-xs font-mono transition-colors flex items-center justify-center ${
                    p === page
                      ? "bg-[#F4119E] text-white font-700"
                      : "text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            {page < totalPages && (
              <Link
                href={`/players/${steamIdParam}/potm?page=${Math.min(totalPages, page + 10)}`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="Forward 10 pages"
              >
                &gt;
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/players/${steamIdParam}/potm?page=${totalPages}`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="Last page"
              >
                &raquo;
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
