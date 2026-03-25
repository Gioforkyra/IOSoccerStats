export default function PlayersLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-10 w-56 bg-pitch-800 rounded skeleton-fade" />
        <div className="h-4 w-40 bg-pitch-800 rounded skeleton-fade mt-2" style={{ animationDelay: "50ms" }} />
      </div>

      {/* Position filter skeleton */}
      <div className="flex items-center gap-3 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-14 bg-pitch-800 rounded skeleton-fade" style={{ animationDelay: `${100 + i * 30}ms` }} />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40">
        {/* Header row */}
        <div className="flex items-center border-b border-chalk-100/8 px-4 py-3 gap-4 skeleton-fade" style={{ animationDelay: "200ms" }}>
          <div className="h-3 w-6 bg-pitch-700 rounded" />
          <div className="h-3 w-32 bg-pitch-700 rounded" />
          <div className="flex-1" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-3 w-12 bg-pitch-700 rounded" />
          ))}
        </div>
        {/* Rows - staggered appearance */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center px-4 py-3 gap-4 border-b border-chalk-100/5 skeleton-fade ${i % 2 === 0 ? "bg-pitch-600/15" : ""}`}
            style={{ animationDelay: `${250 + i * 40}ms` }}
          >
            <div className="h-4 w-6 bg-pitch-800/60 rounded" />
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-pitch-700 skeleton-shimmer" />
              <div className="h-4 bg-pitch-800/60 rounded" style={{ width: `${80 + (i * 17) % 80}px` }} />
            </div>
            <div className="flex-1" />
            {Array.from({ length: 8 }).map((_, j) => (
              <div key={j} className="h-4 w-10 bg-pitch-800/40 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
