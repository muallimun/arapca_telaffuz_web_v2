"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  Heart,
  CheckCircle2,
  BookOpen,
  Clock,
  Mic,
  AlertTriangle,
  SlidersHorizontal,
  ArrowRight,
  X,
  Download,
  Volume2,
  UserCheck,
  Play,
  Square,
  Maximize2,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Eye,
  EyeOff,
  Sparkles,
  FileText,
  Share2,
  Copy,
  Check,
  Gamepad2,
  GraduationCap,
  Columns2,
  ListChecks,
  Printer,
  MessageCircle,
  ExternalLink,
  Compass,
  Film,
  ListVideo,
} from "lucide-react";
import {
  diyaloglar,
  metinler,
  diyalogGramerNotlari,
  metinGramerNotlari,
  ekGramerNotlari,
  cumleler1111,
  atasozleri,
  gorselKelimeler,
  esZitAnlamlilar,
  youtubeTavsiyeleri,
  getYoutubeRecommendationsByContentId,
  getDialogueCoverUrl,
  getReadingTextCoverUrl,
  getProverbCoverUrl,
  getVisualWordCoverUrl,
  getDynamicContentStats,
  getMainVisualCategory,
  getVisualSubGroupNo,
} from "@/lib/data";
import {
  Level,
  DictionaryItem,
  Dialogue,
  GramerHapBilgi,
  YoutubeCategory,
  YoutubeRecommendationItem,
  SynonymAntonymWordTur,
} from "@/types/data";
import { synonymEntryToDictionaryItem } from "@/lib/mistakeUtils";
import { getSynonymTurLabel } from "@/lib/quiz";
import {
  YOUTUBE_CATEGORY_META,
  YOUTUBE_CATEGORY_ORDER,
  EXTERNAL_WATCH_PLATFORM_GROUPS,
} from "@/lib/youtubeUtils";
import LiteYoutubeCard, {
  YoutubePlayerModal,
} from "@/components/LiteYoutubeCard";
import {
  extractDialogueVocabulary,
  cleanArabicText,
  DialogueVocabularyEntry,
} from "@/lib/dict";
import { normalizeArabicText, formatTurkishCategory } from "@/lib/arabicTextUtils";
import { MixedText } from "@/components/ui/MixedText";
import { useUserStore } from "@/store/userStore";
import { useSettings, VoiceGender } from "@/store/settings";
import { playClick, playSuccess } from "@/lib/sfxManager";
import {
  loadAudioManifest,
  playDualGenderAudio,
  getDualGenderAudioUrl,
  speakHybrid,
  stopAllAudio,
} from "@/lib/audio";
import {
  getDownloadedDialogueIds,
  downloadDialogueOfflinePack,
} from "@/lib/offlineManager";
import WordTooltip from "@/components/ui/WordTooltip";
import type { ShareCardPayload } from "@/components/ui/ShareContentCardModal";

const ShadowingModal = dynamic(
  () => import("@/components/ui/ShadowingModal"),
  { ssr: false }
);
const DialoguePdfModal = dynamic(
  () => import("@/components/ui/DialoguePdfModal"),
  { ssr: false }
);
const ShareAchievementModal = dynamic(
  () => import("@/components/ui/ShareAchievementModal"),
  { ssr: false }
);
const ShareContentCardModal = dynamic(
  () => import("@/components/ui/ShareContentCardModal"),
  { ssr: false }
);
const StatsAndBadgesModal = dynamic(
  () => import("@/components/ui/StatsAndBadgesModal"),
  { ssr: false }
);
import { GrammarQuickModal } from "@/components/ui/GrammarHapBilgiPanel";
import {
  formatArabicByHarekeMode,
  getArabicFontConfig,
} from "@/lib/arabicTextUtils";
import {
  DEFAULT_GRAMMAR_ORIGIN,
  GRAMMAR_DOMAINS,
  GRAMMAR_DOMAIN_ORDER,
  buildGrammarWhatsAppShareUrl,
  buildUnifiedGrammarAtlasCatalog,
  extractGrammarCardIdFromUrl,
  type GrammarDomainFilter,
} from "@/lib/grammarTaxonomy";
import {
  printGrammarBookletPdf,
  printSingleGrammarSheetPdf,
} from "@/lib/grammarPdfGenerator";

type SavedItemFilter =
  | "all"
  | "words"
  | "visual-words"
  | "sentences"
  | "proverbs";

type YoutubeSubFilter = "all" | "video" | "playlist" | "watched";
type StatusFilter = "all" | "completed" | "ongoing" | "favorites";
type ViewSection =
  | "vitrin"
  | "dialogues"
  | "metinler"
  | "cumleler"
  | "atasozleri"
  | "gorsel-kelimeler"
  | "gramer"
  | "es-zit"
  | "videolar"
  | "saved-words"
  | "weak-words";

