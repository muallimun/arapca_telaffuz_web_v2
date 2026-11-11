// src/lib/audio.ts
// 3 Katmanlı Hibrit ve Doğal Arapça Seslendirme Motoru (V2 /sesler/ Mimarisi):
// Katman 1: Yerel / CDN MP3 (/sesler/diyaloglar/..., /sesler/metinler/..., /sesler/kelimeler/{erkek|kadin}/..., /sesler/cumleler/{erkek|kadin}/..., /sesler/atasozleri/{erkek|kadin}/...)
// Katman 2: Sunucu Destekli Neural TTS API (/api/tts - HamedNeural / ZariyahNeural + Google TTS Fallback) + Bellek/CacheStorage Önbelleği
// Katman 3: Akıllı Web Speech API (Offline Fallback - en kaliteli Arapça sistem sesini seçer)

import {
  atasozleri,
  cumleler1111,
  getDialogueById,
  getReadingTextById,
  gorselKelimeler,
  resolveAudioUrl,
  sozluk,
} from "@/lib/data";
import { useSettings, VoiceGender } from "@/store/settings";

export type VoiceOption =
  | "male"
  | "female"
  | "E"
  | "K"
  | "erkek"
  | "kadin"
  | "ar-SA-HamedNeural"
  | "ar-SA-ZariyahNeural";

let activeAudio: HTMLAudioElement | null = null;
let audioManifest: Record<string, string[]> | null = null;

// İstemci tarafı bellek içi Blob URL önbelleği (50 öğelik LRU sınırı + URL.revokeObjectURL)
const MEMORY_BLOB_CACHE_MAX = 50;
const memoryBlobUrlCache = new Map<string, string>();
const TTS_CACHE_STORAGE_NAME = "arabic-neural-tts-cache-v2";

function getMemoryBlobUrl(cacheKey: string): string | null {
  const existing = memoryBlobUrlCache.get(cacheKey);
  if (!existing) return null;
  // LRU yenilemesi: anahtarı en sona taşı
  memoryBlobUrlCache.delete(cacheKey);
  memoryBlobUrlCache.set(cacheKey, existing);
  return existing;
}

function setMemoryBlobUrl(cacheKey: string, blobUrl: string): void {
  if (memoryBlobUrlCache.has(cacheKey)) {
    const prev = memoryBlobUrlCache.get(cacheKey);
    if (prev && prev !== blobUrl) {
      try {
        URL.revokeObjectURL(prev);
      } catch {
        // ignore
      }
    }
    memoryBlobUrlCache.delete(cacheKey);
  }
  while (memoryBlobUrlCache.size >= MEMORY_BLOB_CACHE_MAX) {
    const oldestKey = memoryBlobUrlCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldestUrl = memoryBlobUrlCache.get(oldestKey);
    memoryBlobUrlCache.delete(oldestKey);
    if (oldestUrl) {
      try {
        URL.revokeObjectURL(oldestUrl);
      } catch {
        // ignore
      }
    }
  }
  memoryBlobUrlCache.set(cacheKey, blobUrl);
}

/**
 * Hem tam CDN URL'lerini (https://raw.githubusercontent.com/.../public/sesler/... veya jsDelivr)
 * hem de göreli /sesler/... yollarını tekil kanonik "/sesler/..." Cache API anahtarına dönüştürür.
 */
export function toCanonicalAudioCacheKey(rawUrl: string): string {
  if (!rawUrl || rawUrl.startsWith("blob:") || rawUrl.startsWith("data:")) {
    return "";
  }
  const clean = rawUrl.trim().split("?")[0].split("#")[0];
  const seslerIdx = clean.indexOf("/sesler/");
  if (seslerIdx !== -1) {
    return clean.slice(seslerIdx);
  }
  if (clean.startsWith("sesler/")) {
    return `/${clean}`;
  }
  if (clean.startsWith("/")) {
    return clean;
  }
  return "";
}

export async function loadAudioManifest(): Promise<Record<string, string[]>> {
  if (audioManifest) return audioManifest;
  audioManifest = {};
  return audioManifest;
}

export function getPreferredVoiceGender(): VoiceGender {
  try {
    return useSettings.getState().preferredVoiceGender || "erkek";
  } catch {
    return "erkek";
  }
}

