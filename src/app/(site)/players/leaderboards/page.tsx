import type { Metadata } from "next";
import Link from "next/link";
import type { ApiPlayerStatisticsTotalsItem } from "@/lib/iosoccer-api";
import { getPastTournaments } from "@/lib/iosoccer-api";
import { prisma } from "@/lib/prisma";
import { PendingLink } from "../PendingLink";
import { LeaderboardsLoadingBar } from "./LeaderboardsLoadingBar";

export const metadata: Metadata = {
  title: "Player Leaderboards — IOSHUBv2",
  description:
    "Top 10 IOSoccer players for goals, assists, appearances, saves, and more.",
};

export const revalidate = 120;

type Board = {
  key: string;
  title: string;
  subtitle: string;
  sortBy: string;
  unit: string;
  minApps?: number;
  format: (p: ApiPlayerStatisticsTotalsItem) => string;
};

const BOARDS: Board[] = [
  {
    key: "appearances",
    title: "Appearances",
    subtitle: "Total matches played",
    sortBy: "Appearances",
    unit: "apps",
    format: (p) => Number(p.appearances ?? 0).toLocaleString(),
  },
  {
    key: "rating",
    title: "Top Rating",
    subtitle: "Highest player rating (min 500 apps)",
    sortBy: "Rating",
    unit: "",
    minApps: 500,
    format: (p) => (p.rating != null ? Number(p.rating).toFixed(1) : "-"),
  },
  {
    key: "goals",
    title: "Most Goals",
    subtitle: "Total goals scored",
    sortBy: "Goals",
    unit: "goals",
    format: (p) => Number(p.goals ?? 0).toLocaleString(),
  },
  {
    key: "goalsPerApp",
    title: "Goals / App",
    subtitle: "Goals per appearance (min 500 apps)",
    sortBy: "GoalsAverage",
    unit: "g/app",
    minApps: 500,
    format: (p) => {
      const apps = Number(p.appearances ?? 0);
      return apps > 0 ? (Number(p.goals ?? 0) / apps).toFixed(2) : "0.00";
    },
  },
  {
    key: "assists",
    title: "Most Assists",
    subtitle: "Total assists",
    sortBy: "Assists",
    unit: "assists",
    format: (p) => Number(p.assists ?? 0).toLocaleString(),
  },
  {
    key: "chancesCreated",
    title: "Chances Created",
    subtitle: "Total chances created",
    sortBy: "ChancesCreated",
    unit: "cc",
    format: (p) => Number(p.chancesCreated ?? 0).toLocaleString(),
  },
  {
    key: "interceptions",
    title: "Interceptions",
    subtitle: "Total interceptions",
    sortBy: "Interceptions",
    unit: "int",
    format: (p) => Number(p.interceptions ?? 0).toLocaleString(),
  },
  {
    key: "saves",
    title: "Most Saves",
    subtitle: "Total keeper saves (min 500 apps)",
    sortBy: "KeeperSaves",
    unit: "saves",
    minApps: 500,
    format: (p) => Number(p.keeperSaves ?? 0).toLocaleString(),
  },
  {
    key: "saveRate",
    title: "Save Rate",
    subtitle: "Saves / shots faced (min 500 apps)",
    sortBy: "KeeperSavePercentage",
    unit: "sv%",
    minApps: 500,
    format: (p) => {
      const saves = Number(p.keeperSaves ?? 0);
      const conceded = Number(p.goalsConceded ?? 0);
      const faced = saves + conceded;
      return faced > 0 ? ((saves / faced) * 100).toFixed(1) + "%" : "0%";
    },
  },
  {
    key: "shotConversion",
    title: "Shot Conversion",
    subtitle: "Goals / shots (min 500 apps)",
    sortBy: "ShotConversionPercentage",
    unit: "conv%",
    minApps: 500,
    format: (p) => {
      const shots = Number(p.shots ?? 0);
      const goals = Number(p.goals ?? 0);
      return shots > 0 ? ((goals / shots) * 100).toFixed(1) + "%" : "0%";
    },
  },
  {
    key: "winRate",
    title: "Win Rate",
    subtitle: "Wins / matches played (min 500 apps)",
    sortBy: "WinPercentage",
    unit: "win%",
    minApps: 500,
    format: (p) => {
      const apps = Number(p.appearances ?? 0);
      const wins = Number(p.wins ?? 0);
      return apps > 0 ? ((wins / apps) * 100).toFixed(1) + "%" : "0%";
    },
  },
  {
    key: "ownGoals",
    title: "Own Goals",
    subtitle: "Oops — own goals scored",
    sortBy: "OwnGoals",
    unit: "og",
    format: (p) => Number(p.ownGoals ?? 0).toLocaleString(),
  },
  {
    key: "redCards",
    title: "Red Cards",
    subtitle: "Most sent off",
    sortBy: "RedCards",
    unit: "reds",
    format: (p) => Number(p.redCards ?? 0).toLocaleString(),
  },
  {
    key: "titles",
    title: "Titles",
    subtitle: "Tournaments won with a team",
    sortBy: "",
    unit: "titles",
    format: () => "",
  },
  {
    key: "potm",
    title: "POTM",
    subtitle: "Player of the Match awards",
    sortBy: "",
    unit: "potm",
    format: () => "",
  },
  {
    key: "potmPerApp",
    title: "POTM / App",
    subtitle: "POTM per appearance · Europe only (min 500 apps)",
    sortBy: "",
    unit: "p/app",
    minApps: 500,
    format: () => "",
  },
];

