"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Paintbrush,
  RefreshCcw,
  Timer,
  Trophy,
  Volume2,
  X,
} from "lucide-react";
import {
  diyalogGramerNotlari,
  diyaloglar,
  metinGramerNotlari,
  metinler,
} from "@/lib/data";
import type { GramerHapBilgi, Level } from "@/types/data";
import { speakHybrid, stopAllAudio } from "@/lib/audio";
import {
  fixArabicTypography,
  normalizeArabicText,
  simplifyGrammarTerminology,
} from "@/lib/arabicTextUtils";
import { MixedText } from "@/components/ui/MixedText";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import {
  playClick,
  playFanfare,
  playSuccess,
  playWrong,
} from "@/lib/sfxManager";

export interface IrabColorPainterProps {
  cefrFilter?: "all" | Level;
  grammarFilter?: string;
  questionCount?: 10 | 20 | 30;
  timeLimit?: number | null;
  onClose?: () => void;
}

export type IrabBrushKey =
  | "merfu_subject"
  | "haber_predicate"
  | "mansub_object"
  | "mecrur_genitive"
  | "verb_other";

interface BrushThemeMeta {
  key: IrabBrushKey;
  emoji: string;
  academicTitle: string;
  simpleTitle: string;
  buttonActiveClass: string;
  buttonIdleClass: string;
  paintedBoxClass: string;
  roleLabelClass: string;
}

const BRUSH_THEMES: Record<IrabBrushKey, BrushThemeMeta> = {
  merfu_subject: {
    key: "merfu_subject",
    emoji: "🟢",
    academicTitle: "Mübteda / Fâil / Nâib-i Fâil (Özne — Merfû)",
    simpleTitle: "Özne Grubu (Ötreli / İşi Yapan)",
    buttonActiveClass:
      "bg-emerald-600 border-emerald-800 text-white ring-2 ring-emerald-400/50",
    buttonIdleClass:
      "bg-emerald-50 dark:bg-emerald-950/45 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 hover:border-emerald-500",
    paintedBoxClass:
      "bg-emerald-100/90 dark:bg-emerald-950/65 border-emerald-500 text-emerald-950 dark:text-emerald-200",
    roleLabelClass: "text-emerald-800 dark:text-emerald-300",
  },
  haber_predicate: {
    key: "haber_predicate",
    emoji: "🔵",
    academicTitle: "Haber / Kâne & İnne Haberi (Yüklem)",
    simpleTitle: "Yüklem / Haber Grubu",
    buttonActiveClass:
      "bg-sky-600 border-sky-800 text-white ring-2 ring-sky-400/50",
    buttonIdleClass:
      "bg-sky-50 dark:bg-sky-950/45 border-sky-300 dark:border-sky-700 text-sky-950 dark:text-sky-200 hover:border-sky-500",
    paintedBoxClass:
      "bg-sky-100/90 dark:bg-sky-950/65 border-sky-500 text-sky-950 dark:text-sky-200",
    roleLabelClass: "text-sky-800 dark:text-sky-300",
  },
  mansub_object: {
    key: "mansub_object",
    emoji: "🟠",
    academicTitle: "Mef'ûl / Hâl / Temyiz / Zarf / İnne İsmi (Mansûb)",
    simpleTitle: "Nesne, Zaman/Yer & Üstünlü Tamlayıcılar",
    buttonActiveClass:
      "bg-amber-500 border-amber-700 text-slate-950 ring-2 ring-amber-400/50",
    buttonIdleClass:
      "bg-amber-50 dark:bg-amber-950/45 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 hover:border-amber-500",
    paintedBoxClass:
      "bg-amber-100/90 dark:bg-amber-950/65 border-amber-500 text-amber-950 dark:text-amber-200",
    roleLabelClass: "text-amber-900 dark:text-amber-300",
  },
  mecrur_genitive: {
    key: "mecrur_genitive",
    emoji: "🟣",
    academicTitle: "Harf-i Cer & Mecrûr / Muzâfun İleyh (Cer Grubu)",
    simpleTitle: "Harf-i Cer & Tamlayan (Esreli Grup)",
    buttonActiveClass:
      "bg-purple-600 border-purple-800 text-white ring-2 ring-purple-400/50",
    buttonIdleClass:
      "bg-purple-50 dark:bg-purple-950/45 border-purple-300 dark:border-purple-700 text-purple-950 dark:text-purple-200 hover:border-purple-500",
    paintedBoxClass:
      "bg-purple-100/90 dark:bg-purple-950/65 border-purple-500 text-purple-950 dark:text-purple-200",
    roleLabelClass: "text-purple-800 dark:text-purple-300",
  },
  verb_other: {
    key: "verb_other",
    emoji: "⚪",
    academicTitle: "Fiil / Sıfat / Edat & Diğer Görevler",
    simpleTitle: "Fiil, Sıfat & Edat Grubu",
    buttonActiveClass:
      "bg-indigo-600 border-indigo-800 text-white ring-2 ring-indigo-400/50",
    buttonIdleClass:
      "bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 hover:border-indigo-500",
    paintedBoxClass:
      "bg-indigo-50/95 dark:bg-indigo-950/65 border-indigo-500 text-indigo-950 dark:text-indigo-200",
    roleLabelClass: "text-indigo-800 dark:text-indigo-300",
  },
};

