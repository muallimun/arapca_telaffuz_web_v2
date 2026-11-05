"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
} from "lucide-react";
import {
  diyaloglar,
  metinler,
  cumleler1111,
  atasozleri,
  gorselKelimeler,
  getDialogueCoverUrl,
  getReadingTextCoverUrl,
  getProverbCoverUrl,
  getVisualWordCoverUrl,
} from "@/lib/data";
import { Level, DictionaryItem } from "@/types/data";
import { extractDialogueVocabulary, cleanArabicText } from "@/lib/dict";
import { normalizeArabicText } from "@/lib/arabicTextUtils";
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
import ShadowingModal from "@/components/ui/ShadowingModal";
import WordTooltip from "@/components/ui/WordTooltip";

type StatusFilter = "all" | "completed" | "ongoing" | "favorites";
type ViewSection =
  | "dialogues"
  | "metinler"
  | "cumleler"
  | "atasozleri"
  | "gorsel-kelimeler"
  | "saved-words"
  | "weak-words";

export default function LibraryPage() {
  const {
    favoriteDialogues,
    completedDialogues,
    favoriteWords,
    weakWords,
    toggleFavoriteDialogue,
    toggleCompletedDialogue,
    toggleFavoriteWord,
    removeWeakWord,
  } = useUserStore();

  const {
    showHareke,
    speechRate,
    preferredVoiceGender,
    setPreferredVoiceGender,
  } = useSettings();

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCategoryPanelOpen, setIsCategoryPanelOpen] =
    useState<boolean>(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(
    null
  );
  const touchStartXRef = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState<ViewSection>("dialogues");
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

  useEffect(() => {
    void loadAudioManifest().then(() => {
      void getDownloadedDialogueIds().then((ids) => setOfflineIds(ids));
    });
    const raf = requestAnimationFrame(() => {
      setMounted(true);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const lvl = params.get("seviye") as Level | null;
        const durum = params.get("durum");
        const tab = params.get("tab");
        if (lvl && ["A1", "A2", "B1", "B2"].includes(lvl)) {
          setLevelFilter(lvl);
        }
        if (durum === "completed") {
          setStatusFilter("completed");
        }
        if (tab) {
          if (tab === "diyaloglar" || tab === "dialogues") {
            setActiveSection("dialogues");
          } else if (
            [
              "metinler",
              "cumleler",
              "atasozleri",
              "gorsel-kelimeler",
              "saved-words",
              "weak-words",
            ].includes(tab)
          ) {
            setActiveSection(tab as ViewSection);
          }
        }
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      sequentialTokenRef.current += 1;
      stopAllAudio();
    };
  }, []);

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
    setIsCategoryPanelOpen(false);
    setSelectedCardIndex(null);
    setVisibleCount(36);
  };

  const handleDownloadDialogueCardOffline = async (dlgId: string) => {
    if (downloadingId) return;
    playClick();
    setDownloadingId(dlgId);
    setDownloadingPct(5);
    const ok = await downloadDialogueOfflinePack(dlgId, (pct) => {
      setDownloadingPct(pct);
    });
    setDownloadingId(null);
    if (ok) {
      setOfflineIds((prev) => (prev.includes(dlgId) ? prev : [...prev, dlgId]));
      playSuccess();
    }
  };

  const removeTashkeel = (text: string) => text.replace(/[\u064B-\u0652]/g, "");
  const getDisplayArabic = (text: string) =>
    !mounted || showHareke ? text : removeTashkeel(text);

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
        const matchId = dlg.id.replace("dlg_", "").includes(q);
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

  // 5. 999 Görsel Kelime Filtreleme
  const visualCategories = useMemo(() => {
    return Array.from(
      new Set(gorselKelimeler.map((g) => g.kategori_tr).filter(Boolean))
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
        if (g.kategori_tr) {
          counts[g.kategori_tr] = (counts[g.kategori_tr] || 0) + 1;
        }
      });
    }
    return counts;
  }, [activeSection, levelFilter]);

  const filteredVisualWords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = cleanArabicText(search.trim());
    const normQ = normalizeArabicText(search.trim());

    return gorselKelimeler.filter((g) => {
      if (levelFilter !== "all" && g.cefr !== levelFilter) return false;
      if (categoryFilter !== "all" && g.kategori_tr !== categoryFilter)
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
  }, [search, levelFilter, categoryFilter]);

  const activeModalListLength =
    activeSection === "cumleler"
      ? filteredSentences.length
      : activeSection === "atasozleri"
      ? filteredProverbs.length
      : activeSection === "gorsel-kelimeler"
      ? filteredVisualWords.length
      : 0;

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
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedCardIndex(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCardIndex, activeModalListLength]);

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
    categoryFilter !== "all";

  const isDualGenderSection =
    activeSection === "cumleler" ||
    activeSection === "atasozleri" ||
    activeSection === "gorsel-kelimeler";

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* GÖLGELEME MODALI */}
      {shadowingTarget && (
        <ShadowingModal
          text={shadowingTarget.text}
          refAudioUrl={shadowingTarget.refAudioUrl}
          forms={shadowingTarget.forms}
          onClose={() => setShadowingTarget(null)}
        />
      )}

      {/* TEKİL KART ÇALIŞMA MODALI (İLERİ / GERİ NAVİGASYONLU — 999 Görsel Kelime, 508 Atasözü, 1111 Cümle) */}
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
          const imageUrl = currentVisual
            ? getVisualWordCoverUrl(currentVisual)
            : currentProverb
            ? getProverbCoverUrl(currentProverb.id)
            : null;
          const fallbackUrl = currentVisual
            ? "/gorseller/kelimeler/gorsel_0001.webp"
            : "/gorseller/atasozleri/ata_0001.webp";

          const headerBadge = currentVisual
            ? `#${currentVisual.id.replace("gorsel_", "")} • ${
                currentVisual.cefr
              } • ${currentVisual.kategori_tr}`
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
              className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4"
              onClick={() => setSelectedCardIndex(null)}
            >
              <div
                className="relative max-w-lg w-full max-h-[92vh] flex flex-col bg-[#FDFBF7] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => {
                  touchStartXRef.current = e.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(e) => {
                  if (touchStartXRef.current === null) return;
                  const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
                  const deltaX = endX - touchStartXRef.current;
                  touchStartXRef.current = null;
                  if (deltaX > 50) {
                    goPrev();
                  } else if (deltaX < -50) {
                    goNext();
                  }
                }}
              >
                {/* 1. Üst Başlık Barı */}
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#F7EFE1] dark:bg-[var(--background)] border-b border-[#E6D7BE] dark:border-[var(--border)] shrink-0">
                  <span className="px-2.5 py-1 rounded-xl bg-[#087F5B] text-white text-[11px] font-extrabold truncate">
                    {headerBadge}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] text-xs font-extrabold tabular-nums text-[var(--foreground)]">
                      {safeIndex + 1} / {activeModalListLength}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setSelectedCardIndex(null);
                      }}
                      className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-[var(--surface)] hover:bg-rose-50 border-2 border-[#E6D7BE] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1 cursor-pointer"
                    >
                      <X size={15} />
                      <span>Kapat</span>
                    </button>
                  </div>
                </div>

                {/* 2 & 3. Kaydırılabilir Orta İçerik: 1:1 Kare Görsel + Pedagojik Detaylar */}
                <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
                  {imageUrl && (
                    <div className="aspect-square w-full max-w-[260px] sm:max-w-[320px] mx-auto rounded-2xl overflow-hidden border-2 border-[#E6D7BE] bg-white shadow-sm relative">
                      <img
                        src={imageUrl}
                        alt={activeItem.turkce}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (!img.src.endsWith(fallbackUrl)) {
                            img.src = fallbackUrl;
                          }
                        }}
                        className="w-full h-full object-cover"
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
                    </div>
                  )}

                  {/* Harekeli Arapça Odak Kutusu */}
                  <div
                    dir="rtl"
                    className="arabic font-arabic text-3xl sm:text-4xl font-bold text-[#065F46] dark:text-emerald-400 text-center leading-[1.95] bg-white dark:bg-[var(--background)] rounded-2xl p-3.5 border-2 border-[#E6D7BE] shadow-2xs"
                  >
                    <WordTooltip
                      text={activeItem.arapca}
                      contextSentenceTr={activeItem.turkce}
                    />
                  </div>

                  {/* Türkçe Anlam ve Modüle Özel Pedagojik Bilgiler */}
                  <div className="bg-[#F7EFE1] dark:bg-[var(--background)] rounded-2xl p-3.5 border border-[#E6D7BE] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-base sm:text-lg font-extrabold text-[var(--foreground)]">
                        {activeItem.turkce}
                      </p>
                      {currentSentence?.odak_kalip && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 text-amber-900 dark:text-amber-200 text-xs font-extrabold">
                          📌 {currentSentence.odak_kalip}
                        </span>
                      )}
                    </div>

                    {currentVisual &&
                      (currentVisual.ikincil_form ||
                        currentVisual.ucuncul_form) && (
                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--muted)] border-t border-dashed border-[#E2D3B8] pt-2">
                          {currentVisual.ikincil_form &&
                            currentVisual.ikincil_form !== "-" && (
                              <span>
                                {currentVisual.tur === "fiil"
                                  ? "Muzâri:"
                                  : "Çoğul:"}{" "}
                                <strong
                                  dir="rtl"
                                  className="arabic font-arabic text-base text-[var(--foreground)]"
                                >
                                  {getDisplayArabic(currentVisual.ikincil_form)}
                                </strong>
                              </span>
                            )}
                          {currentVisual.ucuncul_form &&
                            currentVisual.ucuncul_form !== "-" && (
                              <span>
                                Masdar:{" "}
                                <strong
                                  dir="rtl"
                                  className="arabic font-arabic text-base text-[var(--foreground)]"
                                >
                                  {getDisplayArabic(currentVisual.ucuncul_form)}
                                </strong>
                              </span>
                            )}
                        </div>
                      )}

                    {currentProverb?.lafzi_ceviri && (
                      <p className="text-xs font-semibold text-[var(--muted)] border-t border-dashed border-[#E2D3B8] pt-2">
                        <strong className="text-[var(--foreground)]">
                          Lafzî Çeviri:
                        </strong>{" "}
                        {currentProverb.lafzi_ceviri}
                      </p>
                    )}

                    {currentProverb?.kullanim_baglami && (
                      <div className="rounded-xl bg-white/85 dark:bg-[var(--surface)] px-3 py-2 border border-[#E6D7BE] text-xs font-semibold text-slate-700 dark:text-slate-300">
                        💡 <strong>Kullanım Bağlamı:</strong>{" "}
                        {currentProverb.kullanim_baglami}
                      </div>
                    )}

                    {currentVisual?.ornek_ar && (
                      <div className="bg-white dark:bg-[var(--surface)] rounded-xl p-3 border border-[#E6D7BE] space-y-1.5 mt-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold uppercase text-[#6741D9]">
                            Örnek Cümle
                          </span>
                          <button
                            type="button"
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
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-[#087F5B]/40 text-[11px] font-extrabold text-[#065F46] dark:text-emerald-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Volume2 size={12} />
                            <span>🔊 Örnek Cümleyi Dinle</span>
                          </button>
                        </div>
                        <div
                          dir="rtl"
                          className="arabic font-arabic text-xl sm:text-2xl font-bold text-[var(--foreground)] text-right leading-[1.9]"
                        >
                          <WordTooltip
                            text={currentVisual.ornek_ar}
                            contextSentenceTr={
                              currentVisual.ornek_tr || currentVisual.turkce
                            }
                          />
                        </div>
                        {currentVisual.ornek_tr && (
                          <p className="text-xs font-semibold text-[var(--muted)]">
                            {currentVisual.ornek_tr}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4. Ses ve Telaffuz Aksiyon Satırı */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleListenDualGender(activeItem)}
                      className={`flex-1 min-h-[44px] px-3.5 rounded-xl border-2 border-b-3 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isItemPlaying
                          ? "bg-[#087F5B] border-[#065F46] text-white"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)] hover:border-[#087F5B]"
                      }`}
                    >
                      <Volume2
                        size={16}
                        className={
                          isItemPlaying ? "text-white" : "text-[#065F46]"
                        }
                      />
                      <span>
                        {isItemPlaying
                          ? "Dinleniyor..."
                          : `🔊 Dinle (${
                              mounted && preferredVoiceGender === "kadin"
                                ? "👩 Kadın"
                                : "👨 Erkek"
                            })`}
                      </span>
                    </button>

                    <div className="flex items-center bg-[#F7EFE1] dark:bg-[var(--background)] p-1 rounded-xl border-2 border-[#E6D7BE] shrink-0">
                      {(
                        [
                          { id: "erkek", label: "👨" },
                          { id: "kadin", label: "👩" },
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
                            className={`min-h-[34px] px-2.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                              active
                                ? "bg-[#087F5B] text-white"
                                : "text-[var(--muted)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {g.label}
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
                      className="min-h-[44px] px-4 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/75 border-2 border-[#6741D9] border-b-3 text-xs sm:text-sm font-extrabold text-[#6741D9] dark:text-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Mic size={16} />
                      <span>🎙️ Telaffuz Et</span>
                    </button>
                  </div>
                </div>

                {/* 5. Alt İleri / Geri Navigasyon Barı (Başparmak Ergonomisi) */}
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#F7EFE1] dark:bg-[var(--background)] border-t border-[#E6D7BE] dark:border-[var(--border)] shrink-0">
                  <button
                    type="button"
                    onClick={goPrev}
                    className="min-h-[44px] px-4 rounded-xl bg-white dark:bg-[var(--surface)] hover:bg-[#EFE3CE] border-2 border-[#E6D7BE] border-b-3 text-xs sm:text-sm font-extrabold text-[var(--foreground)] flex items-center gap-1.5 cursor-pointer active:translate-y-0.5"
                  >
                    <ChevronLeft size={16} />
                    <span>Önceki</span>
                  </button>

                  <span className="text-xs sm:text-sm font-extrabold tabular-nums text-[var(--muted)]">
                    {safeIndex + 1} / {activeModalListLength}
                  </span>

                  <button
                    type="button"
                    onClick={goNext}
                    className="min-h-[44px] px-4 rounded-xl bg-[#087F5B] hover:bg-[#065F46] border-2 border-[#065F46] border-b-3 text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5 cursor-pointer active:translate-y-0.5"
                  >
                    <span>Sonraki</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ÜST BAŞLIK & V2 MODÜL SEÇİCİ */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              onClick={() => playClick()}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 flex items-center justify-center text-[var(--foreground)] hover:bg-[#EFE3CE] active:border-b-2 active:translate-y-0.5 transition-all shrink-0"
              aria-label="Ana Sayfaya Dön"
            >
              <ChevronLeft size={19} strokeWidth={2.5} />
            </Link>
            <div>
              <h1 className="text-lg sm:text-2xl font-extrabold text-[var(--foreground)] tracking-tight leading-tight">
                Eğitim Kütüphanesi (V2)
              </h1>
              <p className="text-[11px] sm:text-xs font-medium text-[var(--muted)]">
                120 diyalog, 60 okuma metni, 1111 cümle, 508 atasözü ve 999
                görsel kelime
              </p>
            </div>
          </div>

          {/* Çift Cinsiyetli Seslendirici Seçici (1111 Cümle, 508 Atasözü ve Görsel Kelimeler için) */}
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

        {/* V2 Modül Sekmeleri */}
        <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 border-2 border-[#E6D7BE] dark:border-[var(--border)] flex overflow-x-auto no-scrollbar items-center gap-1 max-w-full">
          {(
            [
              {
                id: "dialogues",
                label: `💬 Diyaloglar (${diyaloglar.length})`,
              },
              {
                id: "metinler",
                label: `📖 Metinler (${metinler.length})`,
              },
              {
                id: "cumleler",
                label: `🗣️ 1111 Cümle (${cumleler1111.length})`,
              },
              {
                id: "atasozleri",
                label: `📜 Atasözleri (${atasozleri.length})`,
              },
              {
                id: "gorsel-kelimeler",
                label: `🖼️ Görsel Kelime (${gorselKelimeler.length})`,
              },
              {
                id: "saved-words",
                label: `❤️ Defterim (${mounted ? favoriteWords.length : 0})`,
              },
              {
                id: "weak-words",
                label: `🎯 Mahreç (${mounted ? weakWords.length : 0})`,
              },
            ] as { id: ViewSection; label: string }[]
          ).map((tab) => {
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSwitchSection(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? "bg-[#087F5B] text-white font-extrabold shadow-2xs"
                    : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ORTAK ARAMA VE SEVİYE / DURUM FİLTRE ÇUBUĞU */}
      {activeSection !== "saved-words" && activeSection !== "weak-words" && (
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
                placeholder={
                  activeSection === "dialogues"
                    ? "120 diyalog içinde başlık, gramer konusu veya Arapça ifade ara..."
                    : activeSection === "metinler"
                    ? "60 okuma metni içinde başlık, tema, gramer veya Arapça ara..."
                    : activeSection === "cumleler"
                    ? "1111 cümle içinde Türkçe, Arapça veya tema ara..."
                    : activeSection === "atasozleri"
                    ? "508 atasözü içinde Türkçe anlam, lafzî çeviri veya Arapça ara..."
                    : "999 görsel kelime içinde Türkçe, Arapça veya kategori ara..."
                }
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
            <div className="flex overflow-x-auto no-scrollbar items-center gap-1.5 py-0.5">
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
                          📂 Kategori:{" "}
                          <strong className="text-[#6741D9] dark:text-indigo-300">
                            {categoryFilter === "all"
                              ? "Tüm Kategoriler"
                              : categoryFilter.replace(/_/g, " ")}
                          </strong>
                        </span>
                      </span>

                      {categoryFilter !== "all" && (
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            setCategoryFilter("all");
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 sm:max-h-80 overflow-y-auto p-2.5 bg-white dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-inner">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setCategoryFilter("all");
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
                              {cat.replace(/_/g, " ")}
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
                </div>
              );
            })()}

          {mobileFiltersOpen && (
            <div className="sm:hidden pt-1.5 border-t border-dashed border-[#E2D3B8] flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] font-extrabold text-[var(--muted)] mr-1">
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
                        className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer ${
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
                const dlgNo = dlg.id.replace("dlg_", "");
                const imagePath = getDialogueCoverUrl(dlg.id);
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
                      className="relative h-36 w-full bg-[#E6D7BE] overflow-hidden block group"
                    >
                      <img
                        src={imagePath}
                        alt={dlg.baslik_tr}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (
                            !img.src.endsWith("/gorseller/diyaloglar/dlg_001.webp")
                          ) {
                            img.src = "/gorseller/diyaloglar/dlg_001.webp";
                          }
                        }}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="bg-white/95 text-[#2b241d] font-extrabold text-[11px] px-2.5 py-0.5 rounded-lg border border-[#E6D7BE] tabular-nums">
                          #{dlgNo}
                        </span>
                        <span className="bg-[#087F5B] text-white font-extrabold text-[11px] px-2 py-0.5 rounded-lg">
                          {dlg.seviye}
                        </span>
                      </div>

                      {isComp && (
                        <span className="absolute top-2.5 right-2.5 bg-[#6741D9] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-xs">
                          <CheckCircle2 size={12} />
                          <span>Tamamlandı</span>
                        </span>
                      )}

                      <div className="absolute bottom-2 right-3 left-3 flex flex-col gap-0.5">
                        <span
                          lang="ar"
                          dir="rtl"
                          className="arabic text-white text-lg sm:text-xl font-bold leading-tight text-right drop-shadow-xs truncate"
                        >
                          {getDisplayArabic(dlg.baslik_ar)}
                        </span>
                        <span
                          dir="ltr"
                          className="text-white text-xs font-bold leading-snug text-left drop-shadow-xs truncate"
                        >
                          {dlg.baslik_tr}
                        </span>
                      </div>
                    </Link>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      {dlg.odak_gramer && (
                        <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1 truncate">
                          📌 {dlg.odak_gramer}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-[var(--muted)] font-semibold border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] pb-2.5">
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
                const imagePath = getReadingTextCoverUrl(txt.id);
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
                      className="relative h-36 w-full bg-[#E6D7BE] overflow-hidden block group"
                    >
                      <img
                        src={imagePath}
                        alt={txt.baslik_tr}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (
                            !img.src.endsWith("/gorseller/metinler/metin_01.webp")
                          ) {
                            img.src = "/gorseller/metinler/metin_01.webp";
                          }
                        }}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="bg-white/95 text-[#2b241d] font-extrabold text-[11px] px-2.5 py-0.5 rounded-lg border border-[#E6D7BE] tabular-nums">
                          Metin #{txtNo}
                        </span>
                        <span className="bg-[#6741D9] text-white font-extrabold text-[11px] px-2 py-0.5 rounded-lg">
                          {txt.seviye}
                        </span>
                      </div>

                      {isComp && (
                        <span className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>Okundu</span>
                        </span>
                      )}

                      <div className="absolute bottom-2 right-3 left-3 flex flex-col gap-0.5">
                        <span
                          lang="ar"
                          dir="rtl"
                          className="arabic text-white text-lg sm:text-xl font-bold leading-tight text-right drop-shadow-xs truncate"
                        >
                          {getDisplayArabic(txt.baslik_ar)}
                        </span>
                        <span
                          dir="ltr"
                          className="text-white text-xs font-bold leading-snug text-left drop-shadow-xs truncate"
                        >
                          {txt.baslik_tr}
                        </span>
                      </div>
                    </Link>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      {txt.odak_gramer && (
                        <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300 rounded-lg px-2.5 py-1 truncate">
                          📌 {txt.odak_gramer}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-[var(--muted)] font-semibold border-b border-dashed border-[#E2D3B8] pb-2.5">
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
            <div className="flex items-center gap-2">
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
                    <span>⏹ Sıralı Dinlemeyi Durdur</span>
                  </>
                ) : (
                  <>
                    <Play size={11} fill="currentColor" />
                    <span>
                      ▶ Sıralı Dinle (
                      {mounted && preferredVoiceGender === "kadin"
                        ? "👩 Kadın"
                        : "👨 Erkek"}
                      )
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredSentences.slice(0, visibleCount).map((item, idx) => {
              const isPlaying = playingItemId === item.id;
              const itemLevel = item.seviye || item.cefr || "A1";
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
                        {item.odak_kalip && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 text-amber-900 dark:text-amber-200 text-[10px] font-extrabold">
                            📌 {item.odak_kalip}
                          </span>
                        )}
                        {item.tema && (
                          <span className="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-[var(--background)] border border-[#E6D7BE] text-[10px] font-bold text-[var(--muted)] truncate">
                            {item.tema.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      dir="rtl"
                      className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.95] bg-white/85 dark:bg-[var(--background)] rounded-xl p-3 border border-[#E6D7BE]"
                    >
                      <WordTooltip
                        text={item.arapca}
                        contextSentenceTr={item.turkce}
                      />
                    </div>

                    <div className="border-l-4 border-[#087F5B] bg-white/75 dark:bg-[var(--background)] rounded-r-xl px-3 py-2 border border-[#E6D7BE]">
                      <p className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] leading-snug">
                        {item.turkce}
                      </p>
                    </div>
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
            <div className="flex items-center gap-2">
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
                    <span>⏹ Sıralı Dinlemeyi Durdur</span>
                  </>
                ) : (
                  <>
                    <Play size={11} fill="currentColor" />
                    <span>
                      ▶ Sıralı Dinle (
                      {mounted && preferredVoiceGender === "kadin"
                        ? "👩 Kadın"
                        : "👨 Erkek"}
                      )
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProverbs.slice(0, visibleCount).map((item, idx) => {
              const isPlaying = playingItemId === item.id;
              const imgUrl = getProverbCoverUrl(item.id);
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
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            if (
                              !img.src.endsWith(
                                "/gorseller/atasozleri/ata_0001.webp"
                              )
                            ) {
                              img.src = "/gorseller/atasozleri/ata_0001.webp";
                            }
                          }}
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
                      </div>
                    </div>

                    <div
                      dir="rtl"
                      className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.95] bg-white/85 dark:bg-[var(--background)] rounded-xl p-3 border border-[#E6D7BE]"
                    >
                      <WordTooltip
                        text={item.arapca}
                        contextSentenceTr={item.turkce}
                      />
                    </div>

                    {item.kullanim_baglami && (
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

      {/* 5. SEKME: 999 GÖRSEL KELİME (1:1 KARE GÖRSEL & BÜTÜNCÜL KART MİMARİSİ) */}
      {activeSection === "gorsel-kelimeler" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--muted)] px-1">
            <span>
              Toplam <strong>{filteredVisualWords.length}</strong> resimli
              kelime kartı
            </span>
            <div className="flex items-center gap-2">
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
                    <span>⏹ Sıralı Dinlemeyi Durdur</span>
                  </>
                ) : (
                  <>
                    <Play size={11} fill="currentColor" />
                    <span>
                      ▶ Sıralı Dinle (
                      {mounted && preferredVoiceGender === "kadin"
                        ? "👩 Kadın"
                        : "👨 Erkek"}
                      )
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVisualWords.slice(0, visibleCount).map((item, idx) => {
              const isPlaying = playingItemId === item.id;
              const imgUrl = getVisualWordCoverUrl(item);
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
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            if (
                              !img.src.endsWith(
                                "/gorseller/kelimeler/gorsel_0001.webp"
                              )
                            ) {
                              img.src = "/gorseller/kelimeler/gorsel_0001.webp";
                            }
                          }}
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
                            {item.kategori_tr}
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

                        <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] leading-snug">
                          {item.turkce}
                        </h3>

                        {(item.ikincil_form || item.ucuncul_form) && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--muted)] pt-0.5">
                            {item.ikincil_form && item.ikincil_form !== "-" && (
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
                            {item.ucuncul_form && item.ucuncul_form !== "-" && (
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
                      <div
                        dir="rtl"
                        className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.85]"
                      >
                        <WordTooltip
                          text={item.arapca}
                          contextSentenceTr={item.turkce}
                        />
                      </div>

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
                          <div
                            dir="rtl"
                            className="arabic font-arabic text-lg sm:text-xl font-bold text-[var(--foreground)] text-right leading-[1.9]"
                          >
                            <WordTooltip
                              text={item.ornek_ar}
                              contextSentenceTr={item.ornek_tr || item.turkce}
                            />
                          </div>
                          {item.ornek_tr && (
                            <p className="text-[11px] font-semibold text-[var(--muted)]">
                              {item.ornek_tr}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alt Aksiyon Satırı */}
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
                          forms,
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

      {/* 6. SEKME: KELİME DEFTERİM */}
      {activeSection === "saved-words" && (
        <section className="space-y-4">
          {!mounted || favoriteWords.length === 0 ? (
            <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-10 text-center space-y-3">
              <p className="text-base font-extrabold text-[var(--foreground)]">
                Kelime defterinizde henüz kayıtlı kelime bulunmuyor.
              </p>
              <p className="text-xs text-[var(--muted)]">
                Diyalog okurken veya Sözlük sayfasında kalp ikonuna tıklayarak
                kelimeleri buraya kaydedebilirsiniz.
              </p>
              <Link
                href="/sozluk"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-bold border-b-4 border-[#065F46]"
              >
                Sözlüğe Git
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoriteWords.map((word) => (
                <div
                  key={word.id}
                  className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-dashed border-[#E2D3B8] pb-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-[#065F46] dark:text-emerald-400">
                        {word.tur} · Kök: {word.kok}
                      </span>
                      <p className="text-sm font-extrabold text-[var(--foreground)] mt-1">
                        {word.anlam_tr}
                      </p>
                    </div>
                    <span
                      lang="ar"
                      dir="rtl"
                      className="arabic text-3xl font-bold text-[#065F46] dark:text-emerald-400"
                    >
                      {getDisplayArabic(word.mufret || word.mazi || "")}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handlePracticeWord(word)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-3 text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Mic
                        size={14}
                        className="text-[#065F46] dark:text-emerald-400"
                      />
                      <span>Telaffuz Et</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        toggleFavoriteWord(word);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-red-50 border-2 border-red-200 border-b-3 text-xs font-bold text-red-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Heart size={14} fill="currentColor" />
                      <span>Çıkar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
    </div>
  );
}