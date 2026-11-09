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
  playStart,
  playCorrect,
  playWrong,
  playFanfare,
} from "@/lib/sfxManager";
import ShareAchievementModal from "@/components/ui/ShareAchievementModal";

// Doğu Arapça rakamları (٠-٩) -> Batı rakamları (0-9)
const EASTERN_DIGIT_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

// Sayı kelimeleri <-> rakam eşdeğerlik tablosu (normalize edilmiş harflerle)
const ARABIC_NUMBER_EQUIVALENTS: Record<string, string[]> = {
  "0": ["صفر"],
  "1": ["واحد", "واحده"],
  "2": ["اثنان", "اثنين", "اثنتان", "اثنتين"],
  "3": ["ثلاثه", "ثلاث"],
  "4": ["اربعه", "اربع"],
  "5": ["خمسه", "خمس"],
  "6": ["سته", "ست"],
  "7": ["سبعه", "سبع"],
  "8": ["ثمانيه", "ثماني", "ثمان"],
  "9": ["تسعه", "تسع"],
  "10": ["عشره", "عشر"],
  "11": ["احد عشر", "احدى عشره"],
  "12": ["اثنا عشر", "اثني عشر"],
};

/**
 * 2. Sıkı Kelime ve Harf Uyumu Doğrulaması için Normalizasyon (`normalizeStrictArabic`):
 * - Tüm harekeleri (\u064B-\u065F, \u0670), tatweel (\u0640) ve noktalama işaretlerini temizler.
 * - Harf varyantlarını birleştirir: أ/إ/آ/ٱ -> ا, ة -> ه, ى -> ي, ؤ -> و, ئ -> ي.
 * - Doğu Arapça rakamlarını (٠-٩) standart rakamlara (0-9) dönüştürür.
 */
