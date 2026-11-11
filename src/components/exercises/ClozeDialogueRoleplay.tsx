"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  MessageSquare,
  Mic,
  RefreshCcw,
  Timer,
  Trophy,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import {
  diyaloglar,
  getDialogueCoverUrl,
  resolveAudioUrl,
} from "@/lib/data";
import type { Dialogue, DialogueLine, Level } from "@/types/data";
import { getMp3Path, speakHybrid, stopAllAudio } from "@/lib/audio";
import { fixArabicTypography, normalizeArabicText } from "@/lib/arabicTextUtils";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import {
  playClick,
  playFanfare,
  playSuccess,
  playWrong,
} from "@/lib/sfxManager";

const ShadowingModal = dynamic(
  () => import("@/components/ui/ShadowingModal"),
  { ssr: false }
);

export interface ClozeDialogueRoleplayProps {
  dialogues?: Dialogue[];
  cefrFilter?: "all" | Level;
  questionCount?: 10 | 20 | 30;
  timeLimit?: number | null;
  onClose?: () => void;
}

interface TurnPairQuestion {
  id: string;
  dialogueId: string;
  dialogueTitleTr: string;
  dialogueTitleAr: string;
  coverUrl: string;
  level: Level;
  promptLine: DialogueLine;
  replyLine: DialogueLine;
  options: DialogueLine[];
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function ClozeDialogueRoleplay({
  dialogues,
  cefrFilter = "all",
  questionCount = 10,
  timeLimit = null,
  onClose,
}: ClozeDialogueRoleplayProps) {
  const { arabicFont, speechRate } = useSettings();
  const {
    recordSkillAttempt,
    recordItemAttempt,
    addMistake,
    addStudyMinutes,
  } = useUserStore();

  const [roundSeed, setRoundSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState<string[]>([]);
  const [isSolved, setIsSolved] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [firstTryCorrectCount, setFirstTryCorrectCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [playingLineKey, setPlayingLineKey] = useState<string | null>(null);
  const [shadowingOpen, setShadowingOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    timeLimit
  );

  const audioDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sadece gerçek çok konuşmacılı diyalogları kullan (sentetik 1111/atasözü havuzu gelirse gerçek diyaloglara dön)
  const effectiveDialogues = useMemo(() => {
    const validPassed = (dialogues || []).filter(
      (d) => d.id.startsWith("dlg_") && Array.isArray(d.satirlar) && d.satirlar.length >= 2
    );
    const source = validPassed.length >= 2 ? validPassed : diyaloglar;
    if (cefrFilter === "all") return source;
    const byLvl = source.filter((d) => d.seviye === cefrFilter);
    return byLvl.length >= 2 ? byLvl : source;
  }, [cefrFilter, dialogues]);

  // Tüm diyalog satırlarını (seviye + cinsiyet bazlı çeldirici havuzu için) indeksle
  const allRealReplyPool = useMemo(() => {
    const pool: Array<{ dialogueId: string; level: Level; line: DialogueLine }> =
      [];
    for (const dlg of diyaloglar) {
      for (let i = 1; i < dlg.satirlar.length; i++) {
        pool.push({
          dialogueId: dlg.id,
          level: dlg.seviye,
          line: dlg.satirlar[i],
        });
      }
    }
    return pool;
  }, []);

  const sessionQuestions: TurnPairQuestion[] = useMemo(() => {
    void roundSeed;
    const rawPairs: Omit<TurnPairQuestion, "options">[] = [];

    for (const dlg of effectiveDialogues) {
      const coverUrl = dlg.gorsel || getDialogueCoverUrl(dlg.id);
      for (let i = 0; i < dlg.satirlar.length - 1; i++) {
        const promptLine = dlg.satirlar[i];
        const replyLine = dlg.satirlar[i + 1];
        if (!promptLine?.arapca || !replyLine?.arapca) continue;
        rawPairs.push({
          id: `cloze_${dlg.id}_${promptLine.sira}_${replyLine.sira}`,
          dialogueId: dlg.id,
          dialogueTitleTr: dlg.baslik_tr,
          dialogueTitleAr: dlg.baslik_ar,
          coverUrl,
          level: dlg.seviye,
          promptLine,
          replyLine,
        });
      }
    }

    const picked = shuffleArray(rawPairs).slice(
      0,
      Math.min(questionCount, rawPairs.length)
    );

    return picked.map((pair) => {
      const targetWords = countWords(pair.replyLine.arapca);
      const targetNorm = normalizeArabicText(pair.replyLine.arapca);
      const promptNorm = normalizeArabicText(pair.promptLine.arapca);
      const targetGender = pair.replyLine.cinsiyet || "E";

      // KOPYA SIZINTISI KİLİDİ:
      // Aynı CEFR seviyesi + aynı konuşmacı cinsiyeti (E/K) + benzer kelime uzunluğu!
      const strictCandidates = allRealReplyPool
        .filter(
          (cand) =>
            cand.dialogueId !== pair.dialogueId &&
            cand.level === pair.level &&
            (cand.line.cinsiyet || "E") === targetGender &&
            normalizeArabicText(cand.line.arapca) !== targetNorm &&
            normalizeArabicText(cand.line.arapca) !== promptNorm
        )
        .map((cand) => ({
          line: cand.line,
          lenDiff: Math.abs(countWords(cand.line.arapca) - targetWords),
          jitter: Math.random(),
        }))
        .sort((a, b) =>
          a.lenDiff !== b.lenDiff ? a.lenDiff - b.lenDiff : a.jitter - b.jitter
        );

      const distractors: DialogueLine[] = [];
      const usedNorms = new Set<string>([targetNorm, promptNorm]);

      for (const item of strictCandidates) {
        if (distractors.length >= 3) break;
        const norm = normalizeArabicText(item.line.arapca);
        if (!usedNorms.has(norm)) {
          usedNorms.add(norm);
          distractors.push(item.line);
        }
      }

      // Nadir yedek: aynı cinsiyette diğer seviyelerden tamamla
      if (distractors.length < 3) {
        for (const cand of shuffleArray(allRealReplyPool)) {
          if (distractors.length >= 3) break;
          if ((cand.line.cinsiyet || "E") !== targetGender) continue;
          const norm = normalizeArabicText(cand.line.arapca);
          if (!usedNorms.has(norm)) {
            usedNorms.add(norm);
            distractors.push(cand.line);
          }
        }
      }

      return {
        ...pair,
        options: shuffleArray([pair.replyLine, ...distractors.slice(0, 3)]),
      };
    });
  }, [allRealReplyPool, effectiveDialogues, questionCount, roundSeed]);

  const currentQuestion = sessionQuestions[currentIndex] || null;

  const playDialogueTurn = useCallback(
    async (dialogueId: string, line: DialogueLine, key: string) => {
      setPlayingLineKey(key);
      try {
        await speakHybrid({
          text: line.arapca,
          dialogueId,
          lineSira: line.sira,
          voice: line.cinsiyet === "K" ? "kadin" : "erkek",
          rate: speechRate,
        });
      } finally {
        setPlayingLineKey((prev) => (prev === key ? null : prev));
      }
    },
    [speechRate]
  );

  // Soru açıldığında 1. konuşmacının repliğini otomatik seslendir
  useEffect(() => {
    if (!currentQuestion || isCompleted) return;
    const t = setTimeout(() => {
      void playDialogueTurn(
        currentQuestion.dialogueId,
        currentQuestion.promptLine,
        "prompt"
      );
    }, 300);
    return () => clearTimeout(t);
  }, [currentQuestion, isCompleted, playDialogueTurn]);

  useEffect(() => {
    return () => {
      if (audioDelayTimerRef.current) clearTimeout(audioDelayTimerRef.current);
      stopAllAudio();
    };
  }, []);

  // İsteğe bağlı zamanlayıcı
  useEffect(() => {
    if (
      !timeLimit ||
      isCompleted ||
      isSolved ||
      remainingSeconds === null ||
      remainingSeconds <= 0
    ) {
      return;
    }
    const timer = setTimeout(() => {
      if (remainingSeconds <= 1) {
        setRemainingSeconds(0);
        if (currentQuestion) {
          void playWrong();
          recordSkillAttempt("dinleme", false);
          recordItemAttempt(
            currentQuestion.dialogueId,
            "sentence",
            false,
            showTranslations,
            20,
            "Diyalog Replik Tamamlama: Süre doldu"
          );
          addMistake(currentQuestion.dialogueId);
          setStreak(0);
          setIsSolved(true);
        }
      } else {
        setRemainingSeconds((s) => (s !== null ? s - 1 : null));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    addMistake,
    currentQuestion,
    isCompleted,
    isSolved,
    recordItemAttempt,
    recordSkillAttempt,
    remainingSeconds,
    showTranslations,
    timeLimit,
  ]);

  const handleSelectOption = async (chosenLine: DialogueLine) => {
    if (!currentQuestion || isSolved) return;

    const chosenNorm = normalizeArabicText(chosenLine.arapca);
    const expectedNorm = normalizeArabicText(currentQuestion.replyLine.arapca);

    if (chosenNorm === expectedNorm) {
      const firstTry = wrongAttempts.length === 0;
      const nextStreak = firstTry ? streak + 1 : 1;
      setIsSolved(true);
      setStreak(nextStreak);
      if (firstTry) {
        setFirstTryCorrectCount((c) => c + 1);
      }

      recordSkillAttempt("dinleme", firstTry);
      recordSkillAttempt("okuma", firstTry);
      recordItemAttempt(
        currentQuestion.dialogueId,
        "sentence",
        firstTry,
        showTranslations,
        firstTry ? 100 : 65,
        "Diyalog Boş Replik Tamamlama"
      );
      if (!firstTry) {
        addMistake(currentQuestion.dialogueId);
      }

      await playSuccess({ streak: nextStreak });
      audioDelayTimerRef.current = setTimeout(() => {
        void playDialogueTurn(
          currentQuestion.dialogueId,
          currentQuestion.replyLine,
          "reply"
        );
      }, 250);
      return;
    }

    setStreak(0);
    if (!wrongAttempts.includes(chosenNorm)) {
      setWrongAttempts((prev) => [...prev, chosenNorm]);
    }
    await playWrong();
  };

  const handleNext = () => {
    playClick();
    if (audioDelayTimerRef.current) {
      clearTimeout(audioDelayTimerRef.current);
      audioDelayTimerRef.current = null;
    }
    stopAllAudio();

    if (currentIndex + 1 < sessionQuestions.length) {
      setCurrentIndex((i) => i + 1);
      setWrongAttempts([]);
      setIsSolved(false);
      setShowTranslations(false);
      setCoverFailed(false);
      setRemainingSeconds(timeLimit);
    } else {
      addStudyMinutes(3);
      const pct =
        sessionQuestions.length > 0
          ? Math.round((firstTryCorrectCount / sessionQuestions.length) * 100)
          : 100;
      void playFanfare(pct);
      setIsCompleted(true);
    }
  };

  if (!currentQuestion) {
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 text-center space-y-4">
        <p className="text-sm font-bold text-[var(--foreground)]">
          Bu filtre için uygun diyalog repliği bulunamadı.
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
      (firstTryCorrectCount / sessionQuestions.length) * 100
    );
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 sm:p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-400 flex items-center justify-center text-[#087F5B] dark:text-emerald-300">
          <Trophy size={32} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-[var(--foreground)]">
            Diyalog Replik Tamamlama Bitti!
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
            İlk Deneme İsabeti:{" "}
            <strong className="text-[#087F5B] dark:text-emerald-400 tabular-nums">
              %{accuracy} ({firstTryCorrectCount}/{sessionQuestions.length})
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
              setFirstTryCorrectCount(0);
              setStreak(0);
              setWrongAttempts([]);
              setIsSolved(false);
              setIsCompleted(false);
              setCoverFailed(false);
              setRemainingSeconds(timeLimit);
            }}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCcw size={16} />
            <span>Yeni Repliklerle Oyna</span>
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

  const replyAudioUrl = currentQuestion.replyLine.ses_dosyasi
    ? resolveAudioUrl(currentQuestion.replyLine.ses_dosyasi)
    : getMp3Path(
        currentQuestion.dialogueId,
        currentQuestion.replyLine.sira,
        currentQuestion.replyLine.cinsiyet
      );

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Üst Bilgi Barı */}
      <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
          <MessageSquare size={17} className="text-[#087F5B] shrink-0" />
          <span>Diyalog Boş Replik Tamamlama</span>
          <span aria-hidden="true" className="text-[var(--muted)]">·</span>
          <span className="tabular-nums text-[#087F5B] dark:text-emerald-400">
            {currentIndex + 1} / {sessionQuestions.length}
          </span>
          <span aria-hidden="true" className="text-[var(--muted)]">·</span>
          <span className="text-[var(--muted)]">Seviye {currentQuestion.level}</span>
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
              setShowTranslations((v) => !v);
            }}
            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Eye size={14} className="text-[#6741D9]" />
            <span>{showTranslations ? "Çeviriyi Gizle" : "Türkçe İpucu"}</span>
          </button>
        </div>
      </div>

      {/* Ana Diyalog Sahnesi */}
      <div className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-4 sm:p-6 space-y-5 shadow-xs">
        {/* Diyalog Başlığı ve Kapak Görseli */}
        <div className="flex items-center gap-3.5 pb-3 border-b border-[#E6D7BE]/70 dark:border-[var(--border)]">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-[#E6D7BE] dark:border-[var(--border)] bg-gradient-to-br from-emerald-800 to-teal-950 shrink-0 flex items-center justify-center">
            {!coverFailed && currentQuestion.coverUrl ? (
              <img
                src={currentQuestion.coverUrl}
                alt={currentQuestion.dialogueTitleTr}
                referrerPolicy="no-referrer"
                onError={() => setCoverFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <MessageSquare className="w-7 h-7 text-emerald-200" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <p
              dir="rtl"
              lang="ar"
              className="arabic font-arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-300 leading-[1.8]"
            >
              {fixArabicTypography(currentQuestion.dialogueTitleAr, arabicFont)}
            </p>
            <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
              {currentQuestion.dialogueTitleTr}
            </h2>
          </div>
        </div>

        {/* KONUŞMA BALONLARI */}
        <div className="space-y-3.5">
          {/* 1. Konuşmacının Repliği */}
          <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--foreground)]">
                <span
                  dir="rtl"
                  lang="ar"
                  className="arabic font-arabic text-lg font-bold text-[#087F5B] dark:text-emerald-400"
                >
                  {currentQuestion.promptLine.konusmaci_ar}
                </span>
                <span className="text-[var(--muted)]">
                  ({currentQuestion.promptLine.konusmaci})
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  void playDialogueTurn(
                    currentQuestion.dialogueId,
                    currentQuestion.promptLine,
                    "prompt"
                  );
                }}
                className={`min-h-[48px] px-3.5 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                  playingLineKey === "prompt"
                    ? "bg-[#087F5B] text-white border-[#065F46]"
                    : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[#087F5B] dark:text-emerald-400"
                }`}
              >
                <Volume2 size={15} />
                <span>Dinle</span>
              </button>
            </div>

            <p
              dir="rtl"
              lang="ar"
              className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[var(--foreground)] text-right leading-[1.95] break-words"
            >
              {fixArabicTypography(currentQuestion.promptLine.arapca, arabicFont)}
            </p>

            {(showTranslations || isSolved) && (
              <p className="text-xs sm:text-sm font-medium text-[var(--muted)] pt-1 border-t border-[#E6D7BE]/60 dark:border-[var(--border)]">
                “{currentQuestion.promptLine.turkce}”
              </p>
            )}
          </div>

          {/* 2. Konuşmacının Cevap Balonu (Boş ______ veya Tamamlanmış) */}
          <div
            className={`rounded-2xl border-2 p-4 space-y-3 transition-all ${
              isSolved
                ? "bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-400 dark:border-emerald-600"
                : "bg-[#F3F0FF]/70 dark:bg-indigo-950/30 border-dashed border-[#6741D9]"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold">
                <span
                  dir="rtl"
                  lang="ar"
                  className="arabic font-arabic text-lg font-bold text-[#6741D9] dark:text-indigo-300"
                >
                  {currentQuestion.replyLine.konusmaci_ar}
                </span>
                <span className="text-[var(--muted)]">
                  ({currentQuestion.replyLine.konusmaci} ·{" "}
                  {currentQuestion.replyLine.cinsiyet === "K" ? "Kadın" : "Erkek"})
                </span>
              </div>

              {isSolved && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      void playDialogueTurn(
                        currentQuestion.dialogueId,
                        currentQuestion.replyLine,
                        "reply"
                      );
                    }}
                    className="min-h-[48px] px-3.5 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 size={15} />
                    <span>Cevabı Dinle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      stopAllAudio();
                      setShadowingOpen(true);
                    }}
                    className="min-h-[48px] px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-b-2 border-amber-600 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mic size={15} />
                    <span>🎙️ Bu Repliği Ben Seslendireyim (Gölgele)</span>
                  </button>
                </div>
              )}
            </div>

            {isSolved ? (
              <>
                <p
                  dir="rtl"
                  lang="ar"
                  className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-300 text-right leading-[1.95] break-words"
                >
                  {fixArabicTypography(
                    currentQuestion.replyLine.arapca,
                    arabicFont
                  )}
                </p>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 pt-1 border-t border-emerald-200/70 dark:border-emerald-800/60">
                  “{currentQuestion.replyLine.turkce}”
                </p>
              </>
            ) : (
              <div className="py-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-[#4C28B5] dark:text-indigo-200">
                  Akışa en uygun cevabı aşağıdan seçin:
                </span>
                <span
                  dir="rtl"
                  lang="ar"
                  className="font-mono text-lg font-black tracking-widest text-[#6741D9] dark:text-indigo-300"
                >
                  ____________
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4 ARAPÇA REPLİK SEÇENEĞİ */}
        {!isSolved ? (
          <div className="grid grid-cols-1 gap-2.5 pt-1">
            {currentQuestion.options.map((opt, idx) => {
              const optNorm = normalizeArabicText(opt.arapca);
              const isEliminated = wrongAttempts.includes(optNorm);
              return (
                <button
                  key={`${optNorm}-${idx}`}
                  type="button"
                  disabled={isEliminated}
                  onClick={() => void handleSelectOption(opt)}
                  className={`min-h-[56px] px-4 py-3 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-3 transition-all ${
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
                    className="arabic font-arabic text-xl sm:text-2xl font-bold text-right leading-[1.95] flex-1 break-words"
                  >
                    {fixArabicTypography(opt.arapca, arabicFont)}
                  </span>
                  {isEliminated && (
                    <XCircle size={18} className="text-rose-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#087F5B] dark:text-emerald-400">
              <CheckCircle2 size={17} />
              <span>Harika! Diyalog akışı tamamlandı.</span>
            </span>

            <button
              type="button"
              onClick={handleNext}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <span>
                {currentIndex + 1 < sessionQuestions.length
                  ? "Sonraki Diyaloğa Geç"
                  : "Sonuçları Gör"}
              </span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* GÖLGELEME / TELAFFUZ MODALI */}
      {shadowingOpen && (
        <ShadowingModal
          text={currentQuestion.replyLine.arapca}
          turkishText={currentQuestion.replyLine.turkce}
          itemId={currentQuestion.dialogueId}
          refAudioUrl={replyAudioUrl}
          voice={currentQuestion.replyLine.cinsiyet === "K" ? "kadin" : "erkek"}
          level={currentQuestion.level}
          onClose={() => setShadowingOpen(false)}
        />
      )}
    </div>
  );
}
