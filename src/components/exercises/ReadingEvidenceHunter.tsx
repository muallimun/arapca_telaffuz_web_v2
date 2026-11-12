"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  Highlighter,
  Lightbulb,
  RefreshCcw,
  Search,
  Timer,
  Trophy,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import { metinler } from "@/lib/data";
import type { Level, ReadingText, ReadingTextLine } from "@/types/data";
import { speakHybrid, stopAllAudio } from "@/lib/audio";
import { fixArabicTypography, normalizeArabicText } from "@/lib/arabicTextUtils";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import {
  playClick,
  playFanfare,
  playSuccess,
  playWrong,
} from "@/lib/sfxManager";

export interface ReadingEvidenceHunterProps {
  readingId?: string;
  cefrFilter?: "all" | Level;
  questionCount?: 10 | 20 | 30;
  timeLimit?: number | null;
  onClose?: () => void;
}

interface EvidenceQuestionItem {
  id: string;
  reading: ReadingText;
  soruAr: string;
  soruTr: string;
  cevapAr: string;
  cevapTr: string;
  answerOptions: string[];
  evidenceLineIndices: number[];
  isInferenceQuestion: boolean;
}

const ARABIC_STOP_WORDS = new Set([
  "من",
  "في",
  "الى",
  "علي",
  "على",
  "عن",
  "مع",
  "هل",
  "ما",
  "ماذا",
  "من",
  "متي",
  "متى",
  "اين",
  "كيف",
  "لماذا",
  "كم",
  "هو",
  "هي",
  "هم",
  "هن",
  "انت",
  "انا",
  "نحن",
  "هذا",
  "هذه",
  "ذلك",
  "تلك",
  "ان",
  "كان",
  "كانت",
  "يكون",
  "نعم",
  "لا",
  "لانه",
  "لانها",
  "لان",
  "قد",
  "كل",
  "بين",
]);

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function stripLightArabicPrefixes(normWord: string): string {
  let w = normWord;
  if (w.length >= 5 && (w.startsWith("وال") || w.startsWith("بال") || w.startsWith("كال") || w.startsWith("فال"))) {
    w = w.slice(3);
  } else if (w.length >= 4 && w.startsWith("ال")) {
    w = w.slice(2);
  } else if (w.length >= 4 && (w.startsWith("لل") || w.startsWith("وب") || w.startsWith("وف"))) {
    w = w.slice(2);
  } else if (w.length >= 4 && /^[وفبلك]/.test(w)) {
    w = w.slice(1);
  }
  // İyelik zamiri son eklerini hafiflet
  if (w.length >= 5 && (w.endsWith("هم") || w.endsWith("ها") || w.endsWith("كم") || w.endsWith("نا"))) {
    w = w.slice(0, -2);
  }
  return w;
}

function extractArabicKeywords(text: string): string[] {
  return normalizeArabicText(text)
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !ARABIC_STOP_WORDS.has(w))
    .map(stripLightArabicPrefixes)
    .filter((w) => w.length >= 2);
}

