"use client";

import { useState, useRef, useMemo, useCallback, memo, useEffect } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Area, ComposedChart, Line,
} from "recharts";

type Player = { steam_id: string; username: string; rating: number; percentile?: number };
type PlayerWithMeta = Player & { color: string };
type Point = PlayerWithMeta & { x: number; y: number };
type DisplayInfo = PlayerWithMeta | null;

const BIN_SIZE = 0.1;
const DOT_R = 3;
const DOT_SPACING = 3;
const ZOOM_FACTOR = 0.15;
const CHART_MARGIN = { top: 16, right: 24, left: 0, bottom: 8 };
const Y_AXIS_WIDTH = 4;

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
  const t = Math.max(0, Math.min(1, max === min ? 0.5 : (rating - min) / (max - min)));
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

// ── Static chart — only re-renders when data or committed zoom changes ──
const StaticChart = memo(function StaticChart({
  data, min, max, mean, xPad, binsArray, xDomain, visibleMaxY,
}: {
  data: Point[];
  min: number; max: number; mean: number; xPad: number;
  binsArray: [number, PlayerWithMeta[]][];
  xDomain: [number, number] | null;
  visibleMaxY: number;
}) {
  const domainX = xDomain ?? [min - xPad, max + xPad];

  const visibleTicks = binsArray
    .map(([bin]) => bin)
    .filter((t) => t >= domainX[0] && t <= domainX[1]);

  return (
    <ResponsiveContainer width="100%" height={580}>
      <ScatterChart margin={CHART_MARGIN}>
        <XAxis
          type="number"
          dataKey="x"
          domain={domainX}
          tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "monospace" }}
          tickLine={false}
          axisLine={{ stroke: "#ffffff10" }}
          tickFormatter={(v) => v.toFixed(1)}
          ticks={visibleTicks}
          allowDataOverflow
        />
        <YAxis
          type="number"
          dataKey="y"
          domain={[0, visibleMaxY + DOT_SPACING]}
          tick={false}
          tickLine={false}
          axisLine={false}
          width={Y_AXIS_WIDTH}
          allowDataOverflow
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

// ── Normal distribution PDF ──
function normalPdf(x: number, mean: number, stdDev: number): number {
  const exp = -0.5 * ((x - mean) / stdDev) ** 2;
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.E ** exp;
}

// ── Histogram with normal curve overlay (separate card) ──
const HIST_BIN = 0.5; // wider bins for cleaner histogram

export const NormalDistributionChart = memo(function NormalDistributionChart({
  binsArray, mean, min, max, xPad, totalPlayers,
}: {
  binsArray: [number, PlayerWithMeta[]][];
  mean: number; min: number; max: number; xPad: number;
  totalPlayers: number;
}) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { chartData, stdDev, maxVal, histTicks, lo, hi, percentileLines } = useMemo(() => {
    const ratings = binsArray.flatMap(([, group]) => group.map((p) => p.rating));
    const stdDev = Math.sqrt(ratings.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratings.length);

    // Build histogram with wider bins (0.5)
    const histMap = new Map<number, number>();
    for (const r of ratings) {
      const bin = Math.round(r / HIST_BIN) * HIST_BIN;
      histMap.set(bin, (histMap.get(bin) ?? 0) + 1);
    }

    const histBins = Array.from(histMap.keys()).sort((a, b) => a - b);

    // Domain with small padding so edge bars don't clip
    const lo = histBins[0] - HIST_BIN * 0.4;
    const hi = histBins[histBins.length - 1] + HIST_BIN * 0.4;

    // Single merged dataset: curve points + histogram bin centers
    const binSet = new Set(histBins.map((b) => Number(b.toFixed(1))));
    const chartData: { x: number; count: number | null; normal: number }[] = [];

    // Add all curve points (count = null so Bar ignores them)
    for (let x = lo; x <= hi; x = Number((x + 0.05).toFixed(2))) {
      const rounded = Number(x.toFixed(1));
      const isHist = binSet.has(rounded) && Math.abs(x - rounded) < 0.001;
      chartData.push({
        x: Number(x.toFixed(2)),
        count: isHist ? (histMap.get(rounded) ?? 0) : null,
        normal: normalPdf(x, mean, stdDev) * totalPlayers * HIST_BIN,
      });
    }

    // Ensure every histogram bin is present
    for (const bin of histBins) {
      if (!chartData.find((d) => Math.abs(d.x - bin) < 0.001 && d.count !== null)) {
        chartData.push({
          x: bin,
          count: histMap.get(bin) ?? 0,
          normal: normalPdf(bin, mean, stdDev) * totalPlayers * HIST_BIN,
        });
      }
    }

    chartData.sort((a, b) => a.x - b.x);

    const maxVal = Math.max(...chartData.map((d) => Math.max(d.count ?? 0, d.normal)));

    // Percentile lines with colors based on rating position
    const pLines = [
      { x: mean - 2 * stdDev, label: "2.5%", opacity: 0.06 },
      { x: mean - stdDev,     label: "16%",  opacity: 0.1 },
      { x: mean,              label: "50%",  opacity: 0.2 },
      { x: mean + stdDev,     label: "84%",  opacity: 0.1 },
      { x: mean + 2 * stdDev, label: "97.5%", opacity: 0.06 },
    ]
      .filter((p) => p.x >= lo && p.x <= hi)
      .map((p) => ({ ...p, color: ratingColor(p.x, min, max) }));

    return { chartData, stdDev, maxVal, histTicks: histBins, lo, hi, percentileLines: pLines };
  }, [binsArray, mean, min, max, xPad, totalPlayers]);

  // On mobile, only show 50% (mean) line to avoid overlap
  const visiblePercentiles = isMobile
    ? percentileLines.filter((p) => p.label === "50%")
    : percentileLines;

  return (
    <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-3 sm:p-4">
      <div className="mb-3">
        <h3 className="text-xs sm:text-sm font-mono font-600 text-chalk-300 uppercase tracking-wider">Normal Distribution</h3>
        <p className="text-[10px] sm:text-xs font-mono text-chalk-500 mt-1 leading-relaxed">
          mean {mean.toFixed(2)} · std dev {stdDev.toFixed(2)} · {totalPlayers} players
          <br className="sm:hidden" />
          <span className="hidden sm:inline"> · </span>
          68% between {(mean - stdDev).toFixed(1)}–{(mean + stdDev).toFixed(1)}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 280 : 400}>
        <ComposedChart data={chartData} margin={isMobile ? { top: 16, right: 8, left: -8, bottom: 4 } : { top: 24, right: 24, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="normalFillGrad" x1="0" y1="0" x2="1" y2="0">
              {COLOR_STOPS.map((c, i) => (
                <stop key={i} offset={`${(i / (COLOR_STOPS.length - 1)) * 100}%`}
                  stopColor={`rgb(${c[0]},${c[1]},${c[2]})`} stopOpacity={0.12} />
              ))}
            </linearGradient>
            <linearGradient id="normalStrokeGrad" x1="0" y1="0" x2="1" y2="0">
              {COLOR_STOPS.map((c, i) => (
                <stop key={i} offset={`${(i / (COLOR_STOPS.length - 1)) * 100}%`}
                  stopColor={`rgb(${c[0]},${c[1]},${c[2]})`} stopOpacity={0.9} />
              ))}
            </linearGradient>
          </defs>
          <XAxis
            dataKey="x"
            type="number"
            domain={[lo, hi]}
            tick={{ fontSize: isMobile ? 9 : 11, fill: "#9ca3af", fontFamily: "monospace" }}
            tickLine={false}
            axisLine={{ stroke: "#ffffff10" }}
            tickFormatter={(v: number) => v.toFixed(1)}
            ticks={isMobile ? histTicks.filter((_, i) => i % 2 === 0) : histTicks}
            allowDuplicatedCategory={false}
          />
          <YAxis
            domain={[0, Math.ceil(maxVal * 1.15)]}
            tick={{ fontSize: isMobile ? 9 : 11, fill: "#9ca3af", fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            width={isMobile ? 28 : 36}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload;
              if (!d || d.count == null) return null;
              const color = ratingColor(d.x, min, max);
              return (
                <div className="rounded-md border border-chalk-100/10 bg-pitch-900 px-3 py-2 text-sm font-mono shadow-lg">
                  <div className="text-chalk-300">Rating {(d.x - HIST_BIN / 2).toFixed(1)} – {(d.x + HIST_BIN / 2).toFixed(1)}</div>
                  <div className="font-600" style={{ color }}>{d.count} players</div>
                </div>
              );
            }}
            cursor={false}
          />
          {visiblePercentiles.map((p) => (
            <ReferenceLine key={p.label} x={p.x} stroke={p.color} strokeDasharray="3 3" strokeOpacity={p.opacity + 0.2}
              label={isMobile
                ? { value: p.x.toFixed(1), fontSize: 9, fill: p.color, fontFamily: "monospace", position: "insideTopLeft", offset: 4 }
                : { value: `${p.label} · ${p.x.toFixed(1)}`, fontSize: 11, fill: p.color, fontFamily: "monospace", position: "insideTopLeft", offset: 6 }
              } />
          ))}
          <Bar dataKey="count" isAnimationActive={false}
            barSize={isMobile ? Math.max(10, 300 / histTicks.length) : Math.max(14, 700 / histTicks.length)}
            shape={(props: any) => {
              const { x, y, width, height, payload } = props;
              if (!payload) return <rect />;
              const color = ratingColor(payload.x, min, max);
              return <rect x={x} y={y} width={width} height={height} fill={color} opacity={0.4} rx={2} />;
            }}
          />
          <Area dataKey="normal" type="monotone" stroke="none" fill="url(#normalFillGrad)" isAnimationActive={false} />
          <Line dataKey="normal" type="monotone" stroke="url(#normalStrokeGrad)" strokeWidth={isMobile ? 2 : 2.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Mobile percentile legend */}
      {isMobile && percentileLines.length > 1 && (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 text-[9px] font-mono">
          {percentileLines.map((p) => (
            <span key={p.label} style={{ color: p.color }}>
              {p.label} · {p.x.toFixed(1)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

export default function RatingsDistributionChart({ players }: { players: Player[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const prevSteamIdRef = useRef<string | null>(null);
  const prevSearchIdsRef = useRef<string[]>([]);
  const selBinRef = useRef(0);
  const selIdxRef = useRef(0);
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Zoom state — only committed values trigger Recharts re-render
  const [xDomain, setXDomain] = useState<[number, number] | null>(null);
  const xDomainRef = useRef<[number, number] | null>(null);
  const rafRef = useRef<number>(0);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

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
    if (prevSteamIdRef.current) {
      const el = containerRef.current.querySelector<SVGCircleElement>(`[data-dot-id="${prevSteamIdRef.current}"]`);
      if (el) { el.setAttribute("r", String(DOT_R)); el.setAttribute("opacity", "0.8"); el.removeAttribute("stroke"); el.removeAttribute("stroke-width"); }
    }
    if (steamId) {
      const el = containerRef.current.querySelector<SVGCircleElement>(`[data-dot-id="${steamId}"]`);
      if (el) { el.setAttribute("r", String(DOT_R + 2)); el.setAttribute("opacity", "1"); el.setAttribute("stroke", "#fff"); el.setAttribute("stroke-width", "1.5"); }
    }
    prevSteamIdRef.current = steamId;
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!containerRef.current) return;

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
    setDisplayInfo(player);
  }, [binsArray, highlightDot]);

  const xPad = (max - min) * 0.04;
  const fullMaxY = data.length > 0 ? Math.max(...data.map((d) => d.y)) : 1;

  const visibleMaxY = useMemo(() => {
    if (!xDomain) return fullMaxY;
    const [lo, hi] = xDomain;
    let m = 1;
    for (const d of data) {
      if (d.x >= lo && d.x <= hi && d.y > m) m = d.y;
    }
    return m;
  }, [xDomain, data, fullMaxY]);

  // ── Zoom via scroll — commits to React state via rAF (1 render per frame max) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const absMin = min - xPad;
    const absMax = max + xPad;
    const fullRange = absMax - absMin;

    function commitDomain(d: [number, number] | null) {
      xDomainRef.current = d;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setXDomain(d));
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();

      const cur = xDomainRef.current;
      const curMin = cur ? cur[0] : absMin;
      const curMax = cur ? cur[1] : absMax;
      const range = curMax - curMin;

      // Shift+scroll → pan horizontally
      if (e.shiftKey && cur) {
        const panAmount = range * 0.1 * (e.deltaY > 0 ? 1 : -1);
        let nMin = curMin + panAmount;
        let nMax = curMax + panAmount;
        if (nMin < absMin) { nMax += absMin - nMin; nMin = absMin; }
        if (nMax > absMax) { nMin -= nMax - absMax; nMax = absMax; }
        commitDomain([nMin, nMax]);
        return;
      }

      // Normal scroll → zoom
      const rect = el!.getBoundingClientRect();
      const chartLeft = rect.left + CHART_MARGIN.left + Y_AXIS_WIDTH;
      const chartRight = rect.right - CHART_MARGIN.right;
      const mouseX = Math.max(0, Math.min(1, (e.clientX - chartLeft) / (chartRight - chartLeft)));

      const direction = e.deltaY > 0 ? 1 : -1;
      const delta = range * ZOOM_FACTOR * direction;

      let nMin = curMin - delta * mouseX;
      let nMax = curMax + delta * (1 - mouseX);

      if (nMax - nMin >= fullRange) { commitDomain(null); return; }
      if (nMax - nMin < BIN_SIZE * 2) return;

      if (nMin < absMin) { nMax += absMin - nMin; nMin = absMin; }
      if (nMax > absMax) { nMin -= nMax - absMax; nMax = absMax; }
      nMin = Math.max(nMin, absMin);
      nMax = Math.min(nMax, absMax);

      commitDomain([nMin, nMax]);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(rafRef.current);
    };
  }, [min, max, xPad]);

  // ── Drag-to-pan — CSS transform during drag, single Recharts commit on release ──
  useEffect(() => {
    const el = containerRef.current;
    const wrap = chartWrapRef.current;
    if (!el || !wrap) return;

    function onMouseDown(e: MouseEvent) {
      if (!xDomainRef.current) return;
      if ((e.target as HTMLElement).closest("input, button")) return;
      e.preventDefault();
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      el!.style.cursor = "grabbing";
    }

    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      e.preventDefault();
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      // Pure CSS translate — zero React renders
      wrap!.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    function onMouseUp(e: MouseEvent) {
      if (!isDragging.current) return;
      isDragging.current = false;
      el!.style.cursor = "";

      // Reset CSS transform
      wrap!.style.transform = "";

      const cur = xDomainRef.current;
      if (!cur) return;

      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

      const rect = el!.getBoundingClientRect();
      const chartWidth = rect.width - CHART_MARGIN.left - CHART_MARGIN.right - Y_AXIS_WIDTH;
      const xRange = cur[1] - cur[0];
      const xShift = -(dx / chartWidth) * xRange;

      const absMin = min - xPad;
      const absMax = max + xPad;

      let nMin = cur[0] + xShift;
      let nMax = cur[1] + xShift;
      if (nMin < absMin) { nMax += absMin - nMin; nMin = absMin; }
      if (nMax > absMax) { nMin -= nMax - absMax; nMax = absMax; }

      xDomainRef.current = [nMin, nMax];
      setXDomain([nMin, nMax]);
    }

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [min, max, xPad]);

  if (!players.length) return null;

  xDomainRef.current = xDomain;
  const isZoomed = xDomain !== null;

  return (
    <>
    <div
      ref={containerRef}
      className={`rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-4 outline-none focus-visible:ring-1 focus-visible:ring-chalk-100/20 ${isZoomed ? "cursor-grab active:cursor-grabbing" : ""}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-start sm:justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] font-mono text-chalk-500">
          <span className="hidden sm:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-chalk-100/20 text-chalk-300 text-[10px] leading-tight">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-chalk-100/20 text-chalk-300 text-[10px] leading-tight">→</kbd>
            <span className="ml-0.5">rating</span>
          </span>
          <span className="hidden sm:flex items-center gap-1">
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
            className="bg-pitch-800 border border-chalk-100/10 rounded px-2 py-0.5 text-[10px] font-mono text-chalk-200 placeholder-chalk-500 focus:outline-none focus:border-[#F4119E]/40 w-36"
          />
        </div>

        {displayInfo && (
          <div className="rounded-md border border-[#F4119E]/50 bg-[#F4119E]/5 px-3 py-2 text-right font-mono text-xs shadow-[0_0_12px_rgba(244,17,158,0.15)] w-full sm:w-auto max-w-full overflow-hidden">
            <div className="text-chalk-100 font-600 mb-1 truncate">{displayInfo.username}</div>
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

      {isZoomed && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => { setXDomain(null); xDomainRef.current = null; }}
            className="text-[10px] font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/20 rounded px-2 py-0.5 transition-colors"
          >
            reset zoom
          </button>
        </div>
      )}

      <div ref={chartWrapRef} style={{ willChange: "transform" }}>
        <StaticChart
          data={data} min={min} max={max} mean={mean}
          xPad={xPad} binsArray={binsArray}
          xDomain={xDomain} visibleMaxY={visibleMaxY}
        />
      </div>

    </div>

    <div className="mt-4">
      <NormalDistributionChart
        binsArray={binsArray} mean={mean}
        min={min} max={max} xPad={xPad}
        totalPlayers={players.length}
      />
    </div>
    </>
  );
}
