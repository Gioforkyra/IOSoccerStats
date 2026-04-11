"use client";

import { useTheme } from "@/contexts/ThemeContext";

const CELL = 12;
const GAP = 3;
const STRIDE = CELL + GAP;
const LEFT_PAD = 30;
const TOP_PAD = 18;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Props = {
  data: Record<string, number>; // "YYYY-MM-DD" → match count
  color?: string;               // hex, defaults to pink
};

function hexToRgbArr(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

// Blend fg onto bg with given alpha — returns solid rgb string
function blend(fg: [number, number, number], bg: [number, number, number], alpha: number): string {
  const r = Math.round(fg[0] * alpha + bg[0] * (1 - alpha));
  const g = Math.round(fg[1] * alpha + bg[1] * (1 - alpha));
  const b = Math.round(fg[2] * alpha + bg[2] * (1 - alpha));
  return `rgb(${r},${g},${b})`;
}

// Deterministic formatter — no locale dependency, avoids hydration mismatch
function fmtDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2,"0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function playHover() {
  if (typeof window === "undefined") return;
  const audio = new Audio("/hover.mp3");
  audio.volume = 0.35;
  audio.play().catch(() => {});
}

export function ActivityHeatmap({ data, color = "#F4119E" }: Props) {
  const { theme } = useTheme();
  const cellStroke = "#000000";
  // All date math in UTC so server/client produce identical output
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const startRaw = new Date(today);
  startRaw.setUTCDate(startRaw.getUTCDate() - 364);
  const dow = startRaw.getUTCDay();
  startRaw.setUTCDate(startRaw.getUTCDate() - (dow === 0 ? 6 : dow - 1));

  const weeks: Array<Array<{ date: Date; count: number }>> = [];
  const cursor = new Date(startRaw);
  while (cursor <= today) {
    const week: Array<{ date: Date; count: number }> = [];
    for (let d = 0; d < 7; d++) {
      week.push({ date: new Date(cursor), count: data[cursor.toISOString().slice(0, 10)] ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  const monthLabels: Array<{ label: string; wi: number }> = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const m = week[0].date.getUTCMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: MONTHS[m], wi });
      lastMonth = m;
    }
  });

  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#F4119E";
  const fgRgb = hexToRgbArr(safeColor);
  const resolvedEmptyFill = theme === "light" ? "#edeff4" : "#171717";
  // Solid (pre-blended) colors so rendering is identical regardless of wrapper bg
  const BLEND_BASE: [number, number, number] =
    theme === "light" ? [237, 239, 244] : [26, 29, 43]; // light: #edeff4, dark: #1a1d2b
  const topFill = theme === "light" ? blend(fgRgb, BLEND_BASE, 0.85) : safeColor;
  const getColor = (count: number): string => {
    if (count === 0) return resolvedEmptyFill;
    if (count === 1) return blend(fgRgb, BLEND_BASE, 0.2);
    if (count <= 3) return blend(fgRgb, BLEND_BASE, 0.4);
    if (count <= 6) return blend(fgRgb, BLEND_BASE, 0.6);
    return topFill;
  };
  const STROKE_PAD = 1;
  const W = weeks.length;
  const svgW = LEFT_PAD + W * STRIDE - GAP + STROKE_PAD;
  const svgH = TOP_PAD + 7 * STRIDE - GAP + STROKE_PAD;

  const DAY_LABELS: [string, number][] = [["Mon", 0], ["Wed", 2], ["Fri", 4], ["Sun", 6]];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        style={{ display: "block", height: "auto" }}
      >
        <style>{`
          .hm-cell {
            transform-box: fill-box;
            transform-origin: center;
            transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
            cursor: pointer;
          }
          .hm-cell:hover {
            transform: scale(1.55);
          }
        `}</style>
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text key={i} x={LEFT_PAD + m.wi * STRIDE} y={11} fontSize={9} fill="#9ca3af" fontFamily="monospace">
            {m.label}
          </text>
        ))}

        {/* Day labels */}
        {DAY_LABELS.map(([label, di]) => (
          <text
            key={label}
            x={LEFT_PAD - 4}
            y={TOP_PAD + di * STRIDE + CELL - 1}
            fontSize={8}
            fill="#6b7280"
            fontFamily="monospace"
            textAnchor="end"
          >
            {label}
          </text>
        ))}

        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            const isFuture = day.date > today;
            return (
              <rect
                key={`${wi}-${di}`}
                x={LEFT_PAD + wi * STRIDE}
                y={TOP_PAD + di * STRIDE}
                width={CELL}
                height={CELL}
                rx={2}
                ry={2}
                fill={isFuture ? "transparent" : getColor(day.count)}
                stroke={isFuture ? undefined : cellStroke}
                strokeWidth={isFuture ? undefined : 1}
                strokeOpacity={isFuture ? undefined : 1}
                className={isFuture ? undefined : "hm-cell"}
                onMouseEnter={isFuture ? undefined : playHover}
              >
                {!isFuture && (
                  <title>
                    {`${fmtDate(day.date)}: ${day.count} ${day.count === 1 ? "match" : "matches"}`}
                  </title>
                )}
              </rect>
            );
          })
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-1">
        <span className="text-[9px] font-mono text-chalk-500">Less</span>
        {[0, 1, 2, 4, 7].map((n) => (
          <div
            key={n}
            style={{ width: 10, height: 10, backgroundColor: getColor(n), borderRadius: 2 }}
          />
        ))}
        <span className="text-[9px] font-mono text-chalk-500">More</span>
      </div>
    </div>
  );
}
