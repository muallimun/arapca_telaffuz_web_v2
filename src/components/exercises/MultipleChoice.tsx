"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  playCorrect,
  playWrong,
  playStart,
  playFanfare,
  playClick,
} from "@/lib/sfxManager";
import { Dialogue, DictionaryItem, SynonymAntonymEntry } from "@/types/data";
import {
  shuffleArray,
  selectSmartWordDistractors,
  resolveSentenceSourceMeta,
  stripParentheticalArabicExamples,
  generateSynonymAntonymMcQuestions,
} from "@/lib/quiz";
import { cumleler1111, atasozleri } from "@/lib/data";
import {
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Trophy,
  Timer,
  AlertCircle,
  Volume2,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Play,
  Target,
  X,
  ListChecks,
  Eye,
  Share2,
  Sparkles,
} from "lucide-react";
import { useCountdown } from "@/lib/useTimer";
import { speakHybrid, playTTS } from "@/lib/audio";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import {
  formatArabicText,
  hasArabicCharacters,
  hasLatinCharacters,
} from "@/lib/arabicTextUtils";
import { MixedText } from "@/components/ui/MixedText";
import ShareAchievementModal from "@/components/ui/ShareAchievementModal";
import { ArabicIdiom } from "@/lib/arabicIdioms";
import { normalizeToCanonicalMistakeId } from "@/lib/mistakeUtils";

export type QuizContentType = "words" | "idioms" | "sentences" | "mixed";
export type FeedbackMode = "instant" | "end";

export interface QuizQuestionItem {
  id: string;
  kind: "word" | "idiom" | "sentence";
  arabic: string;
  turkish: string;
  metaLabel: string;
  topBadge?: string;
  promptQuestionTr?: string;
  wordId?: string;
  literalTr?: string;
  usageNote?: string;
  options: { text: string; isCorrect: boolean }[];
}

function formatWordTurLabel(tur?: string): string {
  const normalized = (tur || "").trim().toLowerCase();
  if (normalized === "isim") return "İsim";
  if (normalized === "fiil") return "Fiil";
  if (normalized === "edat" || normalized === "harf") return "Edat";
  if (normalized === "ifade") return "Kalıp İfade";
  if (
    normalized === "ozel-isim" ||
    normalized === "özel isim" ||
    normalized === "özel-isim"
  ) {
    return "Özel İsim";
  }
  if (!normalized) return "İsim";
  return (
    normalized.charAt(0).toLocaleUpperCase("tr-TR") + normalized.slice(1)
  );
}

interface Props {
  vocabulary: DictionaryItem[];
  idioms?: ArabicIdiom[];
  dialogues?: Dialogue[];
  synonymEntries?: SynonymAntonymEntry[];
  isSynonymsAntonymsMode?: boolean;
  contentType?: QuizContentType;
  feedbackMode?: FeedbackMode;
  timeLimit: number | null;
  questionCount?: number;
  isMistakesMode?: boolean;
  onClose?: () => void;
}