const BRUSH_ORDER: IrabBrushKey[] = [
  "merfu_subject",
  "haber_predicate",
  "mansub_object",
  "mecrur_genitive",
  "verb_other",
];

/**
 * `irab_tahlili` içindeki `gorevi` metnini 5 Temel İ'rab Renk Fırçasına sınıflandırır.
 */
export function classifyIrabRoleToBrush(goreviRaw: string): IrabBrushKey {
  const g = goreviRaw.toLocaleLowerCase("tr-TR").replace(/\u0307/g, "");

  // 1. Önce doğrudan Fiil ile başlayan öbekleri ("Fiil + Fâil", "Muzari Fiil", "Emir Fiil") Fiil fırçasına al
  if (
    /^(?:meçhul\s+|mâzî\s+|mazi\s+|muzari\s+|muzârî\s+|emir\s+|nâkıs\s+|nakıs\s+)?fiil/i.test(
      goreviRaw.trim()
    )
  ) {
    return "verb_other";
  }

  // 2. Haber / Yüklem ("Şibh-i Cümle Haber", "Öne Geçmiş Câr-Mecrûr Haber", "İnne'nin Haberi", "Kâne'nin Haberi")
  if (g.includes("haber") || g.includes("yüklem")) {
    return "haber_predicate";
  }

  // 3. Sıfat / Na't / Bedel / Atıf / Edat (Harf-i Cer hariç)
  if (
    g.startsWith("sıfat") ||
    g.includes("sıra sayısı sıfatı") ||
    g.startsWith("na't") ||
    g.startsWith("bedel") ||
    g.startsWith("atıf") ||
    g.includes("istifham") ||
    g.includes("soru edatı") ||
    g.includes("gelecek zaman") ||
    g.includes("olumsuzluk") ||
    g.includes("şart edatı") ||
    g.includes("nasb edatı") ||
    g.includes("cezm edatı")
  ) {
    return "verb_other";
  }

  // 4. Mansûb Tamlayıcılar: Mef'ûl, İnne'nin İsmi, Hâl, Temyiz, Zarf, Müstesnâ
  if (
    g.includes("mef'ûl") ||
    g.includes("mef’ûl") ||
    g.includes("meful") ||
    g.includes("nesne") ||
    g.includes("inne'nin ismi") ||
    g.includes("innenin ismi") ||
    g.includes("temyiz") ||
    g.includes("zarf") ||
    /\bh[âa]l\b/i.test(goreviRaw) ||
    g.includes("müstesn") ||
    (g.includes("mansûb") && !g.includes("sıfat")) ||
    (g.includes("mansub") && !g.includes("sıfat"))
  ) {
    return "mansub_object";
  }

  // 5. Özne — Merfû: Mübteda, Fâil, Nâib-i Fâil, Kâne'nin İsmi
  if (
    g.includes("mübted") ||
    g.includes("mubted") ||
    g.includes("nâib-i fâil") ||
    g.includes("naib-i fail") ||
    g.includes("sözde özne") ||
    g.includes("kâne'nin ismi") ||
    g.includes("kanenin ismi") ||
    g.includes("fâil") ||
    g.includes("fail") ||
    g.includes("özne")
  ) {
    return "merfu_subject";
  }

  // 6. Cer & Tamlayan Grubu: Harf-i Cer, Mecrûr, Câr-Mecrûr, Muzâfun İleyh
  if (
    g.includes("harf-i cer") ||
    g.includes("câr-mecrûr") ||
    g.includes("car-mecrur") ||
    g.includes("mecrûr") ||
    g.includes("mecrur") ||
    g.includes("muzâfun ileyh") ||
    g.includes("muzafun ileyh") ||
    g.includes("tamlayan")
  ) {
    return "mecrur_genitive";
  }

  return "verb_other";
}

