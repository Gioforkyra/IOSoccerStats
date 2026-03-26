export default function PlayerProfileLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="h-4 w-32 bg-pitch-800 rounded animate-pulse mb-6" />

      {/* Hero card skeleton */}
      <div className="rounded-xl border border-chalk-100/8 bg-pitch-900 p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-lg bg-pitch-700 animate-pulse shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-9 w-48 bg-pitch-800 rounded animate-pulse" />
            <div className="flex gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-14 bg-pitch-700 rounded animate-pulse" />
                  <div className="h-6 w-20 bg-pitch-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-pitch-900/60 border border-chalk-100/8 rounded-lg p-4">
            <div className="h-3 w-16 bg-pitch-700 rounded animate-pulse mb-2" />
            <div className="h-8 w-20 bg-pitch-800 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Detailed stats skeleton */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-pitch-900/40 border border-chalk-100/8 rounded-lg p-5">
            <div className="h-4 w-24 bg-pitch-700 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-4 w-20 bg-pitch-800 rounded animate-pulse" />
                  <div className="h-4 w-12 bg-pitch-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
