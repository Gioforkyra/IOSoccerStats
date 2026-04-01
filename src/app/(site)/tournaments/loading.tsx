export default function TournamentsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-10 w-56 bg-pitch-800 rounded skeleton-fade" />
        <div className="h-4 w-40 bg-pitch-800 rounded skeleton-fade mt-2" style={{ animationDelay: "50ms" }} />
      </div>

      <div className="flex items-center gap-3 mb-6 skeleton-fade" style={{ animationDelay: "100ms" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-6 w-24 bg-pitch-800 rounded" />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-pitch-900/40 border border-chalk-100/8 rounded-lg p-5 skeleton-fade"
            style={{ animationDelay: `${150 + i * 60}ms` }}
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-pitch-700 rounded-lg shrink-0 skeleton-shimmer" />
              <div className="flex-1">
                <div className="h-5 w-48 bg-pitch-700 rounded mb-2" />
                <div className="flex gap-4">
                  <div className="h-3 w-32 bg-pitch-800/60 rounded" />
                  <div className="h-3 w-20 bg-pitch-800/60 rounded" />
                  <div className="h-3 w-16 bg-pitch-800/60 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