interface SentenceSegment {
  segId: string;
  displayArabic: string;
  isPaintable: boolean;
  targetIndex?: number;
  gorevi?: string;
  harekeNedeni?: string;
  expectedBrush?: IrabBrushKey;
}

interface IrabPainterItem {
  id: string;
  sourceId: string;
  level: Level;
  sourceTitleTr: string;
  konuBasligi: string;
  sentenceAr: string;
  sentenceTr: string;
  segments: SentenceSegment[];
  paintableCount: number;
  activeBrushes: Array<{
    brush: BrushThemeMeta;
    rolesInSentence: string[];
  }>;
}

function shuffleList<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * `metinden_ornek.arapca` içindeki kelimeleri `irab_tahlili` dizisindeki tek veya çok kelimeli
 * öbeklerle (ör. `"مِنْ إِسْطَنْبُولَ"`) eşleştirerek boyanabilir segment listesi üretir.
 */
function buildSentenceSegments(
  sentenceAr: string,
  irabList: Array<{ kelime: string; gorevi: string; hareke_nedeni: string }>
): SentenceSegment[] {
  const rawTokens = sentenceAr.trim().split(/\s+/).filter(Boolean);
  const normSentenceTokens = rawTokens.map((t) => normalizeArabicText(t));

  // Her irab öğesini cümle içinde sırayla ara
  const matchedSpans: Array<{
    start: number;
    endExclusive: number;
    irabIdx: number;
  }> = [];

  let searchCursor = 0;
  let allMatched = true;

  for (let i = 0; i < irabList.length; i++) {
    const phraseTokens = irabList[i].kelime
      .trim()
      .split(/\s+/)
      .map((t) => normalizeArabicText(t))
      .filter(Boolean);

    if (phraseTokens.length === 0) {
      allMatched = false;
      break;
    }

    let foundStart = -1;
    for (
      let pos = searchCursor;
      pos <= normSentenceTokens.length - phraseTokens.length;
      pos++
    ) {
      const ok = phraseTokens.every(
        (pt, offset) => normSentenceTokens[pos + offset] === pt
      );
      if (ok) {
        foundStart = pos;
        break;
      }
    }

    if (foundStart === -1) {
      allMatched = false;
      break;
    }

    matchedSpans.push({
      start: foundStart,
      endExclusive: foundStart + phraseTokens.length,
      irabIdx: i,
    });
    searchCursor = foundStart + phraseTokens.length;
  }

  if (!allMatched || matchedSpans.length === 0) {
    // Doğrudan irab_tahlili öğelerini sıralı kutular olarak döndür
    return irabList.map((item, idx) => ({
      segId: `seg_direct_${idx}`,
      displayArabic: item.kelime,
      isPaintable: true,
      targetIndex: idx,
      gorevi: item.gorevi,
      harekeNedeni: item.hareke_nedeni,
      expectedBrush: classifyIrabRoleToBrush(item.gorevi),
    }));
  }

  const segments: SentenceSegment[] = [];
  let tokenIdx = 0;
  for (const span of matchedSpans) {
    if (tokenIdx < span.start) {
      segments.push({
        segId: `ctx_${tokenIdx}`,
        displayArabic: rawTokens.slice(tokenIdx, span.start).join(" "),
        isPaintable: false,
      });
    }
    const irabItem = irabList[span.irabIdx];
    segments.push({
      segId: `target_${span.irabIdx}`,
      displayArabic: rawTokens.slice(span.start, span.endExclusive).join(" "),
      isPaintable: true,
      targetIndex: span.irabIdx,
      gorevi: irabItem.gorevi,
      harekeNedeni: irabItem.hareke_nedeni,
      expectedBrush: classifyIrabRoleToBrush(irabItem.gorevi),
    });
    tokenIdx = span.endExclusive;
  }

  if (tokenIdx < rawTokens.length) {
    segments.push({
      segId: `ctx_tail_${tokenIdx}`,
      displayArabic: rawTokens.slice(tokenIdx).join(" "),
      isPaintable: false,
    });
  }

  return segments;
}