type LeaderboardRow = { steamID: string; name: string; value: string };

// The upstream API is slow (~30s for sort keys like Appearances / Goals).
// We use Next.js fetch with a 90s abort timeout and rely on Next's fetch
// cache (via next.revalidate) so only the first request per stat is slow.
async function fetchBoard(
  board: Board
): Promise<ApiPlayerStatisticsTotalsItem[]> {
  const body = JSON.stringify({
    page: 1,
    pageSize: 10,
    sortBy: board.sortBy,
    sortOrder: "DESC",
    filters: {
      excludePlayers: [],
      includeSubstituteAppearances: true,
      matchFormat: 8,
      regionId: 1,
      timePeriod: 0,
      ...(board.minApps ? { minimumAppearances: board.minApps } : {}),
    },
  });
  try {
    const res = await fetch(
      "https://iosoccer.com:44380/api/player-statistics/match-totals",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Origin: "https://www.iosoccer.com",
          Referer: "https://www.iosoccer.com/",
        },
        body,
        signal: AbortSignal.timeout(90_000),
        // Cache each stat for 1 hour (3600s). Subsequent visits within the
        // window are served instantly; after expiry the next visit triggers
        // a fresh upstream call. Tag allows manual on-demand purge if needed.
        next: { revalidate: 3600, tags: [`leaderboard:${board.key}`] },
      }
    );
    if (!res.ok) {
      console.error(
        `[leaderboards] ${board.key} (sortBy=${board.sortBy}) HTTP ${res.status}`
      );
      return [];
    }
    const json = (await res.json()) as {
      items?: ApiPlayerStatisticsTotalsItem[];
    };
    return json.items || [];
  } catch (err) {
    console.error(
      `[leaderboards] ${board.key} (sortBy=${board.sortBy}) failed:`,
      err
    );
    return [];
  }
}

