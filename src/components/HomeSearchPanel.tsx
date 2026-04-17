"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

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
    <div ref={panelRef} className="relative">
      <div className="relative">
        <div className="home-search-bar flex items-center gap-3 rounded-xl border border-chalk-100/10 bg-pitch-900/60 px-5 py-4 focus-within:border-[#F4119E]/50 transition-colors">
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

      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        {[
          { href: "/players", label: "Players" },
          { href: "/teams", label: "Teams" },
          { href: "/matches", label: "Matches" },
          { href: "/matches/live", label: "Live" },
          { href: "/fixtures", label: "Fixtures" },
          { href: "/tournaments?status=active", label: "Tournaments" },
          { href: "/players/transfers", label: "Transfers" },
          { href: "/ratings", label: "Ratings" },
          { href: "/players/leaderboards", label: "Leaderboards" },
        ].map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="home-pill rounded-lg border border-chalk-100/10 bg-pitch-900/50 px-4 py-2.5 text-sm font-mono uppercase tracking-wider text-chalk-300 hover:border-[#F4119E]/50 hover:text-[#F4119E] hover:bg-pitch-800/60 transition-colors"
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/support"
          className="home-pill home-pill--support rounded-lg border border-[#F4119E]/50 bg-[#F4119E]/10 px-4 py-2.5 text-sm font-mono uppercase tracking-wider text-[#F4119E] hover:border-[#F4119E] hover:bg-[#F4119E]/20 transition-colors"
        >
          Support
        </Link>
        <ThemeToggle />
      </div>
    </div>
  );
}
