import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — IOSHUBv2",
  description: "IOSHUBv2 is an unofficial fan-made statistics hub for IOSoccer. Learn who built it and why.",
};

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <span className="text-xs font-mono text-[#F4119E] uppercase tracking-widest">Fan Project</span>
        <h1 className="mt-2 font-display font-black text-3xl sm:text-4xl uppercase tracking-wide text-chalk-100">
          About IOSHUBv2
        </h1>
      </div>

      <div className="space-y-6 font-body text-chalk-300 leading-relaxed">
        <section>
          <h2 className="font-display font-bold text-lg uppercase tracking-wide text-chalk-100 mb-2">What is this?</h2>
          <p>
            IOSHUBv2 is an <strong className="text-chalk-100">unofficial, fan-made statistics platform</strong> for{" "}
            <a href="https://iosoccer.com" target="_blank" rel="noopener noreferrer" className="text-[#F4119E] hover:underline">
              IOSoccer
            </a>
            . It provides detailed stats for players, teams, matches, tournaments, and ratings — all powered by
            IOSoccer's public API.
          </p>
          <p className="mt-3 text-sm text-chalk-500 border-l-2 border-[#F4119E]/40 pl-4">
            This project is <strong className="text-chalk-400">not affiliated with, endorsed by, or officially
            connected to IOSoccer</strong> in any way. All game data belongs to IOSoccer and its community.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg uppercase tracking-wide text-chalk-100 mb-2">Why was it built?</h2>
          <p>
            IOSoccer has a passionate community but limited tools to explore deep statistics. IOSHUBv2 was built to
            fill that gap, giving players and spectators a richer way to analyze match details, player performance,
            head-to-head comparisons, ratings trends, and more.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg uppercase tracking-wide text-chalk-100 mb-2">Data source</h2>
          <p>
            All data is fetched in real-time from the{" "}
            <a href="https://iosoccer.com" target="_blank" rel="noopener noreferrer" className="text-[#F4119E] hover:underline">
              IOSoccer public API
            </a>
            . No data is independently collected, altered, or stored beyond temporary caching for performance.
            IOSHUBv2 does not claim ownership of any IOSoccer data.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold text-lg uppercase tracking-wide text-chalk-100 mb-2">Who built it?</h2>
          <p>
            IOSHUBv2 is a solo side project built by SELF_MADE, a member of the IOSoccer community. It is maintained
            independently with no commercial interest.
          </p>
        </section>

        <section className="pt-4 border-t border-chalk-100/10">
          <p className="text-sm text-chalk-500">
            For legal information, see our{" "}
            <Link href="/privacy" className="text-[#F4119E] hover:underline">Privacy Policy</Link>
            {" "}and{" "}
            <Link href="/terms" className="text-[#F4119E] hover:underline">Terms of Service</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