function buildIrabPainterCatalog(): IrabPainterItem[] {
  const dlgMap = new Map(diyaloglar.map((d) => [d.id, d]));
  const metinMap = new Map(metinler.map((m) => [m.id, m]));

  const notesWithMeta: Array<{
    note: GramerHapBilgi;
    level: Level;
    sourceTitleTr: string;
  }> = [];

  for (const note of diyalogGramerNotlari) {
    if (
      !note.ayrintili_anlatim?.irab_tahlili?.length ||
      !note.metinden_ornek?.arapca
    ) {
      continue;
    }
    const dlg = dlgMap.get(note.bagli_id);
    notesWithMeta.push({
      note,
      level: dlg?.seviye || "A1",
      sourceTitleTr: dlg?.baslik_tr || note.bagli_id,
    });
  }

  for (const note of metinGramerNotlari) {
    if (
      !note.ayrintili_anlatim?.irab_tahlili?.length ||
      !note.metinden_ornek?.arapca
    ) {
      continue;
    }
    const txt = metinMap.get(note.bagli_id);
    notesWithMeta.push({
      note,
      level: txt?.seviye || "A2",
      sourceTitleTr: txt?.baslik_tr || note.bagli_id,
    });
  }

  const catalog: IrabPainterItem[] = [];

  for (const { note, level, sourceTitleTr } of notesWithMeta) {
    const irabList = note.ayrintili_anlatim?.irab_tahlili || [];
    if (irabList.length < 2) continue;

    const segments = buildSentenceSegments(
      note.metinden_ornek.arapca,
      irabList
    );
    const paintableSegments = segments.filter((s) => s.isPaintable);
    if (paintableSegments.length < 2) continue;

    const rolesMap = new Map<IrabBrushKey, string[]>();
    for (const seg of paintableSegments) {
      if (!seg.expectedBrush || !seg.gorevi) continue;
      const list = rolesMap.get(seg.expectedBrush) || [];
      if (!list.includes(seg.gorevi)) {
        list.push(seg.gorevi);
      }
      rolesMap.set(seg.expectedBrush, list);
    }

    // Cümlede en az 2 farklı renk fırçası bulunsun ki gerçek seçim olsun
    if (rolesMap.size < 2) continue;

    const activeBrushes = BRUSH_ORDER.filter((k) => rolesMap.has(k)).map(
      (k) => ({
        brush: BRUSH_THEMES[k],
        rolesInSentence: rolesMap.get(k) || [],
      })
    );

    catalog.push({
      id: `irabpaint_${note.bagli_id}`,
      sourceId: note.bagli_id,
      level,
      sourceTitleTr,
      konuBasligi: note.konu_basligi,
      sentenceAr: note.metinden_ornek.arapca,
      sentenceTr: note.metinden_ornek.turkce,
      segments,
      paintableCount: paintableSegments.length,
      activeBrushes,
    });
  }

  return catalog;
}

