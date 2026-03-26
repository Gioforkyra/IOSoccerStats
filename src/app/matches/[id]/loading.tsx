export default function MatchLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="h-4 w-32 bg-pitch-800 rounded animate-pulse mb-6" />

      {/* Score header */}
      <div className="bg-pitch-900/60 border border-chalk-100/8 rounded-xl p-6 md:p-8 mb-6">
        <div className="h-3 w-40 bg-pitch-700 rounded animate-pulse mx-auto mb-5" />
        <div className="flex items-center justify-center gap-4 md:gap-8">
          <div className="flex-1 flex justify-end">
            <div className="h-8 w-32 bg-pitch-800 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-14 w-10 bg-pitch-800 rounded animate-pulse" />
            <div className="h-6 w-3 bg-pitch-700 rounded animate-pulse" />
            <div className="h-14 w-10 bg-pitch-800 rounded animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="h-8 w-32 bg-pitch-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-2 w-full bg-pitch-700 rounded-full animate-pulse mt-5" />
      </div>

      {/* Shot map + Team stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="h-5 w-24 bg-pitch-800 rounded animate-pulse mb-3" />
          <div className="bg-pitch-800/60 rounded-lg border border-chalk-100/8" style={{ paddingTop: "62%" }} />
        </div>
        <div>
          <div className="h-5 w-24 bg-pitch-800 rounded animate-pulse mb-3" />
          <div className="bg-pitch-900/40 rounded-lg border border-chalk-100/8 p-4 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center">
                <div className="h-4 w-10 bg-pitch-800 rounded animate-pulse" />
                <div className="flex-1 flex justify-center">
                  <div className="h-3 w-16 bg-pitch-700 rounded animate-pulse" />
                </div>
                <div className="h-4 w-10 bg-pitch-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Player stats tables */}
      {Array.from({ length: 2 }).map((_, t) => (
        <div key={t} className="mb-6">
          <div className="h-5 w-36 bg-pitch-800 rounded animate-pulse mb-3" />
          <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
            <div className="p-3 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-4 w-24 bg-pitch-800 rounded animate-pulse" />
                  {Array.from({ length: 10 }).map((_, j) => (
                    <div key={j} className="h-4 w-8 bg-pitch-700 rounded animate-pulse" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
