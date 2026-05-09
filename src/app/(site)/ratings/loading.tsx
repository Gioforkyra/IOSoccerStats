export default function RatingsLoading() {
  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="h-10 w-40 bg-pitch-800 rounded skeleton-fade" />
        <div className="h-4 w-56 bg-pitch-800 rounded skeleton-fade mt-2" style={{ animationDelay: "50ms" }} />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Period pills */}
        <div className="flex flex-wrap gap-2 skeleton-fade" style={{ animationDelay: "100ms" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 w-20 bg-pitch-800 rounded" />
          ))}
        </div>

        <div className="w-px h-4 bg-chalk-100/10" />

        {/* Min matches pills */}
        <div className="flex items-center gap-2 skeleton-fade" style={{ animationDelay: "150ms" }}>
          <div className="h-3 w-20 bg-pitch-800/60 rounded" />
          <div className="flex gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-6 w-12 bg-pitch-800 rounded" />
            ))}
          </div>
        </div>

        <div className="w-px h-4 bg-chalk-100/10" />

        <div className="h-3 w-28 bg-pitch-800/60 rounded skeleton-fade" style={{ animationDelay: "200ms" }} />
      </div>

      {/* Chart area */}
      <div
        className="relative w-full h-[520px] rounded-lg border border-chalk-100/15 bg-pitch-900/60 overflow-hidden skeleton-fade"
        style={{ animationDelay: "250ms" }}
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />

        {/* Subtle horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between py-8 px-6 pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-px w-full bg-chalk-100/8" />
          ))}
        </div>

        {/* Loading label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="text-sm font-mono text-chalk-200 uppercase tracking-wider">
            Loading ratings…
          </div>
          <div className="text-xs font-mono text-chalk-400">
            This loading could take up to 30s
          </div>
        </div>
      </div>
    </main>
  );
}
