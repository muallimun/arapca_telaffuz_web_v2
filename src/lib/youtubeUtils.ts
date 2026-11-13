import {
  YoutubeCategory,
  YoutubeRecommendationItem,
} from "@/types/data";

export interface YoutubeCategoryMeta {
  id: YoutubeCategory;
  label: string;
  shortLabel: string;
  emoji: string;
  arabicTitle: string;
  gradientClass: string;
  badgeClass: string;
  description: string;
}

export const YOUTUBE_CATEGORY_ORDER: YoutubeCategory[] = [
  "cizgi_animasyon",
  "diyalog_egitim",
  "hikaye_kissa",
  "tarihi_dizi_film",
  "islami_sohbet_ders",
  "belgesel_basin",
];

export const YOUTUBE_CATEGORY_META: Record<
  YoutubeCategory,
  YoutubeCategoryMeta
> = {
  cizgi_animasyon: {
    id: "cizgi_animasyon",
    label: "Çizgi Film & Animasyon",
    shortLabel: "Çizgi & Animasyon",
    emoji: "🎨",
    arabicTitle: "الرُّسُومُ الْمُتَحَرِّكَةُ",
    gradientClass:
      "from-emerald-800 via-teal-700 to-cyan-800 text-emerald-50",
    badgeClass:
      "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700",
    description:
      "A1–A2 seviyesinde yavaş, fasih ve görsel bağlamlı çizgi diziler",
  },
  diyalog_egitim: {
    id: "diyalog_egitim",
    label: "Diyalog & Eğitim",
    shortLabel: "Diyalog & Eğitim",
    emoji: "🗣️",
    arabicTitle: "الْحِوَارُ وَالتَّعْلِيمُ",
    gradientClass:
      "from-indigo-800 via-violet-700 to-purple-800 text-indigo-50",
    badgeClass:
      "bg-violet-100 dark:bg-violet-950/70 text-violet-900 dark:text-violet-200 border-violet-300 dark:border-violet-700",
    description:
      "Günlük konuşma kalıpları, saatler ve uygulamalı dil dersleri",
  },
  hikaye_kissa: {
    id: "hikaye_kissa",
    label: "Hikâye & Kıssalar",
    shortLabel: "Hikâye & Kıssa",
    emoji: "📖",
    arabicTitle: "الْقِصَصُ وَالْحِكَايَاتُ",
    gradientClass:
      "from-amber-800 via-orange-700 to-yellow-800 text-amber-50",
    badgeClass:
      "bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700",
    description:
      "Kelile ve Dimne, Kur'an kıssaları ve edebi tahkiye serileri",
  },
  tarihi_dizi_film: {
    id: "tarihi_dizi_film",
    label: "Tarihî Dizi & Sinema",
    shortLabel: "Tarihî Dizi & Film",
    emoji: "🏛️",
    arabicTitle: "الدِّرَامَا التَّارِيخِيَّةُ",
    gradientClass:
      "from-stone-900 via-amber-900 to-emerald-950 text-amber-50",
    badgeClass:
      "bg-orange-100 dark:bg-orange-950/70 text-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700",
    description:
      "Hz. Ömer, Selahaddin Eyyubi, Ertuğrul ve fasih dublajlı tarihî yapımlar",
  },
  islami_sohbet_ders: {
    id: "islami_sohbet_ders",
    label: "İslâmî Sohbet & İlim Dersleri",
    shortLabel: "İslâmî Ders & Sohbet",
    emoji: "🕌",
    arabicTitle: "الدُّرُوسُ الْعِلْمِيَّةُ",
    gradientClass:
      "from-emerald-950 via-emerald-800 to-teal-900 text-emerald-50",
    badgeClass:
      "bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border-teal-300 dark:border-teal-700",
    description:
      "Siyer, Riyâzü's-Sâlihîn, tefsir, akîde ve klasik şerh halkaları",
  },
  belgesel_basin: {
    id: "belgesel_basin",
    label: "Belgesel & Basın Arapçası",
    shortLabel: "Belgesel & Basın",
    emoji: "🌍",
    arabicTitle: "الْوَثَائِقِيَّاتُ وَالْإِعْلَامُ",
    gradientClass:
      "from-slate-900 via-sky-900 to-indigo-950 text-sky-50",
    badgeClass:
      "bg-sky-100 dark:bg-sky-950/70 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-700",
    description:
      "Al Jazeera, BBC Arabic belgeselleri ve ilmî-siyasî tartışma programları",
  },
};

export interface ExternalWatchPlatform {
  name: string;
  url: string;
  badge: string;
  description: string;
}

export interface ExternalWatchPlatformGroup {
  id: string;
  title: string;
  emoji: string;
  platforms: ExternalWatchPlatform[];
}

