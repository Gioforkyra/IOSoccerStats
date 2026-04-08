import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — IOSHUBv2",
  description: "Terms of Service for IOSHUBv2 — conditions for using this fan-made IOSoccer statistics platform.",
};

const LAST_UPDATED = "April 8, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold text-lg uppercase tracking-wide text-chalk-100 mb-2">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <span className="text-xs font-mono text-[#F4119E] uppercase tracking-widest">Legal</span>
        <h1 className="mt-2 font-display font-black text-3xl sm:text-4xl uppercase tracking-wide text-chalk-100">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm font-mono text-chalk-500">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="space-y-6 font-body text-chalk-300 leading-relaxed">
        <Section title="1. About this service">
          <p>
            IOSHUBv2 is a free, fan-made, non-commercial statistics platform for the{" "}
            <a href="https://iosoccer.com" target="_blank" rel="noopener noreferrer" className="text-[#F4119E] hover:underline">
              IOSoccer
            </a>{" "}
            community. By accessing this website, you agree to these terms. If you do not agree, please discontinue use of the service.
          </p>
          <p className="mt-3 text-sm text-chalk-500 border-l-2 border-[#F4119E]/40 pl-4">
            IOSHUBv2 is not affiliated with, endorsed by, or officially associated with IOSoccer or its developers.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            This service is intended for users aged 13 and older. By using IOSHUBv2, you confirm that you meet this requirement.
          </p>
        </Section>

        <Section title="3. Use of the service">
          <p>You may use IOSHUBv2 for personal, non-commercial purposes only. You agree not to:</p>
          <ul className="mt-2 ml-4 space-y-1 text-sm text-chalk-400 list-disc">
            <li>Scrape, crawl, or use automated access beyond what is permitted by our <code className="font-mono text-xs bg-pitch-800 px-1 rounded">robots.txt</code></li>
            <li>Use this service for any commercial purpose without explicit written permission</li>
            <li>Attempt to reverse-engineer, interfere with, or disrupt the service or its infrastructure</li>
            <li>Use the service in any way that violates applicable law</li>
          </ul>
        </Section>

        <Section title="4. Data accuracy">
          <p>
            All statistics and data displayed on IOSHUBv2 are sourced from the IOSoccer public API and are
            provided <strong className="text-chalk-100">as-is</strong>, without any guarantee of accuracy,
            completeness, or timeliness.
          </p>
          <p className="mt-3">
            IOSHUBv2 is not responsible for errors, missing data, or discrepancies between what is shown here
            and IOSoccer's official records.
          </p>
        </Section>

        <Section title="5. Intellectual property">
          <p>
            All game data, team names, player names, and related content are the property of IOSoccer and its
            community. IOSHUBv2 does not claim ownership of any IOSoccer content.
          </p>
          <p className="mt-3">
            The IOSHUBv2 interface, design, and original code are the work of its creator and may not be
            reproduced or redistributed without permission.
          </p>
        </Section>

        <Section title="6. Third-party services">
          <p>
            IOSHUBv2 relies on third-party infrastructure (Vercel for hosting, Cloudflare for CDN and security).
            Your use of this site is also subject to their respective terms of service and privacy policies.
          </p>
        </Section>

        <Section title="7. Disclaimer of warranties">
          <p>
            IOSHUBv2 is provided <strong className="text-chalk-100">"as is"</strong> and{" "}
            <strong className="text-chalk-100">"as available"</strong> without warranties of any kind, express or implied.
            We do not guarantee that the service will be uninterrupted, error-free, or always up to date.
          </p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>
            To the maximum extent permitted by applicable law, IOSHUBv2 and its creator shall not be liable for any
            indirect, incidental, special, or consequential damages arising from your use of — or inability to use — this service.
          </p>
        </Section>

        <Section title="9. Governing law">
          <p>
            These terms are governed by and construed in accordance with the laws of the European Union and the
            Republic of Italy, without regard to conflict of law principles.
          </p>
        </Section>

        <Section title="10. Changes to these terms">
          <p>
            We reserve the right to update these terms at any time. Continued use of the service after changes
            are published constitutes acceptance of the updated terms. The "last updated" date at the top of
            this page will always reflect the most recent revision.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            For questions or concerns regarding these terms, contact:{" "}
            <a href="mailto:gaf.develop@protonmail.com" className="text-[#F4119E] hover:underline">
              gaf.develop@protonmail.com
            </a>
          </p>
        </Section>
      </div>
    </div>
  );
}
