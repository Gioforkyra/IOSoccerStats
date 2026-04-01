import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import Link from "next/link";

export const revalidate = 300;

const PAGE_SIZE = 15;

const MIN_MATCHES_OPTIONS = [0, 10, 25, 50, 100, 250, 500, 1000];
const TEAM_TYPES = [
  { value: "0", label: "ALL TYPES" },
  { value: "1", label: "CLUB" },
  { value: "2", label: "NATIONAL" },
  { value: "3", label: "MIX" },
  { value: "4", label: "DRAFT" },
];
const REGIONS = [
  { value: "Europe",        label: "EU" },
  { value: "Americas",      label: "AM" },
  { value: "North America", label: "NA" },
  { value: "South America", label: "SA" },
  { value: "Asia",          label: "ASIA" },
  { value: "",              label: "ALL" },
];

const SORT_COLS = [
  "matches", "win_pct", "wins", "losses", "draws",
  "goals_avg", "assists_avg", "shots_avg", "shot_accuracy",
  "passes_avg", "pass_completion", "interceptions_avg",
  "offsides_avg", "possession_avg", "yellows_avg", "reds_avg",
] as const;
type SortCol = typeof SORT_COLS[number];

type TeamRow = {
  id: number;
  name: string;
  logo: string | null;
  color: string | null;
  matches: bigint;
  wins: bigint;
  draws: bigint;
  losses: bigint;
  win_pct: number;
  goals_avg: number;
  assists_avg: number;
  shots_avg: number;
  shot_accuracy: number;
  passes_avg: number;
  pass_completion: number;
  interceptions_avg: number;
  offsides_avg: number;
  possession_avg: number;
  yellows_avg: number;
  reds_avg: number;
  form_str: string | null;
};

const SORT_SQL: Record<SortCol, string> = {
  matches: "matches",
  win_pct: "win_pct",
  wins: "wins",
  losses: "losses",
  draws: "draws",
  goals_avg: "goals_avg",
  assists_avg: "assists_avg",
  shots_avg: "shots_avg",
  shot_accuracy: "shot_accuracy",
  passes_avg: "passes_avg",
  pass_completion: "pass_completion",
  interceptions_avg: "interceptions_avg",
  offsides_avg: "offsides_avg",
  possession_avg: "possession_avg",
  yellows_avg: "yellows_avg",
  reds_avg: "reds_avg",
};

function f2(v: number | null) {
  return v != null ? v.toFixed(2) : "0.00";
}
function f1pct(v: number | null) {
  return v != null ? v.toFixed(1) + "%" : "0%";
}

