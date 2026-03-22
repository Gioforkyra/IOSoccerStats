import Link from "next/link";

// Mock data — sostituisci con fetch reale dal tuo backend
const RECENT_MATCHES = [
  { id: 229807, home: "Joga Bonito", homeCode: "JB", away: "Vision", awayCode: "VSN", homeGoals: 8, awayGoals: 1, map: "stanley_park", kickOff: "2h ago" },
  { id: 229806, home: "Esperanza", homeCode: "pZ", away: "Project X", awayCode: "X", homeGoals: 5, awayGoals: 2, map: "london", kickOff: "3h ago" },
  { id: 229805, home: "Yutes", homeCode: "Yutes", away: "Inspiration", awayCode: "INP", homeGoals: 3, awayGoals: 5, map: "vienna", kickOff: "4h ago" },
  { id: 229804, home: "Joga Bonito", homeCode: "JB", away: "IOSoccer Challenge", awayCode: "IOSC", homeGoals: 4, awayGoals: 2, map: "london", kickOff: "5h ago" },
  { id: 229802, home: "Project X", homeCode: "X", away: "IOSoccer Premier", awayCode: "IOSP", homeGoals: 5, awayGoals: 4, map: "court_hey", kickOff: "6h ago" },
];

const TOP_SCORERS = [
  { name: "aryan", goals: 2155, apps: 3188, avg: 0.68, rating: 9.2 },
  { name: "Nuri",  goals: 2310, apps: 2282, avg: 1.01, rating: 7.9 },
  { name: "Janir", goals: 1999, apps: 2128, avg: 0.94, rating: 8.0 },
  { name: "tet-",  goals: 708,  apps: 3109, avg: 0.23, rating: 8.2 },
  { name: "Kobe",  goals: 546,  apps: 967,  avg: 0.56, rating: 8.3 },
];

const STATS_HERO = [
  { label: "Total Matches",  value: "91,306", sub: "all time" },
  { label: "Active Players", value: "6,790",  sub: "with 10+ apps" },
  { label: "Goals Scored",   value: "2.1M",   sub: "tracked" },
  { label: "xG Calculated",  value: "1.8M",   sub: "by IOStats" },
];

