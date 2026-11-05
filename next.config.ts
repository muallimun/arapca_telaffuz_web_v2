import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // YENİ: Uygulamayı kendi sunucunda çalıştırmak için gerekli olan "standalone" modu
  output: "standalone", 
  
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
    const mediaCdnBase = (
      process.env.NEXT_PUBLIC_MEDIA_CDN_BASE ||
      "https://raw.githubusercontent.com/muallimun/arapca_telaffuz_medya/main"
    ).replace(/\/+$/, "");

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
      ],
    };
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Whisper (WASM) yapay zekasının çalışması için gerekli güvenlik başlıkları
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          // Ek Güvenlik Başlıkları (Clickjacking, MIME Sniffing, Referrer, Mikrofon ve CSP)
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
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: data: https://cdn.jsdelivr.net; worker-src 'self' blob: data:; connect-src 'self' blob: data: https://raw.githubusercontent.com https://huggingface.co https://*.hf.co https://*.huggingface.co https://cdn.jsdelivr.net; img-src 'self' data: blob: https://raw.githubusercontent.com https://cdn.jsdelivr.net https:; media-src 'self' data: blob: https://raw.githubusercontent.com https://cdn.jsdelivr.net https:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;