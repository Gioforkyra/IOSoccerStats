import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { MinAppsSelect } from "./MinAppsSelect";

const PAGE_SIZE = 10;

/* ------------------------------------------------------------------ */
/*  Stat views – mirroring the official IOSoccer site                 */
/* ------------------------------------------------------------------ */

type StatView = "general" | "gk" | "defending" | "attacking";

const STAT_VIEWS: { key: StatView; label: string }[] = [
  { key: "general", label: "General Stats" },
  { key: "gk", label: "Goalkeeping Stats" },
  { key: "defending", label: "Defending Stats" },
  { key: "attacking", label: "Attacking Stats" },
];

type ColDef = {
  key: string;
  label: string;
  title: string;
  sortSql: Prisma.Sql;
  format: (row: PlayerRow) => string;
  highlight?: boolean;     // pink / accent colour
  avg?: boolean;           // shown as "per app" average
};

/* ------------------------------------------------------------------ */
/*  Row type – every aggregated field we might need                   */
/* ------------------------------------------------------------------ */

type PlayerRow = {
  steam_id: string;
  username: string;
  position: string | null;
  avatar: string | null;
  rating: number | null;
  country: string | null;
  iosoccer_id: number | null;
  apps: bigint;
  as_sub: bigint;
  wins: bigint;
  draws: bigint;
  losses: bigint;
  total_goals: bigint;
  total_assists: bigint;
  total_second_assists: bigint;
  total_shots: bigint;
  total_shots_on_target: bigint;
  total_key_passes: bigint;
  total_chances_created: bigint;
  total_offsides: bigint;
  total_own_goals: bigint;
  total_passes: bigint;
  total_passes_completed: bigint;
  total_saves: bigint;
  total_saves_caught: bigint;
  total_goals_conceded: bigint;
  total_interceptions: bigint;
  total_tackles: bigint;
  total_tackles_completed: bigint;
  total_fouls: bigint;
  total_fouls_suffered: bigint;
  total_yellow_cards: bigint;
  total_red_cards: bigint;
  total_distance: bigint;
  total_possession: bigint;
  avg_possession_pct: number;
  shot_accuracy: number;
  pass_accuracy: number;
};

/* helpers */
const n = (v: bigint) => Number(v);
const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(2) + "%" : "0%");
const avg = (total: bigint, apps: bigint) => {
  const a = n(apps);
  return a > 0 ? (n(total) / a).toFixed(2) : "0";
};
const winPct = (r: PlayerRow) => {
  const a = n(r.apps);
  return a > 0 ? ((n(r.wins) / a) * 100).toFixed(0) + "%" : "0%";
};
const distKm = (r: PlayerRow) => {
  const a = n(r.apps);
  if (a === 0) return "0";
  const km = n(r.total_distance) / 1000 / a;
  return km.toFixed(2) + "km";
};
const saveRate = (r: PlayerRow) => {
  const faced = n(r.total_saves) + n(r.total_goals_conceded);
  return faced > 0 ? ((n(r.total_saves) / faced) * 100).toFixed(2) + "%" : "0%";
};

/* ------------------------------------------------------------------ */
/*  Column definitions per view                                       */
/* ------------------------------------------------------------------ */

