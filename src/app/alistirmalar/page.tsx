"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Check,
  Play,
  BookOpen,
  CheckSquare,
  PenTool,
  Link2,
  Info,
  Timer,
  ListOrdered,
  Image as ImageIcon,
  FolderOpen,
} from "lucide-react";
import { playClick, playStart } from "@/lib/sfxManager";
import {
  diyaloglar,
  metinler,
  sozluk,
  gorselKelimeler,
  getDynamicContentStats,
  getMainVisualCategory,
} from "@/lib/data";
import {
  getDialogueVocabulary,
  getReadingTextVocabulary,
  isProperNounItem,
} from "@/lib/dict";
import { Dialogue, DictionaryItem, Level, ResimliKelime } from "@/types/data";
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
} from "@/lib/mistakeUtils";
import {
  generatePoolFromDialogues,
  generatePoolFromReadings,
  generatePoolFrom1111Sentences,
  generatePoolFromProverbs,
  generatePoolFromVisualWords,
  getModuleCategoryList,
  normalizeWordPartOfSpeech,
} from "@/lib/quiz";

import Flashcard from "@/components/exercises/Flashcard";
import MultipleChoice, {
  FeedbackMode,
  QuizContentType,
} from "@/components/exercises/MultipleChoice";
import FillInBlanks, {
  FillSubMode,
} from "@/components/exercises/FillInBlanks";
import MatchingGame from "@/components/exercises/MatchingGame";
import SentenceBuilder from "@/components/exercises/SentenceBuilder";
import VisualRosettaQuiz from "@/components/exercises/VisualRosettaQuiz";

type ExerciseType =
  | "flashcard"
  | "multiple-choice"
  | "fill-in-blanks"
  | "matching"
  | "sentence-builder"
  | "visual-rosetta";

export type PoolSourceId =
  | "full_dict"
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
  return null;
}

