"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overall", href: "" },
  { label: "Statistics", href: "/statistics" },
  { label: "Matches", href: "/matches" },
  { label: "Team History", href: "/team-history" },
  { label: "Tournaments", href: "/tournaments" },
];

export default function PlayerTabs({ steamId }: { steamId: string }) {
  const pathname = usePathname();
  const basePath = `/players/${encodeURIComponent(steamId)}`;

  return (
    <div className="flex border-b border-chalk-100/8 mb-6">
      {TABS.map((tab) => {
        const fullPath = basePath + tab.href;
        const isActive =
          tab.href === ""
            ? pathname === basePath || pathname === basePath + "/"
            : pathname.startsWith(fullPath);

        return (
          <Link
            key={tab.label}
            href={fullPath}
            className={`px-6 py-3 font-display font-700 text-sm uppercase tracking-wider border-b-2 transition-colors ${
              isActive
                ? "border-[#F4119E] text-chalk-100"
                : "border-transparent text-chalk-400 hover:text-chalk-200 hover:border-chalk-100/20"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
