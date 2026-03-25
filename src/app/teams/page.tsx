import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { proxyImg } from "@/lib/img";

const TEAM_TYPES = [
  { value: "1", label: "CLUB TEAMS" },
  { value: "2", label: "NATIONAL TEAMS" },
  { value: "3", label: "MIX TEAMS" },
  { value: "4", label: "DRAFT TEAMS" },
];

type TeamCard = {
  id: number;
  name: string;
  logo: string | null;
  color: string | null;
  inactive: boolean;
  team_type: number | null;
  total_matches: bigint;
};

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const params = await searchParams;
  const typeFilter = params.type || "1"; // default Club
  const statusFilter = params.status || "current"; // current or past

  const isInactive = statusFilter === "past";

  const teams = await prisma.$queryRaw<TeamCard[]>`
    SELECT
      t.id,
      t.name,
      t.logo,
      t.color,
      t.inactive,
      t.team_type,
      COUNT(DISTINCT m.id) AS total_matches
    FROM teams t
    LEFT JOIN matches m ON m.home_team_id = t.id OR m.away_team_id = t.id
    WHERE t.region_id = 1
      AND t.team_type = ${parseInt(typeFilter)}::int
      AND t.inactive = ${isInactive}
    GROUP BY t.id, t.name, t.logo, t.color, t.inactive, t.team_type
    ORDER BY t.name ASC
  `;

  function filterUrl(key: string, value: string) {
    const sp = new URLSearchParams();
    if (key === "type") {
      sp.set("type", value);
      sp.set("status", statusFilter);
    } else {
      sp.set("type", typeFilter);
      sp.set("status", value);
    }
    return `/teams?${sp.toString()}`;
  }

  const currentTypeLabel = TEAM_TYPES.find((t) => t.value === typeFilter)?.label || "TEAMS";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            TEAMS
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {teams.length} {currentTypeLabel.toLowerCase()} · {statusFilter === "current" ? "active" : "inactive"}
          </p>
        </div>

        {/* Team type dropdown-style filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-mono">
            {TEAM_TYPES.map((t) => (
              <Link
                key={t.value}
                href={filterUrl("type", t.value)}
                className={`px-3 py-1.5 rounded border transition-colors ${
                  typeFilter === t.value
                    ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10"
                    : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Current / Past toggle */}
      <div className="flex items-center gap-3 mb-6">
        {["current", "past"].map((s) => (
          <Link
            key={s}
            href={filterUrl("status", s)}
            className={`text-sm font-display font-700 tracking-wider uppercase transition-colors ${
              statusFilter === s
                ? "text-chalk-100 border-b-2 border-[#F4119E] pb-1"
                : "text-chalk-400 hover:text-chalk-200 pb-1 border-b-2 border-transparent"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Team Cards Grid */}
      {teams.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-chalk-400 font-body text-lg mb-2">No teams found</div>
          <p className="text-chalk-400/60 font-mono text-sm">
            Try changing the filters above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {teams.map((t) => {
            const bgColor = t.color || "#1a2d52";
            const matches = Number(t.total_matches);

            return (
              <Link
                key={t.id}
                href={`/teams/${t.id}`}
                className="group relative rounded-xl overflow-hidden border-2 border-transparent hover:border-[#F4119E]/50 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-[#F4119E]/20"
              >
                {/* Color background */}
                <div
                  className="aspect-[4/3] flex items-center justify-center p-4 relative"
                  style={{ backgroundColor: bgColor }}
                >
                  {/* Subtle gradient overlay for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

                  {t.logo ? (
                    <img
                      src={proxyImg(t.logo)!}
                      alt={t.name}
                      className="w-20 h-20 object-contain relative z-10 drop-shadow-lg group-hover:scale-110 transition-transform"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center relative z-10">
                      <span className="font-display font-900 text-2xl text-white/80">
                        {t.name.slice(0, 3).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Team info */}
                <div className="bg-pitch-900 p-3 text-center">
                  <div className="font-display font-700 text-sm text-chalk-100 uppercase tracking-wide truncate">
                    {t.name}
                  </div>
                  <div className="text-[10px] font-mono text-chalk-400 mt-1">
                    {matches > 0
                      ? `${matches} match${matches !== 1 ? "es" : ""}`
                      : "No matches yet"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