export function hasMp3(contentId: string, sira: number): boolean {
  if (!contentId || sira < 1) return false;
  // 120 diyaloğun (dlg_001 - dlg_120) ve 60 okuma metninin (metin_01 - metin_60) tüm satırları için V2 /sesler/ MP3 önceliği
  if (/^(dlg|metin)_\d+$/i.test(contentId)) {
    return true;
  }
  if (!audioManifest || !audioManifest[contentId]) return false;
  const entry = audioManifest[contentId];
  if (Array.isArray(entry)) {
    const siraStr = String(sira);
    const padded = siraStr.padStart(3, "0");
    return (
      entry.includes(siraStr) ||
      entry.includes(padded) ||
      entry.some((item) => String(item) === siraStr)
    );
  }
  return Boolean((entry as Record<string, string>)[String(sira)]);
}

export function getMp3Path(
  contentId: string,
  sira: number,
  speakerGender?: "E" | "K"
): string {
  if (!contentId) return "";

  // 1. Okuma metni ise (metin_01 .. metin_60)
  if (contentId.startsWith("metin_")) {
    const txt = getReadingTextById(contentId);
    const line = txt?.satirlar?.find((l) => l.sira === sira);
    if (line?.ses_dosyasi) {
      return resolveAudioUrl(line.ses_dosyasi);
    }
    const num2 = String(parseInt(contentId.replace(/\D+/g, ""), 10) || 1).padStart(
      2,
      "0"
    );
    const sira2 = String(sira).padStart(2, "0");
    return resolveAudioUrl(`/sesler/metinler/metin_${num2}/satir_${sira2}.mp3`);
  }

  // 2. Diyalog ise (dlg_001 .. dlg_120)
  const dlg = getDialogueById(contentId);
  const line = dlg?.satirlar?.find((l) => l.sira === sira);
  if (line?.ses_dosyasi) {
    return resolveAudioUrl(line.ses_dosyasi);
  }

  const num3 = String(parseInt(contentId.replace(/\D+/g, ""), 10) || 1).padStart(
    3,
    "0"
  );
  const sira2 = String(sira).padStart(2, "0");
  const genderCode = speakerGender || line?.cinsiyet || "E";
  return resolveAudioUrl(
    `/sesler/diyaloglar/dlg_${num3}/satir_${sira2}_${genderCode}.mp3`
  );
}

export function getFallbackMp3Path(contentId: string, sira: number): string {
  return getMp3Path(contentId, sira);
}

/**
 * Çift cinsiyetli (erkek/ ve kadin/) ses dosyası bulunan öğeler (Kelime, 1111 Cümle, 508 Atasözü)
 * için aktif veya belirtilen cinsiyete uygun ses URL'sini döndürür.
 */
export function getDualGenderAudioUrl(
  item: {
    id?: string;
    ses_erkek?: string;
    ses_kadin?: string;
  },
  genderOverride?: VoiceGender
): string | undefined {
  const gender = genderOverride || getPreferredVoiceGender();
  const rawPath = gender === "kadin" ? item.ses_kadin : item.ses_erkek;
  if (rawPath) {
    // Kelimeler ve Atasözleri GitHub medya deposunda .wav formatındadır
    if (
      rawPath.includes("/kelimeler/") ||
      rawPath.includes("/atasozleri/") ||
      (item.id && (item.id.startsWith("ata_") || /^\d{4}_/.test(item.id)))
    ) {
      return resolveAudioUrl(rawPath.replace(/\.mp3$/i, ".wav"));
    }
    return resolveAudioUrl(rawPath);
  }
  if (item.id) {
    if (item.id.startsWith("cumle_")) {
      return resolveAudioUrl(`/sesler/cumleler/${gender}/${item.id}.mp3`);
    }
    if (item.id.startsWith("ata_")) {
      return resolveAudioUrl(`/sesler/atasozleri/${gender}/${item.id}.wav`);
    }
    if (/^\d{4}_/.test(item.id)) {
      return resolveAudioUrl(`/sesler/kelimeler/${gender}/${item.id}.wav`);
    }
  }
  return undefined;
}

export function setActiveAudio(audio: HTMLAudioElement | null) {
  activeAudio = audio;
}

export function stopAllAudio() {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.src = "";
      activeAudio.onended = null;
      activeAudio.onerror = null;
    } catch {
      // sessizce geç
    }
    activeAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // sessizce geç
    }
  }
}

