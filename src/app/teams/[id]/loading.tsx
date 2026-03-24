export default function TeamProfileLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="h-4 w-32 bg-pitch-800 rounded animate-pulse mb-6" />
      <div className="rounded-xl border border-chalk-100/8 bg-pitch-900 p-6 md:p-8 mb-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-pitch-700 animate-pulse shrink-0" />
          <div className="space-y-2">
            <div className="h-9 w-48 bg-pitch-800 rounded animate-pulse" />
            <div className="h-4 w-24 bg-pitch-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-pitch-900/60 border border-chalk-100/8 rounded-lg p-4">
            <div className="h-3 w-12 bg-pitch-700 rounded animate-pulse mb-2" />
            <div className="h-8 w-16 bg-pitch-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
