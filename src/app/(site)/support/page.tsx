import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support & Updates — IOSHUBv2",
  description:
    "People who've supported IOSHUBv2 and the latest updates shipped to the site.",
};

type Supporter = {
  name: string;
  method: string;
  note?: string;
};

type Update = {
  date: string;
  title: string;
  body: string;
};

type ChangelogEntry = {
  date: string;
  changes: string[];
};

const SUPPORTERS: Supporter[] = [
  { name: "Edwar", method: "Support & Feedback" },
  { name: "Labelo", method: "Support" },
  { name: "Robifera", method: "Logo & Feedback" },
];

const UPDATES: Update[] = [
  {
    date: "Planned",
    title: "Common traits for players",
    body: "Surface recurring statistical traits and patterns across a player's career.",
  },
];

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-05-05",
    changes: [
      "Player titles now require at least one appearance in the respective tournament for the winning team — rostered-but-never-played stints no longer count.",
    ],
  },
  {
    date: "2026-05-04",
    changes: [
      "May 2026 player ratings imported — new values shown on every player profile and as a new period on the /ratings distribution page.",
      "Ratings page now defaults to a 100+ matches-played filter for a cleaner distribution view.",
      "Rating delta on player profiles now reflects the change vs the previous snapshot (not vs the very first one).",
      "Match detail negative title renamed from 'Low Int.' to 'Low Ints'.",
      "Region filter on the Teams page (Europe / South America / North America / Asia) — defaults to Europe.",
      "Team type (Club / National / Mix / Draft) and region filters on the Teams page now apply strictly to inactive teams as well.",
    ],
  },
  {
    date: "2026-04-25",
    changes: [
      "New Players tab on every tournament page with stats of every player who appeared in that tournament.",
      "Top 4 awards highlighted at the top of the tab: Golden Boot, Playmaker, Golden Glove and Best Passer.",
      "Stat-view filters and min apps filter on the tournament Players table.",
    ],
  },
  {
    date: "2026-04-24",
    changes: [
      "Match detail titles fully redesigned: new positive (Lethal, Sniper, Aerial Threat, Visionary, Threat, Maestro, Aggressive, Cross Catcher) and negative (Ghost, Bad Shots, Ball Hogger, Bad Passes, Low Ints, Own Goal, Exposed) titles with refined awarding logic.",
      "New 'carry' title tier with animated gradient: Wall (GK), Striker, Artist, All Rounder, plus personal Carry for big individual contributions.",
      "Hover descriptions on every title badge.",
      "Bracket page on Cup tournaments and Draft leagues showing matches grouped by knockout phase (Round 1, Quarter-Final, Semi-Final, Final, ...) with winner highlighted.",
      "Cup standings: undefeated teams (0 losses) always pinned at the top.",
    ],
  },
  {
    date: "2026-04-22",
    changes: [
      "New Format column on the Matches page showing 8v8 or 4v4.",
      "Format filter on the Matches page (8v8 by default, 4v4 selectable).",
      "Match detail lineups now render a 4v4 Y-shape formation when the match is 4v4.",
    ],
  },
  {
    date: "2026-04-19",
    changes: [
      "Match detail H2H values now clearly readable in both dark and light mode, as well as more distinguishable bars.",
      "ALL / COMP / FRIENDLY match type filter on team results and player matches pages.",
    ],
  },
  {
    date: "2026-04-18",
    changes: [
      "Lineups section on team pages with filters by time period and win rate.",
    ],
  },
];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function periodKey(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

function periodLabel(key: string): string {
  const [y, m] = key.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_NAMES[idx] ?? m} ${y}`;
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;

  const periods = Array.from(
    new Set(CHANGELOG.map((e) => periodKey(e.date)))
  ).sort((a, b) => b.localeCompare(a));

  const selectedPeriod =
    sp.period && periods.includes(sp.period) ? sp.period : periods[0];

  const visibleChangelog = selectedPeriod
    ? CHANGELOG.filter((e) => periodKey(e.date) === selectedPeriod)
    : CHANGELOG;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <span className="text-xs font-mono text-[#F4119E] uppercase tracking-widest">
          Community
        </span>
        <h1 className="mt-2 font-display font-black text-3xl sm:text-4xl uppercase tracking-wide text-chalk-100">
          Support & Updates
        </h1>
        <p className="mt-3 font-body text-chalk-400">
          IOSHUBv2 runs on community goodwill. This page lists the people who
          keep the lights on and the latest changes shipped to the site.
        </p>
      </div>

      <section className="rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-5 sm:p-6 mb-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-1">
          Want to help?
        </div>
        <h2 className="font-display font-black text-xl uppercase tracking-wide text-chalk-100">
          Buy me a coffee
        </h2>
        <p className="mt-1 text-sm font-body text-chalk-400">
          Hosting, domain and caching aren't free. Any amount is appreciated —
          you'll be listed here (unless you prefer anonymous).
        </p>
        <p className="mt-3 text-sm font-body text-chalk-300">
          You can support me at this link:{" "}
          <a
            href="https://ko-fi.com/bybl0s"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[#F4119E] hover:underline whitespace-nowrap"
          >
            https://ko-fi.com/bybl0s
          </a>
        </p>
      </section>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display font-bold text-lg uppercase tracking-wide text-chalk-100">
            Supporters
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-wider text-chalk-500">
            Wall of Supporters
          </span>
        </div>
        {SUPPORTERS.length === 0 ? (
          <div className="rounded-xl border border-dashed border-chalk-100/10 bg-pitch-900/30 px-5 py-8 text-center">
            <p className="font-body text-chalk-400 text-sm">
              The most recent supporters will appear at the top of this list.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {SUPPORTERS.map((s, i) => (
              <li
                key={`${s.name}-${i}`}
                className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#F4119E]">♥</span>
                  <span className="font-display font-700 text-chalk-100">
                    {s.name}
                  </span>
                  <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-chalk-500">
                    {s.method}
                  </span>
                </div>
                {s.note && (
                  <p className="mt-1 text-xs font-body text-chalk-400">{s.note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display font-bold text-lg uppercase tracking-wide text-chalk-100">
            Planned Updates
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-wider text-chalk-500">
            Coming Soon
          </span>
        </div>
        {UPDATES.length === 0 ? (
          <div className="rounded-xl border border-dashed border-chalk-100/10 bg-pitch-900/30 px-5 py-8 text-center">
            <p className="font-body text-chalk-400 text-sm">
              Upcoming features and improvements will be listed here.
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {UPDATES.map((u, i) => (
              <li
                key={`${u.date}-${i}`}
                className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 px-4 py-3"
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#F4119E]">
                    {u.date}
                  </span>
                  <h3 className="font-display font-700 text-chalk-100">
                    {u.title}
                  </h3>
                </div>
                <p className="mt-1 text-sm font-body text-chalk-300">{u.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display font-bold text-lg uppercase tracking-wide text-chalk-100">
            Changelog
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-wider text-chalk-500">
            Recent Changes
          </span>
        </div>
        {CHANGELOG.length === 0 ? (
          <div className="rounded-xl border border-dashed border-chalk-100/10 bg-pitch-900/30 px-5 py-8 text-center">
            <p className="font-body text-chalk-400 text-sm">
              Recent changes shipped to the site will appear here.
            </p>
          </div>
        ) : (
          <>
            {periods.length > 1 && (
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                {periods.map((p) => {
                  const active = p === selectedPeriod;
                  const cn = `px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
                    active
                      ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10 cursor-default"
                      : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"
                  }`;
                  const label = periodLabel(p);
                  return active ? (
                    <span key={p} className={cn} aria-current="page">{label}</span>
                  ) : (
                    <Link key={p} href={`/support?period=${p}`} className={cn}>{label}</Link>
                  );
                })}
              </div>
            )}
            <ol className="space-y-3">
              {visibleChangelog.map((entry, i) => (
                <li
                  key={`${entry.date}-${i}`}
                  className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 px-4 py-3"
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#F4119E] mb-2">
                    {entry.date}
                  </div>
                  <ul className="space-y-1.5">
                    {entry.changes.map((c, j) => (
                      <li
                        key={j}
                        className="text-sm font-body text-chalk-300"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <div className="mt-10 pt-4 border-t border-chalk-100/10 text-sm text-chalk-500">
        Got feedback or suggestions? Reach out on{" "}
        <Link href="/about" className="text-[#F4119E] hover:underline">
          the about page
        </Link>
        .
      </div>
    </div>
  );
}
