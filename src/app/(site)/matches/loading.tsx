export default function MatchesLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center gap-3 py-40">
        <div className="h-10 w-10 rounded-full border-2 border-chalk-100/15 border-t-[#F4119E] animate-spin" />
        <div className="text-sm font-mono text-chalk-200 uppercase tracking-wider">
          Loading matches…
        </div>
        <div className="text-xs font-mono text-chalk-400">
          This loading could take up to 30s
        </div>
      </div>
    </div>
  );
}
