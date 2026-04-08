import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Player Statistics — IOSHUBv2",
  description: "Full IOSoccer player statistics leaderboard. Filter by goals, assists, rating and more.",
};
import { MinAppsSelect } from "./MinAppsSelect";
import { PendingLink } from "./PendingLink";
import { PlayersFilterForm } from "./PlayersFilterForm";
import { PlayersNavProgress } from "./PlayersNavProgress";
import { getPlayerStatisticsTotals, type ApiPlayerStatisticsTotalsItem } from "@/lib/iosoccer-api";
import { prisma } from "@/lib/prisma";

export const revalidate = 120;

const PAGE_SIZE = 10;

const UNSUPPORTED_SORT_KEYS = new Set(["tackles", "tacklesComp", "tackleAcc"]);

type StatView = "general" | "gk" | "defending" | "attacking";

const STAT_VIEWS: { key: StatView; label: string }[] = [
  { key: "general", label: "General Stats" },
  { key: "gk", label: "Goalkeeping Stats" },
  { key: "defending", label: "Defending Stats" },
  { key: "attacking", label: "Attacking Stats" },
];

type PlayerRow = {
  steam_id: string;
  username: string;
  rating: number | null;
  country: string | null;
  apps: number;
  as_sub: number;
  wins: number;
  draws: number;
  losses: number;
  total_goals: number;
  total_assists: number;
  total_second_assists: number;
  total_shots: number;
  total_shots_on_target: number;
  total_key_passes: number;
  total_chances_created: number;
  total_offsides: number;
  total_own_goals: number;
  total_passes: number;
  total_passes_completed: number;
  total_saves: number;
  total_saves_caught: number;
  total_goals_conceded: number;
  total_interceptions: number;
  total_tackles: number;
  total_tackles_completed: number;
  total_fouls: number;
  total_fouls_suffered: number;
  total_yellow_cards: number;
  total_red_cards: number;
  total_distance: number;
  total_possession: number;
  avg_possession_pct: number;
  shot_accuracy: number;
  pass_accuracy: number;
};

type ColDef = {
  key: string;
  label: string;
  title: string;
  apiSortBy: string;
  format: (row: PlayerRow) => string;
  avg?: boolean;
};

const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(2) + "%" : "0%");
const avg = (total: number, apps: number) => (apps > 0 ? (total / apps).toFixed(2) : "0");
const winPct = (r: PlayerRow) => (r.apps > 0 ? ((r.wins / r.apps) * 100).toFixed(0) + "%" : "0%");
const distKm = (r: PlayerRow) => (r.apps > 0 ? (r.total_distance / 1000 / r.apps).toFixed(2) + "km" : "0");
const saveRate = (r: PlayerRow) => {
  const faced = r.total_saves + r.total_goals_conceded;
  return faced > 0 ? ((r.total_saves / faced) * 100).toFixed(2) + "%" : "0%";
};

function normalizePct(v: number | null | undefined): number {
  const n = Number(v ?? 0);
  return n >= 0 && n <= 1 ? n * 100 : n;
}