export default async function TeamStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    dir?: string;
    page?: string;
    q?: string;
    minMatches?: string;
    type?: string;
    region?: string;
  }>;
}) {
  const params = await searchParams;

  const sortKey = (SORT_COLS.includes(params.sort as SortCol) ? params.sort : "matches") as SortCol;
  const dir = params.dir === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const nameQuery = params.q?.trim() || "";
  const minMatches = MIN_MATCHES_OPTIONS.includes(parseInt(params.minMatches || "0"))
    ? parseInt(params.minMatches || "0")
    : 0;
  const teamType = parseInt(params.type || "0");
  // Default to Europe
  const regionFilter = params.region !== undefined ? params.region : "Europe";
  const offset = (page - 1) * PAGE_SIZE;

  const sortSqlStr = SORT_SQL[sortKey];
  const effectiveMin = Math.max(1, minMatches);

  function buildCte() {
    const ttFilter = teamType > 0
      ? Prisma.sql`AND t.team_type = ${teamType}`
      : Prisma.empty;
    const nFilter = nameQuery
      ? Prisma.sql`AND t.name ILIKE ${"%" + nameQuery + "%"}`
      : Prisma.empty;
    const minFilter = Prisma.sql`HAVING COUNT(DISTINCT tma.match_id) >= ${effectiveMin}`;
    const rFilter = regionFilter
      ? Prisma.sql`AND t.region = ${regionFilter}`
      : Prisma.empty;

    return Prisma.sql`
      WITH team_sides AS (
        SELECT
          m.id AS match_id,
          t.id AS team_id,
          CASE WHEN m.home_team_id = t.id THEN 'home' ELSE 'away' END AS side,
          CASE
            WHEN (m.home_team_id = t.id AND m.home_score > m.away_score)
              OR (m.away_team_id = t.id AND m.away_score > m.home_score) THEN 'W'
            WHEN m.home_score = m.away_score THEN 'D'
            ELSE 'L'
          END AS result
        FROM matches m
        JOIN teams t ON t.id = m.home_team_id OR t.id = m.away_team_id
        WHERE t.inactive = false ${ttFilter} ${nFilter} ${rFilter}
      ),
      match_total_poss AS (
        SELECT match_id, NULLIF(SUM(possession), 0) AS total_poss
        FROM match_player_stats
        GROUP BY match_id
      ),
      team_match_agg AS (
        SELECT
          ts.team_id, ts.match_id, ts.result,
          SUM(mps.goals)              AS goals,
          SUM(mps.assists)            AS assists,
          SUM(mps.shots)              AS shots,
          SUM(mps.shots_on_target)    AS shots_on_target,
          SUM(mps.passes)             AS passes,
          SUM(mps.passes_completed)   AS passes_completed,
          SUM(mps.interceptions)      AS interceptions,
          SUM(mps.offsides)           AS offsides,
          SUM(mps.yellow_cards)       AS yellow_cards,
          SUM(mps.red_cards)          AS red_cards,
          SUM(mps.possession)         AS team_poss,
          mtp.total_poss
        FROM team_sides ts
        JOIN match_player_stats mps ON mps.match_id = ts.match_id AND mps.team_side = ts.side
        LEFT JOIN match_total_poss mtp ON mtp.match_id = ts.match_id
        GROUP BY ts.team_id, ts.match_id, ts.result, mtp.total_poss
      ),
      team_form AS (
        SELECT team_id, STRING_AGG(result, ',' ORDER BY rn ASC) AS form_str
        FROM (
          SELECT ts.team_id, ts.result,
                 ROW_NUMBER() OVER (PARTITION BY ts.team_id ORDER BY m.date DESC) AS rn
          FROM team_sides ts
          JOIN matches m ON m.id = ts.match_id
        ) ranked
        WHERE rn <= 5
        GROUP BY team_id
      ),
      team_stats AS (
        SELECT
          t.id, t.name, t.logo, t.color,
          COUNT(DISTINCT tma.match_id)::bigint                                                AS matches,
          COUNT(DISTINCT CASE WHEN tma.result = 'W' THEN tma.match_id END)::bigint           AS wins,
          COUNT(DISTINCT CASE WHEN tma.result = 'D' THEN tma.match_id END)::bigint           AS draws,
          COUNT(DISTINCT CASE WHEN tma.result = 'L' THEN tma.match_id END)::bigint           AS losses,
          ROUND(COUNT(DISTINCT CASE WHEN tma.result = 'W' THEN tma.match_id END)::numeric
            / NULLIF(COUNT(DISTINCT tma.match_id), 0) * 100, 1)::float8                      AS win_pct,
          ROUND(AVG(tma.goals)::numeric, 2)::float8                                          AS goals_avg,
          ROUND(AVG(tma.assists)::numeric, 2)::float8                                        AS assists_avg,
          ROUND(AVG(tma.shots)::numeric, 2)::float8                                          AS shots_avg,
          ROUND(SUM(tma.shots_on_target)::numeric / NULLIF(SUM(tma.shots), 0) * 100, 1)::float8 AS shot_accuracy,
          ROUND(AVG(tma.passes)::numeric, 2)::float8                                         AS passes_avg,
          ROUND(SUM(tma.passes_completed)::numeric / NULLIF(SUM(tma.passes), 0) * 100, 1)::float8 AS pass_completion,
          ROUND(AVG(tma.interceptions)::numeric, 2)::float8                                  AS interceptions_avg,
          ROUND(AVG(tma.offsides)::numeric, 2)::float8                                       AS offsides_avg,
          ROUND(AVG(CASE WHEN tma.total_poss > 0 THEN tma.team_poss::numeric / tma.total_poss * 100 END)::numeric, 2)::float8 AS possession_avg,
          ROUND(AVG(tma.yellow_cards)::numeric, 2)::float8                                   AS yellows_avg,
          ROUND(AVG(tma.red_cards)::numeric, 2)::float8                                      AS reds_avg,
          tf.form_str
        FROM teams t
        JOIN team_match_agg tma ON tma.team_id = t.id
        LEFT JOIN team_form tf ON tf.team_id = t.id
        WHERE t.inactive = false ${ttFilter} ${nFilter} ${rFilter}
        GROUP BY t.id, t.name, t.logo, t.color, tf.form_str
        ${minFilter}
      )
    `;
  }

  const [rows, countResult] = await Promise.all([
    prisma.$queryRaw<TeamRow[]>`
      ${buildCte()}
      SELECT * FROM team_stats
      ORDER BY ${Prisma.raw(sortSqlStr)} ${Prisma.raw(dir)} NULLS LAST
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      ${buildCte()}
      SELECT COUNT(*) AS total FROM team_stats
    `,
  ]);
  const totalTeams = Number((countResult as { total: bigint }[])[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalTeams / PAGE_SIZE));

  /* URL builders */
  function baseUrl() {
    const sp = new URLSearchParams();
    sp.set("sort", sortKey);
    sp.set("dir", dir.toLowerCase());
    if (nameQuery) sp.set("q", nameQuery);
    if (minMatches > 0) sp.set("minMatches", String(minMatches));
    if (teamType > 0) sp.set("type", String(teamType));
    if (regionFilter !== "Europe") sp.set("region", regionFilter);
    return sp;
  }
  function sortUrl(key: SortCol) {
    const newDir = key === sortKey && dir === "DESC" ? "asc" : "desc";
    const sp = baseUrl();
    sp.set("sort", key);
    sp.set("dir", newDir);
    sp.delete("page");
    return `/teams/statistics?${sp.toString()}`;
  }
  function pageUrl(p: number) {
    const sp = baseUrl();
    sp.set("page", String(p));
    return `/teams/statistics?${sp.toString()}`;
  }
  function filterUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams();
    if (sortKey !== "matches") sp.set("sort", sortKey);
    if (dir !== "DESC") sp.set("dir", dir.toLowerCase());
    if (nameQuery) sp.set("q", nameQuery);
    if (minMatches > 0) sp.set("minMatches", String(minMatches));
    if (teamType > 0) sp.set("type", String(teamType));
    if (regionFilter !== "Europe") sp.set("region", regionFilter);
    for (const [k, v] of Object.entries(overrides)) {
      if (k === "region" && v === "Europe") sp.delete(k);
      else if (v === "" || v === "0") sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete("page");
    return `/teams/statistics?${sp.toString()}`;
  }

  type ColDef = { key: SortCol; label: string; title: string; avg?: boolean; format: (r: TeamRow) => string };
  const columns: ColDef[] = [
    { key: "matches",          label: "MATCHES",  title: "Matches Played",           format: (r) => Number(r.matches).toLocaleString() },
    { key: "win_pct",          label: "WIN%",     title: "Win Rate",                  format: (r) => f1pct(r.win_pct) },
    { key: "wins",             label: "W",        title: "Wins",                      format: (r) => Number(r.wins).toLocaleString() },
    { key: "losses",           label: "L",        title: "Losses",                    format: (r) => Number(r.losses).toLocaleString() },
    { key: "draws",            label: "D",        title: "Draws",                     format: (r) => Number(r.draws).toLocaleString() },
    { key: "goals_avg",        label: "GOALS",    title: "Goals per Match (avg)",     avg: true, format: (r) => f2(r.goals_avg) },
    { key: "assists_avg",      label: "ASSISTS",  title: "Assists per Match (avg)",   avg: true, format: (r) => f2(r.assists_avg) },
    { key: "shots_avg",        label: "SHOTS",    title: "Shots per Match (avg)",     avg: true, format: (r) => f2(r.shots_avg) },
    { key: "shot_accuracy",    label: "SHOT ACC", title: "Shot Accuracy",             format: (r) => f1pct(r.shot_accuracy) },
    { key: "passes_avg",       label: "PASSES",   title: "Passes per Match (avg)",    avg: true, format: (r) => f2(r.passes_avg) },
    { key: "pass_completion",  label: "PASS%",    title: "Pass Completion",           format: (r) => f1pct(r.pass_completion) },
    { key: "interceptions_avg",label: "INT",      title: "Interceptions (avg)",       avg: true, format: (r) => f2(r.interceptions_avg) },
    { key: "offsides_avg",     label: "OFFSIDES", title: "Offsides per Match (avg)",  avg: true, format: (r) => f2(r.offsides_avg) },
    { key: "possession_avg",   label: "POSS",     title: "Possession Average",        format: (r) => f1pct(r.possession_avg) },
    { key: "yellows_avg",      label: "YEL",      title: "Yellow Cards (avg)",        avg: true, format: (r) => f2(r.yellows_avg) },
    { key: "reds_avg",         label: "RED",      title: "Red Cards (avg)",           avg: true, format: (r) => f2(r.reds_avg) },
  ];

  function FormBadge({ result }: { result: string }) {
    const cls =
      result === "W"
        ? "bg-grass-500 text-white"
        : result === "D"
        ? "bg-chalk-500/40 text-chalk-200"
        : "bg-red-600 text-white";
    return (
      <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-mono font-700 ${cls}`}>
        {result}
      </span>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">TEAM STATISTICS</h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {totalTeams.toLocaleString()} teams · sorted by{" "}
            <span className="font-mono text-chalk-300">{columns.find((c) => c.key === sortKey)?.title ?? sortKey}</span>
          </p>
        </div>

        {/* Search */}
        <form action="/teams/statistics" method="GET" className="flex items-center gap-2 flex-wrap">
          {sortKey !== "matches" && <input type="hidden" name="sort" value={sortKey} />}
          {dir !== "DESC" && <input type="hidden" name="dir" value={dir.toLowerCase()} />}
          {minMatches > 0 && <input type="hidden" name="minMatches" value={String(minMatches)} />}
          {teamType > 0 && <input type="hidden" name="type" value={String(teamType)} />}
          {regionFilter !== "Europe" && <input type="hidden" name="region" value={regionFilter} />}
          <input
            type="text"
            name="q"
            placeholder="Filter By Team Name"
            defaultValue={nameQuery}
            className="bg-pitch-800 border border-chalk-100/10 rounded px-3 py-1.5 text-sm text-chalk-100 placeholder:text-chalk-400/50 font-body focus:outline-none focus:border-[#F4119E]/50 w-52"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-mono rounded border border-chalk-100/10 text-chalk-300 hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors"
          >
            FILTER
          </button>
        </form>
      </div>

      {/* Filters row 1: Region + Team type */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {REGIONS.map((r) => (
          <Link
            key={r.value}
            href={filterUrl({ region: r.value })}
            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              regionFilter === r.value
                ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10"
                : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/30 hover:text-chalk-200"
            }`}
          >
            {r.label}
          </Link>
        ))}
        <span className="text-chalk-100/10 text-xs">|</span>
        {TEAM_TYPES.map((t) => (
          <Link
            key={t.value}
            href={filterUrl({ type: t.value })}
            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              String(teamType) === t.value
                ? "border-chalk-300/60 text-chalk-200 bg-chalk-100/5"
                : "border-chalk-100/10 text-chalk-400 hover:border-chalk-100/30 hover:text-chalk-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Filters row 2: Min matches */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <span className="text-xs font-mono text-chalk-500">MIN MATCHES</span>
        {MIN_MATCHES_OPTIONS.map((v) => (
          <Link
            key={v}
            href={filterUrl({ minMatches: String(v) })}
            className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${
              minMatches === v
                ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10"
                : "border-chalk-100/10 text-chalk-400 hover:border-chalk-100/30 hover:text-chalk-200"
            }`}
          >
            {v === 0 ? "ALL" : v}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-chalk-100/8">
              <th className="text-left px-3 py-3 font-mono text-xs text-chalk-400 w-8">#</th>
              <th className="text-left px-3 py-3 font-mono text-xs text-chalk-400 sticky left-0 bg-pitch-900/95 z-10 min-w-[160px]">
                TEAM
              </th>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-3 font-mono text-[11px] text-chalk-400 text-right">
                  <Link
                    href={sortUrl(col.key)}
                    className="flex items-center justify-end gap-1 hover:text-chalk-100 transition-colors"
                    title={col.title}
                  >
                    <span className="flex flex-col items-end leading-tight">
                      <span>{col.label}</span>
                      {col.avg && <span className="text-[9px] text-chalk-500">AVERAGE</span>}
                    </span>
                    {sortKey === col.key && (
                      <span className={dir === "DESC" ? "text-red-400" : "text-green-400"}>
                        {dir === "DESC" ? "↓" : "↑"}
                      </span>
                    )}
                  </Link>
                </th>
              ))}
              <th className="px-3 py-3 font-mono text-[11px] text-chalk-400 text-right">FORM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const form = row.form_str ? row.form_str.split(",").slice(0, 5) : [];
              const teamColor = row.color || "#F4119E";
              return (
                <tr key={row.id} className={`stat-row group border-b border-chalk-100/4 last:border-0 ${i % 2 === 0 ? "trow-odd" : "trow-even"}`}>
                  <td className="px-3 py-1.5 font-display font-700 text-chalk-100/20 text-base">
                    {offset + i + 1}
                  </td>
                  <td className={`px-3 py-1.5 sticky left-0 z-10 ${i % 2 === 0 ? "trow-odd" : "trow-even"}`}>
                    <Link
                      href={`/teams/${row.id}`}
                      className="flex items-center gap-2 hover:text-[#F4119E] transition-colors"
                    >
                      {row.logo ? (
                        <img src={row.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
                      ) : (
                        <div
                          className="w-5 h-5 rounded shrink-0 flex items-center justify-center text-[9px] font-display font-700"
                          style={{ backgroundColor: teamColor + "33", color: teamColor }}
                        >
                          {row.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="font-body font-medium text-chalk-100 group-hover:text-[#F4119E] transition-colors truncate max-w-[140px]">
                        {row.name}
                      </span>
                    </Link>
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-1.5 text-right font-mono text-[12px] text-chalk-300">
                      {col.format(row)}
                    </td>
                  ))}
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-0.5 justify-end">
                      {form.length > 0
                        ? form.map((r, fi) => <FormBadge key={fi} result={r} />)
                        : <span className="text-chalk-500 text-xs font-mono">—</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 3} className="px-4 py-12 text-center text-chalk-400 font-body">
                  No teams found.
                </td>
              </tr>
            )}
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
              <Link href={pageUrl(1)} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="First page">
                &laquo;
              </Link>
            )}
            {page > 1 && (
              <Link href={pageUrl(Math.max(1, page - 10))} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center">
                &lt;
              </Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
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
              <Link href={pageUrl(Math.min(totalPages, page + 10))} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center">
                &gt;
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageUrl(totalPages)} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="Last page">
                &raquo;
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
