/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
];

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.iosoccer.com" },
      { protocol: "https", hostname: "iosoccer.co.uk" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // ── Edge / CDN caching for dynamic pages (Prisma blocks ISR) ──
      // CDN-Cache-Control is read by Cloudflare but NOT sent to browsers
      {
        source: "/players/:steamId",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=60" },
          { key: "Cache-Control", value: "public, max-age=60, stale-while-revalidate=30" },
        ],
      },
      {
        source: "/players/:steamId/matches",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=60" },
          { key: "Cache-Control", value: "public, max-age=60, stale-while-revalidate=30" },
        ],
      },
      {
        source: "/teams/:id",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=60" },
          { key: "Cache-Control", value: "public, max-age=60, stale-while-revalidate=30" },
        ],
      },
      {
        source: "/matches/:id",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=60" },
          { key: "Cache-Control", value: "public, max-age=120, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/tournaments/:id",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=60" },
          { key: "Cache-Control", value: "public, max-age=120, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/matches",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=60" },
          { key: "Cache-Control", value: "public, max-age=60, stale-while-revalidate=30" },
        ],
      },
      {
        source: "/tournaments",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=60" },
          { key: "Cache-Control", value: "public, max-age=120, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/players/transfers",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=60" },
          { key: "Cache-Control", value: "public, max-age=120, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/players/h2h",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=60" },
          { key: "Cache-Control", value: "public, max-age=120, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/ratings",
        headers: [
          { key: "CDN-Cache-Control", value: "public, s-maxage=600, stale-while-revalidate=120" },
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=60" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
