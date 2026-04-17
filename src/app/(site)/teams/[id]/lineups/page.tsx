import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

type CanonicalPosition = "LW" | "CF" | "RW" | "CM" | "LB" | "CB" | "RB" | "GK";

function normalizeToCanonicalPosition(position: string | null): CanonicalPosition | null {
  const pos = (position || "").toUpperCase();
  if (pos === "LW" || pos === "LF") return "LW";
  if (pos === "CF" || pos === "ST" || pos === "RF") return "CF";
  if (pos === "RW") return "RW";
  if (["CM", "LCM", "RCM", "CDM", "CAM", "LM", "RM", "DM", "AM"].includes(pos)) return "CM";
  if (pos === "LB" || pos === "LWB") return "LB";
  if (pos === "CB" || pos === "LCB" || pos === "RCB") return "CB";
  if (pos === "RB" || pos === "RWB") return "RB";
  if (pos === "GK") return "GK";
  return null;
}

type LineupRow = {
  player_steam_id: string;
  position: string | null;
  username: string;
  avatar: string | null;
  result: "W" | "D" | "L";
};

const RANGE_OPTIONS: { key: string; label: string; days: number | null }[] = [
  { key: "7d", label: "Last 7 Days", days: 7 },
  { key: "30d", label: "Last 30 Days", days: 30 },
  { key: "90d", label: "Last 90 Days", days: 90 },
  { key: "all", label: "All Time", days: null },
];

const SLOT_LABELS: Record<CanonicalPosition, string> = {
  LW: "Left Wing",
  CF: "Striker",
  RW: "Right Wing",
  CM: "Midfielder",
  LB: "Left Back",
  CB: "Centre Back",
  RB: "Right Back",
  GK: "Goalkeeper",
};

type SlotResult = {
  slot: CanonicalPosition;
  top: { steam_id: string; username: string; avatar: string | null; apps: number; wins: number } | null;
  runnersUp: { steam_id: string; username: string; apps: number; wins: number }[];
  totalAppsInSlot: number;
};

