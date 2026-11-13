"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Settings,
  Cloud,
  HardDrive,
  Search,
  Plus,
  Download,
  Save,
  Upload,
  Volume2,
  Mic,
  Square,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  RefreshCw,
  Edit3,
  Trash2,
  FolderOpen,
  Play,
  ExternalLink,
  Code2,
  Lock,
  Unlock,
  LogOut,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import {
  resolveImageUrl,
  resolveAudioUrl,
  getDialogueCoverUrl,
  getReadingTextCoverUrl,
  getProverbCoverUrl,
  getVisualWordCoverUrl,
} from "@/lib/data";
import { playClick, playSuccess, playError } from "@/lib/sfxManager";
import { speakHybrid } from "@/lib/audio";
import { stripHarakat } from "@/lib/dict";
import {
  YOUTUBE_CATEGORY_META,
  YOUTUBE_CATEGORY_ORDER,
  extractYoutubeIdsFromUrl,
  resolveYoutubeIds,
  buildYoutubeEmbedUrl,
  getYoutubeThumbnailUrls,
} from "@/lib/youtubeUtils";
import type {
  SynonymAntonymSubItem,
  YoutubeCategory,
  YoutubeRecommendationItem,
} from "@/types/data";
import type { AdminDatasetKey } from "@/app/api/admin/route";

type StudioTabKey = AdminDatasetKey | "efect_manager";

interface DatasetMeta {
  key: StudioTabKey;
  label: string;
  shortLabel: string;
  icon: string;
  fileName: string;
  description: string;
}

const STUDIO_TABS: DatasetMeta[] = [
  {
    key: "gorsel_kelimeler",
    label: "🖼️ 998 Görsel Kelime",
    shortLabel: "Görsel Kelime",
    icon: "🖼️",
    fileName: "gorselKelimeler_guncel.json",
    description: "Görsel destekli kelimeler, kök, çoğul/muzari, soru kalıbı ve örnek cümleler",
  },
  {
    key: "cumleler_1111",
    label: "🗣️ 1111 Cümle",
    shortLabel: "1111 Cümle",
    icon: "🗣️",
    fileName: "1111_cumle.json",
    description: "Günlük konuşma kalıpları, odak gramer ve erkek/kadın ses dosyaları",
  },
  {
    key: "atasozleri_508",
    label: "📜 508 Atasözü",
    shortLabel: "508 Atasözü",
    icon: "📜",
    fileName: "atasozleri.json",
    description: "Arapça atasözleri, deyimsel/lafzî çeviri, görsel ve ses dosyaları",
  },
  {
    key: "diyaloglar_120",
    label: "💬 120 Diyalog",
    shortLabel: "120 Diyalog",
    icon: "💬",
    fileName: "tum_diyaloglar_120.json",
    description: "Seviyelendirilmiş 120 diyalog, konuşmacı satırları ve kapak görselleri",
  },
  {
    key: "metinler_60",
    label: "📖 60 Metin",
    shortLabel: "60 Metin",
    icon: "📖",
    fileName: "tum_metinler_60.json",
    description: "60 okuma metni, cümle satırları ve okuduğunu anlama soruları",
  },
  {
    key: "sozluk",
    label: "📚 1895 Sözlük",
    shortLabel: "Sözlük",
    icon: "📚",
    fileName: "yeni_tum_sozluk.json",
    description: "Morfolojik sözlük (kök, müfret/cemi, mazi/muzari/masdar, örnekler)",
  },
  {
    key: "diyalog_gramer",
    label: "📌 Diyalog Gramer (120)",
    shortLabel: "Diyalog Gramer",
    icon: "📌",
    fileName: "diyaloglar_gramer_hap_bilgi.json",
    description: "120 diyaloğun hap gramer kuralları, formüller ve ayrıntılı i'rab anlatımı",
  },
  {
    key: "metin_gramer",
    label: "📌 Metin Gramer (60)",
    shortLabel: "Metin Gramer",
    icon: "📌",
    fileName: "metinler_gramer_hap_bilgi.json",
    description: "60 okuma metninin hap gramer kuralları, tablolar ve i'rab tahlilleri",
  },
  {
    key: "ek_gramer",
    label: "📌 Temel & İleri Gramer (15)",
    shortLabel: "Ek Gramer (15)",
    icon: "📌",
    fileName: "ek_gramer_hap_bilgi.json",
    description: "15 müstakil temel ve ileri gramer hap bilgi kartı (grm_001 – grm_015)",
  },
  {
    key: "seviye_sorulari",
    label: "🧭 Seviye & Tarama Soruları (180)",
    shortLabel: "180 Seviye Sorusu",
    icon: "🧭",
    fileName: "seviye_tespit_sorulari.json",
    description: "A1–B2 seviye tespit, konu tarama soruları ve gerekçeli çeldirici analizleri",
  },
  {
    key: "youtube_tavsiyeleri",
    label: "🎬 YouTube & İzleme Rehberi (55)",
    shortLabel: "YouTube Rehberi",
    icon: "🎬",
    fileName: "youtube_tavsiyeleri.json",
    description: "CEFR A1–B2 seviyeli YouTube video & oynatma listeleri, pedagojik notlar ve odak kelimeler",
  },
  {
    key: "es_zit_anlamlilar",
    label: "🔄 Eş & Zıt Anlamlılar (400)",
    shortLabel: "Eş & Zıt (400)",
    icon: "🔄",
    fileName: "es_zit_anlamlilar.json",
    description: "400 ana madde, eş/zıt anlamlılar, ince anlam farkları (الفروق اللغوية) ve karşılaştırmalı örnek cümleler",
  },
  {
    key: "efect_manager",
    label: "🔊 Ses Efektleri (efect)",
    shortLabel: "Ses Efektleri",
    icon: "🔊",
    fileName: "efect/*.mp3",
    description: "Uygulama içi 14 MP3 ses efekti ve sözlü övgü sesleri (efect/ klasörü)",
  },
];

interface EfectItem {
  id: string;
  fileName: string;
  targetPath: string;
  titleTr: string;
  arabicSample: string;
  gender: "male" | "female";
  category: string;
}

const EFECT_CATALOG: EfectItem[] = [
  {
    id: "efect_click",
    fileName: "butonsesi.mp3",
    targetPath: "/efect/butonsesi.mp3",
    titleTr: "Buton Tıklama Sesi",
    arabicSample: "نَقْرَة",
    gender: "male",
    category: "Arayüz Efekti",
  },
  {
    id: "efect_start",
    fileName: "baslangic.mp3",
    targetPath: "/efect/baslangic.mp3",
    titleTr: "Alıştırma Başlangıç Sesi",
    arabicSample: "بِسْمِ اللّٰهِ نَبْدَأُ",
    gender: "male",
    category: "Arayüz Efekti",
  },
  {
    id: "efect_dogru",
    fileName: "dogru.mp3",
    targetPath: "/efect/dogru.mp3",
    titleTr: "Doğru Cevap Zil Sesi 1",
    arabicSample: "إِجَابَةٌ صَحِيحَةٌ",
    gender: "male",
    category: "Doğru Cevap",
  },
  {
    id: "efect_bildiniz",
    fileName: "bildiniz.mp3",
    targetPath: "/efect/bildiniz.mp3",
    titleTr: "Doğru Cevap Zil Sesi 2 (Bildiniz)",
    arabicSample: "أَحْسَنْتَ، إِجَابَةٌ صَحِيحَةٌ",
    gender: "male",
    category: "Doğru Cevap",
  },
  {
    id: "efect_yanlis",
    fileName: "yanliscevap.mp3",
    targetPath: "/efect/yanliscevap.mp3",
    titleTr: "Yanlış Cevap Sesi 1",
    arabicSample: "حَاوِلْ مَرَّةً أُخْرَى",
    gender: "male",
    category: "Yanlış Cevap",
  },
  {
    id: "efect_bilemediniz",
    fileName: "bilemediniz.mp3",
    targetPath: "/efect/bilemediniz.mp3",
    titleTr: "Yanlış Cevap Sesi 2 (Bilemediniz)",
    arabicSample: "لَا بَأْسَ، حَاوِلْ ثَانِيَةً",
    gender: "male",
    category: "Yanlış Cevap",
  },
  {
    id: "efect_ahsent_m",
    fileName: "ahsent_male.mp3",
    targetPath: "/efect/ahsent_male.mp3",
    titleTr: "Ahsent! (Erkek Övgü Sesi)",
    arabicSample: "أَحْسَنْتَ!",
    gender: "male",
    category: "Sözlü Övgü (Erkek)",
  },
  {
    id: "efect_mumtaz_m",
    fileName: "mumtaz_male.mp3",
    targetPath: "/efect/mumtaz_male.mp3",
    titleTr: "Mümtâz! (Erkek Övgü Sesi)",
    arabicSample: "مُمْتَازٌ!",
    gender: "male",
    category: "Sözlü Övgü (Erkek)",
  },
  {
    id: "efect_rai_m",
    fileName: "rai_male.mp3",
    targetPath: "/efect/rai_male.mp3",
    titleTr: "Râi'! (Erkek Övgü Sesi)",
    arabicSample: "رَائِعٌ!",
    gender: "male",
    category: "Sözlü Övgü (Erkek)",
  },
  {
    id: "efect_ahsent_f",
    fileName: "ahsent_female.mp3",
    targetPath: "/efect/ahsent_female.mp3",
    titleTr: "Ahsenti! (Kadın Övgü Sesi)",
    arabicSample: "أَحْسَنْتِ!",
    gender: "female",
    category: "Sözlü Övgü (Kadın)",
  },
  {
    id: "efect_mumtaz_f",
    fileName: "mumtaz_female.mp3",
    targetPath: "/efect/mumtaz_female.mp3",
    titleTr: "Mümtâze! (Kadın Övgü Sesi)",
    arabicSample: "مُمْتَازَةٌ!",
    gender: "female",
    category: "Sözlü Övgü (Kadın)",
  },
  {
    id: "efect_rai_f",
    fileName: "rai_female.mp3",
    targetPath: "/efect/rai_female.mp3",
    titleTr: "Râia! (Kadın Övgü Sesi)",
    arabicSample: "رَائِعَةٌ!",
    gender: "female",
    category: "Sözlü Övgü (Kadın)",
  },
  {
    id: "efect_tebrikler",
    fileName: "tebrikler.mp3",
    targetPath: "/efect/tebrikler.mp3",
    titleTr: "Tebrikler Fanfar Sesi (%85+ Başarı)",
    arabicSample: "مَبْرُوكٌ! نَجَاحٌ بَاهِرٌ!",
    gender: "male",
    category: "Bitiş Fanfarı",
  },
  {
    id: "efect_basari",
    fileName: "basari.mp3",
    targetPath: "/efect/basari.mp3",
    titleTr: "Standart Başarı Fanfar Sesi",
    arabicSample: "أَتْمَمْتَ التَّدْرِيبَ بِنَجَاحٍ",
    gender: "male",
    category: "Bitiş Fanfarı",
  },
];

