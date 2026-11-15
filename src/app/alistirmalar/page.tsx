"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Play,
  BookOpen,
  CheckSquare,
  PenTool,
  Link2,
  Timer,
  ListOrdered,
  Image as ImageIcon,
  FolderOpen,
  GitBranch,
  Trophy,
  ShieldAlert,
  Headphones,
  MessageSquare,
  Scale,
  Search,
  Paintbrush,
  Sparkles,
  Layers,
  HelpCircle,
  X,
} from "lucide-react";
import { playClick, playStart } from "@/lib/sfxManager";
import {
  diyaloglar,
  metinler,
  sozluk,
  gorselKelimeler,
  diyalogGramerNotlari,
  metinGramerNotlari,
  ekGramerNotlari,
  getDynamicContentStats,
  getMainVisualCategory,
} from "@/lib/data";
import {
  getDialogueVocabulary,
  getReadingTextVocabulary,
  isProperNounItem,
} from "@/lib/dict";
import {
  Dialogue,
  DictionaryItem,
  Level,
  ResimliKelime,
  SynonymAntonymEntry,
  SynonymAntonymWordTur,
} from "@/types/data";
import { useUserStore } from "@/store/userStore";
import { useSettings } from "@/store/settings";
import {
  ArabicIdiom,
  getCombinedIdiomsCatalog,
  extractDialoguesIdioms,
} from "@/lib/arabicIdioms";
import {
  resolveMistakesPool,
  buildDailyStudyPackage,
  getLeechSrsItems,
  synonymEntryToDictionaryItem,
} from "@/lib/mistakeUtils";
import {
  generatePoolFromDialogues,
  generatePoolFromReadings,
  generatePoolFrom1111Sentences,
  generatePoolFromProverbs,
  generatePoolFromVisualWords,
  getFilteredSynonymAntonymEntries,
  getSynonymTurLabel,
  getModuleCategoryList,
  normalizeWordPartOfSpeech,
} from "@/lib/quiz";
import { formatTurkishCategory } from "@/lib/arabicTextUtils";
import { MixedText } from "@/components/ui/MixedText";
import { useEscapeKey } from "@/lib/modalStack";

import type {
  FeedbackMode,
  QuizContentType,
} from "@/components/exercises/MultipleChoice";
import type { FillSubMode } from "@/components/exercises/FillInBlanks";

function ExerciseModuleLoadingSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 sm:p-8 shadow-sm space-y-4 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="h-5 w-44 rounded-xl bg-[#E6D7BE]/70 dark:bg-slate-700" />
        <div className="h-5 w-20 rounded-xl bg-[#E6D7BE]/70 dark:bg-slate-700" />
      </div>
      <div className="h-36 rounded-2xl bg-[#F7EFE1] dark:bg-slate-800/70 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-center">
        <span className="text-xs sm:text-sm font-extrabold text-[#087F5B] dark:text-emerald-400">
          ⏳ Alıştırma modülü hazırlanıyor...
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-12 rounded-2xl bg-[#E6D7BE]/50 dark:bg-slate-800" />
        <div className="h-12 rounded-2xl bg-[#E6D7BE]/50 dark:bg-slate-800" />
        <div className="h-12 rounded-2xl bg-[#E6D7BE]/50 dark:bg-slate-800" />
        <div className="h-12 rounded-2xl bg-[#E6D7BE]/50 dark:bg-slate-800" />
      </div>
    </div>
  );
}

