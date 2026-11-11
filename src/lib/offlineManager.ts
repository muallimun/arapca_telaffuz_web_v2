// src/lib/offlineManager.ts
// İndirilebilir Çevrimdışı Ders Paketleri (Cache API: "muallimun-offline-audio-v1")

import {
  diyaloglar,
  metinler,
  getDialogueById,
  getReadingTextById,
} from "@/lib/data";
import { getMp3Path, toCanonicalAudioCacheKey } from "@/lib/audio";

export const OFFLINE_AUDIO_CACHE_NAME = "muallimun-offline-audio-v1";
export const OFFLINE_PWA_CACHE_NAME = "muallimun-arapca-pwa-v2.1";
const OFFLINE_STORAGE_KEY = "muallimun-offline-dialogues-v1";

// Ortalama bir diyalog cümlesi MP3 boyutu (~145 KB)
const ESTIMATED_KB_PER_SENTENCE = 145;

export interface OfflinePackDownloadResult {
  ok: boolean;
  downloadedCount: number;
  totalCount: number;
  failedUrls: string[];
}

function readStoredOfflineList(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStoredOfflineList(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const unique = Array.from(new Set(ids));
    window.localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(unique));
    window.dispatchEvent(new CustomEvent("muallimun-offline-updated"));
  } catch {
    // ignore storage errors
  }
}

/**
 * Diyalog (dlg_001 .. dlg_120) veya Okuma Metni (metin_01 .. metin_60) satırlarını kullanarak
 * ilgili içeriğin tüm çözümlenmiş MP3 URL'lerini döndürür.
 */
export async function getDialogueAudioUrls(dialogueId: string): Promise<{
  urls: string[];
  estimatedSizeMb: number;
}> {
  const urlsSet = new Set<string>();

  if (dialogueId.startsWith("metin_")) {
    const txt = getReadingTextById(dialogueId);
    if (txt && Array.isArray(txt.satirlar)) {
      for (const line of txt.satirlar) {
        urlsSet.add(getMp3Path(txt.id, line.sira));
      }
    }
  } else {
    const dlg = getDialogueById(dialogueId);
    if (dlg && Array.isArray(dlg.satirlar)) {
      for (const line of dlg.satirlar) {
        urlsSet.add(getMp3Path(dlg.id, line.sira, line.cinsiyet));
      }
    }
  }

  const urls = Array.from(urlsSet).filter(Boolean);
  const estimatedSizeMb = Number(
    Math.max(0.4, (urls.length * ESTIMATED_KB_PER_SENTENCE) / 1024).toFixed(1)
  );

  return { urls, estimatedSizeMb };
}

/**
 * Belirtilen diyaloğun veya okuma metninin tüm MP3 dosyalarının
 * Cache API'de ("muallimun-offline-audio-v1") kanonik anahtarla kayıtlı olup olmadığını kontrol eder.
 */
export async function isDialogueOfflineReady(
  dialogueId: string
): Promise<boolean> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return false;
  }
  try {
    const { urls } = await getDialogueAudioUrls(dialogueId);
    if (urls.length === 0) return false;

    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    let matchedCount = 0;
    for (const url of urls) {
      const canonicalKey = toCanonicalAudioCacheKey(url) || url;
      const match =
        (await cache.match(canonicalKey)) || (await cache.match(url));
      if (match && match.ok) {
        matchedCount += 1;
      }
    }
    const isReady = matchedCount >= urls.length;
    const stored = readStoredOfflineList();
    if (isReady && !stored.includes(dialogueId)) {
      writeStoredOfflineList([...stored, dialogueId]);
    } else if (!isReady && stored.includes(dialogueId)) {
      writeStoredOfflineList(stored.filter((id) => id !== dialogueId));
    }
    return isReady;
  } catch {
    return readStoredOfflineList().includes(dialogueId);
  }
}

/**
 * İndirilmiş olan tüm diyalogların (dlg_001..dlg_120) ve okuma metinlerinin (metin_01..metin_60)
 * ID listesini kanonik "/sesler/..." anahtarlarıyla doğrulayarak döndürür.
 */
export async function getDownloadedDialogueIds(): Promise<string[]> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return readStoredOfflineList();
  }
  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const keys = await cache.keys();
    if (keys.length === 0) {
      writeStoredOfflineList([]);
      return [];
    }

    const cachedCanonicalKeys = new Set<string>();
    for (const req of keys) {
      const canonical = toCanonicalAudioCacheKey(req.url);
      if (canonical) {
        cachedCanonicalKeys.add(canonical);
      }
      try {
        const u = new URL(req.url, window.location.origin);
        const pathCanonical = toCanonicalAudioCacheKey(u.pathname);
        if (pathCanonical) {
          cachedCanonicalKeys.add(pathCanonical);
        }
      } catch {
        // ignore
      }
    }

    const readyIds: string[] = [];

    for (const dlg of diyaloglar) {
      const { urls } = await getDialogueAudioUrls(dlg.id);
      if (
        urls.length > 0 &&
        urls.every((u) => {
          const key = toCanonicalAudioCacheKey(u);
          return Boolean(key && cachedCanonicalKeys.has(key));
        })
      ) {
        readyIds.push(dlg.id);
      }
    }

    for (const txt of metinler) {
      const { urls } = await getDialogueAudioUrls(txt.id);
      if (
        urls.length > 0 &&
        urls.every((u) => {
          const key = toCanonicalAudioCacheKey(u);
          return Boolean(key && cachedCanonicalKeys.has(key));
        })
      ) {
        readyIds.push(txt.id);
      }
    }

    writeStoredOfflineList(readyIds);
    return readyIds;
  } catch {
    return readStoredOfflineList();
  }
}