function toPlayerRow(item: ApiPlayerStatisticsTotalsItem): PlayerRow {
  const apps = Number(item.appearances ?? 0);
  return {
    steam_id: item.steamID,
    username: item.nickname || item.name || item.steamID,
    rating: item.rating ?? null,
    country: item.countryCode || item.country || null,
    apps,
    as_sub: Number(item.substituteAppearances ?? 0),
    wins: Number(item.wins ?? 0),
    draws: Number(item.draws ?? 0),
    losses: Number(item.losses ?? 0),
    total_goals: Number(item.goals ?? 0),
    total_assists: Number(item.assists ?? 0),
    total_second_assists: Number(item.secondAssists ?? 0),
    total_shots: Number(item.shots ?? 0),
    total_shots_on_target: Number(item.shotsOnGoal ?? 0),
    total_key_passes: Number(item.keyPasses ?? 0),
    total_chances_created: Number(item.chancesCreated ?? 0),
    total_offsides: Number(item.offsides ?? 0),
    total_own_goals: Number(item.ownGoals ?? 0),
    total_passes: Number(item.passes ?? 0),
    total_passes_completed: Number(item.passesCompleted ?? 0),
    total_saves: Number(item.keeperSaves ?? 0),
    total_saves_caught: Math.round(Number(item.keeperSavesCaughtAverage ?? 0) * apps),
    total_goals_conceded: Number(item.goalsConceded ?? 0),
    total_interceptions: Number(item.interceptions ?? 0),
    total_tackles: Math.round(Number(item.slidingTacklesAverage ?? 0) * apps),
    total_tackles_completed: Math.round(Number(item.slidingTacklesCompletedAverage ?? 0) * apps),
    total_fouls: Number(item.fouls ?? 0),
    total_fouls_suffered: Number(item.foulsSuffered ?? 0),
    total_yellow_cards: Number(item.yellowCards ?? 0),
    total_red_cards: Number(item.redCards ?? 0),
    total_distance: Math.round(Number(item.distanceCoveredAverage ?? 0) * apps),
    total_possession: Math.round(Number(item.possessionAverage ?? 0) * apps),
    avg_possession_pct: normalizePct(item.possessionPercentageAverage),
    shot_accuracy: normalizePct(item.shotAccuracyPercentage),
    pass_accuracy: normalizePct(item.passCompletionPercentageAverage),
  };
}

