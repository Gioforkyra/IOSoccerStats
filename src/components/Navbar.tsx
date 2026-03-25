"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";

const NAV = [
  { label: "Live", href: "/matches/live", live: true, exact: true },
  { label: "Matches", href: "/matches", exact: false },
  { label: "Players", href: "/players", exact: false },
  { label: "Teams", href: "/teams", exact: false },
  { label: "Tournaments", href: "/tournaments", exact: false },
];

type SearchResult = {
  type: "player" | "team";
  id: string;
  name: string;
  extra: string | null;
};

function isActive(path: string, item: typeof NAV[number]): boolean {
  if (item.exact) return path === item.href;
  // For "/matches", don't match "/matches/live"
  if (item.href === "/matches") return path === "/matches" || (path.startsWith("/matches") && !path.startsWith("/matches/live"));
  return path.startsWith(item.href);
}

export default function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    setShowResults(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 250);
  };

  const handleSelect = (r: SearchResult) => {
    setShowResults(false);
    setQuery("");
    if (r.type === "player") router.push(`/players/${r.id}`);
    else router.push(`/teams/${r.id}`);
  };

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchBox = (className: string) => (
    <div ref={searchRef} className={`relative ${className}`}>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => query.length >= 2 && setShowResults(true)}
        className="w-full bg-pitch-800 border border-chalk-100/10 rounded px-3 py-1.5 text-sm font-body text-chalk-200 placeholder-chalk-400 focus:outline-none focus:border-grass-500/50"
      />
      {showResults && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-pitch-900 border border-chalk-100/10 rounded-lg shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="px-4 py-3 text-xs font-mono text-chalk-400">Searching...</div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => handleSelect(r)}
              className={`w-full text-left px-4 py-2.5 hover:bg-pitch-700/50 transition-colors flex items-center gap-3 cursor-pointer ${
                i % 2 === 0 ? "bg-pitch-600/10" : ""
              }`}
            >
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                r.type === "player" ? "bg-grass-500/15 text-grass-500" : "bg-cyan-500/15 text-cyan-400"
              }`}>
                {r.type === "player" ? "PLR" : "TEAM"}
              </span>
              <span className="font-body text-sm text-chalk-100">{r.name}</span>
              {r.extra && <span className="text-xs font-mono text-chalk-400 ml-auto">{r.extra}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-chalk-100/5 bg-pitch-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-11 gap-4 md:gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-display font-900 text-lg tracking-wide text-chalk-100 sm:text-xl">
            IOSoccer-<span className="pink-gradient-text">Stats</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="relative z-10 hidden md:flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "nav-link flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-body font-medium transition-colors",
                isActive(path, item)
                  ? "text-chalk-100 border border-[#F4119E]/40 bg-[#F4119E]/5"
                  : "text-chalk-400 hover:text-chalk-100 border border-transparent"
              )}
            >
              {item.live && (
                <span className="live-dot w-1.5 h-1.5 rounded-full bg-grass-500 inline-block" />
              )}
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {searchBox("hidden sm:block w-44 md:w-56")}

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <span className={clsx("block w-5 h-0.5 bg-chalk-200 transition-transform", open && "rotate-45 translate-y-2")} />
            <span className={clsx("block w-5 h-0.5 bg-chalk-200 transition-opacity", open && "opacity-0")} />
            <span className={clsx("block w-5 h-0.5 bg-chalk-200 transition-transform", open && "-rotate-45 -translate-y-2")} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-chalk-100/5 bg-pitch-950/95 backdrop-blur-md">
          <div className="px-4 py-3 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2.5 rounded text-sm font-body font-medium transition-colors",
                  isActive(path, item)
                    ? "text-chalk-100 bg-pitch-800"
                    : "text-chalk-400 hover:text-chalk-100 hover:bg-pitch-800/50"
                )}
              >
                {item.live && (
                  <span className="live-dot w-1.5 h-1.5 rounded-full bg-grass-500 inline-block" />
                )}
                {item.label}
              </Link>
            ))}
            <div className="pt-2">
              {searchBox("sm:hidden")}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
