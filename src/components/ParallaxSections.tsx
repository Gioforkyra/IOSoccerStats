"use client";

import { useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import { DistributionOnlyChart } from "@/components/RatingsDistributionChart";
import { useTheme } from "@/contexts/ThemeContext";

/* ──────────────────────────────────────────────────────────────────────────
   Shared helpers
   ──────────────────────────────────────────────────────────────────────── */

type Accent = { from: string; via?: string; to: string };

function accentGradient(a: Accent) {
  return a.via
    ? `linear-gradient(90deg, ${a.from} 0%, ${a.via} 50%, ${a.to} 100%)`
    : `linear-gradient(90deg, ${a.from} 0%, ${a.to} 100%)`;
}

function accentSoftGradient(a: Accent, alphaHex: string) {
  return a.via
    ? `linear-gradient(90deg, ${a.from}${alphaHex} 0%, ${a.via}${alphaHex} 50%, ${a.to}${alphaHex} 100%)`
    : `linear-gradient(90deg, ${a.from}${alphaHex} 0%, ${a.to}${alphaHex} 100%)`;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 60 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

function SectionShell({
  id,
  eyebrow,
  title,
  subtitle,
  ctaHref,
  ctaLabel,
  children,
  accent,
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  ctaHref: string;
  ctaLabel: string;
  children: React.ReactNode;
  accent: Accent;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  const gradientText: React.CSSProperties = {
    backgroundImage: accentGradient(accent),
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };

  return (
    <section
      id={id}
      ref={ref}
      style={{
        ["--accent-from" as string]: accent.from,
        ["--accent-to" as string]: accent.to,
      }}
      className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-20 overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: accentSoftGradient(accent, "22"),
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
        }}
      />
      <motion.div
        style={{ y, opacity }}
        className="relative z-10 max-w-6xl w-full mx-auto"
      >
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, margin: "-15% 0px" }}
          variants={container}
          className="text-center mb-10"
        >
          <motion.div
            variants={fadeUp}
            className="text-[10px] font-mono uppercase tracking-[0.3em] mb-3 inline-block font-700"
            style={gradientText}
          >
            {eyebrow}
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display text-4xl md:text-6xl font-black uppercase tracking-tight text-chalk-100"
          >
            {title}
          </motion.h2>
          {subtitle && (
            <motion.p
              variants={fadeUp}
              className="mt-3 text-chalk-400 font-body text-sm md:text-base max-w-2xl mx-auto"
            >
              {subtitle}
            </motion.p>
          )}
        </motion.div>

        {children}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-10% 0px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 text-center"
        >
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-mono text-sm transition-all"
            style={{
              backgroundImage: accentSoftGradient(accent, "22"),
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: `${accent.from}66`,
              color: accent.from,
            }}
          >
            {ctaLabel}
            <span aria-hidden>→</span>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

function LazyFetch<T>({
  endpoint,
  children,
  skeleton,
}: {
  endpoint: string;
  children: (data: T) => React.ReactNode;
  skeleton: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const { data, error } = useSWR<T>(inView ? endpoint : null, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 300_000,
  });

  return (
    <div ref={ref}>
      {!data && !error && skeleton}
      {error && (
        <div className="text-center text-chalk-400 font-mono text-sm py-8">
          Failed to load data.
        </div>
      )}
      {data && children(data)}
    </div>
  );
}

/** Wraps a visual preview in a single Link that covers the whole area,
 *  and disables pointer events inside so nested elements can't be clicked. */
function PreviewLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`block group ${className}`} aria-label="Open page">
      <div
        className="pointer-events-none select-none"
        aria-hidden="false"
      >
        {children}
      </div>
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Accents (gradients)
   ──────────────────────────────────────────────────────────────────────── */

const ACCENT_TOP_TEAMS: Accent = { from: "#1CDCE8", via: "#BB77ED", to: "#F34962" };
const ACCENT_RATINGS: Accent = { from: "#E20B8C", to: "#F84B00" };
const ACCENT_PLAYER_H2H: Accent = { from: "#F9C823", to: "#FC506E" };
const ACCENT_TEAM_H2H: Accent = { from: "#46B83D", to: "#111E0B" };
const ACCENT_LEADERBOARDS: Accent = { from: "#5C73B9", to: "#B330E1" };

/* ──────────────────────────────────────────────────────────────────────────
   Section 1: Top 10 Teams
   ──────────────────────────────────────────────────────────────────────── */

