"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MIN_MATCHES_OPTIONS = [0, 50, 100, 500, 1000, 2000];

function buildHref(period: string, minMatches: number) {
  const params = new URLSearchParams();
  params.set("period", period);
  params.set("min", String(minMatches));
  return `/ratings?${params.toString()}`;
}

type Props = {
  periods: string[];
  selectedPeriod: string;
  minMatches: number;
};

export function RatingsFilters({ periods, selectedPeriod, minMatches }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (href: string) => {
    startTransition(() => router.push(href));
  };

  const periodsByYear = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of periods) {
      const [y] = p.split("-");
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(p);
    }
    return map;
  }, [periods]);

  const years = useMemo(
    () => Array.from(periodsByYear.keys()).sort((a, b) => Number(b) - Number(a)),
    [periodsByYear]
  );

  const selectedYearFromPeriod = selectedPeriod ? selectedPeriod.split("-")[0] : years[0] ?? "";
  const [selectedYear, setSelectedYear] = useState<string>(selectedYearFromPeriod);

  const monthsForYear = (periodsByYear.get(selectedYear) ?? [])
    .slice()
    .sort((a, b) => a.localeCompare(b));

  const handleYearClick = (year: string) => {
    setSelectedYear(year);
    if (year === selectedYearFromPeriod) return;
    const firstMonth = periodsByYear.get(year)?.[0];
    if (firstMonth) navigate(buildHref(firstMonth, minMatches));
  };

  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* Year selector + min matches (right) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono text-chalk-500 uppercase tracking-wider mr-1">year</span>
        {years.map((y) => {
          const active = y === selectedYear;
          const cn = `px-3 py-1.5 rounded text-xs font-mono font-700 transition-colors border ${
            active
              ? "bg-[#F4119E]/15 border-[#F4119E]/50 text-chalk-100 cursor-default"
              : "bg-pitch-900/40 border-chalk-100/10 text-chalk-400 hover:text-chalk-100 hover:border-chalk-100/20"
          } ${isPending ? "pointer-events-none opacity-70" : ""}`;
          return active ? (
            <span key={y} className={cn} aria-current="page">{y}</span>
          ) : (
            <button
              key={y}
              type="button"
              onClick={() => handleYearClick(y)}
              className={cn}
            >
              {y}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-mono text-chalk-500 uppercase tracking-wider">min matches</span>
          <div className="flex gap-1">
            {MIN_MATCHES_OPTIONS.map((m) => {
              const active = m === minMatches;
              const cn = `px-2.5 py-1 rounded text-xs font-mono transition-colors border ${
                active
                  ? "bg-chalk-100/10 border-chalk-100/30 text-chalk-100 cursor-default"
                  : "bg-transparent border-chalk-100/8 text-chalk-500 hover:text-chalk-300 hover:border-chalk-100/20"
              } ${isPending ? "pointer-events-none opacity-70" : ""}`;
              const label = m === 0 ? "all" : `${m}+`;
              return active ? (
                <span key={m} className={cn} aria-current="page">{label}</span>
              ) : (
                <button
                  key={m}
                  type="button"
                  onClick={() => navigate(buildHref(selectedPeriod ?? "", m))}
                  className={cn}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Month selector for selected year */}
      {monthsForYear.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono text-chalk-500 uppercase tracking-wider mr-1">month</span>
          {monthsForYear.map((p) => {
            const month = parseInt(p.split("-")[1], 10);
            const label = MONTHS[month - 1];
            const active = p === selectedPeriod;
            const cn = `px-3 py-1.5 rounded text-xs font-mono font-600 transition-colors border ${
              active
                ? "bg-chalk-100/10 border-chalk-100/30 text-chalk-100 cursor-default"
                : "bg-pitch-900/40 border-chalk-100/10 text-chalk-400 hover:text-chalk-100 hover:border-chalk-100/20"
            } ${isPending ? "pointer-events-none opacity-70" : ""}`;
            return active ? (
              <span key={p} className={cn} aria-current="page">{label}</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => navigate(buildHref(p, minMatches))}
                className={cn}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-[10px] font-mono text-chalk-500 uppercase tracking-wider">EU players only</span>

        {isPending && (
          <span
            role="status"
            aria-label="Loading"
            className="ml-auto inline-flex items-center gap-2"
          >
            <span className="w-4 h-4 rounded-full border-2 border-[#F4119E]/25 border-t-[#F4119E] animate-spin" />
            <span className="text-[10px] font-mono text-[#F4119E] uppercase tracking-wider">loading…</span>
          </span>
        )}
      </div>
    </div>
  );
}