export default function IrabColorPainter({
  cefrFilter = "all",
  grammarFilter = "all",
  questionCount = 10,
  timeLimit = null,
  onClose,
}: IrabColorPainterProps) {
  const { arabicFont, speechRate, grammarDepthMode } = useSettings();
  const {
    recordSkillAttempt,
    recordItemAttempt,
    addMistake,
    addStudyMinutes,
  } = useUserStore();

  const [roundSeed, setRoundSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedBrush, setSelectedBrush] = useState<IrabBrushKey | null>(null);
  const [paintedMap, setPaintedMap] = useState<Record<string, IrabBrushKey>>(
    {}
  );
  const [wrongSegFlash, setWrongSegFlash] = useState<string | null>(null);
  const [hadMistakeOnCurrent, setHadMistakeOnCurrent] = useState(false);
  const [cleanSentencesCount, setCleanSentencesCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    timeLimit
  );

  const audioDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fullCatalog = useMemo(() => buildIrabPainterCatalog(), []);

  const sessionItems = useMemo(() => {
    void roundSeed;
    let pool =
      cefrFilter === "all"
        ? fullCatalog
        : fullCatalog.filter((item) => item.level === cefrFilter);
    if (pool.length === 0) pool = fullCatalog;

    let prioritized: IrabPainterItem[] = [];
    if (grammarFilter && grammarFilter !== "all") {
      const qLower = grammarFilter
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/\u0307/g, "");
      const qNormAr = normalizeArabicText(grammarFilter);
      prioritized = pool.filter((it) => {
        const titleLower = it.konuBasligi
          .toLocaleLowerCase("tr-TR")
          .replace(/\u0307/g, "");
        return (
          titleLower.includes(qLower) ||
          qLower.includes(titleLower) ||
          (qNormAr.length >= 2 &&
            normalizeArabicText(it.konuBasligi).includes(qNormAr))
        );
      });
    }

    const rest = shuffleList(
      pool.filter((it) => !prioritized.some((p) => p.id === it.id))
    );
    return [...shuffleList(prioritized), ...rest].slice(
      0,
      Math.min(questionCount, pool.length)
    );
  }, [cefrFilter, fullCatalog, grammarFilter, questionCount, roundSeed]);

  const currentItem = sessionItems[currentIndex] || null;

  // Aktif fırça seçili değilse veya yeni soruda mevcut değilse ilk aktif fırçayı otomatik seç
  const effectiveBrush: IrabBrushKey | null = useMemo(() => {
    if (!currentItem || currentItem.activeBrushes.length === 0) return null;
    if (
      selectedBrush &&
      currentItem.activeBrushes.some((b) => b.brush.key === selectedBrush)
    ) {
      return selectedBrush;
    }
    return currentItem.activeBrushes[0].brush.key;
  }, [currentItem, selectedBrush]);

  const formatDepthText = useCallback(
    (txt: string) =>
      grammarDepthMode === "simple" ? simplifyGrammarTerminology(txt) : txt,
    [grammarDepthMode]
  );

  useEffect(() => {
    return () => {
      if (audioDelayRef.current) clearTimeout(audioDelayRef.current);
      stopAllAudio();
    };
  }, []);

  const isCurrentSentenceDone = useMemo(() => {
    if (!currentItem) return false;
    return currentItem.segments
      .filter((s) => s.isPaintable)
      .every((s) => Boolean(paintedMap[s.segId]));
  }, [currentItem, paintedMap]);

  // İsteğe bağlı zamanlayıcı
  useEffect(() => {
    if (
      !timeLimit ||
      isCompleted ||
      isCurrentSentenceDone ||
      remainingSeconds === null ||
      remainingSeconds <= 0
    ) {
      return;
    }
    const timer = setTimeout(() => {
      if (remainingSeconds <= 1) {
        setRemainingSeconds(0);
        if (currentItem) {
          const autoFilled: Record<string, IrabBrushKey> = {};
          for (const seg of currentItem.segments) {
            if (seg.isPaintable && seg.expectedBrush) {
              autoFilled[seg.segId] = seg.expectedBrush;
            }
          }
          setPaintedMap(autoFilled);
          setHadMistakeOnCurrent(true);
          setStreak(0);
          recordSkillAttempt("gramer", false);
          recordItemAttempt(
            currentItem.sourceId,
            "sentence",
            false,
            false,
            25,
            "İ'rab Renk Boyama: Süre doldu"
          );
          addMistake(currentItem.sourceId);
          void playWrong();
        }
      } else {
        setRemainingSeconds((s) => (s !== null ? s - 1 : null));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    addMistake,
    currentItem,
    isCompleted,
    isCurrentSentenceDone,
    recordItemAttempt,
    recordSkillAttempt,
    remainingSeconds,
    timeLimit,
  ]);

  const handlePaintSegment = async (seg: SentenceSegment) => {
    if (
      !currentItem ||
      !seg.isPaintable ||
      !seg.expectedBrush ||
      !effectiveBrush ||
      paintedMap[seg.segId]
    ) {
      return;
    }

    if (effectiveBrush === seg.expectedBrush) {
      const nextPainted = {
        ...paintedMap,
        [seg.segId]: effectiveBrush,
      };
      setPaintedMap(nextPainted);
      setWrongSegFlash(null);

      const paintedTotal = Object.keys(nextPainted).length;
      if (paintedTotal >= currentItem.paintableCount) {
        const cleanPass = !hadMistakeOnCurrent;
        const nextStreak = cleanPass ? streak + 1 : 1;
        setStreak(nextStreak);
        if (cleanPass) {
          setCleanSentencesCount((c) => c + 1);
        }

        recordSkillAttempt("gramer", cleanPass);
        recordItemAttempt(
          currentItem.sourceId,
          "sentence",
          cleanPass,
          false,
          cleanPass ? 100 : 70,
          "Cümleyi İ'rab Renkleriyle Boya"
        );
        if (!cleanPass) {
          addMistake(currentItem.sourceId);
        }

        await playSuccess({ streak: nextStreak });
        audioDelayRef.current = setTimeout(() => {
          void speakHybrid({
            text: currentItem.sentenceAr,
            rate: speechRate,
          });
        }, 250);
      } else {
        playClick();
        // Seçili fırçayla boyanacak başka öğe kalmadıysa otomatik sıradaki fırçaya geç
        const remainingForCurrentBrush = currentItem.segments.some(
          (s) =>
            s.isPaintable &&
            !nextPainted[s.segId] &&
            s.expectedBrush === effectiveBrush
        );
        if (!remainingForCurrentBrush) {
          const nextAvailable = currentItem.segments.find(
            (s) => s.isPaintable && !nextPainted[s.segId]
          );
          if (nextAvailable?.expectedBrush) {
            setSelectedBrush(nextAvailable.expectedBrush);
          }
        }
      }
      return;
    }

    // Yanlış fırça ile dokunuldu
    setHadMistakeOnCurrent(true);
    setStreak(0);
    setWrongSegFlash(seg.segId);
    setTimeout(() => {
      setWrongSegFlash((prev) => (prev === seg.segId ? null : prev));
    }, 550);
    await playWrong();
  };

  const handleNext = () => {
    playClick();
    if (audioDelayRef.current) {
      clearTimeout(audioDelayRef.current);
      audioDelayRef.current = null;
    }
    stopAllAudio();

    if (currentIndex + 1 < sessionItems.length) {
      setCurrentIndex((i) => i + 1);
      setPaintedMap({});
      setSelectedBrush(null);
      setWrongSegFlash(null);
      setHadMistakeOnCurrent(false);
      setRemainingSeconds(timeLimit);
    } else {
      addStudyMinutes(3);
      const pct =
        sessionItems.length > 0
          ? Math.round((cleanSentencesCount / sessionItems.length) * 100)
          : 100;
      void playFanfare(pct);
      setIsCompleted(true);
    }
  };

  if (!currentItem) {
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 text-center space-y-4">
        <p className="text-sm font-bold text-[var(--foreground)]">
          Bu filtre için İ&apos;rab Boyama cümlesi bulunamadı.
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold cursor-pointer"
          >
            Merkeze Dön
          </button>
        )}
      </div>
    );
  }

  if (isCompleted) {
    const accuracy = Math.round(
      (cleanSentencesCount / sessionItems.length) * 100
    );
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 sm:p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-400 flex items-center justify-center text-[#087F5B] dark:text-emerald-300">
          <Trophy size={32} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-[var(--foreground)]">
            İ&apos;rab Boyama Atölyesi Tamamlandı!
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
            Hatasız Boyanan Cümle Oranı:{" "}
            <strong className="text-[#087F5B] dark:text-emerald-400 tabular-nums">
              %{accuracy} ({cleanSentencesCount}/{sessionItems.length})
            </strong>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              playClick();
              setRoundSeed((s) => s + 1);
              setCurrentIndex(0);
              setPaintedMap({});
              setSelectedBrush(null);
              setHadMistakeOnCurrent(false);
              setCleanSentencesCount(0);
              setStreak(0);
              setIsCompleted(false);
              setRemainingSeconds(timeLimit);
            }}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCcw size={16} />
            <span>Yeni Cümlelerle Boya</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={() => {
                playClick();
                stopAllAudio();
                onClose();
              }}
              className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <X size={16} />
              <span>Merkeze Dön</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const paintedSegmentsList = currentItem.segments.filter(
    (s) => s.isPaintable && Boolean(paintedMap[s.segId])
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Üst Bilgi Barı */}
      <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
          <Paintbrush size={17} className="text-[#6741D9] shrink-0" />
          <span>Cümleyi İ&apos;rab Renkleriyle Boya</span>
          <span aria-hidden="true" className="text-[var(--muted)]">·</span>
          <span className="tabular-nums text-[#087F5B] dark:text-emerald-400">
            {currentIndex + 1} / {sessionItems.length}
          </span>
          <span aria-hidden="true" className="text-[var(--muted)]">·</span>
          <span className="text-[var(--muted)]">Seviye {currentItem.level}</span>
        </div>

        <div className="flex items-center gap-3 text-xs font-extrabold">
          <span className="tabular-nums text-[var(--muted)]">
            Boyanan: {paintedSegmentsList.length}/{currentItem.paintableCount}
          </span>
          {remainingSeconds !== null && (
            <span className="inline-flex items-center gap-1 tabular-nums text-[var(--foreground)]">
              <Timer size={14} />
              <span>{remainingSeconds}s</span>
            </span>
          )}
        </div>
      </div>

      {/* Ana Tuval ve Fırça Paleti */}
      <div className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-4 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E6D7BE]/70 dark:border-[var(--border)]">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#6741D9] dark:text-indigo-300">
            <BookOpen size={15} className="shrink-0" />
            <MixedText text={formatDepthText(currentItem.konuBasligi)} />
          </div>

          <button
            type="button"
            onClick={() => {
              playClick();
              void speakHybrid({
                text: currentItem.sentenceAr,
                rate: speechRate,
              });
            }}
            className="min-h-[48px] px-3.5 py-2 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[#087F5B] dark:text-emerald-400 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 size={15} />
            <span>Cümleyi Dinle</span>
          </button>
        </div>

        {/* SAĞDAN SOLA ARAPÇA CÜMLE BOYAMA TUVALİ */}
        <div className="rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-6 space-y-4">
          <div
            dir="rtl"
            lang="ar"
            className="flex flex-wrap items-start justify-start gap-2.5 sm:gap-3 leading-[1.95]"
          >
            {currentItem.segments.map((seg) => {
              if (!seg.isPaintable) {
                return (
                  <span
                    key={seg.segId}
                    className="min-h-[52px] inline-flex items-center px-2 py-1.5 arabic font-arabic text-2xl sm:text-3xl font-bold text-slate-500 dark:text-slate-400 leading-[1.95]"
                  >
                    {fixArabicTypography(seg.displayArabic, arabicFont)}
                  </span>
                );
              }

              const appliedBrushKey = paintedMap[seg.segId];
              const appliedTheme = appliedBrushKey
                ? BRUSH_THEMES[appliedBrushKey]
                : null;
              const isFlashingWrong = wrongSegFlash === seg.segId;

              return (
                <button
                  key={seg.segId}
                  type="button"
                  disabled={Boolean(appliedBrushKey)}
                  onClick={() => void handlePaintSegment(seg)}
                  className={`min-h-[56px] px-4 py-2 rounded-2xl border-2 border-b-4 flex flex-col items-center justify-center gap-0.5 transition-all ${
                    appliedTheme
                      ? appliedTheme.paintedBoxClass
                      : isFlashingWrong
                      ? "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-200"
                      : "bg-[#FDFBF7] dark:bg-[var(--surface)] border-dashed border-[#cbb692] dark:border-slate-600 hover:border-[#6741D9] text-[var(--foreground)] active:translate-y-0.5 cursor-pointer"
                  }`}
                >
                  <span className="arabic font-arabic text-2xl sm:text-3xl font-bold leading-[1.95]">
                    {fixArabicTypography(seg.displayArabic, arabicFont)}
                  </span>
                  {appliedTheme && seg.gorevi && (
                    <span
                      dir="ltr"
                      lang="tr"
                      className={`font-sans text-[11px] font-black leading-tight ${appliedTheme.roleLabelClass}`}
                    >
                      {appliedTheme.emoji}{" "}
                      <MixedText text={formatDepthText(seg.gorevi)} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 pt-3 border-t border-[#E6D7BE]/60 dark:border-[var(--border)]">
            Türkçe Anlamı: “{currentItem.sentenceTr}”
          </p>
        </div>

        {/* ALT DİNAMİK RENK FIRÇASI PALETİ (Yalnızca o cümlede bulunan görevler!) */}
        {!isCurrentSentenceDone && (
          <div className="space-y-2.5">
            <p className="text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
              1. Aşağıdan bir İ&apos;rab Fırçası seçin · 2. Üstteki cümlede o göreve sahip kelime/öbeğe dokunarak boyayın:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentItem.activeBrushes.map(({ brush, rolesInSentence }) => {
                const isSelected = effectiveBrush === brush.key;
                const remainingCount = currentItem.segments.filter(
                  (s) =>
                    s.isPaintable &&
                    s.expectedBrush === brush.key &&
                    !paintedMap[s.segId]
                ).length;

                return (
                  <button
                    key={brush.key}
                    type="button"
                    disabled={remainingCount === 0}
                    onClick={() => {
                      playClick();
                      setSelectedBrush(brush.key);
                    }}
                    className={`min-h-[54px] px-4 py-2.5 rounded-2xl border-2 text-left flex items-center justify-between gap-2.5 transition-all ${
                      remainingCount === 0
                        ? "opacity-40 bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 cursor-default"
                        : isSelected
                        ? `${brush.buttonActiveClass} cursor-pointer`
                        : `${brush.buttonIdleClass} cursor-pointer`
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs sm:text-sm font-black leading-snug">
                        {brush.emoji}{" "}
                        {grammarDepthMode === "simple"
                          ? brush.simpleTitle
                          : brush.academicTitle}
                      </div>
                      <div className="text-[11px] font-semibold opacity-90 leading-snug">
                        Bu cümlede:{" "}
                        <MixedText
                          text={rolesInSentence
                            .map((r) => formatDepthText(r))
                            .join(" · ")}
                        />
                      </div>
                    </div>

                    <span className="text-xs font-black tabular-nums shrink-0">
                      {remainingCount > 0 ? `${remainingCount}x` : "Tamam"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* DOĞRU BOYANAN KUTULARIN ANLIK İ'RAB & HAREKE NEDENİ AÇIKLAMALARI */}
        {paintedSegmentsList.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <h3 className="text-xs font-black text-[var(--muted)]">
              Boyanan Ögelerin İ&apos;rab &amp; Hareke Gerekçeleri:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {paintedSegmentsList.map((seg) => {
                const bKey = paintedMap[seg.segId];
                const theme = BRUSH_THEMES[bKey];
                return (
                  <div
                    key={`exp_${seg.segId}`}
                    className="rounded-2xl bg-[#F7EFE1]/85 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-1.5 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-black ${theme.roleLabelClass}`}
                      >
                        {theme.emoji}{" "}
                        <MixedText text={formatDepthText(seg.gorevi || "")} />
                      </span>
                      <span
                        dir="rtl"
                        lang="ar"
                        className="arabic font-arabic text-xl font-bold text-[#065F46] dark:text-emerald-300 leading-[1.8]"
                      >
                        {fixArabicTypography(seg.displayArabic, arabicFont)}
                      </span>
                    </div>
                    <MixedText
                      mode="block"
                      text={formatDepthText(seg.harekeNedeni || "")}
                      className="text-xs font-medium text-[var(--foreground)] leading-relaxed"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CÜMLE TAMAMLANDIĞINDA SONRAKİ BUTONU */}
        {isCurrentSentenceDone && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E6D7BE]/70 dark:border-[var(--border)]">
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-[#087F5B] dark:text-emerald-400">
              <CheckCircle2 size={18} />
              <span>Tebrikler! Cümlenin tüm ögeleri doğru renklendirildi.</span>
            </span>

            <button
              type="button"
              onClick={handleNext}
              className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {currentIndex + 1 < sessionItems.length
                  ? "Sonraki Cümleyi Boya"
                  : "Sonuçları Gör"}
              </span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
