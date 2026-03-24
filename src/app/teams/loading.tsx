export default function TeamsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="h-10 w-40 bg-pitch-800 rounded animate-pulse" />
        <div className="h-4 w-48 bg-pitch-800 rounded animate-pulse mt-2" />
      </div>
      <div className="flex items-center gap-3 mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-16 bg-pitch-800 rounded animate-pulse" />
        ))}
      </div>
      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="flex items-center px-4 py-3 gap-4 border-b border-chalk-100/5">
            <div className="h-4 w-6 bg-pitch-800 rounded animate-pulse" />
            <div className="w-7 h-7 rounded bg-pitch-700 animate-pulse" />
            <div className="h-4 bg-pitch-800 rounded animate-pulse" style={{ width: `${100 + Math.random() * 80}px` }} />
            <div className="flex-1" />
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-4 w-10 bg-pitch-800 rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