export default async function TeamLineupsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range: rangeParam } = await searchParams;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  const activeRange = RANGE_OPTIONS.find((o) => o.key === rangeParam) ?? RANGE_OPTIONS[1];

  const rows = activeRange.days != null
    ? await prisma.$queryRaw<LineupRow[]>`
        SELECT
          mps.player_steam_id,
          mps.position,
          p.username,
          p.avatar,
          CASE
            WHEN (mps.team_side = 'home' AND m.home_score > m.away_score)
              OR (mps.team_side = 'away' AND m.away_score > m.home_score) THEN 'W'
            WHEN m.home_score = m.away_score THEN 'D'
            ELSE 'L'
          END AS result
        FROM match_player_stats mps
        JOIN matches m ON m.id = mps.match_id
        JOIN players p ON p.steam_id = mps.player_steam_id
        WHERE (
          (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
          (mps.team_side = 'away' AND m.away_team_id = ${teamId})
        )
          AND mps.is_substitute = false
          AND mps.position IS NOT NULL
          AND m.date >= NOW() - INTERVAL '1 day' * ${activeRange.days}
      `
    : await prisma.$queryRaw<LineupRow[]>`
        SELECT
          mps.player_steam_id,
          mps.position,
          p.username,
          p.avatar,
          CASE
            WHEN (mps.team_side = 'home' AND m.home_score > m.away_score)
              OR (mps.team_side = 'away' AND m.away_score > m.home_score) THEN 'W'
            WHEN m.home_score = m.away_score THEN 'D'
            ELSE 'L'
          END AS result
        FROM match_player_stats mps
        JOIN matches m ON m.id = mps.match_id
        JOIN players p ON p.steam_id = mps.player_steam_id
        WHERE (
          (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
          (mps.team_side = 'away' AND m.away_team_id = ${teamId})
        )
          AND mps.is_substitute = false
          AND mps.position IS NOT NULL
      `;

  type PlayerAgg = { steam_id: string; username: string; avatar: string | null; apps: number; wins: number };
  const bySlot = new Map<CanonicalPosition, Map<string, PlayerAgg>>();

  for (const row of rows) {
    const slot = normalizeToCanonicalPosition(row.position);
    if (!slot) continue;
    if (!bySlot.has(slot)) bySlot.set(slot, new Map());
    const slotMap = bySlot.get(slot)!;
    const isWin = row.result === "W" ? 1 : 0;
    const existing = slotMap.get(row.player_steam_id);
    if (existing) {
      existing.apps += 1;
      existing.wins += isWin;
    } else {
      slotMap.set(row.player_steam_id, {
        steam_id: row.player_steam_id,
        username: row.username,
        avatar: row.avatar,
        apps: 1,
        wins: isWin,
      });
    }
  }

  const canonicalSlots: CanonicalPosition[] = ["LW", "CF", "RW", "CM", "LB", "CB", "RB", "GK"];
  const results: Record<CanonicalPosition, SlotResult> = Object.fromEntries(
    canonicalSlots.map((slot) => {
      const slotMap = bySlot.get(slot);
      if (!slotMap || slotMap.size === 0) {
        return [slot, { slot, top: null, runnersUp: [], totalAppsInSlot: 0 }];
      }
      const sorted = Array.from(slotMap.values()).sort((a, b) => b.apps - a.apps);
      const [top, ...rest] = sorted;
      const totalApps = sorted.reduce((acc, p) => acc + p.apps, 0);
      return [
        slot,
        {
          slot,
          top,
          runnersUp: rest.slice(0, 3).map((p) => ({ steam_id: p.steam_id, username: p.username, apps: p.apps, wins: p.wins })),
          totalAppsInSlot: totalApps,
        },
      ];
    })
  ) as Record<CanonicalPosition, SlotResult>;

  const totalMatchesRows = activeRange.days != null
    ? await prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(DISTINCT m.id) AS total
        FROM matches m
        WHERE (m.home_team_id = ${teamId} OR m.away_team_id = ${teamId})
          AND m.date >= NOW() - INTERVAL '1 day' * ${activeRange.days}
      `
    : await prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(DISTINCT m.id) AS total
        FROM matches m
        WHERE (m.home_team_id = ${teamId} OR m.away_team_id = ${teamId})
      `;
  const totalMatches = Number(totalMatchesRows[0]?.total ?? 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase">
          Most Played Lineup
        </h3>
        <div className="flex gap-1.5 flex-wrap">
          {RANGE_OPTIONS.map((opt) => {
            const isActive = opt.key === activeRange.key;
            return (
              <Link
                key={opt.key}
                href={`/teams/${teamId}/lineups?range=${opt.key}`}
                className={`px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-wider border transition-colors ${
                  isActive
                    ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10"
                    : "border-chalk-100/10 text-chalk-400 hover:text-[#F4119E] hover:border-[#F4119E]/50"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 text-center py-12 text-chalk-400 font-body">
          No starting appearances found for this team in the selected range.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-chalk-100/8 bg-gradient-to-b from-grass-950/30 via-pitch-900/60 to-pitch-900/60 p-3 sm:p-6 md:p-8 mb-4 relative overflow-hidden">
            {/* Pitch lines decoration */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="lineup-pitch-line" />
              <div className="lineup-pitch-circle" />
              <div className="lineup-goal" />
            </div>

            <div className="relative flex flex-col gap-4 sm:gap-6 md:gap-8">
              <LineupRow slots={[results.LW, results.CF, results.RW]} />
              <LineupRow slots={[results.CM]} />
              <LineupRow slots={[results.LB, results.CB, results.RB]} />
              <LineupRow slots={[results.GK]} />
            </div>
          </div>

          <div className="text-[11px] font-mono text-chalk-400 text-center">
            Based on <span className="text-chalk-200 font-700">{totalMatches}</span> {totalMatches === 1 ? "match" : "matches"} · starters only · {activeRange.label.toLowerCase()}
          </div>
        </>
      )}
    </div>
  );
}

function LineupRow({ slots }: { slots: SlotResult[] }) {
  return (
    <div className="flex justify-center gap-1.5 sm:gap-3 md:gap-6">
      {slots.map((s) => (
        <SlotCard key={s.slot} result={s} />
      ))}
    </div>
  );
}

function SlotCard({ result }: { result: SlotResult }) {
  const { slot, top, runnersUp, totalAppsInSlot } = result;
  const pct = top && totalAppsInSlot > 0 ? Math.round((top.apps / totalAppsInSlot) * 100) : 0;
  const topWr = top && top.apps > 0 ? Math.round((top.wins / top.apps) * 100) : 0;
  const wrToneTop = topWr > 55 ? "wr-elite" : topWr >= 50 ? "text-green-400" : "text-red-400";

  return (
    <div className="w-[96px] sm:w-[140px] md:w-[180px] rounded-lg border border-chalk-100/10 bg-pitch-900/70 backdrop-blur-sm p-2 sm:p-3 flex flex-col items-center text-center">
      <div className="text-[11px] sm:text-xs font-mono text-[#F4119E] tracking-wider mb-1.5 sm:mb-2">
        {slot}
      </div>
      {top ? (
        <>
          {top.avatar ? (
            <img
              src={top.avatar}
              alt={top.username}
              className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-md object-cover border-2 border-chalk-100/20 mb-1.5 sm:mb-2"
            />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-md bg-pitch-800 border-2 border-chalk-100/20 flex items-center justify-center text-xs sm:text-sm font-display font-900 text-chalk-400 mb-1.5 sm:mb-2">
              {top.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <Link
            href={`/players/${top.steam_id}`}
            className="font-body text-[11px] sm:text-sm text-chalk-100 hover:text-[#F4119E] transition-colors font-700 truncate max-w-full"
            title={top.username}
          >
            {top.username}
          </Link>
          <div className="text-[11px] sm:text-xs font-mono text-chalk-400 mt-0.5 sm:mt-1">
            <span className="text-chalk-200 font-700">{top.apps}</span> {top.apps === 1 ? "start" : "starts"}
            {pct < 100 && pct > 0 && <span className="text-chalk-500"> · {pct}%</span>}
          </div>
          <div className={`text-[11px] sm:text-xs font-mono font-700 mt-0.5 ${wrToneTop}`}>
            WR {topWr}%
          </div>
          <div className="hidden sm:block text-[11px] font-mono text-chalk-500 mt-0.5">
            {SLOT_LABELS[slot]}
          </div>
          {runnersUp.length > 0 && (
            <div className="w-full mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-chalk-100/8 flex flex-col gap-0.5">
              {runnersUp.map((r) => {
                const wr = r.apps > 0 ? Math.round((r.wins / r.apps) * 100) : 0;
                const wrTone = wr > 55 ? "wr-elite" : wr >= 50 ? "text-green-400" : "text-red-400";
                return (
                  <Link
                    key={r.steam_id}
                    href={`/players/${r.steam_id}`}
                    className="flex items-center justify-between gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-mono text-chalk-500 hover:text-chalk-200 transition-colors"
                    title={`${r.username} — ${r.apps} starts · WR ${wr}%`}
                  >
                    <span className="truncate flex-1 text-left">{r.username}</span>
                    <span className="text-chalk-300 shrink-0">{r.apps}</span>
                    <span className={`shrink-0 ${wrTone}`}>{wr}%</span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-md border-2 border-dashed border-chalk-100/15 flex items-center justify-center text-chalk-500 text-[11px] sm:text-xs font-mono mb-1.5 sm:mb-2">
            —
          </div>
          <div className="text-[11px] sm:text-xs font-mono text-chalk-500">No data</div>
          <div className="hidden sm:block text-[11px] font-mono text-chalk-500 mt-0.5">
            {SLOT_LABELS[slot]}
          </div>
        </>
      )}
    </div>
  );
}
