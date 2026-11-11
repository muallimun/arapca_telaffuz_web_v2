"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  BookOpen,
  Mic,
  Gamepad2,
  BookMarked,
  Volume2,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Brain,
  Award,
  Clock,
  Flame,
  Target,
  Play,
  Share2,
  Compass,
  Stethoscope,
  BarChart3,
  ListChecks,
  GraduationCap,
} from "lucide-react";
import {
  diyaloglar,
  diyalogGramerNotlari,
  metinler,
  cumleler1111,
  atasozleri,
  getDialoguesSortedPedagogically,
  getDialogueCoverUrl,
  getReadingTextCoverUrl,
  getProverbCoverUrl,
  getDynamicContentStats,
} from "@/lib/data";
import {
  useUserStore,
  getTodayDateString,
  getYesterdayDateString,
} from "@/store/userStore";
import { useSettings } from "@/store/settings";
import { playClick } from "@/lib/sfxManager";
import {
  playTTS,
  playDualGenderAudio,
  loadAudioManifest,
  hasMp3,
  getMp3Path,
} from "@/lib/audio";
import { useAudioStore } from "@/store/audioStore";
import { GrammarQuickModal } from "@/components/ui/GrammarHapBilgiPanel";
import type { ShareCardPayload } from "@/components/ui/ShareContentCardModal";

const ShadowingModal = dynamic(
  () => import("@/components/ui/ShadowingModal"),
  { ssr: false }
);
const ShareContentCardModal = dynamic(
  () => import("@/components/ui/ShareContentCardModal"),
  { ssr: false }
);
const PhonemeHeatmapModal = dynamic(
  () => import("@/components/ui/PhonemeHeatmapModal"),
  { ssr: false }
);
import { MixedText } from "@/components/ui/MixedText";
import { buildDailyStudyPackage, getLeechSrsItems } from "@/lib/mistakeUtils";
import {
  formatArabicByHarekeMode,
  formatTurkishCategory,
} from "@/lib/arabicTextUtils";
import { ASSESSMENT_TOPICS } from "@/types/assessment";

const SENTENCE_THEME_LABELS: Record<string, string> = {
  selamlasma_ve_nezaket: "Selamlaşma ve Nezaket",
  tanisma_ve_kisisel_bilgiler: "Tanışma ve Kişisel Bilgiler",
  aile_ve_akrabalik: "Aile ve Akrabalık",
  ev_ve_gunluk_rutin: "Ev ve Günlük Rutin",
  gunluk_rutin_ve_ev: "Günlük Rutin ve Ev",
  zaman_saat_ve_takvim: "Zaman, Saat ve Takvim",
  yemek_mutfak_ve_restoran: "Yemek, Mutfak ve Restoran",
  alisveris_carsi_ve_fiyat: "Alışveriş, Çarşı ve Fiyat",
  ulasim_adres_ve_yon: "Ulaşım, Adres ve Yön",
  hava_durumu_ve_mevsimler: "Hava Durumu ve Mevsimler",
  okul_egitim_ve_sinif: "Okul, Eğitim ve Sınıf",
  okul_ve_egitim: "Okul ve Eğitim",
  saglik_hastane_ve_eczane: "Sağlık, Hastane ve Eczane",
  seyahat_havaalani_ve_otel: "Seyahat, Havaalanı ve Otel",
  is_meslek_ve_ofis: "İş, Meslek ve Ofis",
  duygular_fikirler_ve_tercihler: "Duygular ve Tercihler",
  teknoloji_iletisim_ve_internet: "Teknoloji ve İletişim",
  hobiler_spor_ve_bos_zaman: "Hobiler ve Spor",
  kisisel_gelisim_ve_hedefler: "Kişisel Gelişim ve Hedefler",
  toplum_kultur_ve_gelenekler: "Toplum ve Kültür",
  cevre_doga_ve_ekoloji: "Çevre ve Doğa",
  ekonomi_finans_ve_ticaret: "Ekonomi ve Ticaret",
  bilim_sanat_ve_edebiyat: "Bilim, Sanat ve Edebiyat",
  hukuk_adalet_ve_haklar: "Hukuk ve Adalet",
  medya_haber_ve_gundem: "Medya ve Gündem",
  tartisma_ikna_ve_muzakere: "Tartışma ve Müzakere",
  felsefe_hikmet_ve_etik: "Hikmet ve Etik",
};

function formatSentenceThemeLabel(raw?: string): string {
  if (!raw) return "Günlük İletişim";
  const key = raw.trim().toLowerCase();
  if (SENTENCE_THEME_LABELS[key]) return SENTENCE_THEME_LABELS[key];
  return formatTurkishCategory(raw);
}

type ModuleKey = "kutuphane" | "telaffuz" | "alistirmalar" | "sozluk";

interface ModuleItem {
  id: ModuleKey;
  title: string;
  arabicBadge: string;
  subtitle: string;
  meta: string;
  tooltip: string;
  icon: typeof BookOpen;
  targetHref: string;
  accentColor: "emerald" | "purple";
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const [shadowingModalData, setShadowingModalData] = useState<{
    text: string;
    audioUrl?: string;
  } | null>(null);

  const {
    completedDialogues,
    learnedWords,
    mistakeIds,
    srsRecords,
    pronunciationScores,
    studyMinutes,
    streakDays,
    lastStudyDate,
    dailyGoalMinutes,
    detectedCefrLevel,
    topicMastery,
    skillStats,
    completedLevelExams,
    addStudyMinutes,
    syncDailyProgress,
  } = useUserStore();

