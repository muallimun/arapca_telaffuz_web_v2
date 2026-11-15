"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Volume2,
  CheckCircle2,
  XCircle,
  Trophy,
  RefreshCcw,
  Play,
  Target,
  Share2,
  Timer,
  Flame,
  ArrowRight,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { Level, ResimliKelime } from "@/types/data";
import {
  gorselKelimeler,
  getMainVisualCategory,
  resolveImageUrl,
} from "@/lib/data";
import { selectSmartVisualDistractors, shuffleArray } from "@/lib/quiz";
import { playDualGenderAudio, loadAudioManifest } from "@/lib/audio";
import {
  playClick,
  playCorrect,
  playWrong,
  playFanfare,
  playStart,
} from "@/lib/sfxManager";
import { useUserStore } from "@/store/userStore";
import { useSettings } from "@/store/settings";
import { formatArabicText, formatTurkishCategory } from "@/lib/arabicTextUtils";
import { MixedText } from "@/components/ui/MixedText";
import { saveLastExerciseSummary } from "@/lib/learningAnalytics";
import ShareAchievementModal from "@/components/ui/ShareAchievementModal";

interface WhatIsThisQuestion {
  id: string;
  target: ResimliKelime;
  options: ResimliKelime[];
}

interface WhatIsThisGameProps {
  visualPool: ResimliKelime[];
  cefrFilter?: "all" | Level;
  questionCount?: 10 | 20 | 30;
  timeLimit?: number | null;
  onClose?: () => void;
}

const CANONICAL_VISUAL_BY_ID = new Map<string, ResimliKelime>(
  gorselKelimeler
    .filter((item) => Boolean(item.gorsel && item.arapca && item.turkce))
    .map((item) => [item.id, item])
);

