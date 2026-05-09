"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MIN_MATCHES_OPTIONS = [0, 50, 100, 500, 1000, 2000];

function fmtPeriod(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

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

  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => {
          const active = p === selectedPeriod;
          const cn = `px-3 py-1.5 rounded text-xs font-mono font-600 transition-colors border ${
            active
              ? "bg-[#F4119E]/15 border-[#F4119E]/50 text-chalk-100 cursor-default"
              : "bg-pitch-900/40 border-chalk-100/10 text-chalk-400 hover:text-chalk-100 hover:border-chalk-100/20"
          } ${isPending ? "pointer-events-none opacity-70" : ""}`;
          return active ? (
            <span key={p} className={cn} aria-current="page">{fmtPeriod(p)}</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => navigate(buildHref(p, minMatches))}
              className={cn}
            >
              {fmtPeriod(p)}
            </button>
          );
        })}
      </div>

      <div className="w-px h-4 bg-chalk-100/10" />

      {/* Min matches filter */}
      <div className="flex items-center gap-2">
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

      <div className="w-px h-4 bg-chalk-100/10" />

      <span className="text-[10px] font-mono text-chalk-500 uppercase tracking-wider">EU players only</span>

      {/* Loading spinner — appears to the right of filters during navigation */}
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
  );
}
