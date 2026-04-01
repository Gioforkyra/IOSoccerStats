export default function MatchesLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="h-10 w-44 bg-pitch-800 rounded skeleton-fade" />
        <div className="h-4 w-48 bg-pitch-800 rounded skeleton-fade mt-2" style={{ animationDelay: "50ms" }} />
      </div>

      {/* Date groups */}
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g} className="mb-6 skeleton-fade" style={{ animationDelay: `${100 + g * 150}ms` }}>
          <div className="h-3 w-32 bg-pitch-800 rounded mb-2" />
          <div className="rounded-lg border border-chalk-100/8 overflow-hidden bg-pitch-900/40 divide-y divide-chalk-100/5">
            {Array.from({ length: 4 + g }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 skeleton-fade ${i % 2 === 0 ? "bg-pitch-600/15" : ""}`}
                style={{ animationDelay: `${200 + g * 150 + i * 40}ms` }}
              >
                <div className="w-12 h-3 bg-pitch-700 rounded shrink-0" />
                <div className="flex-1 flex items-center justify-end gap-2">
                  <div className="h-4 bg-pitch-800/60 rounded" style={{ width: `${60 + (i * 23) % 60}px` }} />
                  <div className="w-5 h-5 bg-pitch-700 rounded shrink-0" />
                </div>
                <div className="w-16 flex items-center justify-center gap-1.5 shrink-0">
                  <div className="w-5 h-5 bg-pitch-700 rounded" />
                  <div className="w-2 h-3 bg-pitch-800/40 rounded" />
                  <div className="w-5 h-5 bg-pitch-700 rounded" />
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="w-5 h-5 bg-pitch-700 rounded shrink-0" />
                  <div className="h-4 bg-pitch-800/60 rounded" style={{ width: `${50 + (i * 19) % 70}px` }} />
                </div>
                <div className="w-10 h-4 bg-pitch-800/40 rounded shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
