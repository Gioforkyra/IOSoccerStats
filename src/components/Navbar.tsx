"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { label: "Live", href: "/matches/live", live: true },
  { label: "Matches", href: "/matches" },
  { label: "Players", href: "/players" },
  { label: "Teams", href: "/teams" },
  { label: "Tournaments", href: "/tournaments" },
];

export default function Navbar() {
  const path = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-chalk-100/5 bg-pitch-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 flex items-center h-14 gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-display font-900 text-xl tracking-wider text-chalk-100">
            IO<span className="text-grass-500">STATS</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "nav-link flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-body font-medium transition-colors",
                path.startsWith(item.href)
                  ? "text-chalk-100"
                  : "text-chalk-400 hover:text-chalk-100"
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
          <input
            type="text"
            placeholder="Search player..."
            className="bg-pitch-800 border border-chalk-100/10 rounded px-3 py-1.5 text-sm font-body text-chalk-200 placeholder-chalk-400 focus:outline-none focus:border-grass-500/50 w-44 transition-all focus:w-56"
          />
          <a
            href="https://store.steampowered.com/app/673560/IOSoccer/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-display font-700 tracking-widest px-3 py-1.5 border border-grass-500/40 text-grass-500 rounded hover:bg-grass-500/10 transition-colors"
          >
            PLAY FREE
          </a>
        </div>
      </div>
    </nav>
  );
}