export const EXTERNAL_WATCH_PLATFORM_GROUPS: ExternalWatchPlatformGroup[] = [
  {
    id: "cartoon_animation",
    title: "Çizgi Film & Animasyon Arşivleri",
    emoji: "🎨",
    platforms: [
      {
        name: "SpaceToon Online",
        url: "https://www.youtube.com/user/spacetoononline",
        badge: "YouTube Kanalı",
        description: "Arap dünyasının en köklü çocuk ve çizgi dizi kanalı",
      },
      {
        name: "ATA Animation Studio",
        url: "https://www.youtube.com/c/ATAAnimationStudio/playlists",
        badge: "Oynatma Listeleri",
        description: "Fasih Arapça tarihî ve eğitici animasyon serileri",
      },
      {
        name: "StarDima",
        url: "https://www.stardima.com/",
        badge: "Web Arşivi",
        description: "Arapça dublajlı çizgi film ve animasyon arşivi",
      },
      {
        name: "Learn with Zakaria (تعلم مع زكريا)",
        url: "https://www.youtube.com/@LearnwithZakaria",
        badge: "A1 Görsel Arapça",
        description:
          "Çocuklar ve A1 başlangıç seviyesi için görsel destekli Fasih Arapça kelime ve kavram videoları",
      },
    ],
  },
  {
    id: "education_dialogue",
    title: "Eğitim & Diyalog Kanalları",
    emoji: "🗣️",
    platforms: [
      {
        name: "ArabicPod101",
        url: "https://www.youtube.com/@ArabicPod101",
        badge: "Dinleme & Diyalog",
        description: "Seviyelere göre günlük Arapça dinleme ve kelime dersleri",
      },
      {
        name: "Learn Arabic with Maha",
        url: "https://www.youtube.com/@LearnArabicwithMaha",
        badge: "Kültür & İletişim",
        description: "Günlük ifadeler, telaffuz ve pratik Arapça dersleri",
      },
      {
        name: "Khan Academy Arabi (أكاديمية خان)",
        url: "https://www.youtube.com/@KhanAcademyArabi",
        badge: "Akademik & Bilimsel Arapça",
        description:
          "Matematik, fen ve bilim konularında açık ve anlaşılır akademik Fasih Arapça ders anlatımları",
      },
    ],
  },
  {
    id: "islamic_doc_media",
    title: "İslâmî İlimler, Belgesel & Basın",
    emoji: "🌍",
    platforms: [
      {
        name: "Naseem Al-Sham (Şam Âlimleri Arşivi)",
        url: "https://naseemalsham.com/",
        badge: "İlmî Arşiv",
        description:
          "Dr. Ramazan el-Bûtî ve Şam ulemasının sesli/görüntülü ders külliyatı",
      },
      {
        name: "Al Jazeera Learning Arabic",
        url: "https://learning.aljazeera.net",
        badge: "Basın Arapçası",
        description:
          "Seviyelendirilmiş haber videoları, metinler ve interaktif sorular",
      },
      {
        name: "Al Jazeera Documentary",
        url: "https://www.youtube.com/user/aljazeeradoc/playlists",
        badge: "Belgesel Külliyatı",
        description:
          "Tarih, kültür, bilim ve coğrafya temalı fasih Arapça belgeseller",
      },
      {
        name: "DW Documentary (وثائقية دي دبليو)",
        url: "https://www.youtube.com/@dwdocumentaryar",
        badge: "Fasih Arapça Belgeseller",
        description:
          "Bilim, çevre, tarih ve küresel konular üzerine profesyonel Fasih Arapça belgeseller",
      },
      {
        name: "AJ+ Kibrit (AJ+ كبريت)",
        url: "https://www.youtube.com/@ajpluskabreet",
        badge: "Kısa Kültür & Tarih Videoları",
        description:
          "Kelime kökenleri, tarih, bilim ve kültür üzerine dinamik kısa Fasih Arapça videolar",
      },
      {
        name: "Havatır - Ahmed eş-Şukayrî",
        url: "https://www.youtube.com/user/AhmadAlShugairi/playlists",
        badge: "Kültür & Toplum",
        description:
          "İslam dünyası, ahlak ve medeniyet üzerine ödüllü kültür serisi",
      },
      {
        name: "BBC Arabic",
        url: "https://www.bbc.com/arabic",
        badge: "Küresel Basın",
        description:
          "Güncel dünya haberleri, röportajlar ve medya Arapçası içerikleri",
      },
    ],
  },
];

export interface ParsedYoutubeUrlInfo {
  videoId?: string;
  playlistId?: string;
  startSeconds?: number;
}