function normalizeVoiceGender(voice?: VoiceOption): "male" | "female" {
  if (!voice) {
    return getPreferredVoiceGender() === "kadin" ? "female" : "male";
  }
  if (
    voice === "female" ||
    voice === "K" ||
    voice === "kadin" ||
    voice === "ar-SA-ZariyahNeural"
  ) {
    return "female";
  }
  return "male";
}

/**
 * Katman 3: Akıllı Web Speech API Seçicisi (Çevrimdışı / Hata durumunda devreye girer)
 */
function pickBestArabicVoice(
  gender: "male" | "female"
): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const arabicVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith("ar") ||
      v.name.includes("Arabic") ||
      v.name.includes("العربية")
  );

  if (arabicVoices.length === 0) return null;

  const scored = arabicVoices.map((v) => {
    let score = 0;
    const nameL = v.name.toLowerCase();
    const langL = v.lang.toLowerCase();

    if (langL === "ar-sa") score += 30;
    else if (langL === "ar-eg" || langL === "ar-ae") score += 25;
    else score += 15;

    if (nameL.includes("natural") || nameL.includes("neural")) score += 40;
    if (nameL.includes("google") || nameL.includes("microsoft")) score += 25;
    if (
      nameL.includes("hamed") ||
      nameL.includes("zariyah") ||
      nameL.includes("salma") ||
      nameL.includes("shakir") ||
      nameL.includes("maged") ||
      nameL.includes("tarik") ||
      nameL.includes("laila")
    ) {
      score += 20;
    }

    if (gender === "female") {
      if (
        nameL.includes("zariyah") ||
        nameL.includes("salma") ||
        nameL.includes("laila") ||
        nameL.includes("female") ||
        nameL.includes("amira")
      ) {
        score += 18;
      }
    } else {
      if (
        nameL.includes("hamed") ||
        nameL.includes("shakir") ||
        nameL.includes("maged") ||
        nameL.includes("tarik") ||
        nameL.includes("male") ||
        nameL.includes("naayf")
      ) {
        score += 18;
      }
    }

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].voice;
}

export function playWebSpeechFallback(
  text: string,
  rate: number = 1,
  voice?: VoiceOption,
  langOverride?: "ar-SA" | "tr-TR"
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    stopAllAudio();
    const gender = normalizeVoiceGender(voice);
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const targetLang = langOverride || (isArabic ? "ar-SA" : "tr-TR");

    let hasSpokenOnce = false;
    let fallbackVoiceTimer: ReturnType<typeof setTimeout> | null = null;

    const speakNow = () => {
      if (hasSpokenOnce) return;
      hasSpokenOnce = true;
      if (fallbackVoiceTimer !== null) {
        clearTimeout(fallbackVoiceTimer);
        fallbackVoiceTimer = null;
      }
      window.speechSynthesis.onvoiceschanged = null;

      const utterance = new SpeechSynthesisUtterance(text);
      if (targetLang === "ar-SA") {
        const bestVoice = pickBestArabicVoice(gender);
        if (bestVoice) {
          utterance.voice = bestVoice;
          utterance.lang = bestVoice.lang;
        } else {
          utterance.lang = "ar-SA";
        }
      } else {
        const voices = window.speechSynthesis.getVoices();
        const trVoice = voices.find((v) =>
          v.lang.toLowerCase().startsWith("tr")
        );
        if (trVoice) {
          utterance.voice = trVoice;
          utterance.lang = trVoice.lang;
        } else {
          utterance.lang = "tr-TR";
        }
      }
      utterance.rate = rate;
      utterance.pitch = gender === "female" ? 1.05 : 0.98;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speakNow();
      };
      fallbackVoiceTimer = setTimeout(speakNow, 250);
    } else {
      speakNow();
    }
  });
}

export function playTurkishTTS(text: string, rate: number = 1): Promise<void> {
  return playWebSpeechFallback(text, rate, "male", "tr-TR");
}

/**
 * Katman 2: /api/tts üzerinden Neural TTS Sesini İndir ve Önbellekle (Memory + CacheStorage)
 */
