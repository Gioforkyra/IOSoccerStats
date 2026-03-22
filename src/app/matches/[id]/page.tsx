"use client";
import Link from "next/link";

// Mock match data (match 229806 dal HAR reale)
const MATCH = {
  id: 229806,
  home: { name: "Esperanza", code: "pZ", goals: 5 },
  away: { name: "Project X", code: "X",  goals: 2 },
  kickOff: "Mon Mar 16 2026 — 19:07",
  map: "8v8_london",
  server: "[EU/FR] Official 8v8 | Match 3",
  potm: "bogba",
  events: [
    { type: "MISS",        min: 3,  player: "lemon",            team: "away", nx: 0.33, ny: 0.82 },
    { type: "YELLOW CARD", min: 6,  player: ".kAimb0t",         team: "away" },
    { type: "SAVE",        min: 10, player: "fom",   by: "edwar",  team: "away", nx: 0.49, ny: 0.94 },
    { type: "SAVE",        min: 11, player: "fom",   by: "Fisk",   team: "away", nx: 0.41, ny: 0.89 },
    { type: "YELLOW CARD", min: 20, player: "X.Disciplined Stroga", team: "away" },
    { type: "SAVE",        min: 22, player: "fom",   by: "lemon",  team: "home", nx: 0.45, ny: 0.92 },
    { type: "SAVE",        min: 25, player: "fom",   by: "edwar",  team: "away", nx: 0.52, ny: 0.91 },
    { type: "SAVE",        min: 29, player: "fom",   by: "bogba",  team: "away", nx: 0.48, ny: 0.88 },
    { type: "GOAL",        min: 39, player: "SeNy",               team: "home", nx: 0.52, ny: 0.95 },
    { type: "GOAL",        min: 44, player: "edwar",  by: "SeNy",  team: "home", nx: 0.46, ny: 0.91 },
    { type: "YELLOW CARD", min: 46, player: "bogba",              team: "home" },
    { type: "SAVE",        min: 55, player: "fom",   by: ".kAimb0t", team: "home", nx: 0.52, ny: 0.94 },
    { type: "MISS",        min: 59, player: "SeNy",               team: "home", nx: 0.50, ny: 0.84 },
    { type: "GOAL",        min: 64, player: "bogba",               team: "home", nx: 0.55, ny: 0.90 },
    { type: "GOAL",        min: 67, player: "edwar",  by: "bogba", team: "home", nx: 0.44, ny: 0.93 },
    { type: "MISS",        min: 72, player: "Fisk",                team: "home", nx: 0.51, ny: 0.80 },
    { type: "GOAL",        min: 90, player: "Zealtix", by: ".kAimb0t", team: "away", nx: 0.48, ny: 0.92 },
    { type: "GOAL",        min: 92, player: ".kAimb0t", by: "Zealtix", team: "away", nx: 0.51, ny: 0.94 },
  ],
  playerStats: [
    { team: "pZ", name: "bogba",     pos: "CM", goals: 1, shots: 2, shotsOT: 2, assists: 1, passes: 32, completed: 28, pct: "88%", ints: 5, poss: "9%", xg: 0.71 },
    { team: "pZ", name: "edwar",     pos: "LW", goals: 2, shots: 5, shotsOT: 4, assists: 1, passes: 45, completed: 35, pct: "78%", ints: 2, poss: "7%", xg: 1.24 },
    { team: "pZ", name: "SeNy",      pos: "CF", goals: 1, shots: 6, shotsOT: 3, assists: 1, passes: 18, completed: 13, pct: "72%", ints: 0, poss: "5%", xg: 0.98 },
    { team: "pZ", name: "fom",       pos: "GK", goals: 0, shots: 0, shotsOT: 0, assists: 0, passes: 12, completed: 9,  pct: "75%", ints: 0, poss: "3%", xg: 0 },
    { team: "pZ", name: "alberteg",  pos: "LB", goals: 1, shots: 0, shotsOT: 0, assists: 1, passes: 51, completed: 40, pct: "78%", ints: 1, poss: "8%", xg: 0.31 },
    { team: "pZ", name: "reborn",    pos: "CB", goals: 1, shots: 1, shotsOT: 1, assists: 0, passes: 56, completed: 43, pct: "77%", ints: 1, poss: "9%", xg: 0.22 },
    { team: "X",  name: ".kAimb0t",  pos: "RW", goals: 1, shots: 4, shotsOT: 4, assists: 1, passes: 15, completed: 12, pct: "80%", ints: 2, poss: "5%", xg: 0.88 },
    { team: "X",  name: "Zealtix",   pos: "CF", goals: 1, shots: 2, shotsOT: 2, assists: 1, passes: 16, completed: 11, pct: "69%", ints: 1, poss: "4%", xg: 0.76 },
    { team: "X",  name: "lemon",     pos: "LW", goals: 0, shots: 3, shotsOT: 1, assists: 0, passes: 20, completed: 15, pct: "75%", ints: 0, poss: "6%", xg: 0.42 },
    { team: "X",  name: "X.kim9",    pos: "CB", goals: 0, shots: 0, shotsOT: 0, assists: 0, passes: 62, completed: 51, pct: "82%", ints: 0, poss: "10%", xg: 0 },
  ],
};