export function normalizeStrictArabic(str: string): string {
  const withWesternDigits = (str || "").replace(
    /[٠-٩]/g,
    (d) => EASTERN_DIGIT_MAP[d] ?? d
  );

  return withWesternDigits
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0621-\u064A0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Konuşulan metindeki rakamları (örn. "7") hedef metindeki sayı kelimesine (örn. "سبعه")
 * veya tam tersine kanonikleştirir.
 */
function canonicalizeNumbersForTarget(
  normalizedSpoken: string,
  normalizedTarget: string
): string {
  if (!normalizedSpoken || !normalizedTarget) return normalizedSpoken;
  let result = normalizedSpoken;

  for (const [digit, wordVariants] of Object.entries(
    ARABIC_NUMBER_EQUIVALENTS
  )) {
    const targetHasDigit = normalizedTarget.split(" ").includes(digit);
    const matchingTargetWord = wordVariants.find((w) =>
      normalizedTarget.includes(w)
    );

    if (matchingTargetWord) {
      // Hedefte sayı kelimesi varsa (örn. "سبعه"), konuşmadaki rakamı veya diğer varyantı hedef kelimeye çevir
      const digitRegex = new RegExp(`\\b${digit}\\b`, "g");
      result = result.replace(digitRegex, matchingTargetWord);
      for (const variant of wordVariants) {
        if (variant !== matchingTargetWord && result.includes(variant)) {
          result = result.replace(new RegExp(variant, "g"), matchingTargetWord);
        }
      }
    } else if (targetHasDigit) {
      // Hedefte rakam varsa, konuşmadaki sayı kelimelerini rakama çevir
      for (const variant of wordVariants) {
        if (result.includes(variant)) {
          result = result.replace(new RegExp(variant, "g"), digit);
        }
      }
    }
  }

  return result.replace(/\s+/g, " ").trim();
}

/** Karakter dizileri arası Levenshtein düzenleme mesafesi */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const aChars = Array.from(a);
  const bChars = Array.from(b);
  const m = aChars.length;
  const n = bChars.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = aChars[i - 1] === bChars[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function stripLeadingAl(word: string): string {
  return word.startsWith("ال") && word.length > 3 ? word.slice(2) : word;
}

function isSingleWordStrictMatch(
  targetWord: string,
  spokenWord: string
): { matched: boolean; similarity: number; distance: number } {
  if (!targetWord || !spokenWord) {
    return { matched: false, similarity: 0, distance: 99 };
  }
  if (targetWord === spokenWord) {
    return { matched: true, similarity: 100, distance: 0 };
  }

  // Harf-i tarif (ال) farkı varsa çekirdek kelimeyi de kontrol et (örn. "يوم" vs "اليوم")
  const bareTarget = stripLeadingAl(targetWord);
  const bareSpoken = stripLeadingAl(spokenWord);
  if (bareTarget === bareSpoken && bareTarget.length >= 2) {
    return { matched: true, similarity: 100, distance: 0 };
  }

  const distRaw = levenshteinDistance(targetWord, spokenWord);
  const maxLenRaw = Math.max(
    Array.from(targetWord).length,
    Array.from(spokenWord).length,
    1
  );
  const simRaw = Math.round(((maxLenRaw - distRaw) / maxLenRaw) * 100);

  const distBare = levenshteinDistance(bareTarget, bareSpoken);
  const maxLenBare = Math.max(
    Array.from(bareTarget).length,
    Array.from(bareSpoken).length,
    1
  );
  const simBare = Math.round(((maxLenBare - distBare) / maxLenBare) * 100);

  const bestDist = distBare < distRaw ? distBare : distRaw;
  const bestSim = Math.max(simRaw, simBare);
  const targetLen = Array.from(bareTarget).length;

  // Kısa kelimelerde (<= 4 harf) %100 tam harf eşleşmesi zorunlu;
  // 5+ harfli kelimelerde en fazla 1 harf farkı (veya >= %90 benzerlik) kabul edilir.
  if (targetLen <= 4) {
    return {
      matched: bestDist === 0,
      similarity: bestDist === 0 ? 100 : bestSim,
      distance: bestDist,
    };
  }

  const isMatch = bestDist <= 1 || bestSim >= 90;
  return {
    matched: isMatch,
    similarity: bestSim,
    distance: bestDist,
  };
}

export interface StrictSpeechMatchResult {
  isMatch: boolean;
  isExact100: boolean;
  similarity: number;
}

/**
 * Hedef Arapça ibare ile kullanıcının söylediği metni %90-%100 harf uyumuna göre doğrular.
 * Rastgele sesleri veya farklı kelimeleri ASLA doğru kabul etmez.
 */
export function strictArabicSpeechMatch(
  targetAr: string,
  spokenTranscript: string
): StrictSpeechMatchResult {
  const normTarget = normalizeStrictArabic(targetAr);
  const rawNormSpoken = normalizeStrictArabic(spokenTranscript);
  const normSpoken = canonicalizeNumbersForTarget(rawNormSpoken, normTarget);

  if (!normTarget || !normSpoken) {
    return { isMatch: false, isExact100: false, similarity: 0 };
  }

  if (normTarget === normSpoken) {
    return { isMatch: true, isExact100: true, similarity: 100 };
  }

  const targetWords = normTarget.split(" ").filter(Boolean);
  const spokenWords = normSpoken.split(" ").filter(Boolean);

  // 1) TEK KELİMELİK HEDEFLER (örn. يَوْم, أُسْبُوع, شَهْر, سَنَة, رَجُل, اِمْرَأَة)
  if (targetWords.length === 1) {
    const tWord = targetWords[0];
    // Kullanıcı tek kelime söylediyse veya birkaç kelime içinde tam hedef kelimeyi söylediyse
    let bestSingle = isSingleWordStrictMatch(tWord, normSpoken.replace(/\s+/g, ""));
    for (const sWord of spokenWords) {
      const candidate = isSingleWordStrictMatch(tWord, sWord);
      if (candidate.similarity > bestSingle.similarity) {
        bestSingle = candidate;
      }
    }
    return {
      isMatch: bestSingle.matched,
      isExact100: bestSingle.similarity === 100,
      similarity: bestSingle.similarity,
    };
  }

  // 2) ÇOK KELİMELİ İBARE VE CÜMLELER (örn. البِنْتُ تَشْرَبُ, سَبْعَةُ أَيَّامٍ)
  const fullDist = levenshteinDistance(normTarget, normSpoken);
  const maxFullLen = Math.max(
    Array.from(normTarget).length,
    Array.from(normSpoken).length,
    1
  );
  const fullSimilarity = Math.round(
    ((maxFullLen - fullDist) / maxFullLen) * 100
  );

  // Hedef kelimelerin tamamının konuşulan kelimeler içinde karşılığı bulunmalı
  let matchedWordCount = 0;
  let wordSimSum = 0;
  for (const tWord of targetWords) {
    let bestWordMatch = { matched: false, similarity: 0, distance: 99 };
    for (const sWord of spokenWords) {
      const res = isSingleWordStrictMatch(tWord, sWord);
      if (res.similarity > bestWordMatch.similarity) {
        bestWordMatch = res;
      }
    }
    if (bestWordMatch.matched) {
      matchedWordCount++;
    }
    wordSimSum += bestWordMatch.similarity;
  }

  const avgWordSimilarity = Math.round(wordSimSum / targetWords.length);
  const allTargetWordsPresent = matchedWordCount === targetWords.length;
  const effectiveSim = Math.max(fullSimilarity, avgWordSimilarity);

  const isPhraseMatch =
    allTargetWordsPresent && (fullSimilarity >= 85 || avgWordSimilarity >= 90);

  return {
    isMatch: isPhraseMatch,
    isExact100:
      allTargetWordsPresent && (fullSimilarity >= 95 || avgWordSimilarity === 100),
    similarity: effectiveSim,
  };
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

  // Mod A (listen_speak_matrix) için sıralı kart, 3 deneme sayacı ve mikrofon durumları
  const [matrixStepIndex, setMatrixStepIndex] = useState<number>(0);
  const [matrixCompletedIndices, setMatrixCompletedIndices] = useState<
    number[]
  >([]);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [isPlayingTargetAudio, setIsPlayingTargetAudio] =
    useState<boolean>(false);
  const [spokenTranscript, setSpokenTranscript] = useState<string>("");
  const [micStatusMessage, setMicStatusMessage] = useState<string>("");
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [micTimedOut, setMicTimedOut] = useState<boolean>(false);
  const [isWrongPronunciationState, setIsWrongPronunciationState] =
    useState<boolean>(false);

  const recognitionRef = useRef<WebSpeechRecognitionInstance | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const micStartDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const micSilenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const autoReplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedAttemptsRef = useRef<number>(0);
  const streakRef = useRef<number>(0);
  const verifiedCardLockRef = useRef<boolean>(false);

  const currentQuestion = questions[currentIndex];

  const clearTimers = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (micStartDelayTimerRef.current) {
      clearTimeout(micStartDelayTimerRef.current);
      micStartDelayTimerRef.current = null;
    }
    if (micSilenceTimeoutRef.current) {
      clearTimeout(micSilenceTimeoutRef.current);
      micSilenceTimeoutRef.current = null;
    }
    if (autoReplayTimerRef.current) {
      clearTimeout(autoReplayTimerRef.current);
      autoReplayTimerRef.current = null;
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (micSilenceTimeoutRef.current) {
      clearTimeout(micSilenceTimeoutRef.current);
      micSilenceTimeoutRef.current = null;
    }
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

  /**
   * 1. Mikrofon Yaşam Döngüsü ve Ses Çakışmasını Önleme:
   * Hedef Arapça ses dosyası çalarken mikrofon (`SpeechRecognition`) kesinlikle kapatılır.
   */
  const playItemAudio = useCallback(
    (item: ResimliKelime, mode?: ConcreteVisualMode, onEnded?: () => void) => {
      if (isPaused) return;
      // Hedef ses çalarken mikrofonu kesinlikle kapalı tut
      stopSpeechRecognition();
      setIsPlayingTargetAudio(true);

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
          setIsPlayingTargetAudio(false);
          if (onEnded) onEnded();
        })
        .catch(() => {
          setIsPlayingTargetAudio(false);
          if (onEnded) onEnded();
        });
    },
    [isPaused, preferredVoiceGender, speechRate, stopSpeechRecognition]
  );

  const advanceToNextQuestion = useCallback(
    (statusForCurrent: QuestionStepStatus) => {
      stopSpeechRecognition();
      clearTimers();

      const nextStatuses = [...stepStatuses];
      if (currentIndex < nextStatuses.length) {
        nextStatuses[currentIndex] = statusForCurrent;
      }
      setStepStatuses(nextStatuses);

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
        setFailedAttempts(0);
        failedAttemptsRef.current = 0;
        setMicTimedOut(false);
        setIsWrongPronunciationState(false);
        verifiedCardLockRef.current = false;
      } else {
        const correctTotal = nextStatuses.filter((s) => s === "correct").length;
        const pct =
          questions.length > 0
            ? Math.round((correctTotal / questions.length) * 100)
            : 100;
        playFanfare(pct);
        setIsCompleted(true);
      }
    },
    [
      currentIndex,
      questions.length,
      stepStatuses,
      stopSpeechRecognition,
      clearTimers,
    ]
  );

  /**
   * Mod A (`listen_speak_matrix`): Bir kartın telaffuzu doğrulandığında veya
   * 3 başarısız deneme sonrası "Sonrakine Geç ⏭" ile geçildiğinde çağrılır.
   */
  const handleMatrixCardVerified = useCallback(
    (cardIdx: number, wasSkippedAfterFailed = false) => {
      if (!currentQuestion || verifiedCardLockRef.current) return;
      verifiedCardLockRef.current = true;
      stopSpeechRecognition();
      clearTimers();

      if (wasSkippedAfterFailed) {
        playClick();
        setHadWrongOnCurrent(true);
        setMicStatusMessage("Sonraki karta geçiliyor...");
      } else {
        streakRef.current += 1;
        playCorrect({
          isSpeech: true,
          streak: streakRef.current,
          gender: preferredVoiceGender,
        });
        setMicStatusMessage("Harika telaffuz! ✓");
      }

      setIsWrongPronunciationState(false);
      setMicTimedOut(false);
      setMatrixCompletedIndices((prev) =>
        prev.includes(cardIdx) ? prev : [...prev, cardIdx]
      );

      const totalCards = currentQuestion.options.length;
      if (cardIdx + 1 < totalCards) {
        autoAdvanceTimerRef.current = setTimeout(() => {
          verifiedCardLockRef.current = false;
          setMatrixStepIndex(cardIdx + 1);
          setSpokenTranscript("");
          setMicStatusMessage("");
          setFailedAttempts(0);
          failedAttemptsRef.current = 0;
          setMicTimedOut(false);
          setIsWrongPronunciationState(false);
        }, 650);
      } else {
        // Tüm 4 kart tamamlandı
        const allClean = !hadWrongOnCurrent && !wasSkippedAfterFailed;
        recordItemAttempt(
          currentQuestion.target.id,
          "word",
          allClean,
          false,
          allClean ? 100 : 70
        );
        if (allClean) {
          setScore((s) => s + 1);
        }
        autoAdvanceTimerRef.current = setTimeout(() => {
          verifiedCardLockRef.current = false;
          advanceToNextQuestion(allClean ? "correct" : "wrong");
        }, 750);
      }
    },
    [
      currentQuestion,
      hadWrongOnCurrent,
      preferredVoiceGender,
      stopSpeechRecognition,
      clearTimers,
      recordItemAttempt,
      advanceToNextQuestion,
    ]
  );

  /**
   * Mod A: Sıkı Harf Uyumlu (`strictArabicSpeechMatch`) ve 3 Deneme Döngülü WebSpeech STT Başlatıcı
   */
  const startMatrixListening = useCallback(
    function startMatrixListeningImpl(
      targetItem: ResimliKelime,
      cardIdx: number
    ) {
      if (isPaused || micFreeMode || verifiedCardLockRef.current) return;

      // Önceki SpeechRecognition nesnesini güvenli şekilde temizle (abort)
      stopSpeechRecognition();
      setMicTimedOut(false);

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
        setMicTimedOut(true);
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

        let resolvedAttempt = false;
        let receivedAnySpeech = false;

        const resetSilenceWatchdog = () => {
          if (micSilenceTimeoutRef.current) {
            clearTimeout(micSilenceTimeoutRef.current);
          }
          micSilenceTimeoutRef.current = setTimeout(() => {
            if (!resolvedAttempt && recognitionRef.current === rec) {
              resolvedAttempt = true;
              try {
                rec.abort();
              } catch {
                // ignore
              }
              recognitionRef.current = null;
              setIsListeningMic(false);
              setMicTimedOut(true);
              setMicStatusMessage(
                "🎙️ Ses duyulmadı, tekrar konuşmak için dokunun"
              );
            }
          }, 5000);
        };

        resetSilenceWatchdog();

        rec.onresult = (evt: unknown) => {
          if (resolvedAttempt || verifiedCardLockRef.current) return;
          const event = evt as {
            results?: {
              [index: number]: {
                isFinal?: boolean;
                length?: number;
                [altIndex: number]: { transcript?: string };
              };
              length: number;
            };
          };
          if (!event.results || event.results.length === 0) return;
          const res = event.results[event.results.length - 1];
          if (!res) return;

          const altCount = typeof res.length === "number" ? res.length : 1;
          const alternatives: string[] = [];
          for (let i = 0; i < altCount; i++) {
            const t = (res[i]?.transcript || "").trim();
            if (t) alternatives.push(t);
          }

          const primaryTranscript = alternatives[0] || "";
          if (!primaryTranscript) return;

          receivedAnySpeech = true;
          resetSilenceWatchdog();
          setSpokenTranscript(primaryTranscript);

          // Tüm alternatifler içinde en yüksek harf uyumunu kontrol et
          let bestMatch: StrictSpeechMatchResult = {
            isMatch: false,
            isExact100: false,
            similarity: 0,
          };
          let matchedTranscript = primaryTranscript;

          for (const alt of alternatives) {
            const evalRes = strictArabicSpeechMatch(targetItem.arapca, alt);
            if (
              evalRes.isMatch &&
              (!bestMatch.isMatch || evalRes.similarity > bestMatch.similarity)
            ) {
              bestMatch = evalRes;
              matchedTranscript = alt;
            } else if (
              !bestMatch.isMatch &&
              evalRes.similarity > bestMatch.similarity
            ) {
              bestMatch = evalRes;
              matchedTranscript = alt;
            }
          }

          // Interim sonuçlarda yalnızca %100 tam eşleşme sağlandığında anında onayla;
          // aksi halde konuşmanın bitmesini (res.isFinal) bekle!
          if (!res.isFinal) {
            if (bestMatch.isMatch && bestMatch.isExact100) {
              resolvedAttempt = true;
              setSpokenTranscript(matchedTranscript);
              handleMatrixCardVerified(cardIdx, false);
            }
            return;
          }

          // Konuşma tamamlandı (isFinal === true)
          resolvedAttempt = true;
          if (micSilenceTimeoutRef.current) {
            clearTimeout(micSilenceTimeoutRef.current);
            micSilenceTimeoutRef.current = null;
          }

          if (bestMatch.isMatch) {
            setSpokenTranscript(matchedTranscript);
            handleMatrixCardVerified(cardIdx, false);
            return;
          }

          // YANLIŞ TELAFFUZ:
          // 1) Deneme sayacını artır (1/3, 2/3, 3/3) ve yanlış ses efektini çal
          stopSpeechRecognition();
          streakRef.current = 0;
          const nextAttempts = failedAttemptsRef.current + 1;
          failedAttemptsRef.current = nextAttempts;
          setFailedAttempts(nextAttempts);
          setIsWrongPronunciationState(true);
          setMicTimedOut(false);
          playWrong();

          if (nextAttempts < 3) {
            setMicStatusMessage(
              `Algılanan: "${primaryTranscript}" • Tekrar dinleyin (Deneme ${nextAttempts}/3)`
            );
            // 2) 600ms sonra doğru Arapça sesi OTOMATİK OLARAK tekrar çal
            if (autoReplayTimerRef.current) {
              clearTimeout(autoReplayTimerRef.current);
            }
            autoReplayTimerRef.current = setTimeout(() => {
              if (isPaused || verifiedCardLockRef.current) return;
              playItemAudio(targetItem, "listen_speak_matrix", () => {
                // 3) Doğru sesin çalması bittikten 300ms sonra mikrofonu otomatik yeniden aç
                if (micStartDelayTimerRef.current) {
                  clearTimeout(micStartDelayTimerRef.current);
                }
                micStartDelayTimerRef.current = setTimeout(() => {
                  if (!isPaused && !micFreeMode && !verifiedCardLockRef.current) {
                    startMatrixListeningImpl(targetItem, cardIdx);
                  }
                }, 300);
              });
            }, 600);
          } else {
            // 3 Başarısız Deneme Sonrası: Doğru sesi bir kez daha dinlet ve "Sonrakine Geç ⏭" + "🎙️ Tekrar Dene" butonlarını aktif et
            setMicStatusMessage(
              `Algılanan: "${primaryTranscript}" • 3 deneme tamamlandı (Deneme 3/3)`
            );
            if (autoReplayTimerRef.current) {
              clearTimeout(autoReplayTimerRef.current);
            }
            autoReplayTimerRef.current = setTimeout(() => {
              if (isPaused || verifiedCardLockRef.current) return;
              playItemAudio(targetItem, "listen_speak_matrix");
            }, 600);
          }
        };

        rec.onerror = () => {
          if (resolvedAttempt) return;
          resolvedAttempt = true;
          if (micSilenceTimeoutRef.current) {
            clearTimeout(micSilenceTimeoutRef.current);
            micSilenceTimeoutRef.current = null;
          }
          setIsListeningMic(false);
          setMicTimedOut(true);
          setMicStatusMessage(
            "🎙️ Ses duyulmadı, tekrar konuşmak için dokunun"
          );
        };

        rec.onend = () => {
          if (micSilenceTimeoutRef.current) {
            clearTimeout(micSilenceTimeoutRef.current);
            micSilenceTimeoutRef.current = null;
          }
          setIsListeningMic(false);
          if (!resolvedAttempt && !receivedAnySpeech) {
            resolvedAttempt = true;
            setMicTimedOut(true);
            setMicStatusMessage(
              "🎙️ Ses duyulmadı, tekrar konuşmak için dokunun"
            );
          }
        };

        recognitionRef.current = rec;
        setIsListeningMic(true);
        setIsWrongPronunciationState(false);
        const attemptLabel =
          failedAttemptsRef.current > 0
            ? ` (Deneme ${Math.min(3, failedAttemptsRef.current + 1)}/3)`
            : "";
        setMicStatusMessage(
          `🎙️ Dinleniyor... Şimdi okuyun${attemptLabel}`
        );
        rec.start();
      } catch {
        setIsListeningMic(false);
        setMicTimedOut(true);
        setMicStatusMessage(
          "🎙️ Ses duyulmadı, tekrar konuşmak için dokunun"
        );
      }
    },
    [
      isPaused,
      micFreeMode,
      stopSpeechRecognition,
      handleMatrixCardVerified,
      playItemAudio,
    ]
  );

  // Soru veya Matrix adımı değiştiğinde önce hedef sesi çal, ses bittikten 300ms sonra mikrofonu başlat
  useEffect(() => {
    if (!currentQuestion || isCompleted || isPaused) return;

    if (currentQuestion.concreteMode === "listen_speak_matrix") {
      const activeCard =
        currentQuestion.options[matrixStepIndex] || currentQuestion.target;
      stopSpeechRecognition();

      const timer = setTimeout(() => {
        playItemAudio(activeCard, "listen_speak_matrix", () => {
          if (!micFreeMode && !isPaused && !verifiedCardLockRef.current) {
            if (micStartDelayTimerRef.current) {
              clearTimeout(micStartDelayTimerRef.current);
            }
            // Hedef sesin çalması tamamen bittikten 300ms sonra mikrofonu otomatik başlat
            micStartDelayTimerRef.current = setTimeout(() => {
              if (!micFreeMode && !isPaused && !verifiedCardLockRef.current) {
                startMatrixListening(activeCard, matrixStepIndex);
              }
            }, 300);
          }
        });
      }, 220);

      return () => {
        clearTimeout(timer);
        if (micStartDelayTimerRef.current) {
          clearTimeout(micStartDelayTimerRef.current);
          micStartDelayTimerRef.current = null;
        }
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
    stopSpeechRecognition,
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
      playStart();
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
      setFailedAttempts(0);
      failedAttemptsRef.current = 0;
      setMicTimedOut(false);
      setIsWrongPronunciationState(false);
      verifiedCardLockRef.current = false;
      streakRef.current = 0;
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

    // Mod A'da karta tıklanınca o kartın sesini çal, ses bitince 300ms sonra mikrofonu aç (veya mikrofonsuz moddaysa onayla)
    if (currentQuestion.concreteMode === "listen_speak_matrix") {
      const clickedIdx = currentQuestion.options.findIndex(
        (o) => o.id === option.id
      );
      if (micFreeMode && clickedIdx === matrixStepIndex) {
        playItemAudio(option, "listen_speak_matrix");
        handleMatrixCardVerified(clickedIdx, false);
        return;
      }
      playItemAudio(option, "listen_speak_matrix", () => {
        if (
          !micFreeMode &&
          !isPaused &&
          clickedIdx === matrixStepIndex &&
          !verifiedCardLockRef.current
        ) {
          if (micStartDelayTimerRef.current) {
            clearTimeout(micStartDelayTimerRef.current);
          }
          micStartDelayTimerRef.current = setTimeout(() => {
            startMatrixListening(option, clickedIdx);
          }, 300);
        }
      });
      return;
    }

    if (selectedOptionId === currentQuestion.target.id) return;
    if (wrongAttemptIds.includes(option.id)) return;

    const isCorrect = option.id === currentQuestion.target.id;

    if (isCorrect) {
      setSelectedOptionId(option.id);
      streakRef.current += 1;
      playCorrect({
        streak: streakRef.current,
        gender: preferredVoiceGender,
      });
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
      streakRef.current = 0;
      playWrong();
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
        <div
          className={`shrink-0 text-white rounded-xl px-3 py-2 border-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-sm transition-colors ${
            isWrongPronunciationState
              ? "bg-amber-950/95 border-amber-500/80"
              : "bg-[#1E293B] border-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                clearTimers();
                playItemAudio(
                  activeMatrixCard,
                  "listen_speak_matrix",
                  () => {
                    if (!micFreeMode && !isPaused) {
                      micStartDelayTimerRef.current = setTimeout(() => {
                        startMatrixListening(activeMatrixCard, matrixStepIndex);
                      }, 300);
                    }
                  }
                );
              }}
              className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
              title="Kartın Sesini Dinle"
            >
              <Volume2 size={18} />
            </button>

            <button
              type="button"
              onClick={() => {
                if (micFreeMode) {
                  handleMatrixCardVerified(matrixStepIndex, false);
                } else {
                  clearTimers();
                  stopAllAudio();
                  startMatrixListening(activeMatrixCard, matrixStepIndex);
                }
              }}
              disabled={isPlayingTargetAudio}
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                isListeningMic
                  ? "bg-emerald-500 text-white ring-4 ring-emerald-400/40 animate-pulse"
                  : isPlayingTargetAudio
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-slate-700 hover:bg-slate-600 text-emerald-300"
              }`}
              title={
                micFreeMode
                  ? "Mikrofonsuz Onayla"
                  : isPlayingTargetAudio
                  ? "Önce örnek sesi dinleyin..."
                  : "Mikrofonla Telaffuz Et"
              }
            >
              <Mic size={18} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold">
                  KART {matrixStepIndex + 1} / {currentQuestion.options.length}
                </span>
                {failedAttempts > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/25 border border-amber-400/60 text-amber-200 text-[10px] font-extrabold">
                    Deneme {Math.min(3, failedAttempts)}/3
                  </span>
                )}
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
              <p
                className={`text-[11px] truncate mt-0.5 font-semibold ${
                  isWrongPronunciationState
                    ? "text-amber-200"
                    : isListeningMic
                    ? "text-emerald-300"
                    : "text-slate-300"
                }`}
              >
                {micFreeMode
                  ? "Mikrofonsuz Mod aktif: Onaylamak için aktif karta veya 'Onayla ✓' butonuna dokunun."
                  : isPlayingTargetAudio
                  ? "🔊 Örnek telaffuz çalıyor... Ses bitince mikrofon otomatik açılacak."
                  : micStatusMessage ||
                    (spokenTranscript
                      ? `Algılanan: "${spokenTranscript}"`
                      : "🎙️ Dinleniyor... Şimdi okuyun")}
              </p>
            </div>
          </div>

          {/* Sağ Aksiyon Butonları: Mikrofonsuz Onay / Ses Duyulmadı Tekrar Konuş / 3 Deneme Sonrası Tekrar Dene & Sonrakine Geç */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {micFreeMode ? (
              <button
                type="button"
                onClick={() => handleMatrixCardVerified(matrixStepIndex, false)}
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Onayla ✓</span>
              </button>
            ) : failedAttempts >= 3 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    clearTimers();
                    stopAllAudio();
                    startMatrixListening(activeMatrixCard, matrixStepIndex);
                  }}
                  className="h-8 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  <span>🎙️ Tekrar Dene</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleMatrixCardVerified(matrixStepIndex, true)
                  }
                  className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] sm:text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  <span>Sonrakine Geç ⏭</span>
                </button>
              </>
            ) : micTimedOut && !isListeningMic && !isPlayingTargetAudio ? (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  clearTimers();
                  stopAllAudio();
                  startMatrixListening(activeMatrixCard, matrixStepIndex);
                }}
                className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer animate-pulse"
              >
                <span>🎙️ Ses duyulmadı, tekrar konuşmak için dokunun</span>
              </button>
            ) : null}
          </div>
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
              cardStyle = isWrongPronunciationState
                ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-500 ring-3 ring-amber-400/50"
                : "bg-sky-50/90 dark:bg-sky-950/40 border-sky-500 ring-3 ring-sky-400/50";
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
                        playItemAudio(option, "listen_speak_matrix", () => {
                          if (
                            !micFreeMode &&
                            !isPaused &&
                            isMatrixActive &&
                            !verifiedCardLockRef.current
                          ) {
                            micStartDelayTimerRef.current = setTimeout(() => {
                              startMatrixListening(option, idx);
                            }, 300);
                          }
                        });
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
                  clearTimers();
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
                if (next) {
                  stopSpeechRecognition();
                  clearTimers();
                }
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
