import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPastTournaments,
  getCurrentTournaments,
  getTournamentStandings,
  getMatches,
  badgeSmallUrl,
  type ApiMatchListItem,
} from "@/lib/iosoccer-api";

export const revalidate = 300;

const FORMAT_LABELS: Record<number, string> = {
  1: "League", 2: "Knockout", 3: "Group + Knockout", 4: "Custom",
  5: "Swiss", 6: "Round Robin", 7: "Double Elimination", 8: "League",
};
const TEAM_TYPES: Record<number, string> = { 1: "Club", 2: "National", 3: "Mix", 4: "Draft" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(iso: string | null) {
  if (!iso) return "?";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
}

function serverFlag(name: string | null): string {
  if (!name) return "";
  const bracketMatch = name.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    const parts = bracketMatch[1].split("/");
    const code = parts[parts.length - 1].trim().toUpperCase();
    if (code === "AMS") return "🇳🇱";
    if (code === "UK") return "🇬🇧";
    if (code === "EU") return "🇪🇺";
    if (code === "NA") return "🇺🇸";
    if (/^[A-Z]{2}$/.test(code)) {
      return Array.from(code)
        .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
        .join("");
    }
  }
  return "";
}

type ComputedStanding = {
  teamId: number;
  teamName: string;
  logoUrl: string | null;
  p: number; w: number; d: number; l: number;
  gf: number; ga: number; gd: number; pts: number;
};

function computeStandings(matches: ApiMatchListItem[]): ComputedStanding[] {
  const map = new Map<number, ComputedStanding>();
  for (const m of matches) {
    const hg = m.matchStatistics?.matchGoalsHome;
    const ag = m.matchStatistics?.matchGoalsAway;
    if (hg == null || ag == null) continue;
    for (const [tid, team, gf, ga] of [
      [m.teamHomeId, m.teamHome, hg, ag],
      [m.teamAwayId, m.teamAway, ag, hg],
    ] as [number, typeof m.teamHome, number, number][]) {
      if (!map.has(tid)) {
        map.set(tid, {
          teamId: tid,
          teamName: team.name,
          logoUrl: badgeSmallUrl(team.badgeImage),
          p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0,
        });
      }
      const s = map.get(tid)!;
      s.p++; s.gf += gf; s.ga += ga;
    }
    const home = map.get(m.teamHomeId)!;
    const away = map.get(m.teamAwayId)!;
    if (hg > ag) { home.w++; away.l++; }
    else if (hg < ag) { away.w++; home.l++; }
    else { home.d++; away.d++; }
  }
  for (const s of map.values()) {
    s.gd = s.gf - s.ga;
    s.pts = s.w * 3 + s.d;
  }
  return Array.from(map.values()).sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
  );
}