async function getOrFetchNeuralTtsBlobUrl(
  text: string,
  gender: "male" | "female"
): Promise<string | null> {
  const cleanText = text.trim();
  if (!cleanText) return null;

  const cacheKey = `${gender}:${cleanText}`;
  const cachedMemUrl = getMemoryBlobUrl(cacheKey);
  if (cachedMemUrl) {
    return cachedMemUrl;
  }

  const requestUrl = `/api/tts?text=${encodeURIComponent(
    cleanText
  )}&voice=${gender}`;

  try {
    if (typeof window !== "undefined" && "caches" in window) {
      try {
        const cache = await caches.open(TTS_CACHE_STORAGE_NAME);
        const cachedRes = await cache.match(requestUrl);
        if (cachedRes && cachedRes.ok) {
          const blob = await cachedRes.blob();
          if (blob.size > 128) {
            const blobUrl = URL.createObjectURL(blob);
            setMemoryBlobUrl(cacheKey, blobUrl);
            return blobUrl;
          }
        }
      } catch {
        // CacheStorage erişilemezse devam et
      }
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return null;
    }

    const res = await fetch(requestUrl);
    if (!res.ok) return null;

    const blob = await res.blob();
    if (blob.size <= 128) return null;

    if (typeof window !== "undefined" && "caches" in window) {
      try {
        const cache = await caches.open(TTS_CACHE_STORAGE_NAME);
        await cache.put(
          requestUrl,
          new Response(blob, {
            headers: { "Content-Type": "audio/mpeg" },
          })
        );
      } catch {
        // sessizce geç
      }
    }

    const blobUrl = URL.createObjectURL(blob);
    setMemoryBlobUrl(cacheKey, blobUrl);
    return blobUrl;
  } catch {
    return null;
  }
}

function applyPlaybackRateAndPitch(audio: HTMLAudioElement, rate: number) {
  const clampedRate = Math.min(1.5, Math.max(0.5, Number(rate) || 1.0));
  audio.defaultPlaybackRate = clampedRate;
  audio.playbackRate = clampedRate;
  audio.preservesPitch = true;
  const extAudio = audio as HTMLAudioElement & {
    webkitPreservesPitch?: boolean;
    mozPreservesPitch?: boolean;
  };
  if ("webkitPreservesPitch" in extAudio) {
    extAudio.webkitPreservesPitch = true;
  }
  if ("mozPreservesPitch" in extAudio) {
    extAudio.mozPreservesPitch = true;
  }
}

export function setActiveAudioPlaybackRate(rate: number) {
  if (activeAudio) {
    try {
      applyPlaybackRateAndPitch(activeAudio, rate);
    } catch {
      // ignore
    }
  }
}

// 404 dönen uzak medya URL'lerini oturum boyunca hatırlayarak anında Neural TTS'e yönlendirir
const missingRemoteAudioUrls = new Set<string>();
const AUDIO_LOAD_TIMEOUT_MS = 4500;

/**
 * Bir ses dosyası URL'si 404 döndüğünde (örn. cumle_1103..1111 kadın/erkek MP3 dosyaları),
 * URL yolundan ilgili Arapça metni ve ses cinsiyetini otomatik çözümler.
 */