function buildColumns(view: StatView): ColDef[] {
  const rating: ColDef = {
    key: "rating", label: "RTG", title: "Rating", apiSortBy: "Rating", format: (r) => (r.rating != null ? r.rating.toFixed(1) : "-"),
  };
  const apps: ColDef = {
    key: "apps", label: "APPS", title: "Appearances", apiSortBy: "Appearances", format: (r) => r.apps.toLocaleString(),
  };
  const asSub: ColDef = {
    key: "asSub", label: "SUB", title: "As Substitute", apiSortBy: "SubstituteAppearances", format: (r) => r.as_sub.toLocaleString(),
  };
  const winRate: ColDef = {
    key: "winPct", label: "WIN%", title: "Win Rate", apiSortBy: "WinPercentage", format: winPct,
  };
  const wins: ColDef = {
    key: "wins", label: "W", title: "Wins", apiSortBy: "Wins", format: (r) => r.wins.toLocaleString(),
  };
  const losses: ColDef = {
    key: "losses", label: "L", title: "Losses", apiSortBy: "Losses", format: (r) => r.losses.toLocaleString(),
  };
  const draws: ColDef = {
    key: "draws", label: "D", title: "Draws", apiSortBy: "Draws", format: (r) => r.draws.toLocaleString(),
  };

  switch (view) {
    case "general":
      return [
        rating, apps, asSub, winRate, wins, losses, draws,
        { key: "goals", label: "GOALS", title: "Goals", apiSortBy: "Goals", format: (r) => r.total_goals.toLocaleString() },
        { key: "goalsAvg", label: "GOALS", title: "Goals / App (avg)", apiSortBy: "GoalsAverage", format: (r) => avg(r.total_goals, r.apps), avg: true },
        { key: "shotAcc", label: "SHOT ACC", title: "Shot Accuracy", apiSortBy: "ShotAccuracyPercentage", format: (r) => r.shot_accuracy.toFixed(2) + "%" },
        { key: "assists", label: "AST", title: "Assists", apiSortBy: "Assists", format: (r) => r.total_assists.toLocaleString() },
        { key: "assistsAvg", label: "AST", title: "Assists / App (avg)", apiSortBy: "AssistsAverage", format: (r) => avg(r.total_assists, r.apps), avg: true },
        { key: "passes", label: "PASSES", title: "Passes (avg)", apiSortBy: "PassesAverage", format: (r) => avg(r.total_passes, r.apps), avg: true },
        { key: "passAcc", label: "PASS%", title: "Pass Completion", apiSortBy: "PassCompletionPercentageAverage", format: (r) => r.pass_accuracy.toFixed(2) + "%" },
        { key: "poss", label: "POSS", title: "Possession", apiSortBy: "PossessionPercentageAverage", format: (r) => r.avg_possession_pct.toFixed(2) + "%", avg: true },
        { key: "yellows", label: "YEL", title: "Yellow Cards", apiSortBy: "YellowCards", format: (r) => r.total_yellow_cards.toLocaleString() },
        { key: "reds", label: "RED", title: "Red Cards", apiSortBy: "RedCards", format: (r) => r.total_red_cards.toLocaleString() },
        { key: "dist", label: "DIST", title: "Distance / App (avg)", apiSortBy: "DistanceCoveredAverage", format: distKm, avg: true },
      ];

    case "gk":
      return [
        rating, apps, asSub, winRate, wins, losses, draws,
        { key: "passes", label: "PASSES", title: "Passes (avg)", apiSortBy: "PassesAverage", format: (r) => avg(r.total_passes, r.apps), avg: true },
        { key: "passAcc", label: "PASS%", title: "Pass Completion", apiSortBy: "PassCompletionPercentageAverage", format: (r) => r.pass_accuracy.toFixed(2) + "%" },
        { key: "poss", label: "POSS", title: "Possession", apiSortBy: "PossessionPercentageAverage", format: (r) => r.avg_possession_pct.toFixed(2) + "%", avg: true },
        { key: "yellows", label: "YEL", title: "Yellow Cards", apiSortBy: "YellowCards", format: (r) => r.total_yellow_cards.toLocaleString() },
        { key: "reds", label: "RED", title: "Red Cards", apiSortBy: "RedCards", format: (r) => r.total_red_cards.toLocaleString() },
        { key: "saves", label: "SAVES", title: "Saves (avg)", apiSortBy: "KeeperSavesAverage", format: (r) => avg(r.total_saves, r.apps), avg: true },
        { key: "saveRate", label: "SV%", title: "Save Rate", apiSortBy: "KeeperSavePercentage", format: saveRate },
        { key: "savesCaught", label: "CAUGHT", title: "Saves Caught (avg)", apiSortBy: "KeeperSavesCaughtAverage", format: (r) => avg(r.total_saves_caught, r.apps), avg: true },
        { key: "goalsConceded", label: "GC", title: "Goals Conceded (avg)", apiSortBy: "GoalsConcededAverage", format: (r) => avg(r.total_goals_conceded, r.apps), avg: true },
      ];

    case "defending":
      return [
        rating, apps, asSub, winRate, wins, losses, draws,
        { key: "interceptions", label: "INT", title: "Interceptions", apiSortBy: "Interceptions", format: (r) => r.total_interceptions.toLocaleString() },
        { key: "intAvg", label: "INT", title: "Interceptions / App (avg)", apiSortBy: "InterceptionsAverage", format: (r) => avg(r.total_interceptions, r.apps), avg: true },
        { key: "tackles", label: "TKL", title: "Tackles", apiSortBy: "SlidingTackles", format: (r) => r.total_tackles.toLocaleString() },
        { key: "tacklesComp", label: "TKL✓", title: "Tackles Completed", apiSortBy: "SlidingTacklesCompleted", format: (r) => r.total_tackles_completed.toLocaleString() },
        { key: "tackleAcc", label: "TKL%", title: "Tackle Accuracy", apiSortBy: "TackleAccuracyPercentage", format: (r) => pct(r.total_tackles_completed, r.total_tackles) },
        { key: "fouls", label: "FLS", title: "Fouls", apiSortBy: "Fouls", format: (r) => r.total_fouls.toLocaleString() },
        { key: "foulsSuffered", label: "FLS+", title: "Fouls Suffered", apiSortBy: "FoulsSuffered", format: (r) => r.total_fouls_suffered.toLocaleString() },
        { key: "yellows", label: "YEL", title: "Yellow Cards", apiSortBy: "YellowCards", format: (r) => r.total_yellow_cards.toLocaleString() },
        { key: "reds", label: "RED", title: "Red Cards", apiSortBy: "RedCards", format: (r) => r.total_red_cards.toLocaleString() },
        { key: "ownGoals", label: "OG", title: "Own Goals", apiSortBy: "OwnGoals", format: (r) => r.total_own_goals.toLocaleString() },
        { key: "goalsConceded", label: "GC", title: "Goals Conceded", apiSortBy: "GoalsConceded", format: (r) => r.total_goals_conceded.toLocaleString() },
        { key: "gcAvg", label: "GC", title: "Goals Conceded / App (avg)", apiSortBy: "GoalsConcededAverage", format: (r) => avg(r.total_goals_conceded, r.apps), avg: true },
      ];

    case "attacking":
      return [
        rating, apps, asSub, winRate, wins, losses, draws,
        { key: "goals", label: "GOALS", title: "Goals", apiSortBy: "Goals", format: (r) => r.total_goals.toLocaleString() },
        { key: "goalsAvg", label: "GOALS", title: "Goals / App (avg)", apiSortBy: "GoalsAverage", format: (r) => avg(r.total_goals, r.apps), avg: true },
        { key: "assists", label: "AST", title: "Assists", apiSortBy: "Assists", format: (r) => r.total_assists.toLocaleString() },
        { key: "assistsAvg", label: "AST", title: "Assists / App (avg)", apiSortBy: "AssistsAverage", format: (r) => avg(r.total_assists, r.apps), avg: true },
        { key: "secondAssists", label: "2ND", title: "Second Assists", apiSortBy: "SecondAssists", format: (r) => r.total_second_assists.toLocaleString() },
        { key: "shots", label: "SHT", title: "Shots", apiSortBy: "Shots", format: (r) => r.total_shots.toLocaleString() },
        { key: "shotsOT", label: "SOT", title: "Shots on Target", apiSortBy: "ShotsOnGoal", format: (r) => r.total_shots_on_target.toLocaleString() },
        { key: "shotAcc", label: "SHOT%", title: "Shot Accuracy", apiSortBy: "ShotAccuracyPercentage", format: (r) => r.shot_accuracy.toFixed(2) + "%" },
        { key: "shotConv", label: "CONV%", title: "Shot Conversion", apiSortBy: "ShotConversionPercentage", format: (r) => pct(r.total_goals, r.total_shots) },
        { key: "keyPasses", label: "KP", title: "Key Passes", apiSortBy: "KeyPasses", format: (r) => r.total_key_passes.toLocaleString() },
        { key: "chancesCreated", label: "CC", title: "Chances Created", apiSortBy: "ChancesCreated", format: (r) => r.total_chances_created.toLocaleString() },
        { key: "offsides", label: "OFF", title: "Offsides", apiSortBy: "Offsides", format: (r) => r.total_offsides.toLocaleString() },
        { key: "passes", label: "PASS", title: "Passes", apiSortBy: "Passes", format: (r) => r.total_passes.toLocaleString() },
        { key: "passAcc", label: "PASS%", title: "Pass Completion", apiSortBy: "PassCompletionPercentageAverage", format: (r) => r.pass_accuracy.toFixed(2) + "%" },
      ];
  }
}

