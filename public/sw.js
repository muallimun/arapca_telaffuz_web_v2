const CACHE_NAME = "muallimun-arapca-pwa-v2.2";
const OFFLINE_AUDIO_CACHE = "muallimun-offline-audio-v1";
const PROTECTED_CACHES = ["muallimun-offline-audio-v1", "transformers-cache"];
const EXTRA_PRESERVED_CACHES = ["arabic-neural-tts-cache-v2"];
const OFFLINE_URL = "/offline";

const PRECACHE_ASSETS = [
  "/",
  "/offline",
  "/kutuphane",
  "/alistirmalar",
  "/sozluk",
  "/seviye-tespit",
  "/ayarlar",
  "/fonts/Arakom.ttf",
  "/manifest.webmanifest",
  "/icons/favicon.ico",
  "/icons/favicon-16x16.png",
  "/icons/favicon-32x32.png",
  "/icons/apple-touch-icon.png",
  "/icons/android-chrome-192x192.png",
  "/icons/android-chrome-512x512.png",
];

function extractCanonicalMediaPath(urlObj) {
  const pathname = urlObj.pathname;
  if (pathname.startsWith("/sesler/") || pathname.startsWith("/gorseller/")) {
    return pathname;
  }
  const seslerIdx = pathname.indexOf("/sesler/");
  if (seslerIdx !== -1) {
    return pathname.slice(seslerIdx);
  }
  const gorsellerIdx = pathname.indexOf("/gorseller/");
  if (gorsellerIdx !== -1) {
    return pathname.slice(gorsellerIdx);
  }
  return "";
}

// Kurulum: Temel uygulama kabuğunu Promise.allSettled ile güvenli şekilde önbelleğe al
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(PRECACHE_ASSETS.map((asset) => cache.add(asset)))
      )
      .then(() => self.skipWaiting())
  );
});

// Aktivasyon: PROTECTED_CACHES (çevrimdışı sesler ve Whisper modeli) dışındaki eski önbellekleri temizle
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== CACHE_NAME &&
              !PROTECTED_CACHES.includes(cacheName) &&
              !EXTRA_PRESERVED_CACHES.includes(cacheName)
            ) {
              return caches.delete(cacheName);
            }
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: API/POST doğrudan ağ, /sesler/* ve /gorseller/* cache-first (muallimun-offline-audio-v1), navigasyon network-first
self.addEventListener("fetch", (event) => {
  const { request } = event;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (!url.protocol.startsWith("http")) {
    return;
  }

  // 1) /api/* (admin, tts, stt, stats, feedback) ve POST isteklerini önbelleklemeden doğrudan ağa yönlendir
  if (
    request.method === "POST" ||
    (url.origin === self.location.origin &&
      (url.pathname === "/api" || url.pathname.startsWith("/api/")))
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  // 2) /sesler/* ve /gorseller/* isteklerinde önce muallimun-offline-audio-v1 önbelleğine bak (cache-first), yoksa ağdan çek
  const canonicalMediaPath = extractCanonicalMediaPath(url);
  if (canonicalMediaPath) {
    event.respondWith(
      (async () => {
        const offlineMediaCache = await caches.open(OFFLINE_AUDIO_CACHE);
        const cachedMedia =
          (await offlineMediaCache.match(canonicalMediaPath)) ||
          (await offlineMediaCache.match(request)) ||
          (await caches.match(canonicalMediaPath)) ||
          (await caches.match(request));
        if (cachedMedia) {
          return cachedMedia;
        }

        const networkResponse = await fetch(request);
        if (
          canonicalMediaPath.startsWith("/gorseller/") &&
          networkResponse &&
          networkResponse.status === 200 &&
          !request.headers.get("range") &&
          (networkResponse.type === "basic" || networkResponse.type === "cors")
        ) {
          const responseClone = networkResponse.clone();
          offlineMediaCache
            .put(canonicalMediaPath, responseClone)
            .catch(() => {});
        }
        return networkResponse;
      })()
    );
    return;
  }

  // Yalnızca aynı origin'deki diğer istekleri işle
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.endsWith(".wasm") || request.headers.get("range")) {
    return;
  }

  // 3) Sayfa navigasyonlarında (request.mode === "navigate") network-first; çevrimdışıyken önbellek veya /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === "basic" || networkResponse.type === "cors")
          ) {
            const responseClone = networkResponse.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone).catch(() => {}));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse =
            (await caches.match(request)) ||
            (await caches.match(url.pathname));
          if (cachedResponse) {
            return cachedResponse;
          }
          const cache = await caches.open(CACHE_NAME);
          const offlineResponse =
            (await cache.match(OFFLINE_URL)) ||
            (await caches.match(OFFLINE_URL));
          if (offlineResponse) {
            return offlineResponse;
          }
          return new Response(
            '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Çevrimdışı Mod — Muallimun Arapça</title></head><body style="text-align:center;margin-top:50px;font-family:sans-serif;"><h1>Çevrimdışı Mod</h1><p>Lütfen internet bağlantınızı kontrol edin.</p></body></html>',
            {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          );
        })
    );
    return;
  }

  // Next.js RSC (React Server Components) istekleri: Network-first + çevrimdışı önbellek yedeği
  const isRscRequest =
    url.searchParams.has("_rsc") || request.headers.get("RSC") === "1";

  if (isRscRequest) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === "basic" || networkResponse.type === "cors")
          ) {
            const responseClone = networkResponse.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone).catch(() => {}));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached =
            (await caches.match(request)) ||
            (await caches.match(url.pathname));
          if (cached) return cached;
          return new Response("", { status: 504 });
        })
    );
    return;
  }

  // Statik uygulama kabuğu dosyaları (fontlar, ikonlar, CSS, JS) için: Cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status === 206) {
          return networkResponse;
        }
        if (
          networkResponse.status === 200 &&
          (networkResponse.type === "basic" || networkResponse.type === "cors")
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });
        }
        return networkResponse;
      });
    })
  );
});