/**
 * Bir diyaloğa veya okuma metnine ait tüm cümle MP3 dosyalarını kanonik "/sesler/..." anahtarıyla
 * "muallimun-offline-audio-v1" önbelleğine indirir ve başarısız URL'leri doğrular.
 */
export async function downloadDialogueOfflinePack(
  dialogueId: string,
  onProgress?: (
    percent: number,
    completedCount: number,
    totalCount: number,
    estimatedSizeMb: number
  ) => void
): Promise<OfflinePackDownloadResult> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return {
      ok: false,
      downloadedCount: 0,
      totalCount: 0,
      failedUrls: [],
    };
  }

  const { urls, estimatedSizeMb } = await getDialogueAudioUrls(dialogueId);
  if (urls.length === 0) {
    return {
      ok: false,
      downloadedCount: 0,
      totalCount: 0,
      failedUrls: [],
    };
  }

  const failedUrls: string[] = [];
  let downloadedCount = 0;

  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const pwaCache = await caches.open(OFFLINE_PWA_CACHE_NAME);

    const dialoguePageUrl = dialogueId.startsWith("metin_")
      ? `/metin/${dialogueId}`
      : `/diyalog/${dialogueId}`;
    try {
      const pageRes = await fetch(dialoguePageUrl, { cache: "no-cache" });
      if (pageRes.ok) {
        await cache.put(dialoguePageUrl, pageRes.clone());
        await pwaCache.put(dialoguePageUrl, pageRes.clone());
      }
    } catch {
      // Sayfa önbellekleme hatası ses indirmeyi durdurmasın
    }

    let processed = 0;
    onProgress?.(0, 0, urls.length, estimatedSizeMb);

    for (const url of urls) {
      const canonicalKey = toCanonicalAudioCacheKey(url) || url;
      let itemSuccess = false;

      try {
        const existing =
          (await cache.match(canonicalKey)) || (await cache.match(url));
        if (existing && existing.ok) {
          // Eski tam URL ile kayıtlıysa kanonik anahtara da senkronize et
          if (!(await cache.match(canonicalKey))) {
            await cache.put(canonicalKey, existing.clone());
          }
          itemSuccess = true;
        } else {
          const response = await fetch(url, { cache: "no-cache" });
          if (response.ok) {
            const blob = await response.clone().blob();
            if (blob.size > 128) {
              await cache.put(canonicalKey, response.clone());
              itemSuccess = true;
            }
          }
        }
      } catch {
        itemSuccess = false;
      }

      if (itemSuccess) {
        downloadedCount += 1;
      } else {
        failedUrls.push(url);
      }

      processed += 1;
      const pct = Math.min(100, Math.round((processed / urls.length) * 100));
      onProgress?.(pct, downloadedCount, urls.length, estimatedSizeMb);
    }

    const allSucceeded = failedUrls.length === 0 && downloadedCount === urls.length;
    const stored = readStoredOfflineList();
    if (allSucceeded) {
      if (!stored.includes(dialogueId)) {
        writeStoredOfflineList([...stored, dialogueId]);
      }
    } else if (stored.includes(dialogueId)) {
      writeStoredOfflineList(stored.filter((id) => id !== dialogueId));
    }

    return {
      ok: allSucceeded,
      downloadedCount,
      totalCount: urls.length,
      failedUrls,
    };
  } catch {
    return {
      ok: false,
      downloadedCount,
      totalCount: urls.length,
      failedUrls: failedUrls.length > 0 ? failedUrls : urls,
    };
  }
}

/**
 * Tüm diyalogların ses paketlerini sırayla çevrimdışı önbelleğe indirir.
 */
export async function downloadAllDialoguesOffline(
  onProgress?: (
    percent: number,
    completedDialogues: number,
    totalDialogues: number
  ) => void
): Promise<number> {
  const total = diyaloglar.length;
  let successCount = 0;
  onProgress?.(0, 0, total);

  for (let i = 0; i < total; i++) {
    const dlg = diyaloglar[i];
    const res = await downloadDialogueOfflinePack(dlg.id);
    if (res.ok) successCount += 1;
    const pct = Math.min(100, Math.round(((i + 1) / total) * 100));
    onProgress?.(pct, i + 1, total);
  }

  return successCount;
}

/**
 * Çevrimdışı ses önbelleğini ("muallimun-offline-audio-v1") tamamen temizler.
 */
export async function clearOfflineAudioCache(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if ("caches" in window) {
      await caches.delete(OFFLINE_AUDIO_CACHE_NAME);
    }
  } catch {
    // ignore
  }
  writeStoredOfflineList([]);
}

/**
 * Oynatma sırasında URL çevrimdışı önbellekte ("muallimun-offline-audio-v1") varsa
 * internetsiz ortamda da kesintisiz çalışması için Blob URL döndürür.
 */
export async function resolveOfflineCachedAudioUrl(
  url: string
): Promise<string> {
  const canonicalKey = toCanonicalAudioCacheKey(url);
  if (
    typeof window === "undefined" ||
    !("caches" in window) ||
    !canonicalKey
  ) {
    return url;
  }
  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const matched =
      (await cache.match(canonicalKey)) || (await cache.match(url));
    if (matched && matched.ok) {
      const blob = await matched.blob();
      if (blob.size > 128) {
        return URL.createObjectURL(blob);
      }
    }
  } catch {
    // ignore
  }
  return url;
}
