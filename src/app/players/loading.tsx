export default function PlayersLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-10 w-56 bg-pitch-800 rounded animate-pulse" />
        <div className="h-4 w-40 bg-pitch-800 rounded animate-pulse mt-2" />
      </div>

      {/* Position filter skeleton */}
      <div className="flex items-center gap-3 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-14 bg-pitch-800 rounded animate-pulse" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40">
        {/* Header row */}
        <div className="flex items-center border-b border-chalk-100/8 px-4 py-3 gap-4">
          <div className="h-3 w-6 bg-pitch-700 rounded animate-pulse" />
          <div className="h-3 w-32 bg-pitch-700 rounded animate-pulse" />
          <div className="flex-1" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-3 w-12 bg-pitch-700 rounded animate-pulse" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center px-4 py-3 gap-4 border-b border-chalk-100/5"
          >
            <div className="h-4 w-6 bg-pitch-800 rounded animate-pulse" />
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-pitch-700 animate-pulse" />
              <div className="h-4 bg-pitch-800 rounded animate-pulse" style={{ width: `${80 + Math.random() * 80}px` }} />
            </div>
            <div className="flex-1" />
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="h-4 w-10 bg-pitch-800 rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