  const {
    preferredLevel,
    viewMode,
    speechRate,
    showHareke,
    harekeMode,
    arabicFont,
    preferredVoiceGender,
  } = useSettings();
  const { playAudio } = useAudioStore();

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    syncDailyProgress();
    loadAudioManifest().then(() => setManifestLoaded(true));

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncDailyProgress();
      }
    };
    const studyTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        addStudyMinutes(1);
      }
    }, 60000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(studyTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [syncDailyProgress, addStudyMinutes]);

  const dailyPackage = useMemo(() => {
    return buildDailyStudyPackage({
      srsRecords: mounted ? srsRecords || {} : {},
      mistakeIds: mounted ? mistakeIds || [] : [],
      completedDialogues: mounted ? completedDialogues || [] : [],
      learnedWords: mounted ? learnedWords || [] : [],
      preferredLevel,
      detectedCefrLevel: mounted ? detectedCefrLevel : null,
    });
  }, [
    mounted,
    srsRecords,
    mistakeIds,
    completedDialogues,
    learnedWords,
    preferredLevel,
    detectedCefrLevel,
  ]);

  const recommendedDialogue = dailyPackage.dailyDialogue.dialogue;
  const recommendedDialogueId = recommendedDialogue.id || "dlg_001";
  const recommendedCoverSrc =
    recommendedDialogue.gorsel || getDialogueCoverUrl(recommendedDialogueId);
  const recommendedSentenceCount =
    (recommendedDialogue as unknown as { cumleler?: unknown[] }).cumleler
      ?.length ?? recommendedDialogue.satirlar.length;
  const [failedCoverId, setFailedCoverId] = useState<string | null>(null);
  const recImgFailed = failedCoverId === recommendedDialogueId;
  const [activeGrammarModal, setActiveGrammarModal] = useState<{
    dialogueId?: string;
    readingId?: string;
    grammarTopic?: string;
  } | null>(null);
  const [shareCardTarget, setShareCardTarget] =
    useState<ShareCardPayload | null>(null);
  const [showPhonemeHeatmap, setShowPhonemeHeatmap] = useState(false);

  const contentStats = getDynamicContentStats();

  const modules: ModuleItem[] = useMemo(
    () => [
      {
        id: "kutuphane",
        title: "Eğitim Kütüphanesi",
        arabicBadge: "المَكْتَبَة",
        subtitle: `${contentStats.dialogueCount} Diyalog, ${contentStats.readingCount} Metin, ${contentStats.sentenceCount} Cümle, ${contentStats.proverbCount} Atasözü ve ${contentStats.visualWordCount} Görsel Kelime`,
        meta: `${contentStats.dialogueCount} Diyalog · ${contentStats.readingCount} Metin`,
        tooltip: `A1'den B2'ye ${contentStats.dialogueCount} diyalog, ${contentStats.readingCount} okuma metni, ${contentStats.sentenceCount} cümle, ${contentStats.proverbCount} atasözü ve ${contentStats.visualWordCount} görsel kelimeyi inceleyin`,
        icon: BookOpen,
        targetHref: "/kutuphane",
        accentColor: "emerald",
      },
      {
        id: "telaffuz",
        title: "Telaffuz & Gölgeleme",
        arabicBadge: "التَّلَفُّظ",
        subtitle: "Mahreç analizi, ses dalgası ve yapay zeka koçluğu",
        meta: "Canlı Mikrofon · 38 Mahreç Çifti",
        tooltip: "16kHz ses analizi ve 38 mahreç çifti ile telaffuz pratiği yapın",
        icon: Mic,
        targetHref: `/diyalog/${recommendedDialogueId}`,
        accentColor: "purple",
      },
      {
        id: "alistirmalar",
        title: "Kelime Alıştırmaları",
        arabicBadge: "التَّدْرِيبَات",
        subtitle:
          "Kartlar, test, i'rab boyama, hata avcısı, kör dikte ve görsel-sesli 14 interaktif oyun",
        meta: "14 Farklı Modül • Görsel & Sesli",
        tooltip:
          "14 farklı interaktif kelime, cümle, i'rab boyama, diyalog ve okuma oyunu",
        icon: Gamepad2,
        targetHref: "/alistirmalar",
        accentColor: "emerald",
      },
      {
        id: "sozluk",
        title: "İnteraktif Sözlük",
        arabicBadge: "المُعْجَم",
        subtitle: "Kök harfler, müfret-cemî, mâzî-muzâri ve sesli telaffuz",
        meta: `${contentStats.dictionaryWordCount} Kelime · Sesli Sözlük`,
        tooltip: "Kök harflere göre kelimeleri, çoğulları, fiil çekimlerini ve kalıpları arayın",
        icon: BookMarked,
        targetHref: "/sozluk",
        accentColor: "purple",
      },
    ],
    [recommendedDialogueId, contentStats]
  );

  const pedagogicalDialogues = useMemo(
    () => getDialoguesSortedPedagogically(),
    []
  );

  // Kullanıcının tespit edilen CEFR seviyesini veya tamamladığı diyaloglara göre aktif CEFR seviyesini belirle
  const activeLevel = useMemo(() => {
    if (mounted && detectedCefrLevel) {
      return detectedCefrLevel;
    }
    const doneSet = new Set(mounted ? completedDialogues || [] : []);
    const levels: Array<"A1" | "A2" | "B1" | "B2"> = ["A1", "A2", "B1", "B2"];
    for (const lvl of levels) {
      const dlgsInLvl = pedagogicalDialogues.filter((d) => d.seviye === lvl);
      if (dlgsInLvl.some((d) => !doneSet.has(d.id))) {
        return lvl;
      }
    }
    return "A1";
  }, [mounted, detectedCefrLevel, completedDialogues, pedagogicalDialogues]);

  // İnatçı Kelimeler Kliniği (wrongCount >= 3 olan SRS öğeleri)
  const leechItems = useMemo(
    () => (mounted ? getLeechSrsItems(srsRecords || {}) : []),
    [mounted, srsRecords]
  );

  // En zayıf veya sıradaki konu tarama önerisi
  const recommendedDiagnosticTopic = useMemo(() => {
    if (!mounted) return ASSESSMENT_TOPICS[0];
    const attempted = ASSESSMENT_TOPICS.map((t) => {
      const rec = topicMastery?.[t.ust_konu];
      if (!rec || rec.total <= 0) return { topic: t, pct: null as number | null };
      return {
        topic: t,
        pct: Math.round((rec.correct / rec.total) * 100),
      };
    });
    const withScores = attempted.filter(
      (x): x is { topic: (typeof ASSESSMENT_TOPICS)[0]; pct: number } =>
        x.pct !== null
    );
    if (withScores.length > 0) {
      withScores.sort((a, b) => a.pct - b.pct);
      return withScores[0].topic;
    }
    return ASSESSMENT_TOPICS[0];
  }, [mounted, topicMastery]);

  // Günün Okuma Metni (60 Okuma Metni içinden kullanıcının seviyesine ve tamamlama durumuna göre seçilir)
  const recommendedReading = useMemo(() => {
    const doneSet = new Set(mounted ? completedDialogues || [] : []);
    const unreadInLevel = metinler.filter(
      (m) => m.seviye === activeLevel && !doneSet.has(m.id)
    );
    if (unreadInLevel.length > 0) return unreadInLevel[0];
    const anyUnread = metinler.filter((m) => !doneSet.has(m.id));
    if (anyUnread.length > 0) return anyUnread[0];
    return metinler[0];
  }, [mounted, completedDialogues, activeLevel]);

  const recommendedReadingCoverSrc =
    recommendedReading.gorsel || getReadingTextCoverUrl(recommendedReading.id);

  // Günün Kalıp Cümlesi (1111 Günlük Cümle içinden seviyeye ve güne göre seçilir)
  const dailySentenceItem = useMemo(() => {
    const levelPool = cumleler1111.filter(
      (c) => (c.seviye || c.cefr || "A1") === activeLevel
    );
    const pool = levelPool.length > 0 ? levelPool : cumleler1111;
    const daySeed = mounted
      ? parseInt(getTodayDateString().replace(/\D/g, ""), 10) || 1
      : 1;
    return pool[(daySeed + tipIndex) % pool.length] || pool[0];
  }, [activeLevel, mounted, tipIndex]);

  // Günün Atasözü & Hikmeti (508 Atasözü içinden seviyeye ve güne göre seçilir)
  const dailyProverbItem = useMemo(() => {
    const levelPool = atasozleri.filter(
      (a) => (a.cefr || "B1") === activeLevel
    );
    const pool = levelPool.length > 0 ? levelPool : atasozleri;
    const daySeed = mounted
      ? parseInt(getTodayDateString().replace(/\D/g, ""), 10) || 1
      : 1;
    return pool[(daySeed + tipIndex) % pool.length] || pool[0];
  }, [activeLevel, mounted, tipIndex]);

  const dailyProverbCoverSrc =
    dailyProverbItem.gorsel || getProverbCoverUrl(dailyProverbItem.id);

  // Tamamlanan Diyalog (120) ve Tamamlanan Okuma Metni (60) ayrımı
  const { completedDialogueCount, completedReadingCount } = useMemo(() => {
    if (!mounted) {
      return { completedDialogueCount: 0, completedReadingCount: 0 };
    }
    const dlgIds = new Set(diyaloglar.map((d) => d.id));
    const txtIds = new Set(metinler.map((m) => m.id));
    let dCount = 0;
    let rCount = 0;
    for (const id of completedDialogues) {
      if (dlgIds.has(id)) dCount++;
      else if (txtIds.has(id)) rCount++;
    }
    return { completedDialogueCount: dCount, completedReadingCount: rCount };
  }, [mounted, completedDialogues]);

  // Günün Konuşma Kalıbı Havuzu: Önce Günün Diyaloğundan, ardından kullanıcının aktif seviyesindeki (ör. A1) diyaloglardan seçilir
  const levelQuotesPool = useMemo(() => {
    const dailyDlg = dailyPackage.dailyDialogue.dialogue;
    const sameLevelDlgs = pedagogicalDialogues.filter(
      (d) => d.seviye === activeLevel
    );
    const orderedDlgs = [
      ...(dailyDlg && dailyDlg.seviye === activeLevel ? [dailyDlg] : []),
      ...sameLevelDlgs.filter((d) => d.id !== dailyDlg?.id),
    ];

    const pool: { dlg: (typeof diyaloglar)[0]; line: (typeof diyaloglar)[0]["satirlar"][0] }[] = [];
    for (const dlg of orderedDlgs) {
      // Çok kısa tek kelimelik ("مَرْحَباً.") satırlar yerine en az 2 kelimelik pedagojik konuşma kalıplarını öncelikle ekle
      const meaningfulLines = dlg.satirlar.filter(
        (s) => s.arapca.trim().split(/\s+/).length >= 2
      );
      const sourceLines =
        meaningfulLines.length > 0 ? meaningfulLines : dlg.satirlar;
      for (const line of sourceLines) {
        pool.push({ dlg, line });
      }
    }
    if (pool.length === 0) {
      const fallbackDlg = diyaloglar[0];
      return [{ dlg: fallbackDlg, line: fallbackDlg.satirlar[0] }];
    }
    return pool;
  }, [activeLevel, dailyPackage.dailyDialogue.dialogue, pedagogicalDialogues]);

  // Günün Arapça Diyaloğu / Kalıp İpucu
  const featuredDialogue = useMemo(() => {
    return levelQuotesPool[tipIndex % levelQuotesPool.length] || levelQuotesPool[0];
  }, [levelQuotesPool, tipIndex]);

  const displayArabic = (text: string) =>
    formatArabicByHarekeMode(
      text,
      !mounted ? "full" : harekeMode || (showHareke ? "full" : "none"),
      mounted ? arabicFont : "arakom"
    );

  // Telaffuz Başarısı Hesaplama (Gerçek mikrofon denemeleri yoksa sahte %88 gösterme)
  const pronunciationAccuracy = useMemo(() => {
    if (!mounted) return null;
    if (pronunciationScores && pronunciationScores.length > 0) {
      const sum = pronunciationScores.reduce((acc, s) => acc + s, 0);
      return Math.round(sum / pronunciationScores.length);
    }
    return null;
  }, [mounted, pronunciationScores]);

  // Gün değişiminde bugünkü çalışma süresini ve seriyi Europe/Istanbul zaman dilimiyle doğrula
  const { todayStudyMinutes, activeStreakDays } = useMemo(() => {
    if (!mounted) {
      return { todayStudyMinutes: 0, activeStreakDays: 0 };
    }
    const todayStr = getTodayDateString();
    const yesterdayStr = getYesterdayDateString();

    const isToday = lastStudyDate === todayStr;
    const isYesterday = lastStudyDate === yesterdayStr;

    return {
      todayStudyMinutes: isToday ? studyMinutes : 0,
      activeStreakDays: isToday || isYesterday ? streakDays : 0,
    };
  }, [mounted, lastStudyDate, studyMinutes, streakDays]);

  const handleListenFeatured = async () => {
    playClick();
    const { dlg, line } = featuredDialogue;
    const rate = mounted ? speechRate : 1;
    if (manifestLoaded && hasMp3(dlg.id, line.sira)) {
      try {
        await playAudio(getMp3Path(dlg.id, line.sira), line.sira, rate);
        return;
      } catch {
        // TTS fallback
      }
    }
    await playTTS(line.arapca, rate);
  };

  const handlePracticeFeatured = () => {
    playClick();
    const { dlg, line } = featuredDialogue;
    const audioUrl =
      manifestLoaded && hasMp3(dlg.id, line.sira)
        ? getMp3Path(dlg.id, line.sira)
        : undefined;
    setShadowingModalData({ text: line.arapca, audioUrl });
  };

  const isTranslationVisible = viewMode !== "arabic-only";

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* GÖLGELEME MODALI */}
      {shadowingModalData && (
        <ShadowingModal
          text={shadowingModalData.text}
          refAudioUrl={shadowingModalData.audioUrl}
          onClose={() => setShadowingModalData(null)}
        />
      )}

      {/* BÖLÜM 1: ÜSTTE 4'LÜ DOĞRUDAN NAVİGASYON KARTLARI */}
      <section aria-label="Çalışma Modülleri" className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight">
              Çalışma Modülleri
            </h1>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Başlamak istediğiniz Arapça eğitim modülüne tıklayın
            </p>
          </div>
          <span className="arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-400">
            أَهْلًا وَسَهْلًا
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            const isPurple = mod.accentColor === "purple";

            return (
              <Link
                key={mod.id}
                href={mod.targetHref}
                onClick={() => playClick()}
                data-tooltip={mod.tooltip}
                className="group relative text-left p-3.5 rounded-2xl border-2 border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] dark:hover:border-[#087F5B] hover:-translate-y-0.5 active:translate-y-0 transition-all flex flex-col justify-between min-h-[138px]"
              >
                <span className="arabic absolute top-2.5 right-3.5 text-lg font-bold text-[var(--muted)] opacity-80 group-hover:text-[#087F5B] dark:group-hover:text-[#20c997] transition-colors">
                  {mod.arabicBadge}
                </span>

                <div>
                  <div
                    className={`w-9 h-9 rounded-xl border-2 border-b-3 flex items-center justify-center mb-2.5 transition-colors ${
                      isPurple
                        ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9] text-[#6741D9] dark:text-[#d0bfff] group-hover:bg-[#6741D9] group-hover:text-white"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[#065F46] dark:text-emerald-400 group-hover:bg-[#087F5B] group-hover:border-[#065F46] group-hover:text-white"
                    }`}
                  >
                    <Icon size={18} strokeWidth={2.3} />
                  </div>

                  <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] group-hover:text-[#087F5B] dark:group-hover:text-[#20c997] leading-snug transition-colors">
                    {mod.title}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug line-clamp-2">
                    {mod.subtitle}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-600 dark:text-slate-300 truncate">{mod.meta}</span>
                  <span className="inline-flex items-center gap-1 shrink-0 text-[#065F46] dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Başla</span>
                    <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* V2 5'Lİ HIZLI KÜTÜPHANE GEÇİŞ ŞERİDİ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          {[
            {
              label: `💬 ${contentStats.dialogueCount} Diyalog`,
              sub: "Odak Gramer Notlu",
              href: "/kutuphane?tab=diyaloglar",
              badge: "A1-B2",
            },
            {
              label: `📖 ${contentStats.readingCount} Okuma Metni`,
              sub: "Sorulu & Gramerli",
              href: "/kutuphane?tab=metinler",
              badge: "Yeni",
            },
            {
              label: `🗣️ ${contentStats.sentenceCount} Günlük Cümle`,
              sub: "Çift Cinsiyet Sesli",
              href: "/kutuphane?tab=cumleler",
              badge: "E/K Ses",
            },
            {
              label: `📜 ${contentStats.proverbCount} Atasözü`,
              sub: "Lafzî & Bağlam Notlu",
              href: "/kutuphane?tab=atasozleri",
              badge: "Hikmet",
            },
            {
              label: `🖼️ ${contentStats.visualWordCount} Görsel Kelime`,
              sub: "Resimli & Örnekli",
              href: "/kutuphane?tab=gorsel_kelime",
              badge: "Resimli",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => playClick()}
              className="p-2.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 hover:border-emerald-500/60 hover:shadow-sm flex flex-col justify-between gap-1 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-extrabold text-[var(--foreground)] group-hover:text-[#087F5B] leading-snug">
                  {item.label}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#087F5B]/15 text-[#065F46] dark:text-emerald-300 text-[9px] font-black shrink-0 whitespace-nowrap">
                  {item.badge}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-[var(--muted)]">
                {item.sub}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* BÖLÜM 1.25: SEVİYE TESPİT & 13 KONU TARAMA KARTI + KOŞULLU İNATÇI KELİMELER KLİNİĞİ */}
      <section
        aria-label="Seviye Tespit ve Kişisel Klinik Kısayolları"
        className={`grid grid-cols-1 ${
          leechItems.length >= 1 ? "lg:grid-cols-3" : "lg:grid-cols-1"
        } gap-3`}
      >
        <div
          className={`${
            leechItems.length >= 1 ? "lg:col-span-2" : ""
          } rounded-2xl border-2 border-[#6741D9]/60 dark:border-[#6741D9]/70 border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#6741D9] text-white text-xs font-extrabold">
                <Compass size={14} />
                <span>
                  {mounted && detectedCefrLevel
                    ? `Aktif Kur Seviyeniz: ${detectedCefrLevel}`
                    : "🧭 Seviyemi Belirle (3 Dk Akıllı Test)"}
                </span>
              </span>
              {mounted && completedLevelExams.length > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-[#065F46] dark:text-emerald-300 text-[11px] font-extrabold">
                  🏆 Bitirilen Kur: {completedLevelExams.join(", ")}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-snug">
              {mounted && detectedCefrLevel
                ? "180 soruluk doğrulanmış havuzdan 13 konu tarama testi çözün veya kur bitirme sınavıyla seviye atlayın."
                : "Henüz seviye tespiti yapmadınız. 16+2 soruluk adaptif testle A1–B2 seviyenizi belirleyip günlük çalışma planınızı kişiselleştirin."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/seviye-tespit"
              onClick={() => playClick()}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5432B8] text-white border-b-3 border-[#3d2191] text-xs font-extrabold whitespace-nowrap"
            >
              <Compass size={14} />
              <span>
                {mounted && detectedCefrLevel ? "Yeniden Ölç" : "Seviyemi Belirle"}
              </span>
            </Link>
            <Link
              href="/seviye-tespit?mode=topic"
              onClick={() => playClick()}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 hover:border-[#087F5B] text-xs font-extrabold text-[#065F46] dark:text-emerald-400 whitespace-nowrap"
            >
              <ListChecks size={14} />
              <span>Konu Tarama Testleri</span>
            </Link>
            {mounted && detectedCefrLevel && (
              <Link
                href={`/seviye-tespit?mode=exam&level=${detectedCefrLevel}`}
                onClick={() => playClick()}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 hover:border-amber-500 text-xs font-extrabold text-amber-800 dark:text-amber-300 whitespace-nowrap"
              >
                <GraduationCap size={14} />
                <span>{detectedCefrLevel} Kur Sınavı</span>
              </Link>
            )}
          </div>
        </div>

        {leechItems.length >= 1 && (
          <div className="rounded-2xl border-2 border-rose-400 dark:border-rose-700 border-b-4 bg-rose-50/85 dark:bg-rose-950/35 p-3.5 sm:p-4 flex flex-col justify-between gap-2.5">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-600 text-white text-xs font-extrabold">
                <Stethoscope size={14} />
                <span>🩺 İnatçı Kelimeler Kliniği ({leechItems.length} Öğe)</span>
              </span>
              <p className="text-xs font-semibold text-rose-950 dark:text-rose-200 leading-snug">
                3 veya daha fazla kez takıldığınız kelimeler için özel odaklı tekrar kliniği hazır.
              </p>
            </div>
            <Link
              href="/alistirmalar?plan=leech"
              onClick={() => playClick()}
              className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border-b-3 border-rose-900 text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
            >
              <Play size={13} fill="currentColor" />
              <span>Kliniği Başlat ({leechItems.length} Öğe)</span>
            </Link>
          </div>
        )}
      </section>

      {/* BÖLÜM 1.5: BUGÜN NE ÇALIŞMALIYIM? (~12 DAKİKALIK AKILLI PAKET) */}
      <section
        aria-label="Bugün Ne Çalışmalıyım? Akıllı Günlük Çalışma Paketi"
        className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#087F5B] dark:border-[#087F5B]/80 border-b-4 pt-4 sm:pt-5 px-3.5 sm:px-4 pb-3.5 sm:pb-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] pb-3">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-600 dark:bg-emerald-600 text-white text-xs font-extrabold">
                <Target size={15} />
                <span>Bugün Ne Çalışmalıyım?</span>
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border border-[#6741D9]/30 text-[11px] font-extrabold text-[#6741D9] dark:text-[#d0bfff]">
                ~12 Dakikalık Akıllı Paket
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Diyalog, Okuma Metni, SRS Kelime, {contentStats.sentenceCount} Günlük Cümle ve {contentStats.proverbCount} Atasözü modüllerinden oluşan kişisel günlük çalışma planınız
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href={`/diyalog/${dailyPackage.dailyDialogue.dialogue.id}`}
              onClick={() => playClick()}
              data-tooltip="Bugün için önerilen sesli diyaloğu açın ve dinleyin"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B] transition-all whitespace-nowrap"
            >
              <BookOpen size={14} className="text-[#065F46] dark:text-emerald-400" />
              <span>Günün Diyaloğu</span>
            </Link>

            <Link
              href={`/metin/${recommendedReading.id}`}
              onClick={() => playClick()}
              data-tooltip="Bugün için önerilen okuma metnini açın"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 text-xs font-extrabold text-[#6741D9] dark:text-[#d0bfff] hover:border-[#6741D9] transition-all whitespace-nowrap"
            >
              <BookOpen size={14} />
              <span>Günün Metni</span>
            </Link>

            <Link
              href="/alistirmalar?plan=daily"
              onClick={() => playClick()}
              data-tooltip="Aralıklı tekrar (SRS) algoritmasıyla seçilen kelimelerle günlük çalışmayı başlatın"
              data-tooltip-align="right"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 text-white border-b-3 border-emerald-800 text-xs font-extrabold active:border-b-0 active:translate-y-0.5 transition-all whitespace-nowrap shadow-xs"
            >
              <Play size={14} fill="currentColor" />
              <span>12 Dakikalık Günlük Paketi Başlat</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 items-stretch">
          {/* 1. SÜTUN: 📖 1. DİYALOG & METİN */}
          <div className="bg-white dark:bg-[var(--background)] rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400 uppercase tracking-wide whitespace-nowrap">
                📖 1. DİYALOG &amp; METİN
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-[#065F46] dark:text-emerald-300 text-xs font-semibold whitespace-nowrap shrink-0">
                Seviye {recommendedDialogue.seviye}
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-3 justify-between">
              {/* 1. Diyalog Kartı (flex-1) */}
              <Link
                href={`/diyalog/${recommendedDialogue.id}`}
                onClick={() => playClick()}
                data-tooltip="Diyaloğu açmak, cümleleri dinlemek ve telaffuz çalışmak için tıklayın"
                className="flex-1 flex flex-col justify-between p-3.5 rounded-xl bg-[#F7EFE1]/65 dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] shadow-2xs group transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] aspect-square rounded-xl overflow-hidden shrink-0 border border-[#E6D7BE] dark:border-[var(--border)] bg-white relative flex items-center justify-center">
                    {!recImgFailed ? (
                      <img
                        src={recommendedCoverSrc}
                        alt={recommendedDialogue.baslik_tr}
                        referrerPolicy="no-referrer"
                        onError={() => {
                          setFailedCoverId(recommendedDialogueId);
                        }}
                        className="w-16 h-16 sm:w-[72px] sm:h-[72px] aspect-square object-contain rounded-xl bg-white shrink-0 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-700 via-teal-800 to-indigo-900 flex items-center justify-center">
                        <BookOpen size={24} className="text-white/80" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col justify-between gap-1">
                    <span className="inline-block w-fit px-1.5 py-0.5 rounded-md bg-[#087F5B] text-white text-[9px] font-extrabold tabular-nums whitespace-nowrap">
                      Diyalog #{recommendedDialogue.id.replace("dlg_", "")} • {recommendedSentenceCount} Cümle
                    </span>

                    <h3 className="font-bold text-sm text-[var(--foreground)] leading-snug line-clamp-2 group-hover:text-[#087F5B] transition-colors">
                      {recommendedDialogue.baslik_tr}
                    </h3>

                    <p
                      dir="rtl"
                      className="arabic font-arabic text-lg font-bold text-emerald-900 dark:text-emerald-300 leading-snug text-right truncate"
                    >
                      {displayArabic(recommendedDialogue.baslik_ar)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-dashed border-[#E2D3B8]/80 dark:border-[var(--border-dashed)]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      playClick();
                      setActiveGrammarModal({
                        dialogueId: recommendedDialogue.id,
                        grammarTopic:
                          recommendedDialogue.odak_gramer ||
                          diyalogGramerNotlari.find(
                            (g) => g.bagli_id === recommendedDialogue.id
                          )?.konu_basligi,
                      });
                    }}
                    title="Bu gramer kuralını ve örneklerini ayrı pencerede incelemek için tıklayın"
                    dir="ltr"
                    className="w-full text-left block font-sans text-[11px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-200/80 hover:border-amber-400 dark:border-amber-700/60 px-2 py-0.5 rounded-md line-clamp-1 cursor-pointer transition-colors"
                  >
                    📌{" "}
                    <MixedText
                      text={
                        recommendedDialogue.odak_gramer ||
                        diyalogGramerNotlari.find(
                          (g) => g.bagli_id === recommendedDialogue.id
                        )?.konu_basligi ||
                        recommendedDialogue.satirlar?.[0]?.odak_kalip ||
                        "Günlük Konuşma"
                      }
                      arabicClassName="arabic font-arabic text-xs font-bold text-amber-950 dark:text-amber-200 mx-0.5 inline-block"
                    />
                  </button>
                </div>
              </Link>

              {/* 2. Okuma Metni Kartı (flex-1) */}
              <Link
                href={`/metin/${recommendedReading.id}`}
                onClick={() => playClick()}
                data-tooltip="Günün okuma metnini (paragraf/cümle görünümü ve sorularla) açmak için tıklayın"
                className="flex-1 flex flex-col justify-between p-3.5 rounded-xl bg-[#F3F0FF]/65 dark:bg-[var(--lavender-bg)] border border-[#6741D9]/35 hover:border-[#6741D9] shadow-2xs group transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] aspect-square rounded-xl overflow-hidden shrink-0 border border-[#E6D7BE] dark:border-[var(--border)] bg-white flex items-center justify-center">
                    <img
                      src={recommendedReadingCoverSrc}
                      alt={recommendedReading.baslik_tr}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 sm:w-[72px] sm:h-[72px] aspect-square object-contain rounded-xl bg-white shrink-0 group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col justify-between gap-1">
                    <span className="inline-block w-fit px-1.5 py-0.5 rounded-md bg-[#6741D9] text-white text-[9px] font-extrabold tabular-nums whitespace-nowrap">
                      Okuma Metni #{String(recommendedReading.sira || 1).padStart(2, "0")} ({recommendedReading.seviye})
                    </span>

                    <h3 className="font-bold text-sm text-[var(--foreground)] group-hover:text-[#6741D9] leading-snug line-clamp-2 transition-colors">
                      {recommendedReading.baslik_tr}
                    </h3>

                    <p
                      dir="rtl"
                      className="arabic font-arabic text-lg font-bold text-[#6741D9] dark:text-[#d0bfff] leading-snug text-right truncate"
                    >
                      {displayArabic(recommendedReading.baslik_ar)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-dashed border-[#6741D9]/25">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      playClick();
                      setActiveGrammarModal({
                        readingId: recommendedReading.id,
                        grammarTopic: recommendedReading.odak_gramer,
                      });
                    }}
                    title="Bu metnin odak gramer notunu ayrı pencerede incelemek için tıklayın"
                    dir="ltr"
                    className="w-full text-left block font-sans text-[11px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-200/80 hover:border-amber-400 dark:border-amber-700/60 px-2 py-0.5 rounded-md line-clamp-1 cursor-pointer transition-colors"
                  >
                    📌{" "}
                    <MixedText
                      text={
                        recommendedReading.odak_gramer ||
                        `${recommendedReading.satirlar?.length || 6} Cümle • Sorulu`
                      }
                      arabicClassName="arabic font-arabic text-xs font-bold text-amber-950 dark:text-amber-200 mx-0.5 inline-block"
                    />
                  </button>
                </div>
              </Link>
            </div>

            {/* Alt Aksiyon Satırı: 💬 Diyaloğu Aç ve 📖 Metni Oku → */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Link
                href={`/diyalog/${recommendedDialogue.id}`}
                onClick={() => playClick()}
                className="flex-1 py-2 px-2.5 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-[11px] font-extrabold flex items-center justify-center gap-1 whitespace-nowrap transition-colors"
              >
                <span>💬 Diyaloğu Aç</span>
              </Link>
              <Link
                href={`/metin/${recommendedReading.id}`}
                onClick={() => playClick()}
                className="flex-1 py-2 px-2.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#6741D9] text-[11px] font-extrabold text-[#6741D9] dark:text-[#d0bfff] flex items-center justify-center gap-1 whitespace-nowrap transition-colors"
              >
                <span>📖 Metni Oku →</span>
              </Link>
            </div>
          </div>

          {/* 2. SÜTUN: 🧠 2. GÜNÜN 6 KELİMESİ */}
          <div className="bg-white dark:bg-[var(--background)] rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-extrabold text-[#6741D9] dark:text-[#d0bfff] uppercase tracking-wide whitespace-nowrap">
                🧠 2. GÜNÜN 6 KELİMESİ
              </span>
              <Link
                href="/alistirmalar?plan=daily"
                onClick={() => playClick()}
                className="whitespace-nowrap shrink-0 text-xs font-semibold text-[#6741D9] dark:text-[#d0bfff] hover:underline"
              >
                Tümünü Çalış →
              </Link>
            </div>

            <div className="flex-1 grid grid-cols-2 grid-rows-3 gap-2">
              {dailyPackage.dailyWords.map((dw) => {
                const ar = (dw.item.mufret || dw.item.mazi || "")
                  .split("/")[0]
                  .trim();
                const badgeCls =
                  dw.badgeTone === "mistake"
                    ? "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-700"
                    : dw.badgeTone === "due"
                    ? "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700"
                    : "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-700";

                const compactStatusText =
                  dw.badgeTone === "mistake"
                    ? "⚡ Hata"
                    : dw.badgeTone === "due"
                    ? "⏰ Tekrar"
                    : "✨ Yeni";

                return (
                  <button
                    key={dw.item.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      playTTS(ar, mounted ? speechRate : 1);
                    }}
                    data-tooltip="Kelimeyi sesli dinlemek için tıklayın"
                    className="flex flex-col justify-between p-2.5 rounded-xl bg-[#F7EFE1]/65 dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-left gap-1.5 transition-colors cursor-pointer"
                  >
                    {/* Üst Satır: Sol tarafta hoparlör, sağ tarafta durum rozeti */}
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white/80 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] shrink-0">
                        <Volume2
                          size={12}
                          className="text-[#065F46] dark:text-emerald-400 shrink-0"
                        />
                      </span>
                      <span
                        className={`inline-block whitespace-nowrap text-[9px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${badgeCls}`}
                      >
                        {compactStatusText}
                      </span>
                    </div>

                    {/* Orta Satır: Tam genişlikte harekeli Arapça kelime (ASLA truncate uygulanmaz!) */}
                    <div
                      dir="rtl"
                      lang="ar"
                      className="w-full arabic font-arabic text-xl sm:text-2xl font-bold text-emerald-950 dark:text-emerald-300 leading-[1.9] text-right break-words"
                    >
                      {displayArabic(ar)}
                    </div>

                    {/* Alt Satır: Türkçe anlam */}
                    <span className="w-full text-xs text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug font-medium">
                      {dw.item.anlam_tr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. SÜTUN: 🗣️ 3. KALIP CÜMLE */}
          <div className="bg-white dark:bg-[var(--background)] rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400 uppercase tracking-wide whitespace-nowrap">
                🗣️ 3. KALIP CÜMLE
              </span>
              <Link
                href="/kutuphane?tab=cumleler"
                onClick={() => playClick()}
                className="whitespace-nowrap shrink-0 text-xs font-semibold text-[#065F46] dark:text-emerald-400 hover:underline"
              >
                {contentStats.sentenceCount} Cümle →
              </Link>
            </div>

            <div className="flex-1 flex flex-col justify-between gap-2.5 p-2.5 rounded-xl bg-[#F7EFE1]/65 dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)]">
              {/* 1. Üst Bilgi Satırı */}
              <div className="flex items-center justify-between gap-1.5">
                <span className="px-2 py-0.5 rounded bg-[#087F5B] text-white text-[10px] font-extrabold tabular-nums whitespace-nowrap shrink-0">
                  Kalıp Cümle #{dailySentenceItem.sira || dailySentenceItem.id.replace("cumle_", "")} • {dailySentenceItem.seviye || dailySentenceItem.cefr || "A1"}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/90 dark:bg-[var(--background)] border border-[#E6D7BE] text-[10px] font-bold text-[var(--muted)] truncate">
                  {formatSentenceThemeLabel(dailySentenceItem.tema || dailySentenceItem.kategori)}
                </span>
              </div>

              {/* 2. Arapça Cümle Kutusu (flex-1 flex items-center justify-center) */}
              <div className="flex-1 min-h-[96px] flex items-center justify-center p-4 rounded-xl border border-[#E6D7BE] bg-white dark:bg-[var(--background)] shadow-2xs">
                <p
                  dir="rtl"
                  className="arabic font-arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-center leading-relaxed"
                >
                  {displayArabic(dailySentenceItem.arapca)}
                </p>
              </div>

              {/* 3. Türkçe Çeviri & Gramer Analiz Kartı */}
              <div className="rounded-xl bg-[#F7F2E7] dark:bg-[var(--background)] border border-[#E6D7BE]/80 p-3 flex flex-col gap-1.5">
                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug">
                  “{dailySentenceItem.turkce}”
                </p>
                {dailySentenceItem.odak_kalip && (
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setActiveGrammarModal({
                        grammarTopic: dailySentenceItem.odak_kalip,
                      });
                    }}
                    title="Bu gramer kalıbının kuralını ve örnek cümlelerini incelemek için tıklayın"
                    dir="ltr"
                    className="w-fit text-left font-sans text-[11px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/70 text-amber-900 dark:text-amber-200 border border-amber-200/80 hover:border-amber-400 dark:border-amber-700/60 px-2 py-0.5 rounded-md leading-snug cursor-pointer transition-colors inline-flex items-center gap-1"
                  >
                    <span className="shrink-0">📌</span>
                    <MixedText
                      text={dailySentenceItem.odak_kalip}
                      arabicClassName="arabic font-arabic text-xs font-bold text-amber-950 dark:text-amber-200 mx-0.5 inline-block"
                    />
                  </button>
                )}
              </div>

              {/* 4. Alt Butonlar */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    void playDualGenderAudio({
                      text: dailySentenceItem.arapca,
                      ses_erkek: dailySentenceItem.ses_erkek,
                      ses_kadin: dailySentenceItem.ses_kadin,
                      rate: mounted ? speechRate : 1,
                      gender: mounted ? preferredVoiceGender : "erkek",
                    });
                  }}
                  className="flex-1 py-2 px-2.5 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Volume2 size={13} className="shrink-0" />
                  <span>Cümleyi Dinle</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setShadowingModalData({
                      text: dailySentenceItem.arapca,
                      audioUrl:
                        mounted && preferredVoiceGender === "kadin"
                          ? dailySentenceItem.ses_kadin ||
                            dailySentenceItem.ses_erkek
                          : dailySentenceItem.ses_erkek ||
                            dailySentenceItem.ses_kadin,
                    });
                  }}
                  className="py-2 px-2.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#6741D9] text-[11px] font-extrabold text-[#6741D9] dark:text-[#d0bfff] flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Mic size={13} className="shrink-0" />
                  <span>Telaffuz Et</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setShareCardTarget({
                      type: "sentence",
                      arabicText: dailySentenceItem.arapca,
                      turkishText: dailySentenceItem.turkce,
                      subInfoTr: dailySentenceItem.odak_kalip
                        ? `📌 Odak Kalıp: ${dailySentenceItem.odak_kalip}`
                        : undefined,
                      level: dailySentenceItem.cefr,
                      category: formatSentenceThemeLabel(dailySentenceItem.tema),
                      deepLink: "https://app.muallimun.net/kutuphane?tab=cumleler",
                      initialShowTranslation: isTranslationVisible,
                    });
                  }}
                  title="Görsel Kart Olarak Paylaş"
                  className="py-2 px-2.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#087F5B] text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Share2 size={13} className="shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* 4. SÜTUN: 📜 4. GÜNÜN ATASÖZÜ */}
          <div className="bg-white dark:bg-[var(--background)] rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wide whitespace-nowrap">
                📜 4. GÜNÜN ATASÖZÜ
              </span>
              <Link
                href="/kutuphane?tab=atasozleri"
                onClick={() => playClick()}
                className="whitespace-nowrap shrink-0 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline"
              >
                {contentStats.proverbCount} Atasözü →
              </Link>
            </div>

            <div className="flex-1 flex flex-col justify-between gap-2.5 p-2.5 rounded-xl bg-[#F7EFE1]/65 dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)]">
              {/* 1. Üst Görsel & Başlık Alanı */}
              <div className="flex items-start gap-2.5">
                <div className="w-20 h-20 aspect-square rounded-xl overflow-hidden shrink-0 border border-[#E6D7BE] bg-white flex items-center justify-center">
                  <img
                    src={dailyProverbCoverSrc}
                    alt={dailyProverbItem.turkce}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 aspect-square object-contain rounded-xl bg-white shrink-0"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-amber-600 text-white text-[9px] font-extrabold tabular-nums whitespace-nowrap">
                    Atasözü #{dailyProverbItem.sira || dailyProverbItem.id.replace("ata_", "")} • {dailyProverbItem.cefr}
                  </span>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                    “{dailyProverbItem.turkce}”
                  </p>
                  {dailyProverbItem.lafzi_ceviri && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                      <strong>Lafzî:</strong> {dailyProverbItem.lafzi_ceviri}
                    </p>
                  )}
                </div>
              </div>

              {/* 2. Arapça Atasözü Kutusu */}
              <div className="py-3 px-3.5 rounded-xl border border-[#E6D7BE] bg-white dark:bg-[var(--background)] text-center shadow-2xs">
                <p
                  dir="rtl"
                  className="arabic font-arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 leading-relaxed text-center"
                >
                  {displayArabic(dailyProverbItem.arapca)}
                </p>
              </div>

              {/* 3. 💡 Kullanım Bağlamı Kutusu (flex-1) */}
              <div className="flex-1 flex items-center rounded-xl bg-[#F7F2E7] dark:bg-[var(--background)] border border-[#E6D7BE]/80 p-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                <p className="line-clamp-3">
                  <strong className="text-amber-900 dark:text-amber-300">💡 Bağlam:</strong>{" "}
                  {dailyProverbItem.kullanim_baglami ||
                    (dailyProverbItem as unknown as { context_tr?: string })
                      .context_tr ||
                    "Günlük hayatta hikmetli bir öğüt ve tecrübe paylaşımı olarak kullanılır."}
                </p>
              </div>

              {/* 4. Alt Butonlar */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    void playDualGenderAudio({
                      text: dailyProverbItem.arapca,
                      ses_erkek: dailyProverbItem.ses_erkek,
                      ses_kadin: dailyProverbItem.ses_kadin,
                      rate: mounted ? speechRate : 1,
                      gender: mounted ? preferredVoiceGender : "erkek",
                    });
                  }}
                  className="flex-1 py-2 px-2.5 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Volume2 size={13} className="shrink-0" />
                  <span>Atasözünü Dinle</span>
                </button>

                <Link
                  href="/alistirmalar?pool=proverbs_508"
                  onClick={() => playClick()}
                  className="py-2 px-2.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#6741D9] text-[11px] font-extrabold text-[#6741D9] dark:text-[#d0bfff] whitespace-nowrap shrink-0"
                >
                  Çalış
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setShareCardTarget({
                      type: "proverb",
                      arabicText: dailyProverbItem.arapca,
                      turkishText: dailyProverbItem.turkce,
                      subInfoTr: dailyProverbItem.lafzi_ceviri
                        ? `Lafzî: ${dailyProverbItem.lafzi_ceviri}`
                        : dailyProverbItem.kullanim_baglami,
                      level: dailyProverbItem.cefr,
                      imageUrl: dailyProverbCoverSrc,
                      deepLink: "https://app.muallimun.net/kutuphane?tab=atasozleri",
                      initialShowTranslation: isTranslationVisible,
                    });
                  }}
                  title="Atasözünü Görsel Kart Olarak Paylaş"
                  className="py-2 px-2.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-amber-500 text-[11px] font-extrabold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Share2 size={13} className="shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BÖLÜM 2: GÜNÜN ARAPÇA DİYALOĞU / KALIP İPUCU ŞERİDİ (KOMPAKT) */}
      <section
        aria-label="Günün Arapça Kalıbı ve Diyalog İpucu"
        className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-3.5 sm:p-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#065F46] dark:text-emerald-400">
              <span>Günün Konuşma Kalıbı</span>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--muted)]">
                {featuredDialogue.dlg.baslik_tr} ({featuredDialogue.dlg.seviye})
              </span>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setTipIndex((prev) => (prev + 1) % levelQuotesPool.length);
                }}
                className="ml-auto md:ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--foreground)] bg-white dark:bg-[var(--background)] px-2.5 py-0.5 rounded-lg border border-[#E6D7BE] dark:border-[var(--border)] transition-colors cursor-pointer"
                data-tooltip="Farklı bir günlük Arapça konuşma kalıbı göster"
              >
                <RefreshCw size={11} />
                <span>Değiştir</span>
              </button>
            </div>

            <p
              dir="rtl"
              className="arabic text-2xl sm:text-3xl font-bold text-[var(--foreground)] py-0.5 leading-relaxed break-words"
            >
              {displayArabic(featuredDialogue.line.arapca)}
            </p>

            {isTranslationVisible && (
              <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
                “{featuredDialogue.line.turkce}”
              </p>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleListenFeatured}
              data-tooltip="Cümleyi doğal Arapça seslendirmeyle dinle"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 text-xs font-extrabold text-[var(--foreground)] hover:bg-[#FDFBF7] active:border-b-1 active:translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
            >
              <Volume2 size={15} className="text-[#065F46] dark:text-emerald-400" />
              <span>Sesli Dinle</span>
            </button>

            <button
              type="button"
              onClick={handlePracticeFeatured}
              data-tooltip="Bu cümleyi mikrofona okuyarak telaffuz puanınızı ölçün"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-2 border-[#6741D9] border-b-3 text-xs font-extrabold text-[#6741D9] dark:text-[#d0bfff] hover:opacity-95 active:border-b-1 active:translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
            >
              <Mic size={15} />
              <span>Telaffuz Et</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                setShareCardTarget({
                  type: "sentence",
                  arabicText: featuredDialogue.line.arapca,
                  turkishText: featuredDialogue.line.turkce,
                  titleAr: featuredDialogue.dlg.baslik_ar,
                  titleTr: featuredDialogue.dlg.baslik_tr,
                  level: featuredDialogue.dlg.seviye,
                  imageUrl:
                    featuredDialogue.dlg.gorsel ||
                    getDialogueCoverUrl(featuredDialogue.dlg.id),
                  deepLink: `https://app.muallimun.net/diyalog/${featuredDialogue.dlg.id}`,
                  initialShowTranslation: isTranslationVisible,
                });
              }}
              data-tooltip="Bu kalıp cümleyi görseliyle birlikte kart olarak paylaş"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 text-xs font-extrabold text-[#065F46] dark:text-emerald-400 hover:border-[#087F5B] active:border-b-1 active:translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
            >
              <Share2 size={15} />
              <span>Paylaş</span>
            </button>

            <Link
              href={`/diyalog/${featuredDialogue.dlg.id}`}
              onClick={() => playClick()}
              data-tooltip="Bu cümlenin yer aldığı diyaloğun tamamını aç"
              data-tooltip-align="right"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 text-white border-b-3 border-emerald-800 text-xs font-extrabold active:border-b-0 active:translate-y-0.5 transition-all whitespace-nowrap"
            >
              <span>Diyaloğa Git</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* BÖLÜM 3: 4 SÜTUNLU ÖĞRENCİ İLERLEME ÖZETİ (KOMPAKT) */}
      <section aria-label="Öğrenci İlerleme Özeti">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Tamamlanan Diyalog & Okuma Metni */}
          <Link
            href="/kutuphane?durum=completed"
            onClick={() => playClick()}
            data-tooltip={`Tamamladığınız diyalogların (${contentStats.dialogueCount}) ve okuma metinlerinin (${contentStats.readingCount}) toplam ilerleme durumu`}
            className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 px-3.5 pb-3.5 pt-3.5 sm:pt-4 flex items-center gap-3 hover:border-[#087F5B] transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-[#065F46] dark:text-emerald-400 shrink-0">
              <CheckCircle2 size={20} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-base sm:text-lg font-black tabular-nums text-[var(--foreground)] leading-tight">
                  {completedDialogueCount}
                  <span className="text-[11px] font-bold text-[var(--muted)]">
                    /{contentStats.dialogueCount} Diyalog
                  </span>
                </span>
                <span className="text-sm sm:text-base font-black tabular-nums text-[#6741D9] dark:text-[#d0bfff] leading-tight">
                  {completedReadingCount}
                  <span className="text-[11px] font-bold text-[var(--muted)]">
                    /{contentStats.readingCount} Metin
                  </span>
                </span>
              </div>
              <span className="block text-xs font-bold text-[var(--muted)] mt-0.5 line-clamp-2 leading-tight">
                Tamamlanan Diyalog & Metin
              </span>
            </div>
          </Link>

          {/* 2. Öğrenilen Kelime */}
          <Link
            href="/sozluk?durum=learned"
            onClick={() => playClick()}
            data-tooltip="Sözlükte 'Öğrendim' olarak işaretlediğiniz kelime sayısı"
            className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 px-3.5 pb-3.5 pt-3.5 sm:pt-4 flex items-center gap-3 hover:border-[#087F5B] transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-[#6741D9] shrink-0">
              <Brain size={20} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <span className="block text-xl font-black tabular-nums text-[var(--foreground)] leading-normal">
                {mounted
                  ? Math.min(
                      contentStats.dictionaryWordCount,
                      learnedWords.filter(
                        (id) =>
                          Boolean(id) &&
                          !id.startsWith("idiom_") &&
                          !id.startsWith("idm_") &&
                          !id.startsWith("sent_")
                      ).length
                    )
                  : 0}
                <span className="text-xs font-bold text-[var(--muted)]">
                  /{contentStats.dictionaryWordCount}
                </span>
              </span>
              <span className="block text-xs font-bold text-[var(--muted)] mt-0.5 line-clamp-2 leading-tight">
                Öğrenilen Kelime
              </span>
            </div>
          </Link>

          {/* 3. Telaffuz Başarısı */}
          <button
            type="button"
            onClick={handlePracticeFeatured}
            data-tooltip="Gölgeleme ve Mahreç Koçu denemelerinizin ortalama başarı skoru"
            className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 px-3.5 pb-3.5 pt-3.5 sm:pt-4 flex items-center gap-3 text-left hover:border-[#087F5B] transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-amber-600 shrink-0">
              <Award size={20} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              {pronunciationAccuracy !== null ? (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xl font-black tabular-nums text-[var(--foreground)] leading-normal">
                    %{pronunciationAccuracy}
                  </span>
                  <span className="text-[11px] font-bold text-[var(--muted)] tabular-nums">
                    ({pronunciationScores.length} deneme)
                  </span>
                </div>
              ) : (
                <span className="block text-sm sm:text-base font-extrabold text-[var(--muted)] leading-snug">
                  Henüz ölçülmedi
                </span>
              )}
              <span className="block text-xs font-bold text-[var(--muted)] mt-0.5 line-clamp-2 leading-tight">
                Telaffuz Başarısı
              </span>
            </div>
          </button>

          {/* 4. Günlük Hedef & Seri */}
          <Link
            href="/alistirmalar"
            onClick={() => playClick()}
            data-tooltip="Kesintisiz çalışma seriniz (Streak) ve bugünkü çalışma süreniz"
            data-tooltip-align="right"
            className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 px-3.5 pb-3.5 pt-3.5 sm:pt-4 flex flex-col justify-between gap-2 hover:border-[#087F5B] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-orange-500 shrink-0">
                <Flame size={20} strokeWidth={2.4} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xl font-black tabular-nums text-[var(--foreground)] leading-normal">
                    🔥 {activeStreakDays}
                  </span>
                  <span className="text-xs font-extrabold text-orange-600 dark:text-orange-400">
                    Gün
                  </span>
                  <span className="text-[11px] font-bold text-[var(--muted)] ml-auto inline-flex items-center gap-0.5 tabular-nums">
                    <Clock size={11} />
                    {todayStudyMinutes}/{mounted ? dailyGoalMinutes : 15} dk
                  </span>
                </div>
                <span className="block text-xs font-bold text-[var(--muted)] mt-0.5 line-clamp-2 leading-tight">
                  Günlük Hedef
                </span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-white dark:bg-[var(--background)] rounded-full overflow-hidden border border-[#E6D7BE]/70 dark:border-[var(--border)]">
              <div
                className="h-full bg-[#087F5B] rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (todayStudyMinutes /
                        Math.max(1, mounted ? dailyGoalMinutes : 15)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </Link>
        </div>
      </section>

      {/* BÖLÜM 3.5: 6 BECERİ HAKİMİYET HARİTASI & ÖNERİLEN KONU TARAMASI */}
      <section
        aria-label="6 Beceri Hakimiyet Haritası"
        className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-3.5 sm:p-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#087F5B]/15 text-[#065F46] dark:text-emerald-300 text-xs font-extrabold">
              <BarChart3 size={14} />
              <span>📊 Beceri Hakimiyet Haritası</span>
            </span>
            <span className="text-xs font-semibold text-[var(--muted)] hidden sm:inline">
              Alıştırma, okuma, telaffuz ve konu taramalarınıza göre canlı güncellenir
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playClick();
                setShowPhonemeHeatmap(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-xs font-extrabold text-[#065F46] dark:text-emerald-300 shrink-0 cursor-pointer"
            >
              <span>🗣️ 28 Harf Mahreç Haritam</span>
            </button>

            <Link
              href={`/seviye-tespit?mode=topic&topic=${encodeURIComponent(
                recommendedDiagnosticTopic.ust_konu
              )}`}
              onClick={() => playClick()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] text-xs font-extrabold text-[#6741D9] dark:text-[#d0bfff] shrink-0"
            >
              <span>{recommendedDiagnosticTopic.icon}</span>
              <span>Önerilen Tarama: {recommendedDiagnosticTopic.ust_konu} →</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {(
            [
              { key: "kelime", label: "Kelime", icon: "🧠" },
              { key: "gramer", label: "Gramer", icon: "📌" },
              { key: "okuma", label: "Okuma", icon: "📖" },
              { key: "dinleme", label: "Dinleme", icon: "🎧" },
              { key: "telaffuz", label: "Telaffuz", icon: "🎙️" },
              { key: "imla", label: "İmla & Dizilim", icon: "✍️" },
            ] as const
          ).map((sk) => {
            const rec = mounted ? skillStats?.[sk.key] : undefined;
            const pct =
              rec && rec.total > 0
                ? Math.round((rec.correct / rec.total) * 100)
                : sk.key === "telaffuz" && pronunciationAccuracy !== null
                ? pronunciationAccuracy
                : null;

            return (
              <div
                key={sk.key}
                className="rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold text-[var(--foreground)] truncate">
                    {sk.icon} {sk.label}
                  </span>
                  <span className="text-xs font-black tabular-nums text-[#065F46] dark:text-emerald-400">
                    {pct !== null ? `%${pct}` : "—"}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#F7EFE1] dark:bg-[var(--surface)] overflow-hidden">
                  <div
                    className="h-full bg-[#087F5B] rounded-full transition-all duration-500"
                    style={{ width: `${pct ?? 0}%` }}
                  />
                </div>
                <span className="block text-[10px] font-semibold text-[var(--muted)] tabular-nums">
                  {rec && rec.total > 0
                    ? `${rec.correct}/${rec.total} başarılı`
                    : "Henüz veri yok"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <GrammarQuickModal
        isOpen={Boolean(activeGrammarModal)}
        onClose={() => setActiveGrammarModal(null)}
        dialogueId={activeGrammarModal?.dialogueId}
        readingId={activeGrammarModal?.readingId}
        grammarTopic={activeGrammarModal?.grammarTopic}
        onOpenShadowing={(ar) =>
          setShadowingModalData({
            text: ar,
          })
        }
      />

      {shareCardTarget && (
        <ShareContentCardModal
          payload={shareCardTarget}
          onClose={() => setShareCardTarget(null)}
        />
      )}

      {showPhonemeHeatmap && (
        <PhonemeHeatmapModal
          isOpen={showPhonemeHeatmap}
          onClose={() => setShowPhonemeHeatmap(false)}
        />
      )}
    </div>
  );
}