export default function LibraryPage() {
  const {
    favoriteDialogues,
    completedDialogues,
    favoriteWords,
    weakWords,
    mistakeIds,
    watchedVideos,
    toggleFavoriteDialogue,
    toggleCompletedDialogue,
    toggleFavoriteWord,
    removeWeakWord,
    addMistake,
    removeMistake,
  } = useUserStore();

  const {
    showHareke,
    harekeMode,
    cycleHarekeMode,
    speechRate,
    preferredVoiceGender,
    setPreferredVoiceGender,
    arabicFont,
    arabicFontSize,
  } = useSettings();

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [visualSubSetFilter, setVisualSubSetFilter] = useState<number | "all">(
    "all"
  );
  const [isCategoryPanelOpen, setIsCategoryPanelOpen] =
    useState<boolean>(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(
    null
  );
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [showArabic, setShowArabic] = useState<boolean>(true);
  const [showTurkish, setShowTurkish] = useState<boolean>(true);
  const [revealedArabicIds, setRevealedArabicIds] = useState<
    Record<string, boolean>
  >({});
  const [revealedTurkishIds, setRevealedTurkishIds] = useState<
    Record<string, boolean>
  >({});
  const touchStartXRef = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState<ViewSection>("vitrin");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(36);
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const [isSequentialPlaying, setIsSequentialPlaying] = useState<boolean>(false);
  const sequentialTokenRef = useRef<number>(0);
  const itemCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [shadowingTarget, setShadowingTarget] = useState<{
    text: string;
    refAudioUrl?: string;
    forms?: { label: string; arabic: string }[];
  } | null>(null);

  const [offlineIds, setOfflineIds] = useState<string[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingPct, setDownloadingPct] = useState<number>(0);

  const [savedItemFilter, setSavedItemFilter] =
    useState<SavedItemFilter>("all");
  const [isHomeworkMode, setIsHomeworkMode] = useState<boolean>(false);
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] =
    useState<boolean>(false);
  const [isHwCertificateOpen, setIsHwCertificateOpen] =
    useState<boolean>(false);
  const [hwInspectedIds, setHwInspectedIds] = useState<string[]>([]);
  const [homeworkLinkCopied, setHomeworkLinkCopied] = useState<boolean>(false);
  const [isStatsBadgesOpen, setIsStatsBadgesOpen] = useState<boolean>(false);
  const [libraryPdfConfig, setLibraryPdfConfig] = useState<{
    dialogue: Dialogue;
    vocabEntries: DialogueVocabularyEntry[];
    imagePath: string;
    rawNum: number;
  } | null>(null);

  const [grammarDomainFilter, setGrammarDomainFilter] =
    useState<GrammarDomainFilter>("all");
  const [highlightedGrammarCardId, setHighlightedGrammarCardId] = useState<
    string | null
  >(null);
  const [activeGrammarModal, setActiveGrammarModal] = useState<{
    grammarNote?: GramerHapBilgi | null;
    dialogueId?: string;
    readingId?: string;
    sourceId?: string;
    grammarTopic?: string;
  } | null>(null);

  const [youtubeCategoryFilter, setYoutubeCategoryFilter] = useState<
    YoutubeCategory | "all"
  >("all");
  const [youtubeKindFilter, setYoutubeKindFilter] =
    useState<YoutubeSubFilter>("all");
  const [youtubeModalItems, setYoutubeModalItems] = useState<
    YoutubeRecommendationItem[] | null
  >(null);

  const [synTurFilter, setSynTurFilter] = useState<
    SynonymAntonymWordTur | "all"
  >("all");
  const [openSynNuanceMap, setOpenSynNuanceMap] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    void loadAudioManifest().then(() => {
      void getDownloadedDialogueIds().then((ids) => setOfflineIds(ids));
    });

    const applyCardDeepLink = () => {
      if (typeof window === "undefined") return false;
      const cardId = extractGrammarCardIdFromUrl(
        window.location.hash,
        window.location.search
      );
      if (!cardId) return false;

      setActiveSection("gramer");
      setLevelFilter("all");
      setGrammarDomainFilter("all");
      setSearch("");

      const fullCatalog = buildUnifiedGrammarAtlasCatalog({
        ekGramerNotlari,
        diyalogGramerNotlari,
        metinGramerNotlari,
        diyaloglar,
        metinler,
      });
      const matchIdx = fullCatalog.findIndex(
        (c) => c.bagliId.toLowerCase() === cardId.toLowerCase()
      );
      if (matchIdx >= 0) {
        const matched = fullCatalog[matchIdx];
        setVisibleCount((prev) => Math.max(prev, matchIdx + 12));
        setHighlightedGrammarCardId(matched.bagliId);
        setActiveGrammarModal({
          grammarNote: matched.rawNote,
          dialogueId: matched.dialogueId,
          readingId: matched.readingId,
          sourceId: matched.bagliId,
          grammarTopic: matched.grammarQuery,
        });
      }
      return true;
    };

    const raf = requestAnimationFrame(() => {
      setMounted(true);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const hashRaw = window.location.hash.replace(/^#/, "");
        const hashParams = new URLSearchParams(hashRaw);

        const lvl = (params.get("level") ||
          params.get("seviye") ||
          hashParams.get("level")) as Level | null;
        const durum = params.get("durum");
        const tab = params.get("tab") || hashParams.get("tab");
        const cat = params.get("cat") || params.get("category");
        const qParam = params.get("q");
        const hwParam = params.get("hw");

        if (lvl && ["A1", "A2", "B1", "B2"].includes(lvl)) {
          setLevelFilter(lvl);
        }
        if (durum === "completed") {
          setStatusFilter("completed");
          if (!tab) {
            setActiveSection("dialogues");
          }
        }
        if (cat && cat.trim().length > 0) {
          const rawCat = cat.trim();
          setCategoryFilter(
            tab === "gorsel_kelime" ||
              tab === "gorsel-kelimeler" ||
              tab === "visual_words"
              ? getMainVisualCategory(rawCat)
              : rawCat
          );
        }
        if (qParam && qParam.trim().length > 0) {
          setSearch(qParam.trim());
        }
        if (hwParam === "1" || hwParam === "true") {
          setIsHomeworkMode(true);
        }
        if (tab) {
          if (tab === "vitrin" || tab === "overview") {
            setActiveSection("vitrin");
          } else if (tab === "diyaloglar" || tab === "dialogues") {
            setActiveSection("dialogues");
          } else if (
            tab === "gorsel_kelime" ||
            tab === "gorsel-kelimeler" ||
            tab === "visual_words"
          ) {
            setActiveSection("gorsel-kelimeler");
          } else if (
            tab === "gramer" ||
            tab === "grammar" ||
            tab === "gramer-atlasi"
          ) {
            setActiveSection("gramer");
            const domParam =
              params.get("domain") || hashParams.get("domain");
            if (
              domParam === "nouns_pronouns_reading" ||
              domParam === "phrases_sentence_nahiv" ||
              domParam === "verbs_conjugation_sarf" ||
              domParam === "styles_conjunctions"
            ) {
              setGrammarDomainFilter(domParam);
            }
          } else if (
            tab === "videolar" ||
            tab === "youtube" ||
            tab === "izleme-rehberi"
          ) {
            setActiveSection("videolar");
            const ytCat = params.get("ytcat") || params.get("cat");
            if (
              ytCat &&
              YOUTUBE_CATEGORY_ORDER.includes(ytCat as YoutubeCategory)
            ) {
              setYoutubeCategoryFilter(ytCat as YoutubeCategory);
            }
          } else if (
            tab === "es-zit" ||
            tab === "es_zit" ||
            tab === "synonyms" ||
            tab === "synonyms_antonyms"
          ) {
            setActiveSection("es-zit");
            const turParam = params.get("tur") || hashParams.get("tur");
            if (
              turParam === "isim" ||
              turParam === "fiil" ||
              turParam === "sifat" ||
              turParam === "zarf"
            ) {
              setSynTurFilter(turParam);
            }
          } else if (
            [
              "metinler",
              "cumleler",
              "atasozleri",
              "saved-words",
              "weak-words",
            ].includes(tab)
          ) {
            setActiveSection(tab as ViewSection);
          }
        }

        // #card=grm_XXX veya ?card=grm_XXX kontrolü: Gramer sekmesini açar, kartı vurgular ve detay panelini açar
        applyCardDeepLink();
      }
    });

    const handleHashChange = () => {
      applyCardDeepLink();
    };

    const handleOpenVitrinEvent = () => {
      sequentialTokenRef.current += 1;
      setIsSequentialPlaying(false);
      setPlayingItemId(null);
      stopAllAudio();
      setActiveSection("vitrin");
      setCategoryFilter("all");
      setVisualSubSetFilter("all");
      setIsCategoryPanelOpen(false);
      setSelectedCardIndex(null);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("hashchange", handleHashChange);
      window.addEventListener(
        "muallimun:kutuphane-vitrin",
        handleOpenVitrinEvent
      );
    }

    return () => {
      cancelAnimationFrame(raf);
      if (typeof window !== "undefined") {
        window.removeEventListener("hashchange", handleHashChange);
        window.removeEventListener(
          "muallimun:kutuphane-vitrin",
          handleOpenVitrinEvent
        );
      }
      sequentialTokenRef.current += 1;
      stopAllAudio();
    };
  }, []);

  // Derin bağlantı (#card=...) ile açılan gramer kartına yumuşak kaydırma (scroll)
  useEffect(() => {
    if (!mounted || activeSection !== "gramer" || !highlightedGrammarCardId) {
      return;
    }
    const timer = window.setTimeout(() => {
      const cardEl = document.getElementById(
        `grammar-card-${highlightedGrammarCardId}`
      );
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [mounted, activeSection, highlightedGrammarCardId, visibleCount]);

  const stopSequentialPlay = () => {
    sequentialTokenRef.current += 1;
    setIsSequentialPlaying(false);
    setPlayingItemId(null);
    stopAllAudio();
  };

  const handleSwitchSection = (sec: ViewSection) => {
    playClick();
    stopSequentialPlay();
    setActiveSection(sec);
    setCategoryFilter("all");
    setYoutubeCategoryFilter("all");
    setYoutubeKindFilter("all");
    setSynTurFilter("all");
    setVisualSubSetFilter("all");
    setIsCategoryPanelOpen(false);
    setSelectedCardIndex(null);
    setVisibleCount(36);
  };

  const handleDownloadDialogueCardOffline = async (dlgId: string) => {
    if (downloadingId) return;
    playClick();
    setDownloadingId(dlgId);
    setDownloadingPct(5);
    const res = await downloadDialogueOfflinePack(dlgId, (pct) => {
      setDownloadingPct(pct);
    });
    setDownloadingId(null);
    if (res.ok) {
      setOfflineIds((prev) => (prev.includes(dlgId) ? prev : [...prev, dlgId]));
      playSuccess();
    }
  };

  const [shareCardTarget, setShareCardTarget] =
    useState<ShareCardPayload | null>(null);

  const activeFontCfg = getArabicFontConfig(mounted ? arabicFont : "arakom");
  const libraryCardArabicFontSizePx = Math.round(
    (mounted ? arabicFontSize : 34) * 0.94 * activeFontCfg.scale
  );
  const librarySubArabicFontSizePx = Math.round(
    (mounted ? arabicFontSize : 34) * 0.78 * activeFontCfg.scale
  );

  const activeHarekeMode = !mounted
    ? "full"
    : !showHareke
      ? "none"
      : harekeMode || "full";

  const getDisplayArabic = (text: string) =>
    formatArabicByHarekeMode(
      text,
      activeHarekeMode,
      mounted ? arabicFont : "arakom"
    );

  const toggleBulkArabic = () => {
    playClick();
    setShowArabic((prev) => !prev);
    setRevealedArabicIds({});
  };

  const toggleBulkTurkish = () => {
    playClick();
    setShowTurkish((prev) => !prev);
    setRevealedTurkishIds({});
  };

  const toggleCardArabicReveal = (id: string) => {
    playClick();
    setRevealedArabicIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCardTurkishReveal = (id: string) => {
    playClick();
    setRevealedTurkishIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 1. Diyalog Filtreleme (120 Diyalog)
  const filteredDialogues = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = cleanArabicText(search.trim());
    const normQ = normalizeArabicText(search.trim());

    return diyaloglar.filter((dlg) => {
      if (q) {
        const matchTr = dlg.baslik_tr.toLowerCase().includes(q);
        const matchGrammar = dlg.odak_gramer?.toLowerCase().includes(q);
        const matchTema = dlg.tema?.toLowerCase().includes(q);
        const matchAr =
          dlg.baslik_ar.includes(search.trim()) ||
          (cleanQ.length > 0 &&
            cleanArabicText(dlg.baslik_ar).includes(cleanQ)) ||
          (normQ.length > 0 &&
            normalizeArabicText(dlg.baslik_ar).includes(normQ));
        const matchId =
          dlg.id.replace("dlg_", "").includes(q) ||
          String(dlg.sira || "").includes(q);
        const matchLines = dlg.satirlar.some(
          (s) =>
            s.turkce.toLowerCase().includes(q) ||
            (cleanQ.length > 0 && cleanArabicText(s.arapca).includes(cleanQ)) ||
            (normQ.length > 0 && normalizeArabicText(s.arapca).includes(normQ))
        );
        if (
          !matchTr &&
          !matchGrammar &&
          !matchTema &&
          !matchAr &&
          !matchId &&
          !matchLines
        )
          return false;
      }

      if (mounted) {
        const isComp = completedDialogues.includes(dlg.id);
        const isFav = favoriteDialogues.includes(dlg.id);
        if (statusFilter === "completed" && !isComp) return false;
        if (statusFilter === "ongoing" && isComp) return false;
        if (statusFilter === "favorites" && !isFav) return false;
      }

      if (levelFilter !== "all" && dlg.seviye !== levelFilter) return false;
      return true;
    });
  }, [
    search,
    statusFilter,
    levelFilter,
    mounted,
    completedDialogues,
    favoriteDialogues,
  ]);

  // 2. Okuma Metinleri Filtreleme (60 Metin)
  const filteredTexts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = cleanArabicText(search.trim());
    const normQ = normalizeArabicText(search.trim());

    return metinler.filter((txt) => {
      if (q) {
        const matchTr = txt.baslik_tr.toLowerCase().includes(q);
        const matchGrammar = txt.odak_gramer?.toLowerCase().includes(q);
        const matchTema = txt.tema?.toLowerCase().includes(q);
        const matchAr =
          txt.baslik_ar.includes(search.trim()) ||
          (cleanQ.length > 0 &&
            cleanArabicText(txt.baslik_ar).includes(cleanQ)) ||
          (normQ.length > 0 &&
            normalizeArabicText(txt.baslik_ar).includes(normQ));
        const matchLines = txt.satirlar.some(
          (s) =>
            s.turkce.toLowerCase().includes(q) ||
            (cleanQ.length > 0 && cleanArabicText(s.arapca).includes(cleanQ))
        );
        if (!matchTr && !matchGrammar && !matchTema && !matchAr && !matchLines)
          return false;
      }

      if (mounted) {
        const isComp = completedDialogues.includes(txt.id);
        const isFav = favoriteDialogues.includes(txt.id);
        if (statusFilter === "completed" && !isComp) return false;
        if (statusFilter === "ongoing" && isComp) return false;
        if (statusFilter === "favorites" && !isFav) return false;
      }

      if (levelFilter !== "all" && txt.seviye !== levelFilter) return false;
      return true;
    });
  }, [
    search,
    statusFilter,
    levelFilter,
    mounted,
    completedDialogues,
    favoriteDialogues,
  ]);

  // 3. 1111 Cümle Filtreleme
  const cumleThemes = useMemo(() => {
    return Array.from(
      new Set(cumleler1111.map((c) => c.tema).filter(Boolean))
    ) as string[];
  }, []);

  const filteredSentences = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = cleanArabicText(search.trim());
    const normQ = normalizeArabicText(search.trim());

    return cumleler1111.filter((c) => {
      const itemLevel = c.seviye || c.cefr;
      if (levelFilter !== "all" && itemLevel !== levelFilter) return false;
      if (categoryFilter !== "all" && c.tema !== categoryFilter) return false;
      if (q) {
        const matchTr = c.turkce.toLowerCase().includes(q);
        const matchTema =
          c.tema?.toLowerCase().includes(q) ||
          c.tema?.replace(/_/g, " ").toLowerCase().includes(q);
        const matchKalip = c.odak_kalip?.toLowerCase().includes(q);
        const matchAr =
          c.arapca.includes(search.trim()) ||
          (cleanQ.length > 0 && cleanArabicText(c.arapca).includes(cleanQ)) ||
          (normQ.length > 0 && normalizeArabicText(c.arapca).includes(normQ));
        if (!matchTr && !matchTema && !matchKalip && !matchAr) return false;
      }
      return true;
    });
  }, [search, levelFilter, categoryFilter]);

  // 4. 508 Atasözü Filtreleme
  const proverbThemes = useMemo(() => {
    return Array.from(
      new Set(atasozleri.map((a) => a.tema).filter(Boolean))
    ) as string[];
  }, []);

  const filteredProverbs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = cleanArabicText(search.trim());
    const normQ = normalizeArabicText(search.trim());

    return atasozleri.filter((a) => {
      if (levelFilter !== "all" && a.cefr !== levelFilter) return false;
      if (categoryFilter !== "all" && a.tema !== categoryFilter) return false;
      if (q) {
        const matchTr = a.turkce.toLowerCase().includes(q);
        const matchLafzi = a.lafzi_ceviri?.toLowerCase().includes(q);
        const matchBaglam = a.kullanim_baglami?.toLowerCase().includes(q);
        const matchAr =
          a.arapca.includes(search.trim()) ||
          (cleanQ.length > 0 && cleanArabicText(a.arapca).includes(cleanQ)) ||
          (normQ.length > 0 && normalizeArabicText(a.arapca).includes(normQ));
        if (!matchTr && !matchLafzi && !matchBaglam && !matchAr) return false;
      }
      return true;
    });
  }, [search, levelFilter, categoryFilter]);

  // 5. 998 Görsel Kelime Filtreleme (19 Ana Tematik Kategori + 9'lu Alt Setler)
  const formatVisualCategoryBadge = (rawCatTr?: string) => {
    const mainCat = getMainVisualCategory(rawCatTr);
    const subNo = getVisualSubGroupNo(rawCatTr);
    return subNo ? `${mainCat} • Set ${subNo}` : mainCat || "Görsel Kelime";
  };

  const visualCategories = useMemo(() => {
    return Array.from(
      new Set(
        gorselKelimeler
          .map((g) => getMainVisualCategory(g.kategori_tr))
          .filter(Boolean)
      )
    );
  }, []);

  const categoryCountsMap = useMemo(() => {
    const counts: Record<string, number> = {};
    if (activeSection === "cumleler") {
      cumleler1111.forEach((c) => {
        const itemLevel = c.seviye || c.cefr;
        if (levelFilter !== "all" && itemLevel !== levelFilter) return;
        if (c.tema) {
          counts[c.tema] = (counts[c.tema] || 0) + 1;
        }
      });
    } else if (activeSection === "atasozleri") {
      atasozleri.forEach((a) => {
        if (levelFilter !== "all" && a.cefr !== levelFilter) return;
        if (a.tema) {
          counts[a.tema] = (counts[a.tema] || 0) + 1;
        }
      });
    } else if (activeSection === "gorsel-kelimeler") {
      gorselKelimeler.forEach((g) => {
        if (levelFilter !== "all" && g.cefr !== levelFilter) return;
        const mainCat = getMainVisualCategory(g.kategori_tr);
        if (mainCat) {
          counts[mainCat] = (counts[mainCat] || 0) + 1;
        }
      });
    }
    return counts;
  }, [activeSection, levelFilter]);

  const availableVisualSubSets = useMemo(() => {
    if (activeSection !== "gorsel-kelimeler" || categoryFilter === "all") {
      return { totalInMainCat: 0, sets: [] as { setNo: number; count: number }[] };
    }
    const setCounts = new Map<number, number>();
    let totalInMainCat = 0;
    gorselKelimeler.forEach((g) => {
      if (levelFilter !== "all" && g.cefr !== levelFilter) return;
      if (getMainVisualCategory(g.kategori_tr) !== categoryFilter) return;
      totalInMainCat += 1;
      const subNo = getVisualSubGroupNo(g.kategori_tr);
      if (subNo !== null) {
        setCounts.set(subNo, (setCounts.get(subNo) || 0) + 1);
      }
    });
    const sets = Array.from(setCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([setNo, count]) => ({ setNo, count }));
    return { totalInMainCat, sets };
  }, [activeSection, categoryFilter, levelFilter]);

  const filteredVisualWords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = cleanArabicText(search.trim());
    const normQ = normalizeArabicText(search.trim());

    return gorselKelimeler.filter((g) => {
      if (levelFilter !== "all" && g.cefr !== levelFilter) return false;
      if (
        categoryFilter !== "all" &&
        getMainVisualCategory(g.kategori_tr) !== categoryFilter
      )
        return false;
      if (
        visualSubSetFilter !== "all" &&
        getVisualSubGroupNo(g.kategori_tr) !== visualSubSetFilter
      )
        return false;
      if (q) {
        const matchTr = g.turkce.toLowerCase().includes(q);
        const matchCat = g.kategori_tr.toLowerCase().includes(q);
        const matchAr =
          g.arapca.includes(search.trim()) ||
          (cleanQ.length > 0 && cleanArabicText(g.arapca).includes(cleanQ)) ||
          (normQ.length > 0 && normalizeArabicText(g.arapca).includes(normQ));
        if (!matchTr && !matchCat && !matchAr) return false;
      }
      return true;
    });
  }, [search, levelFilter, categoryFilter, visualSubSetFilter]);

  // 6. GRAMER ATLASI VERİ MODELİ VE 4 DİL BİLİMSEL ALAN FİLTRELEMESİ (Toplam 195 Hap Bilgi Kartı)
  const grammarAtlasCatalog = useMemo(
    () =>
      buildUnifiedGrammarAtlasCatalog({
        ekGramerNotlari,
        diyalogGramerNotlari,
        metinGramerNotlari,
        diyaloglar,
        metinler,
      }),
    []
  );

  const grammarDomainCounts = useMemo(() => {
    const counts = {
      all: 0,
      nouns_pronouns_reading: 0,
      phrases_sentence_nahiv: 0,
      verbs_conjugation_sarf: 0,
      styles_conjunctions: 0,
    };
    for (const item of grammarAtlasCatalog) {
      if (levelFilter !== "all" && item.level !== levelFilter) continue;
      counts.all += 1;
      counts[item.domainId] += 1;
    }
    return counts;
  }, [grammarAtlasCatalog, levelFilter]);

  const filteredGrammarAtlasItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = cleanArabicText(search.trim());
    const normQ = normalizeArabicText(search.trim());

    return grammarAtlasCatalog.filter((item) => {
      if (
        grammarDomainFilter !== "all" &&
        item.domainId !== grammarDomainFilter
      ) {
        return false;
      }
      if (levelFilter !== "all" && item.level !== levelFilter) {
        return false;
      }
      if (q) {
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchRule = item.hapKural.toLowerCase().includes(q);
        const matchDomain = item.domainMeta.shortTitle
          .toLowerCase()
          .includes(q);
        const matchLesson = item.linkedLessonFullTitle
          ? item.linkedLessonFullTitle.toLowerCase().includes(q)
          : false;
        const matchKtt = item.kttUstKonu
          ? item.kttUstKonu.toLowerCase().includes(q)
          : false;
        const matchTrEx = item.exampleTr.toLowerCase().includes(q);
        const matchAr =
          item.title.includes(search.trim()) ||
          item.exampleAr.includes(search.trim()) ||
          (cleanQ.length > 0 &&
            (cleanArabicText(item.title).includes(cleanQ) ||
              cleanArabicText(item.exampleAr).includes(cleanQ))) ||
          (normQ.length > 0 &&
            (normalizeArabicText(item.title).includes(normQ) ||
              normalizeArabicText(item.exampleAr).includes(normQ)));
        if (
          !matchTitle &&
          !matchRule &&
          !matchDomain &&
          !matchLesson &&
          !matchKtt &&
          !matchTrEx &&
          !matchAr
        ) {
          return false;
        }
      }
      return true;
    });
  }, [grammarAtlasCatalog, grammarDomainFilter, levelFilter, search]);

  // 7. YOUTUBE VİDEO & OYNATMA LİSTESİ FİLTRELEMESİ (60 Küratörlü Kayıt)
  const youtubeCounts = useMemo(() => {
    const byLevel: Record<Level | "all", number> = {
      all: youtubeTavsiyeleri.length,
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
    };
    const byCategory: Record<YoutubeCategory | "all", number> = {
      all: 0,
      cizgi_animasyon: 0,
      diyalog_egitim: 0,
      hikaye_kissa: 0,
      tarihi_dizi_film: 0,
      islami_sohbet_ders: 0,
      belgesel_basin: 0,
    };
    let videoOnly = 0;
    let playlistOnly = 0;
    let watchedCount = 0;
    const watchedSet = new Set(mounted ? watchedVideos || [] : []);

    for (const item of youtubeTavsiyeleri) {
      byLevel[item.cefr] = (byLevel[item.cefr] || 0) + 1;
      if (levelFilter === "all" || item.cefr === levelFilter) {
        byCategory.all += 1;
        byCategory[item.kategori] = (byCategory[item.kategori] || 0) + 1;
        if (
          youtubeCategoryFilter === "all" ||
          item.kategori === youtubeCategoryFilter
        ) {
          if (item.tur === "video") videoOnly += 1;
          else playlistOnly += 1;
          if (watchedSet.has(item.id)) watchedCount += 1;
        }
      }
    }
    return {
      byLevel,
      byCategory,
      videoOnly,
      playlistOnly,
      watchedCount,
      totalWatchedAll: watchedSet.size,
    };
  }, [levelFilter, youtubeCategoryFilter, mounted, watchedVideos]);

  const filteredYoutubeItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = cleanArabicText(search.trim());
    const normQ = normalizeArabicText(search.trim());
    const watchedSet = new Set(mounted ? watchedVideos || [] : []);

    return youtubeTavsiyeleri.filter((item) => {
      if (levelFilter !== "all" && item.cefr !== levelFilter) return false;
      if (
        youtubeCategoryFilter !== "all" &&
        item.kategori !== youtubeCategoryFilter
      )
        return false;
      if (youtubeKindFilter === "video" && item.tur !== "video") return false;
      if (youtubeKindFilter === "playlist" && item.tur !== "playlist")
        return false;
      if (youtubeKindFilter === "watched" && !watchedSet.has(item.id))
        return false;

      if (q) {
        const matchTr = item.baslik_tr.toLowerCase().includes(q);
        const matchChannel = item.kanal_adi.toLowerCase().includes(q);
        const matchNote = item.pedagojik_not.toLowerCase().includes(q);
        const matchCat = YOUTUBE_CATEGORY_META[item.kategori]?.label
          .toLowerCase()
          .includes(q);
        const matchAr =
          item.baslik_ar.includes(search.trim()) ||
          (cleanQ.length > 0 &&
            cleanArabicText(item.baslik_ar).includes(cleanQ)) ||
          (normQ.length > 0 &&
            normalizeArabicText(item.baslik_ar).includes(normQ));
        const matchWords = Array.isArray(item.odak_kelimeler)
          ? item.odak_kelimeler.some(
              (w) =>
                w.includes(search.trim()) ||
                (cleanQ.length > 0 && cleanArabicText(w).includes(cleanQ)) ||
                (normQ.length > 0 && normalizeArabicText(w).includes(normQ))
            )
          : false;
        if (
          !matchTr &&
          !matchChannel &&
          !matchNote &&
          !matchCat &&
          !matchAr &&
          !matchWords
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    levelFilter,
    youtubeCategoryFilter,
    youtubeKindFilter,
    search,
    mounted,
    watchedVideos,
  ]);

  const filteredSynonymsAntonyms = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = cleanArabicText(search.trim());
    const normQ = normalizeArabicText(search.trim());

    return esZitAnlamlilar.filter((entry) => {
      if (levelFilter !== "all" && entry.cefr !== levelFilter) return false;
      if (synTurFilter !== "all" && entry.tur !== synTurFilter) return false;

      if (q) {
        const matchMainTr = entry.anlam_tr.toLowerCase().includes(q);
        const matchExTr = entry.ornek_cumle_tr.toLowerCase().includes(q);
        const matchId = entry.id.toLowerCase().includes(q);
        const matchMainAr =
          entry.kelime_ar.includes(search.trim()) ||
          entry.kelime_harekesiz.includes(search.trim()) ||
          (cleanQ.length > 0 &&
            (cleanArabicText(entry.kelime_ar).includes(cleanQ) ||
              entry.kelime_harekesiz.includes(cleanQ))) ||
          (normQ.length > 0 &&
            normalizeArabicText(entry.kelime_ar).includes(normQ));
        const matchExAr =
          entry.ornek_cumle_ar.includes(search.trim()) ||
          (cleanQ.length > 0 &&
            cleanArabicText(entry.ornek_cumle_ar).includes(cleanQ)) ||
          (normQ.length > 0 &&
            normalizeArabicText(entry.ornek_cumle_ar).includes(normQ));
        const matchSyn = entry.es_anlamlilar.some(
          (s) =>
            s.tr.toLowerCase().includes(q) ||
            (s.nuans_tr && s.nuans_tr.toLowerCase().includes(q)) ||
            s.ar.includes(search.trim()) ||
            s.harekesiz.includes(search.trim()) ||
            (cleanQ.length > 0 &&
              (cleanArabicText(s.ar).includes(cleanQ) ||
                s.harekesiz.includes(cleanQ))) ||
            (normQ.length > 0 && normalizeArabicText(s.ar).includes(normQ))
        );
        const matchAnt = entry.zit_anlamlilar.some(
          (z) =>
            z.tr.toLowerCase().includes(q) ||
            z.ar.includes(search.trim()) ||
            z.harekesiz.includes(search.trim()) ||
            (cleanQ.length > 0 &&
              (cleanArabicText(z.ar).includes(cleanQ) ||
                z.harekesiz.includes(cleanQ))) ||
            (normQ.length > 0 && normalizeArabicText(z.ar).includes(normQ))
        );

        if (
          !matchMainTr &&
          !matchExTr &&
          !matchId &&
          !matchMainAr &&
          !matchExAr &&
          !matchSyn &&
          !matchAnt
        ) {
          return false;
        }
      }

      return true;
    });
  }, [levelFilter, synTurFilter, search]);

  const synonymTurCounts = useMemo(() => {
    const base = esZitAnlamlilar.filter(
      (e) => levelFilter === "all" || e.cefr === levelFilter
    );
    return {
      all: base.length,
      isim: base.filter((e) => e.tur === "isim").length,
      fiil: base.filter((e) => e.tur === "fiil").length,
      sifat: base.filter((e) => e.tur === "sifat").length,
      zarf: base.filter((e) => e.tur === "zarf").length,
    };
  }, [levelFilter]);

  const mistakeIdsSet = useMemo(() => {
    if (!mounted) return new Set<string>();
    return new Set(mistakeIds);
  }, [mounted, mistakeIds]);

  const activeModalListLength =
    activeSection === "cumleler"
      ? filteredSentences.length
      : activeSection === "atasozleri"
      ? filteredProverbs.length
      : activeSection === "gorsel-kelimeler"
      ? filteredVisualWords.length
      : 0;

  const prepareForms = (word: DictionaryItem) => {
    const forms: { label: string; arabic: string }[] = [];
    if (word.tur === "isim") {
      if (word.mufret)
        forms.push({ label: "Müfret (Tekil)", arabic: word.mufret });
      if (word.cemi && word.cemi !== "-")
        forms.push({ label: "Cemî (Çoğul)", arabic: word.cemi });
    } else if (word.tur === "fiil") {
      if (word.mazi) forms.push({ label: "Mâzî (Geçmiş)", arabic: word.mazi });
      if (word.muzari)
        forms.push({ label: "Muzâri (Şimdiki)", arabic: word.muzari });
      if (word.masdar)
        forms.push({ label: "Masdar (İsim)", arabic: word.masdar });
    }
    return forms.length > 0 ? forms : undefined;
  };

  const handlePracticeWord = (word: DictionaryItem) => {
    playClick();
    const forms = prepareForms(word);
    if (forms) {
      setShadowingTarget({ text: forms[0].arabic, forms });
    }
  };

  const handleListenDualGender = async (item: {
    id: string;
    arapca: string;
    ses_erkek?: string;
    ses_kadin?: string;
  }) => {
    playClick();
    if (isSequentialPlaying) {
      stopSequentialPlay();
    }
    if (playingItemId === item.id) {
      stopAllAudio();
      setPlayingItemId(null);
      return;
    }
    setPlayingItemId(item.id);
    setHwInspectedIds((prev) =>
      prev.includes(item.id) ? prev : [...prev, item.id]
    );
    try {
      await playDualGenderAudio({
        text: item.arapca,
        id: item.id,
        ses_erkek: item.ses_erkek,
        ses_kadin: item.ses_kadin,
        rate: speechRate,
        gender: preferredVoiceGender,
      });
    } finally {
      setPlayingItemId((prev) => (prev === item.id ? null : prev));
    }
  };

  const listenDualGenderRef = useRef(handleListenDualGender);
  useEffect(() => {
    listenDualGenderRef.current = handleListenDualGender;
  });

  useEffect(() => {
    if (selectedCardIndex === null || activeModalListLength === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        playClick();
        setSelectedCardIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + activeModalListLength) % activeModalListLength
        );
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        playClick();
        setSelectedCardIndex((prev) =>
          prev === null ? null : (prev + 1) % activeModalListLength
        );
      } else if (e.key === " " || e.code === "Space") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        const safeIdx =
          ((selectedCardIndex % activeModalListLength) +
            activeModalListLength) %
          activeModalListLength;
        const item =
          activeSection === "gorsel-kelimeler"
            ? filteredVisualWords[safeIdx]
            : activeSection === "atasozleri"
              ? filteredProverbs[safeIdx]
              : activeSection === "cumleler"
                ? filteredSentences[safeIdx]
                : null;
        if (item) {
          void listenDualGenderRef.current(item);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          setSelectedCardIndex(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedCardIndex,
    activeModalListLength,
    activeSection,
    filteredVisualWords,
    filteredProverbs,
    filteredSentences,
    lightboxImage,
  ]);

  const handleToggleSequentialPlay = async (
    items: {
      id: string;
      arapca: string;
      ses_erkek?: string;
      ses_kadin?: string;
    }[]
  ) => {
    playClick();
    if (isSequentialPlaying) {
      stopSequentialPlay();
      return;
    }
    const visibleItems = items.slice(0, visibleCount);
    if (visibleItems.length === 0) return;

    const myToken = ++sequentialTokenRef.current;
    setIsSequentialPlaying(true);

    for (const item of visibleItems) {
      if (sequentialTokenRef.current !== myToken) break;
      setPlayingItemId(item.id);
      const cardEl = itemCardRefs.current[item.id];
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      try {
        await playDualGenderAudio({
          text: item.arapca,
          id: item.id,
          ses_erkek: item.ses_erkek,
          ses_kadin: item.ses_kadin,
          rate: speechRate,
          gender: useSettings.getState().preferredVoiceGender,
        });
      } catch {
        // continue
      }
      if (sequentialTokenRef.current !== myToken) break;
      await new Promise((r) => setTimeout(r, 380));
    }

    if (sequentialTokenRef.current === myToken) {
      setIsSequentialPlaying(false);
      setPlayingItemId(null);
    }
  };

  const hasActiveFilter =
    statusFilter !== "all" ||
    levelFilter !== "all" ||
    categoryFilter !== "all" ||
    synTurFilter !== "all" ||
    youtubeCategoryFilter !== "all" ||
    youtubeKindFilter !== "all";

  const isDualGenderSection =
    activeSection === "cumleler" ||
    activeSection === "atasozleri" ||
    activeSection === "gorsel-kelimeler";

  const favoriteIdsSet = useMemo(() => {
    return new Set(favoriteWords.map((w) => w.id));
  }, [favoriteWords]);

  const contentStats = getDynamicContentStats();

  const completedDialogueCount = useMemo(() => {
    if (!mounted) return 0;
    const validIds = new Set(diyaloglar.map((d) => d.id));
    return completedDialogues.filter((id) => validIds.has(id)).length;
  }, [mounted, completedDialogues]);

  const completedReadingCount = useMemo(() => {
    if (!mounted) return 0;
    const validIds = new Set(metinler.map((m) => m.id));
    return completedDialogues.filter((id) => validIds.has(id)).length;
  }, [mounted, completedDialogues]);

  const toSentenceFavoriteItem = (
    item: (typeof cumleler1111)[number]
  ): DictionaryItem => ({
    id: item.id,
    kok: item.odak_kalip || "-",
    tur: "cumle",
    mufret: item.arapca,
    anlam_tr: item.turkce,
    ses_erkek: item.ses_erkek,
    ses_kadin: item.ses_kadin,
    kategori_tr: item.tema
      ? item.tema.replace(/_/g, " ")
      : `${contentStats.sentenceCount} Günlük Cümle`,
    cefr: item.seviye || item.cefr || "A1",
  });

  const toProverbFavoriteItem = (
    item: (typeof atasozleri)[number]
  ): DictionaryItem => ({
    id: item.id,
    kok: "-",
    tur: "atasozu",
    mufret: item.arapca,
    anlam_tr: item.turkce,
    ornek_tr: item.lafzi_ceviri,
    gorsel: item.gorsel || getProverbCoverUrl(item.id),
    ses_erkek: item.ses_erkek,
    ses_kadin: item.ses_kadin,
    kategori_tr: item.tema
      ? item.tema.replace(/_/g, " ")
      : `${contentStats.proverbCount} Atasözü`,
    cefr: item.cefr || "B1",
  });

  const toVisualWordFavoriteItem = (
    item: (typeof gorselKelimeler)[number]
  ): DictionaryItem => ({
    id: item.id.startsWith("gorsel_") ? item.id : `gorsel_${item.id}`,
    kok: "-",
    tur: "gorsel_kelime",
    mufret: item.arapca,
    cemi:
      item.ikincil_form && item.ikincil_form !== "-"
        ? item.ikincil_form
        : undefined,
    masdar:
      item.ucuncul_form && item.ucuncul_form !== "-"
        ? item.ucuncul_form
        : undefined,
    anlam_tr: item.turkce,
    ornek_ar: item.ornek_ar,
    ornek_tr: item.ornek_tr,
    gorsel: item.gorsel || getVisualWordCoverUrl(item),
    ses_erkek: item.ses_erkek,
    ses_kadin: item.ses_kadin,
    kategori_tr: formatVisualCategoryBadge(item.kategori_tr),
    cefr: item.cefr || "A1",
  });

  const isVisualWordFavorited = (item: (typeof gorselKelimeler)[number]) => {
    const normId = item.id.startsWith("gorsel_")
      ? item.id
      : `gorsel_${item.id}`;
    return favoriteIdsSet.has(normId) || favoriteIdsSet.has(item.id);
  };

  const getSavedItemKind = (
    word: DictionaryItem
  ): "words" | "visual-words" | "sentences" | "proverbs" => {
    if (word.tur === "cumle" || word.id.startsWith("cumle_")) {
      return "sentences";
    }
    if (word.tur === "atasozu" || word.id.startsWith("ata_")) {
      return "proverbs";
    }
    if (
      word.tur === "gorsel_kelime" ||
      word.id.startsWith("gorsel_") ||
      Boolean(word.gorsel && !word.id.startsWith("ata_"))
    ) {
      return "visual-words";
    }
    return "words";
  };

  const filteredSavedItems = useMemo(() => {
    if (savedItemFilter === "all") return favoriteWords;
    return favoriteWords.filter(
      (w) => getSavedItemKind(w) === savedItemFilter
    );
  }, [favoriteWords, savedItemFilter]);

  const buildExerciseUrlForCurrentTab = () => {
    const pool =
      activeSection === "cumleler"
        ? "sentences_1111"
        : activeSection === "atasozleri"
        ? "proverbs_508"
        : "visual_words";
    const params = new URLSearchParams();
    params.set("pool", pool);
    if (levelFilter !== "all") {
      params.set("level", levelFilter);
    }
    if (categoryFilter !== "all") {
      params.set("cat", categoryFilter);
    }
    return `/alistirmalar?${params.toString()}`;
  };

  const buildHomeworkShareUrl = () => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://app.muallimun.net";
    const params = new URLSearchParams();
    params.set("tab", activeSection);
    if (levelFilter !== "all") {
      params.set("level", levelFilter);
    }
    if (categoryFilter !== "all") {
      params.set("cat", categoryFilter);
    }
    if (search.trim()) {
      params.set("q", search.trim());
    }
    params.set("hw", "1");
    return `${origin}/kutuphane?${params.toString()}`;
  };

  const getModuleHumanLabel = () => {
    if (activeSection === "vitrin") return "Kütüphane Vitrini (Genel Bakış)";
    if (activeSection === "cumleler")
      return `${contentStats.sentenceCount} Günlük Cümle`;
    if (activeSection === "atasozleri")
      return `${contentStats.proverbCount} Atasözü ve Hikmetli Söz`;
    if (activeSection === "gorsel-kelimeler")
      return `${contentStats.visualWordCount} Görsel Kelime`;
    if (activeSection === "saved-words") return "Kişisel Çalışma Defterim";
    if (activeSection === "gramer")
      return `${contentStats.grammarNoteCount} Odak Gramer Atlası`;
    if (activeSection === "es-zit")
      return `${contentStats.synonymsAntonymsCount} Eş & Zıt Anlamlılar`;
    if (activeSection === "videolar")
      return `${contentStats.youtubeCount} Video & İzleme Rehberi`;
    if (activeSection === "metinler")
      return `${contentStats.readingCount} Okuma Metni`;
    return `${contentStats.dialogueCount} Diyalog`;
  };

  const handleOpenLibraryPdfModal = (targetSection?: ViewSection) => {
    playClick();
    const sec = targetSection || activeSection;
    const lvlLabel = levelFilter === "all" ? "Tüm Kurlar" : levelFilter;
    const catLabel =
      categoryFilter === "all"
        ? "Tüm Kategoriler"
        : categoryFilter.replace(/_/g, " ");
    const safeLevel: Level = levelFilter === "all" ? "A1" : levelFilter;
    const activeGender: "E" | "K" =
      preferredVoiceGender === "kadin" ? "K" : "E";

    if (sec === "cumleler") {
      const slice = filteredSentences.slice(0, 24);
      if (slice.length === 0) return;
      const syntheticDialogue: Dialogue = {
        id: "kutuphane_cumleler",
        seviye: safeLevel,
        baslik_tr: `${contentStats.sentenceCount} Günlük Cümle • ${lvlLabel} • ${catLabel}`,
        baslik_ar: "الجُمَلُ اليَوْمِيَّةُ وَالقَوَاعِدُ التَّطْبِيقِيَّةُ",
        odak_gramer: catLabel,
        satirlar: slice.map((item, i) => ({
          sira: i + 1,
          konusmaci: item.tema
            ? item.tema.replace(/_/g, " ")
            : `Cümle #${item.sira || i + 1}`,
          konusmaci_ar: item.seviye || item.cefr || "A1",
          cinsiyet: activeGender,
          arapca: item.arapca,
          turkce: item.turkce,
        })),
      };
      const extracted = extractDialogueVocabulary(slice.map((s) => s.arapca));
      const extractedEntries: DialogueVocabularyEntry[] = extracted
        .slice(0, 20)
        .map((dictItem, idx) => ({
          item: dictItem,
          contextWord: dictItem.mufret || dictItem.mazi || "",
          contextSentence: slice[idx % slice.length]?.arapca || "",
          contextTranslation: slice[idx % slice.length]?.turkce || "",
          morphologyNote: dictItem.tur || "isim",
          lineNumber: (idx % slice.length) + 1,
        }));
      const fallbackVocab: DialogueVocabularyEntry[] = slice
        .slice(0, 16)
        .map((s, idx) => ({
          item: {
            id: s.id || `cumle_v_${idx}`,
            kok: s.odak_kalip || "-",
            tur: "isim",
            mufret: s.arapca,
            anlam_tr: s.turkce,
          },
          contextWord: s.arapca,
          contextSentence: s.arapca,
          contextTranslation: s.turkce,
          morphologyNote: s.odak_kalip || "Kalıp Cümle",
          lineNumber: idx + 1,
        }));
      setLibraryPdfConfig({
        dialogue: syntheticDialogue,
        vocabEntries:
          extractedEntries.length >= 4 ? extractedEntries : fallbackVocab,
        imagePath: "/gorseller/diyaloglar/001.webp",
        rawNum: 1,
      });
      return;
    }

    if (sec === "atasozleri") {
      const slice = filteredProverbs.slice(0, 22);
      if (slice.length === 0) return;
      const firstImg =
        slice[0]?.gorsel || getProverbCoverUrl(slice[0]?.id || "ata_001");
      const syntheticDialogue: Dialogue = {
        id: "kutuphane_atasozleri",
        seviye: levelFilter === "all" ? "B1" : levelFilter,
        baslik_tr: `${contentStats.proverbCount} Atasözü • ${lvlLabel} • ${catLabel}`,
        baslik_ar: "الأَمْثَالُ وَالحِكَمُ العَرَبِيَّةُ",
        odak_gramer: catLabel,
        satirlar: slice.map((item, i) => ({
          sira: i + 1,
          konusmaci: item.tema
            ? item.tema.replace(/_/g, " ")
            : `Atasözü #${item.sira || i + 1}`,
          konusmaci_ar: item.cefr || "B1",
          cinsiyet: activeGender,
          arapca: item.arapca,
          turkce: item.lafzi_ceviri
            ? `${item.turkce} (Lafzî: ${item.lafzi_ceviri})`
            : item.turkce,
        })),
      };
      const vocabEntries: DialogueVocabularyEntry[] = slice.map((item, i) => ({
        item: {
          id: item.id,
          kok: "-",
          tur: "isim",
          mufret: item.arapca,
          anlam_tr: item.turkce,
          gorsel: item.gorsel || getProverbCoverUrl(item.id),
        },
        contextWord: item.arapca,
        contextSentence: item.arapca,
        contextTranslation: item.turkce,
        morphologyNote: item.tema ? item.tema.replace(/_/g, " ") : "Atasözü",
        lineNumber: i + 1,
      }));
      setLibraryPdfConfig({
        dialogue: syntheticDialogue,
        vocabEntries,
        imagePath: firstImg,
        rawNum: 1,
      });
      return;
    }

    if (sec === "gorsel-kelimeler") {
      const slice = filteredVisualWords.slice(0, 24);
      if (slice.length === 0) return;
      const firstImg =
        slice[0]?.gorsel || getVisualWordCoverUrl(slice[0]);
      const syntheticDialogue: Dialogue = {
        id: "kutuphane_gorsel_kelimeler",
        seviye: safeLevel,
        baslik_tr: `${contentStats.visualWordCount} Görsel Kelime • ${lvlLabel} • ${catLabel}`,
        baslik_ar: "المُفْرَدَاتُ المُصَوَّرَةُ وَالأَمْثِلَةُ",
        odak_gramer: catLabel,
        satirlar: slice.map((item, i) => ({
          sira: i + 1,
          konusmaci: formatVisualCategoryBadge(item.kategori_tr),
          konusmaci_ar: item.tur === "fiil" ? "فعل" : "اسم",
          cinsiyet: activeGender,
          arapca: item.ornek_ar
            ? `${item.arapca} — ${item.ornek_ar}`
            : item.arapca,
          turkce: item.ornek_tr
            ? `${item.turkce} (${item.ornek_tr})`
            : item.turkce,
        })),
      };
      const vocabEntries: DialogueVocabularyEntry[] = slice.map((item, i) => ({
        item: {
          id: item.id,
          kok: "-",
          tur: item.tur || "isim",
          mufret: item.arapca,
          cemi:
            item.ikincil_form && item.ikincil_form !== "-"
              ? item.ikincil_form
              : undefined,
          masdar:
            item.ucuncul_form && item.ucuncul_form !== "-"
              ? item.ucuncul_form
              : undefined,
          anlam_tr: item.turkce,
          gorsel: item.gorsel || getVisualWordCoverUrl(item),
        },
        contextWord: item.arapca,
        contextSentence: item.ornek_ar || item.arapca,
        contextTranslation: item.ornek_tr || item.turkce,
        morphologyNote: item.kategori_tr || "Görsel Kelime",
        lineNumber: i + 1,
      }));
      setLibraryPdfConfig({
        dialogue: syntheticDialogue,
        vocabEntries,
        imagePath: firstImg,
        rawNum: 1,
      });
      return;
    }

    if (sec === "saved-words") {
      const slice = filteredSavedItems.slice(0, 24);
      if (slice.length === 0) return;
      const firstWithImg = slice.find((w) => Boolean(w.gorsel));
      const filterTitleMap: Record<SavedItemFilter, string> = {
        all: "Tüm Kayıtlı Öğeler",
        words: "Sözlük Kelimeleri",
        "visual-words": "Görsel Kelimeler",
        sentences: "Günlük Cümleler",
        proverbs: "Atasözleri",
      };
      const syntheticDialogue: Dialogue = {
        id: "kutuphane_defterim",
        seviye: "A1",
        baslik_tr: `Defterim • ${filterTitleMap[savedItemFilter]} (${slice.length} Öğe)`,
        baslik_ar: "دَفْتَرُ الْمُفْرَدَاتِ وَالْعِبَارَاتِ الْخَاصُّ بِي",
        odak_gramer: filterTitleMap[savedItemFilter],
        satirlar: slice.map((w, i) => {
          const mainAr = w.mufret || w.mazi || "";
          return {
            sira: i + 1,
            konusmaci: w.kategori_tr || w.tur || `Öğe #${i + 1}`,
            konusmaci_ar: w.cefr || "A1",
            cinsiyet: activeGender,
            arapca: w.ornek_ar ? `${mainAr} — ${w.ornek_ar}` : mainAr,
            turkce: w.ornek_tr
              ? `${w.anlam_tr} (${w.ornek_tr})`
              : w.anlam_tr,
          };
        }),
      };
      const vocabEntries: DialogueVocabularyEntry[] = slice.map((w, i) => {
        const mainAr = w.mufret || w.mazi || "";
        return {
          item: w,
          contextWord: mainAr,
          contextSentence: w.ornek_ar || mainAr,
          contextTranslation: w.ornek_tr || w.anlam_tr,
          morphologyNote: w.kategori_tr || w.tur || "Defterim",
          lineNumber: i + 1,
        };
      });
      setLibraryPdfConfig({
        dialogue: syntheticDialogue,
        vocabEntries,
        imagePath: firstWithImg?.gorsel || "/gorseller/diyaloglar/001.webp",
        rawNum: 1,
      });
    }
  };

  return (
    <div className="tr-scale space-y-3 sm:space-y-4">
      {/* GÖLGELEME MODALI */}
      {shadowingTarget && (
        <ShadowingModal
          text={shadowingTarget.text}
          refAudioUrl={shadowingTarget.refAudioUrl}
          forms={shadowingTarget.forms}
          onClose={() => setShadowingTarget(null)}
        />
      )}

      {/* A4 PDF ÇALIŞMA KAĞIDI VE QUİZ YAPRAĞI MODALI */}
      {libraryPdfConfig && (
        <DialoguePdfModal
          dialogue={libraryPdfConfig.dialogue}
          vocabEntries={libraryPdfConfig.vocabEntries}
          imagePath={libraryPdfConfig.imagePath}
          rawNum={libraryPdfConfig.rawNum}
          onClose={() => setLibraryPdfConfig(null)}
        />
      )}

      {/* 🎓 ÖĞRETMEN ÖDEV PAYLAŞIM MODALI */}
      {isHomeworkModalOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsHomeworkModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#6741D9] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)]">
                    🎓 Öğretmen Ödev Paketi Paylaş
                  </h3>
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    Öğrencileriniz bağlantıya tıkladığında doğrudan bu filtreli
                    listeyle çalışmaya başlar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHomeworkModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[var(--muted)]">Modül:</span>
                <span className="font-extrabold text-[#087F5B]">
                  {getModuleHumanLabel()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[var(--muted)]">Seviye:</span>
                <span className="font-extrabold text-[#6741D9]">
                  {levelFilter === "all" ? "Tüm Kurlar (A1–B2)" : levelFilter}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[var(--muted)]">Kategori:</span>
                <span className="font-extrabold text-[var(--foreground)] truncate max-w-[220px]">
                  {categoryFilter === "all"
                    ? "Tüm Kategoriler"
                    : categoryFilter.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase text-[var(--muted)] block">
                Doğrudan Ödev Bağlantısı
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={buildHomeworkShareUrl()}
                  className="flex-1 h-10 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] px-3 text-xs font-mono text-[var(--foreground)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    const url = buildHomeworkShareUrl();
                    void navigator.clipboard?.writeText(url);
                    setHomeworkLinkCopied(true);
                    playSuccess();
                    setTimeout(() => setHomeworkLinkCopied(false), 2500);
                  }}
                  className="h-10 px-3.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-3 border-[#065F46] flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {homeworkLinkCopied ? (
                    <>
                      <Check size={14} />
                      <span>Kopyalandı</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Kopyala</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `🎓 Arapça Ödev Paketi (${getModuleHumanLabel()} • ${
                    levelFilter === "all" ? "Tüm Kurlar" : levelFilter
                  } • ${
                    categoryFilter === "all"
                      ? "Tüm Kategoriler"
                      : categoryFilter.replace(/_/g, " ")
                  }):\n${buildHomeworkShareUrl()}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playClick()}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-3 border-[#065F46] flex items-center justify-center gap-2"
              >
                <Share2 size={14} />
                <span>WhatsApp ile Gönder</span>
              </a>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(
                  buildHomeworkShareUrl()
                )}&text=${encodeURIComponent(
                  `🎓 Arapça Ödev Paketi: ${getModuleHumanLabel()} (${
                    levelFilter === "all" ? "Tüm Kurlar" : levelFilter
                  } • ${
                    categoryFilter === "all"
                      ? "Tüm Kategoriler"
                      : categoryFilter.replace(/_/g, " ")
                  })`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playClick()}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold border-b-3 border-[#5230B5] flex items-center justify-center gap-2"
              >
                <Share2 size={14} />
                <span>Telegram ile Gönder</span>
              </a>
            </div>

            <button
              type="button"
              onClick={() => {
                playClick();
                setIsHomeworkModalOpen(false);
                setIsHomeworkMode(true);
                setIsHwCertificateOpen(true);
              }}
              className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold border-b-3 border-amber-700 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span>🏅 Ödev Karnesi Oluştur &amp; Ödev Takip Barını Aç</span>
            </button>
          </div>
        </div>
      )}

      {/* 🏅 DOĞRULAMA KODLU ÖDEV TAMAMLAMA KARNESİ MODALI */}
      {isHwCertificateOpen && (
        <ShareAchievementModal
          isOpen={isHwCertificateOpen}
          onClose={() => setIsHwCertificateOpen(false)}
          title={
            categoryFilter === "all"
              ? "Genel Çalışma Paketi"
              : categoryFilter.replace(/_/g, " ")
          }
          moduleLabel={getModuleHumanLabel()}
          levelLabel={levelFilter === "all" ? "A1-B2" : levelFilter}
          scorePercent={100}
          wordsCount={Math.max(hwInspectedIds.length, 6)}
          badgeType="homework"
          homeworkTitle={`${getModuleHumanLabel()} Ödev Paketi`}
          completionPercent={100}
          listenedCount={Math.max(hwInspectedIds.length, 6)}
          totalLinesCount={Math.max(
            Math.min(activeModalListLength || 12, 24),
            hwInspectedIds.length,
            6
          )}
          pronPracticedCount={Math.max(Math.min(hwInspectedIds.length, 3), 1)}
          pronTargetCount={3}
          quizCompleted={true}
          dialogueId={`kutuphane_${activeSection}`}
          homeworkUrl={buildHomeworkShareUrl()}
        />
      )}

      {isStatsBadgesOpen && (
        <StatsAndBadgesModal
          isOpen={isStatsBadgesOpen}
          onClose={() => setIsStatsBadgesOpen(false)}
        />
      )}

      {/* TEKİL KART ÇALIŞMA MODALI (İLERİ / GERİ NAVİGASYONLU — 998 Görsel Kelime, 508 Atasözü, 1111 Cümle) */}
      {selectedCardIndex !== null &&
        isDualGenderSection &&
        activeModalListLength > 0 &&
        (() => {
          const safeIndex =
            ((selectedCardIndex % activeModalListLength) +
              activeModalListLength) %
            activeModalListLength;

          const currentVisual =
            activeSection === "gorsel-kelimeler"
              ? filteredVisualWords[safeIndex]
              : null;
          const currentProverb =
            activeSection === "atasozleri"
              ? filteredProverbs[safeIndex]
              : null;
          const currentSentence =
            activeSection === "cumleler"
              ? filteredSentences[safeIndex]
              : null;

          const activeItem =
            currentVisual || currentProverb || currentSentence;
          if (!activeItem) return null;

          const isItemPlaying = playingItemId === activeItem.id;
          const isModalArVisible =
            showArabic || Boolean(revealedArabicIds[activeItem.id]);
          const isModalTrVisible =
            showTurkish || Boolean(revealedTurkishIds[activeItem.id]);
          const imageUrl = currentVisual
            ? currentVisual.gorsel || getVisualWordCoverUrl(currentVisual)
            : currentProverb
            ? currentProverb.gorsel || getProverbCoverUrl(currentProverb.id)
            : null;

          const headerBadge = currentVisual
            ? `#${
                currentVisual.sira ||
                parseInt(currentVisual.id.split("_")[0], 10) ||
                safeIndex + 1
              } • ${currentVisual.cefr} • ${formatVisualCategoryBadge(
                currentVisual.kategori_tr
              )}`
            : currentProverb
            ? `#${
                currentProverb.sira || currentProverb.id.replace("ata_", "")
              } • ${currentProverb.cefr} • ${(
                currentProverb.tema || "Atasözü"
              ).replace(/_/g, " ")}`
            : currentSentence
            ? `#${
                currentSentence.sira || currentSentence.id.replace("cumle_", "")
              } • ${currentSentence.seviye || currentSentence.cefr || "A1"} • ${(
                currentSentence.tema || "Günlük Cümle"
              ).replace(/_/g, " ")}`
            : "";

          const modalForms: { label: string; arabic: string }[] | undefined =
            currentVisual
              ? [
                  { label: "Temel Form", arabic: currentVisual.arapca },
                  ...(currentVisual.ikincil_form &&
                  currentVisual.ikincil_form !== "-"
                    ? [
                        {
                          label:
                            currentVisual.tur === "fiil"
                              ? "Muzâri (Şimdiki)"
                              : "Cemî (Çoğul)",
                          arabic: currentVisual.ikincil_form,
                        },
                      ]
                    : []),
                  ...(currentVisual.ucuncul_form &&
                  currentVisual.ucuncul_form !== "-"
                    ? [
                        {
                          label: "Masdar",
                          arabic: currentVisual.ucuncul_form,
                        },
                      ]
                    : []),
                ]
              : undefined;

          const goPrev = () => {
            playClick();
            setSelectedCardIndex(
              (safeIndex - 1 + activeModalListLength) % activeModalListLength
            );
          };

          const goNext = () => {
            playClick();
            setSelectedCardIndex((safeIndex + 1) % activeModalListLength);
          };

          return (
            <div
              className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
              onClick={() => setSelectedCardIndex(null)}
            >
              <div
                className="relative w-[95vw] max-h-[92vh] rounded-2xl sm:w-[90vw] lg:w-[85vw] max-w-[1500px] sm:h-[85vh] sm:max-h-[88vh] sm:rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl border-2 border-[#E2D4B7] bg-[#FDFBF7] dark:bg-[var(--surface)] dark:border-[var(--border)]"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => {
                  touchStartXRef.current = e.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(e) => {
                  if (touchStartXRef.current === null) return;
                  const endX =
                    e.changedTouches[0]?.clientX ?? touchStartXRef.current;
                  const deltaX = endX - touchStartXRef.current;
                  touchStartXRef.current = null;
                  if (deltaX > 50) {
                    goPrev();
                  } else if (deltaX < -50) {
                    goNext();
                  }
                }}
              >
                {/* 1. Üst Başlık Barı (Mobilde Sağ Üst ✕ Kapat Sabit, Filtre Anahtarları 2. Satırda Taşmasız) */}
                <div className="px-2.5 sm:px-5 lg:px-7 py-2 sm:py-3 bg-[#F7EFE1] dark:bg-[var(--background)] border-b border-[#E6D7BE] dark:border-[var(--border)] shrink-0 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-1.5 sm:gap-2 w-full min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <span className="px-2.5 py-1 rounded-lg bg-[#087F5B] text-white text-xs sm:text-sm font-extrabold truncate max-w-[195px] sm:max-w-[360px] lg:max-w-[480px]">
                        {headerBadge}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] text-[11px] sm:text-sm font-extrabold tabular-nums text-[var(--foreground)] shrink-0">
                        {safeIndex + 1} / {activeModalListLength}
                      </span>
                    </div>

                    {/* Masaüstünde tek satırda görünürlük anahtarları + Sağ üstte her zaman sabit ✕ Kapat */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <div className="hidden sm:flex items-center gap-1.5 sm:gap-2">
                        {(() => {
                          const modalFavItem = currentVisual
                            ? toVisualWordFavoriteItem(currentVisual)
                            : currentProverb
                            ? toProverbFavoriteItem(currentProverb)
                            : currentSentence
                            ? toSentenceFavoriteItem(currentSentence)
                            : null;
                          const isModalFav =
                            mounted &&
                            modalFavItem &&
                            (currentVisual
                              ? isVisualWordFavorited(currentVisual)
                              : favoriteIdsSet.has(modalFavItem.id));
                          return modalFavItem ? (
                            <button
                              type="button"
                              onClick={() => {
                                playClick();
                                toggleFavoriteWord(modalFavItem);
                              }}
                              title={
                                isModalFav
                                  ? "Defterimden Çıkar"
                                  : "Defterime Ekle"
                              }
                              className={`h-9 px-3 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                                isModalFav
                                  ? "bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-600 dark:text-rose-300 shadow-2xs"
                                  : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--muted)] hover:text-rose-600"
                              }`}
                            >
                              <Heart
                                size={14}
                                fill={isModalFav ? "currentColor" : "none"}
                              />
                              <span>
                                {isModalFav ? "Defterimde" : "Defterime Ekle"}
                              </span>
                            </button>
                          ) : null;
                        })()}

                        <button
                          type="button"
                          onClick={toggleBulkArabic}
                          title={showArabic ? "Arapça Açık" : "Arapça Gizli"}
                          className={`h-9 px-3 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                            showArabic
                              ? "bg-[#087F5B] border-[#065F46] text-white shadow-2xs"
                              : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--muted)]"
                          }`}
                        >
                          {showArabic ? <Eye size={13} /> : <EyeOff size={13} />}
                          <span>Arapça</span>
                        </button>

                        <button
                          type="button"
                          onClick={toggleBulkTurkish}
                          title={showTurkish ? "Türkçe Açık" : "Türkçe Gizli"}
                          className={`h-9 px-3 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                            showTurkish
                              ? "bg-[#6741D9] border-[#5230B5] text-white shadow-2xs"
                              : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--muted)]"
                          }`}
                        >
                          {showTurkish ? <Eye size={13} /> : <EyeOff size={13} />}
                          <span>Türkçe</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            cycleHarekeMode();
                          }}
                          title={
                            activeHarekeMode === "full"
                              ? "Tam Harekeli"
                              : activeHarekeMode === "irab-only"
                                ? "Hareke Solması (Sadece İ'rab)"
                                : "Harekesiz (İleri Okuma)"
                          }
                          className={`h-9 px-3 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeHarekeMode === "full"
                              ? "bg-amber-100 dark:bg-amber-950/70 border-amber-400 text-amber-900 dark:text-amber-200"
                              : activeHarekeMode === "irab-only"
                                ? "bg-emerald-100 dark:bg-emerald-950/70 border-emerald-400 text-emerald-900 dark:text-emerald-200"
                                : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--muted)]"
                          }`}
                        >
                          <span>
                            ✨{" "}
                            {activeHarekeMode === "full"
                              ? "Tam"
                              : activeHarekeMode === "irab-only"
                                ? "İ'rab"
                                : "Yalın"}
                          </span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setSelectedCardIndex(null);
                        }}
                        aria-label="Kapat"
                        title="Pencereyi Kapat (Esc)"
                        className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 sm:bg-white sm:dark:bg-[var(--surface)] sm:hover:bg-rose-50 border border-rose-700 sm:border-[#E6D7BE] text-xs font-extrabold text-white sm:text-[var(--foreground)] flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                      >
                        <X size={16} />
                        <span className="hidden sm:inline">Kapat</span>
                      </button>
                    </div>
                  </div>

                  {/* Mobil (< 640px) Görünürlük & Defter Anahtarları — Taşmasız Kompakt Satır */}
                  <div className="sm:hidden flex items-center justify-between gap-1.5 w-full">
                    {(() => {
                      const modalFavItem = currentVisual
                        ? toVisualWordFavoriteItem(currentVisual)
                        : currentProverb
                        ? toProverbFavoriteItem(currentProverb)
                        : currentSentence
                        ? toSentenceFavoriteItem(currentSentence)
                        : null;
                      const isModalFav =
                        mounted &&
                        modalFavItem &&
                        (currentVisual
                          ? isVisualWordFavorited(currentVisual)
                          : favoriteIdsSet.has(modalFavItem.id));
                      return modalFavItem ? (
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            toggleFavoriteWord(modalFavItem);
                          }}
                          title={
                            isModalFav
                              ? "Defterimden Çıkar"
                              : "Defterime Ekle"
                          }
                          className={`h-8 w-9 rounded-xl border text-xs font-extrabold flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            isModalFav
                              ? "bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-600 dark:text-rose-300"
                              : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--muted)]"
                          }`}
                        >
                          <Heart
                            size={14}
                            fill={isModalFav ? "currentColor" : "none"}
                          />
                        </button>
                      ) : null;
                    })()}

                    <button
                      type="button"
                      onClick={toggleBulkArabic}
                      className={`flex-1 h-8 px-2 rounded-xl border text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap min-w-0 ${
                        showArabic
                          ? "bg-[#087F5B] border-[#065F46] text-white"
                          : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--muted)]"
                      }`}
                    >
                      {showArabic ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>Arapça</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleBulkTurkish}
                      className={`flex-1 h-8 px-2 rounded-xl border text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap min-w-0 ${
                        showTurkish
                          ? "bg-[#6741D9] border-[#5230B5] text-white"
                          : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--muted)]"
                      }`}
                    >
                      {showTurkish ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>Türkçe</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        cycleHarekeMode();
                      }}
                      className={`flex-1 h-8 px-2 rounded-xl border text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap min-w-0 ${
                        activeHarekeMode === "full"
                          ? "bg-amber-100 dark:bg-amber-950/70 border-amber-400 text-amber-900 dark:text-amber-200"
                          : activeHarekeMode === "irab-only"
                            ? "bg-emerald-100 dark:bg-emerald-950/70 border-emerald-400 text-emerald-900 dark:text-emerald-200"
                            : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--muted)]"
                      }`}
                    >
                      <span>
                        ✨{" "}
                        {activeHarekeMode === "full"
                          ? "Tam"
                          : activeHarekeMode === "irab-only"
                            ? "İ'rab"
                            : "Yalın"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. Orta İçerik Alanı (%85 Ekran Ölçekli, Sıfır Kaydırmalı Split-View) */}
                <div
                  className={
                    imageUrl
                      ? "flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 p-4 sm:p-6 lg:p-8 items-center overflow-y-auto lg:overflow-hidden"
                      : "flex-1 min-h-0 flex flex-col justify-center gap-4 lg:gap-6 p-4 sm:p-6 lg:p-10 overflow-y-auto lg:overflow-hidden"
                  }
                >
                  {/* Sol Sütun: Kırpılmamış 1:1 Kare Görsel (aspect-square + object-contain + Lightbox) */}
                  {imageUrl && (
                    <div className="lg:col-span-5 flex items-center justify-center h-full min-h-0">
                      <div
                        onClick={() => {
                          playClick();
                          setLightboxImage({
                            src: imageUrl,
                            title: activeItem.turkce,
                            subtitle: activeItem.arapca,
                          });
                        }}
                        title="Görseli tam ekran büyütmek için tıklayın"
                        className="group relative aspect-square w-full max-w-[200px] sm:max-w-[320px] lg:max-w-[min(100%,56vh)] max-h-[28vh] sm:max-h-[42vh] lg:max-h-[58vh] mx-auto rounded-2xl lg:rounded-3xl overflow-hidden border-2 border-[#E6D7BE] bg-white shadow-md flex items-center justify-center cursor-pointer"
                      >
                        <img
                          src={imageUrl}
                          alt={activeItem.turkce}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        {currentVisual && (
                          <span
                            className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold uppercase shadow-xs ${
                              currentVisual.tur === "fiil"
                                ? "bg-[#6741D9] text-white"
                                : "bg-[#087F5B] text-white"
                            }`}
                          >
                            {currentVisual.tur === "fiil" ? "Fiil" : "İsim"}
                          </span>
                        )}
                        <span className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-xl bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs">
                          <Maximize2 size={14} />
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sağ Sütun: Metin ve Pedagojik Kartlar */}
                  <div
                    className={
                      imageUrl
                        ? "lg:col-span-7 flex flex-col justify-center gap-3 lg:gap-5 h-full min-h-0 min-w-0"
                        : "w-full max-w-4xl mx-auto flex flex-col justify-center gap-4 lg:gap-6 min-h-0"
                    }
                  >
                    {/* Harekeli Arapça Ana Metin Kutusu (Fluid Clamp Typography) */}
                    {isModalArVisible ? (
                      <div
                        dir="rtl"
                        className="rounded-2xl border border-[#E6D7BE] bg-white dark:bg-[var(--background)] p-4 lg:p-6 min-h-[84px] lg:min-h-[116px] shadow-xs flex flex-col items-center justify-center text-center relative"
                      >
                        <div className="arabic font-arabic text-[clamp(2rem,4vw,3.5rem)] font-bold text-[#065F46] dark:text-emerald-400 leading-[1.85] py-0.5 w-full flex items-center justify-center text-center">
                          <WordTooltip
                            text={activeItem.arapca}
                            contextSentenceTr={activeItem.turkce}
                            centered
                          />
                        </div>
                        {!showArabic && (
                          <button
                            type="button"
                            onClick={() =>
                              toggleCardArabicReveal(activeItem.id)
                            }
                            className="mt-2 mx-auto px-2.5 py-1 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] text-xs font-sans font-extrabold text-[var(--muted)] flex items-center gap-1 cursor-pointer"
                          >
                            <EyeOff size={12} />
                            <span>Arapçayı Tekrar Gizle</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleCardArabicReveal(activeItem.id)}
                        className="w-full min-h-[88px] lg:min-h-[120px] rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-dashed border-[#087F5B]/60 p-4 lg:p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-emerald-50/40 transition-all"
                      >
                        <span
                          dir="rtl"
                          className="arabic font-arabic text-[clamp(1.4rem,2.4vw,2.5rem)] font-bold text-[#065F46]/40 blur-md select-none"
                        >
                          {getDisplayArabic(activeItem.arapca)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-[#065F46] dark:text-emerald-300 text-xs sm:text-sm font-extrabold">
                          <Eye size={14} />
                          <span>Arapçayı görmek için dokun</span>
                        </span>
                      </button>
                    )}

                    {/* Türkçe Anlam ve Detay Kutusu */}
                    <div className="rounded-2xl border border-[#E6D7BE]/80 bg-[#F7F2E7]/80 dark:bg-[var(--background)] p-4 lg:p-6 flex flex-col gap-2.5 lg:gap-3.5">
                      {isModalTrVisible ? (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[clamp(1.1rem,1.7vw,1.85rem)] font-bold text-[#1E293B] dark:text-white leading-snug">
                              {activeItem.turkce}
                            </p>
                            <div className="flex items-center gap-1.5">
                              {currentSentence?.odak_kalip && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    playClick();
                                    setActiveGrammarModal({
                                      grammarTopic: currentSentence.odak_kalip,
                                    });
                                  }}
                                  title="Bu gramer kalıbının kuralını ve örneklerini pencerede aç"
                                  dir="ltr"
                                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 border border-amber-300 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-extrabold cursor-pointer transition-colors inline-flex items-center gap-1"
                                >
                                  <span className="shrink-0">📌</span>
                                  <MixedText text={currentSentence.odak_kalip} />
                                </button>
                              )}
                              {!showTurkish && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleCardTurkishReveal(activeItem.id)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] text-xs font-extrabold text-[var(--muted)] flex items-center gap-1 cursor-pointer"
                                >
                                  <EyeOff size={12} />
                                  <span>Gizle</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {currentProverb?.lafzi_ceviri && (
                            <p className="text-[clamp(0.9rem,1.2vw,1.3rem)] text-[#475569] dark:text-slate-300 border-t border-dashed border-[#E2D3B8] pt-2 leading-snug">
                              <strong className="font-bold text-[#1E293B] dark:text-white">
                                Lafzî Çeviri:
                              </strong>{" "}
                              {currentProverb.lafzi_ceviri}
                            </p>
                          )}

                          {currentProverb?.kullanim_baglami && (
                            <div className="rounded-xl bg-white/90 dark:bg-[var(--surface)] border border-[#E6D7BE] p-3 lg:p-4 text-[clamp(0.85rem,1.1vw,1.2rem)] text-[#334155] dark:text-slate-200 leading-relaxed">
                              💡 <strong>Kullanım Bağlamı:</strong>{" "}
                              {currentProverb.kullanim_baglami}
                            </div>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            toggleCardTurkishReveal(activeItem.id)
                          }
                          className="w-full min-h-[52px] rounded-xl bg-white/80 dark:bg-[var(--surface)] border-2 border-dashed border-[#6741D9]/50 p-3 flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold text-[#6741D9] dark:text-indigo-300 cursor-pointer hover:bg-indigo-50/40 transition-all"
                        >
                          <Eye size={15} />
                          <span>Türkçeyi görmek için dokun</span>
                        </button>
                      )}

                      {isModalArVisible &&
                        currentVisual &&
                        (currentVisual.ikincil_form ||
                          currentVisual.ucuncul_form) && (
                          <div className="flex flex-wrap items-center gap-3 text-[clamp(0.9rem,1.2vw,1.3rem)] text-[#475569] dark:text-slate-300 border-t border-dashed border-[#E2D3B8] pt-2">
                            {currentVisual.ikincil_form &&
                              currentVisual.ikincil_form !== "-" && (
                                <span>
                                  {currentVisual.tur === "fiil"
                                    ? "Muzâri:"
                                    : "Çoğul:"}{" "}
                                  <strong
                                    dir="rtl"
                                    className="arabic font-arabic text-[clamp(1.1rem,1.5vw,1.6rem)] font-bold text-[#1E293B] dark:text-white"
                                  >
                                    {getDisplayArabic(
                                      currentVisual.ikincil_form
                                    )}
                                  </strong>
                                </span>
                              )}
                            {currentVisual.ucuncul_form &&
                              currentVisual.ucuncul_form !== "-" && (
                                <span>
                                  Masdar:{" "}
                                  <strong
                                    dir="rtl"
                                    className="arabic font-arabic text-[clamp(1.1rem,1.5vw,1.6rem)] font-bold text-[#1E293B] dark:text-white"
                                  >
                                    {getDisplayArabic(
                                      currentVisual.ucuncul_form
                                    )}
                                  </strong>
                                </span>
                              )}
                          </div>
                        )}

                      {/* Örnek Cümle Kutusu (Kelimeler için) */}
                      {currentVisual?.ornek_ar && (
                        <div className="rounded-xl bg-white/90 dark:bg-[var(--surface)] border border-[#E6D7BE] p-3 lg:p-4 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-[#6741D9]">
                              💡 Örnek Cümle
                            </span>
                            <button
                              type="button"
                              title="Örnek Cümleyi Dinle"
                              aria-label="Örnek Cümleyi Dinle"
                              onClick={() => {
                                playClick();
                                if (
                                  currentVisual.ornek_ses_erkek ||
                                  currentVisual.ornek_ses_kadin
                                ) {
                                  void playDualGenderAudio({
                                    text: currentVisual.ornek_ar,
                                    ses_erkek: currentVisual.ornek_ses_erkek,
                                    ses_kadin: currentVisual.ornek_ses_kadin,
                                    rate: speechRate,
                                    gender: preferredVoiceGender,
                                  });
                                } else {
                                  void speakHybrid({
                                    text: currentVisual.ornek_ar,
                                    rate: speechRate,
                                    voice: preferredVoiceGender,
                                  });
                                }
                              }}
                              className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-[#087F5B]/40 text-[#065F46] dark:text-emerald-300 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            >
                              <Volume2 size={15} />
                            </button>
                          </div>
                          {isModalArVisible ? (
                            <div
                              dir="rtl"
                              className="arabic font-arabic text-[clamp(1.15rem,1.6vw,1.7rem)] font-bold text-[var(--foreground)] text-right leading-[1.75]"
                            >
                              <WordTooltip
                                text={currentVisual.ornek_ar}
                                contextSentenceTr={
                                  currentVisual.ornek_tr ||
                                  currentVisual.turkce
                                }
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                toggleCardArabicReveal(activeItem.id)
                              }
                              className="w-full py-1.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 text-xs font-extrabold text-[#065F46] dark:text-emerald-300 cursor-pointer"
                            >
                              Örnek Arapça cümleyi gör
                            </button>
                          )}
                          {currentVisual.ornek_tr && isModalTrVisible && (
                            <p className="text-[clamp(0.85rem,1.1vw,1.2rem)] text-[#334155] dark:text-slate-200 leading-relaxed">
                              {currentVisual.ornek_tr}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Birleştirilmiş Alt Kontrol İskelesi (360px Mobilde Sol < Önceki ve Sağ Sonraki > Simetrik ve Taşmasız) */}
                <div className="flex items-center justify-between gap-1 sm:gap-3 px-2 sm:px-5 lg:px-7 py-2 sm:py-3.5 bg-[#F7EFE1] dark:bg-[var(--background)] border-t border-[#E6D7BE] dark:border-[var(--border)] shrink-0">
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Önceki Kart"
                    title="Önceki Kart (Sol Ok)"
                    className="h-10 w-9 sm:w-auto sm:h-auto px-0 sm:px-4 lg:px-6 sm:py-2.5 lg:py-3 text-sm lg:text-base font-semibold rounded-xl bg-white dark:bg-[var(--surface)] hover:bg-[#EFE3CE] border-2 border-[#E6D7BE] border-b-3 text-[var(--foreground)] flex items-center justify-center gap-1.5 cursor-pointer active:translate-y-0.5 shrink-0"
                  >
                    <ChevronLeft size={18} />
                    <span className="hidden sm:inline">Önceki</span>
                  </button>

                  <div className="flex items-center justify-center gap-1 sm:gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => void handleListenDualGender(activeItem)}
                      title="Dinle (Boşluk Tuşu)"
                      className={`h-10 sm:h-auto px-2 sm:px-4 lg:px-6 sm:py-2.5 lg:py-3 text-xs sm:text-sm lg:text-base font-semibold rounded-xl border-2 border-b-3 flex items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer min-w-0 whitespace-nowrap ${
                        isItemPlaying
                          ? "bg-[#087F5B] border-[#065F46] text-white"
                          : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--foreground)] hover:border-[#087F5B]"
                      }`}
                    >
                      <Volume2
                        size={16}
                        className={
                          isItemPlaying
                            ? "text-white shrink-0"
                            : "text-[#065F46] shrink-0"
                        }
                      />
                      <span className="truncate">
                        {isItemPlaying ? "Dur" : "Dinle"}
                      </span>
                    </button>

                    <div className="flex items-center bg-white dark:bg-[var(--surface)] p-0.5 sm:p-1 rounded-xl border-2 border-[#E6D7BE] shrink-0">
                      {(
                        [
                          { id: "erkek", label: "👨 Erkek" },
                          { id: "kadin", label: "👩 Kadın" },
                        ] as { id: VoiceGender; label: string }[]
                      ).map((g) => {
                        const active =
                          (mounted ? preferredVoiceGender : "erkek") === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            title={
                              g.id === "erkek"
                                ? "Erkek Seslendirici"
                                : "Kadın Seslendirici"
                            }
                            onClick={() => {
                              playClick();
                              setPreferredVoiceGender(g.id);
                            }}
                            className={`px-1.5 py-1.5 sm:px-2.5 lg:px-3.5 lg:py-2 rounded-lg text-xs lg:text-sm font-semibold transition-all cursor-pointer ${
                              active
                                ? "bg-[#087F5B] text-white"
                                : "text-[var(--muted)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            <span className="sm:hidden">
                              {g.id === "erkek" ? "👨" : "👩"}
                            </span>
                            <span className="hidden sm:inline">{g.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setShadowingTarget({
                          text: activeItem.arapca,
                          refAudioUrl: getDualGenderAudioUrl(
                            activeItem,
                            preferredVoiceGender
                          ),
                          forms: modalForms,
                        });
                      }}
                      className="h-10 sm:h-auto px-2 sm:px-4 lg:px-6 sm:py-2.5 lg:py-3 text-xs sm:text-sm lg:text-base font-semibold rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/75 border-2 border-[#6741D9] border-b-3 text-[#6741D9] dark:text-indigo-200 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <Mic size={15} className="shrink-0" />
                      <span>Telaffuz</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        if (currentVisual) {
                          const morphAr: string[] = [];
                          if (
                            currentVisual.ikincil_form &&
                            currentVisual.ikincil_form !== "-"
                          ) {
                            morphAr.push(
                              `${
                                currentVisual.tur === "fiil"
                                  ? "Mâzî / Muzâri:"
                                  : "Müfret / Cemî:"
                              } ${currentVisual.ikincil_form}`
                            );
                          }
                          if (currentVisual.ornek_ar) {
                            morphAr.push(`Örnek: ${currentVisual.ornek_ar}`);
                          }
                          setShareCardTarget({
                            type: "visual_word",
                            arabicText: currentVisual.arapca,
                            turkishText: currentVisual.turkce,
                            subInfoAr:
                              morphAr.length > 0
                                ? morphAr.join("  |  ")
                                : undefined,
                            subInfoTr: currentVisual.ornek_tr
                              ? `Örnek: ${currentVisual.ornek_tr}`
                              : undefined,
                            level: currentVisual.cefr,
                            category: formatVisualCategoryBadge(
                              currentVisual.kategori_tr
                            ),
                            imageUrl: imageUrl || undefined,
                            deepLink:
                              "https://app.muallimun.net/kutuphane?tab=gorsel-kelimeler",
                            initialShowTranslation: isModalTrVisible,
                          });
                        } else if (currentProverb) {
                          setShareCardTarget({
                            type: "proverb",
                            arabicText: currentProverb.arapca,
                            turkishText: currentProverb.turkce,
                            subInfoTr: currentProverb.lafzi_ceviri
                              ? `Lafzî: ${currentProverb.lafzi_ceviri}`
                              : currentProverb.kullanim_baglami,
                            level: currentProverb.cefr,
                            category: currentProverb.tema
                              ? formatTurkishCategory(currentProverb.tema)
                              : undefined,
                            imageUrl: imageUrl || undefined,
                            deepLink:
                              "https://app.muallimun.net/kutuphane?tab=atasozleri",
                            initialShowTranslation: isModalTrVisible,
                          });
                        } else if (currentSentence) {
                          setShareCardTarget({
                            type: "sentence",
                            arabicText: currentSentence.arapca,
                            turkishText: currentSentence.turkce,
                            subInfoTr: currentSentence.odak_kalip
                              ? `📌 Odak Kalıp: ${currentSentence.odak_kalip}`
                              : undefined,
                            level: currentSentence.cefr,
                            category: currentSentence.tema
                              ? formatTurkishCategory(currentSentence.tema)
                              : undefined,
                            deepLink:
                              "https://app.muallimun.net/kutuphane?tab=cumleler",
                            initialShowTranslation: isModalTrVisible,
                          });
                        }
                      }}
                      title="Görsel Kart Olarak Paylaş"
                      className="h-10 w-9 sm:w-auto sm:h-auto px-0 sm:px-3.5 lg:px-5 sm:py-2.5 lg:py-3 text-sm lg:text-base font-semibold rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] hover:border-[#087F5B] border-b-3 text-[#065F46] dark:text-emerald-400 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Share2 size={16} />
                      <span className="hidden sm:inline">Paylaş</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Sonraki Kart"
                    title="Sonraki Kart (Sağ Ok)"
                    className="h-10 w-9 sm:w-auto sm:h-auto px-0 sm:px-4 lg:px-6 sm:py-2.5 lg:py-3 text-sm lg:text-base font-semibold rounded-xl bg-[#087F5B] hover:bg-[#065F46] border-2 border-[#065F46] border-b-3 text-white flex items-center justify-center gap-1.5 cursor-pointer active:translate-y-0.5 shrink-0"
                  >
                    <span className="hidden sm:inline">Sonraki</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Tam Ekran 1:1 Görsel Lightbox Önizleme Modalı */}
              {lightboxImage && (
                <div
                  className="fixed inset-0 z-[75] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxImage(null);
                  }}
                >
                  <div
                    className="relative max-w-[min(92vw,82vh)] w-full bg-[#FDFBF7] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E2D4B7] p-3 sm:p-4 shadow-2xl flex flex-col items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-full flex items-center justify-between gap-2 px-1">
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-extrabold text-[var(--foreground)] truncate">
                          {lightboxImage.title}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLightboxImage(null)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <X size={15} />
                        <span>Kapat</span>
                      </button>
                    </div>
                    <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-[#E6D7BE] bg-white flex items-center justify-center">
                      <img
                        src={lightboxImage.src}
                        alt={lightboxImage.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {/* 🎓 ÖĞRETMEN ÖDEV PAKETİ AKTİF BİLDİRİM BANDI */}
      {isHomeworkMode && (
        <div className="rounded-2xl border-2 border-[#6741D9] border-b-4 bg-gradient-to-r from-[#F3F0FF] via-[#FDFBF7] to-emerald-50/80 dark:from-indigo-950/70 dark:via-slate-900 dark:to-emerald-950/50 px-3.5 py-3 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2.5 py-1 rounded-xl bg-[#6741D9] text-white text-xs font-black flex items-center gap-1.5 shrink-0">
              <GraduationCap size={15} />
              <span>Öğretmen Ödev Paketi</span>
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold text-[#4C28B5] dark:text-indigo-200 truncate">
                {getModuleHumanLabel()} •{" "}
                {levelFilter === "all" ? "Tüm Kurlar" : levelFilter} •{" "}
                {categoryFilter === "all"
                  ? "Tüm Kategoriler"
                  : categoryFilter.replace(/_/g, " ")}
              </p>
              <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 truncate">
                📊 Çalışma İlerlemesi: {hwInspectedIds.length} Öğe Dinlendi / İncelendi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isDualGenderSection && (
              <Link
                href={buildExerciseUrlForCurrentTab()}
                onClick={() => playClick()}
                className="px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold border-b-2 border-[#3b1f8c] flex items-center gap-1.5"
              >
                <Gamepad2 size={14} />
                <span>Ödev Alıştırması</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                playClick();
                setIsHwCertificateOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold border-b-2 border-emerald-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <CheckCircle2 size={14} />
              <span>🏅 Ödevi Tamamla &amp; Ödev Karnesi Al</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playClick();
                setIsHomeworkMode(false);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[var(--surface)] border border-[#D0BFFF] text-[11px] font-extrabold text-[#4C28B5] dark:text-indigo-200 cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* ÜST BAŞLIK & V2 MODÜL SEÇİCİ */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            {activeSection !== "vitrin" ? (
              <button
                type="button"
                onClick={() => handleSwitchSection("vitrin")}
                className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 flex items-center gap-1 sm:gap-1.5 text-xs font-extrabold text-[#065F46] dark:text-emerald-400 hover:bg-[#EFE3CE] active:border-b-2 active:translate-y-0.5 transition-all shrink-0 cursor-pointer"
                title="Kütüphane Vitrinine Dön"
              >
                <ChevronLeft size={17} strokeWidth={2.5} />
                <span className="sm:hidden">Vitrin</span>
                <span className="hidden sm:inline">Kütüphane Vitrini</span>
              </button>
            ) : (
              <Link
                href="/"
                onClick={() => playClick()}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 flex items-center justify-center text-[var(--foreground)] hover:bg-[#EFE3CE] active:border-b-2 active:translate-y-0.5 transition-all shrink-0"
                aria-label="Ana Sayfaya Dön"
              >
                <ChevronLeft size={19} strokeWidth={2.5} />
              </Link>
            )}
            <div>
              <h1 className="text-lg sm:text-2xl font-extrabold text-[var(--foreground)] tracking-tight leading-tight">
                Eğitim Kütüphanesi
              </h1>
              <p className="text-[11px] sm:text-xs font-medium text-[var(--muted)]">
                {contentStats.dialogueCount} diyalog, {contentStats.readingCount}{" "}
                okuma metni, {contentStats.sentenceCount} cümle,{" "}
                {contentStats.proverbCount} atasözü ve{" "}
                {contentStats.visualWordCount} görsel kelime
              </p>
            </div>
          </div>

          {/* Çift Cinsiyetli Seslendirici Seçici (Günlük Cümle, Atasözü ve Görsel Kelimeler için) */}
          {isDualGenderSection && (
            <div className="flex items-center gap-1.5 bg-[#F7EFE1] dark:bg-[var(--surface)] px-2.5 py-1.5 rounded-xl border-2 border-[#E6D7BE] dark:border-[var(--border)] self-start sm:self-auto">
              <UserCheck size={14} className="text-[#087F5B] shrink-0" />
              <span className="text-[11px] font-extrabold text-[var(--foreground)]">
                Seslendirici:
              </span>
              {(
                [
                  { id: "erkek", label: "👨 Erkek" },
                  { id: "kadin", label: "👩 Kadın" },
                ] as { id: VoiceGender; label: string }[]
              ).map((g) => {
                const active = (mounted ? preferredVoiceGender : "erkek") === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setPreferredVoiceGender(g.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      active
                        ? "bg-[#087F5B] text-white shadow-2xs"
                        : "bg-white dark:bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modül Sekmeleri (Mobilde Yatay Kaydırılabilir + Sağ Görsel İpucu, Masaüstünde Dengeli Flex-Wrap) */}
        <div className="relative max-w-full">
          <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1.5 pr-8 lg:pr-2 border-2 border-[#E6D7BE] dark:border-[var(--border)] flex overflow-x-auto lg:overflow-visible no-scrollbar whitespace-nowrap lg:whitespace-normal lg:flex-wrap items-center gap-1.5 max-w-full">
            {(
              [
                {
                  id: "vitrin",
                  label: "🏛️ Vitrin (Genel Bakış)",
                },
                {
                  id: "dialogues",
                  label: `💬 Diyaloglar (${contentStats.dialogueCount})`,
                },
                {
                  id: "metinler",
                  label: `📖 Metinler (${contentStats.readingCount})`,
                },
                {
                  id: "cumleler",
                  label: `🗣️ Günlük Cümle (${contentStats.sentenceCount})`,
                },
                {
                  id: "atasozleri",
                  label: `📜 Atasözleri (${contentStats.proverbCount})`,
                },
                {
                  id: "gorsel-kelimeler",
                  label: `🖼️ Görsel Kelime (${contentStats.visualWordCount})`,
                },
                {
                  id: "gramer",
                  label: `📌 Gramer Atlası (${contentStats.grammarNoteCount})`,
                },
                {
                  id: "es-zit",
                  label: `🔄 Eş & Zıt Anlamlılar (${contentStats.synonymsAntonymsCount})`,
                },
                {
                  id: "videolar",
                  label: `🎬 Video & İzleme Rehberi (${contentStats.youtubeCount})`,
                },
              ] as { id: ViewSection; label: string }[]
            ).map((tab) => {
              const active = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSwitchSection(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? tab.id === "vitrin"
                        ? "bg-[#6741D9] text-white font-extrabold shadow-2xs"
                        : "bg-[#087F5B] text-white font-extrabold shadow-2xs"
                      : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            {/* Kişisel Çalışma Alanı Ayırıcısı ve Kişisel Sekmeler (md:ml-auto olmadan dengeli sarma) */}
            <span
              aria-hidden="true"
              className="h-5 w-px bg-[#D9C7A8] dark:bg-slate-700 mx-0.5 shrink-0"
            />
            <div
              role="group"
              aria-label="Kişisel Çalışma Sekmeleri"
              className="flex items-center gap-1.5 shrink-0"
            >
              {(
                [
                  {
                    id: "saved-words",
                    label: `❤️ Defterim (${mounted ? favoriteWords.length : 0})`,
                    activeClass:
                      "bg-rose-600 border-rose-700 text-white font-extrabold shadow-2xs",
                    idleClass:
                      "bg-rose-50/75 dark:bg-rose-950/35 border-rose-300/70 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 font-bold hover:border-rose-500",
                  },
                  {
                    id: "weak-words",
                    label: `🎯 Mahreç (${mounted ? weakWords.length : 0})`,
                    activeClass:
                      "bg-[#6741D9] border-[#5230B5] text-white font-extrabold shadow-2xs",
                    idleClass:
                      "bg-[#F3F0FF]/80 dark:bg-indigo-950/35 border-[#6741D9]/35 dark:border-indigo-700/60 text-[#4C28B5] dark:text-indigo-300 font-bold hover:border-[#6741D9]",
                  },
                ] as {
                  id: ViewSection;
                  label: string;
                  activeClass: string;
                  idleClass: string;
                }[]
              ).map((tab) => {
                const active = activeSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSwitchSection(tab.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      active ? tab.activeClass : tab.idleClass
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          <span
            aria-hidden="true"
            className="lg:hidden pointer-events-none absolute inset-y-0.5 right-0.5 w-7 rounded-r-xl bg-gradient-to-l from-white via-white/90 to-transparent dark:from-[#1e1e1e] dark:via-[#1e1e1e]/90 flex items-center justify-end pr-1 text-[var(--muted)]"
          >
            <ChevronRight size={13} className="opacity-80" />
          </span>
        </div>
      </div>

      {/* 0. SEKME: KÜTÜPHANE VİTRİN (GENEL BAKIŞ) EKRANI */}
      {activeSection === "vitrin" && (
        <section
          aria-label="Kütüphane Vitrini (Genel Bakış)"
          className="space-y-4"
        >
          {/* 6 Zengin Vitrin Kartı (Bento Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {/* 1. Konuşma Diyalogları Kartı */}
            <div
              onClick={() => handleSwitchSection("dialogues")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSwitchSection("dialogues");
                }
              }}
              className="group rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] hover:border-[#087F5B] p-4 flex flex-col justify-between gap-3.5 transition-all hover:-translate-y-0.5 cursor-pointer shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-2xl overflow-hidden shrink-0 border-2 border-[#E6D7BE] bg-white shadow-2xs flex items-center justify-center relative">
                    <img
                      src={
                        diyaloglar[0]?.gorsel || getDialogueCoverUrl("dlg_001")
                      }
                      alt="Konuşma Diyalogları"
                      referrerPolicy="no-referrer"
                      className="w-full h-full aspect-square object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#087F5B] text-white text-[10px] font-extrabold shadow-2xs">
                      💬 Sesli
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div
                      lang="ar"
                      dir="rtl"
                      className="arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.85] py-0.5"
                    >
                      {getDisplayArabic("الحِوَارَاتُ اليَوْمِيَّة")}
                    </div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] group-hover:text-[#087F5B] transition-colors leading-snug">
                      💬 Konuşma Diyalogları
                    </h2>
                    <p className="text-xs font-medium text-[var(--muted)] leading-relaxed line-clamp-3">
                      Gerçek hayat senaryoları, rol yapma modu, kelime-kelime
                      ses takibi ve odak gramer notları
                    </p>
                  </div>
                </div>

                {/* Dinamik İstatistik Metadatası */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[#065F46] dark:text-emerald-400">
                    {contentStats.dialogueCount} Diyalog
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[var(--foreground)]">
                    {contentStats.dialogueSentenceCount} Cümle
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/60 text-[#065F46] dark:text-emerald-300">
                    A1–B2 Kurları
                  </span>
                </div>

                {/* Kişisel İlerleme Çubuğu */}
                <div className="bg-white/85 dark:bg-[var(--background)] rounded-xl p-2.5 border border-[#E6D7BE] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-extrabold">
                    <span className="text-[var(--muted)]">
                      Kişisel İlerleme
                    </span>
                    <span className="text-[#065F46] dark:text-emerald-400 tabular-nums">
                      {completedDialogueCount} / {contentStats.dialogueCount}{" "}
                      Tamamlandı
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#E6D7BE]/60 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#087F5B] transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (completedDialogueCount /
                              Math.max(1, contentStats.dialogueCount)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSwitchSection("dialogues");
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center justify-between transition-all duration-200 shadow-2xs group-hover:shadow-md cursor-pointer"
                >
                  <span>💬 Diyalogları Keşfet</span>
                  <span className="bg-white/20 p-1 rounded-lg flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight size={15} />
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Okuma Metinleri Kartı */}
            <div
              onClick={() => handleSwitchSection("metinler")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSwitchSection("metinler");
                }
              }}
              className="group rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] hover:border-[#6741D9] p-4 flex flex-col justify-between gap-3.5 transition-all hover:-translate-y-0.5 cursor-pointer shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-2xl overflow-hidden shrink-0 border-2 border-[#E6D7BE] bg-white shadow-2xs flex items-center justify-center relative">
                    <img
                      src={
                        metinler[0]?.gorsel ||
                        getReadingTextCoverUrl("metin_01")
                      }
                      alt="Okuma Metinleri"
                      referrerPolicy="no-referrer"
                      className="w-full h-full aspect-square object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#6741D9] text-white text-[10px] font-extrabold shadow-2xs">
                      📖 Metin
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div
                      lang="ar"
                      dir="rtl"
                      className="arabic text-xl sm:text-2xl font-bold text-[#6741D9] dark:text-[#d0bfff] text-right leading-[1.85] py-0.5"
                    >
                      {getDisplayArabic("نُصُوصُ القِرَاءَة")}
                    </div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] group-hover:text-[#6741D9] transition-colors leading-snug">
                      📖 Okuma Metinleri
                    </h2>
                    <p className="text-xs font-medium text-[var(--muted)] leading-relaxed line-clamp-3">
                      Cümle ve paragraf görünümü, okuduğunu anlama soruları,
                      sesli takip ve odak gramer analizi
                    </p>
                  </div>
                </div>

                {/* Dinamik İstatistik Metadatası */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[#6741D9] dark:text-[#d0bfff]">
                    {contentStats.readingCount} Okuma Metni
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[var(--foreground)]">
                    {contentStats.readingQuestionCount} Anlama Sorusu
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-[#F3F0FF] dark:bg-indigo-950/60 text-[#6741D9] dark:text-indigo-200">
                    Paragraf & Cümle Modu
                  </span>
                </div>

                {/* Kişisel İlerleme Çubuğu */}
                <div className="bg-white/85 dark:bg-[var(--background)] rounded-xl p-2.5 border border-[#E6D7BE] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-extrabold">
                    <span className="text-[var(--muted)]">
                      Kişisel İlerleme
                    </span>
                    <span className="text-[#6741D9] dark:text-[#d0bfff] tabular-nums">
                      {completedReadingCount} / {contentStats.readingCount}{" "}
                      Tamamlandı
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#E6D7BE]/60 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#6741D9] transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (completedReadingCount /
                              Math.max(1, contentStats.readingCount)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSwitchSection("metinler");
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-between transition-all duration-200 shadow-2xs group-hover:shadow-md cursor-pointer"
                >
                  <span>📖 Metinleri Oku &amp; Dinle</span>
                  <span className="bg-white/20 p-1 rounded-lg flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight size={15} />
                  </span>
                </button>
              </div>
            </div>

            {/* 3. Görsel Kelime Kartları Kartı */}
            <div
              onClick={() => handleSwitchSection("gorsel-kelimeler")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSwitchSection("gorsel-kelimeler");
                }
              }}
              className="group rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] hover:border-[#087F5B] p-4 flex flex-col justify-between gap-3.5 transition-all hover:-translate-y-0.5 cursor-pointer shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-2xl overflow-hidden shrink-0 border-2 border-[#E6D7BE] bg-white shadow-2xs flex items-center justify-center relative">
                    <img
                      src={
                        gorselKelimeler[0]?.gorsel ||
                        getVisualWordCoverUrl(gorselKelimeler[0])
                      }
                      alt="Görsel Kelime Kartları"
                      referrerPolicy="no-referrer"
                      className="w-full h-full aspect-square object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#087F5B] text-white text-[10px] font-extrabold shadow-2xs">
                      🖼️ 1:1 Kare
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div
                      lang="ar"
                      dir="rtl"
                      className="arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.85] py-0.5"
                    >
                      {getDisplayArabic("المُفْرَدَاتُ المُصَوَّرَة")}
                    </div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] group-hover:text-[#087F5B] transition-colors leading-snug">
                      🖼️ Görsel Kelime Kartları
                    </h2>
                    <p className="text-xs font-medium text-[var(--muted)] leading-relaxed line-clamp-3">
                      Kare illüstrasyonlar, müfret-cemî/masdar çekimleri,
                      harekeli örnek cümleler ve çift cinsiyetli seslendirme
                    </p>
                  </div>
                </div>

                {/* Dinamik İstatistik Metadatası */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[#065F46] dark:text-emerald-400">
                    {contentStats.visualWordCount} Resimli Kelime
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[var(--foreground)]">
                    {contentStats.visualWordCategoryCount} Konu Kategorisi
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/60 text-[#065F46] dark:text-emerald-300">
                    Örnek Cümleli
                  </span>
                </div>

                {/* Örnek Görsel Kelime Önizleme Şeridi */}
                {gorselKelimeler[0] && (
                  <div className="bg-white/85 dark:bg-[var(--background)] rounded-xl px-3 py-2 border border-[#E6D7BE] flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[var(--foreground)] truncate">
                      Örn: {gorselKelimeler[0].turkce}
                    </span>
                    <span
                      dir="rtl"
                      lang="ar"
                      className="arabic font-arabic text-2xl font-bold text-emerald-950 dark:text-emerald-300 shrink-0 leading-none"
                    >
                      {getDisplayArabic(gorselKelimeler[0].arapca)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSwitchSection("gorsel-kelimeler");
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm flex items-center justify-between transition-all duration-200 shadow-2xs group-hover:shadow-md cursor-pointer"
                >
                  <span>🖼️ Görsel Kelimelere Git</span>
                  <span className="bg-white/20 p-1 rounded-lg flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight size={15} />
                  </span>
                </button>
              </div>
            </div>

            {/* 4. Günlük Kalıp Cümleler Kartı */}
            <div
              onClick={() => handleSwitchSection("cumleler")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSwitchSection("cumleler");
                }
              }}
              className="group rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] hover:border-[#087F5B] p-4 flex flex-col justify-between gap-3.5 transition-all hover:-translate-y-0.5 cursor-pointer shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-2xl overflow-hidden shrink-0 border-2 border-[#E6D7BE] bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-emerald-950/60 dark:via-slate-900 dark:to-indigo-950/50 shadow-2xs flex flex-col items-center justify-center p-2 text-center relative">
                    <span className="text-2xl mb-0.5">🗣️</span>
                    <span
                      dir="rtl"
                      className="arabic text-base sm:text-lg font-bold text-[#065F46] dark:text-emerald-300 leading-tight"
                    >
                      {getDisplayArabic("كَلَامٌ يَوْمِيّ")}
                    </span>
                    <span className="mt-1 px-1.5 py-0.5 rounded bg-[#087F5B] text-white text-[9px] font-extrabold">
                      E / K Sesli
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div
                      lang="ar"
                      dir="rtl"
                      className="arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.85] py-0.5"
                    >
                      {getDisplayArabic("الجُمَلُ اليَوْمِيَّة")}
                    </div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] group-hover:text-[#087F5B] transition-colors leading-snug">
                      🗣️ Günlük Kalıp Cümleler
                    </h2>
                    <p className="text-xs font-medium text-[var(--muted)] leading-relaxed line-clamp-3">
                      Günlük hayatta en çok kullanılan cümle kalıpları, gramer
                      yapısı etiketleri ve kadın/erkek stüdyo sesleri
                    </p>
                  </div>
                </div>

                {/* Dinamik İstatistik Metadatası */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[#065F46] dark:text-emerald-400">
                    {contentStats.sentenceCount} Kalıp Cümle
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[var(--foreground)]">
                    {contentStats.sentenceCategoryCount} Kategori
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300">
                    {contentStats.grammarNoteCount} Odak Gramer Notu
                  </span>
                </div>

                {cumleler1111[0] && (
                  <div className="bg-white/85 dark:bg-[var(--background)] rounded-xl px-3 py-2 border border-[#E6D7BE] flex flex-col gap-1">
                    <div
                      dir="rtl"
                      lang="ar"
                      className="arabic text-base font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.85] py-0.5"
                    >
                      {getDisplayArabic(cumleler1111[0].arapca)}
                    </div>
                    <span className="text-xs font-extrabold text-[var(--foreground)] leading-snug line-clamp-2">
                      “{cumleler1111[0].turkce}”
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSwitchSection("cumleler");
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#166534] hover:bg-[#14532d] text-white font-bold text-sm flex items-center justify-between transition-all duration-200 shadow-2xs group-hover:shadow-md cursor-pointer"
                >
                  <span>🗣️ Cümle Kalıplarını İncele</span>
                  <span className="bg-white/20 p-1 rounded-lg flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight size={15} />
                  </span>
                </button>
              </div>
            </div>

            {/* 5. Arapça Atasözleri & Hikmetler Kartı */}
            <div
              onClick={() => handleSwitchSection("atasozleri")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSwitchSection("atasozleri");
                }
              }}
              className="group rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] hover:border-amber-600 p-4 flex flex-col justify-between gap-3.5 transition-all hover:-translate-y-0.5 cursor-pointer shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-2xl overflow-hidden shrink-0 border-2 border-[#E6D7BE] bg-white shadow-2xs flex items-center justify-center relative">
                    <img
                      src={
                        atasozleri[0]?.gorsel ||
                        getProverbCoverUrl(atasozleri[0]?.id || "ata_001")
                      }
                      alt="Arapça Atasözleri & Hikmetler"
                      referrerPolicy="no-referrer"
                      className="w-full h-full aspect-square object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-amber-600 text-white text-[10px] font-extrabold shadow-2xs">
                      📜 Hikmet
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div
                      lang="ar"
                      dir="rtl"
                      className="arabic text-xl sm:text-2xl font-bold text-amber-800 dark:text-amber-300 text-right leading-[1.85] py-0.5"
                    >
                      {getDisplayArabic("الأَمْثَالُ وَالحِكَم")}
                    </div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors leading-snug">
                      📜 Arapça Atasözleri & Hikmetler
                    </h2>
                    <p className="text-xs font-medium text-[var(--muted)] leading-relaxed line-clamp-3">
                      Klasik ve modern Arap dünyasından seçkin atasözleri, lafzî
                      çevirileri, Türkçe karşılıkları ve kullanım bağlamları
                    </p>
                  </div>
                </div>

                {/* Dinamik İstatistik Metadatası */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-amber-800 dark:text-amber-300">
                    {contentStats.proverbCount} Atasözü
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[var(--foreground)]">
                    {contentStats.proverbCategoryCount} Tema
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300">
                    Lafzî & Bağlam Notlu
                  </span>
                </div>

                {atasozleri[0] && (
                  <div className="bg-white/85 dark:bg-[var(--background)] rounded-xl px-3 py-2 border border-[#E6D7BE] flex flex-col gap-1">
                    <div
                      dir="rtl"
                      lang="ar"
                      className="arabic text-base font-bold text-amber-800 dark:text-amber-300 text-right leading-[1.85] py-0.5"
                    >
                      {getDisplayArabic(atasozleri[0].arapca)}
                    </div>
                    <span className="text-xs font-extrabold text-[var(--foreground)] leading-snug line-clamp-2">
                      “{atasozleri[0].turkce}”
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSwitchSection("atasozleri");
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm flex items-center justify-between transition-all duration-200 shadow-2xs group-hover:shadow-md cursor-pointer"
                >
                  <span>📜 Atasözlerini Keşfet</span>
                  <span className="bg-white/20 p-1 rounded-lg flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight size={15} />
                  </span>
                </button>
              </div>
            </div>

            {/* 6. Çalışma Defterim & 38 Mahreç Rehberi İkili Hızlı Erişim Kartı */}
            <div className="rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                    ❤️ Çalışma Defterim & 🎯 38 Mahreç
                  </h2>
                  <span
                    lang="ar"
                    dir="rtl"
                    className="arabic text-lg font-bold text-[#6741D9] dark:text-[#d0bfff]"
                  >
                    {getDisplayArabic("دَفْتَرِي وَالمَخَارِج")}
                  </span>
                </div>

                <p className="text-xs font-medium text-[var(--muted)] leading-snug">
                  Kaydettiğiniz kelime, cümle ve atasözlerini tek yerden yönetin
                  veya 38 mahreç çiftinde zorlandığınız kelimeleri tekrar edin.
                </p>

                {/* Alt Araç 1: Kişisel Çalışma Defterim */}
                <button
                  type="button"
                  onClick={() => handleSwitchSection("saved-words")}
                  className="w-full text-left p-3 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] hover:border-rose-400 flex items-center justify-between gap-2.5 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 flex items-center justify-center shrink-0">
                      <Heart size={18} fill="currentColor" />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs sm:text-sm font-extrabold text-[var(--foreground)] group-hover:text-rose-600 truncate">
                        Defterim ({mounted ? favoriteWords.length : 0})
                      </span>
                      <span className="block text-[11px] font-semibold text-[var(--muted)] truncate">
                        Kaydedilen kelime, cümle, atasözü & PDF çıktı
                      </span>
                    </div>
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-rose-600 shrink-0 group-hover:translate-x-0.5 transition-transform"
                  />
                </button>

                {/* Alt Araç 2: 38 Mahreç Rehberi & Telaffuz Tekrarım */}
                <button
                  type="button"
                  onClick={() => handleSwitchSection("weak-words")}
                  className="w-full text-left p-3 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] flex items-center justify-between gap-2.5 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/60 border border-[#6741D9]/30 text-[#6741D9] dark:text-indigo-300 flex items-center justify-center shrink-0">
                      <Mic size={18} />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs sm:text-sm font-extrabold text-[var(--foreground)] group-hover:text-[#6741D9] truncate">
                        38 Mahreç Çifti &amp; Telaffuz Tekrarım (
                        {mounted ? weakWords.length : 0})
                      </span>
                      <span className="block text-[11px] font-semibold text-[var(--muted)] truncate">
                        Telaffuz ve gölgelemede tekrar edilecek kelimeler
                      </span>
                    </div>
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-[#6741D9] shrink-0 group-hover:translate-x-0.5 transition-transform"
                  />
                </button>
              </div>

              <div className="pt-2 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] grid grid-cols-2 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => handleSwitchSection("saved-words")}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border-b-3 border-rose-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <span>❤️ Defterimi Aç →</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchSection("weak-words")}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white border-b-3 border-[#5230B5] font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <span>🎯 Mahreç Rehberi →</span>
                </button>
              </div>
            </div>
          </div>

          {/* 7. Gramer Atlası & Ders Notları Vitrin Kartı (Tam Genişlik Vurgulu) */}
          <div
            onClick={() => handleSwitchSection("gramer")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSwitchSection("gramer");
              }
            }}
            className="group rounded-2xl border-2 border-amber-300 dark:border-amber-700/80 border-b-4 bg-gradient-to-r from-[#F7EFE1] via-amber-50/70 to-[#F7EFE1] dark:from-[var(--surface)] dark:via-amber-950/30 dark:to-[var(--surface)] hover:border-[#087F5B] p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 transition-all hover:-translate-y-0.5 cursor-pointer shadow-xs"
          >
            <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-100 dark:bg-amber-950/80 border-2 border-amber-400 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                <span className="text-2xl">📌</span>
                <span className="text-[10px] font-black text-amber-900 dark:text-amber-200 uppercase mt-0.5">
                  {contentStats.grammarNoteCount} Not
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-[var(--foreground)] group-hover:text-[#087F5B] transition-colors">
                    📌 Arapça Gramer Atlası &amp; Odak Hap Bilgiler
                  </h2>
                  <span
                    lang="ar"
                    dir="rtl"
                    className="arabic text-lg font-bold text-[#065F46] dark:text-emerald-400"
                  >
                    {getDisplayArabic("أَطْلَسُ القَوَاعِدِ النَّحْوِيَّة")}
                  </span>
                </div>
                <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                  A1–B2 kurlarındaki toplam{" "}
                  <strong>{contentStats.grammarNoteCount} odak gramer kartını</strong>{" "}
                  4 dil bilimsel alanda (İsimler &amp; Zamirler, Nahiv, Sarf, Üslûplar) görsel formül şemaları, özet tablolar, kelime kelime i&apos;rab analizleri ve A4 PDF ders föyleriyle keşfedin.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] font-extrabold">
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-amber-300 text-amber-900 dark:text-amber-200">
                    {contentStats.grammarNoteCount} Odak Gramer Kartı
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-amber-300 text-amber-900 dark:text-amber-200">
                    4 Dil Bilimsel Alan • A4 PDF Föy &amp; Kitapçık
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[#065F46] dark:text-emerald-400">
                    {contentStats.sentenceCount} Kalıp Cümle Eşleşmesi
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-[#087F5B] text-white">
                    <span className="hidden lg:inline">
                      Yan Panel &amp; Akıllı Tahta Uyumlu
                    </span>
                    <span className="lg:hidden">
                      Görsel Şema &amp; İ&apos;rab Çözümlemeli
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-auto flex items-center gap-2 lg:self-center shrink-0">
              <span className="w-full lg:w-auto py-2.5 px-4 rounded-xl bg-[#087F5B] group-hover:bg-[#065F46] text-white border-b-3 border-[#065F46] text-xs sm:text-sm font-black inline-flex items-center justify-between lg:justify-center gap-1.5 shadow-xs transition-colors">
                <span>📌 Gramer Atlasını Aç</span>
                <ArrowRight size={15} className="shrink-0" />
              </span>
            </div>
          </div>

          {/* 8. Arapça Video & İzleme Rehberi Vitrin Kartı (Tam Genişlik Vurgulu) */}
          <div
            onClick={() => handleSwitchSection("videolar")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSwitchSection("videolar");
              }
            }}
            className="group rounded-2xl border-2 border-rose-300 dark:border-rose-800/80 border-b-4 bg-gradient-to-r from-[#F7EFE1] via-rose-50/65 to-[#F7EFE1] dark:from-[var(--surface)] dark:via-rose-950/30 dark:to-[var(--surface)] hover:border-rose-600 p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 transition-all hover:-translate-y-0.5 cursor-pointer shadow-xs"
          >
            <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-rose-100 dark:bg-rose-950/80 border-2 border-rose-400 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                <span className="text-2xl">🎬</span>
                <span className="text-[10px] font-black text-rose-900 dark:text-rose-200 uppercase mt-0.5">
                  {contentStats.youtubeCount} Kaynak
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-[var(--foreground)] group-hover:text-rose-600 transition-colors">
                    🎬 Seviyeli Arapça Video &amp; İzleme Rehberi
                  </h2>
                  <span
                    lang="ar"
                    dir="rtl"
                    className="arabic text-lg font-bold text-[#065F46] dark:text-emerald-400"
                  >
                    {getDisplayArabic("دَلِيلُ الْمُشَاهَدَةِ وَالِاسْتِمَاعِ")}
                  </span>
                </div>
                <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                  A1–B2 seviyelerine göre seçilmiş{" "}
                  <strong>{contentStats.youtubeCount} video ve oynatma listesini</strong>{" "}
                  (çizgi diziler, kıssalar, tarihî diziler, ilmî dersler ve Al Jazeera/BBC belgeselleri) sıfır gecikmeli uygulama içi oynatıcı ve izleme metodolojisiyle keşfedin.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] font-extrabold">
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-rose-300 text-rose-900 dark:text-rose-200">
                    6 Tematik Kategori • A1–B2
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[#065F46] dark:text-emerald-400">
                    {EXTERNAL_WATCH_PLATFORM_GROUPS.reduce(
                      (sum, g) => sum + g.platforms.length,
                      0
                    )}{" "}
                    Harici Arşiv Platformu
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white">
                    İzlenen: {youtubeCounts.totalWatchedAll} / {contentStats.youtubeCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-auto flex items-center gap-2 lg:self-center shrink-0">
              <span className="w-full lg:w-auto py-2.5 px-4 rounded-xl bg-rose-600 group-hover:bg-rose-700 text-white border-b-3 border-rose-800 text-xs sm:text-sm font-black inline-flex items-center justify-between lg:justify-center gap-1.5 shadow-xs transition-colors">
                <span>🎬 İzleme Rehberini Aç</span>
                <ArrowRight size={15} className="shrink-0" />
              </span>
            </div>
          </div>

          {/* 9. Eş & Zıt Anlamlılar (المرادفات والأضداد) Vitrin Kartı */}
          <div
            onClick={() => handleSwitchSection("es-zit")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSwitchSection("es-zit");
              }
            }}
            className="group rounded-2xl border-2 border-emerald-400/80 dark:border-emerald-800/80 border-b-4 bg-gradient-to-r from-[#F7EFE1] via-emerald-50/75 to-amber-50/55 dark:from-[var(--surface)] dark:via-emerald-950/30 dark:to-amber-950/20 hover:border-[#087F5B] p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 transition-all hover:-translate-y-0.5 cursor-pointer shadow-xs"
          >
            <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border-2 border-emerald-500 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                <span className="text-2xl">🔄</span>
                <span className="text-[10px] font-black text-emerald-900 dark:text-emerald-200 uppercase mt-0.5">
                  {contentStats.synonymsAntonymsCount} Madde
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-[var(--foreground)] group-hover:text-[#087F5B] transition-colors">
                    🔄 Eş &amp; Zıt Anlamlılar Atlası
                  </h2>
                  <span
                    lang="ar"
                    dir="rtl"
                    className="arabic text-lg font-bold text-[#065F46] dark:text-emerald-400"
                  >
                    {getDisplayArabic("الْمُرَادِفَاتُ وَالْأَضْدَادُ")}
                  </span>
                </div>
                <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                  İsim, fiil, sıfat ve zarf türlerinde{" "}
                  <strong>{contentStats.synonymsAntonymsCount} ana madde</strong>{" "}
                  ve <strong>1.800+ harekeli kelimeyi</strong> ince anlam farkları (
                  <span lang="ar" dir="rtl" className="arabic font-bold">
                    الْفُرُوقُ اللُّغَوِيَّةُ
                  </span>
                  ), zıt kavramlar ve sesli karşılaştırmalı örnek cümlelerle öğrenin.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] font-extrabold">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white">
                    المرادفات • İnce Anlam Nüansları
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white">
                    الأضداد • Zıt Kavramlar
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[#065F46] dark:text-emerald-400">
                    İsim • Fiil • Sıfat • Zarf (A1–B2)
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-auto flex items-center gap-2 lg:self-center shrink-0">
              <span className="w-full lg:w-auto py-2.5 px-4 rounded-xl bg-[#087F5B] group-hover:bg-[#065F46] text-white border-b-3 border-[#065F46] text-xs sm:text-sm font-black inline-flex items-center justify-between lg:justify-center gap-1.5 shadow-xs transition-colors">
                <span>🔄 Eş &amp; Zıt Anlamlıları Aç</span>
                <ArrowRight size={15} className="shrink-0" />
              </span>
            </div>
          </div>

          {/* Alt Hızlı Aksiyon Şeridi (Vitrin Alt Barı) */}
          <div className="rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-[#087F5B] text-white text-[11px] font-extrabold">
                  📊 Toplam Kütüphane Özeti
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
                  {contentStats.dialogueCount} Diyalog •{" "}
                  {contentStats.readingCount} Metin •{" "}
                  {contentStats.totalLibraryCards.toLocaleString("tr-TR")} Eğitim
                  Kartı
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-[var(--muted)]">
                {contentStats.dialogueSentenceCount} diyalog cümlesi,{" "}
                {contentStats.readingQuestionCount} okuma anlama sorusu,{" "}
                {contentStats.sentenceCount} günlük kalıp cümle,{" "}
                {contentStats.proverbCount} atasözü ve{" "}
                {contentStats.visualWordCount} resimli kelime kartı
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/alistirmalar"
                onClick={() => playClick()}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-3 border-[#065F46] text-xs font-extrabold transition-all whitespace-nowrap"
              >
                <Gamepad2 size={15} />
                <span>Kütüphane Havuzuyla Alıştırma Yap</span>
              </Link>

              <Link
                href="/sozluk"
                onClick={() => playClick()}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white border-b-3 border-[#5230B5] text-xs font-extrabold transition-all whitespace-nowrap"
              >
                <BookOpen size={15} />
                <span>
                  İnteraktif Kök Sözlüğü (
                  {contentStats.dictionaryWordCount.toLocaleString("tr-TR")}{" "}
                  Kelime)
                </span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ORTAK ARAMA VE SEVİYE / DURUM FİLTRE ÇUBUĞU */}
      {activeSection !== "vitrin" &&
        activeSection !== "videolar" &&
        activeSection !== "saved-words" &&
        activeSection !== "weak-words" && (
        <section className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-2 sm:p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisibleCount(36);
                }}
                placeholder="Başlık, kelime veya konu ara..."
                className="w-full h-9 bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] rounded-xl pl-8 pr-8 text-xs font-semibold text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#087F5B]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                  aria-label="Aramayı Temizle"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                playClick();
                setMobileFiltersOpen((v) => !v);
              }}
              className={`sm:hidden h-9 px-3 rounded-xl border-2 border-b-3 text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
                mobileFiltersOpen || hasActiveFilter
                  ? "bg-[#6741D9] border-[#5230B5] text-white"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Filtreler</span>
            </button>

            <div className="hidden sm:flex bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] items-center gap-1 shrink-0">
              {(["all", "A1", "A2", "B1", "B2"] as (Level | "all")[]).map(
                (lvl) => {
                  const active = levelFilter === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        playClick();
                        setLevelFilter(lvl);
                        setVisibleCount(36);
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                        active
                          ? "bg-[#087F5B] text-white font-semibold shadow-2xs"
                          : "text-[var(--muted)] font-medium hover:text-[var(--foreground)]"
                      }`}
                    >
                      {lvl === "all" ? "Tüm Kurlar" : lvl}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Alt Durum veya Tema/Kategori Filtre Şeridi */}
          {(activeSection === "dialogues" || activeSection === "metinler") && (
            <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap items-center gap-1.5 py-0.5">
              {(
                [
                  {
                    id: "all",
                    label: `Tümü (${
                      activeSection === "dialogues"
                        ? diyaloglar.length
                        : metinler.length
                    })`,
                  },
                  {
                    id: "completed",
                    label: "Tamamlananlar",
                  },
                  {
                    id: "ongoing",
                    label: "Devam Edenler",
                  },
                  {
                    id: "favorites",
                    label: "Favoriler",
                  },
                ] as { id: StatusFilter; label: string }[]
              ).map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setStatusFilter(tab.id);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? "bg-[#087F5B] border-[#065F46] text-white font-bold shadow-2xs"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] font-medium hover:text-[var(--foreground)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Gramer Atlası Dil Bilimsel Alan Sekmeleri (Seçenek A: 4 Temel Alan) + Toplu PDF Kitapçık Butonu */}
          {activeSection === "gramer" && (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pt-0.5">
              <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap items-center gap-1.5 py-0.5">
                {(
                  [
                    {
                      id: "all" as GrammarDomainFilter,
                      label: `Tümü (${grammarDomainCounts.all})`,
                    },
                    ...GRAMMAR_DOMAIN_ORDER.map((domId) => ({
                      id: domId as GrammarDomainFilter,
                      label: `${GRAMMAR_DOMAINS[domId].tabLabel} (${grammarDomainCounts[domId]})`,
                    })),
                  ]
                ).map((tab) => {
                  const active = grammarDomainFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        playClick();
                        setGrammarDomainFilter(tab.id);
                        setVisibleCount(36);
                      }}
                      className={`px-3 py-1.5 text-xs rounded-xl border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? "bg-[#087F5B] border-[#065F46] text-white font-extrabold shadow-2xs"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={filteredGrammarAtlasItems.length === 0}
                onClick={() => {
                  playClick();
                  printGrammarBookletPdf(
                    filteredGrammarAtlasItems.map((i) => i.rawNote),
                    {
                      levelFilter,
                      domainFilter: grammarDomainFilter,
                      searchQuery: search,
                    }
                  );
                }}
                className="min-h-[38px] w-full lg:w-auto px-3.5 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] disabled:opacity-50 text-white border-b-3 border-[#4C28B5] text-xs font-black inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all shadow-xs"
              >
                <FileText size={14} className="shrink-0" />
                <span>
                  📑 Kur Kitapçığı İndir (PDF) •{" "}
                  {filteredGrammarAtlasItems.length} Konu
                </span>
              </button>
            </div>
          )}

          {/* Eş & Zıt Anlamlılar Kelime Türü Sekmeleri + Alıştırma Kısayolu */}
          {activeSection === "es-zit" && (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pt-0.5">
              <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap items-center gap-1.5 py-0.5">
                {(
                  [
                    {
                      id: "all" as SynonymAntonymWordTur | "all",
                      label: `Tümü (${synonymTurCounts.all})`,
                    },
                    {
                      id: "isim" as SynonymAntonymWordTur,
                      label: `📘 İsim (${synonymTurCounts.isim})`,
                    },
                    {
                      id: "fiil" as SynonymAntonymWordTur,
                      label: `⚡ Fiil (${synonymTurCounts.fiil})`,
                    },
                    {
                      id: "sifat" as SynonymAntonymWordTur,
                      label: `🎨 Sıfat (${synonymTurCounts.sifat})`,
                    },
                    {
                      id: "zarf" as SynonymAntonymWordTur,
                      label: `⏱️ Zarf (${synonymTurCounts.zarf})`,
                    },
                  ]
                ).map((tab) => {
                  const active = synTurFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        playClick();
                        setSynTurFilter(tab.id);
                        setVisibleCount(36);
                      }}
                      className={`px-3 py-1.5 text-xs rounded-xl border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? "bg-[#087F5B] border-[#065F46] text-white font-extrabold shadow-2xs"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <Link
                href={`/alistirmalar?pool=synonyms_antonyms${
                  levelFilter !== "all" ? `&level=${levelFilter}` : ""
                }${synTurFilter !== "all" ? `&tur=${synTurFilter}` : ""}`}
                onClick={() => playClick()}
                className="min-h-[38px] w-full lg:w-auto px-3.5 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white border-b-3 border-[#4C28B5] text-xs font-black inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all shadow-xs"
              >
                <Gamepad2 size={14} className="shrink-0" />
                <span>
                  🎯 Eş &amp; Zıt Anlam Alıştırması Çöz ({filteredSynonymsAntonyms.length} Kayıt)
                </span>
              </Link>
            </div>
          )}

          {/* 1111 Cümle / Atasözleri / Görsel Kelimeler Açılır Çok Sütunlu Kategori Seçici (Category Bento Grid) */}
          {(activeSection === "cumleler" ||
            activeSection === "atasozleri" ||
            activeSection === "gorsel-kelimeler") &&
            (() => {
              const activeCategoryList =
                activeSection === "cumleler"
                  ? cumleThemes
                  : activeSection === "atasozleri"
                  ? proverbThemes
                  : visualCategories;

              return (
                <div className="space-y-2 pt-0.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] truncate">
                        <FolderOpen
                          size={14}
                          className="text-[#6741D9] shrink-0"
                        />
                        <span className="truncate">
                          Kategori:{" "}
                          <strong className="text-[#6741D9] dark:text-indigo-300">
                            {categoryFilter === "all"
                              ? "Tüm Kategoriler"
                              : formatTurkishCategory(categoryFilter)}
                          </strong>
                        </span>
                      </span>

                      {categoryFilter !== "all" && (
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            setCategoryFilter("all");
                            setVisualSubSetFilter("all");
                            setSelectedCardIndex(null);
                            setVisibleCount(36);
                          }}
                          className="min-h-[36px] px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 text-rose-700 dark:text-rose-300 text-xs font-extrabold flex items-center gap-1 cursor-pointer hover:bg-rose-100"
                        >
                          <X size={13} />
                          <span>Tümü</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setIsCategoryPanelOpen((prev) => !prev);
                      }}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border-2 border-b-3 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                        isCategoryPanelOpen || categoryFilter !== "all"
                          ? "bg-[#6741D9] border-[#5230B5] text-white"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#6741D9]"
                      }`}
                    >
                      <span>
                        🗂️ Kategori Seç ({activeCategoryList.length})
                      </span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${
                          isCategoryPanelOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>

                  {isCategoryPanelOpen && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-72 sm:max-h-none overflow-y-auto sm:overflow-visible p-3 bg-white dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-inner">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setCategoryFilter("all");
                          setVisualSubSetFilter("all");
                          setSelectedCardIndex(null);
                          setVisibleCount(36);
                          setIsCategoryPanelOpen(false);
                        }}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center justify-between gap-1.5 text-left transition-all cursor-pointer ${
                          categoryFilter === "all"
                            ? "bg-[#6741D9] border-[#5230B5] text-white shadow-2xs"
                            : "bg-[#F7EFE1]/70 dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#6741D9]"
                        }`}
                      >
                        <span className="truncate">Tüm Kategoriler</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums shrink-0 ${
                            categoryFilter === "all"
                              ? "bg-white/20 text-white"
                              : "bg-white dark:bg-[var(--background)] text-[#6741D9]"
                          }`}
                        >
                          {Object.values(categoryCountsMap).reduce(
                            (a, b) => a + b,
                            0
                          )}
                        </span>
                      </button>

                      {activeCategoryList.map((cat) => {
                        const active = categoryFilter === cat;
                        const count = categoryCountsMap[cat] || 0;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              playClick();
                              setCategoryFilter(cat);
                              setVisualSubSetFilter("all");
                              setSelectedCardIndex(null);
                              setVisibleCount(36);
                              setIsCategoryPanelOpen(false);
                            }}
                            className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-1.5 text-left transition-all cursor-pointer ${
                              active
                                ? "bg-[#6741D9] border-[#5230B5] text-white font-extrabold shadow-2xs"
                                : "bg-[#F7EFE1]/50 dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#6741D9]"
                            }`}
                          >
                            <span className="line-clamp-2 leading-tight">
                              {formatTurkishCategory(cat)}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums shrink-0 ${
                                active
                                  ? "bg-white/20 text-white"
                                  : "bg-white dark:bg-[var(--background)] text-[var(--muted)]"
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Görsel Kelimeler Seçili Ana Kategori İçin 9'lu Alt Set (Alt Grup) Seçicisi */}
                  {activeSection === "gorsel-kelimeler" &&
                    categoryFilter !== "all" &&
                    availableVisualSubSets.sets.length > 1 && (
                      <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap sm:flex-wrap items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/85 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)]">
                        <span className="text-[11px] font-extrabold text-[var(--muted)] mr-1 shrink-0">
                          Alt Set (9’lu Grup):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            setVisualSubSetFilter("all");
                            setSelectedCardIndex(null);
                            setVisibleCount(36);
                          }}
                          className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            visualSubSetFilter === "all"
                              ? "bg-[#087F5B] text-white shadow-2xs"
                              : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[var(--foreground)] hover:border-[#087F5B] border border-[#E6D7BE]"
                          }`}
                        >
                          Tümü ({availableVisualSubSets.totalInMainCat})
                        </button>
                        {availableVisualSubSets.sets.map((sub) => {
                          const active = visualSubSetFilter === sub.setNo;
                          return (
                            <button
                              key={sub.setNo}
                              type="button"
                              onClick={() => {
                                playClick();
                                setVisualSubSetFilter(sub.setNo);
                                setSelectedCardIndex(null);
                                setVisibleCount(36);
                              }}
                              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer tabular-nums ${
                                active
                                  ? "bg-[#087F5B] text-white shadow-2xs"
                                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[var(--foreground)] hover:border-[#087F5B] border border-[#E6D7BE]"
                              }`}
                            >
                              {sub.setNo}. Set ({sub.count})
                            </button>
                          );
                        })}
                      </div>
                    )}

                  {/* Toplu Arapça / Türkçe / Hareke Görünürlük Kontrolleri */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleBulkArabic}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                          showArabic
                            ? "bg-[#087F5B] border-[#065F46] text-white shadow-2xs"
                            : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {showArabic ? <Eye size={13} /> : <EyeOff size={13} />}
                        <span>
                          Arapça: {showArabic ? "Açık" : "Kapalı"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={toggleBulkTurkish}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                          showTurkish
                            ? "bg-[#6741D9] border-[#5230B5] text-white shadow-2xs"
                            : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {showTurkish ? (
                          <Eye size={13} />
                        ) : (
                          <EyeOff size={13} />
                        )}
                        <span>
                          Türkçe: {showTurkish ? "Açık" : "Kapalı"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          cycleHarekeMode();
                        }}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                          activeHarekeMode === "full"
                            ? "bg-amber-100 dark:bg-amber-950/70 border-amber-400 text-amber-900 dark:text-amber-200"
                            : activeHarekeMode === "irab-only"
                              ? "bg-emerald-100 dark:bg-emerald-950/70 border-emerald-400 text-emerald-900 dark:text-emerald-200"
                              : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        <Sparkles size={13} />
                        <span>
                          Hareke:{" "}
                          {activeHarekeMode === "full"
                            ? "Tam"
                            : activeHarekeMode === "irab-only"
                              ? "İ'rab"
                              : "Kapalı"}
                        </span>
                      </button>
                    </div>

                    {!showArabic && !showTurkish && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/70 border border-amber-300 text-amber-900 dark:text-amber-200 text-[11px] font-extrabold">
                        🎧 Kör Dinleme Modu Aktif
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

          {mobileFiltersOpen && (
            <div className="sm:hidden pt-1.5 border-t border-dashed border-[#E2D3B8] flex items-center justify-between gap-2">
              <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap items-center gap-1 py-0.5 min-w-0 flex-1">
                <span className="text-[11px] font-extrabold text-[var(--muted)] mr-1 shrink-0">
                  Seviye:
                </span>
                {(["all", "A1", "A2", "B1", "B2"] as (Level | "all")[]).map(
                  (lvl) => {
                    const active = levelFilter === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => {
                          playClick();
                          setLevelFilter(lvl);
                        }}
                        className={`shrink-0 px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer ${
                          active
                            ? "bg-[#6741D9] border-[#5230B5] text-white font-bold"
                            : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)] font-semibold"
                        }`}
                      >
                        {lvl === "all" ? "Tümü" : lvl}
                      </button>
                    );
                  }
                )}
              </div>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setStatusFilter("all");
                    setLevelFilter("all");
                    setCategoryFilter("all");
                  }}
                  className="text-[11px] font-bold text-rose-600 underline"
                >
                  Sıfırla
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* 1. SEKME: 120 DİYALOG */}
      {activeSection === "dialogues" && (
        <>
          {filteredDialogues.length === 0 ? (
            <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-10 text-center space-y-3">
              <p className="text-base font-extrabold text-[var(--foreground)]">
                Aradığınız kriterlere uygun diyalog bulunamadı.
              </p>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setSearch("");
                  setStatusFilter("all");
                  setLevelFilter("all");
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-bold border-b-4 border-[#065F46]"
              >
                Filtreleri Sıfırla
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDialogues.map((dlg) => {
                const dlgNo = String(
                  dlg.sira || parseInt(dlg.id.replace("dlg_", ""), 10) || 1
                ).padStart(2, "0");
                const imagePath = dlg.gorsel || getDialogueCoverUrl(dlg.id);
                const wordCount = extractDialogueVocabulary(
                  dlg.satirlar.map((s) => s.arapca)
                ).length;
                const readTime = Math.max(
                  1,
                  Math.ceil(dlg.satirlar.length * 0.5)
                );
                const isComp = mounted && completedDialogues.includes(dlg.id);
                const isFav = mounted && favoriteDialogues.includes(dlg.id);

                return (
                  <div
                    key={dlg.id}
                    className={`rounded-2xl border-2 border-b-4 overflow-hidden flex flex-col justify-between transition-all hover:-translate-y-0.5 ${
                      isComp
                        ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9]"
                        : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)]"
                    }`}
                  >
                    <Link
                      href={`/diyalog/${dlg.id}`}
                      onClick={() => playClick()}
                      className="flex items-start gap-3.5 p-3.5 pb-2.5 group"
                    >
                      <div className="relative w-28 h-28 sm:w-32 sm:h-32 aspect-square rounded-2xl overflow-hidden shrink-0 border-2 border-[#E6D7BE] bg-white shadow-2xs">
                        <img
                          src={imagePath}
                          alt={dlg.baslik_tr}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute top-1 left-1 flex items-center gap-0.5">
                          <span className="bg-white/95 text-[#2b241d] font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-[#E6D7BE] tabular-nums shadow-2xs leading-none">
                            #{dlgNo}
                          </span>
                          <span className="bg-[#087F5B] text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-md shadow-2xs leading-none">
                            {dlg.seviye}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 flex flex-col justify-between space-y-1.5">
                        <div className="space-y-1">
                          {isComp && (
                            <span className="inline-flex items-center gap-1 bg-[#6741D9] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs">
                              <CheckCircle2 size={11} />
                              <span>Tamamlandı</span>
                            </span>
                          )}
                          <div
                            lang="ar"
                            dir="rtl"
                            className="arabic text-[#065F46] dark:text-emerald-400 text-lg sm:text-xl font-bold leading-[1.85] py-0.5 text-right line-clamp-2"
                          >
                            {getDisplayArabic(dlg.baslik_ar)}
                          </div>
                          <div
                            dir="ltr"
                            className="text-[var(--foreground)] group-hover:text-[#087F5B] text-xs sm:text-sm font-extrabold leading-snug text-left line-clamp-2 transition-colors"
                          >
                            {dlg.baslik_tr}
                          </div>
                        </div>

                        {dlg.odak_gramer && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              playClick();
                              setActiveGrammarModal({
                                dialogueId: dlg.id,
                                grammarTopic: dlg.odak_gramer,
                              });
                            }}
                            title="Bu gramer kuralını ve örneklerini bağımsız pencerede açmak için tıklayın"
                            dir="ltr"
                            className="w-full text-left text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100/80 hover:bg-amber-200/90 dark:bg-amber-950/50 dark:hover:bg-amber-900/70 border border-amber-300 hover:border-amber-500 dark:border-amber-700 rounded-lg px-2 py-1 line-clamp-2 leading-snug cursor-pointer transition-colors"
                          >
                            <span className="mr-1">📌</span>
                            <MixedText text={dlg.odak_gramer} />
                          </button>
                        )}
                      </div>
                    </Link>

                    <div className="px-3.5 pb-3.5 pt-1 flex-1 flex flex-col justify-between space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-[var(--muted)] font-semibold border-y border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] py-2">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <BookOpen
                            size={13}
                            className="text-[#065F46] dark:text-emerald-400"
                          />
                          {dlg.satirlar.length} Cümle · {wordCount} Kelime
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock size={13} />
                          {readTime} dk
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            toggleFavoriteDialogue(dlg.id);
                          }}
                          title={
                            isFav ? "Favorilerden Çıkar" : "Favorilere Ekle"
                          }
                          className={`h-9 w-9 rounded-xl border-2 border-b-3 flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                            isFav
                              ? "bg-red-50 border-red-300 text-red-600"
                              : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-red-500"
                          }`}
                        >
                          <Heart
                            size={15}
                            fill={isFav ? "currentColor" : "none"}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            toggleCompletedDialogue(dlg.id);
                          }}
                          className={`h-9 px-2.5 rounded-xl border-2 border-b-3 text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                            isComp
                              ? "bg-[#6741D9] border-[#5230B5] text-white"
                              : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[#065F46]"
                          }`}
                        >
                          <CheckCircle2 size={14} />
                          <span className="hidden xl:inline">
                            {isComp ? "Bitti" : "Bitir"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            setShareCardTarget({
                              type: "dialogue",
                              arabicText:
                                dlg.satirlar[0]?.arapca || dlg.baslik_ar,
                              titleAr: dlg.baslik_ar,
                              titleTr: dlg.baslik_tr,
                              turkishText:
                                dlg.satirlar[0]?.turkce || dlg.baslik_tr,
                              excerptLines: dlg.satirlar
                                .slice(0, 3)
                                .map((l) => ({
                                  speakerAr: l.konusmaci_ar,
                                  speakerTr: l.konusmaci,
                                  arapca: l.arapca,
                                  turkce: l.turkce,
                                })),
                              level: dlg.seviye,
                              category: dlg.tema,
                              imageUrl: imagePath,
                              deepLink: `https://app.muallimun.net/diyalog/${dlg.id}`,
                            });
                          }}
                          title="Diyaloğu Görsel Kart Olarak Paylaş"
                          className="h-9 w-9 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] border-b-3 text-[#065F46] dark:text-emerald-400 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                        >
                          <Share2 size={14} />
                        </button>

                        <Link
                          href={`/alistirmalar?pool=all_dialogues&dialogueId=${dlg.id}`}
                          onClick={() => playClick()}
                          title="Bu Diyalogla Alıştırma Yap"
                          className="h-9 px-2.5 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/70 border-2 border-[#6741D9] border-b-3 text-xs font-extrabold text-[#6741D9] dark:text-indigo-200 flex items-center justify-center gap-1 shrink-0"
                        >
                          <Gamepad2 size={14} />
                          <span className="hidden sm:inline">Alıştırma</span>
                        </Link>

                        <Link
                          href={`/diyalog/${dlg.id}`}
                          onClick={() => playClick()}
                          className="flex-1 h-9 px-3 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-bold text-xs border-b-3 border-[#065F46] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5"
                        >
                          <span>Diyaloğu Aç</span>
                          <ArrowRight size={14} />
                        </Link>
                      </div>

                      {(() => {
                        const isOffline = offlineIds.includes(dlg.id);
                        const isDownloadingThis = downloadingId === dlg.id;
                        const audioCount = dlg.satirlar.length;
                        const estMb = Math.max(
                          0.4,
                          Number(((audioCount * 145) / 1024).toFixed(1))
                        );
                        return (
                          <div className="pt-1 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                            <button
                              type="button"
                              disabled={Boolean(downloadingId) && !isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  void handleDownloadDialogueCardOffline(dlg.id);
                                }
                              }}
                              className={`w-full py-1.5 px-2.5 rounded-xl border text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                isOffline
                                  ? "bg-[#087F5B] border-[#065F46] text-white"
                                  : isDownloadingThis
                                  ? "bg-amber-100 border-amber-400 text-amber-900"
                                  : "bg-white/90 dark:bg-[var(--background)] border-[#E6D7BE] hover:border-[#087F5B] text-slate-700 dark:text-slate-200"
                              }`}
                            >
                              {isOffline ? (
                                <span>✅ Çevrimdışı Hazır (~{estMb} MB)</span>
                              ) : isDownloadingThis ? (
                                <>
                                  <Download size={12} className="animate-bounce" />
                                  <span>
                                    İndiriliyor %{downloadingPct} (~{estMb} MB)
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Download size={12} className="text-[#065F46]" />
                                  <span>📥 Çevrimdışı İndir (~{estMb} MB)</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 2. SEKME: 60 OKUMA METNİ */}
      {activeSection === "metinler" && (
        <>
          {filteredTexts.length === 0 ? (
            <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] border-b-4 p-10 text-center space-y-3">
              <p className="text-base font-extrabold text-[var(--foreground)]">
                Aradığınız kriterlere uygun okuma metni bulunamadı.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTexts.map((txt) => {
                const txtNo = txt.id.replace("metin_", "");
                const imagePath = txt.gorsel || getReadingTextCoverUrl(txt.id);
                const isComp = mounted && completedDialogues.includes(txt.id);
                const isFav = mounted && favoriteDialogues.includes(txt.id);

                return (
                  <div
                    key={txt.id}
                    className={`rounded-2xl border-2 border-b-4 overflow-hidden flex flex-col justify-between transition-all hover:-translate-y-0.5 ${
                      isComp
                        ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9]"
                        : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)]"
                    }`}
                  >
                    <Link
                      href={`/metin/${txt.id}`}
                      onClick={() => playClick()}
                      className="flex items-start gap-3.5 p-3.5 pb-2.5 group"
                    >
                      <div className="relative w-28 h-28 sm:w-32 sm:h-32 aspect-square rounded-2xl overflow-hidden shrink-0 border-2 border-[#E6D7BE] bg-white shadow-2xs">
                        <img
                          src={imagePath}
                          alt={txt.baslik_tr}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute top-1 left-1 flex items-center gap-0.5">
                          <span className="bg-white/95 text-[#2b241d] font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-[#E6D7BE] tabular-nums shadow-2xs leading-none">
                            #{txtNo}
                          </span>
                          <span className="bg-[#6741D9] text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-md shadow-2xs leading-none">
                            {txt.seviye}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 flex flex-col justify-between space-y-1.5">
                        <div className="space-y-1">
                          {isComp && (
                            <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs">
                              <CheckCircle2 size={11} />
                              <span>Okundu</span>
                            </span>
                          )}
                          <div
                            lang="ar"
                            dir="rtl"
                            className="arabic text-[#065F46] dark:text-emerald-400 text-lg sm:text-xl font-bold leading-[1.85] py-0.5 text-right line-clamp-2"
                          >
                            {getDisplayArabic(txt.baslik_ar)}
                          </div>
                          <div
                            dir="ltr"
                            className="text-[var(--foreground)] group-hover:text-[#087F5B] text-xs sm:text-sm font-extrabold leading-snug text-left line-clamp-2 transition-colors"
                          >
                            {txt.baslik_tr}
                          </div>
                        </div>

                        {txt.odak_gramer && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              playClick();
                              setActiveGrammarModal({
                                readingId: txt.id,
                                grammarTopic: txt.odak_gramer,
                              });
                            }}
                            title="Bu okuma metninin gramer kuralını bağımsız pencerede açmak için tıklayın"
                            dir="ltr"
                            className="w-full text-left text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100/80 hover:bg-amber-200/90 dark:bg-amber-950/50 dark:hover:bg-amber-900/70 border border-amber-300 hover:border-amber-500 rounded-lg px-2 py-1 line-clamp-2 leading-snug cursor-pointer transition-colors"
                          >
                            <span className="mr-1">📌</span>
                            <MixedText text={txt.odak_gramer} />
                          </button>
                        )}
                      </div>
                    </Link>

                    <div className="px-3.5 pb-3.5 pt-1 flex-1 flex flex-col justify-between space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-[var(--muted)] font-semibold border-y border-dashed border-[#E2D3B8] py-2">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <BookOpen size={13} className="text-[#6741D9]" />
                          {txt.satirlar.length} Cümle · {txt.sorular?.length || 0} Soru
                        </span>
                        {txt.tema && (
                          <span className="truncate max-w-[130px]">{txt.tema}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            toggleFavoriteDialogue(txt.id);
                          }}
                          className={`h-9 w-9 rounded-xl border-2 border-b-3 flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                            isFav
                              ? "bg-red-50 border-red-300 text-red-600"
                              : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)]"
                          }`}
                        >
                          <Heart size={15} fill={isFav ? "currentColor" : "none"} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            toggleCompletedDialogue(txt.id);
                          }}
                          className={`h-9 px-2.5 rounded-xl border-2 border-b-3 text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                            isComp
                              ? "bg-[#6741D9] border-[#5230B5] text-white"
                              : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)]"
                          }`}
                        >
                          <CheckCircle2 size={14} />
                          <span>{isComp ? "Bitti" : "Bitir"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            setShareCardTarget({
                              type: "reading",
                              arabicText:
                                txt.satirlar[0]?.arapca || txt.baslik_ar,
                              titleAr: txt.baslik_ar,
                              titleTr: txt.baslik_tr,
                              turkishText:
                                txt.satirlar[0]?.turkce || txt.baslik_tr,
                              excerptLines: txt.satirlar
                                .slice(0, 3)
                                .map((l) => ({
                                  arapca: l.arapca,
                                  turkce: l.turkce,
                                })),
                              level: txt.seviye,
                              category: txt.tema,
                              imageUrl: imagePath,
                              deepLink: `https://app.muallimun.net/metin/${txt.id}`,
                            });
                          }}
                          title="Okuma Metnini Görsel Kart Olarak Paylaş"
                          className="h-9 w-9 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] hover:border-[#087F5B] border-b-3 text-[#065F46] dark:text-emerald-400 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                        >
                          <Share2 size={14} />
                        </button>

                        <Link
                          href={`/alistirmalar?pool=reading_texts&readingId=${txt.id}`}
                          onClick={() => playClick()}
                          title="Bu Metinle Alıştırma Yap"
                          className="h-9 px-2.5 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/70 border-2 border-[#6741D9] border-b-3 text-xs font-extrabold text-[#6741D9] dark:text-indigo-200 flex items-center justify-center gap-1 shrink-0"
                        >
                          <Gamepad2 size={14} />
                          <span className="hidden sm:inline">Alıştırma</span>
                        </Link>

                        <Link
                          href={`/metin/${txt.id}`}
                          onClick={() => playClick()}
                          className="flex-1 h-9 px-3 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-bold text-xs border-b-3 border-[#065F46] flex items-center justify-center gap-1.5"
                        >
                          <span>Metni Oku</span>
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 3. SEKME: 1111 CÜMLE */}
      {activeSection === "cumleler" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--muted)] px-1">
            <span>
              Toplam <strong>{filteredSentences.length}</strong> kalıp ve günlük
              cümle listeleniyor
            </span>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() =>
                  void handleToggleSequentialPlay(filteredSentences)
                }
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSequentialPlaying
                    ? "bg-red-600 hover:bg-red-700 text-white border-red-800"
                    : "bg-[#087F5B] hover:bg-[#065F46] text-white border-[#065F46]"
                }`}
              >
                {isSequentialPlaying ? (
                  <>
                    <Square size={11} fill="currentColor" />
                    <span>Durdur</span>
                  </>
                ) : (
                  <>
                    <Play size={11} fill="currentColor" />
                    <span>
                      Sıralı Dinle (
                      {mounted && preferredVoiceGender === "kadin"
                        ? "👩 Kadın"
                        : "👨 Erkek"}
                      )
                    </span>
                  </>
                )}
              </button>

              <Link
                href={buildExerciseUrlForCurrentTab()}
                onClick={() => playClick()}
                className="px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white font-extrabold text-xs border-b-2 border-[#5230B5] flex items-center gap-1.5 transition-all"
              >
                <Gamepad2 size={13} />
                <span>Alıştırma Yap</span>
              </Link>

              <button
                type="button"
                onClick={() => handleOpenLibraryPdfModal("cumleler")}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--surface)] hover:border-[#087F5B] text-[var(--foreground)] font-extrabold text-xs border border-[#E6D7BE] border-b-2 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileText size={13} className="text-[#087F5B]" />
                <span className="hidden sm:inline">PDF Çalışma Kağıdı</span>
                <span className="sm:hidden">PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIsHomeworkModalOpen(true);
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--surface)] hover:border-[#6741D9] text-[var(--foreground)] font-extrabold text-xs border border-[#E6D7BE] border-b-2 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <GraduationCap size={13} className="text-[#6741D9]" />
                <span className="hidden sm:inline">Ödev Paylaş</span>
                <span className="sm:hidden">Ödev</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredSentences.slice(0, visibleCount).map((item, idx) => {
              const isPlaying = playingItemId === item.id;
              const itemLevel = item.seviye || item.cefr || "A1";
              const isArVisible =
                showArabic || Boolean(revealedArabicIds[item.id]);
              const isTrVisible =
                showTurkish || Boolean(revealedTurkishIds[item.id]);
              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    itemCardRefs.current[item.id] = el;
                  }}
                  className={`rounded-2xl border-2 border-b-4 p-4 flex flex-col justify-between gap-3 transition-all ${
                    isPlaying
                      ? "bg-emerald-50/95 dark:bg-emerald-950/60 border-[#087F5B] ring-2 ring-[#087F5B]"
                      : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)]"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg bg-[#087F5B] text-white text-[10px] font-extrabold tabular-nums">
                        #{item.sira || item.id.replace("cumle_", "")} •{" "}
                        {itemLevel}
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {item.odak_kalip && isTrVisible && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              playClick();
                              setActiveGrammarModal({
                                grammarTopic: item.odak_kalip,
                              });
                            }}
                            title="Bu gramer kalıbının kuralını, formülünü ve örnek cümlelerini incelemek için tıklayın"
                            dir="ltr"
                            className="px-2 py-0.5 rounded-lg bg-amber-100/90 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/70 border border-amber-300 hover:border-amber-500 text-amber-900 dark:text-amber-200 text-[10px] font-extrabold cursor-pointer transition-colors inline-flex items-center gap-1"
                          >
                            <span className="shrink-0">📌</span>
                            <MixedText text={item.odak_kalip} />
                          </button>
                        )}
                        {item.tema && (
                          <span className="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-[var(--background)] border border-[#E6D7BE] text-[10px] font-bold text-[var(--muted)] truncate">
                            {formatTurkishCategory(item.tema)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isArVisible ? (
                      <div
                        dir="rtl"
                        style={{
                          fontSize: `${libraryCardArabicFontSizePx}px`,
                          lineHeight: activeFontCfg.lineHeight,
                        }}
                        className="arabic font-arabic font-bold text-[#065F46] dark:text-emerald-400 text-right bg-white/85 dark:bg-[var(--background)] rounded-xl p-3 border border-[#E6D7BE]"
                      >
                        <WordTooltip
                          text={item.arapca}
                          contextSentenceTr={item.turkce}
                        />
                        {!showArabic && (
                          <button
                            type="button"
                            onClick={() => toggleCardArabicReveal(item.id)}
                            className="mt-1.5 px-2 py-0.5 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] text-[10px] font-sans font-extrabold text-[var(--muted)] flex items-center gap-1 cursor-pointer"
                          >
                            <EyeOff size={10} />
                            <span>Gizle</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleCardArabicReveal(item.id)}
                        className="w-full min-h-[60px] rounded-xl bg-white/85 dark:bg-[var(--background)] border-2 border-dashed border-[#087F5B]/55 p-3 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-emerald-50/40 transition-all"
                      >
                        <span
                          dir="rtl"
                          className="arabic font-arabic text-xl font-bold text-[#065F46]/40 blur-md select-none line-clamp-1"
                        >
                          {getDisplayArabic(item.arapca)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400">
                          <Eye size={12} />
                          <span>Arapçayı görmek için dokun</span>
                        </span>
                      </button>
                    )}

                    {isTrVisible ? (
                      <div className="border-l-4 border-[#087F5B] bg-white/75 dark:bg-[var(--background)] rounded-r-xl px-3 py-2 border border-[#E6D7BE] flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] leading-snug">
                          {item.turkce}
                        </p>
                        {!showTurkish && (
                          <button
                            type="button"
                            onClick={() => toggleCardTurkishReveal(item.id)}
                            className="px-2 py-0.5 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] text-[10px] font-extrabold text-[var(--muted)] shrink-0 cursor-pointer"
                          >
                            Gizle
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleCardTurkishReveal(item.id)}
                        className="w-full min-h-[42px] rounded-xl bg-white/75 dark:bg-[var(--background)] border-2 border-dashed border-[#6741D9]/50 px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-extrabold text-[#6741D9] dark:text-indigo-300 cursor-pointer hover:bg-indigo-50/40 transition-all"
                      >
                        <Eye size={13} />
                        <span>Türkçeyi görmek için dokun</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleListenDualGender(item)}
                      className={`flex-1 min-h-[40px] px-3 rounded-xl border-2 border-b-3 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isPlaying
                          ? "bg-[#087F5B] border-[#065F46] text-white"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)] hover:border-[#087F5B]"
                      }`}
                    >
                      <Volume2
                        size={14}
                        className={isPlaying ? "text-white" : "text-[#065F46]"}
                      />
                      <span>
                        {isPlaying
                          ? "Dinleniyor..."
                          : `Dinle (${
                              mounted && preferredVoiceGender === "kadin"
                                ? "Kadın"
                                : "Erkek"
                            })`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setShadowingTarget({
                          text: item.arapca,
                          refAudioUrl: getDualGenderAudioUrl(
                            item,
                            preferredVoiceGender
                          ),
                        });
                      }}
                      className="min-h-[40px] px-3 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/75 border-2 border-[#6741D9] border-b-3 text-xs font-extrabold text-[#6741D9] dark:text-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Mic size={14} />
                      <span>Telaffuz</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        toggleFavoriteWord(toSentenceFavoriteItem(item));
                      }}
                      title={
                        mounted && favoriteIdsSet.has(item.id)
                          ? "Defterimden Çıkar"
                          : "Defterime Ekle"
                      }
                      className={`min-h-[40px] w-10 rounded-xl border-2 border-b-3 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        mounted && favoriteIdsSet.has(item.id)
                          ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-600"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)] hover:text-rose-500"
                      }`}
                    >
                      <Heart
                        size={15}
                        fill={
                          mounted && favoriteIdsSet.has(item.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setShareCardTarget({
                          type: "sentence",
                          arabicText: item.arapca,
                          turkishText: item.turkce,
                          subInfoTr: item.odak_kalip
                            ? `📌 Odak Kalıp: ${item.odak_kalip}`
                            : undefined,
                          level: itemLevel,
                          category: item.tema
                            ? formatTurkishCategory(item.tema)
                            : undefined,
                          deepLink:
                            "https://app.muallimun.net/kutuphane?tab=cumleler",
                          initialShowTranslation: isTrVisible,
                        });
                      }}
                      title="Görsel Kart Olarak Paylaş"
                      className="min-h-[40px] w-10 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] hover:border-[#087F5B] border-b-3 text-[#065F46] dark:text-emerald-400 flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <Share2 size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setSelectedCardIndex(idx);
                      }}
                      title="Tekil Kart Görünümünde Aç"
                      className="min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-3 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B] flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    >
                      <Maximize2 size={13} className="text-[#087F5B]" />
                      <span className="hidden sm:inline">Kartı Aç</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleCount < filteredSentences.length && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setVisibleCount((c) => c + 36);
                }}
                className="px-6 py-3 rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold border-b-4 border-[#065F46] cursor-pointer"
              >
                Daha Fazla Cümle Göster ({visibleCount} /{" "}
                {filteredSentences.length})
              </button>
            </div>
          )}
        </section>
      )}

      {/* 4. SEKME: 508 ATASÖZÜ VE HİKMETLİ SÖZ */}
      {activeSection === "atasozleri" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--muted)] px-1">
            <span>
              Toplam <strong>{filteredProverbs.length}</strong> Arapça atasözü
              ve hikmetli söz
            </span>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() =>
                  void handleToggleSequentialPlay(filteredProverbs)
                }
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSequentialPlaying
                    ? "bg-red-600 hover:bg-red-700 text-white border-red-800"
                    : "bg-[#087F5B] hover:bg-[#065F46] text-white border-[#065F46]"
                }`}
              >
                {isSequentialPlaying ? (
                  <>
                    <Square size={11} fill="currentColor" />
                    <span>Durdur</span>
                  </>
                ) : (
                  <>
                    <Play size={11} fill="currentColor" />
                    <span>
                      Sıralı Dinle (
                      {mounted && preferredVoiceGender === "kadin"
                        ? "👩 Kadın"
                        : "👨 Erkek"}
                      )
                    </span>
                  </>
                )}
              </button>

              <Link
                href={buildExerciseUrlForCurrentTab()}
                onClick={() => playClick()}
                className="px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white font-extrabold text-xs border-b-2 border-[#5230B5] flex items-center gap-1.5 transition-all"
              >
                <Gamepad2 size={13} />
                <span>Alıştırma Yap</span>
              </Link>

              <button
                type="button"
                onClick={() => handleOpenLibraryPdfModal("atasozleri")}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--surface)] hover:border-[#087F5B] text-[var(--foreground)] font-extrabold text-xs border border-[#E6D7BE] border-b-2 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileText size={13} className="text-[#087F5B]" />
                <span className="hidden sm:inline">PDF Çalışma Kağıdı</span>
                <span className="sm:hidden">PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIsHomeworkModalOpen(true);
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--surface)] hover:border-[#6741D9] text-[var(--foreground)] font-extrabold text-xs border border-[#E6D7BE] border-b-2 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <GraduationCap size={13} className="text-[#6741D9]" />
                <span className="hidden sm:inline">Ödev Paylaş</span>
                <span className="sm:hidden">Ödev</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProverbs.slice(0, visibleCount).map((item, idx) => {
              const isPlaying = playingItemId === item.id;
              const imgUrl = item.gorsel || getProverbCoverUrl(item.id);
              const isArVisible =
                showArabic || Boolean(revealedArabicIds[item.id]);
              const isTrVisible =
                showTurkish || Boolean(revealedTurkishIds[item.id]);
              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    itemCardRefs.current[item.id] = el;
                  }}
                  className={`rounded-2xl border-2 border-b-4 p-4 flex flex-col justify-between gap-3 transition-all ${
                    isPlaying
                      ? "bg-emerald-50/95 dark:bg-emerald-950/60 border-[#087F5B] ring-2 ring-[#087F5B]"
                      : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)]"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setSelectedCardIndex(idx);
                        }}
                        title="Tekil Kart Görünümünde Aç (1:1 Kare Görsel)"
                        className="relative w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-2xl overflow-hidden border-2 border-[#E6D7BE] shrink-0 group cursor-pointer bg-white"
                      >
                        <img
                          src={imgUrl}
                          alt={item.turkce}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute bottom-1 right-1 p-1 rounded-md bg-black/65 text-white">
                          <Maximize2 size={10} />
                        </span>
                      </button>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-600 text-white text-[10px] font-extrabold tabular-nums">
                            #{item.sira || item.id.replace("ata_", "")} •{" "}
                            {item.cefr}
                          </span>
                          {item.tema && (
                            <span className="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-[var(--background)] border border-[#E6D7BE] text-[10px] font-bold text-[var(--muted)] truncate">
                              {item.tema.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        {isTrVisible ? (
                          <div className="space-y-1">
                            <p className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] leading-snug">
                              “{item.turkce}”
                            </p>
                            {item.lafzi_ceviri && (
                              <p className="text-[11px] font-semibold text-[var(--muted)] leading-snug">
                                <strong className="text-[var(--foreground)]">
                                  Lafzî Çeviri:
                                </strong>{" "}
                                {item.lafzi_ceviri}
                              </p>
                            )}
                            {!showTurkish && (
                              <button
                                type="button"
                                onClick={() => toggleCardTurkishReveal(item.id)}
                                className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[10px] font-extrabold text-[var(--muted)] cursor-pointer"
                              >
                                Türkçeyi Gizle
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleCardTurkishReveal(item.id)}
                            className="w-full min-h-[44px] rounded-xl bg-white/75 dark:bg-[var(--background)] border-2 border-dashed border-[#6741D9]/50 px-2.5 py-1.5 flex items-center justify-center gap-1 text-[11px] font-extrabold text-[#6741D9] dark:text-indigo-300 cursor-pointer hover:bg-indigo-50/40 transition-all"
                          >
                            <Eye size={12} />
                            <span>Türkçeyi görmek için dokun</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isArVisible ? (
                      <div
                        dir="rtl"
                        style={{
                          fontSize: `${libraryCardArabicFontSizePx}px`,
                          lineHeight: activeFontCfg.lineHeight,
                        }}
                        className="arabic font-arabic font-bold text-[#065F46] dark:text-emerald-400 text-right bg-white/85 dark:bg-[var(--background)] rounded-xl p-3 border border-[#E6D7BE]"
                      >
                        <WordTooltip
                          text={item.arapca}
                          contextSentenceTr={item.turkce}
                        />
                        {!showArabic && (
                          <button
                            type="button"
                            onClick={() => toggleCardArabicReveal(item.id)}
                            className="mt-1.5 px-2 py-0.5 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] text-[10px] font-sans font-extrabold text-[var(--muted)] flex items-center gap-1 cursor-pointer"
                          >
                            <EyeOff size={10} />
                            <span>Gizle</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleCardArabicReveal(item.id)}
                        className="w-full min-h-[60px] rounded-xl bg-white/85 dark:bg-[var(--background)] border-2 border-dashed border-[#087F5B]/55 p-3 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-emerald-50/40 transition-all"
                      >
                        <span
                          dir="rtl"
                          className="arabic font-arabic text-xl font-bold text-[#065F46]/40 blur-md select-none line-clamp-1"
                        >
                          {getDisplayArabic(item.arapca)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400">
                          <Eye size={12} />
                          <span>Arapçayı görmek için dokun</span>
                        </span>
                      </button>
                    )}

                    {item.kullanim_baglami && isTrVisible && (
                      <div className="rounded-xl bg-white/75 dark:bg-[var(--background)] px-3 py-2 border border-[#E6D7BE] text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        💡 <strong>Bağlam:</strong> {item.kullanim_baglami}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleListenDualGender(item)}
                      className={`flex-1 min-h-[40px] px-3 rounded-xl border-2 border-b-3 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isPlaying
                          ? "bg-[#087F5B] border-[#065F46] text-white"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)] hover:border-[#087F5B]"
                      }`}
                    >
                      <Volume2
                        size={14}
                        className={isPlaying ? "text-white" : "text-[#065F46]"}
                      />
                      <span>
                        {isPlaying
                          ? "Dinleniyor..."
                          : `Dinle (${
                              mounted && preferredVoiceGender === "kadin"
                                ? "Kadın"
                                : "Erkek"
                            })`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setShadowingTarget({
                          text: item.arapca,
                          refAudioUrl: getDualGenderAudioUrl(
                            item,
                            preferredVoiceGender
                          ),
                        });
                      }}
                      className="min-h-[40px] px-3 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/75 border-2 border-[#6741D9] border-b-3 text-xs font-extrabold text-[#6741D9] dark:text-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Mic size={14} />
                      <span>Telaffuz</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        toggleFavoriteWord(toProverbFavoriteItem(item));
                      }}
                      title={
                        mounted && favoriteIdsSet.has(item.id)
                          ? "Defterimden Çıkar"
                          : "Defterime Ekle"
                      }
                      className={`min-h-[40px] w-10 rounded-xl border-2 border-b-3 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        mounted && favoriteIdsSet.has(item.id)
                          ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-600"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)] hover:text-rose-500"
                      }`}
                    >
                      <Heart
                        size={15}
                        fill={
                          mounted && favoriteIdsSet.has(item.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setShareCardTarget({
                          type: "proverb",
                          arabicText: item.arapca,
                          turkishText: item.turkce,
                          subInfoTr: item.lafzi_ceviri
                            ? `Lafzî: ${item.lafzi_ceviri}`
                            : item.kullanim_baglami,
                          level: item.cefr,
                          category: item.tema
                            ? formatTurkishCategory(item.tema)
                            : undefined,
                          imageUrl: imgUrl,
                          deepLink:
                            "https://app.muallimun.net/kutuphane?tab=atasozleri",
                          initialShowTranslation: isTrVisible,
                        });
                      }}
                      title="Atasözünü Görsel Kart Olarak Paylaş"
                      className="min-h-[40px] w-10 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] hover:border-amber-500 border-b-3 text-amber-800 dark:text-amber-300 flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <Share2 size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setSelectedCardIndex(idx);
                      }}
                      title="Tekil Kart Görünümünde Aç"
                      className="min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-3 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B] flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    >
                      <Maximize2 size={13} className="text-[#087F5B]" />
                      <span className="hidden sm:inline">Kartı Aç</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleCount < filteredProverbs.length && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setVisibleCount((c) => c + 36);
                }}
                className="px-6 py-3 rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold border-b-4 border-[#065F46] cursor-pointer"
              >
                Daha Fazla Atasözü Göster ({visibleCount} /{" "}
                {filteredProverbs.length})
              </button>
            </div>
          )}
        </section>
      )}

      {/* 5. SEKME: 998 GÖRSEL KELİME (1:1 KARE GÖRSEL & BÜTÜNCÜL KART MİMARİSİ) */}
      {activeSection === "gorsel-kelimeler" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--muted)] px-1">
            <span>
              Toplam <strong>{filteredVisualWords.length}</strong> resimli
              kelime kartı
            </span>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() =>
                  void handleToggleSequentialPlay(filteredVisualWords)
                }
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSequentialPlaying
                    ? "bg-red-600 hover:bg-red-700 text-white border-red-800"
                    : "bg-[#087F5B] hover:bg-[#065F46] text-white border-[#065F46]"
                }`}
              >
                {isSequentialPlaying ? (
                  <>
                    <Square size={11} fill="currentColor" />
                    <span>Durdur</span>
                  </>
                ) : (
                  <>
                    <Play size={11} fill="currentColor" />
                    <span>
                      Sıralı Dinle (
                      {mounted && preferredVoiceGender === "kadin"
                        ? "👩 Kadın"
                        : "👨 Erkek"}
                      )
                    </span>
                  </>
                )}
              </button>

              <Link
                href={buildExerciseUrlForCurrentTab()}
                onClick={() => playClick()}
                className="px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white font-extrabold text-xs border-b-2 border-[#5230B5] flex items-center gap-1.5 transition-all"
              >
                <Gamepad2 size={13} />
                <span>Alıştırma Yap</span>
              </Link>

              <button
                type="button"
                onClick={() => handleOpenLibraryPdfModal("gorsel-kelimeler")}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--surface)] hover:border-[#087F5B] text-[var(--foreground)] font-extrabold text-xs border border-[#E6D7BE] border-b-2 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileText size={13} className="text-[#087F5B]" />
                <span className="hidden sm:inline">PDF Çalışma Kağıdı</span>
                <span className="sm:hidden">PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIsHomeworkModalOpen(true);
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--surface)] hover:border-[#6741D9] text-[var(--foreground)] font-extrabold text-xs border border-[#E6D7BE] border-b-2 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <GraduationCap size={13} className="text-[#6741D9]" />
                <span className="hidden sm:inline">Ödev Paylaş</span>
                <span className="sm:hidden">Ödev</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVisualWords.slice(0, visibleCount).map((item, idx) => {
              const isPlaying = playingItemId === item.id;
              const imgUrl = item.gorsel || getVisualWordCoverUrl(item);
              const isArVisible =
                showArabic || Boolean(revealedArabicIds[item.id]);
              const isTrVisible =
                showTurkish || Boolean(revealedTurkishIds[item.id]);
              const forms: { label: string; arabic: string }[] = [
                { label: "Temel Form", arabic: item.arapca },
              ];
              if (item.ikincil_form && item.ikincil_form !== "-") {
                forms.push({
                  label: "Çoğul / Muzâri",
                  arabic: item.ikincil_form,
                });
              }
              if (item.ucuncul_form && item.ucuncul_form !== "-") {
                forms.push({ label: "Masdar", arabic: item.ucuncul_form });
              }

              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    itemCardRefs.current[item.id] = el;
                  }}
                  className={`rounded-2xl border-2 border-b-4 p-4 flex flex-col justify-between gap-3 transition-all ${
                    isPlaying
                      ? "bg-emerald-50/95 dark:bg-emerald-950/60 border-[#087F5B] ring-2 ring-[#087F5B]"
                      : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)]"
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Üst Satır: Sol 1:1 Kare Görsel Kutusu + Sağ Meta Bilgileri */}
                    <div className="flex items-start gap-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setSelectedCardIndex(idx);
                        }}
                        title="Tekil Kart Görünümünde Aç (1:1 Kare Görsel)"
                        className="w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-2xl overflow-hidden border-2 border-[#E6D7BE] bg-white shrink-0 relative group cursor-pointer"
                      >
                        <img
                          src={imgUrl}
                          alt={item.turkce}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute bottom-1 right-1 p-1 rounded-md bg-black/65 text-white">
                          <Maximize2 size={10} />
                        </span>
                      </button>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-lg bg-[#087F5B] text-white text-[10px] font-extrabold tabular-nums">
                            {item.cefr}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-white/90 dark:bg-[var(--background)] border border-[#E6D7BE] text-[10px] font-extrabold text-[var(--muted)] truncate">
                            {formatVisualCategoryBadge(item.kategori_tr)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                              item.tur === "fiil"
                                ? "bg-indigo-100 dark:bg-indigo-950/70 text-[#6741D9] dark:text-indigo-300 border border-indigo-300"
                                : "bg-emerald-100 dark:bg-emerald-950/70 text-[#065F46] dark:text-emerald-300 border border-emerald-300"
                            }`}
                          >
                            {item.tur === "fiil" ? "Fiil" : "İsim"}
                          </span>
                        </div>

                        {isTrVisible ? (
                          <div className="flex items-center justify-between gap-1.5">
                            <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] leading-snug">
                              {item.turkce}
                            </h3>
                            {!showTurkish && (
                              <button
                                type="button"
                                onClick={() => toggleCardTurkishReveal(item.id)}
                                className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[10px] font-extrabold text-[var(--muted)] shrink-0 cursor-pointer"
                              >
                                Gizle
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleCardTurkishReveal(item.id)}
                            className="w-full min-h-[38px] rounded-xl bg-white/75 dark:bg-[var(--background)] border-2 border-dashed border-[#6741D9]/50 px-2.5 py-1 flex items-center justify-center gap-1 text-[11px] font-extrabold text-[#6741D9] dark:text-indigo-300 cursor-pointer hover:bg-indigo-50/40 transition-all"
                          >
                            <Eye size={12} />
                            <span>Türkçeyi görmek için dokun</span>
                          </button>
                        )}

                        {isArVisible &&
                          (item.ikincil_form || item.ucuncul_form) && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--muted)] pt-0.5">
                              {item.ikincil_form &&
                                item.ikincil_form !== "-" && (
                                  <span>
                                    {item.tur === "fiil" ? "Muzâri:" : "Çoğul:"}{" "}
                                    <strong
                                      dir="rtl"
                                      className="arabic font-arabic text-sm text-[var(--foreground)]"
                                    >
                                      {getDisplayArabic(item.ikincil_form)}
                                    </strong>
                                  </span>
                                )}
                              {item.ucuncul_form &&
                                item.ucuncul_form !== "-" && (
                                  <span>
                                    Masdar:{" "}
                                    <strong
                                      dir="rtl"
                                      className="arabic font-arabic text-sm text-[var(--foreground)]"
                                    >
                                      {getDisplayArabic(item.ucuncul_form)}
                                    </strong>
                                  </span>
                                )}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Orta Kutu: Sağa Hizalı İri Harekeli Arapça Kelime + Örnek Cümle */}
                    <div className="bg-white/85 dark:bg-[var(--background)] rounded-xl p-3 border border-[#E6D7BE] space-y-2">
                      {isArVisible ? (
                        <div>
                          <div
                            dir="rtl"
                            style={{
                              fontSize: `${libraryCardArabicFontSizePx}px`,
                              lineHeight: activeFontCfg.lineHeight,
                            }}
                            className="arabic font-arabic font-bold text-[#065F46] dark:text-emerald-400 text-right"
                          >
                            <WordTooltip
                              text={item.arapca}
                              contextSentenceTr={item.turkce}
                            />
                          </div>
                          {!showArabic && (
                            <button
                              type="button"
                              onClick={() => toggleCardArabicReveal(item.id)}
                              className="mt-1 px-2 py-0.5 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] text-[10px] font-sans font-extrabold text-[var(--muted)] flex items-center gap-1 cursor-pointer"
                            >
                              <EyeOff size={10} />
                              <span>Arapçayı Gizle</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleCardArabicReveal(item.id)}
                          className="w-full min-h-[54px] rounded-xl bg-[#F7EFE1]/60 dark:bg-[var(--surface)] border-2 border-dashed border-[#087F5B]/55 p-2.5 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-emerald-50/40 transition-all"
                        >
                          <span
                            dir="rtl"
                            className="arabic font-arabic text-xl font-bold text-[#065F46]/40 blur-md select-none"
                          >
                            {getDisplayArabic(item.arapca)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400">
                            <Eye size={12} />
                            <span>Arapçayı görmek için dokun</span>
                          </span>
                        </button>
                      )}

                      {item.ornek_ar && (
                        <div className="border-t border-dashed border-[#E2D3B8] pt-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-extrabold uppercase text-[#6741D9]">
                              Örnek Cümle
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                playClick();
                                if (
                                  item.ornek_ses_erkek ||
                                  item.ornek_ses_kadin
                                ) {
                                  void playDualGenderAudio({
                                    text: item.ornek_ar,
                                    ses_erkek: item.ornek_ses_erkek,
                                    ses_kadin: item.ornek_ses_kadin,
                                    rate: speechRate,
                                    gender: preferredVoiceGender,
                                  });
                                } else {
                                  void speakHybrid({
                                    text: item.ornek_ar,
                                    rate: speechRate,
                                    voice: preferredVoiceGender,
                                  });
                                }
                              }}
                              className="text-[10px] font-extrabold text-[#065F46] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Volume2 size={11} />
                              <span>Cümleyi Dinle</span>
                            </button>
                          </div>
                          {isArVisible ? (
                            <div
                              dir="rtl"
                              style={{
                                fontSize: `${librarySubArabicFontSizePx}px`,
                                lineHeight: activeFontCfg.lineHeight,
                              }}
                              className="arabic font-arabic font-bold text-[var(--foreground)] text-right"
                            >
                              <WordTooltip
                                text={item.ornek_ar}
                                contextSentenceTr={item.ornek_tr || item.turkce}
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleCardArabicReveal(item.id)}
                              className="w-full py-1 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 text-[11px] font-extrabold text-[#065F46] dark:text-emerald-300 cursor-pointer"
                            >
                              👁️ Örnek Arapça cümleyi gör
                            </button>
                          )}
                          {item.ornek_tr && isTrVisible && (
                            <p className="text-[11px] font-semibold text-[var(--muted)]">
                              {item.ornek_tr}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alt Aksiyon Satırı (360px Mobil Uyumlu flex-wrap + whitespace-nowrap) */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleListenDualGender(item)}
                      className={`flex-1 min-w-[116px] min-h-[38px] px-2.5 py-1.5 rounded-xl border-2 border-b-3 text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                        isPlaying
                          ? "bg-[#087F5B] border-[#065F46] text-white"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)] hover:border-[#087F5B]"
                      }`}
                    >
                      <Volume2
                        size={14}
                        className={`shrink-0 ${
                          isPlaying ? "text-white" : "text-[#065F46]"
                        }`}
                      />
                      <span>
                        {isPlaying
                          ? "Dinleniyor..."
                          : `Dinle (${
                              mounted && preferredVoiceGender === "kadin"
                                ? "Kadın"
                                : "Erkek"
                            })`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setShadowingTarget({
                          text: item.arapca,
                          refAudioUrl: getDualGenderAudioUrl(
                            item,
                            preferredVoiceGender
                          ),
                          forms,
                        });
                      }}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/75 border-2 border-[#6741D9] border-b-3 text-xs font-extrabold text-[#6741D9] dark:text-indigo-200 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Mic size={13} className="shrink-0" />
                      <span>Telaffuz</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        toggleFavoriteWord(toVisualWordFavoriteItem(item));
                      }}
                      title={
                        mounted && isVisualWordFavorited(item)
                          ? "Defterimden Çıkar"
                          : "Defterime Ekle"
                      }
                      className={`min-h-[38px] w-9 rounded-xl border-2 border-b-3 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        mounted && isVisualWordFavorited(item)
                          ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-600"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)] hover:text-rose-500"
                      }`}
                    >
                      <Heart
                        size={15}
                        fill={
                          mounted && isVisualWordFavorited(item)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        const morphAr: string[] = [];
                        if (item.ikincil_form && item.ikincil_form !== "-") {
                          morphAr.push(
                            `${
                              item.tur === "fiil"
                                ? "Mâzî / Muzâri:"
                                : "Müfret / Cemî:"
                            } ${item.ikincil_form}`
                          );
                        }
                        if (item.ornek_ar) {
                          morphAr.push(`Örnek: ${item.ornek_ar}`);
                        }
                        setShareCardTarget({
                          type: "visual_word",
                          arabicText: item.arapca,
                          turkishText: item.turkce,
                          subInfoAr:
                            morphAr.length > 0
                              ? morphAr.join("  |  ")
                              : undefined,
                          subInfoTr: item.ornek_tr
                            ? `Örnek: ${item.ornek_tr}`
                            : undefined,
                          level: item.cefr,
                          category: formatVisualCategoryBadge(item.kategori_tr),
                          imageUrl: imgUrl,
                          deepLink:
                            "https://app.muallimun.net/kutuphane?tab=gorsel-kelimeler",
                          initialShowTranslation: isTrVisible,
                        });
                      }}
                      title="Görsel Kelimeyi Kart Olarak Paylaş"
                      className="min-h-[38px] w-9 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] hover:border-[#087F5B] border-b-3 text-[#065F46] dark:text-emerald-400 flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <Share2 size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setSelectedCardIndex(idx);
                      }}
                      title="Tekil Kart Görünümünde Aç"
                      className="min-h-[38px] w-9 sm:w-auto sm:px-2.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-3 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B] flex items-center justify-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <Maximize2 size={13} className="text-[#087F5B] shrink-0" />
                      <span className="hidden sm:inline">Kartı Aç</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleCount < filteredVisualWords.length && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setVisibleCount((c) => c + 36);
                }}
                className="px-6 py-3 rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold border-b-4 border-[#065F46] cursor-pointer"
              >
                Daha Fazla Görsel Kelime Göster ({visibleCount} /{" "}
                {filteredVisualWords.length})
              </button>
            </div>
          )}
        </section>
      )}

      {/* 6. SEKME: KİŞİSEL ÇALIŞMA DEFTERİM (KELİMELER, GÖRSEL KELİMELER, CÜMLELER, ATASÖZLERİ) */}
      {activeSection === "saved-words" && (
        <section className="space-y-4">
          {!mounted || favoriteWords.length === 0 ? (
            <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-10 text-center space-y-3">
              <p className="text-base font-extrabold text-[var(--foreground)]">
                Çalışma defterinizde henüz kayıtlı öğe bulunmuyor.
              </p>
              <p className="text-xs text-[var(--muted)] max-w-xl mx-auto">
                {contentStats.sentenceCount} Cümle, {contentStats.proverbCount}{" "}
                Atasözü, {contentStats.visualWordCount} Görsel Kelime
                kartlarındaki, Diyaloglardaki veya Sözlük sayfasındaki kalp (❤️)
                ikonuna tıklayarak öğeleri kişisel defterinize
                kaydedebilirsiniz.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSwitchSection("gorsel-kelimeler")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-4 border-[#065F46] cursor-pointer"
                >
                  <span>
                    🖼️ {contentStats.visualWordCount} Görsel Kelimeye Göz At
                  </span>
                </button>
                <Link
                  href="/sozluk"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold border-b-4 border-[#5230B5]"
                >
                  <span>📖 Sözlüğe Git</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setIsStatsBadgesOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold border-b-4 border-amber-800 cursor-pointer"
                >
                  <span>🏆 İstatistikler, Rozetler &amp; Öğretmen Raporu</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Defterim Üst Kontrol, Tür Filtreleme ve Aksiyon Çubuğu */}
              <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-3 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                      ❤️ Kişisel Çalışma Defterim ({favoriteWords.length} Kayıt)
                    </h2>
                    <p className="text-[11px] font-semibold text-[var(--muted)]">
                      Kaydettiğiniz kelime, görsel kart, cümle ve atasözleriyle
                      özel alıştırma yapın veya A4 PDF çalışma kağıdı indirin.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/alistirmalar?pool=favorites"
                      onClick={() => playClick()}
                      className="px-3.5 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white font-extrabold text-xs border-b-3 border-[#5230B5] flex items-center gap-1.5 transition-all"
                    >
                      <Gamepad2 size={14} />
                      <span>Defterimdekilerle Alıştırma Yap</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setIsStatsBadgesOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs border-b-3 border-amber-800 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>🏆 İstatistikler &amp; Rozetler</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenLibraryPdfModal("saved-words")}
                      className="px-3.5 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-xs border-b-3 border-[#065F46] flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <FileText size={14} />
                      <span>Defterimi PDF İndir</span>
                    </button>
                  </div>
                </div>

                {/* Tür Filtresi Sekmeleri: Tümü | Kelimeler | Görsel Kelimeler | Cümleler | Atasözleri */}
                <div className="flex overflow-x-auto no-scrollbar items-center gap-1.5 pt-1 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                  {(
                    [
                      {
                        id: "all",
                        label: `Tümü (${favoriteWords.length})`,
                      },
                      {
                        id: "words",
                        label: `📖 Kelimeler (${
                          favoriteWords.filter(
                            (w) => getSavedItemKind(w) === "words"
                          ).length
                        })`,
                      },
                      {
                        id: "visual-words",
                        label: `🖼️ Görsel Kelimeler (${
                          favoriteWords.filter(
                            (w) => getSavedItemKind(w) === "visual-words"
                          ).length
                        })`,
                      },
                      {
                        id: "sentences",
                        label: `🗣️ Cümleler (${
                          favoriteWords.filter(
                            (w) => getSavedItemKind(w) === "sentences"
                          ).length
                        })`,
                      },
                      {
                        id: "proverbs",
                        label: `📜 Atasözleri (${
                          favoriteWords.filter(
                            (w) => getSavedItemKind(w) === "proverbs"
                          ).length
                        })`,
                      },
                    ] as { id: SavedItemFilter; label: string }[]
                  ).map((tab) => {
                    const active = savedItemFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          playClick();
                          setSavedItemFilter(tab.id);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                          active
                            ? "bg-[#087F5B] border-[#065F46] text-white shadow-2xs"
                            : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredSavedItems.length === 0 ? (
                <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] p-8 text-center">
                  <p className="text-sm font-extrabold text-[var(--foreground)]">
                    Bu kategoride henüz kayıtlı öğeniz bulunmuyor.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSavedItems.map((word) => {
                    const kind = getSavedItemKind(word);
                    const mainAr = word.mufret || word.mazi || "";
                    const isPlaying = playingItemId === word.id;
                    const kindBadge =
                      kind === "visual-words"
                        ? "🖼️ Görsel Kelime"
                        : kind === "sentences"
                        ? "🗣️ Günlük Cümle"
                        : kind === "proverbs"
                        ? "📜 Atasözü"
                        : `📖 ${word.tur || "Kelime"}`;

                    return (
                      <div
                        key={word.id}
                        className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start gap-3.5">
                            {word.gorsel && (
                              <div className="w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-2xl overflow-hidden border-2 border-[#E6D7BE] bg-white shrink-0 flex items-center justify-center">
                                <img
                                  src={word.gorsel}
                                  alt={word.anlam_tr}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full aspect-square object-contain"
                                />
                              </div>
                            )}

                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-[#087F5B] text-white text-[10px] font-extrabold">
                                  {kindBadge}
                                </span>
                                {word.cefr && (
                                  <span className="px-2 py-0.5 rounded-lg bg-[#6741D9] text-white text-[10px] font-extrabold">
                                    {word.cefr}
                                  </span>
                                )}
                                {word.kategori_tr && (
                                  <span className="px-2 py-0.5 rounded-lg bg-white/90 dark:bg-[var(--background)] border border-[#E6D7BE] text-[10px] font-bold text-[var(--muted)] truncate">
                                    {word.kategori_tr}
                                  </span>
                                )}
                                {word.kok && word.kok !== "-" && (
                                  <span className="px-2 py-0.5 rounded-lg bg-amber-100/90 text-amber-900 text-[10px] font-extrabold">
                                    📌 {word.kok}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] leading-snug">
                                {word.anlam_tr}
                              </p>

                              {word.ornek_tr && (
                                <p className="text-[11px] font-semibold text-[var(--muted)] leading-snug">
                                  {kind === "proverbs"
                                    ? `Lafzî: ${word.ornek_tr}`
                                    : word.ornek_tr}
                                </p>
                              )}
                            </div>
                          </div>

                          <div
                            dir="rtl"
                            style={{
                              fontSize: `${libraryCardArabicFontSizePx}px`,
                              lineHeight: activeFontCfg.lineHeight,
                            }}
                            className="arabic font-arabic font-bold text-[#065F46] dark:text-emerald-400 text-right bg-white/85 dark:bg-[var(--background)] rounded-xl p-3 border border-[#E6D7BE]"
                          >
                            <WordTooltip
                              text={mainAr}
                              contextSentenceTr={word.anlam_tr}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              void handleListenDualGender({
                                id: word.id,
                                arapca: mainAr,
                                ses_erkek: word.ses_erkek,
                                ses_kadin: word.ses_kadin,
                              })
                            }
                            className={`flex-1 min-h-[38px] px-3 rounded-xl border-2 border-b-3 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isPlaying
                                ? "bg-[#087F5B] border-[#065F46] text-white"
                                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)] hover:border-[#087F5B]"
                            }`}
                          >
                            <Volume2
                              size={14}
                              className={
                                isPlaying ? "text-white" : "text-[#065F46]"
                              }
                            />
                            <span>
                              {isPlaying ? "Dinleniyor..." : "Dinle"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              setShadowingTarget({
                                text: mainAr,
                                refAudioUrl: getDualGenderAudioUrl(
                                  {
                                    id: word.id,
                                    ses_erkek: word.ses_erkek,
                                    ses_kadin: word.ses_kadin,
                                  },
                                  preferredVoiceGender
                                ),
                                forms: prepareForms(word),
                              });
                            }}
                            className="min-h-[38px] px-3 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/75 border-2 border-[#6741D9] border-b-3 text-xs font-extrabold text-[#6741D9] dark:text-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Mic size={14} />
                            <span>Telaffuz</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              setShareCardTarget({
                                type:
                                  kind === "proverbs"
                                    ? "proverb"
                                    : kind === "sentences"
                                    ? "sentence"
                                    : "visual_word",
                                arabicText: mainAr,
                                turkishText: word.anlam_tr,
                                subInfoAr:
                                  word.kok && word.kok !== "-"
                                    ? `Kök: ${word.kok}`
                                    : word.ornek_ar
                                    ? `Örnek: ${word.ornek_ar}`
                                    : undefined,
                                subInfoTr: word.ornek_tr || undefined,
                                level: word.cefr,
                                category: word.kategori_tr,
                                imageUrl: word.gorsel,
                                deepLink:
                                  kind === "proverbs"
                                    ? "https://app.muallimun.net/kutuphane?tab=atasozleri"
                                    : kind === "sentences"
                                    ? "https://app.muallimun.net/kutuphane?tab=cumleler"
                                    : kind === "visual-words"
                                    ? "https://app.muallimun.net/kutuphane?tab=gorsel-kelimeler"
                                    : `https://app.muallimun.net/sozluk?q=${encodeURIComponent(
                                        mainAr
                                      )}`,
                              });
                            }}
                            title="Görsel Kart Olarak Paylaş"
                            className="min-h-[38px] w-10 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] hover:border-[#087F5B] border-b-3 text-[#065F46] dark:text-emerald-400 flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <Share2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              toggleFavoriteWord(word);
                            }}
                            title="Defterimden Çıkar"
                            className="min-h-[38px] px-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-200 border-b-3 text-xs font-extrabold text-rose-600 flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Heart size={14} fill="currentColor" />
                            <span>Çıkar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* 7. SEKME: MAHREÇ ANTRENMANI (ZAYIF KELİMELER) */}
      {activeSection === "weak-words" && (
        <section className="space-y-4">
          {!mounted || weakWords.length === 0 ? (
            <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-10 text-center space-y-2">
              <AlertTriangle
                size={36}
                className="mx-auto text-[#065F46] dark:text-emerald-400 mb-2"
              />
              <p className="text-base font-extrabold text-[var(--foreground)]">
                Harika! Mahreç tekrarı gerektiren zayıf kelimeniz yok.
              </p>
              <p className="text-xs text-[var(--muted)]">
                Gölgeleme çalışmalarında zorlandığınız kelimeler otomatik olarak
                buraya eklenir.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {weakWords.map((word) => (
                <div
                  key={word.id}
                  className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-dashed border-[#E2D3B8] pb-3">
                    <div>
                      <span className="text-[11px] font-bold text-amber-700">
                        Mahreç Tekrarı · Kök: {word.kok}
                      </span>
                      <p className="text-sm font-extrabold text-[var(--foreground)] mt-1">
                        {word.anlam_tr}
                      </p>
                    </div>
                    <span
                      lang="ar"
                      dir="rtl"
                      className="arabic text-3xl font-bold text-[#6741D9]"
                    >
                      {getDisplayArabic(word.mufret || word.mazi || "")}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handlePracticeWord(word)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-bold border-b-3 border-[#065F46] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Mic size={14} />
                      <span>Şimdi Çalış</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        removeWeakWord(word.id);
                      }}
                      className="py-2 px-3 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-3 text-xs font-bold text-[var(--muted)] hover:text-[#065F46] dark:text-emerald-400 cursor-pointer"
                      title="Listeden Tamamlandı Olarak Kaldır"
                    >
                      <CheckCircle2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 6. SEKME: 📌 GRAMER ATLASI (195 GRAMER HAP BİLGİ KARTI — 4 DİL BİLİMSEL ALAN) */}
      {activeSection === "gramer" && (
        <section aria-label="Arapça Gramer Atlası" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--muted)] px-1">
            <span>
              Toplam <strong>{filteredGrammarAtlasItems.length}</strong> gramer konusu listeleniyor
              {levelFilter !== "all" ? ` (${levelFilter} Kuru)` : ""}
            </span>
            <span className="hidden lg:inline-flex text-[11px] font-extrabold text-[#087F5B] dark:text-emerald-400 items-center gap-1 flex-wrap">
              <span>💡 Kartlardaki</span>
              <Columns2 size={13} className="inline shrink-0" />
              <span>
                &ldquo;Notu &amp; Tabloyu Aç&rdquo; ile yan panelde inceleyebilir, &ldquo;🖨️ A4 Ders Föyü (PDF)&rdquo; ile yazdırabilirsiniz.
              </span>
            </span>
            <span className="lg:hidden text-[11px] font-extrabold text-[#087F5B] dark:text-emerald-400">
              💡 Kartları tam ekran inceleyebilir, A4 PDF indirebilir veya WhatsApp&apos;ta paylaşabilirsiniz.
            </span>
          </div>

          {filteredGrammarAtlasItems.length === 0 ? (
            <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] border-b-4 p-10 text-center space-y-3">
              <p className="text-base font-extrabold text-[var(--foreground)]">
                Aradığınız kriterlere uygun gramer konusu bulunamadı.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setLevelFilter("all");
                  setGrammarDomainFilter("all");
                }}
                className="px-4 py-2 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold cursor-pointer"
              >
                Filtreleri Temizle
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredGrammarAtlasItems.slice(0, visibleCount).map((gItem) => {
                  const isHighlighted =
                    highlightedGrammarCardId === gItem.bagliId;
                  return (
                    <div
                      key={gItem.id}
                      id={`grammar-card-${gItem.bagliId}`}
                      className={`rounded-2xl border-2 ${
                        isHighlighted
                          ? "border-[#087F5B] ring-2 ring-[#087F5B]/40"
                          : "border-[#E6D7BE] dark:border-[var(--border)]"
                      } border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] hover:border-[#087F5B] p-4 flex flex-col justify-between gap-3.5 transition-all shadow-xs`}
                    >
                      <div className="space-y-3">
                        {/* Üst Rozet Satırı: Yalnızca Seviye + Dil Bilimsel Alan */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#087F5B] text-white text-[11px] font-black">
                              {gItem.level}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-extrabold ${gItem.domainMeta.badgeClass}`}
                            >
                              <span>{gItem.domainMeta.emoji}</span>
                              <span>{gItem.domainMeta.shortTitle}</span>
                            </span>
                          </div>
                        </div>

                        {/* Türkçe & Arapça Gramer Konu Başlığı */}
                        <div className="space-y-1">
                          <h3
                            dir="ltr"
                            lang="tr"
                            className="text-sm sm:text-base font-black text-[var(--foreground)] leading-snug text-left"
                          >
                            <MixedText text={gItem.title} />
                          </h3>

                          {/* Kart İçinde Küçük Şık Diyalog / Metin Bağlantısı veya KTT Konusu */}
                          {(gItem.linkedLessonUrl || gItem.kttUstKonu) && (
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 text-[11px]">
                              {gItem.linkedLessonUrl &&
                                gItem.linkedLessonFullTitle && (
                                  <Link
                                    href={gItem.linkedLessonUrl}
                                    onClick={() => playClick()}
                                    className="inline-flex items-center gap-1 font-bold text-[#087F5B] dark:text-emerald-400 hover:underline max-w-full"
                                  >
                                    <BookOpen size={12} className="shrink-0" />
                                    <span className="truncate">
                                      {gItem.linkedLessonFullTitle}
                                    </span>
                                  </Link>
                                )}
                              {gItem.kttUstKonu && (
                                <span className="font-bold text-[var(--muted)]">
                                  Konu: {gItem.kttUstKonu}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Kısa Kural Özeti (hap_kural) */}
                        <div className="bg-white/95 dark:bg-[var(--background)] rounded-xl p-3 border border-[#E6D7BE] dark:border-[var(--border)]">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#087F5B] dark:text-emerald-400 block mb-0.5">
                            Temel Kural Özeti:
                          </span>
                          <p
                            dir="ltr"
                            lang="tr"
                            className="text-xs sm:text-sm font-semibold text-[var(--foreground)] leading-relaxed line-clamp-3 text-left"
                          >
                            <MixedText text={gItem.hapKural} />
                          </p>
                        </div>

                        {/* Formül & Örnek Cümle Önizlemesi */}
                        {gItem.exampleAr && (
                          <div className="bg-[#FDFBF7] dark:bg-[var(--background)] rounded-xl p-3 border border-dashed border-[#E6D7BE] dark:border-[var(--border)] space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-[#6741D9] dark:text-indigo-300">
                                🎯 Örnek Cümle
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  playClick();
                                  void speakHybrid({
                                    text: gItem.exampleAr,
                                    rate: speechRate,
                                  });
                                }}
                                className="px-2 py-0.5 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] hover:border-[#087F5B] text-[10px] font-extrabold text-[var(--foreground)] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Volume2 size={11} className="text-[#087F5B]" />
                                <span>Dinle</span>
                              </button>
                            </div>
                            <div
                              dir="rtl"
                              className="arabic font-arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.85]"
                            >
                              {getDisplayArabic(gItem.exampleAr)}
                            </div>
                            <p className="text-xs font-bold text-[var(--foreground)] border-l-3 border-[#087F5B] pl-2">
                              “{gItem.exampleTr}”
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Mobil Uyumlu Esnek Aksiyon Alanı: İnceleme/Test + A4 PDF & WhatsApp Paylaşım */}
                      <div className="pt-2.5 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              setActiveGrammarModal({
                                grammarNote: gItem.rawNote,
                                dialogueId: gItem.dialogueId,
                                readingId: gItem.readingId,
                                sourceId: gItem.bagliId,
                                grammarTopic: gItem.grammarQuery,
                              });
                            }}
                            className="flex-1 min-w-[140px] min-h-[40px] py-2 px-3 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-black text-xs border-b-3 border-[#065F46] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                          >
                            <BookOpen size={14} className="lg:hidden shrink-0" />
                            <Columns2 size={14} className="hidden lg:inline shrink-0" />
                            <span>Notu &amp; Tabloyu Aç</span>
                          </button>

                          {gItem.kttUstKonu && (
                            <Link
                              href={`/seviye-tespit?mode=topic&topic=${encodeURIComponent(
                                gItem.kttUstKonu
                              )}`}
                              onClick={() => playClick()}
                              className="flex-1 min-w-[190px] min-h-[40px] py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs border-b-3 border-amber-700 flex items-center justify-center gap-1.5 transition-all"
                            >
                              <ListChecks size={14} className="shrink-0" />
                              <span>Bu Konunun Tarama Testini Çöz</span>
                            </Link>
                          )}

                          <Link
                            href={`/alistirmalar?pool=sentences_1111&grammar=${encodeURIComponent(
                              gItem.grammarQuery
                            )}`}
                            onClick={() => playClick()}
                            className="min-h-[40px] py-2 px-3 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/70 border-2 border-[#6741D9] border-b-3 text-[#6741D9] dark:text-indigo-200 font-extrabold text-xs flex items-center justify-center gap-1 transition-all"
                          >
                            <Gamepad2 size={13} />
                            <span>Alıştırma Yap</span>
                          </Link>

                          {(() => {
                            const linkedYt = getYoutubeRecommendationsByContentId(
                              gItem.bagliId
                            );
                            if (linkedYt.length === 0) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  playClick();
                                  stopAllAudio();
                                  setYoutubeModalItems(linkedYt);
                                }}
                                className="flex-1 min-w-[210px] min-h-[40px] py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs border-b-3 border-rose-800 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                              >
                                <span>🎬 İlgili Tavsiye Videoyu / Listeyi İzle</span>
                              </button>
                            );
                          })()}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              printSingleGrammarSheetPdf(gItem.rawNote);
                            }}
                            className="min-h-[40px] py-2 px-3 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#087F5B]/65 hover:border-[#087F5B] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[#065F46] dark:text-emerald-300 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                          >
                            <Printer size={14} className="shrink-0" />
                            <span>🖨️ A4 Ders Föyü (PDF)</span>
                          </button>

                          <a
                            href={
                              mounted
                                ? buildGrammarWhatsAppShareUrl(gItem.rawNote)
                                : buildGrammarWhatsAppShareUrl(
                                    gItem.rawNote,
                                    DEFAULT_GRAMMAR_ORIGIN
                                  )
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              playClick();
                              e.currentTarget.href =
                                buildGrammarWhatsAppShareUrl(gItem.rawNote);
                            }}
                            className="min-h-[40px] py-2 px-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border-2 border-[#1da851]/55 text-emerald-950 dark:text-emerald-200 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-all"
                          >
                            <MessageCircle
                              size={14}
                              className="text-[#1da851] shrink-0"
                            />
                            <span>📲 WhatsApp&apos;ta Paylaş</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {visibleCount < filteredGrammarAtlasItems.length && (
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setVisibleCount((prev) => prev + 36);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-xs border-b-3 border-[#065F46] cursor-pointer transition-all"
                  >
                    Daha Fazla Gramer Notu Göster (
                    {filteredGrammarAtlasItems.length - visibleCount} kaldı)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* BAĞIMSIZ GRAMER HAP BİLGİ PENCERESİ (YAN PANEL / AKILLI TAHTA MODU) */}
      <GrammarQuickModal
        isOpen={Boolean(activeGrammarModal)}
        onClose={() => setActiveGrammarModal(null)}
        grammarNote={activeGrammarModal?.grammarNote}
        dialogueId={activeGrammarModal?.dialogueId}
        readingId={activeGrammarModal?.readingId}
        sourceId={activeGrammarModal?.sourceId}
        grammarTopic={activeGrammarModal?.grammarTopic}
        onOpenShadowing={(ar) => setShadowingTarget({ text: ar })}
      />

      {/* 8. SEKME: 🎬 VİDEO & İZLEME REHBERİ (55 KAYIT + METODOLOJİ + 14 HARİCİ PLATFORM) */}
      {activeSection === "videolar" && (
        <section
          aria-label="Arapça Video ve İzleme Rehberi"
          className="space-y-4"
        >
          {/* EN ÜST: AÇILIR/KAPANIR "🧭 NASIL İZLEMELİYİM? & HARİCİ PLATFORMLAR REHBERİ" AKORDEON PANELİ */}
          <details className="group rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-gradient-to-br from-[#F7EFE1] via-[#FDFBF7] to-amber-50/50 dark:from-[var(--surface)] dark:via-[var(--surface)] dark:to-slate-900 shadow-xs overflow-hidden">
            <summary
              onClick={() => playClick()}
              className="list-none cursor-pointer p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none hover:bg-[#EFE3CE]/40 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-2xl bg-[#087F5B] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Compass size={22} />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-[var(--foreground)]">
                      🧭 Nasıl İzlemeliyim? &amp; Harici Platformlar Rehberi
                    </h2>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 border border-amber-300 text-amber-900 dark:text-amber-200 text-[10px] font-extrabold">
                      A1 → B2 Yol Haritası &amp;{" "}
                      {EXTERNAL_WATCH_PLATFORM_GROUPS.reduce(
                        (sum, g) => sum + g.platforms.length,
                        0
                      )}{" "}
                      Seçkin Arşiv
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[var(--muted)]">
                    Seviyelere göre günlük izleme metodolojisini ve SpaceToon, Learn with Zakaria, Khan Academy Arabi, Al Jazeera Learning, DW Documentary gibi{" "}
                    {EXTERNAL_WATCH_PLATFORM_GROUPS.reduce(
                      (sum, g) => sum + g.platforms.length,
                      0
                    )}{" "}
                    harici platformu görüntülemek için tıklayın.
                  </p>
                </div>
              </div>

              <span className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[#087F5B] dark:text-emerald-400 inline-flex items-center gap-1.5 shrink-0">
                <span className="group-open:hidden">Rehberi Aç</span>
                <span className="hidden group-open:inline">Rehberi Gizle</span>
                <ChevronDown
                  size={15}
                  className="transition-transform duration-200 group-open:rotate-180"
                />
              </span>
            </summary>

            <div className="p-4 sm:p-5 pt-1 border-t border-dashed border-[#E6D7BE] dark:border-[var(--border)] space-y-5">
              {/* BÖLÜM A: SEVİYELERE GÖRE İZLEME ROTASI VE METODOLOJİ */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#087F5B] text-white text-xs font-black">
                    1. Adım
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                    Seviyelere Göre İzleme Rotası ve Metodoloji
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                  {/* Başlangıç Seviyesi (A1-A2) */}
                  <div className="rounded-2xl border-2 border-emerald-300/90 dark:border-emerald-800 bg-white dark:bg-[var(--background)] p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white text-xs font-black">
                        Başlangıç Seviyesi (A1–A2)
                      </span>
                      <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                        🎨 Çizgi Diziler &amp; Animasyonlar
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[var(--foreground)] leading-relaxed">
                      Her gün düzenli <strong>20 dakikalık</strong> kısa çizgi dizi bölümleriyle (<em>Baraaem</em>, <em>Nan ve Lili</em>, <em>Heidi</em>, <em>Sali</em>, <em>Favvaz ve Nura</em>) fasih Arapça kulak aşinalığı kazanın. Her kelimeyi sözlükten bakmak yerine görsel bağlamdan sezmeye odaklanın; <strong>30–40 bölüm</strong> izledikten sonra uzun metrajlı animasyonlara geçiş yapın.
                    </p>
                  </div>

                  {/* Orta Seviye (B1) */}
                  <div className="rounded-2xl border-2 border-[#6741D9]/45 dark:border-indigo-700 bg-white dark:bg-[var(--background)] p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#6741D9] text-white text-xs font-black">
                        Orta Seviye (B1)
                      </span>
                      <span className="text-xs font-extrabold text-[#6741D9] dark:text-indigo-300">
                        🏛️ Kıssalar, Diziler &amp; Sohbetler
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[var(--foreground)] leading-relaxed">
                      <em>Kelile ve Dimne</em>, <em>Kur&apos;an Kıssaları</em>, fasih dublajlı <em>Diriliş Ertuğrul</em>, <em>Yunus Emre</em>, <em>Selahaddin Eyyubi</em>, <em>Ahmed b. Hanbel</em> ve <em>Siyer / Riyâzü&apos;s-Sâlihîn</em> dersleriyle devam edin. Bu serilerle yeterli kulak dolgunluğu oluştuktan sonra, tarihî diziler içinde <strong>en fasih ve edebî dile sahip olan <em>Hz. Ömer</em> dizisine</strong> geçin.
                    </p>
                  </div>

                  {/* İleri Seviye (B2) */}
                  <div className="rounded-2xl border-2 border-amber-400/80 dark:border-amber-700 bg-white dark:bg-[var(--background)] p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-600 text-white text-xs font-black">
                        İleri Seviye (B2)
                      </span>
                      <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300">
                        🌍 İslâmî İlimler &amp; Basın
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[var(--foreground)] leading-relaxed">
                      <em>Ramazan el-Bûtî</em> ve <em>Nâbulsî</em> tefsir/akîde dersleri, <em>Al Jazeera</em> ve <em>BBC Arapça</em> belgeselleri (<em>Endülüs</em>, <em>Nekbe</em>, <em>El-Ezher</em>) ile <em>Bilâ Hudûd</em> ve <em>eş-Şerîa ve&apos;l-Hayât</em> tartışma programlarını takip ederek çağdaş basın, diplomasi ve akademi ıstılahlarını kazanın.
                    </p>
                  </div>
                </div>
              </div>

              {/* BÖLÜM B: SEÇKİN HARİCİ İZLEME VE ARŞİV PLATFORMLARI */}
              <div className="space-y-3 pt-2 border-t border-dashed border-[#E6D7BE] dark:border-[var(--border)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#6741D9] text-white text-xs font-black">
                      2. Adım
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                      Seçkin Harici İzleme ve Arşiv Platformları
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-[var(--muted)]">
                    Yeni sekmede açılan güvenilir Arapça medya ve arşiv kaynakları
                  </span>
                </div>

                <div className="space-y-3.5">
                  {EXTERNAL_WATCH_PLATFORM_GROUPS.map((group) => (
                    <div key={group.id} className="space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#065F46] dark:text-emerald-400 flex items-center gap-1.5">
                        <span>{group.emoji}</span>
                        <span>{group.title}</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {group.platforms.map((plat) => (
                          <a
                            key={plat.url}
                            href={plat.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => playClick()}
                            className="group/plat rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] bg-white dark:bg-[var(--background)] p-3 flex items-start justify-between gap-2.5 transition-all shadow-2xs"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] group-hover/plat:text-[#087F5B] transition-colors">
                                  {plat.name}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-[#F7EFE1] dark:bg-[var(--surface)] text-[10px] font-bold text-[var(--muted)]">
                                  {plat.badge}
                                </span>
                              </div>
                              <p className="text-[11px] font-medium text-[var(--muted)] leading-snug">
                                {plat.description}
                              </p>
                            </div>
                            <ExternalLink
                              size={14}
                              className="text-[var(--muted)] group-hover/plat:text-[#087F5B] shrink-0 mt-0.5"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>

          {/* FİLTRE PANELİ: ARAMA + CEFR SEVİYE + 6 TEMATİK KATEGORİ + TÜR/İZLENEN ALT FİLTRESİ */}
          <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-3 sm:p-3.5 space-y-2.5">
            {/* Satır 1: Arama + Seviye Seçici (Tümü | A1 | A2 | B1 | B2) */}
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setVisibleCount(36);
                  }}
                  placeholder="Video adı, Arapça başlık, kanal, odak kelime veya konu ara..."
                  className="w-full h-9 bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] rounded-xl pl-8 pr-8 text-xs font-semibold text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#087F5B]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                    aria-label="Aramayı Temizle"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] items-center gap-1 shrink-0">
                {(["all", "A1", "A2", "B1", "B2"] as (Level | "all")[]).map(
                  (lvl) => {
                    const active = levelFilter === lvl;
                    const count = youtubeCounts.byLevel[lvl] || 0;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => {
                          playClick();
                          setLevelFilter(lvl);
                          setVisibleCount(36);
                        }}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                          active
                            ? "bg-[#087F5B] text-white font-extrabold shadow-2xs"
                            : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                        }`}
                      >
                        {lvl === "all" ? `Tümü (${count})` : `${lvl} (${count})`}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Satır 2: 6 Tematik YoutubeCategory Filtresi (Mobilde iç boşluklu yatay kaydırma, masaüstünde kesilmeyen flex-wrap) */}
            <div className="relative max-w-full">
              <div className="flex overflow-x-auto md:overflow-visible md:flex-wrap no-scrollbar whitespace-nowrap md:whitespace-normal items-center gap-1.5 py-1 px-1.5 pr-7 md:px-0 md:pr-0 max-w-full">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setYoutubeCategoryFilter("all");
                    setVisibleCount(36);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                    youtubeCategoryFilter === "all"
                      ? "bg-[#6741D9] border-[#4C28B5] text-white shadow-2xs"
                      : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Tüm Kategoriler ({youtubeCounts.byCategory.all})
                </button>

                {YOUTUBE_CATEGORY_ORDER.map((catId) => {
                  const meta = YOUTUBE_CATEGORY_META[catId];
                  const active = youtubeCategoryFilter === catId;
                  const count = youtubeCounts.byCategory[catId] || 0;
                  return (
                    <button
                      key={catId}
                      type="button"
                      onClick={() => {
                        playClick();
                        setYoutubeCategoryFilter(catId);
                        setVisibleCount(36);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-all inline-flex items-center gap-1 ${
                        active
                          ? "bg-[#6741D9] border-[#4C28B5] text-white shadow-2xs"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#6741D9]"
                      }`}
                    >
                      <span>{meta.emoji}</span>
                      <span>{meta.shortLabel}</span>
                      <span className="opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>
              <span
                aria-hidden="true"
                className="md:hidden pointer-events-none absolute inset-y-0.5 right-0 w-6 bg-gradient-to-l from-[#FDFBF7] via-[#FDFBF7]/85 to-transparent dark:from-[var(--surface)] dark:via-[var(--surface)]/85 flex items-center justify-end pr-0.5 text-[var(--muted)]"
              >
                <ChevronRight size={12} className="opacity-75" />
              </span>
            </div>

            {/* Satır 3: Tür & İzlenme Durumu Alt Filtresi (Tümü | Tekil Videolar | Oynatma Listeleri | İzlediklerim) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
              <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap items-center gap-1.5">
                {(
                  [
                    {
                      id: "all",
                      label: `Tümü (${
                        youtubeCounts.videoOnly + youtubeCounts.playlistOnly
                      })`,
                      icon: null,
                    },
                    {
                      id: "video",
                      label: `Tekil Videolar (${youtubeCounts.videoOnly})`,
                      icon: <Film size={13} />,
                    },
                    {
                      id: "playlist",
                      label: `Oynatma Listeleri (${youtubeCounts.playlistOnly})`,
                      icon: <ListVideo size={13} />,
                    },
                    {
                      id: "watched",
                      label: `İzlediklerim (${youtubeCounts.watchedCount})`,
                      icon: <CheckCircle2 size={13} />,
                    },
                  ] as {
                    id: YoutubeSubFilter;
                    label: string;
                    icon: React.ReactNode;
                  }[]
                ).map((sub) => {
                  const active = youtubeKindFilter === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        playClick();
                        setYoutubeKindFilter(sub.id);
                        setVisibleCount(36);
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                        active
                          ? "bg-[#087F5B] border-[#065F46] text-white font-extrabold shadow-2xs"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {sub.icon}
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>

              <span className="text-[11px] font-extrabold text-[var(--muted)]">
                Gösterilen: <strong>{filteredYoutubeItems.length}</strong> içerik
              </span>
            </div>
          </div>

          {/* KART IZGARASI (SIFIR GECİKMELİ LITE YOUTUBE KARTLARI) */}
          {filteredYoutubeItems.length === 0 ? (
            <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] border-b-4 p-10 text-center space-y-3">
              <p className="text-base font-extrabold text-[var(--foreground)]">
                Seçtiğiniz filtrelere uygun video veya oynatma listesi bulunamadı.
              </p>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setSearch("");
                  setLevelFilter("all");
                  setYoutubeCategoryFilter("all");
                  setYoutubeKindFilter("all");
                }}
                className="px-4 py-2 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold cursor-pointer"
              >
                Filtreleri Temizle
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredYoutubeItems.slice(0, visibleCount).map((ytItem) => (
                  <LiteYoutubeCard
                    key={ytItem.id}
                    item={ytItem}
                    onOpenCinemaModal={(selected) =>
                      setYoutubeModalItems([selected])
                    }
                  />
                ))}
              </div>

              {visibleCount < filteredYoutubeItems.length && (
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setVisibleCount((prev) => prev + 36);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-xs border-b-3 border-[#065F46] cursor-pointer transition-all"
                  >
                    Daha Fazla Video Göster (
                    {filteredYoutubeItems.length - visibleCount} kaldı)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* EŞ & ZIT ANLAMLILAR (المرادفات والأضداد) BÖLÜMÜ */}
      {activeSection === "es-zit" && (
        <section
          aria-label="Eş ve Zıt Anlamlı Kelimeler"
          className="space-y-4"
        >
          {/* Üst Bilgi Bandı */}
          <div className="rounded-2xl border-2 border-emerald-400/70 dark:border-emerald-800/70 border-b-4 bg-gradient-to-r from-[#F7EFE1] via-emerald-50/70 to-amber-50/50 dark:from-[var(--surface)] dark:via-emerald-950/25 dark:to-amber-950/20 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-[#087F5B] text-white text-xs font-extrabold">
                  🔄 المرادفات والأضداد
                </span>
                <h2 className="text-sm sm:text-base font-black text-[var(--foreground)]">
                  Eş &amp; Zıt Anlamlılar ve الفروق اللغوية (İnce Anlam Farkları)
                </h2>
              </div>
              <p className="text-xs font-medium text-[var(--muted)]">
                Rozetlere tıklayarak telaffuzları dinleyebilir,{" "}
                <strong className="text-emerald-700 dark:text-emerald-300">
                  💡 الفروق
                </strong>{" "}
                düğmesiyle eş anlamlılar arasındaki bağlamsal farkları inceleyebilir ve zorlandığınız kelimeleri{" "}
                <strong>Defterim</strong> veya <strong>Hata Defteri</strong>&apos;ne ekleyebilirsiniz.
              </p>
            </div>
            <div className="text-xs font-extrabold text-[var(--muted)] shrink-0">
              Gösterilen:{" "}
              <strong className="text-[var(--foreground)]">
                {filteredSynonymsAntonyms.length}
              </strong>{" "}
              / {contentStats.synonymsAntonymsCount} madde
            </div>
          </div>

          {filteredSynonymsAntonyms.length === 0 ? (
            <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-10 text-center space-y-3">
              <p className="text-base font-extrabold text-[var(--foreground)]">
                Aradığınız kriterlere uygun eş veya zıt anlamlı kelime bulunamadı.
              </p>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setSearch("");
                  setLevelFilter("all");
                  setSynTurFilter("all");
                }}
                className="px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-3 border-[#065F46] cursor-pointer"
              >
                Filtreleri Temizle
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSynonymsAntonyms
                  .slice(0, visibleCount)
                  .map((entry) => {
                    const dictItem = synonymEntryToDictionaryItem(entry);
                    const isSaved = mounted && favoriteIdsSet.has(dictItem.id);
                    const inMistakes =
                      mounted &&
                      (mistakeIdsSet.has(entry.id) ||
                        mistakeIdsSet.has(`mc_${entry.id}`) ||
                        mistakeIdsSet.has(`mg_${entry.id}`) ||
                        mistakeIdsSet.has(`fill_${entry.id}`));

                    return (
                      <article
                        key={entry.id}
                        className="rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 flex flex-col justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-3">
                          {/* Üst Başlık: Kelime + Ses + Tür/Kur Rozetleri */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-[#087F5B] text-white text-[11px] font-black">
                                  {entry.cefr}
                                </span>
                                <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-[11px] font-extrabold text-[#4C28B5] dark:text-indigo-300">
                                  {getSynonymTurLabel(entry.tur)}
                                </span>
                                <span className="text-[11px] font-bold text-[var(--muted)]">
                                  #{entry.sira}
                                </span>
                              </div>
                              <p className="text-sm sm:text-base font-black text-[var(--foreground)] leading-snug">
                                {entry.anlam_tr}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  playClick();
                                  void speakHybrid({
                                    text: entry.kelime_ar,
                                    rate: speechRate,
                                    voice:
                                      preferredVoiceGender === "kadin"
                                        ? "ar-SA-ZariyahNeural"
                                        : "ar-SA-HamedNeural",
                                  });
                                }}
                                title="Ana kelimeyi seslendir"
                                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] hover:border-[#087F5B] flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Volume2
                                  size={16}
                                  className="text-[#087F5B] shrink-0"
                                />
                                <span
                                  lang="ar"
                                  dir="rtl"
                                  className="arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-300 leading-normal"
                                >
                                  {getDisplayArabic(entry.kelime_ar)}
                                </span>
                              </button>
                            </div>
                          </div>

                          {/* Eş Anlamlıları (المرادفات) */}
                          {entry.es_anlamlilar.length > 0 && (
                            <div className="rounded-xl bg-emerald-50/85 dark:bg-emerald-950/35 border border-emerald-300/80 dark:border-emerald-800/70 p-2.5 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wide">
                                  🔄 Eş Anlamlıları (المرادفات)
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {entry.es_anlamlilar.map((syn, idx) => {
                                  const nuanceKey = `${entry.id}_syn_${idx}`;
                                  const isNuanceOpen = Boolean(
                                    openSynNuanceMap[nuanceKey]
                                  );
                                  return (
                                    <div
                                      key={nuanceKey}
                                      className="inline-flex flex-col gap-1 max-w-full"
                                    >
                                      <div className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-[var(--background)] border border-emerald-400/80 dark:border-emerald-700 shadow-2xs">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            playClick();
                                            void speakHybrid({
                                              text: syn.ar,
                                              rate: speechRate,
                                              voice:
                                                preferredVoiceGender === "kadin"
                                                  ? "ar-SA-ZariyahNeural"
                                                  : "ar-SA-HamedNeural",
                                            });
                                          }}
                                          className="inline-flex items-center gap-1.5 cursor-pointer hover:opacity-85"
                                          title="Eş anlamlıyı dinle"
                                        >
                                          <Volume2
                                            size={13}
                                            className="text-emerald-700 dark:text-emerald-400 shrink-0"
                                          />
                                          <span
                                            lang="ar"
                                            dir="rtl"
                                            className="arabic text-lg sm:text-xl font-bold text-emerald-900 dark:text-emerald-200"
                                          >
                                            {getDisplayArabic(syn.ar)}
                                          </span>
                                          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                            ({syn.tr})
                                          </span>
                                        </button>

                                        {syn.nuans_tr && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              playClick();
                                              setOpenSynNuanceMap((prev) => ({
                                                ...prev,
                                                [nuanceKey]: !prev[nuanceKey],
                                              }));
                                            }}
                                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black cursor-pointer transition-colors ${
                                              isNuanceOpen
                                                ? "bg-emerald-700 text-white"
                                                : "bg-emerald-100 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-200"
                                            }`}
                                          >
                                            💡 الفروق
                                          </button>
                                        )}
                                      </div>

                                      {syn.nuans_tr && isNuanceOpen && (
                                        <div className="px-2.5 py-1.5 rounded-lg bg-emerald-100/90 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-[11px] font-semibold text-emerald-950 dark:text-emerald-100 leading-relaxed">
                                          <strong className="font-black">
                                            İnce Anlam Farkı:{" "}
                                          </strong>
                                          <MixedText text={syn.nuans_tr} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Zıt Anlamlıları (الأضداد) */}
                          {entry.zit_anlamlilar.length > 0 && (
                            <div className="rounded-xl bg-amber-50/85 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/70 p-2.5 space-y-2">
                              <span className="block text-[11px] font-black text-amber-900 dark:text-amber-300 uppercase tracking-wide">
                                ⚡ Zıt Anlamlıları (الأضداد)
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {entry.zit_anlamlilar.map((ant, idx) => (
                                  <button
                                    key={`${entry.id}_ant_${idx}`}
                                    type="button"
                                    onClick={() => {
                                      playClick();
                                      void speakHybrid({
                                        text: ant.ar,
                                        rate: speechRate,
                                        voice:
                                          preferredVoiceGender === "kadin"
                                            ? "ar-SA-ZariyahNeural"
                                            : "ar-SA-HamedNeural",
                                      });
                                    }}
                                    title="Zıt anlamlıyı dinle"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-[var(--background)] border border-amber-400/85 dark:border-amber-700 hover:border-amber-600 cursor-pointer shadow-2xs transition-colors"
                                  >
                                    <Volume2
                                      size={13}
                                      className="text-amber-700 dark:text-amber-400 shrink-0"
                                    />
                                    <span
                                      lang="ar"
                                      dir="rtl"
                                      className="arabic text-lg sm:text-xl font-bold text-amber-950 dark:text-amber-200"
                                    >
                                      {getDisplayArabic(ant.ar)}
                                    </span>
                                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                                      ({ant.tr})
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Karşılaştırmalı Örnek Cümle */}
                          {entry.ornek_cumle_ar && (
                            <div className="rounded-xl bg-white/90 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-extrabold text-[#6741D9] dark:text-indigo-300">
                                  📖 Karşılaştırmalı Örnek Cümle
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    playClick();
                                    void speakHybrid({
                                      text: entry.ornek_cumle_ar,
                                      rate: speechRate,
                                      voice:
                                        preferredVoiceGender === "kadin"
                                          ? "ar-SA-ZariyahNeural"
                                          : "ar-SA-HamedNeural",
                                    });
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-[#F3F0FF] dark:bg-indigo-950/50 border border-[#6741D9]/30 text-[11px] font-extrabold text-[#4C28B5] dark:text-indigo-200 inline-flex items-center gap-1 cursor-pointer hover:bg-[#E5DBFF]"
                                >
                                  <Volume2 size={12} />
                                  <span>Cümleyi Dinle</span>
                                </button>
                              </div>
                              <p
                                lang="ar"
                                dir="rtl"
                                className="arabic text-xl sm:text-2xl font-bold text-[var(--foreground)] leading-loose text-right"
                              >
                                {getDisplayArabic(entry.ornek_cumle_ar)}
                              </p>
                              <p className="text-xs font-semibold text-[var(--muted)] leading-relaxed">
                                {entry.ornek_cumle_tr}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Alt Aksiyon Butonları: Çalışma Defterime Ekle + Hata Defterime Ekle */}
                        <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6D7BE]/80 dark:border-[var(--border)]">
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              toggleFavoriteWord(dictItem);
                            }}
                            className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                              isSaved
                                ? "bg-rose-600 border-rose-700 text-white"
                                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-rose-700 dark:text-rose-300 hover:border-rose-500"
                            }`}
                          >
                            <Heart
                              size={14}
                              className={isSaved ? "fill-white" : ""}
                            />
                            <span>
                              {isSaved
                                ? "Çalışma Defterimde"
                                : "Çalışma Defterime Ekle"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              if (inMistakes) {
                                removeMistake(entry.id);
                              } else {
                                addMistake(entry.id);
                              }
                            }}
                            className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                              inMistakes
                                ? "bg-amber-600 border-amber-700 text-white"
                                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-amber-800 dark:text-amber-300 hover:border-amber-500"
                            }`}
                          >
                            <AlertTriangle size={14} />
                            <span>
                              {inMistakes
                                ? "⚡ Hata Defterinde"
                                : "⚡ Hata Defterime Ekle"}
                            </span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>

              {visibleCount < filteredSynonymsAntonyms.length && (
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setVisibleCount((prev) => prev + 36);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-xs border-b-3 border-[#065F46] cursor-pointer transition-all"
                  >
                    Daha Fazla Göster (
                    {filteredSynonymsAntonyms.length - visibleCount} kayıt kaldı)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* GENİŞ SİNEMA MODU YOUTUBE OYNATICI MODALI */}
      {youtubeModalItems && youtubeModalItems.length > 0 && (
        <YoutubePlayerModal
          items={youtubeModalItems}
          onClose={() => setYoutubeModalItems(null)}
        />
      )}

      {shareCardTarget && (
        <ShareContentCardModal
          payload={shareCardTarget}
          onClose={() => setShareCardTarget(null)}
        />
      )}
    </div>
  );
}