function inferFallbackTextAndVoiceFromUrl(
  url: string
): { text: string; voice: VoiceOption } | null {
  if (!url || url.startsWith("blob:") || url.includes("/api/tts")) {
    return null;
  }

  const genderFromPath: VoiceOption = /\/kadin\/|_K\.mp3$/i.test(url)
    ? "kadin"
    : /\/erkek\/|_E\.mp3$/i.test(url)
    ? "erkek"
    : getPreferredVoiceGender();

  // 1. 1111 Kalıp Cümle (cumle_XXXX)
  const cumleMatch = url.match(/(cumle_\d{4})/i);
  if (cumleMatch) {
    const id = cumleMatch[1].toLowerCase();
    const found = cumleler1111.find((c) => c.id.toLowerCase() === id);
    if (found?.arapca) {
      return { text: found.arapca, voice: genderFromPath };
    }
  }

  // 2. 508 Atasözü (ata_XXXX)
  const ataMatch = url.match(/(ata_\d{4})/i);
  if (ataMatch) {
    const id = ataMatch[1].toLowerCase();
    const found = atasozleri.find((a) => a.id.toLowerCase() === id);
    if (found?.arapca) {
      return { text: found.arapca, voice: genderFromPath };
    }
  }

  // 3. Diyalog satırı (/diyaloglar/dlg_XXX/satir_YY_E.mp3)
  const dlgMatch = url.match(/\/diyaloglar\/(dlg_\d+)\/satir_(\d+)/i);
  if (dlgMatch) {
    const dlg = getDialogueById(dlgMatch[1].toLowerCase());
    const sira = parseInt(dlgMatch[2], 10);
    const line = dlg?.satirlar?.find((l) => l.sira === sira);
    if (line?.arapca) {
      return {
        text: line.arapca,
        voice: line.cinsiyet === "K" ? "kadin" : genderFromPath,
      };
    }
  }

  // 4. Okuma Metni satırı (/metinler/metin_XX/satir_YY.mp3)
  const metinMatch = url.match(/\/metinler\/(metin_\d+)\/satir_(\d+)/i);
  if (metinMatch) {
    const txt = getReadingTextById(metinMatch[1].toLowerCase());
    const sira = parseInt(metinMatch[2], 10);
    const line = txt?.satirlar?.find((l) => l.sira === sira);
    if (line?.arapca) {
      return { text: line.arapca, voice: genderFromPath };
    }
  }

  // 5. Görsel Kelime veya Sözlük (/kelimeler/{erkek|kadin}/XXXX_...)
  const wordFileMatch = url.match(/\/kelimeler\/(?:erkek|kadin)\/([^/.?]+)/i);
  if (wordFileMatch) {
    const rawId = decodeURIComponent(wordFileMatch[1]);
    const gk = gorselKelimeler.find((w) => w.id === rawId);
    if (gk?.arapca) {
      return { text: gk.arapca, voice: genderFromPath };
    }
    const dictWord = sozluk.find((w) => w.id === rawId);
    const dictAr = dictWord?.mufret || dictWord?.mazi;
    if (dictAr) {
      return { text: dictAr, voice: genderFromPath };
    }
  }

  return null;
}

function playSingleAudioUrl(url: string, rate: number = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("Empty audio URL"));
      return;
    }

    const isBlobOrLocalApi =
      url.startsWith("blob:") || url.startsWith("data:") || url.includes("/api/tts");

    if (!isBlobOrLocalApi && missingRemoteAudioUrls.has(url)) {
      reject(new Error("Known missing remote audio URL"));
      return;
    }

    stopAllAudio();
    const audio = new Audio(url);
    audio.preload = "auto";
    applyPlaybackRateAndPitch(audio, rate);
    activeAudio = audio;

    let settled = false;
    let loadWatchdog: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (activeAudio === audio) {
        try {
          audio.pause();
          audio.src = "";
        } catch {
          // ignore
        }
        activeAudio = null;
      }
      reject(new Error("Audio startup timeout"));
    }, AUDIO_LOAD_TIMEOUT_MS);

    const clearWatchdog = () => {
      if (loadWatchdog !== null) {
        clearTimeout(loadWatchdog);
        loadWatchdog = null;
      }
    };

    audio.onloadedmetadata = () => {
      clearWatchdog();
      applyPlaybackRateAndPitch(audio, rate);
    };

    audio.oncanplay = () => {
      clearWatchdog();
      applyPlaybackRateAndPitch(audio, rate);
    };

    audio.onplay = () => {
      applyPlaybackRateAndPitch(audio, rate);
    };

    audio.onplaying = () => {
      clearWatchdog();
      applyPlaybackRateAndPitch(audio, rate);
    };

    audio.onended = () => {
      clearWatchdog();
      if (settled) return;
      settled = true;
      if (activeAudio === audio) activeAudio = null;
      resolve();
    };

    audio.onerror = () => {
      clearWatchdog();
      if (settled) return;
      settled = true;
      if (!isBlobOrLocalApi) {
        missingRemoteAudioUrls.add(url);
      }
      if (activeAudio === audio) activeAudio = null;
      reject(new Error("Audio playback failed"));
    };

    audio.play().catch((err) => {
      clearWatchdog();
      if (settled) return;
      settled = true;
      if (activeAudio === audio) activeAudio = null;
      reject(err);
    });
  });
}

