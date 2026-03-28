"use client";

const MIN_APPS_OPTIONS = [0, 10, 25, 50, 100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000];

export function MinAppsSelect({
  view,
  sortKey,
  dir,
  nameQuery,
  minApps,
}: {
  view: string;
  sortKey: string;
  dir: string;
  nameQuery: string;
  minApps: number;
}) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sp = new URLSearchParams();
    sp.set("view", view);
    sp.set("sort", sortKey);
    sp.set("dir", dir);
    if (nameQuery) sp.set("q", nameQuery);
    const val = e.target.value;
    if (val !== "0") sp.set("minApps", val);
    window.location.href = `/players?${sp.toString()}`;
  }

  return (
    <select
      value={String(minApps)}
      onChange={handleChange}
      className={`px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer bg-transparent border ${
        minApps > 0
          ? "text-[#F4119E] border-[#F4119E]/40 bg-[#F4119E]/15"
          : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/30 hover:text-chalk-200"
      }`}
    >
      <option
        value="0"
        style={{ backgroundColor: "#1c1c1c", color: minApps === 0 ? "#F4119E" : "#5a6e94" }}
      >
        ALL APPEARANCES
      </option>
      {MIN_APPS_OPTIONS.filter((v) => v > 0).map((v) => (
        <option
          key={v}
          value={String(v)}
          style={{ backgroundColor: "#1c1c1c", color: v === minApps ? "#F4119E" : "#5a6e94" }}
        >
          {v}+ APPEARANCES
        </option>
      ))}
    </select>
  );
}