type TopTeamsData = {
  teams: {
    id: number;
    name: string;
    logo: string | null;
    avgRating: number | null;
  }[];
};

function TopTeamsSection() {
  const accent = ACCENT_TOP_TEAMS;
  const { theme } = useTheme();
  const mainColor = theme === "light" ? accent.to : accent.from;
  const ratingStyle: React.CSSProperties =
    theme === "light"
      ? { color: accent.to }
      : {
          backgroundImage: accentGradient(accent),
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        };

  return (
    <SectionShell
      id="top-teams"
      eyebrow="The Top"
      title="Top 8 Teams"
      subtitle="The highest-rated active teams in IOSoccer right now."
      ctaHref="/teams"
      ctaLabel="View All Teams"
      accent={accent}
    >
      <LazyFetch<TopTeamsData>
        endpoint="/api/home/top-teams"
        skeleton={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-pitch-800/40 animate-pulse"
              />
            ))}
          </div>
        }
      >
        {(data) => (
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: false, margin: "-10% 0px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {data.teams.slice(0, 10).map((team, i) => (
              <motion.div key={team.id} variants={fadeUp} custom={i}>
                <Link
                  href={`/teams/${team.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 transition-all hover:bg-pitch-900/80"
                  style={{
                    borderColor: `${accent.from}22`,
                  }}
                >
                  <span
                    className="w-7 h-7 rounded-full bg-pitch-800 flex items-center justify-center text-xs font-mono tabular-nums font-700 shrink-0"
                    style={{ color: mainColor }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-body text-base text-chalk-100 truncate font-600">
                      {team.name}
                    </div>
                    <div
                      className="mt-0.5 text-xs font-mono tabular-nums font-700"
                      style={ratingStyle}
                    >
                      {team.avgRating?.toFixed(2) ?? "-"}
                    </div>
                  </div>
                  {team.logo ? (
                    <img
                      src={team.logo}
                      alt=""
                      className="w-16 h-16 object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-pitch-700 shrink-0" />
                  )}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </LazyFetch>
    </SectionShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Section 2: Ratings Distribution (normal distribution only)
   ──────────────────────────────────────────────────────────────────────── */

type RatingsData = {
  period: string | null;
  players: { steam_id: string; username: string; rating: number }[];
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function fmtPeriod(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

function RatingsDistributionSection() {
  const accent = ACCENT_RATINGS;
  return (
    <SectionShell
      id="ratings"
      eyebrow="The Curve"
      title="Rating Distribution"
      subtitle="Where every EU player lands on the rating curve."
      ctaHref="/ratings"
      ctaLabel="View Ratings"
      accent={accent}
    >
      <LazyFetch<RatingsData>
        endpoint="/api/home/ratings-distribution"
        skeleton={
          <div className="h-[500px] rounded-2xl bg-pitch-900/40 animate-pulse" />
        }
      >
        {(data) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: false, margin: "-10% 0px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border bg-pitch-900/40 overflow-hidden"
            style={{ borderColor: `${accent.from}22` }}
          >
            <div className="px-4 sm:px-6 py-4 border-b border-chalk-100/8 flex items-baseline justify-between">
              <div>
                <div className="font-display font-900 text-xl sm:text-2xl tracking-wider text-chalk-100 uppercase">
                  Ratings
                </div>
                <p className="text-xs font-body text-chalk-400 mt-0.5">
                  {data.period ? fmtPeriod(data.period) : "—"} ·{" "}
                  {data.players.length} players
                </p>
              </div>
              <span className="text-[10px] font-mono text-chalk-500 uppercase tracking-wider">
                EU players only
              </span>
            </div>
            <Link
              href="/ratings"
              className="block group"
              aria-label="Open ratings page"
            >
              <div className="pointer-events-none p-2 sm:p-4">
                {data.players.length > 0 ? (
                  <DistributionOnlyChart players={data.players} />
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-chalk-400 font-body text-sm">
                    No rating data for this period.
                  </div>
                )}
              </div>
            </Link>
          </motion.div>
        )}
      </LazyFetch>
    </SectionShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Section 3: Player Head 2 Head (picker mock)
   ──────────────────────────────────────────────────────────────────────── */

type TopPlayersData = {
  players: { steamId: string; username: string; avatar: string | null }[];
};

function PlayerPickerColumn({
  label,
  players,
}: {
  label: string;
  players: TopPlayersData["players"];
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-2 px-1">
        {label}
      </div>
      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/60 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-chalk-100/8 text-sm font-body text-chalk-500">
          Search player…
        </div>
        <div className="max-h-[360px] overflow-hidden">
          {players.slice(0, 8).map((p) => (
            <div
              key={p.steamId}
              className="w-full flex items-center gap-3 px-3 py-2 border-b border-chalk-100/5 last:border-b-0"
            >
              {p.avatar ? (
                <img
                  src={p.avatar}
                  alt=""
                  className="w-7 h-7 rounded object-cover shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded bg-pitch-700 shrink-0 flex items-center justify-center text-[10px] font-display font-700 text-chalk-300">
                  {p.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-body truncate text-chalk-200 flex-1">
                {p.username}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-chalk-500">
                apps
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayerH2HSection() {
  const accent = ACCENT_PLAYER_H2H;
  return (
    <SectionShell
      id="player-h2h"
      eyebrow="Feature"
      title="Player Head 2 Head"
      subtitle="Stack any two players side by side and see how their careers compare."
      ctaHref="/players/h2h"
      ctaLabel="Compare Players"
      accent={accent}
    >
      <LazyFetch<TopPlayersData>
        endpoint="/api/home/top-players"
        skeleton={
          <div className="rounded-2xl bg-pitch-900/40 h-[480px] animate-pulse" />
        }
      >
        {(data) => (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-10% 0px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <PreviewLink href="/players/h2h">
              <div
                className="rounded-2xl border bg-pitch-900/40 p-6 md:p-8 transition-colors"
                style={{ borderColor: `${accent.from}22` }}
              >
                <div className="mb-6">
                  <h3 className="font-display font-800 text-3xl tracking-tight text-chalk-100">
                    HEAD 2 HEAD
                  </h3>
                  <p className="text-chalk-400 text-sm font-body mt-1">
                    Select two players to compare their stats in shared matches
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <PlayerPickerColumn
                    label="Pick Player One"
                    players={data.players.slice(0, 8)}
                  />
                  <PlayerPickerColumn
                    label="Pick Player Two"
                    players={data.players.slice(0, 8)}
                  />
                </div>

                <div className="flex justify-center mt-6">
                  <div className="px-6 py-2 rounded font-mono text-xs uppercase tracking-wider font-700 bg-chalk-100/5 border border-chalk-100/10 text-chalk-400">
                    Compare
                  </div>
                </div>
              </div>
            </PreviewLink>
          </motion.div>
        )}
      </LazyFetch>
    </SectionShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Section 4: Team Head 2 Head (picker mock)
   ──────────────────────────────────────────────────────────────────────── */

function TeamPickerColumn({
  label,
  teams,
}: {
  label: string;
  teams: TopTeamsData["teams"];
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-2 px-1">
        {label}
      </div>
      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/60 overflow-hidden">
        <div className="max-h-[360px] overflow-hidden">
          {teams.slice(0, 8).map((t) => (
            <div
              key={t.id}
              className="w-full flex items-center gap-3 px-3 py-2 border-b border-chalk-100/5 last:border-b-0"
            >
              {t.logo ? (
                <img
                  src={t.logo}
                  alt=""
                  className="w-7 h-7 object-contain shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded shrink-0 bg-pitch-700" />
              )}
              <span className="text-sm font-body truncate text-chalk-200 flex-1">
                {t.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamH2HSection() {
  const accent = ACCENT_TEAM_H2H;
  return (
    <SectionShell
      id="team-h2h"
      eyebrow="Feature"
      title="Team Head 2 Head"
      subtitle="Pit two squads against each other and dive into the full match history."
      ctaHref="/teams/h2h"
      ctaLabel="Compare Teams"
      accent={accent}
    >
      <LazyFetch<TopTeamsData>
        endpoint="/api/home/top-teams"
        skeleton={
          <div className="rounded-2xl bg-pitch-900/40 h-[480px] animate-pulse" />
        }
      >
        {(data) => (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-10% 0px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <PreviewLink href="/teams/h2h">
              <div
                className="rounded-2xl border bg-pitch-900/40 p-6 md:p-8 transition-colors"
                style={{ borderColor: `${accent.from}22` }}
              >
                <div className="mb-6">
                  <h3 className="font-display font-800 text-3xl tracking-tight text-chalk-100">
                    HEAD 2 HEAD
                  </h3>
                  <p className="text-chalk-400 text-sm font-body mt-1">
                    Select two teams to compare their head-to-head record
                  </p>
                </div>

                <div className="flex items-center gap-1 text-xs font-mono mb-4">
                  {["All", "Club", "National", "Mix"].map((f, i) => (
                    <div
                      key={f}
                      className="px-3 py-1.5 rounded border"
                      style={
                        i === 0
                          ? {
                              borderColor: accent.from,
                              color: accent.from,
                              backgroundColor: `${accent.from}1a`,
                            }
                          : {
                              borderColor: "rgba(255,255,255,0.1)",
                              color: "#9ca3af",
                            }
                      }
                    >
                      {f.toUpperCase()}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <TeamPickerColumn
                    label="Pick Team One"
                    teams={data.teams}
                  />
                  <TeamPickerColumn
                    label="Pick Team Two"
                    teams={data.teams}
                  />
                </div>
              </div>
            </PreviewLink>
          </motion.div>
        )}
      </LazyFetch>
    </SectionShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Section 5: Leaderboards (empty table preview, matching real page)
   ──────────────────────────────────────────────────────────────────────── */

const LEADERBOARD_CARDS: {
  key: string;
  title: string;
  subtitle: string;
  unit: string;
  stat: string;
}[] = [
  {
    key: "goals",
    title: "Most Goals",
    subtitle: "Total goals scored",
    unit: "goals",
    stat: "goals",
  },
  {
    key: "saves",
    title: "Most Saves",
    subtitle: "Total keeper saves (min 500 apps)",
    unit: "saves",
    stat: "saves",
  },
  {
    key: "potm",
    title: "POTM",
    subtitle: "Player of the Match awards",
    unit: "potm",
    stat: "potm",
  },
  {
    key: "winRate",
    title: "Win Rate",
    subtitle: "Wins / matches played (min 500 apps)",
    unit: "win%",
    stat: "winRate",
  },
];

function LeaderboardCard({
  card,
  accent,
}: {
  card: (typeof LEADERBOARD_CARDS)[number];
  accent: Accent;
}) {
  const gradientText: React.CSSProperties = {
    backgroundImage: accentGradient(accent),
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };
  return (
    <Link
      href={`/players/leaderboards?stat=${card.stat}`}
      className="group block rounded-lg border bg-pitch-900/40 overflow-hidden transition-colors"
      style={{ borderColor: `${accent.from}22` }}
    >
      <div className="px-4 py-3 border-b border-chalk-100/8">
        <div
          className="font-mono text-xs uppercase tracking-[0.15em] font-700"
          style={gradientText}
        >
          {card.title}
        </div>
        <div className="font-body text-xs text-chalk-400 mt-0.5">
          {card.subtitle}
        </div>
      </div>
      <ul>
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className={`flex items-center gap-2 pl-2 pr-4 py-2 border-b border-chalk-100/5 last:border-b-0 ${
              i % 2 === 0 ? "bg-transparent" : "bg-chalk-100/[0.02]"
            }`}
          >
            <span className="w-6 text-center font-mono text-xs text-chalk-500 shrink-0 tabular-nums">
              {i + 1}
            </span>
            <div className="w-8 h-8 rounded bg-pitch-800 shrink-0" />
            <div className="flex-1 h-3 rounded bg-pitch-800/80" />
            <div className="w-12 h-3 rounded bg-pitch-800/60" />
          </li>
        ))}
      </ul>
    </Link>
  );
}

function LeaderboardsSection() {
  const accent = ACCENT_LEADERBOARDS;
  return (
    <SectionShell
      id="leaderboards"
      eyebrow="The Best of the Best"
      title="Leaderboards"
      subtitle="Top the charts. Every stat, every era — from goals to POTMs to save rate."
      ctaHref="/players/leaderboards"
      ctaLabel="View All Leaderboards"
      accent={accent}
    >
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: false, margin: "-10% 0px" }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {LEADERBOARD_CARDS.map((card, i) => (
          <motion.div key={card.key} variants={fadeUp} custom={i}>
            <LeaderboardCard card={card} accent={accent} />
          </motion.div>
        ))}
      </motion.div>
    </SectionShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Root
   ──────────────────────────────────────────────────────────────────────── */

export default function ParallaxSections() {
  return (
    <div className="relative">
      <TopTeamsSection />
      <RatingsDistributionSection />
      <PlayerH2HSection />
      <TeamH2HSection />
      <LeaderboardsSection />
    </div>
  );
}
