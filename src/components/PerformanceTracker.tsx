"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

/* ── types ── */
export type TrackerDataPoint = {
  label: string;
  wins: number;
  draws: number;
  losses: number;
  avgGoals: number;
  avgAssists: number;
  avgGoalsConceded: number;
  cleanSheets: number;
  potm: number;
  appearances: number;
};

type MetricDef = {
  key: string;
  label: string;
  lines: { dataKey: string; name: string; color: string }[];
};

const PLAYER_METRICS: MetricDef[] = [
  {
    key: "outcomes",
    label: "Match Outcomes",
    lines: [
      { dataKey: "wins", name: "Wins", color: "#22c55e" },
      { dataKey: "draws", name: "Draws", color: "#6b7280" },
      { dataKey: "losses", name: "Losses", color: "#ef4444" },
    ],
  },
  {
    key: "avgGoals",
    label: "Average Goals",
    lines: [{ dataKey: "avgGoals", name: "Goals/App", color: "#F4119E" }],
  },
  {
    key: "avgAssists",
    label: "Average Assists",
    lines: [{ dataKey: "avgAssists", name: "Assists/App", color: "#F4119E" }],
  },
  {
    key: "avgGoalsConceded",
    label: "Average Goals Conceded",
    lines: [{ dataKey: "avgGoalsConceded", name: "GC/App", color: "#F4119E" }],
  },
  {
    key: "cleanSheets",
    label: "Clean Sheets",
    lines: [{ dataKey: "cleanSheets", name: "Clean Sheets", color: "#F4119E" }],
  },
  {
    key: "potm",
    label: "POTM",
    lines: [{ dataKey: "potm", name: "POTM", color: "#F4119E" }],
  },
  {
    key: "appearances",
    label: "Appearances",
    lines: [{ dataKey: "appearances", name: "Apps", color: "#F4119E" }],
  },
];

const TEAM_METRICS: MetricDef[] = [
  {
    key: "outcomes",
    label: "Match Outcomes",
    lines: [
      { dataKey: "wins", name: "Wins", color: "#22c55e" },
      { dataKey: "draws", name: "Draws", color: "#6b7280" },
      { dataKey: "losses", name: "Losses", color: "#ef4444" },
    ],
  },
  {
    key: "avgGoals",
    label: "Average Goals",
    lines: [{ dataKey: "avgGoals", name: "Goals/Match", color: "#F4119E" }],
  },
  {
    key: "avgGoalsConceded",
    label: "Average Goals Conceded",
    lines: [{ dataKey: "avgGoalsConceded", name: "GC/Match", color: "#F4119E" }],
  },
  {
    key: "cleanSheets",
    label: "Clean Sheets",
    lines: [{ dataKey: "cleanSheets", name: "Clean Sheets", color: "#F4119E" }],
  },
  {
    key: "appearances",
    label: "Played",
    lines: [{ dataKey: "appearances", name: "Played", color: "#F4119E" }],
  },
];

const PERIOD_OPTIONS = [
  { key: "monthly", label: "Monthly" },
  { key: "weekly", label: "Weekly" },
  { key: "last30", label: "Last 30 Days" },
] as const;

type PeriodKey = (typeof PERIOD_OPTIONS)[number]["key"];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-chalk-100/10 bg-pitch-900 px-3 py-2 text-xs font-mono shadow-lg">
      <div className="text-chalk-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-chalk-300">{p.name}:</span>
          <span className="font-700 text-chalk-100">
            {typeof p.value === "number"
              ? Number.isInteger(p.value)
                ? p.value
                : p.value.toFixed(2)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PerformanceTracker({
  monthly,
  weekly,
  last30,
  variant = "player",
}: {
  monthly: TrackerDataPoint[];
  weekly: TrackerDataPoint[];
  last30: TrackerDataPoint[];
  variant?: "player" | "team";
}) {
  const METRICS = variant === "team" ? TEAM_METRICS : PLAYER_METRICS;
  const [metric, setMetric] = useState("outcomes");
  const [period, setPeriod] = useState<PeriodKey>("monthly");

  const dataMap = useMemo(
    () => ({ monthly, weekly, last30 }),
    [monthly, weekly, last30],
  );

  const data = dataMap[period];
  const activeDef = METRICS.find((m) => m.key === metric)!;

  if (monthly.length === 0 && weekly.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <h3 className="font-display font-700 text-sm tracking-wider text-[#F4119E] uppercase shrink-0">
          Performance Tracker
        </h3>

        {/* Metric tabs - scrollable on mobile */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
                metric === m.key
                  ? "bg-[#F4119E] text-white"
                  : "bg-pitch-800 text-chalk-400 hover:text-[#F4119E] hover:bg-pitch-800/80"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Period selector */}
        <div className="relative shrink-0">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            className="appearance-none bg-[#F4119E] text-white text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 pr-6 rounded cursor-pointer"
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-[8px] pointer-events-none">
            ▼
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-4">
        {data.length < 2 ? (
          <div className="text-xs font-mono text-chalk-400 py-8 text-center">
            Not enough data for this period — play more matches!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 11,
                  fill: "#9ca3af",
                  fontFamily: "monospace",
                }}
                tickLine={false}
                axisLine={false}
                interval={data.length > 30 ? Math.floor(data.length / 15) - 1 : 0}
                angle={-90}
                textAnchor="end"
                height={45}
              />
              <YAxis
                tick={{
                  fontSize: 10,
                  fill: "#9ca3af",
                  fontFamily: "monospace",
                }}
                tickLine={false}
                axisLine={false}
                width={44}
                allowDecimals={activeDef.lines.length === 1 && activeDef.key !== "outcomes"}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  textTransform: "uppercase",
                  paddingTop: 8,
                }}
                formatter={(value: string) => (
                  <span className="text-chalk-300">{value}</span>
                )}
              />
              {activeDef.lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: line.color, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: line.color, strokeWidth: 2, stroke: "#1a1a2e" }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
