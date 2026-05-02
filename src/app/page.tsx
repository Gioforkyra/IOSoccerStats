import HomeSearchPanel from "@/components/HomeSearchPanel";
import ParallaxSections from "@/components/ParallaxSections";

export const revalidate = 120;

import { getActiveTeams, getPlayers } from "@/lib/iosoccer-api";
import { prisma } from "@/lib/prisma";
import ParticlesBackground from "@/components/ParticlesBackground";
import Footer from "@/components/Footer";


export default async function HomePage() {
  const [playersCount, teamsCount] = await Promise.all([
    getPlayers({ page: 1, pageSize: 1 })
      .then((p) => p.totalItems)
      .catch(() => prisma.player.count().catch(() => 0)),
    getActiveTeams(1, 1)
      .then((t) => t.length)
      .catch(() =>
        prisma.team.count({ where: { inactive: false, teamType: 1 } }).catch(() => 0),
      ),
  ]);

  return (
    <div className="min-h-screen relative bg-pitch-950 flex flex-col">
      <ParticlesBackground />

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col">
        <section className="relative min-h-screen flex flex-col justify-center">
          <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12">
            {/* Header */}
            <div className="mb-12 md:mb-16">
              <div className="min-w-0">
                <h1 className="flex items-center justify-center gap-3 text-center font-display text-6xl font-black uppercase leading-[0.95] tracking-tight text-chalk-100 md:text-8xl">
                  <img src="/favicon/favicon-96x96.png" alt="IOSHUBv2" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
                  <span>IOS<span className="text-[#F4119E]">HUB</span>V2</span>
                </h1>
              </div>
            </div>

            {/* Full-width search */}
            <HomeSearchPanel playersCount={playersCount} teamsCount={teamsCount} />
          </div>

          <a href="#top-teams" className="scroll-indicator" aria-label="Scroll down">
            Scroll
          </a>
        </section>

        <ParallaxSections />

        <Footer className="mt-6" />
      </div>
    </div>
  );
}
