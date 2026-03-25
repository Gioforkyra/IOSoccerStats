"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type SearchResult = {
  type: "player" | "team";
  id: string;
  name: string;
  extra: string | null;
};

export default function HomeSearchPanel({
  playersCount,
  teamsCount,
}: {
  playersCount: number;
  teamsCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const panelRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (value: string) => {
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
      if (!response.ok) throw new Error("Search failed");
      const data: SearchResult[] = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setShowResults(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(value);
    }, 250);
  };

  const handleSelect = (result: SearchResult) => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    router.push(result.type === "player" ? `/players/${result.id}` : `/teams/${result.id}`);
  };

  return (
    <div
      ref={panelRef}
      className="home-card-hover relative overflow-hidden rounded-[32px] border border-chalk-100/8 bg-[radial-gradient(circle_at_top,rgba(131,208,203,0.12),transparent_45%),linear-gradient(180deg,rgba(10,29,38,0.96),rgba(9,18,26,0.92))] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.32)]"
    >
      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-10 top-8 h-24 w-24 rounded-full bg-[rgba(20,82,119,0.2)] blur-3xl" />
        <div className="absolute bottom-10 right-10 h-28 w-28 rounded-full bg-[rgba(131,208,203,0.18)] blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-chalk-400">
          Search
        </div>
        <h2 className="mt-4 max-w-2xl font-display text-4xl font-800 leading-tight text-chalk-100 md:text-5xl">
          Search Players And Teams
        </h2>
        <p className="mt-3 max-w-2xl text-base font-body leading-7 text-chalk-300">
          Search across {playersCount.toLocaleString("en-GB")} players and{" "}
          {teamsCount.toLocaleString("en-GB")} tracked teams, then jump straight into match
          detail pages, team hubs and player profiles.
        </p>

        <div className="relative mt-8">
          <div className="flex items-center gap-3 rounded-2xl border border-chalk-100/8 bg-pitch-950/75 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 shrink-0 text-chalk-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(event) => handleChange(event.target.value)}
              onFocus={() => query.trim().length >= 2 && setShowResults(true)}
              placeholder="Search players or teams..."
              className="w-full bg-transparent text-base font-body text-chalk-100 placeholder:text-chalk-400 focus:outline-none"
            />
          </div>

          {showResults && (loading || results.length > 0) && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-chalk-100/8 bg-pitch-950/95 shadow-[0_22px_60px_rgba(0,0,0,0.45)]">
              {loading && results.length === 0 && (
                <div className="px-4 py-3 text-sm font-mono text-chalk-400">Searching...</div>
              )}
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-pitch-800/85 ${
                    index % 2 === 0 ? "bg-pitch-900/35" : ""
                  }`}
                >
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] ${
                      result.type === "player"
                        ? "bg-[rgba(20,82,119,0.25)] text-[var(--stats-accent-soft)]"
                        : "bg-cyan-500/15 text-cyan-300"
                    }`}
                  >
                    {result.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-body text-sm text-chalk-100">
                    {result.name}
                  </span>
                  {result.extra && (
                    <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-chalk-400">
                      {result.extra}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { href: "/players", label: "Players" },
            { href: "/teams", label: "Teams" },
            { href: "/matches", label: "Matches" },
            { href: "/matches/live", label: "Live Scores" },
            { href: "/tournaments", label: "Tournaments" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="home-accent-outline rounded-full border border-chalk-100/8 bg-pitch-950/50 px-3 py-2 text-xs font-mono uppercase tracking-[0.16em] text-chalk-300"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
