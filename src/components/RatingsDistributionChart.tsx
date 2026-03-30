"use client";

import { useState, useRef, useMemo, useCallback, memo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

type Player = { steam_id: string; username: string; rating: number; percentile?: number };
type PlayerWithMeta = Player & { color: string };
type Point = PlayerWithMeta & { x: number; y: number };
type DisplayInfo = PlayerWithMeta | null;

const BIN_SIZE = 0.1;
const DOT_R = 3;
const DOT_SPACING = 3;

function getBin(r: number) {
  return Math.round(r / BIN_SIZE) * BIN_SIZE;
}

const COLOR_STOPS: [number, number, number][] = [
  [239, 68,  68 ],
  [249, 115, 22 ],
  [234, 179, 8  ],
  [134, 239, 172],
  [21,  128, 61 ],
];

function ratingColor(rating: number, min: number, max: number): string {
  const t = max === min ? 0.5 : (rating - min) / (max - min);
  const seg = t * (COLOR_STOPS.length - 1);
  const i = Math.min(Math.floor(seg), COLOR_STOPS.length - 2);
  const s = seg - i;
  const [r1, g1, b1] = COLOR_STOPS[i];
  const [r2, g2, b2] = COLOR_STOPS[i + 1];
  return `rgb(${Math.round(r1+(r2-r1)*s)},${Math.round(g1+(g2-g1)*s)},${Math.round(b1+(b2-b1)*s)})`;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { username, rating, percentile, color } = payload[0].payload as Point;
  return (
    <div className="rounded-md border border-chalk-100/10 bg-pitch-900 px-3 py-2 text-xs font-mono shadow-lg pointer-events-none">
      <div className="text-chalk-200 font-600 mb-1">{username}</div>
      <div className="flex items-center gap-3">
        <span className="font-700 text-sm" style={{ color }}>{rating.toFixed(2)}</span>
        <span className="text-chalk-400">P{percentile}</span>
      </div>
    </div>
  );
}

// ── Static chart — only re-renders when `data` changes, never on selection ──
const StaticChart = memo(function StaticChart({
  data, min, max, mean, xPad, maxY, binsArray, containerRef,
}: {
  data: Point[];
  min: number; max: number; mean: number; xPad: number; maxY: number;
  binsArray: [number, PlayerWithMeta[]][];
}) {
  return (
    <ResponsiveContainer width="100%" height={580}>
      <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
        <XAxis
          type="number"
          dataKey="x"
          domain={[min - xPad, max + xPad]}
          tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "monospace" }}
          tickLine={false}
          axisLine={{ stroke: "#ffffff10" }}
          tickFormatter={(v) => v.toFixed(1)}
          ticks={binsArray.map(([bin]) => bin)}
        />
        <YAxis
          type="number"
          dataKey="y"
          domain={[0, maxY + DOT_SPACING]}
          tick={false}
          tickLine={false}
          axisLine={false}
          width={4}
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <ReferenceLine
          x={mean}
          stroke="#ffffff"
          strokeDasharray="4 4"
          strokeOpacity={0.2}
          label={{ value: `avg ${mean.toFixed(2)}`, fontSize: 9, fill: "#9ca3af", fontFamily: "monospace", position: "top" }}
        />
        <Scatter
          data={data}
          isAnimationActive={false}
          shape={(props: any) => {
            const { cx, cy, payload } = props;
            return (
              <circle
                data-dot-id={payload.steam_id}
                cx={cx} cy={cy}
                r={DOT_R}
                fill={payload.color}
                opacity={0.8}
                style={{ transition: "r 0.05s, opacity 0.05s" }}
              />
            );
          }}
          activeShape={(props: any) => {
            const { cx, cy, payload } = props;
            return <circle cx={cx} cy={cy} r={DOT_R + 2} fill={payload.color} opacity={1} stroke="#fff" strokeWidth={1.5} />;
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
});

export default function RatingsDistributionChart({ players }: { players: Player[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSteamIdRef = useRef<string | null>(null);
  const prevSearchIdsRef = useRef<string[]>([]);
  const selBinRef = useRef(0);
  const selIdxRef = useRef(0);
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { binsArray, data, min, max, mean } = useMemo(() => {
    if (!players.length) return { binsArray: [] as [number, PlayerWithMeta[]][], data: [] as Point[], min: 0, max: 0, mean: 0 };

    const ratings = players.map((p) => p.rating);
    const minR = Math.min(...ratings);
    const maxR = Math.max(...ratings);
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    const sorted = [...players].sort((a, b) => a.rating - b.rating);
    const n = sorted.length;
    const withMeta: PlayerWithMeta[] = sorted.map((p, i) => ({
      ...p,
      percentile: Math.round(((i + 1) / n) * 100),
      color: ratingColor(p.rating, minR, maxR),
    }));

    const binMap = new Map<number, PlayerWithMeta[]>();
    for (const p of withMeta) {
      const bin = getBin(p.rating);
      if (!binMap.has(bin)) binMap.set(bin, []);
      binMap.get(bin)!.push(p);
    }
    const binsArray = Array.from(binMap.entries()).sort((a, b) => a[0] - b[0]);
    const data: Point[] = [];
    for (const [, group] of binsArray) {
      group.forEach((p, i) => {
        data.push({ ...p, x: p.rating, y: (i + 1) * DOT_SPACING });
      });
    }
    return { binsArray, data, min: minR, max: maxR, mean };
  }, [players]);

  const highlightDot = useCallback((steamId: string | null) => {
    if (!containerRef.current) return;
    // Remove previous highlight
    if (prevSteamIdRef.current) {
      const el = containerRef.current.querySelector<SVGCircleElement>(`[data-dot-id="${prevSteamIdRef.current}"]`);
      if (el) { el.setAttribute("r", String(DOT_R)); el.setAttribute("opacity", "0.8"); el.removeAttribute("stroke"); el.removeAttribute("stroke-width"); }
    }
    // Apply new highlight
    if (steamId) {
      const el = containerRef.current.querySelector<SVGCircleElement>(`[data-dot-id="${steamId}"]`);
      if (el) { el.setAttribute("r", String(DOT_R + 2)); el.setAttribute("opacity", "1"); el.setAttribute("stroke", "#fff"); el.setAttribute("stroke-width", "1.5"); }
    }
    prevSteamIdRef.current = steamId;
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!containerRef.current) return;

    // Clear previous search highlights
    for (const id of prevSearchIdsRef.current) {
      const el = containerRef.current.querySelector<SVGCircleElement>(`[data-dot-id="${id}"]`);
      if (el) { el.setAttribute("r", String(DOT_R)); el.setAttribute("opacity", "0.8"); el.removeAttribute("stroke"); el.removeAttribute("stroke-width"); el.style.filter = ""; }
    }
    prevSearchIdsRef.current = [];

    if (!query.trim()) { setDisplayInfo(null); return; }

    const q = query.toLowerCase();
    const matches = data.filter((p) => p.username.toLowerCase().includes(q));

    for (const player of matches) {
      const el = containerRef.current.querySelector<SVGCircleElement>(`[data-dot-id="${player.steam_id}"]`);
      if (el) {
        el.setAttribute("r", String(DOT_R + 2));
        el.setAttribute("opacity", "1");
        el.setAttribute("stroke", "#fff");
        el.setAttribute("stroke-width", "1.5");
        el.style.filter = `drop-shadow(0 0 5px ${player.color})`;
        prevSearchIdsRef.current.push(player.steam_id);
      }
    }

    const exact = data.find((p) => p.username.toLowerCase() === q) ?? matches[0] ?? null;
    setDisplayInfo(exact);
  }, [data]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) return;
    e.preventDefault();

    let bin = selBinRef.current;
    let idx = selIdxRef.current;

    if (e.key === "ArrowRight") { bin = Math.min(bin + 1, binsArray.length - 1); idx = 0; }
    else if (e.key === "ArrowLeft") { bin = Math.max(bin - 1, 0); idx = 0; }
    else if (e.key === "ArrowUp") { idx = Math.min(idx + 1, (binsArray[bin]?.[1].length ?? 1) - 1); }
    else if (e.key === "ArrowDown") { idx = Math.max(idx - 1, 0); }

    selBinRef.current = bin;
    selIdxRef.current = idx;

    const player = binsArray[bin]?.[1]?.[idx] ?? null;
    highlightDot(player?.steam_id ?? null);
    setDisplayInfo(player); // only this triggers React re-render (lightweight card)
  }, [binsArray, highlightDot]);

  const xPad = (max - min) * 0.04;
  const maxY = data.length > 0 ? Math.max(...data.map((d) => d.y)) : 1;

  if (!players.length) return null;

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-4 outline-none focus-visible:ring-1 focus-visible:ring-chalk-100/20"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Controls row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 text-[10px] font-mono text-chalk-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-chalk-100/20 text-chalk-300 text-[10px] leading-tight">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-chalk-100/20 text-chalk-300 text-[10px] leading-tight">→</kbd>
            <span className="ml-0.5">rating</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-chalk-100/20 text-chalk-300 text-[10px] leading-tight">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-chalk-100/20 text-chalk-300 text-[10px] leading-tight">↓</kbd>
            <span className="ml-0.5">player</span>
          </span>
          <input
            type="text"
            placeholder="search player..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="ml-2 bg-pitch-800 border border-chalk-100/10 rounded px-2 py-0.5 text-[10px] font-mono text-chalk-200 placeholder-chalk-500 focus:outline-none focus:border-[#F4119E]/40 w-36"
          />
        </div>

        {displayInfo && (
          <div className="rounded-md border border-[#F4119E]/50 bg-[#F4119E]/5 px-3 py-2 text-right font-mono text-xs shadow-[0_0_12px_rgba(244,17,158,0.15)]">
            <div className="text-chalk-100 font-600 mb-1">{displayInfo.username}</div>
            <div className="flex items-center justify-end gap-2">
              <span style={{ color: displayInfo.color }} className="font-700 text-sm">
                {displayInfo.rating.toFixed(2)}
              </span>
              <span className="text-chalk-400 text-[10px]">
                top {Math.max(1, 100 - (displayInfo.percentile ?? 100))}% rating
              </span>
            </div>
          </div>
        )}
      </div>

      <StaticChart
        data={data} min={min} max={max} mean={mean}
        xPad={xPad} maxY={maxY} binsArray={binsArray}
      />
    </div>
  );
}
