import type { Metadata } from "next";
import { getTransfers, getPlayerById } from "@/lib/iosoccer-api";
import { proxyImg } from "@/lib/img";

export const metadata: Metadata = {
  title: "Player Transfers — IOSHUBv2",
  description: "Latest IOSoccer player transfers and team movements.",
};
import { fetchSteamAvatarCached } from "@/lib/steam-avatar";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const filter = params.filter === "free" ? "free" : "all";
  const nameQuery = params.q?.trim() || "";

  let transfers: Awaited<ReturnType<typeof getTransfers>>["items"] = [];
  let totalTransfers = 0;
  let totalPages = 1;
  let apiUnavailable = false;
  try {
    const data = await getTransfers({
      regionId: 1,
      page,
      pageSize: PAGE_SIZE,
      freeAgentsOnly: filter === "free",
      playerName: nameQuery || null,
    });
    transfers = data.items;
    totalTransfers = data.totalItems;
    totalPages = Math.max(1, data.totalPages);
  } catch {
    apiUnavailable = true;
  }

  // Resolve steamIDs and avatars for player profile links (parallel)
  const uniquePlayerIds = [...new Set(transfers.map((t) => t.playerId))];
  const playerMap = new Map<number, { steamId: string; avatar: string | null }>();
  await Promise.all(
    uniquePlayerIds.map(async (pid) => {
      try {
        const p = await getPlayerById(pid);
        if (p.steamID) {
          const avatar = await fetchSteamAvatarCached(p.steamID);
          playerMap.set(pid, { steamId: p.steamID, avatar });
        }
      } catch { /* skip if player not found */ }
    })
  );

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (p > 1) sp.set("page", String(p));
    if (filter !== "all") sp.set("filter", filter);
    if (nameQuery) sp.set("q", nameQuery);
    const qs = sp.toString();
    return qs ? `/players/transfers?${qs}` : "/players/transfers";
  }

  function filterUrl(f: string) {
    const sp = new URLSearchParams();
    if (f !== "all") sp.set("filter", f);
    if (nameQuery) sp.set("q", nameQuery);
    const qs = sp.toString();
    return qs ? `/players/transfers?${qs}` : "/players/transfers";
  }

  function formatDate(iso: string): string {
    const dt = new Date(iso);
    return dt.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) + ", " + dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function badgeImg(url: string | null): string | null {
    return proxyImg(url);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            PLAYER TRANSFERS
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {totalTransfers.toLocaleString()} transfers
          </p>
        </div>

        {/* Search */}
        <form action="/players/transfers" method="GET" className="flex items-center gap-2">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input
            type="text"
            name="q"
            placeholder="Filter by player name"
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

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { key: "all", label: "ALL" },
          { key: "free", label: "FREE AGENTS ONLY" },
        ].map((f) => {
          const active = filter === f.key;
          const cn = `px-3 py-1.5 rounded text-xs font-mono transition-colors ${
            active
              ? "bg-[#F4119E]/15 text-[#F4119E] border border-[#F4119E]/40 cursor-default"
              : "border border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/30 hover:text-chalk-200"
          }`;
          return active ? (
            <span key={f.key} className={cn} aria-current="page">{f.label}</span>
          ) : (
            <Link key={f.key} href={filterUrl(f.key)} className={cn}>{f.label}</Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-chalk-100/8">
              <th className="text-left px-3 py-3 font-mono text-[11px] text-chalk-400 uppercase tracking-wide min-w-[160px]">
                Player
              </th>
              <th className="text-left px-3 py-3 font-mono text-[11px] text-chalk-400 uppercase tracking-wide min-w-[180px]">
                Leave Date
              </th>
              <th className="text-left px-3 py-3 font-mono text-[11px] text-chalk-400 uppercase tracking-wide min-w-[180px]">
                From
              </th>
              <th className="text-left px-3 py-3 font-mono text-[11px] text-chalk-400 uppercase tracking-wide min-w-[180px]">
                Join Date
              </th>
              <th className="text-left px-3 py-3 font-mono text-[11px] text-chalk-400 uppercase tracking-wide min-w-[180px]">
                To
              </th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t, i) => {
              const leaveDate = t.leaveDate ? formatDate(t.leaveDate) : "N/A";
              const joinDate = t.joinDate ? formatDate(t.joinDate) : "N/A";

              const fromName = t.transferFromTeamName || "Free Agent";
              const toName = t.transferToTeamName || "Free Agent";
              const fromLogo = badgeImg(t.transferFromTeamBadgeUrlSmall);
              const toLogo = badgeImg(t.transferToTeamBadgeUrlSmall);

              return (
                <tr
                  key={`${t.playerId}-${t.leaveDate}-${t.joinDate}-${i}`}
                  className={`group ${i % 2 === 0 ? "bg-[#1c1c1c]" : "bg-[#181818]"}`}
                >
                  {/* Player */}
                  <td className="px-3 py-1.5">
                    {(() => {
                      const info = playerMap.get(t.playerId);
                      const steamId = info?.steamId;
                      const avatar = info?.avatar;
                      const inner = (
                        <span className="flex items-center gap-2">
                          {avatar ? (
                            <img src={avatar} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded bg-pitch-700 flex items-center justify-center text-[10px] font-display font-700 text-chalk-300 shrink-0">
                              {t.playerName[0]?.toUpperCase() || "?"}
                            </div>
                          )}
                          <span className="font-body font-medium text-chalk-100 group-hover:text-[#F4119E] transition-colors truncate max-w-[120px]">
                            {t.playerName}
                          </span>
                        </span>
                      );
                      return steamId ? (
                        <Link
                          href={`/players/${steamId}`}
                          className="hover:text-[#F4119E] transition-colors"
                        >
                          {inner}
                        </Link>
                      ) : (
                        inner
                      );
                    })()}
                  </td>

                  {/* Leave Date */}
                  <td className="px-3 py-1.5 font-mono text-[12px] text-chalk-300">
                    {leaveDate}
                  </td>

                  {/* From */}
                  <td className="px-3 py-1.5">
                    {t.transferFromTeamId ? (
                      <Link
                        href={`/teams/${t.transferFromTeamId}`}
                        className="flex items-center gap-2 hover:text-[#F4119E] transition-colors"
                      >
                        {fromLogo && (
                          <img src={fromLogo} alt="" className="w-5 h-5 rounded object-contain shrink-0" />
                        )}
                        <span className="font-body text-sm text-chalk-100 hover:text-[#F4119E] transition-colors truncate max-w-[140px]">
                          {fromName}
                        </span>
                      </Link>
                    ) : (
                      <span className="font-body text-sm text-chalk-400">Free Agent</span>
                    )}
                  </td>

                  {/* Join Date */}
                  <td className="px-3 py-1.5 font-mono text-[12px] text-chalk-300">
                    {joinDate}
                  </td>

                  {/* To */}
                  <td className="px-3 py-1.5">
                    {t.transferToTeamId ? (
                      <Link
                        href={`/teams/${t.transferToTeamId}`}
                        className="flex items-center gap-2 hover:text-[#F4119E] transition-colors"
                      >
                        {toLogo && (
                          <img src={toLogo} alt="" className="w-5 h-5 rounded object-contain shrink-0" />
                        )}
                        <span className="font-body text-sm text-chalk-100 hover:text-[#F4119E] transition-colors truncate max-w-[140px]">
                          {toName}
                        </span>
                      </Link>
                    ) : (
                      <span className="font-body text-sm text-chalk-400">Free Agent</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {transfers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-chalk-400 font-body">
                  {apiUnavailable
                    ? "The IOSoccer API is currently unreachable. Please try again in a few minutes."
                    : "No transfers found."}
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
