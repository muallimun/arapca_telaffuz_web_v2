"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, notFound } from "next/navigation";
import {
  Play,
  Square,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Heart,
  CheckCircle2,
  Mic,
  Eye,
  Sparkles,
  Repeat,
  Columns2,
  Rows2,
  Languages,
  MousePointerClick,
  FileText,
  Maximize2,
  MoreHorizontal,
  X,
  Share2,
  Download,
  GraduationCap,
  ClipboardCheck,
  AlignJustify,
  LayoutList,
  RotateCcw,
} from "lucide-react";
import {
  metinler,
  getReadingTextById,
  getReadingTextCoverUrl,
  getReadingTextGrammarNote,
  getYoutubeRecommendationsByContentId,
} from "@/lib/data";
import { YoutubePlayerModal } from "@/components/LiteYoutubeCard";
import {
  GrammarHapBilgiPanel,
  LessonGrammarSplitPanel,
} from "@/components/ui/GrammarHapBilgiPanel";
import {
  loadAudioManifest,
  hasMp3,
  getMp3Path,
  VoiceOption,
  speakHybrid,
  stopAllAudio,
} from "@/lib/audio";
import {
  isDialogueOfflineReady,
  downloadDialogueOfflinePack,
  getDialogueAudioUrls,
} from "@/lib/offlineManager";
import { useAudioStore } from "@/store/audioStore";
import {
  useSettings,
  ViewMode,
  SpeechRate,
  WordTrackingStyle,
  PauseBetweenLines,
} from "@/store/settings";
import { useClassroomToolsStore } from "@/store/classroomToolsStore";
import { useUserStore } from "@/store/userStore";
import {
  playClick,
  playSuccess,
  playFanfare,
} from "@/lib/sfxManager";
import WordTooltip from "@/components/ui/WordTooltip";
import ShadowingButton from "@/components/ui/ShadowingButton";
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
const TeacherHomeworkModal = dynamic(
  () =>
    import("@/components/ui/ShareAchievementModal").then(
      (m) => m.TeacherHomeworkModal
    ),
  { ssr: false }
);
const ShareContentCardModal = dynamic(
  () => import("@/components/ui/ShareContentCardModal"),
  { ssr: false }
);
import {
  getReadingTextVocabulary,
  DialogueVocabularyEntry,
  getWordCategory,
  cleanArabicText,
} from "@/lib/dict";
import {
  parseHomeworkParams,
  loadHomeworkProgress,
  saveHomeworkProgress,
} from "@/lib/homeworkContract";
import {
  extractDialogueIdioms,
  ExtractedDialogueIdiom,
  normalizeForIdiomMatch,
} from "@/lib/arabicIdioms";
import {
  Dialogue,
  DictionaryItem,
  ReadingTextLine,
} from "@/types/data";
import {
  formatArabicText,
  formatArabicByHarekeMode,
  splitMixedBidiText,
} from "@/lib/arabicTextUtils";
import {
  requestWakeLock,
  releaseWakeLock,
  releaseAllWakeLocks,
} from "@/lib/wakeLock";

type StudyMode =
  | "listen"
  | "shadowing"
  | "questions"
  | "vocabulary"
  | "gramer";
type FlowMode = "single" | "sequential";
type TextLayoutMode = "sentences" | "paragraph";

