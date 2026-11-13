"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  Printer,
  FileText,
  Columns2,
  Rows2,
  AlignJustify,
  Sparkles,
  BookOpen,
  Image as ImageIcon,
  Languages,
  QrCode,
  PenTool,
  Eye,
} from "lucide-react";
import { Dialogue, ReadingTextQuestion } from "@/types/data";
import { DialogueVocabularyEntry, getWordCategory } from "@/lib/dict";
import { extractDialogueIdioms } from "@/lib/arabicIdioms";
import { playClick, playSuccess } from "@/lib/sfxManager";
import {
  formatArabicText,
  removeArabicHarakat,
  getArabicFontConfig,
} from "@/lib/arabicTextUtils";
import { useSettings } from "@/store/settings";
import { generateQrSvg } from "@/lib/qrCode";
import {
  buildInfoGapPairCards,
  PAIR_SPEAKING_RUBRIC_CRITERIA,
} from "@/lib/infoGapBuilder";
import {
  STUDIO_DEFAULT_PAPER_TITLE,
  STUDIO_MATERIAL_SOURCES,
  StudioLevelFilter,
  StudioSourceId,
  SixSectionExamCounts,
  buildSixSectionExamData,
  clampExamCounts,
  inferInitialStudioSelection,
  listStudioPackOptions,
  resolveStudioMaterialBundle,
} from "@/lib/a4ExamStudioEngine";
export { allocateExam100PointsSixSections } from "@/lib/pdfDeterministicUtils";

interface DialoguePdfModalProps {
  dialogue: Dialogue;
  vocabEntries: DialogueVocabularyEntry[];
  imagePath: string;
  rawNum: number;
  readingQuestions?: ReadingTextQuestion[];
  initialDocMode?: PdfDocMode;
  onClose: () => void;
}

type ImagePrintMode = "hide" | "compact" | "banner";
type TranslationPrintMode = "show" | "hide" | "dotted" | "ar-dotted";
type TranslationLayout = "side-by-side" | "stacked" | "grouped-end";
type SideBySideOrder = "ar-right" | "ar-left";
type VocabPlacement = "same-page" | "new-page";
type VocabLanguageMode = "both" | "ar-only" | "tr-only";
type FitMode = "auto" | "normal" | "compact" | "ultra";
type DensityLevel = "normal" | "compact" | "tight" | "ultra";

export type PdfPrintScope = "student" | "answer-key" | "both";
export type PdfDocMode =
  | "handout"
  | "quiz-sheet"
  | "unvocalized-rubric"
  | "flashcards"
  | "pair-infogap";

export function escapeHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function hashStringSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function allocateExam100Points(
  countA: number,
  countB: number,
  countC: number
): {
  perQuestionA: number[];
  perQuestionB: number[];
  perQuestionC: number[];
  totalA: number;
  totalB: number;
  totalC: number;
  grandTotal: number;
} {
  const cA = Math.max(0, Math.floor(countA));
  const cB = Math.max(0, Math.floor(countB));
  const cC = Math.max(0, Math.floor(countC));
  if (cA + cB + cC === 0) {
    return {
      perQuestionA: [],
      perQuestionB: [],
      perQuestionC: [],
      totalA: 0,
      totalB: 0,
      totalC: 0,
      grandTotal: 0,
    };
  }

  const rawWeights = [cA > 0 ? 30 : 0, cB > 0 ? 40 : 0, cC > 0 ? 30 : 0];
  const weightSum = rawWeights[0] + rawWeights[1] + rawWeights[2];
  const exactShares = rawWeights.map((w) => (100 * w) / weightSum);
  const sectionTotals = exactShares.map((s) => Math.floor(s));
  let sectionRem =
    100 - (sectionTotals[0] + sectionTotals[1] + sectionTotals[2]);

  const orderByFrac = [0, 1, 2]
    .filter((idx) => rawWeights[idx] > 0)
    .sort(
      (i, j) =>
        exactShares[j] - sectionTotals[j] - (exactShares[i] - sectionTotals[i])
    );

  let cursor = 0;
  while (sectionRem > 0 && orderByFrac.length > 0) {
    const targetIdx = orderByFrac[cursor % orderByFrac.length];
    sectionTotals[targetIdx] += 1;
    sectionRem -= 1;
    cursor += 1;
  }

  const splitIntoIntegers = (sectionTotal: number, count: number): number[] => {
    if (count <= 0 || sectionTotal <= 0) return [];
    const base = Math.floor(sectionTotal / count);
    const rem = sectionTotal % count;
    return Array.from({ length: count }, (_, idx) =>
      idx < rem ? base + 1 : base
    );
  };

  const perQuestionA = splitIntoIntegers(sectionTotals[0], cA);
  const perQuestionB = splitIntoIntegers(sectionTotals[1], cB);
  const perQuestionC = splitIntoIntegers(sectionTotals[2], cC);

  const totalA = perQuestionA.reduce((s, n) => s + n, 0);
  const totalB = perQuestionB.reduce((s, n) => s + n, 0);
  const totalC = perQuestionC.reduce((s, n) => s + n, 0);

  return {
    perQuestionA,
    perQuestionB,
    perQuestionC,
    totalA,
    totalB,
    totalC,
    grandTotal: totalA + totalB + totalC,
  };
}

export const MAARIF_RUBRIC_CRITERIA = [
  {
    skillTr: "1. Dinleme / Anlama",
    skillAr: "الِاسْتِمَاعُ وَالْفَهْمُ",
    developing: "Ana fikri kısmen yakalar (0–10p)",
    proficient: "Bağlamı ve temel yargıları anlar (11–18p)",
    advanced: "Nüansları ve kalıp ifadeleri tam çözer (19–25p)",
    maxPoints: 25,
  },
  {
    skillTr: "2. Konuşma & Mahreç",
    skillAr: "الْمُحَادَثَةُ وَمَخَارِجُ الْحُرُوفِ",
    developing: "Belirgin mahreç/akıcılık hatası var (0–10p)",
    proficient: "Anlaşılır telaffuz ve doğru vurgu (11–18p)",
    advanced: "Sahih mahreç, med ve doğal tonlama (19–25p)",
    maxPoints: 25,
  },
  {
    skillTr: "3. Okuma & Harekeleme",
    skillAr: "الْقِرَاءَةُ وَالضَّبْطُ بِالشَّكْلِ",
    developing: "Temel kelime harekelerinde eksikler var (0–10p)",
    proficient: "Bina ve kelime içi harekeleri doğru koyar (11–18p)",
    advanced: "Son harf i'rab harekelerini eksiksiz zabteder (19–25p)",
    maxPoints: 25,
  },
  {
    skillTr: "4. Yazma, İmla & İ'rab",
    skillAr: "الْكِتَابَةُ وَالْإِعْرَابُ الْوَظِيفِيُّ",
    developing: "Harf birleştirme/hemze hataları görülür (0–10p)",
    proficient: "Doğru imla ve anlaşılır Türkçe tercüme (11–18p)",
    advanced: "Kurallı imla, tam tercüme ve doğru i'rab tahlili (19–25p)",
    maxPoints: 25,
  },
] as const;

export function stripHarakat(text: string): string {
  return removeArabicHarakat(text);
}

/**
 * Arapça kelimeyi noktalama ve harekelerden arındırarak normalize eder
 * (Boşluk doldurma eşleştirmesi için)
 */
