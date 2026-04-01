import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const IOSOCCER_API = "https://iosoccer.com:44380/api";
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "*/*",
  Origin: "https://www.iosoccer.com",
  Referer: "https://www.iosoccer.com/",
};
const PAGE_SIZE = 200;
const BATCH_CONCURRENCY = 5; // pages fetched in parallel
const UPSERT_CHUNK = 100;    // rows per DB transaction

type TotalsItem = {
  steamID: string;
  appearances: number;
  substituteAppearances: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  secondAssists: number;
  shots: number;
  shotsOnGoal: number;
  keyPasses: number;
  chancesCreated: number;
  offsides: number;
  ownGoals: number;
  passes: number;
  passesCompleted: number;
  keeperSaves: number;
  keeperSavesCaughtAverage: number;
  goalsConceded: number;
  interceptions: number;
  slidingTacklesAverage: number;
  slidingTacklesCompletedAverage: number;
  fouls: number;
  foulsSuffered: number;
  yellowCards: number;
  redCards: number;
  distanceCoveredAverage: number;
  possessionAverage: number;
  possessionPercentageAverage: number;
  shotAccuracyPercentage: number;
  passCompletionPercentageAverage: number;
};

async function fetchPage(page: number): Promise<{ items: TotalsItem[]; totalPages: number }> {
  const res = await fetch(`${IOSOCCER_API}/player-statistics/match-totals`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      page,
      pageSize: PAGE_SIZE,
      filters: { timePeriod: 0, includeSubstituteAppearances: true },
      sortOrder: "ASC",
      sortBy: "Player.Name",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`IOSoccer API error: ${res.status}`);
  const data = await res.json();
  return {
    items: data.items ?? [],
    totalPages: data.totalPages ?? 1,
  };
}

function ri(v: number | null | undefined): number {
  return Math.round(v ?? 0);
}
function rf(v: number | null | undefined): number {
  return v ?? 0;
}

function buildUpsert(item: TotalsItem): Prisma.PrismaPromise<number> {
  const apps = item.appearances ?? 0;
  return prisma.$executeRaw`
    INSERT INTO mv_player_leaderboard (
      player_steam_id, apps, as_sub, wins, draws, losses,
      total_goals, total_assists, total_second_assists,
      total_shots, total_shots_on_target,
      total_key_passes, total_chances_created, total_offsides, total_own_goals,
      total_passes, total_passes_completed,
      total_saves, total_saves_caught, total_goals_conceded,
      total_interceptions, total_tackles, total_tackles_completed,
      total_fouls, total_fouls_suffered,
      total_yellow_cards, total_red_cards,
      total_distance, total_possession,
      avg_possession_pct, shot_accuracy, pass_accuracy
    ) VALUES (
      ${item.steamID},
      ${apps}::bigint, ${ri(item.substituteAppearances)}::bigint,
      ${ri(item.wins)}::bigint, ${ri(item.draws)}::bigint, ${ri(item.losses)}::bigint,
      ${ri(item.goals)}::bigint, ${ri(item.assists)}::bigint, ${ri(item.secondAssists)}::bigint,
      ${ri(item.shots)}::bigint, ${ri(item.shotsOnGoal)}::bigint,
      ${ri(item.keyPasses)}::bigint, ${ri(item.chancesCreated)}::bigint,
      ${ri(item.offsides)}::bigint, ${ri(item.ownGoals)}::bigint,
      ${ri(item.passes)}::bigint, ${ri(item.passesCompleted)}::bigint,
      ${ri(item.keeperSaves)}::bigint,
      ${ri((item.keeperSavesCaughtAverage ?? 0) * apps)}::bigint,
      ${ri(item.goalsConceded)}::bigint,
      ${ri(item.interceptions)}::bigint,
      ${ri((item.slidingTacklesAverage ?? 0) * apps)}::bigint,
      ${ri((item.slidingTacklesCompletedAverage ?? 0) * apps)}::bigint,
      ${ri(item.fouls)}::bigint, ${ri(item.foulsSuffered)}::bigint,
      ${ri(item.yellowCards)}::bigint, ${ri(item.redCards)}::bigint,
      ${ri((item.distanceCoveredAverage ?? 0) * apps)}::bigint,
      ${ri((item.possessionAverage ?? 0) * apps)}::bigint,
      ${rf(item.possessionPercentageAverage)},
      ${rf((item.shotAccuracyPercentage ?? 0) * 100)},
      ${rf((item.passCompletionPercentageAverage ?? 0) * 100)}
    )
    ON CONFLICT (player_steam_id) DO UPDATE SET
      apps                    = EXCLUDED.apps,
      as_sub                  = EXCLUDED.as_sub,
      wins                    = EXCLUDED.wins,
      draws                   = EXCLUDED.draws,
      losses                  = EXCLUDED.losses,
      total_goals             = EXCLUDED.total_goals,
      total_assists           = EXCLUDED.total_assists,
      total_second_assists    = EXCLUDED.total_second_assists,
      total_shots             = EXCLUDED.total_shots,
      total_shots_on_target   = EXCLUDED.total_shots_on_target,
      total_key_passes        = EXCLUDED.total_key_passes,
      total_chances_created   = EXCLUDED.total_chances_created,
      total_offsides          = EXCLUDED.total_offsides,
      total_own_goals         = EXCLUDED.total_own_goals,
      total_passes            = EXCLUDED.total_passes,
      total_passes_completed  = EXCLUDED.total_passes_completed,
      total_saves             = EXCLUDED.total_saves,
      total_saves_caught      = EXCLUDED.total_saves_caught,
      total_goals_conceded    = EXCLUDED.total_goals_conceded,
      total_interceptions     = EXCLUDED.total_interceptions,
      total_tackles           = EXCLUDED.total_tackles,
      total_tackles_completed = EXCLUDED.total_tackles_completed,
      total_fouls             = EXCLUDED.total_fouls,
      total_fouls_suffered    = EXCLUDED.total_fouls_suffered,
      total_yellow_cards      = EXCLUDED.total_yellow_cards,
      total_red_cards         = EXCLUDED.total_red_cards,
      total_distance          = EXCLUDED.total_distance,
      total_possession        = EXCLUDED.total_possession,
      avg_possession_pct      = EXCLUDED.avg_possession_pct,
      shot_accuracy           = EXCLUDED.shot_accuracy,
      pass_accuracy           = EXCLUDED.pass_accuracy
  `;
}

async function upsertChunk(items: TotalsItem[]) {
  await prisma.$transaction(items.map(buildUpsert));
}

export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SYNC_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // --- 1. Discover total pages ---
    const first = await fetchPage(1);
    const { totalPages } = first;
    const allItems: TotalsItem[] = [...first.items];

    // --- 2. Fetch remaining pages in parallel batches ---
    for (let start = 2; start <= totalPages; start += BATCH_CONCURRENCY) {
      const end = Math.min(start + BATCH_CONCURRENCY - 1, totalPages);
      const pages = await Promise.all(
        Array.from({ length: end - start + 1 }, (_, i) => fetchPage(start + i))
      );
      for (const p of pages) allItems.push(...p.items);
    }

    // --- 3. Upsert in chunks ---
    for (let i = 0; i < allItems.length; i += UPSERT_CHUNK) {
      await upsertChunk(allItems.slice(i, i + UPSERT_CHUNK));
    }

    return NextResponse.json({ ok: true, processed: allItems.length });
  } catch (e: any) {
    console.error("[sync-leaderboard]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