function ExercisesPageContent() {
  const searchParams = useSearchParams();
  const [selectedType, setSelectedType] = useState<ExerciseType>("flashcard");
  const [isPlaying, setIsPlaying] = useState(false);
  const [frozenPools, setFrozenPools] = useState<{
    vocabulary: DictionaryItem[];
    idioms: ArabicIdiom[];
    dialogues: Dialogue[];
    visualPool: ResimliKelime[];
    isMistakesMode: boolean;
  } | null>(null);

  const {
    favoriteWords,
    weakWords,
    mistakeIds,
    srsRecords,
    completedDialogues,
    learnedWords,
    clearMistakes,
  } = useUserStore();
  const { preferredLevel } = useSettings();

  // Havuz ve Dinamik Alt Filtre State'leri
  const [rangePreset, setRangePreset] = useState<PoolSourceId>("full_dict");
  const [cefrFilter, setCefrFilter] = useState<"all" | Level>("all");
  const [wordPosFilter, setWordPosFilter] = useState<
    "all" | "isim" | "fiil" | "edat"
  >("all");
  const [singleDialogueId, setSingleDialogueId] = useState<string>("all");
  const [singleReadingId, setSingleReadingId] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [startNum, setStartNum] = useState(1);
  const [endNum, setEndNum] = useState(diyaloglar.length);
  const [contentType, setContentType] = useState<QuizContentType>("words");
  const [questionCount, setQuestionCount] = useState<10 | 20 | 30>(10);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>("instant");
  const [fillSubMode, setFillSubMode] = useState<FillSubMode>("choices");

  const dailyPackage = useMemo(
    () =>
      buildDailyStudyPackage({
        srsRecords: srsRecords || {},
        mistakeIds: mistakeIds || [],
        completedDialogues: completedDialogues || [],
        learnedWords: learnedWords || [],
        preferredLevel,
      }),
    [srsRecords, mistakeIds, completedDialogues, learnedWords, preferredLevel]
  );

  // URL parametrelerini oku (?pool=sentences_1111&cat=...&level=A1&mode=quiz vb.)
  useEffect(() => {
    const poolParam =
      searchParams.get("pool") || searchParams.get("source");
    const catParam =
      searchParams.get("cat") || searchParams.get("category");
    const levelParam =
      searchParams.get("level") || searchParams.get("seviye");
    const modeParam = searchParams.get("mode");
    const dlgParam = searchParams.get("dialogueId");
    const readingParam =
      searchParams.get("readingId") || searchParams.get("metinId");
    const planParam = searchParams.get("plan");

    const raf = requestAnimationFrame(() => {
      if (planParam === "daily") {
        setSingleDialogueId("all");
        setSingleReadingId("all");
        setCategoryFilter("all");
        setRangePreset("srs_due");
        setContentType("mixed");
        setSelectedType("multiple-choice");
        const dueVocab =
          dailyPackage.dueReviewPool.words.length >= 4
            ? dailyPackage.dueReviewPool.words
            : [
                ...dailyPackage.dueReviewPool.words,
                ...sozluk
                  .filter(
                    (w) =>
                      !dailyPackage.dueReviewPool.words.some(
                        (dw) => dw.id === w.id
                      )
                  )
                  .slice(0, 8),
              ];
        setFrozenPools({
          vocabulary: dueVocab,
          idioms:
            dailyPackage.dueReviewPool.idioms.length > 0
              ? dailyPackage.dueReviewPool.idioms
              : getCombinedIdiomsCatalog().slice(0, 4),
          dialogues:
            dailyPackage.dueReviewPool.dialogues.length > 0
              ? dailyPackage.dueReviewPool.dialogues
              : [dailyPackage.dailyDialogue.dialogue],
          visualPool: gorselKelimeler,
          isMistakesMode: true,
        });
        setIsPlaying(true);
        return;
      }

      if (levelParam && ["A1", "A2", "B1", "B2"].includes(levelParam)) {
        setCefrFilter(levelParam as Level);
      }

      const resolvedPool = normalizePoolParam(poolParam);
      if (resolvedPool) {
        setRangePreset(resolvedPool);
        if (resolvedPool === "sentences_1111") {
          setContentType("sentences");
        } else if (resolvedPool === "proverbs_508") {
          setContentType("idioms");
        } else if (resolvedPool === "visual_words") {
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
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [searchParams, dailyPackage]);

  const mistakesResolved = useMemo(
    () => resolveMistakesPool(mistakeIds),
    [mistakeIds]
  );

  // Modül bazlı dinamik kategori listesi (1111 Cümle, 508 Atasözü, 999 Görsel Kelime)
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
      }),
    [rangePreset, categoryFilter, cefrFilter]
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

  // Görsel & Sesli Eşleştirme için filtrelenmiş ResimliKelime[] havuzu (999 Görsel Kelime, 508 Atasözü, 120 Diyalog, 60 Metin)
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
          kategori_tr: (a.category || "Atasözü").replace(/_/g, " "),
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
            ? `1111 Cümle · ${categoryFilter.replace(/_/g, " ")}`
            : "1111 Günlük Kalıp Cümle",
        baslik_ar: "١١١١ جُمْلَة يَوْمِيَّة",
        satirlar: items.map((c, idx) => ({
          sira: idx + 1,
          konusmaci: (c.category || "Günlük Cümle").replace(/_/g, " "),
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
            ? `508 Atasözü · ${categoryFilter.replace(/_/g, " ")}`
            : "508 Arapça Atasözü ve Hikmet",
        baslik_ar: "٥٠٨ أَمْثَال وَحِكَم",
        satirlar: items.map((a, idx) => ({
          sira: idx + 1,
          konusmaci: (a.category || "Atasözü").replace(/_/g, " "),
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
            ? `999 Görsel Kelime · ${categoryFilter}`
            : "999 Görsel Kelime Örnek Cümleleri",
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
    dailyPackage,
    mistakesResolved.dialogues,
    active1111SentencesWordItems,
    activeProverbsWordItems,
    activeVisualWordsWordItems,
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

  // Seçili havuza göre Kelime (DictionaryItem[]) havuzu ve bilgi mesajı
  const { combinedVocabulary, poolNotice } = useMemo(() => {
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
  ]);

  const exerciseCards: {
    id: ExerciseType;
    title: string;
    arabicBadge: string;
    subtitle: string;
    icon: typeof BookOpen;
  }[] = [
    {
      id: "flashcard",
      title: "Kelime & Cümle Kartları",
      arabicBadge: "البِطَاقَات",
      subtitle:
        "Sesli Arapça-Türkçe 3B kelime, atasözü, kalıp ifade ve cümle kartları",
      icon: BookOpen,
    },
    {
      id: "multiple-choice",
      title: "Çoktan Seçmeli Test",
      arabicBadge: "الاخْتِبَار",
      subtitle:
        "Kelime, atasözü, kalıp ifade veya cümlelerle 4 şıklı anlam testi",
      icon: CheckSquare,
    },
    {
      id: "fill-in-blanks",
      title: "Boşluk Doldurma & İmla",
      arabicBadge: "الفَرَاغَات",
      subtitle: "Seçmeli sürükle-bırak veya dinleyip klavyeyle yazma",
      icon: PenTool,
    },
    {
      id: "matching",
      title: "Ok Çizerek Eşleştirme",
      arabicBadge: "المُطَابَقَة",
      subtitle:
        "Kelime, atasözü ve cümleleri interaktif ok çizerek eşleştirin",
      icon: Link2,
    },
    {
      id: "sentence-builder",
      title: "Cümle Kurma (Kelime Sıralama)",
      arabicBadge: "تَرْتِيبُ الْجُمَل",
      subtitle:
        "Dinlediğiniz cümle, atasözü veya örnek cümlenin kelimelerini sıralayın",
      icon: ListOrdered,
    },
    {
      id: "visual-rosetta",
      title: "Görsel & Sesli Eşleştirme",
      arabicBadge: "الصُّوَرُ وَالتَّلَفُّظ",
      subtitle:
        "Kare görseller, çift cinsiyetli ses ve canlı telaffuz ile görsel-işitsel eşleştirme",
      icon: ImageIcon,
    },
  ];

  const contentStats = getDynamicContentStats();

  // Hızlı Havuz Sekmeleri (4x2 Ferah Izgara Seçenekleri)
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
      title: "⚡ Hata Defteri",
      countBadge: String(mistakeIds.length),
      label: `Hata Defteri (${mistakeIds.length})`,
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

  const quickPoolPills = poolOptions.slice(0, 8);

  const isPoolCompatibleWithSelectedMode = (poolId: PoolSourceId): boolean => {
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
    return true;
  };

  const isMistakesEmpty =
    rangePreset === "mistakes" && mistakeIds.length === 0;

  const handlePoolSelectChange = (presetId: PoolSourceId) => {
    if (
      selectedType === "visual-rosetta" &&
      !isPoolCompatibleWithSelectedMode(presetId)
    ) {
      playClick();
      return;
    }
    if (selectedType === "sentence-builder" && presetId === "full_dict") {
      playClick();
      return;
    }
    playClick();
    setRangePreset(presetId);
    setCategoryFilter("all");
    setWordPosFilter("all");
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
    } else if (presetId === "visual_words" || presetId === "full_dict") {
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
      isMistakesMode:
        rangePreset === "mistakes" || rangePreset === "srs_due",
    });
    setIsPlaying(true);
  };

  const handleCloseExercise = () => {
    setIsPlaying(false);
    setFrozenPools(null);
  };

  const isSentencesOnlyMode =
    selectedType === "fill-in-blanks" || selectedType === "sentence-builder";

  const showSmartContentTypeSelector =
    !isSentencesOnlyMode &&
    selectedType !== "visual-rosetta" &&
    (rangePreset === "all_dialogues" ||
      rangePreset === "reading_texts" ||
      rangePreset === "visual_words");

  const effectiveContentType: QuizContentType = useMemo(() => {
    if (isSentencesOnlyMode) return "sentences";
    if (rangePreset === "full_dict") return "words";
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
    filteredVisualWordsPool.length,
    activeVisualWordsWordItems,
    active1111SentencesWordItems,
    activeProverbsWordItems,
    activeReadingsWordItems,
    activeDialoguesWordItems,
    sentenceCountInPool,
    combinedVocabulary.length,
    idiomsPool.length,
  ]);

  return (
    <div className={isPlaying ? "space-y-2 pb-4" : "space-y-2 sm:space-y-2.5 pb-16 md:pb-2"}>
      {/* ÜST BAŞLIK */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isPlaying ? (
            <button
              type="button"
              onClick={() => {
                playClick();
                handleCloseExercise();
              }}
              className="h-8 px-2.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center gap-1 text-xs font-extrabold text-[var(--foreground)] hover:bg-[#EFE3CE] cursor-pointer shrink-0"
            >
              <ChevronLeft size={15} />
              <span>Ayarlara Dön</span>
            </button>
          ) : (
            <Link
              href="/"
              onClick={() => playClick()}
              className="w-8 h-8 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center justify-center text-[var(--foreground)] hover:bg-[#EFE3CE] shrink-0"
              aria-label="Ana Sayfaya Dön"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </Link>
          )}

          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-extrabold text-[var(--foreground)] tracking-tight leading-tight truncate">
              İnteraktif Alıştırma Merkezi
            </h1>
            <p className="text-[10px] sm:text-[11px] font-medium text-[var(--muted)] truncate">
              {contentStats.dialogueCount} Diyalog • {contentStats.readingCount} Metin • {contentStats.sentenceCount} Cümle • {contentStats.proverbCount} Atasözü • {contentStats.visualWordCount} Görsel Kelime • {contentStats.dictionaryWordCount} Sözlük Kelimesi
            </p>
          </div>
        </div>

        <div
          data-tooltip={`${contentStats.dialogueCount} Diyalog • ${contentStats.readingCount} Metin • ${contentStats.sentenceCount} Cümle • ${contentStats.proverbCount} Atasözü • ${contentStats.visualWordCount} Görsel Kelime • ${contentStats.dictionaryWordCount} Sözlük Kelimesi`}
          data-tooltip-pos="bottom"
          data-tooltip-align="right"
          className="hidden sm:flex items-center gap-1.5 bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 rounded-xl px-2.5 py-1 text-xs font-extrabold text-[#065F46] dark:text-emerald-400 tabular-nums shrink-0"
        >
          <span>{activePoolCountLabel}</span>
          <Info size={12} className="opacity-75 shrink-0" />
        </div>
      </div>

      {!isPlaying ? (
        <>
          {/* 1. ÜSTTE 2 SÜTUNLU (MOBİL) / 6'LI (MASAÜSTÜ) KOMPAKT ALIŞTIRMA TÜRÜ SEÇİM IZGARASI (ZERO-SCROLL) */}
          <section aria-label="Alıştırma Türü Seçimi">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {exerciseCards.map((card) => {
                const isSelected = selectedType === card.id;
                const Icon = card.icon;

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setSelectedType(card.id);
                      if (card.id === "sentence-builder") {
                        setContentType("sentences");
                        if (rangePreset === "full_dict") {
                          setRangePreset("sentences_1111");
                        }
                      } else if (card.id === "fill-in-blanks") {
                        setContentType("sentences");
                      } else if (card.id === "visual-rosetta") {
                        if (
                          rangePreset !== "visual_words" &&
                          rangePreset !== "proverbs_508" &&
                          rangePreset !== "all_dialogues" &&
                          rangePreset !== "reading_texts"
                        ) {
                          setRangePreset("visual_words");
                        }
                        setContentType("words");
                      }
                    }}
                    className={`text-left p-2 sm:p-2.5 rounded-2xl border-2 border-b-4 transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9] -translate-y-0.5 shadow-xs"
                        : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#cbb692]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1 sm:mb-1.5 gap-1">
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border-2 border-b-3 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-[#6741D9] border-[#5230B5] text-white"
                            : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[#065F46] dark:text-emerald-400"
                        }`}
                      >
                        <Icon size={15} strokeWidth={2.3} />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          lang="ar"
                          dir="rtl"
                          className="arabic text-xs sm:text-sm font-bold text-[var(--muted)] opacity-75 leading-none"
                        >
                          {card.arabicBadge}
                        </span>
                        {isSelected && (
                          <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#6741D9] text-white flex items-center justify-center shrink-0">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </div>

                    <h2
                      className={`font-extrabold text-xs sm:text-sm leading-tight w-full ${
                        isSelected
                          ? "text-[#4C28B5] dark:text-[#d0bfff]"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {card.title}
                    </h2>

                    <p className="hidden sm:block text-[11px] text-[var(--muted)] leading-tight line-clamp-2 mt-0.5">
                      {card.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. KOMPAKT AYAR PANELİ + TÜM EĞİTİM HAVUZLARI + BAŞLAT BUTONU */}
          <section className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-2.5 sm:p-3 space-y-2">
            {/* 8 Ana Veri Kaynağı Izgarası (4x2 Ferah Izgara — Metin Kesilmesi Yok) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pb-2 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
              {quickPoolPills.map((pill) => {
                const isActive = rangePreset === pill.id;
                const isCompatible = isPoolCompatibleWithSelectedMode(pill.id);
                const incompatibilityHint =
                  selectedType === "visual-rosetta" && !isCompatible
                    ? "Bu modül görselli havuzlarla (Görsel Kelimeler, Atasözleri, Diyaloglar, Metinler) çalışır"
                    : selectedType === "sentence-builder" && !isCompatible
                    ? "Bu modül cümle içeren havuzlarla (Günlük Cümleler, Diyaloglar, Okuma Metinleri, Atasözleri, Görsel Kelimeler) çalışır"
                    : undefined;

                const activeStyle =
                  pill.id === "srs_due"
                    ? "bg-[#6741D9] border-[#5230B5] text-white shadow-2xs"
                    : pill.id === "mistakes"
                    ? "bg-amber-600 border-amber-700 text-white shadow-2xs"
                    : "bg-[#087F5B] border-[#065F46] text-white shadow-2xs";

                const badgeStyle = isActive
                  ? "bg-white/20 text-white border-white/30"
                  : pill.id === "srs_due"
                  ? "bg-[#F3F0FF] dark:bg-indigo-950/60 text-[#6741D9] dark:text-indigo-300 border-[#6741D9]/30"
                  : pill.id === "mistakes"
                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[#065F46] dark:text-emerald-400 border-[#E6D7BE]";

                return (
                  <button
                    key={pill.id}
                    type="button"
                    title={incompatibilityHint}
                    data-tooltip={incompatibilityHint}
                    onClick={() => handlePoolSelectChange(pill.id)}
                    className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold flex items-center justify-between gap-2 text-left transition-all ${
                      !isCompatible
                        ? "opacity-45 bg-white/60 dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)] cursor-not-allowed"
                        : isActive
                        ? `${activeStyle} cursor-pointer`
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B] cursor-pointer"
                    }`}
                  >
                    <span className="leading-snug">{pill.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded-lg border text-[11px] font-black tabular-nums shrink-0 ${badgeStyle}`}
                    >
                      {pill.countBadge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Kütüphane Defterim veya Mahreç Tekrarı URL'sinden gelindiyse aktif kaynak göstergesi */}
            {(rangePreset === "favorites" || rangePreset === "weak-words") && (
              <div className="flex items-center justify-between gap-2 bg-white/90 dark:bg-[var(--background)] rounded-xl px-3 py-1.5 border border-[#6741D9]/50 text-xs font-extrabold text-[#6741D9] dark:text-indigo-300">
                <span>
                  {rangePreset === "favorites"
                    ? `❤️ Kişisel Çalışma Defterim (${favoriteWords.length} kayıt) seçili`
                    : `🎯 Mahreç Tekrarı (${weakWords.length} kelime) seçili`}
                </span>
                <button
                  type="button"
                  onClick={() => handlePoolSelectChange("full_dict")}
                  className="text-[11px] font-bold underline cursor-pointer"
                >
                  Tüm Sözlüğe Dön
                </button>
              </div>
            )}

            {/* Bağlama Duyarlı Çalışma Türü Seçicisi: SADECE Çoklu-Tür Kaynaklarında (120 Diyalog, 60 Metin, 999 Görsel Kelime) görünür */}
            {showSmartContentTypeSelector && (
              <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1.5 border border-[#E6D7BE] dark:border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <span className="text-[11px] font-extrabold text-[var(--muted)] px-1.5 whitespace-nowrap">
                  Çalışma Türü:
                </span>
                {rangePreset === "visual_words" ? (
                  <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto sm:min-w-[340px]">
                    {(
                      [
                        {
                          id: "words",
                          label: `🖼️ Kelimeler (${filteredVisualWordsPool.length})`,
                        },
                        {
                          id: "sentences",
                          label: `💬 Örnek Cümleler (${filteredVisualWordsPool.filter((w) => Boolean(w.ornek_ar)).length})`,
                        },
                      ] as { id: QuizContentType; label: string }[]
                    ).map((item) => {
                      const active = effectiveContentType === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            playClick();
                            setContentType(item.id);
                          }}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
                            active
                              ? "bg-[#6741D9] text-white font-extrabold shadow-2xs"
                              : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:min-w-[340px]">
                    {(
                      [
                        { id: "words", label: "🔤 Kelimeler" },
                        { id: "sentences", label: "💬 Cümleler" },
                        { id: "mixed", label: "🔀 Karışık" },
                      ] as { id: QuizContentType; label: string }[]
                    ).map((item) => {
                      const active = effectiveContentType === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            playClick();
                            setContentType(item.id);
                          }}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
                            active
                              ? "bg-[#6741D9] text-white font-extrabold shadow-2xs"
                              : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tek Kompakt Filtre ve Ayar Barı: Kategori/Konu + Seviye + Soru/Süre/Sonuç + Başlat Butonu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-1.5 sm:gap-2">
              {/* 1. Dinamik Alt Filtre (Sadece 120 Diyalog, 60 Metin, 999 Görsel Kelime, 1111 Cümle veya 508 Atasözü seçiliyse görünür) */}
              {rangePreset === "all_dialogues" && (
                <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 h-9 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0 lg:min-w-[220px]">
                  <FolderOpen
                    size={13}
                    className="text-[#6741D9] shrink-0"
                  />
                  <span className="text-[11px] font-bold text-[var(--muted)] whitespace-nowrap">
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
                <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 h-9 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0 lg:min-w-[220px]">
                  <FolderOpen
                    size={13}
                    className="text-[#6741D9] shrink-0"
                  />
                  <span className="text-[11px] font-bold text-[var(--muted)] whitespace-nowrap">
                    Metin:
                  </span>
                  <select
                    value={singleReadingId}
                    onChange={(e) => {
                      playClick();
                      setSingleReadingId(e.target.value);
                    }}
                    aria-label="Okuma Metni Seçimi"
                    className="bg-transparent text-xs font-extrabold text-[var(--foreground)] focus:outline-none cursor-pointer w-full truncate"
                  >
                    <option value="all">
                      Tüm Okuma Metinleri ({metinler.length})
                    </option>
                    {metinler.map((m, idx) => {
                      const num = String(m.sira || idx + 1).padStart(2, "0");
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
                <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 h-9 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0 lg:min-w-[220px]">
                  <FolderOpen
                    size={13}
                    className="text-[#6741D9] shrink-0"
                  />
                  <span className="text-[11px] font-bold text-[var(--muted)] whitespace-nowrap">
                    Kategori:
                  </span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      playClick();
                      setCategoryFilter(e.target.value);
                    }}
                    aria-label="Kategori Seçimi"
                    className="bg-transparent text-xs font-extrabold text-[var(--foreground)] focus:outline-none cursor-pointer w-full truncate"
                  >
                    <option value="all">
                      Tüm Kategoriler ({activeModuleCategories.length} kategori)
                    </option>
                    {activeModuleCategories.map((cat) => (
                      <option key={cat.category} value={cat.category}>
                        {cat.label} ({cat.count})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Kural C: 📚 Tüm Sözlük Seçildiğinde Kelime Türü Filtresi ([Tümü] [İsimler] [Fiiller] [Edat & Kalıplar]) */}
              {rangePreset === "full_dict" && !isSentencesOnlyMode && (
                <div className="sm:col-span-2 lg:col-span-1 bg-white dark:bg-[var(--background)] rounded-xl p-1 h-auto border border-[#E6D7BE] dark:border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-1">
                  <span className="text-[11px] font-bold text-[var(--muted)] px-1.5 whitespace-nowrap">
                    Kelime Türü:
                  </span>
                  <div className="grid grid-cols-2 sm:flex items-center gap-1 w-full sm:w-auto">
                    {(
                      [
                        { id: "all", label: "Tümü" },
                        { id: "isim", label: "İsimler" },
                        { id: "fiil", label: "Fiiller" },
                        { id: "edat", label: "Edat & Kalıplar" },
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
                            setWordPosFilter(posItem.id);
                          }}
                          className={`px-2 py-1 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
                            active
                              ? "bg-[#6741D9] text-white font-bold shadow-2xs"
                              : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                          }`}
                        >
                          {posItem.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. CEFR Seviye Filtresi (Tüm Seviyeler | A1 | A2 | B1 | B2) */}
              <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 h-9 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-bold text-[var(--muted)] whitespace-nowrap">
                  Seviye:
                </span>
                <select
                  value={cefrFilter}
                  onChange={(e) => {
                    playClick();
                    setCefrFilter(e.target.value as "all" | Level);
                  }}
                  aria-label="CEFR Seviye Filtresi"
                  className="bg-transparent text-xs font-extrabold text-[var(--foreground)] focus:outline-none cursor-pointer w-full truncate"
                >
                  <option value="all">Tüm Seviyeler (A1–B2)</option>
                  <option value="A1">Seviye A1 (Başlangıç)</option>
                  <option value="A2">Seviye A2 (Temel)</option>
                  <option value="B1">Seviye B1 (Orta)</option>
                  <option value="B2">Seviye B2 (İleri)</option>
                </select>
              </div>

              {/* Boşluk Doldurma Alt Mod Seçicisi */}
              {selectedType === "fill-in-blanks" && (
                <div className="sm:col-span-2 lg:col-span-1 py-1 px-1.5 bg-white dark:bg-[var(--background)] rounded-xl h-auto border border-[#E6D7BE] dark:border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-1">
                  <span className="text-[11px] font-bold text-[var(--muted)] px-1 whitespace-nowrap">
                    Mod:
                  </span>
                  <div className="grid grid-cols-2 sm:flex items-center gap-1 w-full sm:w-auto">
                    {(
                      [
                        { id: "choices", label: "🧩 Seçmeli / Sürükle" },
                        { id: "dictation", label: "🎧 Dinle & Yaz (İmla)" },
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
                          className={`px-2 py-1 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
                            active
                              ? "bg-[#6741D9] text-white font-bold shadow-2xs"
                              : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Değerlendirme Zamanı Seçicisi (⚡ Hemen | 🏁 Bitince) */}
              {selectedType !== "flashcard" && selectedType !== "visual-rosetta" && (
                <div className="sm:col-span-2 lg:col-span-1 bg-white dark:bg-[var(--background)] rounded-xl p-1 h-auto border border-[#E6D7BE] dark:border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-1">
                  <span className="text-[11px] font-bold text-[var(--muted)] px-1 whitespace-nowrap">
                    Sonuç:
                  </span>
                  <div className="grid grid-cols-2 sm:flex items-center gap-1 w-full sm:w-auto">
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
                          className={`px-2 py-1 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
                            active
                              ? "bg-[#087F5B] text-white font-bold shadow-2xs"
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

              {/* 4 & 5. Soru Sayısı (10 | 20 | 30) ve Süre (Süresiz | 60s | 30s) */}
              <div className="sm:col-span-2 lg:col-span-1 grid grid-cols-2 gap-1.5 w-full lg:w-auto">
                <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 h-8.5 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-[var(--muted)] px-1 whitespace-nowrap">
                    Soru:
                  </span>
                  {([10, 20, 30] as (10 | 20 | 30)[]).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        playClick();
                        setQuestionCount(cnt);
                      }}
                      className={`flex-1 px-2 py-0.5 text-xs tabular-nums rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                        questionCount === cnt
                          ? "bg-[#087F5B] text-white font-bold"
                          : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>

                <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 h-8.5 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-1">
                  <Timer
                    size={12}
                    className="text-[#6741D9] ml-1 shrink-0"
                  />
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
                      className={`flex-1 px-1.5 py-0.5 text-xs rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                        timeLimit === t.val
                          ? "bg-[#087F5B] text-white font-bold"
                          : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Sağ Uç / Mobil Tam Genişlik: Vurgulu [▶ Alıştırmayı Başlat (X Öğe)] Butonu (Tek ▶ ikonu) */}
              <button
                type="button"
                onClick={handleStartExercise}
                disabled={
                  isMistakesEmpty ||
                  (combinedVocabulary.length < 4 &&
                    sentenceCountInPool < 2 &&
                    idiomsPool.length < 1 &&
                    filteredVisualWordsPool.length < 4)
                }
                className="sm:col-span-2 lg:col-span-1 lg:ml-auto w-full lg:w-auto h-10 sm:h-9 px-4 bg-[#087F5B] hover:bg-[#065F46] disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm rounded-xl border-b-3 border-[#065F46] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Play size={14} fill="currentColor" className="shrink-0" />
                <span className="truncate">
                  Alıştırmayı Başlat ({activeItemCount.toLocaleString("tr-TR")} Öğe)
                </span>
              </button>
            </div>

            {/* Seçili Alıştırma Özeti Şeridi (Tek Satırlık Net Pedagojik Özet Rozeti) */}
            <div className="rounded-xl bg-white/90 dark:bg-[var(--background)] px-3 py-1.5 border border-[#E6D7BE] dark:border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs font-bold text-[var(--foreground)]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[#065F46] dark:text-emerald-400 font-extrabold">
                  🎯 Seçili:{" "}
                  {exerciseCards.find((c) => c.id === selectedType)?.title}
                </span>
                <span className="text-[var(--muted)]">•</span>
                <span>
                  Kaynak:{" "}
                  <strong className="text-[#6741D9] dark:text-indigo-300">
                    {poolOptions
                      .find((p) => p.id === rangePreset)
                      ?.title.replace(/^[^\s]+\s/, "") || "Tüm Sözlük"}{" "}
                    ({activePoolCountLabel})
                  </strong>
                </span>
                <span className="text-[var(--muted)]">•</span>
                <span>
                  Seviye:{" "}
                  <strong>
                    {cefrFilter === "all"
                      ? "Tüm Seviyeler"
                      : `Seviye ${cefrFilter}`}
                  </strong>
                </span>
                <span className="text-[var(--muted)]">•</span>
                <span>
                  <strong>{questionCount} Soru</strong> (
                  {timeLimit ? `${timeLimit}s Süreli` : "Süresiz"})
                </span>
              </div>
            </div>

            {isMistakesEmpty && (
              <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-xl px-3.5 py-2 border-2 border-[#087F5B]/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-extrabold text-[#065F46] dark:text-emerald-400">
                <div className="flex items-center gap-2 text-center sm:text-left">
                  <Check
                    size={15}
                    className="shrink-0 text-[#065F46] dark:text-emerald-400"
                  />
                  <span>
                    Harika! Şu an hata defterinizde zorlandığınız bir kelime
                    veya cümle bulunmuyor.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handlePoolSelectChange("full_dict")}
                  className="px-3 py-1 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  Tüm Sözlüğe Geç
                </button>
              </div>
            )}

            {!isMistakesEmpty &&
              rangePreset === "mistakes" &&
              mistakeIds.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl px-3 py-1.5 border border-amber-300 dark:border-amber-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                  <span>
                    ⚡ Akıllı Hata Defterinizde{" "}
                    <strong>{mistakeIds.length}</strong> öğe kayıtlı. Farklı
                    günlerde 3 kez ipucusuz doğru cevapladığınız (Kademe 3/5)
                    sorular uzun süreli hafızaya alınarak listeden otomatik
                    mezun edilir.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      clearMistakes();
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-400 text-[11px] font-extrabold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer shrink-0"
                  >
                    Defteri Temizle
                  </button>
                </div>
              )}

            {poolNotice && !isMistakesEmpty && (
              <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 py-1 border border-[#E6D7BE] flex items-center gap-1.5 text-[11px] font-semibold text-[#6741D9] dark:text-[#d0bfff]">
                <Info size={13} className="shrink-0" />
                <span className="truncate">{poolNotice}</span>
              </div>
            )}
          </section>
        </>
      ) : (
        /* AKTİF ALIŞTIRMA EKRANI */
        <div className="space-y-4">
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
              onClose={handleCloseExercise}
            />
          )}
          {selectedType === "multiple-choice" && (
            <MultipleChoice
              vocabulary={frozenPools?.vocabulary ?? combinedVocabulary}
              idioms={frozenPools?.idioms ?? idiomsPool}
              dialogues={frozenPools?.dialogues ?? selectedDialogues}
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
          {selectedType === "fill-in-blanks" && (
            <FillInBlanks
              dialogues={frozenPools?.dialogues ?? selectedDialogues}
              vocabulary={frozenPools?.vocabulary ?? combinedVocabulary}
              idioms={frozenPools?.idioms ?? idiomsPool}
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
        </div>
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