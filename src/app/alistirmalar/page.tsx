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
  Layers,
  Timer,
  ListOrdered,
  Image as ImageIcon,
  FolderOpen,
} from "lucide-react";
import { playClick } from "@/lib/sfxManager";
import {
  diyaloglar,
  metinler,
  sozluk,
  gorselKelimeler,
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
  generateFullDictionaryPool,
  generatePoolFromDialogues,
  generatePoolFromReadings,
  generatePoolFrom1111Sentences,
  generatePoolFromProverbs,
  generatePoolFromVisualWords,
  getModuleCategoryList,
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
        setCategoryFilter(catParam);
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
        if (
          resolvedMode === "sentence-builder" ||
          resolvedMode === "fill-in-blanks"
        ) {
          setContentType("sentences");
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

  const activeFullDictWordItems = useMemo(
    () => generateFullDictionaryPool({ level: cefrFilter }),
    [cefrFilter]
  );

  // Rosetta Görsel Eşleştirme için filtrelenmiş ResimliKelime[] havuzu
  const filteredVisualWordsPool: ResimliKelime[] = useMemo(() => {
    const allowedIds = new Set(activeVisualWordsWordItems.map((w) => w.id));
    const filtered = gorselKelimeler.filter((gk) => allowedIds.has(gk.id));
    return filtered.length >= 4 ? filtered : gorselKelimeler;
  }, [activeVisualWordsWordItems]);

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
        poolNotice: `🖼️ 999 Görsel Kelime havuzundan ${items.length} resimli ve örnek cümleli kelime seçildi.`,
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
        poolNotice: `🗣️ 1111 Günlük Kalıp Cümle havuzundan ${items.length} cümle seçildi.`,
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
        poolNotice: `📜 508 Atasözü & Hikmet havuzundan ${items.length} atasözü seçildi.`,
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
        poolNotice: `📖 60 Okuma Metni havuzundan ${effectiveTexts.length} metin, ${sentenceCountInPool} cümle ve ${list.length} kelime seçildi.`,
      };
    }

    if (rangePreset === "full_dict") {
      const filteredByLevel =
        cefrFilter === "all"
          ? nonProperSozluk
          : nonProperSozluk.filter((w) => w.cefr === cefrFilter);
      return {
        combinedVocabulary:
          filteredByLevel.length >= 4 ? filteredByLevel : nonProperSozluk,
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
      title: "Görsel Eşleştirme (Rosetta)",
      arabicBadge: "الصُّوَرُ وَالصَّوْت",
      subtitle:
        "999 kare görsel ve çift cinsiyetli sesle Rosetta Stone usulü eşleştirme",
      icon: ImageIcon,
    },
  ];

  // Hızlı Havuz Sekmeleri (Quick Pool Pills) ve Havuz Select Seçenekleri
  const poolOptions: {
    id: PoolSourceId;
    label: string;
    shortLabel: string;
  }[] = [
    {
      id: "full_dict",
      label: "📚 Tüm Sözlük (3.118 Kelime)",
      shortLabel: "📚 Tüm Sözlük (3.118)",
    },
    {
      id: "visual_words",
      label: "🖼️ 999 Görsel Kelime (Resimli & Örnekli)",
      shortLabel: "🖼️ 999 Görsel Kelime",
    },
    {
      id: "all_dialogues",
      label: "💬 120 Diyalog (Kelime & Cümleler)",
      shortLabel: "💬 120 Diyalog",
    },
    {
      id: "reading_texts",
      label: "📖 60 Okuma Metni (Cümle & Kelimeler)",
      shortLabel: "📖 60 Okuma Metni",
    },
    {
      id: "sentences_1111",
      label: "🗣️ 1111 Günlük Kalıp Cümle",
      shortLabel: "🗣️ 1111 Günlük Cümle",
    },
    {
      id: "proverbs_508",
      label: "📜 508 Arapça Atasözü & Hikmet",
      shortLabel: "📜 508 Atasözü",
    },
    {
      id: "srs_due",
      label: `⏰ Bugün Tekrar Edilecekler (SRS) (${dailyPackage.dueReviewPool.totalDueCount})`,
      shortLabel: `⏰ SRS Tekrar (${dailyPackage.dueReviewPool.totalDueCount})`,
    },
    {
      id: "mistakes",
      label: `⚡ Hata Defteri / Zorlandıklarım (${mistakeIds.length})`,
      shortLabel: `⚡ Hata Defteri (${mistakeIds.length})`,
    },
    {
      id: "favorites",
      label: `❤️ Favorilerim / Kaydedilenler (${favoriteWords.length})`,
      shortLabel: `❤️ Favorilerim (${favoriteWords.length})`,
    },
    {
      id: "weak-words",
      label: `🎯 Mahreç Tekrarı (${weakWords.length})`,
      shortLabel: `🎯 Mahreç (${weakWords.length})`,
    },
  ];

  const quickPoolPills = poolOptions.slice(0, 8);

  const isMistakesEmpty =
    rangePreset === "mistakes" && mistakeIds.length === 0;

  const handlePoolSelectChange = (presetId: PoolSourceId) => {
    playClick();
    setRangePreset(presetId);
    setCategoryFilter("all");
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
    playClick();
    if (
      combinedVocabulary.length < 4 &&
      sentenceCountInPool < 2 &&
      idiomsPool.length < 1
    )
      return;
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
  const effectiveContentType: QuizContentType = isSentencesOnlyMode
    ? "sentences"
    : contentType;

  // Seçili havuz, kategori, seviye ve alıştırma moduna göre gerçek zamanlı öğe sayısı
  const { activeItemCount, activePoolCountLabel } = useMemo(() => {
    if (selectedType === "visual-rosetta") {
      const cnt = activeVisualWordsWordItems.length || gorselKelimeler.length;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt} Görsel Kelime`,
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
        cefrFilter === "all" ? 3118 : activeFullDictWordItems.length;
      return {
        activeItemCount: cnt,
        activePoolCountLabel: `${cnt.toLocaleString("tr-TR")} Kelime`,
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
    activeVisualWordsWordItems,
    active1111SentencesWordItems,
    activeProverbsWordItems,
    activeReadingsWordItems,
    activeDialoguesWordItems,
    activeFullDictWordItems,
    sentenceCountInPool,
    combinedVocabulary.length,
    idiomsPool.length,
  ]);

  return (
    <div className="space-y-3 sm:space-y-4 pb-28 md:pb-8">
      {/* ÜST BAŞLIK */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {isPlaying ? (
            <button
              type="button"
              onClick={() => {
                playClick();
                handleCloseExercise();
              }}
              className="h-9 px-3 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center gap-1.5 text-xs font-extrabold text-[var(--foreground)] hover:bg-[#EFE3CE] cursor-pointer shrink-0"
            >
              <ChevronLeft size={16} />
              <span>Ayarlara Dön</span>
            </button>
          ) : (
            <Link
              href="/"
              onClick={() => playClick()}
              className="w-9 h-9 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center justify-center text-[var(--foreground)] hover:bg-[#EFE3CE] shrink-0"
              aria-label="Ana Sayfaya Dön"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </Link>
          )}

          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight leading-tight truncate">
              İnteraktif Alıştırma Merkezi
            </h1>
            <p className="text-[11px] sm:text-xs font-medium text-[var(--muted)] truncate">
              120 Diyalog • 60 Metin • 1111 Cümle • 508 Atasözü • 999 Görsel Kelime • 3118 Sözlük Kelimesi
            </p>
          </div>
        </div>

        <div
          data-tooltip="120 Diyalog • 60 Metin • 1111 Cümle • 508 Atasözü • 999 Görsel Kelime • 3118 Sözlük Kelimesi"
          data-tooltip-pos="bottom"
          data-tooltip-align="right"
          className="hidden sm:flex items-center gap-2 bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 rounded-xl px-3 py-1.5 text-xs font-extrabold text-[#065F46] dark:text-emerald-400 tabular-nums shrink-0"
        >
          <span>{activePoolCountLabel}</span>
          <Info size={13} className="opacity-75 shrink-0" />
        </div>
      </div>

      {!isPlaying ? (
        <>
          {/* 1. ÜSTTE 2 SÜTUNLU (MOBİL) / 6'LI (MASAÜSTÜ) KOMPAKT ALIŞTIRMA TÜRÜ SEÇİM IZGARASI */}
          <section aria-label="Alıştırma Türü Seçimi">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
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
                      if (
                        card.id === "sentence-builder" ||
                        card.id === "fill-in-blanks"
                      ) {
                        setContentType("sentences");
                      } else if (card.id === "visual-rosetta") {
                        setRangePreset("visual_words");
                        setContentType("words");
                      }
                    }}
                    className={`text-left p-2.5 sm:p-3 rounded-2xl border-2 border-b-4 transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9] -translate-y-0.5 shadow-xs"
                        : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#cbb692]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5 sm:mb-2 gap-1.5">
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 border-b-3 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-[#6741D9] border-[#5230B5] text-white"
                            : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[#065F46] dark:text-emerald-400"
                        }`}
                      >
                        <Icon size={16} strokeWidth={2.3} />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          lang="ar"
                          dir="rtl"
                          className="arabic text-sm font-bold text-[var(--muted)] opacity-75 leading-none"
                        >
                          {card.arabicBadge}
                        </span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[#6741D9] text-white flex items-center justify-center shrink-0">
                            <Check size={11} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </div>

                    <h2
                      className={`font-bold text-xs sm:text-base leading-snug w-full ${
                        isSelected
                          ? "text-[#4C28B5] dark:text-[#d0bfff]"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {card.title}
                    </h2>

                    <p className="hidden sm:block text-xs text-[var(--muted)] leading-snug line-clamp-2 mt-1">
                      {card.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. KOMPAKT AYAR PANELİ + TÜM EĞİTİM HAVUZLARI + BAŞLAT BUTONU */}
          <section className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-2.5 space-y-2.5">
            {/* Hızlı Havuz Sekmeleri (Quick Pool Pills — 8 Ana Veri Kaynağı) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1.5 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
              {quickPoolPills.map((pill) => {
                const isActive = rangePreset === pill.id;
                const activeStyle =
                  pill.id === "srs_due"
                    ? "bg-[#6741D9] border-[#5230B5] text-white shadow-2xs"
                    : pill.id === "mistakes"
                    ? "bg-amber-600 border-amber-700 text-white shadow-2xs"
                    : "bg-[#087F5B] border-[#065F46] text-white shadow-2xs";

                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => handlePoolSelectChange(pill.id)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? activeStyle
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                    }`}
                  >
                    <span>{pill.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Üst Ayar Satırı: Havuz Seçimi + Dinamik Alt Filtre (Kategori/Metin/Diyalog) + Seviye */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2">
              {/* 1. Kaynak Havuzu Select */}
              <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 h-10 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0 lg:min-w-[260px]">
                <Layers
                  size={14}
                  className="text-[#065F46] dark:text-emerald-400 shrink-0"
                />
                <span className="text-[11px] font-bold text-[var(--muted)] whitespace-nowrap">
                  Havuz:
                </span>
                <select
                  value={rangePreset}
                  onChange={(e) =>
                    handlePoolSelectChange(e.target.value as PoolSourceId)
                  }
                  aria-label="Kelime ve Cümle Havuzu Seçimi"
                  className="bg-transparent text-xs font-extrabold text-[var(--foreground)] focus:outline-none cursor-pointer w-full truncate"
                >
                  {poolOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Dinamik Alt Filtre (Diyalog / Okuma Metni / Kategori Seçimi) */}
              {rangePreset === "all_dialogues" && (
                <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 h-10 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0 lg:min-w-[240px]">
                  <FolderOpen
                    size={14}
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
                <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 h-10 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0 lg:min-w-[240px]">
                  <FolderOpen
                    size={14}
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
                <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 h-10 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0 lg:min-w-[240px]">
                  <FolderOpen
                    size={14}
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

              {/* 2.5. CEFR Seviye Filtresi (Tüm Seviyeler | A1 | A2 | B1 | B2) */}
              <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 h-10 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0">
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

              {/* 3. İçerik Türü (Soru Kaynağı: Kelimeler | Kalıp İfadeler | Cümleler | Karışık) */}
              <div className="sm:col-span-2 lg:col-span-1 bg-white dark:bg-[var(--background)] rounded-xl p-1.5 h-auto border border-[#E6D7BE] dark:border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-1.5 w-full lg:w-auto">
                <span className="text-[11px] font-bold text-[var(--muted)] px-1 whitespace-nowrap">
                  İçerik:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full">
                  {(
                    [
                      { id: "words", label: "🔤 Kelimeler" },
                      { id: "idioms", label: "✨ Atasözü / Kalıp" },
                      {
                        id: "sentences",
                        label: "💬 Cümleler",
                      },
                      { id: "mixed", label: "🔀 Karışık" },
                    ] as { id: QuizContentType; label: string }[]
                  ).map((item) => {
                    const active = effectiveContentType === item.id;
                    const isDisabled =
                      isSentencesOnlyMode && item.id !== "sentences";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={isDisabled}
                        data-tooltip={
                          isDisabled
                            ? "Bu mod otomatik olarak cümle/atasözü/örnek cümle içeren öğeleri süzer"
                            : undefined
                        }
                        data-tooltip-pos="top"
                        onClick={() => {
                          if (isDisabled) return;
                          playClick();
                          setContentType(item.id);
                        }}
                        className={`px-2.5 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap text-center ${
                          active
                            ? "bg-[#6741D9] text-white font-bold shadow-2xs cursor-pointer"
                            : isDisabled
                            ? "text-[var(--muted)] opacity-45 cursor-not-allowed"
                            : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)] cursor-pointer"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Boşluk Doldurma Alt Mod Seçicisi */}
              {selectedType === "fill-in-blanks" && (
                <div className="sm:col-span-2 lg:col-span-1 py-1.5 px-1.5 bg-white dark:bg-[var(--background)] rounded-xl h-auto border border-[#E6D7BE] dark:border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-1.5">
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
                          className={`px-2 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
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

              {/* 4. Değerlendirme Zamanı Seçicisi (⚡ Hemen Göster | 🏁 Bitince Göster) */}
              {selectedType !== "flashcard" && (
                <div className="sm:col-span-2 lg:col-span-1 bg-white dark:bg-[var(--background)] rounded-xl p-1.5 h-auto border border-[#E6D7BE] dark:border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-1.5">
                  <span className="text-[11px] font-bold text-[var(--muted)] px-1 whitespace-nowrap">
                    Sonuçlar:
                  </span>
                  <div className="grid grid-cols-2 sm:flex items-center gap-1 w-full sm:w-auto">
                    {(
                      [
                        { id: "instant", label: "⚡ Hemen Göster" },
                        { id: "end", label: "🏁 Bitince Göster" },
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
                          className={`px-2 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap text-center cursor-pointer ${
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

              {/* 5 & 6. Soru Sayısı (10 | 20 | 30) ve Süre (Süresiz | 60s | 30s) */}
              <div className="sm:col-span-2 lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
                <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 h-9 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-[var(--muted)] px-1.5 whitespace-nowrap">
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
                      className={`flex-1 px-2.5 py-1 text-xs tabular-nums rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                        questionCount === cnt
                          ? "bg-[#087F5B] text-white font-bold"
                          : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)]"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>

                <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 h-9 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-1">
                  <Timer
                    size={13}
                    className="text-[#6741D9] ml-1.5 shrink-0"
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
                      className={`flex-1 px-2 py-1 text-xs rounded-lg transition-all whitespace-nowrap cursor-pointer ${
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

              {/* 7. Sağ Uç / Mobil Tam Genişlik: Vurgulu [▶ Alıştırmayı Başlat (X Öğe)] Butonu */}
              <button
                type="button"
                onClick={handleStartExercise}
                disabled={
                  isMistakesEmpty ||
                  (combinedVocabulary.length < 4 &&
                    sentenceCountInPool < 2 &&
                    idiomsPool.length < 1)
                }
                className="sm:col-span-2 lg:col-span-1 lg:ml-auto w-full lg:w-auto h-11 sm:h-10 px-5 bg-[#087F5B] hover:bg-[#065F46] disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm rounded-xl border-b-3 border-[#065F46] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Play size={15} fill="currentColor" />
                <span className="truncate">
                  ▶ Alıştırmayı Başlat ({activeItemCount.toLocaleString("tr-TR")} Öğe · {activePoolCountLabel})
                </span>
              </button>
            </div>

            {isMistakesEmpty && (
              <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-xl px-4 py-3 border-2 border-[#087F5B]/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-extrabold text-[#065F46] dark:text-emerald-400">
                <div className="flex items-center gap-2 text-center sm:text-left">
                  <Check
                    size={16}
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
                  className="px-3 py-1.5 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  Tüm Sözlüğe Geç
                </button>
              </div>
            )}

            {!isMistakesEmpty &&
              rangePreset === "mistakes" &&
              mistakeIds.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl px-3.5 py-2 border border-amber-300 dark:border-amber-700/60 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
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
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-400 text-[11px] font-extrabold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer shrink-0"
                  >
                    Defteri Temizle
                  </button>
                </div>
              )}

            {poolNotice && !isMistakesEmpty && (
              <div className="bg-white dark:bg-[var(--background)] rounded-xl px-3 py-1.5 border border-[#E6D7BE] flex items-center gap-2 text-xs font-semibold text-[#6741D9] dark:text-[#d0bfff]">
                <Info size={14} className="shrink-0" />
                <span>{poolNotice}</span>
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