async function fetchPotmBoard(
  mode: "total" | "perApp"
): Promise<LeaderboardRow[]> {
  try {
    const rows =
      mode === "total"
        ? await prisma.$queryRaw<
            { steam_id: string; potm_count: bigint; app_count: bigint }[]
          >`
            SELECT
              mps.player_steam_id AS steam_id,
              COUNT(*) FILTER (WHERE mps.is_potm) AS potm_count,
              COUNT(DISTINCT mps.match_id) AS app_count
            FROM match_player_stats mps
            GROUP BY mps.player_steam_id
            HAVING COUNT(*) FILTER (WHERE mps.is_potm) > 0
            ORDER BY potm_count DESC
            LIMIT 10
          `
        : await prisma.$queryRaw<
            { steam_id: string; potm_count: bigint; app_count: bigint }[]
          >`
            SELECT
              mps.player_steam_id AS steam_id,
              COUNT(*) FILTER (WHERE mps.is_potm) AS potm_count,
              COUNT(DISTINCT mps.match_id) AS app_count
            FROM match_player_stats mps
            JOIN matches m ON m.id = mps.match_id
            JOIN teams t ON t.id = CASE
              WHEN mps.team_side = 'home' THEN m.home_team_id
              WHEN mps.team_side = 'away' THEN m.away_team_id
            END
            WHERE t.region_id = 1
            GROUP BY mps.player_steam_id
            HAVING COUNT(DISTINCT mps.match_id) >= 500
            ORDER BY (COUNT(*) FILTER (WHERE mps.is_potm))::float
                     / NULLIF(COUNT(DISTINCT mps.match_id), 0) DESC
            LIMIT 10
          `;

    if (rows.length === 0) return [];

    const steamIds = rows.map((r) => r.steam_id);
    const players = await prisma.player.findMany({
      where: { steamId: { in: steamIds } },
      select: { steamId: true, username: true },
    });
    const nameBySteam = new Map(players.map((p) => [p.steamId, p.username]));

    return rows.map((r) => {
      const potm = Number(r.potm_count);
      const apps = Number(r.app_count);
      const value =
        mode === "total"
          ? potm.toLocaleString()
          : apps > 0
            ? (potm / apps).toFixed(3)
            : "0.000";
      return {
        steamID: r.steam_id,
        name: nameBySteam.get(r.steam_id) ?? r.steam_id,
        value,
      };
    });
  } catch (err) {
    console.error(`[leaderboards] potm (${mode}) failed:`, err);
    return [];
  }
}