function ShotDot({ event }: { event: typeof MATCH.events[0] }) {
  if (!event.nx) return null;
  const x = event.nx * 100;
  const y = (1 - event.ny) * 100;
  const color =
    event.type === "GOAL"  ? "#00e676" :
    event.type === "SAVE"  ? "#ffb300" :
    event.type === "MISS"  ? "#ef5350" : null;
  if (!color) return null;
  return (
    <div
      className="absolute w-3 h-3 rounded-full border-2 border-pitch-950/60 cursor-pointer hover:scale-150 transition-transform"
      style={{ left: `${x}%`, top: `${y}%`, background: color, transform: "translate(-50%, -50%)" }}
      title={`${event.type} — ${event.player} (min ${event.min})`}
    />
  );
}

export default function MatchPage({ params }: { params: { id: string } }) {
  const homeStats = MATCH.playerStats.filter(p => p.team === "pZ");
  const awayStats = MATCH.playerStats.filter(p => p.team === "X");

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-chalk-400 mb-6 flex items-center gap-2">
        <Link href="/matches" className="hover:text-grass-500">Matches</Link>
        <span className="text-chalk-400/30">/</span>
        <span className="text-chalk-200">Match {MATCH.id}</span>
      </div>

      {/* Score header */}
      <div className="bg-pitch-900/60 border border-chalk-100/8 rounded-lg p-6 mb-6 fade-up fade-up-1">
        <div className="text-xs font-mono text-chalk-400 text-center mb-4">
          {MATCH.kickOff} · {MATCH.map} · {MATCH.server}
        </div>
        <div className="flex items-center justify-center gap-8">
          <div className="text-right flex-1">
            <div className="font-display font-800 text-3xl text-chalk-100">{MATCH.home.name}</div>
            <div className="text-xs font-mono text-chalk-400 mt-1">{MATCH.home.code}</div>
          </div>
          <div className="font-display font-900 text-6xl flex items-center gap-3">
            <span className="text-grass-500">{MATCH.home.goals}</span>
            <span className="text-chalk-400/30 text-3xl">—</span>
            <span className="text-chalk-200">{MATCH.away.goals}</span>
          </div>
          <div className="flex-1">
            <div className="font-display font-800 text-3xl text-chalk-100">{MATCH.away.name}</div>
            <div className="text-xs font-mono text-chalk-400 mt-1">{MATCH.away.code}</div>
          </div>
        </div>
        <div className="text-center mt-4">
          <span className="text-xs font-mono text-amber-400">⭐ POTM: {MATCH.potm}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shot map */}
        <div className="lg:col-span-2 fade-up fade-up-2">
          <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">
            SHOT MAP <span className="text-xs text-grass-500 font-mono">· xG by IOStats</span>
          </h2>
          <div className="relative bg-pitch-800/60 rounded-lg border border-chalk-100/8 overflow-hidden" style={{ paddingTop: "62%" }}>
            <div className="absolute inset-0">
              {/* Pitch SVG */}
              <svg viewBox="0 0 100 62" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                {/* Field */}
                <rect x="0" y="0" width="100" height="62" fill="#0a1a0a" />
                {/* Stripes */}
                {[0,8,16,24,32,40,48,56,64,72,80,88,96].map(x => (
                  <rect key={x} x={x} y="0" width="4" height="62" fill="rgba(255,255,255,0.02)" />
                ))}
                {/* Outline */}
                <rect x="2" y="2" width="96" height="58" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
                {/* Center line */}
                <line x1="50" y1="2" x2="50" y2="60" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                {/* Center circle */}
                <circle cx="50" cy="31" r="9" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                <circle cx="50" cy="31" r="0.7" fill="rgba(255,255,255,0.3)" />
                {/* Home penalty area (top) */}
                <rect x="30" y="2" width="40" height="14" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                <rect x="38" y="2" width="24" height="7" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                {/* Away penalty area (bottom) */}
                <rect x="30" y="46" width="40" height="14" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
                <rect x="38" y="55" width="24" height="7" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                {/* Goals */}
                <rect x="43" y="1" width="14" height="1.5" fill="rgba(255,255,255,0.4)" />
                <rect x="43" y="60.5" width="14" height="1.5" fill="rgba(255,255,255,0.4)" />
                {/* Team labels */}
                <text x="50" y="11" textAnchor="middle" fontSize="2.5" fill="rgba(255,255,255,0.3)" fontFamily="monospace">{MATCH.home.code}</text>
                <text x="50" y="57" textAnchor="middle" fontSize="2.5" fill="rgba(255,255,255,0.3)" fontFamily="monospace">{MATCH.away.code}</text>
              </svg>
              {/* Shot dots */}
              {MATCH.events.map((ev, i) => (
                <ShotDot key={i} event={ev} />
              ))}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 text-xs font-mono text-chalk-400">
            {[["#00e676","Goal"],["#ffb300","Save"],["#ef5350","Miss"]].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{background: c}} />
                {l}
              </span>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="fade-up fade-up-3">
          <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">TIMELINE</h2>
          <div className="bg-pitch-900/40 rounded-lg border border-chalk-100/8 p-3 max-h-96 overflow-y-auto space-y-1">
            {MATCH.events.map((ev, i) => {
              const icon =
                ev.type === "GOAL"        ? "⚽" :
                ev.type === "SAVE"        ? "🧤" :
                ev.type === "MISS"        ? "✕" :
                ev.type === "YELLOW CARD" ? "🟨" :
                ev.type === "RED CARD"    ? "🟥" : "·";
              const color =
                ev.type === "GOAL"        ? "text-grass-400" :
                ev.type === "SAVE"        ? "text-amber-400" :
                ev.type === "YELLOW CARD" ? "text-yellow-400" :
                ev.type === "RED CARD"    ? "text-red-400" :
                "text-chalk-400";
              return (
                <div key={i} className="flex items-start gap-2 text-xs py-1">
                  <span className="font-mono text-chalk-400/50 w-6 shrink-0 text-right">{ev.min}&apos;</span>
                  <span>{icon}</span>
                  <div>
                    <span className={`font-medium font-body ${color}`}>{ev.player}</span>
                    {"by" in ev && (
                      <span className="text-chalk-400"> · ast. {(ev as any).by}</span>
                    )}
                    <div className="text-chalk-400/40">{ev.team === "pZ" ? MATCH.home.code : MATCH.away.code}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Player stats table */}
      <div className="mt-6 fade-up fade-up-4">
        <h2 className="font-display font-700 text-base tracking-wider text-chalk-100 mb-3">PLAYER STATISTICS</h2>
        <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-chalk-100/8">
                {["TEAM","PLAYER","POS","G","SHOTS","OT","AST","PASS","CMPL","PASS%","INT","POSS","xG"].map(h => (
                  <th key={h} className="px-3 py-2 font-mono text-chalk-400 text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...homeStats, { team: "—", name: "", pos: "", goals: null, shots: 0, shotsOT: 0, assists: 0, passes: 0, completed: 0, pct: "", ints: 0, poss: "", xg: 0 }, ...awayStats].map((p, i) => {
                if (!p.name) return (
                  <tr key={i}><td colSpan={13} className="border-t border-chalk-100/8 py-1" /></tr>
                );
                return (
                  <tr key={p.name} className="stat-row">
                    <td className="px-3 py-2 font-mono text-chalk-400">{p.team}</td>
                    <td className="px-3 py-2">
                      <Link href={`/players/${p.name}`} className="font-body font-medium text-chalk-100 hover:text-grass-400 transition-colors">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-chalk-400 text-right">{p.pos}</td>
                    <td className={`px-3 py-2 font-mono text-right font-medium ${p.goals ? "text-grass-400" : "text-chalk-400"}`}>{p.goals}</td>
                    <td className="px-3 py-2 font-mono text-chalk-300 text-right">{p.shots}</td>
                    <td className="px-3 py-2 font-mono text-chalk-300 text-right">{p.shotsOT}</td>
                    <td className="px-3 py-2 font-mono text-chalk-300 text-right">{p.assists}</td>
                    <td className="px-3 py-2 font-mono text-chalk-300 text-right">{p.passes}</td>
                    <td className="px-3 py-2 font-mono text-chalk-300 text-right">{p.completed}</td>
                    <td className="px-3 py-2 font-mono text-chalk-300 text-right">{p.pct}</td>
                    <td className="px-3 py-2 font-mono text-chalk-300 text-right">{p.ints}</td>
                    <td className="px-3 py-2 font-mono text-chalk-300 text-right">{p.poss}</td>
                    <td className={`px-3 py-2 font-mono text-right ${p.xg > 0 ? "text-grass-500/80" : "text-chalk-400"}`}>{p.xg > 0 ? p.xg.toFixed(2) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