const HAREKE_KEYS = [
  { char: "\u064E", label: "ـَ Fetha" },
  { char: "\u0650", label: "ـِ Kesra" },
  { char: "\u064F", label: "ـُ Damme" },
  { char: "\u0652", label: "ـْ Sükun" },
  { char: "\u0651", label: "ـّ Şedde" },
  { char: "\u064B", label: "ـً T.Fetha" },
  { char: "\u064D", label: "ـٍ T.Kesra" },
  { char: "\u064C", label: "ـٌ T.Damme" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericRecord = Record<string, any>;

interface HealthIssue {
  index: number;
  id: string;
  title: string;
  issueType: "corrupt_char" | "missing_hareke" | "empty_field" | "missing_media";
  severity: "error" | "warning";
  detail: string;
}

function hasArabicDiacritics(str: string): boolean {
  return /[\u064B-\u0652\u0670]/.test(str || "");
}

function getRecordId(rec: GenericRecord, idx: number): string {
  return String(
    rec.id ||
      rec.bagli_id ||
      rec.diyalog_id ||
      rec.metin_id ||
      rec.sira ||
      `kayit_${idx + 1}`
  );
}

function getRecordLevel(rec: GenericRecord): string {
  return String(rec.cefr || rec.seviye || rec.level || "A1");
}

function getRecordCategory(rec: GenericRecord): string {
  if (typeof rec.kategori === "string" && rec.kategori in YOUTUBE_CATEGORY_META) {
    const meta = YOUTUBE_CATEGORY_META[rec.kategori as YoutubeCategory];
    return `${meta.emoji} ${meta.shortLabel}`;
  }
  if (rec.kelime_ar && typeof rec.tur === "string") {
    const turLabels: Record<string, string> = {
      isim: "📘 İsim",
      fiil: "⚡ Fiil",
      sifat: "✨ Sıfat",
      zarf: "⏳ Zarf",
    };
    const esCount = Array.isArray(rec.es_anlamlilar) ? rec.es_anlamlilar.length : 0;
    const zitCount = Array.isArray(rec.zit_anlamlilar) ? rec.zit_anlamlilar.length : 0;
    return `${turLabels[rec.tur] || rec.tur} (=${esCount} / ≠${zitCount})`;
  }
  return String(
    rec.ktt_ust_konu ||
      rec.ust_konu ||
      rec.kategori_tr ||
      rec.kategori ||
      rec.tema ||
      rec.odak_gramer ||
      rec.tur ||
      rec.diyalog_baslik ||
      rec.metin_baslik ||
      "Genel"
  );
}

function getRecordArabic(rec: GenericRecord): string {
  if (rec.kelime_ar) return String(rec.kelime_ar);
  if (rec.soru_metni_ar) return String(rec.soru_metni_ar);
  if (rec.arapca) return String(rec.arapca);
  if (rec.baslik_ar) return String(rec.baslik_ar);
  if (rec.mufret) return String(rec.mufret);
  if (rec.mazi) return String(rec.mazi);
  if (rec.metinden_ornek?.arapca) return String(rec.metinden_ornek.arapca);
  if (Array.isArray(rec.gramer_notlari) && rec.gramer_notlari[0]?.ornekler?.[0]?.arapca) {
    return String(rec.gramer_notlari[0].ornekler[0].arapca);
  }
  return "";
}

function getRecordTurkish(rec: GenericRecord): string {
  if (rec.cozum_detayi?.soru_cevirisi_tr) {
    return String(rec.cozum_detayi.soru_cevirisi_tr);
  }
  if (rec.konu_basligi) return String(rec.konu_basligi);
  if (rec.soru_yonergesi_tr) return String(rec.soru_yonergesi_tr);
  if (rec.turkce) return String(rec.turkce);
  if (rec.baslik_tr) return String(rec.baslik_tr);
  if (rec.anlam_tr) return String(rec.anlam_tr);
  if (rec.diyalog_baslik) return String(rec.diyalog_baslik);
  if (rec.metin_baslik) return String(rec.metin_baslik);
  if (rec.hap_kural) return String(rec.hap_kural);
  return "";
}

function getDefaultImagePath(
  tab: StudioTabKey,
  rec: GenericRecord,
  idx: number
): string {
  if (rec.gorsel) return String(rec.gorsel);
  if (tab === "gorsel_kelimeler") {
    const num = String(rec.sira || idx + 1).padStart(4, "0");
    return `/gorseller/kelimeler/gorsel_${num}.webp`;
  }
  if (tab === "atasozleri_508") {
    const num = String(rec.sira || idx + 1).padStart(4, "0");
    return `/gorseller/atasozleri/ata_${num}.webp`;
  }
  if (tab === "diyaloglar_120") {
    const num = String(rec.id || `${idx + 1}`).replace(/\D+/g, "").padStart(3, "0") || "001";
    return `/gorseller/diyaloglar/${num}.webp`;
  }
  if (tab === "metinler_60") {
    const num = String(rec.id || `${idx + 1}`).replace(/\D+/g, "").padStart(2, "0") || "01";
    return `/gorseller/metinler/metin_${num}.webp`;
  }
  return "";
}

function getPreviewImageUrl(
  tab: StudioTabKey,
  rec: GenericRecord,
  idx: number,
  cacheBuster: number
): string {
  let rawUrl = "";
  if (tab === "gorsel_kelimeler") {
    rawUrl = rec.gorsel
      ? resolveImageUrl(String(rec.gorsel))
      : getVisualWordCoverUrl(String(rec.id || idx + 1));
  } else if (tab === "atasozleri_508") {
    rawUrl = rec.gorsel
      ? resolveImageUrl(String(rec.gorsel))
      : getProverbCoverUrl(String(rec.id || `ata_${idx + 1}`));
  } else if (tab === "diyaloglar_120") {
    rawUrl = getDialogueCoverUrl(String(rec.id || `dlg_${idx + 1}`));
  } else if (tab === "metinler_60") {
    rawUrl = getReadingTextCoverUrl(String(rec.id || `metin_${idx + 1}`));
  } else if (rec.gorsel) {
    rawUrl = resolveImageUrl(String(rec.gorsel));
  }
  if (!rawUrl) return "";
  return `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}t=${cacheBuster}`;
}

function getDefaultAudioPath(
  tab: StudioTabKey,
  rec: GenericRecord,
  gender: "male" | "female",
  idx: number
): string {
  const field = gender === "female" ? rec.ses_kadin : rec.ses_erkek;
  if (field) return String(field);
  const gFolder = gender === "female" ? "kadin" : "erkek";
  const num4 = String(rec.sira || idx + 1).padStart(4, "0");
  if (tab === "gorsel_kelimeler") {
    return `/sesler/kelimeler/${gFolder}/${rec.id || num4}.wav`;
  }
  if (tab === "cumleler_1111") {
    return `/sesler/cumleler/${gFolder}/cumle_${num4}.mp3`;
  }
  if (tab === "atasozleri_508") {
    return `/sesler/atasozleri/${gFolder}/ata_${num4}.wav`;
  }
  if (tab === "sozluk") {
    return `/sesler/kelimeler/${gFolder}/${rec.id || `kelime_${num4}`}.mp3`;
  }
  return `/sesler/cumleler/${gFolder}/${rec.id || `kayit_${num4}`}.mp3`;
}

function isValidAdminToken(rawToken: string): boolean {
  const t = (rawToken || "").trim();
  return (
    (t.startsWith("github_pat_") && t.length >= 20) ||
    (t.startsWith("ghp_") && t.length >= 20) ||
    (t.startsWith("gho_") && t.length >= 20)
  );
}

/**
 * MediaRecorder çıktısını (WebM/Opus, MP4/AAC vb.) AudioContext.decodeAudioData ile çözüp
 * gerçek 16-bit Mono PCM RIFF WAVE (.wav) kapsayıcısına dönüştürür.
 */
async function convertRecordedBlobToMonoWav16(rawBlob: Blob): Promise<Blob> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const arrayBuf = await rawBlob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
    const numChannels = audioBuf.numberOfChannels;
    const length = audioBuf.length;
    const sampleRate = audioBuf.sampleRate;

    const monoSamples = new Float32Array(length);
    for (let ch = 0; ch < numChannels; ch++) {
      const chData = audioBuf.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        monoSamples[i] += chData[i] / numChannels;
      }
    }

    const bytesPerSample = 2; // 16-bit PCM
    const dataByteLength = length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(buffer);

    const writeAscii = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeAscii(0, "RIFF");
    view.setUint32(4, 36 + dataByteLength, true);
    writeAscii(8, "WAVE");
    writeAscii(12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
    view.setUint16(22, 1, true); // NumChannels = 1 (Mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true); // ByteRate
    view.setUint16(32, bytesPerSample, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample = 16
    writeAscii(36, "data");
    view.setUint32(40, dataByteLength, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      const clamped = Math.max(-1, Math.min(1, monoSamples[i]));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
  } finally {
    await ctx.close().catch(() => {});
  }
}

export default function AdminStudioPage() {
  // 1. GitHub & Depo Ayarları (Yalnızca sessionStorage — sekme kapanınca silinir)
  const [githubToken, setGithubToken] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.sessionStorage.getItem("muallimun_admin_gh_token") || "";
    } catch {
      return "";
    }
  });
  const [adminSecret, setAdminSecret] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.sessionStorage.getItem("muallimun_admin_secret") || "";
    } catch {
      return "";
    }
  });
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [lockTokenInput, setLockTokenInput] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.sessionStorage.getItem("muallimun_admin_gh_token") || "";
    } catch {
      return "";
    }
  });
  const [lockError, setLockError] = useState<string | null>(null);
  const [verifyingToken, setVerifyingToken] = useState(false);

  const [repoOwner, setRepoOwner] = useState("muallimun");
  const [codeRepo, setCodeRepo] = useState("arapca_telaffuz_web_v2");
  const [mediaRepo, setMediaRepo] = useState("arapca_telaffuz_medya");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 2. Aktif Sekme & Veri Durumu
  const [activeTab, setActiveTab] = useState<StudioTabKey>("gorsel_kelimeler");
  const [records, setRecords] = useState<GenericRecord[]>([]);
  const [datasetBaseSha, setDatasetBaseSha] = useState<string | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error" | "info";
    text: string;
    url?: string;
  } | null>(null);

  // 3. Arama, Filtre & Sayfalama (25 kayıt/sayfa)
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // 4. Düzenleme Modalı & Medya Stüdyosu Durumu
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftRecord, setDraftRecord] = useState<GenericRecord | null>(null);
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState("");
  const [cacheBuster, setCacheBuster] = useState<number>(1);
  const [imgPreviewBroken, setImgPreviewBroken] = useState(false);
  const [squareResizePx, setSquareResizePx] = useState<512 | 768>(512);
  const [mediaBusyLabel, setMediaBusyLabel] = useState<string | null>(null);
  const [maleAudioStatus, setMaleAudioStatus] = useState<"unknown" | "ready" | "missing">("unknown");
  const [femaleAudioStatus, setFemaleAudioStatus] = useState<"unknown" | "ready" | "missing">("unknown");
  const [dialogueSelectedLineIdx, setDialogueSelectedLineIdx] = useState<number>(0);

  // Mikrofon Kayıt Durumu (Gerçek 16-bit Mono PCM .wav dönüşümlü)
  const [recordingGender, setRecordingGender] = useState<"male" | "female" | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const activeAudioElRef = useRef<HTMLAudioElement | null>(null);

  // 5. Sağlık Taraması & Eksik Ses Tamir Durumu
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [brokenMediaIds, setBrokenMediaIds] = useState<Record<string, string>>({});
  const [checkingMediaHealth, setCheckingMediaHealth] = useState(false);
  const [mediaProbeProgress, setMediaProbeProgress] = useState<{
    checked: number;
    total: number;
  } | null>(null);
  const [repairingMissingSentences, setRepairingMissingSentences] =
    useState(false);
  const [repairProgressText, setRepairProgressText] = useState<string | null>(
    null
  );

  const buildAdminHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...extra,
      };
      if (adminSecret.trim()) {
        headers["x-admin-secret"] = adminSecret.trim();
      }
      return headers;
    },
    [adminSecret]
  );

  // Eski güvensiz localStorage anahtarlarını sayfa açılışında temizle ve varsa aktif sekme oturumunu sunucudan doğrula
  useEffect(() => {
    let active = true;
    try {
      window.localStorage.removeItem("muallimun_admin_gh_token");
      window.localStorage.removeItem("muallimun_admin_unlocked");
    } catch {
      // ignore
    }

    const verifyExistingSession = async () => {
      let savedToken = "";
      let savedSecret = "";
      try {
        savedToken =
          window.sessionStorage.getItem("muallimun_admin_gh_token") || "";
        savedSecret =
          window.sessionStorage.getItem("muallimun_admin_secret") || "";
      } catch {
        return;
      }

      if (!isValidAdminToken(savedToken)) return;
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (savedSecret.trim()) {
          headers["x-admin-secret"] = savedSecret.trim();
        }
        const res = await fetch("/api/admin", {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "verify_access",
            githubToken: savedToken.trim(),
            owner: "muallimun",
            codeRepo: "arapca_telaffuz_web_v2",
            mediaRepo: "arapca_telaffuz_medya",
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json?.ok && json?.authorized === true) {
          setGithubToken(savedToken.trim());
          setIsAdminUnlocked(true);
        } else {
          window.sessionStorage.removeItem("muallimun_admin_gh_token");
          window.sessionStorage.removeItem("muallimun_admin_unlocked");
          setIsAdminUnlocked(false);
        }
      } catch {
        // Ağ hatasında kilidi ASLA açma
        if (active) {
          setIsAdminUnlocked(false);
        }
      }
    };

    void verifyExistingSession();
    return () => {
      active = false;
    };
  }, []);

  const saveRepoSettingsToStorage = (
    token: string,
    owner: string,
    cRepo: string,
    mRepo: string,
    secretVal?: string
  ) => {
    setGithubToken(token);
    setRepoOwner(owner);
    setCodeRepo(cRepo);
    setMediaRepo(mRepo);
    if (secretVal !== undefined) {
      setAdminSecret(secretVal);
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("muallimun_admin_gh_token");
        window.localStorage.removeItem("muallimun_admin_unlocked");
        window.sessionStorage.setItem("muallimun_admin_gh_token", token.trim());
        if (secretVal !== undefined) {
          window.sessionStorage.setItem(
            "muallimun_admin_secret",
            secretVal.trim()
          );
        }
      } catch {
        // ignore
      }
    }
  };

  // Veri setini API'den yükle
  const fetchDataset = useCallback(
    async (tabKey: StudioTabKey) => {
      if (tabKey === "efect_manager") {
        await Promise.resolve();
        setRecords(EFECT_CATALOG);
        setDatasetBaseSha(undefined);
        setHasUnsavedChanges(false);
        setCurrentPage(1);
        return;
      }
      await Promise.resolve();
      setLoading(true);
      setStatusBanner(null);
      try {
        const reqHeaders: Record<string, string> = {};
        if (githubToken.trim()) {
          reqHeaders.Authorization = `Bearer ${githubToken.trim()}`;
        }
        const res = await fetch(`/api/admin?dataset=${tabKey}`, {
          headers: reqHeaders,
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Veri seti yüklenemedi.");
        }
        setRecords(Array.isArray(json.data) ? json.data : []);
        setDatasetBaseSha(
          typeof json.baseSha === "string" ? json.baseSha : undefined
        );
        setHasUnsavedChanges(false);
        setCurrentPage(1);
      } catch (err) {
        setStatusBanner({
          type: "error",
          text: err instanceof Error ? err.message : "Veri okuma hatası",
        });
      } finally {
        setLoading(false);
      }
    },
    [githubToken]
  );

  useEffect(() => {
    if (!isAdminUnlocked) return;
    let active = true;
    const load = async () => {
      if (!active) return;
      await fetchDataset(activeTab);
    };
    void load();
    return () => {
      active = false;
    };
  }, [activeTab, fetchDataset, isAdminUnlocked]);

  const handleUnlockAdminStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    setLockError(null);
    const trimmed = lockTokenInput.trim();

    if (!isValidAdminToken(trimmed)) {
      playError();
      setLockError(
        "Geçersiz erişim anahtarı! Lütfen geçerli bir GitHub Personal Access Token (github_pat_... veya ghp_...) girin."
      );
      return;
    }

    setVerifyingToken(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: buildAdminHeaders(),
        body: JSON.stringify({
          action: "verify_access",
          githubToken: trimmed,
          owner: repoOwner.trim(),
          codeRepo: codeRepo.trim(),
          mediaRepo: mediaRepo.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || json?.authorized !== true) {
        playError();
        setLockError(
          json?.error ||
            "GitHub yazma (push) yetkisi doğrulanamadı. Anahtarın geçerli ve yetkili olduğundan emin olun."
        );
        return;
      }

      saveRepoSettingsToStorage(
        trimmed,
        repoOwner.trim(),
        codeRepo.trim(),
        mediaRepo.trim(),
        adminSecret
      );
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem("muallimun_admin_unlocked", "true");
        } catch {
          // ignore
        }
      }
      playSuccess();
      setIsAdminUnlocked(true);
    } catch {
      playError();
      setLockError(
        "Sunucu yetki doğrulama bağlantısı kurulamadı. Ağ hatası nedeniyle stüdyo kilidi açılmadı; lütfen internet bağlantınızı kontrol edip tekrar deneyin."
      );
    } finally {
      setVerifyingToken(false);
    }
  };

  const handleLockAdminStudio = () => {
    playClick();
    setIsAdminUnlocked(false);
    setGithubToken("");
    setLockTokenInput("");
    setRecords([]);
    setDatasetBaseSha(undefined);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("muallimun_admin_unlocked");
        window.localStorage.removeItem("muallimun_admin_gh_token");
        window.sessionStorage.removeItem("muallimun_admin_unlocked");
        window.sessionStorage.removeItem("muallimun_admin_gh_token");
      } catch {
        // ignore
      }
    }
  };

  // Filtrelenmiş kayıtlar
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records
      .map((rec, originalIndex) => ({ rec, originalIndex }))
      .filter(({ rec, originalIndex }) => {
        if (levelFilter !== "all" && activeTab !== "efect_manager") {
          const lvl = getRecordLevel(rec);
          if (lvl !== levelFilter) return false;
        }
        if (!q) return true;
        const idStr = getRecordId(rec, originalIndex).toLowerCase();
        const arStr = getRecordArabic(rec).toLowerCase();
        const trStr = getRecordTurkish(rec).toLowerCase();
        const catStr = getRecordCategory(rec).toLowerCase();
        const rootStr = String(rec.kok || "").toLowerCase();
        const channelStr = String(rec.kanal_adi || "").toLowerCase();
        const urlStr = String(rec.url || "").toLowerCase();
        const synBlob =
          Array.isArray(rec.es_anlamlilar) || Array.isArray(rec.zit_anlamlilar)
            ? [
                String(rec.kelime_harekesiz || ""),
                String(rec.ornek_cumle_ar || ""),
                String(rec.ornek_cumle_tr || ""),
                ...(Array.isArray(rec.es_anlamlilar)
                  ? rec.es_anlamlilar.map(
                      (s: GenericRecord) =>
                        `${s.ar || ""} ${s.harekesiz || ""} ${s.tr || ""} ${s.nuans_tr || ""}`
                    )
                  : []),
                ...(Array.isArray(rec.zit_anlamlilar)
                  ? rec.zit_anlamlilar.map(
                      (a: GenericRecord) =>
                        `${a.ar || ""} ${a.harekesiz || ""} ${a.tr || ""}`
                    )
                  : []),
              ]
                .join(" ")
                .toLowerCase()
            : "";
        return (
          idStr.includes(q) ||
          arStr.includes(q) ||
          trStr.includes(q) ||
          catStr.includes(q) ||
          rootStr.includes(q) ||
          channelStr.includes(q) ||
          urlStr.includes(q) ||
          synBlob.includes(q)
        );
      });
  }, [records, searchQuery, levelFilter, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRecords = useMemo(() => {
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage, totalPages]);

  // Sağlık Taraması (Veri & Medya Denetleyicisi)
  const healthIssues = useMemo<HealthIssue[]>(() => {
    if (activeTab === "efect_manager") return [];
    const issues: HealthIssue[] = [];
    records.forEach((rec, index) => {
      const id = getRecordId(rec, index);
      const ar = getRecordArabic(rec);
      const tr = getRecordTurkish(rec);
      const rawJson = JSON.stringify(rec);

      // 1. Bozuk karakter (\uFFFD / □) kontrolü
      if (rawJson.includes("\uFFFD") || rawJson.includes("□")) {
        issues.push({
          index,
          id,
          title: tr || ar || id,
          issueType: "corrupt_char",
          severity: "error",
          detail: "Kayıtta bozuk karakter (□ / \\uFFFD) tespit edildi.",
        });
      }

      // 2. Boş Arapça veya Türkçe alan kontrolü
      if (
        activeTab !== "diyalog_gramer" &&
        activeTab !== "metin_gramer" &&
        activeTab !== "ek_gramer" &&
        (!ar.trim() || !tr.trim())
      ) {
        issues.push({
          index,
          id,
          title: tr || ar || id,
          issueType: "empty_field",
          severity: "error",
          detail: !ar.trim()
            ? "Arapça metin alanı boş bırakılmış."
            : "Türkçe anlam/başlık alanı boş bırakılmış.",
        });
      }

      // 3. Eksik hareke kontrolü
      if (ar.trim().length > 1 && !hasArabicDiacritics(ar)) {
        issues.push({
          index,
          id,
          title: tr || ar || id,
          issueType: "missing_hareke",
          severity: "warning",
          detail: `Arapça metinde ("${ar.slice(0, 28)}") hiç hareke bulunmuyor.`,
        });
      }

      // 4. Medya yolu veya kırık medya kontrolü
      if (brokenMediaIds[id]) {
        issues.push({
          index,
          id,
          title: tr || ar || id,
          issueType: "missing_media",
          severity: "error",
          detail: brokenMediaIds[id],
        });
      } else if (
        activeTab === "gorsel_kelimeler" &&
        (!rec.gorsel || !String(rec.gorsel).trim())
      ) {
        issues.push({
          index,
          id,
          title: tr || ar || id,
          issueType: "missing_media",
          severity: "warning",
          detail: "Görsel dosya yolu (gorsel) tanımlanmamış.",
        });
      }
    });
    return issues;
  }, [records, activeTab, brokenMediaIds]);

  // Tüm kayıtların görsel ve ses (ses_erkek, ses_kadin, ses_dosyasi) URL'lerini kontrollü gruplar halinde tara
  const runLiveMediaProbe = async () => {
    playClick();
    setCheckingMediaHealth(true);
    setStatusBanner(null);

    interface ProbeTarget {
      id: string;
      label: string;
      url: string;
      displayPath: string;
    }

    const targets: ProbeTarget[] = [];

    records.forEach((rec, idx) => {
      const id = getRecordId(rec, idx);
      if (activeTab === "efect_manager") {
        const tp = String(rec.targetPath || "").replace(/^\/+/, "");
        if (tp) {
          targets.push({
            id,
            label: "Efekt Sesi",
            url: `https://raw.githubusercontent.com/muallimun/arapca_telaffuz_medya/main/${tp}`,
            displayPath: `/${tp}`,
          });
        }
        return;
      }

      if (
        activeTab === "gorsel_kelimeler" ||
        activeTab === "atasozleri_508" ||
        activeTab === "diyaloglar_120" ||
        activeTab === "metinler_60"
      ) {
        const imgUrl = getPreviewImageUrl(activeTab, rec, idx, cacheBuster);
        if (imgUrl) {
          targets.push({
            id,
            label: "Görsel",
            url: imgUrl,
            displayPath: getDefaultImagePath(activeTab, rec, idx),
          });
        }
      }

      if (
        activeTab === "gorsel_kelimeler" ||
        activeTab === "cumleler_1111" ||
        activeTab === "atasozleri_508" ||
        activeTab === "sozluk"
      ) {
        const checkDual = (
          rawField: unknown,
          gender: "male" | "female",
          tag: string
        ) => {
          let rawPath =
            typeof rawField === "string" && rawField.trim()
              ? rawField.trim()
              : activeTab !== "sozluk"
              ? getDefaultAudioPath(activeTab, rec, gender, idx)
              : "";
          if (!rawPath) return;
          if (
            rawPath.includes("/kelimeler/") ||
            rawPath.includes("/atasozleri/")
          ) {
            rawPath = rawPath.replace(/\.mp3$/i, ".wav");
          }
          targets.push({
            id,
            label: tag,
            url: resolveAudioUrl(rawPath),
            displayPath: rawPath,
          });
        };
        checkDual(rec.ses_erkek, "male", "Erkek Sesi");
        checkDual(rec.ses_kadin, "female", "Kadın Sesi");
      }

      if (
        (activeTab === "diyaloglar_120" || activeTab === "metinler_60") &&
        Array.isArray(rec.satirlar)
      ) {
        rec.satirlar.forEach((line: GenericRecord, lIdx: number) => {
          const rawLineAudio =
            typeof line.ses_dosyasi === "string" && line.ses_dosyasi.trim()
              ? line.ses_dosyasi.trim()
              : "";
          if (rawLineAudio) {
            targets.push({
              id,
              label: `Satır #${lIdx + 1} Sesi`,
              url: resolveAudioUrl(rawLineAudio),
              displayPath: rawLineAudio,
            });
          }
        });
      }
    });

    const nextBroken: Record<string, string> = {};
    let checked = 0;
    let missingCount = 0;
    let networkErrorCount = 0;
    const total = targets.length;
    setMediaProbeProgress({ checked: 0, total });

    const BATCH_SIZE = 20;
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (target) => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            let res: Response;
            try {
              res = await fetch(target.url, {
                method: "HEAD",
                cache: "no-store",
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timer);
            }
            if (!res.ok) {
              missingCount += 1;
              const msg = `${target.label} ${res.status} (Eksik): ${target.displayPath}`;
              nextBroken[target.id] = nextBroken[target.id]
                ? `${nextBroken[target.id]} | ${msg}`
                : msg;
            }
          } catch {
            networkErrorCount += 1;
            const msg = `${target.label} Ağ/Bağlantı Hatası: ${target.displayPath}`;
            nextBroken[target.id] = nextBroken[target.id]
              ? `${nextBroken[target.id]} | ${msg}`
              : msg;
          } finally {
            checked += 1;
          }
        })
      );
      setMediaProbeProgress({ checked, total });
    }

    setBrokenMediaIds(nextBroken);
    setCheckingMediaHealth(false);
    setMediaProbeProgress(null);

    if (networkErrorCount > 0) {
      playError();
      setStatusBanner({
        type: "error",
        text: `⚠️ Medya taraması sırasında ${networkErrorCount} bağlantıda ağ hatası ve ${missingCount} adet 404 eksik dosya tespit edildi. Ağ hatası nedeniyle tarama "Başarılı" sayılmadı.`,
      });
    } else if (missingCount > 0) {
      playError();
      setStatusBanner({
        type: "info",
        text: `🔍 Toplam ${total} medya adresi tarandı: ${missingCount} adet eksik (404) görsel/ses dosyası tespit edildi.`,
      });
    } else {
      playSuccess();
      setStatusBanner({
        type: "success",
        text: `✅ Toplam ${total} görsel ve ses dosyası eksiksiz doğrulandı (0 kırık bağlantı).`,
      });
    }
  };

  // Eksik 17 Cümle Sesini (cumle_1103 kadın + cumle_1104..1111 erkek/kadın) Otomatik TTS ile Tamamla
  const handleRepairMissingSentenceAudios = async () => {
    playClick();
    if (repairingMissingSentences) return;

    let sentenceList = records;
    if (activeTab !== "cumleler_1111" || sentenceList.length === 0) {
      try {
        const res = await fetch("/api/admin?dataset=cumleler_1111", {
          cache: "no-store",
        });
        const json = await res.json();
        if (res.ok && json?.ok && Array.isArray(json.data)) {
          sentenceList = json.data;
        }
      } catch {
        playError();
        setStatusBanner({
          type: "error",
          text: "1111 Cümle veri seti okunamadı.",
        });
        return;
      }
    }

    const repairJobs: Array<{
      id: string;
      arabicText: string;
      gender: "male" | "female";
      targetPath: string;
    }> = [];

    for (let num = 1103; num <= 1111; num++) {
      const id = `cumle_${String(num).padStart(4, "0")}`;
      const rec = sentenceList.find((r) => r.id === id);
      if (!rec || !rec.arapca) continue;

      if (num >= 1104) {
        repairJobs.push({
          id,
          arabicText: String(rec.arapca),
          gender: "male",
          targetPath: String(
            rec.ses_erkek || `/sesler/cumleler/erkek/${id}.mp3`
          ),
        });
      }
      repairJobs.push({
        id,
        arabicText: String(rec.arapca),
        gender: "female",
        targetPath: String(rec.ses_kadin || `/sesler/cumleler/kadin/${id}.mp3`),
      });
    }

    if (repairJobs.length === 0) {
      setStatusBanner({
        type: "info",
        text: "Onarılacak cumle_1103–1111 kaydı bulunamadı.",
      });
      return;
    }

    setRepairingMissingSentences(true);
    let completed = 0;
    let skippedExisting = 0;
    let failed = 0;

    for (let i = 0; i < repairJobs.length; i++) {
      const job = repairJobs[i];
      setRepairProgressText(
        `🔊 (${i + 1}/${repairJobs.length}) ${job.id} (${
          job.gender === "female" ? "kadın" : "erkek"
        }) kontrol ediliyor...`
      );

      // Halihazırda medya deposunda mevcutsa tekrar üretmeden geç
      try {
        const probeRes = await fetch(resolveAudioUrl(job.targetPath), {
          method: "HEAD",
          cache: "no-store",
        });
        if (probeRes.ok) {
          skippedExisting += 1;
          continue;
        }
      } catch {
        // Eksik veya erişilemiyor; TTS üretimine geç
      }

      setRepairProgressText(
        `🎙️ (${i + 1}/${repairJobs.length}) ${job.id} (${
          job.gender === "female" ? "kadın" : "erkek"
        }) TTS üretilip yükleniyor...`
      );

      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: buildAdminHeaders(),
          body: JSON.stringify({
            action: "generate_and_save_tts",
            text: job.arabicText,
            gender: job.gender,
            targetPath: job.targetPath,
            githubToken,
            owner: repoOwner,
            mediaRepo,
            commitMessage: `fix(audio): ${job.id} (${job.gender}) eksik cümle sesi otomatik tamamlandı`,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.ok) {
          completed += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    setRepairingMissingSentences(false);
    setRepairProgressText(null);
    setCacheBuster((prev) => prev + 1);

    if (failed > 0) {
      playError();
      setStatusBanner({
        type: "error",
        text: `⚠️ Eksik ses onarımı tamamlandı: ${completed} ses üretildi, ${skippedExisting} ses zaten mevcuttu, ${failed} ses yüklenemedi (GitHub Token / ağ yetkisini kontrol edin).`,
      });
    } else {
      playSuccess();
      setStatusBanner({
        type: "success",
        text: `✅ cumle_1103–1111 ses tamamlama başarılı! ${completed} yeni ses üretilip kaydedildi (${skippedExisting} ses zaten mevcuttu).`,
      });
    }
  };

  // Kayıt Düzenleme Modalını Aç
  const openRecordEditor = (index: number) => {
    playClick();
    const target = records[index];
    if (!target) return;
    const cloned = JSON.parse(JSON.stringify(target)) as GenericRecord;
    setEditingIndex(index);
    setDraftRecord(cloned);
    setRawJsonText(JSON.stringify(cloned, null, 2));
    setRawJsonMode(false);
    setImgPreviewBroken(false);
    setMaleAudioStatus("unknown");
    setFemaleAudioStatus("unknown");
    setDialogueSelectedLineIdx(0);
  };

  // Yeni Kayıt Ekle
  const handleAddNewRecord = () => {
    playClick();
    const nextNum = records.length + 1;
    let template: GenericRecord = {
      id: `yeni_${nextNum}`,
      sira: nextNum,
      cefr: "A1",
      kategori_tr: "Genel",
      arapca: "",
      turkce: "",
    };

    if (activeTab === "gorsel_kelimeler") {
      const pad4 = String(nextNum).padStart(4, "0");
      template = {
        id: pad4,
        sira: nextNum,
        cefr: "A1",
        kategori_tr: "Aile ve İnsan",
        arapca: "كَلِمَةٌ جَدِيدَةٌ",
        turkce: "Yeni Kelime",
        kok: "ك ل م",
        ikincil_form: "كَلِمَاتٌ",
        ucuncul_form: "-",
        soru_kalibi: "مَا هٰذِهِ؟",
        ornek_ar: "هٰذِهِ كَلِمَةٌ مُفِيدَةٌ.",
        ornek_tr: "Bu faydalı bir kelimedir.",
        gorsel: `/gorseller/kelimeler/gorsel_${pad4}.webp`,
        ses_erkek: `/sesler/kelimeler/erkek/${pad4}.wav`,
        ses_kadin: `/sesler/kelimeler/kadin/${pad4}.wav`,
      };
    } else if (activeTab === "cumleler_1111") {
      const pad4 = String(nextNum).padStart(4, "0");
      template = {
        id: `cumle_${pad4}`,
        sira: nextNum,
        seviye: "A1",
        tema: "Günlük İletişim",
        odak_kalip: "",
        arapca: "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللّٰهِ",
        turkce: "Allah'ın selamı ve rahmeti üzerinize olsun",
        ses_erkek: `/sesler/cumleler/erkek/cumle_${pad4}.mp3`,
        ses_kadin: `/sesler/cumleler/kadin/cumle_${pad4}.mp3`,
      };
    } else if (activeTab === "atasozleri_508") {
      const pad4 = String(nextNum).padStart(4, "0");
      template = {
        id: `ata_${pad4}`,
        sira: nextNum,
        cefr: "B1",
        tema: "Hikmet ve Sabır",
        arapca: "الصَّبْرُ مِفْتَاحُ الْفَرَجِ",
        turkce: "Sabır ferahlığın anahtarıdır.",
        lafzi_ceviri: "Sabır kurtuluşun anahtarıdır.",
        gorsel: `/gorseller/atasozleri/ata_${pad4}.webp`,
        ses_erkek: `/sesler/atasozleri/erkek/ata_${pad4}.wav`,
        ses_kadin: `/sesler/atasozleri/kadin/ata_${pad4}.wav`,
      };
    } else if (activeTab === "sozluk") {
      template = {
        id: `sozluk_${nextNum}`,
        kok: "ك ت ب",
        tur: "isim",
        mufret: "كِتَابٌ",
        cemi: "كُتُبٌ",
        anlam_tr: "Kitap",
        cefr: "A1",
        ornek_ar: "هٰذَا كِتَابٌ جَدِيدٌ.",
        ornek_tr: "Bu yeni bir kitaptır.",
      };
    } else if (activeTab === "ek_gramer") {
      const pad3 = String(nextNum).padStart(3, "0");
      template = {
        bagli_id: `grm_${pad3}`,
        seviye: "A1",
        ktt_ust_konu: "Temel Gramer",
        konu_basligi: "Yeni Gramer Konusu",
        hap_kural: "Kısa ve öz hap gramer kuralı buraya yazılır.",
        metinden_ornek: {
          arapca: "هٰذَا مِثَالٌ جَدِيدٌ.",
          turkce: "Bu yeni bir örnektir.",
          aciklama: "Örnek cümlenin gramer açıklaması.",
        },
        ek_ornekler: [],
        ipucu: "Pedagojik ipucu notu.",
      };
    } else if (activeTab === "youtube_tavsiyeleri") {
      const pad3 = String(nextNum).padStart(3, "0");
      template = {
        id: `yt_${pad3}`,
        sira: nextNum,
        cefr: "A1",
        tur: "video",
        kategori: "diyalog_egitim",
        baslik_tr: "Yeni Tavsiye Video Başlığı",
        baslik_ar: "عُنْوَانُ الْفِيدْيُو الْجَدِيدِ",
        kanal_adi: "Muallimun Net",
        url: "https://www.youtube.com/watch?v=",
        video_id: "",
        sure_etiketi: "10 dk",
        pedagojik_not:
          "Bu içeriği nasıl izlemeniz gerektiğine dair pedagojik rehber notu.",
        odak_kelimeler: ["حِوَارٌ", "اِسْتِمَاعٌ"],
      };
    } else if (activeTab === "es_zit_anlamlilar") {
      const pad3 = String(nextNum).padStart(3, "0");
      template = {
        id: `ez_${pad3}`,
        sira: nextNum,
        cefr: "A1",
        tur: "isim",
        kelime_ar: "فَرَحٌ",
        kelime_harekesiz: "فرح",
        anlam_tr: "sevinç, neşe",
        es_anlamlilar: [
          {
            ar: "سُرُورٌ",
            harekesiz: "سرور",
            tr: "sevinç, mutluluk",
            nuans_tr: "İç huzuru ve gönül ferahlığı içeren sevinçtir.",
          },
        ],
        zit_anlamlilar: [
          {
            ar: "حُزْنٌ",
            harekesiz: "حزن",
            tr: "hüzün, üzüntü",
          },
        ],
        ornek_cumle_ar: "بَعْدَ الصَّبْرِ يَتَحَوَّلُ الْحُزْنُ إِلَى فَرَحٍ وَسُرُورٍ.",
        ornek_cumle_tr: "Sabırdan sonra hüzün sevince ve mutluluğa dönüşür.",
      };
    }

    const updated = [template, ...records];
    setRecords(updated);
    setHasUnsavedChanges(true);
    openRecordEditor(0);
  };

  // Taslak Kaydı Listeye Uygula ve İsteğe Bağlı Sunucuya/GitHub'a Kaydet
  const handleApplyDraftRecord = async (saveToCloudImmediately = false) => {
    if (editingIndex === null || !draftRecord) return;
    playClick();

    let finalRecord = draftRecord;
    if (rawJsonMode) {
      try {
        finalRecord = JSON.parse(rawJsonText);
      } catch {
        playError();
        setStatusBanner({
          type: "error",
          text: "Ham JSON formatı hatalı! Lütfen parantez ve virgülleri kontrol edin.",
        });
        return;
      }
    }

    const nextList = [...records];
    nextList[editingIndex] = finalRecord;
    setRecords(nextList);
    setDraftRecord(finalRecord);
    setHasUnsavedChanges(true);

    if (saveToCloudImmediately && activeTab !== "efect_manager") {
      await handleSaveDatasetToBackend(nextList);
    } else {
      playSuccess();
      setStatusBanner({
        type: "info",
        text: `Kayıt #${editingIndex + 1} bellekte güncellendi. Kalıcı olması için "💾 Veri Setini Kaydet" butonuna basınız.`,
      });
    }
  };

  // Tüm JSON Veri Setini API Üzerinden GitHub / Yerel Dosyaya Kaydet
  const handleSaveDatasetToBackend = async (customRecords?: GenericRecord[]) => {
    if (activeTab === "efect_manager") return;
    playClick();
    setSavingAll(true);
    setStatusBanner(null);

    const payloadData = customRecords || records;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: buildAdminHeaders(),
        body: JSON.stringify({
          action: "save_json",
          dataset: activeTab,
          data: payloadData,
          baseSha: datasetBaseSha,
          githubToken,
          owner: repoOwner,
          codeRepo,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Kaydetme işlemi başarısız oldu.");
      }
      if (typeof json.newSha === "string") {
        setDatasetBaseSha(json.newSha);
      }
      setHasUnsavedChanges(false);
      playSuccess();
      setStatusBanner({
        type: "success",
        text:
          json.mode === "github"
            ? `✅ ${json.fileName} başarıyla GitHub (${json.repoPath}) deposuna commit edildi!`
            : `✅ ${json.fileName} yerel geliştirici dosya sistemine (src/data/${json.fileName}) kaydedildi!`,
        url: json.htmlUrl,
      });
    } catch (err) {
      playError();
      setStatusBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Kaydetme hatası oluştu.",
      });
    } finally {
      setSavingAll(false);
    }
  };

  // JSON Yedek İndir
  const handleDownloadBackupJson = () => {
    playClick();
    const meta = STUDIO_TABS.find((t) => t.key === activeTab);
    const fileName = meta?.fileName.endsWith(".json")
      ? meta.fileName
      : `${activeTab}_backup.json`;
    const blob = new Blob([JSON.stringify(records, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    playSuccess();
  };

  // 1:1 Kare .webp Görsel Dönüştürücü ve Yükleyici (Canvas 512x512 / 768x768)
  const convertImageFileToSquareWebpBase64 = (
    file: File,
    sizePx: number
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = sizePx;
          canvas.height = sizePx;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas başlatılamadı"));
            return;
          }
          // Beyaz/Krem temiz arka plan ve 1:1 merkezlenmiş ölçekleme
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, sizePx, sizePx);

          const scale = Math.max(sizePx / img.width, sizePx / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const dx = (sizePx - drawW) / 2;
          const dy = (sizePx - drawH) / 2;
          ctx.drawImage(img, dx, dy, drawW, drawH);

          const dataUrl = canvas.toDataURL("image/webp", 0.9);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Görsel okunamadı"));
        img.src = String(reader.result);
      };
      reader.onerror = () => reject(new Error("Dosya okunamadı"));
      reader.readAsDataURL(file);
    });
  };

  const handleUploadImageFile = async (file: File) => {
    if (!draftRecord || editingIndex === null) return;
    playClick();
    const targetPath = getDefaultImagePath(activeTab, draftRecord, editingIndex);
    if (!targetPath) return;

    setMediaBusyLabel("Görsel 1:1 .webp formatına dönüştürülüp yükleniyor...");
    try {
      const webpBase64 = await convertImageFileToSquareWebpBase64(
        file,
        squareResizePx
      );
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: buildAdminHeaders(),
        body: JSON.stringify({
          action: "upload_media",
          base64Content: webpBase64,
          targetPath,
          githubToken,
          owner: repoOwner,
          mediaRepo,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Görsel yüklenemedi.");
      }

      const updatedDraft = { ...draftRecord, gorsel: targetPath };
      setDraftRecord(updatedDraft);
      setRawJsonText(JSON.stringify(updatedDraft, null, 2));
      setCacheBuster((prev) => prev + 1);
      setImgPreviewBroken(false);
      playSuccess();
      setStatusBanner({
        type: "success",
        text: `🖼️ Görsel başarıyla yüklendi: ${json.repoFilePath}`,
        url: json.htmlUrl,
      });
    } catch (err) {
      playError();
      setStatusBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Görsel yükleme hatası",
      });
    } finally {
      setMediaBusyLabel(null);
    }
  };

  // Ses (.mp3 / .wav) Dosyası Yükleme (Erkek / Kadın / Efect)
  const handleUploadAudioBlobOrFile = async (
    blobOrFile: Blob,
    targetPath: string,
    gender: "male" | "female"
  ) => {
    if (!draftRecord) return;
    setMediaBusyLabel(`Ses dosyası (${targetPath}) yükleniyor...`);
    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Ses dosyası okunamadı"));
        reader.readAsDataURL(blobOrFile);
      });

      const res = await fetch("/api/admin", {
        method: "POST",
        headers: buildAdminHeaders(),
        body: JSON.stringify({
          action: "upload_media",
          base64Content,
          targetPath,
          githubToken,
          owner: repoOwner,
          mediaRepo,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Ses yüklenemedi.");
      }

      if (activeTab !== "efect_manager") {
        if (
          Array.isArray(draftRecord.satirlar) &&
          draftRecord.satirlar[dialogueSelectedLineIdx]
        ) {
          const nextLines = [...draftRecord.satirlar];
          nextLines[dialogueSelectedLineIdx] = {
            ...nextLines[dialogueSelectedLineIdx],
            ses_dosyasi: targetPath,
          };
          const updatedDraft = { ...draftRecord, satirlar: nextLines };
          setDraftRecord(updatedDraft);
          setRawJsonText(JSON.stringify(updatedDraft, null, 2));
        } else {
          const fieldName = gender === "female" ? "ses_kadin" : "ses_erkek";
          const updatedDraft = { ...draftRecord, [fieldName]: targetPath };
          setDraftRecord(updatedDraft);
          setRawJsonText(JSON.stringify(updatedDraft, null, 2));
        }
      }

      if (gender === "female") setFemaleAudioStatus("ready");
      else setMaleAudioStatus("ready");
      setCacheBuster((prev) => prev + 1);
      playSuccess();
      setStatusBanner({
        type: "success",
        text: `🔊 Ses dosyası başarıyla yüklendi: ${json.repoFilePath}`,
        url: json.htmlUrl,
      });
    } catch (err) {
      playError();
      setStatusBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Ses yükleme hatası",
      });
    } finally {
      setMediaBusyLabel(null);
    }
  };

  // Otomatik TTS ile Ses Üret & Medya Deposuna Kaydet
  const handleGenerateAndSaveTts = async (
    arabicText: string,
    targetPath: string,
    gender: "male" | "female"
  ) => {
    if (!arabicText.trim()) {
      playError();
      setStatusBanner({
        type: "error",
        text: "Seslendirilecek Arapça metin boş olamaz!",
      });
      return;
    }
    playClick();
    setMediaBusyLabel(
      `🎙️ "${arabicText.slice(0, 28)}" için ${
        gender === "female" ? "Kadın" : "Erkek"
      } sesi üretilip kaydediliyor...`
    );

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: buildAdminHeaders(),
        body: JSON.stringify({
          action: "generate_and_save_tts",
          text: arabicText,
          gender,
          targetPath,
          githubToken,
          owner: repoOwner,
          mediaRepo,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "TTS ses üretimi başarısız oldu.");
      }

      if (json.base64Audio) {
        const audio = new Audio(json.base64Audio);
        void audio.play().catch(() => {});
      }

      if (draftRecord && activeTab !== "efect_manager") {
        const fieldName = gender === "female" ? "ses_kadin" : "ses_erkek";
        const updatedDraft = { ...draftRecord, [fieldName]: targetPath };
        setDraftRecord(updatedDraft);
        setRawJsonText(JSON.stringify(updatedDraft, null, 2));
      }

      if (gender === "female") setFemaleAudioStatus("ready");
      else setMaleAudioStatus("ready");
      setCacheBuster((prev) => prev + 1);
      playSuccess();
      setStatusBanner({
        type: "success",
        text: `✨ TTS (${json.ttsEngine}) ile ses üretildi ve kaydedildi: ${json.repoFilePath}`,
        url: json.htmlUrl,
      });
    } catch (err) {
      playError();
      setStatusBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Otomatik ses üretme hatası",
      });
    } finally {
      setMediaBusyLabel(null);
    }
  };

  // Tarayıcı Mikrofonundan Kayıt Başlat / Durdur ve Gerçek 16-bit Mono PCM .wav Olarak Yükle
  const handleToggleMicRecord = async (
    targetPath: string,
    gender: "male" | "female"
  ) => {
    playClick();
    if (recordingGender === gender && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingGender(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const rawRecordedBlob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (rawRecordedBlob.size <= 100) return;

        setMediaBusyLabel(
          "Mikrofon kaydı 16-bit Mono PCM (.wav) formatına dönüştürülüyor..."
        );
        try {
          const wavBlob = await convertRecordedBlobToMonoWav16(rawRecordedBlob);
          const wavTargetPath = targetPath.replace(/\.(mp3|wav)$/i, ".wav");
          await handleUploadAudioBlobOrFile(wavBlob, wavTargetPath, gender);
        } catch (err) {
          setMediaBusyLabel(null);
          playError();
          setStatusBanner({
            type: "error",
            text:
              err instanceof Error
                ? `WAV dönüştürme hatası: ${err.message}`
                : "Mikrofon kaydı WAV formatına dönüştürülemedi.",
          });
        }
      };

      recorder.start();
      setRecordingGender(gender);
    } catch {
      playError();
      setStatusBanner({
        type: "error",
        text: "Mikrofon izni alınamadı. Lütfen tarayıcı izinlerini kontrol edin.",
      });
    }
  };

  // Ses Önizleme Oynatıcısı
  const handlePlayPreviewAudio = (
    rawTargetPath: string,
    gender: "male" | "female"
  ) => {
    playClick();
    if (activeAudioElRef.current) {
      activeAudioElRef.current.pause();
      activeAudioElRef.current = null;
    }

    const clean = rawTargetPath.replace(/^\/+/, "");
    const resolvedUrl = clean.startsWith("efect/")
      ? `https://raw.githubusercontent.com/muallimun/arapca_telaffuz_medya/main/${clean}?t=${cacheBuster}`
      : `${resolveAudioUrl(rawTargetPath)}?t=${cacheBuster}`;

    const audio = new Audio(resolvedUrl);
    activeAudioElRef.current = audio;
    audio.onloadeddata = () => {
      if (gender === "female") setFemaleAudioStatus("ready");
      else setMaleAudioStatus("ready");
    };
    audio.onerror = () => {
      // Yerel public klasöründen dene
      const localFallback = new Audio(`/${clean}?t=${cacheBuster}`);
      localFallback.onloadeddata = () => {
        if (gender === "female") setFemaleAudioStatus("ready");
        else setMaleAudioStatus("ready");
      };
      localFallback.onerror = () => {
        if (gender === "female") setFemaleAudioStatus("missing");
        else setMaleAudioStatus("missing");
      };
      void localFallback.play().catch(() => {});
    };
    void audio.play().catch(() => {});
  };

  const updateDraftField = (key: string, value: unknown) => {
    if (!draftRecord) return;
    const next = { ...draftRecord, [key]: value };
    setDraftRecord(next);
    setRawJsonText(JSON.stringify(next, null, 2));
  };

  const isCloudActive = Boolean(githubToken.trim());

  if (!isAdminUnlocked) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 sm:py-16">
        <div className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-6 sm:p-8 shadow-md space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#087F5B] text-white flex items-center justify-center shadow-xs shrink-0">
              <Lock size={24} />
            </div>
            <Link
              href="/"
              onClick={() => playClick()}
              className="h-9 px-3.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center gap-1.5 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B]"
            >
              <ChevronLeft size={15} />
              <span>Ana Sayfaya Dön</span>
            </Link>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#F3F0FF] dark:bg-indigo-950/70 border border-[#6741D9]/40 text-[11px] font-black text-[#4C28B5] dark:text-indigo-300">
              <ShieldCheck size={13} />
              <span>YETKİLİ YÖNETİCİ ERİŞİMİ</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--foreground)]">
              🔒 Yönetici Doğrulaması (Admin Stüdyosu)
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[var(--muted)] leading-relaxed">
              İçerik, Ses ve Görsel Yönetim Stüdyosu yalnızca yetkili yöneticilere
              açıktır. Devam etmek için GitHub Erişim Anahtarınızı (
              <code className="font-mono text-[#065F46] dark:text-emerald-400">
                github_pat_...
              </code>{" "}
              veya{" "}
              <code className="font-mono text-[#065F46] dark:text-emerald-400">
                ghp_...
              </code>
              ) girin.
            </p>
          </div>

          <form onSubmit={handleUnlockAdminStudio} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-gh-token-input"
                className="text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5"
              >
                <KeyRound size={14} className="text-[#087F5B]" />
                <span>GitHub Personal Access Token (github_pat_... / ghp_...)</span>
              </label>
              <input
                id="admin-gh-token-input"
                type="password"
                value={lockTokenInput}
                onChange={(e) => {
                  setLockTokenInput(e.target.value);
                  if (lockError) setLockError(null);
                }}
                placeholder="github_pat_xxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
                className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] focus:border-[#087F5B] focus:outline-none text-xs sm:text-sm font-mono text-[var(--foreground)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-[var(--muted)] block">
                  Organizasyon / Sahip
                </label>
                <input
                  type="text"
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-white/80 dark:bg-[var(--background)] border border-[#E6D7BE] text-xs font-bold text-[var(--foreground)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-[var(--muted)] block">
                  Kod Deposu
                </label>
                <input
                  type="text"
                  value={codeRepo}
                  onChange={(e) => setCodeRepo(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-white/80 dark:bg-[var(--background)] border border-[#E6D7BE] text-xs font-bold text-[var(--foreground)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-[var(--muted)] block">
                  Medya Deposu
                </label>
                <input
                  type="text"
                  value={mediaRepo}
                  onChange={(e) => setMediaRepo(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-white/80 dark:bg-[var(--background)] border border-[#E6D7BE] text-xs font-bold text-[var(--foreground)]"
                />
              </div>
            </div>

            {lockError && (
              <div className="rounded-xl border-2 border-rose-400 bg-rose-50 dark:bg-rose-950/50 p-3 flex items-start gap-2 text-xs font-extrabold text-rose-800 dark:text-rose-200">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                <span>{lockError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifyingToken}
              className="w-full h-11 rounded-xl bg-[#087F5B] hover:bg-[#065F46] disabled:opacity-60 text-white font-black text-xs sm:text-sm border-b-4 border-[#064E3B] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock size={16} />
              <span>
                {verifyingToken
                  ? "GitHub Anahtarı Doğrulanıyor..."
                  : "🔓 Doğrula ve Yönetim Stüdyosunu Aç"}
              </span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      {/* 1. ÜST BAĞLANTI & DEPO AYAR ÇUBUĞU */}
      <header className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              onClick={() => playClick()}
              className="h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center gap-1.5 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B]"
            >
              <ChevronLeft size={15} />
              <span>Ana Sayfa</span>
            </Link>
            <div>
              <h1 className="text-base sm:text-xl font-black text-[var(--foreground)] flex items-center gap-2">
                <span>🛠️ İçerik, Ses &amp; Görsel Yönetim Stüdyosu</span>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg bg-[#087F5B] text-white">
                  /admin
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs font-semibold text-[var(--muted)]">
                11 JSON Veri Tabanı + YouTube Rehberi + 1:1 .webp Görsel Dönüştürücü + Çift Cinsiyet .mp3 &amp; TTS Stüdyosu
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Çalışma Modu Göstergesi */}
            <span
              className={`px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1.5 ${
                isCloudActive
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200"
                  : "bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-900 dark:text-amber-200"
              }`}
            >
              {isCloudActive ? (
                <>
                  <Cloud size={14} className="text-emerald-600" />
                  <span>☁️ GitHub Bulut Senkronizasyonu Aktif</span>
                </>
              ) : (
                <>
                  <HardDrive size={14} className="text-amber-600" />
                  <span>💻 Yerel Geliştirici Modu (Localhost)</span>
                </>
              )}
            </span>

            {/* 🩺 Veri & Medya Denetleyicisi Butonu */}
            <button
              type="button"
              onClick={() => {
                playClick();
                setIsHealthModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/70 border-2 border-[#6741D9] text-[#4C28B5] dark:text-indigo-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer hover:bg-[#E5DBFF]"
            >
              <Stethoscope size={14} />
              <span>🩺 Veri &amp; Medya Denetleyicisi</span>
              {healthIssues.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-rose-600 text-white text-[10px] font-black">
                  {healthIssues.length}
                </span>
              )}
            </button>

            {/* Depo & Token Ayar Çekmecesi Butonu */}
            <button
              type="button"
              onClick={() => {
                playClick();
                setIsSettingsOpen((v) => !v);
              }}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5 cursor-pointer hover:border-[#087F5B]"
            >
              <Settings size={14} />
              <span>GitHub &amp; Depo Ayarları</span>
            </button>

            {/* 🔒 Çıkış Yap / Kilitle Butonu */}
            <button
              type="button"
              onClick={handleLockAdminStudio}
              className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-400 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer hover:bg-rose-100"
              title="Yönetici oturumunu kapat ve stüdyoyu kilitle"
            >
              <LogOut size={14} />
              <span>🔒 Çıkış Yap / Kilitle</span>
            </button>
          </div>
        </div>

        {/* Açılır/Kapanır GitHub Token & Çift Depo Ayar Çekmecesi */}
        {isSettingsOpen && (
          <div className="pt-3 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 animate-in fade-in duration-150">
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-[var(--foreground)] block">
                🔑 GitHub Personal Access Token (ghp_...)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) =>
                  saveRepoSettingsToStorage(
                    e.target.value,
                    repoOwner,
                    codeRepo,
                    mediaRepo
                  )
                }
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-xs font-mono text-[var(--foreground)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-[var(--foreground)] block">
                👤 GitHub Kullanıcı / Organizasyon Adı
              </label>
              <input
                type="text"
                value={repoOwner}
                onChange={(e) =>
                  saveRepoSettingsToStorage(
                    githubToken,
                    e.target.value,
                    codeRepo,
                    mediaRepo
                  )
                }
                placeholder="muallimun"
                className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-xs font-bold text-[var(--foreground)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-[var(--foreground)] block">
                📦 Kod &amp; JSON Deposu (src/data/*.json)
              </label>
              <input
                type="text"
                value={codeRepo}
                onChange={(e) =>
                  saveRepoSettingsToStorage(
                    githubToken,
                    repoOwner,
                    e.target.value,
                    mediaRepo
                  )
                }
                placeholder="arapca_telaffuz_web_v2"
                className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-xs font-bold text-[var(--foreground)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-[var(--foreground)] block">
                🎵 Medya Deposu (.mp3 &amp; .webp)
              </label>
              <input
                type="text"
                value={mediaRepo}
                onChange={(e) =>
                  saveRepoSettingsToStorage(
                    githubToken,
                    repoOwner,
                    codeRepo,
                    e.target.value
                  )
                }
                placeholder="arapca_telaffuz_medya"
                className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-xs font-bold text-[var(--foreground)]"
              />
            </div>
          </div>
        )}
      </header>

      {/* DURUM BİLDİRİM ÇUBUĞU */}
      {statusBanner && (
        <div
          className={`rounded-2xl border-2 px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-extrabold ${
            statusBanner.type === "success"
              ? "bg-emerald-50 border-emerald-500 text-emerald-950"
              : statusBanner.type === "error"
              ? "bg-rose-50 border-rose-500 text-rose-950"
              : "bg-amber-50 border-amber-400 text-amber-950"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{statusBanner.text}</span>
            {statusBanner.url && (
              <a
                href={statusBanner.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-1 text-[#065F46]"
              >
                <span>GitHub&apos;da Gör</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. ÜST SEKMELER (VERİ SETLERİ + SES EFEKTLERİ YÖNETİCİSİ) */}
      <div className="flex flex-wrap gap-1.5">
        {STUDIO_TABS.map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                playClick();
                setActiveTab(tab.key);
              }}
              className={`flex-1 min-w-[138px] sm:min-w-[155px] px-2.5 py-2 rounded-2xl border-2 border-b-4 text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-[#087F5B] border-[#065F46] text-white shadow-sm"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
              }`}
            >
              <span className="text-xs font-extrabold leading-tight truncate">
                {tab.icon} {tab.shortLabel}
              </span>
              <span
                className={`text-[10px] font-bold mt-0.5 truncate ${
                  isSelected ? "text-emerald-100" : "text-[var(--muted)]"
                }`}
              >
                {tab.fileName}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. FİLTRE, ARAMA VE AKSİYON ÇUBUĞU */}
      <section className="rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] p-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Arapça, Türkçe, Kök, ID veya Kategori ara..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-bold text-[var(--foreground)] focus:outline-none focus:border-[#087F5B]"
            />
          </div>

          {activeTab !== "efect_manager" && (
            <div className="flex items-center gap-1">
              {["all", "A1", "A2", "B1", "B2"].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    playClick();
                    setLevelFilter(lvl);
                    setCurrentPage(1);
                  }}
                  className={`h-9 px-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                    levelFilter === lvl
                      ? "bg-[#6741D9] text-white border-[#5230B5]"
                      : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE]"
                  }`}
                >
                  {lvl === "all" ? "Tüm Kurlar" : lvl}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "cumleler_1111" && (
            <button
              type="button"
              disabled={repairingMissingSentences}
              onClick={() => void handleRepairMissingSentenceAudios()}
              className="h-9 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-extrabold border-b-2 border-amber-800 flex items-center gap-1.5 cursor-pointer"
              title="cumle_1103 kadın ve cumle_1104–1111 erkek/kadın eksik ses dosyalarını otomatik üretip medya deposuna yükler"
            >
              <Volume2 size={14} />
              <span>
                {repairingMissingSentences
                  ? repairProgressText || "Eksik Sesler Üretiliyor..."
                  : "🔊 Eksik Sesleri Tamamla (cumle_1103–1111)"}
              </span>
            </button>
          )}

          {activeTab !== "efect_manager" && (
            <>
              <button
                type="button"
                onClick={handleAddNewRecord}
                className="h-9 px-3 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold border-b-2 border-[#3b1f8c] flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>➕ Yeni Kayıt Ekle</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSaveDatasetToBackend()}
                disabled={savingAll}
                className={`h-9 px-3.5 rounded-xl text-white text-xs font-extrabold border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  hasUnsavedChanges
                    ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-800 animate-pulse"
                    : "bg-[#087F5B] hover:bg-[#065F46] border-[#065F46]"
                }`}
              >
                <Save size={14} />
                <span>
                  {savingAll
                    ? "Kaydediliyor..."
                    : isCloudActive
                    ? "💾 GitHub'a Commit Et"
                    : "💾 Veri Setini Kaydet"}
                </span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleDownloadBackupJson}
            className="h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#087F5B] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={14} />
            <span>📥 JSON İndir (Yedek)</span>
          </button>
        </div>
      </section>

      {/* 4. KAYIT LİSTESİ TABLOSU (SAYFALAMALI — 25 KAYIT / SAYFA) */}
      <section className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-white dark:bg-[var(--surface)] overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-[#F7EFE1] dark:bg-[var(--background)] border-b border-[#E6D7BE] flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-[var(--foreground)]">
          <span>
            {STUDIO_TABS.find((t) => t.key === activeTab)?.label} — Toplam{" "}
            {filteredRecords.length} Kayıt (Sayfa {currentPage}/{totalPages})
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => {
                playClick();
                setCurrentPage((p) => Math.max(1, p - 1));
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft size={13} />
              <span>Önceki</span>
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => {
                playClick();
                setCurrentPage((p) => Math.min(totalPages, p + 1));
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <span>Sonraki</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm font-extrabold text-[var(--muted)] flex items-center justify-center gap-2">
            <RefreshCw size={18} className="animate-spin text-[#087F5B]" />
            <span>Veri tabanı yükleniyor...</span>
          </div>
        ) : (
          <div className="divide-y divide-[#E6D7BE]/60">
            {paginatedRecords.map(({ rec, originalIndex }) => {
              const id = getRecordId(rec, originalIndex);
              const lvl = getRecordLevel(rec);
              const cat = getRecordCategory(rec);
              const ar =
                activeTab === "efect_manager"
                  ? String(rec.arabicSample || "")
                  : getRecordArabic(rec);
              const tr =
                activeTab === "efect_manager"
                  ? String(rec.titleTr || "")
                  : getRecordTurkish(rec);
              const thumbUrl =
                activeTab === "efect_manager"
                  ? ""
                  : getPreviewImageUrl(activeTab, rec, originalIndex, cacheBuster);

              return (
                <div
                  key={`${id}-${originalIndex}`}
                  className="px-3.5 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 hover:bg-[#FDFBF7] dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="px-2 py-1 rounded-lg bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] text-[11px] font-mono font-extrabold text-[var(--foreground)] shrink-0">
                      #{originalIndex + 1} • {id}
                    </span>

                    {thumbUrl && (
                      <img
                        src={thumbUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                        className="w-10 h-10 aspect-square object-contain rounded-lg border border-slate-200 bg-white shrink-0"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                          {lvl}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-900 truncate max-w-[200px]">
                          {cat}
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] truncate">
                          {tr}
                        </span>
                      </div>
                      {ar && (
                        <p
                          dir="rtl"
                          className="arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 truncate mt-0.5"
                        >
                          {ar}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {activeTab === "efect_manager" && (
                      <button
                        type="button"
                        onClick={() =>
                          handlePlayPreviewAudio(String(rec.targetPath), rec.gender)
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <Play size={13} />
                        <span>▶️ Dinle</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openRecordEditor(originalIndex)}
                      className="px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-2 border-[#065F46] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 size={13} />
                      <span>Düzenle (Metin + Medya)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. BİRLEŞİK KAYIT & MEDYA DÜZENLEME MODALI (İKİ SÜTUNLU: SOL METİN, SAĞ GÖRSEL & SES STÜDYOSU) */}
      {editingIndex !== null && draftRecord && (
        <div
          className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          onClick={() => setEditingIndex(null)}
        >
          <div
            className="w-full max-w-6xl bg-[#FDFBF7] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Üst Bar */}
            <div className="px-4 sm:px-6 py-3 bg-[#F7EFE1] dark:bg-[var(--background)] border-b border-[#E6D7BE] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold">
                  Kayıt #{editingIndex + 1} • {getRecordId(draftRecord, editingIndex)}
                </span>
                <h3 className="text-sm sm:text-base font-black text-[var(--foreground)] truncate max-w-md">
                  {getRecordTurkish(draftRecord) || draftRecord.titleTr || "Kayıt & Medya Düzenleyici"}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    if (!rawJsonMode) {
                      setRawJsonText(JSON.stringify(draftRecord, null, 2));
                    } else {
                      try {
                        setDraftRecord(JSON.parse(rawJsonText));
                      } catch {
                        // ignore
                      }
                    }
                    setRawJsonMode((v) => !v);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                    rawJsonMode
                      ? "bg-[#6741D9] text-white border-[#5230B5]"
                      : "bg-white dark:bg-[var(--surface)] text-[var(--foreground)] border-[#E6D7BE]"
                  }`}
                >
                  <Code2 size={14} />
                  <span>{rawJsonMode ? "Form Görünümüne Dön" : "Ham JSON Düzenle"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditingIndex(null)}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {mediaBusyLabel && (
              <div className="px-4 py-2 bg-amber-100 border-b border-amber-300 text-amber-950 text-xs font-extrabold flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin text-amber-700" />
                <span>{mediaBusyLabel}</span>
              </div>
            )}

            {/* İKİ SÜTUNLU ANA GÖVDE */}
            <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
              {/* SOL SÜTUN (7/12): METİN VE DİL BİLİMİ ALANLARI */}
              <div className="lg:col-span-7 space-y-3.5">
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-dashed border-[#E2D3B8]">
                  <h4 className="text-xs sm:text-sm font-black text-[#065F46] dark:text-emerald-400 uppercase tracking-wide">
                    📝 SOL SÜTUN — Metin, Hareke &amp; Dil Bilimi Alanları
                  </h4>
                  {/* Hızlı Hareke Ekleme Tuşları */}
                  <div className="flex flex-wrap items-center gap-1">
                    {HAREKE_KEYS.map((hk) => (
                      <button
                        key={hk.label}
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(hk.char);
                          setStatusBanner({
                            type: "info",
                            text: `${hk.label} panoya kopyalandı (Ctrl+V ile yapıştırabilirsiniz).`,
                          });
                        }}
                        className="px-1.5 py-0.5 rounded bg-white border border-[#E6D7BE] text-[11px] font-bold hover:border-[#087F5B] cursor-pointer"
                        title={`${hk.label} kopyala`}
                      >
                        {hk.label.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {rawJsonMode ? (
                  <textarea
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    rows={18}
                    className="w-full p-3 rounded-2xl bg-slate-950 text-emerald-300 font-mono text-xs border-2 border-slate-700 focus:outline-none"
                  />
                ) : activeTab === "efect_manager" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-extrabold block mb-1">
                        Efekt Başlığı (Türkçe)
                      </label>
                      <input
                        type="text"
                        value={String(draftRecord.titleTr || "")}
                        onChange={(e) => updateDraftField("titleTr", e.target.value)}
                        className="w-full h-9 px-3 rounded-xl bg-white border border-[#E6D7BE] text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-extrabold block mb-1">
                        TTS Seslendirme Metni (Arapça)
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={String(draftRecord.arabicSample || "")}
                        onChange={(e) =>
                          updateDraftField("arabicSample", e.target.value)
                        }
                        className="w-full h-11 px-3 rounded-xl bg-white border border-[#E6D7BE] arabic text-2xl font-bold text-[#065F46]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Üst Satır: ID, Seviye, Kategori */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                          Kayıt ID
                        </label>
                        <input
                          type="text"
                          value={String(
                            draftRecord.id ||
                              draftRecord.bagli_id ||
                              draftRecord.diyalog_id ||
                              draftRecord.metin_id ||
                              ""
                          )}
                          onChange={(e) => {
                            if ("bagli_id" in draftRecord)
                              updateDraftField("bagli_id", e.target.value);
                            else if ("diyalog_id" in draftRecord)
                              updateDraftField("diyalog_id", e.target.value);
                            else if ("metin_id" in draftRecord)
                              updateDraftField("metin_id", e.target.value);
                            else updateDraftField("id", e.target.value);
                          }}
                          className="w-full h-9 px-3 rounded-xl bg-white border border-[#E6D7BE] text-xs font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                          Kur Seviyesi (CEFR)
                        </label>
                        <select
                          value={getRecordLevel(draftRecord)}
                          onChange={(e) => {
                            if ("seviye" in draftRecord)
                              updateDraftField("seviye", e.target.value);
                            else updateDraftField("cefr", e.target.value);
                          }}
                          className="w-full h-9 px-3 rounded-xl bg-white border border-[#E6D7BE] text-xs font-extrabold"
                        >
                          <option value="A1">A1 (Başlangıç)</option>
                          <option value="A2">A2 (Temel)</option>
                          <option value="B1">B1 (Orta)</option>
                          <option value="B2">B2 (İleri)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                          {activeTab === "youtube_tavsiyeleri"
                            ? "İzleme Kategorisi"
                            : activeTab === "es_zit_anlamlilar"
                            ? "Kelime Türü (tur)"
                            : "Kategori / Tema / KTT Üst Konu"}
                        </label>
                        {activeTab === "youtube_tavsiyeleri" ? (
                          <select
                            value={String(
                              draftRecord.kategori || "diyalog_egitim"
                            )}
                            onChange={(e) =>
                              updateDraftField("kategori", e.target.value)
                            }
                            className="w-full h-9 px-3 rounded-xl bg-white border border-[#E6D7BE] text-xs font-extrabold"
                          >
                            {YOUTUBE_CATEGORY_ORDER.map((catId) => {
                              const meta = YOUTUBE_CATEGORY_META[catId];
                              return (
                                <option key={catId} value={catId}>
                                  {meta.emoji} {meta.label}
                                </option>
                              );
                            })}
                          </select>
                        ) : activeTab === "es_zit_anlamlilar" ? (
                          <select
                            value={String(draftRecord.tur || "isim")}
                            onChange={(e) =>
                              updateDraftField("tur", e.target.value)
                            }
                            className="w-full h-9 px-3 rounded-xl bg-white border border-[#E6D7BE] text-xs font-extrabold"
                          >
                            <option value="isim">📘 İsim (اسم)</option>
                            <option value="fiil">⚡ Fiil (فعل)</option>
                            <option value="sifat">✨ Sıfat (صفة)</option>
                            <option value="zarf">⏳ Zarf (ظرف)</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={String(
                              draftRecord.ktt_ust_konu ||
                                draftRecord.ust_konu ||
                                draftRecord.kategori_tr ||
                                draftRecord.tema ||
                                draftRecord.odak_gramer ||
                                draftRecord.tur ||
                                ""
                            )}
                            onChange={(e) => {
                              if ("ktt_ust_konu" in draftRecord)
                                updateDraftField("ktt_ust_konu", e.target.value);
                              else if ("ust_konu" in draftRecord)
                                updateDraftField("ust_konu", e.target.value);
                              else if ("kategori_tr" in draftRecord)
                                updateDraftField("kategori_tr", e.target.value);
                              else if ("tema" in draftRecord)
                                updateDraftField("tema", e.target.value);
                              else if ("odak_gramer" in draftRecord)
                                updateDraftField("odak_gramer", e.target.value);
                              else updateDraftField("tur", e.target.value);
                            }}
                            className="w-full h-9 px-3 rounded-xl bg-white border border-[#E6D7BE] text-xs font-bold"
                          />
                        )}
                      </div>
                    </div>

                    {/* Ana Arapça ve Türkçe Alanları */}
                    {activeTab !== "diyalog_gramer" &&
                      activeTab !== "metin_gramer" &&
                      activeTab !== "ek_gramer" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-extrabold text-[#065F46] block mb-1">
                              Arapça Ana Metin / Başlık (Harekeli)
                            </label>
                            <input
                              type="text"
                              dir="rtl"
                              value={String(
                                draftRecord.kelime_ar ??
                                  draftRecord.arapca ??
                                  draftRecord.baslik_ar ??
                                  draftRecord.mufret ??
                                  draftRecord.mazi ??
                                  ""
                              )}
                              onChange={(e) => {
                                if ("kelime_ar" in draftRecord) {
                                  const nextDraft: GenericRecord = {
                                    ...draftRecord,
                                    kelime_ar: e.target.value,
                                    kelime_harekesiz: stripHarakat(
                                      e.target.value
                                    ),
                                  };
                                  setDraftRecord(nextDraft);
                                  setRawJsonText(
                                    JSON.stringify(nextDraft, null, 2)
                                  );
                                } else if ("baslik_ar" in draftRecord)
                                  updateDraftField("baslik_ar", e.target.value);
                                else if ("mufret" in draftRecord)
                                  updateDraftField("mufret", e.target.value);
                                else if ("mazi" in draftRecord && !("arapca" in draftRecord))
                                  updateDraftField("mazi", e.target.value);
                                else updateDraftField("arapca", e.target.value);
                              }}
                              className="w-full h-11 px-3 rounded-xl bg-white border-2 border-[#087F5B]/40 arabic text-2xl font-bold text-[#065F46]"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-extrabold text-[var(--foreground)] block mb-1">
                              Türkçe Anlamı / Başlığı
                            </label>
                            <input
                              type="text"
                              value={String(
                                draftRecord.turkce ??
                                  draftRecord.baslik_tr ??
                                  draftRecord.anlam_tr ??
                                  ""
                              )}
                              onChange={(e) => {
                                if ("baslik_tr" in draftRecord)
                                  updateDraftField("baslik_tr", e.target.value);
                                else if ("anlam_tr" in draftRecord)
                                  updateDraftField("anlam_tr", e.target.value);
                                else updateDraftField("turkce", e.target.value);
                              }}
                              className="w-full h-11 px-3 rounded-xl bg-white border border-[#E6D7BE] text-xs sm:text-sm font-bold"
                            />
                          </div>
                        </div>
                      )}

                    {/* Morfoloji & Sarf Alanları (Görsel Kelimeler & Sözlük) */}
                    {(activeTab === "gorsel_kelimeler" ||
                      activeTab === "sozluk") && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-[#F7EFE1]/70 border border-[#E6D7BE]">
                        <div>
                          <label className="text-[10px] font-extrabold text-amber-900 block mb-1">
                            Kök Harfler (جذر)
                          </label>
                          <input
                            type="text"
                            dir="rtl"
                            value={String(draftRecord.kok || "")}
                            onChange={(e) => updateDraftField("kok", e.target.value)}
                            className="w-full h-9 px-2.5 rounded-lg bg-white border border-amber-300 arabic text-lg font-bold text-amber-900"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-violet-900 block mb-1">
                            Çoğul (Cemî) / Muzâri
                          </label>
                          <input
                            type="text"
                            dir="rtl"
                            value={String(
                              draftRecord.ikincil_form ??
                                draftRecord.cemi ??
                                draftRecord.muzari ??
                                ""
                            )}
                            onChange={(e) => {
                              if ("ikincil_form" in draftRecord)
                                updateDraftField("ikincil_form", e.target.value);
                              else if ("muzari" in draftRecord)
                                updateDraftField("muzari", e.target.value);
                              else updateDraftField("cemi", e.target.value);
                            }}
                            className="w-full h-9 px-2.5 rounded-lg bg-white border border-violet-300 arabic text-lg font-bold text-violet-900"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-emerald-900 block mb-1">
                            Masdar / 3. Form
                          </label>
                          <input
                            type="text"
                            dir="rtl"
                            value={String(
                              draftRecord.ucuncul_form ?? draftRecord.masdar ?? ""
                            )}
                            onChange={(e) => {
                              if ("ucuncul_form" in draftRecord)
                                updateDraftField("ucuncul_form", e.target.value);
                              else updateDraftField("masdar", e.target.value);
                            }}
                            className="w-full h-9 px-2.5 rounded-lg bg-white border border-emerald-300 arabic text-lg font-bold text-emerald-900"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-700 block mb-1">
                            Soru Kalıbı (مَا هٰذَا؟)
                          </label>
                          <input
                            type="text"
                            dir="rtl"
                            value={String(draftRecord.soru_kalibi || "")}
                            onChange={(e) =>
                              updateDraftField("soru_kalibi", e.target.value)
                            }
                            className="w-full h-9 px-2.5 rounded-lg bg-white border border-slate-300 arabic text-lg font-bold text-slate-800"
                          />
                        </div>
                      </div>
                    )}

                    {/* Örnek Cümle / Lafzi Çeviri Alanları */}
                    {(activeTab === "gorsel_kelimeler" ||
                      activeTab === "sozluk" ||
                      activeTab === "atasozleri_508") && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                            {activeTab === "atasozleri_508"
                              ? "Lafzî (Kelimesi Kelimesine) Çeviri"
                              : "Örnek Cümle (Arapça)"}
                          </label>
                          <input
                            type="text"
                            dir={activeTab === "atasozleri_508" ? "ltr" : "rtl"}
                            value={String(
                              activeTab === "atasozleri_508"
                                ? draftRecord.lafzi_ceviri || ""
                                : draftRecord.ornek_ar || ""
                            )}
                            onChange={(e) =>
                              updateDraftField(
                                activeTab === "atasozleri_508"
                                  ? "lafzi_ceviri"
                                  : "ornek_ar",
                                e.target.value
                              )
                            }
                            className={`w-full h-9 px-3 rounded-xl bg-white border border-[#E6D7BE] ${
                              activeTab === "atasozleri_508"
                                ? "text-xs font-bold"
                                : "arabic text-lg font-bold text-[#065F46]"
                            }`}
                          />
                        </div>
                        {activeTab !== "atasozleri_508" && (
                          <div>
                            <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                              Örnek Cümle Çevirisi (Türkçe)
                            </label>
                            <input
                              type="text"
                              value={String(draftRecord.ornek_tr || "")}
                              onChange={(e) =>
                                updateDraftField("ornek_tr", e.target.value)
                              }
                              className="w-full h-9 px-3 rounded-xl bg-white border border-[#E6D7BE] text-xs font-bold"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Diyalog veya Okuma Metni Cümle Satırları Düzenleyici */}
                    {Array.isArray(draftRecord.satirlar) && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-[#4C28B5]">
                            💬 Cümle Satırları ({draftRecord.satirlar.length} Satır) — Seçili Satır: #{dialogueSelectedLineIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextLines = [
                                ...draftRecord.satirlar,
                                {
                                  sira: draftRecord.satirlar.length + 1,
                                  konusmaci: "Konuşmacı",
                                  konusmaci_ar: "المتحدث",
                                  cinsiyet: "E",
                                  arapca: "",
                                  turkce: "",
                                },
                              ];
                              updateDraftField("satirlar", nextLines);
                              setDialogueSelectedLineIdx(nextLines.length - 1);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#6741D9] text-white text-[11px] font-extrabold cursor-pointer"
                          >
                            + Satır Ekle
                          </button>
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                          {draftRecord.satirlar.map(
                            (line: GenericRecord, lIdx: number) => (
                              <div
                                key={lIdx}
                                onClick={() => setDialogueSelectedLineIdx(lIdx)}
                                className={`p-2.5 rounded-xl border-2 space-y-1.5 cursor-pointer ${
                                  dialogueSelectedLineIdx === lIdx
                                    ? "bg-[#F3F0FF] border-[#6741D9]"
                                    : "bg-white border-[#E6D7BE]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold">
                                  <span>
                                    Satır #{lIdx + 1} ({line.konusmaci || "Metin"})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const filtered = draftRecord.satirlar.filter(
                                        (_: unknown, idx: number) => idx !== lIdx
                                      );
                                      updateDraftField("satirlar", filtered);
                                    }}
                                    className="text-rose-600 hover:underline flex items-center gap-0.5"
                                  >
                                    <Trash2 size={12} />
                                    <span>Sil</span>
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  dir="rtl"
                                  value={String(line.arapca || "")}
                                  onChange={(e) => {
                                    const copy = [...draftRecord.satirlar];
                                    copy[lIdx] = {
                                      ...copy[lIdx],
                                      arapca: e.target.value,
                                    };
                                    updateDraftField("satirlar", copy);
                                  }}
                                  placeholder="Arapça cümle..."
                                  className="w-full h-9 px-2.5 rounded-lg bg-white border border-[#E6D7BE] arabic text-lg font-bold text-[#065F46]"
                                />
                                <input
                                  type="text"
                                  value={String(line.turkce || "")}
                                  onChange={(e) => {
                                    const copy = [...draftRecord.satirlar];
                                    copy[lIdx] = {
                                      ...copy[lIdx],
                                      turkce: e.target.value,
                                    };
                                    updateDraftField("satirlar", copy);
                                  }}
                                  placeholder="Türkçe çevirisi..."
                                  className="w-full h-8 px-2.5 rounded-lg bg-white border border-[#E6D7BE] text-xs font-semibold"
                                />
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Gramer Hap Bilgi ve Ayrıntılı Anlatım Düzenleyici */}
                    {Array.isArray(draftRecord.gramer_notlari) && (
                      <div className="space-y-2.5 pt-1">
                        <span className="text-xs font-extrabold text-[#065F46] block">
                          📌 Gramer Kuralları &amp; 2. Katman Ayrıntılı Konu Anlatımı ({draftRecord.gramer_notlari.length} Kural)
                        </span>
                        {draftRecord.gramer_notlari.map(
                          (gn: GenericRecord, gIdx: number) => (
                            <div
                              key={gIdx}
                              className="p-3 rounded-2xl bg-white border-2 border-[#E6D7BE] space-y-2"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={String(gn.baslik || "")}
                                  onChange={(e) => {
                                    const copy = [...draftRecord.gramer_notlari];
                                    copy[gIdx] = {
                                      ...copy[gIdx],
                                      baslik: e.target.value,
                                    };
                                    updateDraftField("gramer_notlari", copy);
                                  }}
                                  placeholder="Kural Başlığı"
                                  className="h-9 px-2.5 rounded-lg border border-[#E6D7BE] text-xs font-extrabold"
                                />
                                <input
                                  type="text"
                                  value={String(gn.formul || "")}
                                  onChange={(e) => {
                                    const copy = [...draftRecord.gramer_notlari];
                                    copy[gIdx] = {
                                      ...copy[gIdx],
                                      formul: e.target.value,
                                    };
                                    updateDraftField("gramer_notlari", copy);
                                  }}
                                  placeholder="Kısa Formül"
                                  className="h-9 px-2.5 rounded-lg border border-[#E6D7BE] text-xs font-bold text-[#6741D9]"
                                />
                              </div>
                              <textarea
                                rows={2}
                                value={String(gn.kisa_aciklama || "")}
                                onChange={(e) => {
                                  const copy = [...draftRecord.gramer_notlari];
                                  copy[gIdx] = {
                                    ...copy[gIdx],
                                    kisa_aciklama: e.target.value,
                                  };
                                  updateDraftField("gramer_notlari", copy);
                                }}
                                placeholder="Kısa Pedagojik Açıklama..."
                                className="w-full p-2 rounded-lg border border-[#E6D7BE] text-xs font-semibold"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}
                    {/* Müstakil / Tekil Hap Gramer Kartı Alanları (konu_basligi / hap_kural) */}
                    {("konu_basligi" in draftRecord || "hap_kural" in draftRecord) && (
                      <div className="p-3 rounded-2xl bg-white border-2 border-[#E6D7BE] space-y-2.5">
                        <span className="text-xs font-extrabold text-[#065F46] block">
                          📌 Hap Gramer Kartı Başlığı, Kuralı &amp; Örneği
                        </span>
                        <div>
                          <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                            Konu Başlığı
                          </label>
                          <input
                            type="text"
                            value={String(draftRecord.konu_basligi || "")}
                            onChange={(e) =>
                              updateDraftField("konu_basligi", e.target.value)
                            }
                            className="w-full h-9 px-2.5 rounded-lg border border-[#E6D7BE] text-xs font-extrabold"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                            Hap Kural Özeti
                          </label>
                          <textarea
                            rows={3}
                            value={String(draftRecord.hap_kural || "")}
                            onChange={(e) =>
                              updateDraftField("hap_kural", e.target.value)
                            }
                            className="w-full p-2 rounded-lg border border-[#E6D7BE] text-xs font-semibold"
                          />
                        </div>
                        {draftRecord.metinden_ornek && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[11px] font-extrabold text-[#065F46] block mb-1">
                                Örnek Cümle (Arapça)
                              </label>
                              <input
                                type="text"
                                dir="rtl"
                                value={String(
                                  draftRecord.metinden_ornek?.arapca || ""
                                )}
                                onChange={(e) =>
                                  updateDraftField("metinden_ornek", {
                                    ...draftRecord.metinden_ornek,
                                    arapca: e.target.value,
                                  })
                                }
                                className="w-full h-10 px-2.5 rounded-lg border border-[#E6D7BE] arabic text-lg font-bold text-[#065F46]"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                                Örnek Cümle Çevirisi (Türkçe)
                              </label>
                              <input
                                type="text"
                                value={String(
                                  draftRecord.metinden_ornek?.turkce || ""
                                )}
                                onChange={(e) =>
                                  updateDraftField("metinden_ornek", {
                                    ...draftRecord.metinden_ornek,
                                    turkce: e.target.value,
                                  })
                                }
                                className="w-full h-10 px-2.5 rounded-lg border border-[#E6D7BE] text-xs font-semibold"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* YouTube & İzleme Rehberi Özel Alanları */}
                    {activeTab === "youtube_tavsiyeleri" && (
                      <div className="p-3.5 rounded-2xl bg-[#F7EFE1]/80 border-2 border-[#E6D7BE] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-[#065F46]">
                            🎬 YouTube Bağlantısı, Oynatma Türü &amp; Pedagojik Notlar
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              const extracted = extractYoutubeIdsFromUrl(
                                String(draftRecord.url || "")
                              );
                              const nextDraft: GenericRecord = {
                                ...draftRecord,
                              };
                              if (extracted.videoId) {
                                nextDraft.video_id = extracted.videoId;
                              }
                              if (extracted.playlistId) {
                                nextDraft.playlist_id = extracted.playlistId;
                              }
                              if (extracted.startSeconds) {
                                nextDraft.baslangic_sn = extracted.startSeconds;
                              }
                              if (extracted.playlistId && !extracted.videoId) {
                                nextDraft.tur = "playlist";
                              } else if (extracted.videoId && !extracted.playlistId) {
                                nextDraft.tur = "video";
                              }
                              setDraftRecord(nextDraft);
                              setRawJsonText(JSON.stringify(nextDraft, null, 2));
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-[11px] font-extrabold cursor-pointer"
                          >
                            🔗 URL&apos;den ID Ayrıştır
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                              Kaynak Türü (tur)
                            </label>
                            <select
                              value={String(draftRecord.tur || "video")}
                              onChange={(e) =>
                                updateDraftField("tur", e.target.value)
                              }
                              className="w-full h-9 px-2.5 rounded-lg bg-white border border-[#E6D7BE] text-xs font-extrabold"
                            >
                              <option value="video">▶️ Tekil Video (video)</option>
                              <option value="playlist">
                                📑 Oynatma Listesi (playlist)
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                              Kanal Adı (kanal_adi)
                            </label>
                            <input
                              type="text"
                              value={String(draftRecord.kanal_adi || "")}
                              onChange={(e) =>
                                updateDraftField("kanal_adi", e.target.value)
                              }
                              className="w-full h-9 px-2.5 rounded-lg bg-white border border-[#E6D7BE] text-xs font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                              Süre / Seri Etiketi (sure_etiketi)
                            </label>
                            <input
                              type="text"
                              value={String(draftRecord.sure_etiketi || "")}
                              onChange={(e) =>
                                updateDraftField("sure_etiketi", e.target.value)
                              }
                              placeholder="Örn: 14 dk veya 30 Bölümlük Dizi"
                              className="w-full h-9 px-2.5 rounded-lg bg-white border border-[#E6D7BE] text-xs font-bold"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                            Tam YouTube URL&apos;si (url)
                          </label>
                          <input
                            type="url"
                            value={String(draftRecord.url || "")}
                            onChange={(e) =>
                              updateDraftField("url", e.target.value)
                            }
                            placeholder="https://www.youtube.com/watch?v=... veya playlist?list=..."
                            className="w-full h-9 px-3 rounded-lg bg-white border border-[#E6D7BE] text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                              Video ID (11 Karakter, Opsiyonel)
                            </label>
                            <input
                              type="text"
                              value={String(draftRecord.video_id || "")}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                const next = { ...draftRecord };
                                if (val) next.video_id = val;
                                else delete next.video_id;
                                setDraftRecord(next);
                                setRawJsonText(JSON.stringify(next, null, 2));
                              }}
                              placeholder="Örn: dQw4w9WgXcQ"
                              className="w-full h-9 px-2.5 rounded-lg bg-white border border-[#E6D7BE] text-xs font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                              Playlist ID (Opsiyonel)
                            </label>
                            <input
                              type="text"
                              value={String(draftRecord.playlist_id || "")}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                const next = { ...draftRecord };
                                if (val) next.playlist_id = val;
                                else delete next.playlist_id;
                                setDraftRecord(next);
                                setRawJsonText(JSON.stringify(next, null, 2));
                              }}
                              placeholder="Örn: PLEM4OKFQO5J..."
                              className="w-full h-9 px-2.5 rounded-lg bg-white border border-[#E6D7BE] text-xs font-mono font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                              Bağlı Ders ID (bagli_icerik_id)
                            </label>
                            <input
                              type="text"
                              value={String(draftRecord.bagli_icerik_id || "")}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                const next = { ...draftRecord };
                                if (val) next.bagli_icerik_id = val;
                                else delete next.bagli_icerik_id;
                                setDraftRecord(next);
                                setRawJsonText(JSON.stringify(next, null, 2));
                              }}
                              placeholder="Örn: dlg_001, metin_005, grm_012"
                              className="w-full h-9 px-2.5 rounded-lg bg-white border border-[#E6D7BE] text-xs font-mono font-bold"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                            Pedagojik İzleme Notu (pedagojik_not)
                          </label>
                          <textarea
                            rows={3}
                            value={String(draftRecord.pedagojik_not || "")}
                            onChange={(e) =>
                              updateDraftField("pedagojik_not", e.target.value)
                            }
                            className="w-full p-2.5 rounded-lg bg-white border border-[#E6D7BE] text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-extrabold text-[#065F46] block mb-1">
                            Odak Kelimeler (Virgülle Ayırın — Harekeli Arapça)
                          </label>
                          <input
                            type="text"
                            dir="rtl"
                            value={
                              Array.isArray(draftRecord.odak_kelimeler)
                                ? draftRecord.odak_kelimeler.join("، ")
                                : ""
                            }
                            onChange={(e) => {
                              const arr = e.target.value
                                .split(/[,،\n]+/)
                                .map((s) => s.trim())
                                .filter(Boolean);
                              updateDraftField("odak_kelimeler", arr);
                            }}
                            placeholder="حِوَارٌ، اِسْتِمَاعٌ، مَهَارَةٌ"
                            className="w-full h-10 px-3 rounded-lg bg-white border border-[#087F5B]/40 arabic text-lg font-bold text-[#065F46]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Eş & Zıt Anlamlılar (المرادفات والأضداد) Özel Yapısal Düzenleyici */}
                    {activeTab === "es_zit_anlamlilar" && (
                      <div className="p-3.5 rounded-2xl bg-[#F7EFE1]/85 border-2 border-[#E6D7BE] space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                              Harekesiz Ana Kelime (kelime_harekesiz)
                            </label>
                            <input
                              type="text"
                              dir="rtl"
                              value={String(draftRecord.kelime_harekesiz || "")}
                              onChange={(e) =>
                                updateDraftField(
                                  "kelime_harekesiz",
                                  e.target.value
                                )
                              }
                              className="w-full h-9 px-3 rounded-lg bg-white border border-[#E6D7BE] arabic text-base font-bold text-slate-700"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-extrabold text-[var(--muted)] block mb-1">
                              Sıra Numarası (sira)
                            </label>
                            <input
                              type="number"
                              value={Number(draftRecord.sira || 1)}
                              onChange={(e) =>
                                updateDraftField(
                                  "sira",
                                  Math.max(1, Number(e.target.value) || 1)
                                )
                              }
                              className="w-full h-9 px-3 rounded-lg bg-white border border-[#E6D7BE] text-xs font-mono font-bold"
                            />
                          </div>
                        </div>

                        {/* Eş Anlamlılar (المرادفات) */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-[#065F46]">
                              = Eş Anlamlılar — المرادفات (
                              {Array.isArray(draftRecord.es_anlamlilar)
                                ? draftRecord.es_anlamlilar.length
                                : 0}
                              )
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                playClick();
                                const current: SynonymAntonymSubItem[] =
                                  Array.isArray(draftRecord.es_anlamlilar)
                                    ? draftRecord.es_anlamlilar
                                    : [];
                                updateDraftField("es_anlamlilar", [
                                  ...current,
                                  {
                                    ar: "",
                                    harekesiz: "",
                                    tr: "",
                                    nuans_tr: "",
                                  },
                                ]);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-[11px] font-extrabold cursor-pointer"
                            >
                              + Eş Anlamlı Ekle
                            </button>
                          </div>

                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {(Array.isArray(draftRecord.es_anlamlilar)
                              ? draftRecord.es_anlamlilar
                              : []
                            ).map((syn: SynonymAntonymSubItem, sIdx: number) => (
                              <div
                                key={sIdx}
                                className="p-2.5 rounded-xl bg-emerald-50/75 border border-emerald-300 space-y-1.5"
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                                  <input
                                    type="text"
                                    dir="rtl"
                                    value={String(syn.ar || "")}
                                    onChange={(e) => {
                                      const copy = [
                                        ...draftRecord.es_anlamlilar,
                                      ];
                                      copy[sIdx] = {
                                        ...copy[sIdx],
                                        ar: e.target.value,
                                        harekesiz: stripHarakat(
                                          e.target.value
                                        ),
                                      };
                                      updateDraftField("es_anlamlilar", copy);
                                    }}
                                    placeholder="Harekeli Arapça..."
                                    className="sm:col-span-5 h-9 px-2.5 rounded-lg bg-white border border-emerald-300 arabic text-lg font-bold text-[#065F46]"
                                  />
                                  <input
                                    type="text"
                                    value={String(syn.tr || "")}
                                    onChange={(e) => {
                                      const copy = [
                                        ...draftRecord.es_anlamlilar,
                                      ];
                                      copy[sIdx] = {
                                        ...copy[sIdx],
                                        tr: e.target.value,
                                      };
                                      updateDraftField("es_anlamlilar", copy);
                                    }}
                                    placeholder="Türkçe karşılığı..."
                                    className="sm:col-span-5 h-9 px-2.5 rounded-lg bg-white border border-emerald-300 text-xs font-bold"
                                  />
                                  <div className="sm:col-span-2 flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (syn.ar)
                                          void speakHybrid({ text: syn.ar });
                                      }}
                                      title="Dinle"
                                      className="p-1.5 rounded-lg bg-white border border-emerald-300 text-[#065F46] hover:bg-emerald-100 cursor-pointer"
                                    >
                                      <Volume2 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const filtered =
                                          draftRecord.es_anlamlilar.filter(
                                            (_: unknown, idx: number) =>
                                              idx !== sIdx
                                          );
                                        updateDraftField(
                                          "es_anlamlilar",
                                          filtered
                                        );
                                      }}
                                      title="Sil"
                                      className="p-1.5 rounded-lg bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  value={String(syn.nuans_tr || "")}
                                  onChange={(e) => {
                                    const copy = [...draftRecord.es_anlamlilar];
                                    const val = e.target.value;
                                    const nextItem = { ...copy[sIdx] };
                                    if (val.trim()) nextItem.nuans_tr = val;
                                    else delete nextItem.nuans_tr;
                                    copy[sIdx] = nextItem;
                                    updateDraftField("es_anlamlilar", copy);
                                  }}
                                  placeholder="💡 الفروق اللغوية — İnce anlam farkı (opsiyonel)..."
                                  className="w-full h-8 px-2.5 rounded-lg bg-white/90 border border-emerald-200 text-[11px] font-semibold text-emerald-950"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Zıt Anlamlılar (الأضداد) */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-amber-900">
                              ≠ Zıt Anlamlılar — الأضداد (
                              {Array.isArray(draftRecord.zit_anlamlilar)
                                ? draftRecord.zit_anlamlilar.length
                                : 0}
                              )
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                playClick();
                                const current: SynonymAntonymSubItem[] =
                                  Array.isArray(draftRecord.zit_anlamlilar)
                                    ? draftRecord.zit_anlamlilar
                                    : [];
                                updateDraftField("zit_anlamlilar", [
                                  ...current,
                                  {
                                    ar: "",
                                    harekesiz: "",
                                    tr: "",
                                  },
                                ]);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-extrabold cursor-pointer"
                            >
                              + Zıt Anlamlı Ekle
                            </button>
                          </div>

                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {(Array.isArray(draftRecord.zit_anlamlilar)
                              ? draftRecord.zit_anlamlilar
                              : []
                            ).map((ant: SynonymAntonymSubItem, aIdx: number) => (
                              <div
                                key={aIdx}
                                className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-300 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                              >
                                <input
                                  type="text"
                                  dir="rtl"
                                  value={String(ant.ar || "")}
                                  onChange={(e) => {
                                    const copy = [
                                      ...draftRecord.zit_anlamlilar,
                                    ];
                                    copy[aIdx] = {
                                      ...copy[aIdx],
                                      ar: e.target.value,
                                      harekesiz: stripHarakat(
                                        e.target.value
                                      ),
                                    };
                                    updateDraftField("zit_anlamlilar", copy);
                                  }}
                                  placeholder="Harekeli Arapça..."
                                  className="sm:col-span-5 h-9 px-2.5 rounded-lg bg-white border border-amber-300 arabic text-lg font-bold text-amber-950"
                                />
                                <input
                                  type="text"
                                  value={String(ant.tr || "")}
                                  onChange={(e) => {
                                    const copy = [
                                      ...draftRecord.zit_anlamlilar,
                                    ];
                                    copy[aIdx] = {
                                      ...copy[aIdx],
                                      tr: e.target.value,
                                    };
                                    updateDraftField("zit_anlamlilar", copy);
                                  }}
                                  placeholder="Türkçe zıt anlamı..."
                                  className="sm:col-span-5 h-9 px-2.5 rounded-lg bg-white border border-amber-300 text-xs font-bold"
                                />
                                <div className="sm:col-span-2 flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (ant.ar)
                                        void speakHybrid({ text: ant.ar });
                                    }}
                                    title="Dinle"
                                    className="p-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer"
                                  >
                                    <Volume2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const filtered =
                                        draftRecord.zit_anlamlilar.filter(
                                          (_: unknown, idx: number) =>
                                            idx !== aIdx
                                        );
                                      updateDraftField(
                                        "zit_anlamlilar",
                                        filtered
                                      );
                                    }}
                                    title="Sil"
                                    className="p-1.5 rounded-lg bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Karşılaştırmalı Örnek Cümle */}
                        <div className="space-y-2 pt-1 border-t border-[#E6D7BE]">
                          <label className="text-[11px] font-extrabold text-[#065F46] block">
                            📖 Karşılaştırmalı Bağlam Cümlesi (ornek_cumle_ar &amp; ornek_cumle_tr)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              dir="rtl"
                              value={String(draftRecord.ornek_cumle_ar || "")}
                              onChange={(e) =>
                                updateDraftField(
                                  "ornek_cumle_ar",
                                  e.target.value
                                )
                              }
                              placeholder="Harekeli Arapça örnek cümle..."
                              className="flex-1 h-10 px-3 rounded-lg bg-white border border-[#087F5B]/40 arabic text-lg font-bold text-[#065F46]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (draftRecord.ornek_cumle_ar) {
                                  void speakHybrid({
                                    text: String(draftRecord.ornek_cumle_ar),
                                  });
                                }
                              }}
                              title="Örnek cümleyi dinle"
                              className="h-10 px-3 rounded-lg bg-[#087F5B] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Volume2 size={14} />
                              <span>Dinle</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            value={String(draftRecord.ornek_cumle_tr || "")}
                            onChange={(e) =>
                              updateDraftField("ornek_cumle_tr", e.target.value)
                            }
                            placeholder="Örnek cümlenin Türkçe çevirisi..."
                            className="w-full h-9 px-3 rounded-lg bg-white border border-[#E6D7BE] text-xs font-semibold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SAĞ SÜTUN (5/12): CANLI GÖRSEL (.webp) VE SES (.mp3) STÜDYOSU */}
              <div className="lg:col-span-5 space-y-4">
                <h4 className="text-xs sm:text-sm font-black text-[#4C28B5] dark:text-indigo-300 uppercase tracking-wide pb-1.5 border-b border-dashed border-[#E2D3B8]">
                  🎨 SAĞ SÜTUN — Canlı Görsel (.webp) &amp; Ses (.mp3) Stüdyosu
                </h4>

                {/* YOUTUBE ÖNİZLEME PANELİ */}
                {activeTab === "youtube_tavsiyeleri" && (
                  <div className="rounded-2xl border-2 border-[#E6D7BE] bg-white dark:bg-[var(--background)] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[var(--foreground)]">
                        🎬 Gömülü Oynatıcı &amp; Kapak Önizlemesi
                      </span>
                      {draftRecord.url && (
                        <a
                          href={String(draftRecord.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#087F5B] hover:underline"
                        >
                          <span>YouTube&apos;da Aç</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>

                    {(() => {
                      const ytDraft =
                        draftRecord as unknown as YoutubeRecommendationItem;
                      const resolvedIds = resolveYoutubeIds(ytDraft);
                      const thumbs = getYoutubeThumbnailUrls(
                        resolvedIds.videoId
                      );
                      const embedUrl = buildYoutubeEmbedUrl(ytDraft);
                      const catMeta =
                        YOUTUBE_CATEGORY_META[
                          (ytDraft.kategori as YoutubeCategory) ||
                            "diyalog_egitim"
                        ] || YOUTUBE_CATEGORY_META.diyalog_egitim;

                      return (
                        <div className="space-y-2.5">
                          <div className="aspect-video w-full rounded-xl overflow-hidden border border-[#E6D7BE] relative bg-slate-900">
                            {thumbs.length > 0 && !imgPreviewBroken ? (
                              <img
                                src={thumbs[0]}
                                alt={String(ytDraft.baslik_tr || "YouTube")}
                                referrerPolicy="no-referrer"
                                onError={() => setImgPreviewBroken(true)}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div
                                className={`w-full h-full bg-gradient-to-br ${catMeta.gradientClass} p-4 flex flex-col items-center justify-center text-center`}
                              >
                                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-black/30 mb-2">
                                  {ytDraft.tur === "playlist"
                                    ? "📑 Oynatma Listesi Kapağı"
                                    : "🎬 Tipografik Kapak"}
                                </span>
                                <p
                                  dir="rtl"
                                  lang="ar"
                                  className="arabic text-xl font-bold leading-relaxed"
                                >
                                  {ytDraft.baslik_ar || "عُنْوَانُ الْفِيدْيُو"}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-extrabold text-[var(--muted)] block">
                              Standart Gömülü Oynatıcı Adresi (youtube.com/embed):
                            </span>
                            <code className="text-[10px] font-mono text-[#065F46] break-all block bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                              {embedUrl || "Geçerli video_id veya playlist_id girildiğinde üretilir"}
                            </code>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* EŞ & ZIT ANLAMLILAR CANLI KART & TTS ÖNİZLEMESİ */}
                {activeTab === "es_zit_anlamlilar" && (
                  <div className="rounded-2xl border-2 border-[#E6D7BE] bg-white dark:bg-[var(--background)] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[var(--foreground)]">
                        🔄 المرادفات والأضداد — Canlı Kart &amp; TTS Önizlemesi
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (draftRecord.kelime_ar) {
                            void speakHybrid({
                              text: String(draftRecord.kelime_ar),
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 size={12} />
                        <span>Ana Kelimeyi Dinle</span>
                      </button>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#FDFBF7] border border-[#E6D7BE] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[var(--foreground)]">
                          {String(draftRecord.anlam_tr || "Türkçe Anlam")}
                        </span>
                        <span
                          dir="rtl"
                          lang="ar"
                          className="arabic text-3xl font-bold text-[#065F46]"
                        >
                          {String(draftRecord.kelime_ar || "كَلِمَةٌ")}
                        </span>
                      </div>

                      {Array.isArray(draftRecord.es_anlamlilar) &&
                        draftRecord.es_anlamlilar.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {draftRecord.es_anlamlilar.map(
                              (s: SynonymAntonymSubItem, i: number) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    if (s.ar) void speakHybrid({ text: s.ar });
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span className="font-black text-emerald-700">
                                    =
                                  </span>
                                  <span
                                    dir="rtl"
                                    lang="ar"
                                    className="arabic text-base font-bold"
                                  >
                                    {s.ar}
                                  </span>
                                  <span className="text-[11px] text-emerald-800">
                                    ({s.tr})
                                  </span>
                                </button>
                              )
                            )}
                          </div>
                        )}

                      {Array.isArray(draftRecord.zit_anlamlilar) &&
                        draftRecord.zit_anlamlilar.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {draftRecord.zit_anlamlilar.map(
                              (a: SynonymAntonymSubItem, i: number) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    if (a.ar) void speakHybrid({ text: a.ar });
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span className="font-black text-amber-700">
                                    ≠
                                  </span>
                                  <span
                                    dir="rtl"
                                    lang="ar"
                                    className="arabic text-base font-bold"
                                  >
                                    {a.ar}
                                  </span>
                                  <span className="text-[11px] text-amber-800">
                                    ({a.tr})
                                  </span>
                                </button>
                              )
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* 1. 🖼️ GÖRSEL YÖNETİCİSİ (1:1 KARE ÖNİZLEME & OTOMATİK .WEBP DÖNÜŞTÜRÜCÜ) */}
                {activeTab !== "efect_manager" &&
                  activeTab !== "youtube_tavsiyeleri" &&
                  activeTab !== "es_zit_anlamlilar" &&
                  activeTab !== "diyalog_gramer" &&
                  activeTab !== "metin_gramer" &&
                  activeTab !== "ek_gramer" && (
                    <div className="rounded-2xl border-2 border-[#E6D7BE] bg-white dark:bg-[var(--background)] p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                          <ImageIcon size={15} className="text-[#087F5B]" />
                          <span>🖼️ 1:1 Kare Görsel Yöneticisi (.webp)</span>
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-extrabold">
                          <span>Boyut:</span>
                          {([512, 768] as const).map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setSquareResizePx(sz)}
                              className={`px-2 py-0.5 rounded border cursor-pointer ${
                                squareResizePx === sz
                                  ? "bg-[#087F5B] text-white border-[#065F46]"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                            >
                              {sz}x{sz}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(() => {
                        const targetImgPath = getDefaultImagePath(
                          activeTab,
                          draftRecord,
                          editingIndex
                        );
                        const previewUrl = getPreviewImageUrl(
                          activeTab,
                          draftRecord,
                          editingIndex,
                          cacheBuster
                        );
                        return (
                          <>
                            <div className="flex items-center gap-3">
                              <div className="w-28 h-28 aspect-square rounded-2xl border-2 border-dashed border-[#E6D7BE] bg-[#FDFBF7] flex items-center justify-center overflow-hidden shrink-0 relative">
                                {previewUrl && !imgPreviewBroken ? (
                                  <img
                                    src={previewUrl}
                                    alt="Önizleme"
                                    referrerPolicy="no-referrer"
                                    onError={() => setImgPreviewBroken(true)}
                                    className="w-full h-full aspect-square object-contain"
                                  />
                                ) : (
                                  <div className="text-center p-2">
                                    <AlertTriangle
                                      size={20}
                                      className="mx-auto text-rose-600 mb-1"
                                    />
                                    <span className="text-[10px] font-extrabold text-rose-700 block">
                                      ❌ Görsel Eksik
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0 space-y-2">
                                <div>
                                  <span className="text-[10px] font-bold text-[var(--muted)] block">
                                    Medya Deposu Hedef Yolu:
                                  </span>
                                  <code className="text-[11px] font-mono font-bold text-[#065F46] break-all block bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-200 mt-0.5">
                                    {targetImgPath || "Tanımlanmamış"}
                                  </code>
                                </div>

                                <label
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const f = e.dataTransfer.files?.[0];
                                    if (f) void handleUploadImageFile(f);
                                  }}
                                  className="w-full py-2 px-3 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-2 border-[#065F46] flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Upload size={14} />
                                  <span>📤 Yeni Görsel Yükle / Değiştir</span>
                                  <input
                                    type="file"
                                    accept="image/webp,image/png,image/jpeg"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) void handleUploadImageFile(f);
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                {/* 2. 🔊 SES YÖNETİCİSİ (ERKEK & KADIN .MP3 DİNLEME, YÜKLEME, MİKROFON VE TTS) */}
                {activeTab !== "youtube_tavsiyeleri" &&
                  activeTab !== "es_zit_anlamlilar" && (
                <div className="rounded-2xl border-2 border-[#E6D7BE] bg-white dark:bg-[var(--background)] p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                      <Volume2 size={15} className="text-[#6741D9]" />
                      <span>🔊 Çift Cinsiyet Ses Stüdyosu (.mp3 &amp; TTS)</span>
                    </span>
                  </div>

                  {(["male", "female"] as const)
                    .filter((g) =>
                      activeTab === "efect_manager"
                        ? draftRecord.gender === g
                        : true
                    )
                    .map((gender) => {
                      const isFemale = gender === "female";
                      const targetAudioPath =
                        activeTab === "efect_manager"
                          ? String(draftRecord.targetPath || "")
                          : Array.isArray(draftRecord.satirlar) &&
                            draftRecord.satirlar[dialogueSelectedLineIdx]
                          ? `/sesler/${
                              activeTab === "metinler_60" ? "metinler" : "diyaloglar"
                            }/${draftRecord.id}/${String(
                              dialogueSelectedLineIdx + 1
                            ).padStart(2, "0")}.mp3`
                          : getDefaultAudioPath(
                              activeTab,
                              draftRecord,
                              gender,
                              editingIndex
                            );

                      const ttsText =
                        activeTab === "efect_manager"
                          ? String(draftRecord.arabicSample || "")
                          : Array.isArray(draftRecord.satirlar) &&
                            draftRecord.satirlar[dialogueSelectedLineIdx]
                          ? String(
                              draftRecord.satirlar[dialogueSelectedLineIdx].arapca ||
                                ""
                            )
                          : getRecordArabic(draftRecord);

                      const status = isFemale ? femaleAudioStatus : maleAudioStatus;

                      return (
                        <div
                          key={gender}
                          className="p-3 rounded-xl bg-[#FDFBF7] dark:bg-[var(--surface)] border border-[#E6D7BE] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-[var(--foreground)]">
                              {isFemale
                                ? "👩 Kadın Sesi (ses_kadin)"
                                : "👨 Erkek Sesi (ses_erkek)"}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                                status === "ready"
                                  ? "bg-emerald-100 text-emerald-900"
                                  : status === "missing"
                                  ? "bg-rose-100 text-rose-900"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {status === "ready"
                                ? "✅ Ses Hazır"
                                : status === "missing"
                                ? "❌ Ses Bulunamadı"
                                : "🎵 Kontrol Edilebilir"}
                            </span>
                          </div>

                          <code className="text-[10px] font-mono text-slate-600 block truncate bg-white px-2 py-1 rounded border border-[#E6D7BE]">
                            {targetAudioPath}
                          </code>

                          <div className="grid grid-cols-2 gap-1.5">
                            {/* ▶️ Dinle */}
                            <button
                              type="button"
                              onClick={() =>
                                handlePlayPreviewAudio(targetAudioPath, gender)
                              }
                              className="py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Play size={12} />
                              <span>▶️ Dinle</span>
                            </button>

                            {/* 📁 MP3 Dosyası Seç & Yükle */}
                            <label className="py-1.5 px-2.5 rounded-lg bg-[#6741D9] hover:bg-[#5230B5] text-white text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer">
                              <FolderOpen size={12} />
                              <span>📁 MP3 Seç &amp; Yükle</span>
                              <input
                                type="file"
                                accept="audio/mpeg,audio/mp3,audio/wav"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    void handleUploadAudioBlobOrFile(
                                      f,
                                      targetAudioPath,
                                      gender
                                    );
                                  }
                                }}
                              />
                            </label>

                            {/* 🎙️ Mikrofondan Kaydet & Yükle */}
                            <button
                              type="button"
                              onClick={() =>
                                void handleToggleMicRecord(targetAudioPath, gender)
                              }
                              className={`py-1.5 px-2.5 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer ${
                                recordingGender === gender
                                  ? "bg-rose-600 text-white animate-pulse"
                                  : "bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300"
                              }`}
                            >
                              {recordingGender === gender ? (
                                <>
                                  <Square size={11} />
                                  <span>Kaydı Bitir &amp; Yükle</span>
                                </>
                              ) : (
                                <>
                                  <Mic size={12} />
                                  <span>🎙️ Mikrofondan Kaydet</span>
                                </>
                              )}
                            </button>

                            {/* ✨ TTS ile Otomatik Seslendir & Kaydet */}
                            <button
                              type="button"
                              onClick={() =>
                                void handleGenerateAndSaveTts(
                                  ttsText,
                                  targetAudioPath,
                                  gender
                                )
                              }
                              className="py-1.5 px-2.5 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Sparkles size={12} />
                              <span>✨ TTS Seslendir &amp; Kaydet</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
                )}
              </div>
            </div>

            {/* Modal Alt Kaydetme Çubuğu */}
            <div className="px-4 sm:px-6 py-3 bg-[#F7EFE1] dark:bg-[var(--background)] border-t border-[#E6D7BE] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-bold text-[var(--muted)]">
                Medya yüklemeleri anında uygulanır; metin değişiklikleri için kaydet butonunu kullanın.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingIndex(null)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#E6D7BE] text-xs font-extrabold text-[var(--foreground)] cursor-pointer"
                >
                  Kapat
                </button>
                {activeTab !== "efect_manager" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleApplyDraftRecord(false)}
                      className="px-4 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold cursor-pointer"
                    >
                      ✓ Listeye Uygula
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApplyDraftRecord(true)}
                      className="px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Save size={14} />
                      <span>
                        {isCloudActive
                          ? "💾 Uygula & GitHub'a Commit Et"
                          : "💾 Uygula & Dosyaya Kaydet"}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. 🩺 VERİ VE MEDYA DENETLEYİCİSİ ("SAĞLIK TARAMASI" MODALI) */}
      {isHealthModalOpen && (
        <div
          className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setIsHealthModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl bg-[#FDFBF7] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] border-b-4 p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-[#E2D3B8] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#6741D9] text-white flex items-center justify-center">
                  <Stethoscope size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                    🩺 Veri &amp; Medya Sağlık Taraması ({STUDIO_TABS.find((t) => t.key === activeTab)?.shortLabel})
                  </h3>
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    Bozuk karakter (□), eksik hareke, boş alan ve kırık (404) görsel/ses kontrolü
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeTab === "cumleler_1111" && (
                  <button
                    type="button"
                    disabled={repairingMissingSentences}
                    onClick={() => void handleRepairMissingSentenceAudios()}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 size={13} />
                    <span>
                      {repairingMissingSentences
                        ? repairProgressText || "Tamamlanıyor..."
                        : "🔊 Eksik Sesleri Tamamla (cumle_1103–1111)"}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={checkingMediaHealth}
                  onClick={() => void runLiveMediaProbe()}
                  className="px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    size={13}
                    className={checkingMediaHealth ? "animate-spin" : ""}
                  />
                  <span>
                    {checkingMediaHealth
                      ? mediaProbeProgress
                        ? `Taranıyor (${mediaProbeProgress.checked}/${mediaProbeProgress.total})...`
                        : "404 Medya Taranıyor..."
                      : "🔍 Tam Canlı 404 Medya Taraması Yap"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsHealthModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white border border-[#E6D7BE] flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {healthIssues.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <CheckCircle2
                    size={36}
                    className="mx-auto text-emerald-600"
                  />
                  <p className="text-sm font-extrabold text-emerald-900">
                    Harika! Bu veri setinde bozuk karakter, boş alan veya eksik hareke bulunmadı.
                  </p>
                </div>
              ) : (
                healthIssues.map((iss, idx) => (
                  <div
                    key={`${iss.id}-${idx}`}
                    className="p-3 rounded-2xl bg-white border border-[#E6D7BE] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                            iss.severity === "error"
                              ? "bg-rose-100 text-rose-900"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {iss.issueType === "corrupt_char"
                            ? "Bozuk Karakter"
                            : iss.issueType === "empty_field"
                            ? "Boş Alan"
                            : iss.issueType === "missing_media"
                            ? "Eksik / 404 Medya"
                            : "Eksik Hareke"}
                        </span>
                        <span className="text-xs font-extrabold text-[var(--foreground)] truncate">
                          #{iss.index + 1} ({iss.id}) — {iss.title}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5">
                        {iss.detail}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsHealthModalOpen(false);
                        openRecordEditor(iss.index);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold shrink-0 cursor-pointer"
                    >
                      Hemen Düzelt →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
