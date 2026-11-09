"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Volume2,
  Check,
  X,
  RotateCcw,
  Trophy,
  Sparkles,
  Eye,
  EyeOff,
  Share2,
  UserCheck,
  Mic,
  MicOff,
  Pause,
  Play,
  SkipForward,
  MessageSquare,
  Puzzle,
} from "lucide-react";
import { ResimliKelime, Level } from "@/types/data";
import { gorselKelimeler, resolveImageUrl } from "@/lib/data";
import { selectSmartVisualDistractors, shuffleArray } from "@/lib/quiz";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import { playDualGenderAudio, playTTS, stopAllAudio } from "@/lib/audio";
import {
  playClick,
  playSuccess,
  playError,
  playFanfare,
} from "@/lib/sfxManager";
import ShareAchievementModal from "@/components/ui/ShareAchievementModal";

function normalizeArabicForCompare(str: string): string {
  return (str || "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\u0621-\u064A\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function evaluateArabicSimilarity(target: string, spoken: string): number {
  const a = normalizeArabicForCompare(target);
  const b = normalizeArabicForCompare(spoken);
  if (!a || !b) return 0;
  if (a === b || b.includes(a) || a.includes(b)) return 100;

  const aWords = a.split(" ");
  const bWords = b.split(" ");
  let matchedWords = 0;
  for (const w of aWords) {
    if (bWords.some((bw) => bw === w || bw.includes(w) || w.includes(bw))) {
      matchedWords++;
    }
  }
  if (matchedWords > 0) {
    return Math.round((matchedWords / aWords.length) * 100);
  }

  const aChars = new Set(a.replace(/\s+/g, "").split(""));
  let commonChars = 0;
  for (const ch of b.replace(/\s+/g, "")) {
    if (aChars.has(ch)) commonChars++;
  }
  return Math.min(
    90,
    Math.round((commonChars / Math.max(1, a.length)) * 100)
  );
}

export type VisualInteractionMode =
  | "mixed"
  | "listen_speak_matrix"
  | "match_header_to_card"
  | "speech_bubble_match"
  | "audio_to_image";

type ConcreteVisualMode = Exclude<VisualInteractionMode, "mixed">;

type QuestionStepStatus = "pending" | "correct" | "wrong" | "skipped";

interface VisualQuestion {
  target: ResimliKelime;
  options: ResimliKelime[];
  concreteMode: ConcreteVisualMode;
}

interface VisualRosettaQuizProps {
  visualPool?: ResimliKelime[];
  cefrFilter?: "all" | Level;
  questionCount?: number;
  onClose?: () => void;
}

interface WebSpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const CONCRETE_MODES_CYCLE: ConcreteVisualMode[] = [
  "listen_speak_matrix",
  "match_header_to_card",
  "speech_bubble_match",
  "audio_to_image",
];

function selectBalancedTargets(
  pool: ResimliKelime[],
  count: number
): ResimliKelime[] {
  const seenImages = new Set<string>();
  const seenArabic = new Set<string>();
  const uniquePool: ResimliKelime[] = [];

  for (const item of shuffleArray(pool)) {
    const imgKey = (item.gorsel || "").trim().toLowerCase();
    const arKey = (item.arapca || "").trim().toLowerCase();
    if (!imgKey || seenImages.has(imgKey) || seenArabic.has(arKey)) continue;
    seenImages.add(imgKey);
    seenArabic.add(arKey);
    uniquePool.push(item);
  }

  return (uniquePool.length >= 4 ? uniquePool : shuffleArray(pool)).slice(
    0,
    count
  );
}

function buildVisualQuestions(
  pool: ResimliKelime[],
  count: number,
  selectedMode: VisualInteractionMode
): VisualQuestion[] {
  const safePool = pool.length >= 4 ? pool : gorselKelimeler;
  const targets = selectBalancedTargets(safePool, count);

  return targets.map((target, index) => {
    const distractors = selectSmartVisualDistractors(target, safePool, 3);
    const options = shuffleArray([target, ...distractors]);
    const concreteMode: ConcreteVisualMode =
      selectedMode === "mixed"
        ? CONCRETE_MODES_CYCLE[index % CONCRETE_MODES_CYCLE.length]
        : selectedMode;

    return {
      target,
      options,
      concreteMode,
    };
  });
}

export default function VisualRosettaQuiz({
  visualPool,
  cefrFilter = "all",
  questionCount = 10,
  onClose,
}: VisualRosettaQuizProps) {
  const {
    preferredVoiceGender,
    setPreferredVoiceGender,
    showHareke,
    speechRate,
  } = useSettings();
  const { recordItemAttempt, addMistake } = useUserStore();

  const [interactionMode, setInteractionMode] =
    useState<VisualInteractionMode>("mixed");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [revealHint, setRevealHint] = useState<boolean>(false);
  const [micFreeMode, setMicFreeMode] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const activePool = useMemo(() => {
    const base =
      visualPool && visualPool.length >= 4 ? visualPool : gorselKelimeler;
    return base.filter((item) => {
      if (
        selectedCategory !== "all" &&
        item.kategori !== selectedCategory &&
        item.kategori_tr !== selectedCategory
      ) {
        return false;
      }
      if (cefrFilter !== "all" && item.cefr !== cefrFilter) return false;
      return true;
    });
  }, [visualPool, selectedCategory, cefrFilter]);

  const categories = useMemo(() => {
    const base =
      visualPool && visualPool.length >= 4 ? visualPool : gorselKelimeler;
    const map = new Map<string, string>();
    base.forEach((item) => {
      if (item.kategori && item.kategori_tr) {
        map.set(item.kategori, item.kategori_tr);
      }
    });
    return Array.from(map.entries());
  }, [visualPool]);

  const [questions, setQuestions] = useState<VisualQuestion[]>(() =>
    buildVisualQuestions(activePool, questionCount, "mixed")
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [wrongAttemptIds, setWrongAttemptIds] = useState<string[]>([]);
  const [hadWrongOnCurrent, setHadWrongOnCurrent] = useState<boolean>(false);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<QuestionStepStatus[]>(() =>
    Array.from({ length: questionCount }, () => "pending")
  );

  // Mod A (listen_speak_matrix) için sıralı kart ve mikrofon durumları
  const [matrixStepIndex, setMatrixStepIndex] = useState<number>(0);
  const [matrixCompletedIndices, setMatrixCompletedIndices] = useState<
    number[]
  >([]);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [spokenTranscript, setSpokenTranscript] = useState<string>("");
  const [micStatusMessage, setMicStatusMessage] = useState<string>("");

  const recognitionRef = useRef<WebSpeechRecognitionInstance | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const currentQuestion = questions[currentIndex];

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListeningMic(false);
  }, []);

  const clearTimers = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const formatAr = useCallback(
    (text: string) => {
      if (!text) return "";
      if (showHareke) return text;
      return text.replace(/[\u064B-\u065F\u0670]/g, "");
    },
    [showHareke]
  );

  const getPhraseForMode = useCallback(
    (item: ResimliKelime, mode: ConcreteVisualMode) => {
      if (mode === "speech_bubble_match") {
        const bubbleAr =
          item.ornek_ar && item.ornek_ar.trim().length > 0
            ? item.ornek_ar
            : item.arapca;
        const bubbleTr =
          item.ornek_tr && item.ornek_tr.trim().length > 0
            ? item.ornek_tr
            : item.turkce;
        return { ar: bubbleAr, tr: bubbleTr };
      }
      return { ar: item.arapca, tr: item.turkce };
    },
    []
  );

  const playItemAudio = useCallback(
    (item: ResimliKelime, mode?: ConcreteVisualMode, onEnded?: () => void) => {
      if (isPaused) return;
      const fallbackText =
        mode === "speech_bubble_match" && item.ornek_ar
          ? item.ornek_ar
          : item.arapca;

      playDualGenderAudio({
        text: fallbackText,
        id: item.id,
        ses_erkek: item.ses_erkek,
        ses_kadin: item.ses_kadin,
        gender: preferredVoiceGender,
        rate: speechRate,
      })
        .then(() => {
          if (onEnded) onEnded();
        })
        .catch(() => {
          if (onEnded) onEnded();
        });
    },
    [isPaused, preferredVoiceGender, speechRate]
  );

  const advanceToNextQuestion = useCallback(
    (statusForCurrent: QuestionStepStatus) => {
      stopSpeechRecognition();
      clearTimers();

      setStepStatuses((prev) => {
        const next = [...prev];
        if (currentIndex < next.length) {
          next[currentIndex] = statusForCurrent;
        }
        return next;
      });

      if (currentIndex + 1 < questions.length) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setSelectedOptionId(null);
        setWrongAttemptIds([]);
        setHadWrongOnCurrent(false);
        setRevealHint(false);
        setMatrixStepIndex(0);
        setMatrixCompletedIndices([]);
        setSpokenTranscript("");
        setMicStatusMessage("");
      } else {
        playFanfare();
        setIsCompleted(true);
      }
    },
    [currentIndex, questions.length, stopSpeechRecognition, clearTimers]
  );

  // Mod A (listen_speak_matrix): Bir kartın telaffuzu onaylandığında çağrılır
  const handleMatrixCardVerified = useCallback(
    (cardIdx: number) => {
      if (!currentQuestion) return;
      stopSpeechRecognition();
      clearTimers();
      playSuccess();

      setMatrixCompletedIndices((prev) =>
        prev.includes(cardIdx) ? prev : [...prev, cardIdx]
      );
      setMicStatusMessage("Harika telaffuz! ✓");

      const totalCards = currentQuestion.options.length;
      if (cardIdx + 1 < totalCards) {
        autoAdvanceTimerRef.current = setTimeout(() => {
          setMatrixStepIndex(cardIdx + 1);
          setSpokenTranscript("");
          setMicStatusMessage("");
        }, 650);
      } else {
        // Tüm 4 kart tamamlandı
        recordItemAttempt(currentQuestion.target.id, "word", true, false, 100);
        setScore((s) => s + 1);
        autoAdvanceTimerRef.current = setTimeout(() => {
          advanceToNextQuestion("correct");
        }, 750);
      }
    },
    [
      currentQuestion,
      stopSpeechRecognition,
      clearTimers,
      recordItemAttempt,
      advanceToNextQuestion,
    ]
  );

  // Mod A: WebSpeech STT başlatıcı
  const startMatrixListening = useCallback(
    (targetItem: ResimliKelime, cardIdx: number) => {
      if (isPaused || micFreeMode) return;
      stopSpeechRecognition();

      const win =
        typeof window !== "undefined"
          ? (window as unknown as Record<string, unknown>)
          : null;
      const SpeechRecCtor = win
        ? ((win.SpeechRecognition || win.webkitSpeechRecognition) as
            | (new () => WebSpeechRecognitionInstance)
            | undefined)
        : undefined;

      if (!SpeechRecCtor) {
        setMicStatusMessage(
          "Tarayıcı mikrofon desteklemiyor — Onaylamak için karta dokunun"
        );
        return;
      }

      try {
        const rec = new SpeechRecCtor();
        rec.lang = "ar-SA";
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 3;

        rec.onresult = (evt: unknown) => {
          const event = evt as {
            results?: {
              [index: number]: {
                isFinal?: boolean;
                [altIndex: number]: { transcript?: string };
              };
              length: number;
            };
          };
          if (!event.results || event.results.length === 0) return;
          const res = event.results[event.results.length - 1];
          const transcript = (res?.[0]?.transcript || "").trim();
          if (transcript) {
            setSpokenTranscript(transcript);
            const simScore = evaluateArabicSimilarity(
              targetItem.arapca,
              transcript
            );
            if (simScore >= 45 || res.isFinal) {
              if (simScore >= 35 || transcript.length >= 2) {
                handleMatrixCardVerified(cardIdx);
              } else if (res.isFinal) {
                setMicStatusMessage(
                  `Tekrar deneyin veya "Geç ⏭" butonuna dokunun`
                );
              }
            }
          }
        };

        rec.onerror = () => {
          setIsListeningMic(false);
          setMicStatusMessage(
            "Ses algılanamadı — Tekrar konuşun veya Geç'e basın"
          );
        };

        rec.onend = () => {
          setIsListeningMic(false);
        };

        recognitionRef.current = rec;
        setIsListeningMic(true);
        setMicStatusMessage("Şimdi yüksek sesle tekrar edin...");
        rec.start();
      } catch {
        setIsListeningMic(false);
        setMicStatusMessage("Mikrofon başlatılamadı — Geç butonunu kullanın");
      }
    },
    [isPaused, micFreeMode, stopSpeechRecognition, handleMatrixCardVerified]
  );

  // Soru veya Matrix adımı değiştiğinde otomatik ses çalma
  useEffect(() => {
    if (!currentQuestion || isCompleted || isPaused) return;

    if (currentQuestion.concreteMode === "listen_speak_matrix") {
      const activeCard =
        currentQuestion.options[matrixStepIndex] || currentQuestion.target;
      const timer = setTimeout(() => {
        playItemAudio(activeCard, "listen_speak_matrix", () => {
          if (!micFreeMode && !isPaused) {
            startMatrixListening(activeCard, matrixStepIndex);
          }
        });
      }, 220);
      return () => {
        clearTimeout(timer);
      };
    } else {
      const timer = setTimeout(() => {
        playItemAudio(currentQuestion.target, currentQuestion.concreteMode);
      }, 200);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [
    currentIndex,
    matrixStepIndex,
    currentQuestion,
    isCompleted,
    isPaused,
    micFreeMode,
    playItemAudio,
    startMatrixListening,
  ]);

  useEffect(() => {
    return () => {
      stopAllAudio();
      stopSpeechRecognition();
      clearTimers();
    };
  }, [stopSpeechRecognition, clearTimers]);

  const restartQuiz = useCallback(
    (customPool?: ResimliKelime[], customMode?: VisualInteractionMode) => {
      playClick();
      stopAllAudio();
      stopSpeechRecognition();
      clearTimers();
      const targetPool = customPool || activePool;
      const targetMode = customMode || interactionMode;
      const built = buildVisualQuestions(
        targetPool,
        questionCount,
        targetMode
      );
      setQuestions(built);
      setCurrentIndex(0);
      setSelectedOptionId(null);
      setWrongAttemptIds([]);
      setHadWrongOnCurrent(false);
      setRevealHint(false);
      setScore(0);
      setIsCompleted(false);
      setMatrixStepIndex(0);
      setMatrixCompletedIndices([]);
      setSpokenTranscript("");
      setMicStatusMessage("");
      setStepStatuses(
        Array.from({ length: built.length }, () => "pending")
      );
    },
    [
      activePool,
      interactionMode,
      questionCount,
      stopSpeechRecognition,
      clearTimers,
    ]
  );

  const handleSelectOption = (option: ResimliKelime) => {
    if (!currentQuestion || isPaused) return;

    // Mod A'da karta tıklanınca o kartın sesini çal veya mikrofonsuz moddaysa onayla
    if (currentQuestion.concreteMode === "listen_speak_matrix") {
      const clickedIdx = currentQuestion.options.findIndex(
        (o) => o.id === option.id
      );
      playItemAudio(option, "listen_speak_matrix");
      if (micFreeMode && clickedIdx === matrixStepIndex) {
        handleMatrixCardVerified(clickedIdx);
      }
      return;
    }

    if (selectedOptionId === currentQuestion.target.id) return;
    if (wrongAttemptIds.includes(option.id)) return;

    const isCorrect = option.id === currentQuestion.target.id;

    if (isCorrect) {
      setSelectedOptionId(option.id);
      playSuccess();
      playItemAudio(option, currentQuestion.concreteMode);

      const firstTry = !hadWrongOnCurrent && !revealHint;
      if (firstTry) {
        setScore((s) => s + 1);
        recordItemAttempt(
          currentQuestion.target.id,
          "word",
          true,
          false,
          100
        );
      } else {
        recordItemAttempt(
          currentQuestion.target.id,
          "word",
          true,
          revealHint,
          75
        );
      }

      clearTimers();
      autoAdvanceTimerRef.current = setTimeout(() => {
        advanceToNextQuestion(hadWrongOnCurrent ? "wrong" : "correct");
      }, 950);
    } else {
      playError();
      setHadWrongOnCurrent(true);
      setWrongAttemptIds((prev) => [...prev, option.id]);
      addMistake(currentQuestion.target.id);
      recordItemAttempt(
        currentQuestion.target.id,
        "word",
        false,
        revealHint,
        25
      );
      playItemAudio(option, currentQuestion.concreteMode);
    }
  };

  if (!currentQuestion) {
    return (
      <div className="p-6 text-center bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE]">
        <p className="text-sm font-bold text-[var(--muted)]">
          Bu filtrede yeterli görsel öğe bulunamadı.
        </p>
      </div>
    );
  }

  if (isCompleted) {
    const accuracy = Math.round((score / questions.length) * 100);
    return (
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-5 sm:p-7 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-[#087F5B]/15 border-2 border-[#087F5B] flex items-center justify-center mx-auto text-[#065F46] dark:text-emerald-400">
          <Trophy size={28} />
        </div>

        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-[#6741D9] dark:text-purple-300 text-xs font-extrabold">
            <Sparkles size={13} />
            Görsel &amp; Sesli Eşleştirme Tamamlandı
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--foreground)]">
            İlk Denemede {score} / {questions.length} Doğru!
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
            Başarı Oranı: <strong className="text-[#087F5B]">%{accuracy}</strong>
          </p>
        </div>

        {/* Adım Zinciri Özeti */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap py-1">
          {stepStatuses.map((st, idx) => (
            <span
              key={idx}
              className={`w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center border ${
                st === "correct"
                  ? "bg-emerald-600 border-emerald-700 text-white"
                  : st === "wrong"
                  ? "bg-amber-600 border-amber-700 text-white"
                  : "bg-slate-200 dark:bg-slate-700 border-slate-300 text-slate-700 dark:text-slate-200"
              }`}
            >
              {st === "correct" ? "✓" : st === "wrong" ? "✕" : idx + 1}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => restartQuiz()}
            className="h-10 px-4 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-xs sm:text-sm border-b-3 border-[#065F46] flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>Yeni Görsellerle Tekrar Oyna</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              setShowShareModal(true);
            }}
            className="h-10 px-4 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white font-extrabold text-xs sm:text-sm border-b-3 border-[#5230B5] flex items-center gap-2 cursor-pointer"
          >
            <Share2 size={15} />
            <span>Başarı Kartını Paylaş</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] font-extrabold text-xs sm:text-sm text-[var(--foreground)] cursor-pointer"
            >
              Alıştırma Merkezine Dön
            </button>
          )}
        </div>

        <ShareAchievementModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          title="Görsel & Sesli Eşleştirme"
          subtitle="Kare Görsel ve Çift Cinsiyetli Ses Pratiği"
          arabicTitle="الصُّوَرُ وَالتَّلَفُّظ"
          scorePercent={accuracy}
          pointsText={`${score} / ${questions.length} Doğru`}
          wordsCount={questions.length}
          levelLabel={cefrFilter === "all" ? "A1-B2" : cefrFilter}
          badgeType="exercise"
        />
      </div>
    );
  }

  const activeConcreteMode = currentQuestion.concreteMode;
  const targetPhrase = getPhraseForMode(
    currentQuestion.target,
    activeConcreteMode
  );
  const isQuestionSolved = selectedOptionId === currentQuestion.target.id;
  const activeMatrixCard =
    currentQuestion.options[matrixStepIndex] || currentQuestion.target;

  const modeTabs: {
    id: VisualInteractionMode;
    label: string;
    shortLabel: string;
  }[] = [
    { id: "mixed", label: "🔄 Karma Akış", shortLabel: "🔄 Karma" },
    {
      id: "listen_speak_matrix",
      label: "🎙️ Dinle & Telaffuz Matrisi",
      shortLabel: "🎙️ Matris",
    },
    {
      id: "match_header_to_card",
      label: "🧩 İbareyi Görsele Yerleştir",
      shortLabel: "🧩 Yerleştir",
    },
    {
      id: "speech_bubble_match",
      label: "💬 Konuşma Balonlu Eşleştirme",
      shortLabel: "💬 Balonlu",
    },
    {
      id: "audio_to_image",
      label: "🔊 Dinle & Görseli Bul",
      shortLabel: "🔊 Dinle-Bul",
    },
  ];

  return (
    <div className="h-[calc(100dvh-105px)] max-h-[calc(100dvh-105px)] flex flex-col justify-between overflow-hidden p-2 sm:p-4 bg-[#F7EFE1]/60 dark:bg-[var(--surface)]/50 rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] gap-1.5 sm:gap-2">
      {/* 1. ÜST KONTROL VE 4 ETKİLEŞİM MODU SEÇİCİ ÇUBUĞU (shrink-0) */}
      <div className="shrink-0 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] px-2 py-1.5 flex flex-wrap items-center justify-between gap-1.5">
        {/* Etkileşim Modu Sekmeleri */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
          {modeTabs.map((tab) => {
            const active = interactionMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playClick();
                  setInteractionMode(tab.id);
                  restartQuiz(activePool, tab.id);
                }}
                className={`px-2 py-1 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  active
                    ? "bg-[#6741D9] text-white shadow-2xs"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border border-[#E6D7BE] hover:border-[#6741D9]"
                }`}
              >
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Sağ Kontroller: Erkek/Kadın Ses + Kategori */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <div className="inline-flex items-center rounded-lg bg-white dark:bg-[var(--background)] p-0.5 border border-[#E6D7BE]">
            <button
              type="button"
              onClick={() => {
                playClick();
                setPreferredVoiceGender("erkek");
              }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                preferredVoiceGender === "erkek"
                  ? "bg-[#087F5B] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <UserCheck size={11} />
              <span>Erkek</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playClick();
                setPreferredVoiceGender("kadin");
              }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                preferredVoiceGender === "kadin"
                  ? "bg-[#6741D9] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <UserCheck size={11} />
              <span>Kadın</span>
            </button>
          </div>

          {categories.length > 1 && (
            <select
              value={selectedCategory}
              onChange={(e) => {
                const nextCat = e.target.value;
                setSelectedCategory(nextCat);
                const base =
                  visualPool && visualPool.length >= 4
                    ? visualPool
                    : gorselKelimeler;
                const nextPool = base.filter(
                  (i) =>
                    (nextCat === "all" ||
                      i.kategori === nextCat ||
                      i.kategori_tr === nextCat) &&
                    (cefrFilter === "all" || i.cefr === cefrFilter)
                );
                restartQuiz(nextPool, interactionMode);
              }}
              aria-label="Görsel Kategori Seçimi"
              className="hidden sm:block h-7 px-2 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[11px] font-bold text-[var(--foreground)] max-w-[140px] truncate"
            >
              <option value="all">Tüm Kategoriler</option>
              {categories.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 2. HEDEF İBARE / AKTİF KONUŞMA BANDI (shrink-0) */}
      {activeConcreteMode === "listen_speak_matrix" ? (
        /* MOD A: Koyu Lacivert/Antrasit Aktif Konuşma Çubuğu (bg-[#1E293B] text-white) */
        <div className="shrink-0 bg-[#1E293B] text-white rounded-xl px-3 py-2 border-2 border-slate-700 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() =>
                playItemAudio(
                  activeMatrixCard,
                  "listen_speak_matrix",
                  () => {
                    if (!micFreeMode && !isPaused) {
                      startMatrixListening(activeMatrixCard, matrixStepIndex);
                    }
                  }
                )
              }
              className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
              title="Kartın Sesini Dinle"
            >
              <Volume2 size={18} />
            </button>

            <button
              type="button"
              onClick={() => {
                if (micFreeMode) {
                  handleMatrixCardVerified(matrixStepIndex);
                } else {
                  startMatrixListening(activeMatrixCard, matrixStepIndex);
                }
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                isListeningMic
                  ? "bg-emerald-500 text-white ring-4 ring-emerald-400/40 animate-pulse"
                  : "bg-slate-700 hover:bg-slate-600 text-emerald-300"
              }`}
              title={
                micFreeMode
                  ? "Mikrofonsuz Onayla"
                  : "Mikrofonla Telaffuz Et"
              }
            >
              <Mic size={18} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold">
                  KART {matrixStepIndex + 1} / {currentQuestion.options.length}
                </span>
                <span
                  lang="ar"
                  dir="rtl"
                  className="arabic text-lg sm:text-2xl font-bold text-white leading-none truncate"
                >
                  {formatAr(activeMatrixCard.arapca)}
                </span>
                <span className="text-xs text-slate-300 font-semibold truncate">
                  ({activeMatrixCard.turkce})
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                {micFreeMode
                  ? "Mikrofonsuz Mod aktif: Onaylamak için aktif karta veya 'Onayla ✓' butonuna dokunun."
                  : spokenTranscript
                  ? `Algılanan: "${spokenTranscript}" — ${micStatusMessage}`
                  : micStatusMessage ||
                    "Sesi dinleyin ve mikrofon simgesi yanınca yüksek sesle tekrar edin."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleMatrixCardVerified(matrixStepIndex)}
            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>{micFreeMode ? "Onayla ✓" : "Geç ⏭"}</span>
          </button>
        </div>
      ) : activeConcreteMode === "match_header_to_card" ? (
        /* MOD B: Üst-Ortada Sesli Hedef İbare Kartı (🧩 İbareyi Görsele Yerleştir) */
        <div className="shrink-0 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-xl px-3 py-1.5 border-2 border-[#6741D9] flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#6741D9]/15 text-[#6741D9] dark:text-purple-300 text-[11px] font-extrabold shrink-0">
              <Puzzle size={13} />
              <span>İbareyi Görsele Yerleştir</span>
            </span>
            <span className="text-[11px] font-semibold text-[var(--muted)] hidden sm:inline truncate">
              Üstteki Arapça ibareyi aşağıdaki doğru görselin başlık yuvasına yerleştirin:
            </span>
          </div>

          {/* Merkez Hedef İbare Kartı */}
          <div className="flex items-center gap-2 bg-white dark:bg-[var(--background)] px-3 py-1 rounded-xl border-2 border-[#6741D9] shadow-2xs">
            <button
              type="button"
              onClick={() =>
                playItemAudio(currentQuestion.target, activeConcreteMode)
              }
              className="w-7 h-7 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white flex items-center justify-center cursor-pointer shrink-0"
              title="Tekrar Dinle"
            >
              <Volume2 size={15} />
            </button>
            <span
              lang="ar"
              dir="rtl"
              className="arabic text-lg sm:text-2xl font-bold text-[var(--foreground)] leading-none"
            >
              {formatAr(targetPhrase.ar)}
            </span>
            {revealHint && (
              <span className="text-xs font-bold text-[#087F5B] border-l border-[#E6D7BE] pl-2">
                {targetPhrase.tr}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              playClick();
              setRevealHint((v) => !v);
            }}
            className="h-7 px-2 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1 cursor-pointer shrink-0"
          >
            {revealHint ? <EyeOff size={12} /> : <Eye size={12} />}
            <span className="hidden sm:inline">
              {revealHint ? "Gizle" : "Anlam"}
            </span>
          </button>
        </div>
      ) : activeConcreteMode === "speech_bubble_match" ? (
        /* MOD C: Konuşma Balonlu Eşleştirme Başlığı */
        <div className="shrink-0 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-xl px-3 py-1.5 border-2 border-[#087F5B] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() =>
                playItemAudio(currentQuestion.target, "speech_bubble_match")
              }
              className="w-8 h-8 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white flex items-center justify-center shrink-0 cursor-pointer"
              title="İfadeyi Dinle"
            >
              <Volume2 size={16} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={13} className="text-[#087F5B] shrink-0" />
                <span
                  lang="ar"
                  dir="rtl"
                  className="arabic text-base sm:text-xl font-bold text-[var(--foreground)] leading-tight truncate"
                >
                  {formatAr(targetPhrase.ar)}
                </span>
              </div>
              {revealHint ? (
                <p className="text-[11px] font-bold text-[#087F5B] truncate">
                  {targetPhrase.tr}
                </p>
              ) : (
                <p className="text-[10px] font-semibold text-[var(--muted)] truncate">
                  Bu ifadeyi doğru sahnenin konuşma balonuna yerleştirin
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playClick();
              setRevealHint((v) => !v);
            }}
            className="h-7 px-2.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1 cursor-pointer shrink-0"
          >
            {revealHint ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{revealHint ? "Gizle" : "Türkçe İpucu"}</span>
          </button>
        </div>
      ) : (
        /* MOD D: Dinle & Görseli Bul Başlığı */
        <div className="shrink-0 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-xl px-3 py-1.5 border-2 border-[#E6D7BE] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() =>
                playItemAudio(currentQuestion.target, "audio_to_image")
              }
              className="w-8 h-8 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white flex items-center justify-center shrink-0 cursor-pointer"
              title="Tekrar Dinle"
            >
              <Volume2 size={16} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  lang="ar"
                  dir="rtl"
                  className="arabic text-lg sm:text-2xl font-bold text-[var(--foreground)] leading-none truncate"
                >
                  {formatAr(currentQuestion.target.arapca)}
                </span>
                {revealHint && (
                  <span className="text-xs font-extrabold text-[#087F5B] truncate">
                    — {currentQuestion.target.turkce}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-semibold text-[var(--muted)] truncate">
                Dinlediğiniz ibareye karşılık gelen kare görseli seçin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                playClick();
                playTTS(
                  currentQuestion.target.arapca,
                  Math.max(0.65, speechRate * 0.78),
                  preferredVoiceGender
                );
              }}
              className="h-7 px-2 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[11px] font-bold text-[var(--foreground)] cursor-pointer hidden sm:flex items-center gap-1"
            >
              🐢 Yavaş
            </button>
            <button
              type="button"
              onClick={() => {
                playClick();
                setRevealHint((v) => !v);
              }}
              className="h-7 px-2.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1 cursor-pointer"
            >
              {revealHint ? <EyeOff size={12} /> : <Eye size={12} />}
              <span>{revealHint ? "Gizle" : "İpucu"}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. MERKEZ 2x2 / 1x4 KARE GÖRSEL KART IZGARASI (KIRPILMAMIŞ 1:1 OBJECT-CONTAIN & ZERO-SCROLL) */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <div
          className={`w-full h-full grid grid-cols-2 ${
            activeConcreteMode === "match_header_to_card"
              ? "lg:grid-cols-4"
              : "sm:grid-cols-2 lg:grid-cols-4"
          } gap-2 sm:gap-2.5 items-stretch`}
        >
          {currentQuestion.options.map((option, idx) => {
            const isTarget = option.id === currentQuestion.target.id;
            const isSelectedCorrect =
              selectedOptionId === option.id && isTarget;
            const isWrongAttempt = wrongAttemptIds.includes(option.id);
            const isMatrixActive =
              activeConcreteMode === "listen_speak_matrix" &&
              matrixStepIndex === idx;
            const isMatrixDone =
              activeConcreteMode === "listen_speak_matrix" &&
              matrixCompletedIndices.includes(idx);

            let cardStyle =
              "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9]";
            if (isSelectedCorrect || isMatrixDone) {
              cardStyle =
                "bg-emerald-50/90 dark:bg-emerald-950/40 border-[#087F5B] ring-3 ring-[#087F5B]/40";
            } else if (isMatrixActive) {
              cardStyle =
                "bg-sky-50/90 dark:bg-sky-950/40 border-sky-500 ring-3 ring-sky-400/50";
            } else if (isWrongAttempt) {
              cardStyle =
                "bg-rose-50/80 dark:bg-rose-950/30 border-rose-400 opacity-65";
            }

            const optionBubblePhrase = getPhraseForMode(
              option,
              "speech_bubble_match"
            );

            return (
              <div
                key={`${option.id}_${idx}`}
                onClick={() => handleSelectOption(option)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectOption(option);
                  }
                }}
                className={`group relative rounded-2xl border-2 border-b-4 p-1.5 sm:p-2 transition-all flex flex-col justify-between overflow-hidden cursor-pointer select-none ${cardStyle}`}
              >
                {/* KART ÜST BARI — Moda Göre Dinamik */}
                {activeConcreteMode === "listen_speak_matrix" && (
                  <div
                    className={`shrink-0 rounded-xl px-2 py-1 mb-1 flex items-center justify-between gap-1 border ${
                      isMatrixDone
                        ? "bg-emerald-600 text-white border-emerald-700"
                        : isMatrixActive
                        ? "bg-[#1E293B] text-white border-slate-700"
                        : "bg-[#F7EFE1] dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playItemAudio(option, "listen_speak_matrix");
                      }}
                      className="w-6 h-6 rounded-lg bg-black/15 hover:bg-black/25 flex items-center justify-center shrink-0 cursor-pointer"
                      title="Dinle"
                    >
                      <Volume2 size={13} />
                    </button>
                    <span
                      lang="ar"
                      dir="rtl"
                      className="arabic text-sm sm:text-lg font-bold leading-none truncate"
                    >
                      {formatAr(option.arapca)}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                        isMatrixDone
                          ? "bg-white text-emerald-700"
                          : isMatrixActive
                          ? "bg-emerald-400 text-slate-950 animate-pulse"
                          : "bg-black/10 text-current"
                      }`}
                    >
                      {isMatrixDone ? "✓" : idx + 1}
                    </span>
                  </div>
                )}

                {activeConcreteMode === "match_header_to_card" && (
                  <div
                    className={`shrink-0 rounded-xl px-2 py-1 mb-1 min-h-[30px] sm:min-h-[34px] flex items-center justify-center border-2 transition-all ${
                      isSelectedCorrect
                        ? "bg-[#087F5B] border-[#065F46] text-white shadow-xs"
                        : isWrongAttempt
                        ? "bg-rose-100 dark:bg-rose-950/60 border-rose-400 text-rose-800 dark:text-rose-200"
                        : "bg-[#F7EFE1]/60 dark:bg-[var(--background)]/60 border-dashed border-[#cbb692] text-[var(--muted)]"
                    }`}
                  >
                    {isSelectedCorrect ? (
                      <div className="flex items-center gap-1.5">
                        <Check size={14} strokeWidth={3} />
                        <span
                          lang="ar"
                          dir="rtl"
                          className="arabic text-base sm:text-lg font-bold leading-none"
                        >
                          {formatAr(targetPhrase.ar)}
                        </span>
                      </div>
                    ) : isWrongAttempt ? (
                      <span
                        lang="ar"
                        dir="rtl"
                        className="arabic text-sm font-bold leading-none"
                      >
                        {formatAr(option.arapca)}
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] font-bold opacity-75">
                        Buraya yerleştir ({idx + 1})
                      </span>
                    )}
                  </div>
                )}

                {activeConcreteMode === "speech_bubble_match" && (
                  /* MOD C: Görselin Üstünde Üçgen İşaretçili Beyaz Konuşma Balonu */
                  <div className="shrink-0 relative mb-2">
                    <div
                      className={`rounded-xl px-2.5 py-1 min-h-[30px] sm:min-h-[34px] flex items-center justify-center border-2 shadow-2xs transition-all ${
                        isSelectedCorrect
                          ? "bg-emerald-600 border-emerald-700 text-white"
                          : isWrongAttempt
                          ? "bg-rose-50 border-rose-300 text-rose-800"
                          : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {isSelectedCorrect ? (
                        <div className="flex items-center gap-1.5">
                          <Check size={14} strokeWidth={3} />
                          <span
                            lang="ar"
                            dir="rtl"
                            className="arabic text-sm sm:text-base font-bold leading-tight truncate"
                          >
                            {formatAr(targetPhrase.ar)}
                          </span>
                        </div>
                      ) : isWrongAttempt ? (
                        <span
                          lang="ar"
                          dir="rtl"
                          className="arabic text-xs sm:text-sm font-bold leading-tight truncate"
                        >
                          {formatAr(optionBubblePhrase.ar)}
                        </span>
                      ) : (
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">
                          💬 Konuşma balonuna yerleştir...
                        </span>
                      )}
                    </div>
                    {/* Balonun aşağı bakan üçgen oku */}
                    <div
                      className={`w-2.5 h-2.5 rotate-45 border-r-2 border-b-2 mx-auto -mt-1.5 ${
                        isSelectedCorrect
                          ? "bg-emerald-600 border-emerald-700"
                          : isWrongAttempt
                          ? "bg-rose-50 border-rose-300"
                          : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      }`}
                    />
                  </div>
                )}

                {/* 1:1 KARE GÖRSEL KUTUSU — HİÇBİR ZAMAN KIRPILMAZ (aspect-square + object-contain) */}
                <div className="relative flex-1 min-h-0 flex items-center justify-center bg-[#FBF7F0] dark:bg-slate-900/60 rounded-xl overflow-hidden p-1">
                  <img
                    src={resolveImageUrl(option.gorsel)}
                    alt={option.turkce}
                    loading="eager"
                    className="aspect-square max-h-[22vh] sm:max-h-[26vh] lg:max-h-[30vh] w-auto mx-auto object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
                  />

                  {/* Sağ Üst Doğru / Yanlış Büyük Rozeti */}
                  {(isSelectedCorrect || isMatrixDone) && (
                    <div className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-[#087F5B] text-white flex items-center justify-center shadow-md border-2 border-white">
                      <Check size={15} strokeWidth={3} />
                    </div>
                  )}
                  {isWrongAttempt && (
                    <div className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md border-2 border-white">
                      <X size={15} strokeWidth={3} />
                    </div>
                  )}
                </div>

                {/* Alt Bilgi Satırı (Seçildiğinde veya Matrix modunda anlam gösterimi) */}
                <div className="shrink-0 pt-1 flex items-center justify-between gap-1 text-[11px] font-bold text-[var(--muted)]">
                  <span className="truncate">
                    {isSelectedCorrect ||
                    isWrongAttempt ||
                    isMatrixDone ||
                    isQuestionSolved
                      ? option.turkce
                      : `Seçenek ${idx + 1}`}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#F7EFE1] dark:bg-[var(--background)] text-[10px] font-extrabold text-[var(--muted)]">
                    {option.cefr}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. ALT DAİRESEL İLERLEME ZİNCİRİ VE KONTROL BARI (shrink-0) */}
      <div className="shrink-0 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] px-2.5 py-1.5 flex items-center justify-between gap-2">
        {/* Sol: ⏸ Duraklat ve 🎙️ Mikrofon Aç/Kapa */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClick();
              setIsPaused((prev) => {
                const next = !prev;
                if (next) {
                  stopAllAudio();
                  stopSpeechRecognition();
                }
                return next;
              });
            }}
            className={`h-8 px-2.5 rounded-lg border text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
              isPaused
                ? "bg-amber-600 border-amber-700 text-white"
                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)] hover:border-[#087F5B]"
            }`}
            title={isPaused ? "Devam Et" : "Duraklat"}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
            <span className="hidden sm:inline">
              {isPaused ? "Devam Et" : "Duraklat"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              setMicFreeMode((prev) => {
                const next = !prev;
                if (next) stopSpeechRecognition();
                return next;
              });
            }}
            className={`h-8 px-2.5 rounded-lg border text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
              micFreeMode
                ? "bg-slate-700 border-slate-800 text-amber-300"
                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[#087F5B] hover:border-[#087F5B]"
            }`}
            title="Mikrofonsuz Mod Aç/Kapa"
          >
            {micFreeMode ? <MicOff size={13} /> : <Mic size={13} />}
            <span className="hidden sm:inline">
              {micFreeMode ? "Mikrofonsuz Mod" : "Mikrofon Açık"}
            </span>
          </button>
        </div>

        {/* Merkez: Dairesel İlerleme Zinciri (Doğru: Yeşil ✓, Yanlış: Turuncu/Kırmızı ✕, Aktif: Mavi 1..N, Bekleyen: Gri) */}
        <div className="flex items-center justify-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {questions.map((_, idx) => {
            const st = stepStatuses[idx] || "pending";
            const isCurrent = idx === currentIndex;

            let circleClass =
              "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400";
            if (isCurrent) {
              circleClass =
                "bg-sky-600 border-sky-700 text-white ring-2 ring-sky-400/50 scale-105";
            } else if (st === "correct") {
              circleClass = "bg-emerald-600 border-emerald-700 text-white";
            } else if (st === "wrong") {
              circleClass = "bg-amber-600 border-amber-700 text-white";
            } else if (st === "skipped") {
              circleClass = "bg-slate-400 border-slate-500 text-white";
            }

            return (
              <span
                key={idx}
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border text-[11px] font-extrabold flex items-center justify-center shrink-0 transition-all tabular-nums ${circleClass}`}
                title={`Soru ${idx + 1}`}
              >
                {isCurrent
                  ? idx + 1
                  : st === "correct"
                  ? "✓"
                  : st === "wrong"
                  ? "✕"
                  : idx + 1}
              </span>
            );
          })}
        </div>

        {/* Sağ: Atla ⏭ Butonu */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClick();
              advanceToNextQuestion(hadWrongOnCurrent ? "wrong" : "skipped");
            }}
            className="h-8 px-3 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#6741D9] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1 cursor-pointer transition-all"
            title="Bu Soruyu Atla"
          >
            <span>Atla</span>
            <SkipForward size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