function normalizeArabicToken(word: string): string {
  return removeArabicHarakat(word)
    .replace(/[.,!?؟،؛:"'«»()[\]\-—]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

/**
 * Diyalog ID'sini kontrol ederek her zaman standart iki haneli
 * https://app.muallimun.net/diyalog/dlg_XX ve app.muallimun.net/diyalog/dlg_XX
 * adreslerini üretir.
 */
export function buildDialogueQrUrl(
  id: string | number,
  fallbackRawNum?: number
): {
  dialogueUrl: string;
  shortDisplayUrl: string;
  normalizedSlug: string;
} {
  const rawStr = String(id ?? "").trim();
  const digitsMatch = rawStr.match(/\d+/);
  const num = digitsMatch
    ? parseInt(digitsMatch[0], 10)
    : fallbackRawNum || 1;
  if (rawStr.startsWith("kutuphane_")) {
    return {
      dialogueUrl: `https://app.muallimun.net/kutuphane`,
      shortDisplayUrl: `app.muallimun.net/kutuphane`,
      normalizedSlug: rawStr,
    };
  }
  if (rawStr.startsWith("metin_")) {
    const padded = String(Math.max(1, num)).padStart(2, "0");
    const normalizedSlug = `metin_${padded}`;
    return {
      dialogueUrl: `https://app.muallimun.net/metin/${normalizedSlug}`,
      shortDisplayUrl: `app.muallimun.net/metin/${normalizedSlug}`,
      normalizedSlug,
    };
  }
  const padded = String(Math.max(1, num)).padStart(3, "0");
  const normalizedSlug = `dlg_${padded}`;

  return {
    dialogueUrl: `https://app.muallimun.net/diyalog/${normalizedSlug}`,
    shortDisplayUrl: `app.muallimun.net/diyalog/${normalizedSlug}`,
    normalizedSlug,
  };
}

/**
 * ISO/IEC 18004 Standartlarına %100 Uyumlu Otomatik Sürümlü (V1–V15) Taranabilir QR Kod
 * URL metnini kesmeden tam uzunlukta kodlar.
 */
function generateQrSvgMarkup(urlText: string, size = 64): string {
  return generateQrSvg(urlText, size, { borderRadiusPx: 8, quietZone: 2 });
}

export default function DialoguePdfModal({
  dialogue: initialDialogue,
  vocabEntries: initialVocabEntries,
  imagePath: initialImagePath,
  rawNum: initialRawNum,
  readingQuestions: initialReadingQuestions,
  initialDocMode,
  onClose,
}: DialoguePdfModalProps) {
  const { arabicFont } = useSettings();
  const fontConfig = getArabicFontConfig(arabicFont);

  // STÜDYO KAYNAK, SEVİYE, PAKET VE KAĞIT BAŞLIĞI DURUMLARI
  const initialSelection = useMemo(
    () => inferInitialStudioSelection(initialDialogue),
    [initialDialogue]
  );
  const [studioSourceId, setStudioSourceId] = useState<StudioSourceId>(
    initialSelection.sourceId
  );
  const [studioLevelFilter, setStudioLevelFilter] = useState<StudioLevelFilter>(
    initialSelection.levelFilter
  );
  const [studioPackId, setStudioPackId] = useState<string>(
    initialSelection.packId
  );
  const [customPaperTitle, setCustomPaperTitle] = useState<string>("");

  // 6 ÖZELLEŞTİRİLEBİLİR YAZILI SINAV BÖLÜM SAYILARI (0 girilen bölüm otomatik gizlenir)
  const [examCounts, setExamCounts] = useState<SixSectionExamCounts>({
    sec1ArToTr: 5,
    sec2TrToAr: 5,
    sec3FillBlank: 5,
    sec4MultipleChoice: 4,
    sec5Matching: 5,
    sec6Morphology: 4,
  });
  const [includeTopicSummary, setIncludeTopicSummary] = useState<boolean>(true);

  const studioPackOptions = useMemo(
    () =>
      listStudioPackOptions(
        studioSourceId,
        studioLevelFilter,
        initialDialogue
      ),
    [studioSourceId, studioLevelFilter, initialDialogue]
  );

  const effectiveStudioPackId = useMemo(() => {
    if (studioPackOptions.some((o) => o.id === studioPackId)) {
      return studioPackId;
    }
    return studioPackOptions[0]?.id || initialSelection.packId;
  }, [studioPackOptions, studioPackId, initialSelection.packId]);

  const studioBundle = useMemo(
    () =>
      resolveStudioMaterialBundle({
        sourceId: studioSourceId,
        levelFilter: studioLevelFilter,
        packId: effectiveStudioPackId,
        initialProps: {
          dialogue: initialDialogue,
          vocabEntries: initialVocabEntries,
          imagePath: initialImagePath,
          rawNum: initialRawNum,
          readingQuestions: initialReadingQuestions,
        },
      }),
    [
      studioSourceId,
      studioLevelFilter,
      effectiveStudioPackId,
      initialDialogue,
      initialVocabEntries,
      initialImagePath,
      initialRawNum,
      initialReadingQuestions,
    ]
  );

  const dialogue = studioBundle.dialogue;
  const vocabEntries = studioBundle.vocabEntries;
  const imagePath = studioBundle.imagePath;
  const rawNum = studioBundle.rawNum;
  const readingQuestions =
    studioBundle.readingQuestions.length > 0
      ? studioBundle.readingQuestions
      : initialReadingQuestions;

  // BÖLÜM 2: Seçim Çipleri / Segmented Controls State'leri
  // PDF-1: Görsel Modu ("Gizle" | "Kompakt Kart (Varsayılan)" | "Geniş Banner")
  const [imageMode, setImageMode] = useState<ImagePrintMode>("compact");
  const [imgError, setImgError] = useState<boolean>(false);

  // PDF-2: Çeviri Görünüm Modu ("Göster (Varsayılan)" | "Gizle" | "Yazı Alanı (Noktalı)")
  const [translationMode, setTranslationMode] =
    useState<TranslationPrintMode>("show");

  // PDF-3: Boşluk Doldurma (Etkinlik) Modu (Varsayılan: Kapalı)
  const [clozeMode, setClozeMode] = useState<boolean>(false);

  // PDF-4: Harekeler (Varsayılan: Açık)
  const [includeHarakat, setIncludeHarakat] = useState<boolean>(true);

  // PDF-5: Dinleme QR Kodu (Varsayılan: Açık)
  const [includeQrCode, setIncludeQrCode] = useState<boolean>(true);

  // Ek Sözlük, Kalıp İfadeler & Mizanpaj Ayarları
  const idioms = useMemo(
    () => extractDialogueIdioms(dialogue.satirlar),
    [dialogue.satirlar]
  );
  const dialogueIdioms = idioms;
  const [includeVocabulary, setIncludeVocabulary] = useState<boolean>(true);
  const [includeIdioms, setIncludeIdioms] = useState<boolean>(true);
  const [idiomsBlankMode, setIdiomsBlankMode] = useState<boolean>(false);
  const [includeWorksheet, setIncludeWorksheet] = useState<boolean>(false);
  const [includeStudentHeader, setIncludeStudentHeader] =
    useState<boolean>(false);
  const [includeAnswerKey, setIncludeAnswerKey] = useState<boolean>(true);
  const [mobileTab, setMobileTab] = useState<"settings" | "preview">("settings");
  const [vocabPlacement, setVocabPlacement] =
    useState<VocabPlacement>("same-page");
  const [vocabLanguageMode, setVocabLanguageMode] =
    useState<VocabLanguageMode>("both");
  const [translationLayout, setTranslationLayout] =
    useState<TranslationLayout>("side-by-side");
  const [translationPageBreak, setTranslationPageBreak] = useState<
    "same" | "new"
  >("same");
  const [sideBySideOrder, setSideBySideOrder] =
    useState<SideBySideOrder>("ar-right");
  const [showAdvancedLayout, setShowAdvancedLayout] = useState<boolean>(false);

  // ADIM 3: Üst Mod Seçici (5 Öğretmen Şablonu) + A/B Kitapçık Grubu + Gelişmiş Ayar Çekmecesi
  const [pdfDocMode, setPdfDocMode] = useState<PdfDocMode>(
    initialDocMode ?? "handout"
  );
  const [bookletGroup, setBookletGroup] = useState<"A" | "B">("A");
  const [showAdvancedSettings, setShowAdvancedSettings] =
    useState<boolean>(false);
  const [flashcardGridSize, setFlashcardGridSize] = useState<
    "3x3" | "3x4" | "4x4"
  >("3x3");

  const sixSectionExamData = useMemo(
    () =>
      buildSixSectionExamData({
        bundle: studioBundle,
        counts: examCounts,
        bookletGroup,
      }),
    [studioBundle, examCounts, bookletGroup]
  );

  const effectivePaperTitleTr = useMemo(() => {
    const trimmed = customPaperTitle.trim();
    if (trimmed) return trimmed;
    if (pdfDocMode === "quiz-sheet") {
      return `${STUDIO_DEFAULT_PAPER_TITLE} — ${dialogue.baslik_tr}`;
    }
    return dialogue.baslik_tr;
  }, [customPaperTitle, pdfDocMode, dialogue.baslik_tr]);

  const infoGapDeck = useMemo(
    () => buildInfoGapPairCards(dialogue, vocabEntries),
    [dialogue, vocabEntries]
  );

  const applyTeacherPreset = (
    preset:
      | "student-handout"
      | "exam-ab"
      | "unvocalized-rubric"
      | "cut-fold-cards"
      | "pair-infogap"
  ) => {
    playClick();
    if (preset === "student-handout") {
      setPdfDocMode("handout");
      setIncludeHarakat(true);
      setTranslationMode("show");
      setClozeMode(false);
      setIncludeVocabulary(true);
      setVocabLanguageMode("both");
      setIdiomsBlankMode(false);
      setIncludeWorksheet(false);
      setIncludeQrCode(true);
      setIncludeStudentHeader(false);
      setIncludeAnswerKey(false);
    } else if (preset === "exam-ab") {
      setPdfDocMode("quiz-sheet");
      setIncludeHarakat(true);
      setIncludeStudentHeader(true);
      setIncludeAnswerKey(true);
    } else if (preset === "unvocalized-rubric") {
      setPdfDocMode("unvocalized-rubric");
      setIncludeHarakat(false);
      setIncludeStudentHeader(true);
      setIncludeAnswerKey(true);
    } else if (preset === "cut-fold-cards") {
      setPdfDocMode("flashcards");
      setIncludeHarakat(true);
      setTranslationMode("show");
      setVocabLanguageMode("both");
      setClozeMode(false);
      setIncludeStudentHeader(false);
      setIncludeAnswerKey(false);
    } else if (preset === "pair-infogap") {
      setPdfDocMode("pair-infogap");
      setIncludeHarakat(true);
      setImageMode("hide");
      setIncludeQrCode(false);
      setIncludeStudentHeader(false);
      setIncludeAnswerKey(true);
    }
  };

  // Otomatik Sığdırma (Auto-Fit) Motoru State'leri
  const [fitMode, setFitMode] = useState<FitMode>("auto");
  const [activeDensity, setActiveDensity] = useState<DensityLevel>("normal");
  const a4PageRef = useRef<HTMLDivElement | null>(null);
  const targetMaxHeightRef = useRef<number>(950);

  const hasAnyBlankActivity =
    pdfDocMode === "quiz-sheet" ||
    pdfDocMode === "unvocalized-rubric" ||
    pdfDocMode === "pair-infogap" ||
    clozeMode ||
    translationMode === "dotted" ||
    translationMode === "ar-dotted" ||
    (includeVocabulary &&
      vocabEntries.length > 0 &&
      vocabLanguageMode !== "both") ||
    (includeIdioms && idioms.length > 0 && idiomsBlankMode) ||
    (includeVocabulary && includeWorksheet);

  // Herhangi bir çalışma kağıdı / boşluk modu veya Quiz Yaprağı seçildiğinde Öğrenci Bilgi Şeridi ve Cevap Anahtarını otomatik aktif et
  useEffect(() => {
    if (hasAnyBlankActivity) {
      const raf = requestAnimationFrame(() => {
        if (pdfDocMode !== "flashcards" && pdfDocMode !== "pair-infogap") {
          setIncludeStudentHeader(true);
        }
        setIncludeAnswerKey(true);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [hasAnyBlankActivity, pdfDocMode]);

  // İçerik veya mizanpaj ayarları değiştiğinde fitMode'a göre başlangıç yoğunluğunu belirle
  useEffect(() => {
    const nextDensity: DensityLevel =
      fitMode === "compact"
        ? "tight"
        : fitMode === "ultra"
        ? "ultra"
        : "normal";
    const raf = requestAnimationFrame(() => {
      setActiveDensity(nextDensity);
    });
    return () => cancelAnimationFrame(raf);
  }, [
    fitMode,
    dialogue.id,
    pdfDocMode,
    bookletGroup,
    flashcardGridSize,
    imageMode,
    translationMode,
    clozeMode,
    includeHarakat,
    includeQrCode,
    includeVocabulary,
    includeIdioms,
    idiomsBlankMode,
    includeWorksheet,
    includeStudentHeader,
    includeAnswerKey,
    vocabPlacement,
    vocabLanguageMode,
    translationLayout,
    translationPageBreak,
    sideBySideOrder,
    arabicFont,
  ]);

  // Gerçek A4 Baskı Yüksekliği (950px / sayfa) Ölçümü ve Çok Adımlı Auto-Fit Algoritması
  useEffect(() => {
    if (fitMode !== "auto") return;
    const el = a4PageRef.current;
    if (!el) return;

    const PAGE_HEIGHT = 950;
    const evaluateOverflow = () => {
      const target = a4PageRef.current;
      if (!target) return;
      const rawScrollH = target.scrollHeight;
      const zoomFactor =
        activeDensity === "ultra"
          ? 0.92
          : activeDensity === "tight"
          ? 0.96
          : 1;
      const effectiveH = Math.round(rawScrollH * zoomFactor);

      if (activeDensity === "normal") {
        if (rawScrollH <= PAGE_HEIGHT) return;
        const remainder = rawScrollH % PAGE_HEIGHT;
        // 1 sayfa (950px) veya 2 sayfa (1900px) sınırını 1px ile 285px (1–8 satır) arasında aşıyorsa:
        if (remainder >= 1 && remainder <= 285) {
          targetMaxHeightRef.current =
            Math.floor(rawScrollH / PAGE_HEIGHT) * PAGE_HEIGHT;
          if (remainder <= 95) {
            setActiveDensity("compact");
          } else if (remainder <= 185) {
            setActiveDensity("tight");
          } else {
            setActiveDensity("ultra");
          }
        }
      } else if (activeDensity === "compact") {
        // Kademe uygulandıktan sonra hâlâ hedef sayfa sınırını aşıyorsa bir üst kademeye ("tight") yükselt
        const limit = targetMaxHeightRef.current || PAGE_HEIGHT;
        const remainder = effectiveH % PAGE_HEIGHT;
        if (
          effectiveH > limit &&
          remainder >= 1 &&
          remainder <= 285
        ) {
          setActiveDensity("tight");
        }
      } else if (activeDensity === "tight") {
        // "tight" seçildiği halde hâlâ 950px (veya 1900px) sınırını birkaç piksel aşıyorsa "ultra" kademesine yükselt
        const limit = targetMaxHeightRef.current || PAGE_HEIGHT;
        const remainder = effectiveH % PAGE_HEIGHT;
        if (
          effectiveH > limit &&
          remainder >= 1 &&
          remainder <= 285
        ) {
          setActiveDensity("ultra");
        }
      }
    };

    const rafId = requestAnimationFrame(evaluateOverflow);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        evaluateOverflow();
      });
      observer.observe(el);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
    };
  }, [fitMode, activeDensity, mobileTab]);

  const printIframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const formatAr = (text: string) =>
    formatArabicText(text, includeHarakat, arabicFont);

  // PDF-3: Diyalog cümleleri içinde vocabulary kelimelerini tespit edip boşluğa ("....................") dönüştüren motor
  const clozeData = useMemo(() => {
    // Sözlükteki hedef kelimeleri normalize edilmiş halleriyle hazırla
    const targetCandidates: { norm: string; display: string }[] = [];
    for (const entry of vocabEntries) {
      const w = entry.item;
      const forms = [w.mufret, w.mazi, w.muzari, w.cemi].filter(
        (f): f is string => Boolean(f && f !== "-" && f.trim().length > 1)
      );
      for (const f of forms) {
        const cleanForm = f.split(/[،,/]/)[0].trim();
        const norm = normalizeArabicToken(cleanForm);
        if (norm.length >= 2) {
          targetCandidates.push({ norm, display: cleanForm });
        }
      }
    }

    const usedWords: string[] = [];
    const usedNormSet = new Set<string>();
    const lineTargetWords: (string | null)[] = [];

    const processedLines = dialogue.satirlar.map((line) => {
      const tokens = line.arapca.split(/(\s+)/);
      let replacedInThisLine = false;
      let targetWordForLine: string | null = null;

      const updatedTokens = tokens.map((tok) => {
        if (replacedInThisLine || /^\s+$/.test(tok)) return tok;
        const tokNorm = normalizeArabicToken(tok);
        if (tokNorm.length < 2) return tok;

        const matched = targetCandidates.find(
          (cand) =>
            cand.norm === tokNorm ||
            tokNorm === `ال${cand.norm}` ||
            (cand.norm.length >= 3 &&
              tokNorm.length >= 3 &&
              (tokNorm.startsWith(cand.norm) || tokNorm.endsWith(cand.norm)))
        );

        if (matched && !usedNormSet.has(tokNorm)) {
          replacedInThisLine = true;
          usedNormSet.add(tokNorm);
          const cleanOriginalWord = tok
            .replace(/[.,!?؟،؛:"'«»()]/g, "")
            .trim();
          const trailingPunct = tok.slice(cleanOriginalWord.length);
          usedWords.push(cleanOriginalWord);
          targetWordForLine = cleanOriginalWord;
          return `....................${trailingPunct}`;
        }
        return tok;
      });

      if (!replacedInThisLine) {
        const wordIndices = tokens
          .map((t, idx) => ({ t, idx, norm: normalizeArabicToken(t) }))
          .filter((x) => !/^\s+$/.test(x.t) && x.norm.length > 3);

        if (wordIndices.length > 0 && usedWords.length < dialogue.satirlar.length) {
          const pick =
            wordIndices[Math.min(1, wordIndices.length - 1)];
          if (!usedNormSet.has(pick.norm)) {
            usedNormSet.add(pick.norm);
            const cleanOriginalWord = pick.t
              .replace(/[.,!?؟،؛:"'«»()]/g, "")
              .trim();
            const trailingPunct = pick.t.slice(cleanOriginalWord.length);
            usedWords.push(cleanOriginalWord);
            targetWordForLine = cleanOriginalWord;
            updatedTokens[pick.idx] = `....................${trailingPunct}`;
          }
        }
      }

      lineTargetWords.push(targetWordForLine);
      return clozeMode ? updatedTokens.join("") : line.arapca;
    });

    const shuffled = [...usedWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (i * 7 + 3) % (i + 1);
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }

    return {
      processedLines,
      helperWords: clozeMode ? shuffled : ([] as string[]),
      lineTargetWords,
    };
  }, [clozeMode, dialogue.satirlar, vocabEntries]);

  // ✂️ Kes-Yapıştır Kelime & Cümle Kartları Verisi (3x3 = 9 Kart, 3x4 = 12 Kart, 4x4 = 16 Kart)
  const flashcardItems = useMemo(() => {
    const targetCount =
      flashcardGridSize === "3x3"
        ? 9
        : flashcardGridSize === "3x4"
        ? 12
        : 16;

    const cards: Array<{
      id: string;
      arabic: string;
      turkish: string;
      kok?: string;
      morphInfo?: string;
      posLabel: string;
      imageUrl?: string;
    }> = [];

    for (const entry of vocabEntries) {
      if (cards.length >= targetCount) break;
      const w = entry.item;
      const mainAr = (w.mufret || w.mazi || entry.contextWord || "").trim();
      if (!mainAr) continue;
      const category = getWordCategory(w);
      const posLabel =
        category === "fiil" ? "Fiil" : category === "edat" ? "Edat" : "İsim";
      const rootClean =
        w.kok && w.kok !== "-" && w.kok.trim().length > 0
          ? w.kok.trim().split("").join(" ")
          : undefined;

      const morphParts: string[] = [];
      if (w.cemi && w.cemi !== "-") morphParts.push(`Çoğul: ${w.cemi}`);
      if (w.muzari && w.muzari !== "-") morphParts.push(`Muzâri: ${w.muzari}`);
      if (w.masdar && w.masdar !== "-") morphParts.push(`Masdar: ${w.masdar}`);

      cards.push({
        id: `fc-v-${cards.length}`,
        arabic: mainAr,
        turkish: w.anlam_tr,
        kok: rootClean,
        morphInfo: morphParts.slice(0, 2).join(" • ") || undefined,
        posLabel,
        imageUrl: w.gorsel || undefined,
      });
    }

    for (const line of dialogue.satirlar) {
      if (cards.length >= targetCount) break;
      cards.push({
        id: `fc-l-${line.sira}`,
        arabic: line.arapca,
        turkish: line.turkce,
        kok: undefined,
        morphInfo: line.konusmaci ? `Konuşmacı: ${line.konusmaci}` : undefined,
        posLabel: "Cümle",
        imageUrl: cards.length === 0 ? imagePath : undefined,
      });
    }

    return cards.slice(0, targetCount);
  }, [vocabEntries, dialogue.satirlar, flashcardGridSize, imagePath]);

  // 5 soruluk mini çalışma kağıdı (includeWorksheet === true ise sayfa sonuna eklenir)
  const miniWorksheetQuestions = useMemo(() => {
    const stripPunct = (w: string) =>
      w.replace(/[.,!?؟،؛:"'«»()]/g, "").trim();

    const items: {
      sira: number;
      blankSentence: string;
      answer: string;
      turkce: string;
    }[] = [];

    for (const line of dialogue.satirlar) {
      if (items.length >= 5) break;
      const words = line.arapca.split(/\s+/);
      const candidate =
        words.find((w) => stripPunct(w).length > 3) ||
        words.find((w) => stripPunct(w).length > 2);
      if (candidate) {
        const cleanAns = stripPunct(candidate);
        const blankSentence = line.arapca.replace(
          candidate,
          " ...................... "
        );
        items.push({
          sira: items.length + 1,
          blankSentence,
          answer: cleanAns,
          turkce: line.turkce,
        });
      }
    }
    return items;
  }, [dialogue]);

  // Aşama 2.3: Öğretmen İçin A/B Kitapçıklı 100 Puanlık Yazılı Sınav & Cevap Anahtarı Otomatik Üreticisi
  const a4QuizSheetData = useMemo(() => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const seedValue = hashStringSeed(
      `${dialogue.id}::BOOKLET_${bookletGroup}::v3`
    );
    const rng = mulberry32(seedValue);
    const formCode = `${bookletGroup}-${seedValue
      .toString(16)
      .toUpperCase()
      .padStart(4, "0")
      .slice(-4)}`;

    const rawVocab = vocabEntries.slice(0, 7);
    const baseMatchingSource =
      rawVocab.length >= 6
        ? rawVocab.map((v) => ({
            ar: (v.item.mufret || v.item.mazi || v.contextWord || "")
              .split("/")[0]
              .trim(),
            tr: v.item.anlam_tr,
          }))
        : [
            ...rawVocab.map((v) => ({
              ar: (v.item.mufret || v.item.mazi || v.contextWord || "")
                .split("/")[0]
                .trim(),
              tr: v.item.anlam_tr,
            })),
            ...dialogue.satirlar.slice(0, 6).map((l) => ({
              ar: l.arapca.split(/\s+/)[0] || l.arapca,
              tr: l.turkce.split(/\s+/).slice(0, 2).join(" "),
            })),
          ].slice(0, 6);

    const matchingSource = seededShuffle(baseMatchingSource, rng);
    let shuffledIndices = seededShuffle(
      matchingSource.map((_, i) => i),
      rng
    );
    if (
      shuffledIndices.length >= 2 &&
      shuffledIndices.every((val, idx) => val === idx)
    ) {
      shuffledIndices = [...shuffledIndices.slice(1), shuffledIndices[0]];
    }

    const baseSectionB = seededShuffle(miniWorksheetQuestions.slice(0, 5), rng);
    const wordBank = seededShuffle(
      baseSectionB.map((q) => q.answer),
      rng
    );

    const rawMultipleChoice: {
      typeLabel: string;
      arabicPrompt: string;
      questionTr: string;
      rawOpts: string[];
      correctText: string;
    }[] = [];

    const allLineTrs = dialogue.satirlar.map((l) => l.turkce);
    const idiomPool = dialogueIdioms.slice(0, 2);

    idiomPool.forEach((idm, idx) => {
      const distractors = [
        ...dialogueIdioms
          .filter((o) => o.id !== idm.id)
          .map((o) => o.meaningTr),
        ...allLineTrs.filter((t) => t !== idm.meaningTr),
        "Nasılsınız, iyi misiniz?",
        "Yarın görüşmek üzere.",
      ].slice(idx * 2, idx * 2 + 2);
      const rawOpts = Array.from(new Set([idm.meaningTr, ...distractors])).slice(
        0,
        3
      );
      rawMultipleChoice.push({
        typeLabel: "Kalıp İfade",
        arabicPrompt: idm.matchedPhrase || idm.arabic,
        questionTr: "Yukarıdaki kalıp ifadenin Türkçe anlamı hangisidir?",
        rawOpts,
        correctText: idm.meaningTr,
      });
    });

    if (readingQuestions && readingQuestions.length > 0) {
      readingQuestions.slice(0, 4).forEach((rq, rqIdx) => {
        if (rawMultipleChoice.length >= 4) return;
        const otherQs = readingQuestions
          .filter((_, i) => i !== rqIdx)
          .map((o) => `${o.cevap_ar} (${o.cevap_tr})`);
        const correctStr = `${rq.cevap_ar} (${rq.cevap_tr})`;
        const rawOpts = Array.from(
          new Set([
            correctStr,
            ...otherQs,
            "نَعَمْ، بِكُلِّ سُرُورٍ. (Evet, memnuniyetle.)",
            "فِي الصَّبَاحِ الْبَاكِرِ. (Sabah erkenden.)",
          ])
        ).slice(0, 3);
        rawMultipleChoice.push({
          typeLabel: "Okuduğunu Anlama",
          arabicPrompt: rq.soru_ar,
          questionTr: rq.soru_tr,
          rawOpts,
          correctText: correctStr,
        });
      });
    }

    for (
      let i = 0;
      i < dialogue.satirlar.length && rawMultipleChoice.length < 4;
      i++
    ) {
      const ln = dialogue.satirlar[i];
      const otherLines = dialogue.satirlar
        .filter((o) => o.sira !== ln.sira)
        .map((o) => o.turkce);
      const distractors = [
        otherLines[i % Math.max(1, otherLines.length)] ||
          "Memnun oldum, teşekkür ederim.",
        otherLines[(i + 2) % Math.max(1, otherLines.length)] ||
          "Evet, bugün hava çok güzel.",
      ];
      const rawOpts = Array.from(
        new Set([
          ln.turkce,
          ...distractors,
          "Affedersiniz, yardımcı olabilir misiniz?",
        ])
      ).slice(0, 3);
      rawMultipleChoice.push({
        typeLabel: `Metin Anlama (Cümle #${ln.sira})`,
        arabicPrompt: ln.arapca,
        questionTr: "Metinde geçen bu cümlenin doğru Türkçe çevirisi hangisidir?",
        rawOpts,
        correctText: ln.turkce,
      });
    }

    const shuffledMcItems = seededShuffle(rawMultipleChoice, rng);

    const pointsAllocation = allocateExam100Points(
      matchingSource.length,
      baseSectionB.length,
      shuffledMcItems.length
    );

    const sectionAMatching = matchingSource.map((item, idx) => {
      const rightMeaningIdx = shuffledIndices[idx];
      const correctLetterPos = shuffledIndices.indexOf(idx);
      const correctLetter = letters[correctLetterPos] || "A";
      return {
        num: idx + 1,
        points: pointsAllocation.perQuestionA[idx] ?? 0,
        arabic: item.ar,
        letter: letters[idx] || String(idx + 1),
        shuffledTr: matchingSource[rightMeaningIdx]?.tr || item.tr,
        correctLetter,
        correctTr: item.tr,
      };
    });

    const sectionBFillBlanks = baseSectionB.map((q, idx) => ({
      ...q,
      points: pointsAllocation.perQuestionB[idx] ?? 0,
    }));

    const optLetters = ["A", "B", "C", "D"];
    const sectionCMultipleChoice = shuffledMcItems.map((item, idx) => {
      const ordered = seededShuffle(item.rawOpts, rng);
      const cIdx = ordered.indexOf(item.correctText);
      return {
        num: idx + 1,
        points: pointsAllocation.perQuestionC[idx] ?? 0,
        typeLabel: item.typeLabel,
        arabicPrompt: item.arabicPrompt,
        questionTr: item.questionTr,
        options: ordered.map((t, oIdx) => ({
          letter: optLetters[oIdx] || "A",
          text: t,
        })),
        correctLetter: optLetters[cIdx >= 0 ? cIdx : 0],
        correctText: item.correctText,
      };
    });

    return {
      bookletGroup,
      formCode,
      pointsAllocation,
      sectionAMatching,
      sectionBFillBlanks,
      wordBank,
      sectionCMultipleChoice,
    };
  }, [
    vocabEntries,
    dialogue,
    miniWorksheetQuestions,
    dialogueIdioms,
    readingQuestions,
    bookletGroup,
  ]);

  const unvocalizedRubricItems = useMemo(() => {
    const selected = dialogue.satirlar.slice(0, 6);
    const count = selected.length;
    const basePts = count > 0 ? Math.floor(100 / count) : 0;
    const remPts = count > 0 ? 100 % count : 0;
    return selected.map((line, idx) => ({
      num: idx + 1,
      sira: line.sira,
      konusmaci: line.konusmaci,
      konusmaciAr: line.konusmaci_ar,
      unvocalizedAr: stripHarakat(line.arapca),
      vocalizedAr: line.arapca,
      turkce: line.turkce,
      points: idx < remPts ? basePts + 1 : basePts,
    }));
  }, [dialogue.satirlar]);

  const { dialogueUrl, shortDisplayUrl } = useMemo(
    () => buildDialogueQrUrl(dialogue.id, rawNum),
    [dialogue.id, rawNum]
  );

  const qrBoxPixelSize =
    activeDensity === "ultra"
      ? 56
      : activeDensity === "tight"
      ? 64
      : activeDensity === "compact"
      ? 80
      : 96;

  const qrSvgMarkup = useMemo(
    () => generateQrSvgMarkup(dialogueUrl, qrBoxPixelSize),
    [dialogueUrl, qrBoxPixelSize]
  );

  const effectiveImageMode: ImagePrintMode = imgError ? "hide" : imageMode;

  const handleGenerateAndPrintPdf = (printScope: PdfPrintScope = "student") => {
    playClick();
    playSuccess();

    const formatArHtml = (text: string) => escapeHtml(formatAr(text));
    const formatVocalizedArHtml = (text: string) =>
      escapeHtml(formatArabicText(text, true, arabicFont));

    const formattedDate = escapeHtml(
      new Date().toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    );

    const originStr =
      typeof window !== "undefined" ? window.location.origin : "";
    const absoluteImgUrl = escapeHtml(
      originStr ? `${originStr}${imagePath}` : imagePath
    );

    const speakers = Array.from(
      new Set(dialogue.satirlar.map((l) => l.konusmaci))
    );

    // Kelime Kutusu (الكلمات المساعدة) — Boşluk Doldurma Modu Aktifse
    const helperWordsBoxHtml =
      clozeMode && clozeData.helperWords.length > 0
        ? `
        <div class="helper-words-box">
          <div class="helper-words-header">
            <span>✏️ Kelime Kutusu (boşlukları aşağıdaki kelimelerle doldurunuz)</span>
            <span class="helper-words-ar-title" dir="rtl">الكلمات المساعدة</span>
          </div>
          <div class="helper-words-items" dir="rtl">
            ${clozeData.helperWords
              .map(
                (w) =>
                  `<span class="helper-word-chip">${formatArHtml(w)}</span>`
              )
              .join("")}
          </div>
        </div>
      `
        : "";

    // Türkçe hücresi veya noktalı yazı alanı üretici
    const renderTrContentHtml = (
      line: Dialogue["satirlar"][0],
      badgeCls: string
    ) => {
      if (translationMode === "dotted") {
        return `
          <div class="tr-dotted-wrap">
            <span class="speaker-tr ${badgeCls}">${escapeHtml(line.konusmaci)}:</span>
            <div class="tr-dotted-line">........................................................................</div>
          </div>
        `;
      }
      return `
        <span class="speaker-tr ${badgeCls}">${escapeHtml(line.konusmaci)}</span>
        <span class="tr-text">${escapeHtml(line.turkce)}</span>
      `;
    };

    // Arapça hücresi veya geniş/yüksek noktalı yazım kutusu üretici
    const renderArContentHtml = (
      line: Dialogue["satirlar"][0],
      badgeCls: string,
      arLineText: string,
      numbered?: boolean
    ) => {
      const speakerLabel = numbered
        ? `${line.sira}. ${formatArHtml(line.konusmaci_ar)}`
        : formatArHtml(line.konusmaci_ar);
      if (translationMode === "ar-dotted") {
        return `
          <div class="ar-dotted-wrap" dir="rtl">
            <span class="speaker-ar ${badgeCls}">${speakerLabel}</span>
            <div class="ar-dotted-box">................................................................................</div>
          </div>
        `;
      }
      return `
        <span class="speaker-ar ${badgeCls}">${speakerLabel}</span>
        <span class="ar-text">${formatArHtml(arLineText)}</span>
      `;
    };

    // Cümle satırları HTML üretimi
    let dialogueBodyHtml = "";

    if (translationMode === "hide") {
      dialogueBodyHtml = `
        <div class="lines-container">
          ${dialogue.satirlar
            .map((line, idx) => {
              const spIdx = speakers.indexOf(line.konusmaci);
              const badgeCls =
                spIdx % 2 === 0 ? "sp-badge-emerald" : "sp-badge-indigo";
              const rowBg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
              const arLineText = clozeData.processedLines[idx] || line.arapca;
              return `
                <div class="line-row single-ar" style="background: ${rowBg};">
                  <div class="ar-col" dir="rtl">
                    ${renderArContentHtml(line, badgeCls, arLineText)}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    } else if (translationLayout === "side-by-side") {
      const isArRight = sideBySideOrder === "ar-right";
      const trHeaderTitle =
        translationMode === "dotted"
          ? "Türkçe Tercüme (Yazı Alanı)"
          : "Türkçe Tercüme";
      const arHeaderTitle =
        translationMode === "ar-dotted"
          ? "النَّصُّ الْعَرَبِيُّ (Arapça Yazım Alanı)"
          : "النَّصُّ الْعَرَبِيُّ (Arapça Metin)";

      dialogueBodyHtml = `
        <table class="two-col-table" dir="ltr">
          <thead>
            <tr>
              ${
                isArRight
                  ? `
                <th style="width: 50%; text-align: left;" dir="ltr">${trHeaderTitle}</th>
                <th style="width: 50%; text-align: right;" dir="rtl">${arHeaderTitle}</th>
              `
                  : `
                <th style="width: 50%; text-align: right;" dir="rtl">${arHeaderTitle}</th>
                <th style="width: 50%; text-align: left;" dir="ltr">${trHeaderTitle}</th>
              `
              }
            </tr>
          </thead>
          <tbody>
            ${dialogue.satirlar
              .map((line, idx) => {
                const spIdx = speakers.indexOf(line.konusmaci);
                const badgeCls =
                  spIdx % 2 === 0 ? "sp-badge-emerald" : "sp-badge-indigo";
                const rowBg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
                const arLineText = clozeData.processedLines[idx] || line.arapca;

                const arCellHtml = `
                  <td class="ar-cell" dir="rtl">
                    ${renderArContentHtml(line, badgeCls, arLineText)}
                  </td>
                `;
                const trCellHtml = `
                  <td class="tr-cell" dir="ltr">
                    ${renderTrContentHtml(line, badgeCls)}
                  </td>
                `;

                return `
                  <tr style="background: ${rowBg};">
                    ${
                      isArRight
                        ? `${trCellHtml}${arCellHtml}`
                        : `${arCellHtml}${trCellHtml}`
                    }
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `;
    } else if (translationLayout === "stacked") {
      dialogueBodyHtml = `
        <div class="lines-container">
          ${dialogue.satirlar
            .map((line, idx) => {
              const spIdx = speakers.indexOf(line.konusmaci);
              const badgeCls =
                spIdx % 2 === 0 ? "sp-badge-emerald" : "sp-badge-indigo";
              const rowBg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
              const arLineText = clozeData.processedLines[idx] || line.arapca;
              return `
                <div class="stacked-card" style="background: ${rowBg};">
                  <div class="ar-col" dir="rtl">
                    ${renderArContentHtml(line, badgeCls, arLineText)}
                  </div>
                  <div class="tr-col" dir="ltr">
                    ${renderTrContentHtml(line, badgeCls)}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    } else {
      const trPageBreakStyle =
        translationPageBreak === "new"
          ? "page-break-before: always; break-before: page; margin-top: 0; padding-top: 6px;"
          : "margin-top: 18px; page-break-inside: avoid;";

      dialogueBodyHtml = `
        <div class="section-block">
          <div class="section-title">1. Arapça Diyalog Metni (النَّصُّ الْعَرَبِيُّ)</div>
          <div class="lines-container">
            ${dialogue.satirlar
              .map((line, idx) => {
                const spIdx = speakers.indexOf(line.konusmaci);
                const badgeCls =
                  spIdx % 2 === 0 ? "sp-badge-emerald" : "sp-badge-indigo";
                const rowBg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
                const arLineText = clozeData.processedLines[idx] || line.arapca;
                return `
                  <div class="line-row single-ar" style="background: ${rowBg};">
                    <div class="ar-col" dir="rtl">
                      ${renderArContentHtml(line, badgeCls, arLineText, true)}
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
        <div class="section-block" style="${trPageBreakStyle}">
          <div class="section-title">Diyalog Tercümeleri (الترجمة التركية)</div>
          <div class="end-tr-list">
            ${dialogue.satirlar
              .map((line) =>
                translationMode === "dotted"
                  ? `
              <div class="end-tr-item">
                <strong>${line.sira}. ${escapeHtml(line.konusmaci)}:</strong>
                <div class="tr-dotted-line" style="display:inline-block;width:75%;vertical-align:bottom;">......................................................</div>
              </div>
            `
                  : `
              <div class="end-tr-item">
                <strong>${line.sira}. ${escapeHtml(line.konusmaci)}:</strong> ${escapeHtml(line.turkce)}
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // Opsiyonel: 📚 Diyalog Kelime Hazinesi (المفردات)
    let vocabSectionHtml = "";
    if (includeVocabulary && vocabEntries.length > 0) {
      const vocabCells = vocabEntries.map((entry) => {
        const w = entry.item;
        const mainAr = w.mufret || w.mazi || "";
        const category = getWordCategory(w);
        const badgeHtml =
          category === "fiil"
            ? `<span class="pos-badge pos-fiil">Fiil</span>`
            : category === "edat"
            ? `<span class="pos-badge pos-edat">Edat</span>`
            : `<span class="pos-badge pos-isim">İsim</span>`;
        const rootText =
          w.kok && w.kok !== "-" ? `Kök: ${formatArHtml(w.kok)}` : "";

        const trDisplayHtml =
          vocabLanguageMode === "ar-only"
            ? `<div class="vocab-dotted-blank" title="Türkçe anlamı yazınız">............................................</div>`
            : `<div class="vocab-meaning">${escapeHtml(w.anlam_tr)}</div>`;

        const arDisplayHtml =
          vocabLanguageMode === "tr-only"
            ? `<div class="vocab-dotted-blank-ar" dir="rtl" title="Arapça karşılığını yazınız">....................................</div>`
            : `<span class="vocab-ar">${formatArHtml(mainAr)}</span>`;

        const rawThumbUrl = w.gorsel
          ? w.gorsel.startsWith("http")
            ? w.gorsel
            : `${originStr}${w.gorsel.startsWith("/") ? "" : "/"}${w.gorsel}`
          : "";
        const itemThumbHtml = rawThumbUrl
          ? `<img src="${escapeHtml(rawThumbUrl)}" alt="" loading="eager" style="width:36px;height:36px;aspect-ratio:1/1;object-fit:contain;border-radius:6px;border:1px solid #cbd5e1;background:#ffffff;flex-shrink:0;" onerror="this.style.display='none'" />`
          : "";

        return `
          <div class="vocab-grid-card">
            ${itemThumbHtml}
            <div class="vocab-left">
              <div class="vocab-meta-row">
                ${badgeHtml}
                ${
                  rootText && vocabLanguageMode !== "tr-only"
                    ? `<span class="vocab-root" dir="rtl">${rootText}</span>`
                    : ""
                }
              </div>
              ${trDisplayHtml}
            </div>
            <div class="vocab-right" dir="rtl">
              ${arDisplayHtml}
            </div>
          </div>
        `;
      });

      const pageBreakStyle =
        vocabPlacement === "new-page"
          ? "page-break-before: always; margin-top: 0; padding-top: 4px;"
          : "margin-top: 18px; page-break-inside: avoid;";

      const modeSubtitle =
        vocabLanguageMode === "ar-only"
          ? " • Kelime Anlam Testi (Türkçesini Yazınız)"
          : vocabLanguageMode === "tr-only"
          ? " • Arapça İmla Testi (Arapçasını Yazınız)"
          : "";

      vocabSectionHtml = `
        <div class="section-block" style="${pageBreakStyle}">
          <div class="section-title">📚 Diyalog Kelime Hazinesi (المفردات) — ${
            vocabEntries.length
          } Kelime${modeSubtitle}</div>
          <div class="vocab-two-col-grid">
            ${vocabCells.join("")}
          </div>
        </div>
      `;
    }

    // Opsiyonel: ✨ Kalıp İfadeler Tablosu
    let idiomsSectionHtml = "";
    if (includeIdioms && idioms.length > 0) {
      const idiomRowsHtml = idioms
        .map((idm, idx) => {
          const rowBg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
          const meaningCellHtml = idiomsBlankMode
            ? `<div class="idiom-dotted-line">......................................................</div>`
            : `<strong>${escapeHtml(idm.meaningTr)}</strong>`;
          return `
            <tr style="background: ${rowBg};">
              <td class="idiom-ar-cell" dir="rtl">${formatArHtml(idm.arabic)}</td>
              <td class="idiom-tr-cell" dir="ltr">${meaningCellHtml}</td>
              <td class="idiom-note-cell" dir="ltr">
                <div><strong>Harfiyen:</strong> ${escapeHtml(idm.literalTr)}</div>
                <div style="color:#475569;margin-top:2px;">💡 ${escapeHtml(idm.usageNote)}</div>
              </td>
            </tr>
          `;
        })
        .join("");

      idiomsSectionHtml = `
        <div class="section-block" style="margin-top: 18px; page-break-inside: avoid;">
          <div class="section-title" style="border-left-color: #6741d9; color: #4c28b5;">
            ✨ Bu Diyalogdaki Kalıp İfadeler (التعبيرات الاصطلاحية) — ${
              idioms.length
            } İfade${
        idiomsBlankMode ? " • Çalışma Kağıdı (Deyimsel Anlamı Yazınız)" : ""
      }
          </div>
          <table class="idioms-table" dir="ltr">
            <thead>
              <tr>
                <th style="width: 30%; text-align: right;" dir="rtl">1. Kalıp İfade (Arapça)</th>
                <th style="width: 30%; text-align: left;">2. Deyimsel Anlamı (Türkçe)</th>
                <th style="width: 40%; text-align: left;">3. Harfiyen Anlamı &amp; Kullanım İpucu</th>
              </tr>
            </thead>
            <tbody>
              ${idiomRowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }

    // Opsiyonel: Ek 5 Soruluk Çalışma Soruları
    let worksheetSectionHtml = "";
    if (includeWorksheet && miniWorksheetQuestions.length > 0) {
      const worksheetRows = miniWorksheetQuestions
        .map(
          (q) => `
          <div class="quiz-row">
            <div class="quiz-ar" dir="rtl">
              <strong>${q.sira}.</strong> ${formatArHtml(q.blankSentence)}
            </div>
            ${
              translationMode === "show"
                ? `<div class="quiz-tr">İpucu: “${escapeHtml(q.turkce)}”</div>`
                : ""
            }
          </div>
        `
        )
        .join("");

      const wordBank = miniWorksheetQuestions
        .map((q) => formatArHtml(q.answer))
        .join("  •  ");

      worksheetSectionHtml = `
        <div class="section-block" style="margin-top: 18px; page-break-inside: avoid;">
          <div class="section-title">✏️ Ek Çalışma Soruları (${miniWorksheetQuestions.length} Soru)</div>
          <div class="word-bank" dir="rtl">
            <strong>Kelime Havuzu:</strong> ${wordBank}
          </div>
          <div class="quiz-list">
            ${worksheetRows}
          </div>
        </div>
      `;
    }

    // Öğrenci Bilgi Şeridi
    const studentHeaderHtml = includeStudentHeader
      ? `
        <div class="student-info-strip">
          <span><strong>Adı Soyadı:</strong> ....................................</span>
          <span><strong>Sınıf / No:</strong> ....................</span>
          <span><strong>Tarih:</strong> .... / .... / 2026</span>
          <span><strong>Puan:</strong> ......... / 100</span>
        </div>
      `
      : "";

    // ✍️ Harekesiz Yazılı Yoklama + Maarif 4 Beceri Değerlendirme Rubriği HTML Üretimi
    const unvocalizedRubricSectionHtml = `
      <div class="student-header-strip">
        <span><strong>Adı Soyadı:</strong> .......................................</span>
        <span><strong>Sınıfı / No:</strong> ..................</span>
        <span><strong>Tarih:</strong> .... / .... / 2026</span>
        <span><strong>Toplam Puan:</strong> ........ / 100</span>
      </div>

      <div class="section-block" style="margin-bottom:10px;">
        <div class="section-title">
          <span>BÖLÜM 1 — Harekesiz Metni Harekeleme, Tercüme ve İ'rab Yoklaması</span>
          <span class="section-title-ar" dir="rtl">أ. الضَّبْطُ بِالشَّكْلِ وَالتَّرْجَمَةُ وَالْإِعْرَابُ</span>
        </div>
        <div style="font-size:10.5px;color:#475569;margin-bottom:6px;font-weight:600;">
          Yönerge: Aşağıdaki harekesiz Arapça cümleleri tam harekeleyiniz (ضبط بالشكل), altı çizili veya temel ögelerin i'rabını belirterek Türkçe tercümesini noktalı alana yazınız.
        </div>
        <div style="border:1.5px solid #cbd5e1;border-radius:10px;overflow:hidden;">
          ${unvocalizedRubricItems
            .map(
              (item, idx) => `
            <div style="padding:8px 12px;border-bottom:${
              idx < unvocalizedRubricItems.length - 1
                ? "1px solid #e2e8f0"
                : "none"
            };background:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};page-break-inside:avoid;break-inside:avoid;">
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;" dir="rtl">
                <div style="font-family:${fontConfig.cssFamily};font-size:${Math.round(
                23 * fontConfig.scale
              )}px;font-weight:700;color:#0f172a;line-height:2.25;text-align:right;flex:1;">
                  <span style="font-size:14px;color:#087f5b;margin-left:6px;">${
                    item.num
                  }.</span>
                  ${escapeHtml(
                    formatArabicText(item.unvocalizedAr, false, arabicFont)
                  )}
                </div>
                <span dir="ltr" style="font-size:9.5px;font-weight:800;color:#6741d9;background:#f3f0ff;border:1px solid #d0bfff;padding:1px 6px;border-radius:5px;flex-shrink:0;">
                  ${item.points}p
                </span>
              </div>
              <div style="margin-top:4px;display:flex;align-items:flex-end;gap:6px;font-size:10.5px;color:#475569;">
                <strong style="flex-shrink:0;">Tercüme &amp; İ'rab Notu:</strong>
                <div style="flex:1;border-bottom:1.5px dotted #94a3b8;height:18px;"></div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      <div class="section-block" style="margin-top:12px;page-break-inside:avoid;break-inside:avoid;">
        <div class="section-title" style="border-left-color:#6741d9;color:#4c28b5;">
          <span>📊 Maarif Modeli 4 Temel Dil Becerisi Değerlendirme Ölçeği (Rubrik — Toplam 100 Puan)</span>
          <span dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:15px;">مِقْيَاسُ التَّقْوِيمِ الشَّامِلِ</span>
        </div>
        <table class="two-col-table" style="font-size:10.5px;">
          <thead>
            <tr>
              <th style="width:24%;text-align:left;">Temel Dil Becerisi</th>
              <th style="width:22%;text-align:left;">Geliştirilmeli (0–10p)</th>
              <th style="width:22%;text-align:left;">Yeterli (11–18p)</th>
              <th style="width:20%;text-align:left;">Yetkin (19–25p)</th>
              <th style="width:12%;text-align:center;">Puan</th>
            </tr>
          </thead>
          <tbody>
            ${MAARIF_RUBRIC_CRITERIA.map(
              (r, idx) => `
              <tr style="background:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};">
                <td>
                  <div style="font-weight:800;color:#0f172a;">${escapeHtml(r.skillTr)}</div>
                  <div dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:13px;color:#087f5b;font-weight:700;">${escapeHtml(
                r.skillAr
              )}</div>
                </td>
                <td style="color:#475569;">${escapeHtml(r.developing)}</td>
                <td style="color:#334155;">${escapeHtml(r.proficient)}</td>
                <td style="color:#065f46;font-weight:700;">${escapeHtml(r.advanced)}</td>
                <td style="text-align:center;font-weight:800;color:#1e293b;">.... / ${r.maxPoints}</td>
              </tr>
            `
            ).join("")}
            <tr style="background:#ecfdf5;">
              <td colspan="4" style="font-weight:800;color:#065f46;text-align:right;">
                Öğretmen Genel Değerlendirmesi &amp; Toplam Bütüncül Puan:
              </td>
              <td style="text-align:center;font-weight:800;color:#065f46;font-size:11.5px;">
                ...... / 100
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // ✂️ Kes-Katla Kelime & Cümle Kartları Şablonu HTML Üretimi
    const flashcardGridCols =
      flashcardGridSize === "4x4" ? "repeat(4, 1fr)" : "repeat(3, 1fr)";
    const flashcardImgPx = flashcardGridSize === "3x3" ? 76 : 54;
    const flashcardsSectionHtml = `
      <div style="margin-bottom:8px;padding:6px 12px;border-radius:10px;background:#f8fafc;border:1.5px dashed #94a3b8;display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:700;color:#334155;">
        <span>✂️ Kesikli çizgilerden makasla keserek veya ortadan katlayarak çift yönlü kelime kartı olarak kullanabilirsiniz.</span>
        <span style="color:#087f5b;font-weight:800;">${flashcardGridSize} Şablon (${flashcardItems.length} Kart)</span>
      </div>
      <div style="display:grid;grid-template-columns:${flashcardGridCols};gap:10px;">
        ${flashcardItems
          .map((fc, idx) => {
            const rawFcImg = fc.imageUrl
              ? fc.imageUrl.startsWith("http")
                ? fc.imageUrl
                : `${originStr}${fc.imageUrl.startsWith("/") ? "" : "/"}${
                    fc.imageUrl
                  }`
              : "";
            return `
              <div style="border:2px dashed #94a3b8;border-radius:14px;padding:${
                flashcardGridSize === "3x3" ? "12px 10px" : "8px 8px"
              };display:flex;flex-direction:column;justify-content:space-between;align-items:center;text-align:center;background:#ffffff;page-break-inside:avoid;break-inside:avoid;min-height:${
                flashcardGridSize === "3x3"
                  ? "215px"
                  : flashcardGridSize === "3x4"
                  ? "165px"
                  : "145px"
              };position:relative;">
                <div style="width:100%;display:flex;align-items:center;justify-content:space-between;font-size:9.5px;font-weight:800;color:#64748b;margin-bottom:4px;">
                  <span>✂️ #${idx + 1} • ${escapeHtml(fc.posLabel)}</span>
                  ${
                    fc.kok
                      ? `<span dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:13px;color:#6741d9;background:#f3f0ff;padding:0 6px;border-radius:5px;border:1px solid #d0bfff;">${formatArHtml(
                          fc.kok
                        )}</span>`
                      : `<span>${escapeHtml(dialogue.seviye)}</span>`
                  }
                </div>

                ${
                  rawFcImg && effectiveImageMode !== "hide"
                    ? `<img src="${escapeHtml(rawFcImg)}" alt="" loading="eager" style="width:${flashcardImgPx}px;height:${flashcardImgPx}px;aspect-ratio:1/1;object-fit:contain;margin:2px auto;display:block;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;" onerror="this.style.display='none'" />`
                    : ""
                }

                <div dir="rtl" style="margin:4px 0;width:100%;">
                  ${
                    translationMode === "ar-dotted"
                      ? `<div style="border-bottom:1.5px dotted #64748b;height:26px;width:88%;margin:6px auto;">................</div>`
                      : `<div style="font-family:${fontConfig.cssFamily};font-size:${Math.round(
                          (flashcardGridSize === "3x3" ? 25 : 20) *
                            fontConfig.scale
                        )}px;font-weight:700;color:#087f5b;line-height:1.45;">${formatArHtml(
                          fc.arabic
                        )}</div>`
                  }
                  ${
                    fc.morphInfo && translationMode !== "ar-dotted"
                      ? `<div dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:12px;font-weight:700;color:#475569;margin-top:2px;">${formatArHtml(
                          fc.morphInfo
                        )}</div>`
                      : ""
                  }
                </div>

                <div style="width:100%;border-top:1px dashed #cbd5e1;padding-top:5px;margin-top:4px;">
                  ${
                    translationMode === "dotted"
                      ? `<div style="font-size:11px;color:#64748b;letter-spacing:1px;padding-top:4px;">....................................</div>`
                      : `<div style="font-size:${
                          flashcardGridSize === "3x3" ? "12px" : "11px"
                        };font-weight:800;color:#1e293b;line-height:1.3;">${escapeHtml(
                          fc.turkish
                        )}</div>`
                  }
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    const renderPairStudentHalfHtml = (
      role: "A" | "B",
      cardLines: typeof infoGapDeck.studentACard
    ) => {
      const isA = role === "A";
      const borderColor = isA ? "#087f5b" : "#6741d9";
      const headerBg = isA ? "#ecfdf5" : "#f3f0ff";
      const headerColor = isA ? "#065f46" : "#4c28b5";
      return `
        <div style="border:2px solid ${borderColor};border-radius:12px;overflow:hidden;background:#ffffff;page-break-inside:avoid;break-inside:avoid;">
          <div style="background:${headerBg};border-bottom:1.5px solid ${borderColor};padding:6px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div style="font-size:11px;font-weight:800;color:${headerColor};">
              ${isA ? "🅰️ ÖĞRENCİ A KONUŞMA KARTI" : "🅱️ ÖĞRENCİ B KONUŞMA KARTI"} • ${escapeHtml(
        dialogue.baslik_tr
      )} (${escapeHtml(dialogue.seviye)})
            </div>
            <div style="font-size:10px;font-weight:700;color:#334155;">
              Adı Soyadı: .................................
            </div>
          </div>
          <div style="padding:4px 8px;">
            ${cardLines
              .map(
                (ln, idx) => `
              <div style="padding:3.5px 4px;border-bottom:${
                idx < cardLines.length - 1 ? "1px dashed #cbd5e1" : "none"
              };display:flex;flex-direction:column;gap:1.5px;">
                <div dir="rtl" style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;text-align:right;font-family:${
                  fontConfig.cssFamily
                };font-size:${Math.round(
                  16.5 * fontConfig.scale
                )}px;font-weight:700;color:#0f172a;line-height:1.55;">
                  <div>
                    <span style="color:${borderColor};font-size:13px;margin-left:4px;">#${
                  ln.lineNumber
                } ${formatArHtml(ln.speakerAr)}:</span>
                    ${formatArHtml(ln.displayArabic)}
                  </div>
                  <span dir="ltr" style="font-family:sans-serif;font-size:9px;font-weight:800;padding:1px 6px;border-radius:4px;white-space:nowrap;${
                    ln.isFull
                      ? "background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;"
                      : "background:#fef3c7;color:#92400e;border:1px solid #fcd34d;"
                  }">
                    ${ln.isFull ? "Sıra Sizde" : "Bilgi Boşluğu"}
                  </span>
                </div>
                <div style="font-size:9.5px;color:${
                  ln.isFull ? "#475569" : "#92400e"
                };font-weight:${ln.isFull ? "600" : "700"};">
                  ${escapeHtml(ln.displayTurkishCue)}
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    };

    const pairInfoGapSectionHtml = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${renderPairStudentHalfHtml("A", infoGapDeck.studentACard)}
        <div style="display:flex;align-items:center;gap:10px;margin:3px 0;">
          <div style="flex:1;border-top:2px dashed #087f5b;"></div>
          <span style="font-size:10px;font-weight:800;color:#065f46;background:#ecfdf5;border:1px dashed #087f5b;padding:2px 10px;border-radius:999px;white-space:nowrap;">
            ✂️ Buradan Kesiniz — Üst Kart: Öğrenci A • Alt Kart: Öğrenci B
          </span>
          <div style="flex:1;border-top:2px dashed #087f5b;"></div>
        </div>
        ${renderPairStudentHalfHtml("B", infoGapDeck.studentBCard)}
      </div>
    `;

    // 🔑 ÖĞRETMEN CEVAP ANAHTARI HTML ÜRETİMİ
    const renderHighlightedClozeSentenceHtml = (
      fullArabic: string,
      targetWord: string | null
    ) => {
      if (!targetWord) return formatArHtml(fullArabic);
      const formattedFull = formatArHtml(fullArabic);
      const formattedTarget = formatArHtml(targetWord);
      if (formattedFull.includes(formattedTarget)) {
        return formattedFull.replace(
          formattedTarget,
          `<u style="color:#087f5b;background:#ecfdf5;padding:0 5px;border-radius:4px;font-weight:800;text-decoration:underline;text-decoration-thickness:2px;">${formattedTarget}</u>`
        );
      }
      return `${formattedFull} <u style="color:#dc2626;font-weight:800;">(${formattedTarget})</u>`;
    };

    const shouldRenderAnswerKey =
      printScope === "answer-key" ||
      (printScope === "both" && includeAnswerKey);
    const answerKeyPageBreakStyle =
      printScope === "both"
        ? "page-break-before: always; break-before: page; padding-top: 4px;"
        : "padding-top: 0;";

    const secondPageAnswerKeyHtml = shouldRenderAnswerKey
      ? `
        <div class="teacher-answer-key-page" style="${answerKeyPageBreakStyle}">
          <div class="header-card" style="border-color:#087f5b;background:#ecfdf5;margin-bottom:12px;">
            <div class="header-left">
              <div class="badge-row">
                <span class="badge" style="background:#087f5b;">🔑 ÖĞRETMEN CEVAP ANAHTARI</span>
                <span class="badge-cefr">CEFR ${escapeHtml(dialogue.seviye)}</span>
                ${
                  pdfDocMode === "quiz-sheet"
                    ? `<span class="badge" style="background:#6741d9;">KİTAPÇIK: ${a4QuizSheetData.bookletGroup} GRUBU (FORM #${escapeHtml(
                        a4QuizSheetData.formCode
                      )})</span>`
                    : ""
                }
                <span class="badge-outline">مِفْتَاحُ الْإِجَابَاتِ لِلْمُعَلِّمِ</span>
              </div>
              <div class="title-row">
                <h2 class="title-tr" style="font-size:16px;">🔑 Öğretmen Cevap Anahtarı — ${escapeHtml(
                  dialogue.baslik_tr
                )}</h2>
                <span class="title-ar" dir="rtl" style="font-size:22px;">${formatArHtml(
                  dialogue.baslik_ar
                )}</span>
              </div>
            </div>
          </div>

          ${
            pdfDocMode === "quiz-sheet"
              ? `
              ${
                sixSectionExamData.sec1ArToTr.length > 0
                  ? `<div class="section-block" style="margin-bottom:8px;">
                      <div class="section-title">✅ 1. Bölüm — Arapça → Türkçe Anlam Yazma Cevapları (${sixSectionExamData.pointsAllocation.sectionTotals[0]} Puan)</div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        ${sixSectionExamData.sec1ArToTr
                          .map(
                            (it) =>
                              `<div style="border:1px solid #cbd5e1;border-radius:7px;padding:4px 8px;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;">
                                <span><strong>${it.num}. (${it.points}p):</strong> ${escapeHtml(it.correctTurkish)}</span>
                                <span dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:17px;font-weight:700;color:#087f5b;">${formatArHtml(it.arabic)}</span>
                              </div>`
                          )
                          .join("")}
                      </div>
                    </div>`
                  : ""
              }
              ${
                sixSectionExamData.sec2TrToAr.length > 0
                  ? `<div class="section-block" style="margin-bottom:8px;">
                      <div class="section-title">✅ 2. Bölüm — Türkçe → Arapça Yazma Cevapları (${sixSectionExamData.pointsAllocation.sectionTotals[1]} Puan)</div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        ${sixSectionExamData.sec2TrToAr
                          .map(
                            (it) =>
                              `<div style="border:1px solid #cbd5e1;border-radius:7px;padding:4px 8px;background:#ffffff;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;">
                                <span><strong>${it.num}. (${it.points}p):</strong> ${escapeHtml(it.turkish)}</span>
                                <span dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:17px;font-weight:700;color:#6741d9;"><u>${formatArHtml(it.correctArabic)}</u></span>
                              </div>`
                          )
                          .join("")}
                      </div>
                    </div>`
                  : ""
              }
              ${
                sixSectionExamData.sec3FillBlank.length > 0
                  ? `<div class="section-block" style="margin-bottom:8px;">
                      <div class="section-title">✅ 3. Bölüm — Boşluk Doldurma Cevapları (${sixSectionExamData.pointsAllocation.sectionTotals[2]} Puan)</div>
                      <div style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
                        ${sixSectionExamData.sec3FillBlank
                          .map(
                            (b, idx) =>
                              `<div style="padding:5px 10px;border-bottom:${
                                idx < sixSectionExamData.sec3FillBlank.length - 1
                                  ? "1px solid #e2e8f0"
                                  : "none"
                              };display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;">
                                <span><strong>${b.num}. (${b.points}p):</strong> <span dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:16px;font-weight:800;color:#dc2626;"><u>${formatArHtml(b.targetWordAr)}</u></span> (${escapeHtml(b.turkishMeaning)})</span>
                                <span dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:17px;font-weight:700;color:#0f172a;">${formatArHtml(b.fullSentenceAr)}</span>
                              </div>`
                          )
                          .join("")}
                      </div>
                    </div>`
                  : ""
              }
              ${
                sixSectionExamData.sec4MultipleChoice.length > 0
                  ? `<div class="section-block" style="margin-bottom:8px;">
                      <div class="section-title">✅ 4. Bölüm — Çoktan Seçmeli Test Cevapları (${sixSectionExamData.pointsAllocation.sectionTotals[3]} Puan)</div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        ${sixSectionExamData.sec4MultipleChoice
                          .map(
                            (c) =>
                              `<div style="border:1px solid #cbd5e1;border-radius:7px;padding:5px 9px;background:#f8fafc;font-size:11px;">
                                <strong>Soru ${c.num} (${c.points}p) → Şık ${escapeHtml(c.correctLetter)}:</strong> ${escapeHtml(c.correctTurkish)}
                              </div>`
                          )
                          .join("")}
                      </div>
                    </div>`
                  : ""
              }
              ${
                sixSectionExamData.sec5Matching.length > 0
                  ? `<div class="section-block" style="margin-bottom:8px;">
                      <div class="section-title">✅ 5. Bölüm — Eşleştirme Alıştırması Cevapları (${sixSectionExamData.pointsAllocation.sectionTotals[4]} Puan)</div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        ${sixSectionExamData.sec5Matching
                          .map(
                            (m) =>
                              `<div style="border:1px solid #cbd5e1;border-radius:7px;padding:4px 8px;background:#ffffff;font-size:11px;display:flex;align-items:center;justify-content:space-between;">
                                <span><strong>${m.rightNumber}. ${escapeHtml(m.rightShuffledTr)}</strong> → <strong>[${escapeHtml(m.rightCorrectLetter)}]</strong></span>
                                <span dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:16px;font-weight:700;color:#087f5b;">${formatArHtml(m.rightMatchedArabic)}</span>
                              </div>`
                          )
                          .join("")}
                      </div>
                    </div>`
                  : ""
              }
              ${
                sixSectionExamData.sec6Morphology.length > 0
                  ? `<div class="section-block" style="margin-bottom:8px;">
                      <div class="section-title">✅ 6. Bölüm — Sarf (Kök &amp; Müfret–Cemî / Mâzî–Muzâri) Cevapları (${sixSectionExamData.pointsAllocation.sectionTotals[5]} Puan)</div>
                      <table class="two-col-table" style="font-size:11px;">
                        <thead>
                          <tr>
                            <th># / Türkçe</th>
                            <th dir="rtl" style="text-align:right;">Kök (جذر)</th>
                            <th dir="rtl" style="text-align:right;">1. Form</th>
                            <th dir="rtl" style="text-align:right;">2. Form</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${sixSectionExamData.sec6Morphology
                            .map(
                              (r) =>
                                `<tr>
                                  <td><strong>${r.num}. (${r.points}p)</strong> ${escapeHtml(r.turkce)}</td>
                                  <td dir="rtl" style="text-align:right;font-family:${fontConfig.cssFamily};font-size:16px;font-weight:700;color:#6741d9;">${formatArHtml(r.kokSpaced)}</td>
                                  <td dir="rtl" style="text-align:right;font-family:${fontConfig.cssFamily};font-size:17px;font-weight:700;color:#087f5b;">${formatArHtml(r.form1Ar)} (${escapeHtml(r.form1Label)})</td>
                                  <td dir="rtl" style="text-align:right;font-family:${fontConfig.cssFamily};font-size:17px;font-weight:700;color:#087f5b;">${formatArHtml(r.form2Ar)} (${escapeHtml(r.form2Label)})</td>
                                </tr>`
                            )
                            .join("")}
                        </tbody>
                      </table>
                    </div>`
                  : ""
              }
            `
              : pdfDocMode === "unvocalized-rubric"
              ? `
              <div class="section-block" style="margin-bottom:10px;">
                <div class="section-title">✅ Harekesiz Yoklama Tam Harekeli (الضبط الكامل) ve Tercüme Anahtarı</div>
                <table class="two-col-table" style="font-size:11.5px;">
                  <thead>
                    <tr>
                      <th style="width:46%;text-align:left;">Tam Türkçe Tercümesi</th>
                      <th style="width:54%;text-align:right;" dir="rtl">Tam Harekeli Doğru Metin (النَّصُّ الْمَشْكُولُ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${unvocalizedRubricItems
                      .map(
                        (item, idx) => `
                        <tr style="background:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};">
                          <td style="font-weight:600;color:#1e293b;"><strong>${item.num}. (${item.points}p) ${escapeHtml(
                          item.konusmaci
                        )}:</strong> ${escapeHtml(item.turkce)}</td>
                          <td dir="rtl" style="text-align:right;font-family:${fontConfig.cssFamily};font-size:20px;font-weight:700;color:#087f5b;line-height:2;">
                            ${item.num}. ${formatVocalizedArHtml(item.vocalizedAr)}
                          </td>
                        </tr>
                      `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
              : pdfDocMode === "flashcards"
              ? `
              <div class="section-block" style="margin-bottom:10px;">
                <div class="section-title">✅ Kes-Katla Kelime Kartları Tam Cevap Listesi (${flashcardItems.length} Kart)</div>
                <table class="two-col-table" style="font-size:11.5px;">
                  <thead>
                    <tr>
                      <th style="width:10%;">Kart</th>
                      <th style="width:35%;text-align:right;" dir="rtl">Arapça Kelime / İfade</th>
                      <th style="width:20%;text-align:right;" dir="rtl">Kök &amp; Sarf Bilgisi</th>
                      <th style="width:35%;text-align:left;">Türkçe Doğru Anlamı</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${flashcardItems
                      .map(
                        (fc, idx) => `
                        <tr style="background:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};">
                          <td style="font-weight:800;">#${idx + 1} (${escapeHtml(fc.posLabel)})</td>
                          <td dir="rtl" style="text-align:right;font-family:${fontConfig.cssFamily};font-size:19px;font-weight:700;color:#087f5b;"><u style="text-decoration-color:#087f5b;">${formatArHtml(
                          fc.arabic
                        )}</u></td>
                          <td dir="rtl" style="text-align:right;font-family:${fontConfig.cssFamily};font-size:14px;color:#6741d9;font-weight:700;">${
                          fc.kok ? `Kök: ${formatArHtml(fc.kok)}` : "-"
                        } ${fc.morphInfo ? `• ${formatArHtml(fc.morphInfo)}` : ""}</td>
                          <td style="font-weight:800;color:#1e293b;">${escapeHtml(fc.turkish)}</td>
                        </tr>
                      `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
              : pdfDocMode === "pair-infogap"
              ? `
              <div class="section-block" style="margin-bottom:10px;">
                <div class="section-title">✅ İkili Bilgi Boşluğu (Öğrenci A &amp; B) Tam Diyalog ve Gizlenen Kelimeler Anahtarı</div>
                <table class="two-col-table" style="font-size:11px;">
                  <thead>
                    <tr>
                      <th style="width:16%;">Boşluk Kimde?</th>
                      <th style="width:34%;text-align:left;">Tam Türkçe Anlamı</th>
                      <th style="width:50%;text-align:right;" dir="rtl">Tam Arapça Cümle &amp; Gizlenen Hedef Kelime</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${infoGapDeck.lines
                      .map(
                        (ln, idx) => `
                        <tr style="background:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};">
                          <td style="font-weight:800;color:${
                            ln.lineNumber % 2 === 1 ? "#6741d9" : "#087f5b"
                          };">#${ln.lineNumber} (${
                          ln.lineNumber % 2 === 1
                            ? "Öğrenci B'de Boş"
                            : "Öğrenci A'da Boş"
                        })</td>
                          <td style="font-weight:600;color:#1e293b;"><strong>${escapeHtml(
                            ln.speakerTr
                          )}:</strong> ${escapeHtml(ln.turkishFull)}</td>
                          <td dir="rtl" style="text-align:right;font-family:${
                            fontConfig.cssFamily
                          };font-size:18px;font-weight:700;color:#0f172a;">
                            ${formatArHtml(ln.fullArabic)}
                            <span style="color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:0 5px;margin-right:6px;font-size:15px;">
                              [${formatArHtml(ln.hiddenWordsAr.join(" ، "))}]
                            </span>
                          </td>
                        </tr>
                      `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
              <div class="section-block" style="margin-bottom:8px;">
                <div class="section-title">📊 Öğretmen Eşli Konuşma Değerlendirme Rubriği (100 Puan)</div>
                <table class="two-col-table" style="font-size:11px;">
                  <thead>
                    <tr>
                      <th style="width:28%;">Ölçüt</th>
                      <th style="width:54%;">Beklenen İletişimsel Kazanım</th>
                      <th style="width:18%;text-align:center;">Puan</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${PAIR_SPEAKING_RUBRIC_CRITERIA.map(
                      (c, idx) => `
                      <tr style="background:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};">
                        <td style="font-weight:800;color:#065f46;">${escapeHtml(
                          c.titleTr
                        )}</td>
                        <td>${escapeHtml(c.descriptionTr)}</td>
                        <td style="text-align:center;font-weight:800;">.... / ${
                          c.maxPoints
                        }</td>
                      </tr>
                    `
                    ).join("")}
                  </tbody>
                </table>
              </div>
            `
              : `
              <div class="section-block" style="margin-bottom:10px;">
                <div class="section-title">✅ 1. Diyalog / Metin Tam Cümleleri ve Boşluk Doldurma (Cloze) Çözümleri</div>
                <table class="two-col-table" style="font-size:11.5px;">
                  <thead>
                    <tr>
                      <th style="width:48%;text-align:left;">Tam Türkçe Tercümesi</th>
                      <th style="width:52%;text-align:right;" dir="rtl">Tam Arapça Cümle (Hedef Kelimeler Altı Çizili)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${dialogue.satirlar
                      .map((line, idx) => {
                        const targetW = clozeData.lineTargetWords[idx] || null;
                        return `
                          <tr style="background:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};">
                            <td style="font-weight:600;color:#1e293b;"><strong>${line.sira}. ${escapeHtml(
                              line.konusmaci
                            )}:</strong> ${escapeHtml(line.turkce)}</td>
                            <td dir="rtl" style="text-align:right;font-family:${fontConfig.cssFamily};font-size:18px;font-weight:700;color:#0f172a;">
                              <span style="color:#087f5b;font-size:14px;margin-left:6px;">${
                                line.sira
                              }. ${formatArHtml(line.konusmaci_ar)}:</span>
                              ${renderHighlightedClozeSentenceHtml(
                                line.arapca,
                                targetW
                              )}
                            </td>
                          </tr>
                        `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>

              ${
                vocabEntries.length > 0
                  ? `
                  <div class="section-block" style="margin-bottom:10px;">
                    <div class="section-title">✅ 2. Kelime Tablosu Tam Karşılıkları (${vocabEntries.length} Kelime)</div>
                    <div class="vocab-two-col-grid">
                      ${vocabEntries
                        .map((e, idx) => {
                          const w = e.item;
                          const mainAr = w.mufret || w.mazi || "";
                          return `
                            <div class="vocab-grid-card" style="padding:5px 9px;min-height:36px;">
                              <div class="vocab-left">
                                <span style="font-size:11px;font-weight:800;color:#1e293b;">${
                                  idx + 1
                                }. ${escapeHtml(w.anlam_tr)}</span>
                              </div>
                              <div class="vocab-right" dir="rtl">
                                <span class="vocab-ar" style="font-size:18px;"><u style="color:#087f5b;">${formatArHtml(
                                  mainAr
                                )}</u></span>
                              </div>
                            </div>
                          `;
                        })
                        .join("")}
                    </div>
                  </div>
                `
                  : ""
              }

              ${
                includeWorksheet && miniWorksheetQuestions.length > 0
                  ? `
                  <div class="section-block" style="margin-bottom:10px;">
                    <div class="section-title">✅ 3. Ek Çalışma Soruları Cevapları</div>
                    <div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;background:#f8fafc;font-size:11.5px;">
                      ${miniWorksheetQuestions
                        .map(
                          (q) =>
                            `<span style="margin-right:14px;"><strong>${q.sira})</strong> <span dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:17px;font-weight:800;color:#dc2626;"><u>${formatArHtml(
                              q.answer
                            )}</u></span> (${escapeHtml(q.turkce)})</span>`
                        )
                        .join(" ")}
                    </div>
                  </div>
                `
                  : ""
              }
            `
          }
          <footer class="corporate-footer">
            <span>🔑 Öğretmen Cevap Anahtarı — ${escapeHtml(dialogue.baslik_tr)} (${escapeHtml(
          dialogue.seviye
        )})</span>
            <a href="https://www.muallimun.net" target="_blank" rel="noopener noreferrer" class="corporate-brand" style="text-decoration:none;">www.muallimun.net</a>
          </footer>
        </div>
      `
      : "";

    // Görsel & QR Kod HTML blokları
    const compactImageHtml =
      effectiveImageMode === "compact"
        ? `<img src="${absoluteImgUrl}" alt="${escapeHtml(dialogue.baslik_tr)}" loading="eager" class="cover-img-compact" onerror="this.style.display='none'" />`
        : "";

    const bannerImageHtml =
      effectiveImageMode === "banner"
        ? `<div class="banner-img-wrap"><img src="${absoluteImgUrl}" alt="${escapeHtml(dialogue.baslik_tr)}" loading="eager" class="cover-img-banner" onerror="this.parentElement.style.display='none'" /></div>`
        : "";

    const qrBlockHtml = includeQrCode
      ? `
        <a href="${escapeHtml(dialogueUrl)}" target="_blank" rel="noopener noreferrer" class="qr-code-container" title="${escapeHtml(dialogueUrl)}">
          ${qrSvgMarkup}
          <span class="qr-caption">Dinlemek için okutun</span>
          <span class="qr-short-url">${escapeHtml(shortDisplayUrl)}</span>
        </a>
      `
      : "";

    const hasHeaderRight =
      effectiveImageMode === "compact" || includeQrCode;

    const htmlDocument = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8" />
        <title>Diyalog #${String(rawNum).padStart(2, "0")} - ${escapeHtml(
      dialogue.baslik_tr
    )} | www.muallimun.net</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Lateef:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Scheherazade+New:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @font-face {
            font-family: "Arakom";
            src: url("${originStr}/fonts/Arakom.ttf") format("truetype");
            font-weight: 100 900;
            font-style: normal;
            font-display: swap;
          }
          @page {
            size: A4 portrait;
            margin: ${
              activeDensity === "ultra"
                ? "8mm"
                : activeDensity === "tight"
                ? "9.5mm 11mm 10mm 11mm"
                : "11mm 13mm 14mm 13mm"
            };
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #1f1a14;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.5;
          }
          .header-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            border: 2px solid #087F5B;
            border-bottom-width: 4px;
            border-radius: 14px;
            padding: 12px 16px;
            background: #fdfbf7;
            margin-bottom: 12px;
          }
          .header-left {
            flex: 1;
            min-width: 0;
          }
          .header-right {
            display: flex;
            align-items: center;
            gap: 12px;
            border-left: 1px dashed #cbd5e1;
            padding-left: 12px;
            flex-shrink: 0;
          }
          .cover-img-compact {
            width: 88px;
            height: 88px;
            aspect-ratio: 1 / 1;
            object-fit: contain;
            background: #fff;
            border-radius: 10px;
            border: 1.5px solid #cbd5e1;
            display: block;
          }
          .banner-img-wrap {
            width: 100%;
            margin-bottom: 12px;
            border-radius: 12px;
            overflow: hidden;
            border: 1.5px solid #cbd5e1;
          }
          .cover-img-banner {
            width: 135px;
            height: 135px;
            aspect-ratio: 1 / 1;
            object-fit: contain;
            background: #ffffff;
            margin: 0 auto;
            display: block;
          }
          .qr-code-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            text-decoration: none;
            color: inherit;
          }
          .qr-caption {
            font-size: 8.5px;
            font-weight: 800;
            color: #087f5b;
            white-space: nowrap;
          }
          .qr-short-url {
            font-size: 8px;
            color: #64748b;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            white-space: nowrap;
          }
          .badge-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 5px;
            flex-wrap: wrap;
          }
          .badge {
            background: #087F5B;
            color: #ffffff;
            font-weight: 800;
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 6px;
          }
          .badge-cefr {
            background: #6741d9;
            color: #ffffff;
            font-weight: 800;
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 6px;
          }
          .badge-outline {
            border: 1px solid #cbb692;
            color: #5c5042;
            font-weight: 700;
            font-size: 9.5px;
            padding: 2px 7px;
            border-radius: 6px;
          }
          .title-row {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
          }
          .title-tr {
            font-size: 18px;
            font-weight: 800;
            color: #1f1a14;
            margin: 0;
          }
          .title-ar {
            font-family: ${fontConfig.cssFamily};
            font-size: 26px;
            font-weight: 700;
            color: #087f5b;
            line-height: 1.25;
          }
          .header-submeta {
            margin-top: 4px;
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
          }
          .helper-words-box {
            background: #f3f0ff;
            border: 1.5px dashed #6741d9;
            border-radius: 12px;
            padding: 9px 14px;
            margin-bottom: 12px;
            page-break-inside: avoid;
          }
          .helper-words-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 11px;
            font-weight: 800;
            color: #4c28b5;
          }
          .helper-words-ar-title {
            font-family: ${fontConfig.cssFamily};
            font-size: 18px;
            font-weight: 700;
          }
          .helper-words-items {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
          }
          .helper-word-chip {
            background: #ffffff;
            border: 1px solid #d0bfff;
            border-radius: 8px;
            padding: 2px 10px;
            font-family: ${fontConfig.cssFamily};
            font-size: ${Math.round(20 * fontConfig.scale)}px;
            font-weight: 700;
            color: #3b1fa8;
          }
          .two-col-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #cbd5e1;
            border-radius: 10px;
            overflow: hidden;
          }
          .two-col-table th {
            background: #f1f5f9;
            color: #1e293b;
            font-size: 11px;
            font-weight: 800;
            padding: 8px 12px;
            border-bottom: 1.5px solid #cbd5e1;
          }
          .two-col-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
          }
          .two-col-table tr,
          .idioms-table tr,
          .stacked-card,
          .line-row,
          .vocab-grid-card,
          .quiz-row {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .section-title {
            page-break-after: avoid;
            break-after: avoid;
          }
          .ar-cell {
            text-align: right;
            border-left: 1px dashed #cbd5e1;
            border-right: 1px dashed #cbd5e1;
          }
          .tr-cell {
            text-align: left;
            color: #334155;
            font-size: 12px;
          }
          .tr-dotted-wrap {
            display: flex;
            align-items: flex-end;
            gap: 6px;
            width: 100%;
          }
          .tr-dotted-line {
            flex: 1;
            height: 22px;
            border-bottom: 1.5px dotted #94a3b8;
          }
          .ar-dotted-box {
            display: inline-block;
            width: 82%;
            min-width: 180px;
            height: 28px;
            border-bottom: 1.5px dotted #64748b;
            vertical-align: bottom;
          }
          .student-info-strip, .student-header-strip {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 10px 16px;
            border: 1.5px solid #cbd5e1;
            border-radius: 10px;
            padding: 7px 14px;
            background: #f8fafc;
            margin-bottom: 12px;
            font-size: 11px;
            color: #1e293b;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .student-dots {
            color: #64748b;
            letter-spacing: 0.5px;
          }
          .idioms-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #cbd5e1;
            border-radius: 10px;
            overflow: hidden;
          }
          .idioms-table th {
            background: #f3f0ff;
            color: #4c28b5;
            font-size: 11px;
            font-weight: 800;
            padding: 8px 10px;
            border-bottom: 1.5px solid #cbd5e1;
            text-align: left;
          }
          .idioms-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
          }
          .idiom-ar-cell {
            text-align: right;
            font-family: ${fontConfig.cssFamily};
            font-size: ${Math.round(21 * fontConfig.scale)}px;
            font-weight: 700;
            color: #087f5b;
            line-height: 1.85;
            width: 30%;
            border-left: 1px dashed #cbd5e1;
          }
          .idiom-tr-cell {
            font-size: 12px;
            font-weight: 700;
            color: #1e293b;
            width: 32%;
            border-left: 1px dashed #cbd5e1;
          }
          .idiom-note-cell {
            font-size: 10.5px;
            color: #475569;
            line-height: 1.45;
            width: 38%;
          }
          .idiom-literal {
            color: #5f3dc4;
            font-weight: 600;
            margin-bottom: 2px;
          }
          .idiom-usage {
            color: #475569;
          }
          .answer-key-block {
            background: #f8fafc;
            border: 1.5px dashed #087F5B;
            border-radius: 10px;
            padding: 8px 12px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .answer-key-grid {
            display: flex;
            flex-direction: column;
            gap: 5px;
            font-size: 11px;
            color: #1e293b;
          }
          .answer-key-item {
            line-height: 1.55;
          }
          .sp-badge-emerald {
            background: #e6fcf5;
            color: #087f5b;
            border: 1px solid #96f2d7;
          }
          .sp-badge-indigo {
            background: #f3f0ff;
            color: #5f3dc4;
            border: 1px solid #d0bfff;
          }
          .speaker-ar {
            font-family: ${fontConfig.cssFamily};
            font-size: 16px;
            font-weight: 700;
            padding: 1px 8px;
            border-radius: 6px;
            margin-left: 8px;
            display: inline-block;
          }
          .ar-text {
            font-family: ${fontConfig.cssFamily};
            font-size: ${Math.round(22 * fontConfig.scale)}px;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.85;
          }
          .speaker-tr {
            font-weight: 800;
            font-size: 10.5px;
            padding: 2px 7px;
            border-radius: 6px;
            margin-right: 6px;
            display: inline-block;
            flex-shrink: 0;
          }
          .tr-text {
            font-weight: 600;
          }
          .stacked-card {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 8px 12px;
            margin-bottom: 7px;
            page-break-inside: avoid;
          }
          .stacked-card .tr-col {
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px dashed #cbd5e1;
            font-size: 12px;
            color: #334155;
          }
          .line-row.single-ar {
            border-bottom: 1px solid #e2e8f0;
            padding: 8px 10px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 12.5px;
            font-weight: 800;
            color: #087f5b;
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-left: 4px solid #087F5B;
            padding: 6px 12px;
            border-radius: 8px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .end-tr-list {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 16px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 10px 14px;
          }
          .end-tr-item {
            font-size: 11.5px;
            color: #334155;
          }
          .vocab-two-col-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px 12px;
          }
          .vocab-grid-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px 10px;
            background: #f8fafc;
            page-break-inside: avoid;
            min-height: 46px;
          }
          .vocab-left {
            flex: 1;
            min-width: 0;
          }
          .vocab-meta-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2px;
          }
          .pos-badge {
            font-size: 9px;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 4px;
            text-transform: uppercase;
          }
          .pos-fiil {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fcd34d;
          }
          .pos-isim {
            background: #e0f2fe;
            color: #075985;
            border: 1px solid #7dd3fc;
          }
          .pos-edat {
            background: #f3e8ff;
            color: #6b21a8;
            border: 1px solid #d8b4fe;
          }
          .vocab-root {
            font-family: ${fontConfig.cssFamily};
            font-size: 13px;
            font-weight: 700;
            color: #64748b;
          }
          .vocab-meaning {
            font-size: 11.5px;
            font-weight: 700;
            color: #1e293b;
          }
          .vocab-dotted-blank {
            width: 92%;
            height: 18px;
            border-bottom: 1.5px dotted #64748b;
            margin-top: 2px;
          }
          .vocab-dotted-blank-ar {
            width: 110px;
            height: 22px;
            border-bottom: 1.5px dotted #64748b;
          }
          .vocab-right {
            text-align: right;
            flex-shrink: 0;
          }
          .vocab-ar {
            font-family: ${fontConfig.cssFamily};
            font-size: ${Math.round(21 * fontConfig.scale)}px;
            font-weight: 700;
            color: #087f5b;
            line-height: 1.85;
          }
          .word-bank {
            background: #f3f0ff;
            border: 1px dashed #6741d9;
            border-radius: 8px;
            padding: 7px 12px;
            font-family: ${fontConfig.cssFamily};
            font-size: 20px;
            font-weight: 700;
            color: #4c28b5;
            margin-bottom: 10px;
            text-align: center;
          }
          .quiz-row {
            border-bottom: 1px dashed #cbd5e1;
            padding: 8px 4px;
          }
          .quiz-ar {
            font-family: ${fontConfig.cssFamily};
            font-size: 20px;
            font-weight: 700;
            line-height: 1.85;
          }
          .quiz-tr {
            font-size: 11px;
            color: #64748b;
            font-style: italic;
          }
          .corporate-footer {
            margin-top: 18px;
            padding-top: 8px;
            border-top: 2px solid #087F5B;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            font-size: 10.5px;
            color: #475569;
            page-break-inside: avoid;
          }
          .corporate-brand {
            font-size: 12px;
            font-weight: 800;
            color: #087f5b;
            letter-spacing: 0.03em;
          }
          /* 4 Kademeli Otomatik Sığdırma (Auto-Fit) Sınıfları (normal | compact | tight | ultra) */
          body.density-compact .header-card {
            padding: 10px 12px;
            margin-bottom: 10px;
          }
          body.density-compact .cover-img-compact {
            width: 80px;
            height: 80px;
          }
          body.density-compact .title-tr {
            font-size: 16.5px;
          }
          body.density-compact .title-ar {
            font-size: 23px;
          }
          body.density-compact .two-col-table td,
          body.density-compact .stacked-card,
          body.density-compact .line-row {
            padding: 6px 10px;
          }
          body.density-compact .ar-sentence {
            font-size: ${Math.round(17.5 * fontConfig.scale)}px;
            line-height: 1.5;
          }
          body.density-compact .tr-cell,
          body.density-compact .tr-subrow,
          body.density-compact .end-tr-item {
            font-size: 12px;
            line-height: 1.38;
          }
          body.density-compact .section-block,
          body.density-compact .vocab-section,
          body.density-compact .idioms-section {
            margin-top: 11px;
          }
          body.density-compact .vocab-grid-card,
          body.density-compact .idioms-table td,
          body.density-compact .idioms-table th {
            padding: 4px 8px;
            font-size: 11.5px;
          }

          /* TIGHT KADEMESİ (CSS zoom: 0.96 + Sıkı Padding/Font) */
          body.density-tight {
            zoom: 0.96;
          }
          body.density-tight .header-card {
            padding: 8px 10px;
            margin-bottom: 8px;
          }
          body.density-tight .cover-img-compact {
            width: 64px;
            height: 64px;
          }
          body.density-tight .title-tr {
            font-size: 15.5px;
          }
          body.density-tight .title-ar {
            font-size: 21px;
          }
          body.density-tight .two-col-table td,
          body.density-tight .stacked-card,
          body.density-tight .line-row {
            padding: 4px 8px;
          }
          body.density-tight .ar-sentence {
            font-size: ${Math.round(16.5 * fontConfig.scale)}px;
            line-height: 1.42;
          }
          body.density-tight .tr-cell,
          body.density-tight .tr-subrow,
          body.density-tight .end-tr-item {
            font-size: 11.5px;
            line-height: 1.28;
          }
          body.density-tight .section-block,
          body.density-tight .vocab-section,
          body.density-tight .idioms-section {
            margin-top: 8px;
          }
          body.density-tight .vocab-grid-card,
          body.density-tight .idioms-table td,
          body.density-tight .idioms-table th {
            padding: 2.5px 7px;
            font-size: 11px;
          }
          body.density-tight .corporate-footer {
            margin-top: 8px;
            padding-top: 5px;
          }

          /* ULTRA KADEMESİ (CSS zoom: 0.92 + @page 8mm + Maksimum Sıkı Padding/Font) */
          body.density-ultra {
            zoom: 0.92;
          }
          body.density-ultra .header-card {
            padding: 6px 8px;
            margin-bottom: 6px;
          }
          body.density-ultra .cover-img-compact {
            width: 56px;
            height: 56px;
          }
          body.density-ultra .title-tr {
            font-size: 15px;
          }
          body.density-ultra .title-ar {
            font-size: 19.5px;
          }
          body.density-ultra .header-submeta,
          body.density-ultra .qr-caption,
          body.density-ultra .qr-short-url {
            font-size: 9px;
          }
          body.density-ultra .student-info-bar {
            padding: 4px 8px;
            margin-bottom: 6px;
            font-size: 10.5px;
          }
          body.density-ultra .two-col-table td,
          body.density-ultra .stacked-card,
          body.density-ultra .line-row {
            padding: 2px 7px;
          }
          body.density-ultra .ar-sentence {
            font-size: ${Math.round(15.5 * fontConfig.scale)}px;
            line-height: 1.32;
          }
          body.density-ultra .tr-cell,
          body.density-ultra .tr-subrow,
          body.density-ultra .end-tr-item {
            font-size: 11px;
            line-height: 1.22;
          }
          body.density-ultra .section-block,
          body.density-ultra .vocab-section,
          body.density-ultra .idioms-section {
            margin-top: 6px;
          }
          body.density-ultra .section-title {
            padding: 3px 8px;
            margin-bottom: 4px;
            font-size: 11px;
          }
          body.density-ultra .vocab-grid-card,
          body.density-ultra .idioms-table td,
          body.density-ultra .idioms-table th {
            padding: 2px 6px;
            font-size: 10.5px;
          }
          body.density-ultra .vocab-ar {
            font-size: ${Math.round(17 * fontConfig.scale)}px;
            line-height: 1.35;
          }
          body.density-ultra .corporate-footer {
            margin-top: 6px;
            padding-top: 4px;
          }
        </style>
      </head>
      <body class="density-${activeDensity}">
        ${
          printScope !== "answer-key"
            ? `
        <div class="header-card">
          <div class="header-left">
            <div class="badge-row">
              <span class="badge">${
                dialogue.id.startsWith("kutuphane_")
                  ? "KÜTÜPHANE ÇALIŞMA FÖYÜ"
                  : dialogue.id.startsWith("metin_")
                  ? `OKUMA METNİ #${String(rawNum).padStart(2, "0")}`
                  : `DİYALOG #${String(rawNum).padStart(2, "0")}`
              }</span>
              <span class="badge-cefr">CEFR ${escapeHtml(dialogue.seviye)}</span>
              ${
                pdfDocMode === "quiz-sheet"
                  ? `<span class="badge" style="background:#6741d9;">Kitapçık: ${a4QuizSheetData.bookletGroup} Grubu (Form Kodu: #${escapeHtml(
                      a4QuizSheetData.formCode
                    )})</span>`
                  : ""
              }
              <span class="badge-outline">${
                pdfDocMode === "quiz-sheet"
                  ? `YAZILI SINAV (${sixSectionExamData.pointsAllocation.grandTotal} PUAN)`
                  : pdfDocMode === "unvocalized-rubric"
                  ? "HAREKESİZ YOKLAMA & MAARİF RUBRİĞİ (100 PUAN)"
                  : pdfDocMode === "flashcards"
                  ? `✂️ KES-KATLA KELİME KARTLARI (${flashcardGridSize})`
                  : `${dialogue.satirlar.length} Cümle • ${vocabEntries.length} Kelime`
              }</span>
              <span class="badge-outline">${
                includeHarakat ? "Harekeli" : "Harekesiz"
              }</span>
            </div>
            <div class="title-row">
              <h1 class="title-tr">${escapeHtml(effectivePaperTitleTr)}</h1>
              <span class="title-ar" dir="rtl">${formatArHtml(
                dialogue.baslik_ar
              )}</span>
            </div>
            <div class="header-submeta">
              Tarih: ${formattedDate} • Font: ${escapeHtml(
                fontConfig.name.split(" (")[0]
              )} • www.muallimun.net
            </div>
          </div>
          ${
            hasHeaderRight
              ? `
            <div class="header-right">
              ${compactImageHtml}
              ${qrBlockHtml}
            </div>
          `
              : ""
          }
        </div>

        ${
          pdfDocMode === "quiz-sheet"
            ? `
          <div class="student-header-strip">
            <span><strong>Adı Soyadı:</strong> .......................................</span>
            <span><strong>Sınıfı / No:</strong> ..................</span>
            <span><strong>Kitapçık:</strong> ${sixSectionExamData.bookletGroup} Grubu (#${escapeHtml(
                sixSectionExamData.formCode
              )})</span>
            <span><strong>Puan:</strong> ........ / ${
              sixSectionExamData.pointsAllocation.grandTotal
            }</span>
          </div>

          ${
            includeTopicSummary
              ? `<div class="section-block" style="margin-bottom:10px;border:1.5px solid #087f5b;border-radius:10px;padding:8px 12px;background:#f0fdf4;">
                  <div style="font-size:11.5px;font-weight:800;color:#065f46;margin-bottom:3px;">📚 Konu Özeti / Dilbilgisi ve Kelime Kutusu — ${escapeHtml(
                    studioBundle.topicSummary.titleTr
                  )}</div>
                  <div style="font-size:10.5px;color:#1e293b;margin-bottom:5px;">${escapeHtml(
                    studioBundle.topicSummary.ruleSummaryTr
                  )}</div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                    ${studioBundle.topicSummary.rows
                      .map(
                        (r) =>
                          `<div style="background:#ffffff;border:1px solid #bbf7d0;border-radius:7px;padding:4px 8px;font-size:10px;">
                            <strong style="color:#065f46;">${escapeHtml(r.headingTr)}:</strong> ${escapeHtml(r.detailTr)}
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>`
              : ""
          }

          ${
            sixSectionExamData.sec1ArToTr.length > 0
              ? `<div class="section-block" style="margin-bottom:10px;">
                  <div class="section-title">
                    <span>1. BÖLÜM — Arapça → Türkçe Anlam Yazma (${sixSectionExamData.pointsAllocation.sectionTotals[0]} Puan)</span>
                    <span class="section-title-ar" dir="rtl">١. اُكْتُبْ مَعَانِيَ الْكَلِمَاتِ بِالتُّرْكِيَّةِ</span>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${sixSectionExamData.sec1ArToTr
                      .map(
                        (it) =>
                          `<div style="border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;background:#ffffff;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                            <div style="flex:1;border-bottom:1.5px dotted #94a3b8;height:18px;"></div>
                            <div dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:${Math.round(
                            18 * fontConfig.scale
                          )}px;font-weight:700;color:#087f5b;">${it.num}. ${formatArHtml(it.arabic)} <span dir="ltr" style="font-size:9px;color:#64748b;font-family:sans-serif;">(${it.points}p)</span></div>
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>`
              : ""
          }

          ${
            sixSectionExamData.sec2TrToAr.length > 0
              ? `<div class="section-block" style="margin-bottom:10px;">
                  <div class="section-title">
                    <span>2. BÖLÜM — Türkçe → Arapça Yazma (${sixSectionExamData.pointsAllocation.sectionTotals[1]} Puan)</span>
                    <span class="section-title-ar" dir="rtl">٢. اُكْتُبِ الْمُقَابِلَ الْعَرَبِيَّ</span>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${sixSectionExamData.sec2TrToAr
                      .map(
                        (it) =>
                          `<div style="border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;background:#ffffff;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                            <div style="font-size:11px;font-weight:700;color:#1e293b;">${it.num}. ${escapeHtml(it.turkish)} <span style="font-size:9px;color:#6741d9;">(${it.points}p)</span></div>
                            <div style="width:45%;border-bottom:1.5px dotted #94a3b8;height:18px;"></div>
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>`
              : ""
          }

          ${
            sixSectionExamData.sec3FillBlank.length > 0
              ? `<div class="section-block" style="margin-bottom:10px;">
                  <div class="section-title">
                    <span>3. BÖLÜM — Cümle Tamamlama / Boşluk Doldurma (${sixSectionExamData.pointsAllocation.sectionTotals[2]} Puan)</span>
                    <span class="section-title-ar" dir="rtl">٣. اِمْلَأِ الْفَرَاغَاتِ بِالْكَلِمَةِ الْمُنَاسِبَةِ</span>
                  </div>
                  <div class="helper-words-box" style="margin-bottom:6px;padding:6px 10px;">
                    <div class="helper-words-header">
                      <span>📦 Kelime Kutusu (Uygun kelimeyi seçip boşluğa yazınız)</span>
                      <span class="helper-words-ar-title" dir="rtl">صُنْدُوقُ الْكَلِمَاتِ</span>
                    </div>
                    <div class="helper-words-items" dir="rtl">
                      ${sixSectionExamData.sec3WordBank
                        .map(
                          (w) =>
                            `<span class="helper-word-chip">${formatArHtml(w)}</span>`
                        )
                        .join("")}
                    </div>
                  </div>
                  <div style="border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;">
                    ${sixSectionExamData.sec3FillBlank
                      .map(
                        (q, idx) =>
                          `<div style="padding:5px 10px;border-bottom:${
                            idx < sixSectionExamData.sec3FillBlank.length - 1
                              ? "1px solid #e2e8f0"
                              : "none"
                          };background:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};">
                            <div dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:${Math.round(
                            18 * fontConfig.scale
                          )}px;font-weight:700;color:#0f172a;text-align:right;">
                              ${q.num}. ${formatArHtml(q.blankSentenceAr)} <span dir="ltr" style="font-size:9.5px;color:#6741d9;font-family:sans-serif;">(${q.points}p)</span>
                            </div>
                            <div style="font-size:10px;color:#475569;margin-top:1px;"><em>Anlam İpucu: ${escapeHtml(q.turkishMeaning)}</em></div>
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>`
              : ""
          }

          ${
            sixSectionExamData.sec4MultipleChoice.length > 0
              ? `<div class="section-block" style="margin-bottom:10px;">
                  <div class="section-title">
                    <span>4. BÖLÜM — Çoktan Seçmeli Test (${sixSectionExamData.pointsAllocation.sectionTotals[3]} Puan)</span>
                    <span class="section-title-ar" dir="rtl">٤. اِخْتَرِ الْإِجَابَةَ الصَّحِيحَةَ</span>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${sixSectionExamData.sec4MultipleChoice
                      .map(
                        (mc) =>
                          `<div style="border:1px solid #cbd5e1;border-radius:10px;padding:6px 9px;background:#ffffff;break-inside:avoid;">
                            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin-bottom:3px;">
                              <span style="font-size:10px;font-weight:800;color:#6741d9;">Soru ${mc.num} (${mc.points}p)</span>
                              <span dir="rtl" style="font-family:${fontConfig.cssFamily};font-size:${Math.round(
                            17 * fontConfig.scale
                          )}px;font-weight:700;color:#087f5b;">${formatArHtml(mc.arabicPrompt)}</span>
                            </div>
                            <div style="font-size:10px;font-weight:700;color:#334155;margin-bottom:4px;">${escapeHtml(mc.questionStemTr)}</div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 6px;font-size:10px;color:#1e293b;">
                              ${mc.options
                                .map(
                                  (o) =>
                                    `<div><strong>${escapeHtml(o.letter)})</strong> ${escapeHtml(o.textTr)}</div>`
                                )
                                .join("")}
                            </div>
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>`
              : ""
          }

          ${
            sixSectionExamData.sec5Matching.length > 0
              ? `<div class="section-block" style="margin-bottom:10px;">
                  <div class="section-title">
                    <span>5. BÖLÜM — Eşleştirme Alıştırması (${sixSectionExamData.pointsAllocation.sectionTotals[4]} Puan)</span>
                    <span class="section-title-ar" dir="rtl">٥. صِلْ بَيْنَ الْمَجْمُوعَتَيْنِ</span>
                  </div>
                  <table class="vocab-table" style="width:100%;border-collapse:collapse;">
                    <thead>
                      <tr>
                        <th style="width:44%;text-align:right;" dir="rtl">Harfli Arapça İfade</th>
                        <th style="width:14%;text-align:center;">Cevap Kutusu</th>
                        <th style="width:42%;text-align:left;">Numaralı Karışık Türkçe Karşılığı</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sixSectionExamData.sec5Matching
                        .map(
                          (row) =>
                            `<tr>
                              <td dir="rtl" style="text-align:right;font-family:${fontConfig.cssFamily};font-size:${Math.round(
                              17.5 * fontConfig.scale
                            )}px;font-weight:700;color:#087f5b;padding:4px 8px;">
                                <strong>${escapeHtml(row.leftLetter)})</strong> ${formatArHtml(row.leftArabic)}
                              </td>
                              <td style="text-align:center;font-weight:800;font-size:11px;color:#334155;padding:4px;">
                                [ &nbsp;&nbsp;&nbsp;&nbsp; ]
                              </td>
                              <td style="text-align:left;font-size:11px;font-weight:700;color:#1e293b;padding:4px 8px;">
                                <strong>${row.rightNumber}.</strong> ${escapeHtml(row.rightShuffledTr)} <span style="font-size:9px;color:#64748b;">(${row.points}p)</span>
                              </td>
                            </tr>`
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>`
              : ""
          }

          ${
            sixSectionExamData.sec6Morphology.length > 0
              ? `<div class="section-block" style="margin-bottom:10px;">
                  <div class="section-title">
                    <span>6. BÖLÜM — Sarf: Kök &amp; Müfret–Cemî / Mâzî–Muzâri Tablosu (${sixSectionExamData.pointsAllocation.sectionTotals[5]} Puan)</span>
                    <span class="section-title-ar" dir="rtl">٦. جَدْوَلُ الصَّرْفِ وَالْجُذُورِ</span>
                  </div>
                  <table class="two-col-table" style="font-size:11px;">
                    <thead>
                      <tr>
                        <th style="width:28%;">Türkçe Anlamı</th>
                        <th style="width:22%;text-align:center;">Üçlü Kök (جذر)</th>
                        <th style="width:25%;text-align:center;">Müfret / Mâzî</th>
                        <th style="width:25%;text-align:center;">Cemî / Muzâri</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sixSectionExamData.sec6Morphology
                        .map(
                          (r) =>
                            `<tr>
                              <td style="font-weight:700;">${r.num}. ${escapeHtml(r.turkce)} <span style="font-size:9px;color:#6741d9;">(${r.points}p)</span></td>
                              <td style="text-align:center;color:#94a3b8;">.................</td>
                              <td dir="rtl" style="text-align:center;font-family:${fontConfig.cssFamily};font-size:17px;font-weight:700;color:#087f5b;">${
                                r.givenSlot === "form1"
                                  ? formatArHtml(r.form1Ar)
                                  : "................."
                              }</td>
                              <td dir="rtl" style="text-align:center;font-family:${fontConfig.cssFamily};font-size:17px;font-weight:700;color:#087f5b;">${
                                r.givenSlot === "form2"
                                  ? formatArHtml(r.form2Ar)
                                  : "................."
                              }</td>
                            </tr>`
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>`
              : ""
          }
        `
            : pdfDocMode === "unvocalized-rubric"
            ? unvocalizedRubricSectionHtml
            : pdfDocMode === "flashcards"
            ? `
          ${studentHeaderHtml}
          ${flashcardsSectionHtml}
        `
            : pdfDocMode === "pair-infogap"
            ? pairInfoGapSectionHtml
            : `
          ${studentHeaderHtml}
          ${bannerImageHtml}
          ${helperWordsBoxHtml}
          ${dialogueBodyHtml}
          ${vocabSectionHtml}
          ${idiomsSectionHtml}
          ${worksheetSectionHtml}
        `
        }

        <footer class="corporate-footer">
          <span>${
            dialogue.id.startsWith("kutuphane_")
              ? `${escapeHtml(dialogue.baslik_tr)} (${escapeHtml(dialogue.seviye)})`
              : `${dialogue.id.startsWith("metin_") ? "Metin" : "Diyalog"} #${String(rawNum).padStart(2, "0")}: ${escapeHtml(dialogue.baslik_tr)} (${escapeHtml(dialogue.seviye)})`
          } — ${
              pdfDocMode === "quiz-sheet"
                ? `A4 Yazılı Sınav • Kitapçık ${a4QuizSheetData.bookletGroup}`
                : pdfDocMode === "unvocalized-rubric"
                ? "A4 Harekesiz Yazılı Yoklama + Maarif Rubriği"
                : pdfDocMode === "flashcards"
                ? `A4 Kes-Katla Kelime Kartları (${flashcardGridSize})`
                : pdfDocMode === "pair-infogap"
                ? "A4 İkili Bilgi Boşluğu Konuşma Kartları (Öğrenci A & B)"
                : "Arapça Öğrenci Ders Föyü"
            }</span>
          <a href="https://www.muallimun.net" target="_blank" rel="noopener noreferrer" class="corporate-brand" style="text-decoration:none;">www.muallimun.net</a>
        </footer>
        `
            : ""
        }

        ${secondPageAnswerKeyHtml}
      </body>
      </html>
    `;

    setMobileTab("preview");
    const iframe = printIframeRef.current;
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlDocument);
        doc.close();

        const triggerPrint = () => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        };

        const imgs = Array.from(doc.images || []);
        const pendingImgs = imgs.filter((img) => !img.complete);
        const imagesReadyPromise =
          pendingImgs.length === 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                let loadedCount = 0;
                pendingImgs.forEach((img) => {
                  const onFinish = () => {
                    loadedCount++;
                    if (loadedCount >= pendingImgs.length) resolve();
                  };
                  img.addEventListener("load", onFinish, { once: true });
                  img.addEventListener("error", onFinish, { once: true });
                });
              });

        const fontsReadyPromise =
          doc.fonts && typeof doc.fonts.ready?.then === "function"
            ? doc.fonts.ready.then(() => undefined).catch(() => undefined)
            : Promise.resolve();

        let printed = false;
        const finalizePrint = () => {
          if (printed) return;
          printed = true;
          setTimeout(triggerPrint, 120);
        };

        Promise.race([
          Promise.all([imagesReadyPromise, fontsReadyPromise]),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]).then(finalizePrint);
      }
    }
  };

  const speakers = useMemo(
    () => Array.from(new Set(dialogue.satirlar.map((l) => l.konusmaci))),
    [dialogue.satirlar]
  );

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      {/* Gizli Vektörel A4 Yazdırma Iframe'i */}
      <iframe
        ref={printIframeRef}
        title="A4 Ders Notu Yazdırma Katmanı"
        className="fixed w-0 h-0 border-0 opacity-0 pointer-events-none"
      />

      <div
        className="w-full max-w-4xl max-h-[94vh] bg-[#FDFBF7] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL ÜST BAŞLIK (print:hidden) */}
        <div className="print:hidden bg-[#F7EFE1] dark:bg-[var(--background)] px-4 sm:px-5 py-2.5 border-b-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#087F5B] border-b-3 border-[#087F5B] text-white flex items-center justify-center shrink-0">
              <FileText size={17} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] truncate">
                🖨️ A4 Yazılı Sınav, Ders Notu &amp; Quiz Üretici
              </h2>
              <p className="text-[11px] font-semibold text-[var(--muted)] truncate">
                {studioBundle.sourceCodeBracket} {dialogue.baslik_tr} •{" "}
                <span className="text-[#065F46] dark:text-emerald-400 font-bold">
                  www.muallimun.net
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleGenerateAndPrintPdf("student")}
              className="hidden sm:flex px-3.5 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-xs border-b-3 border-[#087F5B] active:translate-y-0.5 transition-all items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer size={15} />
              <span>🖨️ Öğrenci Kağıdını Yazdır</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playClick();
                onClose();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
              aria-label="Kapat"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* MOBİL ERGONOMİ SEKMELERİ (< 768px): [⚙️ Kağıt Ayarları] ve [📄 A4 Önizleme] */}
        <div className="print:hidden md:hidden bg-[#F7EFE1]/80 dark:bg-[var(--background)] px-3 py-2 border-b border-[#E6D7BE] dark:border-[var(--border)] grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClick();
              setMobileTab("settings");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobileTab === "settings"
                ? "bg-[#6741D9] text-white shadow-xs"
                : "bg-white dark:bg-[var(--surface)] text-[var(--muted)] border border-[#E6D7BE]"
            }`}
          >
            <span>⚙️ Kağıt Ayarları</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playClick();
              setMobileTab("preview");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobileTab === "preview"
                ? "bg-[#087F5B] text-white shadow-xs"
                : "bg-white dark:bg-[var(--surface)] text-[var(--muted)] border border-[#E6D7BE]"
            }`}
          >
            <span>📄 A4 Önizleme</span>
          </button>
        </div>

        {/* KOMPAKT SEÇİM ÇİPLERİ / SEGMENTED CONTROLS BARI (print:hidden) */}
        <div
          className={`print:hidden bg-[#FDFBF7] dark:bg-[var(--surface)] px-3 sm:px-4 py-2 border-b-2 border-[#E6D7BE] dark:border-[var(--border)] space-y-1.5 overflow-y-auto md:overflow-visible ${
            mobileTab === "settings"
              ? "flex-1 md:flex-none block"
              : "hidden md:block shrink-0"
          }`}
        >
          {/* KAYNAK, SEVİYE, İÇERİK PAKETİ VE ÖZEL BAŞLIK SEÇİM PANELİ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pb-1.5 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
            <div className="space-y-0.5">
              <label className="block text-[10px] font-extrabold text-[var(--muted)] uppercase">
                1. Materyal Kaynağı
              </label>
              <select
                value={studioSourceId}
                onChange={(e) => {
                  const nextSrc = e.target.value as StudioSourceId;
                  setStudioSourceId(nextSrc);
                  const nextOpts = listStudioPackOptions(
                    nextSrc,
                    studioLevelFilter,
                    initialDialogue
                  );
                  if (nextOpts[0]) setStudioPackId(nextOpts[0].id);
                }}
                className="w-full h-8 px-2 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
              >
                {initialSelection.sourceId === "defterim_custom" && (
                  <option value="defterim_custom">
                    📓 Çalışma Defterim Seçkisi
                  </option>
                )}
                {STUDIO_MATERIAL_SOURCES.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-0.5">
              <label className="block text-[10px] font-extrabold text-[var(--muted)] uppercase">
                2. Seviye (CEFR)
              </label>
              <div className="grid grid-cols-5 gap-1 h-8 bg-[#F7EFE1] dark:bg-[var(--background)] p-0.5 rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
                {(["all", "A1", "A2", "B1", "B2"] as StudioLevelFilter[]).map(
                  (lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        playClick();
                        setStudioLevelFilter(lvl);
                      }}
                      className={`rounded-lg text-[11px] font-extrabold cursor-pointer ${
                        studioLevelFilter === lvl
                          ? "bg-[#087F5B] text-white"
                          : "text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {lvl === "all" ? "Tümü" : lvl}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-0.5">
              <label className="block text-[10px] font-extrabold text-[var(--muted)] uppercase">
                3. İçerik / Paket Seçimi
              </label>
              <select
                value={effectiveStudioPackId}
                onChange={(e) => setStudioPackId(e.target.value)}
                className="w-full h-8 px-2 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
              >
                {studioPackOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-0.5">
              <label className="block text-[10px] font-extrabold text-[var(--muted)] uppercase">
                4. Özel Sınav / Föy Başlığı
              </label>
              <input
                type="text"
                value={customPaperTitle}
                onChange={(e) => setCustomPaperTitle(e.target.value)}
                placeholder={dialogue.baslik_tr}
                className="w-full h-8 px-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
              />
            </div>
          </div>

          {/* 0. Satır: 5 Tek Tık Öğretmen Şablonu + A/B Kitapçık Seçici + ⚙️ Gelişmiş Mizanpaj Ayarları */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
            <div className="flex flex-wrap items-center gap-1 bg-[#F7EFE1] dark:bg-[var(--background)] p-1 rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
              <button
                type="button"
                onClick={() => applyTeacherPreset("student-handout")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  pdfDocMode === "handout"
                    ? "bg-[#087F5B] text-white shadow-xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                📄 Öğrenci Ders Föyü
              </button>
              <button
                type="button"
                onClick={() => applyTeacherPreset("exam-ab")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  pdfDocMode === "quiz-sheet"
                    ? "bg-[#6741D9] text-white shadow-xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                📝 6 Bölümlü Yazılı Sınav (A / B)
              </button>
              <button
                type="button"
                onClick={() => applyTeacherPreset("unvocalized-rubric")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  pdfDocMode === "unvocalized-rubric"
                    ? "bg-teal-700 text-white shadow-xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                ✍️ Harekesiz Yazılı Yoklama + Maarif Rubriği
              </button>
              <button
                type="button"
                onClick={() => applyTeacherPreset("cut-fold-cards")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  pdfDocMode === "flashcards"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                ✂️ Kes-Katla Kelime Kartları
              </button>
              <button
                type="button"
                onClick={() => applyTeacherPreset("pair-infogap")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  pdfDocMode === "pair-infogap"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                🗣️ Eşli Konuşma Kartı (Öğrenci A &amp; B)
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Ders Notu (Handout) için 3 Hızlı Mizanpaj Seçicisi */}
              {pdfDocMode === "handout" && (
                <div className="flex flex-wrap items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-xl border border-emerald-300 dark:border-emerald-700">
                  <span className="text-[11px] font-extrabold text-emerald-900 dark:text-emerald-200">
                    Mizanpaj:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setTranslationMode("show");
                      setTranslationLayout("side-by-side");
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      translationMode !== "hide" &&
                      translationLayout === "side-by-side"
                        ? "bg-[#087F5B] text-white"
                        : "text-emerald-900 dark:text-emerald-200"
                    }`}
                  >
                    Yan Yana
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setTranslationMode("hide");
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      translationMode === "hide"
                        ? "bg-[#087F5B] text-white"
                        : "text-emerald-900 dark:text-emerald-200"
                    }`}
                  >
                    Sadece Arapça
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setTranslationMode("show");
                      setTranslationLayout("stacked");
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      translationMode !== "hide" &&
                      translationLayout === "stacked"
                        ? "bg-[#087F5B] text-white"
                        : "text-emerald-900 dark:text-emerald-200"
                    }`}
                  >
                    Alt Alta Satır
                  </button>
                </div>
              )}

              {pdfDocMode === "quiz-sheet" && (
                <div className="flex items-center gap-1 bg-violet-50 dark:bg-violet-950/50 px-2 py-1 rounded-xl border border-violet-300 dark:border-violet-700">
                  <span className="text-[11px] font-extrabold text-violet-900 dark:text-violet-200">
                    Kitapçık:
                  </span>
                  {(["A", "B"] as const).map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => {
                        playClick();
                        setBookletGroup(grp);
                      }}
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                        bookletGroup === grp
                          ? "bg-[#6741D9] text-white shadow-2xs"
                          : "text-violet-900 dark:text-violet-200 hover:bg-violet-100"
                      }`}
                    >
                      {grp} Grubu
                    </button>
                  ))}
                  <span className="text-[10px] font-mono font-bold text-violet-700 dark:text-violet-300 pl-1">
                    #{sixSectionExamData.formCode}
                  </span>
                </div>
              )}

              {pdfDocMode === "flashcards" && (
                <div className="flex flex-wrap items-center gap-1 bg-amber-50 dark:bg-amber-950/50 px-2 py-1 rounded-xl border border-amber-300 dark:border-amber-700">
                  <span className="text-[11px] font-extrabold text-amber-900 dark:text-amber-200">
                    ✂️ Izgara:
                  </span>
                  {(
                    [
                      { id: "3x3", label: "3x3 (9 Kart)" },
                      { id: "3x4", label: "3x4 (12 Kart)" },
                      { id: "4x4", label: "4x4 (16 Kart)" },
                    ] as const
                  ).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        playClick();
                        setFlashcardGridSize(g.id);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                        flashcardGridSize === g.id
                          ? "bg-amber-600 text-white shadow-2xs"
                          : "text-amber-900 dark:text-amber-200 hover:bg-amber-100/70"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setShowAdvancedSettings((v) => !v);
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  showAdvancedSettings
                    ? "bg-[#6741D9] text-white border-[#5230B5]"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                <span>
                  ⚙️ Gelişmiş Mizanpaj Ayarları{" "}
                  {showAdvancedSettings ? "▲" : "▼"}
                </span>
              </button>
            </div>
          </div>

          {/* YAZILI SINAV MODUNDA 6 ÖZELLEŞTİRİLEBİLİR SORU BÖLÜMÜ SAYACI + KONU ÖZETİ KUTUSU */}
          {pdfDocMode === "quiz-sheet" && (
            <div className="bg-violet-50/70 dark:bg-violet-950/30 rounded-xl border border-violet-200 dark:border-violet-800/70 p-2 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-extrabold text-[#4C28B5] dark:text-purple-300">
                  📝 6 Özelleştirilebilir Sınav Bölümü (0 girilen bölüm gizlenir • Otomatik 100 Puan Dağılımı)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setIncludeTopicSummary((v) => !v);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold border cursor-pointer ${
                      includeTopicSummary
                        ? "bg-[#087F5B] text-white border-[#065F46]"
                        : "bg-white dark:bg-slate-900 text-[var(--muted)] border-slate-300"
                    }`}
                  >
                    📚 Konu Özeti Kutusu: {includeTopicSummary ? "Açık" : "Gizli"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setIncludeAnswerKey((v) => !v);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold border cursor-pointer ${
                      includeAnswerKey
                        ? "bg-[#6741D9] text-white border-[#5230B5]"
                        : "bg-white dark:bg-slate-900 text-[var(--muted)] border-slate-300"
                    }`}
                  >
                    🔑 2. Sayfa Cevap Anahtarı: {includeAnswerKey ? "Açık" : "Gizli"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                {(
                  [
                    { key: "sec1ArToTr", label: "1) AR → TR Anlam", max: 50 },
                    { key: "sec2TrToAr", label: "2) TR → AR Yazma", max: 50 },
                    { key: "sec3FillBlank", label: "3) Boşluk Doldur", max: 50 },
                    { key: "sec4MultipleChoice", label: "4) Çoktan Seçmeli", max: 50 },
                    { key: "sec5Matching", label: "5) Eşleştirme", max: 30 },
                    { key: "sec6Morphology", label: "6) Sarf Tablosu", max: 30 },
                  ] as const
                ).map((sec) => (
                  <div
                    key={sec.key}
                    className="bg-white dark:bg-slate-900 rounded-lg border border-violet-200 dark:border-slate-700 px-2 py-1 flex items-center justify-between gap-1"
                  >
                    <span className="text-[10px] font-bold text-[var(--foreground)] truncate">
                      {sec.label}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={sec.max}
                      value={examCounts[sec.key]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value || "0", 10);
                        setExamCounts((prev) =>
                          clampExamCounts({
                            ...prev,
                            [sec.key]: Number.isNaN(val) ? 0 : val,
                          })
                        );
                      }}
                      className="w-11 h-6 rounded border border-violet-300 dark:border-slate-600 text-center text-xs font-black text-[#4C28B5] dark:text-purple-200 bg-violet-50/50 dark:bg-slate-800"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {showAdvancedSettings && (
            <div className="space-y-1.5 pt-1">
          {/* 1. Satır: Görsel Modu + Çeviri Modu + Sayfaya Sığdır */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* PDF-1: Görsel Seçici */}
            <div className="flex flex-wrap items-center gap-1 bg-[#F7EFE1] dark:bg-[var(--background)] px-2 py-1 rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
              <ImageIcon size={13} className="text-[#065F46] dark:text-emerald-400 shrink-0" />
              <span className="text-[11px] font-extrabold text-[var(--foreground)]">
                Görsel:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: "hide", label: "Gizle" },
                    { id: "compact", label: "Kompakt Kart" },
                    { id: "banner", label: "Geniş Banner" },
                  ] as { id: ImagePrintMode; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setImageMode(opt.id);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      imageMode === opt.id
                        ? "bg-[#087F5B] text-white shadow-xs"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PDF-2: Çeviri & Boşluklu Çalışma Kağıdı Görünüm Seçici */}
            <div className="flex flex-wrap items-center gap-1 bg-[#F7EFE1] dark:bg-[var(--background)] px-2 py-1 rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
              <Languages size={13} className="text-[#6741D9] shrink-0" />
              <span className="text-[11px] font-extrabold text-[var(--foreground)]">
                Dil & Çeviri:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: "show", label: "Arapça + Türkçe" },
                    { id: "hide", label: "Sadece Arapça" },
                    { id: "dotted", label: "Çeviriyi Boş Bırak (TR Boş)" },
                    { id: "ar-dotted", label: "Arapçayı Boş Bırak (AR Boş)" },
                  ] as { id: TranslationPrintMode; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setTranslationMode(opt.id);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      translationMode === opt.id
                        ? "bg-[#6741D9] text-white shadow-xs"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PDF-AUTO-FIT: 4 Kademeli Sayfaya Sığdır Seçici */}
            <div className="flex flex-wrap items-center gap-1 bg-[#F7EFE1] dark:bg-[var(--background)] px-2 py-1 rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
              <span className="text-[11px] font-extrabold text-[var(--foreground)]">
                📐 Sayfaya Sığdır:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: "auto", label: "⚡ Otomatik" },
                    { id: "normal", label: "Normal" },
                    { id: "compact", label: "Sıkı" },
                    { id: "ultra", label: "Maksimum Sıkı" },
                  ] as { id: FitMode; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setFitMode(opt.id);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      fitMode === opt.id
                        ? "bg-[#087F5B] text-white shadow-xs"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Satır: Boşluk Doldurma + Harekeler + QR Kod + Kelime Tablosu + Kalıp İfadeler + Öğrenci Şeridi + 🔑 Cevap Anahtarı (2. Sayfa) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* PDF-3: Boşluk Doldurma (Etkinlik) Toggle */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setClozeMode((v) => !v);
                }}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  clozeMode
                    ? "bg-[#6741D9] text-white border-[#5230B5] shadow-xs"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                <PenTool size={12} />
                <span>Boşluk Doldurma: {clozeMode ? "Açık" : "Kapalı"}</span>
              </button>

              {/* PDF-4: Harekeler Toggle */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIncludeHarakat((v) => !v);
                }}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  includeHarakat
                    ? "bg-[#087F5B] text-white border-[#087F5B] shadow-xs"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                <Sparkles size={12} />
                <span>Harekeler: {includeHarakat ? "Açık" : "Kapalı"}</span>
              </button>

              {/* PDF-5: QR Kod Toggle */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIncludeQrCode((v) => !v);
                }}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  includeQrCode
                    ? "bg-[#087F5B] text-white border-[#087F5B] shadow-xs"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                <QrCode size={12} />
                <span>QR Kod: {includeQrCode ? "Açık" : "Kapalı"}</span>
              </button>

              {/* Sözlük Kelime Tablosu Toggle */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIncludeVocabulary((v) => !v);
                }}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  includeVocabulary
                    ? "bg-[#087F5B] text-white border-[#087F5B] shadow-xs"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                <BookOpen size={12} />
                <span>Kelime Tablosu ({vocabEntries.length})</span>
              </button>

              {/* Kalıp İfadeler Tablosu Toggle */}
              {dialogueIdioms.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setIncludeIdioms((v) => !v);
                  }}
                  className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    includeIdioms
                      ? "bg-[#6741D9] text-white border-[#5230B5] shadow-xs"
                      : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)]"
                  }`}
                >
                  <Sparkles size={12} />
                  <span>Kalıp İfadeler Tablosu ({dialogueIdioms.length})</span>
                </button>
              )}

              {/* Kalıp İfade Anlamlarını Boş Bırak Alt Seçeneği */}
              {dialogueIdioms.length > 0 && (
                <button
                  type="button"
                  disabled={!includeIdioms}
                  title={
                    !includeIdioms
                      ? "Önce Kalıp İfadeler Tablosunu etkinleştirin"
                      : "Kalıp ifade anlamlarını çalışma kağıdında boş bırakır"
                  }
                  onClick={() => {
                    if (!includeIdioms) return;
                    playClick();
                    setIdiomsBlankMode((v) => !v);
                  }}
                  className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 transition-all ${
                    !includeIdioms
                      ? "opacity-45 pointer-events-none select-none bg-stone-100/60 dark:bg-slate-800/40 text-[var(--muted)] border-[#E6D7BE]"
                      : idiomsBlankMode
                      ? "bg-amber-600 text-white border-amber-700 shadow-xs cursor-pointer"
                      : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)] cursor-pointer"
                  }`}
                >
                  <PenTool size={12} />
                  <span>
                    Kalıp İfade Anlamlarını Boş Bırak:{" "}
                    {includeIdioms && idiomsBlankMode ? "Açık" : "Kapalı"}
                  </span>
                </button>
              )}

              {/* Öğrenci Bilgi Şeridi Toggle */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIncludeStudentHeader((v) => !v);
                }}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  includeStudentHeader
                    ? "bg-[#087F5B] text-white border-[#087F5B] shadow-xs"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                <span>
                  👤 Öğrenci Bilgi Şeridi:{" "}
                  {includeStudentHeader ? "Açık" : "Kapalı"}
                </span>
              </button>

              {/* 🔑 Öğretmen Cevap Anahtarı Önizleme Toggle */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIncludeAnswerKey((v) => !v);
                }}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  includeAnswerKey
                    ? "bg-emerald-700 text-white border-emerald-900 shadow-xs"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                <span>
                  🔑 Öğretmen Cevap Anahtarı:{" "}
                  {includeAnswerKey ? "Önizlemede Açık" : "Gizli"}
                </span>
              </button>
            </div>

            {/* Mizanpaj & Sözlük Alt Ayarları Aç/Kapa */}
            <button
              type="button"
              onClick={() => {
                playClick();
                setShowAdvancedLayout((v) => !v);
              }}
              className="px-2.5 py-1 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-[11px] font-extrabold text-[#6741D9] dark:text-[#d0bfff] flex items-center gap-1 cursor-pointer"
            >
              <Columns2 size={12} />
              <span>
                {showAdvancedLayout
                  ? "Mizanpajı Gizle"
                  : "Tablo & Mizanpaj Ayarları"}
              </span>
            </button>
          </div>

          {/* Genişletilebilir Tablo & Sütun Mizanpaj Seçenekleri */}
          {showAdvancedLayout && (
            <div className="pt-1.5 border-t border-[#E6D7BE] dark:border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Sütun & Tercüme Yerleşimi ("Sadece Arapça" seçiliyse pasif) */}
              <div
                aria-disabled={translationMode === "hide"}
                className={`p-2 rounded-xl border border-[#E6D7BE] space-y-1 transition-all ${
                  translationMode === "hide"
                    ? "opacity-45 pointer-events-none select-none bg-stone-100/60 dark:bg-slate-800/40"
                    : "bg-[#F7EFE1]/70 dark:bg-[var(--background)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-[11px] font-extrabold text-[#6741D9]">
                    Tercüme Yerleşimi & Sütun Yönü:
                  </span>
                  {translationMode === "hide" && (
                    <span className="text-[10px] font-bold text-[var(--muted)]">
                      (Sadece Arapça modunda çeviri sütunu bulunmaz)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    {
                      id: "side-by-side" as TranslationLayout,
                      label: "Yan Yana",
                      icon: Columns2,
                    },
                    {
                      id: "stacked" as TranslationLayout,
                      label: "Alt Alta",
                      icon: Rows2,
                    },
                    {
                      id: "grouped-end" as TranslationLayout,
                      label: "Sonda Toplu",
                      icon: AlignJustify,
                    },
                  ].map((l) => {
                    const Icon = l.icon;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          playClick();
                          setTranslationLayout(l.id);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                          translationLayout === l.id
                            ? "bg-[#6741D9] text-white"
                            : "bg-white dark:bg-[var(--surface)] text-[var(--muted)]"
                        }`}
                      >
                        <Icon size={12} />
                        <span>{l.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sütun Yönü Butonları ("Alt Alta" veya "Sonda Toplu" seçildiğinde pasif) */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <div
                    title={
                      translationLayout !== "side-by-side"
                        ? "Sütun yönü sadece Yan Yana görünümde geçerlidir"
                        : undefined
                    }
                    className={`flex flex-wrap gap-1 ${
                      translationLayout !== "side-by-side"
                        ? "opacity-40 pointer-events-none select-none"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      disabled={translationLayout !== "side-by-side"}
                      title="Sütun yönü sadece Yan Yana görünümde geçerlidir"
                      onClick={() => {
                        playClick();
                        setSideBySideOrder("ar-right");
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                        sideBySideOrder === "ar-right"
                          ? "bg-emerald-700 text-white"
                          : "bg-white text-[var(--muted)]"
                      }`}
                    >
                      Sağda Arapça / Solda Türkçe
                    </button>
                    <button
                      type="button"
                      disabled={translationLayout !== "side-by-side"}
                      title="Sütun yönü sadece Yan Yana görünümde geçerlidir"
                      onClick={() => {
                        playClick();
                        setSideBySideOrder("ar-left");
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                        sideBySideOrder === "ar-left"
                          ? "bg-emerald-700 text-white"
                          : "bg-white text-[var(--muted)]"
                      }`}
                    >
                      Solda Arapça / Sağda Türkçe
                    </button>
                  </div>

                  {translationLayout === "grouped-end" && (
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setTranslationPageBreak("same");
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                          translationPageBreak === "same"
                            ? "bg-emerald-700 text-white"
                            : "bg-white text-[var(--muted)]"
                        }`}
                      >
                        Konum: Aynı Sayfada
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setTranslationPageBreak("new");
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                          translationPageBreak === "new"
                            ? "bg-emerald-700 text-white"
                            : "bg-white text-[var(--muted)]"
                        }`}
                      >
                        Konum: Arka Sayfada
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Kelime Tablosu Test Modu & Konumu ("Kelime Tablosu" kapalıysa pasif) */}
              <div
                aria-disabled={!includeVocabulary}
                className={`p-2 rounded-xl border border-[#E6D7BE] space-y-1 transition-all ${
                  !includeVocabulary
                    ? "opacity-45 pointer-events-none select-none bg-stone-100/60 dark:bg-slate-800/40"
                    : "bg-[#F7EFE1]/70 dark:bg-[var(--background)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400">
                    Kelime Tablosu Modu & Konumu{" "}
                    {!includeVocabulary ? "(Kapalı)" : ""}:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: "both" as VocabLanguageMode, label: "Arapça + Türkçe" },
                    {
                      id: "ar-only" as VocabLanguageMode,
                      label: "Anlam Testi (TR Boş)",
                    },
                    {
                      id: "tr-only" as VocabLanguageMode,
                      label: "İmla Testi (AR Boş)",
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        playClick();
                        setVocabLanguageMode(m.id);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                        vocabLanguageMode === m.id
                          ? "bg-[#087F5B] text-white"
                          : "bg-white dark:bg-[var(--surface)] text-[var(--muted)]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setVocabPlacement((p) =>
                        p === "same-page" ? "new-page" : "same-page"
                      );
                    }}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white border border-[#E6D7BE] text-[var(--foreground)] cursor-pointer"
                  >
                    Konum:{" "}
                    {vocabPlacement === "same-page"
                      ? "Aynı Sayfada"
                      : "Yeni Sayfada"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setIncludeWorksheet((v) => !v);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                      includeWorksheet
                        ? "bg-[#6741D9] text-white"
                        : "bg-white border border-[#E6D7BE] text-[var(--muted)]"
                    }`}
                  >
                    +5 Ek Soru: {includeWorksheet ? "Açık" : "Kapalı"}
                  </button>
                </div>
              </div>
            </div>
          )}
            </div>
          )}
        </div>

        {/* CANLI A4 ÇALIŞMA KAĞIDI ÖNİZLEME ALANI */}
        <div
          className={`flex-1 overflow-y-auto p-2.5 sm:p-6 bg-[#EFE6D5]/70 dark:bg-black/40 print:block! ${
            mobileTab === "preview" ? "block" : "hidden md:block"
          }`}
        >
          <div
            ref={a4PageRef}
            style={
              activeDensity === "ultra"
                ? { zoom: 0.92 }
                : activeDensity === "tight"
                ? { zoom: 0.96 }
                : undefined
            }
            className={`max-w-[780px] w-full mx-auto bg-white text-slate-900 light rounded-2xl border-2 border-[#CBD5E1] shadow-lg overflow-x-hidden transition-all ${
              activeDensity === "ultra"
                ? "p-3 space-y-1.5"
                : activeDensity === "tight"
                ? "p-4 space-y-2"
                : activeDensity === "compact"
                ? "p-5 space-y-2.5"
                : "p-7 sm:p-8 space-y-4"
            }`}
          >
            {/* Önizleme Rozeti (print:hidden) */}
            <div className="print:hidden flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-500 border-b border-slate-200 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-[#065F46] dark:text-emerald-400">
                  <Eye size={14} />
                  <span>Canlı A4 Çalışma Kağıdı Önizlemesi</span>
                </span>
                {activeDensity !== "normal" && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                    ✨ Sarkan satırlar otomatik daraltılarak sayfaya sığdırıldı
                  </span>
                )}
              </div>
              <span>Vektörel A4 Çıktı • {fontConfig.name.split(" (")[0]}</span>
            </div>

            {/* A4 ÜST BAŞLIK KARTI */}
            <div
              className={`border-2 border-[#087F5B] border-b-4 rounded-2xl bg-[#FDFBF7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                activeDensity === "ultra"
                  ? "p-2 mb-2"
                  : activeDensity === "tight"
                  ? "p-2.5 mb-2.5"
                  : activeDensity === "compact"
                  ? "p-3 mb-3"
                  : "p-4 mb-5"
              }`}
            >
              <div className="flex-1 min-w-0 space-y-1 w-full">
                <div
                  className={`flex items-center gap-1.5 flex-wrap ${
                    activeDensity === "ultra" ? "text-[10px]" : ""
                  }`}
                >
                  <span className="px-2 py-0.5 rounded-md bg-[#087F5B] text-white text-[10px] font-extrabold">
                    {dialogue.id.startsWith("kutuphane_")
                      ? "KÜTÜPHANE ÇALIŞMA FÖYÜ"
                      : `${dialogue.id.startsWith("metin_") ? "OKUMA METNİ" : "DİYALOG"} #${String(rawNum).padStart(2, "0")}`}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#6741D9] text-white text-[10px] font-extrabold">
                    CEFR {dialogue.seviye}
                  </span>
                  {pdfDocMode === "quiz-sheet" && (
                    <span className="px-2 py-0.5 rounded-md bg-violet-700 text-white text-[10px] font-extrabold">
                      Kitapçık: {sixSectionExamData.bookletGroup} Grubu (Form Kodu: #
                      {sixSectionExamData.formCode})
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md border border-[#CBB692] text-[#5C5042] text-[10px] font-bold">
                    {pdfDocMode === "quiz-sheet"
                      ? `Yazılı Sınav • ${sixSectionExamData.pointsAllocation.grandTotal} Puan`
                      : pdfDocMode === "unvocalized-rubric"
                      ? "Harekesiz Yoklama + Maarif Rubriği • 100 Puan"
                      : `${dialogue.satirlar.length} Cümle • ${vocabEntries.length} Kelime`}
                  </span>
                  <span className="px-2 py-0.5 rounded-md border border-[#CBB692] text-[#5C5042] text-[10px] font-bold">
                    {includeHarakat ? "Harekeli" : "Harekesiz"}
                  </span>
                  {dialogue.odak_gramer && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-extrabold">
                      📌 {dialogue.odak_gramer}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h1
                    className={`font-extrabold text-[#1f1a14] ${
                      activeDensity === "ultra" || activeDensity === "tight"
                        ? "text-base"
                        : activeDensity === "compact"
                        ? "text-lg"
                        : "text-xl"
                    }`}
                  >
                    {effectivePaperTitleTr}
                  </h1>
                  <span
                    dir="rtl"
                    className={`arabic font-bold text-[#065F46] dark:text-emerald-400 ${
                      activeDensity === "ultra"
                        ? "text-xl"
                        : activeDensity === "tight"
                        ? "text-2xl"
                        : activeDensity === "compact"
                        ? "text-2xl sm:text-3xl"
                        : "text-2xl sm:text-3xl"
                    }`}
                  >
                    {formatAr(dialogue.baslik_ar)}
                  </span>
                </div>
              </div>

              {/* Sağ Köşe: Kompakt Görsel ve/veya QR Kod */}
              {(effectiveImageMode === "compact" || includeQrCode) && (
                <div className="flex items-center gap-2.5 sm:border-l sm:border-dashed sm:border-slate-300 sm:pl-3 shrink-0">
                  {effectiveImageMode === "compact" && (
                    <img
                      src={imagePath}
                      alt={dialogue.baslik_tr}
                      loading="eager"
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                      className={`aspect-square object-contain bg-white rounded-xl border border-slate-300 shrink-0 ${
                        activeDensity === "ultra"
                          ? "w-14 h-14"
                          : activeDensity === "tight"
                          ? "w-16 h-16"
                          : activeDensity === "compact"
                          ? "w-20 h-20"
                          : "w-24 h-24"
                      }`}
                    />
                  )}
                  {includeQrCode && (
                    <a
                      href={dialogueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${dialogueUrl} adresini aç`}
                      className="flex flex-col items-center gap-0.5 shrink-0 group hover:opacity-90 transition-opacity"
                    >
                      <div
                        className={`flex items-center justify-center ${
                          activeDensity === "ultra"
                            ? "w-14 h-14"
                            : activeDensity === "tight"
                            ? "w-16 h-16"
                            : activeDensity === "compact"
                            ? "w-20 h-20"
                            : "w-24 h-24"
                        }`}
                        dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
                      />
                      <span
                        className={`${
                          activeDensity === "ultra" ? "text-[8px]" : "text-[9px]"
                        } font-extrabold text-[#065F46] dark:text-emerald-400 whitespace-nowrap group-hover:underline`}
                      >
                        Dinlemek için okutun
                      </span>
                      {activeDensity !== "ultra" && (
                        <span className="text-[9px] text-slate-500 font-mono whitespace-nowrap">
                          {shortDisplayUrl}
                        </span>
                      )}
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* 👤 ÖĞRENCİ BİLGİ ŞERİDİ */}
            {(includeStudentHeader ||
              pdfDocMode === "quiz-sheet" ||
              pdfDocMode === "unvocalized-rubric") && (
              <div
                className={`border border-slate-300 rounded-xl bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-slate-800 ${
                  activeDensity === "ultra"
                    ? "px-2.5 py-1 text-[10.5px]"
                    : activeDensity === "tight"
                    ? "px-3 py-1.5 text-[11px]"
                    : activeDensity === "compact"
                    ? "px-3 py-1.5 text-[11.5px]"
                    : "px-3.5 py-2 text-xs"
                }`}
              >
                <span>
                  <strong>Adı Soyadı:</strong>{" "}
                  <span className="text-slate-600">
                    ..................................
                  </span>
                </span>
                <span>
                  <strong>Sınıfı / No:</strong>{" "}
                  <span className="text-slate-600">.................</span>
                </span>
                {pdfDocMode === "quiz-sheet" ? (
                  <span>
                    <strong>Kitapçık:</strong>{" "}
                    <span className="font-extrabold text-[#6741D9]">
                      {sixSectionExamData.bookletGroup} Grubu (#
                      {sixSectionExamData.formCode})
                    </span>
                  </span>
                ) : (
                  <span>
                    <strong>Tarih:</strong>{" "}
                    <span className="text-slate-600">.... / .... / 2026</span>
                  </span>
                )}
                <span>
                  <strong>Puan:</strong>{" "}
                  <span className="text-slate-600">
                    ....... /{" "}
                    {pdfDocMode === "quiz-sheet"
                      ? sixSectionExamData.pointsAllocation.grandTotal
                      : 100}
                  </span>
                </span>
              </div>
            )}

            {pdfDocMode === "quiz-sheet" ? (
              <div className="space-y-4">
                {/* KONU ÖZETİ / DİLBİLGİSİ VE KELİME KUTUSU */}
                {includeTopicSummary && (
                  <div className="rounded-xl border-2 border-[#087F5B]/60 bg-emerald-50/60 p-3 space-y-2 break-inside-avoid">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#065F46]">
                        📚 Konu Özeti &amp; Dilbilgisi Kutusu —{" "}
                        {studioBundle.topicSummary.titleTr}
                      </span>
                      <span
                        dir="rtl"
                        className="arabic text-base font-bold text-[#065F46]"
                      >
                        {formatAr(studioBundle.topicSummary.titleAr)}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-700 leading-snug">
                      {studioBundle.topicSummary.ruleSummaryTr}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {studioBundle.topicSummary.rows.map((r, rIdx) => (
                        <div
                          key={rIdx}
                          className="rounded-lg bg-white border border-emerald-200 px-2.5 py-1.5 text-[11px]"
                        >
                          <strong className="text-[#065F46]">
                            {r.headingTr}:
                          </strong>{" "}
                          <span className="text-slate-700">{r.detailTr}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1. BÖLÜM: ARAPÇA -> TÜRKÇE ANLAM YAZMA */}
                {sixSectionExamData.sec1ArToTr.length > 0 && (
                  <div className="space-y-1.5 break-inside-avoid">
                    <div className="flex items-center justify-between bg-[#F7EFE1] border border-[#E6D7BE] border-l-4 border-l-[#087F5B] px-3 py-1.5 rounded-lg">
                      <span className="text-xs font-extrabold text-slate-900">
                        1. BÖLÜM — Arapça → Türkçe Anlam Yazma (
                        {sixSectionExamData.pointsAllocation.sectionTotals[0]}{" "}
                        Puan)
                      </span>
                      <span
                        dir="rtl"
                        className="arabic text-base font-bold text-[#065F46]"
                      >
                        ١. اُكْتُبْ مَعَانِيَ الْكَلِمَاتِ بِالتُّرْكِيَّةِ
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sixSectionExamData.sec1ArToTr.map((it) => (
                        <div
                          key={it.num}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
                          <div
                            dir="rtl"
                            className="arabic text-xl font-bold text-[#065F46]"
                          >
                            {it.num}. {formatAr(it.arabic)}{" "}
                            <span
                              dir="ltr"
                              className="text-[10px] font-sans text-slate-500"
                            >
                              ({it.points}p)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. BÖLÜM: TÜRKÇE -> ARAPÇA YAZMA */}
                {sixSectionExamData.sec2TrToAr.length > 0 && (
                  <div className="space-y-1.5 break-inside-avoid">
                    <div className="flex items-center justify-between bg-[#F7EFE1] border border-[#E6D7BE] border-l-4 border-l-[#6741D9] px-3 py-1.5 rounded-lg">
                      <span className="text-xs font-extrabold text-slate-900">
                        2. BÖLÜM — Türkçe → Arapça Yazma (
                        {sixSectionExamData.pointsAllocation.sectionTotals[1]}{" "}
                        Puan)
                      </span>
                      <span
                        dir="rtl"
                        className="arabic text-base font-bold text-[#6741D9]"
                      >
                        ٢. اُكْتُبِ الْمُقَابِلَ الْعَرَبِيَّ
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sixSectionExamData.sec2TrToAr.map((it) => (
                        <div
                          key={it.num}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <span className="text-xs font-bold text-slate-800">
                            {it.num}. {it.turkish}{" "}
                            <span className="text-[10px] text-[#6741D9]">
                              ({it.points}p)
                            </span>
                          </span>
                          <div className="w-2/5 border-b border-dotted border-slate-400 h-5" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. BÖLÜM: CÜMLE TAMAMLAMA / BOŞLUK DOLDURMA */}
                {sixSectionExamData.sec3FillBlank.length > 0 && (
                  <div className="space-y-2 break-inside-avoid">
                    <div className="flex items-center justify-between bg-[#F7EFE1] border border-[#E6D7BE] border-l-4 border-l-[#087F5B] px-3 py-1.5 rounded-lg">
                      <span className="text-xs font-extrabold text-slate-900">
                        3. BÖLÜM — Cümle Tamamlama / Boşluk Doldurma (
                        {sixSectionExamData.pointsAllocation.sectionTotals[2]}{" "}
                        Puan)
                      </span>
                      <span
                        dir="rtl"
                        className="arabic text-base font-bold text-[#065F46]"
                      >
                        ٣. اِمْلَأِ الْفَرَاغَاتِ بِالْكَلِمَةِ الْمُنَاسِبَةِ
                      </span>
                    </div>
                    <div className="bg-[#F3F0FF] border-2 border-dashed border-[#6741D9] rounded-xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-[#4C28B5]">
                        <span>📦 Kelime Kutusu</span>
                        <span dir="rtl" className="arabic text-base font-bold">
                          صُنْدُوقُ الْكَلِمَاتِ
                        </span>
                      </div>
                      <div
                        dir="rtl"
                        className="flex flex-wrap items-center justify-center gap-2"
                      >
                        {sixSectionExamData.sec3WordBank.map((w, idx) => (
                          <span
                            key={`${w}-${idx}`}
                            className="arabic text-lg font-bold px-3 py-0.5 rounded-lg bg-white border border-[#D0BFFF] text-[#3B1FA8]"
                          >
                            {formatAr(w)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200">
                      {sixSectionExamData.sec3FillBlank.map((q) => (
                        <div
                          key={q.num}
                          className="py-1.5 px-3 bg-white odd:bg-slate-50/70 space-y-0.5"
                        >
                          <div
                            dir="rtl"
                            className="arabic text-xl font-bold text-slate-900 text-right"
                          >
                            {q.num}. {formatAr(q.blankSentenceAr)}{" "}
                            <span
                              dir="ltr"
                              className="text-[10px] font-sans text-[#6741D9]"
                            >
                              ({q.points}p)
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-600">
                            Anlam İpucu: {q.turkishMeaning}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. BÖLÜM: ÇOKTAN SEÇMELİ TEST (2x2 ŞIKLAR) */}
                {sixSectionExamData.sec4MultipleChoice.length > 0 && (
                  <div className="space-y-1.5 break-inside-avoid">
                    <div className="flex items-center justify-between bg-[#F7EFE1] border border-[#E6D7BE] border-l-4 border-l-[#6741D9] px-3 py-1.5 rounded-lg">
                      <span className="text-xs font-extrabold text-slate-900">
                        4. BÖLÜM — Çoktan Seçmeli Test (
                        {sixSectionExamData.pointsAllocation.sectionTotals[3]}{" "}
                        Puan)
                      </span>
                      <span
                        dir="rtl"
                        className="arabic text-base font-bold text-[#6741D9]"
                      >
                        ٤. اِخْتَرِ الْإِجَابَةَ الصَّحِيحَةَ
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {sixSectionExamData.sec4MultipleChoice.map((mc) => (
                        <div
                          key={mc.num}
                          className="rounded-xl border border-slate-300 bg-white p-2.5 space-y-1.5"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[10px] font-extrabold text-[#6741D9] bg-[#F3F0FF] px-2 py-0.5 rounded-md">
                              Soru {mc.num} ({mc.points}p)
                            </span>
                            <span
                              dir="rtl"
                              className="arabic text-lg font-bold text-[#065F46] text-right"
                            >
                              {formatAr(mc.arabicPrompt)}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-700">
                            {mc.questionStemTr}
                          </p>
                          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-800">
                            {mc.options.map((o) => (
                              <div key={o.letter} className="leading-snug">
                                <strong className="text-[#065F46]">
                                  {o.letter})
                                </strong>{" "}
                                {o.textTr}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. BÖLÜM: EŞLEŞTİRME ALIŞTIRMASI */}
                {sixSectionExamData.sec5Matching.length > 0 && (
                  <div className="space-y-1.5 break-inside-avoid">
                    <div className="flex items-center justify-between bg-[#F7EFE1] border border-[#E6D7BE] border-l-4 border-l-[#087F5B] px-3 py-1.5 rounded-lg">
                      <span className="text-xs font-extrabold text-slate-900">
                        5. BÖLÜM — Eşleştirme Alıştırması (
                        {sixSectionExamData.pointsAllocation.sectionTotals[4]}{" "}
                        Puan)
                      </span>
                      <span
                        dir="rtl"
                        className="arabic text-base font-bold text-[#065F46]"
                      >
                        ٥. صِلْ بَيْنَ الْمَجْمُوعَتَيْنِ
                      </span>
                    </div>
                    <div className="border border-slate-300 rounded-xl overflow-hidden">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-extrabold">
                            <th dir="rtl" className="py-1.5 px-3 text-right w-[44%]">
                              Harfli Arapça İfade
                            </th>
                            <th className="py-1.5 px-2 text-center w-[14%] border-x border-slate-200">
                              Cevap Kutusu
                            </th>
                            <th className="py-1.5 px-3 text-left w-[42%]">
                              Numaralı Karışık Türkçe Karşılığı
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sixSectionExamData.sec5Matching.map((row) => (
                            <tr
                              key={row.rowIndex}
                              className="bg-white odd:bg-slate-50/70"
                            >
                              <td
                                dir="rtl"
                                className="py-1 px-3 text-right arabic text-xl font-bold text-[#065F46]"
                              >
                                {row.leftLetter}) {formatAr(row.leftArabic)}
                              </td>
                              <td className="py-1 px-2 text-center font-extrabold text-slate-700 border-x border-dashed border-slate-200">
                                [ &nbsp;&nbsp;&nbsp; ]
                              </td>
                              <td className="py-1 px-3 text-left font-bold text-slate-800">
                                <span className="text-[#6741D9] font-extrabold mr-1">
                                  {row.rightNumber}.
                                </span>
                                {row.rightShuffledTr}{" "}
                                <span className="text-[10px] text-slate-500">
                                  ({row.points}p)
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 6. BÖLÜM: SARF (KÖK & MÜFRET-CEMÎ / FİİL) TABLOSU */}
                {sixSectionExamData.sec6Morphology.length > 0 && (
                  <div className="space-y-1.5 break-inside-avoid">
                    <div className="flex items-center justify-between bg-[#F7EFE1] border border-[#E6D7BE] border-l-4 border-l-[#6741D9] px-3 py-1.5 rounded-lg">
                      <span className="text-xs font-extrabold text-slate-900">
                        6. BÖLÜM — Sarf: Kök &amp; Müfret–Cemî / Mâzî–Muzâri Tablosu (
                        {sixSectionExamData.pointsAllocation.sectionTotals[5]}{" "}
                        Puan)
                      </span>
                      <span
                        dir="rtl"
                        className="arabic text-base font-bold text-[#6741D9]"
                      >
                        ٦. جَدْوَلُ الصَّرْفِ وَالْجُذُورِ
                      </span>
                    </div>
                    <div className="border border-slate-300 rounded-xl overflow-hidden">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-extrabold">
                            <th className="py-1.5 px-3 text-left w-[28%]">
                              Türkçe Anlamı
                            </th>
                            <th className="py-1.5 px-2 text-center w-[22%]">
                              Üçlü Kök (جذر)
                            </th>
                            <th className="py-1.5 px-2 text-center w-[25%]">
                              Müfret / Mâzî
                            </th>
                            <th className="py-1.5 px-2 text-center w-[25%]">
                              Cemî / Muzâri
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sixSectionExamData.sec6Morphology.map((r) => (
                            <tr
                              key={r.num}
                              className="bg-white odd:bg-slate-50/70"
                            >
                              <td className="py-1.5 px-3 font-bold text-slate-800">
                                {r.num}. {r.turkce}{" "}
                                <span className="text-[10px] text-[#6741D9]">
                                  ({r.points}p)
                                </span>
                              </td>
                              <td className="py-1.5 px-2 text-center text-slate-400">
                                .................
                              </td>
                              <td
                                dir="rtl"
                                className="py-1.5 px-2 text-center arabic text-lg font-bold text-[#065F46]"
                              >
                                {r.givenSlot === "form1"
                                  ? formatAr(r.form1Ar)
                                  : "................."}
                              </td>
                              <td
                                dir="rtl"
                                className="py-1.5 px-2 text-center arabic text-lg font-bold text-[#065F46]"
                              >
                                {r.givenSlot === "form2"
                                  ? formatAr(r.form2Ar)
                                  : "................."}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : pdfDocMode === "unvocalized-rubric" ? (
              <div className="space-y-4">
                <div className="space-y-1.5 break-inside-avoid">
                  <div className="flex items-center justify-between bg-[#F7EFE1] border border-[#E6D7BE] border-l-4 border-l-teal-700 px-3 py-1.5 rounded-lg">
                    <span className="text-xs font-extrabold text-slate-900">
                      BÖLÜM 1 — Harekesiz Metni Harekeleme, Tercüme ve İ&apos;rab Yoklaması
                    </span>
                    <span
                      dir="rtl"
                      className="arabic text-base font-bold text-teal-800"
                    >
                      أ. الضَّبْطُ بِالشَّكْلِ وَالتَّرْجَمَةُ وَالْإِعْرَابُ
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-600 px-1">
                    Yönerge: Aşağıdaki harekesiz Arapça cümleleri tam harekeleyiniz, temel ögelerin i&apos;rabını belirterek Türkçe tercümesini noktalı alana yazınız.
                  </p>
                  <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200">
                    {unvocalizedRubricItems.map((item) => (
                      <div
                        key={item.num}
                        className="p-3 bg-white odd:bg-slate-50/70 space-y-1.5"
                      >
                        <div
                          dir="rtl"
                          className="flex items-baseline justify-between gap-3"
                        >
                          <div className="arabic text-2xl font-bold text-slate-900 leading-loose text-right flex-1">
                            <span className="text-sm text-[#065F46] ml-1.5">
                              {item.num}.
                            </span>
                            {formatArabicText(
                              item.unvocalizedAr,
                              false,
                              arabicFont
                            )}
                          </div>
                          <span
                            dir="ltr"
                            className="text-[10px] font-extrabold text-[#6741D9] bg-[#F3F0FF] border border-[#D0BFFF] px-2 py-0.5 rounded-md shrink-0"
                          >
                            {item.points}p
                          </span>
                        </div>
                        <div className="flex items-end gap-2 text-[11px] text-slate-600">
                          <strong className="shrink-0">
                            Tercüme &amp; İ&apos;rab Notu:
                          </strong>
                          <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 break-inside-avoid">
                  <div className="flex items-center justify-between bg-[#F3F0FF] border border-[#D0BFFF] border-l-4 border-l-[#6741D9] px-3 py-1.5 rounded-lg">
                    <span className="text-xs font-extrabold text-[#4C28B5]">
                      📊 Maarif Modeli 4 Temel Dil Becerisi Değerlendirme Ölçeği (Rubrik — Toplam 100 Puan)
                    </span>
                    <span
                      dir="rtl"
                      className="arabic text-base font-bold text-[#4C28B5]"
                    >
                      مِقْيَاسُ التَّقْوِيمِ الشَّامِلِ
                    </span>
                  </div>
                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <table className="w-full border-collapse text-[11px] text-left">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-extrabold">
                          <th className="py-1.5 px-2.5 w-[24%]">
                            Temel Dil Becerisi
                          </th>
                          <th className="py-1.5 px-2 w-[22%]">
                            Geliştirilmeli (0–10p)
                          </th>
                          <th className="py-1.5 px-2 w-[22%]">
                            Yeterli (11–18p)
                          </th>
                          <th className="py-1.5 px-2 w-[20%]">
                            Yetkin (19–25p)
                          </th>
                          <th className="py-1.5 px-2 text-center w-[12%]">
                            Puan
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {MAARIF_RUBRIC_CRITERIA.map((r) => (
                          <tr
                            key={r.skillTr}
                            className="bg-white odd:bg-slate-50/70"
                          >
                            <td className="py-1.5 px-2.5">
                              <div className="font-extrabold text-slate-900">
                                {r.skillTr}
                              </div>
                              <div
                                dir="rtl"
                                className="arabic text-sm font-bold text-[#065F46]"
                              >
                                {r.skillAr}
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-slate-600">
                              {r.developing}
                            </td>
                            <td className="py-1.5 px-2 text-slate-700">
                              {r.proficient}
                            </td>
                            <td className="py-1.5 px-2 text-[#065F46] font-bold">
                              {r.advanced}
                            </td>
                            <td className="py-1.5 px-2 text-center font-extrabold text-slate-900">
                              .... / {r.maxPoints}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-emerald-50">
                          <td
                            colSpan={4}
                            className="py-1.5 px-2.5 text-right font-extrabold text-[#065F46]"
                          >
                            Öğretmen Genel Değerlendirmesi &amp; Toplam Puan:
                          </td>
                          <td className="py-1.5 px-2 text-center font-extrabold text-[#065F46]">
                            ...... / 100
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : pdfDocMode === "flashcards" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-[#065F46] bg-emerald-50/70 border border-emerald-200 px-3 py-2 rounded-xl">
                  <span>
                    ✂️ Kes-Yapıştır Kelime & Cümle Kartları ({flashcardGridSize} •{" "}
                    {flashcardItems.length} Kart) — Kesikli çizgilerden keserek kart oluşturunuz
                  </span>
                  <span dir="rtl" className="arabic text-base font-bold text-[#065F46]">
                    بطاقات المفردات والعبارات
                  </span>
                </div>
                <div
                  className={`grid gap-3 ${
                    flashcardGridSize === "4x4"
                      ? "grid-cols-2 sm:grid-cols-4"
                      : "grid-cols-2 sm:grid-cols-3"
                  }`}
                >
                  {flashcardItems.map((fc, idx) => {
                    const showBlankTr =
                      translationMode === "dotted" || vocabLanguageMode === "ar-only";
                    const showBlankAr =
                      translationMode === "ar-dotted" || vocabLanguageMode === "tr-only";
                    return (
                      <div
                        key={`fc-${idx}`}
                        className="border-2 border-dashed border-slate-400 rounded-xl p-3 flex flex-col justify-between items-center text-center bg-white relative break-inside-avoid min-h-[155px]"
                      >
                        <div className="w-full flex items-center justify-between text-[10px] font-extrabold text-slate-400 mb-1">
                          <span>✂️ #{idx + 1}</span>
                          {fc.kok && (
                            <span
                              dir="rtl"
                              className="arabic text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200"
                            >
                              جذر: {fc.kok}
                            </span>
                          )}
                        </div>

                        {fc.imageUrl && (
                          <div className="my-1 flex items-center justify-center">
                            <img
                              src={fc.imageUrl}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                              className="aspect-square w-20 h-20 object-contain mx-auto rounded-lg border border-slate-200 bg-slate-50/50 p-1"
                            />
                          </div>
                        )}

                        <div className="my-1.5 w-full">
                          {showBlankAr ? (
                            <div className="w-4/5 mx-auto border-b-2 border-dotted border-slate-400 h-7 my-2" />
                          ) : (
                            <div
                              dir="rtl"
                              className="font-arabic arabic text-2xl font-bold text-[#065F46] leading-snug"
                            >
                              {formatAr(fc.arabic)}
                            </div>
                          )}
                          {fc.morphInfo && !showBlankAr && (
                            <div
                              dir="rtl"
                              className="arabic text-xs font-bold text-violet-800 bg-violet-50 border border-violet-200 rounded-md px-2 py-0.5 mt-1 inline-block"
                            >
                              {formatAr(fc.morphInfo)}
                            </div>
                          )}
                        </div>

                        <div className="w-full pt-1.5 mt-1 border-t border-dashed border-slate-200">
                          {showBlankTr ? (
                            <div
                              className="text-xs font-bold text-slate-400 tracking-widest py-0.5"
                              title="Öğrenci yazım alanı"
                            >
                              ....................
                            </div>
                          ) : (
                            <div className="text-xs font-extrabold text-slate-800 leading-snug">
                              {fc.turkish}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : pdfDocMode === "pair-infogap" ? (
              <div className="space-y-3">
                {(
                  [
                    {
                      role: "A" as const,
                      title: "🅰️ ÖĞRENCİ A KONUŞMA KARTI",
                      borderCls: "border-[#087F5B]",
                      headCls: "bg-emerald-50 text-[#065F46] border-[#087F5B]",
                      items: infoGapDeck.studentACard,
                    },
                    {
                      role: "B" as const,
                      title: "🅱️ ÖĞRENCİ B KONUŞMA KARTI",
                      borderCls: "border-[#6741D9]",
                      headCls: "bg-[#F3F0FF] text-[#4C28B5] border-[#6741D9]",
                      items: infoGapDeck.studentBCard,
                    },
                  ] as const
                ).map((half, hIdx) => (
                  <div key={half.role} className="space-y-3">
                    {hIdx === 1 && (
                      <div className="flex items-center gap-3 py-1">
                        <div className="flex-1 border-t-2 border-dashed border-[#087F5B]" />
                        <span className="px-3 py-1 rounded-full bg-emerald-50 border border-dashed border-[#087F5B] text-[11px] font-extrabold text-[#065F46] whitespace-nowrap">
                          ✂️ Buradan Kesiniz — Üst Kart: Öğrenci A • Alt Kart: Öğrenci B
                        </span>
                        <div className="flex-1 border-t-2 border-dashed border-[#087F5B]" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl border-2 ${half.borderCls} bg-white overflow-hidden break-inside-avoid`}
                    >
                      <div
                        className={`px-3.5 py-2 border-b ${half.headCls} flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold`}
                      >
                        <span>
                          {half.title} • {dialogue.baslik_tr}
                        </span>
                        <span className="text-slate-700 font-bold">
                          Adı Soyadı: .................................
                        </span>
                      </div>
                      <div className="divide-y divide-dashed divide-slate-200 px-3 py-1">
                        {half.items.map((ln) => (
                          <div
                            key={`${half.role}-${ln.lineNumber}`}
                            className="py-1.5 space-y-0.5"
                          >
                            <div
                              dir="rtl"
                              lang="ar"
                              className="flex items-baseline justify-between gap-2 text-right arabic text-xl font-bold text-slate-900 leading-[1.95]"
                            >
                              <div>
                                <span className="text-sm text-[#065F46] ml-1.5">
                                  #{ln.lineNumber} {formatAr(ln.speakerAr)}:
                                </span>
                                {formatAr(ln.displayArabic)}
                              </div>
                              <span
                                dir="ltr"
                                className={`font-sans text-[10px] font-extrabold px-2 py-0.5 rounded shrink-0 ${
                                  ln.isFull
                                    ? "bg-emerald-50 text-[#065F46] border border-emerald-200"
                                    : "bg-amber-50 text-amber-900 border border-amber-300"
                                }`}
                              >
                                {ln.isFull ? "Sıra Sizde" : "Bilgi Boşluğu"}
                              </span>
                            </div>
                            <div
                              className={`text-[11px] ${
                                ln.isFull
                                  ? "text-slate-600 font-semibold"
                                  : "text-amber-900 font-bold"
                              }`}
                            >
                              {ln.displayTurkishCue}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
            {/* PDF-1: Geniş Banner Görsel Modu (width: 100%, max-height: 135px, object-fit: cover) */}
            {effectiveImageMode === "banner" && (
              <div className="w-full rounded-xl overflow-hidden border border-slate-300 bg-white flex items-center justify-center py-1">
                <img
                  src={imagePath}
                  alt={dialogue.baslik_tr}
                  loading="eager"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-[135px] h-[135px] aspect-square object-contain block"
                />
              </div>
            )}

            {/* PDF-3: Kelime Kutusu (الكلمات المساعدة) — Boşluk Doldurma Modu Aktifse */}
            {clozeMode && clozeData.helperWords.length > 0 && (
              <div
                className={`bg-[#F3F0FF] border-2 border-dashed border-[#6741D9] rounded-xl ${
                  activeDensity === "ultra"
                    ? "p-1.5 space-y-1"
                    : activeDensity === "tight"
                    ? "p-2 space-y-1.5"
                    : "p-3 space-y-2"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-extrabold text-[#4C28B5]">
                  <span>✏️ Kelime Kutusu (Boşlukları doldurunuz)</span>
                  <span dir="rtl" className="arabic text-lg font-bold">
                    الكلمات المساعدة
                  </span>
                </div>
                <div
                  dir="rtl"
                  className="flex flex-wrap items-center justify-center gap-2"
                >
                  {clozeData.helperWords.map((word, idx) => (
                    <span
                      key={`${word}-${idx}`}
                      className="arabic text-lg sm:text-xl font-bold px-3 py-0.5 rounded-lg bg-white border border-[#D0BFFF] text-[#3B1FA8]"
                    >
                      {formatAr(word)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* DİYALOG SATIRLARI ÖNİZLEMESİ */}
            {translationMode === "hide" ? (
              <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200">
                {dialogue.satirlar.map((line, idx) => {
                  const spIdx = speakers.indexOf(line.konusmaci);
                  const isEmerald = spIdx % 2 === 0;
                  const arText = clozeData.processedLines[idx] || line.arapca;
                  return (
                    <div
                      key={line.sira}
                      dir="rtl"
                      className={`${
                        activeDensity === "ultra"
                          ? "py-0.5 px-2"
                          : activeDensity === "tight"
                          ? "py-1 px-2"
                          : activeDensity === "compact"
                          ? "py-1.5 px-2.5"
                          : "py-2.5 px-3"
                      } flex items-baseline gap-2 break-inside-avoid ${
                        idx % 2 === 0 ? "bg-slate-50" : "bg-white"
                      }`}
                    >
                      <span
                        className={`arabic text-base font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                          isEmerald
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-violet-50 text-violet-800 border-violet-200"
                        }`}
                      >
                        {formatAr(line.konusmaci_ar)}
                      </span>
                      <span
                        className={`arabic font-bold text-slate-900 ${
                          activeDensity === "ultra"
                            ? "text-[15.5px] leading-tight"
                            : activeDensity === "tight"
                            ? "text-[16.5px] leading-snug"
                            : activeDensity === "compact"
                            ? "text-[17.5px] leading-snug"
                            : "text-[19px] leading-relaxed"
                        }`}
                      >
                        {formatAr(arText)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : translationLayout === "stacked" ? (
              /* ALT ALTA MODU: Üstte Arapça (dir="rtl"), hemen altında kesikli çizgi ile ayrılmış Türkçe tercüme (dir="ltr") */
              <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200">
                {dialogue.satirlar.map((line, idx) => {
                  const spIdx = speakers.indexOf(line.konusmaci);
                  const isEmerald = spIdx % 2 === 0;
                  const arText = clozeData.processedLines[idx] || line.arapca;

                  return (
                    <div
                      key={line.sira}
                      className={`${
                        activeDensity === "ultra"
                          ? "py-0.5 px-2"
                          : activeDensity === "tight"
                          ? "py-1 px-2"
                          : activeDensity === "compact"
                          ? "py-1.5 px-2.5"
                          : "py-2.5 px-3"
                      } break-inside-avoid ${
                        idx % 2 === 0 ? "bg-slate-50" : "bg-white"
                      }`}
                    >
                      <div
                        dir="rtl"
                        className="text-right flex items-baseline gap-2"
                      >
                        <span
                          className={`arabic text-base font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                            isEmerald
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-violet-50 text-violet-800 border-violet-200"
                          }`}
                        >
                          {formatAr(line.konusmaci_ar)}
                        </span>
                        {translationMode === "ar-dotted" ? (
                          <div className="flex-1 border-b border-dotted border-slate-400 h-7" />
                        ) : (
                          <span
                            className={`arabic font-bold text-slate-900 ${
                              activeDensity === "ultra"
                                ? "text-[15.5px] leading-tight"
                                : activeDensity === "tight"
                                ? "text-[16.5px] leading-snug"
                                : activeDensity === "compact"
                                ? "text-[17.5px] leading-snug"
                                : "text-[19px] leading-relaxed"
                            }`}
                          >
                            {formatAr(arText)}
                          </span>
                        )}
                      </div>

                      <div
                        dir="ltr"
                        className="mt-1 pt-1 border-t border-slate-200/70 text-left"
                      >
                        {translationMode === "dotted" ? (
                          <div className="flex items-end gap-2">
                            <span className="text-xs font-bold text-slate-600 shrink-0">
                              {line.konusmaci}:
                            </span>
                            <div className="w-full border-b border-dotted border-slate-400 h-5" />
                          </div>
                        ) : (
                          <div
                            className={`text-slate-600 ${
                              activeDensity === "ultra"
                                ? "text-[11px] leading-tight"
                                : activeDensity === "tight"
                                ? "text-[11.5px] leading-tight"
                                : activeDensity === "compact"
                                ? "text-[12px] leading-snug"
                                : "text-[13px] leading-normal"
                            }`}
                          >
                            <span className="font-bold text-slate-600 mr-1.5">
                              {line.konusmaci}:
                            </span>
                            <span>{line.turkce}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : translationLayout === "grouped-end" ? (
              /* SONDA TOPLU MODU: Diyalog satırlarında yalnızca numaralı Arapça cümleler, altında (veya yeni sayfada) toplu tercüme bloğu */
              <div
                className={
                  activeDensity === "ultra"
                    ? "space-y-1.5"
                    : activeDensity !== "normal"
                    ? "space-y-2"
                    : "space-y-4"
                }
              >
                <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200">
                  {dialogue.satirlar.map((line, idx) => {
                    const spIdx = speakers.indexOf(line.konusmaci);
                    const isEmerald = spIdx % 2 === 0;
                    const arText = clozeData.processedLines[idx] || line.arapca;
                    return (
                      <div
                        key={line.sira}
                        dir="rtl"
                        className={`${
                          activeDensity === "ultra"
                            ? "py-0.5 px-2"
                            : activeDensity === "tight"
                            ? "py-1 px-2"
                            : activeDensity === "compact"
                            ? "py-1.5 px-2.5"
                            : "py-2.5 px-3"
                        } flex items-baseline gap-2 break-inside-avoid ${
                          idx % 2 === 0 ? "bg-slate-50" : "bg-white"
                        }`}
                      >
                        <span
                          className={`arabic text-base font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                            isEmerald
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-violet-50 text-violet-800 border-violet-200"
                          }`}
                        >
                          {line.sira}. {formatAr(line.konusmaci_ar)}
                        </span>
                        {translationMode === "ar-dotted" ? (
                          <div className="flex-1 border-b border-dotted border-slate-400 h-7" />
                        ) : (
                          <span
                            className={`arabic font-bold text-slate-900 ${
                              activeDensity === "ultra"
                                ? "text-[15.5px] leading-tight"
                                : activeDensity === "tight"
                                ? "text-[16.5px] leading-snug"
                                : activeDensity === "compact"
                                ? "text-[17.5px] leading-snug"
                                : "text-[19px] leading-relaxed"
                            }`}
                          >
                            {formatAr(arText)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div
                  className={
                    translationPageBreak === "new"
                      ? "break-before-page print:break-before-page mt-5 pt-4 border-t-2 border-dashed border-emerald-400 space-y-2"
                      : activeDensity === "ultra"
                      ? "mt-1.5 space-y-1"
                      : activeDensity === "tight"
                      ? "mt-2 space-y-1.5"
                      : activeDensity === "compact"
                      ? "mt-3 space-y-1.5"
                      : "mt-5 space-y-2"
                  }
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-[#065F46] dark:text-emerald-400 bg-slate-50 border border-slate-300 border-l-4 border-l-[#087F5B] px-3 py-1.5 rounded-lg">
                    <span>Diyalog Tercümeleri (الترجمة التركية)</span>
                    {translationPageBreak === "new" && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                        Konum: Arka Sayfada
                      </span>
                    )}
                  </div>
                  <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200 bg-white">
                    {dialogue.satirlar.map((line, idx) => (
                      <div
                        key={line.sira}
                        dir="ltr"
                        className={`${
                          activeDensity === "ultra"
                            ? "py-0.5 px-1.5 text-[11px] leading-tight"
                            : activeDensity === "tight"
                            ? "py-0.5 px-2 text-[11.5px] leading-tight"
                            : activeDensity === "compact"
                            ? "py-1 px-2 text-[12px] leading-snug"
                            : "py-1.5 px-2.5 text-[13px] leading-normal"
                        } text-slate-700 ${
                          idx % 2 === 0 ? "bg-slate-50/70" : "bg-white"
                        }`}
                      >
                        {translationMode === "dotted" ? (
                          <div className="flex items-end gap-2">
                            <span className="font-bold text-slate-700 shrink-0">
                              {line.sira}. {line.konusmaci}:
                            </span>
                            <div className="w-full border-b border-dotted border-slate-400 h-5" />
                          </div>
                        ) : (
                          <div>
                            <strong className="font-bold text-slate-800 mr-1.5">
                              {line.sira}. {line.konusmaci}:
                            </strong>
                            <span>{line.turkce}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* YAN YANA MODU (Varsayılan) */
              <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200">
                {dialogue.satirlar.map((line, idx) => {
                  const spIdx = speakers.indexOf(line.konusmaci);
                  const isEmerald = spIdx % 2 === 0;
                  const arText = clozeData.processedLines[idx] || line.arapca;

                  return (
                    <div
                      key={line.sira}
                      className={`${
                        activeDensity === "ultra"
                          ? "py-0.5 px-2 gap-1.5"
                          : activeDensity === "tight"
                          ? "py-1 px-2 gap-2"
                          : activeDensity === "compact"
                          ? "py-1.5 px-2.5 gap-2.5"
                          : "py-2.5 px-3 gap-3"
                      } grid grid-cols-1 sm:grid-cols-2 items-center break-inside-avoid ${
                        idx % 2 === 0 ? "bg-slate-50" : "bg-white"
                      }`}
                    >
                      {/* Sol Sütun: Türkçe Çeviri veya Noktalı Yazı Alanı */}
                      <div
                        className={
                          sideBySideOrder === "ar-left"
                            ? "sm:order-2"
                            : "sm:order-1"
                        }
                      >
                        {translationMode === "dotted" ? (
                          <div className="flex items-end gap-2">
                            <span
                              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border shrink-0 ${
                                isEmerald
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-violet-50 text-violet-800 border-violet-200"
                              }`}
                            >
                              {line.konusmaci}:
                            </span>
                            <div className="flex-1 border-b border-dotted border-slate-400 h-6" />
                          </div>
                        ) : (
                          <div
                            className={`text-slate-700 font-semibold ${
                              activeDensity === "ultra"
                                ? "text-[11px] leading-tight"
                                : activeDensity === "tight"
                                ? "text-[11.5px] leading-tight"
                                : activeDensity === "compact"
                                ? "text-[12px] leading-snug"
                                : "text-[13px] leading-normal"
                            }`}
                          >
                            <span
                              className={`text-[10.5px] font-extrabold px-1.5 py-0.5 rounded-md border mr-1.5 inline-block ${
                                isEmerald
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-violet-50 text-violet-800 border-violet-200"
                              }`}
                            >
                              {line.konusmaci}
                            </span>
                            <span>{line.turkce}</span>
                          </div>
                        )}
                      </div>

                      {/* Sağ Sütun: Arapça Metin veya Noktalı Yazı Alanı */}
                      <div
                        dir="rtl"
                        className={`text-right ${
                          sideBySideOrder === "ar-left"
                            ? "sm:order-1"
                            : "sm:order-2"
                        }`}
                      >
                        <span
                          className={`arabic text-base font-bold px-2 py-0.5 rounded-md border ml-2 inline-block ${
                            isEmerald
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-violet-50 text-violet-800 border-violet-200"
                          }`}
                        >
                          {formatAr(line.konusmaci_ar)}
                        </span>
                        {translationMode === "ar-dotted" ? (
                          <span className="inline-block w-4/5 border-b border-dotted border-slate-400 h-7 align-bottom" />
                        ) : (
                          <span
                            className={`arabic font-bold text-slate-900 ${
                              activeDensity === "ultra"
                                ? "text-[15.5px] leading-tight"
                                : activeDensity === "tight"
                                ? "text-[16.5px] leading-snug"
                                : activeDensity === "compact"
                                ? "text-[17.5px] leading-snug"
                                : "text-[19px] leading-relaxed"
                            }`}
                          >
                            {formatAr(arText)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* KELİME TABLOSU ÖNİZLEMESİ */}
            {includeVocabulary && vocabEntries.length > 0 && (
              <div
                className={`space-y-1.5 ${
                  activeDensity === "ultra"
                    ? "mt-1.5"
                    : activeDensity === "tight"
                    ? "mt-2"
                    : activeDensity === "compact"
                    ? "mt-3"
                    : "mt-5"
                }`}
              >
                <div
                  className={`text-xs font-extrabold text-[#065F46] dark:text-emerald-400 bg-slate-50 border border-slate-300 border-l-4 border-l-[#087F5B] px-3 rounded-lg ${
                    activeDensity === "ultra"
                      ? "py-0.5"
                      : activeDensity === "tight"
                      ? "py-1"
                      : activeDensity === "compact"
                      ? "py-1.5"
                      : "py-2"
                  }`}
                >
                  📚 Diyalog Kelime Hazinesi (المفردات) — {vocabEntries.length}{" "}
                  Kelime
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {vocabEntries.map((entry, idx) => {
                    const w = entry.item;
                    const mainAr = w.mufret || w.mazi || "";
                    return (
                      <div
                        key={`${mainAr}-${idx}`}
                        className={`flex items-center justify-between gap-2 ${
                          activeDensity === "ultra"
                            ? "py-0.5 px-1.5 text-[10.5px]"
                            : activeDensity === "tight"
                            ? "py-0.5 px-2 text-[11px]"
                            : activeDensity === "compact"
                            ? "py-1 px-2 text-[11.5px]"
                            : "py-1.5 px-2.5 text-xs"
                        } rounded-lg border border-slate-300 bg-slate-50 break-inside-avoid`}
                      >
                        {w.gorsel && (
                          <img
                            src={w.gorsel}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                            className="w-9 h-9 aspect-square object-contain rounded-md border border-slate-300 bg-white shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          {vocabLanguageMode === "ar-only" ? (
                            <div className="border-b border-dotted border-slate-400 h-5 w-11/12" />
                          ) : (
                            <span className="font-bold text-slate-800 block truncate">
                              {w.anlam_tr}
                            </span>
                          )}
                        </div>
                        <div dir="rtl" className="shrink-0">
                          {vocabLanguageMode === "tr-only" ? (
                            <div className="border-b border-dotted border-slate-400 h-5 w-24" />
                          ) : (
                            <span
                              className={`arabic font-bold text-[#065F46] dark:text-emerald-400 ${
                                activeDensity === "ultra"
                                  ? "text-[16px] leading-tight"
                                  : activeDensity === "tight"
                                  ? "text-[17px] leading-snug"
                                  : activeDensity === "compact"
                                  ? "text-[18px] leading-snug"
                                  : "text-[19px] leading-relaxed"
                              }`}
                            >
                              {formatAr(mainAr)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ✨ BU DİYALOGDAKİ KALIP İFADELER (التعبيرات الاصطلاحية) TABLOSU ÖNİZLEMESİ */}
            {includeIdioms && dialogueIdioms.length > 0 && (
              <div
                className={`space-y-1.5 ${
                  activeDensity === "ultra"
                    ? "mt-1.5"
                    : activeDensity === "tight"
                    ? "mt-2"
                    : activeDensity === "compact"
                    ? "mt-3"
                    : "mt-5"
                }`}
              >
                <div
                  className={`text-xs font-extrabold text-[#4C28B5] bg-[#F3F0FF] border border-[#D0BFFF] border-l-4 border-l-[#6741D9] px-3 rounded-lg ${
                    activeDensity === "ultra"
                      ? "py-0.5"
                      : activeDensity === "tight"
                      ? "py-1"
                      : activeDensity === "compact"
                      ? "py-1.5"
                      : "py-2"
                  }`}
                >
                  ✨ Bu Diyalogdaki Kalıp İfadeler (التعبيرات الاصطلاحية) —{" "}
                  {dialogueIdioms.length} İfade
                </div>
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-[#F3F0FF] text-[#4C28B5] text-[11px] font-extrabold border-b border-slate-300">
                        <th
                          className={`${
                            activeDensity === "ultra"
                              ? "py-0.5 px-1.5"
                              : activeDensity === "tight"
                              ? "py-1 px-2"
                              : activeDensity === "compact"
                              ? "py-1.5 px-2"
                              : "py-2 px-2.5"
                          } text-right w-[30%]`}
                        >
                          Kalıp İfade (Arapça)
                        </th>
                        <th
                          className={`${
                            activeDensity === "ultra"
                              ? "py-0.5 px-1.5"
                              : activeDensity === "tight"
                              ? "py-1 px-2"
                              : activeDensity === "compact"
                              ? "py-1.5 px-2"
                              : "py-2 px-2.5"
                          } w-[32%]`}
                        >
                          Deyimsel Anlamı (Türkçe)
                        </th>
                        <th
                          className={`${
                            activeDensity === "ultra"
                              ? "py-0.5 px-1.5"
                              : activeDensity === "tight"
                              ? "py-1 px-2"
                              : activeDensity === "compact"
                              ? "py-1.5 px-2"
                              : "py-2 px-2.5"
                          } w-[38%]`}
                        >
                          Harfiyen Anlamı & Kullanım İpucu
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dialogueIdioms.map((idm) => (
                        <tr
                          key={idm.id}
                          className="break-inside-avoid bg-white odd:bg-slate-50/70"
                        >
                          <td
                            dir="rtl"
                            className={`${
                              activeDensity === "ultra"
                                ? "py-0.5 px-1.5 text-[15.5px] leading-tight"
                                : activeDensity === "tight"
                                ? "py-0.5 px-2 text-[16.5px] leading-snug"
                                : activeDensity === "compact"
                                ? "py-1 px-2 text-[17.5px] leading-snug"
                                : "py-1.5 px-2.5 text-[19px] leading-relaxed"
                            } text-right font-arabic arabic font-bold text-[#065F46] dark:text-emerald-400 border-l border-dashed border-slate-200`}
                          >
                            {formatAr(idm.arabic)}
                          </td>
                          <td
                            className={`${
                              activeDensity === "ultra"
                                ? "py-0.5 px-1.5 text-[10.5px]"
                                : activeDensity === "tight"
                                ? "py-0.5 px-2 text-[11px]"
                                : activeDensity === "compact"
                                ? "py-1 px-2 text-[11.5px]"
                                : "py-1.5 px-2.5 text-xs"
                            } font-bold text-slate-800 border-l border-dashed border-slate-200`}
                          >
                            {idiomsBlankMode ? (
                              <div className="border-b border-dotted border-slate-400 h-5 w-11/12" />
                            ) : (
                              idm.meaningTr
                            )}
                          </td>
                          <td
                            className={`${
                              activeDensity === "ultra"
                                ? "py-0.5 px-1.5 text-[10.5px]"
                                : activeDensity === "tight"
                                ? "py-0.5 px-2 text-[11px]"
                                : activeDensity === "compact"
                                ? "py-1 px-2 text-[11.5px]"
                                : "py-1.5 px-2.5 text-xs"
                            } text-slate-600 space-y-0.5`}
                          >
                            {idm.literalTr && (
                              <div className="text-[#5F3DC4] font-semibold">
                                <strong>Harfiyen:</strong> {idm.literalTr}
                              </div>
                            )}
                            {idm.usageNote && (
                              <div>
                                <strong>İpucu:</strong> {idm.usageNote}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

              </>
            )}

            {/* ZORUNLU KURUMSAL ALT BİLGİ (FOOTER): www.muallimun.net */}
            <footer className="pt-3 mt-4 border-t-2 border-[#087F5B] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
              <span className="font-semibold">
                {dialogue.id.startsWith("kutuphane_")
                  ? `${dialogue.baslik_tr} (${dialogue.seviye}) — Arapça Çalışma Kağıdı`
                  : `${dialogue.id.startsWith("metin_") ? "Metin" : "Diyalog"} #${String(rawNum).padStart(2, "0")}: ${dialogue.baslik_tr} (${dialogue.seviye}) — Arapça Çalışma Kağıdı`}
              </span>
              <a
                href="https://www.muallimun.net"
                target="_blank"
                rel="noopener noreferrer"
                className="font-extrabold text-xs text-[#065F46] dark:text-emerald-400 tracking-wide hover:underline"
              >
                www.muallimun.net
              </a>
            </footer>
          </div>

          {/* 🔑 2. SAYFA: ÖĞRETMEN CEVAP ANAHTARI */}
          {includeAnswerKey && (
            <div className="break-before-page mt-6 max-w-[210mm] mx-auto bg-white text-slate-900 rounded-2xl border-2 border-[#087F5B] shadow-lg p-4 sm:p-7 space-y-4 print:shadow-none print:border-0 print:p-0">
              {/* Öğretmen Cevap Anahtarı Kurumsal Başlığı */}
              <div className="pb-3 border-b-2 border-[#087F5B] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                      ÖĞRETMEN CEVAP ANAHTARI (مفتاح الإجابات للمعلم)
                    </span>
                    {pdfDocMode === "quiz-sheet" && (
                      <span className="inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-md bg-violet-100 text-violet-900 border border-violet-300">
                        Kitapçık: {sixSectionExamData.bookletGroup} Grubu (#
                        {sixSectionExamData.formCode})
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[#065F46]">
                    🔑 Öğretmen Cevap Anahtarı — {effectivePaperTitleTr}
                  </h3>
                </div>
                <div
                  dir="rtl"
                  className="arabic text-xl font-bold text-[#065F46]"
                >
                  {formatAr(dialogue.baslik_ar)}
                </div>
              </div>

              {pdfDocMode === "quiz-sheet" ? (
                <div className="space-y-3 text-xs text-slate-800">
                  {sixSectionExamData.sec1ArToTr.length > 0 && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-3 space-y-1.5">
                      <div className="font-extrabold text-[#065F46] text-xs">
                        1. Bölüm — Arapça → Türkçe Cevapları (
                        {sixSectionExamData.pointsAllocation.sectionTotals[0]} Puan):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {sixSectionExamData.sec1ArToTr.map((it) => (
                          <div
                            key={it.num}
                            className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-white border border-emerald-200"
                          >
                            <span className="font-bold">
                              {it.num}. ({it.points}p) → {it.correctTurkish}
                            </span>
                            <span
                              dir="rtl"
                              className="arabic text-base font-bold text-[#065F46]"
                            >
                              {formatAr(it.arabic)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sixSectionExamData.sec2TrToAr.length > 0 && (
                    <div className="rounded-xl border border-violet-300 bg-violet-50/40 p-3 space-y-1.5">
                      <div className="font-extrabold text-[#4C28B5] text-xs">
                        2. Bölüm — Türkçe → Arapça Cevapları (
                        {sixSectionExamData.pointsAllocation.sectionTotals[1]} Puan):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {sixSectionExamData.sec2TrToAr.map((it) => (
                          <div
                            key={it.num}
                            className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-white border border-violet-200"
                          >
                            <span className="font-bold">
                              {it.num}. ({it.points}p) {it.turkish}
                            </span>
                            <span
                              dir="rtl"
                              className="arabic text-base font-bold text-[#4C28B5]"
                            >
                              {formatAr(it.correctArabic)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sixSectionExamData.sec3FillBlank.length > 0 && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-3 space-y-1.5">
                      <div className="font-extrabold text-[#065F46] text-xs">
                        3. Bölüm — Boşluk Doldurma Cevapları (
                        {sixSectionExamData.pointsAllocation.sectionTotals[2]} Puan):
                      </div>
                      <div className="space-y-1">
                        {sixSectionExamData.sec3FillBlank.map((b) => (
                          <div
                            key={b.num}
                            className="p-2 rounded-lg bg-white border border-emerald-200 flex flex-wrap items-center justify-between gap-2"
                          >
                            <span>
                              <strong>
                                {b.num}. ({b.points}p):
                              </strong>{" "}
                              {b.turkishMeaning}
                            </span>
                            <span
                              dir="rtl"
                              className="arabic text-base font-bold text-[#065F46]"
                            >
                              {formatAr(b.targetWordAr)} — {formatAr(b.fullSentenceAr)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sixSectionExamData.sec4MultipleChoice.length > 0 && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/40 p-3 space-y-1.5">
                      <div className="font-extrabold text-amber-900 text-xs">
                        4. Bölüm — Çoktan Seçmeli Test Cevapları (
                        {sixSectionExamData.pointsAllocation.sectionTotals[3]} Puan):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {sixSectionExamData.sec4MultipleChoice.map((c) => (
                          <div
                            key={c.num}
                            className="p-2 rounded-lg bg-white border border-amber-200 font-bold"
                          >
                            Soru {c.num} ({c.points}p): Şık {c.correctLetter}) {c.correctTurkish}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sixSectionExamData.sec5Matching.length > 0 && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-3 space-y-1.5">
                      <div className="font-extrabold text-[#065F46] text-xs">
                        5. Bölüm — Eşleştirme Cevapları (
                        {sixSectionExamData.pointsAllocation.sectionTotals[4]} Puan):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {sixSectionExamData.sec5Matching.map((m) => (
                          <div
                            key={m.rowIndex}
                            className="p-2 rounded-lg bg-white border border-emerald-200 flex items-center justify-between gap-2"
                          >
                            <span className="font-bold">
                              {m.rightNumber}. {m.rightShuffledTr} → [{m.rightCorrectLetter}]
                            </span>
                            <span
                              dir="rtl"
                              className="arabic text-base font-bold text-[#065F46]"
                            >
                              {formatAr(m.rightMatchedArabic)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sixSectionExamData.sec6Morphology.length > 0 && (
                    <div className="rounded-xl border border-violet-300 bg-violet-50/40 p-3 space-y-1.5">
                      <div className="font-extrabold text-[#4C28B5] text-xs">
                        6. Bölüm — Sarf Tablosu Tam Çözümleri (
                        {sixSectionExamData.pointsAllocation.sectionTotals[5]} Puan):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {sixSectionExamData.sec6Morphology.map((r) => (
                          <div
                            key={r.num}
                            className="p-2 rounded-lg bg-white border border-violet-200 flex items-center justify-between gap-2"
                          >
                            <span className="font-bold">
                              {r.num}. {r.turkce}
                            </span>
                            <span
                              dir="rtl"
                              className="arabic text-base font-bold text-[#4C28B5]"
                            >
                              {formatAr(r.kokSpaced)} • {formatAr(r.form1Ar)} •{" "}
                              {formatAr(r.form2Ar)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : pdfDocMode === "unvocalized-rubric" ? (
                <div className="space-y-2">
                  <div className="text-xs font-extrabold text-[#065F46]">
                    ✅ Harekesiz Yoklama Tam Harekeli Çözüm ve Tercüme Anahtarı
                  </div>
                  <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200">
                    {unvocalizedRubricItems.map((item) => (
                      <div
                        key={item.num}
                        className="p-2.5 grid grid-cols-1 sm:grid-cols-2 items-center gap-2 odd:bg-slate-50"
                      >
                        <div className="text-xs text-slate-800">
                          <strong className="text-[#065F46] mr-1">
                            {item.num}. ({item.points}p) {item.konusmaci}:
                          </strong>
                          <span className="font-semibold">{item.turkce}</span>
                        </div>
                        <div
                          dir="rtl"
                          className="text-right arabic text-xl font-bold text-[#065F46]"
                        >
                          {formatArabicText(item.vocalizedAr, true, arabicFont)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : pdfDocMode === "flashcards" ? (
                <div className="space-y-2">
                  <div className="text-xs font-extrabold text-[#065F46]">
                    ✂️ Kes-Yapıştır Kartlar Tam Liste & Çözüm Tablosu ({flashcardItems.length} Kart)
                  </div>
                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-emerald-50 text-[#065F46] font-extrabold border-b border-slate-300">
                          <th className="py-1.5 px-2.5 w-10">#</th>
                          <th className="py-1.5 px-2.5 text-right">Arapça Kelime / İfade</th>
                          <th className="py-1.5 px-2.5 text-right">Kök & Sarf Bilgisi</th>
                          <th className="py-1.5 px-2.5">Türkçe Doğru Anlamı</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {flashcardItems.map((fc, idx) => (
                          <tr key={idx} className="odd:bg-slate-50">
                            <td className="py-1 px-2.5 font-extrabold text-slate-500">
                              {idx + 1}
                            </td>
                            <td
                              dir="rtl"
                              className="py-1 px-2.5 text-right arabic text-lg font-bold text-[#065F46]"
                            >
                              {formatAr(fc.arabic)}
                            </td>
                            <td
                              dir="rtl"
                              className="py-1 px-2.5 text-right arabic text-xs font-bold text-violet-800"
                            >
                              {[
                                fc.kok ? `جذر: ${fc.kok}` : "",
                                fc.morphInfo ? formatAr(fc.morphInfo) : "",
                              ]
                                .filter(Boolean)
                                .join(" • ") || "—"}
                            </td>
                            <td className="py-1 px-2.5 font-bold text-slate-800">
                              {fc.turkish}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : pdfDocMode === "pair-infogap" ? (
                <div className="space-y-3">
                  <div className="text-xs font-extrabold text-[#065F46] bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                    🗣️ Eşli Konuşma Kartları (Öğrenci A &amp; B) Gizlenen Hedef Kelimeler ve Tam Çözüm Anahtarı
                  </div>
                  <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200">
                    {infoGapDeck.lines.map((ln) => (
                      <div
                        key={ln.lineNumber}
                        className="p-2.5 grid grid-cols-1 sm:grid-cols-2 items-center gap-2 odd:bg-slate-50"
                      >
                        <div className="text-xs text-slate-800">
                          <strong className="text-[#065F46] mr-1">
                            #{ln.lineNumber} (
                            {ln.lineNumber % 2 === 1
                              ? "Öğrenci B'de Boş"
                              : "Öğrenci A'da Boş"}
                            ) {ln.speakerTr}:
                          </strong>
                          <span className="font-semibold">{ln.turkishFull}</span>
                        </div>
                        <div
                          dir="rtl"
                          lang="ar"
                          className="text-right arabic text-lg font-bold text-slate-900 leading-[1.95]"
                        >
                          {formatAr(ln.fullArabic)}{" "}
                          <span className="text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-base">
                            [{formatAr(ln.hiddenWordsAr.join(" ، "))}]
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Tam Metin / Boşluk Doldurma (Cloze) & Noktalı Çeviri Çözümleri */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-extrabold text-[#065F46] bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center justify-between">
                      <span>
                        📖 Tam Metin, Tercüme & Boşluk Doldurma Çözümleri (Hedef kelimeler altı çizili ve renklidir)
                      </span>
                      <span dir="rtl" className="arabic text-sm font-bold">
                        النص الكامل والترجمة
                      </span>
                    </div>
                    <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200">
                      {dialogue.satirlar.map((line, idx) => {
                        const targetWord = clozeData.lineTargetWords?.[idx];
                        const formattedFull = formatAr(line.arapca);
                        const formattedTarget = targetWord ? formatAr(targetWord) : "";
                        return (
                          <div
                            key={line.sira}
                            className="py-1.5 px-3 grid grid-cols-1 sm:grid-cols-2 items-center gap-2 odd:bg-slate-50"
                          >
                            <div className="text-xs text-slate-800">
                              <strong className="text-[#065F46] mr-1">
                                {line.sira}. {line.konusmaci}:
                              </strong>
                              <span className="font-semibold">{line.turkce}</span>
                            </div>
                            <div
                              dir="rtl"
                              className="text-right arabic text-lg font-bold text-slate-900"
                            >
                              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 ml-1.5">
                                {formatAr(line.konusmaci_ar)}
                              </span>
                              {formattedTarget &&
                              formattedFull.includes(formattedTarget) ? (
                                <>
                                  {formattedFull.split(formattedTarget)[0]}
                                  <span className="underline decoration-2 decoration-red-600 bg-emerald-100 text-red-700 px-1.5 py-0.5 rounded mx-0.5">
                                    {formattedTarget}
                                  </span>
                                  {formattedFull
                                    .split(formattedTarget)
                                    .slice(1)
                                    .join(formattedTarget)}
                                </>
                              ) : (
                                formattedFull
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sözlük & Kalıp İfade Çözümleri */}
                  {vocabEntries.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-extrabold text-[#065F46] bg-slate-50 border border-slate-300 px-3 py-1 rounded-lg">
                        📚 Kelime Hazinesi Tam Çözüm Anahtarı ({vocabEntries.length} Kelime)
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {vocabEntries.map((entry, idx) => {
                          const w = entry.item;
                          const mainAr = w.mufret || w.mazi || "";
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50/70 text-[11px]"
                            >
                              <span className="font-bold text-slate-800 truncate">
                                {idx + 1}. {w.anlam_tr}
                              </span>
                              <span
                                dir="rtl"
                                className="arabic text-base font-bold text-[#065F46] shrink-0"
                              >
                                {formatAr(mainAr)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <footer className="pt-2 mt-3 border-t border-emerald-300 flex items-center justify-between text-[10px] text-slate-500">
                <span>
                  🔑 Öğretmen Cevap Anahtarı • {dialogue.baslik_tr} ({dialogue.seviye})
                </span>
                <span className="font-extrabold text-[#065F46]">
                  www.muallimun.net
                </span>
              </footer>
            </div>
          )}
        </div>

        {/* MODAL ALT AKSİYON ÇUBUĞU: Öğrenci Nüshası ve Öğretmen Cevap Anahtarı Ayrı Basım Seçenekleri */}
        <div className="print:hidden bg-[#F7EFE1] dark:bg-[var(--background)] px-3 sm:px-5 py-2.5 border-t-2 border-[#E6D7BE] dark:border-[var(--border)] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClick();
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
          >
            Kapat
          </button>

          <div className="flex flex-wrap items-center gap-2 justify-end flex-1">
            <button
              type="button"
              onClick={() => handleGenerateAndPrintPdf("student")}
              className="px-3.5 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-xs border-b-3 border-[#065F46] active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer size={15} />
              <span>🖨️ Öğrenci Kağıdını Yazdır (Cevapsız)</span>
            </button>

            <button
              type="button"
              onClick={() => handleGenerateAndPrintPdf("answer-key")}
              className="px-3.5 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white font-extrabold text-xs border-b-3 border-[#4C28B5] active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>🔑 Sadece Cevap Anahtarını Yazdır</span>
            </button>

            <button
              type="button"
              onClick={() => handleGenerateAndPrintPdf("both")}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs border-b-3 border-amber-800 active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>📚 İkisini Birlikte Yazdır</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