export default async function TournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tournamentId = parseInt(id, 10);
  if (isNaN(tournamentId)) return notFound();

  const tab = sp.tab === "standings" ? "standings" : "matches";
  const currentPage = Math.max(1, parseInt(sp.page || "1", 10));

  const [past, current] = await Promise.all([getPastTournaments(), getCurrentTournaments()]);
  const all = [...current, ...past];
  const tournament = all.find((t) => t.id === tournamentId);
  if (!tournament) return notFound();

  // Fetch matches page + API standings in parallel
  const [standingsRaw, matchData] = await Promise.all([
    getTournamentStandings(tournamentId).catch(() => []),
    getMatches({ tournamentId, pageSize: 10, page: currentPage }),
  ]);

  const apiStandings = standingsRaw as Awaited<ReturnType<typeof getTournamentStandings>>;
  const matches = matchData.items;
  const totalPages = matchData.totalPages;
  const totalMatches = matchData.totalItems;

  // If on standings tab and API returned nothing, compute from all matches
  let computedStandings: ComputedStanding[] | null = null;
  if (tab === "standings" && apiStandings.length === 0) {
    const allMatches = await getMatches({ tournamentId, pageSize: 500 }).catch(() => null);
    if (allMatches) computedStandings = computeStandings(allMatches.items);
  }

  const isActive = current.some((t) => t.id === tournamentId);
  const org = tournament.tournamentSeries?.organisation?.acronym ?? null;
  const winnerLogo = badgeSmallUrl(tournament.winningTeam?.badgeImage ?? null);

  const pageNumbers: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (currentPage > 3) pageNumbers.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pageNumbers.push(i);
    if (currentPage < totalPages - 2) pageNumbers.push("...");
    pageNumbers.push(totalPages);
  }

  function pageUrl(p: number) {
    return `/tournaments/${tournamentId}?tab=matches&page=${p}`;
  }

  const tabUrl = (t: string) => `/tournaments/${tournamentId}?tab=${t}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-chalk-400 mb-6">
        <Link href="/tournaments" className="hover:text-grass-500 transition-colors">Tournaments</Link>
        <span className="mx-2">/</span>
        <span className="text-chalk-200">{tournament.name}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/40 p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="font-display font-900 text-3xl tracking-tight text-chalk-100 uppercase">
                {tournament.name}
              </h1>
              {org && (
                <span className="text-[11px] font-mono bg-[#F4119E]/15 text-[#F4119E] px-2 py-0.5 rounded">
                  {org}
                </span>
              )}
              {isActive && (
                <span className="text-[10px] font-mono bg-grass-500/20 text-grass-400 px-2 py-0.5 rounded">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono text-chalk-400">
              {tournament.format > 0 && <span>FORMAT <span className="text-chalk-200">{FORMAT_LABELS[tournament.format] || "-"}</span></span>}
              {tournament.teamType > 0 && <span>TYPE <span className="text-chalk-200">{TEAM_TYPES[tournament.teamType] || "-"}</span></span>}
              {tournament.startDate && <span>START <span className="text-chalk-200">{fmtDate(tournament.startDate)}</span></span>}
              {tournament.endDate && <span>END <span className="text-chalk-200">{fmtDate(tournament.endDate)}</span></span>}
            </div>
          </div>
          {tournament.winningTeamId && tournament.winningTeam && (
            <Link href={`/teams/${tournament.winningTeamId}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              {winnerLogo && <img src={winnerLogo} alt="" className="w-6 h-6 object-contain" />}
              <div>
                <div className="text-[10px] font-mono text-chalk-400 uppercase">Winner</div>
                <div className="font-body font-medium text-[#F4119E]">{tournament.winningTeam.name}</div>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 font-mono text-xs">
        <Link
          href={tabUrl("matches")}
          className={`px-4 py-2 rounded border transition-colors ${tab === "matches" ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}
        >
          MATCHES <span className={tab === "matches" ? "text-[#F4119E]/70" : "text-chalk-500"}>({totalMatches})</span>
        </Link>
        <Link
          href={tabUrl("standings")}
          className={`px-4 py-2 rounded border transition-colors ${tab === "standings" ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}
        >
          STANDINGS
        </Link>
      </div>

      {/* MATCHES TAB */}
      {tab === "matches" && (
        <>
          {matches.length === 0 ? (
            <div className="text-center py-8 text-chalk-400 font-body text-sm">No matches found.</div>
          ) : (
            <>
              <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-hidden">
                <div className="hidden sm:grid border-b border-chalk-100/8 px-4 py-2 text-[10px] font-mono text-chalk-500 uppercase"
                  style={{ gridTemplateColumns: "9rem 1fr 2.5rem 1fr 7rem 2rem" }}>
                  <span>Date</span>
                  <span className="text-right">Home</span>
                  <span className="text-center">Score</span>
                  <span>Away</span>
                  <span className="text-center hidden md:block">POTM</span>
                  <span />
                </div>
                {matches.map((m, i) => {
                  const homeLogo = badgeSmallUrl(m.teamHome.badgeImage);
                  const awayLogo = badgeSmallUrl(m.teamAway.badgeImage);
                  const hg = m.matchStatistics?.matchGoalsHome ?? null;
                  const ag = m.matchStatistics?.matchGoalsAway ?? null;
                  const flag = serverFlag(m.server?.name ?? null);
                  return (
                    <Link
                      key={m.id}
                      href={`/matches/${m.id}`}
                      className={`flex sm:grid items-center gap-2 px-4 py-2.5 hover:bg-[#F4119E]/10 transition-colors ${i % 2 === 0 ? "bg-black/[0.03]" : ""} ${i > 0 ? "border-t border-chalk-100/5" : ""}`}
                      style={{ gridTemplateColumns: "9rem 1fr 2.5rem 1fr 7rem 2rem" }}
                    >
                      <span className="text-[10px] font-mono text-chalk-500 shrink-0 hidden sm:block">
                        {fmtDateTime(m.kickOff)}
                      </span>
                      <span className="flex-1 sm:flex-none text-right font-body text-sm text-chalk-100 truncate flex items-center justify-end gap-1.5">
                        {m.teamHome.name}
                        {homeLogo ? <img src={homeLogo} alt="" className="h-5 w-5 shrink-0 object-contain" /> : <div className="h-5 w-5 shrink-0" />}
                      </span>
                      <span className="font-mono text-sm font-700 text-chalk-100 text-center shrink-0">
                        {hg !== null ? `${hg}-${ag}` : "vs"}
                      </span>
                      <span className="flex-1 sm:flex-none font-body text-sm text-chalk-100 truncate flex items-center gap-1.5">
                        {awayLogo ? <img src={awayLogo} alt="" className="h-5 w-5 shrink-0 object-contain" /> : <div className="h-5 w-5 shrink-0" />}
                        {m.teamAway.name}
                      </span>
                      <span className="text-[10px] font-mono text-[#56a3ff] shrink-0 text-center hidden md:block truncate">
                        {m.playerOfTheMatch ? m.playerOfTheMatch.name : ""}
                      </span>
                      <span className="text-base shrink-0 text-right" title={m.server?.name ?? undefined}>
                        {flag}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-1.5 mt-4">
                  {currentPage > 1 && (
                    <Link href={pageUrl(currentPage - 1)} className="px-3 py-1.5 rounded border border-chalk-100/10 text-chalk-400 font-mono text-xs hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors">&lt;</Link>
                  )}
                  {pageNumbers.map((p, idx) =>
                    p === "..." ? (
                      <span key={`e-${idx}`} className="px-2 text-chalk-500 font-mono text-xs">&hellip;</span>
                    ) : (
                      <Link key={p} href={pageUrl(p)} className={`px-3 py-1.5 rounded border font-mono text-xs transition-colors ${p === currentPage ? "border-[#F4119E] bg-[#F4119E] text-white" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}>{p}</Link>
                    )
                  )}
                  {currentPage < totalPages && (
                    <Link href={pageUrl(currentPage + 1)} className="px-3 py-1.5 rounded border border-chalk-100/10 text-chalk-400 font-mono text-xs hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors">&gt;</Link>
                  )}
                  {currentPage < totalPages && (
                    <Link href={pageUrl(totalPages)} className="px-3 py-1.5 rounded border border-chalk-100/10 text-chalk-400 font-mono text-xs hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors">&raquo;</Link>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* STANDINGS TAB */}
      {tab === "standings" && (() => {
        // Prefer API standings, fall back to computed
        if (apiStandings.length > 0) {
          const FORM_LABELS: Record<number, { label: string; cls: string }> = {
            0: { label: "W", cls: "bg-grass-500 text-white" },
            1: { label: "D", cls: "bg-chalk-500 text-white" },
            2: { label: "L", cls: "bg-red-500 text-white" },
          };
          return (
            <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-chalk-100/8">
                    <th className="text-left px-3 py-2.5 font-mono text-[10px] text-chalk-400 w-7">#</th>
                    <th className="text-left px-2 py-2.5 font-mono text-[10px] text-chalk-400">TEAM</th>
                    <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">P</th>
                    <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">W</th>
                    <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">D</th>
                    <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">L</th>
                    <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">GD</th>
                    <th className="text-left px-2 py-2.5 font-mono text-[10px] text-chalk-400">FORM</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {apiStandings.map((s, i) => {
                    const logoUrl = s.badgeImageUrl ? `/api/img?url=${encodeURIComponent(s.badgeImageUrl)}` : null;
                    const isWinner = tournament.winningTeamId === s.teamId;
                    const form = s.form ?? [];
                    return (
                      <tr key={s.teamId} className={`border-t border-chalk-100/5 hover:bg-[#F4119E]/10 transition-colors ${i % 2 === 0 ? "bg-black/[0.03]" : ""}`}>
                        <td className="px-3 py-2 font-mono text-chalk-400 text-center">{s.position ?? i + 1}</td>
                        <td className="px-2 py-2">
                          <Link href={`/teams/${s.teamId}`} className={`flex items-center gap-1.5 hover:text-[#F4119E] transition-colors ${isWinner ? "text-[#F4119E]" : "text-chalk-100"}`}>
                            {logoUrl && <img src={logoUrl} alt="" className="h-5 w-5 object-contain shrink-0" />}
                            <span className="font-body truncate">{s.teamName}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-chalk-300">{s.matchesPlayed ?? "-"}</td>
                        <td className="px-2 py-2 text-center font-mono text-grass-400">{s.wins ?? "-"}</td>
                        <td className="px-2 py-2 text-center font-mono text-chalk-400">{s.draws ?? "-"}</td>
                        <td className="px-2 py-2 text-center font-mono text-red-400">{s.losses ?? "-"}</td>
                        <td className={`px-2 py-2 text-center font-mono ${(s.goalDifference ?? 0) > 0 ? "text-grass-400" : (s.goalDifference ?? 0) < 0 ? "text-red-400" : "text-chalk-400"}`}>
                          {(s.goalDifference ?? 0) > 0 ? `+${s.goalDifference}` : (s.goalDifference ?? 0)}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, fi) => {
                              const val = form[fi];
                              const fb = val !== undefined && val in FORM_LABELS ? FORM_LABELS[val] : { label: "?", cls: "bg-chalk-100/10 text-chalk-500" };
                              return <span key={fi} className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-mono font-700 ${fb.cls}`}>{fb.label}</span>;
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link href={`/teams/${s.teamId}`} className="inline-block text-[10px] font-mono text-chalk-400 border border-chalk-100/10 px-2 py-1 rounded hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors whitespace-nowrap">
                            VIEW PROFILE
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }

        // Computed from matches
        const rows = computedStandings ?? [];
        if (rows.length === 0) {
          return <div className="text-center py-12 text-chalk-400 font-body text-sm">No standings data available.</div>;
        }
        return (
          <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-chalk-100/8">
                  <th className="text-left px-3 py-2.5 font-mono text-[10px] text-chalk-400 w-7">#</th>
                  <th className="text-left px-2 py-2.5 font-mono text-[10px] text-chalk-400">TEAM</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">P</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">W</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">D</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">L</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">GF</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">GA</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">GD</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">PTS</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const isWinner = tournament.winningTeamId === s.teamId;
                  return (
                    <tr key={s.teamId} className={`border-t border-chalk-100/5 hover:bg-[#F4119E]/10 transition-colors ${i % 2 === 0 ? "bg-black/[0.03]" : ""}`}>
                      <td className="px-3 py-2 font-mono text-chalk-400 text-center">{i + 1}</td>
                      <td className="px-2 py-2">
                        <Link href={`/teams/${s.teamId}`} className={`flex items-center gap-1.5 hover:text-[#F4119E] transition-colors ${isWinner ? "text-[#F4119E]" : "text-chalk-100"}`}>
                          {s.logoUrl && <img src={s.logoUrl} alt="" className="h-5 w-5 object-contain shrink-0" />}
                          <span className="font-body truncate">{s.teamName}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-chalk-300">{s.p}</td>
                      <td className="px-2 py-2 text-center font-mono text-grass-400">{s.w}</td>
                      <td className="px-2 py-2 text-center font-mono text-chalk-400">{s.d}</td>
                      <td className="px-2 py-2 text-center font-mono text-red-400">{s.l}</td>
                      <td className="px-2 py-2 text-center font-mono text-chalk-300">{s.gf}</td>
                      <td className="px-2 py-2 text-center font-mono text-chalk-300">{s.ga}</td>
                      <td className={`px-2 py-2 text-center font-mono ${s.gd > 0 ? "text-grass-400" : s.gd < 0 ? "text-red-400" : "text-chalk-400"}`}>
                        {s.gd > 0 ? `+${s.gd}` : s.gd}
                      </td>
                      <td className="px-2 py-2 text-center font-mono font-700 text-chalk-100">{s.pts}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/teams/${s.teamId}`} className="inline-block text-[10px] font-mono text-chalk-400 border border-chalk-100/10 px-2 py-1 rounded hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors whitespace-nowrap">
                          VIEW PROFILE
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}