const VALID_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VALID_PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,64}$/;
const REGEX_VIDEO_ID =
  /(?:[?&]v=|youtu\.be\/|\/embed\/(?!videoseries\b)|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i;
const REGEX_PLAYLIST_ID = /[?&]list=([A-Za-z0-9_-]{10,64})(?:[?&#]|$)/i;
const REGEX_START_PARAM = /[?&](?:start|t)=([0-9hmsHMS]+)(?:[?&#]|$)/i;

function sanitizeCandidateId(
  raw: string | undefined | null,
  validator: RegExp
): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "null"
  ) {
    return undefined;
  }
  return validator.test(trimmed) ? trimmed : undefined;
}

function parseTimeParamToSeconds(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) {
    const val = parseInt(trimmed, 10);
    return val > 0 ? val : undefined;
  }
  const match = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match) return undefined;
  const hours = parseInt(match[1] || "0", 10);
  const mins = parseInt(match[2] || "0", 10);
  const secs = parseInt(match[3] || "0", 10);
  const total = hours * 3600 + mins * 60 + secs;
  return total > 0 ? total : undefined;
}

/**
 * YouTube URL'sinden (youtu.be/..., youtube.com/watch?v=..., youtube.com/playlist?list=..., youtube.com/embed/...)
 * videoId, playlistId ve varsa başlangıç saniyesini URL ayrıştırıcı + Regex ile güvenli şekilde ayıklar.
 */
export function extractYoutubeIdsFromUrl(rawUrl?: string): ParsedYoutubeUrlInfo {
  if (!rawUrl || typeof rawUrl !== "string") return {};
  const trimmed = rawUrl.trim();
  if (!trimmed) return {};

  let videoId: string | undefined;
  let playlistId: string | undefined;
  let startSeconds: number | undefined;

  // 1. Regex tabanlı doğrudan ayıklama (watch?v=, list=, youtu.be/, start=/t=)
  const regexVidMatch = trimmed.match(REGEX_VIDEO_ID);
  if (regexVidMatch?.[1]) {
    videoId = sanitizeCandidateId(regexVidMatch[1], VALID_VIDEO_ID_RE);
  }
  const regexListMatch = trimmed.match(REGEX_PLAYLIST_ID);
  if (regexListMatch?.[1]) {
    playlistId = sanitizeCandidateId(regexListMatch[1], VALID_PLAYLIST_ID_RE);
  }
  const regexStartMatch = trimmed.match(REGEX_START_PARAM);
  if (regexStartMatch?.[1]) {
    startSeconds = parseTimeParamToSeconds(regexStartMatch[1]);
  }

  // 2. Standart URL ayrıştırıcı ile doğrulama / tamamlama
  try {
    const normalizedUrl =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    const parsed = new URL(normalizedUrl);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (!playlistId) {
      playlistId = sanitizeCandidateId(
        parsed.searchParams.get("list"),
        VALID_PLAYLIST_ID_RE
      );
    }

    if (!videoId) {
      if (host === "youtu.be") {
        const seg = parsed.pathname.split("/").filter(Boolean)[0] || "";
        videoId = sanitizeCandidateId(seg, VALID_VIDEO_ID_RE);
      } else if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtube-nocookie.com"
      ) {
        const vParam = sanitizeCandidateId(
          parsed.searchParams.get("v"),
          VALID_VIDEO_ID_RE
        );
        if (vParam) {
          videoId = vParam;
        } else {
          const pathParts = parsed.pathname.split("/").filter(Boolean);
          if (
            (pathParts[0] === "embed" ||
              pathParts[0] === "shorts" ||
              pathParts[0] === "live") &&
            pathParts[1] &&
            pathParts[1] !== "videoseries"
          ) {
            videoId = sanitizeCandidateId(pathParts[1], VALID_VIDEO_ID_RE);
          }
        }
      }
    }

    if (!startSeconds) {
      startSeconds =
        parseTimeParamToSeconds(parsed.searchParams.get("start")) ??
        parseTimeParamToSeconds(parsed.searchParams.get("t"));
    }
  } catch {
    // Regex sonuçları yeterli
  }

  return { videoId, playlistId, startSeconds };
}

export function resolveYoutubeIds(
  item: Pick<
    YoutubeRecommendationItem,
    "url" | "video_id" | "playlist_id" | "baslangic_sn"
  >
): ParsedYoutubeUrlInfo {
  const fromUrl = extractYoutubeIdsFromUrl(item.url);
  const videoId =
    sanitizeCandidateId(item.video_id, VALID_VIDEO_ID_RE) ?? fromUrl.videoId;
  const playlistId =
    sanitizeCandidateId(item.playlist_id, VALID_PLAYLIST_ID_RE) ??
    fromUrl.playlistId;

  const startSeconds =
    typeof item.baslangic_sn === "number" &&
    Number.isFinite(item.baslangic_sn) &&
    item.baslangic_sn > 0
      ? Math.floor(item.baslangic_sn)
      : fromUrl.startSeconds;

  return { videoId, playlistId, startSeconds };
}

