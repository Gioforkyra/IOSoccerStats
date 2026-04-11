"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overall", href: "" },
  { label: "Statistics", href: "/statistics" },
  { label: "Matches", href: "/matches" },
  { label: "POTM", href: "/potm" },
  { label: "Team History", href: "/team-history" },
  { label: "Tournaments", href: "/tournaments" },
];

export default function PlayerTabs({ steamId }: { steamId: string }) {
  const pathname = usePathname();
  const basePath = `/players/${encodeURIComponent(steamId)}`;

  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
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
            prefetch={false}
            className={`px-5 py-2.5 rounded-lg font-display font-700 text-sm uppercase tracking-wider border transition-all whitespace-nowrap ${
              isActive
                ? "border-[#F4119E] text-chalk-100 shadow-[0_0_12px_rgba(244,17,158,0.55),inset_0_0_8px_rgba(244,17,158,0.15)]"
                : "border-transparent text-chalk-400 hover:text-chalk-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
