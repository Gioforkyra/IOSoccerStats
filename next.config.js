/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.iosoccer.com" },
      { protocol: "https", hostname: "iosoccer.co.uk" },
    ],
  },
};

module.exports = nextConfig;