async function playAudioElementCore(
  url: string,
  rate: number = 1
): Promise<void> {
  let effectiveUrl = url;
  let tempOfflineBlobUrl: string | null = null;
  const canonicalKey = toCanonicalAudioCacheKey(url);
  if (
    typeof window !== "undefined" &&
    "caches" in window &&
    canonicalKey
  ) {
    try {
      const cache = await caches.open("muallimun-offline-audio-v1");
      const matched =
        (await cache.match(canonicalKey)) || (await cache.match(url));
      if (matched && matched.ok) {
        const blob = await matched.blob();
        if (blob.size > 128) {
          tempOfflineBlobUrl = URL.createObjectURL(blob);
          effectiveUrl = tempOfflineBlobUrl;
        }
      }
    } catch {
      // ignore cache lookup failure
    }
  }
  try {
    await playSingleAudioUrl(effectiveUrl, rate);
  } finally {
    if (tempOfflineBlobUrl) {
      try {
        URL.revokeObjectURL(tempOfflineBlobUrl);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Herhangi bir ses URL'sini (Yerel/CDN MP3 veya Neural TTS Blob URL) oynatır.
 * Eğer uzak MP3/WAV dosyası eksikse (örn. cumle_1103..1111) URL'den Arapça metni çözümleyip
 * kullanıcıyı sessiz bırakmadan otomatik /api/tts -> Web Speech yedek zincirini devreye sokar.
 */
export async function playAudioElement(
  url: string,
  rate: number = 1
): Promise<void> {
  try {
    await playAudioElementCore(url, rate);
  } catch (err) {
    const inferred = inferFallbackTextAndVoiceFromUrl(url);
    if (inferred?.text) {
      await playTTS(inferred.text, rate, inferred.voice);
      return;
    }
    throw err;
  }
}

/**
 * Ana TTS Fonksiyonu (Katman 2 Neural TTS -> Katman 3 Akıllı Web Speech Fallback)
 */
export async function playTTS(
  text: string,
  rate: number = 1,
  voice?: VoiceOption
): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;

  const gender = normalizeVoiceGender(voice);

  // Katman 2: Doğal Neural TTS (/api/tts + Önbellek)
  const neuralBlobUrl = await getOrFetchNeuralTtsBlobUrl(cleanText, gender);
  if (neuralBlobUrl) {
    try {
      await playAudioElementCore(neuralBlobUrl, rate);
      return;
    } catch {
      // Oynatma hatası olursa Katman 3'e düş
    }
  }

  // Katman 3: Gelişmiş Web Speech API Fallback
  await playWebSpeechFallback(cleanText, rate, gender);
}

/**
 * Çift cinsiyetli (erkek/ ve kadin/) ses dosyası bulunan öğeleri (Kelime, 1111 Cümle, 508 Atasözü)
 * önce /sesler/... MP3 yolundan oynatır, bulunamazsa seçili cinsiyetin Neural TTS sesiyle okur.
 */
export async function playDualGenderAudio(options: {
  text: string;
  id?: string;
  ses_erkek?: string;
  ses_kadin?: string;
  gender?: VoiceGender;
  rate?: number;
}): Promise<void> {
  const { text, id, ses_erkek, ses_kadin, gender, rate = 1 } = options;
  const activeGender = gender || getPreferredVoiceGender();
  const mp3Url = getDualGenderAudioUrl({ id, ses_erkek, ses_kadin }, activeGender);

  if (mp3Url && !missingRemoteAudioUrls.has(mp3Url)) {
    try {
      await playAudioElementCore(mp3Url, rate);
      return;
    } catch {
      // MP3 bulunamazsa (örn. cumle_1103..1111) kesintisiz Neural TTS'e geç
    }
  }

  await playTTS(text, rate, activeGender);
}

/**
 * 3 Katmanlı Hibrit Cümle/Kelime Seslendirici:
 * 1. Yerel / CDN MP3 (/sesler/...) varsa MP3 çalar
 * 2. Yoksa /api/tts üzerinden Doğal Neural TTS çalar (önbellekli)
 * 3. Çevrimdışıysa Akıllı Web Speech API çalar
 */
export async function speakHybrid(options: {
  text: string;
  rate?: number;
  voice?: VoiceOption;
  dialogueId?: string;
  lineSira?: number;
  wordId?: string;
}): Promise<void> {
  const {
    text,
    rate = 1,
    voice,
    dialogueId,
    lineSira,
    wordId,
  } = options;

  // Katman 1A: Diyalog veya Okuma Metni satırı MP3 kontrolü (/sesler/diyaloglar/... veya /sesler/metinler/...)
  if (dialogueId && lineSira !== undefined && hasMp3(dialogueId, lineSira)) {
    const dlgMp3Url = getMp3Path(dialogueId, lineSira);
    if (dlgMp3Url && !missingRemoteAudioUrls.has(dlgMp3Url)) {
      try {
        await playAudioElementCore(dlgMp3Url, rate);
        return;
      } catch {
        // MP3 yüklenemezse Katman 2 Neural TTS'e geç
      }
    }
  }

  // Katman 1B: Sözlük / Görsel Kelime yerel/CDN MP3 kontrolü (/sesler/kelimeler/{erkek|kadin}/...)
  if (wordId) {
    const foundWord = sozluk.find((w) => w.id === wordId);
    const activeGender: VoiceGender =
      voice === "female" || voice === "K" || voice === "kadin"
        ? "kadin"
        : voice === "male" || voice === "E" || voice === "erkek"
        ? "erkek"
        : getPreferredVoiceGender();
    const wordMp3 = getDualGenderAudioUrl(
      {
        id: wordId,
        ses_erkek: foundWord?.ses_erkek,
        ses_kadin: foundWord?.ses_kadin,
      },
      activeGender
    );
    if (wordMp3 && !missingRemoteAudioUrls.has(wordMp3)) {
      try {
        await playAudioElementCore(wordMp3, rate);
        return;
      } catch {
        // Katman 2'ye geç
      }
    }
  }

  // Katman 2 & 3: Neural TTS -> Web Speech Fallback
  await playTTS(text, rate, voice);
}

export function getActiveAudio(): HTMLAudioElement | null {
  return activeAudio;
}

export interface WordTimingSegment {
  index: number;
  word: string;
  weight: number;
  startRatio: number;
  endRatio: number;
}

/**
 * Fonetik Ağırlıklı Kelime Zamanlama Motoru:
 * Harf sayısı + Med harfleri (ا، و، ي، ى، ٰ -> +1.5 ağırlık) + Şedde (\u0651 -> +1.2 ağırlık) + Noktalama duraksaması (، . ؟ ! ؛ : -> +2.0 ağırlık)
 */
export function calculateWordPhoneticWeights(sentence: string): {
  segments: WordTimingSegment[];
  totalWeight: number;
  estimatedDurationSec: number;
} {
  const words = sentence.split(" ");
  const rawWeights: { index: number; word: string; weight: number }[] = [];

  words.forEach((word, index) => {
    const trimmed = word.trim();
    if (!trimmed) {
      rawWeights.push({ index, word, weight: 0.2 });
      return;
    }

    const baseLetters = (trimmed.match(/[\u0621-\u064A]/g) || []).length;
    const maddCount = (trimmed.match(/[اويى\u0670]/g) || []).length;
    const shaddaCount = (trimmed.match(/\u0651/g) || []).length;
    const hasPunctPause = /[،.؟!؛:,?]/.test(trimmed);

    const weight =
      Math.max(1, baseLetters) +
      maddCount * 1.5 +
      shaddaCount * 1.2 +
      (hasPunctPause ? 2.0 : 0);

    rawWeights.push({ index, word, weight });
  });

  const totalWeight =
    rawWeights.reduce((sum, item) => sum + item.weight, 0) || 1;

  let cumulative = 0;
  const segments: WordTimingSegment[] = rawWeights.map((item) => {
    const startRatio = cumulative / totalWeight;
    cumulative += item.weight;
    const endRatio = cumulative / totalWeight;
    return {
      index: item.index,
      word: item.word,
      weight: item.weight,
      startRatio,
      endRatio,
    };
  });

  const estimatedDurationSec = Math.max(1.2, totalWeight * 0.088);

  return { segments, totalWeight, estimatedDurationSec };
}

export function getWordIndexAtProgress(
  segments: WordTimingSegment[],
  progressRatio: number
): { wordIndex: number; wordProgress: number } {
  if (segments.length === 0) {
    return { wordIndex: 0, wordProgress: 0 };
  }
  const clamped = Math.max(0, Math.min(0.9999, progressRatio));
  for (const seg of segments) {
    if (clamped >= seg.startRatio && clamped <= seg.endRatio) {
      const span = Math.max(0.0001, seg.endRatio - seg.startRatio);
      const wordProgress = Math.max(
        0,
        Math.min(1, (clamped - seg.startRatio) / span)
      );
      return { wordIndex: seg.index, wordProgress };
    }
  }
  const last = segments[segments.length - 1];
  return { wordIndex: last.index, wordProgress: 1 };
}