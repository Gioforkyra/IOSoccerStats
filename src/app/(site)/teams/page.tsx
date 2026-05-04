import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getActiveTeams, type ApiTeamSummary } from "@/lib/iosoccer-api";
import TeamsGrid from "./TeamsGrid";
import ApiUnavailableNotice from "@/components/ApiUnavailableNotice";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Teams — IOSHUBv2",
  description: "All active IOSoccer teams with ratings, stats and squad information.",
};

const TEAM_TYPES = [
  { value: "1", label: "CLUB TEAMS" },
  { value: "2", label: "NATIONAL TEAMS" },
  { value: "3", label: "MIX TEAMS" },
  { value: "4", label: "DRAFT TEAMS" },
];

const REGIONS = [
  { value: "1", label: "EUROPE" },
  { value: "2", label: "SOUTH AMERICA" },
  { value: "3", label: "NORTH AMERICA" },
  { value: "4", label: "ASIA" },
];

export type TeamWithRating = ApiTeamSummary & { avgRating: number | null; isInactive?: boolean; dbLogo?: string | null };

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; region?: string }>;
}) {
  const params = await searchParams;
  const typeFilter = params.type || "1";
  const teamTypeInt = parseInt(typeFilter);
  const regionFilter = params.region || "1";
  const regionInt = parseInt(regionFilter);

  let activeTeams: ApiTeamSummary[] = [];
  let apiUnavailable = false;
  try {
    activeTeams = await getActiveTeams(regionInt, teamTypeInt);
  } catch {
    apiUnavailable = true;
  }

  // avg_rating for active teams
  const activeIds = activeTeams.map((t) => t.id);
  const dbActive = activeIds.length > 0
    ? await prisma.$queryRaw<{ id: number; avg_rating: number | null }[]>`
        SELECT id, avg_rating FROM teams WHERE id = ANY(${activeIds})
      `
    : [];
  const ratingMap = new Map(dbActive.map((r) => [r.id, r.avg_rating]));

  const teamsWithRating: TeamWithRating[] = activeTeams.map((t) => ({
    ...t,
    avgRating: ratingMap.get(t.id) ?? null,
  }));

  // Inactive teams from DB
  const inactiveRows = await prisma.$queryRaw<{
    id: number; name: string; slug: string; logo: string | null;
    color: string | null; region: string | null; avg_rating: number | null;
    team_type: number | null;
  }[]>`
    SELECT id, name, slug, logo, color, region, avg_rating, team_type
    FROM teams
    WHERE inactive = true
      AND team_type = ${teamTypeInt}
      AND region_id = ${regionInt}
    ORDER BY name ASC
  `;

  const inactiveTeams: TeamWithRating[] = inactiveRows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    badgeImageId: null,
    badgeImage: null,
    color: r.color,
    region: r.region,
    inactive: true,
    teamType: r.team_type ?? teamTypeInt,
    avgRating: r.avg_rating,
    isInactive: true,
    dbLogo: r.logo,
  }));

  const currentTypeLabel = TEAM_TYPES.find((t) => t.value === typeFilter)?.label || "TEAMS";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">TEAMS</h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {teamsWithRating.length} {currentTypeLabel.toLowerCase()} · active
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-1 text-xs font-mono flex-wrap">
            {TEAM_TYPES.map((t) => (
              <a
                key={t.value}
                href={`/teams?type=${t.value}&region=${regionFilter}`}
                className={`px-3 py-1.5 rounded border transition-colors ${
                  typeFilter === t.value
                    ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10"
                    : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"
                }`}
              >
                {t.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs font-mono flex-wrap">
            {REGIONS.map((r) => (
              <a
                key={r.value}
                href={`/teams?type=${typeFilter}&region=${r.value}`}
                className={`px-3 py-1.5 rounded border transition-colors ${
                  regionFilter === r.value
                    ? "border-chalk-100/40 text-chalk-100 bg-chalk-100/10"
                    : "border-chalk-100/10 text-chalk-400 hover:border-chalk-100/30 hover:text-chalk-200"
                }`}
              >
                {r.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {apiUnavailable && <ApiUnavailableNotice />}
      <TeamsGrid activeTeams={teamsWithRating} inactiveTeams={inactiveTeams} />
    </div>
  );
}
