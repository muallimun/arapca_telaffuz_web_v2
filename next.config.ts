import type { NextConfig } from "next";

// Medya deposu adresi (GitHub'a yüklenir yüklenmez anında çalışır)
const MEDIA_CDN_URL =
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
  "https://raw.githubusercontent.com/muallimun/arapca_telaffuz_medya/main/public";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "muallimun.github.io",
      },
    ],
  },
  async rewrites() {
    return {
      // Önce yerel public/ klasörüne bakar; dosya yoksa otomatik olarak medya deposundan (CDN) çeker
      fallback: [
        {
          source: "/sesler/:path*",
          destination: `${MEDIA_CDN_URL}/sesler/:path*`,
        },
        {
          source: "/gorseller/:path*",
          destination: `${MEDIA_CDN_URL}/gorseller/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;