/**
 * Standart YouTube gömülü oynatıcı (https://www.youtube.com/embed/...) URL'sini üretir:
 * - Hem videoId hem playlistId varsa:
 *   https://www.youtube.com/embed/${videoId}?list=${playlistId}&rel=0&modestbranding=1&autoplay=1
 * - Sadece playlistId varsa (!videoId):
 *   https://www.youtube.com/embed/videoseries?list=${playlistId}&rel=0&modestbranding=1&autoplay=1
 * - Sadece videoId varsa:
 *   https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1(&start=...)
 */
export function buildYoutubeEmbedUrl(
  item: Pick<
    YoutubeRecommendationItem,
    "url" | "video_id" | "playlist_id" | "baslangic_sn"
  > & {
    tur?: "video" | "playlist";
  },
  options?: { autoplay?: boolean }
): string {
  const { videoId, playlistId, startSeconds } = resolveYoutubeIds(item);
  const autoplay = options?.autoplay ?? true;
  const autoplayParam = autoplay ? "&autoplay=1" : "";
  const startParam =
    startSeconds && startSeconds > 0 ? `&start=${startSeconds}` : "";

  if (videoId && playlistId) {
    return `https://www.youtube.com/embed/${encodeURIComponent(
      videoId
    )}?list=${encodeURIComponent(
      playlistId
    )}&rel=0&modestbranding=1${autoplayParam}${startParam}`;
  }

  if (!videoId && playlistId) {
    return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(
      playlistId
    )}&rel=0&modestbranding=1${autoplayParam}`;
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${encodeURIComponent(
      videoId
    )}?rel=0&modestbranding=1${autoplayParam}${startParam}`;
  }

  return "";
}

export function getYoutubeThumbnailUrls(videoId?: string): string[] {
  const cleanId = sanitizeCandidateId(videoId, VALID_VIDEO_ID_RE);
  if (!cleanId) {
    return [];
  }
  return [
    `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${cleanId}/mqdefault.jpg`,
  ];
}

/**
 * İçerik ID eşleştirmesini sıfır dolgusu farklarından bağımsız olarak kanonikleştirir:
 * ör. "metin_05" ve "metin_005" -> "metin:5", "dlg_001" -> "dlg:1", "grm_012" -> "grm:12".
 */
export function normalizeContentLinkKey(rawId?: string): string {
  if (!rawId || typeof rawId !== "string") return "";
  const cleaned = rawId.trim().toLowerCase();
  if (!cleaned) return "";
  const match = cleaned.match(/^([a-z]+)_0*(\d+)$/);
  if (match) {
    return `${match[1]}:${parseInt(match[2], 10)}`;
  }
  return cleaned;
}

export function doesYoutubeItemMatchContentId(
  item: Pick<YoutubeRecommendationItem, "bagli_icerik_id">,
  contentId: string
): boolean {
  if (!item.bagli_icerik_id || !contentId) return false;
  const targetRaw = contentId.trim().toLowerCase();
  const itemRaw = item.bagli_icerik_id.trim().toLowerCase();
  if (itemRaw === targetRaw) return true;
  const normTarget = normalizeContentLinkKey(targetRaw);
  const normItem = normalizeContentLinkKey(itemRaw);
  return Boolean(normTarget && normTarget === normItem);
}

export function getContentLinkHref(bagliIcerikId?: string): {
  href: string;
  label: string;
} | null {
  if (!bagliIcerikId) return null;
  const clean = bagliIcerikId.trim().toLowerCase();
  const match = clean.match(/^([a-z]+)_0*(\d+)$/);
  if (!match) return null;
  const prefix = match[1];
  const num = parseInt(match[2], 10);
  if (!Number.isFinite(num) || num <= 0) return null;

  if (prefix === "dlg") {
    const id = `dlg_${String(num).padStart(3, "0")}`;
    return {
      href: `/diyalog/${id}`,
      label: `Diyalog #${num}`,
    };
  }
  if (prefix === "metin") {
    const id = `metin_${String(num).padStart(2, "0")}`;
    return {
      href: `/metin/${id}`,
      label: `Okuma Metni #${num}`,
    };
  }
  if (prefix === "grm") {
    const id = `grm_${String(num).padStart(3, "0")}`;
    return {
      href: `/kutuphane#card=${id}`,
      label: `Gramer Notu #${num}`,
    };
  }
  return null;
}