const Flashcard = dynamic(() => import("@/components/exercises/Flashcard"), {
  ssr: false,
  loading: () => <ExerciseModuleLoadingSkeleton />,
});
const MultipleChoice = dynamic(
  () => import("@/components/exercises/MultipleChoice"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const FillInBlanks = dynamic(
  () => import("@/components/exercises/FillInBlanks"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const MatchingGame = dynamic(
  () => import("@/components/exercises/MatchingGame"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const SentenceBuilder = dynamic(
  () => import("@/components/exercises/SentenceBuilder"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const VisualRosettaQuiz = dynamic(
  () => import("@/components/exercises/VisualRosettaQuiz"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const MorphologyAndContextQuiz = dynamic(
  () => import("@/components/exercises/MorphologyAndContextQuiz"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const ClassroomTeamBattle = dynamic(
  () => import("@/components/exercises/ClassroomTeamBattle"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const ErrorHunter = dynamic(
  () => import("@/components/exercises/ErrorHunter"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const BlindDictation = dynamic(
  () => import("@/components/exercises/BlindDictation"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const ClozeDialogueRoleplay = dynamic(
  () => import("@/components/exercises/ClozeDialogueRoleplay"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const GenderSortingGame = dynamic(
  () => import("@/components/exercises/GenderSortingGame"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const ReadingEvidenceHunter = dynamic(
  () => import("@/components/exercises/ReadingEvidenceHunter"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const IrabColorPainter = dynamic(
  () => import("@/components/exercises/IrabColorPainter"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const BalloonSafariGame = dynamic(
  () => import("@/components/exercises/BalloonSafariGame"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const MemoryFlipGame = dynamic(
  () => import("@/components/exercises/MemoryFlipGame"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const WhatIsThisGame = dynamic(
  () => import("@/components/exercises/WhatIsThisGame"),
  {
    ssr: false,
    loading: () => <ExerciseModuleLoadingSkeleton />,
  }
);
const PhonemeHeatmapModal = dynamic(
  () => import("@/components/ui/PhonemeHeatmapModal"),
  { ssr: false }
);

type ExerciseType =
  | "flashcard"
  | "multiple-choice"
  | "fill-in-blanks"
  | "matching"
  | "sentence-builder"
  | "visual-rosetta"
  | "morphology-context"
  | "classroom-battle"
  | "error-hunter"
  | "blind-dictation"
  | "cloze-roleplay"
  | "gender-sorting"
  | "evidence-hunter"
  | "irab-painter"
  | "balloon-safari"
  | "memory-flip"
  | "what-is-this";

type ExerciseCategoryTab =
  | "all"
  | "visual_games"
  | "vocab_cards"
  | "grammar_irab"
  | "listen_dialogue_class";

export type PoolSourceId =
  | "full_dict"
  | "synonyms_antonyms"
  | "visual_words"
  | "all_dialogues"
  | "reading_texts"
  | "sentences_1111"
  | "proverbs_508"
  | "srs_due"
  | "mistakes"
  | "favorites"
  | "weak-words";

function normalizePoolParam(raw?: string | null): PoolSourceId | null {
  if (!raw) return null;
  const val = raw.trim().toLowerCase();
  if (val === "full_dict" || val === "all-dict" || val === "dict") {
    return "full_dict";
  }
  if (
    val === "synonyms_antonyms" ||
    val === "es-zit" ||
    val === "es_zit" ||
    val === "synonyms"
  ) {
    return "synonyms_antonyms";
  }
  if (
    val === "visual_words" ||
    val === "gorsel-kelimeler" ||
    val === "visual"
  ) {
    return "visual_words";
  }
  if (
    val === "all_dialogues" ||
    val === "dialogues" ||
    val === "diyaloglar"
  ) {
    return "all_dialogues";
  }
  if (
    val === "reading_texts" ||
    val === "metinler-60" ||
    val === "metinler" ||
    val === "readings"
  ) {
    return "reading_texts";
  }
  if (
    val === "sentences_1111" ||
    val === "cumleler-1111" ||
    val === "cumleler" ||
    val === "1111"
  ) {
    return "sentences_1111";
  }
  if (
    val === "proverbs_508" ||
    val === "atasozleri-508" ||
    val === "atasozleri" ||
    val === "proverbs"
  ) {
    return "proverbs_508";
  }
  if (val === "srs_due" || val === "srs-daily" || val === "srs") {
    return "srs_due";
  }
  if (val === "mistakes" || val === "hata") {
    return "mistakes";
  }
  if (val === "favorites" || val === "saved-words") {
    return "favorites";
  }
  if (val === "weak-words" || val === "mahrec") {
    return "weak-words";
  }
  return null;
}

function normalizeModeParam(raw?: string | null): ExerciseType | null {
  if (!raw) return null;
  const val = raw.trim().toLowerCase();
  if (val === "flashcard" || val === "cards" || val === "kartlar") {
    return "flashcard";
  }
  if (
    val === "quiz" ||
    val === "multiple-choice" ||
    val === "test" ||
    val === "mc"
  ) {
    return "multiple-choice";
  }
  if (
    val === "fill" ||
    val === "fill-in-blanks" ||
    val === "blanks" ||
    val === "imla"
  ) {
    return "fill-in-blanks";
  }
  if (val === "matching" || val === "match" || val === "eslestirme") {
    return "matching";
  }
  if (
    val === "sentence-builder" ||
    val === "sentences" ||
    val === "cumle-kurma"
  ) {
    return "sentence-builder";
  }
  if (
    val === "visual-rosetta" ||
    val === "rosetta" ||
    val === "gorsel"
  ) {
    return "visual-rosetta";
  }
  if (
    val === "morphology-context" ||
    val === "sarf" ||
    val === "kok" ||
    val === "morphology"
  ) {
    return "morphology-context";
  }
  if (
    val === "classroom-battle" ||
    val === "battle" ||
    val === "yarisma" ||
    val === "sinif"
  ) {
    return "classroom-battle";
  }
  if (
    val === "error-hunter" ||
    val === "hata-avcisi" ||
    val === "error"
  ) {
    return "error-hunter";
  }
  if (
    val === "blind-dictation" ||
    val === "kor-dikte" ||
    val === "tashkeel" ||
    val === "dikte"
  ) {
    return "blind-dictation";
  }
  if (
    val === "cloze-roleplay" ||
    val === "replik" ||
    val === "dialogue-cloze"
  ) {
    return "cloze-roleplay";
  }
  if (
    val === "gender-sorting" ||
    val === "muzekker-muennes" ||
    val === "sepet" ||
    val === "gender"
  ) {
    return "gender-sorting";
  }
  if (
    val === "evidence-hunter" ||
    val === "kanit-dedektifi" ||
    val === "evidence"
  ) {
    return "evidence-hunter";
  }
  if (
    val === "irab-painter" ||
    val === "irab-boyama" ||
    val === "irab"
  ) {
    return "irab-painter";
  }
  if (
    val === "balloon-safari" ||
    val === "balon-safari" ||
    val === "balloon" ||
    val === "safari"
  ) {
    return "balloon-safari";
  }
  if (
    val === "memory-flip" ||
    val === "hafiza-kartlari" ||
    val === "memory" ||
    val === "hafiza"
  ) {
    return "memory-flip";
  }
  if (
    val === "what-is-this" ||
    val === "bu-nedir" ||
    val === "whatisthis" ||
    val === "bunedir"
  ) {
    return "what-is-this";
  }
  return null;
}

function ExercisesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedType, setSelectedType] = useState<ExerciseType>("flashcard");
  const [exerciseCategoryFilter, setExerciseCategoryFilter] =
    useState<ExerciseCategoryTab>("all");
  const [isSetupDrawerOpen, setIsSetupDrawerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mobileProgress, setMobileProgress] = useState<{
    current: number;
    total: number;
    correct: number;
  } | null>(null);
  const handleMobileProgressChange = useCallback(
    (info: { current: number; total: number; correct: number }) => {
      setMobileProgress((prev) =>
        prev &&
        prev.current === info.current &&
        prev.total === info.total &&
        prev.correct === info.correct
          ? prev
          : info
      );
    },
    []
  );
  const [frozenPools, setFrozenPools] = useState<{
    vocabulary: DictionaryItem[];
    idioms: ArabicIdiom[];
    dialogues: Dialogue[];
    visualPool: ResimliKelime[];
    synonymEntries: SynonymAntonymEntry[];
    isSynonymsAntonymsMode: boolean;
    isMistakesMode: boolean;
    isVisualWordsMode: boolean;
  } | null>(null);

  const {
    favoriteWords,
    weakWords,
    mistakeIds,
    srsRecords,
    completedDialogues,
    learnedWords,
    detectedCefrLevel,
    clearMistakes,
  } = useUserStore();
  const { preferredLevel } = useSettings();

  // Havuz ve Dinamik Alt Filtre State'leri
  const [rangePreset, setRangePreset] = useState<PoolSourceId>("full_dict");
  const [cefrFilter, setCefrFilter] = useState<"all" | Level>("all");
  const [wordPosFilter, setWordPosFilter] = useState<
    "all" | "isim" | "fiil" | "edat"
  >("all");
  const [synTurFilter, setSynTurFilter] = useState<
    "all" | SynonymAntonymWordTur
  >("all");
  const [singleDialogueId, setSingleDialogueId] = useState<string>("all");
  const [singleReadingId, setSingleReadingId] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [grammarFilter, setGrammarFilter] = useState<string>("all");
  const [startNum, setStartNum] = useState(1);
  const [endNum, setEndNum] = useState(diyaloglar.length);
  const [contentType, setContentType] = useState<QuizContentType>("words");
  const [questionCount, setQuestionCount] = useState<10 | 20 | 30>(10);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>("instant");
  const [fillSubMode, setFillSubMode] = useState<FillSubMode>("choices");
  const [showPhonemeHeatmap, setShowPhonemeHeatmap] = useState(false);

  useEscapeKey(
    () => setIsSetupDrawerOpen(false),
    isSetupDrawerOpen && !isPlaying,
    "alistirmalar_setup_drawer"
  );

  const dailyPackage = useMemo(
    () =>
      buildDailyStudyPackage({
        srsRecords: srsRecords || {},
        mistakeIds: mistakeIds || [],
        completedDialogues: completedDialogues || [],
        learnedWords: learnedWords || [],
        preferredLevel,
        detectedCefrLevel,
      }),
    [
      srsRecords,
      mistakeIds,
      completedDialogues,
      learnedWords,
      preferredLevel,
      detectedCefrLevel,
    ]
  );

  // URL parametrelerini oku (?pool=sentences_1111&cat=...&grammar=...&level=A1&mode=quiz vb.)
  useEffect(() => {
    const poolParam =
      searchParams.get("pool") || searchParams.get("source");
    const catParam =
      searchParams.get("cat") || searchParams.get("category");
    const grammarParam = searchParams.get("grammar");
    const levelParam =
      searchParams.get("level") || searchParams.get("seviye");
    const modeParam = searchParams.get("mode");
    const dlgParam = searchParams.get("dialogueId");
    const readingParam =
      searchParams.get("readingId") || searchParams.get("metinId");
    const planParam = searchParams.get("plan");
    const autostartParam = searchParams.get("autostart");

    const raf = requestAnimationFrame(() => {
      const storeState = useUserStore.getState();
      const settingsState = useSettings.getState();
      const snapshotDailyPackage = buildDailyStudyPackage({
        srsRecords: storeState.srsRecords || {},
        mistakeIds: storeState.mistakeIds || [],
        completedDialogues: storeState.completedDialogues || [],
        learnedWords: storeState.learnedWords || [],
        preferredLevel: settingsState.preferredLevel,
        detectedCefrLevel: storeState.detectedCefrLevel,
      });

      if (planParam === "daily") {
        setSingleDialogueId("all");
        setSingleReadingId("all");
        setCategoryFilter("all");
        setGrammarFilter("all");
        setRangePreset("srs_due");
        setContentType("mixed");
        setSelectedType("multiple-choice");
        const dueVocab =
          snapshotDailyPackage.dueReviewPool.words.length >= 4
            ? snapshotDailyPackage.dueReviewPool.words
            : [
                ...snapshotDailyPackage.dueReviewPool.words,
                ...sozluk
                  .filter(
                    (w) =>
                      !snapshotDailyPackage.dueReviewPool.words.some(
                        (dw) => dw.id === w.id
                      )
                  )
                  .slice(0, 8),
              ];
        setFrozenPools({
          vocabulary: dueVocab,
          idioms:
            snapshotDailyPackage.dueReviewPool.idioms.length > 0
              ? snapshotDailyPackage.dueReviewPool.idioms
              : getCombinedIdiomsCatalog().slice(0, 4),
          dialogues:
            snapshotDailyPackage.dueReviewPool.dialogues.length > 0
              ? snapshotDailyPackage.dueReviewPool.dialogues
              : [snapshotDailyPackage.dailyDialogue.dialogue],
          visualPool: gorselKelimeler,
          synonymEntries: [],
          isSynonymsAntonymsMode: false,
          isMistakesMode: true,
          isVisualWordsMode: false,
        });
        setIsSetupDrawerOpen(false);
        setIsPlaying(true);
        return;
      }

      if (planParam === "leech") {
        const leechIds = getLeechSrsItems(storeState.srsRecords || {}).map(
          (r) => r.id
        );
        const sourceIds =
          leechIds.length > 0 ? leechIds : storeState.mistakeIds || [];
        const leechResolved = resolveMistakesPool(sourceIds);
        const leechVocab =
          leechResolved.words.length >= 4
            ? leechResolved.words
            : [
                ...leechResolved.words,
                ...sozluk
                  .filter(
                    (w) => !leechResolved.words.some((lw) => lw.id === w.id)
                  )
                  .slice(0, 8),
              ];
        setSingleDialogueId("all");
        setSingleReadingId("all");
        setCategoryFilter("all");
        setGrammarFilter("all");
        setRangePreset("mistakes");
        setContentType(
          leechResolved.idioms.length > 0 || leechResolved.dialogues.length > 0
            ? "mixed"
            : "words"
        );
        setSelectedType("multiple-choice");
        setFrozenPools({
          vocabulary: leechVocab,
          idioms:
            leechResolved.idioms.length > 0
              ? leechResolved.idioms
              : getCombinedIdiomsCatalog().slice(0, 4),
          dialogues:
            leechResolved.dialogues.length > 0
              ? leechResolved.dialogues
              : [snapshotDailyPackage.dailyDialogue.dialogue],
          visualPool: gorselKelimeler,
          synonymEntries: [],
          isSynonymsAntonymsMode: false,
          isMistakesMode: true,
          isVisualWordsMode: false,
        });
        setIsSetupDrawerOpen(false);
        setIsPlaying(true);
        return;
      }

      if (levelParam && ["A1", "A2", "B1", "B2"].includes(levelParam)) {
        setCefrFilter(levelParam as Level);
      }

      const turParam = searchParams.get("tur");
      if (
        turParam === "isim" ||
        turParam === "fiil" ||
        turParam === "sifat" ||
        turParam === "zarf"
      ) {
        setSynTurFilter(turParam);
      }

      const resolvedPool = normalizePoolParam(poolParam);
      if (resolvedPool) {
        setRangePreset(resolvedPool);
        if (resolvedPool === "sentences_1111") {
          setContentType("sentences");
        } else if (resolvedPool === "proverbs_508") {
          setContentType("idioms");
        } else if (
          resolvedPool === "visual_words" ||
          resolvedPool === "synonyms_antonyms"
        ) {
          setContentType("words");
        } else if (resolvedPool === "reading_texts") {
          setContentType("mixed");
        }
      } else if (poolParam === "idioms") {
        setContentType("idioms");
      }

      if (catParam) {
        setCategoryFilter(
          resolvedPool === "visual_words"
            ? getMainVisualCategory(catParam)
            : catParam
        );
      }

      if (grammarParam) {
        setGrammarFilter(grammarParam);
        if (!resolvedPool) {
          setRangePreset("sentences_1111");
          setContentType("sentences");
        }
      }

      if (dlgParam) {
        const targetNum = parseInt(dlgParam.replace(/\D+/g, ""), 10);
        const foundDlg =
          diyaloglar.find((d) => d.id === dlgParam) ||
          (!isNaN(targetNum) && targetNum > 0
            ? diyaloglar.find(
                (d) => parseInt(d.id.replace(/\D+/g, ""), 10) === targetNum
              )
            : undefined);
        if (foundDlg) {
          setRangePreset("all_dialogues");
          setSingleDialogueId(foundDlg.id);
        }
      }

      if (readingParam) {
        const targetNum = parseInt(readingParam.replace(/\D+/g, ""), 10);
        const foundReading =
          metinler.find((m) => m.id === readingParam) ||
          (!isNaN(targetNum) && targetNum > 0
            ? metinler.find(
                (m) => parseInt(m.id.replace(/\D+/g, ""), 10) === targetNum
              )
            : undefined);
        if (foundReading) {
          setRangePreset("reading_texts");
          setSingleReadingId(foundReading.id);
        }
      }

      const resolvedMode = normalizeModeParam(modeParam);
      if (resolvedMode) {
        setSelectedType(resolvedMode);
        setExerciseCategoryFilter("all");
        if (resolvedMode === "sentence-builder") {
          setContentType("sentences");
          if (!resolvedPool) {
            setRangePreset("sentences_1111");
          }
        } else if (resolvedMode === "fill-in-blanks") {
          setContentType("sentences");
        } else if (resolvedMode === "visual-rosetta") {
          if (
            !resolvedPool ||
            (resolvedPool !== "visual_words" &&
              resolvedPool !== "proverbs_508" &&
              resolvedPool !== "all_dialogues" &&
              resolvedPool !== "reading_texts")
          ) {
            setRangePreset("visual_words");
          }
          setContentType("words");
        } else if (resolvedMode === "cloze-roleplay") {
          if (!resolvedPool) {
            setRangePreset("all_dialogues");
          }
        } else if (resolvedMode === "evidence-hunter") {
          if (!resolvedPool) {
            setRangePreset("reading_texts");
          }
        } else if (
          resolvedMode === "gender-sorting" ||
          resolvedMode === "balloon-safari" ||
          resolvedMode === "memory-flip" ||
          resolvedMode === "what-is-this"
        ) {
          setRangePreset("visual_words");
        }
        if (autostartParam === "1") {
          setIsSetupDrawerOpen(false);
          setIsPlaying(true);
        } else {
          setIsSetupDrawerOpen(true);
        }
      } else if (
        autostartParam !== "1" &&
        Boolean(poolParam || grammarParam || dlgParam || readingParam)
      ) {
        setIsSetupDrawerOpen(true);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [searchParams]);

  const mistakesResolved = useMemo(
    () => resolveMistakesPool(mistakeIds),
    [mistakeIds]
  );

  // Modül bazlı dinamik kategori listesi (1111 Cümle, 508 Atasözü, 998 Görsel Kelime)
  const activeModuleCategories = useMemo(() => {
    if (
      rangePreset === "sentences_1111" ||
      rangePreset === "proverbs_508" ||
      rangePreset === "visual_words"
    ) {
      return getModuleCategoryList(rangePreset, cefrFilter);
    }
    return [];
  }, [rangePreset, cefrFilter]);

  // src/lib/quiz.ts Üreticilerinden Aktif WordItem[] Havuzları
  const activeVisualWordsWordItems = useMemo(
    () =>
      generatePoolFromVisualWords({
        category: rangePreset === "visual_words" ? categoryFilter : "all",
        level: cefrFilter,
      }),
    [rangePreset, categoryFilter, cefrFilter]
  );

  const active1111SentencesWordItems = useMemo(
    () =>
      generatePoolFrom1111Sentences({
        category: rangePreset === "sentences_1111" ? categoryFilter : "all",
        level: cefrFilter,
        grammar: rangePreset === "sentences_1111" ? grammarFilter : "all",
        targetCount: questionCount,
      }),
    [rangePreset, categoryFilter, cefrFilter, grammarFilter, questionCount]
  );

  const activeProverbsWordItems = useMemo(
    () =>
      generatePoolFromProverbs({
        category: rangePreset === "proverbs_508" ? categoryFilter : "all",
        level: cefrFilter,
      }),
    [rangePreset, categoryFilter, cefrFilter]
  );

  const activeReadingsWordItems = useMemo(
    () =>
      generatePoolFromReadings({
        readingId: rangePreset === "reading_texts" ? singleReadingId : "all",
        level: cefrFilter,
      }),
    [rangePreset, singleReadingId, cefrFilter]
  );

  const activeDialoguesWordItems = useMemo(
    () =>
      generatePoolFromDialogues({
        dialogueId: singleDialogueId,
        level: cefrFilter,
        startNum,
        endNum,
      }),
    [singleDialogueId, cefrFilter, startNum, endNum]
  );

  const activeSynonymEntries = useMemo(
    () =>
      getFilteredSynonymAntonymEntries({
        level: cefrFilter,
        tur: rangePreset === "synonyms_antonyms" ? synTurFilter : "all",
      }),
    [cefrFilter, rangePreset, synTurFilter]
  );

  // Görsel & Sesli Eşleştirme için filtrelenmiş ResimliKelime[] havuzu (998 Görsel Kelime, 508 Atasözü, 120 Diyalog, 60 Metin)
  const filteredVisualWordsPool: ResimliKelime[] = useMemo(() => {
    if (rangePreset === "proverbs_508") {
      const items =
        activeProverbsWordItems.length >= 4
          ? activeProverbsWordItems
          : generatePoolFromProverbs({ category: "all", level: "all" });
      return items.map(
        (a, idx): ResimliKelime => ({
          id: a.id,
          sira: idx + 1,
          kategori: a.category || "atasozu",
          kategori_tr: formatTurkishCategory(a.category || "Atasözü"),
          arapca: a.arabic,
          turkce: a.turkish,
          tur: "ifade",
          cefr: (a.level as Level) || "B1",
          kok: "-",
          ikincil_form: "",
          ucuncul_form: "",
          soru_kalibi: "",
          ornek_ar: a.literal || a.arabic,
          ornek_tr: a.context || a.turkish,
          gorsel: a.imageUrl || `/gorseller/atasozleri/atasozu_001.webp`,
          ses_erkek: a.audioUrl || `/sesler/atasozleri/erkek/atasozu_001.mp3`,
          ses_kadin:
            a.audioFemaleUrl || `/sesler/atasozleri/kadin/atasozu_001.mp3`,
        })
      );
    }

    if (rangePreset === "all_dialogues") {
      const items = activeDialoguesWordItems.filter(
        (w) => w.type === "sentence" && w.imageUrl && w.audioUrl
      );
      if (items.length >= 4) {
        return items.map(
          (d, idx): ResimliKelime => ({
            id: d.id,
            sira: idx + 1,
            kategori: d.category || "diyalog",
            kategori_tr: d.category || "Diyalog",
            arapca: d.arabic,
            turkce: d.turkish,
            tur: "cumle",
            cefr: (d.level as Level) || "A1",
            kok: "-",
            ikincil_form: "",
            ucuncul_form: "",
            soru_kalibi: "",
            ornek_ar: d.exampleAr || d.arabic,
            ornek_tr: d.exampleTr || d.turkish,
            gorsel: d.imageUrl || "/gorseller/diyaloglar/dlg_001.webp",
            ses_erkek: d.audioUrl || "",
            ses_kadin: d.audioFemaleUrl || d.audioUrl || "",
          })
        );
      }
    }

    if (rangePreset === "reading_texts") {
      const items = activeReadingsWordItems.filter(
        (w) => w.type === "sentence" && w.imageUrl && w.audioUrl
      );
      if (items.length >= 4) {
        return items.map(
          (m, idx): ResimliKelime => ({
            id: m.id,
            sira: idx + 1,
            kategori: m.category || "metin",
            kategori_tr: m.category || "Okuma Metni",
            arapca: m.arabic,
            turkce: m.turkish,
            tur: "cumle",
            cefr: (m.level as Level) || "A1",
            kok: "-",
            ikincil_form: "",
            ucuncul_form: "",
            soru_kalibi: "",
            ornek_ar: m.exampleAr || m.arabic,
            ornek_tr: m.exampleTr || m.turkish,
            gorsel: m.imageUrl || "/gorseller/metinler/metin_01.webp",
            ses_erkek: m.audioUrl || "",
            ses_kadin: m.audioFemaleUrl || m.audioUrl || "",
          })
        );
      }
    }

    const allowedIds = new Set(activeVisualWordsWordItems.map((w) => w.id));
    const filtered = gorselKelimeler.filter((gk) => allowedIds.has(gk.id));
    return filtered.length >= 4 ? filtered : gorselKelimeler;
  }, [
    rangePreset,
    activeVisualWordsWordItems,
    activeProverbsWordItems,
    activeDialoguesWordItems,
    activeReadingsWordItems,
  ]);

  // Balon Safari ve Hafızanı Yokla için YALNIZCA gorselKelimeler_guncel.json kaynaklı saf görsel kelime havuzu ve kategorileri
  const visualWordsOnlyCategories = useMemo(
    () => getModuleCategoryList("visual_words", cefrFilter),
    [cefrFilter]
  );

  const strictVisualWordsOnlyPool: ResimliKelime[] = useMemo(() => {
    const visualItems = generatePoolFromVisualWords({
      category: categoryFilter,
      level: cefrFilter,
    });
    const allowedIds = new Set(visualItems.map((w) => w.id));
    const matched = gorselKelimeler.filter(
      (gk) => Boolean(gk.gorsel) && allowedIds.has(gk.id)
    );
    if (matched.length >= 4) return matched;
    const byLevelOnly =
      cefrFilter === "all"
        ? gorselKelimeler.filter((gk) => Boolean(gk.gorsel))
        : gorselKelimeler.filter(
            (gk) => Boolean(gk.gorsel) && gk.cefr === cefrFilter
          );
    return byLevelOnly.length >= 4
      ? byLevelOnly
      : gorselKelimeler.filter((gk) => Boolean(gk.gorsel));
  }, [categoryFilter, cefrFilter]);

  // Seçili Havuza Göre Cümle / Diyalog Yapısı (Flashcard, MultipleChoice, FillInBlanks, MatchingGame, SentenceBuilder için)
  const selectedDialogues: Dialogue[] = useMemo(() => {
    if (rangePreset === "srs_due") {
      return dailyPackage.dueReviewPool.dialogues.length > 0
        ? dailyPackage.dueReviewPool.dialogues
        : [dailyPackage.dailyDialogue.dialogue];
    }
    if (rangePreset === "mistakes" && mistakesResolved.dialogues.length > 0) {
      return mistakesResolved.dialogues;
    }
    if (rangePreset === "sentences_1111") {
      const items =
        active1111SentencesWordItems.length > 0
          ? active1111SentencesWordItems
          : generatePoolFrom1111Sentences({ category: "all", level: "all" });
      const syntheticDlg: Dialogue = {
        id: "pool_1111",
        seviye: cefrFilter === "all" ? "A1" : cefrFilter,
        baslik_tr:
          categoryFilter !== "all"
            ? `1111 Günlük Kalıp Cümle · ${formatTurkishCategory(categoryFilter)}`
            : "1111 Günlük Kalıp Cümle",
        baslik_ar: "١١١١ جُمْلَة يَوْمِيَّة",
        satirlar: items.map((c, idx) => ({
          sira: idx + 1,
          konusmaci: formatTurkishCategory(c.category || "Günlük Cümle"),
          konusmaci_ar: "جُمْلَة",
          cinsiyet: "E",
          odak_kalip: c.grammarTopic,
          arapca: c.arabic,
          turkce: c.turkish,
          ses_dosyasi: c.audioUrl,
        })),
      };
      return [syntheticDlg];
    }
    if (rangePreset === "proverbs_508") {
      const items =
        activeProverbsWordItems.length > 0
          ? activeProverbsWordItems
          : generatePoolFromProverbs({ category: "all", level: "all" });
      const syntheticDlg: Dialogue = {
        id: "pool_proverbs",
        seviye: cefrFilter === "all" ? "B1" : cefrFilter,
        baslik_tr:
          categoryFilter !== "all"
            ? `508 Atasözü · ${formatTurkishCategory(categoryFilter)}`
            : "508 Arapça Atasözü ve Hikmet",
        baslik_ar: "٥٠٨ أَمْثَال وَحِكَم",
        satirlar: items.map((a, idx) => ({
          sira: idx + 1,
          konusmaci: formatTurkishCategory(a.category || "Atasözü"),
          konusmaci_ar: "مَثَل",
          cinsiyet: "E",
          arapca: a.arabic,
          turkce: a.turkish,
          ses_dosyasi: a.audioUrl,
        })),
      };
      return [syntheticDlg];
    }
    if (rangePreset === "visual_words") {
      const itemsWithExamples = activeVisualWordsWordItems.filter(
        (w) => w.exampleAr && w.exampleAr.trim().length > 0
      );
      const sourceItems =
        itemsWithExamples.length > 0
          ? itemsWithExamples
          : generatePoolFromVisualWords({ category: "all", level: "all" }).filter(
              (w) => w.exampleAr && w.exampleAr.trim().length > 0
            );
      const syntheticDlg: Dialogue = {
        id: "pool_visual",
        seviye: cefrFilter === "all" ? "A1" : cefrFilter,
        baslik_tr:
          categoryFilter !== "all"
            ? `998 Görsel Kelime · ${categoryFilter}`
            : "998 Görsel Kelime Örnek Cümleleri",
        baslik_ar: "أَمْثِلَةُ الْكَلِمَاتِ الْمُصَوَّرَة",
        satirlar: sourceItems.map((w, idx) => ({
          sira: idx + 1,
          konusmaci: `${w.turkish} (${w.arabic})`,
          konusmaci_ar: w.arabic,
          cinsiyet: "E",
          arapca: w.exampleAr || w.arabic,
          turkce: w.exampleTr || w.turkish,
          ses_dosyasi: w.audioUrl,
        })),
      };
      return [syntheticDlg];
    }
    if (rangePreset === "reading_texts") {
      const list = metinler.filter((m) => {
        if (singleReadingId !== "all" && m.id !== singleReadingId) return false;
        if (cefrFilter !== "all" && m.seviye !== cefrFilter) return false;
        return true;
      });
      const effectiveList = list.length > 0 ? list : metinler;
      return effectiveList.map(
        (m): Dialogue => ({
          id: m.id,
          seviye: m.seviye,
          baslik_tr: m.baslik_tr,
          baslik_ar: m.baslik_ar,
          satirlar: m.satirlar.map((s) => ({
            sira: s.sira,
            konusmaci: m.baslik_tr,
            konusmaci_ar: m.baslik_ar,
            cinsiyet: "E",
            arapca: s.arapca,
            turkce: s.turkce,
            ses_dosyasi: s.ses_dosyasi,
          })),
        })
      );
    }

    if (rangePreset === "synonyms_antonyms") {
      const entries =
        activeSynonymEntries.length > 0
          ? activeSynonymEntries
          : getFilteredSynonymAntonymEntries({ level: "all", tur: "all" });
      const syntheticDlg: Dialogue = {
        id: "pool_synonyms_antonyms",
        seviye: cefrFilter === "all" ? "A1" : cefrFilter,
        baslik_tr:
          synTurFilter !== "all"
            ? `Eş & Zıt Anlamlılar · ${getSynonymTurLabel(synTurFilter)}`
            : "400 Eş & Zıt Anlamlı Kelime Karşılaştırmalı Cümleleri",
        baslik_ar: "أَمْثِلَةُ الْمُرَادِفَاتِ وَالْأَضْدَاد",
        satirlar: entries
          .filter((e) => Boolean(e.ornek_cumle_ar?.trim()))
          .map((e, idx) => ({
            sira: idx + 1,
            konusmaci: `${e.anlam_tr} (${e.kelime_ar})`,
            konusmaci_ar: e.kelime_ar,
            cinsiyet: "E",
            arapca: e.ornek_cumle_ar,
            turkce: e.ornek_cumle_tr,
          })),
      };
      return [syntheticDlg];
    }

    // all_dialogues veya full_dict / favorites / weak-words
    if (singleDialogueId !== "all" && !singleDialogueId.startsWith("range:")) {
      return diyaloglar.filter((dlg) => dlg.id === singleDialogueId);
    }
    const rangeFiltered = diyaloglar.filter((dlg) => {
      const num = parseInt(dlg.id.replace("dlg_", ""), 10);
      return num >= startNum && num <= endNum;
    });
    if (cefrFilter !== "all") {
      const byCefr = rangeFiltered.filter((dlg) => dlg.seviye === cefrFilter);
      if (byCefr.length > 0) return byCefr;
    }
    return rangeFiltered;
  }, [
    rangePreset,
    singleDialogueId,
    singleReadingId,
    categoryFilter,
    cefrFilter,
    synTurFilter,
    dailyPackage,
    mistakesResolved.dialogues,
    active1111SentencesWordItems,
    activeProverbsWordItems,
    activeVisualWordsWordItems,
    activeSynonymEntries,
    startNum,
    endNum,
  ]);

  const sentenceCountInPool = useMemo(() => {
    return selectedDialogues.reduce(
      (sum, dlg) => sum + dlg.satirlar.length,
      0
    );
  }, [selectedDialogues]);

  // Seçili havuza göre Kalıp İfadeler / Atasözleri (ArabicIdiom[]) havuzu
  const idiomsPool: ArabicIdiom[] = useMemo(() => {
    const allCatalog = getCombinedIdiomsCatalog();

    if (rangePreset === "proverbs_508") {
      const items =
        activeProverbsWordItems.length > 0
          ? activeProverbsWordItems
          : generatePoolFromProverbs({ category: "all", level: "all" });
      return items.map((a) => ({
        id: a.id,
        arabic: a.arabic,
        meaningTr: a.turkish,
        literalTr: a.literal || "",
        usageNote: a.context || "",
        level: (a.level as "A1-A2" | "B1" | "B2") || "B1",
      }));
    }

    if (rangePreset === "sentences_1111") {
      const items =
        active1111SentencesWordItems.length > 0
          ? active1111SentencesWordItems
          : generatePoolFrom1111Sentences({ category: "all", level: "all" });
      return items.map((c) => ({
        id: c.id,
        arabic: c.arabic,
        meaningTr: c.turkish,
        literalTr: c.grammarTopic ? `Odak Kalıp: ${c.grammarTopic}` : "",
        usageNote: c.context || "",
        level: (c.level as "A1-A2" | "B1" | "B2") || "A1-A2",
      }));
    }

    if (
      rangePreset === "all_dialogues" &&
      singleDialogueId !== "all" &&
      !singleDialogueId.startsWith("range:")
    ) {
      const dlgExtracted = extractDialoguesIdioms(selectedDialogues);
      return dlgExtracted.length > 0 ? dlgExtracted : allCatalog;
    }

    if (rangePreset === "srs_due") {
      return dailyPackage.dueReviewPool.idioms.length > 0
        ? dailyPackage.dueReviewPool.idioms
        : allCatalog;
    }

    if (rangePreset === "mistakes") {
      return mistakesResolved.idioms.length > 0
        ? mistakesResolved.idioms
        : allCatalog;
    }

    if (cefrFilter !== "all") {
      const targetIdiomLvl =
        cefrFilter === "A1" || cefrFilter === "A2" ? "A1-A2" : cefrFilter;
      const filteredByCefr = allCatalog.filter(
        (i) => i.level === targetIdiomLvl || i.level === cefrFilter
      );
      if (filteredByCefr.length > 0) return filteredByCefr;
    }
    return allCatalog;
  }, [
    rangePreset,
    singleDialogueId,
    cefrFilter,
    selectedDialogues,
    activeProverbsWordItems,
    active1111SentencesWordItems,
    dailyPackage.dueReviewPool.idioms,
    mistakesResolved.idioms,
  ]);

  // Seçili havuza göre Kelime (DictionaryItem[]) havuzu
  const { combinedVocabulary } = useMemo(() => {
    const nonProperSozluk = sozluk.filter((w) => !isProperNounItem(w));

    if (rangePreset === "srs_due") {
      const dueWords = dailyPackage.dueReviewPool.words.filter(
        (w) => !isProperNounItem(w)
      );
      if (dueWords.length >= 4) {
        return {
          combinedVocabulary: dueWords,
          poolNotice: `⏰ Günlük Aralıklı Tekrar (SRS) paketinizde bugün tekrar edilmesi gereken ${dueWords.length} kelime ve ${dailyPackage.dueReviewPool.idioms.length} kalıp ifade hazır.`,
        };
      }
      const padded = [
        ...dueWords,
        ...nonProperSozluk
          .filter((w) => !dueWords.some((dw) => dw.id === w.id))
          .slice(0, Math.max(4, 8 - dueWords.length)),
      ];
      return {
        combinedVocabulary: padded,
        poolNotice: `⏰ Günlük Aralıklı Tekrar (SRS) kuyruğunuz hazırlandı.`,
      };
    }

    if (rangePreset === "mistakes") {
      if (mistakeIds.length === 0) {
        return {
          combinedVocabulary: [],
          poolNotice: null,
        };
      }
      const cleanMistakeWords = mistakesResolved.words.filter(
        (w) => !isProperNounItem(w)
      );
      if (cleanMistakeWords.length >= 4) {
        return {
          combinedVocabulary: cleanMistakeWords,
          poolNotice: null,
        };
      }
      const padded = [
        ...cleanMistakeWords,
        ...nonProperSozluk
          .filter((w) => !cleanMistakeWords.some((mw) => mw.id === w.id))
          .slice(0, Math.max(4, 8 - cleanMistakeWords.length)),
      ];
      return {
        combinedVocabulary: padded,
        poolNotice:
          cleanMistakeWords.length > 0
            ? `Hata defterinizde ${cleanMistakeWords.length} kelime/ifade bulunduğu için şık havuzu genel sözlükle desteklendi.`
            : `Hata defterinizdeki cümlelerle pratik yapabilirsiniz.`,
      };
    }

    if (rangePreset === "favorites") {
      const cleanFavs = favoriteWords.filter((w) => !isProperNounItem(w));
      if (cleanFavs.length >= 4) {
        return {
          combinedVocabulary: cleanFavs,
          poolNotice: null,
        };
      }
      const padded = [
        ...cleanFavs,
        ...nonProperSozluk
          .filter((w) => !cleanFavs.some((fw) => fw.id === w.id))
          .slice(0, 12 - cleanFavs.length),
      ];
      return {
        combinedVocabulary: padded,
        poolNotice: `Favori listenizde şu an ${cleanFavs.length} kelime bulunduğu için alıştırma havuzu genel sözlük kelimeleriyle tamamlandı.`,
      };
    }

    if (rangePreset === "weak-words") {
      const cleanWeak = weakWords.filter((w) => !isProperNounItem(w));
      if (cleanWeak.length >= 4) {
        return {
          combinedVocabulary: cleanWeak,
          poolNotice: null,
        };
      }
      const padded = [
        ...cleanWeak,
        ...nonProperSozluk
          .filter((w) => !cleanWeak.some((ww) => ww.id === w.id))
          .slice(0, 12 - cleanWeak.length),
      ];
      return {
        combinedVocabulary: padded,
        poolNotice: `Mahreç Tekrarı (Zayıf Kelimeler) listenizde şu an ${cleanWeak.length} kelime bulunduğu için alıştırma havuzu genel sözlük kelimeleriyle tamamlandı.`,
      };
    }

    if (rangePreset === "visual_words") {
      const items =
        activeVisualWordsWordItems.length > 0
          ? activeVisualWordsWordItems
          : generatePoolFromVisualWords({ category: "all", level: "all" });
      const mappedVocab: DictionaryItem[] = items.map((w) => ({
        id: w.id,
        tur: w.partOfSpeech || "isim",
        kok: w.root || "-",
        anlam_tr: w.turkish,
        mufret: w.arabic,
        cemi: w.plural,
        gorsel: w.imageUrl,
        ornek_ar: w.exampleAr,
        ornek_tr: w.exampleTr,
        ses_erkek: w.audioUrl,
        ses_kadin: w.audioFemaleUrl,
        kategori_tr: w.category,
        cefr: (w.level as Level) || "A1",
      }));
      return {
        combinedVocabulary:
          mappedVocab.length >= 4 ? mappedVocab : nonProperSozluk.slice(0, 12),
        poolNotice: `🖼️ ${getDynamicContentStats().visualWordCount} Görsel Kelime havuzundan ${items.length} resimli ve örnek cümleli kelime seçildi.`,
      };
    }

    if (rangePreset === "sentences_1111") {
      const items =
        active1111SentencesWordItems.length > 0
          ? active1111SentencesWordItems
          : generatePoolFrom1111Sentences({ category: "all", level: "all" });
      const mappedSentenceItems: DictionaryItem[] = items.map((c) => ({
        id: c.id,
        tur: "ifade",
        kok: "-",
        anlam_tr: c.turkish,
        mufret: c.arabic,
        ses_erkek: c.audioUrl,
        ses_kadin: c.audioFemaleUrl,
        kategori_tr: c.category,
        cefr: (c.level as Level) || "A1",
      }));
      return {
        combinedVocabulary: mappedSentenceItems,
        poolNotice: `🗣️ ${getDynamicContentStats().sentenceCount} Günlük Kalıp Cümle havuzundan ${items.length} cümle seçildi.`,
      };
    }

    if (rangePreset === "proverbs_508") {
      const items =
        activeProverbsWordItems.length > 0
          ? activeProverbsWordItems
          : generatePoolFromProverbs({ category: "all", level: "all" });
      const mappedProverbItems: DictionaryItem[] = items.map((a) => ({
        id: a.id,
        tur: "ifade",
        kok: "-",
        anlam_tr: a.turkish,
        mufret: a.arabic,
        gorsel: a.imageUrl,
        ornek_ar: a.literal,
        ornek_tr: a.context,
        ses_erkek: a.audioUrl,
        ses_kadin: a.audioFemaleUrl,
        kategori_tr: a.category,
        cefr: (a.level as Level) || "B1",
      }));
      return {
        combinedVocabulary: mappedProverbItems,
        poolNotice: `📜 ${getDynamicContentStats().proverbCount} Atasözü & Hikmet havuzundan ${items.length} atasözü seçildi.`,
      };
    }

    if (rangePreset === "reading_texts") {
      const textVocabMap = new Map<string, DictionaryItem>();
      const targetTexts = metinler.filter((m) => {
        if (singleReadingId !== "all" && m.id !== singleReadingId) return false;
        if (cefrFilter !== "all" && m.seviye !== cefrFilter) return false;
        return true;
      });
      const effectiveTexts = targetTexts.length > 0 ? targetTexts : metinler;
      effectiveTexts.forEach((m) => {
        getReadingTextVocabulary(m.id).forEach((entry) => {
          if (!isProperNounItem(entry.item)) {
            textVocabMap.set(entry.item.id, entry.item);
          }
        });
      });
      const list = Array.from(textVocabMap.values());
      return {
        combinedVocabulary: list.length >= 4 ? list : nonProperSozluk,
        poolNotice: `📖 ${getDynamicContentStats().readingCount} Okuma Metni havuzundan ${effectiveTexts.length} metin, ${sentenceCountInPool} cümle ve ${list.length} kelime seçildi.`,
      };
    }

    if (rangePreset === "synonyms_antonyms") {
      const entries =
        activeSynonymEntries.length > 0
          ? activeSynonymEntries
          : getFilteredSynonymAntonymEntries({ level: "all", tur: "all" });
      const mappedItems = entries.map((e) => synonymEntryToDictionaryItem(e));
      return {
        combinedVocabulary: mappedItems,
        poolNotice: `🔄 ${getDynamicContentStats().synonymsAntonymsCount} Eş & Zıt Anlamlılar (المرادفات والأضداد) havuzundan ${entries.length} madde ve ince anlam nüansları (الفروق اللغوية) hazırlandı.`,
      };
    }

    if (rangePreset === "full_dict") {
      const filteredByLevel =
        cefrFilter === "all"
          ? nonProperSozluk
          : nonProperSozluk.filter((w) => w.cefr === cefrFilter);
      const filteredByPos =
        wordPosFilter === "all"
          ? filteredByLevel
          : filteredByLevel.filter((w) => {
              const pos = normalizeWordPartOfSpeech(w.tur);
              if (wordPosFilter === "edat") {
                return pos === "edat" || pos === "ifade";
              }
              return pos === wordPosFilter;
            });
      return {
        combinedVocabulary:
          filteredByPos.length >= 4
            ? filteredByPos
            : filteredByLevel.length >= 4
            ? filteredByLevel
            : nonProperSozluk,
        poolNotice: null,
      };
    }

    // all_dialogues
    if (singleDialogueId !== "all" && !singleDialogueId.startsWith("range:")) {
      const singleVocab = getDialogueVocabulary(singleDialogueId)
        .map((e) => e.item)
        .filter((w) => !isProperNounItem(w));
      return {
        combinedVocabulary:
          singleVocab.length >= 4 ? singleVocab : nonProperSozluk.slice(0, 12),
        poolNotice: `💬 Diyalog #${singleDialogueId.replace(
          "dlg_",
          ""
        )} içinden ${sentenceCountInPool} cümle ve ${
          singleVocab.length
        } kelime seçildi.`,
      };
    }

    const allVocabMap = new Map<string, DictionaryItem>();
    selectedDialogues.forEach((dlg) => {
      const entries = getDialogueVocabulary(dlg.id);
      entries.forEach((entry) => {
        if (!isProperNounItem(entry.item)) {
          allVocabMap.set(entry.item.id, entry.item);
        }
      });
    });
    const list = Array.from(allVocabMap.values());
    const filteredList =
      cefrFilter === "all" ? list : list.filter((w) => w.cefr === cefrFilter);
    return {
      combinedVocabulary: filteredList.length >= 4 ? filteredList : list,
      poolNotice: `💬 ${selectedDialogues.length} Diyalog içinden ${sentenceCountInPool} cümle ve ${
        (filteredList.length >= 4 ? filteredList : list).length
      } kelime seçildi.`,
    };
  }, [
    rangePreset,
    singleDialogueId,
    singleReadingId,
    cefrFilter,
    wordPosFilter,
    selectedDialogues,
    sentenceCountInPool,
    favoriteWords,
    weakWords,
    mistakeIds.length,
    mistakesResolved.words,
    dailyPackage.dueReviewPool,
    activeVisualWordsWordItems,
    active1111SentencesWordItems,
    activeProverbsWordItems,
    activeSynonymEntries,
  ]);

  const exerciseCards: {
    id: ExerciseType;
    category: Exclude<ExerciseCategoryTab, "all">;
    title: string;
    arabicBadge: string;
    subtitle: string;
    icon: typeof BookOpen;
  }[] = [
    {
      id: "balloon-safari",
      category: "visual_games",
      title: "🎈 Balon Safari",
      arabicBadge: "سَفَارِي البَالُونَات",
      subtitle:
        "Süzülen balonlardaki resimli ve harekeli Arapça kelimeleri sesinden yakalayın",
      icon: Sparkles,
    },
    {
      id: "memory-flip",
      category: "visual_games",
      title: "🃏 Hafızanı Yokla",
      arabicBadge: "لُعْبَةُ الذَّاكِرَةِ",
      subtitle:
        "Tek kişilik, iki kişilik veya bilgisayara karşı görsel ve Arapça kart eşleştirme",
      icon: Layers,
    },
    {
      id: "what-is-this",
      category: "visual_games",
      title: "🖼️ Bu Nedir?",
      arabicBadge: "صُورَةٌ وَكَلِمَةٌ",
      subtitle:
        "Büyük kelime görseline bakarak 4 harekeli şık arasından doğru Arapçayı bulun",
      icon: HelpCircle,
    },
    {
      id: "visual-rosetta",
      category: "visual_games",
      title: "Görsel & Sesli Eşleştirme",
      arabicBadge: "الصُّوَرُ وَالتَّلَفُّظ",
      subtitle:
        "Kare görseller, çift cinsiyetli ses ve canlı telaffuz ile görsel-işitsel eşleştirme",
      icon: ImageIcon,
    },
    {
      id: "flashcard",
      category: "vocab_cards",
      title: "Kelime & Cümle Kartları",
      arabicBadge: "البِطَاقَات",
      subtitle:
        "Sesli Arapça-Türkçe 3B kelime, atasözü, kalıp ifade ve cümle kartları",
      icon: BookOpen,
    },
    {
      id: "multiple-choice",
      category: "vocab_cards",
      title: "Çoktan Seçmeli Test",
      arabicBadge: "الاخْتِبَار",
      subtitle:
        "Kelime, atasözü, kalıp ifade veya cümlelerle 4 şıklı anlam testi",
      icon: CheckSquare,
    },
    {
      id: "matching",
      category: "vocab_cards",
      title: "Ok Çizerek Eşleştirme",
      arabicBadge: "المُطَابَقَة",
      subtitle:
        "Kelime, atasözü ve cümleleri interaktif ok çizerek eşleştirin",
      icon: Link2,
    },
    {
      id: "gender-sorting",
      category: "vocab_cards",
      title: "Müzekker / Müennes Sepeti",
      arabicBadge: "هَذَا وَهَذِهِ",
      subtitle:
        "998 görsel kelime havuzundan isimleri هَذَا ve هَذِهِ sepetlerine ayırın",
      icon: Scale,
    },
    {
      id: "error-hunter",
      category: "grammar_irab",
      title: "Hata Avcısı (Cümle Onarımı)",
      arabicBadge: "صَيْدُ الْأَخْطَاء",
      subtitle: `${
        ekGramerNotlari.length +
        diyalogGramerNotlari.length +
        metinGramerNotlari.length
      } gramer notundan hatalı kelimeyi bulma ve doğru harekeyle onarma`,
      icon: ShieldAlert,
    },
    {
      id: "irab-painter",
      category: "grammar_irab",
      title: "Cümleyi İ'rab Renkleriyle Boya",
      arabicBadge: "تَلْوِينُ الْإِعْرَاب",
      subtitle:
        "5 renkli i'rab fırçasıyla cümle ögelerini boyayın ve hareke nedenini keşfedin",
      icon: Paintbrush,
    },
    {
      id: "morphology-context",
      category: "grammar_irab",
      title: "Sarf, Kök & Bağlam Atölyesi",
      arabicBadge: "الصَّرْفُ وَالاِشْتِقَاق",
      subtitle:
        "Kök ağacı, müfret-cemî, mâzî-muzâri, soru kalıbı ve bağlam pratiği",
      icon: GitBranch,
    },
    {
      id: "sentence-builder",
      category: "grammar_irab",
      title: "Cümle Kurma (Kelime Sıralama)",
      arabicBadge: "تَرْتِيبُ الْجُمَل",
      subtitle:
        "Dinlediğiniz cümle, atasözü veya örnek cümlenin kelimelerini sıralayın",
      icon: ListOrdered,
    },
    {
      id: "fill-in-blanks",
      category: "listen_dialogue_class",
      title: "Boşluk Doldurma & İmla",
      arabicBadge: "الفَرَاغَات",
      subtitle: "Seçmeli yerleştirme veya dinleyip klavyeyle yazma",
      icon: PenTool,
    },
    {
      id: "blind-dictation",
      category: "listen_dialogue_class",
      title: "Kör Dikte & Harekeleme Atölyesi",
      arabicBadge: "الْإِمْلَاءُ وَالتَّشْكِيل",
      subtitle:
        "Sesi dinleyip cümleyi kurun veya son harfin i'rab hareke taşını yerleştirin",
      icon: Headphones,
    },
    {
      id: "cloze-roleplay",
      category: "listen_dialogue_class",
      title: "Diyalog Boş Replik Tamamlama",
      arabicBadge: "إِكْمَالُ الْحِوَار",
      subtitle:
        "120 diyalogdan bağlama uygun repliği tamamlayın ve kendi sesinizle gölgeleyin",
      icon: MessageSquare,
    },
    {
      id: "evidence-hunter",
      category: "listen_dialogue_class",
      title: "Metin Kanıt Dedektifi",
      arabicBadge: "دَلِيلُ النَّصّ",
      subtitle:
        "60 okuma metninde soruyu cevaplayın ve cevabın geçtiği kanıt satırını işaretleyin",
      icon: Search,
    },
    {
      id: "classroom-battle",
      category: "listen_dialogue_class",
      title: "Sınıf & Tahta Yarışması",
      arabicBadge: "المُسَابَقَةُ الصَّفِّيَّة",
      subtitle:
        "Akıllı tahta ve çift kişilik Takım A vs Takım B bilgi yarışması",
      icon: Trophy,
    },
  ];

  const exerciseCategoryTabs: {
    id: ExerciseCategoryTab;
    label: string;
    count: number;
  }[] = [
    { id: "all", label: "🌟 Tümü", count: exerciseCards.length },
    {
      id: "visual_games",
      label: "🎮 Görsel Oyunlar",
      count: exerciseCards.filter((c) => c.category === "visual_games").length,
    },
    {
      id: "vocab_cards",
      label: "📖 Kelime & Kartlar",
      count: exerciseCards.filter((c) => c.category === "vocab_cards").length,
    },
    {
      id: "grammar_irab",
      label: "📐 Gramer & İ'rab",
      count: exerciseCards.filter((c) => c.category === "grammar_irab").length,
    },
    {
      id: "listen_dialogue_class",
      label: "🎧 Dinleme, Diyalog & Sınıf",
      count: exerciseCards.filter((c) => c.category === "listen_dialogue_class")
        .length,
    },
  ];

  const visibleExerciseCards =
    exerciseCategoryFilter === "all"
      ? exerciseCards
      : exerciseCards.filter((c) => c.category === exerciseCategoryFilter);

  const contentStats = getDynamicContentStats();

  // Hızlı Havuz Sekmeleri (Ferah Izgara Seçenekleri)
  const poolOptions: {
    id: PoolSourceId;
    title: string;
    countBadge: string;
    label: string;
  }[] = [
    {
      id: "full_dict",
      title: "📚 Tüm Sözlük",
      countBadge: contentStats.dictionaryWordCount.toLocaleString("tr-TR"),
      label: `Tüm Sözlük (${contentStats.dictionaryWordCount.toLocaleString("tr-TR")} Kelime)`,
    },
    {
      id: "synonyms_antonyms",
      title: "🔄 Eş & Zıt Anlamlılar",
      countBadge: contentStats.synonymsAntonymsCount.toLocaleString("tr-TR"),
      label: `Eş & Zıt Anlamlı Kelimeler (${contentStats.synonymsAntonymsCount})`,
    },
    {
      id: "visual_words",
      title: "🖼️ Görsel Kelimeler",
      countBadge: contentStats.visualWordCount.toLocaleString("tr-TR"),
      label: `Görsel Kelimeler (${contentStats.visualWordCount})`,
    },
    {
      id: "all_dialogues",
      title: "💬 Diyaloglar",
      countBadge: contentStats.dialogueCount.toLocaleString("tr-TR"),
      label: `Diyaloglar (${contentStats.dialogueCount})`,
    },
    {
      id: "reading_texts",
      title: "📖 Okuma Metinleri",
      countBadge: contentStats.readingCount.toLocaleString("tr-TR"),
      label: `Okuma Metinleri (${contentStats.readingCount})`,
    },
    {
      id: "sentences_1111",
      title: "🗣️ Günlük Cümleler",
      countBadge: contentStats.sentenceCount.toLocaleString("tr-TR"),
      label: `Günlük Cümleler (${contentStats.sentenceCount.toLocaleString("tr-TR")})`,
    },
    {
      id: "proverbs_508",
      title: "📜 Atasözleri",
      countBadge: contentStats.proverbCount.toLocaleString("tr-TR"),
      label: `Atasözleri (${contentStats.proverbCount})`,
    },
    {
      id: "srs_due",
      title: "⏰ SRS Tekrar",
      countBadge: String(dailyPackage.dueReviewPool.totalDueCount),
      label: `SRS Tekrar (${dailyPackage.dueReviewPool.totalDueCount})`,
    },
    {
      id: "mistakes",
      title: "⚡ Hata Defterim",
      countBadge: String(mistakeIds.length),
      label: `Hata Defterim (${mistakeIds.length})`,
    },
    {
      id: "favorites",
      title: "❤️ Favorilerim",
      countBadge: String(favoriteWords.length),
      label: `Favorilerim (${favoriteWords.length})`,
    },
    {
      id: "weak-words",
      title: "🎯 Mahreç Tekrarı",
      countBadge: String(weakWords.length),
      label: `Mahreç Tekrarı (${weakWords.length})`,
    },
  ];

  const quickPoolPills = poolOptions;

  const isSelfSourcedSpecialMode =
    selectedType === "error-hunter" ||
    selectedType === "blind-dictation" ||
    selectedType === "cloze-roleplay" ||
    selectedType === "gender-sorting" ||
    selectedType === "evidence-hunter" ||
    selectedType === "irab-painter";

  const isPoolCompatibleWithSelectedMode = (poolId: PoolSourceId): boolean => {
    if (selectedType === "error-hunter" || selectedType === "irab-painter") {
      return false;
    }
    if (selectedType === "visual-rosetta") {
      return (
        poolId === "visual_words" ||
        poolId === "proverbs_508" ||
        poolId === "all_dialogues" ||
        poolId === "reading_texts"
      );
    }
    if (selectedType === "sentence-builder") {
      return poolId !== "full_dict";
    }
    if (selectedType === "gender-sorting") {
      return poolId === "visual_words";
    }
    if (selectedType === "cloze-roleplay") {
      return poolId === "all_dialogues";
    }
    if (selectedType === "evidence-hunter") {
      return poolId === "reading_texts";
    }
    if (selectedType === "blind-dictation") {
      return (
        poolId === "all_dialogues" ||
        poolId === "sentences_1111" ||
        poolId === "reading_texts"
      );
    }
    if (
      selectedType === "balloon-safari" ||
      selectedType === "memory-flip" ||
      selectedType === "what-is-this"
    ) {
      return poolId === "visual_words";
    }
    return true;
  };

  const isMistakesEmpty =
    !isSelfSourcedSpecialMode &&
    rangePreset === "mistakes" &&
    mistakeIds.length === 0;

  const clearGrammarFilterAndUrl = () => {
    setGrammarFilter("all");
    setFrozenPools(null);
    if (searchParams.has("grammar")) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("grammar");
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }
  };

  const handlePoolSelectChange = (presetId: PoolSourceId) => {
    if (!isPoolCompatibleWithSelectedMode(presetId)) {
      playClick();
      return;
    }
    playClick();
    setRangePreset(presetId);
    setCategoryFilter("all");
    clearGrammarFilterAndUrl();
    setWordPosFilter("all");
    setSynTurFilter("all");
    setSingleDialogueId("all");
    setSingleReadingId("all");
    setStartNum(1);
    setEndNum(diyaloglar.length);

    if (presetId === "sentences_1111") {
      setContentType("sentences");
    } else if (presetId === "proverbs_508") {
      setContentType(
        selectedType === "fill-in-blanks" || selectedType === "sentence-builder"
          ? "sentences"
          : "idioms"
      );
    } else if (
      presetId === "visual_words" ||
      presetId === "full_dict" ||
      presetId === "synonyms_antonyms"
    ) {
      setContentType(
        selectedType === "fill-in-blanks" || selectedType === "sentence-builder"
          ? "sentences"
          : "words"
      );
    } else if (presetId === "reading_texts" || presetId === "all_dialogues") {
      if (
        selectedType === "fill-in-blanks" ||
        selectedType === "sentence-builder"
      ) {
        setContentType("sentences");
      }
    }
  };

  const handleDialogueSubSelectChange = (val: string) => {
    playClick();
    setFrozenPools(null);
    if (val === "range:1-30") {
      setSingleDialogueId("range:1-30");
      setStartNum(1);
      setEndNum(30);
    } else if (val === "range:31-75") {
      setSingleDialogueId("range:31-75");
      setStartNum(31);
      setEndNum(75);
    } else if (val === "range:76-120") {
      setSingleDialogueId("range:76-120");
      setStartNum(76);
      setEndNum(diyaloglar.length);
    } else {
      setSingleDialogueId(val);
      setStartNum(1);
      setEndNum(diyaloglar.length);
    }
  };

  const handleStartExercise = () => {
    if (
      !isSelfSourcedSpecialMode &&
      combinedVocabulary.length < 4 &&
      sentenceCountInPool < 2 &&
      idiomsPool.length < 1 &&
      filteredVisualWordsPool.length < 4
    )
      return;
    playStart();
    setFrozenPools({
      vocabulary: [...combinedVocabulary],
      idioms: [...idiomsPool],
      dialogues: [...selectedDialogues],
      visualPool: [...filteredVisualWordsPool],
      synonymEntries: [...activeSynonymEntries],
      isSynonymsAntonymsMode: rangePreset === "synonyms_antonyms",
      isMistakesMode:
        rangePreset === "mistakes" || rangePreset === "srs_due",
      isVisualWordsMode: rangePreset === "visual_words",
    });
    setIsSetupDrawerOpen(false);
    setMobileProgress(null);
    setIsPlaying(true);
  };

  const handleQuickReviewBannerStart = () => {
    playStart();
    const useMistakes = mistakeIds.length > 0;
    const nonProperSozluk = sozluk.filter((w) => !isProperNounItem(w));
    if (useMistakes) {
      const cleanMistakeWords = mistakesResolved.words.filter(
        (w) => !isProperNounItem(w)
      );
      const vocab =
        cleanMistakeWords.length >= 4
          ? cleanMistakeWords
          : [
              ...cleanMistakeWords,
              ...nonProperSozluk
                .filter((w) => !cleanMistakeWords.some((mw) => mw.id === w.id))
                .slice(0, Math.max(4, 8 - cleanMistakeWords.length)),
            ];
      setRangePreset("mistakes");
      setContentType(
        mistakesResolved.idioms.length > 0 ||
          mistakesResolved.dialogues.length > 0
          ? "mixed"
          : "words"
      );
      setSelectedType("multiple-choice");
      setFrozenPools({
        vocabulary: vocab,
        idioms:
          mistakesResolved.idioms.length > 0
            ? mistakesResolved.idioms
            : getCombinedIdiomsCatalog().slice(0, 4),
        dialogues:
          mistakesResolved.dialogues.length > 0
            ? mistakesResolved.dialogues
            : [dailyPackage.dailyDialogue.dialogue],
        visualPool: gorselKelimeler,
        synonymEntries: [],
        isSynonymsAntonymsMode: false,
        isMistakesMode: true,
        isVisualWordsMode: false,
      });
    } else {
      const dueWords = dailyPackage.dueReviewPool.words.filter(
        (w) => !isProperNounItem(w)
      );
      const vocab =
        dueWords.length >= 4
          ? dueWords
          : [
              ...dueWords,
              ...nonProperSozluk
                .filter((w) => !dueWords.some((dw) => dw.id === w.id))
                .slice(0, Math.max(4, 8 - dueWords.length)),
            ];
      setRangePreset("srs_due");
      setContentType(
        dailyPackage.dueReviewPool.idioms.length > 0 ||
          dailyPackage.dueReviewPool.dialogues.length > 0
          ? "mixed"
          : "words"
      );
      setSelectedType("multiple-choice");
      setFrozenPools({
        vocabulary: vocab,
        idioms:
          dailyPackage.dueReviewPool.idioms.length > 0
            ? dailyPackage.dueReviewPool.idioms
            : getCombinedIdiomsCatalog().slice(0, 4),
        dialogues:
          dailyPackage.dueReviewPool.dialogues.length > 0
            ? dailyPackage.dueReviewPool.dialogues
            : [dailyPackage.dailyDialogue.dialogue],
        visualPool: gorselKelimeler,
        synonymEntries: [],
        isSynonymsAntonymsMode: false,
        isMistakesMode: true,
        isVisualWordsMode: false,
      });
    }
    setIsSetupDrawerOpen(false);
    setMobileProgress(null);
    setIsPlaying(true);
  };

  const handleSelectCardAndOpenDrawer = (cardId: ExerciseType) => {
    playClick();
    setFrozenPools(null);
    setSelectedType(cardId);

    const isEmptyPersonalPool =
      (rangePreset === "favorites" && favoriteWords.length === 0) ||
      (rangePreset === "weak-words" && weakWords.length === 0) ||
      (rangePreset === "mistakes" && mistakeIds.length === 0) ||
      (rangePreset === "srs_due" &&
        dailyPackage.dueReviewPool.totalDueCount === 0);

    if (
      cardId === "balloon-safari" ||
      cardId === "memory-flip" ||
      cardId === "what-is-this" ||
      cardId === "gender-sorting"
    ) {
      setRangePreset("visual_words");
      setContentType("words");
    } else if (cardId === "cloze-roleplay") {
      setRangePreset("all_dialogues");
    } else if (cardId === "evidence-hunter") {
      setRangePreset("reading_texts");
    } else if (cardId === "sentence-builder") {
      setContentType("sentences");
      if (rangePreset === "full_dict" || isEmptyPersonalPool) {
        setRangePreset("sentences_1111");
      }
    } else if (cardId === "fill-in-blanks") {
      setContentType("sentences");
      if (isEmptyPersonalPool) {
        setRangePreset("sentences_1111");
      }
    } else if (cardId === "visual-rosetta") {
      if (
        rangePreset !== "visual_words" &&
        rangePreset !== "proverbs_508" &&
        rangePreset !== "all_dialogues" &&
        rangePreset !== "reading_texts"
      ) {
        setRangePreset("visual_words");
      }
      setContentType("words");
    } else if (cardId === "blind-dictation") {
      if (
        rangePreset !== "all_dialogues" &&
        rangePreset !== "sentences_1111" &&
        rangePreset !== "reading_texts"
      ) {
        setRangePreset("sentences_1111");
      }
    } else if (isEmptyPersonalPool) {
      setRangePreset("full_dict");
      setContentType("words");
    }

    setIsSetupDrawerOpen(true);
  };

  const handleCloseExercise = () => {
    setIsPlaying(false);
    setMobileProgress(null);
    setFrozenPools(null);
  };

  const isSentencesOnlyMode =
    selectedType === "fill-in-blanks" || selectedType === "sentence-builder";

  const showSmartContentTypeSelector =
    !isSentencesOnlyMode &&
    !isSelfSourcedSpecialMode &&
    selectedType !== "visual-rosetta" &&
    selectedType !== "balloon-safari" &&
    selectedType !== "memory-flip" &&
    selectedType !== "what-is-this" &&
    selectedType !== "morphology-context" &&
    selectedType !== "classroom-battle" &&
    (rangePreset === "all_dialogues" ||
      rangePreset === "reading_texts" ||
      rangePreset === "visual_words");

  const effectiveContentType: QuizContentType = useMemo(() => {
    if (isSentencesOnlyMode) return "sentences";
    if (rangePreset === "full_dict" || rangePreset === "synonyms_antonyms") {
      return "words";
    }
    if (rangePreset === "sentences_1111") return "sentences";
    if (rangePreset === "proverbs_508") return "idioms";
    if (rangePreset === "favorites" || rangePreset === "weak-words") {
      return "words";
    }
    if (rangePreset === "srs_due") {
      return dailyPackage.dueReviewPool.idioms.length > 0 ||
        dailyPackage.dueReviewPool.dialogues.length > 0
        ? "mixed"
        : "words";
    }
    if (rangePreset === "mistakes") {
      return mistakesResolved.idioms.length > 0 ||
        mistakesResolved.dialogues.length > 0
        ? "mixed"
        : "words";
    }
    if (rangePreset === "visual_words") {
      return contentType === "sentences" ? "sentences" : "words";
    }
    if (rangePreset === "all_dialogues" || rangePreset === "reading_texts") {
      return contentType === "idioms" ? "mixed" : contentType;
    }
    return contentType;
  }, [
    isSentencesOnlyMode,
    rangePreset,
    contentType,
    dailyPackage.dueReviewPool.idioms.length,
    dailyPackage.dueReviewPool.dialogues.length,
    mistakesResolved.idioms.length,
    mistakesResolved.dialogues.length,
  ]);

  // Seçili havuz, kategori, seviye ve alıştırma moduna göre gerçek zamanlı öğe sayısı
  const { activeItemCount, activePoolCountLabel } = useMemo(() => {
    if (selectedType === "error-hunter") {
      const cnt =
        ekGramerNotlari.length +
        diyalogGramerNotlari.length +
        metinGramerNotlari.length;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt} Hata Avcısı Kalıbı`,
      };
    }

    if (selectedType === "irab-painter") {
      const cnt =
        ekGramerNotlari.length +
        diyalogGramerNotlari.length +
        metinGramerNotlari.length;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt} İ'rab Tahlili Cümlesi`,
      };
    }

    if (selectedType === "blind-dictation") {
      const cnt =
        active1111SentencesWordItems.length +
        ekGramerNotlari.length +
        diyalogGramerNotlari.length +
        metinGramerNotlari.length;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt.toLocaleString("tr-TR")} Dikte & Hareke Cümlesi`,
      };
    }

    if (selectedType === "gender-sorting") {
      const nounPool = (
        filteredVisualWordsPool.length > 0
          ? filteredVisualWordsPool
          : gorselKelimeler
      ).filter(
        (item) =>
          item.tur === "isim" &&
          (item.soru_kalibi === "مَا هَذَا؟" ||
            item.soru_kalibi === "مَا هَذِهِ؟")
      );
      const cnt = nounPool.length || 640;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt} Müzekker/Müennes İsim`,
      };
    }

    if (selectedType === "cloze-roleplay") {
      const pairCount = selectedDialogues.reduce(
        (sum, d) => sum + Math.max(0, (d.satirlar?.length || 0) - 1),
        0
      );
      const cnt = pairCount || selectedDialogues.length;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt} Diyalog Replik Çifti`,
      };
    }

    if (selectedType === "evidence-hunter") {
      const targetReadings =
        singleReadingId !== "all"
          ? metinler.filter((m) => m.id === singleReadingId)
          : cefrFilter === "all"
          ? metinler
          : metinler.filter((m) => m.seviye === cefrFilter);
      const qCount = targetReadings.reduce(
        (sum, m) => sum + (m.sorular?.length || 0),
        0
      );
      return {
        activeItemCount: qCount || metinler.length,
        activePoolCountLabel: `${qCount || metinler.length} Kanıt Sorusu`,
      };
    }

    if (
      selectedType === "balloon-safari" ||
      selectedType === "memory-flip" ||
      selectedType === "what-is-this"
    ) {
      const cnt = strictVisualWordsOnlyPool.length;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt} Görsel Kelime`,
      };
    }

    if (selectedType === "visual-rosetta") {
      const cnt = filteredVisualWordsPool.length || gorselKelimeler.length;
      const labelSuffix =
        rangePreset === "proverbs_508"
          ? "Görsel Atasözü"
          : rangePreset === "all_dialogues"
          ? "Görsel Diyalog İfadesi"
          : rangePreset === "reading_texts"
          ? "Görsel Metin Cümlesi"
          : "Görsel Kelime";
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt} ${labelSuffix}`,
      };
    }

    if (rangePreset === "visual_words") {
      if (isSentencesOnlyMode || effectiveContentType === "sentences") {
        const exCount = activeVisualWordsWordItems.filter(
          (w) => w.exampleAr && w.exampleAr.trim().length > 0
        ).length;
        return {
          activeItemCount: exCount,
          activePoolCountLabel: `${exCount} Örnek Cümle`,
        };
      }
      const cnt = activeVisualWordsWordItems.length;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt} Görsel Kelime`,
      };
    }

    if (rangePreset === "sentences_1111") {
      const cnt = active1111SentencesWordItems.length;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt} Günlük Cümle`,
      };
    }

    if (rangePreset === "proverbs_508") {
      const cnt = activeProverbsWordItems.length;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt} Atasözü`,
      };
    }

    if (rangePreset === "reading_texts") {
      if (isSentencesOnlyMode || effectiveContentType === "sentences") {
        return {
          activeItemCount: sentenceCountInPool,
          activePoolCountLabel: `${sentenceCountInPool} Metin Cümlesi`,
        };
      }
      if (effectiveContentType === "words") {
        return {
          activeItemCount: combinedVocabulary.length,
          activePoolCountLabel: `${combinedVocabulary.length} Metin Kelimesi`,
        };
      }
      const total = activeReadingsWordItems.length;
      return {
        activeItemCount: total,
        activePoolCountLabel: `${sentenceCountInPool} Cümle + ${combinedVocabulary.length} Kelime`,
      };
    }

    if (rangePreset === "all_dialogues") {
      if (isSentencesOnlyMode || effectiveContentType === "sentences") {
        return {
          activeItemCount: sentenceCountInPool,
          activePoolCountLabel: `${sentenceCountInPool} Diyalog Cümlesi`,
        };
      }
      if (effectiveContentType === "words") {
        return {
          activeItemCount: combinedVocabulary.length,
          activePoolCountLabel: `${combinedVocabulary.length} Diyalog Kelimesi`,
        };
      }
      if (effectiveContentType === "idioms") {
        return {
          activeItemCount: idiomsPool.length,
          activePoolCountLabel: `${idiomsPool.length} Kalıp İfade`,
        };
      }
      return {
        activeItemCount: activeDialoguesWordItems.length,
        activePoolCountLabel: `${sentenceCountInPool} Cümle + ${combinedVocabulary.length} Kelime`,
      };
    }

    if (rangePreset === "synonyms_antonyms") {
      const cnt = activeSynonymEntries.length;
      const turSuffix =
        synTurFilter === "all"
          ? "Eş & Zıt Anlam Maddesi"
          : `${getSynonymTurLabel(synTurFilter)} (Eş/Zıt)`;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt.toLocaleString("tr-TR")} ${turSuffix}`,
      };
    }

    if (rangePreset === "full_dict") {
      if (isSentencesOnlyMode || effectiveContentType === "sentences") {
        return {
          activeItemCount: sentenceCountInPool,
          activePoolCountLabel: `${sentenceCountInPool} Cümle`,
        };
      }
      if (effectiveContentType === "idioms") {
        return {
          activeItemCount: idiomsPool.length,
          activePoolCountLabel: `${idiomsPool.length} Kalıp İfade`,
        };
      }
      const cnt =
        cefrFilter === "all" && wordPosFilter === "all"
          ? getDynamicContentStats().dictionaryWordCount
          : combinedVocabulary.length;
      const posSuffix =
        wordPosFilter === "isim"
          ? "İsim"
          : wordPosFilter === "fiil"
          ? "Fiil"
          : wordPosFilter === "edat"
          ? "Edat & Kalıp"
          : "Kelime";
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt.toLocaleString("tr-TR")} ${posSuffix}`,
      };
    }

    const fallbackCount =
      effectiveContentType === "idioms"
        ? idiomsPool.length
        : effectiveContentType === "sentences"
        ? sentenceCountInPool
        : combinedVocabulary.length;

    return {
      activeItemCount: fallbackCount,
      activePoolCountLabel: `${fallbackCount} Öğe`,
    };
  }, [
    selectedType,
    rangePreset,
    isSentencesOnlyMode,
    effectiveContentType,
    cefrFilter,
    wordPosFilter,
    synTurFilter,
    filteredVisualWordsPool,
    activeVisualWordsWordItems,
    active1111SentencesWordItems,
    activeProverbsWordItems,
    activeReadingsWordItems,
    activeDialoguesWordItems,
    activeSynonymEntries,
    selectedDialogues,
    singleReadingId,
    sentenceCountInPool,
    combinedVocabulary.length,
    idiomsPool.length,
    strictVisualWordsOnlyPool.length,
  ]);

  return (
    <div
      className={
        isPlaying
          ? "tr-scale max-md:fixed max-md:inset-0 max-md:z-[90] max-md:bg-[#FAF4E8] max-md:dark:bg-[var(--background)] max-md:flex max-md:flex-col max-md:overflow-y-auto md:space-y-2 md:pb-4"
          : "tr-scale space-y-2 sm:space-y-2.5 pb-20 md:pb-4"
      }
    >
      {/* MOBİL (< 768px) TAM ODAK MODU 44px TEK SATIR ÜST ŞERİDİ */}
      {isPlaying &&
        selectedType !== "visual-rosetta" &&
        selectedType !== "balloon-safari" &&
        selectedType !== "memory-flip" && (
          <div className="md:hidden h-11 min-h-[44px] max-h-[44px] px-2.5 bg-[#F7EFE1] dark:bg-[var(--surface)] border-b border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-2 sticky top-0 z-10 shrink-0">
            <button
              type="button"
              onClick={() => {
                playClick();
                handleCloseExercise();
              }}
              className="h-8 px-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1 text-xs font-extrabold text-[var(--foreground)] active:scale-95 cursor-pointer shrink-0"
            >
              <ChevronLeft size={15} />
              <span>← Çık</span>
            </button>

            <div className="flex-1 min-w-0 flex items-center justify-center gap-2 px-1">
              <div className="w-16 sm:w-24 h-2 rounded-full bg-[#E6D7BE]/80 dark:bg-slate-800 overflow-hidden shrink-0">
                <div
                  className="h-full rounded-full bg-[#087F5B] transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((mobileProgress?.current ?? 1) /
                          Math.max(1, mobileProgress?.total ?? questionCount)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <span className="text-xs font-extrabold text-[var(--foreground)] tabular-nums whitespace-nowrap">
                Soru {mobileProgress?.current ?? 1}/
                {mobileProgress?.total ?? questionCount}
              </span>
            </div>

            <span className="h-7 px-2 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] inline-flex items-center text-xs font-extrabold text-[#065F46] dark:text-emerald-400 tabular-nums shrink-0">
              Doğru: {mobileProgress?.correct ?? 0}
            </span>
          </div>
        )}

      {/* ÜST BAŞLIK (Sadeleştirilmiş Vitrin Başlığı + Sağda Mahreç Haritam) */}
      <div
        className={
          isPlaying
            ? "hidden md:flex items-center justify-between gap-2"
            : "flex items-center justify-between gap-2.5"
        }
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isPlaying ? (
            <button
              type="button"
              onClick={() => {
                playClick();
                handleCloseExercise();
              }}
              className="h-8 px-3 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center gap-1 text-xs font-extrabold text-[var(--foreground)] hover:bg-[#EFE3CE] cursor-pointer shrink-0"
            >
              <ChevronLeft size={15} />
              <span>Listeye Dön</span>
            </button>
          ) : (
            <Link
              href="/"
              onClick={() => playClick()}
              className="w-9 h-9 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center justify-center text-[var(--foreground)] hover:bg-[#EFE3CE] shrink-0"
              aria-label="Ana Sayfaya Dön"
            >
              <ChevronLeft size={17} strokeWidth={2.5} />
            </Link>
          )}

          <h1 className="text-base sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight leading-snug truncate">
            {isPlaying
              ? exerciseCards.find((c) => c.id === selectedType)?.title ||
                "İnteraktif Alıştırma & Oyun Merkezi"
              : "İnteraktif Alıştırma & Oyun Merkezi"}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isPlaying &&
            (rangePreset === "sentences_1111" ||
              selectedType === "error-hunter" ||
              selectedType === "irab-painter" ||
              selectedType === "blind-dictation") &&
            grammarFilter !== "all" && (
              <div
                dir="ltr"
                lang="tr"
                className="font-sans flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 rounded-xl px-2.5 py-1 text-[11px] font-extrabold text-amber-900 dark:text-amber-200 max-w-xs"
              >
                <span className="truncate">
                  📌 Odak Kalıp: <MixedText text={grammarFilter} />
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    clearGrammarFilterAndUrl();
                  }}
                  title="Odak kalıp filtresini kaldır"
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900 hover:bg-amber-300 text-amber-950 dark:text-amber-100 text-[10px] font-black shrink-0 cursor-pointer"
                >
                  <X size={11} />
                  <span>Kaldır</span>
                </button>
              </div>
            )}

          {!isPlaying && (
            <button
              type="button"
              title="28 Harf Mahreç Haritam"
              onClick={() => {
                playClick();
                setShowPhonemeHeatmap(true);
              }}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#087F5B] border-b-3 px-3 py-1.5 text-xs font-extrabold text-[#065F46] dark:text-emerald-300 hover:opacity-95 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <span>🎙️</span>
              <span>Mahreç Haritam</span>
            </button>
          )}
        </div>
      </div>

      {!isPlaying ? (
        <>
          {/* HIZLI TEKRAR BANDI (Yalnızca Hata Defteri veya SRS kuyruğunda öğe varsa görünür) */}
          {(mistakeIds.length > 0 ||
            dailyPackage.dueReviewPool.totalDueCount > 0) && (
            <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--foreground)] min-w-0">
                <span className="shrink-0">⚡</span>
                <span className="leading-snug">
                  {mistakeIds.length > 0 ? (
                    <>
                      <strong className="font-extrabold text-amber-800 dark:text-amber-300">
                        Hızlı Tekrar:
                      </strong>{" "}
                      Hata Defterinde{" "}
                      <strong className="tabular-nums">
                        {mistakeIds.length}
                      </strong>{" "}
                      öğe seni bekliyor
                    </>
                  ) : (
                    <>
                      <strong className="font-extrabold text-[#6741D9] dark:text-indigo-300">
                        Hızlı Tekrar:
                      </strong>{" "}
                      SRS Tekrar listesinde{" "}
                      <strong className="tabular-nums">
                        {dailyPackage.dueReviewPool.totalDueCount}
                      </strong>{" "}
                      öğe seni bekliyor
                    </>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={handleQuickReviewBannerStart}
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-2 border-[#065F46] active:translate-y-0.5 transition-all shrink-0 cursor-pointer whitespace-nowrap"
              >
                Hemen Çalış →
              </button>
            </div>
          )}

          {/* ADIM 1 — NET VE TARANABİLİR 17 MODÜLLÜ VİTRİN */}
          <section aria-label="Alıştırma ve Oyun Vitrini" className="space-y-3">
            {/* Yatay Kaydırılabilir 5 Kategori Sekmesi */}
            <div
              role="tablist"
              aria-label="Alıştırma Kategorileri"
              className="flex overflow-x-auto no-scrollbar items-center gap-2 pb-0.5"
            >
              {exerciseCategoryTabs.map((tab) => {
                const active = exerciseCategoryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      playClick();
                      setExerciseCategoryFilter(tab.id);
                    }}
                    className={`min-h-[42px] px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 border-2 ${
                      active
                        ? "bg-[#6741D9] border-[#5230B5] text-white shadow-2xs"
                        : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[11px] font-black tabular-nums ${
                        active
                          ? "text-white/90"
                          : "text-[#6741D9] dark:text-indigo-300"
                      }`}
                    >
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Ferah Modül Kartları Izgarası (Tam Başlık + Arapça Rozet + 1 Satır Açıklama) */}
            <div className="flex flex-wrap justify-center items-stretch gap-3.5">
              {visibleExerciseCards.map((card) => {
                const Icon = card.icon;
                const isSelected =
                  isSetupDrawerOpen && selectedType === card.id;

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleSelectCardAndOpenDrawer(card.id)}
                    className={`w-full sm:w-[calc(50%-0.4375rem)] lg:w-[calc(25%-0.65625rem)] min-h-[96px] text-left p-3.5 sm:p-4 rounded-2xl border-2 border-b-4 transition-all flex flex-col justify-between gap-2 cursor-pointer group ${
                      isSelected
                        ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9] -translate-y-0.5 shadow-xs"
                        : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] group-hover:border-[#087F5B] text-[#065F46] dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon size={17} strokeWidth={2.3} />
                        </div>

                        <h2 className="font-extrabold text-sm sm:text-[15px] leading-snug text-[var(--foreground)] break-words">
                          {card.title}
                        </h2>
                      </div>

                      <span
                        lang="ar"
                        dir="rtl"
                        className="arabic text-xs sm:text-sm font-bold text-[var(--muted)] opacity-85 leading-relaxed shrink-0"
                      >
                        {card.arabicBadge}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-1">
                      {card.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ADIM 2 — HIZLI BAŞLATMA ÇEKMECESİ (Mobilde Bottom Sheet, Masaüstünde Kompakt Modal) */}
          {isSetupDrawerOpen &&
            (() => {
              const activeCard =
                exerciseCards.find((c) => c.id === selectedType) ||
                exerciseCards[0];
              const ActiveIcon = activeCard.icon;

              // A) Sadece Görsel Kelimelerle Çalışan Oyunlar
              const isVisualWordsOnlyGame =
                selectedType === "balloon-safari" ||
                selectedType === "memory-flip" ||
                selectedType === "what-is-this" ||
                selectedType === "gender-sorting";

              // B) Kendinden Veri Havuzlu Özel Modüller
              const isSelfContainedCorpusModule =
                selectedType === "error-hunter" ||
                selectedType === "irab-painter" ||
                selectedType === "cloze-roleplay" ||
                selectedType === "evidence-hunter";

              const supportsQuestionCount =
                selectedType !== "balloon-safari" &&
                selectedType !== "memory-flip";

              const supportsTimeLimit =
                selectedType !== "balloon-safari" &&
                selectedType !== "flashcard" &&
                selectedType !== "visual-rosetta";

              const supportsFeedbackToggle =
                selectedType === "multiple-choice" ||
                selectedType === "fill-in-blanks" ||
                selectedType === "matching" ||
                selectedType === "sentence-builder";

              const isGameActionLabel =
                selectedType === "balloon-safari" ||
                selectedType === "memory-flip" ||
                selectedType === "what-is-this" ||
                selectedType === "gender-sorting" ||
                selectedType === "classroom-battle";

              // C) Çoklu Havuz Destekleyen Modüller için Uyumlu ve Boş Olmayan Kaynaklar
              const compatibleDrawerPools = quickPoolPills.filter((pill) => {
                if (!isPoolCompatibleWithSelectedMode(pill.id)) return false;
                if (
                  pill.id === "favorites" &&
                  favoriteWords.length === 0 &&
                  rangePreset !== "favorites"
                ) {
                  return false;
                }
                if (
                  pill.id === "weak-words" &&
                  weakWords.length === 0 &&
                  rangePreset !== "weak-words"
                ) {
                  return false;
                }
                if (
                  pill.id === "mistakes" &&
                  mistakeIds.length === 0 &&
                  rangePreset !== "mistakes"
                ) {
                  return false;
                }
                if (
                  pill.id === "srs_due" &&
                  dailyPackage.dueReviewPool.totalDueCount === 0 &&
                  rangePreset !== "srs_due"
                ) {
                  return false;
                }
                return true;
              });

              const visualTotalForLevel =
                cefrFilter === "all"
                  ? gorselKelimeler.length
                  : gorselKelimeler.filter((w) => w.cefr === cefrFilter).length;

              return (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${activeCard.title} Kurulum Penceresi`}
                  onClick={() => setIsSetupDrawerOpen(false)}
                  className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full sm:max-w-lg max-h-[85dvh] sm:max-h-[88dvh] rounded-t-3xl sm:rounded-3xl bg-[#FAF4E8] dark:bg-[var(--surface)] border-t-2 border-x-2 sm:border-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
                  >
                    {/* Mobil Sürükleme Çubuğu Tutamacı */}
                    <div className="sm:hidden w-10 h-1.5 rounded-full bg-[#D5C3A3] dark:bg-slate-600 mx-auto mt-2.5 mb-0.5 shrink-0" />

                    {/* Çekmece Üst Başlığı */}
                    <div className="px-4 py-3 border-b border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-[#065F46] dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <ActiveIcon size={19} strokeWidth={2.3} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-extrabold text-sm sm:text-base text-[var(--foreground)] leading-snug break-words">
                            {activeCard.title}
                          </h2>
                          <p className="text-xs text-[var(--muted)] leading-snug truncate">
                            <span
                              lang="ar"
                              dir="rtl"
                              className="arabic font-bold text-[#065F46] dark:text-emerald-400"
                            >
                              {activeCard.arabicBadge}
                            </span>
                            <span className="mx-1.5">·</span>
                            <span>{activePoolCountLabel}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setIsSetupDrawerOpen(false);
                        }}
                        aria-label="Kurulum penceresini kapat"
                        className="w-10 h-10 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-[var(--foreground)] hover:bg-[#EFE3CE] cursor-pointer shrink-0"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Çekmece Gövdesi: Yalnızca Seçili Modülle Uyumlu 2-3 Sade Ayar */}
                    <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5">
                      {/* Odak Gramer Kalıbı URL ile geldiyse bilgi çubuğu */}
                      {(rangePreset === "sentences_1111" ||
                        selectedType === "error-hunter" ||
                        selectedType === "irab-painter" ||
                        selectedType === "blind-dictation") &&
                        grammarFilter !== "all" && (
                          <div
                            dir="ltr"
                            lang="tr"
                            className="font-sans flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl px-3 py-2 border border-amber-300 dark:border-amber-700 text-xs font-extrabold text-amber-900 dark:text-amber-200"
                          >
                            <span className="truncate">
                              📌 Odak Kalıp: <MixedText text={grammarFilter} />
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                playClick();
                                clearGrammarFilterAndUrl();
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100 text-[11px] font-black inline-flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <X size={12} />
                              <span>Kaldır</span>
                            </button>
                          </div>
                        )}

                      {/* GRUP A: SADECE GÖRSEL KELİMELERLE ÇALIŞAN OYUNLAR (Tek Temiz Kategori Seçici) */}
                      {isVisualWordsOnlyGame && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-extrabold text-[var(--foreground)]">
                            <span>Kategori Seçimi</span>
                            <span className="text-[11px] font-bold text-[#065F46] dark:text-emerald-400 tabular-nums">
                              998 Görsel Kelime · {activePoolCountLabel}
                            </span>
                          </div>
                          <div className="max-h-44 overflow-y-auto grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)]">
                            <button
                              type="button"
                              onClick={() => {
                                playClick();
                                setFrozenPools(null);
                                setRangePreset("visual_words");
                                setCategoryFilter("all");
                              }}
                              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center justify-between gap-1.5 text-left transition-all cursor-pointer ${
                                categoryFilter === "all"
                                  ? "bg-[#087F5B] border-[#065F46] text-white"
                                  : "bg-[#F7EFE1]/70 dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                              }`}
                            >
                              <span className="truncate">Tüm Kategoriler</span>
                              <span className="text-[11px] tabular-nums opacity-90 shrink-0">
                                {visualTotalForLevel}
                              </span>
                            </button>

                            {visualWordsOnlyCategories.map((cat) => {
                              const activeCat = categoryFilter === cat.category;
                              return (
                                <button
                                  key={cat.category}
                                  type="button"
                                  onClick={() => {
                                    playClick();
                                    setFrozenPools(null);
                                    setRangePreset("visual_words");
                                    setCategoryFilter(cat.category);
                                  }}
                                  className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center justify-between gap-1.5 text-left transition-all cursor-pointer ${
                                    activeCat
                                      ? "bg-[#087F5B] border-[#065F46] text-white"
                                      : "bg-[#F7EFE1]/70 dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                                  }`}
                                >
                                  <span className="truncate">{cat.label}</span>
                                  <span className="text-[11px] tabular-nums opacity-85 shrink-0">
                                    {cat.count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* GRUP B: KENDİNDEN VERİ HAVUZLU ÖZEL MODÜLLER (Kaynak seçici gösterilmez) */}
                      {isSelfContainedCorpusModule && (
                        <div className="text-xs font-semibold text-[var(--muted)] flex items-center justify-between gap-2 px-1">
                          <span>
                            {selectedType === "error-hunter"
                              ? "120 Diyalog + 60 Metin Doğrulanmış Gramer Notları"
                              : selectedType === "irab-painter"
                              ? "120 Diyalog + 60 Metin İ'rab Tahlilli Cümleler"
                              : selectedType === "cloze-roleplay"
                              ? "120 Günlük Diyalog Bağlamsal Replikleri"
                              : "60 Okuma Metni Kanıt Soruları"}
                          </span>
                          <span className="font-extrabold text-[#065F46] dark:text-emerald-400 tabular-nums shrink-0">
                            {activePoolCountLabel}
                          </span>
                        </div>
                      )}

                      {/* GRUP C: ÇOKLU HAVUZ DESTEKLEYEN GENEL ALIŞTIRMALAR (2 Sütunlu Uyumlu Kaynak Kartları + Tekil Alt Filtre) */}
                      {!isVisualWordsOnlyGame && !isSelfContainedCorpusModule && (
                        <div className="space-y-2.5">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-extrabold text-[var(--foreground)]">
                              <span>Çalışma Kaynağı</span>
                              {rangePreset === "mistakes" &&
                                mistakeIds.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      playClick();
                                      clearMistakes();
                                      handlePoolSelectChange("full_dict");
                                    }}
                                    className="text-[11px] font-bold text-amber-800 dark:text-amber-300 underline cursor-pointer"
                                  >
                                    Hata Defterini Temizle
                                  </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {compatibleDrawerPools.map((pill) => {
                                const isActive = rangePreset === pill.id;
                                return (
                                  <button
                                    key={pill.id}
                                    type="button"
                                    onClick={() =>
                                      handlePoolSelectChange(pill.id)
                                    }
                                    className={`min-h-[42px] px-3 py-2 rounded-xl border-2 text-xs font-extrabold flex items-center justify-between gap-1.5 text-left transition-all cursor-pointer min-w-0 ${
                                      isActive
                                        ? "bg-[#087F5B] border-[#065F46] text-white shadow-2xs"
                                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                                    }`}
                                  >
                                    <span className="truncate">
                                      {pill.title}
                                    </span>
                                    <span
                                      className={`text-[11px] font-black tabular-nums shrink-0 ${
                                        isActive
                                          ? "text-white/90"
                                          : "text-[#065F46] dark:text-emerald-400"
                                      }`}
                                    >
                                      {pill.countBadge}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Seçili Kaynağın Tekil Alt Filtresi */}
                          {rangePreset === "all_dialogues" && (
                            <div className="bg-white dark:bg-[var(--background)] rounded-xl px-3 min-h-[40px] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-2">
                              <FolderOpen
                                size={14}
                                className="text-[#6741D9] shrink-0"
                              />
                              <span className="text-xs font-bold text-[var(--muted)] whitespace-nowrap">
                                Diyalog:
                              </span>
                              <select
                                value={singleDialogueId}
                                onChange={(e) =>
                                  handleDialogueSubSelectChange(e.target.value)
                                }
                                aria-label="Diyalog Seçimi"
                                className="bg-transparent text-xs font-extrabold text-[var(--foreground)] focus:outline-none cursor-pointer w-full truncate"
                              >
                                <option value="all">
                                  Tüm Diyaloglar ({diyaloglar.length})
                                </option>
                                <option value="range:1-30">
                                  Başlangıç Kuru (Diyalog 1–30)
                                </option>
                                <option value="range:31-75">
                                  Orta Kur (Diyalog 31–75)
                                </option>
                                <option value="range:76-120">
                                  İleri Kur (Diyalog 76–{diyaloglar.length})
                                </option>
                                {diyaloglar.map((dlg) => {
                                  const num = dlg.id.replace("dlg_", "");
                                  return (
                                    <option key={dlg.id} value={dlg.id}>
                                      #{num} — {dlg.baslik_tr} ({dlg.seviye})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}

                          {rangePreset === "reading_texts" && (
                            <div className="bg-white dark:bg-[var(--background)] rounded-xl px-3 min-h-[40px] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-2">
                              <FolderOpen
                                size={14}
                                className="text-[#6741D9] shrink-0"
                              />
                              <span className="text-xs font-bold text-[var(--muted)] whitespace-nowrap">
                                Metin:
                              </span>
                              <select
                                value={singleReadingId}
                                onChange={(e) => {
                                  playClick();
                                  setFrozenPools(null);
                                  setSingleReadingId(e.target.value);
                                }}
                                aria-label="Okuma Metni Seçimi"
                                className="bg-transparent text-xs font-extrabold text-[var(--foreground)] focus:outline-none cursor-pointer w-full truncate"
                              >
                                <option value="all">
                                  Tüm Okuma Metinleri ({metinler.length})
                                </option>
                                {metinler.map((m, idx) => {
                                  const num = String(
                                    m.sira || idx + 1
                                  ).padStart(2, "0");
                                  return (
                                    <option key={m.id} value={m.id}>
                                      #{num} — {m.baslik_tr} ({m.seviye})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}

                          {(rangePreset === "sentences_1111" ||
                            rangePreset === "proverbs_508" ||
                            rangePreset === "visual_words") && (
                            <div className="bg-white dark:bg-[var(--background)] rounded-xl px-3 min-h-[40px] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-2">
                              <FolderOpen
                                size={14}
                                className="text-[#6741D9] shrink-0"
                              />
                              <span className="text-xs font-bold text-[var(--muted)] whitespace-nowrap">
                                Kategori:
                              </span>
                              <select
                                value={categoryFilter}
                                onChange={(e) => {
                                  playClick();
                                  setFrozenPools(null);
                                  setCategoryFilter(e.target.value);
                                }}
                                aria-label="Kategori Seçimi"
                                className="bg-transparent text-xs font-extrabold text-[var(--foreground)] focus:outline-none cursor-pointer w-full truncate"
                              >
                                <option value="all">
                                  Tüm Kategoriler ({activeModuleCategories.length}{" "}
                                  kategori)
                                </option>
                                {activeModuleCategories.map((cat) => (
                                  <option
                                    key={cat.category}
                                    value={cat.category}
                                  >
                                    {cat.label} ({cat.count})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {rangePreset === "full_dict" &&
                            !isSentencesOnlyMode && (
                              <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] grid grid-cols-4 gap-1">
                                {(
                                  [
                                    { id: "all", label: "Tümü" },
                                    { id: "isim", label: "İsimler" },
                                    { id: "fiil", label: "Fiiller" },
                                    { id: "edat", label: "Edatlar" },
                                  ] as {
                                    id: "all" | "isim" | "fiil" | "edat";
                                    label: string;
                                  }[]
                                ).map((posItem) => {
                                  const active = wordPosFilter === posItem.id;
                                  return (
                                    <button
                                      key={posItem.id}
                                      type="button"
                                      onClick={() => {
                                        playClick();
                                        setFrozenPools(null);
                                        setWordPosFilter(posItem.id);
                                      }}
                                      className={`min-h-[34px] px-2 py-1 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
                                        active
                                          ? "bg-[#6741D9] text-white font-extrabold"
                                          : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                                      }`}
                                    >
                                      {posItem.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                          {rangePreset === "synonyms_antonyms" && (
                            <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] grid grid-cols-5 gap-1">
                              {(
                                [
                                  { id: "all", label: "Tümü" },
                                  { id: "isim", label: "İsim" },
                                  { id: "fiil", label: "Fiil" },
                                  { id: "sifat", label: "Sıfat" },
                                  { id: "zarf", label: "Zarf" },
                                ] as {
                                  id: "all" | SynonymAntonymWordTur;
                                  label: string;
                                }[]
                              ).map((turItem) => {
                                const active = synTurFilter === turItem.id;
                                return (
                                  <button
                                    key={turItem.id}
                                    type="button"
                                    onClick={() => {
                                      playClick();
                                      setFrozenPools(null);
                                      setSynTurFilter(turItem.id);
                                    }}
                                    className={`min-h-[34px] px-1.5 py-1 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
                                      active
                                        ? "bg-[#087F5B] text-white font-extrabold"
                                        : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                                    }`}
                                  >
                                    {turItem.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {showSmartContentTypeSelector && (
                            <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] grid grid-cols-2 sm:grid-cols-3 gap-1">
                              {(rangePreset === "visual_words"
                                ? ([
                                    { id: "words", label: "🖼️ Kelimeler" },
                                    {
                                      id: "sentences",
                                      label: "💬 Örnek Cümleler",
                                    },
                                  ] as {
                                    id: QuizContentType;
                                    label: string;
                                  }[])
                                : ([
                                    { id: "words", label: "🔤 Kelimeler" },
                                    { id: "sentences", label: "💬 Cümleler" },
                                    { id: "mixed", label: "🔀 Karışık" },
                                  ] as {
                                    id: QuizContentType;
                                    label: string;
                                  }[])
                              ).map((item) => {
                                const active = effectiveContentType === item.id;
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                      playClick();
                                      setFrozenPools(null);
                                      setContentType(item.id);
                                    }}
                                    className={`min-h-[34px] px-2.5 py-1 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
                                      active
                                        ? "bg-[#6741D9] text-white font-extrabold"
                                        : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {selectedType === "fill-in-blanks" && (
                            <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] grid grid-cols-2 gap-1">
                              {(
                                [
                                  {
                                    id: "choices",
                                    label: "🧩 Seçmeli / Sürükle",
                                  },
                                  {
                                    id: "dictation",
                                    label: "🎧 Dinle & Yaz (İmla)",
                                  },
                                ] as { id: FillSubMode; label: string }[]
                              ).map((m) => {
                                const active = fillSubMode === m.id;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      playClick();
                                      setFillSubMode(m.id);
                                    }}
                                    className={`min-h-[36px] px-2.5 py-1 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
                                      active
                                        ? "bg-[#6741D9] text-white font-extrabold"
                                        : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                                    }`}
                                  >
                                    {m.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ORTAK SADE AYAR 1: Seviye (Tümü | A1 | A2 | B1 | B2) */}
                      <div className="space-y-1.5">
                        <span className="block text-xs font-extrabold text-[var(--foreground)]">
                          Seviye
                        </span>
                        <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] grid grid-cols-5 gap-1">
                          {(
                            [
                              { id: "all", label: "Tümü" },
                              { id: "A1", label: "A1" },
                              { id: "A2", label: "A2" },
                              { id: "B1", label: "B1" },
                              { id: "B2", label: "B2" },
                            ] as { id: "all" | Level; label: string }[]
                          ).map((lvl) => {
                            const active = cefrFilter === lvl.id;
                            return (
                              <button
                                key={lvl.id}
                                type="button"
                                onClick={() => {
                                  playClick();
                                  setFrozenPools(null);
                                  setCefrFilter(lvl.id);
                                }}
                                className={`min-h-[38px] rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                  active
                                    ? "bg-[#6741D9] text-white shadow-2xs"
                                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                                }`}
                              >
                                {lvl.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* ORTAK SADE AYAR 2: Soru Sayısı & Süre (Sadece destekleyen modüllerde görünür) */}
                      {(supportsQuestionCount || supportsTimeLimit) && (
                        <div
                          className={`grid gap-2.5 ${
                            supportsQuestionCount && supportsTimeLimit
                              ? "grid-cols-1 sm:grid-cols-2"
                              : "grid-cols-1"
                          }`}
                        >
                          {supportsQuestionCount && (
                            <div className="space-y-1.5">
                              <span className="block text-xs font-extrabold text-[var(--foreground)]">
                                Soru Sayısı
                              </span>
                              <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] grid grid-cols-3 gap-1">
                                {([10, 20, 30] as (10 | 20 | 30)[]).map(
                                  (cnt) => (
                                    <button
                                      key={cnt}
                                      type="button"
                                      onClick={() => {
                                        playClick();
                                        setQuestionCount(cnt);
                                      }}
                                      className={`min-h-[36px] rounded-lg text-xs font-extrabold tabular-nums transition-all cursor-pointer ${
                                        questionCount === cnt
                                          ? "bg-[#087F5B] text-white"
                                          : "text-[var(--muted)] hover:text-[var(--foreground)]"
                                      }`}
                                    >
                                      {cnt}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {supportsTimeLimit && (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--foreground)]">
                                <Timer size={13} className="text-[#6741D9]" />
                                <span>Süre</span>
                              </span>
                              <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] grid grid-cols-3 gap-1">
                                {[
                                  { val: null, label: "Süresiz" },
                                  { val: 60, label: "60s" },
                                  { val: 30, label: "30s" },
                                ].map((t) => (
                                  <button
                                    key={String(t.val)}
                                    type="button"
                                    onClick={() => {
                                      playClick();
                                      setTimeLimit(t.val);
                                    }}
                                    className={`min-h-[36px] rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                      timeLimit === t.val
                                        ? "bg-[#087F5B] text-white"
                                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                                    }`}
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {supportsFeedbackToggle && (
                        <div className="flex items-center justify-between gap-2 bg-white dark:bg-[var(--background)] rounded-xl px-3 py-1.5 border border-[#E6D7BE] dark:border-[var(--border)]">
                          <span className="text-xs font-bold text-[var(--muted)]">
                            Sonuç Gösterimi
                          </span>
                          <div className="flex items-center gap-1">
                            {(
                              [
                                { id: "instant", label: "⚡ Hemen" },
                                { id: "end", label: "🏁 Bitince" },
                              ] as { id: FeedbackMode; label: string }[]
                            ).map((fb) => {
                              const active = feedbackMode === fb.id;
                              return (
                                <button
                                  key={fb.id}
                                  type="button"
                                  onClick={() => {
                                    playClick();
                                    setFeedbackMode(fb.id);
                                  }}
                                  className={`min-h-[32px] px-2.5 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                                    active
                                      ? "bg-[#087F5B] text-white font-extrabold"
                                      : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                                  }`}
                                >
                                  {fb.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sabit Alt Başlatma Çubuğu (Tek Büyük Birincil Buton) */}
                    <div className="px-4 pt-2.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] bg-[#F7EFE1] dark:bg-[var(--surface)] border-t border-[#E6D7BE] dark:border-[var(--border)] shrink-0">
                      <button
                        type="button"
                        onClick={handleStartExercise}
                        disabled={
                          isMistakesEmpty ||
                          (!isSelfSourcedSpecialMode &&
                            combinedVocabulary.length < 4 &&
                            sentenceCountInPool < 2 &&
                            idiomsPool.length < 1 &&
                            filteredVisualWordsPool.length < 4)
                        }
                        className="w-full min-h-[50px] px-5 bg-[#087F5B] hover:bg-[#065F46] disabled:opacity-50 text-white font-extrabold text-sm sm:text-base rounded-2xl border-b-4 border-[#065F46] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
                      >
                        <Play
                          size={16}
                          fill="currentColor"
                          className="shrink-0"
                        />
                        <span className="truncate">
                          {isGameActionLabel
                            ? `Oyunu Başlat (${activeItemCount.toLocaleString("tr-TR")} Öğe)`
                            : `Alıştırmayı Başlat (${activeItemCount.toLocaleString("tr-TR")} Öğe)`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
        </>
      ) : (
        /* AKTİF ALIŞTIRMA EKRANI */
        <div className="max-md:flex-1 max-md:px-2.5 max-md:pt-1.5 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-4">
          {selectedType === "flashcard" && (
            <Flashcard
              vocabulary={frozenPools?.vocabulary ?? combinedVocabulary}
              idioms={frozenPools?.idioms ?? idiomsPool}
              dialogues={frozenPools?.dialogues ?? selectedDialogues}
              contentType={effectiveContentType}
              questionCount={questionCount}
              isMistakesMode={
                frozenPools?.isMistakesMode ?? rangePreset === "mistakes"
              }
              isVisualWordsMode={
                frozenPools?.isVisualWordsMode ?? rangePreset === "visual_words"
              }
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "multiple-choice" && (
            <MultipleChoice
              vocabulary={frozenPools?.vocabulary ?? combinedVocabulary}
              idioms={frozenPools?.idioms ?? idiomsPool}
              dialogues={frozenPools?.dialogues ?? selectedDialogues}
              synonymEntries={
                frozenPools?.synonymEntries ?? activeSynonymEntries
              }
              isSynonymsAntonymsMode={
                frozenPools?.isSynonymsAntonymsMode ??
                rangePreset === "synonyms_antonyms"
              }
              isVisualWordsMode={
                frozenPools?.isVisualWordsMode ?? rangePreset === "visual_words"
              }
              contentType={effectiveContentType}
              timeLimit={timeLimit}
              questionCount={questionCount}
              feedbackMode={feedbackMode}
              isMistakesMode={
                frozenPools?.isMistakesMode ?? rangePreset === "mistakes"
              }
              grammarFilter={grammarFilter}
              onClose={handleCloseExercise}
              onProgressChange={handleMobileProgressChange}
            />
          )}
          {selectedType === "fill-in-blanks" && (
            <FillInBlanks
              dialogues={frozenPools?.dialogues ?? selectedDialogues}
              vocabulary={frozenPools?.vocabulary ?? combinedVocabulary}
              idioms={frozenPools?.idioms ?? idiomsPool}
              synonymEntries={
                frozenPools?.synonymEntries ?? activeSynonymEntries
              }
              isSynonymsAntonymsMode={
                frozenPools?.isSynonymsAntonymsMode ??
                rangePreset === "synonyms_antonyms"
              }
              isVisualWordsMode={
                frozenPools?.isVisualWordsMode ?? rangePreset === "visual_words"
              }
              contentType={effectiveContentType}
              timeLimit={timeLimit}
              questionCount={questionCount}
              feedbackMode={feedbackMode}
              initialSubMode={fillSubMode}
              isMistakesMode={
                frozenPools?.isMistakesMode ?? rangePreset === "mistakes"
              }
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "matching" && (
            <MatchingGame
              vocabulary={frozenPools?.vocabulary ?? combinedVocabulary}
              idioms={frozenPools?.idioms ?? idiomsPool}
              dialogues={frozenPools?.dialogues ?? selectedDialogues}
              synonymEntries={
                frozenPools?.synonymEntries ?? activeSynonymEntries
              }
              isSynonymsAntonymsMode={
                frozenPools?.isSynonymsAntonymsMode ??
                rangePreset === "synonyms_antonyms"
              }
              isVisualWordsMode={
                frozenPools?.isVisualWordsMode ?? rangePreset === "visual_words"
              }
              contentType={effectiveContentType}
              timeLimit={timeLimit}
              questionCount={questionCount}
              feedbackMode={feedbackMode}
              isMistakesMode={
                frozenPools?.isMistakesMode ?? rangePreset === "mistakes"
              }
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "sentence-builder" && (
            <SentenceBuilder
              dialogues={frozenPools?.dialogues ?? selectedDialogues}
              idioms={frozenPools?.idioms ?? idiomsPool}
              contentType={effectiveContentType}
              questionCount={questionCount}
              timeLimit={timeLimit}
              feedbackMode={feedbackMode}
              isMistakesMode={
                frozenPools?.isMistakesMode ?? rangePreset === "mistakes"
              }
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "visual-rosetta" && (
            <VisualRosettaQuiz
              visualPool={frozenPools?.visualPool ?? filteredVisualWordsPool}
              cefrFilter={cefrFilter}
              questionCount={questionCount}
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "morphology-context" && (
            <MorphologyAndContextQuiz
              visualPool={frozenPools?.visualPool ?? filteredVisualWordsPool}
              vocabulary={frozenPools?.vocabulary ?? combinedVocabulary}
              dialogues={frozenPools?.dialogues ?? selectedDialogues}
              cefrFilter={cefrFilter}
              questionCount={questionCount}
              timeLimit={timeLimit}
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "classroom-battle" && (
            <ClassroomTeamBattle
              vocabulary={frozenPools?.vocabulary ?? combinedVocabulary}
              idioms={frozenPools?.idioms ?? idiomsPool}
              dialogues={frozenPools?.dialogues ?? selectedDialogues}
              visualPool={frozenPools?.visualPool ?? filteredVisualWordsPool}
              cefrFilter={cefrFilter}
              questionCount={questionCount}
              timeLimit={timeLimit}
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "error-hunter" && (
            <ErrorHunter
              cefrFilter={cefrFilter}
              grammarFilter={grammarFilter}
              questionCount={questionCount}
              timeLimit={timeLimit}
              onClose={handleCloseExercise}
              onProgressChange={handleMobileProgressChange}
            />
          )}
          {selectedType === "blind-dictation" && (
            <BlindDictation
              cefrFilter={cefrFilter}
              grammarFilter={grammarFilter}
              questionCount={questionCount}
              timeLimit={timeLimit}
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "cloze-roleplay" && (
            <ClozeDialogueRoleplay
              dialogues={frozenPools?.dialogues ?? selectedDialogues}
              cefrFilter={cefrFilter}
              questionCount={questionCount}
              timeLimit={timeLimit}
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "gender-sorting" && (
            <GenderSortingGame
              visualPool={frozenPools?.visualPool ?? filteredVisualWordsPool}
              cefrFilter={cefrFilter}
              questionCount={questionCount}
              timeLimit={timeLimit}
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "evidence-hunter" && (
            <ReadingEvidenceHunter
              readingId={singleReadingId}
              cefrFilter={cefrFilter}
              questionCount={questionCount}
              timeLimit={timeLimit}
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "irab-painter" && (
            <IrabColorPainter
              cefrFilter={cefrFilter}
              grammarFilter={grammarFilter}
              questionCount={questionCount}
              timeLimit={timeLimit}
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "balloon-safari" && (
            <BalloonSafariGame
              visualPool={strictVisualWordsOnlyPool}
              cefrFilter={cefrFilter}
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "memory-flip" && (
            <MemoryFlipGame
              visualPool={strictVisualWordsOnlyPool}
              cefrFilter={cefrFilter}
              timeLimit={timeLimit}
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "what-is-this" && (
            <WhatIsThisGame
              visualPool={strictVisualWordsOnlyPool}
              cefrFilter={cefrFilter}
              questionCount={questionCount}
              timeLimit={timeLimit}
              onClose={handleCloseExercise}
            />
          )}
        </div>
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

export default function ExercisesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Yükleniyor...</div>}>
      <ExercisesPageContent />
    </Suspense>
  );
}