export default function ReadingTextDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const rawReadingText = getReadingTextById(resolvedParams.id);
  const readingText = rawReadingText ?? metinler[0];

  const {
    stop,
    playAudio,
    playTTS,
    setPlaybackRate,
    playingLineId,
    activeWordIndex,
    activeWordProgress,
    isShadowingPause,
    shadowingPauseMs,
    setShadowingPause,
    waitShadowingPause,
  } = useAudioStore();

  const {
    viewMode,
    setViewMode,
    readingLayoutMode,
    setReadingLayoutMode,
    showHareke,
    harekeMode,
    toggleHareke,
    showShadowing,
    arabicFont,
    arabicFontSize,
    turkishFontSize,
    speechRate,
    setSpeechRate,
    preferredVoiceGender,
    togglePreferredVoiceGender,
    dialogueLoopCount,
    cycleDialogueLoopCount,
    wordTrackingStyle,
    setWordTrackingStyle,
    pauseBetweenLines,
    setPauseBetweenLines,
  } = useSettings();

  const {
    toggleFavoriteDialogue,
    isDialogueFavorite,
    toggleCompletedDialogue,
    isDialogueCompleted,
    toggleFavoriteWord,
    isWordFavorite,
    toggleLearnedWord,
    isWordLearned,
    mistakeIds,
    recordSkillAttempt,
  } = useUserStore();

  const [mounted, setMounted] = useState(false);
  const [, setManifestLoaded] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("listen");

  // Metin Sayfasına Özel: Cümle Cümle ("sentences") veya Paragraf ("paragraph") Düzeni (useSettings ile senkronize)
  const textLayoutMode: TextLayoutMode = mounted
    ? readingLayoutMode
    : "sentences";
  const [selectedParagraphSira, setSelectedParagraphSira] = useState<
    number | null
  >(1);

  // Cümle Bazlı Hareke Override (✨)
  const [lineHarekeOverrides, setLineHarekeOverrides] = useState<
    Record<number, boolean>
  >({});

  const [clickToRevealTr, setClickToRevealTr] = useState<boolean>(
    () => useSettings.getState().viewMode === "click-reveal"
  );
  useEffect(() => {
    const unsub = useSettings.subscribe((state, prevState) => {
      if (state.viewMode !== prevState.viewMode) {
        if (state.viewMode === "click-reveal") {
          setClickToRevealTr(true);
        } else {
          setClickToRevealTr(false);
        }
      }
    });
    return unsub;
  }, []);
  const [revealedTrLines, setRevealedTrLines] = useState<
    Record<number, boolean>
  >({});
  const [revealedArLines, setRevealedArLines] = useState<
    Record<number, boolean>
  >({});
  const [blurArabic, setBlurArabic] = useState<boolean>(false);
  const [revealedArabicLines, setRevealedArabicLines] = useState<
    Record<number, boolean>
  >({});

  // Sınıf / Akıllı Tahta Modu
  const [isClassroomMode, setIsClassroomMode] = useState<boolean>(false);
  const [classroomScale, setClassroomScale] = useState<number>(1.5);
  const [spotlightMode, setSpotlightMode] = useState<boolean>(true);
  const [focusedLineIndex, setFocusedLineIndex] = useState<number>(0);
  const [isClassroomLoop, setIsClassroomLoop] = useState<boolean>(false);
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState<boolean>(false);
  const linkedYoutubeVideos = readingText
    ? getYoutubeRecommendationsByContentId(readingText.id)
    : [];
  const isClassroomLoopRef = useRef<boolean>(false);
  const isClassroomModeRef = useRef<boolean>(false);
  const togglePlayAllShortcutRef = useRef<() => void>(() => {});
  const classroomKeyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

  useEffect(() => {
    isClassroomLoopRef.current = isClassroomLoop;
    isClassroomModeRef.current = isClassroomMode;
  }, [isClassroomLoop, isClassroomMode]);

  const [selectedClassroomLine, setSelectedClassroomLine] = useState<
    number | null
  >(1);
  const [flowMode, setFlowMode] = useState<FlowMode>("single");
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [, setDialogueLoopTurn] = useState<number>(1);
  const [loopingLineSira, setLoopingLineSira] = useState<number | null>(null);
  const [sentenceLoopRemaining, setSentenceLoopRemaining] = useState<
    number | "infinite" | null
  >(null);
  const [autoShadowingFlow, setAutoShadowingFlow] = useState<boolean>(false);
  const [shadowingPauseLineSira, setShadowingPauseLineSira] = useState<
    number | null
  >(null);
  const [shadowingPauseRemainingPct, setShadowingPauseRemainingPct] =
    useState<number>(100);

  // Lightbox, PDF Modal, Paylaşım Modalı, Öğretmen Ödev Modalı ve "⋯" Diğer Menüsü
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isTeacherHwModalOpen, setIsTeacherHwModalOpen] =
    useState<boolean>(false);
  const [isHwReportModalOpen, setIsHwReportModalOpen] =
    useState<boolean>(false);
  const [isHwQuizModalOpen, setIsHwQuizModalOpen] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  // Okuma Metni Anlama Soruları ("❓ Sorular" Sekmesi) State
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number>
  >({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  // Öğrenci Ödev Takip Modu (?hw=1&listen=1&pron=3&quiz=1&title=...&aid=...) State
  const [hwConfig, setHwConfig] = useState<{
    active: boolean;
    title: string;
    requireListen: boolean;
    pronCount: number;
    requireQuiz: boolean;
    aid: string;
  }>({
    active: false,
    title: "",
    requireListen: true,
    pronCount: 3,
    requireQuiz: true,
    aid: "default",
  });
  const [hwListenedLines, setHwListenedLines] = useState<number[]>([]);
  const [hwPracticedLines, setHwPracticedLines] = useState<number[]>([]);
  const [hwPronouncedCount, setHwPronouncedCount] = useState<number>(0);
  const [hwCollectedScores, setHwCollectedScores] = useState<number[]>([]);
  const [hwQuizCompleted, setHwQuizCompleted] = useState<boolean>(false);
  const [hwQuizStep, setHwQuizStep] = useState<number>(0);
  const [hwQuizSelectedOpt, setHwQuizSelectedOpt] = useState<string | null>(
    null
  );
  const [hwQuizCorrectCount, setHwQuizCorrectCount] = useState<number>(0);

  const recordHwLinePractice = useCallback(
    (
      targetTextOrSira: string | number | undefined,
      measuredScore?: number | null
    ) => {
      if (!hwConfig.active) return;
      let lineId: number | null = null;
      if (typeof targetTextOrSira === "number") {
        lineId = targetTextOrSira;
      } else if (typeof targetTextOrSira === "string" && targetTextOrSira.trim()) {
        const cleaned = cleanArabicText(targetTextOrSira);
        const matchedLine = readingText.satirlar.find(
          (s) => cleanArabicText(s.arapca) === cleaned
        );
        if (matchedLine) {
          lineId = matchedLine.sira;
        } else {
          let h = 2166136261;
          for (let i = 0; i < cleaned.length; i++) {
            h ^= cleaned.charCodeAt(i);
            h = Math.imul(h, 16777619);
          }
          lineId = -Math.max(1, (h >>> 0) % 100000);
        }
      }
      if (lineId !== null) {
        setHwPracticedLines((prev) => {
          const next = prev.includes(lineId!) ? prev : [...prev, lineId!];
          setHwPronouncedCount(next.length);
          return next;
        });
      }
      if (
        typeof measuredScore === "number" &&
        Number.isFinite(measuredScore) &&
        measuredScore > 0
      ) {
        setHwCollectedScores((prev) => [...prev, measuredScore]);
      }
    },
    [hwConfig.active, readingText.satirlar]
  );

  // Çevrimdışı Ders Paketi (Cache API) State
  const [isOfflineReady, setIsOfflineReady] = useState<boolean>(false);
  const [isDownloadingOffline, setIsDownloadingOffline] =
    useState<boolean>(false);
  const [offlineProgressPct, setOfflineProgressPct] = useState<number>(0);
  const [offlineEstimatedMb, setOfflineEstimatedMb] = useState<number>(1.2);
  const [showOfflineNotice, setShowOfflineNotice] = useState<boolean>(false);

  // Gölgeleme Modal State
  const [shadowingTarget, setShadowingTarget] = useState<{
    text: string;
    itemId?: string;
    audioUrl?: string;
    voice?: VoiceOption;
    forms?: { label: string; arabic: string }[];
  } | null>(null);
  const [shareCardTarget, setShareCardTarget] =
    useState<ShareCardPayload | null>(null);

  const playToken = useRef(0);
  const lineRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const updateTextLayoutMode = useCallback(
    (mode: TextLayoutMode) => {
      setReadingLayoutMode(mode);
      try {
        localStorage.setItem("muallimun-text-layout-mode", mode);
      } catch {
        // ignore
      }
    },
    [setReadingLayoutMode]
  );

  const toggleLineHareke = (sira: number) => {
    playClick();
    setLineHarekeOverrides((prev) => {
      const current = prev[sira] !== undefined ? prev[sira] : showHareke;
      return { ...prev, [sira]: !current };
    });
  };

  // Mobil ekranlarda (< 768px) Sınıf / Tahta Modu açık kaldıysa otomatik kapat
  useEffect(() => {
    const checkViewportForClassroom = () => {
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setIsClassroomMode(false);
      }
    };
    checkViewportForClassroom();
    window.addEventListener("resize", checkViewportForClassroom);
    return () =>
      window.removeEventListener("resize", checkViewportForClassroom);
  }, []);

  useEffect(() => {
    loadAudioManifest().then(() => {
      setManifestLoaded(true);
      void getDialogueAudioUrls(resolvedParams.id).then(
        ({ estimatedSizeMb }) => {
          setOfflineEstimatedMb(estimatedSizeMb);
        }
      );
      void isDialogueOfflineReady(resolvedParams.id).then((ready) => {
        setIsOfflineReady(ready);
      });
    });

    const raf = requestAnimationFrame(() => {
      setMounted(true);

      if (typeof window !== "undefined") {
        const parsedHw = parseHomeworkParams(
          window.location.search,
          resolvedParams.id
        );
        if (parsedHw.active) {
          setHwConfig({
            active: true,
            title: parsedHw.title,
            requireListen: parsedHw.listen,
            pronCount: parsedHw.pronTargetCount,
            requireQuiz: parsedHw.quiz,
            aid: parsedHw.aid,
          });
          const persisted = loadHomeworkProgress(
            resolvedParams.id,
            parsedHw.aid
          );
          if (persisted) {
            setHwListenedLines(persisted.listened);
            setHwPracticedLines(persisted.practicedLines);
            setHwPronouncedCount(
              Math.max(persisted.practicedLines.length, persisted.pronCount)
            );
            setHwCollectedScores(persisted.scores);
            if (persisted.quizDone) setHwQuizCompleted(true);
          }
        }
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      playToken.current += 1;
      stop();
      void releaseAllWakeLocks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  // Ödev ilerlemesini localStorage (muallimun-hw-v2-...) üzerinde kalıcı olarak sakla
  useEffect(() => {
    if (!hwConfig.active) return;
    saveHomeworkProgress(resolvedParams.id, hwConfig.aid, {
      listened: hwListenedLines,
      practicedLines: hwPracticedLines,
      pronCount: Math.max(hwPracticedLines.length, hwPronouncedCount),
      scores: hwCollectedScores,
      quizDone: hwQuizCompleted,
    });
  }, [
    hwConfig.active,
    hwConfig.aid,
    resolvedParams.id,
    hwListenedLines,
    hwPracticedLines,
    hwPronouncedCount,
    hwCollectedScores,
    hwQuizCompleted,
  ]);

  // Metin dinlerken veya gölgeleme çalışırken mobil ekranın kararmasını önle
  const isWakeLockNeeded =
    isPlayingAll ||
    playingLineId !== null ||
    loopingLineSira !== null ||
    Boolean(shadowingTarget);

  useEffect(() => {
    if (isWakeLockNeeded) {
      void requestWakeLock("reading-text-session");
    } else {
      void releaseWakeLock("reading-text-session");
    }
    return () => {
      void releaseWakeLock("reading-text-session");
    };
  }, [isWakeLockNeeded]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen]);

  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMoreMenuOpen]);

  useEffect(() => {
    const targetLine = playingLineId ?? shadowingPauseLineSira ?? null;
    if (
      targetLine !== null &&
      textLayoutMode === "sentences" &&
      lineRefs.current[targetLine]
    ) {
      lineRefs.current[targetLine]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [playingLineId, shadowingPauseLineSira, textLayoutMode]);

  useEffect(() => {
    if (!isClassroomMode) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`classroom-line-${focusedLineIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [focusedLineIndex, isClassroomMode]);

  useEffect(() => {
    if (!readingText) return;
    const raf = requestAnimationFrame(() => {
      if (playingLineId !== null) {
        setSelectedClassroomLine(playingLineId);
        setSelectedParagraphSira(playingLineId);
        const idx = readingText.satirlar.findIndex(
          (s) => s.sira === playingLineId
        );
        if (idx >= 0) setFocusedLineIndex(idx);
      } else if (shadowingPauseLineSira !== null) {
        setSelectedClassroomLine(shadowingPauseLineSira);
        setSelectedParagraphSira(shadowingPauseLineSira);
        const idx = readingText.satirlar.findIndex(
          (s) => s.sira === shadowingPauseLineSira
        );
        if (idx >= 0) setFocusedLineIndex(idx);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [readingText, playingLineId, shadowingPauseLineSira]);

  // Gölgeleme Boşluğu (Shadowing Pause) görsel geri sayım animasyonu
  useEffect(() => {
    if (!isShadowingPause || shadowingPauseMs <= 0) {
      const resetRaf = requestAnimationFrame(() => {
        setShadowingPauseRemainingPct(100);
      });
      return () => cancelAnimationFrame(resetRaf);
    }
    const startAt = performance.now();
    let rafId: number | null = null;

    const tick = () => {
      const elapsed = performance.now() - startAt;
      const ratio = Math.max(0, 1 - elapsed / shadowingPauseMs);
      setShadowingPauseRemainingPct(Math.round(ratio * 100));
      if (ratio > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isShadowingPause, shadowingPauseMs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      const isClassroomNavKey =
        isClassroomMode &&
        (e.key === "ArrowDown" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "Escape" ||
          e.key === "p" ||
          e.key === "P" ||
          e.key === "r" ||
          e.key === "R");
      if (e.code !== "Space" && !isClassroomNavKey) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!isClassroomMode && (tag === "BUTTON" || tag === "A")) {
        return;
      }
      if (
        shadowingTarget ||
        isPdfModalOpen ||
        isShareModalOpen ||
        isLightboxOpen ||
        isTeacherHwModalOpen ||
        isHwReportModalOpen ||
        isHwQuizModalOpen ||
        document.querySelector(".fixed.inset-0")
      ) {
        return;
      }
      if (isClassroomMode && document.activeElement?.tagName === "BUTTON") {
        (document.activeElement as HTMLElement)?.blur();
      }
      classroomKeyHandlerRef.current(e);
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    isClassroomMode,
    shadowingTarget,
    isPdfModalOpen,
    isShareModalOpen,
    isLightboxOpen,
    isTeacherHwModalOpen,
    isHwReportModalOpen,
    isHwQuizModalOpen,
  ]);

  const currentIndex = metinler.findIndex((m) => m.id === readingText.id);
  const prevReadingText = currentIndex > 0 ? metinler[currentIndex - 1] : null;
  const nextReadingText =
    currentIndex < metinler.length - 1 ? metinler[currentIndex + 1] : null;

  const textVocabEntries: DialogueVocabularyEntry[] = useMemo(
    () => getReadingTextVocabulary(readingText.id),
    [readingText.id]
  );

  const pseudoLinesForIdioms = useMemo(
    () =>
      readingText.satirlar.map((l) => ({
        sira: l.sira,
        konusmaci: "Anlatıcı",
        konusmaci_ar: "الراوي",
        cinsiyet: (preferredVoiceGender === "kadin" ? "K" : "E") as "E" | "K",
        arapca: l.arapca,
        turkce: l.turkce,
        ses_dosyasi: l.ses_dosyasi,
      })),
    [readingText.satirlar, preferredVoiceGender]
  );

  const textIdioms: ExtractedDialogueIdiom[] = useMemo(
    () => extractDialogueIdioms(pseudoLinesForIdioms, readingText.seviye),
    [pseudoLinesForIdioms, readingText.seviye]
  );

  const rawNum =
    readingText.sira ||
    parseInt(readingText.id.replace("metin_", ""), 10) ||
    1;
  const imagePath =
    readingText.gorsel || getReadingTextCoverUrl(readingText.id);
  const grammarNote = getReadingTextGrammarNote(readingText.id);
  const {
    isGrammarSplitOpen,
    grammarSplitSide,
    setGrammarSplitOpen,
    toggleGrammarSplitSide,
  } = useClassroomToolsStore();

  const activeTabId: StudyMode =
    isGrammarSplitOpen && grammarNote && studyMode === "gramer"
      ? "listen"
      : studyMode;

  useEffect(() => {
    if (!grammarNote && isGrammarSplitOpen) {
      setGrammarSplitOpen(false);
    }
  }, [grammarNote, isGrammarSplitOpen, setGrammarSplitOpen]);

  const handleToggleGrammarSplit = useCallback(() => {
    if (isGrammarSplitOpen) {
      stopAllAudio();
      setGrammarSplitOpen(false);
      return;
    }
    if (studyMode === "gramer") {
      setStudyMode("listen");
    }
    setGrammarSplitOpen(true);
  }, [isGrammarSplitOpen, studyMode, setGrammarSplitOpen, setStudyMode]);

  // PDF Modal uyumu için Dialogue nesnesi
  const dialogueForPdf: Dialogue = useMemo(
    () => ({
      id: readingText.id,
      baslik_tr: readingText.baslik_tr,
      baslik_ar: readingText.baslik_ar,
      seviye: readingText.seviye,
      tema: readingText.tema,
      odak_gramer: readingText.odak_gramer || grammarNote?.konu_basligi,
      gorsel: imagePath,
      satirlar: readingText.satirlar.map((l) => ({
        sira: l.sira,
        konusmaci: `Cümle ${l.sira}`,
        konusmaci_ar: `#${l.sira}`,
        cinsiyet: preferredVoiceGender === "kadin" ? "K" : "E",
        arapca: l.arapca,
        turkce: l.turkce,
        ses_dosyasi: l.ses_dosyasi,
      })),
    }),
    [readingText, grammarNote, imagePath, preferredVoiceGender]
  );

  const getNarratorVoice = (): VoiceOption =>
    preferredVoiceGender === "kadin"
      ? "ar-SA-ZariyahNeural"
      : "ar-SA-HamedNeural";

  const getDisplayText = (text: string, harekeOverride?: boolean) => {
    if (harekeOverride !== undefined) {
      return formatArabicText(text, harekeOverride, arabicFont);
    }
    const activeMode = !mounted
      ? "full"
      : harekeMode || (showHareke ? "full" : "none");
    return formatArabicByHarekeMode(text, activeMode, arabicFont);
  };

  const prepareWordForms = (word: DictionaryItem) => {
    const forms: { label: string; arabic: string }[] = [];
    if (word.tur === "isim") {
      if (word.mufret)
        forms.push({
          label: "Müfret (Tekil)",
          arabic: word.mufret.split("/")[0].trim(),
        });
      if (word.cemi && word.cemi !== "-")
        forms.push({
          label: "Cemî (Çoğul)",
          arabic: word.cemi.split("/")[0].trim(),
        });
    } else if (word.tur === "fiil") {
      if (word.mazi)
        forms.push({
          label: "Mâzî (Geçmiş)",
          arabic: word.mufret || word.mazi.split("/")[0].trim(),
        });
      if (word.muzari)
        forms.push({
          label: "Muzâri (Şimdiki)",
          arabic: word.muzari.split("/")[0].trim(),
        });
      if (word.masdar)
        forms.push({
          label: "Masdar (İsim)",
          arabic: word.masdar.split("/")[0].trim(),
        });
    }
    return forms.length > 0 ? forms : undefined;
  };

  const playSentence = async (
    line: ReadingTextLine,
    autoAdvance = false,
    isLooping = false,
    loopRemaining: number | "infinite" | null = null,
    currentDlgTurn: number = 1
  ) => {
    const currentToken = playToken.current;
    const lineHasMp3 = hasMp3(readingText.id, line.sira);
    const lineAudioUrl = lineHasMp3
      ? getMp3Path(readingText.id, line.sira)
      : undefined;
    const voice = getNarratorVoice();

    if (lineHasMp3 && lineAudioUrl) {
      await playAudio(lineAudioUrl, line.sira, speechRate, line.arapca);
    } else {
      await playTTS(line.arapca, line.sira, speechRate, voice);
    }

    setHwListenedLines((prev) =>
      prev.includes(line.sira) ? prev : [...prev, line.sira]
    );

    if (playToken.current !== currentToken) return;

    // 1. Eğer bu cümle için Tekrarla (Loop) aktifse 800ms es vererek tekrar çal
    if (isLooping) {
      const nextRem =
        loopRemaining === "infinite"
          ? "infinite"
          : typeof loopRemaining === "number"
            ? loopRemaining - 1
            : 0;

      if (
        nextRem === "infinite" ||
        (typeof nextRem === "number" && nextRem > 0)
      ) {
        setSentenceLoopRemaining(nextRem);
        const loopWaitOk = await waitShadowingPause(800, false);
        if (!loopWaitOk || playToken.current !== currentToken) return;
        await playSentence(line, false, true, nextRem, currentDlgTurn);
        return;
      } else {
        setLoopingLineSira(null);
        setSentenceLoopRemaining(null);
        stop();
        return;
      }
    }

    // 1.5. Eğer Sınıf Modunda Tekrarlı Dinleme açıksa
    if (
      !autoAdvance &&
      isClassroomModeRef.current &&
      isClassroomLoopRef.current
    ) {
      const clsWaitOk = await waitShadowingPause(1000, false);
      if (
        !clsWaitOk ||
        playToken.current !== currentToken ||
        !isClassroomModeRef.current ||
        !isClassroomLoopRef.current
      ) {
        return;
      }
      await playSentence(line, false, false, null, currentDlgTurn);
      return;
    }

    // 2. Eğer "2. Telaffuz" modunda Otomatik Gölgeleme Akışı açıksa
    if (studyMode === "shadowing" && autoShadowingFlow && !autoAdvance) {
      stop();
      setShadowingTarget({
        text: line.arapca,
        audioUrl: lineAudioUrl,
        voice,
      });
      return;
    }

    // 3. Sıralı Oynatma (Sequential) aktifse sonraki cümleye geç
    if (autoAdvance) {
      const pauseSetting = useSettings.getState().pauseBetweenLines;
      const lastDurSec = useAudioStore.getState().lastPlayedDurationSec || 2.5;
      const isShadowWait = pauseSetting === 2 || pauseSetting === "auto";
      const waitMs =
        pauseSetting === 2
          ? 2000
          : pauseSetting === "auto"
            ? Math.min(8000, Math.max(1500, Math.round(lastDurSec * 1000)))
            : 240;

      if (isShadowWait) {
        setShadowingPauseLineSira(line.sira);
      }

      const waitCompleted = await waitShadowingPause(waitMs, isShadowWait);

      if (isShadowWait) {
        setShadowingPause(false, 0);
        setShadowingPauseLineSira(null);
      }

      if (!waitCompleted || playToken.current !== currentToken) return;
      const nextLine = readingText.satirlar.find(
        (s) => s.sira === line.sira + 1
      );
      if (nextLine) {
        await playSentence(nextLine, true, false, null, currentDlgTurn);
      } else {
        const targetDlgLoops = useSettings.getState().dialogueLoopCount;
        const shouldRepeatDialogue =
          (isClassroomModeRef.current && isClassroomLoopRef.current) ||
          targetDlgLoops === "infinite" ||
          (typeof targetDlgLoops === "number" &&
            currentDlgTurn < targetDlgLoops);

        if (shouldRepeatDialogue) {
          const nextTurn = currentDlgTurn + 1;
          setDialogueLoopTurn(nextTurn);
          const dlgRepeatOk = await waitShadowingPause(750, false);
          if (!dlgRepeatOk || playToken.current !== currentToken) return;
          const firstLine = readingText.satirlar[0];
          await playSentence(firstLine, true, false, null, nextTurn);
          return;
        }

        setIsPlayingAll(false);
        setDialogueLoopTurn(1);
        stop();
      }
    }
  };

  const handlePlayLine = (line: ReadingTextLine) => {
    playClick();
    playToken.current += 1;
    stop();
    setLoopingLineSira(null);
    setSentenceLoopRemaining(null);
    setSelectedParagraphSira(line.sira);

    if (flowMode === "sequential") {
      setIsPlayingAll(true);
      setDialogueLoopTurn(1);
      playSentence(line, true, false, null, 1);
    } else {
      setIsPlayingAll(false);
      playSentence(line, false, false, null, 1);
    }
  };

  const openShadowingCoach = (target: {
    text: string;
    itemId?: string;
    audioUrl?: string;
    voice?: VoiceOption;
    forms?: { label: string; arabic: string }[];
  }) => {
    playToken.current += 1;
    stop();
    setIsPlayingAll(false);
    setLoopingLineSira(null);
    setSentenceLoopRemaining(null);
    setShadowingTarget(target);
  };

  const handleToggleLoopLine = (line: ReadingTextLine) => {
    playClick();
    playToken.current += 1;
    stop();
    setIsPlayingAll(false);
    setSelectedParagraphSira(line.sira);

    if (loopingLineSira === line.sira) {
      setLoopingLineSira(null);
      setSentenceLoopRemaining(null);
    } else {
      const targetLoops: number | "infinite" =
        useSettings.getState().sentenceLoopCount;
      setLoopingLineSira(line.sira);
      setSentenceLoopRemaining(targetLoops);
      playSentence(line, false, true, targetLoops, 1);
    }
  };

  function handleTogglePlayAll() {
    if (!readingText) return;
    playClick();
    setLoopingLineSira(null);
    setSentenceLoopRemaining(null);

    if (isPlayingAll) {
      playToken.current += 1;
      stop();
      setIsPlayingAll(false);
      setDialogueLoopTurn(1);
    } else {
      setFlowMode("sequential");
      setIsPlayingAll(true);
      setDialogueLoopTurn(1);
      playToken.current += 1;
      const firstLine = readingText.satirlar[0];
      if (firstLine) {
        setSelectedParagraphSira(firstLine.sira);
        playSentence(firstLine, true, false, null, 1);
      }
    }
  }

  function handlePlaySingleClassroomLine(line: ReadingTextLine) {
    if (!readingText) return;
    playClick();
    if (!isPlayingAll && playingLineId === line.sira) {
      playToken.current += 1;
      stop();
      setLoopingLineSira(null);
      setSentenceLoopRemaining(null);
      return;
    }
    playToken.current += 1;
    stop();
    setIsPlayingAll(false);
    setLoopingLineSira(null);
    setSentenceLoopRemaining(null);
    setSelectedClassroomLine(line.sira);
    setSelectedParagraphSira(line.sira);
    const idx = readingText.satirlar.findIndex((s) => s.sira === line.sira);
    if (idx >= 0) setFocusedLineIndex(idx);
    playSentence(line, false, false, null, 1);
  }

  function handleToggleClassroomPlayAll(startLineOverride?: ReadingTextLine) {
    if (!readingText) return;
    playClick();
    setLoopingLineSira(null);
    setSentenceLoopRemaining(null);

    if (isPlayingAll) {
      playToken.current += 1;
      stop();
      setIsPlayingAll(false);
      setDialogueLoopTurn(1);
    } else {
      setFlowMode("sequential");
      setIsPlayingAll(true);
      setDialogueLoopTurn(1);
      playToken.current += 1;
      const targetStartLine = startLineOverride || readingText.satirlar[0];
      if (targetStartLine) {
        setSelectedClassroomLine(targetStartLine.sira);
        setSelectedParagraphSira(targetStartLine.sira);
        const idx = readingText.satirlar.findIndex(
          (s) => s.sira === targetStartLine.sira
        );
        if (idx >= 0) setFocusedLineIndex(idx);
        playSentence(targetStartLine, true, false, null, 1);
      }
    }
  }

  useEffect(() => {
    togglePlayAllShortcutRef.current = () => {
      if (
        !isPlayingAll &&
        (playingLineId !== null || isShadowingPause || loopingLineSira !== null)
      ) {
        playClick();
        playToken.current += 1;
        stop();
        setLoopingLineSira(null);
        setSentenceLoopRemaining(null);
        return;
      }
      handleTogglePlayAll();
    };

    classroomKeyHandlerRef.current = (e: KeyboardEvent) => {
      if (!readingText) return;
      const totalLines = readingText.satirlar.length;
      const currentIdx =
        playingLineId !== null
          ? Math.max(
              0,
              readingText.satirlar.findIndex((s) => s.sira === playingLineId)
            )
          : Math.min(
              Math.max(0, focusedLineIndex),
              Math.max(0, totalLines - 1)
            );
      const activeLineObj =
        readingText.satirlar[currentIdx] || readingText.satirlar[0];

      if (
        isClassroomMode &&
        (e.key === "ArrowDown" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowLeft")
      ) {
        e.preventDefault();
        e.stopPropagation();
        playClick();
        if (isPlayingAll || playingLineId !== null) {
          playToken.current += 1;
          stop();
          setIsPlayingAll(false);
        }
        setFocusedLineIndex((prev) => {
          const baseIdx =
            playingLineId !== null ? currentIdx : Math.max(0, prev);
          const nextIdx =
            e.key === "ArrowDown" || e.key === "ArrowRight"
              ? Math.min(totalLines - 1, baseIdx + 1)
              : Math.max(0, baseIdx - 1);
          const nextLineObj = readingText.satirlar[nextIdx];
          if (nextLineObj) {
            setSelectedClassroomLine(nextLineObj.sira);
            setSelectedParagraphSira(nextLineObj.sira);
          }
          return nextIdx;
        });
        return;
      }

      if (isClassroomMode && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        playClick();
        setIsClassroomMode(false);
        return;
      }

      if (isClassroomMode && (e.key === "r" || e.key === "R") && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        playClick();
        setIsClassroomLoop((prev) => !prev);
        return;
      }

      if (
        isClassroomMode &&
        !e.repeat &&
        ((e.code === "Space" && e.shiftKey) ||
          e.key === "p" ||
          e.key === "P")
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleToggleClassroomPlayAll(activeLineObj);
        return;
      }

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        if (isClassroomMode) {
          e.stopPropagation();
          if (activeLineObj) {
            handlePlaySingleClassroomLine(activeLineObj);
          }
          return;
        }
        togglePlayAllShortcutRef.current();
      }
    };
  });

  if (!rawReadingText) return notFound();

  const handleCompleteAndContinue = () => {
    playClick();
    if (!isDialogueCompleted(readingText.id)) {
      toggleCompletedDialogue(readingText.id);
      playSuccess();
    }
    if (nextReadingText) {
      router.push(`/metin/${nextReadingText.id}`);
    } else {
      router.push("/kutuphane?tab=metinler");
    }
  };

  const isFav = mounted ? isDialogueFavorite(readingText.id) : false;
  const isCompleted = mounted ? isDialogueCompleted(readingText.id) : false;
  const currentViewMode: ViewMode = mounted ? viewMode : "stacked";
  const isClickRevealActive =
    currentViewMode === "click-reveal" || clickToRevealTr;
  const shouldShowShadowingButton =
    !mounted || showShadowing || studyMode === "shadowing";

  const handleDownloadOfflineText = async () => {
    if (isDownloadingOffline) return;
    playClick();
    setIsDownloadingOffline(true);
    setOfflineProgressPct(5);
    const res = await downloadDialogueOfflinePack(
      readingText.id,
      (percent, _completed, _total, estMb) => {
        setOfflineProgressPct(percent);
        if (estMb > 0) setOfflineEstimatedMb(estMb);
      }
    );
    setIsDownloadingOffline(false);
    if (res.ok) {
      setIsOfflineReady(true);
      setShowOfflineNotice(true);
      playSuccess();
    }
  };

  // Ödev Hızlı Alıştırması Soruları
  const hwMiniQuizQuestions = (() => {
    const qs: {
      promptLabel: string;
      arabicDisplay: string;
      subHint: string;
      correctOption: string;
      options: string[];
    }[] = [];

    const linesForBlank = readingText.satirlar.slice(0, 2);
    linesForBlank.forEach((ln, idx) => {
      const words = ln.arapca.trim().split(/\s+/).filter(Boolean);
      const targetIdx = words.length > 2 ? 1 : 0;
      const targetWord = words[targetIdx] || words[0] || "";
      const blankedAr = words
        .map((w, i) => (i === targetIdx ? ".........." : w))
        .join(" ");
      const distractors = textVocabEntries
        .map((v) =>
          (v.contextWord || v.item.mufret || v.item.mazi || "").trim()
        )
        .filter((w) => w && w !== targetWord)
        .slice(idx * 3, idx * 3 + 3);
      const opts = Array.from(
        new Set([targetWord, ...distractors, "نَعَمْ", "شُكْراً", "هُنَا"])
      ).slice(0, 4);
      const rotated = opts
        .slice()
        .sort((a, b) => a.localeCompare(b, "ar"));
      qs.push({
        promptLabel: `Bölüm 1: Boşluk Doldurma (${idx + 1}/4)`,
        arabicDisplay: blankedAr,
        subHint: `Türkçesi: "${ln.turkce}"`,
        correctOption: targetWord,
        options: rotated,
      });
    });

    const vocabSample = textVocabEntries.slice(0, 2);
    vocabSample.forEach((v, idx) => {
      const arWord =
        v.contextWord ||
        (v.item.mufret || v.item.mazi || "").split("/")[0].trim();
      const correctTr = v.item.anlam_tr;
      const otherTrs = textVocabEntries
        .map((o) => o.item.anlam_tr)
        .filter((t) => t && t !== correctTr)
        .slice(idx * 2, idx * 2 + 3);
      const opts = Array.from(
        new Set([
          correctTr,
          ...otherTrs,
          "Merhaba / Hoş geldiniz",
          "Teşekkür ederim",
          "İyi günler",
        ])
      ).slice(0, 4);
      const rotated = opts.slice().sort((a, b) => a.localeCompare(b, "tr"));
      qs.push({
        promptLabel: `Bölüm 2: Kelime Eşleştirme (${idx + 3}/4)`,
        arabicDisplay: arWord,
        subHint: "Yukarıdaki kelimenin Türkçe karşılığını seçin:",
        correctOption: correctTr,
        options: rotated,
      });
    });

    return qs;
  })();

  const hwListenTarget = Math.min(3, readingText.satirlar.length);
  const isHwListenDone =
    !hwConfig.requireListen ||
    hwListenedLines.length >= hwListenTarget ||
    isCompleted;
  const isHwPronDone =
    hwConfig.pronCount <= 0 || hwPronouncedCount >= hwConfig.pronCount;
  const isHwQuizDone = !hwConfig.requireQuiz || hwQuizCompleted;

  const hwTotalTasks =
    (hwConfig.requireListen ? 1 : 0) +
    (hwConfig.pronCount > 0 ? 1 : 0) +
    (hwConfig.requireQuiz ? 1 : 0);
  const hwCompletedTasks =
    (hwConfig.requireListen && isHwListenDone ? 1 : 0) +
    (hwConfig.pronCount > 0 && isHwPronDone ? 1 : 0) +
    (hwConfig.requireQuiz && isHwQuizDone ? 1 : 0);
  const hwCompletionRatioPct =
    hwTotalTasks > 0
      ? Math.round((hwCompletedTasks / hwTotalTasks) * 100)
      : 100;

  const hwAverageScore: number | null =
    hwCollectedScores.length > 0
      ? Math.round(
          hwCollectedScores.reduce((a, b) => a + b, 0) /
            hwCollectedScores.length
        )
      : null;

  const hwWeakWordsList: { arabic: string; turkish: string }[] = (() => {
    const matchedMistakes = textVocabEntries
      .filter((v) => mistakeIds.includes(v.item.id))
      .map((v) => ({
        arabic: (v.item.mufret || v.item.mazi || "").split("/")[0].trim(),
        turkish: v.item.anlam_tr.split(",")[0].trim(),
      }));
    if (matchedMistakes.length > 0) return matchedMistakes.slice(0, 4);
    return textVocabEntries.slice(0, 3).map((v) => ({
      arabic: (v.item.mufret || v.item.mazi || "").split("/")[0].trim(),
      turkish: v.item.anlam_tr.split(",")[0].trim(),
    }));
  })();

  const activePlaybackSira =
    playingLineId ?? shadowingPauseLineSira ?? loopingLineSira ?? null;
  const activeClassroomLineIndex =
    activePlaybackSira !== null
      ? Math.max(
          0,
          readingText.satirlar.findIndex((s) => s.sira === activePlaybackSira)
        )
      : Math.min(
          Math.max(0, focusedLineIndex),
          Math.max(0, readingText.satirlar.length - 1)
        );
  const activeClassroomLineObj =
    readingText.satirlar[activeClassroomLineIndex] || readingText.satirlar[0];
  const activeClassroomSira = activeClassroomLineObj?.sira ?? 1;

  // Okuma Metni Anlama Soruları ("❓ Sorular" Sekmesi) Yardımcıları
  const quizQuestionsWithOptions = (() => {
    return readingText.sorular.map((q, qIdx) => {
      const otherAnswers = readingText.sorular
        .filter((_, idx) => idx !== qIdx)
        .map((other) => other.cevap_ar);
      const sentenceDistractors = readingText.satirlar
        .map((l) => l.arapca)
        .filter((ar) => cleanArabicText(ar) !== cleanArabicText(q.cevap_ar));
      const pool = Array.from(
        new Set([q.cevap_ar, ...otherAnswers, ...sentenceDistractors])
      ).slice(0, 4);
      const options = pool
        .slice()
        .sort((a, b) =>
          qIdx % 2 === 0 ? a.localeCompare(b, "ar") : b.localeCompare(a, "ar")
        );
      return {
        ...q,
        options,
      };
    });
  })();

  const correctQuizCount = quizQuestionsWithOptions.reduce((acc, q, qIdx) => {
    const chosenIdx = selectedAnswers[qIdx];
    if (chosenIdx === undefined) return acc;
    const chosenOpt = q.options[chosenIdx];
    return chosenOpt &&
      cleanArabicText(chosenOpt) === cleanArabicText(q.cevap_ar)
      ? acc + 1
      : acc;
  }, 0);

  const selectedParagraphLine =
    readingText.satirlar.find(
      (l) => l.sira === (selectedParagraphSira ?? 1)
    ) || readingText.satirlar[0];

  const cycleSpeechSpeed = () => {
    playClick();
    const rates: SpeechRate[] = [0.5, 0.75, 1, 1.25, 1.5];
    const idx = rates.findIndex((r) => r === speechRate);
    const nextRate = rates[(idx + 1) % rates.length];
    setSpeechRate(nextRate);
    setPlaybackRate(nextRate);
  };

  const revealAllTrLines = () => {
    playClick();
    const all: Record<number, boolean> = {};
    readingText.satirlar.forEach((l) => {
      all[l.sira] = true;
    });
    setRevealedTrLines(all);
  };

  return (
    <div
      className={
        isGrammarSplitOpen && grammarNote
          ? `w-full lg:w-[min(88rem,calc(100vw-2rem))] lg:relative lg:left-1/2 lg:-translate-x-1/2 lg:grid ${
              grammarSplitSide === "left"
                ? "lg:grid-cols-[400px_minmax(0,1fr)]"
                : "lg:grid-cols-[minmax(0,1fr)_400px]"
            } lg:gap-4 xl:gap-5 lg:items-start ${
              isClassroomMode ? "pb-28" : "pb-28 md:pb-10"
            } transition-all duration-200`
          : isClassroomMode
          ? "space-y-4 max-w-7xl w-full lg:w-[min(80rem,calc(100vw-2rem))] lg:relative lg:left-1/2 lg:-translate-x-1/2 px-1 sm:px-4 md:px-8 pb-28 transition-all duration-300"
          : "space-y-3 pb-28 md:pb-10"
      }
    >
      <div
        className={`min-w-0 ${isClassroomMode ? "space-y-4" : "space-y-3"} ${
          isGrammarSplitOpen && grammarNote
            ? grammarSplitSide === "left"
              ? "lg:order-2"
              : "lg:order-1"
            : ""
        }`}
      >
      {/* GÖLGELEME VE TELAFFUZ KOÇU MODALI */}
      {shadowingTarget && (
        <ShadowingModal
          text={shadowingTarget.text}
          itemId={shadowingTarget.itemId}
          refAudioUrl={shadowingTarget.audioUrl}
          voice={shadowingTarget.voice}
          forms={shadowingTarget.forms}
          level={readingText.seviye}
          onEvaluated={(score, evaluatedText) => {
            recordHwLinePractice(
              evaluatedText || shadowingTarget.text,
              score > 0 ? score : null
            );
          }}
          onPracticedUnscored={(practicedText) => {
            recordHwLinePractice(practicedText || shadowingTarget.text, null);
          }}
          onClose={() => setShadowingTarget(null)}
        />
      )}

      {/* DERS NOTU / PDF ÇIKTI VE A4 QUIZ YAPRAĞI MODALI */}
      {isPdfModalOpen && (
        <DialoguePdfModal
          dialogue={dialogueForPdf}
          vocabEntries={textVocabEntries}
          imagePath={imagePath}
          rawNum={rawNum}
          readingQuestions={readingText.sorular}
          onClose={() => setIsPdfModalOpen(false)}
        />
      )}

      {/* ÖĞRETMEN İÇİN "🎓 ÖDEV OLUŞTUR" MODALI */}
      {isTeacherHwModalOpen && (
        <TeacherHomeworkModal
          isOpen={isTeacherHwModalOpen}
          onClose={() => setIsTeacherHwModalOpen(false)}
          dialogueId={readingText.id}
          dialogueTitleTr={readingText.baslik_tr}
          dialogueTitleAr={getDisplayText(readingText.baslik_ar)}
          levelLabel={readingText.seviye}
          totalLines={readingText.satirlar.length}
          onOpenCertificate={() => {
            setHwConfig((prev) => ({ ...prev, active: true }));
            setIsHwReportModalOpen(true);
          }}
        />
      )}

      {/* ÖĞRENCİ ÖDEV TAMAMLAMA VE DOĞRULAMA RAPORU MODALI */}
      {isHwReportModalOpen && (
        <ShareAchievementModal
          isOpen={isHwReportModalOpen}
          onClose={() => setIsHwReportModalOpen(false)}
          title={readingText.baslik_tr}
          arabicTitle={getDisplayText(readingText.baslik_ar)}
          subtitle={`Metin #${String(rawNum).padStart(2, "0")} • ${readingText.satirlar.length} Cümle • ${textVocabEntries.length} Kelime`}
          levelLabel={readingText.seviye}
          scorePercent={hwAverageScore}
          pointsText={`${hwCompletedTasks}/${hwTotalTasks} Görev`}
          wordsCount={textVocabEntries.length}
          badgeType="homework"
          homeworkTitle={hwConfig.title || `${readingText.baslik_tr} Ödevi`}
          completionPercent={hwCompletionRatioPct}
          listenedCount={hwListenedLines.length}
          totalLinesCount={readingText.satirlar.length}
          pronPracticedCount={hwPronouncedCount}
          pronTargetCount={hwConfig.pronCount}
          quizCompleted={isHwQuizDone}
          weakWordsList={hwWeakWordsList}
          dialogueId={readingText.id}
          homeworkUrl={
            typeof window !== "undefined" ? window.location.href : undefined
          }
        />
      )}

      {/* BAŞARI KARTINI PAYLAŞ / İNDİR MODALI */}
      {isShareModalOpen && (
        <ShareAchievementModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title={readingText.baslik_tr}
          arabicTitle={getDisplayText(readingText.baslik_ar)}
          subtitle={`Metin #${String(rawNum).padStart(2, "0")} • ${readingText.satirlar.length} Cümle • ${readingText.sorular.length} Soru • ${textVocabEntries.length} Kelime`}
          levelLabel={readingText.seviye}
          scorePercent={
            readingText.sorular.length > 0 &&
            Object.keys(selectedAnswers).length > 0
              ? Math.round(
                  (correctQuizCount / readingText.sorular.length) * 100
                )
              : hwAverageScore
          }
          pointsText={`${readingText.satirlar.length} Cümle`}
          wordsCount={textVocabEntries.length}
          badgeType="dialogue"
        />
      )}

      {/* ÖDEV İÇİ HIZLI ALIŞTIRMA (BOŞLUK DOLDURMA & EŞLEŞTİRME) MODALI */}
      {isHwQuizModalOpen && hwMiniQuizQuestions.length > 0 && (
        <div
          className="fixed inset-0 z-[75] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsHwQuizModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#6741D9] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={17} />
                <span className="text-xs sm:text-sm font-extrabold">
                  📝 Ödev Alıştırması (Boşluk Doldurma &amp; Eşleştirme)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsHwQuizModalOpen(false)}
                className="w-7 h-7 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              {(() => {
                const currentQ =
                  hwMiniQuizQuestions[
                    Math.min(hwQuizStep, hwMiniQuizQuestions.length - 1)
                  ];
                return (
                  <>
                    <div className="flex items-center justify-between text-xs font-extrabold text-slate-600 dark:text-slate-300">
                      <span>{currentQ.promptLabel}</span>
                      <span>
                        Soru {hwQuizStep + 1} / {hwMiniQuizQuestions.length}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#F7EFE1] dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] space-y-1.5 text-center">
                      <p
                        dir="rtl"
                        className="arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-400"
                      >
                        {getDisplayText(currentQ.arabicDisplay)}
                      </p>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {currentQ.subHint}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {currentQ.options.map((opt) => {
                        const isSelected = hwQuizSelectedOpt === opt;
                        const isCorrect = opt === currentQ.correctOption;
                        const isArOpt = /[\u0600-\u06FF]/.test(opt);
                        let btnStyle =
                          "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#6741D9]";
                        if (hwQuizSelectedOpt !== null) {
                          if (isCorrect) {
                            btnStyle =
                              "bg-emerald-600 border-emerald-800 text-white";
                          } else if (isSelected) {
                            btnStyle = "bg-rose-600 border-rose-800 text-white";
                          }
                        }

                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={hwQuizSelectedOpt !== null}
                            onClick={() => {
                              playClick();
                              setHwQuizSelectedOpt(opt);
                              const nextCorrect =
                                opt === currentQ.correctOption
                                  ? hwQuizCorrectCount + 1
                                  : hwQuizCorrectCount;
                              if (opt === currentQ.correctOption) {
                                setHwQuizCorrectCount(nextCorrect);
                                playSuccess();
                              }
                              setTimeout(() => {
                                if (
                                  hwQuizStep + 1 <
                                  hwMiniQuizQuestions.length
                                ) {
                                  setHwQuizStep((s) => s + 1);
                                  setHwQuizSelectedOpt(null);
                                } else {
                                  setHwQuizCompleted(true);
                                  setIsHwQuizModalOpen(false);
                                  playFanfare();
                                }
                              }, 700);
                            }}
                            dir={isArOpt ? "rtl" : "ltr"}
                            className={`w-full py-2.5 px-3.5 rounded-xl border-2 border-b-3 font-extrabold transition-all cursor-pointer ${
                              isArOpt ? "arabic text-xl" : "text-xs sm:text-sm"
                            } ${btnStyle}`}
                          >
                            {isArOpt ? getDisplayText(opt) : opt}
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ÖĞRENCİ İÇİN "ÖDEV TAKİP ÇUBUĞU" (?hw=1 parametresiyle gelindiğinde veya Ödev menüsünden açıldığında en üstte görünür) */}
      {hwConfig.active && (
        <section className="rounded-2xl bg-gradient-to-r from-[#F3F0FF] via-[#FDFBF7] to-emerald-50/80 dark:from-indigo-950/70 dark:via-slate-900 dark:to-emerald-950/50 border-2 border-[#6741D9] border-b-4 p-3 sm:p-4 shadow-md space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2.5 py-1 rounded-xl bg-[#6741D9] text-white text-xs font-black flex items-center gap-1.5 shrink-0">
                  <GraduationCap size={14} className="shrink-0" />
                  <span>🎓 Öğretmen Ödev Paketi</span>
                </span>
                <h2 className="text-xs sm:text-sm font-black text-[var(--foreground)] truncate">
                  {hwConfig.title || `${readingText.baslik_tr} Sınıf Ödevi`}
                </h2>
              </div>

              <span className="sm:hidden px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-[#6741D9]/40 text-[11px] font-extrabold text-[#6741D9] dark:text-indigo-300 tabular-nums shrink-0">
                {hwCompletedTasks}/{hwTotalTasks} (%{hwCompletionRatioPct})
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full sm:w-auto">
              <span className="hidden sm:inline-flex px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-[#6741D9]/40 text-[11px] font-extrabold text-[#6741D9] dark:text-indigo-300 tabular-nums shrink-0">
                İlerleme: {hwListenedLines.length}/{readingText.satirlar.length} Cümle • Görev: {hwCompletedTasks}/{hwTotalTasks} (%
                {hwCompletionRatioPct})
              </span>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIsHwReportModalOpen(true);
                }}
                className="w-full sm:w-auto justify-center text-xs sm:text-sm px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold border-b-2 border-emerald-800 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 size={14} className="shrink-0" />
                <span>🏅 Ödevi Tamamla &amp; Ödev Karnesi Al</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {hwConfig.requireListen && (
              <div
                className={`p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 ${
                  isHwListenDone
                    ? "bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-600 text-emerald-900 dark:text-emerald-200"
                    : "bg-white/90 dark:bg-slate-900/80 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${
                      isHwListenDone
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {isHwListenDone ? "✓" : "1"}
                  </span>
                  <span className="text-xs font-extrabold truncate">
                    Metni Dinle ve İncele
                  </span>
                </div>
                <span className="text-[11px] font-black tabular-nums shrink-0 text-slate-600 dark:text-slate-300">
                  {Math.min(hwListenedLines.length, hwListenTarget)}/
                  {hwListenTarget} Cümle
                </span>
              </div>
            )}

            {hwConfig.pronCount > 0 && (
              <div
                className={`p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 ${
                  isHwPronDone
                    ? "bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-600 text-emerald-900 dark:text-emerald-200"
                    : "bg-white/90 dark:bg-slate-900/80 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${
                      isHwPronDone
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {isHwPronDone ? "✓" : "2"}
                  </span>
                  <span className="text-xs font-extrabold truncate">
                    En Az {hwConfig.pronCount} Cümlede Telaffuz Yap
                  </span>
                </div>
                <span className="text-[11px] font-black tabular-nums shrink-0 text-slate-600 dark:text-slate-300">
                  {Math.min(hwPronouncedCount, hwConfig.pronCount)}/
                  {hwConfig.pronCount}
                </span>
              </div>
            )}

            {hwConfig.requireQuiz && (
              <div
                className={`p-2.5 rounded-xl border-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 ${
                  isHwQuizDone
                    ? "bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-600 text-emerald-900 dark:text-emerald-200"
                    : "bg-white/90 dark:bg-slate-900/80 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${
                      isHwQuizDone
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {isHwQuizDone ? "✓" : "3"}
                  </span>
                  <span className="text-xs font-extrabold">
                    Metin Alıştırmalarını Çöz
                  </span>
                </div>
                {isHwQuizDone ? (
                  <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 shrink-0 ml-auto">
                    Tamamlandı ✓
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setHwQuizStep(0);
                      setHwQuizSelectedOpt(null);
                      setHwQuizCorrectCount(0);
                      setIsHwQuizModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#6741D9] hover:bg-[#5230B5] text-white text-[11px] font-extrabold shrink-0 ml-auto cursor-pointer"
                  >
                    Alıştırmayı Aç →
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAM EKRAN METİN GÖRSELİ ÖNİZLEME (LIGHTBOX MODAL) */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[60] print:hidden bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-3xl w-full bg-[#FDFBF7] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-black/5 dark:bg-black/40">
              <img
                src={imagePath}
                alt={readingText.baslik_tr}
                referrerPolicy="no-referrer"
                className="w-full max-h-[70vh] object-contain mx-auto"
              />
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIsLightboxOpen(false);
                }}
                className="absolute top-3 right-3 h-9 px-3.5 rounded-xl bg-black/75 hover:bg-black text-white text-xs font-extrabold flex items-center gap-1.5 border border-white/20 cursor-pointer shadow-lg"
              >
                <X size={15} />
                <span>Kapat (ESC)</span>
              </button>
            </div>

            <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-[#F7EFE1] dark:bg-[var(--background)] border-t border-[#E6D7BE] dark:border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-[#087F5B] text-white font-extrabold text-xs tabular-nums">
                  Metin #{String(rawNum).padStart(2, "0")} •{" "}
                  {readingText.seviye}
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)]">
                  {readingText.baslik_tr}
                </h3>
                <span className="text-xs font-semibold text-[var(--muted)]">
                  ({readingText.satirlar.length} Cümle ·{" "}
                  {readingText.sorular.length} Soru · {textVocabEntries.length}{" "}
                  Kelime)
                </span>
              </div>
              <span
                dir="rtl"
                className="arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-400"
              >
                {getDisplayText(readingText.baslik_ar)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KOMPAKT 3 SATIRLIK OKUMA METNİ BİLGİ VE KONTROL KARTI (Diyalog Sayfası İle Birebir Eşit Mimari) */}
      <section className="relative bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-sm p-2 sm:p-3 space-y-1.5">
        {/* 1. SATIR: Kompakt Başlık ve 1:1 Kare Görsel Satırı */}
        <div className="flex items-center justify-between gap-2 py-0.5">
          <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
            <Link
              href="/kutuphane?tab=metinler"
              onClick={() => playClick()}
              data-tooltip="Metinler Kütüphanesine Dön"
              data-tooltip-align="left"
              aria-label="Kütüphaneye Dön"
              className="w-8 h-8 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center justify-center text-[var(--foreground)] hover:border-[#087F5B] shrink-0 transition-all mt-0.5 sm:mt-0"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </Link>

            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-emerald-600 dark:bg-emerald-600 text-white font-extrabold text-[10px] tabular-nums shrink-0">
                  Metin #{String(rawNum).padStart(2, "0")} • {readingText.seviye}
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                  {readingText.satirlar.length} Cümle • {readingText.sorular.length} Soru • {textVocabEntries.length} Kelime
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 sm:flex-wrap leading-snug">
                <h1 className="text-xs sm:text-base font-extrabold text-[var(--foreground)] line-clamp-2">
                  {readingText.baslik_tr}
                </h1>
                <span className="hidden sm:inline text-slate-600 dark:text-slate-300 font-bold">
                  |
                </span>
                <span
                  dir="rtl"
                  className="arabic text-base sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 leading-snug line-clamp-1"
                >
                  {getDisplayText(readingText.baslik_ar)}
                </span>
              </div>
            </div>
          </div>

          {/* Sağdaki 1:1 Kare Metin Görseli (Tıklanınca Büyür) */}
          <button
            type="button"
            onClick={() => {
              playClick();
              setIsLightboxOpen(true);
            }}
            data-tooltip="Görseli Büyüt"
            data-tooltip-align="right"
            aria-label="Metin Kapak Görselini Büyüt"
            className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 aspect-square rounded-xl object-cover shrink-0 shadow-xs overflow-hidden border-2 border-white/80 dark:border-slate-700 relative group cursor-pointer"
          >
            <img
              src={imagePath}
              alt={readingText.baslik_tr}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <span className="absolute bottom-0.5 right-0.5 p-1 rounded-md bg-black/65 text-white flex items-center justify-center">
              <Maximize2 size={9} />
            </span>
          </button>
        </div>

        {/* 2. SATIR: Mobilde Tek Satır Yatay Kaydırılabilir (+ Sağ Görsel Kaydırma İpucu), Masaüstünde 5 Sütunlu Çalışma Modu Sekmeleri */}
        <div className="relative w-full">
          <div className="w-full flex overflow-x-auto no-scrollbar whitespace-nowrap md:grid md:grid-cols-5 gap-1.5 p-1 pr-7 md:pr-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
            {(
              [
                { id: "listen", label: "📖 Metni Oku & Dinle" },
                { id: "shadowing", label: "🎙️ Telaffuz" },
                {
                  id: "questions",
                  label: `❓ Sorular (${readingText.sorular.length})`,
                },
                {
                  id: "vocabulary",
                  label: `📚 Sözlük (${textVocabEntries.length})`,
                },
                ...(grammarNote
                  ? [{ id: "gramer" as StudyMode, label: "📌 Odak Gramer" }]
                  : []),
              ] as { id: StudyMode; label: string }[]
            ).map((tab) => {
              const isSelected = activeTabId === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    playClick();
                    if (tab.id === "gramer" && isGrammarSplitOpen) {
                      stopAllAudio();
                      setGrammarSplitOpen(false);
                    }
                    setStudyMode(tab.id);
                  }}
                  className={`shrink-0 text-xs py-1.5 px-2.5 sm:px-2 whitespace-nowrap rounded-lg font-extrabold transition-all text-center cursor-pointer ${
                    isSelected
                      ? "bg-[#6741D9] text-white shadow-2xs"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] bg-white/60 dark:bg-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <span
            aria-hidden="true"
            className="md:hidden pointer-events-none absolute inset-y-0.5 right-0.5 w-7 rounded-r-xl bg-gradient-to-l from-slate-100 via-slate-100/85 to-transparent dark:from-slate-800 dark:via-slate-800/85 flex items-center justify-end pr-1 text-[var(--muted)]"
          >
            <ChevronRight size={13} className="opacity-80" />
          </span>
        </div>

        {/* 3. SATIR: Tek Satırlık Kompakt Kontrol Çubuğu + "⋯" Diğer Menüsü */}
        <div className="pt-1 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            {/* Sol/Orta Kısım: Kompakt Aksiyon Butonları */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {/* 1. ▶ Dinle / Durdur */}
              <button
                type="button"
                onClick={handleTogglePlayAll}
                data-tooltip="Tüm metni sırayla seslendir / durdur"
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs border-b-2 transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                  isPlayingAll
                    ? "bg-red-600 hover:bg-red-700 text-white border-red-800"
                    : "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-800"
                }`}
              >
                {isPlayingAll ? (
                  <Square size={11} fill="currentColor" />
                ) : (
                  <Play size={11} fill="currentColor" />
                )}
                <span>{isPlayingAll ? "Durdur" : "Dinle"}</span>
              </button>

              {/* 2. Hız Butonu (0.5x / 0.75x / 1.0x / 1.25x / 1.5x Tek Rozet Buton) */}
              <button
                type="button"
                onClick={cycleSpeechSpeed}
                data-tooltip="Okuma Hızını Değiştir (0.5x / 0.75x / 1.0x / 1.25x / 1.5x)"
                aria-label="Okuma Hızı"
                className={`px-2 py-1.5 rounded-xl border text-xs font-semibold tabular-nums transition-all cursor-pointer shrink-0 ${
                  mounted && speechRate !== 1
                    ? "bg-[#087F5B] border-[#087F5B] text-white"
                    : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                }`}
              >
                {mounted
                  ? speechRate === 1
                    ? "1.0x"
                    : `${speechRate}x`
                  : "1.0x"}
              </button>

              {/* 3. Hareke Butonu (✨ 3 Kademeli Hareke Solması) */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  toggleHareke();
                  setLineHarekeOverrides({});
                }}
                data-tooltip="Hareke Görünümü: Tam Harekeli → Hareke Solması (İ'rab) → Harekesiz"
                aria-label="Hareke Görünümünü Değiştir"
                className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1 text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                  !mounted || harekeMode === "full"
                    ? "bg-[#087F5B]/15 border-[#087F5B] text-[#065F46] dark:text-emerald-400"
                    : harekeMode === "irab-only"
                    ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300"
                    : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Sparkles size={13} className="shrink-0" />
                <span>
                  {!mounted || harekeMode === "full"
                    ? "Hareke"
                    : harekeMode === "irab-only"
                    ? "İ'rab"
                    : "Harekesiz"}
                </span>
              </button>

              {/* 4. Seslendirici Cinsiyeti (👨 Erkek / 👩 Kadın) */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  togglePreferredVoiceGender();
                }}
                data-tooltip="Seslendirici Cinsiyetini Değiştir (Erkek / Kadın)"
                aria-label="Seslendirici Cinsiyeti"
                className="px-2 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>
                  {!mounted || preferredVoiceGender === "erkek" ? "👨" : "👩"}
                </span>
                <span className="hidden sm:inline">
                  {!mounted || preferredVoiceGender === "erkek"
                    ? "Erkek"
                    : "Kadın"}
                </span>
              </button>

              {/* 5. METİN SAYFASINA ÖZEL: Paragraf / Cümle Görünümü Geçiş Butonu */}
              {(activeTabId === "listen" || activeTabId === "shadowing") && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    updateTextLayoutMode(
                      textLayoutMode === "sentences" ? "paragraph" : "sentences"
                    );
                  }}
                  data-tooltip={
                    textLayoutMode === "sentences"
                      ? "Paragraf (Bütün Metin) görünümüne geç"
                      : "Cümle Cümle (Liste) görünümüne geç"
                  }
                  aria-label="Paragraf veya Cümle Görünümü"
                  className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1 text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                    textLayoutMode === "paragraph"
                      ? "bg-[#6741D9] border-[#5230B5] text-white shadow-2xs"
                      : "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9]/50 hover:border-[#6741D9] text-[#4C28B5] dark:text-[#d0bfff]"
                  }`}
                >
                  {textLayoutMode === "sentences" ? (
                    <>
                      <AlignJustify size={13} className="shrink-0" />
                      <span>📄 Paragraf</span>
                    </>
                  ) : (
                    <>
                      <LayoutList size={13} className="shrink-0" />
                      <span>📑 Cümle</span>
                    </>
                  )}
                </button>
              )}

              {/* 5b. Yan Yana Gramer Toggle Butonu (Masaüstünde 2 Sütunlu Panel, Mobilde Alt Çekmece) */}
              {grammarNote && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    handleToggleGrammarSplit();
                  }}
                  aria-pressed={isGrammarSplitOpen}
                  data-tooltip={
                    isGrammarSplitOpen
                      ? "Gramer Panelini Kapat"
                      : "Gramer Notunu Metinle Yan Yana Aç"
                  }
                  aria-label={
                    isGrammarSplitOpen
                      ? "Gramer Panelini Kapat"
                      : "Yan Yana Gramer"
                  }
                  className={`inline-flex px-2.5 py-1.5 rounded-xl border items-center gap-1.5 text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isGrammarSplitOpen
                      ? "bg-[#087F5B] hover:bg-[#065F46] border-[#065F46] text-white shadow-xs"
                      : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/70 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200"
                  }`}
                >
                  <Columns2 size={13} className="shrink-0" />
                  <span>
                    {isGrammarSplitOpen ? "Gramer Panelini Kapat" : "Yan Yana Gramer"}
                  </span>
                </button>
              )}

              {/* 5c. Bağlı Tavsiye YouTube Videosu / Oynatma Listesi Rozeti */}
              {linkedYoutubeVideos.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    playToken.current += 1;
                    stop();
                    stopAllAudio();
                    setIsPlayingAll(false);
                    setLoopingLineSira(null);
                    setIsYoutubeModalOpen(true);
                  }}
                  data-tooltip="Bu okuma metniyle ilişkili küratörlü Arapça video/oynatma listesini uygulama içinde izle"
                  className="inline-flex px-2.5 py-1.5 rounded-xl border border-rose-500 bg-rose-600 hover:bg-rose-700 text-white items-center gap-1.5 text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer shrink-0 shadow-2xs"
                >
                  <span>🎬 İlgili Tavsiye Videoyu / Listeyi İzle</span>
                </button>
              )}

              {/* 6. 🖥️ Akıllı Tahta / Sınıf Sunum Modu Butonu (Yalnızca Tablet ve Masaüstü >= 768px) */}
              <button
                type="button"
                onClick={(e) => {
                  (e.currentTarget as HTMLElement)?.blur();
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setIsClassroomMode(false);
                    return;
                  }
                  playClick();
                  setIsClassroomMode((v) => {
                    const next = !v;
                    if (next && selectedClassroomLine === null) {
                      setSelectedClassroomLine(
                        readingText.satirlar[0]?.sira ?? 1
                      );
                      setFocusedLineIndex(0);
                    }
                    return next;
                  });
                }}
                data-tooltip="Sınıf / Tahta Modu: Metinleri büyütür ve alt sunum kumandasını açar"
                aria-label="Sınıf / Tahta Modu"
                className={`hidden md:inline-flex px-2.5 py-1.5 rounded-xl border text-xs font-extrabold items-center gap-1 transition-all cursor-pointer shrink-0 ${
                  isClassroomMode
                    ? "bg-[#087F5B] border-[#087F5B] text-white shadow-2xs"
                    : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-[var(--foreground)]"
                }`}
              >
                <span>🖥️ Sınıf / Tahta Modu</span>
              </button>

              {/* Telaffuz Modunda Oto Koç Butonu */}
              {studyMode === "shadowing" && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setAutoShadowingFlow((v) => !v);
                  }}
                  title="Cümle dinlendikten sonra otomatik olarak telaffuz koçunu aç"
                  className={`px-2 py-1.5 rounded-xl border text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                    autoShadowingFlow
                      ? "bg-[#087F5B] border-[#087F5B] text-white"
                      : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                  }`}
                >
                  <Mic size={12} />
                  <span>Oto Koç: {autoShadowingFlow ? "Açık" : "Manuel"}</span>
                </button>
              )}
            </div>

            {/* Sağ Kısım: "⋯" (MoreHorizontal) Araçlar & Seçenekler Popover Menüsü */}
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIsMoreMenuOpen((v) => !v);
                }}
                data-tooltip="Araçlar, PDF, Ödev, Paylaş, İndir, Kör Dinleme ve Görünüm"
                data-tooltip-align="right"
                aria-label="Araçlar ve Diğer Seçenekler Menüsü"
                className={`h-8 px-2.5 rounded-xl border-2 border-b-3 flex items-center justify-center gap-1 text-xs font-extrabold transition-all cursor-pointer ${
                  isMoreMenuOpen
                    ? "bg-[#6741D9] border-[#5230B5] text-white"
                    : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#6741D9]"
                }`}
              >
                <MoreHorizontal size={16} />
                <span className="hidden sm:inline">Araçlar</span>
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] max-h-[80dvh] overflow-y-auto rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-3 shadow-2xl z-50 space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                      Metin Araçları &amp; Görünüm
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMoreMenuOpen(false)}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                      aria-label="Menüyü Kapat"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* İkincil Araçlar (PDF, Ödev, Paylaş, İndir, Kör Dinleme) Tek Merkezde */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-[var(--muted)] block">
                      Ek Araçlar &amp; Modlar
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setIsMoreMenuOpen(false);
                          setIsPdfModalOpen(true);
                        }}
                        className="col-span-2 py-2 px-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] flex items-center justify-center gap-1.5 text-xs font-extrabold cursor-pointer"
                      >
                        <FileText size={13} className="text-[#065F46] shrink-0" />
                        <span>PDF / Çalışma Kağıdı</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setIsMoreMenuOpen(false);
                          setIsTeacherHwModalOpen(true);
                        }}
                        className="py-2 px-2.5 rounded-xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border border-[#6741D9]/50 text-[#4C28B5] dark:text-[#d0bfff] flex items-center justify-center gap-1.5 text-xs font-extrabold cursor-pointer"
                      >
                        <GraduationCap size={13} className="shrink-0" />
                        <span>Ödev Oluştur</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setIsMoreMenuOpen(false);
                          setShareCardTarget({
                            type: "reading",
                            arabicText:
                              readingText.satirlar[0]?.arapca ||
                              readingText.baslik_ar,
                            titleAr: readingText.baslik_ar,
                            titleTr: readingText.baslik_tr,
                            turkishText:
                              readingText.satirlar[0]?.turkce ||
                              readingText.baslik_tr,
                            excerptLines: readingText.satirlar
                              .slice(0, 3)
                              .map((l) => ({
                                arapca: l.arapca,
                                turkce: l.turkce,
                              })),
                            level: readingText.seviye,
                            category: readingText.tema,
                            imageUrl:
                              readingText.gorsel ||
                              getReadingTextCoverUrl(readingText.id),
                            deepLink: `https://app.muallimun.net/metin/${readingText.id}`,
                            initialShowTranslation:
                              currentViewMode !== "arabic-only" &&
                              !isClickRevealActive,
                          });
                        }}
                        className="col-span-2 py-2 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500/50 text-[#065F46] dark:text-emerald-300 flex items-center justify-center gap-1.5 text-xs font-extrabold cursor-pointer"
                      >
                        <Share2 size={13} className="shrink-0" />
                        <span>Görsel Kart Olarak Paylaş</span>
                      </button>

                      <button
                        type="button"
                        disabled={isDownloadingOffline}
                        onClick={() => {
                          if (isOfflineReady) {
                            playClick();
                            setShowOfflineNotice((v) => !v);
                          } else {
                            void handleDownloadOfflineText();
                          }
                        }}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                          isOfflineReady
                            ? "bg-emerald-600 border-emerald-800 text-white"
                            : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                        }`}
                      >
                        {isOfflineReady ? (
                          <>
                            <CheckCircle2 size={12} className="shrink-0" />
                            <span>Çevrimdışı Hazır</span>
                          </>
                        ) : isDownloadingOffline ? (
                          <>
                            <Download
                              size={12}
                              className="animate-bounce shrink-0"
                            />
                            <span>%{offlineProgressPct}</span>
                          </>
                        ) : (
                          <>
                            <Download
                              size={12}
                              className="text-[#065F46] dark:text-emerald-400 shrink-0"
                            />
                            <span>İndir (~{offlineEstimatedMb} MB)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setBlurArabic((v) => !v);
                          setRevealedArabicLines({});
                        }}
                        className={`col-span-2 py-2 px-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                          blurArabic
                            ? "bg-amber-600 border-amber-800 text-white"
                            : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                        }`}
                      >
                        <Eye
                          size={13}
                          className={
                            blurArabic
                              ? "text-white shrink-0"
                              : "text-amber-600 shrink-0"
                          }
                        />
                        <span>Kör Dinleme</span>
                      </button>
                    </div>
                  </div>

                  {/* OKUMA DÜZENİ (Metin Sayfasına Özel: Cümle Cümle vs Paragraf) */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-[var(--muted)] block">
                      Okuma Düzeni
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 bg-white dark:bg-[var(--background)] rounded-xl p-1.5 border border-[#E6D7BE] dark:border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          updateTextLayoutMode("sentences");
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          textLayoutMode === "sentences"
                            ? "bg-[#6741D9] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <LayoutList size={12} />
                        <span>📑 Cümle Cümle</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          updateTextLayoutMode("paragraph");
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          textLayoutMode === "paragraph"
                            ? "bg-[#6741D9] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <AlignJustify size={12} />
                        <span>📄 Paragraf (Bütün Metin)</span>
                      </button>
                    </div>
                  </div>

                  {/* METİN & ÇEVİRİ GÖRÜNÜMÜ */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-[var(--muted)] block">
                      Metin &amp; Çeviri Görünümü
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 bg-white dark:bg-[var(--background)] rounded-xl p-1.5 border border-[#E6D7BE] dark:border-[var(--border)]">
                      {(
                        [
                          { id: "stacked", label: "Alt Alta", icon: Rows2 },
                          { id: "columns", label: "İki Sütun", icon: Columns2 },
                          {
                            id: "arabic-only",
                            label: "Arapça",
                            icon: Languages,
                          },
                          { id: "turkish-only", label: "Türkçe", icon: Eye },
                        ] as {
                          id: ViewMode;
                          label: string;
                          icon: typeof Rows2;
                        }[]
                      ).map((opt) => {
                        const active =
                          !isClickRevealActive && currentViewMode === opt.id;
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              playClick();
                              setClickToRevealTr(false);
                              setViewMode(opt.id);
                              setRevealedTrLines({});
                              setRevealedArLines({});
                            }}
                            title={opt.label}
                            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              active
                                ? "bg-[#087F5B] text-white"
                                : "text-[var(--muted)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            <Icon size={13} />
                            <span className="whitespace-nowrap px-0.5">
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setClickToRevealTr(true);
                          setViewMode("click-reveal");
                          setRevealedTrLines({});
                        }}
                        title="Tıkla-Gör (Çeviriyi tıklayınca aç)"
                        className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          isClickRevealActive
                            ? "bg-[#087F5B] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <MousePointerClick size={13} />
                        <span className="whitespace-nowrap px-0.5">
                          Tıkla-Gör
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* DİNLENEN KELİME VURGUSU */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-[var(--muted)] block">
                      Dinlenen Kelime Vurgusu
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-white dark:bg-[var(--background)] rounded-xl p-1.5 border border-[#E6D7BE] dark:border-[var(--border)]">
                      {(
                        [
                          { id: "both", label: "Vurgu + Ok" },
                          { id: "highlight", label: "Sadece Vurgu" },
                          { id: "arrow", label: "Sadece Ok" },
                          { id: "off", label: "Kapalı" },
                        ] as { id: WordTrackingStyle; label: string }[]
                      ).map((ws) => {
                        const active =
                          (mounted ? wordTrackingStyle : "both") === ws.id;
                        return (
                          <button
                            key={ws.id}
                            type="button"
                            onClick={() => {
                              playClick();
                              setWordTrackingStyle(ws.id);
                            }}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                              active
                                ? "bg-[#6741D9] text-white"
                                : "text-[var(--muted)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {ws.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CÜMLELER ARASI GÖLGELEME BOŞLUĞU */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-[var(--muted)] block">
                      Cümleler Arası Gölgeleme Boşluğu
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 bg-white dark:bg-[var(--background)] rounded-xl p-1.5 border border-[#E6D7BE] dark:border-[var(--border)]">
                      {(
                        [
                          { id: 0, label: "Yok (Akıcı)" },
                          { id: 2, label: "2 Sn Bekle" },
                          { id: "auto", label: "Cümle Süresi" },
                        ] as { id: PauseBetweenLines; label: string }[]
                      ).map((pOpt) => {
                        const active =
                          (mounted ? pauseBetweenLines : 0) === pOpt.id;
                        return (
                          <button
                            key={String(pOpt.id)}
                            type="button"
                            onClick={() => {
                              playClick();
                              setPauseBetweenLines(pOpt.id);
                            }}
                            className={`py-1.5 px-1.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                              active
                                ? "bg-[#087F5B] text-white"
                                : "text-[var(--muted)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {pOpt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 🔁 Döngü, ♡ Favori, ✓ Tamamla ve 🔗 Paylaş */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        cycleDialogueLoopCount();
                        playClick();
                      }}
                      className={`py-2 px-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        mounted && dialogueLoopCount !== 1
                          ? "bg-[#6741D9] border-[#5230B5] text-white"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                      }`}
                    >
                      <Repeat size={13} />
                      <span>
                        Döngü:{" "}
                        {!mounted
                          ? "1x"
                          : dialogueLoopCount === "infinite"
                            ? "∞"
                            : `${dialogueLoopCount}x`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        toggleFavoriteDialogue(readingText.id);
                      }}
                      className={`py-2 px-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        isFav
                          ? "bg-red-50 border-red-300 text-red-600"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                      }`}
                    >
                      <Heart size={13} fill={isFav ? "currentColor" : "none"} />
                      <span>{isFav ? "Favoride" : "Favori"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        toggleCompletedDialogue(readingText.id);
                      }}
                      className={`py-2 px-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        isCompleted
                          ? "bg-[#F3F0FF] border-[#6741D9] text-[#6741D9]"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      <span>{isCompleted ? "Bitti" : "Tamamla"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setIsMoreMenuOpen(false);
                        setIsShareModalOpen(true);
                      }}
                      className="py-2 px-2 rounded-xl border bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B] text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Share2 size={13} />
                      <span>Paylaş</span>
                    </button>
                  </div>

                  {/* 💡 Rehber Bilgisi */}
                  <div className="text-[11px] py-2 px-2.5 rounded-xl bg-[#087F5B]/10 border border-[#087F5B]/30 font-semibold text-[#065F46] dark:text-emerald-400 leading-snug">
                    💡 <strong>Rehber:</strong> Metni doğal sesle dinleyin.
                    Morfolojik kök analizi için Arapça kelimelere tıklayın;
                    mikrofon ikonuyla telaffuz ve 38 mahreç analizini açın.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Çevrimdışı Hazır Bilgi Rozeti */}
          {(showOfflineNotice || isOfflineReady) && (
            <div className="rounded-xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-600/40 px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
              <span>
                ✅ Okuma metni, sözlük/morfoloji, cümle sesleri ve anlama
                soruları artık tamamen internetsiz çalışır.
              </span>
              {showOfflineNotice && (
                <button
                  type="button"
                  onClick={() => setShowOfflineNotice(false)}
                  className="text-emerald-700 dark:text-emerald-300 hover:underline text-[10px] font-extrabold shrink-0 cursor-pointer"
                >
                  Gizle
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* SINIF MODU ÜST KONTROL ÇUBUĞU (Yalnızca Tablet ve Masaüstü >= 768px) */}
      {isClassroomMode && studyMode !== "vocabulary" && (
        <section
          aria-label="Akıllı Tahta ve Sınıf Sunum Modu Kontrol Çubuğu"
          className="hidden md:flex print:hidden rounded-2xl bg-gradient-to-r from-emerald-900 via-[#087F5B] to-teal-900 text-white border-2 border-emerald-400/60 border-b-4 p-3 sm:p-4 shadow-xl flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1 rounded-xl bg-white/15 border border-white/25 text-xs sm:text-sm font-black tracking-wide flex items-center gap-1.5">
              <span>🖥️ Akıllı Tahta &amp; Sınıf Sunum Modu</span>
            </span>
            <span className="hidden lg:inline text-xs font-semibold text-emerald-100">
              Ok tuşları (↑/↓): Cümle Seç • Space (Boşluk): Cümleyi Dinle •
              Shift+Space (veya P): Tüm Metni Oynat
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 bg-black/25 rounded-xl p-1 border border-white/20">
              <span className="text-[11px] font-extrabold px-2 text-emerald-100 hidden sm:inline">
                🔍 Punto:
              </span>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setClassroomScale((s) =>
                    Math.max(1.2, Math.round((s - 0.15) * 100) / 100)
                  );
                }}
                title="Yazı Boyutunu Küçült (A-)"
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/30 text-white font-black text-xs sm:text-sm cursor-pointer transition-colors"
              >
                A-
              </button>
              <span className="px-2 text-xs sm:text-sm font-black tabular-nums text-amber-300 min-w-[50px] text-center">
                %{Math.round(classroomScale * 100)}
              </span>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setClassroomScale((s) =>
                    Math.min(2.2, Math.round((s + 0.15) * 100) / 100)
                  );
                }}
                title="Yazı Boyutunu Büyüt (A+)"
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/30 text-white font-black text-xs sm:text-sm cursor-pointer transition-colors"
              >
                A+
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                playClick();
                setSpotlightMode((v) => !v);
              }}
              title="Aktif olmayan diğer cümleleri karartarak sınıfın tek cümleye odaklanmasını sağlar"
              className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
                spotlightMode
                  ? "bg-amber-400 text-slate-950 border-amber-200 shadow-sm"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/25"
              }`}
            >
              <span>🔦 Spot Odaklama: {spotlightMode ? "Açık" : "Kapalı"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                setClickToRevealTr(false);
                setViewMode(
                  currentViewMode === "arabic-only" ? "stacked" : "arabic-only"
                );
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
                currentViewMode === "arabic-only"
                  ? "bg-[#6741D9] text-white border-indigo-300 shadow-sm"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/25"
              }`}
            >
              <span>
                👁️{" "}
                {currentViewMode === "arabic-only"
                  ? "Türkçeleri Aç"
                  : "Türkçeleri Gizle"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                setBlurArabic((v) => !v);
                setRevealedArabicLines({});
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
                blurArabic
                  ? "bg-amber-500 text-slate-950 border-amber-200 shadow-sm"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/25"
              }`}
            >
              <span>
                {blurArabic
                  ? "👁️ Arapçaları Netleştir"
                  : "👁️ Arapçaları Bulanıklaştır"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                useClassroomToolsStore.getState().toggleToolbar();
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>🖍️ Tahta Kalemi &amp; Araçlar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                setIsClassroomMode(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border border-rose-300/50 text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-sm"
            >
              <X size={14} />
              <span>Sınıf Modundan Çık</span>
            </button>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* SEKME İÇERİKLERİ: GRAMER / SÖZLÜK / SORULAR / METİN (CÜMLE & PARAGRAF) */}
      {/* ===================================================================== */}
      {studyMode === "gramer" && !isGrammarSplitOpen && grammarNote ? (
        <GrammarHapBilgiPanel
          grammarNote={grammarNote}
          hideLessonSelfLink={true}
          onOpenSplitView={() => {
            setStudyMode("listen");
            setGrammarSplitOpen(true);
          }}
          onOpenShadowing={(ar) => openShadowingCoach({ text: ar })}
        />
      ) : studyMode === "vocabulary" ? (
        <div className="space-y-4">
          {textIdioms.length > 0 && (
            <section className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-[#6741D9] text-white text-xs font-extrabold">
                    ✨ Kalıp İfadeler ({textIdioms.length})
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                    Bu Metindeki Kalıp İfadeler{" "}
                    <bdi
                      dir="rtl"
                      className="arabic font-arabic text-base sm:text-lg text-[#065F46] dark:text-emerald-400"
                    >
                      (التعبيرات الاصطلاحية)
                    </bdi>
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {textIdioms.map((idm) => {
                  const hasPoliteOrAltVariant =
                    Boolean(idm.matchedPhrase) &&
                    normalizeForIdiomMatch(idm.matchedPhrase || "") !==
                      normalizeForIdiomMatch(idm.arabic);
                  const primaryAr: string =
                    hasPoliteOrAltVariant && idm.matchedPhrase
                      ? idm.matchedPhrase
                      : idm.arabic;

                  return (
                    <div
                      key={idm.id}
                      className="rounded-2xl bg-white dark:bg-slate-900/90 border-2 border-[#E6D7BE] dark:border-slate-700 border-b-4 border-l-4 border-l-[#6741D9] p-3.5 flex flex-col justify-between space-y-2.5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#F3F0FF] dark:bg-indigo-950/90 text-[#6741D9] dark:text-indigo-200 text-[10px] font-extrabold border border-[#6741D9]/30">
                            Cümle #{idm.lineNumber} •{" "}
                            {idm.level || readingText.seviye}
                          </span>
                          <span
                            dir="rtl"
                            className="arabic font-arabic text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-snug"
                          >
                            {getDisplayText(primaryAr)}
                          </span>
                        </div>

                        <p className="text-sm font-extrabold text-[var(--foreground)]">
                          {idm.meaningTr}
                        </p>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          💡 {idm.usageNote}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            void speakHybrid({
                              text: primaryAr,
                              rate: speechRate,
                            });
                          }}
                          className="flex-1 h-9 px-3 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 hover:border-[#087F5B] border-2 border-[#E6D7BE] dark:border-slate-600 border-b-3 text-xs font-extrabold text-[var(--foreground)] flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Volume2 size={14} className="text-[#065F46]" />
                          <span>🔊 Dinle</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            openShadowingCoach({ text: primaryAr });
                          }}
                          className="flex-1 h-9 px-3 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/85 border-2 border-[#6741D9] border-b-3 text-xs font-extrabold text-[#6741D9] dark:text-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Mic size={14} />
                          <span>🎙️ Telaffuz Et</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {textVocabEntries.map((entry: DialogueVocabularyEntry) => {
              const word = entry.item;
              const isFavWord = mounted && isWordFavorite(word.id);
              const isLearned = mounted && isWordLearned(word.id);
              const mainAr = word.mufret || word.mazi || "";
              const category = getWordCategory(word);
              const catTheme =
                category === "fiil"
                  ? {
                      leftBorder: "border-l-4 border-l-amber-500",
                      badgeText: "⚡ Fiil (فعل)",
                      badgeClass:
                        "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
                      arColor: "text-amber-700 dark:text-amber-300",
                    }
                  : category === "edat"
                    ? {
                        leftBorder: "border-l-4 border-l-purple-500",
                        badgeText: "🔗 Edat / Kalıp",
                        badgeClass:
                          "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
                        arColor: "text-purple-700 dark:text-purple-300",
                      }
                    : category === "ozel-isim"
                      ? {
                          leftBorder: "border-l-4 border-l-teal-500",
                          badgeText: "👤 Özel İsim (اسم علم)",
                          badgeClass:
                            "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300",
                          arColor: "text-teal-700 dark:text-teal-300",
                        }
                      : {
                          leftBorder: "border-l-4 border-l-sky-500",
                          badgeText: "📘 İsim (اسم)",
                          badgeClass:
                            "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300",
                          arColor: "text-sky-700 dark:text-sky-300",
                        };

              return (
                <div
                  key={word.id}
                  className={`rounded-2xl border-2 border-b-4 ${
                    catTheme.leftBorder
                  } p-4 flex flex-col justify-between space-y-3 ${
                    isLearned
                      ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9]"
                      : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)]"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2 border-b border-dashed border-[#E2D3B8] pb-2.5">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${catTheme.badgeClass}`}
                          >
                            {catTheme.badgeText}
                          </span>
                          {word.kok && word.kok !== "-" && (
                            <span
                              dir="ltr"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]"
                            >
                              <span>Kök:</span>
                              <bdi
                                dir="rtl"
                                className="arabic font-arabic text-xs font-bold text-[var(--foreground)] inline-block"
                              >
                                {getDisplayText(word.kok)}
                              </bdi>
                            </span>
                          )}
                        </div>
                        <p
                          dir="ltr"
                          className="text-sm font-extrabold text-[var(--foreground)] mt-1 text-left leading-snug"
                        >
                          {splitMixedBidiText(word.anlam_tr).map((seg, sIdx) =>
                            seg.isArabic ? (
                              <bdi
                                key={sIdx}
                                dir="rtl"
                                className="arabic font-arabic font-bold inline-block mx-0.5"
                              >
                                {getDisplayText(seg.text)}
                              </bdi>
                            ) : (
                              <span key={sIdx}>{seg.text}</span>
                            )
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          dir="rtl"
                          className={`arabic text-3xl font-bold block leading-tight ${catTheme.arColor}`}
                        >
                          {getDisplayText(mainAr)}
                        </span>
                        {entry.contextWord && (
                          <span
                            dir="ltr"
                            className="inline-flex items-center justify-end gap-1 text-xs md:text-sm font-medium text-[#6741D9] mt-0.5"
                          >
                            <span>Metinde:</span>
                            <bdi
                              dir="rtl"
                              className="arabic text-base md:text-lg font-arabic font-bold inline-block"
                            >
                              {getDisplayText(entry.contextWord)}
                            </bdi>
                          </span>
                        )}
                      </div>
                    </div>

                    {entry.morphologyNote && (
                      <div
                        dir="ltr"
                        className="bg-white dark:bg-[var(--background)] rounded-xl px-3 py-1.5 border border-[#E6D7BE] text-[11px] font-bold text-[#4C28B5] dark:text-[#d0bfff] text-left"
                      >
                        <span className="text-[10px] uppercase tracking-wider text-[#6741D9] block mb-0.5">
                          Morfolojik Çözümleme (Cümle #{entry.lineNumber}):
                        </span>
                        <span
                          dir="ltr"
                          className="block text-left leading-relaxed"
                        >
                          {splitMixedBidiText(entry.morphologyNote).map(
                            (seg, sIdx) =>
                              seg.isArabic ? (
                                <bdi
                                  key={sIdx}
                                  dir="rtl"
                                  className="arabic font-arabic text-sm font-bold inline-block mx-0.5"
                                >
                                  {getDisplayText(seg.text)}
                                </bdi>
                              ) : (
                                <span key={sIdx}>{seg.text}</span>
                              )
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm font-medium text-[var(--muted)] border-b border-dashed border-[#E2D3B8] pb-2">
                      {word.mufret && (
                        <span>
                          Müfret:{" "}
                          <strong className="arabic text-base md:text-lg font-arabic font-bold text-[var(--foreground)]">
                            {getDisplayText(word.mufret)}
                          </strong>
                        </span>
                      )}
                      {word.cemi && word.cemi !== "-" && (
                        <span>
                          Cemî:{" "}
                          <strong className="arabic text-base md:text-lg font-arabic font-bold text-[var(--foreground)]">
                            {getDisplayText(word.cemi)}
                          </strong>
                        </span>
                      )}
                      {word.muzari && (
                        <span>
                          Muzâri:{" "}
                          <strong className="arabic text-base md:text-lg font-arabic font-bold text-[var(--foreground)]">
                            {getDisplayText(word.muzari)}
                          </strong>
                        </span>
                      )}
                      {word.masdar && (
                        <span>
                          Masdar:{" "}
                          <strong className="arabic text-base md:text-lg font-arabic font-bold text-[var(--foreground)]">
                            {getDisplayText(word.masdar)}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        speakHybrid({
                          text: mainAr.split("/")[0].trim(),
                          wordId: word.id,
                          rate: speechRate,
                        });
                      }}
                      className="flex-1 h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-3 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 size={14} className="text-[#065F46]" />
                      <span>Dinle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        const forms = prepareWordForms(word);
                        openShadowingCoach({
                          text:
                            forms?.[0]?.arabic || mainAr.split("/")[0].trim(),
                          forms,
                        });
                      }}
                      className="h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-3 text-xs font-extrabold text-[#6741D9] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Mic size={14} />
                      <span>Telaffuz</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        toggleFavoriteWord(word);
                      }}
                      title="Kelime Kartlarıma Ekle"
                      className={`h-9 w-9 rounded-xl border-2 border-b-3 flex items-center justify-center cursor-pointer ${
                        isFavWord
                          ? "bg-red-50 border-red-300 text-red-600"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)]"
                      }`}
                    >
                      <Heart
                        size={14}
                        fill={isFavWord ? "currentColor" : "none"}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        toggleLearnedWord(word.id);
                      }}
                      title="Öğrendim Olarak İşaretle"
                      className={`h-9 w-9 rounded-xl border-2 border-b-3 flex items-center justify-center cursor-pointer ${
                        isLearned
                          ? "bg-[#6741D9] border-[#5230B5] text-white"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)]"
                      }`}
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      ) : studyMode === "questions" ? (
        /* ================================================================= */
        /* SEKME 3: OKUMA METNİ ANLAMA SORULARI (❓ SORULAR)                 */
        /* ================================================================= */
        <section className="space-y-3.5">
          <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                ❓ Okuduğunu Anlama Soruları ({readingText.sorular.length} Soru)
              </h2>
              <p className="text-xs font-semibold text-[var(--muted)]">
                Metne göre doğru seçeneği işaretleyin. Arapça kelimelere
                tıklayarak kök ve anlam analizi alabilirsiniz.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {Object.keys(selectedAnswers).length > 0 && (
                <>
                  <span className="px-3 py-1.5 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold tabular-nums">
                    Doğru: {correctQuizCount} / {readingText.sorular.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setSelectedAnswers({});
                      setShowQuizResults(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] hover:border-[#6741D9] flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Sıfırla</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {quizQuestionsWithOptions.map((q, qIdx) => {
            const chosenIdx = selectedAnswers[qIdx];
            const isAnswered = chosenIdx !== undefined;

            return (
              <div
                key={qIdx}
                className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-[#6741D9] text-white text-xs font-extrabold">
                      Soru #{qIdx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        void speakHybrid({
                          text: q.soru_ar,
                          rate: speechRate,
                          voice: getNarratorVoice(),
                        });
                      }}
                      className="h-8 px-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#087F5B] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 size={13} className="text-[#065F46]" />
                      <span>Soruyu Dinle</span>
                    </button>
                  </div>

                  <div dir="rtl" className="text-right flex-1">
                    <div
                      style={{
                        fontSize: `calc(${arabicFontSize}px * 0.9 * var(--font-arabic-scale, 1))`,
                      }}
                      className="arabic font-bold text-[var(--foreground)]"
                    >
                      <WordTooltip
                        text={q.soru_ar}
                        contextSentenceTr={q.soru_tr}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
                  🇹🇷 {q.soru_tr}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.options.map((opt, optIdx) => {
                    const isThisChosen = chosenIdx === optIdx;
                    const isThisCorrect =
                      cleanArabicText(opt) === cleanArabicText(q.cevap_ar);

                    let optStyle =
                      "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#6741D9]";
                    if (isAnswered || showQuizResults) {
                      if (isThisCorrect) {
                        optStyle =
                          "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/30";
                      } else if (isThisChosen) {
                        optStyle =
                          "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-900 dark:text-rose-200";
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => {
                          playClick();
                          if (selectedAnswers[qIdx] === undefined) {
                            recordSkillAttempt("okuma", isThisCorrect);
                          }
                          setSelectedAnswers((prev) => ({
                            ...prev,
                            [qIdx]: optIdx,
                          }));
                          if (isThisCorrect) {
                            playSuccess();
                          }
                        }}
                        dir="rtl"
                        className={`p-3 rounded-xl border-2 border-b-3 text-right transition-all flex items-center justify-between gap-2 cursor-pointer ${optStyle}`}
                      >
                        <span className="arabic text-xl sm:text-2xl font-bold leading-snug">
                          {getDisplayText(opt)}
                        </span>
                        {(isAnswered || showQuizResults) && isThisCorrect && (
                          <CheckCircle2
                            size={18}
                            className="text-emerald-600 shrink-0"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {(isAnswered || showQuizResults) && (
                  <div className="rounded-xl bg-white/90 dark:bg-slate-900/80 border border-[#087F5B]/40 p-3 text-xs font-semibold text-[var(--foreground)] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#087F5B] dark:text-emerald-400">
                        ✅ Doğru Cevap &amp; Anlamı:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            void speakHybrid({
                              text: q.cevap_ar,
                              rate: speechRate,
                              voice: getNarratorVoice(),
                            });
                          }}
                          className="h-7 px-2.5 rounded-lg bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 text-[11px] font-extrabold text-[var(--foreground)] flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 size={12} className="text-[#065F46]" />
                          <span>Cevabı Dinle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            openShadowingCoach({
                              text: q.cevap_ar,
                              voice: getNarratorVoice(),
                            });
                          }}
                          className="h-7 px-2.5 rounded-lg bg-[#F3F0FF] dark:bg-indigo-950/80 border border-[#6741D9]/40 text-[11px] font-extrabold text-[#6741D9] dark:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Mic size={12} />
                          <span>Telaffuz Et</span>
                        </button>
                      </div>
                    </div>

                    <div
                      dir="rtl"
                      className="arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-right"
                    >
                      <WordTooltip
                        text={q.cevap_ar}
                        contextSentenceTr={q.cevap_tr}
                      />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                      🇹🇷 {q.cevap_tr}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ) : textLayoutMode === "paragraph" ? (
        /* ================================================================= */
        /* MOD B: PARAGRAF / BÜTÜN METİN GÖRÜNÜMÜ (textLayoutMode="paragraph")*/
        /* ================================================================= */
        <section className="space-y-3">
          {/* Paragraf Modu Üst Hızlı Cümle Kumandası */}
          <div className="rounded-2xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-2 border-[#6741D9]/40 border-b-4 p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-xl bg-[#6741D9] text-white text-xs font-extrabold flex items-center gap-1.5">
                <AlignJustify size={13} />
                <span>Paragraf Görünümü</span>
              </span>
              <span className="text-xs font-bold text-[var(--foreground)] inline-flex flex-wrap items-center gap-1">
                <span>Cümle sonlarındaki</span>
                <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                  1
                </span>
                <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                  2
                </span>
                <span>
                  numaralı rozetlere tıklayarak o cümleyi dinleyebilir veya
                  telaffuz edebilirsiniz.
                </span>
              </span>
            </div>

            {/* Seçili Cümle İçin Hızlı 4'lü Aksiyon Çubuğu ([🔊] [🔁] [🎙️] [✨]) */}
            {selectedParagraphLine && (
              <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-[var(--background)] px-2.5 py-1.5 rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
                <span className="text-xs font-extrabold text-[#6741D9] dark:text-indigo-300 px-1">
                  Cümle #{selectedParagraphLine.sira}:
                </span>

                {/* 1. Dinle */}
                <button
                  type="button"
                  onClick={() => handlePlayLine(selectedParagraphLine)}
                  className={`h-8 px-2.5 rounded-xl border-2 border-b-3 inline-flex items-center gap-1 text-xs font-extrabold transition-all cursor-pointer ${
                    playingLineId === selectedParagraphLine.sira &&
                    loopingLineSira !== selectedParagraphLine.sira
                      ? "bg-[#087F5B] border-[#087F5B] text-white"
                      : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                  }`}
                  data-tooltip="Seçili cümleyi dinle"
                >
                  <Volume2 size={14} className="text-[#065F46]" />
                  <span>Dinle</span>
                </button>

                {/* 2. Döngü */}
                <button
                  type="button"
                  onClick={() => handleToggleLoopLine(selectedParagraphLine)}
                  className={`h-8 px-2 rounded-xl border-2 border-b-3 inline-flex items-center gap-1 text-xs font-extrabold transition-all cursor-pointer ${
                    loopingLineSira === selectedParagraphLine.sira
                      ? "bg-[#6741D9] border-[#5230B5] text-white"
                      : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[#6741D9]"
                  }`}
                  data-tooltip="Seçili cümleyi sürekli tekrarla"
                >
                  <Repeat size={13} />
                  <span>Döngü</span>
                </button>

                {/* 3. Telaffuz */}
                {shouldShowShadowingButton && (
                  <ShadowingButton
                    text={selectedParagraphLine.arapca}
                    onRecorded={() =>
                      recordHwLinePractice(selectedParagraphLine.sira, null)
                    }
                    onOpenCoach={() => {
                      const lineHasMp3 = hasMp3(
                        readingText.id,
                        selectedParagraphLine.sira
                      );
                      const lineAudioUrl = lineHasMp3
                        ? getMp3Path(
                            readingText.id,
                            selectedParagraphLine.sira
                          )
                        : undefined;
                      openShadowingCoach({
                        text: selectedParagraphLine.arapca,
                        audioUrl: lineAudioUrl,
                        voice: getNarratorVoice(),
                      });
                    }}
                  />
                )}

                {/* 4. Cümle Hareke */}
                <button
                  type="button"
                  onClick={() => toggleLineHareke(selectedParagraphLine.sira)}
                  className={`h-8 px-2.5 rounded-xl border-2 border-b-3 inline-flex items-center gap-1 text-xs font-extrabold transition-all cursor-pointer ${
                    (lineHarekeOverrides[selectedParagraphLine.sira] !==
                    undefined
                      ? lineHarekeOverrides[selectedParagraphLine.sira]
                      : !mounted || showHareke)
                      ? "bg-[#087F5B]/15 border-[#087F5B] text-[#065F46] dark:text-emerald-400"
                      : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)]"
                  }`}
                  data-tooltip="Bu cümlenin harekesini aç/kapat"
                >
                  <Sparkles size={12} className="shrink-0" />
                  <span>Hareke</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setShareCardTarget({
                      type: "sentence",
                      arabicText: selectedParagraphLine.arapca,
                      turkishText: selectedParagraphLine.turkce,
                      titleAr: readingText.baslik_ar,
                      titleTr: readingText.baslik_tr,
                      level: readingText.seviye,
                      category: readingText.tema,
                      imageUrl:
                        readingText.gorsel ||
                        getReadingTextCoverUrl(readingText.id),
                      deepLink: `https://app.muallimun.net/metin/${readingText.id}`,
                      initialShowTranslation:
                        currentViewMode !== "arabic-only" &&
                        !isClickRevealActive,
                      initialShowHareke:
                        lineHarekeOverrides[selectedParagraphLine.sira] !==
                        undefined
                          ? lineHarekeOverrides[selectedParagraphLine.sira]
                          : !mounted || showHareke,
                    });
                  }}
                  data-tooltip="Seçili cümleyi görsel kart olarak paylaş"
                  aria-label="Seçili cümleyi görsel kart olarak paylaş"
                  className="h-8 px-2.5 rounded-xl bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-[#065F46] dark:text-emerald-400 inline-flex items-center gap-1 text-[11px] font-extrabold cursor-pointer"
                >
                  <Share2 size={12} className="shrink-0" />
                  <span>Paylaş</span>
                </button>
              </div>
            )}
          </div>

          {/* Kitap / Makale Formatında Bütünleşik Paragraf Kartı */}
          <div className="rounded-3xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-5 sm:p-7 md:p-8 shadow-sm space-y-5">
            <div
              className={
                currentViewMode === "columns" && !isClickRevealActive
                  ? "grid grid-cols-1 md:grid-cols-2 gap-6 items-start"
                  : "space-y-5"
              }
            >
              {/* Arapça Bütünleşik Paragraf Bloğu */}
              {currentViewMode !== "turkish-only" && (
                <div
                  dir="rtl"
                  style={{
                    fontSize: isClassroomMode
                      ? `${Math.max(
                          42,
                          Math.round(arabicFontSize * classroomScale)
                        )}px`
                      : `calc(${arabicFontSize}px * var(--font-arabic-scale, 1))`,
                    lineHeight: isClassroomMode ? 2.35 : 2.25,
                  }}
                  className={`arabic font-bold text-[var(--foreground)] text-right leading-[2.25] ${
                    currentViewMode === "columns" && !isClickRevealActive
                      ? "md:order-2"
                      : ""
                  }`}
                >
                  {readingText.satirlar.map((line) => {
                    const isPlaying = playingLineId === line.sira;
                    const isLooping = loopingLineSira === line.sira;
                    const isSelected = selectedParagraphSira === line.sira;
                    const shouldBlurLine =
                      blurArabic && !revealedArabicLines[line.sira];

                    return (
                      <span
                        key={line.sira}
                        onClick={() => {
                          setSelectedParagraphSira(line.sira);
                          if (shouldBlurLine) {
                            playClick();
                            setRevealedArabicLines((prev) => ({
                              ...prev,
                              [line.sira]: true,
                            }));
                          }
                        }}
                        className={`inline rounded-xl px-1.5 py-0.5 transition-all duration-200 box-decoration-clone ${
                          isPlaying || isLooping
                            ? "bg-amber-200/80 dark:bg-amber-950/75 ring-2 ring-[#6741D9]"
                            : isSelected
                              ? "bg-white/85 dark:bg-slate-800/80"
                              : "hover:bg-white/50 dark:hover:bg-slate-800/40"
                        } ${shouldBlurLine ? "blur-md select-none cursor-pointer" : ""}`}
                      >
                        <span
                          className={
                            shouldBlurLine ? "pointer-events-none" : "inline"
                          }
                        >
                          <WordTooltip
                            text={line.arapca}
                            contextSentenceTr={line.turkce}
                            isLineSpeaking={isPlaying}
                            activeWordIndex={isPlaying ? activeWordIndex : null}
                            activeWordProgress={
                              isPlaying ? activeWordProgress : 0
                            }
                            isClassroomMode={isClassroomMode}
                            forceShowHareke={lineHarekeOverrides[line.sira]}
                            inlineFlow
                          />
                        </span>
                        <button
                          type="button"
                          dir="ltr"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedParagraphSira(line.sira);
                            handlePlayLine(line);
                          }}
                          title={`Cümle #${line.sira} — Dinlemek için tıklayın`}
                          className={`inline-flex items-center justify-center min-w-[26px] h-[24px] px-1.5 mx-1.5 rounded-md text-xs font-sans font-bold tracking-tight transition-all cursor-pointer select-none align-middle ${
                            isPlaying || isLooping || isSelected
                              ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300 dark:ring-indigo-500"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                          }`}
                        >
                          {line.sira}
                        </button>{" "}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Alt Alta veya Tıkla-Gör Modunda Ayırıcı Çizgi */}
              {(currentViewMode === "stacked" ||
                currentViewMode === "click-reveal") && (
                <div className="border-t-2 border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]" />
              )}

              {/* Türkçe Bütünleşik Paragraf Bloğu */}
              {currentViewMode !== "arabic-only" && (
                <div
                  dir="ltr"
                  className={`bg-white/75 dark:bg-[var(--background)]/70 rounded-2xl p-4 sm:p-5 border border-[#E6D7BE] dark:border-[var(--border)] space-y-2.5 ${
                    currentViewMode === "columns" && !isClickRevealActive
                      ? "md:order-1"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#087F5B] dark:text-emerald-400">
                      🇹🇷 Türkçe Metin Çevirisi (Paragraf Akışı)
                    </span>
                    {isClickRevealActive && (
                      <button
                        type="button"
                        onClick={revealAllTrLines}
                        className="px-2.5 py-1 rounded-lg bg-[#087F5B]/15 text-[#065F46] dark:text-emerald-300 text-[11px] font-extrabold hover:bg-[#087F5B] hover:text-white transition-colors cursor-pointer"
                      >
                        👁️ Tüm Çevirileri Göster
                      </button>
                    )}
                  </div>

                  <p
                    style={{
                      fontSize: isClassroomMode
                        ? `${Math.max(
                            22,
                            Math.round(turkishFontSize * (classroomScale * 0.9))
                          )}px`
                        : `${turkishFontSize}px`,
                    }}
                    className="leading-relaxed text-[var(--foreground)] font-semibold"
                  >
                    {readingText.satirlar.map((line) => {
                      const isPlaying = playingLineId === line.sira;
                      const isSelected = selectedParagraphSira === line.sira;
                      const isTrRevealed =
                        !isClickRevealActive ||
                        Boolean(revealedTrLines[line.sira]);

                      return (
                        <span
                          key={line.sira}
                          onClick={() => {
                            setSelectedParagraphSira(line.sira);
                            if (isClickRevealActive && !isTrRevealed) {
                              playClick();
                              setRevealedTrLines((prev) => ({
                                ...prev,
                                [line.sira]: true,
                              }));
                            } else {
                              handlePlayLine(line);
                            }
                          }}
                          title={`Cümle #${line.sira}`}
                          className={`mr-1.5 inline rounded-lg px-1.5 py-0.5 transition-all cursor-pointer box-decoration-clone ${
                            isPlaying
                              ? "bg-amber-200/90 dark:bg-amber-950/80 text-slate-950 dark:text-amber-200 font-extrabold"
                              : isSelected
                                ? "bg-[#087F5B]/15 text-[#065F46] dark:text-emerald-300 font-bold"
                                : "hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                          } ${!isTrRevealed ? "blur-xs select-none" : ""}`}
                        >
                          <sup className="text-[11px] font-extrabold text-[#6741D9] dark:text-indigo-400 mr-0.5">
                            [{line.sira}]
                          </sup>
                          {line.turkce}{" "}
                        </span>
                      );
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Cümleler Arası Gölgeleme Boşluğu Geri Sayım Çubuğu */}
            {isShadowingPause && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-[#087F5B] px-3 py-2 space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#065F46] dark:text-emerald-400 flex items-center gap-1.5">
                    <span>🎙️ Şimdi yüksek sesle tekrar edin...</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-[#065F46] dark:text-emerald-300 tabular-nums">
                    {(
                      (shadowingPauseMs * shadowingPauseRemainingPct) /
                      100000
                    ).toFixed(1)}{" "}
                    sn
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-emerald-200/70 dark:bg-emerald-900 overflow-hidden">
                  <div
                    className="h-full bg-[#087F5B] rounded-full transition-none"
                    style={{ width: `${shadowingPauseRemainingPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        /* ================================================================= */
        /* MOD A: CÜMLE CÜMLE (LİSTE) GÖRÜNÜMÜ (textLayoutMode="sentences")  */
        /* ================================================================= */
        <section className="space-y-2.5">
          {readingText.satirlar.map((line, index) => {
            const isPlaying = playingLineId === line.sira;
            const isLooping = loopingLineSira === line.sira;
            const lineHasMp3 = hasMp3(readingText.id, line.sira);
            const lineAudioUrl = lineHasMp3
              ? getMp3Path(readingText.id, line.sira)
              : undefined;
            const voiceForLine = getNarratorVoice();

            const effectiveLineHareke =
              lineHarekeOverrides[line.sira] !== undefined
                ? lineHarekeOverrides[line.sira]
                : !mounted || showHareke;

            const isTrRevealed =
              (!isClickRevealActive && currentViewMode !== "arabic-only") ||
              revealedTrLines[line.sira];
            const isArRevealed =
              currentViewMode !== "turkish-only" || revealedArLines[line.sira];

            const isArabicLineRevealed = Boolean(
              revealedArabicLines[line.sira]
            );
            const shouldBlurLine = blurArabic && !isArabicLineRevealed;

            const renderArabicLine = () => (
              <div
                onClick={(e) => {
                  if (shouldBlurLine) {
                    e.stopPropagation();
                    playClick();
                    setRevealedArabicLines((prev) => ({
                      ...prev,
                      [line.sira]: true,
                    }));
                  }
                }}
                title={
                  shouldBlurLine
                    ? "Kör Dinleme aktif: Arapça metni açmak için tıklayın"
                    : undefined
                }
                className={`transition-all duration-300 ${
                  shouldBlurLine
                    ? "blur-md select-none cursor-pointer"
                    : "blur-0 opacity-100"
                }`}
              >
                <div className={shouldBlurLine ? "pointer-events-none" : ""}>
                  <WordTooltip
                    text={line.arapca}
                    contextSentenceTr={line.turkce}
                    isLineSpeaking={isPlaying}
                    activeWordIndex={isPlaying ? activeWordIndex : null}
                    activeWordProgress={isPlaying ? activeWordProgress : 0}
                    isClassroomMode={isClassroomMode}
                    forceShowHareke={lineHarekeOverrides[line.sira]}
                  />
                </div>
              </div>
            );

            const isClassroomActiveLine =
              index === activeClassroomLineIndex ||
              activeClassroomSira === line.sira ||
              isPlaying ||
              isLooping;

            return (
              <div
                key={line.sira}
                id={`classroom-line-${index}`}
                ref={(el) => {
                  lineRefs.current[line.sira] = el;
                }}
                onClick={() => {
                  if (isClassroomMode) {
                    setFocusedLineIndex(index);
                    setSelectedClassroomLine(line.sira);
                  }
                }}
                className={`rounded-2xl border-2 border-b-4 transition-all scroll-mt-14 ${
                  isClassroomMode && isClassroomActiveLine
                    ? "ring-4 ring-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/50 border-[#087F5B] shadow-2xl scale-[1.01] p-6 md:p-8"
                    : isPlaying || isLooping
                      ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9] shadow-md p-3.5"
                      : isClassroomMode
                        ? "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] p-5 md:p-6"
                        : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] p-3.5"
                } ${
                  isClassroomMode && !isClassroomActiveLine
                    ? spotlightMode
                      ? "opacity-35 hover:opacity-90 transition-opacity cursor-pointer"
                      : "opacity-85 hover:opacity-100 transition-opacity cursor-pointer"
                    : ""
                }`}
              >
                {/* Üst Satır: Cümle Numarası Rozeti + 4 Kompakt İkon Aksiyon Butonu ([🔊] [🔁] [🎙️] [✨]) */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] pb-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-xl text-xs font-extrabold border-b-2 bg-[#087F5B] text-white border-[#087F5B]">
                      Cümle #{line.sira}
                    </span>
                  </div>

                  {/* 4 Kompakt Aksiyon Butonu: [🔊] [🔁] [🎙️] [✨] */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* 1. 🔊 Doğal Sesle Dinle */}
                    <button
                      type="button"
                      onClick={() => handlePlayLine(line)}
                      className={`group relative w-9 h-9 rounded-xl border-2 border-b-3 inline-flex items-center justify-center transition-all cursor-pointer ${
                        isPlaying && !isLooping
                          ? "bg-[#087F5B] border-[#087F5B] text-white animate-pulse"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                      }`}
                      data-tooltip="Doğal Sesle Dinle"
                      aria-label="Doğal Sesle Dinle"
                    >
                      <Volume2
                        size={15}
                        className={
                          isPlaying && !isLooping
                            ? "text-white"
                            : "text-[#065F46]"
                        }
                      />
                    </button>

                    {/* 2. 🔁 Cümleyi Döngüde Tekrarla */}
                    <button
                      type="button"
                      onClick={() => handleToggleLoopLine(line)}
                      className={`group relative h-9 min-w-9 px-2 rounded-xl border-2 border-b-3 inline-flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        isLooping
                          ? "bg-[#6741D9] border-[#5230B5] text-white"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[#6741D9] hover:border-[#6741D9]"
                      }`}
                      data-tooltip="Cümleyi Döngüde Tekrarla (800ms es ile)"
                      aria-label="Cümleyi Döngüde Tekrarla"
                    >
                      <Repeat
                        size={14}
                        className={isLooping ? "animate-spin" : ""}
                      />
                      {isLooping && sentenceLoopRemaining !== null && (
                        <span className="text-[10px] font-black tabular-nums">
                          {sentenceLoopRemaining === "infinite"
                            ? "∞"
                            : `${sentenceLoopRemaining}x`}
                        </span>
                      )}
                    </button>

                    {/* 3. 🎙️ Kaydet / Telaffuz & 38 Mahreç Koçu (ShadowingButton) */}
                    {shouldShowShadowingButton && (
                      <div
                        onClick={() => {
                          if (currentViewMode === "turkish-only") {
                            setRevealedArLines((prev) => ({
                              ...prev,
                              [line.sira]: true,
                            }));
                          }
                        }}
                      >
                        <ShadowingButton
                          text={line.arapca}
                          onRecorded={() =>
                            recordHwLinePractice(line.sira, null)
                          }
                          onOpenCoach={() => {
                            if (currentViewMode === "turkish-only") {
                              setRevealedArLines((prev) => ({
                                ...prev,
                                [line.sira]: true,
                              }));
                            }
                            openShadowingCoach({
                              text: line.arapca,
                              audioUrl: lineAudioUrl,
                              voice: voiceForLine,
                            });
                          }}
                        />
                      </div>
                    )}

                    {/* 4. ✨ Cümle Bazlı Hareke Aç/Kapat */}
                    <button
                      type="button"
                      onClick={() => toggleLineHareke(line.sira)}
                      className={`h-9 px-2.5 rounded-xl border-2 border-b-3 inline-flex items-center justify-center gap-1 text-[11px] font-extrabold transition-all cursor-pointer ${
                        effectiveLineHareke
                          ? "bg-[#087F5B]/15 border-[#087F5B] text-[#065F46] dark:text-emerald-400"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                      data-tooltip="Bu cümlenin harekesini aç/kapat"
                      aria-label="Bu cümlenin harekesini aç/kapat"
                    >
                      <Sparkles size={12} className="shrink-0" />
                      <span>Hareke</span>
                    </button>

                    {/* 5. 📤 Cümleyi Görsel Kart Olarak Paylaş */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playClick();
                        setShareCardTarget({
                          type: "sentence",
                          arabicText: line.arapca,
                          turkishText: line.turkce,
                          titleAr: readingText.baslik_ar,
                          titleTr: readingText.baslik_tr,
                          level: readingText.seviye,
                          category: readingText.tema,
                          imageUrl:
                            readingText.gorsel ||
                            getReadingTextCoverUrl(readingText.id),
                          deepLink: `https://app.muallimun.net/metin/${readingText.id}`,
                          initialShowTranslation:
                            currentViewMode !== "arabic-only" &&
                            (!isClickRevealActive ||
                              Boolean(revealedTrLines[line.sira])),
                          initialShowHareke: effectiveLineHareke,
                        });
                      }}
                      data-tooltip="Bu cümleyi görsel kart olarak paylaş"
                      aria-label="Bu cümleyi görsel kart olarak paylaş"
                      className="w-9 h-9 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] border-b-3 text-[#065F46] dark:text-emerald-400 inline-flex items-center justify-center transition-all cursor-pointer shrink-0"
                    >
                      <Share2 size={15} />
                    </button>
                  </div>
                </div>

                {/* CÜMLE İÇERİĞİ (5 Görünüm Modu Desteği: Alt Alta, İki Sütun, Arapça, Türkçe, Tıkla-Gör) */}
                {currentViewMode === "columns" && !isClickRevealActive ? (
                  <div className="space-y-1.5">
                    <div className="md:grid md:grid-cols-2 md:gap-5 items-center space-y-1.5 md:space-y-0">
                      <div
                        dir="ltr"
                        className="order-2 md:order-1 bg-white/70 dark:bg-[var(--background)]/60 rounded-xl px-3 py-2 border border-[#E6D7BE] dark:border-[var(--border)]"
                      >
                        <p
                          style={{
                            fontSize: isClassroomMode
                              ? `${Math.max(
                                  22,
                                  Math.round(
                                    turkishFontSize * (classroomScale * 0.9)
                                  )
                                )}px`
                              : `${turkishFontSize}px`,
                          }}
                          className={`text-[var(--muted)] ${
                            isClassroomMode
                              ? "font-medium leading-relaxed"
                              : "font-semibold leading-snug"
                          }`}
                        >
                          {line.turkce}
                        </p>
                      </div>

                      <div
                        dir="rtl"
                        style={{
                          fontSize: isClassroomMode
                            ? `${Math.max(
                                44,
                                Math.round(arabicFontSize * classroomScale)
                              )}px`
                            : `calc(${arabicFontSize}px * var(--font-arabic-scale, 1))`,
                          lineHeight: isClassroomMode ? 2.1 : undefined,
                        }}
                        className="order-1 md:order-2 arabic font-bold text-[var(--foreground)] text-right py-1.5"
                      >
                        {renderArabicLine()}
                      </div>
                    </div>

                    {blurArabic && (
                      <div
                        dir="ltr"
                        className="pt-1.5 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] flex items-center justify-end"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playClick();
                            setRevealedArabicLines((prev) => ({
                              ...prev,
                              [line.sira]: !prev[line.sira],
                            }));
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-3 py-1 rounded-xl border border-amber-300 dark:border-amber-700 hover:border-amber-500 cursor-pointer transition-colors"
                        >
                          <span>
                            {revealedArabicLines[line.sira]
                              ? "🙈 Arapça Metni Gizle"
                              : "👁️ Arapça Metni Göster"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {currentViewMode === "turkish-only" && (
                      <div
                        dir="ltr"
                        className="mb-1.5 pb-1.5 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]"
                      >
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6741D9] block mb-0.5">
                          Türkçe Anlamdan Arapçasını Hatırlayın:
                        </span>
                        <p
                          style={{
                            fontSize: isClassroomMode
                              ? `${Math.max(
                                  22,
                                  Math.round(
                                    turkishFontSize * (classroomScale * 0.9)
                                  )
                                )}px`
                              : `${turkishFontSize}px`,
                          }}
                          className="text-[var(--foreground)] font-bold leading-snug"
                        >
                          “{line.turkce}”
                        </p>
                      </div>
                    )}

                    {isArRevealed ? (
                      <div
                        dir="rtl"
                        style={{
                          fontSize: isClassroomMode
                            ? `${Math.max(
                                44,
                                Math.round(arabicFontSize * classroomScale)
                              )}px`
                            : `calc(${arabicFontSize}px * var(--font-arabic-scale, 1))`,
                          lineHeight: isClassroomMode ? 2.1 : undefined,
                        }}
                        className="arabic font-bold text-[var(--foreground)] text-right py-1.5"
                      >
                        {renderArabicLine()}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 bg-white/80 dark:bg-[var(--background)] rounded-xl p-2 border border-[#E6D7BE]">
                        <span
                          dir="rtl"
                          className="arabic text-2xl font-bold text-[var(--muted)] blur-xs select-none"
                        >
                          {getDisplayText(line.arapca, effectiveLineHareke)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            setRevealedArLines((prev) => ({
                              ...prev,
                              [line.sira]: true,
                            }));
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-[#087F5B] hover:bg-[#065F46] px-3 py-1.5 rounded-xl border-b-2 border-[#087F5B] shrink-0 cursor-pointer"
                        >
                          <Eye size={13} />
                          <span>Arapçasını Göster</span>
                        </button>
                      </div>
                    )}

                    {currentViewMode !== "turkish-only" && (
                      <div
                        dir="ltr"
                        className="mt-1.5 pt-1.5 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] min-h-[30px] flex flex-wrap items-center justify-between gap-2"
                      >
                        {isTrRevealed ? (
                          <p
                            style={{
                              fontSize: isClassroomMode
                                ? `${Math.max(
                                    22,
                                    Math.round(
                                      turkishFontSize * (classroomScale * 0.9)
                                    )
                                  )}px`
                                : `${turkishFontSize}px`,
                            }}
                            className={`text-[var(--muted)] ${
                              isClassroomMode
                                ? "font-medium leading-relaxed"
                                : "font-semibold leading-snug"
                            }`}
                          >
                            {line.turkce}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playClick();
                              setRevealedTrLines((prev) => ({
                                ...prev,
                                [line.sira]: true,
                              }));
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#065F46] dark:text-emerald-400 bg-white dark:bg-[var(--background)] px-3 py-1 rounded-xl border border-[#E6D7BE] hover:border-[#087F5B] cursor-pointer"
                          >
                            <span>👁️ Türkçe Çeviriyi Göster</span>
                          </button>
                        )}

                        {blurArabic && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playClick();
                              setRevealedArabicLines((prev) => ({
                                ...prev,
                                [line.sira]: !prev[line.sira],
                              }));
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-3 py-1 rounded-xl border border-amber-300 dark:border-amber-700 hover:border-amber-500 cursor-pointer transition-colors ml-auto"
                          >
                            <span>
                              {revealedArabicLines[line.sira]
                                ? "🙈 Arapça Metni Gizle"
                                : "👁️ Arapça Metni Göster"}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* CÜMLELER ARASI GÖLGELEME BOŞLUĞU: "ŞİMDİ TEKRAR EDİN" GERİ SAYIM ÇUBUĞU */}
                {isShadowingPause && shadowingPauseLineSira === line.sira && (
                  <div className="mt-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-[#087F5B] px-3 py-2 space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#065F46] dark:text-emerald-400 flex items-center gap-1.5">
                        <span>🎙️ Şimdi yüksek sesle tekrar edin...</span>
                      </span>
                      <span className="text-[11px] font-extrabold text-[#065F46] dark:text-emerald-300 tabular-nums">
                        {(
                          (shadowingPauseMs * shadowingPauseRemainingPct) /
                          100000
                        ).toFixed(1)}{" "}
                        sn
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-emerald-200/70 dark:bg-emerald-900 overflow-hidden">
                      <div
                        className="h-full bg-[#087F5B] rounded-full transition-none"
                        style={{ width: `${shadowingPauseRemainingPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* SINIF MODU ALT SABİT SUNUM KUMANDASI (createPortal ile body altında doğrudan viewport'a sabit) */}
      {mounted &&
        isClassroomMode &&
        studyMode !== "vocabulary" &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-label="Sınıf Modu Alt Sunum Kumandası"
            className="hidden md:flex print:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-fit max-w-[calc(100vw-1.5rem)] rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white border-2 border-emerald-400/70 border-b-4 px-3.5 py-2.5 shadow-2xl backdrop-blur-md flex-wrap lg:flex-nowrap items-center justify-center gap-2 md:gap-2.5 whitespace-nowrap"
          >
          {/* 1. Önceki */}
          <button
            type="button"
            disabled={activeClassroomLineIndex <= 0}
            onClick={() => {
              playClick();
              if (isPlayingAll || playingLineId !== null) {
                playToken.current += 1;
                stop();
                setIsPlayingAll(false);
              }
              const prevIdx = Math.max(0, activeClassroomLineIndex - 1);
              const prevObj = readingText.satirlar[prevIdx];
              setFocusedLineIndex(prevIdx);
              if (prevObj) {
                setSelectedClassroomLine(prevObj.sira);
                setSelectedParagraphSira(prevObj.sira);
              }
            }}
            data-tooltip="Önceki Cümle (↑ veya ←)"
            data-tooltip-pos="top"
            className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-40 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
          >
            <span>⏮️ Önceki</span>
          </button>

          {/* 2. Aktif Cümle Göstergesi */}
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs sm:text-sm font-black tabular-nums">
            Cümle #{activeClassroomSira} / {readingText.satirlar.length}
          </span>

          {/* 3. Cümleyi Dinle */}
          <button
            type="button"
            onClick={() => {
              if (activeClassroomLineObj) {
                handlePlaySingleClassroomLine(activeClassroomLineObj);
              }
            }}
            data-tooltip="Seçili Cümleyi Seslendir / Durdur (Space)"
            data-tooltip-pos="top"
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
              !isPlayingAll && playingLineId === activeClassroomSira
                ? "bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-700"
                : "bg-[#087F5B] hover:bg-[#065F46] text-white border-emerald-950"
            }`}
          >
            <Volume2 size={15} />
            <span>
              {!isPlayingAll && playingLineId === activeClassroomSira
                ? "Durdur"
                : "Cümleyi Dinle"}
            </span>
          </button>

          {/* 4. Tümünü Oynat */}
          <button
            type="button"
            onClick={() =>
              handleToggleClassroomPlayAll(activeClassroomLineObj)
            }
            data-tooltip="Bu Cümleden İtibaren Tüm Metni Oynat (Shift+Space veya P)"
            data-tooltip-pos="top"
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
              isPlayingAll
                ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-800"
                : "bg-[#6741D9] hover:bg-[#5230B5] text-white border-indigo-950"
            }`}
          >
            {isPlayingAll ? (
              <>
                <Square size={13} fill="currentColor" />
                <span>Duraklat</span>
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" />
                <span>Tümünü Oynat</span>
              </>
            )}
          </button>

          {/* 5. Tekrarlı Dinleme */}
          <button
            type="button"
            onClick={() => {
              playClick();
              setIsClassroomLoop((v) => !v);
            }}
            data-tooltip="Sınıf Döngü Modu (R)"
            data-tooltip-pos="top"
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1 shrink-0 cursor-pointer transition-all ${
              isClassroomLoop
                ? "bg-amber-400 text-slate-950"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
          >
            <Repeat size={14} />
            <span className="hidden sm:inline">Döngü</span>
          </button>

          {/* 6. Sonraki */}
          <button
            type="button"
            disabled={
              activeClassroomLineIndex >= readingText.satirlar.length - 1
            }
            onClick={() => {
              playClick();
              if (isPlayingAll || playingLineId !== null) {
                playToken.current += 1;
                stop();
                setIsPlayingAll(false);
              }
              const nextIdx = Math.min(
                readingText.satirlar.length - 1,
                activeClassroomLineIndex + 1
              );
              const nextObj = readingText.satirlar[nextIdx];
              setFocusedLineIndex(nextIdx);
              if (nextObj) {
                setSelectedClassroomLine(nextObj.sira);
                setSelectedParagraphSira(nextObj.sira);
              }
            }}
            data-tooltip="Sonraki Cümle (↓ veya →)"
            data-tooltip-pos="top"
            className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-40 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
          >
            <span>⏭️ Sonraki</span>
          </button>

          <span className="w-px h-6 bg-slate-700 shrink-0" />

          {/* 7. Sınıf Modundan Çık */}
          <button
            type="button"
            onClick={() => {
              playClick();
              setIsClassroomMode(false);
            }}
            data-tooltip="Sınıf Modundan Çık (Esc)"
            data-tooltip-pos="top"
            data-tooltip-align="right"
            aria-label="Sınıf Modundan Çık"
            className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white flex items-center justify-center shrink-0 cursor-pointer transition-all"
          >
            <X size={16} />
          </button>
          </div>,
          document.body
        )}

      {/* BÖLÜM 5: ALT TAMAMLAMA CTA, BAŞARI KARTI PAYLAŞIMI VE ÖNCEKİ/SONRAKİ METİN GEÇİŞİ */}
      <section className="space-y-3 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={handleCompleteAndContinue}
            className="sm:col-span-2 py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 text-white font-bold text-sm sm:text-base rounded-2xl border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
          >
            <CheckCircle2 size={20} className="shrink-0 w-5 h-5" />
            <span>
              {isCompleted
                ? nextReadingText
                  ? `Sonraki Metne Geç (${nextReadingText.baslik_tr})`
                  : "Metin Kütüphanesine Dön"
                : nextReadingText
                  ? `Metni Tamamla ve Sonrakine Geç (${nextReadingText.baslik_tr})`
                  : "Metni Tamamlandı Olarak İşaretle"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              if (!isCompleted) {
                toggleCompletedDialogue(readingText.id);
              }
              setIsShareModalOpen(true);
            }}
            className="py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl border-b-4 border-amber-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Share2 size={17} className="shrink-0" />
            <span>🏆 Başarı Kartını Paylaş / İndir</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prevReadingText ? (
            <Link
              href={`/metin/${prevReadingText.id}`}
              onClick={() => playClick()}
              className="w-full p-3 rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 flex items-center gap-2.5 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B] transition-all"
            >
              <ChevronLeft
                size={18}
                className="text-[#065F46] dark:text-emerald-400 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] text-slate-600 dark:text-slate-300 uppercase">
                  Önceki Metin
                </span>
                <span className="truncate block">
                  {prevReadingText.baslik_tr}
                </span>
              </div>
            </Link>
          ) : (
            <div className="hidden sm:block" />
          )}

          {nextReadingText ? (
            <Link
              href={`/metin/${nextReadingText.id}`}
              onClick={() => playClick()}
              className="w-full p-3 rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 flex items-center justify-end gap-2.5 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B] transition-all text-right"
            >
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] text-slate-600 dark:text-slate-300 uppercase">
                  Sonraki Metin
                </span>
                <span className="truncate block">
                  {nextReadingText.baslik_tr}
                </span>
              </div>
              <ChevronRight
                size={18}
                className="text-[#065F46] dark:text-emerald-400 shrink-0"
              />
            </Link>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>
      </section>

      {shareCardTarget && (
        <ShareContentCardModal
          payload={shareCardTarget}
          onClose={() => setShareCardTarget(null)}
        />
      )}

      {isYoutubeModalOpen && linkedYoutubeVideos.length > 0 && (
        <YoutubePlayerModal
          items={linkedYoutubeVideos}
          onClose={() => setIsYoutubeModalOpen(false)}
        />
      )}
      </div>

      {isGrammarSplitOpen && grammarNote && (
        <LessonGrammarSplitPanel
          grammarNote={grammarNote}
          side={grammarSplitSide}
          onToggleSide={toggleGrammarSplitSide}
          onExpandToFullTab={() => {
            setGrammarSplitOpen(false);
            setStudyMode("gramer");
          }}
          onClose={() => setGrammarSplitOpen(false)}
          onOpenShadowing={(ar) => openShadowingCoach({ text: ar })}
          className={grammarSplitSide === "left" ? "lg:order-1" : "lg:order-2"}
        />
      )}
    </div>
  );
}