export default function MultipleChoice({
  vocabulary,
  idioms = [],
  dialogues = [],
  synonymEntries = [],
  isSynonymsAntonymsMode = false,
  contentType = "words",
  feedbackMode = "instant",
  timeLimit,
  questionCount = 10,
  isMistakesMode: _isMistakesMode = false,
  onClose,
}: Props) {
  const fanfarePlayedRef = useRef(false);
  const wrongAttemptedQuestionsRef = useRef<Set<string>>(new Set());
  const [roundSeed, setRoundSeed] = useState(0);
  const [customQuestions, setCustomQuestions] = useState<
    QuizQuestionItem[] | null
  >(null);
  const { speechRate, showHareke, arabicFont } = useSettings();
  const { addStudyMinutes, addMistake, recordItemAttempt } = useUserStore();

  const itemsSignature = useMemo(
    () =>
      `${isSynonymsAntonymsMode ? "syn" : "std"}::${synonymEntries
        .map((s) => s.id)
        .join("|")}::${vocabulary.map((v) => v.id).join("|")}::${idioms
        .map((i) => i.id)
        .join("|")}::${dialogues.map((d) => d.id).join("|")}`,
    [isSynonymsAntonymsMode, synonymEntries, vocabulary, idioms, dialogues]
  );

  const generatedQuestions: QuizQuestionItem[] = useMemo(() => {
    if (isSynonymsAntonymsMode && synonymEntries.length > 0) {
      return generateSynonymAntonymMcQuestions(
        synonymEntries,
        questionCount
      ).map((sq) => ({
        ...sq,
        metaLabel: sq.metaLabel || "Eş & Zıt Anlamlılar",
      }));
    }
    const wordPool: {
      id: string;
      arabic: string;
      turkish: string;
      metaLabel: string;
      wordId: string;
    }[] = vocabulary
      .map((w) => ({
        id: `w-${w.id}`,
        arabic: (w.mufret || w.mazi || "").split("/")[0].trim(),
        turkish: w.anlam_tr,
        metaLabel: `Tür: ${formatWordTurLabel(w.tur)}${
          w.kok && w.kok !== "-" ? ` · Kök: ${w.kok}` : ""
        }`,
        wordId: w.id,
      }))
      .filter((w) => w.arabic.length > 0 && w.turkish.length > 0);

    const idiomPool: {
      id: string;
      arabic: string;
      turkish: string;
      metaLabel: string;
      literalTr?: string;
      usageNote?: string;
    }[] = idioms
      .map((idm) => ({
        id: `idm-${idm.id}`,
        arabic: idm.arabic.trim(),
        turkish: idm.meaningTr.trim(),
        metaLabel: `✨ Kalıp İfade · Seviye: ${idm.level || "A1-B2"}`,
        literalTr: idm.literalTr,
        usageNote: idm.usageNote,
      }))
      .filter((i) => i.arabic.length > 0 && i.turkish.length > 0);

    const sentencePool: {
      id: string;
      arabic: string;
      turkish: string;
      metaLabel: string;
      topBadge: string;
      promptQuestionTr: string;
    }[] = [];

    dialogues.forEach((dlg) => {
      dlg.satirlar.forEach((line) => {
        if (line.arapca.trim() && line.turkce.trim()) {
          const srcMeta = resolveSentenceSourceMeta(
            dlg.id,
            dlg.baslik_tr,
            line.konusmaci
          );
          sentencePool.push({
            id: `s-${dlg.id}-${line.sira}`,
            arabic: line.arapca.trim(),
            turkish: line.turkce.trim(),
            metaLabel: srcMeta.bottomMeta,
            topBadge: srcMeta.topBadge,
            promptQuestionTr: srcMeta.promptQuestionTr,
          });
        }
      });
    });

    const vocabById = new Map<string, DictionaryItem>();
    for (const w of vocabulary) {
      vocabById.set(w.id, w);
    }

    const normalizeStrippedTr = (txt: string) =>
      stripParentheticalArabicExamples(txt || "")
        .trim()
        .toLocaleLowerCase("tr-TR");

    const pickUniqueDistractorTexts = (
      correctTr: string,
      candidateTexts: string[],
      needed = 3
    ): { text: string; isCorrect: boolean }[] => {
      const seen = new Set<string>([normalizeStrippedTr(correctTr)]);
      const picked: { text: string; isCorrect: boolean }[] = [];
      for (const raw of candidateTexts) {
        if (picked.length >= needed) break;
        const key = normalizeStrippedTr(raw);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        picked.push({ text: raw, isCorrect: false });
      }
      return picked;
    };

    const buildWordQuestion = (
      target: (typeof wordPool)[number]
    ): QuizQuestionItem => {
      const targetItem = vocabById.get(target.wordId);
      const rawCandidateTexts = targetItem
        ? [
            ...selectSmartWordDistractors(targetItem, vocabulary, 6).map(
              (d) => d.anlam_tr
            ),
            ...shuffleArray(
              wordPool.filter((w) => w.id !== target.id).map((w) => w.turkish)
            ),
          ]
        : shuffleArray(
            wordPool.filter((w) => w.id !== target.id).map((w) => w.turkish)
          );

      const distractors = pickUniqueDistractorTexts(
        target.turkish,
        rawCandidateTexts,
        3
      );

      return {
        id: target.id,
        kind: "word",
        arabic: target.arabic,
        turkish: target.turkish,
        metaLabel: target.metaLabel,
        wordId: target.wordId,
        options: shuffleArray([
          { text: target.turkish, isCorrect: true },
          ...distractors,
        ]),
      };
    };

    const buildIdiomQuestion = (
      target: (typeof idiomPool)[number]
    ): QuizQuestionItem => {
      const targetLen = target.turkish.length || 24;
      const inPoolCandidates = shuffleArray(
        idiomPool
          .filter((i) => i.id !== target.id && i.turkish !== target.turkish)
          .map((i) => i.turkish)
      );

      // Atasözü/kalıp ifade şıkları asla tek kelimelik sözlük öğeleriyle doldurulmaz;
      // havuz darsa benzer uzunluktaki atasözü veya günlük kalıp cümle çevirileri kullanılır
      const fallbackPhraseCandidates =
        inPoolCandidates.length >= 4
          ? []
          : [
              ...atasozleri.map((a) => (a.turkce || "").trim()),
              ...cumleler1111.map((c) => (c.turkce || "").trim()),
            ]
              .filter((tr) => tr.length >= 8 && tr !== target.turkish)
              .map((tr) => ({
                tr,
                score: Math.abs(tr.length - targetLen) + Math.random() * 6,
              }))
              .sort((a, b) => a.score - b.score)
              .map((entry) => entry.tr);

      const distractors = pickUniqueDistractorTexts(
        target.turkish,
        [...inPoolCandidates, ...fallbackPhraseCandidates],
        3
      );

      return {
        id: target.id,
        kind: "idiom",
        arabic: target.arabic,
        turkish: target.turkish,
        metaLabel: target.metaLabel,
        literalTr: target.literalTr,
        usageNote: target.usageNote,
        options: shuffleArray([
          { text: target.turkish, isCorrect: true },
          ...distractors,
        ]),
      };
    };

    const buildSentenceQuestion = (
      target: (typeof sentencePool)[number]
    ): QuizQuestionItem => {
      const targetLen = target.turkish.length || 24;
      const inPoolCandidates = shuffleArray(
        sentencePool
          .filter((s) => s.id !== target.id && s.turkish !== target.turkish)
          .map((s) => s.turkish)
      );

      const fallbackFrom1111 =
        inPoolCandidates.length >= 4
          ? []
          : cumleler1111
              .map((c) => (c.turkce || "").trim())
              .filter((tr) => tr.length > 0 && tr !== target.turkish)
              .map((tr) => ({
                tr,
                score: Math.abs(tr.length - targetLen) + Math.random() * 6,
              }))
              .sort((a, b) => a.score - b.score)
              .map((entry) => entry.tr)
              .slice(0, 8);

      const distractors = pickUniqueDistractorTexts(
        target.turkish,
        [...inPoolCandidates, ...fallbackFrom1111],
        3
      );

      return {
        id: target.id,
        kind: "sentence",
        arabic: target.arabic,
        turkish: target.turkish,
        metaLabel: target.metaLabel,
        topBadge: target.topBadge,
        promptQuestionTr: target.promptQuestionTr,
        options: shuffleArray([
          { text: target.turkish, isCorrect: true },
          ...distractors,
        ]),
      };
    };

    if (contentType === "idioms" && idiomPool.length > 0) {
      return shuffleArray(idiomPool)
        .slice(0, questionCount)
        .map(buildIdiomQuestion);
    }

    if (contentType === "sentences" && sentencePool.length >= 1) {
      const isFocused1111Pool =
        dialogues.length === 1 && dialogues[0].id === "pool_1111";
      const pickedSentences = isFocused1111Pool
        ? shuffleArray(sentencePool.slice(0, Math.max(questionCount, 12))).slice(
            0,
            questionCount
          )
        : shuffleArray(sentencePool).slice(0, questionCount);
      return pickedSentences.map(buildSentenceQuestion);
    }

    if (contentType === "mixed") {
      const combinedQuestions: QuizQuestionItem[] = [
        ...shuffleArray(wordPool).slice(0, questionCount).map(buildWordQuestion),
        ...shuffleArray(idiomPool).slice(0, questionCount).map(buildIdiomQuestion),
        ...shuffleArray(sentencePool)
          .slice(0, questionCount)
          .map(buildSentenceQuestion),
      ];
      return shuffleArray(combinedQuestions).slice(0, questionCount);
    }

    return shuffleArray(wordPool)
      .slice(0, questionCount)
      .map(buildWordQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSignature, contentType, questionCount, roundSeed]);

  const questions = customQuestions || generatedQuestions;
  const questionsSignature = useMemo(
    () => questions.map((q) => q.id).join("|"),
    [questions]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<
    Record<number, { chosen: string; isCorrect: boolean }>
  >({});
  const [isFinished, setIsFinished] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [resultViewMode, setResultViewMode] = useState<"summary" | "review">(
    "summary"
  );
  const [reviewIndex, setReviewIndex] = useState(0);

  const handleTimeout = () => setIsTimeUp(true);
  const timeLeft = useCountdown(
    timeLimit,
    handleTimeout,
    !isFinished && !isTimeUp
  );

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setSelected(userAnswers[currentIndex]?.chosen ?? null);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, questionsSignature]);

  const streakRef = useRef<number>(0);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer]);

  useEffect(() => {
    if (isFinished && !fanfarePlayedRef.current) {
      fanfarePlayedRef.current = true;
      addStudyMinutes(3);
      const cCount = Object.values(userAnswers).filter((a) => a.isCorrect).length;
      const pctScore =
        questions.length > 0 ? Math.round((cCount / questions.length) * 100) : 100;
      playFanfare(pctScore);
    } else if (isTimeUp && !fanfarePlayedRef.current) {
      fanfarePlayedRef.current = true;
      playWrong();
    }
  }, [isFinished, isTimeUp, addStudyMinutes, userAnswers, questions.length]);

  if (questions.length < 1) {
    return (
      <p className="text-center p-8 text-sm font-bold text-[var(--muted)]">
        Test oluşturmak için yeterli soru kaynağı bulunamadı.
      </p>
    );
  }

  const currentQuestion = questions[currentIndex] || questions[0];
  const displayArabic = formatArabicText(
    currentQuestion.arabic,
    showHareke,
    arabicFont
  );

  const correctCount = Object.values(userAnswers).filter(
    (a) => a.isCorrect
  ).length;

  const handleListenQuestion = (qTarget: QuizQuestionItem = currentQuestion) => {
    playClick();
    if (qTarget.kind === "word" && qTarget.wordId) {
      speakHybrid({
        text: qTarget.arabic,
        wordId: qTarget.wordId,
        rate: speechRate,
      });
    } else {
      playTTS(qTarget.arabic, speechRate);
    }
  };

  const handleSelect = (text: string, isCorrect: boolean) => {
    if (isTimeUp) return;
    if (feedbackMode === "instant" && selected) return;

    const hadPreviousAttempt =
      wrongAttemptedQuestionsRef.current.has(currentQuestion.id) ||
      userAnswers[currentIndex] !== undefined;
    const canonicalId = normalizeToCanonicalMistakeId(
      currentQuestion.wordId || currentQuestion.id,
      currentQuestion.arabic
    );

    if (!isCorrect) {
      wrongAttemptedQuestionsRef.current.add(currentQuestion.id);
      if (canonicalId) {
        addMistake(canonicalId);
        recordItemAttempt(canonicalId, currentQuestion.kind, false, false);
      }
    } else if (!hadPreviousAttempt && canonicalId) {
      recordItemAttempt(canonicalId, currentQuestion.kind, true, false);
    }

    setSelected(text);
    setUserAnswers((prev) => ({
      ...prev,
      [currentIndex]: { chosen: text, isCorrect },
    }));

    clearAutoAdvanceTimer();

    if (feedbackMode === "instant") {
      if (isCorrect) {
        streakRef.current += 1;
        playCorrect({ streak: streakRef.current });
        autoAdvanceTimerRef.current = setTimeout(() => {
          autoAdvanceTimerRef.current = null;
          if (currentIndex < questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
          } else {
            setResultViewMode("summary");
            setReviewIndex(0);
            setIsFinished(true);
          }
        }, 1050);
      } else {
        streakRef.current = 0;
        playWrong();
      }
    } else {
      playClick();
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      clearAutoAdvanceTimer();
      playClick();
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const nextQuestion = () => {
    clearAutoAdvanceTimer();
    playClick();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setResultViewMode("summary");
      setReviewIndex(0);
      setIsFinished(true);
    }
  };

  // 1) Tekrar Yap (Aynı soruları karıştırarak baştan başlat)
  const handleRepeatSameSet = () => {
    clearAutoAdvanceTimer();
    playStart();
    streakRef.current = 0;
    fanfarePlayedRef.current = false;
    const reshuffled = shuffleArray(
      questions.map((q) => ({
        ...q,
        options: shuffleArray([...q.options]),
      }))
    );
    setCustomQuestions(reshuffled);
    setCurrentIndex(0);
    setUserAnswers({});
    setSelected(null);
    setResultViewMode("summary");
    setReviewIndex(0);
    setIsFinished(false);
    setIsTimeUp(false);
  };

  // 2) Devam Et (Yeni Set)
  const handleStartNewSet = () => {
    clearAutoAdvanceTimer();
    playStart();
    streakRef.current = 0;
    fanfarePlayedRef.current = false;
    setCustomQuestions(null);
    setRoundSeed((s) => s + 1);
    setCurrentIndex(0);
    setUserAnswers({});
    setSelected(null);
    setResultViewMode("summary");
    setReviewIndex(0);
    setIsFinished(false);
    setIsTimeUp(false);
  };

  // 3) Yanlışlarımı Tekrarla
  const wrongQuestions = questions.filter(
    (_, idx) => !userAnswers[idx]?.isCorrect
  );

  const handleRetryWrongOnly = () => {
    if (wrongQuestions.length === 0) return;
    clearAutoAdvanceTimer();
    playStart();
    streakRef.current = 0;
    fanfarePlayedRef.current = false;
    const retryList = shuffleArray(
      wrongQuestions.map((q) => ({
        ...q,
        options: shuffleArray([...q.options]),
      }))
    );
    setCustomQuestions(retryList);
    setCurrentIndex(0);
    setUserAnswers({});
    setSelected(null);
    setResultViewMode("summary");
    setReviewIndex(0);
    setIsFinished(false);
    setIsTimeUp(false);
  };

  if (isFinished || isTimeUp) {
    const wrongCount = questions.length - correctCount;
    const pct = Math.round((correctCount / questions.length) * 100);
    const totalPoints = correctCount * 10;
    const reviewQ = questions[reviewIndex] || questions[0];
    const reviewAns = userAnswers[reviewIndex];

    return (
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-5 sm:p-7 space-y-4 max-w-2xl mx-auto">
        <div className="text-center space-y-3">
          <div
            className={`w-16 h-16 rounded-2xl border-2 border-b-4 flex items-center justify-center mx-auto ${
              isFinished
                ? "bg-[#F3F0FF] border-[#6741D9] text-[#6741D9]"
                : "bg-red-50 border-red-300 text-red-600"
            }`}
          >
            {isFinished ? <Trophy size={32} /> : <AlertCircle size={32} />}
          </div>

          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--foreground)]">
              {isFinished ? "Çoktan Seçmeli Test Tamamlandı!" : "Süre Doldu!"}
            </h3>
            <p className="text-xs font-semibold text-[var(--muted)]">
              Toplam {questions.length} sorudan {correctCount} doğru,{" "}
              {wrongCount} yanlış yanıt verdiniz
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center pt-1">
            <div className="bg-white dark:bg-[var(--background)] rounded-xl p-2.5 border border-[#E6D7BE]">
              <span className="block text-[10px] font-bold text-[var(--muted)] uppercase">
                Başarı
              </span>
              <span className="text-lg font-black text-[#6741D9] tabular-nums">
                %{pct}
              </span>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-2.5 border border-emerald-300">
              <span className="block text-[10px] font-bold text-emerald-700 uppercase">
                Doğru
              </span>
              <span className="text-lg font-black text-emerald-700 tabular-nums">
                {correctCount}
              </span>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/40 rounded-xl p-2.5 border border-rose-300">
              <span className="block text-[10px] font-bold text-rose-700 uppercase">
                Yanlış
              </span>
              <span className="text-lg font-black text-rose-700 tabular-nums">
                {wrongCount}
              </span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl p-2.5 border border-amber-300">
              <span className="block text-[10px] font-bold text-amber-800 uppercase">
                Puan
              </span>
              <span className="text-lg font-black text-amber-800 tabular-nums">
                {totalPoints}
              </span>
            </div>
          </div>
        </div>

        {/* SONUÇ EKRANI SORU GEZGİNİ (1..N) + GÖRÜNÜM MODU ANAHTARI */}
        <div className="bg-white/70 dark:bg-[var(--background)] rounded-xl p-3 border border-[#E6D7BE] dark:border-[var(--border)] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Soru Gezgini (İncelemek için numaraya tıklayın)
            </span>
            <div className="flex items-center gap-1 bg-[#F7EFE1] dark:bg-[var(--surface)] p-0.5 rounded-lg border border-[#E6D7BE]">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setResultViewMode("summary");
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  resultViewMode === "summary"
                    ? "bg-[#087F5B] text-white shadow-2xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <ListChecks size={12} />
                <span>Toplu Sonuç Özeti</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setResultViewMode("review");
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  resultViewMode === "review"
                    ? "bg-[#6741D9] text-white shadow-2xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Eye size={12} />
                <span>Soruları Tek Tek İncele</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-10 gap-1 sm:flex sm:flex-wrap items-center justify-center sm:gap-1.5 pt-0.5">
            {questions.map((_, idx) => {
              const ans = userAnswers[idx];
              const isSelectedReview =
                resultViewMode === "review" && reviewIndex === idx;
              const statusCls = ans
                ? ans.isCorrect
                  ? "bg-emerald-500 text-white border-emerald-600"
                  : "bg-rose-500 text-white border-rose-600"
                : "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400";

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    playClick();
                    setReviewIndex(idx);
                    setResultViewMode("review");
                  }}
                  className={`h-7 w-full sm:w-8 sm:h-8 rounded-lg border text-xs font-bold tabular-nums transition-all cursor-pointer flex items-center justify-center ${statusCls} ${
                    isSelectedReview
                      ? "ring-2 ring-offset-1 ring-[#6741D9] scale-110"
                      : "hover:opacity-90"
                  }`}
                  title={`Soru ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* GÖRÜNÜM 1: TOPLU SONUÇ ÖZETİ VEYA GÖRÜNÜM 2: TEK TEK SORU İNCELEME */}
        {resultViewMode === "summary" ? (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 border-t border-b border-dashed border-[#E2D3B8] pt-3 pb-3 mt-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Soru Dökümü ({questions.length} Soru)
            </h4>
            {questions.map((q, idx) => {
              const ans = userAnswers[idx];
              const isOk = ans?.isCorrect;
              return (
                <button
                  key={q.id + idx}
                  type="button"
                  onClick={() => {
                    playClick();
                    setReviewIndex(idx);
                    setResultViewMode("review");
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all cursor-pointer ${
                    isOk
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 hover:border-emerald-500"
                      : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 hover:border-rose-500"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-white/80 dark:bg-slate-800 border border-slate-300 text-[10px] font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    {isOk ? (
                      <CheckCircle2
                        size={16}
                        className="text-[#065F46] dark:text-emerald-400 shrink-0"
                      />
                    ) : (
                      <XCircle size={16} className="text-rose-600 shrink-0" />
                    )}
                    <span
                      dir="rtl"
                      className="arabic text-lg font-bold text-[var(--foreground)]"
                    >
                      {formatArabicText(q.arabic, showHareke, arabicFont)}
                    </span>
                  </div>
                  <div className="text-right text-[11px] font-bold">
                    {!isOk && ans?.chosen && (
                      <span className="text-rose-700 line-through block">
                        Seçiminiz: <MixedText text={ans.chosen} />
                      </span>
                    )}
                    {!ans && (
                      <span className="text-slate-500 italic block">
                        Boş Bırakıldı
                      </span>
                    )}
                    <span className="text-emerald-800 dark:text-emerald-300 block">
                      Doğru: <MixedText text={q.turkish} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#E2D3B8] pb-2">
              <span className="text-xs font-extrabold text-[#6741D9]">
                Soru {reviewIndex + 1} / {questions.length} İncelemesi
              </span>
              <button
                type="button"
                onClick={() => handleListenQuestion(reviewQ)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#087F5B] text-white text-xs font-bold cursor-pointer"
              >
                <Volume2 size={13} />
                <span>Sesli Dinle</span>
              </button>
            </div>

            <div className="text-center py-1 space-y-1">
              {reviewQ.promptQuestionTr && (
                <p
                  dir="ltr"
                  lang="tr"
                  className="font-sans text-xs font-extrabold text-[var(--muted)]"
                >
                  <MixedText text={reviewQ.promptQuestionTr} />
                </p>
              )}
              <h4
                dir="rtl"
                className="arabic text-3xl sm:text-4xl font-bold text-[#065F46] dark:text-emerald-400"
              >
                {formatArabicText(reviewQ.arabic, showHareke, arabicFont)}
              </h4>
              <p
                dir="ltr"
                lang="tr"
                className="font-sans text-[11px] font-bold text-[var(--muted)] mt-1"
              >
                <MixedText text={reviewQ.metaLabel} />
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {reviewQ.options.map((opt, oIdx) => {
                const isUserChoice = reviewAns?.chosen === opt.text;
                const isRight = opt.isCorrect;
                return (
                  <div
                    key={oIdx}
                    className={`p-3 rounded-xl border-2 text-xs font-extrabold flex items-center justify-between gap-2 ${
                      isRight
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : isUserChoice
                        ? "bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                        : "bg-[#F7EFE1]/50 dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--muted)] opacity-75"
                    }`}
                  >
                    <span dir="ltr" lang="tr" className="font-sans text-left">
                      <MixedText text={opt.text} />
                    </span>
                    {isRight && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 shrink-0">
                        <CheckCircle2 size={15} />
                        <span>Doğru</span>
                      </span>
                    )}
                    {!isRight && isUserChoice && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 shrink-0">
                        <XCircle size={15} />
                        <span>Seçiminiz</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {(reviewQ.literalTr || reviewQ.usageNote) && (
              <div className="rounded-xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border border-[#6741D9]/30 p-3 text-left text-xs space-y-1">
                {reviewQ.literalTr && (
                  <p
                    dir="ltr"
                    lang="tr"
                    className="font-sans font-bold text-[#4C28B5] dark:text-[#d0bfff]"
                  >
                    <span className="font-extrabold">✨ Harfiyen Anlamı:</span>{" "}
                    <MixedText text={reviewQ.literalTr} />
                  </p>
                )}
                {reviewQ.usageNote && (
                  <p
                    dir="ltr"
                    lang="tr"
                    className="font-sans text-[var(--foreground)] font-semibold"
                  >
                    <span className="font-extrabold text-[#065F46] dark:text-emerald-400">
                      💡 Açıklama &amp; Nüans:
                    </span>{" "}
                    <MixedText text={reviewQ.usageNote} />
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-[#E2D3B8]">
              <button
                type="button"
                disabled={reviewIndex === 0}
                onClick={() => {
                  playClick();
                  setReviewIndex((i) => Math.max(0, i - 1));
                }}
                className="px-3 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] disabled:opacity-40 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Önceki Soru</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setResultViewMode("summary");
                }}
                className="px-3 py-1.5 rounded-xl bg-[#F3F0FF] text-[#6741D9] border border-[#6741D9]/30 text-xs font-extrabold cursor-pointer"
              >
                Toplu Sonuçları Gör
              </button>

              <button
                type="button"
                disabled={reviewIndex === questions.length - 1}
                onClick={() => {
                  playClick();
                  setReviewIndex((i) =>
                    Math.min(questions.length - 1, i + 1)
                  );
                }}
                className="px-3 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] disabled:opacity-40 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <span>Sonraki Soru</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* BAŞARI KARTINI PAYLAŞ / İNDİR */}
        <ShareAchievementModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          title="Çoktan Seçmeli Kelime & Cümle Testi"
          subtitle={`${questions.length} Sorudan ${correctCount} Doğru Yanıt`}
          levelLabel="A1-B2"
          scorePercent={pct}
          pointsText={`${totalPoints} Puan`}
          wordsCount={questions.length}
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

        {/* 4 AKSİYON BUTONU (ÇİFT İKON / EMOJİ TEMİZLENDİ) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleRepeatSameSet}
            className="py-3 px-4 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-4 font-extrabold text-xs text-[var(--foreground)] hover:border-[#6741D9] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCcw size={15} className="text-[#6741D9]" />
            <span>Tekrar Yap</span>
          </button>

          <button
            type="button"
            onClick={handleStartNewSet}
            className="py-3 px-4 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-4 border-[#087F5B] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Play size={15} fill="currentColor" />
            <span>Devam Et (Yeni Set)</span>
          </button>

          {wrongQuestions.length > 0 && (
            <button
              type="button"
              onClick={handleRetryWrongOnly}
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

  return (
    <div className="max-w-2xl mx-auto space-y-3.5">
      {/* ÜST DURUM, SÜRE VE SORU GEZGİNİ (1..N) ÇUBUĞU */}
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 px-4 py-2.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] tabular-nums">
              Soru {currentIndex + 1} / {questions.length}
            </span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold inline-flex items-center gap-1 ${
                currentQuestion.topBadge?.includes("Zıt")
                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-400/70"
                  : currentQuestion.kind === "sentence" ||
                    currentQuestion.kind === "idiom"
                  ? "bg-[#F3F0FF] text-[#6741D9] border border-[#6741D9]/30"
                  : "bg-[#E6FCF5] text-[#065F46] dark:text-emerald-400 border border-[#087F5B]/30"
              }`}
            >
              {currentQuestion.topBadge ? (
                <span>{currentQuestion.topBadge}</span>
              ) : currentQuestion.kind === "sentence" ? (
                <span>💬 Diyalog Cümlesi</span>
              ) : currentQuestion.kind === "idiom" ? (
                <>
                  <Sparkles size={11} />
                  <span>Kalıp İfade</span>
                </>
              ) : (
                <>
                  <BookOpen size={11} />
                  <span>Sözlük Kelimesi</span>
                </>
              )}
            </span>
          </div>

          {!customQuestions && questions.length < questionCount && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 text-[10px] font-bold text-amber-800 dark:text-amber-200">
              ℹ️ Seçili kapsamda {questions.length} soru bulundu
            </span>
          )}

          {timeLeft !== null && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs sm:text-sm font-black tabular-nums ${
                timeLeft <= 5
                  ? "bg-red-100 border-red-300 text-red-700 animate-pulse"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-amber-700"
              }`}
            >
              <Timer size={16} />
              <span>{timeLeft} sn</span>
            </div>
          )}

          <span className="text-xs sm:text-sm font-extrabold text-[#065F46] dark:text-emerald-400 bg-white dark:bg-[var(--background)] border border-[#E6D7BE] px-3 py-1 rounded-xl tabular-nums">
            {feedbackMode === "instant"
              ? `Doğru: ${correctCount}`
              : `Yanıtlanan: ${Object.keys(userAnswers).length}/${questions.length}`}
          </span>
        </div>

        {/* Numaralı Soru Gezgini (1..N) */}
        <div className="grid grid-cols-10 gap-1 md:flex md:flex-wrap items-center justify-center md:gap-1.5 pt-1 border-t border-dashed border-[#E2D3B8]">
          {questions.map((_, idx) => {
            const isActive = idx === currentIndex;
            const isAnswered = Boolean(userAnswers[idx]);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  clearAutoAdvanceTimer();
                  playClick();
                  setCurrentIndex(idx);
                }}
                className={`h-7 w-full md:w-8 md:h-8 rounded-lg border text-xs font-bold tabular-nums transition-all cursor-pointer flex items-center justify-center ${
                  isActive
                    ? "ring-2 ring-emerald-600 bg-emerald-600 text-white font-bold scale-105 border-emerald-700"
                    : isAnswered
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 font-bold"
                    : "bg-white/80 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 font-semibold hover:border-emerald-400"
                }`}
                title={`Soru ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* SORU KARTI */}
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 text-center space-y-3">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 border-b border-dashed border-[#E2D3B8] pb-3">
          <span className="text-left text-sm sm:text-base font-extrabold text-[var(--foreground)] leading-relaxed min-w-0 flex-1 break-words">
            {currentQuestion.promptQuestionTr ? (
              <MixedText
                text={currentQuestion.promptQuestionTr}
                arabicClassName="arabic font-arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-300 mx-1 inline-block leading-relaxed"
              />
            ) : currentQuestion.kind === "sentence" ? (
              "Aşağıdaki Arapça diyalog cümlesinin doğru Türkçe çevirisi hangisidir?"
            ) : currentQuestion.kind === "idiom" ? (
              "Aşağıdaki Arapça kalıp ifadenin doğru deyimsel anlamı hangisidir?"
            ) : (
              "Aşağıdaki Arapça kelimenin Türkçe karşılığı nedir?"
            )}
          </span>
          <button
            type="button"
            onClick={() => handleListenQuestion(currentQuestion)}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#087F5B] text-white text-xs sm:text-sm font-bold border-b-2 border-[#087F5B] shrink-0 cursor-pointer"
          >
            <Volume2 size={15} />
            <span>Sesli Dinle</span>
          </button>
        </div>

        <h3
          dir="rtl"
          className={`arabic font-bold text-[#065F46] dark:text-emerald-400 py-2 break-words ${
            currentQuestion.kind === "sentence"
              ? "text-3xl sm:text-4xl leading-relaxed"
              : currentQuestion.kind === "idiom"
              ? "text-3xl sm:text-5xl leading-relaxed"
              : "text-4xl sm:text-6xl"
          }`}
        >
          {displayArabic}
        </h3>

        <p
          dir="ltr"
          lang="tr"
          className="font-sans text-xs sm:text-sm font-bold text-[var(--muted)]"
        >
          <MixedText text={currentQuestion.metaLabel} />
        </p>
      </div>

      {/* ŞIKLAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {currentQuestion.options.map((opt, idx) => {
          const isChosen = selected === opt.text;
          const showCorrect =
            feedbackMode === "instant" && Boolean(selected) && opt.isCorrect;
          const showWrong =
            feedbackMode === "instant" && isChosen && !opt.isCorrect;
          const showNeutralSelected = feedbackMode === "end" && isChosen;
          const displayOptionText =
            currentQuestion.kind === "word" &&
            !selected &&
            feedbackMode === "instant"
              ? stripParentheticalArabicExamples(opt.text)
              : opt.text;
          const isPureArabicOption =
            hasArabicCharacters(displayOptionText) &&
            !hasLatinCharacters(displayOptionText);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(opt.text, opt.isCorrect)}
              disabled={
                (feedbackMode === "instant" && Boolean(selected)) || isTimeUp
              }
              className={`min-h-[60px] p-3.5 sm:p-4 rounded-2xl border-2 border-b-4 transition-all flex items-center justify-between gap-2.5 cursor-pointer min-w-0 ${
                isPureArabicOption
                  ? "font-bold text-center"
                  : "text-left font-bold text-sm sm:text-base leading-snug"
              } ${
                !selected
                  ? "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] text-[var(--foreground)]"
                  : showNeutralSelected
                  ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9] text-[#4C28B5] dark:text-[#d0bfff] -translate-y-0.5 shadow-xs"
                  : showCorrect
                  ? "bg-emerald-50 dark:bg-emerald-950/35 border-[#087F5B] text-[#065F46] dark:text-emerald-300"
                  : showWrong
                  ? "bg-rose-50 dark:bg-rose-950/35 border-rose-400 text-rose-800 dark:text-rose-200"
                  : "bg-[#F7EFE1]/50 border-[#E6D7BE] text-[var(--muted)] opacity-65"
              }`}
            >
              {isPureArabicOption ? (
                <span
                  dir="rtl"
                  lang="ar"
                  className="arabic font-arabic text-2xl sm:text-3xl font-bold leading-relaxed text-center flex-1 min-w-0 break-words"
                >
                  {formatArabicText(displayOptionText, showHareke, arabicFont)}
                </span>
              ) : (
                <span
                  dir="ltr"
                  lang="tr"
                  className="font-sans text-left flex-1 min-w-0 break-words"
                >
                  <MixedText text={displayOptionText} />
                </span>
              )}
              {showCorrect && (
                <CheckCircle2 size={20} className="text-[#065F46] dark:text-emerald-400 shrink-0" />
              )}
              {showWrong && (
                <XCircle size={20} className="text-rose-600 shrink-0" />
              )}
              {showNeutralSelected && (
                <span className="px-2 py-0.5 rounded-md bg-[#6741D9] text-white text-[11px] font-extrabold shrink-0">
                  Seçildi
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* CEVAPLANDIĞINDA HARFİYEN ANLAM / الفروق اللغوية NÜANS VE ÖRNEK İPUCU KUTUSU */}
      {feedbackMode === "instant" &&
        Boolean(selected) &&
        (currentQuestion.literalTr || currentQuestion.usageNote) && (
          <div className="rounded-2xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-2 border-[#6741D9]/40 p-3.5 sm:p-4 text-left text-sm space-y-1.5 animate-in fade-in duration-150">
            {currentQuestion.literalTr && (
              <p
                dir="ltr"
                lang="tr"
                className="font-sans font-bold text-[#4C28B5] dark:text-[#d0bfff]"
              >
                <span className="font-extrabold">✨ Harfiyen Anlamı:</span>{" "}
                <MixedText text={currentQuestion.literalTr} />
              </p>
            )}
            {currentQuestion.usageNote && (
              <p
                dir="ltr"
                lang="tr"
                className="font-sans text-[var(--foreground)] font-semibold"
              >
                <span className="font-extrabold text-[#065F46] dark:text-emerald-400">
                  💡 Açıklama &amp; Nüans:
                </span>{" "}
                <MixedText text={currentQuestion.usageNote} />
              </p>
            )}
          </div>
        )}

      {/* ÖNCEKİ SORU / SONRAKİ SORU (VEYA TESTİ BİTİR) NAVİGASYON BAR */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={prevQuestion}
          disabled={currentIndex === 0}
          className="px-4 py-3 rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 disabled:opacity-40 font-extrabold text-xs sm:text-sm text-[var(--foreground)] hover:border-[#6741D9] flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Önceki Soru</span>
        </button>

        <button
          type="button"
          onClick={nextQuestion}
          className="flex-1 py-3 px-5 bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-xs sm:text-sm rounded-2xl border-b-4 border-[#087F5B] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>
            {currentIndex === questions.length - 1
              ? "Testi Bitir ✓"
              : "Sonraki Soru"}
          </span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}