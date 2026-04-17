"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";
import ThemeToggle from "@/components/ThemeToggle";

type NavItem = {
  label: string;
  href: string;
  live?: boolean;
  exact?: boolean;
  dropdown?: { label: string; href: string }[];
};

const NAV: NavItem[] = [
  { label: "Live", href: "/matches/live", live: true, exact: true },
  { label: "Matches", href: "/matches", exact: false },
  {
    label: "Players",
    href: "/players",
    exact: false,
    dropdown: [
      { label: "Statistics", href: "/players" },
      { label: "Leaderboards", href: "/players/leaderboards" },
      { label: "Transfers", href: "/players/transfers" },
      { label: "Head2Head", href: "/players/h2h" },
    ],
  },
  {
    label: "Teams",
    href: "/teams",
    exact: false,
    dropdown: [
      { label: "List", href: "/teams" },
      { label: "Statistics", href: "/teams/statistics" },
      { label: "Head2Head", href: "/teams/h2h" },
    ],
  },
  {
    label: "Tournaments",
    href: "/tournaments",
    exact: false,
    dropdown: [
      { label: "Tournaments", href: "/tournaments" },
      { label: "Fixtures", href: "/fixtures" },
    ],
  },
  { label: "Ratings", href: "/ratings", exact: false },
];

type SearchResult = {
  type: "player" | "team";
  id: string;
  name: string;
  extra: string | null;
};

function isActive(path: string, item: NavItem): boolean {
  if (item.exact) return path === item.href;
  // For "/matches", don't match "/matches/live"
  if (item.href === "/matches") return path === "/matches" || (path.startsWith("/matches") && !path.startsWith("/matches/live"));
  // Check dropdown sub-pages too (e.g. /fixtures under Tournaments)
  if (item.dropdown?.some((sub) => path === sub.href || path.startsWith(sub.href + "/"))) return true;
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
        className="w-full h-7 bg-pitch-800 border border-chalk-100/10 rounded px-3 py-0 text-sm font-body text-chalk-200 placeholder-chalk-400 focus:outline-none focus:border-[#F4119E]/50"
      />
      {showResults && (results.length > 0 || loading) && (
        <div className="absolute top-full right-0 mt-1 min-w-[320px] bg-pitch-900 border border-chalk-100/10 rounded-lg shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center h-11 gap-4 md:gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/favicon/favicon-96x96.png" alt="IOSHUBv2" className="w-6 h-6 object-contain" />
          <span className="font-display font-black uppercase text-lg tracking-wide text-chalk-100 sm:text-xl">
            IOS<span className="text-[#F4119E]">HUB</span>v2
          </span>
        </Link>

        {/* Desktop nav links + Ko-fi */}
        <div className="relative z-10 hidden md:flex items-center gap-1">
          {NAV.map((item) =>
            item.dropdown ? (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  className={clsx(
                    "nav-link font-nav flex items-center gap-0.5 px-3 py-1.5 rounded text-sm font-semibold transition-colors",
                    isActive(path, item)
                      ? "text-[#F4119E]"
                      : "text-chalk-400 hover:text-[#F4119E]"
                  )}
                >
                  {item.label}
                  <svg className="icon-hang w-3 h-3 ml-0.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </Link>
                <div className="absolute top-full left-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                  <div className="min-w-[140px] bg-pitch-900 border border-chalk-100/10 rounded-lg shadow-xl overflow-hidden">
                    {item.dropdown.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={clsx(
                          "nav-dropdown-item font-nav block px-4 py-2 text-sm font-medium transition-colors",
                          path === sub.href
                            ? "text-chalk-100 bg-[#F4119E]/10"
                            : "text-chalk-400 hover:text-[#F4119E] hover:bg-pitch-700/50"
                        )}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "nav-link font-nav flex items-center gap-0.5 px-3 py-1.5 rounded text-sm font-semibold transition-colors",
                  isActive(path, item)
                    ? "text-[#F4119E]"
                    : "text-chalk-400 hover:text-[#F4119E]"
                )}
              >
                {item.live && (
                  <span className="live-dot w-1.5 h-1.5 rounded-full bg-grass-500 inline-block mr-1" />
                )}
                {item.label}
              </Link>
            )
          )}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          <a
            href="https://ko-fi.com/bybl0s"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support me on Ko-fi"
            className="hidden md:flex shrink-0 items-center justify-center w-[60px] h-7 rounded-md bg-[#ff6433] hover:brightness-110 transition-all"
          >
            <img src="/kofi_brandasset/kofi_symbol.svg" alt="Ko-fi" className="h-5 w-auto" />
          </a>
          <ThemeToggle />
          {searchBox("hidden sm:block w-28 md:w-32")}

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
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "font-nav flex items-center gap-2 px-3 py-2.5 rounded text-sm font-semibold transition-colors",
                    isActive(path, item)
                      ? "text-[#F4119E]"
                      : "text-chalk-400 hover:text-[#F4119E] hover:bg-pitch-800/50"
                  )}
                >
                  {item.live && (
                    <span className="live-dot w-1.5 h-1.5 rounded-full bg-grass-500 inline-block mr-1" />
                  )}
                  {item.label}
                </Link>
                {item.dropdown && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {item.dropdown.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setOpen(false)}
                        className={clsx(
                          "nav-dropdown-item font-nav block px-3 py-2 rounded text-sm font-medium transition-colors",
                          path === sub.href
                            ? "text-[#F4119E]"
                            : "text-chalk-500 hover:text-[#F4119E] hover:bg-pitch-800/30"
                        )}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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
