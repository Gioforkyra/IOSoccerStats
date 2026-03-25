import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

const SORT_OPTIONS: Record<string, { label: string; orderBy: Prisma.Sql }> = {
  rating:   { label: "Rating",  orderBy: Prisma.sql`p.rating` },
  goals:    { label: "Goals",    orderBy: Prisma.sql`agg.total_goals` },
  assists:  { label: "Assists",  orderBy: Prisma.sql`agg.total_assists` },
  apps:     { label: "Apps",     orderBy: Prisma.sql`agg.apps` },
  xg:       { label: "xG",      orderBy: Prisma.sql`agg.total_xg` },
  shotAcc:  { label: "Shot%",   orderBy: Prisma.sql`agg.shot_accuracy` },
  passAcc:  { label: "Pass%",   orderBy: Prisma.sql`agg.pass_accuracy` },
  saves:    { label: "Saves",   orderBy: Prisma.sql`agg.total_saves` },
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
  const dir = params.dir === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const posFilter = params.pos || "";
  const offset = (page - 1) * PAGE_SIZE;

  const orderCol = SORT_OPTIONS[sortKey].orderBy;

  // Use materialized view for fast queries (ms instead of 17s)
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
    JOIN mv_player_leaderboard agg ON agg.player_steam_id = p.steam_id
    ${posFilter ? Prisma.sql`WHERE p.position = ${posFilter}` : Prisma.empty}
    ORDER BY ${orderCol} ${Prisma.raw(dir)} NULLS LAST
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  const countResult = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total
    FROM mv_player_leaderboard agg
    ${posFilter ? Prisma.sql`JOIN players p ON p.steam_id = agg.player_steam_id WHERE p.position = ${posFilter}` : Prisma.empty}
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
    { key: "rating",  label: "RTG",   title: "Rating" },
    { key: "apps",    label: "APPS",  title: "Appearances" },
    { key: "goals",   label: "GOALS", title: "Goals" },
    { key: "assists", label: "AST",   title: "Assists" },
    { key: "xg",      label: "xG",    title: "Expected Goals" },
    { key: "shotAcc", label: "SHOT%", title: "Shot Accuracy" },
    { key: "passAcc", label: "PASS%", title: "Pass Accuracy" },
    { key: "saves",   label: "SAVES", title: "Saves" },
  ];

  const positions = ["GK", "DEF", "MID", "ATT"];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            PLAYER STATS
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {totalPlayers.toLocaleString()} players · sorted by{" "}
            <span className={`font-mono ${dir === "DESC" ? "text-red-400" : "text-grass-500"}`}>{SORT_OPTIONS[sortKey].label}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 text-xs font-mono flex-wrap">
        <Link
          href={posUrl("")}
          className={`px-3 py-1 rounded border transition-colors ${
            !posFilter
              ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10"
              : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"
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
                ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10"
                : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"
            }`}
          >
            {p}
          </Link>
        ))}
      </div>

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
                    className="flex items-center justify-end gap-1 hover:text-chalk-100 transition-colors cursor-help"
                    title={col.title}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className={dir === "DESC" ? "text-red-400" : "text-grass-500"}>
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
                  <td className="px-4 py-1.5 font-display font-700 text-chalk-100/20 text-base">
                    {offset + i + 1}
                  </td>
                  <td className="px-4 py-1.5">
                    <Link
                      href={`/players/${p.steam_id}`}
                      className="flex items-center gap-2.5 hover:text-[#F4119E] transition-colors"
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
                      <span className="font-body font-medium text-chalk-100 group-hover:text-[#F4119E] transition-colors">
                        {p.username}
                      </span>
                      {p.position && (
                        <span className="text-[10px] font-mono text-chalk-400 bg-pitch-800 px-1.5 py-0.5 rounded">
                          {p.position}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className={`px-4 py-1.5 text-right font-mono font-medium ${
                    p.rating && p.rating >= 8 ? "text-grass-500" : p.rating && p.rating >= 6 ? "text-amber-400" : "text-chalk-300"
                  }`}>
                    {p.rating ? p.rating.toFixed(1) : "-"}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-300">
                    {apps.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono font-medium text-chalk-200">
                    {goals.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-300">
                    {assists.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-300">
                    {xg.toFixed(1)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-300">
                    {shotAcc.toFixed(1)}%
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-300">
                    {passAcc.toFixed(1)}%
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-300">
                    {saves.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right text-chalk-400/20 group-hover:text-[#F4119E] transition-colors">
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
              href={pageUrl(1)}
              className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
              title="First page"
            >
              &laquo;
            </Link>
          )}
          {page > 1 && (
            <Link
              href={pageUrl(Math.max(1, page - 10))}
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
                href={pageUrl(p)}
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
              href={pageUrl(Math.min(totalPages, page + 10))}
              className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
              title="Forward 10 pages"
            >
              &gt;
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={pageUrl(totalPages)}
              className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
              title="Last page"
            >
              &raquo;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
