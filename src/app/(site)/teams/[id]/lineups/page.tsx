import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
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

const RANGE_OPTIONS: { key: string; label: string; days: number | null; minAppsWr: number }[] = [
  { key: "7d", label: "Last 7 Days", days: 7, minAppsWr: 2 },
  { key: "30d", label: "Last 30 Days", days: 30, minAppsWr: 5 },
  { key: "6mo", label: "Last 6 Months", days: 180, minAppsWr: 40 },
  { key: "all", label: "All Time", days: null, minAppsWr: 100 },
];

const MODE_OPTIONS: { key: string; label: string; short: string }[] = [
  { key: "all", label: "All Apps", short: "all apps" },
  { key: "winrate", label: "WR", short: "highest WR" },
  { key: "starts", label: "Starts Only", short: "starts only" },
];

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
  searchParams: Promise<{ range?: string; mode?: string }>;
}) {
  const { id } = await params;
  const { range: rangeParam, mode: modeParam } = await searchParams;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  const activeRange = RANGE_OPTIONS.find((o) => o.key === rangeParam) ?? RANGE_OPTIONS[1];
  const activeMode = MODE_OPTIONS.find((o) => o.key === modeParam) ?? MODE_OPTIONS[0];

  const modeFilter =
    activeMode.key === "starts"
      ? Prisma.sql`AND mps.is_substitute = false`
      : Prisma.empty;

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
          AND mps.position IS NOT NULL
          ${modeFilter}
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
          AND mps.position IS NOT NULL
          ${modeFilter}
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

  // Effective min apps for WR mode. The base threshold (e.g. 100 for all-time)
  // is a cap: if no one in the team has that many apps in any slot, scale down
  // to 30% of the most-active player's apps in the team, floor 2.
  let maxAppsAnyPlayer = 0;
  for (const slotMap of bySlot.values()) {
    for (const p of slotMap.values()) {
      if (p.apps > maxAppsAnyPlayer) maxAppsAnyPlayer = p.apps;
    }
  }
  const effectiveMinAppsWr = Math.min(
    activeRange.minAppsWr,
    Math.max(2, Math.ceil(maxAppsAnyPlayer * 0.3)),
  );

  const canonicalSlots: CanonicalPosition[] = ["LW", "CF", "RW", "CM", "LB", "CB", "RB", "GK"];
  // Wilson lower bound at 95% CI: rewards high WR but penalises small samples,
  // so a player with 350 apps @ 78% beats 115 apps @ 80%.
  const wilsonLb = (p: PlayerAgg): number => {
    if (p.apps === 0) return 0;
    const z = 1.96;
    const phat = p.wins / p.apps;
    const z2 = z * z;
    const denom = 1 + z2 / p.apps;
    const center = phat + z2 / (2 * p.apps);
    const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * p.apps)) / p.apps);
    return (center - margin) / denom;
  };
  const results: Record<CanonicalPosition, SlotResult> = Object.fromEntries(
    canonicalSlots.map((slot) => {
      const slotMap = bySlot.get(slot);
      if (!slotMap || slotMap.size === 0) {
        return [slot, { slot, top: null, runnersUp: [], totalAppsInSlot: 0 }];
      }
      const all = Array.from(slotMap.values());
      const totalApps = all.reduce((acc, p) => acc + p.apps, 0);
      let sorted: PlayerAgg[];
      if (activeMode.key === "winrate") {
        const qualified = all.filter((p) => p.apps >= effectiveMinAppsWr);
        sorted = qualified.sort((a, b) => wilsonLb(b) - wilsonLb(a) || b.apps - a.apps);
      } else {
        sorted = all.slice().sort((a, b) => b.apps - a.apps);
      }
      if (sorted.length === 0) {
        return [slot, { slot, top: null, runnersUp: [], totalAppsInSlot: totalApps }];
      }
      const [top, ...rest] = sorted;
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

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase">
            Most Played Lineup
          </h3>
          <div className="flex gap-1.5 flex-wrap">
            {MODE_OPTIONS.map((opt) => {
              const isActive = opt.key === activeMode.key;
              const qs = new URLSearchParams({ range: activeRange.key, mode: opt.key }).toString();
              return (
                <Link
                  key={opt.key}
                  href={`/teams/${teamId}/lineups?${qs}`}
                  className={`px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-wider border transition-colors ${
                    isActive
                      ? "border-cyan-400 text-cyan-300 bg-cyan-400/10"
                      : "border-chalk-100/10 text-chalk-400 hover:text-cyan-300 hover:border-cyan-400/50"
                  }`}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {RANGE_OPTIONS.map((opt) => {
            const isActive = opt.key === activeRange.key;
            const qs = new URLSearchParams({ range: opt.key, mode: activeMode.key }).toString();
            return (
              <Link
                key={opt.key}
                href={`/teams/${teamId}/lineups?${qs}`}
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
          No appearances found for this team in the selected range.
        </div>
      ) : (
        <>
          <div
            className="relative overflow-hidden rounded-xl border border-chalk-100/10 bg-[#3d7a38] p-3 sm:p-5 md:p-6 mb-4"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 40px, transparent 40px, transparent 80px)",
            }}
          >
            {/* Field markings */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 400" preserveAspectRatio="none">
              <rect x="1" y="1" width="298" height="398" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
              <line x1="1" y1="200" x2="299" y2="200" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
              <circle cx="150" cy="200" r="40" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
              <circle cx="150" cy="200" r="3" fill="rgba(255,255,255,0.7)" />
              <path d="M 61 1 L 61 68 L 239 68 L 239 1" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M 107 1 L 107 26 L 193 26 L 193 1" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1" />
              <circle cx="150" cy="50" r="2.5" fill="rgba(255,255,255,0.55)" />
              <path d="M 116 68 A 38 38 0 0 0 184 68" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1" />
              <path d="M 61 399 L 61 332 L 239 332 L 239 399" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M 107 399 L 107 374 L 193 374 L 193 399" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1" />
              <circle cx="150" cy="350" r="2.5" fill="rgba(255,255,255,0.55)" />
              <path d="M 116 332 A 38 38 0 0 1 184 332" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1" />
              <path d="M 1 12 A 11 11 0 0 0 12 1" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              <path d="M 288 1 A 11 11 0 0 0 299 12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              <path d="M 1 388 A 11 11 0 0 1 12 399" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              <path d="M 299 388 A 11 11 0 0 0 288 399" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            </svg>

            <div className="relative flex flex-col gap-3 sm:gap-4 md:gap-5">
              <PitchRow slots={[results.LW, results.CF, results.RW]} />
              <PitchRow slots={[results.CM]} />
              <PitchRow slots={[results.LB, results.CB, results.RB]} />
              <PitchRow slots={[results.GK]} />
            </div>
          </div>

          <div className="text-[11px] font-mono text-chalk-400 text-center">
            Based on <span className="text-chalk-200 font-700">{totalMatches}</span> {totalMatches === 1 ? "match" : "matches"} · {activeMode.short} · {activeRange.label.toLowerCase()}
            {activeMode.key === "winrate" && (
              <>
                {" · "}
                <span className="text-chalk-300">min {effectiveMinAppsWr} apps</span>
                {effectiveMinAppsWr !== activeRange.minAppsWr && (
                  <span className="text-chalk-500"> (adjusted, top player has {maxAppsAnyPlayer} apps)</span>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PitchRow({ slots }: { slots: SlotResult[] }) {
  return (
    <div className="flex justify-center gap-2 sm:gap-4 md:gap-6">
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
    <div className="w-[92px] sm:w-[130px] md:w-[165px] rounded-lg border border-chalk-100/15 bg-pitch-950/80 backdrop-blur-sm p-2 sm:p-3 flex flex-col items-center text-center shadow-lg">
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
          <div className="flex items-center justify-center gap-1.5 max-w-full">
            <span className="text-[11px] sm:text-xs font-mono text-[#F4119E] tracking-wider shrink-0">{slot}</span>
            <Link
              href={`/players/${top.steam_id}`}
              className="font-body text-[11px] sm:text-sm text-chalk-100 hover:text-[#F4119E] transition-colors font-700 truncate"
              title={top.username}
            >
              {top.username}
            </Link>
          </div>
          <div className="text-[11px] sm:text-xs font-mono text-chalk-400 mt-0.5 sm:mt-1">
            <span className="text-chalk-200 font-700">{top.apps}</span> {top.apps === 1 ? "app" : "apps"}
            {pct < 100 && pct > 0 && <span className="text-chalk-500"> · {pct}%</span>}
          </div>
          <div className={`text-[11px] sm:text-xs font-mono font-700 mt-0.5 ${wrToneTop}`}>
            WR {topWr}%
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
                    className="group/runner flex items-center justify-between gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-mono text-chalk-500 transition-colors"
                    title={`${r.username} — ${r.apps} apps · WR ${wr}%`}
                  >
                    <span className="truncate flex-1 text-left group-hover/runner:text-[#F4119E] transition-colors">{r.username}</span>
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
          <div className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-mono">
            <span className="text-[#F4119E] tracking-wider">{slot}</span>
            <span className="text-chalk-500">No data</span>
          </div>
        </>
      )}
    </div>
  );
}
