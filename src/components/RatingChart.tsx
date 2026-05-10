"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Customized,
} from "recharts";

type Point = { date: string; rating: number };

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function segColor(a: number, b: number) {
  return b > a ? "#22c55e" : b < a ? "#ef4444" : "#eab308";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { date, rating } = payload[0].payload as Point;
  return (
    <div className="rounded-md border border-chalk-100/10 bg-pitch-900 px-3 py-2 text-xs font-mono shadow-lg">
      <div className="text-chalk-400">{fmtDate(date)}</div>
      <div className="font-700 text-sm" style={{ color: "#F4119E" }}>{rating.toFixed(2)}</div>
    </div>
  );
}

function SegmentLines({ points, xAxisMap, yAxisMap }: any) {
  const xAxis = xAxisMap && Object.values(xAxisMap)[0] as any;
  const yAxis = yAxisMap && Object.values(yAxisMap)[0] as any;
  const xScale = xAxis?.scale;
  const yScale = yAxis?.scale;
  if (!xScale || !yScale) return null;

  const firstColor = segColor(points[0].rating, points[1].rating);
  const lastColor  = segColor(points[points.length - 2].rating, points[points.length - 1].rating);

  return (
    <g>
      {points.slice(0, -1).map((p: Point, i: number) => {
        const next = points[i + 1];
        const color = segColor(p.rating, next.rating);
        const x1 = xScale(p.date);
        const y1 = yScale(p.rating);
        const x2 = xScale(next.date);
        const y2 = yScale(next.rating);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} />;
      })}

      <circle cx={xScale(points[0].date)} cy={yScale(points[0].rating)} r={4} fill={firstColor} />
      <text
        x={xScale(points[0].date) + 6}
        y={yScale(points[0].rating) - 6}
        fill={firstColor}
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
        textAnchor="start"
      >
        {points[0].rating.toFixed(2)}
      </text>

      <circle cx={xScale(points[points.length - 1].date)} cy={yScale(points[points.length - 1].rating)} r={4} fill={lastColor} />
      <text
        x={xScale(points[points.length - 1].date) - 6}
        y={yScale(points[points.length - 1].rating) - 6}
        fill={lastColor}
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
        textAnchor="end"
      >
        {points[points.length - 1].rating.toFixed(2)}
      </text>

      {points.slice(1, -1).map((p: Point, i: number) => (
        <circle key={i} cx={xScale(p.date)} cy={yScale(p.rating)} r={3} fill={segColor(points[i].rating, p.rating)} />
      ))}
    </g>
  );
}

type RangeOption = "last6" | "all" | number;

export default function RatingChart({ points }: { points: Point[] }) {
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const p of points) {
      const y = new Date(p.date).getUTCFullYear();
      if (Number.isFinite(y)) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [points]);

  const [selectedRange, setSelectedRange] = useState<RangeOption>("last6");

  const filtered = useMemo(() => {
    if (selectedRange === "last6") {
      if (points.length === 0) return points;
      const latest = new Date(points[points.length - 1].date).getTime();
      const cutoff = latest - 365 * 24 * 60 * 60 * 1000;
      return points.filter((p) => new Date(p.date).getTime() >= cutoff);
    }
    if (selectedRange === "all") return points;
    return points.filter((p) => new Date(p.date).getUTCFullYear() === selectedRange);
  }, [points, selectedRange]);

  if (points.length === 0) return null;

  if (filtered.length === 0) {
    return (
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-3">
          <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase">
            Rating
          </h3>
          <RangeSelect
            value={selectedRange}
            years={availableYears}
            onChange={setSelectedRange}
          />
        </div>
        <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-4 text-xs font-mono text-chalk-400">
          No rating data for {selectedRange === "last6" || selectedRange === "all" ? "this range" : selectedRange}.
        </div>
      </div>
    );
  }

  const ratings = filtered.map((p) => p.rating);
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  const current = filtered[filtered.length - 1].rating;
  const previous = filtered.length > 1 ? filtered[filtered.length - 2].rating : current;
  const delta = current - previous;
  const peak = Math.max(...ratings);
  const padding = Math.max((maxR - minR) * 0.2, 0.1);
  const domainMin = Math.max(0, minR - padding);
  const domainMax = maxR + padding;
  const lastSegColor = segColor(filtered[filtered.length - 2]?.rating ?? current, current);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-baseline gap-3 mb-3">
        <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase">
          Rating
        </h3>
        <span className="font-display text-2xl font-800 text-chalk-100">{current.toFixed(2)}</span>
        {filtered.length > 1 && (
          <span className={`text-xs font-mono ${delta > 0 ? "text-grass-400" : delta < 0 ? "text-red-400" : "text-yellow-400"}`}>
            {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
          </span>
        )}
        {filtered.length > 1 && (
          <span className="peak-gold text-xs font-mono font-700 ml-2">
            [peak {peak.toFixed(2)}]
          </span>
        )}
        <div className="ml-auto">
          <RangeSelect
            value={selectedRange}
            years={availableYears}
            onChange={setSelectedRange}
          />
        </div>
      </div>

      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-4">
        {filtered.length === 1 ? (
          <div className="text-xs font-mono text-chalk-400 py-2">
            Only one snapshot in this range — chart needs at least two points.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={filtered} margin={{ top: 14, right: 14, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${String(d.getUTCMonth() + 1).padStart(2,"0")}/${d.getUTCFullYear()}`;
                }}
                tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[domainMin, domainMax]}
                tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                width={32}
                tickFormatter={(v) => v.toFixed(1)}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={current} stroke={lastSegColor} strokeDasharray="3 3" strokeOpacity={0.3} />
              <Line type="linear" dataKey="rating" stroke="transparent" dot={false} activeDot={false} isAnimationActive={false} />
              <Customized component={(props: any) => <SegmentLines {...props} points={filtered} />} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function RangeSelect({
  value,
  years,
  onChange,
}: {
  value: RangeOption;
  years: number[];
  onChange: (v: RangeOption) => void;
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "last6" || v === "all") onChange(v);
        else onChange(Number(v));
      }}
      className="bg-pitch-900 border border-chalk-100/15 rounded px-2 py-1 text-xs font-mono text-chalk-100 hover:border-[#F4119E]/40 focus:border-[#F4119E]/60 focus:outline-none cursor-pointer"
    >
      <option value="last6">Recent</option>
      <option value="all">All</option>
      {years.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
