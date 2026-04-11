import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — IOSHUBv2",
  description: "Privacy Policy for IOSHUBv2 — how we handle data and what we collect.",
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

export default function PrivacyPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <span className="text-xs font-mono text-[#F4119E] uppercase tracking-widest">Legal</span>
        <h1 className="mt-2 font-display font-black text-3xl sm:text-4xl uppercase tracking-wide text-chalk-100">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm font-mono text-chalk-500">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="space-y-6 font-body text-chalk-300 leading-relaxed">
        <Section title="1. Overview">
          <p>
            IOSHUBv2 is a fan-made, non-commercial project operated by an individual creator. We are committed
            to transparency about how data is handled when you use this site.
          </p>
          <p className="mt-3">
            IOSHUBv2 itself does not collect, store, or sell any personal information. However, as a website
            operator, we act as a data controller in relation to the third-party infrastructure used to deliver
            this service.
          </p>
        </Section>

        <Section title="2. Data we process">
          <p className="mb-3">
            IOSHUBv2 does <strong className="text-chalk-100">not</strong> operate user accounts, login systems,
            or any form of registration. No personal data is collected directly.
          </p>
          <p>
              This site is delivered through third-party infrastructure providers (Vercel and Cloudflare) which may process 
            standard technical data such as IP addresses for security and content delivery purposes. For details, refer to 
            their respective privacy policies.
          </p>
        </Section>

        <Section title="3. International data transfers">
          <p>
            Both Vercel and Cloudflare are US-based companies. Data processed by them may be transferred to and
            stored in the United States or other countries outside the EU/EEA. These providers maintain
            compliance with applicable data transfer mechanisms (e.g. Standard Contractual Clauses).
          </p>
        </Section>

        <Section title="4. Cookies">
          <p>
            IOSHUBv2 uses a single technical cookie to remember your preferred color theme (light/dark mode).
            This cookie:
          </p>
          <ul className="mt-2 ml-4 space-y-1 text-sm text-chalk-400 list-disc">
            <li>Contains no personal information</li>
            <li>Is stored only in your browser</li>
            <li>Is never transmitted to third parties</li>
            <li>Is exempt from consent requirements under EU law (strictly necessary / functional cookie)</li>
          </ul>
          <p className="mt-3">
            Cloudflare may set its own technical cookies (
            <code className="font-mono text-xs bg-pitch-800 px-1 rounded">__cf_bm</code>,{" "}
            <code className="font-mono text-xs bg-pitch-800 px-1 rounded">__cflb</code>) for security and load
            balancing. These are strictly necessary and do not require consent.
          </p>
          <p className="mt-3 text-sm text-chalk-500">
            We do <strong className="text-chalk-400">not</strong> use advertising cookies, tracking pixels, or
            third-party analytics.
          </p>
        </Section>

        <Section title="5. Legal basis for processing (GDPR – Art. 6)">
          <p>The limited processing described above is based on:</p>
          <ul className="mt-2 ml-4 space-y-1 text-sm text-chalk-400 list-disc">
            <li>
              <strong className="text-chalk-300">Legitimate interests (Art. 6(1)(f)):</strong> delivering the
              service securely and efficiently
            </li>
            <li>No personal data is processed by IOSHUBv2 directly</li>
          </ul>
        </Section>

        <Section title="6. Your rights (EU / GDPR)">
          <p>
            Since IOSHUBv2 does not directly collect or store personal data, most GDPR rights (access,
            rectification, erasure, portability) are not applicable to us directly. For data processed by
            Cloudflare or Vercel, please contact them directly via their respective privacy policies.
          </p>
          <p className="mt-3">
            If you have any privacy concern or question, you may contact us (see below) and we will do our best
            to assist or direct you appropriately.
          </p>
        </Section>

        <Section title="7. Data retention">
          <p>
            IOSHUBv2 does not retain any personal data. Retention of infrastructure logs is governed by
            Vercel's and Cloudflare's own policies.
          </p>
        </Section>

        <Section title="8. Changes to this policy">
          <p>
            We may update this policy if our infrastructure or practices change. The "last updated" date at the
            top of this page will reflect any revision.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            For privacy-related questions, requests, or general feedback about the site, contact{" "}
            <span className="text-[#F4119E]">@plzenjoygame1</span> on discord.
          </p>
        </Section>
      </div>
    </div>
  );
}