function buildColumns(view: StatView): ColDef[] {
  // Shared base columns (always shown first after player)
  const rating: ColDef = {
    key: "rating", label: "RTG", title: "Rating",
    sortSql: Prisma.sql`p.rating`,
    format: (r) => r.rating ? r.rating.toFixed(1) : "-",
  };
  const apps: ColDef = {
    key: "apps", label: "APPS", title: "Appearances",
    sortSql: Prisma.sql`agg.apps`,
    format: (r) => n(r.apps).toLocaleString(),
  };
  const asSub: ColDef = {
    key: "asSub", label: "SUB", title: "As Substitute",
    sortSql: Prisma.sql`agg.as_sub`,
    format: (r) => n(r.as_sub).toLocaleString(),
  };
  const winRate: ColDef = {
    key: "winPct", label: "WIN%", title: "Win Rate",
    sortSql: Prisma.sql`(agg.wins::float / NULLIF(agg.apps,0))`,
    format: winPct,
  };
  const wins: ColDef = {
    key: "wins", label: "W", title: "Wins",
    sortSql: Prisma.sql`agg.wins`,
    format: (r) => n(r.wins).toLocaleString(),
  };
  const losses: ColDef = {
    key: "losses", label: "L", title: "Losses",
    sortSql: Prisma.sql`agg.losses`,
    format: (r) => n(r.losses).toLocaleString(),
  };
  const draws: ColDef = {
    key: "draws", label: "D", title: "Draws",
    sortSql: Prisma.sql`agg.draws`,
    format: (r) => n(r.draws).toLocaleString(),
  };

  switch (view) {
    case "general":
      return [
        rating, apps, asSub, winRate, wins, losses, draws,
        { key: "goals", label: "GOALS", title: "Goals", sortSql: Prisma.sql`agg.total_goals`, format: (r) => n(r.total_goals).toLocaleString() },
        { key: "goalsAvg", label: "GOALS", title: "Goals / App (avg)", sortSql: Prisma.sql`(agg.total_goals::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_goals, r.apps), avg: true },
        { key: "shotAcc", label: "SHOT ACC", title: "Shot Accuracy", sortSql: Prisma.sql`agg.shot_accuracy`, format: (r) => r.shot_accuracy.toFixed(2) + "%" },
        { key: "assists", label: "AST", title: "Assists", sortSql: Prisma.sql`agg.total_assists`, format: (r) => n(r.total_assists).toLocaleString() },
        { key: "assistsAvg", label: "AST", title: "Assists / App (avg)", sortSql: Prisma.sql`(agg.total_assists::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_assists, r.apps), avg: true },
        { key: "passes", label: "PASSES", title: "Passes (avg)", sortSql: Prisma.sql`(agg.total_passes::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_passes, r.apps), avg: true },
        { key: "passAcc", label: "PASS%", title: "Pass Completion", sortSql: Prisma.sql`agg.pass_accuracy`, format: (r) => r.pass_accuracy.toFixed(2) + "%" },
        { key: "poss", label: "POSS", title: "Possession", sortSql: Prisma.sql`agg.avg_possession_pct`, format: (r) => r.avg_possession_pct.toFixed(2) + "%", avg: true },
        { key: "yellows", label: "YEL", title: "Yellow Cards", sortSql: Prisma.sql`agg.total_yellow_cards`, format: (r) => n(r.total_yellow_cards).toLocaleString() },
        { key: "reds", label: "RED", title: "Red Cards", sortSql: Prisma.sql`agg.total_red_cards`, format: (r) => n(r.total_red_cards).toLocaleString() },
        { key: "dist", label: "DIST", title: "Distance / App (avg)", sortSql: Prisma.sql`(agg.total_distance::float / NULLIF(agg.apps,0))`, format: distKm, avg: true },
      ];

    case "gk":
      return [
        rating, apps, asSub, winRate, wins, losses, draws,
        { key: "passes", label: "PASSES", title: "Passes (avg)", sortSql: Prisma.sql`(agg.total_passes::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_passes, r.apps), avg: true },
        { key: "passAcc", label: "PASS%", title: "Pass Completion", sortSql: Prisma.sql`agg.pass_accuracy`, format: (r) => r.pass_accuracy.toFixed(2) + "%" },
        { key: "poss", label: "POSS", title: "Possession", sortSql: Prisma.sql`agg.avg_possession_pct`, format: (r) => r.avg_possession_pct.toFixed(2) + "%", avg: true },
        { key: "yellows", label: "YEL", title: "Yellow Cards", sortSql: Prisma.sql`agg.total_yellow_cards`, format: (r) => n(r.total_yellow_cards).toLocaleString() },
        { key: "reds", label: "RED", title: "Red Cards", sortSql: Prisma.sql`agg.total_red_cards`, format: (r) => n(r.total_red_cards).toLocaleString() },
        { key: "saves", label: "SAVES", title: "Saves (avg)", sortSql: Prisma.sql`(agg.total_saves::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_saves, r.apps), avg: true, highlight: true },
        { key: "saveRate", label: "SV%", title: "Save Rate", sortSql: Prisma.sql`(agg.total_saves::float / NULLIF(agg.total_saves + agg.total_goals_conceded,0))`, format: saveRate, highlight: true },
        { key: "savesCaught", label: "CAUGHT", title: "Saves Caught (avg)", sortSql: Prisma.sql`(agg.total_saves_caught::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_saves_caught, r.apps), avg: true },
        { key: "goalsConceded", label: "GC", title: "Goals Conceded (avg)", sortSql: Prisma.sql`(agg.total_goals_conceded::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_goals_conceded, r.apps), avg: true },
      ];

    case "defending":
      return [
        rating, apps, asSub, winRate, wins, losses, draws,
        { key: "interceptions", label: "INT", title: "Interceptions", sortSql: Prisma.sql`agg.total_interceptions`, format: (r) => n(r.total_interceptions).toLocaleString() },
        { key: "intAvg", label: "INT", title: "Interceptions / App (avg)", sortSql: Prisma.sql`(agg.total_interceptions::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_interceptions, r.apps), avg: true },
        { key: "tackles", label: "TKL", title: "Tackles", sortSql: Prisma.sql`agg.total_tackles`, format: (r) => n(r.total_tackles).toLocaleString() },
        { key: "tacklesComp", label: "TKL✓", title: "Tackles Completed", sortSql: Prisma.sql`agg.total_tackles_completed`, format: (r) => n(r.total_tackles_completed).toLocaleString() },
        { key: "tackleAcc", label: "TKL%", title: "Tackle Accuracy", sortSql: Prisma.sql`(agg.total_tackles_completed::float / NULLIF(agg.total_tackles,0))`, format: (r) => pct(n(r.total_tackles_completed), n(r.total_tackles)) },
        { key: "fouls", label: "FLS", title: "Fouls", sortSql: Prisma.sql`agg.total_fouls`, format: (r) => n(r.total_fouls).toLocaleString() },
        { key: "foulsSuffered", label: "FLS+", title: "Fouls Suffered", sortSql: Prisma.sql`agg.total_fouls_suffered`, format: (r) => n(r.total_fouls_suffered).toLocaleString() },
        { key: "yellows", label: "YEL", title: "Yellow Cards", sortSql: Prisma.sql`agg.total_yellow_cards`, format: (r) => n(r.total_yellow_cards).toLocaleString() },
        { key: "reds", label: "RED", title: "Red Cards", sortSql: Prisma.sql`agg.total_red_cards`, format: (r) => n(r.total_red_cards).toLocaleString() },
        { key: "ownGoals", label: "OG", title: "Own Goals", sortSql: Prisma.sql`agg.total_own_goals`, format: (r) => n(r.total_own_goals).toLocaleString() },
        { key: "goalsConceded", label: "GC", title: "Goals Conceded", sortSql: Prisma.sql`agg.total_goals_conceded`, format: (r) => n(r.total_goals_conceded).toLocaleString() },
        { key: "gcAvg", label: "GC", title: "Goals Conceded / App (avg)", sortSql: Prisma.sql`(agg.total_goals_conceded::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_goals_conceded, r.apps), avg: true },
      ];

    case "attacking":
      return [
        rating, apps, asSub, winRate, wins, losses, draws,
        { key: "goals", label: "GOALS", title: "Goals", sortSql: Prisma.sql`agg.total_goals`, format: (r) => n(r.total_goals).toLocaleString() },
        { key: "goalsAvg", label: "GOALS", title: "Goals / App (avg)", sortSql: Prisma.sql`(agg.total_goals::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_goals, r.apps), avg: true },
        { key: "assists", label: "AST", title: "Assists", sortSql: Prisma.sql`agg.total_assists`, format: (r) => n(r.total_assists).toLocaleString() },
        { key: "assistsAvg", label: "AST", title: "Assists / App (avg)", sortSql: Prisma.sql`(agg.total_assists::float / NULLIF(agg.apps,0))`, format: (r) => avg(r.total_assists, r.apps), avg: true },
        { key: "secondAssists", label: "2ND", title: "Second Assists", sortSql: Prisma.sql`agg.total_second_assists`, format: (r) => n(r.total_second_assists).toLocaleString() },
        { key: "shots", label: "SHT", title: "Shots", sortSql: Prisma.sql`agg.total_shots`, format: (r) => n(r.total_shots).toLocaleString() },
        { key: "shotsOT", label: "SOT", title: "Shots on Target", sortSql: Prisma.sql`agg.total_shots_on_target`, format: (r) => n(r.total_shots_on_target).toLocaleString() },
        { key: "shotAcc", label: "SHOT%", title: "Shot Accuracy", sortSql: Prisma.sql`agg.shot_accuracy`, format: (r) => r.shot_accuracy.toFixed(2) + "%" },
        { key: "shotConv", label: "CONV%", title: "Shot Conversion (Goals/Shots)", sortSql: Prisma.sql`(agg.total_goals::float / NULLIF(agg.total_shots,0))`, format: (r) => pct(n(r.total_goals), n(r.total_shots)) },
        { key: "keyPasses", label: "KP", title: "Key Passes", sortSql: Prisma.sql`agg.total_key_passes`, format: (r) => n(r.total_key_passes).toLocaleString() },
        { key: "chancesCreated", label: "CC", title: "Chances Created", sortSql: Prisma.sql`agg.total_chances_created`, format: (r) => n(r.total_chances_created).toLocaleString() },
        { key: "offsides", label: "OFF", title: "Offsides", sortSql: Prisma.sql`agg.total_offsides`, format: (r) => n(r.total_offsides).toLocaleString() },
        { key: "passes", label: "PASS", title: "Passes", sortSql: Prisma.sql`agg.total_passes`, format: (r) => n(r.total_passes).toLocaleString() },
        { key: "passAcc", label: "PASS%", title: "Pass Completion", sortSql: Prisma.sql`agg.pass_accuracy`, format: (r) => r.pass_accuracy.toFixed(2) + "%" },
      ];
  }
}

