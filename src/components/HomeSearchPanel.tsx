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
      className="home-card relative rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-6 hover:border-[#F4119E]/30 transition-colors"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400">
        Search
      </div>
      <h2 className="mt-3 font-display text-2xl font-800 text-chalk-100 md:text-3xl">
        Find Players & Teams
      </h2>
      <p className="mt-2 max-w-lg text-sm font-body leading-6 text-chalk-300">
        Search across {playersCount.toLocaleString("en-GB")} players and{" "}
        {teamsCount.toLocaleString("en-GB")} teams.
      </p>

      <div className="relative mt-5">
        <div className="home-search-bar flex items-center gap-3 rounded-lg border border-chalk-100/8 bg-pitch-800/60 px-4 py-3 focus-within:border-[#F4119E]/50 transition-colors">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-chalk-400"
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
            className="w-full bg-transparent text-sm font-body text-chalk-100 placeholder:text-chalk-400 focus:outline-none"
          />
        </div>

        {showResults && (loading || results.length > 0) && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-chalk-100/8 bg-pitch-900/95 shadow-xl max-h-72 overflow-y-auto">
            {loading && results.length === 0 && (
              <div className="px-4 py-3 text-xs font-mono text-chalk-400">Searching...</div>
            )}
            {results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-pitch-700/50 ${
                  index % 2 === 0 ? "bg-pitch-800/20" : ""
                }`}
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase ${
                    result.type === "player"
                      ? "bg-grass-500/15 text-grass-500"
                      : "bg-cyan-500/15 text-cyan-400"
                  }`}
                >
                  {result.type === "player" ? "PLR" : "TEAM"}
                </span>
                <span className="min-w-0 flex-1 truncate font-body text-sm text-chalk-100">
                  {result.name}
                </span>
                {result.extra && (
                  <span className="text-[10px] font-mono text-chalk-400">
                    {result.extra}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { href: "/players", label: "Players" },
          { href: "/teams", label: "Teams" },
          { href: "/matches", label: "Matches" },
          { href: "/matches/live", label: "Live" },
          { href: "/tournaments", label: "Tournaments" },
          { href: "/ratings", label: "Ratings" },
          { href: "/teams?view=list", label: "Team List" },
        ].map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="home-pill rounded border border-chalk-100/8 bg-pitch-800/40 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-chalk-300 hover:border-[#F4119E]/30 hover:text-chalk-100 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
