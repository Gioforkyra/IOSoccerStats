export default function TeamsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-10 w-40 bg-pitch-800 rounded skeleton-fade" />
        <div className="h-4 w-48 bg-pitch-800 rounded skeleton-fade mt-2" style={{ animationDelay: "50ms" }} />
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2 mb-6 skeleton-fade" style={{ animationDelay: "100ms" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-28 bg-pitch-800 rounded" />
        ))}
      </div>

      {/* Team cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden border border-chalk-100/8 skeleton-fade"
            style={{ animationDelay: `${150 + i * 50}ms` }}
          >
            <div className="aspect-square bg-pitch-800 flex items-center justify-center">
              <div className="w-24 h-24 bg-pitch-700/50 rounded-lg skeleton-shimmer" />
            </div>
            <div className="bg-pitch-900 p-3 flex flex-col items-center gap-1">
              <div className="h-4 w-20 bg-pitch-700 rounded" />
              <div className="h-3 w-16 bg-pitch-800/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
