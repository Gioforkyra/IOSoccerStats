import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

const SORT_OPTIONS: Record<string, { label: string; orderBy: Prisma.Sql }> = {
  rating:   { label: "Rating",  orderBy: Prisma.sql`p.rating` },
  goals:    { label: "Goals",    orderBy: Prisma.sql`total_goals` },
  assists:  { label: "Assists",  orderBy: Prisma.sql`total_assists` },
  apps:     { label: "Apps",     orderBy: Prisma.sql`apps` },
  xg:       { label: "xG",      orderBy: Prisma.sql`total_xg` },
  shotAcc:  { label: "Shot%",   orderBy: Prisma.sql`shot_accuracy` },
  passAcc:  { label: "Pass%",   orderBy: Prisma.sql`pass_accuracy` },
  saves:    { label: "Saves",   orderBy: Prisma.sql`total_saves` },
};

type PlayerRow = {
  steam_id: string;
  username: string;
  position: string | null;
  avatar: string | null;
  rating: number | null;
  apps: bigint;
  total_goals: bigint;
  total_assists: bigint;
  total_saves: bigint;
  total_xg: number;
  shot_accuracy: number;
  pass_accuracy: number;
};

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; page?: string; pos?: string }>;
}) {
  const params = await searchParams;
  const sortKey = params.sort && SORT_OPTIONS[params.sort] ? params.sort : "apps";
  const dir = params.dir === "asc" ? "ASC" : params.dir === "desc" ? "DESC" : (params.sort ? "DESC" : "DESC");
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const posFilter = params.pos || "";
  const offset = (page - 1) * PAGE_SIZE;

  const posWhere = posFilter
    ? Prisma.sql`AND mps.position = ${posFilter}`
    : Prisma.empty;

  const orderCol = SORT_OPTIONS[sortKey].orderBy;

  // Set longer timeout for this heavy query
  await prisma.$executeRaw`SET LOCAL statement_timeout = '30s'`;

  const players = await prisma.$queryRaw<PlayerRow[]>`
    SELECT
      p.steam_id,
      p.username,
      p.position,
      p.avatar,
      p.rating,
      agg.apps,
      agg.total_goals,
      agg.total_assists,
      agg.total_saves,
      agg.total_xg,
      agg.shot_accuracy,
      agg.pass_accuracy
    FROM players p
    JOIN (
      SELECT
        mps.player_steam_id,
        COUNT(DISTINCT mps.match_id) AS apps,
        COALESCE(SUM(mps.goals), 0) AS total_goals,
        COALESCE(SUM(mps.assists), 0) AS total_assists,
        COALESCE(SUM(mps.saves), 0) AS total_saves,
        COALESCE(SUM(mps.shots_on_target)::float / NULLIF(SUM(mps.shots), 0) * 100, 0) AS shot_accuracy,
        COALESCE(SUM(mps.passes_completed)::float / NULLIF(SUM(mps.passes), 0) * 100, 0) AS pass_accuracy,
        0::float AS total_xg
      FROM match_player_stats mps
      ${posFilter ? Prisma.sql`WHERE mps.position = ${posFilter}` : Prisma.empty}
      GROUP BY mps.player_steam_id
      HAVING COUNT(DISTINCT mps.match_id) >= 5
    ) agg ON agg.player_steam_id = p.steam_id
    ORDER BY ${orderCol} ${Prisma.raw(dir)} NULLS LAST
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  // Count total players
  const countResult = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM (
      SELECT p.steam_id
      FROM players p
      JOIN match_player_stats mps ON mps.player_steam_id = p.steam_id
      ${posFilter ? Prisma.sql`WHERE mps.position = ${posFilter}` : Prisma.empty}
      GROUP BY p.steam_id
      HAVING COUNT(DISTINCT mps.match_id) >= 5
    ) sub
  `;
  const totalPlayers = Number(countResult[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalPlayers / PAGE_SIZE));

  function sortUrl(key: string) {
    const newDir = key === sortKey && dir === "DESC" ? "asc" : "desc";
    const p = new URLSearchParams();
    p.set("sort", key);
    p.set("dir", newDir);
    if (posFilter) p.set("pos", posFilter);
    return `/players?${p.toString()}`;
  }

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    sp.set("sort", sortKey);
    sp.set("dir", dir.toLowerCase());
    if (posFilter) sp.set("pos", posFilter);
    sp.set("page", String(p));
    return `/players?${sp.toString()}`;
  }

  function posUrl(pos: string) {
    const sp = new URLSearchParams();
    sp.set("sort", sortKey);
    sp.set("dir", dir.toLowerCase());
    if (pos) sp.set("pos", pos);
    return `/players?${sp.toString()}`;
  }

  const COLUMNS = [
    { key: "rating",  label: "RTG" },
    { key: "apps",    label: "APPS" },
    { key: "goals",   label: "GOALS" },
    { key: "assists", label: "AST" },
    { key: "xg",      label: "xG" },
    { key: "shotAcc", label: "SHOT%" },
    { key: "passAcc", label: "PASS%" },
    { key: "saves",   label: "SAVES" },
  ];

  const positions = ["GK", "DEF", "MID", "ATT"];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            PLAYER STATS
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {totalPlayers.toLocaleString()} players · sorted by{" "}
            <span className="text-grass-500 font-mono">{SORT_OPTIONS[sortKey].label}</span>
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-grass-500 border border-grass-500/30 rounded-full px-3 py-1">
          xG data exclusive to IOStats
        </div>
      </div>

      {/* Position filters */}
      <div className="flex items-center gap-3 mb-4 text-xs font-mono flex-wrap">
        <Link
          href={posUrl("")}
          className={`px-3 py-1 rounded border transition-colors ${
            !posFilter
              ? "border-grass-500 text-grass-500 bg-grass-500/10"
              : "border-chalk-100/10 text-chalk-400 hover:border-grass-500/40 hover:text-grass-500"
          }`}
        >
          ALL
        </Link>
        {positions.map((p) => (
          <Link
            key={p}
            href={posUrl(p === "ATT" ? "Forward" : p === "DEF" ? "Defender" : p === "MID" ? "Midfielder" : "Goalkeeper")}
            className={`px-3 py-1 rounded border transition-colors ${
              posFilter === (p === "ATT" ? "Forward" : p === "DEF" ? "Defender" : p === "MID" ? "Midfielder" : "Goalkeeper")
                ? "border-grass-500 text-grass-500 bg-grass-500/10"
                : "border-chalk-100/10 text-chalk-400 hover:border-grass-500/40 hover:text-grass-500"
            }`}
          >
            {p}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chalk-100/8">
              <th className="text-left px-4 py-3 font-mono text-xs text-chalk-400 w-8">#</th>
              <th className="text-left px-4 py-3 font-mono text-xs text-chalk-400">PLAYER</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3 font-mono text-xs text-chalk-400 text-right">
                  <Link
                    href={sortUrl(col.key)}
                    className="flex items-center justify-end gap-1 hover:text-chalk-100 transition-colors"
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-grass-500">
                        {dir === "DESC" ? "\u2193" : "\u2191"}
                      </span>
                    )}
                  </Link>
                </th>
              ))}
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => {
              const apps = Number(p.apps);
              const goals = Number(p.total_goals);
              const assists = Number(p.total_assists);
              const xg = p.total_xg;
              const shotAcc = p.shot_accuracy;
              const passAcc = p.pass_accuracy;
              const saves = Number(p.total_saves);

              return (
                <tr key={p.steam_id} className={`stat-row group ${i % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}`}>
                  <td className="px-4 py-3 font-display font-700 text-chalk-100/20 text-base">
                    {offset + i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/players/${p.steam_id}`}
                      className="flex items-center gap-2.5 hover:text-grass-400 transition-colors"
                    >
                      {p.avatar ? (
                        <img
                          src={p.avatar}
                          alt=""
                          className="w-7 h-7 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded bg-pitch-700 flex items-center justify-center text-xs font-display font-700 text-chalk-300 shrink-0">
                          {p.username[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                      <span className="font-body font-medium text-chalk-100 group-hover:text-grass-400 transition-colors">
                        {p.username}
                      </span>
                      {p.position && (
                        <span className="text-[10px] font-mono text-chalk-400 bg-pitch-800 px-1.5 py-0.5 rounded">
                          {p.position}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${
                    p.rating && p.rating >= 8 ? "text-grass-500" : p.rating && p.rating >= 6 ? "text-amber-400" : "text-chalk-300"
                  }`}>
                    {p.rating ? p.rating.toFixed(1) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-300">
                    {apps.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${sortKey === "goals" ? "text-grass-400" : "text-chalk-200"}`}>
                    {goals.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-300">
                    {assists.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${sortKey === "xg" ? "text-grass-400" : "text-grass-500/70"}`}>
                    {xg.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-300">
                    {shotAcc.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-300">
                    {passAcc.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-300">
                    {saves.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-chalk-400/20 group-hover:text-grass-500 transition-colors">
                    {"\u2192"}
                  </td>
                </tr>
              );
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-chalk-400 font-body">
                  No players found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs font-mono text-chalk-400">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          {page > 1 && (
            <Link
              href={pageUrl(page - 1)}
              className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
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
                href={pageUrl(p)}
                className={`w-8 h-8 rounded text-xs font-mono transition-colors flex items-center justify-center ${
                  p === page
                    ? "bg-grass-500 text-pitch-950 font-700"
                    : "text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30"
                }`}
              >
                {p}
              </Link>
            );
          })}
          {page < totalPages && (
            <Link
              href={pageUrl(page + 1)}
              className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
            >
              &gt;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
