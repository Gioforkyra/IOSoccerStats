"use client";

import { useState } from "react";

export interface StatBarDef {
  label: string;
  val1: number;
  val2: number;
  /** "int" = round, "dec" = 1 decimal, "pct" = 1 decimal + % */
  format?: "int" | "dec" | "pct";
}

export interface StatPage {
  title: string;
  bars: StatBarDef[];
}

export function H2HStatSlider({
  pages,
  color1,
  color2,
}: {
  pages: StatPage[];
  color1: string;
  color2: string;
}) {
  const [current, setCurrent] = useState(0);
  const page = pages[current];

  return (
    <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400">
          {page.title}
        </div>
        <div className="flex items-center gap-2">
          {/* Dot indicators */}
          <div className="flex gap-1.5 items-center">
            {pages.map((p, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                title={p.title}
                className={`rounded-full transition-all ${
                  i === current
                    ? "w-4 h-1.5 bg-[#F4119E]"
                    : "w-1.5 h-1.5 bg-chalk-100/20 hover:bg-chalk-100/40"
                }`}
              />
            ))}
          </div>
          {/* Arrows */}
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="w-7 h-7 rounded flex items-center justify-center text-chalk-400 hover:text-chalk-100 disabled:opacity-25 border border-chalk-100/10 disabled:cursor-default text-base leading-none"
          >
            ‹
          </button>
          <button
            onClick={() => setCurrent((c) => Math.min(pages.length - 1, c + 1))}
            disabled={current === pages.length - 1}
            className="w-7 h-7 rounded flex items-center justify-center text-chalk-400 hover:text-chalk-100 disabled:opacity-25 border border-chalk-100/10 disabled:cursor-default text-base leading-none"
          >
            ›
          </button>
        </div>
      </div>

      {/* Stat bars */}
      {page.bars.map((bar, i) => {
        const total = bar.val1 + bar.val2;
        const pct1 = total > 0 ? (bar.val1 / total) * 100 : 50;
        const pct2 = total > 0 ? (bar.val2 / total) * 100 : 50;
        const fmt = bar.format === "pct"
          ? (x: number) => x.toFixed(1) + "%"
          : bar.format === "dec"
          ? (x: number) => x.toFixed(1)
          : (x: number) => x.toFixed(0);
        return (
          <div key={i} className="mb-3.5 last:mb-0">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-sm font-700 text-chalk-100">{fmt(bar.val1)}</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-chalk-400">{bar.label}</span>
              <span className="font-mono text-sm font-700 text-chalk-100">{fmt(bar.val2)}</span>
            </div>
            <div className="flex h-2 rounded overflow-hidden">
              <div style={{ width: `${pct1}%`, backgroundColor: color1 }} />
              <div style={{ width: `${pct2}%`, backgroundColor: color2 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