export default function WhatIsThisGame({
  visualPool,
  cefrFilter = "all",
  questionCount = 10,
  timeLimit = null,
  onClose,
}: WhatIsThisGameProps) {
  const {
    addMistake,
    recordItemAttempt,
    recordSkillAttempt,
    addStudyMinutes,
  } = useUserStore();
  const {
    speechRate,
    showHareke,
    arabicFont,
    preferredVoiceGender,
  } = useSettings();

  const [roundSeed, setRoundSeed] = useState(0);
  const [customQuestions, setCustomQuestions] = useState<
    WhatIsThisQuestion[] | null
  >(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [usedAudioHint, setUsedAudioHint] = useState(false);
  const [answersMap, setAnswersMap] = useState<
    Record<number, { chosenId: string; isCorrect: boolean }>
  >({});
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(timeLimit);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [shareOpen, setShareOpen] = useState(false);

  const summarySavedRef = useRef(false);
  const answerLockedRef = useRef(false);

  useEffect(() => {
    void loadAudioManifest();
  }, []);

  const cleanSourcePool = useMemo(() => {
    const incoming = visualPool
      .map((item) => CANONICAL_VISUAL_BY_ID.get(item.id))
      .filter((item): item is ResimliKelime => Boolean(item));
    if (incoming.length >= 4) return incoming;
    const byCefr =
      cefrFilter === "all"
        ? Array.from(CANONICAL_VISUAL_BY_ID.values())
        : Array.from(CANONICAL_VISUAL_BY_ID.values()).filter(
            (w) => w.cefr === cefrFilter
          );
    return byCefr.length >= 4
      ? byCefr
      : Array.from(CANONICAL_VISUAL_BY_ID.values());
  }, [visualPool, cefrFilter]);

  const generatedQuestions = useMemo((): WhatIsThisQuestion[] => {
    const allVisuals = Array.from(CANONICAL_VISUAL_BY_ID.values());
    const candidates = shuffleArray(cleanSourcePool).slice(0, questionCount);
    return candidates.map((target, idx) => {
      const distractors = selectSmartVisualDistractors(target, allVisuals, 3);
      return {
        id: `wit_${roundSeed}_${idx}_${target.id}`,
        target,
        options: shuffleArray([target, ...distractors]),
      };
    });
  }, [cleanSourcePool, questionCount, roundSeed]);

  const questions = customQuestions ?? generatedQuestions;
  const currentQuestion = questions[currentIndex] || questions[0];
  const currentAnswer = answersMap[currentIndex];
  const isAnswered = Boolean(currentAnswer);

  useEffect(() => {
    answerLockedRef.current = Boolean(answersMap[currentIndex]);
  }, [currentIndex, answersMap]);

  const correctCount = useMemo(
    () => Object.values(answersMap).filter((a) => a.isCorrect).length,
    [answersMap]
  );

  const finalizeSession = useCallback(
    (timedOut: boolean) => {
      if (summarySavedRef.current) return;
      summarySavedRef.current = true;
      const totalQ = questions.length;
      const solvedCount = Object.keys(answersMap).length;
      const rightCount = Object.values(answersMap).filter(
        (a) => a.isCorrect
      ).length;
      const wrongCount = Math.max(0, totalQ - rightCount);
      saveLastExerciseSummary({
        moduleName: "Bu Nedir? (Görselden Kelime)",
        solved: Math.max(solvedCount, totalQ),
        correct: rightCount,
        wrong: wrongCount,
      });
      addStudyMinutes(Math.max(1, Math.round(totalQ / 5)));
      if (!timedOut) {
        playFanfare();
      }
    },
    [questions.length, answersMap, addStudyMinutes]
  );

  // Opsiyonel süre sayacı (ESLint set-state-in-effect uyumlu interval callback)
  useEffect(() => {
    if (
      timeLimit === null ||
      isFinished ||
      isTimeUp ||
      isAnswered
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        const cur = prev ?? timeLimit;
        if (cur <= 1) {
          window.clearInterval(interval);
          setIsTimeUp(true);
          finalizeSession(true);
          return 0;
        }
        return cur - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [currentIndex, timeLimit, isFinished, isTimeUp, isAnswered, finalizeSession]);

  const speakVisualWord = useCallback(
    (word: ResimliKelime) => {
      void playDualGenderAudio({
        text: word.arapca,
        id: word.id,
        ses_erkek: word.ses_erkek,
        ses_kadin: word.ses_kadin,
        gender: preferredVoiceGender,
        rate: speechRate,
      });
    },
    [preferredVoiceGender, speechRate]
  );

  const handleSelectOption = useCallback(
    (option: ResimliKelime) => {
      if (
        !currentQuestion ||
        isAnswered ||
        answerLockedRef.current ||
        isFinished ||
        isTimeUp
      ) {
        return;
      }
      answerLockedRef.current = true;

      const isCorrect = option.id === currentQuestion.target.id;
      setSelectedOptionId(option.id);

      const nextAnswers = {
        ...answersMap,
        [currentIndex]: { chosenId: option.id, isCorrect },
      };
      setAnswersMap(nextAnswers);

      recordItemAttempt(
        currentQuestion.target.id,
        "word",
        isCorrect,
        usedAudioHint
      );
      recordSkillAttempt("kelime", isCorrect);

      if (isCorrect) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        if (nextStreak > bestStreak) setBestStreak(nextStreak);
        playCorrect();
      } else {
        setStreak(0);
        playWrong();
        addMistake(currentQuestion.target.id);
      }

      speakVisualWord(currentQuestion.target);
    },
    [
      currentQuestion,
      isAnswered,
      isFinished,
      isTimeUp,
      answersMap,
      currentIndex,
      recordItemAttempt,
      recordSkillAttempt,
      usedAudioHint,
      streak,
      bestStreak,
      addMistake,
      speakVisualWord,
    ]
  );

  const handleNextQuestion = useCallback(() => {
    answerLockedRef.current = false;
    playClick();
    setSelectedOptionId(null);
    setUsedAudioHint(false);
    setTimeLeft(timeLimit);
    if (currentIndex >= questions.length - 1) {
      setIsFinished(true);
      finalizeSession(false);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, questions.length, timeLimit, finalizeSession]);

  // Klavye kısayolları (1-4 şık seçimi, Enter / Sağ Ok sonraki soru)
  useEffect(() => {
    if (isFinished || isTimeUp || !currentQuestion) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const targetEl = e.target as HTMLElement | null;
      const tag = targetEl?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        targetEl?.isContentEditable
      ) {
        return;
      }
      if (!isAnswered && ["1", "2", "3", "4"].includes(e.key)) {
        const optIdx = parseInt(e.key, 10) - 1;
        const opt = currentQuestion.options[optIdx];
        if (opt) {
          e.preventDefault();
          handleSelectOption(opt);
        }
      } else if (
        isAnswered &&
        (e.key === "Enter" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        handleNextQuestion();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isFinished,
    isTimeUp,
    currentQuestion,
    isAnswered,
    handleSelectOption,
    handleNextQuestion,
  ]);

  const formatAr = (text: string) =>
    formatArabicText(text, showHareke, arabicFont);

  const resetForNewRun = (nextCustom: WhatIsThisQuestion[] | null, bumpSeed: boolean) => {
    playStart();
    summarySavedRef.current = false;
    answerLockedRef.current = false;
    setCustomQuestions(nextCustom);
    if (bumpSeed) setRoundSeed((s) => s + 1);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setUsedAudioHint(false);
    setAnswersMap({});
    setStreak(0);
    setIsFinished(false);
    setIsTimeUp(false);
    setTimeLeft(timeLimit);
  };

  const wrongQuestions = useMemo(
    () => questions.filter((_, idx) => !answersMap[idx]?.isCorrect),
    [questions, answersMap]
  );

  if (!currentQuestion) return null;

  if (isFinished || isTimeUp) {
    const totalQ = questions.length;
    const wrongCount = Math.max(0, totalQ - correctCount);
    const pct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const totalPoints = correctCount * 12;

    return (
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-5 sm:p-7 space-y-4 max-w-2xl mx-auto">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#E6FCF5] dark:bg-emerald-950/60 border-2 border-b-4 border-[#087F5B] text-[#087F5B] dark:text-emerald-300 flex items-center justify-center mx-auto">
            <Trophy size={32} />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--foreground)]">
              {isFinished
                ? "🖼️ Bu Nedir? Turu Tamamlandı!"
                : "⏱️ Süre Doldu!"}
            </h3>
            <p className="text-xs font-semibold text-[var(--muted)]">
              {totalQ} görsel sorusundan {correctCount} doğru, {wrongCount}{" "}
              yanlış yanıt verdiniz • En yüksek seri: {bestStreak}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
            <div className="bg-white dark:bg-[var(--background)] rounded-xl p-2.5 border border-[#E6D7BE] dark:border-[var(--border)]">
              <span className="block text-[10px] font-bold text-[var(--muted)] uppercase">
                Başarı
              </span>
              <span className="text-lg font-black text-[#6741D9] dark:text-indigo-300 tabular-nums">
                %{pct}
              </span>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-2.5 border border-emerald-300 dark:border-emerald-700">
              <span className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                Doğru
              </span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                {correctCount}
              </span>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/40 rounded-xl p-2.5 border border-rose-300 dark:border-rose-700">
              <span className="block text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                Yanlış
              </span>
              <span className="text-lg font-black text-rose-700 dark:text-rose-300 tabular-nums">
                {wrongCount}
              </span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl p-2.5 border border-amber-300 dark:border-amber-700">
              <span className="block text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                Puan
              </span>
              <span className="text-lg font-black text-amber-800 dark:text-amber-300 tabular-nums">
                +{totalPoints}
              </span>
            </div>
          </div>
        </div>

        <ShareAchievementModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          title="🖼️ Bu Nedir? — Görselden Arapça Kelime"
          subtitle={`${totalQ} Görselden ${correctCount} Doğru Yanıt`}
          levelLabel={cefrFilter === "all" ? "A1-B2" : cefrFilter}
          scorePercent={pct}
          pointsText={`${totalPoints} Puan`}
          wordsCount={totalQ}
          badgeType="exercise"
        />

        <button
          type="button"
          onClick={() => {
            playClick();
            setShareOpen(true);
          }}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-b-4 border-amber-800 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Share2 size={16} />
          <span>🏆 Başarı Kartını Paylaş / İndir</span>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() =>
              resetForNewRun(
                questions.map((q) => ({
                  ...q,
                  options: shuffleArray([...q.options]),
                })),
                false
              )
            }
            className="py-3 px-4 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 font-extrabold text-xs text-[var(--foreground)] hover:border-[#6741D9] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCcw size={15} className="text-[#6741D9]" />
            <span>Aynı Görselleri Tekrarla</span>
          </button>

          <button
            type="button"
            onClick={() => resetForNewRun(null, true)}
            className="py-3 px-4 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-4 border-[#065F46] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Play size={15} fill="currentColor" />
            <span>Yeni Görsel Seti</span>
          </button>

          {wrongQuestions.length > 0 && (
            <button
              type="button"
              onClick={() =>
                resetForNewRun(
                  shuffleArray(
                    wrongQuestions.map((q) => ({
                      ...q,
                      options: shuffleArray([...q.options]),
                    }))
                  ),
                  false
                )
              }
              className="sm:col-span-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white border-b-4 border-amber-700 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Target size={15} />
              <span>Yanlışlarımı Tekrarla ({wrongQuestions.length})</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={() => {
                playClick();
                onClose();
              }}
              className="sm:col-span-2 py-2.5 px-4 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-[var(--muted)] hover:text-[var(--foreground)] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <X size={15} />
              <span>Kapat / Alıştırma Merkezine Dön</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const target = currentQuestion.target;
  const resolvedImgUrl = resolveImageUrl(target.gorsel);
  const isImageBroken = Boolean(failedImages[resolvedImgUrl]);
  const arabicQuestionTag =
    target.soru_kalibi && target.soru_kalibi.trim().length > 0
      ? target.soru_kalibi
      : target.tur === "fiil"
      ? "مَاذَا يَفْعَلُ؟"
      : "مَا هٰذَا؟ / مَا هٰذِهِ؟";
  const categoryLabel =
    getMainVisualCategory(target.kategori_tr || target.kategori || "") ||
    formatTurkishCategory(target.kategori_tr || target.kategori || "Görsel Kelime");

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {/* ÜST İLERLEME, SERİ VE SORU GEZGİNİ ÇUBUĞU */}
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 px-3.5 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] tabular-nums">
              Görsel {currentIndex + 1} / {questions.length}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-[#E6FCF5] dark:bg-emerald-950/60 border border-[#087F5B]/30 text-[10.5px] font-extrabold text-[#065F46] dark:text-emerald-300">
              🖼️ {categoryLabel} • {target.cefr || "A1"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-400/70 text-[11px] font-extrabold text-amber-900 dark:text-amber-200 tabular-nums">
                <Flame size={13} className="text-amber-600" />
                <span>{streak} Seri</span>
              </span>
            )}

            {timeLeft !== null && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl border text-xs font-black tabular-nums ${
                  timeLeft <= 5
                    ? "bg-rose-100 border-rose-300 text-rose-700 animate-pulse"
                    : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-amber-800 dark:text-amber-300"
                }`}
              >
                <Timer size={13} />
                <span>{timeLeft} sn</span>
              </span>
            )}

            <span className="text-xs font-extrabold text-[#065F46] dark:text-emerald-400 bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] px-2.5 py-0.5 rounded-xl tabular-nums">
              Doğru: {correctCount}
            </span>
          </div>
        </div>

        {/* Numaralı Gezgin */}
        <div className="grid grid-cols-10 gap-1 sm:flex sm:flex-wrap items-center justify-center sm:gap-1.5 pt-1 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
          {questions.map((_, idx) => {
            const ans = answersMap[idx];
            const active = idx === currentIndex;
            const cls = active
              ? "ring-2 ring-[#087F5B] bg-[#087F5B] text-white border-[#065F46] font-extrabold"
              : ans
              ? ans.isCorrect
                ? "bg-emerald-500 text-white border-emerald-600 font-bold"
                : "bg-rose-500 text-white border-rose-600 font-bold"
              : "bg-white/80 dark:bg-slate-800 text-[var(--muted)] border-[#E6D7BE] dark:border-slate-700 font-semibold";
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  playClick();
                  setSelectedOptionId(answersMap[idx]?.chosenId ?? null);
                  setTimeLeft(timeLimit);
                  setCurrentIndex(idx);
                }}
                className={`h-6.5 w-full sm:w-7 sm:h-7 rounded-lg border text-[11px] tabular-nums flex items-center justify-center transition-all cursor-pointer ${cls}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* BÜYÜK GÖRSEL VİTRİNİ + SORU KÖKÜ */}
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] pb-2.5">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span
              dir="rtl"
              lang="ar"
              className="arabic text-lg sm:text-xl font-bold px-2.5 py-0.5 rounded-xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border border-[#6741D9]/40 text-[#4C28B5] dark:text-[#d0bfff]"
            >
              {formatAr(arabicQuestionTag)}
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
              Bu görselin Arapçası nedir?
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              playClick();
              if (!isAnswered) setUsedAudioHint(true);
              speakVisualWord(target);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-2 border-[#065F46] shrink-0 cursor-pointer"
          >
            <Volume2 size={14} />
            <span>{isAnswered ? "Sesi Dinle" : "Sesli İpucu"}</span>
          </button>
        </div>

        {/* Net, Kırpılmayan (object-contain) Büyük Kelime Görseli */}
        <div className="w-full h-48 sm:h-60 md:h-64 rounded-2xl bg-white dark:bg-slate-900/90 border-2 border-[#E6D7BE] dark:border-slate-700 p-3 sm:p-4 flex items-center justify-center shadow-xs relative overflow-hidden">
          {!isImageBroken ? (
            <img
              src={resolvedImgUrl}
              alt="Görsel kelime sorusu"
              referrerPolicy="no-referrer"
              loading="eager"
              onError={() =>
                setFailedImages((prev) => ({ ...prev, [resolvedImgUrl]: true }))
              }
              className="w-full h-full object-contain select-none transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
              <ImageIcon size={36} className="text-[#087F5B] opacity-70" />
              <span className="text-base sm:text-lg font-extrabold text-[var(--foreground)]">
                {target.turkce}
              </span>
            </div>
          )}

          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-[#F7EFE1]/95 dark:bg-slate-800/95 border border-[#E6D7BE] dark:border-slate-600 text-[10px] font-extrabold text-[var(--muted)]">
            {target.tur === "fiil" ? "⚡ Fiil" : "📘 İsim"}
          </span>
        </div>

        {/* 4 HAREKELİ ARAPÇA KELİME ŞIKKI (Mobil & Masaüstü %100 Responsive 2x2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {currentQuestion.options.map((opt, idx) => {
            const isTargetOpt = opt.id === target.id;
            const isChosenOpt =
              (currentAnswer?.chosenId ?? selectedOptionId) === opt.id;

            let btnStyle =
              "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-[var(--foreground)]";

            if (isAnswered) {
              if (isTargetOpt) {
                btnStyle =
                  "bg-emerald-50 dark:bg-emerald-950/60 border-[#087F5B] text-[#065F46] dark:text-emerald-300 ring-2 ring-[#087F5B]/40";
              } else if (isChosenOpt) {
                btnStyle =
                  "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-200";
              } else {
                btnStyle =
                  "bg-white/60 dark:bg-[var(--background)] border-[#E6D7BE]/60 opacity-65 text-[var(--muted)]";
              }
            }

            return (
              <button
                key={opt.id}
                type="button"
                dir="rtl"
                disabled={isAnswered}
                onClick={() => handleSelectOption(opt)}
                className={`min-h-[62px] sm:min-h-[70px] px-3.5 py-2.5 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-2.5 transition-all ${
                  isAnswered
                    ? "cursor-default"
                    : "cursor-pointer active:border-b-2 active:translate-y-0.5"
                } ${btnStyle}`}
              >
                <span
                  className={`w-7 h-7 rounded-xl border text-xs font-black tabular-nums flex items-center justify-center shrink-0 ${
                    isAnswered && isTargetOpt
                      ? "bg-[#087F5B] border-[#065F46] text-white"
                      : isAnswered && isChosenOpt
                      ? "bg-rose-600 border-rose-700 text-white"
                      : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-slate-700 text-[var(--muted)]"
                  }`}
                >
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0 text-right">
                  <span
                    dir="rtl"
                    lang="ar"
                    className="arabic text-2xl sm:text-3xl font-bold block leading-relaxed text-right truncate"
                  >
                    {formatAr(opt.arapca)}
                  </span>
                  {isAnswered && (
                    <span
                      dir="ltr"
                      lang="tr"
                      className="block text-[11px] font-bold text-[var(--muted)] text-right truncate"
                    >
                      {opt.turkce}
                    </span>
                  )}
                </div>

                <div className="w-6 flex items-center justify-center shrink-0">
                  {isAnswered && isTargetOpt && (
                    <CheckCircle2
                      size={20}
                      className="text-[#087F5B] dark:text-emerald-400"
                    />
                  )}
                  {isAnswered && isChosenOpt && !isTargetOpt && (
                    <XCircle
                      size={20}
                      className="text-rose-600 dark:text-rose-400"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ANLIK PEDAGOJİK GERİ BİLDİRİM: Türkçe Anlam + Kök + Örnek Cümle + Sonraki Butonu */}
        {isAnswered && (
          <div
            className={`rounded-2xl border-2 p-3.5 space-y-2 transition-all ${
              currentAnswer?.isCorrect
                ? "bg-emerald-50/90 dark:bg-emerald-950/45 border-[#087F5B]"
                : "bg-amber-50/95 dark:bg-amber-950/45 border-amber-400 dark:border-amber-700"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span
                  className={`text-xs sm:text-sm font-extrabold ${
                    currentAnswer?.isCorrect
                      ? "text-[#065F46] dark:text-emerald-300"
                      : "text-amber-900 dark:text-amber-200"
                  }`}
                >
                  {currentAnswer?.isCorrect
                    ? "✅ Tebrikler, doğru eşleştirme!"
                    : `💡 Doğru Cevap:`}
                </span>
                <span
                  dir="rtl"
                  lang="ar"
                  className="arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-300"
                >
                  {formatAr(target.arapca)}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
                  — {target.turkce}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]">
                {target.kok && target.kok !== "-" && (
                  <span className="px-2 py-0.5 rounded-lg bg-white/90 dark:bg-slate-900 border border-[#E6D7BE] dark:border-slate-700">
                    Kök:{" "}
                    <strong className="arabic text-sm text-[var(--foreground)]">
                      {target.kok}
                    </strong>
                  </span>
                )}
                {target.ikincil_form && target.ikincil_form !== "-" && (
                  <span className="px-2 py-0.5 rounded-lg bg-white/90 dark:bg-slate-900 border border-[#E6D7BE] dark:border-slate-700">
                    {target.tur === "fiil" ? "Muzâri:" : "Çoğul:"}{" "}
                    <strong className="arabic text-sm text-[var(--foreground)]">
                      {formatAr(target.ikincil_form)}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            {target.ornek_ar && target.ornek_ar.trim().length > 0 && (
              <div className="rounded-xl bg-white/90 dark:bg-slate-900/85 border border-[#E6D7BE] dark:border-slate-700 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="space-y-0.5 min-w-0">
                  <p
                    dir="rtl"
                    lang="ar"
                    className="arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 leading-relaxed"
                  >
                    {formatAr(target.ornek_ar)}
                  </p>
                  {target.ornek_tr && (
                    <p
                      dir="ltr"
                      lang="tr"
                      className="font-sans text-xs font-semibold text-[var(--muted)]"
                    >
                      <MixedText text={target.ornek_tr} />
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={handleNextQuestion}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold border-b-3 border-[#065F46] active:border-b-0 active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>
                  {currentIndex >= questions.length - 1
                    ? "Turu Tamamla"
                    : "Sonraki Görsel"}
                </span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
