import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uygulamayı kendi sunucunda çalıştırmak için gerekli olan "standalone" modu
  output: "standalone",

  typescript: {
    // Vercel build sırasında TS tip uyarılarının dağıtımı durdurmasını engeller
    ignoreBuildErrors: true,
  },

  experimental: {
    agentFeedback: false,
  },

  // Transformers paketini sunucu tarafında paketleme
  serverExternalPackages: ["@huggingface/transformers"],

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async rewrites() {
    const rawBase = (
      process.env.NEXT_PUBLIC_MEDIA_CDN_BASE ||
      "https://raw.githubusercontent.com/muallimun/arapca_telaffuz_medya/main/public"
    ).replace(/\/+$/, "");
    const mediaCdnBase = rawBase.endsWith("/main")
      ? `${rawBase}/public`
      : rawBase;

    return {
      fallback: [
        {
          source: "/gorseller/:path*",
          destination: `${mediaCdnBase}/gorseller/:path*`,
        },
        {
          source: "/sesler/:path*",
          destination: `${mediaCdnBase}/sesler/:path*`,
        },
        {
          source: "/efect/:path*",
          destination:
            "https://raw.githubusercontent.com/muallimun/arapca_telaffuz_medya/main/efect/:path*",
        },
      ],
    };
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "Permissions-Policy", value: "microphone=(self)" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: data: https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; worker-src 'self' blob: data:; connect-src 'self' blob: data: https://raw.githubusercontent.com https://huggingface.co https://*.hf.co https://*.huggingface.co https://cdn.jsdelivr.net https://www.youtube.com https://*.googlevideo.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be; child-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com; img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://*.ytimg.com https://raw.githubusercontent.com https://cdn.jsdelivr.net https:; media-src 'self' blob: data: https://*.googlevideo.com https://raw.githubusercontent.com https://cdn.jsdelivr.net https:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;