async function fetchTitlesBoard(): Promise<LeaderboardRow[]> {
  try {
    const pastTournaments = await getPastTournaments();
    const winning = pastTournaments.filter(
      (t) => t.winningTeamId != null
    );
    if (winning.length === 0) return [];

    const winningTeamIds = Array.from(
      new Set(winning.map((t) => t.winningTeamId as number))
    );

    const stints = await prisma.$queryRaw<
      { steam_id: string; team_id: number; join_date: Date; leave_date: Date }[]
    >`
      SELECT
        tr.player_steam_id AS steam_id,
        tr.to_team_id AS team_id,
        tr.date AS join_date,
        COALESCE(
          (SELECT MIN(tr2.date) FROM transfers tr2
           WHERE tr2.player_steam_id = tr.player_steam_id
             AND tr2.from_team_id = tr.to_team_id
             AND tr2.type = 'leave'
             AND tr2.date > tr.date),
          NOW()
        ) AS leave_date
      FROM transfers tr
      WHERE tr.type = 'join'
        AND tr.to_team_id = ANY(${winningTeamIds}::int[])
    `;

    const stintsByTeam = new Map<number, typeof stints>();
    for (const s of stints) {
      const arr = stintsByTeam.get(s.team_id) ?? [];
      arr.push(s);
      stintsByTeam.set(s.team_id, arr);
    }

    const counts = new Map<string, number>();
    for (const t of winning) {
      const teamStints = stintsByTeam.get(t.winningTeamId as number);
      if (!teamStints) continue;
      const tStart = t.startDate ? new Date(t.startDate).getTime() : 0;
      const tEnd = t.endDate ? new Date(t.endDate).getTime() : Date.now();
      const winners = new Set<string>();
      for (const s of teamStints) {
        const sJoin = new Date(s.join_date).getTime();
        const sLeave = new Date(s.leave_date).getTime();
        if (tStart <= sLeave && tEnd >= sJoin) {
          winners.add(s.steam_id);
        }
      }
      for (const w of winners) {
        counts.set(w, (counts.get(w) ?? 0) + 1);
      }
    }

    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    if (top.length === 0) return [];

    const topSteamIds = top.map(([id]) => id);
    const players = await prisma.player.findMany({
      where: { steamId: { in: topSteamIds } },
      select: { steamId: true, username: true },
    });
    const nameBySteam = new Map(players.map((p) => [p.steamId, p.username]));

    return top.map(([steamID, count]) => ({
      steamID,
      name: nameBySteam.get(steamID) ?? steamID,
      value: String(count),
    }));
  } catch (err) {
    console.error("[leaderboards] titles failed:", err);
    return [];
  }
}

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ stat?: string }>;
}) {
  const params = await searchParams;
  const selected =
    BOARDS.find((b) => b.key === params.stat) ?? BOARDS[0]; // default: appearances

  const rows: LeaderboardRow[] =
    selected.key === "titles"
      ? await fetchTitlesBoard()
      : selected.key === "potm"
        ? await fetchPotmBoard("total")
        : selected.key === "potmPerApp"
          ? await fetchPotmBoard("perApp")
          : (await fetchBoard(selected)).map((p) => ({
              steamID: p.steamID,
              name: p.nickname || p.name || p.steamID,
              value: selected.format(p),
            }));

  const steamIds = Array.from(
    new Set(
      rows
        .map((p) => (typeof p.steamID === "string" ? p.steamID.trim() : ""))
        .filter((id) => id.length > 0)
    )
  );
  const avatarRows = steamIds.length
    ? await prisma.player.findMany({
        where: { steamId: { in: steamIds } },
        select: { steamId: true, avatar: true },
      })
    : [];
  const avatarBySteam = new Map<string, string | null>(
    avatarRows.map((r) => [r.steamId, r.avatar])
  );

  function statUrl(key: string) {
    const sp = new URLSearchParams();
    if (key !== BOARDS[0].key) sp.set("stat", key);
    const qs = sp.toString();
    return qs ? `/players/leaderboards?${qs}` : "/players/leaderboards";
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-800 text-4xl sm:text-5xl tracking-tight text-chalk-100">
          LEADERBOARDS
        </h1>
        <p className="text-chalk-400 text-sm font-body mt-1">
          Top 10 players · pick a stat
        </p>
      </div>

      {/* Slow API warning */}
      <div className="lb-warning mb-4 rounded-md border px-4 py-3 flex items-start gap-2.5">
        <span className="lb-warning-icon text-base leading-none mt-[2px]">⚠</span>
        <p className="lb-warning-text text-sm font-body leading-snug">
          The upstream IOSoccer API is slow — the first load of each stat can
          take up to <span className="lb-warning-strong font-mono">~60 seconds</span>.
          Subsequent loads of the same stat are cached and instant.
        </p>
      </div>

      {/* Top loading bar — fires on pill click, resolves when new route renders */}
      <LeaderboardsLoadingBar />

      {/* Quick pill nav */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {BOARDS.map((b) => (
          <PendingLink
            key={b.key}
            href={statUrl(b.key)}
            showSpinner
            className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
              selected.key === b.key
                ? "bg-[#F4119E]/15 text-[#F4119E] border border-[#F4119E]/40"
                : "border border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/30 hover:text-chalk-200"
            }`}
          >
            {b.title.toUpperCase()}
          </PendingLink>
        ))}
      </div>

      {/* Board */}
      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-chalk-100/8">
          <div className="font-mono text-xs text-[#F4119E] uppercase tracking-[0.15em]">
            {selected.title}
          </div>
          <div className="font-body text-xs text-chalk-400 mt-0.5">
            {selected.subtitle}
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-chalk-400 text-xs font-body">
            No data — the upstream API didn&apos;t return results for this stat.
          </div>
        ) : (
          <ul>
            {rows.map((p, i) => {
              const name = p.name;
              const avatar = avatarBySteam.get(p.steamID);
              const value = p.value;
              return (
                <li
                  key={`${selected.key}-${p.steamID}-${i}`}
                  className={`stat-row flex items-center gap-2 pl-2 pr-4 py-2 ${
                    i % 2 === 0 ? "trow-odd" : "trow-even"
                  }`}
                >
                  <span className="w-6 text-center font-mono text-xs text-chalk-500 shrink-0 tabular-nums">
                    {i + 1}
                  </span>
                  <Link
                    href={`/players/${encodeURIComponent(p.steamID)}`}
                    prefetch={false}
                    className="flex items-center gap-2.5 min-w-0 flex-1 group"
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name}
                        className="w-8 h-8 rounded object-cover border border-chalk-100/10 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-pitch-700 flex items-center justify-center text-[11px] font-display font-700 text-chalk-300 shrink-0">
                        {name[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <span className="font-body font-medium text-chalk-100 group-hover:text-[#F4119E] transition-colors truncate text-sm">
                      {name}
                    </span>
                  </Link>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="font-mono font-700 text-chalk-100 text-sm tabular-nums">
                      {value}
                    </span>
                    {selected.unit && (
                      <span className="font-mono text-[10px] text-chalk-400 uppercase">
                        {selected.unit}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