function extractTurkishKeywords(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[.,;:!?()"'«»—–-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !["için", "olan", "olarak", "daha", "gibi", "kadar", "sonra", "önce", "nedir", "nasıl", "neden"].includes(w));
}

/**
 * `cevap_ar` + `soru_ar` (ve yardımcı olarak `cevap_tr`) ile metnin satırları arasındaki
 * kelime/gövde örtüşmesini puanlayarak hedef kanıt cümlesini (`evidenceLineIndices`) belirler.
 */
function computeEvidenceLineIndices(
  lines: ReadingTextLine[],
  soruAr: string,
  cevapAr: string,
  cevapTr: string
): { indices: number[]; isInference: boolean } {
  if (lines.length === 0) return { indices: [0], isInference: false };

  const ansKeys = extractArabicKeywords(cevapAr);
  const qKeys = extractArabicKeywords(soruAr);
  const trKeys = extractTurkishKeywords(cevapTr);

  const scores = lines.map((line) => {
    const lineKeys = extractArabicKeywords(line.arapca);
    const lineTrLower = (line.turkce || "").toLowerCase();
    let score = 0;

    // Cevaptaki yeni bilgi kelimeleri en yüksek ağırlığa sahiptir
    for (const ak of ansKeys) {
      const isAlsoInQuestion = qKeys.includes(ak);
      const weight = isAlsoInQuestion ? 1.4 : 3.2;
      if (lineKeys.some((lk) => lk === ak)) {
        score += weight;
      } else if (
        ak.length >= 3 &&
        lineKeys.some(
          (lk) =>
            lk.length >= 3 &&
            (lk.includes(ak.slice(0, 3)) || ak.includes(lk.slice(0, 3)))
        )
      ) {
        score += weight * 0.65;
      }
    }

    // Sorudaki anahtar kelimeler bağlam satırını destekler
    for (const qk of qKeys) {
      if (lineKeys.some((lk) => lk === qk)) {
        score += 1.1;
      }
    }

    // Türkçe anlam örtüşmesi eşitlik bozucu olarak destek verir
    for (const tk of trKeys) {
      const stem4 = tk.slice(0, Math.min(5, tk.length));
      if (lineTrLower.includes(stem4)) {
        score += 1.25;
      }
    }

    return score;
  });

  const maxScore = Math.max(...scores, 0);
  if (maxScore <= 0) {
    return {
      indices: lines.map((_, idx) => idx),
      isInference: true,
    };
  }

  const threshold = Math.max(1.5, maxScore * 0.78);
  const matchedIndices = scores
    .map((sc, idx) => ({ sc, idx }))
    .filter((item) => item.sc >= threshold || item.sc === maxScore)
    .map((item) => item.idx);

  return {
    indices: matchedIndices.length > 0 ? matchedIndices : [0],
    isInference: maxScore < 2.8,
  };
}

export default function ReadingEvidenceHunter({
  readingId = "all",
  cefrFilter = "all",
  questionCount = 10,
  timeLimit = null,
  onClose,
}: ReadingEvidenceHunterProps) {
  const { arabicFont, speechRate } = useSettings();
  const {
    recordSkillAttempt,
    recordItemAttempt,
    addMistake,
    addStudyMinutes,
  } = useUserStore();

  const [roundSeed, setRoundSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<"answer" | "evidence" | "completed_item">(
    "answer"
  );
  const [wrongAnswers, setWrongAnswers] = useState<string[]>([]);
  const [wrongLineIndices, setWrongLineIndices] = useState<number[]>([]);
  const [highlightedLineIdx, setHighlightedLineIdx] = useState<number | null>(
    null
  );
  const [showTurkishHelp, setShowTurkishHelp] = useState(false);
  const [playingLineSira, setPlayingLineSira] = useState<number | null>(null);
  const [hadMistakeOnCurrent, setHadMistakeOnCurrent] = useState(false);
  const [cleanPassCount, setCleanPassCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    timeLimit
  );

  const audioDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionItems: EvidenceQuestionItem[] = useMemo(() => {
    void roundSeed;
    let sourceTexts = metinler;
    if (readingId && readingId !== "all") {
      const exact = metinler.filter((m) => m.id === readingId);
      if (exact.length > 0) sourceTexts = exact;
    } else if (cefrFilter !== "all") {
      const byLevel = metinler.filter((m) => m.seviye === cefrFilter);
      if (byLevel.length > 0) sourceTexts = byLevel;
    }

    // Seviye bazlı tüm cevap havuzu (gerçekçi denk uzunluklu çeldiriciler için)
    const answersByLevel = new Map<Level, string[]>();
    for (const m of metinler) {
      const arr = answersByLevel.get(m.seviye) || [];
      for (const q of m.sorular) {
        if (q.cevap_ar?.trim()) arr.push(q.cevap_ar.trim());
      }
      answersByLevel.set(m.seviye, arr);
    }

    const rawItems: Omit<EvidenceQuestionItem, "answerOptions">[] = [];
    for (const txt of sourceTexts) {
      txt.sorular.forEach((q, qIdx) => {
        if (!q.soru_ar || !q.cevap_ar) return;
        const ev = computeEvidenceLineIndices(
          txt.satirlar,
          q.soru_ar,
          q.cevap_ar,
          q.cevap_tr
        );
        rawItems.push({
          id: `evh_${txt.id}_${qIdx}`,
          reading: txt,
          soruAr: q.soru_ar,
          soruTr: q.soru_tr,
          cevapAr: q.cevap_ar,
          cevapTr: q.cevap_tr,
          evidenceLineIndices: ev.indices,
          isInferenceQuestion: ev.isInference,
        });
      });
    }

    const picked = shuffleArray(rawItems).slice(
      0,
      Math.min(questionCount, rawItems.length)
    );

    return picked.map((item) => {
      const targetNorm = normalizeArabicText(item.cevapAr);
      const targetWordLen = item.cevapAr.trim().split(/\s+/).length;

      // Önce aynı metnin diğer sorularının cevapları, sonra aynı seviyenin diğer cevapları
      const sameTextAnswers = item.reading.sorular
        .map((sq) => sq.cevap_ar.trim())
        .filter((ans) => normalizeArabicText(ans) !== targetNorm);

      const levelPeers = (answersByLevel.get(item.reading.seviye) || [])
        .filter((ans) => normalizeArabicText(ans) !== targetNorm)
        .map((ans) => ({
          ans,
          diff: Math.abs(ans.split(/\s+/).length - targetWordLen),
          rnd: Math.random(),
        }))
        .sort((a, b) => (a.diff !== b.diff ? a.diff - b.diff : a.rnd - b.rnd))
        .map((x) => x.ans);

      const distractors: string[] = [];
      const seen = new Set<string>([targetNorm]);

      for (const cand of [...shuffleArray(sameTextAnswers), ...levelPeers]) {
        if (distractors.length >= 3) break;
        const norm = normalizeArabicText(cand);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          distractors.push(cand);
        }
      }

      return {
        ...item,
        answerOptions: shuffleArray([
          item.cevapAr.trim(),
          ...distractors.slice(0, 3),
        ]),
      };
    });
  }, [cefrFilter, questionCount, readingId, roundSeed]);

  const currentItem = sessionItems[currentIndex] || null;

  const playReadingLine = useCallback(
    async (reading: ReadingText, line: ReadingTextLine) => {
      setPlayingLineSira(line.sira);
      try {
        await speakHybrid({
          text: line.arapca,
          dialogueId: reading.id,
          lineSira: line.sira,
          rate: speechRate,
        });
      } finally {
        setPlayingLineSira((prev) => (prev === line.sira ? null : prev));
      }
    },
    [speechRate]
  );

  useEffect(() => {
    return () => {
      if (audioDelayRef.current) clearTimeout(audioDelayRef.current);
      stopAllAudio();
    };
  }, []);

  // İsteğe bağlı zamanlayıcı
  useEffect(() => {
    if (
      !timeLimit ||
      isCompleted ||
      step === "completed_item" ||
      remainingSeconds === null ||
      remainingSeconds <= 0
    ) {
      return;
    }
    const timer = setTimeout(() => {
      if (remainingSeconds <= 1) {
        setRemainingSeconds(0);
        if (currentItem) {
          void playWrong();
          recordSkillAttempt("okuma", false);
          recordItemAttempt(
            currentItem.reading.id,
            "sentence",
            false,
            showTurkishHelp,
            25,
            "Metin Kanıt Dedektifi: Süre doldu"
          );
          addMistake(currentItem.reading.id);
          setStreak(0);
          setHighlightedLineIdx(currentItem.evidenceLineIndices[0] ?? 0);
          setStep("completed_item");
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
    recordItemAttempt,
    recordSkillAttempt,
    remainingSeconds,
    showTurkishHelp,
    step,
    timeLimit,
  ]);

  const handleSelectAnswer = async (optionText: string) => {
    if (!currentItem || step !== "answer") return;

    if (
      normalizeArabicText(optionText) ===
      normalizeArabicText(currentItem.cevapAr)
    ) {
      playClick();
      setStep("evidence");
      return;
    }

    setHadMistakeOnCurrent(true);
    setStreak(0);
    if (!wrongAnswers.includes(optionText)) {
      setWrongAnswers((prev) => [...prev, optionText]);
    }
    await playWrong();
  };

  const handleSelectEvidenceLine = async (lineIdx: number) => {
    if (!currentItem || step !== "evidence") return;

    const isValidEvidence = currentItem.evidenceLineIndices.includes(lineIdx);
    if (isValidEvidence) {
      const cleanSuccess =
        !hadMistakeOnCurrent && wrongLineIndices.length === 0;
      const nextStreak = cleanSuccess ? streak + 1 : 1;
      setHighlightedLineIdx(lineIdx);
      setStep("completed_item");
      setStreak(nextStreak);
      if (cleanSuccess) {
        setCleanPassCount((c) => c + 1);
      }

      recordSkillAttempt("okuma", cleanSuccess);
      recordItemAttempt(
        currentItem.reading.id,
        "sentence",
        cleanSuccess,
        showTurkishHelp,
        cleanSuccess ? 100 : 70,
        "Metin Kanıt Dedektifi"
      );
      if (!cleanSuccess) {
        addMistake(currentItem.reading.id);
      }

      await playSuccess({ streak: nextStreak });
      const targetLine = currentItem.reading.satirlar[lineIdx];
      if (targetLine) {
        audioDelayRef.current = setTimeout(() => {
          void playReadingLine(currentItem.reading, targetLine);
        }, 250);
      }
      return;
    }

    setHadMistakeOnCurrent(true);
    setStreak(0);
    if (!wrongLineIndices.includes(lineIdx)) {
      const updated = [...wrongLineIndices, lineIdx];
      setWrongLineIndices(updated);
      await playWrong();
      // 2 yanlış satır denemesinden sonra doğru kanıt satırını fosforlu kalemle göster
      if (updated.length >= 2) {
        const autoIdx = currentItem.evidenceLineIndices[0] ?? 0;
        setHighlightedLineIdx(autoIdx);
        recordSkillAttempt("okuma", false);
        recordItemAttempt(
          currentItem.reading.id,
          "sentence",
          false,
          showTurkishHelp,
          50,
          "Metin Kanıt Dedektifi"
        );
        addMistake(currentItem.reading.id);
        setStep("completed_item");
      }
    }
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
      setStep("answer");
      setWrongAnswers([]);
      setWrongLineIndices([]);
      setHighlightedLineIdx(null);
      setHadMistakeOnCurrent(false);
      setShowTurkishHelp(false);
      setRemainingSeconds(timeLimit);
    } else {
      addStudyMinutes(3);
      const pct =
        sessionItems.length > 0
          ? Math.round((cleanPassCount / sessionItems.length) * 100)
          : 100;
      void playFanfare(pct);
      setIsCompleted(true);
    }
  };

  if (!currentItem) {
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 text-center space-y-4">
        <p className="text-sm font-bold text-[var(--foreground)]">
          Bu filtre için okuma metni sorusu bulunamadı.
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
    const accuracy = Math.round((cleanPassCount / sessionItems.length) * 100);
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 sm:p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-400 flex items-center justify-center text-[#087F5B] dark:text-emerald-300">
          <Trophy size={32} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-[var(--foreground)]">
            Metin Kanıt Dedektifi Tamamlandı!
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
            Tam Kanıt İsabeti:{" "}
            <strong className="text-[#087F5B] dark:text-emerald-400 tabular-nums">
              %{accuracy} ({cleanPassCount}/{sessionItems.length})
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
              setStep("answer");
              setWrongAnswers([]);
              setWrongLineIndices([]);
              setHighlightedLineIdx(null);
              setHadMistakeOnCurrent(false);
              setCleanPassCount(0);
              setStreak(0);
              setIsCompleted(false);
              setRemainingSeconds(timeLimit);
            }}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCcw size={16} />
            <span>Yeni Sorularla Tekrarla</span>
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

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Üst Bilgi Barı */}
      <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
          <Search size={17} className="text-[#087F5B] shrink-0" />
          <span>Metin Kanıt Dedektifi</span>
          <span aria-hidden="true" className="text-[var(--muted)]">·</span>
          <span className="tabular-nums text-[#087F5B] dark:text-emerald-400">
            Soru {currentIndex + 1} / {sessionItems.length}
          </span>
          <span aria-hidden="true" className="text-[var(--muted)]">·</span>
          <span className="text-[var(--muted)]">
            Seviye {currentItem.reading.seviye}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {remainingSeconds !== null && (
            <span className="inline-flex items-center gap-1 text-xs font-black tabular-nums text-[var(--foreground)]">
              <Timer size={14} />
              <span>{remainingSeconds}s</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              playClick();
              setShowTurkishHelp((v) => !v);
            }}
            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Eye size={14} className="text-[#6741D9]" />
            <span>{showTurkishHelp ? "Türkçeyi Gizle" : "Türkçe Yardım"}</span>
          </button>
        </div>
      </div>

      {/* 2 Sütunlu Sahne: Sol/Üst Okuma Metni + Sağ/Alt Soru & Kanıt Yönergesi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* SOL / ÜST PANEL: NUMARALI OKUMA METNİ SATIRLARI */}
        <div className="lg:col-span-7 rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E6D7BE]/70 dark:border-[var(--border)]">
            <div>
              <p
                dir="rtl"
                lang="ar"
                className="arabic font-arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-300 leading-[1.8]"
              >
                {fixArabicTypography(currentItem.reading.baslik_ar, arabicFont)}
              </p>
              <h2 className="text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
                {currentItem.reading.baslik_tr}
              </h2>
            </div>

            {step === "evidence" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/70 border border-amber-400 text-amber-900 dark:text-amber-200 text-xs font-black">
                <Highlighter size={14} />
                <span>Kanıt cümlesine dokunun!</span>
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {currentItem.reading.satirlar.map((line, idx) => {
              const isEvidenceHighlighted =
                step === "completed_item" &&
                (highlightedLineIdx === idx ||
                  currentItem.evidenceLineIndices.includes(idx));
              const wasWrongLine = wrongLineIndices.includes(idx);

              return (
                <div
                  key={line.sira}
                  onClick={() => {
                    if (step === "evidence") {
                      void handleSelectEvidenceLine(idx);
                    }
                  }}
                  role={step === "evidence" ? "button" : undefined}
                  tabIndex={step === "evidence" ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (
                      step === "evidence" &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      void handleSelectEvidenceLine(idx);
                    }
                  }}
                  className={`min-h-[52px] rounded-2xl border-2 p-3 sm:p-3.5 transition-all ${
                    isEvidenceHighlighted
                      ? "bg-amber-100/90 dark:bg-emerald-950/55 border-emerald-500 shadow-xs"
                      : step === "evidence"
                      ? wasWrongLine
                        ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 opacity-65"
                        : "bg-white dark:bg-[var(--background)] border-amber-300 dark:border-amber-700 hover:border-[#087F5B] hover:bg-amber-50/50 dark:hover:bg-emerald-950/25 cursor-pointer"
                      : "bg-white dark:bg-[var(--background)] border-[#E6D7BE]/80 dark:border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-6 h-6 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-black tabular-nums text-[var(--muted)] flex items-center justify-center">
                        {line.sira}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playClick();
                          void playReadingLine(currentItem.reading, line);
                        }}
                        title="Satırı sesli dinle"
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer ${
                          playingLineSira === line.sira
                            ? "bg-[#087F5B] text-white border-[#065F46]"
                            : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[#087F5B] dark:text-emerald-400"
                        }`}
                      >
                        <Volume2 size={15} />
                      </button>
                    </div>

                    <p
                      dir="rtl"
                      lang="ar"
                      className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[var(--foreground)] text-right leading-[1.95] flex-1 break-words"
                    >
                      {fixArabicTypography(line.arapca, arabicFont)}
                    </p>
                  </div>

                  {(showTurkishHelp || isEvidenceHighlighted) && (
                    <p className="text-sm sm:text-base font-semibold text-[var(--muted)] mt-2 pt-1.5 border-t border-[#E6D7BE]/50 dark:border-[var(--border)]">
                      {line.turkce}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SAĞ / ALT PANEL: ANLAMA SORUSU VE 2 ADIMLI AKIŞ */}
        <div className="lg:col-span-5 rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-black text-[#6741D9] dark:text-indigo-300">
            <BookOpen size={15} />
            <span>
              {step === "answer"
                ? "Adım 1/2: Metne Göre Soruyu Cevaplayın"
                : step === "evidence"
                ? "Adım 2/2: Cevabınızın Kanıt Cümlesini Boyayın"
                : "Kanıt Doğrulandı!"}
            </span>
          </div>

          {/* Soru Kutusu */}
          <div className="rounded-2xl bg-[#F3F0FF]/80 dark:bg-indigo-950/35 border border-[#6741D9]/35 p-4 space-y-2">
            <p
              dir="rtl"
              lang="ar"
              className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[#4C28B5] dark:text-indigo-200 text-right leading-[1.95] break-words"
            >
              {fixArabicTypography(currentItem.soruAr, arabicFont)}
            </p>
            {(showTurkishHelp || step !== "answer") && (
              <p className="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-200 pt-1.5 border-t border-[#6741D9]/20">
                “{currentItem.soruTr}”
              </p>
            )}
          </div>

          {/* ADIM 1: 4 CEVAP SEÇENEĞİ */}
          {step === "answer" && (
            <div className="space-y-2.5">
              {currentItem.answerOptions.map((opt, idx) => {
                const isEliminated = wrongAnswers.includes(opt);
                return (
                  <button
                    key={`${opt}-${idx}`}
                    type="button"
                    disabled={isEliminated}
                    onClick={() => void handleSelectAnswer(opt)}
                    className={`w-full min-h-[54px] px-4 py-3 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-3 transition-all ${
                      isEliminated
                        ? "opacity-45 bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 cursor-not-allowed"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-[var(--foreground)] active:translate-y-0.5 cursor-pointer"
                    }`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-black text-[var(--muted)] flex items-center justify-center shrink-0">
                      {["A", "B", "C", "D"][idx]}
                    </span>
                    <span
                      dir="rtl"
                      lang="ar"
                      className="arabic font-arabic text-2xl sm:text-3xl font-bold text-right leading-[1.95] flex-1 break-words"
                    >
                      {fixArabicTypography(opt, arabicFont)}
                    </span>
                    {isEliminated && (
                      <XCircle size={18} className="text-rose-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ADIM 2: METİNDEN KANIT CÜMLESİNİ BOYAMA YÖNERGESİ */}
          {step === "evidence" && (
            <div className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">
                <Highlighter size={18} className="shrink-0" />
                <span>🖍️ Metinden Kanıt Cümlesini Boya!</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-amber-950 dark:text-amber-100 leading-relaxed">
                Harika! Doğru cevabı buldunuz. Şimdi bu cevabın kanıtı olan cümleyi metnin içinden seçerek fosforlu kalemle işaretleyin.
              </p>

              <div className="rounded-xl bg-white/90 dark:bg-[var(--background)] border border-amber-300 dark:border-amber-800 p-3 space-y-1">
                <span className="text-[11px] font-extrabold text-[#087F5B] dark:text-emerald-400">
                  Seçtiğiniz Doğru Cevap:
                </span>
                <p
                  dir="rtl"
                  lang="ar"
                  className="arabic font-arabic text-xl font-bold text-[#065F46] dark:text-emerald-300 text-right leading-[1.95]"
                >
                  {fixArabicTypography(currentItem.cevapAr, arabicFont)}
                </p>
              </div>
            </div>
          )}

          {/* ADIM 3: KANIT TAMAMLANDI KARTI */}
          {step === "completed_item" && (
            <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/35 border-2 border-emerald-400 dark:border-emerald-700 p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[#065F46] dark:text-emerald-300">
                <CheckCircle2 size={18} />
                <span>
                  Kanıt Cümlesi{" "}
                  {currentItem.evidenceLineIndices
                    .map((i) => `#${currentItem.reading.satirlar[i]?.sira ?? i + 1}`)
                    .join(", ")}{" "}
                  Doğrulandı!
                </span>
              </div>

              <p
                dir="rtl"
                lang="ar"
                className="arabic font-arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-300 text-right leading-[1.95]"
              >
                {fixArabicTypography(currentItem.cevapAr, arabicFont)}
              </p>
              <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                “{currentItem.cevapTr}”
              </p>

              {currentItem.isInferenceQuestion && (
                <div className="flex items-start gap-2 pt-2 border-t border-emerald-200/70 dark:border-emerald-800/60 text-xs font-semibold text-amber-900 dark:text-amber-200">
                  <Lightbulb size={15} className="shrink-0 mt-0.5" />
                  <span>
                    Çıkarım Notu: Bu soru metnin bağlamından dolaylı çıkarım içermektedir; en güçlü anlamsal ipucu işaretlenen satırda yer alır.
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="w-full min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {currentIndex + 1 < sessionItems.length
                    ? "Sonraki Kanıt Sorusuna Geç"
                    : "Sonuçları Gör"}
                </span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
