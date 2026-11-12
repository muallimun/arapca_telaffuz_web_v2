"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Image as ImageIcon,
  Lightbulb,
  RefreshCcw,
  Timer,
  Trophy,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import { getVisualWordCoverUrl, gorselKelimeler } from "@/lib/data";
import type { Level, ResimliKelime } from "@/types/data";
import { playDualGenderAudio, playTTS, stopAllAudio } from "@/lib/audio";
import {
  fixArabicTypography,
  removeArabicHarakat,
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

export interface GenderSortingGameProps {
  visualPool?: ResimliKelime[];
  cefrFilter?: "all" | Level;
  questionCount?: 10 | 20 | 30;
  timeLimit?: number | null;
  onClose?: () => void;
}

type NounGender = "masculine" | "feminine";

interface GenderQuestionItem {
  word: ResimliKelime;
  expectedGender: NounGender;
  coverUrl: string;
  demonstrativeSentenceAr: string;
  morphologicalHintTr: string;
}

function shuffleList<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Kelimenin son harfine ve yapısına göre 1 satırlık morfolojik müzekker/müennes ipucu üretir.
 */
function buildGenderMorphologyHint(
  arabicWord: string,
  expectedGender: NounGender
): string {
  const skeleton = removeArabicHarakat(arabicWord.normalize("NFC"))
    .replace(/[.,،؛؟?!()"'«»[\]{}\s]/g, "")
    .trim();

  if (expectedGender === "feminine") {
    if (skeleton.endsWith("ة")) {
      return "Sonundaki kapalı tâ (ة — tâ-i merbûta) alametinden kelimenin dişil (müennes) olduğu anlaşılır.";
    }
    if (skeleton.endsWith("اء")) {
      return "Sonundaki uzatmalı müenneslik elifi (اء — elif-i memdûde) sebebiyle dişil (müennes) isimdir.";
    }
    if (skeleton.endsWith("ى")) {
      return "Sonundaki müenneslik elifi (ى — elif-i maksûre) alametinden dişil (müennes) olduğu anlaşılır.";
    }
    return "⭐ Dikkat: Sonunda ة bulunmamasına rağmen Arapçada semâî veya hakikî müennes kabul edilir ve هَذِهِ ile işaret edilir!";
  }

  return "Sonunda müenneslik alameti (ة) bulunmayan ve semâî müennes olmayan eril (müzekker) isimdir; هَذَا ile işaret edilir.";
}

/**
 * Belirli (الـ) kelimeyi nekra işaret cümlesine ("هَذَا كِتَابٌ" / "هَذِهِ سَيَّارَةٌ") dönüştürür.
 */
function buildDemonstrativePhrase(
  arabicWord: string,
  gender: NounGender
): string {
  const clean = arabicWord.trim();
  const prefix = gender === "masculine" ? "هَذَا" : "هَذِهِ";
  return `${prefix} ${clean}`;
}

export default function GenderSortingGame({
  visualPool,
  cefrFilter = "all",
  questionCount = 10,
  timeLimit = null,
  onClose,
}: GenderSortingGameProps) {
  const { arabicFont, preferredVoiceGender, speechRate } = useSettings();
  const {
    recordSkillAttempt,
    recordItemAttempt,
    addMistake,
    addStudyMinutes,
  } = useUserStore();

  const [roundSeed, setRoundSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedBasket, setSelectedBasket] = useState<NounGender | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    timeLimit
  );

  const audioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allGenderNouns = useMemo(() => {
    const candidateSource =
      visualPool && visualPool.length >= 8 ? visualPool : gorselKelimeler;

    const filterEligible = (list: ResimliKelime[]) =>
      list.filter(
        (w) =>
          w.tur === "isim" &&
          (w.soru_kalibi === "مَا هَذَا؟" || w.soru_kalibi === "مَا هَذِهِ؟")
      );

    let eligible = filterEligible(candidateSource);
    if (eligible.length < 8) {
      eligible = filterEligible(gorselKelimeler);
    }

    if (cefrFilter !== "all") {
      const byLvl = eligible.filter((w) => w.cefr === cefrFilter);
      if (byLvl.length >= 6) {
        eligible = byLvl;
      }
    }

    return eligible;
  }, [cefrFilter, visualPool]);

  const sessionQuestions: GenderQuestionItem[] = useMemo(() => {
    void roundSeed;
    const masc = shuffleList(
      allGenderNouns.filter((w) => w.soru_kalibi === "مَا هَذَا؟")
    );
    const fem = shuffleList(
      allGenderNouns.filter((w) => w.soru_kalibi === "مَا هَذِهِ؟")
    );

    const half = Math.ceil(questionCount / 2);
    const balanced = shuffleList([
      ...masc.slice(0, half),
      ...fem.slice(0, half),
    ]).slice(0, Math.min(questionCount, allGenderNouns.length));

    return balanced.map((word) => {
      const expectedGender: NounGender =
        word.soru_kalibi === "مَا هَذِهِ؟" ? "feminine" : "masculine";
      return {
        word,
        expectedGender,
        coverUrl: getVisualWordCoverUrl(word),
        demonstrativeSentenceAr: buildDemonstrativePhrase(
          word.arapca,
          expectedGender
        ),
        morphologicalHintTr: buildGenderMorphologyHint(
          word.arapca,
          expectedGender
        ),
      };
    });
  }, [allGenderNouns, questionCount, roundSeed]);

  const currentItem = sessionQuestions[currentIndex] || null;

  const playWordOnly = useCallback(
    async (item: ResimliKelime) => {
      await playDualGenderAudio({
        text: item.arapca,
        id: item.id,
        ses_erkek: item.ses_erkek,
        ses_kadin: item.ses_kadin,
        gender: preferredVoiceGender,
        rate: speechRate,
      });
    },
    [preferredVoiceGender, speechRate]
  );

  const playDemonstrativeVerification = useCallback(
    async (phraseAr: string) => {
      await playTTS(phraseAr, speechRate, preferredVoiceGender);
    },
    [preferredVoiceGender, speechRate]
  );

  useEffect(() => {
    return () => {
      if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
      stopAllAudio();
    };
  }, []);

  const handleChooseBasket = useCallback(
    async (choice: NounGender) => {
      if (!currentItem || selectedBasket !== null) return;

      setSelectedBasket(choice);
      const isRight = choice === currentItem.expectedGender;

      recordSkillAttempt("kelime", isRight);
      recordSkillAttempt("gramer", isRight);
      recordItemAttempt(
        currentItem.word.id,
        "word",
        isRight,
        false,
        isRight ? 100 : 35,
        "Müzekker / Müennes Sepeti"
      );

      if (isRight) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        setBestCombo((prev) => Math.max(prev, nextCombo));
        setCorrectCount((c) => c + 1);
        await playSuccess({ streak: nextCombo });
      } else {
        setCombo(0);
        addMistake(currentItem.word.id);
        await playWrong();
      }

      audioTimerRef.current = setTimeout(() => {
        void playDemonstrativeVerification(currentItem.demonstrativeSentenceAr);
      }, 250);
    },
    [
      addMistake,
      combo,
      currentItem,
      playDemonstrativeVerification,
      recordItemAttempt,
      recordSkillAttempt,
      selectedBasket,
    ]
  );

  const handleNext = useCallback(() => {
    playClick();
    if (audioTimerRef.current) {
      clearTimeout(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    stopAllAudio();

    if (currentIndex + 1 < sessionQuestions.length) {
      setCurrentIndex((i) => i + 1);
      setSelectedBasket(null);
      setImgFailed(false);
      setRemainingSeconds(timeLimit);
    } else {
      addStudyMinutes(2);
      const pct =
        sessionQuestions.length > 0
          ? Math.round((correctCount / sessionQuestions.length) * 100)
          : 100;
      void playFanfare(pct);
      setIsCompleted(true);
    }
  }, [
    addStudyMinutes,
    correctCount,
    currentIndex,
    sessionQuestions.length,
    timeLimit,
  ]);

  // Klavye kısayolları: Sol Ok -> هَذَا (Eril), Sağ Ok -> هَذِهِ (Dişil), Enter/Space -> Sonraki
  useEffect(() => {
    if (isCompleted || !currentItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector(".fixed.inset-0")) return;
      if (selectedBasket === null) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          void handleChooseBasket("masculine");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          void handleChooseBasket("feminine");
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentItem, handleChooseBasket, handleNext, isCompleted, selectedBasket]);

  // İsteğe bağlı süre sayacı
  useEffect(() => {
    if (
      !timeLimit ||
      isCompleted ||
      selectedBasket !== null ||
      remainingSeconds === null ||
      remainingSeconds <= 0
    ) {
      return;
    }
    const timer = setTimeout(() => {
      if (remainingSeconds <= 1) {
        setRemainingSeconds(0);
        if (currentItem) {
          setSelectedBasket(
            currentItem.expectedGender === "masculine"
              ? "feminine"
              : "masculine"
          );
          setCombo(0);
          recordSkillAttempt("kelime", false);
          recordItemAttempt(
            currentItem.word.id,
            "word",
            false,
            false,
            20,
            "Müzekker/Müennes Sepeti: Süre doldu"
          );
          addMistake(currentItem.word.id);
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
    recordItemAttempt,
    recordSkillAttempt,
    remainingSeconds,
    selectedBasket,
    timeLimit,
  ]);

  if (!currentItem) {
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 text-center space-y-4">
        <p className="text-sm font-bold text-[var(--foreground)]">
          Bu filtre için görsel isim kartı bulunamadı.
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
    const accuracy = Math.round((correctCount / sessionQuestions.length) * 100);
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 sm:p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-400 flex items-center justify-center text-[#087F5B] dark:text-emerald-300">
          <Trophy size={32} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-[var(--foreground)]">
            Müzekker / Müennes Sepeti Tamamlandı!
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
            Doğruluk:{" "}
            <strong className="text-[#087F5B] dark:text-emerald-400 tabular-nums">
              %{accuracy} ({correctCount}/{sessionQuestions.length})
            </strong>{" "}
            · En Yüksek Seri:{" "}
            <strong className="text-amber-600 dark:text-amber-400 tabular-nums">
              {bestCombo}x
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
              setSelectedBasket(null);
              setImgFailed(false);
              setCombo(0);
              setBestCombo(0);
              setCorrectCount(0);
              setIsCompleted(false);
              setRemainingSeconds(timeLimit);
            }}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCcw size={16} />
            <span>Yeni Kelimelerle Oyna</span>
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

  const isAnswered = selectedBasket !== null;
  const isRightAnswer = selectedBasket === currentItem.expectedGender;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Üst Durum ve Seri Çubuğu */}
      <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
          <span>Müzekker / Müennes Sepeti</span>
          <span aria-hidden="true" className="text-[var(--muted)]">·</span>
          <span className="tabular-nums text-[#087F5B] dark:text-emerald-400">
            {currentIndex + 1} / {sessionQuestions.length}
          </span>
          <span aria-hidden="true" className="text-[var(--muted)]">·</span>
          <span className="text-[var(--muted)]">Seviye {currentItem.word.cefr}</span>
        </div>

        <div className="flex items-center gap-3 text-xs font-extrabold">
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 tabular-nums">
            <Flame size={15} />
            <span>Seri: {combo}x</span>
          </span>
          {remainingSeconds !== null && (
            <span className="inline-flex items-center gap-1 tabular-nums text-[var(--foreground)]">
              <Timer size={14} />
              <span>{remainingSeconds}s</span>
            </span>
          )}
        </div>
      </div>

      {/* Ortadaki Görsel İsim Kartı */}
      <div className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-4 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* 1:1 Kare Görsel */}
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-gradient-to-br from-slate-100 to-amber-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center shrink-0">
            {!imgFailed && currentItem.coverUrl ? (
              <img
                src={currentItem.coverUrl}
                alt={currentItem.word.turkce}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-[var(--muted)] p-4 text-center">
                <ImageIcon size={32} />
                <span className="text-xs font-bold">{currentItem.word.turkce}</span>
              </div>
            )}
          </div>

          {/* Harekeli Arapça Kelime, Ses ve Türkçe Anlam */}
          <div className="flex-1 w-full text-center sm:text-left space-y-3">
            <div className="flex items-center justify-center sm:justify-between gap-3">
              <span className="text-xs font-bold text-[var(--muted)]">
                Kategori: {currentItem.word.kategori_tr}
              </span>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  void playWordOnly(currentItem.word);
                }}
                className="min-h-[48px] px-3.5 py-2 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-xs font-extrabold text-[#087F5B] dark:text-emerald-400 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 size={16} />
                <span>Kelimeyi Dinle</span>
              </button>
            </div>

            <p
              dir="rtl"
              lang="ar"
              className="arabic font-arabic text-4xl sm:text-5xl font-bold text-[var(--foreground)] text-center sm:text-right leading-[1.95] break-words"
            >
              {fixArabicTypography(currentItem.word.arapca, arabicFont)}
            </p>

            <p className="text-base sm:text-lg font-extrabold text-slate-700 dark:text-slate-200">
              {currentItem.word.turkce}
            </p>
          </div>
        </div>

        {/* İKİ BÜYÜK SEPET BUTONU (Dokunmatik + Sol/Sağ Ok Kısayollu) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Mavi Müzekker Sepeti */}
          <button
            type="button"
            disabled={isAnswered}
            onClick={() => void handleChooseBasket("masculine")}
            className={`min-h-[68px] px-4 py-3.5 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-3 transition-all ${
              isAnswered
                ? currentItem.expectedGender === "masculine"
                  ? "bg-sky-100 dark:bg-sky-950/70 border-sky-500 text-sky-950 dark:text-sky-100"
                  : selectedBasket === "masculine"
                  ? "bg-rose-50 dark:bg-rose-950/50 border-rose-400 text-rose-800 dark:text-rose-200 opacity-80"
                  : "opacity-45 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                : "bg-sky-50/90 dark:bg-sky-950/35 border-sky-300 dark:border-sky-700 hover:border-sky-500 text-sky-950 dark:text-sky-100 active:translate-y-0.5 cursor-pointer"
            }`}
          >
            <div className="text-left space-y-0.5">
              <span className="text-xs font-black block">
                🟦 Müzekker (Eril)
              </span>
              <span className="hidden sm:block text-[11px] font-semibold opacity-75">
                Sol Ok (←)
              </span>
            </div>
            <span
              dir="rtl"
              lang="ar"
              className="arabic font-arabic text-3xl font-bold leading-[1.95]"
            >
              هَذَا
            </span>
          </button>

          {/* Pembe Müennes Sepeti */}
          <button
            type="button"
            disabled={isAnswered}
            onClick={() => void handleChooseBasket("feminine")}
            className={`min-h-[68px] px-4 py-3.5 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-3 transition-all ${
              isAnswered
                ? currentItem.expectedGender === "feminine"
                  ? "bg-pink-100 dark:bg-pink-950/70 border-pink-500 text-pink-950 dark:text-pink-100"
                  : selectedBasket === "feminine"
                  ? "bg-rose-50 dark:bg-rose-950/50 border-rose-400 text-rose-800 dark:text-rose-200 opacity-80"
                  : "opacity-45 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                : "bg-pink-50/90 dark:bg-pink-950/35 border-pink-300 dark:border-pink-700 hover:border-pink-500 text-pink-950 dark:text-pink-100 active:translate-y-0.5 cursor-pointer"
            }`}
          >
            <div className="text-left space-y-0.5">
              <span className="text-xs font-black block">
                🩷 Müennes (Dişil)
              </span>
              <span className="hidden sm:block text-[11px] font-semibold opacity-75">
                Sağ Ok (→)
              </span>
            </div>
            <span
              dir="rtl"
              lang="ar"
              className="arabic font-arabic text-3xl font-bold leading-[1.95]"
            >
              هَذِهِ
            </span>
          </button>
        </div>

        {/* SEÇİM SONRASI ANINDA SESLİ DOĞRULAMA + 1 SATIRLIK MORFOLOJİK İPUCU */}
        {isAnswered && (
          <div
            className={`rounded-2xl border-2 p-4 space-y-3 animate-in fade-in duration-150 ${
              isRightAnswer
                ? "bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-400 dark:border-emerald-700"
                : "bg-rose-50/90 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black">
                {isRightAnswer ? (
                  <span className="inline-flex items-center gap-1.5 text-[#065F46] dark:text-emerald-300">
                    <CheckCircle2 size={18} />
                    <span>Doğru Sepet!</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <XCircle size={18} />
                    <span>Doğru İşaret Zamiri Kullanımı:</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  void playDemonstrativeVerification(
                    currentItem.demonstrativeSentenceAr
                  );
                }}
                className="min-h-[48px] px-3.5 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 size={15} />
                <span>İbareyi Dinle</span>
              </button>
            </div>

            <p
              dir="rtl"
              lang="ar"
              className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-300 text-right leading-[1.95]"
            >
              {fixArabicTypography(
                currentItem.demonstrativeSentenceAr,
                arabicFont
              )}
            </p>

            <div className="flex items-start gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              <Lightbulb size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <MixedText text={currentItem.morphologicalHintTr} />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {currentIndex + 1 < sessionQuestions.length
                    ? "Sıradaki Kelime"
                    : "Sonuçları Gör"}
                </span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