/* Build a lookup from column key → ColDef for any view */
function colMap(view: StatView): Record<string, ColDef> {
  const cols = buildColumns(view);
  const map: Record<string, ColDef> = {};
  for (const c of cols) map[c.key] = c;
  return map;
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

const MIN_APPS_OPTIONS = [0, 10, 25, 50, 100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; page?: string; pos?: string; view?: string; q?: string; minApps?: string }>;
}) {
  const params = await searchParams;
  const view = (params.view && ["general", "gk", "defending", "attacking"].includes(params.view) ? params.view : "general") as StatView;
  const columns = buildColumns(view);
  const cMap = colMap(view);

  const sortKey = params.sort && (cMap[params.sort] || params.sort === "hubId") ? params.sort : "hubId";
  const dir = params.dir === "desc" ? "DESC" : sortKey === "hubId" && !params.dir ? "ASC" : params.dir === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const nameQuery = params.q?.trim() || "";
  const minApps = MIN_APPS_OPTIONS.includes(parseInt(params.minApps || "0", 10)) ? parseInt(params.minApps || "0", 10) : 0;
  const offset = (page - 1) * PAGE_SIZE;

  const orderCol = sortKey === "hubId" ? Prisma.sql`p.iosoccer_id` : (cMap[sortKey]?.sortSql ?? Prisma.sql`agg.apps`);

  // Build WHERE clause (main query already has LEFT JOIN agg)
  let whereFragment: Prisma.Sql;
  if (nameQuery && minApps > 0) {
    whereFragment = Prisma.sql`WHERE p.username ILIKE ${"%" + nameQuery + "%"} AND COALESCE(agg.apps, 0) >= ${minApps}`;
  } else if (nameQuery) {
    whereFragment = Prisma.sql`WHERE p.username ILIKE ${"%" + nameQuery + "%"}`;
  } else if (minApps > 0) {
    whereFragment = Prisma.sql`WHERE COALESCE(agg.apps, 0) >= ${minApps}`;
  } else {
    whereFragment = Prisma.empty;
  }

  // Count query — needs its own JOIN when filtering by minApps
  const countJoin = minApps > 0 ? Prisma.sql`LEFT JOIN mv_player_leaderboard agg ON agg.player_steam_id = p.steam_id` : Prisma.empty;
  let countWhere: Prisma.Sql;
  if (nameQuery && minApps > 0) {
    countWhere = Prisma.sql`WHERE p.username ILIKE ${"%" + nameQuery + "%"} AND COALESCE(agg.apps, 0) >= ${minApps}`;
  } else if (nameQuery) {
    countWhere = Prisma.sql`WHERE p.username ILIKE ${"%" + nameQuery + "%"}`;
  } else if (minApps > 0) {
    countWhere = Prisma.sql`WHERE COALESCE(agg.apps, 0) >= ${minApps}`;
  } else {
    countWhere = Prisma.empty;
  }

  const players = await prisma.$queryRaw<PlayerRow[]>`
    SELECT
      p.steam_id, p.username, p.position, p.avatar, p.rating, p.country, p.iosoccer_id,
      COALESCE(agg.apps, 0)::bigint AS apps,
      COALESCE(agg.as_sub, 0)::bigint AS as_sub,
      COALESCE(agg.wins, 0)::bigint AS wins,
      COALESCE(agg.draws, 0)::bigint AS draws,
      COALESCE(agg.losses, 0)::bigint AS losses,
      COALESCE(agg.total_goals, 0)::bigint AS total_goals,
      COALESCE(agg.total_assists, 0)::bigint AS total_assists,
      COALESCE(agg.total_second_assists, 0)::bigint AS total_second_assists,
      COALESCE(agg.total_shots, 0)::bigint AS total_shots,
      COALESCE(agg.total_shots_on_target, 0)::bigint AS total_shots_on_target,
      COALESCE(agg.total_key_passes, 0)::bigint AS total_key_passes,
      COALESCE(agg.total_chances_created, 0)::bigint AS total_chances_created,
      COALESCE(agg.total_offsides, 0)::bigint AS total_offsides,
      COALESCE(agg.total_own_goals, 0)::bigint AS total_own_goals,
      COALESCE(agg.total_passes, 0)::bigint AS total_passes,
      COALESCE(agg.total_passes_completed, 0)::bigint AS total_passes_completed,
      COALESCE(agg.total_saves, 0)::bigint AS total_saves,
      COALESCE(agg.total_saves_caught, 0)::bigint AS total_saves_caught,
      COALESCE(agg.total_goals_conceded, 0)::bigint AS total_goals_conceded,
      COALESCE(agg.total_interceptions, 0)::bigint AS total_interceptions,
      COALESCE(agg.total_tackles, 0)::bigint AS total_tackles,
      COALESCE(agg.total_tackles_completed, 0)::bigint AS total_tackles_completed,
      COALESCE(agg.total_fouls, 0)::bigint AS total_fouls,
      COALESCE(agg.total_fouls_suffered, 0)::bigint AS total_fouls_suffered,
      COALESCE(agg.total_yellow_cards, 0)::bigint AS total_yellow_cards,
      COALESCE(agg.total_red_cards, 0)::bigint AS total_red_cards,
      COALESCE(agg.total_distance, 0)::bigint AS total_distance,
      COALESCE(agg.total_possession, 0)::bigint AS total_possession,
      COALESCE(agg.avg_possession_pct, 0)::float8 AS avg_possession_pct,
      COALESCE(agg.shot_accuracy, 0)::float8 AS shot_accuracy,
      COALESCE(agg.pass_accuracy, 0)::float8 AS pass_accuracy
    FROM players p
    LEFT JOIN mv_player_leaderboard agg ON agg.player_steam_id = p.steam_id
    ${whereFragment}
    ORDER BY ${orderCol} ${Prisma.raw(dir)} NULLS LAST
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  const countResult = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total
    FROM players p
    ${countJoin}
    ${countWhere}
  `;
  const totalPlayers = Number(countResult[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalPlayers / PAGE_SIZE));

  /* ---- URL builders ---- */

  function baseParams() {
    const sp = new URLSearchParams();
    sp.set("view", view);
    sp.set("sort", sortKey);
    sp.set("dir", dir.toLowerCase());
    if (nameQuery) sp.set("q", nameQuery);
    if (minApps > 0) sp.set("minApps", String(minApps));
    return sp;
  }

  function sortUrl(key: string) {
    const newDir = key === sortKey && dir === "DESC" ? "asc" : "desc";
    const sp = baseParams();
    sp.set("sort", key);
    sp.set("dir", newDir);
    sp.delete("page");
    return `/players?${sp.toString()}`;
  }

  function pageUrl(p: number) {
    const sp = baseParams();
    sp.set("page", String(p));
    return `/players?${sp.toString()}`;
  }

  function viewUrl(v: string) {
    const sp = new URLSearchParams();
    sp.set("view", v);
    if (nameQuery) sp.set("q", nameQuery);
    if (minApps > 0) sp.set("minApps", String(minApps));
    return `/players?${sp.toString()}`;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            PLAYER STATS
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {totalPlayers.toLocaleString()} players · sorted by{" "}
            <span className="font-mono text-chalk-300">
              {sortKey === "hubId" ? "Hub ID" : (cMap[sortKey]?.title ?? sortKey)}
            </span>
          </p>
        </div>

        {/* Search */}
        <form action="/players" method="GET" className="flex items-center gap-2 flex-wrap">
          <input type="hidden" name="view" value={view} />
          <input
            type="text"
            name="q"
            placeholder="Filter By Player Name"
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

      {/* Stat view tabs + min apps filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STAT_VIEWS.map((sv) => (
          <Link
            key={sv.key}
            href={viewUrl(sv.key)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
              view === sv.key
                ? "bg-[#F4119E]/15 text-[#F4119E] border border-[#F4119E]/40"
                : "border border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/30 hover:text-chalk-200"
            }`}
          >
            {sv.label.toUpperCase()}
          </Link>
        ))}

        {/* Min appearances filter — pushed to the right */}
        <div className="ml-auto">
          <MinAppsSelect
            view={view}
            sortKey={sortKey}
            dir={dir.toLowerCase()}
            nameQuery={nameQuery}
            minApps={minApps}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-chalk-100/8">
              <th className="text-left px-3 py-3 font-mono text-xs text-chalk-400 w-8">#</th>
              <th className="text-left px-3 py-3 font-mono text-xs text-chalk-400 sticky left-0 bg-pitch-900/95 z-10 min-w-[160px]">
                PLAYER
              </th>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-3 font-mono text-[11px] text-chalk-400 text-right">
                  <Link
                    href={sortUrl(col.key)}
                    className="flex items-center justify-end gap-1 hover:text-chalk-100 transition-colors cursor-help"
                    title={col.title}
                  >
                    <span className="flex flex-col items-end leading-tight">
                      <span>{col.label}</span>
                      {col.avg && <span className="text-[9px] text-chalk-500">AVERAGE</span>}
                    </span>
                    {sortKey === col.key && (
                      <span className={dir === "DESC" ? "text-red-400" : "text-green-400"}>
                        {dir === "DESC" ? "\u2193" : "\u2191"}
                      </span>
                    )}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.steam_id} className={`stat-row group ${i % 2 === 0 ? "trow-odd" : "trow-even"}`}>
                <td className="px-3 py-1.5 font-display font-700 text-chalk-100/20 text-base">
                  {offset + i + 1}
                </td>
                <td className={`px-3 py-1.5 sticky left-0 z-10 ${i % 2 === 0 ? "trow-odd" : "trow-even"}`}>
                  <Link
                    href={`/players/${encodeURIComponent(p.steam_id)}`}
                    className="flex items-center gap-2 hover:text-[#F4119E] transition-colors"
                  >
                    {p.avatar ? (
                      <img src={p.avatar} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-pitch-700 flex items-center justify-center text-[10px] font-display font-700 text-chalk-300 shrink-0">
                        {p.username[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <span className="font-body font-medium text-chalk-100 group-hover:text-[#F4119E] transition-colors truncate max-w-[120px]">
                      {p.username}
                    </span>
                    {p.country && (
                      <img
                        src={`https://flagcdn.com/16x12/${p.country.toLowerCase()}.png`}
                        alt={p.country}
                        className="w-4 h-3 object-cover shrink-0"
                        title={p.country}
                      />
                    )}
                  </Link>
                </td>
                {columns.map((col) => {
                  const val = col.format(p);
                  return (
                    <td key={col.key} className="px-3 py-1.5 text-right font-mono text-[12px] text-chalk-300">
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-12 text-center text-chalk-400 font-body">
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