function colMap(view: StatView): Record<string, ColDef> {
  const cols = buildColumns(view);
  const map: Record<string, ColDef> = {};
  for (const c of cols) map[c.key] = c;
  return map;
}

const MIN_APPS_OPTIONS = [0, 10, 25, 50, 100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; page?: string; view?: string; q?: string; minApps?: string }>;
}) {
  const params = await searchParams;
  const view = (params.view && ["general", "gk", "defending", "attacking"].includes(params.view) ? params.view : "general") as StatView;
  const columns = buildColumns(view);
  const cMap = colMap(view);

  const requestedSortKey = params.sort && (cMap[params.sort] || params.sort === "hubId") ? params.sort : "hubId";
  const sortKey = UNSUPPORTED_SORT_KEYS.has(requestedSortKey) ? "hubId" : requestedSortKey;
  const dir = params.dir === "desc" ? "DESC" : sortKey === "hubId" && !params.dir ? "ASC" : params.dir === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const nameQuery = params.q?.trim() || "";
  const minApps = MIN_APPS_OPTIONS.includes(parseInt(params.minApps || "0", 10)) ? parseInt(params.minApps || "0", 10) : 0;
  const offset = (page - 1) * PAGE_SIZE;

  const sortBy = sortKey === "hubId" ? "PlayerId" : (cMap[sortKey]?.apiSortBy || "PlayerId");

  let apiRows: ApiPlayerStatisticsTotalsItem[] = [];
  let totalPlayers = 0;
  let totalPages = 1;
  let players: PlayerRow[] = [];

  try {
    const res = await getPlayerStatisticsTotals({
      page,
      pageSize: PAGE_SIZE,
      sortBy,
      sortOrder: dir,
      playerName: nameQuery || undefined,
      minApps: minApps > 0 ? minApps : undefined,
      includeSubstituteAppearances: true,
      matchFormat: 8,
      regionId: 1,
      timePeriod: 0,
    });
    apiRows = res.items || [];
    totalPlayers = res.totalItems || 0;
    totalPages = Math.max(1, res.totalPages || 1);
    players = apiRows.map(toPlayerRow);
  } catch {
    try {
      // Retry the same sort once: official API can intermittently fail even on valid sort fields.
      const retryRes = await getPlayerStatisticsTotals({
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder: dir,
        playerName: nameQuery || undefined,
        minApps: minApps > 0 ? minApps : undefined,
        includeSubstituteAppearances: true,
        matchFormat: 8,
        regionId: 1,
        timePeriod: 0,
      });
      apiRows = retryRes.items || [];
      totalPlayers = retryRes.totalItems || 0;
      totalPages = Math.max(1, retryRes.totalPages || 1);
      players = apiRows.map(toPlayerRow);
    } catch {
      try {
        const fallbackRes = await getPlayerStatisticsTotals({
          page,
          pageSize: PAGE_SIZE,
          sortBy: "PlayerId",
          sortOrder: "ASC",
          playerName: nameQuery || undefined,
          minApps: minApps > 0 ? minApps : undefined,
          includeSubstituteAppearances: true,
          matchFormat: 8,
          regionId: 1,
          timePeriod: 0,
        });
        apiRows = fallbackRes.items || [];
        totalPlayers = fallbackRes.totalItems || 0;
        totalPages = Math.max(1, fallbackRes.totalPages || 1);
        players = apiRows.map(toPlayerRow);
      } catch {
        players = [];
        totalPlayers = 0;
        totalPages = 1;
      }
    }
  }

  const steamIds = Array.from(
    new Set(
      players
        .map((p) => (typeof p.steam_id === "string" ? p.steam_id.trim() : ""))
        .filter((id) => id.length > 0)
    )
  );
  const avatarRows = steamIds.length
    ? await prisma.player.findMany({
        where: { steamId: { in: steamIds } },
        select: { steamId: true, avatar: true },
      })
    : [];
  const avatarBySteam = new Map<string, string | null>(avatarRows.map((r) => [r.steamId, r.avatar]));

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
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">PLAYER STATS</h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {totalPlayers.toLocaleString()} players · sorted by{" "}
            <span className="font-mono text-chalk-300">{sortKey === "hubId" ? "Hub ID" : (cMap[sortKey]?.title ?? sortKey)}</span>
          </p>
        </div>

        <PlayersFilterForm
          view={view}
          initialQuery={nameQuery}
          sortKey={sortKey}
          dir={dir.toLowerCase()}
          minApps={minApps}
        />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STAT_VIEWS.map((sv) => (
          <PendingLink key={sv.key} href={viewUrl(sv.key)} className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${view === sv.key ? "bg-[#F4119E]/15 text-[#F4119E] border border-[#F4119E]/40" : "border border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/30 hover:text-chalk-200"}`} showSpinner>
            {sv.label.toUpperCase()}
          </PendingLink>
        ))}

        <div className="ml-auto">
          <MinAppsSelect view={view} sortKey={sortKey} dir={dir.toLowerCase()} nameQuery={nameQuery} minApps={minApps} />
        </div>
      </div>

      <PlayersNavProgress />

      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-chalk-100/8">
              <th className="text-left px-3 py-3 font-mono text-xs text-chalk-400 w-8">#</th>
              <th className="text-left px-3 py-3 font-mono text-xs text-chalk-400 sticky left-0 bg-pitch-900/95 z-10 min-w-[160px]">PLAYER</th>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-3 font-mono text-[11px] text-chalk-400 text-right">
                  {UNSUPPORTED_SORT_KEYS.has(col.key) ? (
                    <span className="flex items-center justify-end gap-1 text-chalk-500 cursor-not-allowed" title={`${col.title} (sorting not supported by official API)`}>
                      <span className="flex flex-col items-end leading-tight">
                        <span>{col.label}</span>
                        {col.avg && <span className="text-[9px] text-chalk-500">AVERAGE</span>}
                      </span>
                    </span>
                  ) : (
                    <PendingLink href={sortUrl(col.key)} className="flex items-center justify-end gap-1 hover:text-chalk-100 transition-colors cursor-help" title={col.title} showSpinner>
                      <span className="flex flex-col items-end leading-tight">
                        <span>{col.label}</span>
                        {col.avg && <span className="text-[9px] text-chalk-500">AVERAGE</span>}
                      </span>
                      {sortKey === col.key && <span className={dir === "DESC" ? "text-red-400" : "text-green-400"}>{dir === "DESC" ? "\u2193" : "\u2191"}</span>}
                    </PendingLink>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={`${p.steam_id}-${i}`} className={`stat-row group ${i % 2 === 0 ? "trow-odd" : "trow-even"}`}>
                <td className="px-3 py-1.5 font-display font-700 text-chalk-100/20 text-base">{offset + i + 1}</td>
                <td className={`px-3 py-1.5 sticky left-0 z-10 ${i % 2 === 0 ? "trow-odd" : "trow-even"}`}>
                  <Link href={`/players/${encodeURIComponent(p.steam_id)}`} prefetch={false} className="flex items-center gap-2 hover:text-[#F4119E] transition-colors">
                    {avatarBySteam.get(p.steam_id) ? (
                      <img
                        src={avatarBySteam.get(p.steam_id) as string}
                        alt={p.username}
                        className="w-6 h-6 rounded object-cover border border-chalk-100/10 shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded bg-pitch-700 flex items-center justify-center text-[10px] font-display font-700 text-chalk-300 shrink-0">
                        {p.username[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <span className="font-body font-medium text-chalk-100 group-hover:text-[#F4119E] transition-colors truncate max-w-[120px]">{p.username}</span>
                    {p.country && (
                      <img src={`https://flagcdn.com/16x12/${p.country.toLowerCase()}.png`} alt={p.country} className="w-4 h-3 object-cover shrink-0" title={p.country} />
                    )}
                  </Link>
                </td>
                {columns.map((col) => {
                  const val = col.format(p);
                  let cellClass = "px-3 py-1.5 text-right font-mono text-[12px] text-chalk-300";
                  if (col.key === "winPct") {
                    const wr = p.apps > 0 ? (p.wins / p.apps) * 100 : 0;
                    if (wr > 51) cellClass = "px-3 py-1.5 text-right font-mono text-[12px] wr-elite";
                    else if (wr >= 45) cellClass = "px-3 py-1.5 text-right font-mono text-[12px] text-green-400";
                    else cellClass = "px-3 py-1.5 text-right font-mono text-[12px] text-red-400";
                  }
                  return (
                    <td key={col.key} className={cellClass}>
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

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs font-mono text-chalk-400">Page {page} of {totalPages}</span>
        <div className="flex items-center gap-1">
          {page > 1 && (
            <PendingLink href={pageUrl(1)} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="First page">&laquo;</PendingLink>
          )}
          {page > 1 && (
            <PendingLink href={pageUrl(Math.max(1, page - 10))} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="Back 10 pages">&lt;</PendingLink>
          )}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p: number;
            if (totalPages <= 5) p = i + 1;
            else if (page <= 3) p = i + 1;
            else if (page >= totalPages - 2) p = totalPages - 4 + i;
            else p = page - 2 + i;
            return (
              <PendingLink key={p} href={pageUrl(p)} className={`w-8 h-8 rounded text-xs font-mono transition-colors flex items-center justify-center ${p === page ? "bg-[#F4119E] text-white font-700" : "text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30"}`}>
                {p}
              </PendingLink>
            );
          })}
          {page < totalPages && (
            <PendingLink href={pageUrl(Math.min(totalPages, page + 10))} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="Forward 10 pages">&gt;</PendingLink>
          )}
          {page < totalPages && (
            <PendingLink href={pageUrl(totalPages)} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="Last page">&raquo;</PendingLink>
          )}
        </div>
      </div>
    </div>
  );
}
