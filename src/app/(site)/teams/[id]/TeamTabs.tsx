"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Statistics", href: "" },
  { label: "Results", href: "/results" },
  { label: "Squad", href: "/squad" },
  { label: "Lineups", href: "/lineups" },
  { label: "Player History", href: "/player-history" },
  { label: "Tournaments", href: "/tournaments" },
];

export default function TeamTabs({ teamId }: { teamId: number }) {
  const pathname = usePathname();
  const basePath = `/teams/${teamId}`;

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
            className={`font-nav px-5 py-2.5 rounded-lg font-700 text-sm tracking-wide border transition-all whitespace-nowrap ${
              isActive
                ? "border-[#F4119E] text-chalk-100 shadow-[0_0_12px_rgba(244,17,158,0.55),inset_0_0_8px_rgba(244,17,158,0.15)]"
                : "border-transparent text-chalk-100 hover:text-[#F4119E]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