export default function HomePage() {
  return (
    <div className="field-stripes min-h-screen">
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-6 pt-16 pb-12">
        {/* Background field lines */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] border border-chalk-100 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-chalk-100 rounded-full" />
          <div className="absolute top-0 left-1/2 -translate-x-px h-full w-px bg-chalk-100" />
        </div>

        <div className="relative z-10">
          <div className="fade-up fade-up-1 inline-flex items-center gap-2 text-xs font-mono text-grass-500 border border-grass-500/30 rounded-full px-3 py-1 mb-6">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-grass-500" />
            LIVE DATA FROM EUROPE REGION
          </div>

          <h1 className="fade-up fade-up-2 font-display font-900 text-6xl md:text-8xl tracking-tight text-chalk-100 leading-none mb-4">
            STATS THAT<br />
            <span className="text-grass-500">MATTER.</span>
          </h1>

          <p className="fade-up fade-up-3 text-chalk-300 text-lg max-w-xl mb-8 font-body">
            The most advanced analytics hub for IOSoccer. Shot maps, xG, 
            performance curves and head-to-head comparisons — all powered 
            by real match data.
          </p>

          <div className="fade-up fade-up-4 flex items-center gap-4">
            <Link
              href="/players"
              className="font-display font-700 tracking-widest text-sm px-6 py-3 bg-grass-500 text-pitch-950 rounded hover:bg-grass-400 transition-colors"
            >
              EXPLORE PLAYERS
            </Link>
            <Link
              href="/matches"
              className="font-display font-700 tracking-widest text-sm px-6 py-3 border border-chalk-100/20 text-chalk-200 rounded hover:border-chalk-100/40 transition-colors"
            >
              RECENT MATCHES
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────── */}
      <section className="border-y border-chalk-100/5 bg-pitch-900/50">
        <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS_HERO.map((s, i) => (
            <div key={s.label} className={`fade-up fade-up-${i + 1}`}>
              <div className="font-display font-800 text-3xl text-grass-500 stat-glow">
                {s.value}
              </div>
              <div className="text-xs font-mono text-chalk-400 uppercase tracking-wider mt-0.5">
                {s.label}
              </div>
              <div className="text-xs text-chalk-400/50 font-body">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Main content grid ────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Matches — 2/3 width */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-lg tracking-wider text-chalk-100">
              RECENT MATCHES
            </h2>
            <Link href="/matches" className="text-xs font-mono text-grass-500 hover:text-grass-400">
              VIEW ALL →
            </Link>
          </div>

          <div className="rounded-lg border border-chalk-100/8 overflow-hidden bg-pitch-900/40">
            {RECENT_MATCHES.map((m, i) => {
              const homeWin = m.homeGoals > m.awayGoals;
              const awayWin = m.awayGoals > m.homeGoals;
              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className={`stat-row flex items-center px-4 py-3 gap-4 group fade-up fade-up-${Math.min(i + 1, 5)}`}
                >
                  {/* Time + map */}
                  <div className="w-24 shrink-0">
                    <div className="text-xs font-mono text-chalk-400">{m.kickOff}</div>
                    <div className="text-xs text-chalk-400/40 truncate">{m.map}</div>
                  </div>

                  {/* Home team */}
                  <div className="flex-1 flex items-center justify-end gap-2">
                    <span className={`text-sm font-body font-medium truncate ${homeWin ? "text-chalk-100" : "text-chalk-400"}`}>
                      {m.home}
                    </span>
                    <span className="font-mono text-xs text-chalk-300 shrink-0 w-6 text-center">
                      {m.homeCode}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 flex items-center gap-1 font-display font-700 text-lg">
                    <span className={homeWin ? "text-grass-500" : "text-chalk-200"}>
                      {m.homeGoals}
                    </span>
                    <span className="text-chalk-400/30 text-sm">—</span>
                    <span className={awayWin ? "text-grass-500" : "text-chalk-200"}>
                      {m.awayGoals}
                    </span>
                  </div>

                  {/* Away team */}
                  <div className="flex-1 flex items-center gap-2">
                    <span className="font-mono text-xs text-chalk-300 shrink-0 w-6 text-center">
                      {m.awayCode}
                    </span>
                    <span className={`text-sm font-body font-medium truncate ${awayWin ? "text-chalk-100" : "text-chalk-400"}`}>
                      {m.away}
                    </span>
                  </div>

                  {/* Arrow */}
                  <span className="text-chalk-400/20 group-hover:text-grass-500 transition-colors text-xs">→</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Top Scorers — 1/3 width */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-lg tracking-wider text-chalk-100">
              TOP SCORERS
            </h2>
            <Link href="/players?sort=goals" className="text-xs font-mono text-grass-500 hover:text-grass-400">
              VIEW ALL →
            </Link>
          </div>

          <div className="rounded-lg border border-chalk-100/8 overflow-hidden bg-pitch-900/40">
            {TOP_SCORERS.map((p, i) => (
              <Link
                key={p.name}
                href={`/players/${p.name}`}
                className="stat-row flex items-center px-4 py-3 gap-3 group"
              >
                {/* Rank */}
                <span className="font-display font-700 text-2xl text-chalk-100/10 w-6 shrink-0">
                  {i + 1}
                </span>

                {/* Name + rating */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-body font-medium text-chalk-100 truncate group-hover:text-grass-400 transition-colors">
                    {p.name}
                  </div>
                  <div className="text-xs text-chalk-400 font-mono">
                    {p.apps} apps · {p.avg} avg
                  </div>
                </div>

                {/* Goals */}
                <div className="text-right shrink-0">
                  <div className="font-display font-700 text-xl text-chalk-100">
                    {p.goals.toLocaleString()}
                  </div>
                  <div className="text-xs text-chalk-400 font-mono">goals</div>
                </div>
              </Link>
            ))}
          </div>

          {/* xG callout */}
          <div className="mt-4 p-4 rounded-lg border border-grass-500/20 bg-grass-500/5">
            <div className="text-xs font-mono text-grass-500 uppercase tracking-wider mb-1">
              NEW ON IOSTATS
            </div>
            <div className="text-sm font-body text-chalk-200">
              Expected Goals (xG) calculated from real shot coordinates for every match. 
              See who overperforms their xG.
            </div>
            <Link href="/players?sort=xg" className="text-xs font-mono text-grass-500 mt-2 inline-block hover:text-grass-400">
              EXPLORE XG STATS →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature cards ────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <h2 className="font-display font-700 text-lg tracking-wider text-chalk-100 mb-6">
          WHY IOSTATS
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: "◎",
              title: "Shot Maps",
              desc: "Every shot plotted on the pitch with xG value. Filter by player, team or season.",
              href: "/matches/229806",
              color: "text-grass-500",
            },
            {
              icon: "⚡",
              title: "10× Faster",
              desc: "Pre-computed aggregations mean sub-100ms response times on every leaderboard.",
              href: "/players",
              color: "text-amber-400",
            },
            {
              icon: "↔",
              title: "Player Compare",
              desc: "Head-to-head radar charts comparing any two players across 12 metrics.",
              href: "/players/compare",
              color: "text-chalk-200",
            },
          ].map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group p-5 rounded-lg border border-chalk-100/8 bg-pitch-900/40 hover:border-chalk-100/20 transition-all hover:-translate-y-0.5"
            >
              <div className={`font-display text-3xl mb-3 ${f.color}`}>{f.icon}</div>
              <div className="font-display font-700 text-base tracking-wider text-chalk-100 mb-1">
                {f.title}
              </div>
              <div className="text-sm font-body text-chalk-400">{f.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
