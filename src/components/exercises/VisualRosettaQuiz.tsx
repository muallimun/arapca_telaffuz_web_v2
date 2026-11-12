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
  GripVertical,
  Hand,
  ChevronLeft,
} from "lucide-react";
import { ResimliKelime, Level } from "@/types/data";
import { gorselKelimeler, resolveImageUrl } from "@/lib/data";
import { selectSmartVisualDistractors, shuffleArray } from "@/lib/quiz";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import { playDualGenderAudio, playTTS, stopAllAudio } from "@/lib/audio";
import {
  sfx,
  playClick,
  playStart,
  playCorrect,
  playFanfare,
} from "@/lib/sfxManager";
import ShareAchievementModal from "@/components/ui/ShareAchievementModal";
import { formatArabicText } from "@/lib/arabicTextUtils";
import { MixedText } from "@/components/ui/MixedText";
import {
  registerActiveMediaStream,
  stopAllActiveMediaStreams,
  startUniversalSttSession,
  matchArabicPronunciation,
  type UniversalSttController,
} from "@/lib/universalStt";

/**
 * GÖREV 4.1: Arapça metinleri ve örnek cümleleri ekrana basmadan önce
 * görünmez/bozuk karakterleri (\uFFFD, \uFEFF, \u200B-\u200D) ve cümle sonlarında
 * bozuk kare kutu (□) olarak görünebilen izole nokta/kutu karakterlerini temizler.
 */
export function sanitizeArabicDisplayText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\uFFFD\uFEFF\u200B-\u200D\u200E\u200F\u25A1\u25A0]/g, "")
    .replace(/\s*\.\s*$/g, "")
    .trim();
}

/**
 * Türkçe anlam zaten parantez içeriyorsa (örn. "Merdiven (taşınabilir)")
 * dışına tekrar parantez ekleyip "((...))" çift parantez hatası oluşturmasını önler.
 */
function cleanDoubleParens(rawTr: string): string {
  return (rawTr || "")
    .trim()
    .replace(/\(\(+/g, "(")
    .replace(/\)\)+/g, ")");
}

function formatCleanCardSubtitleTr(rawTr: string): string {
  const cleaned = cleanDoubleParens(rawTr);
  if (!cleaned) return "";
  if (cleaned.includes("(") || cleaned.includes(")")) {
    return `• ${cleaned}`;
  }
  return `(${cleaned})`;
}

export function normalizeStrictArabic(str: string): string {
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

export interface StrictSpeechMatchResult {
  isMatch: boolean;
  isExact100: boolean;
  similarity: number;
}

/**
 * Hedef Arapça ibare ile kullanıcının söylediği metni esnek harekesiz kök ve >= %72 harf uyumuna göre doğrular.
 */
export function strictArabicSpeechMatch(
  targetAr: string,
  spokenTranscript: string
): StrictSpeechMatchResult {
  const evalRes = matchArabicPronunciation(targetAr, [spokenTranscript]);
  return {
    isMatch: evalRes.isMatch,
    isExact100: evalRes.isExact100,
    similarity: evalRes.similarity,
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
  selectedMode: VisualInteractionMode,
  allowGlobalFallback = false
): VisualQuestion[] {
  if (pool.length < 4 && !allowGlobalFallback) {
    return [];
  }
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
    arabicFont,
  } = useSettings();
  const { recordItemAttempt, addMistake } = useUserStore();

  const [interactionMode, setInteractionMode] =
    useState<VisualInteractionMode>("mixed");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [revealHint, setRevealHint] = useState<boolean>(false);
  const [micFreeMode, setMicFreeMode] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [expandedScopeKey, setExpandedScopeKey] = useState<string | null>(null);

  const currentScopeKey = `${cefrFilter}::${selectedCategory}`;
  const isScopeExpanded = expandedScopeKey === currentScopeKey;

  const activePool = useMemo(() => {
    const base =
      visualPool && visualPool.length >= 4 ? visualPool : gorselKelimeler;
    if (isScopeExpanded) return base;
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
  }, [visualPool, selectedCategory, cefrFilter, isScopeExpanded]);

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
    buildVisualQuestions(
      activePool,
      questionCount,
      "mixed",
      cefrFilter === "all" && selectedCategory === "all"
    )
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

  // Etkinlik Başlangıç & "1 - 2 - 3" Mikrofon Kalibrasyon Ekranı State'leri
  const [isActivityStarted, setIsActivityStarted] = useState<boolean>(false);
  const [showCalibrationTest, setShowCalibrationTest] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return sessionStorage.getItem("visual_quiz_mic_calibrated") !== "1";
      } catch {
        return true;
      }
    }
    return true;
  });
  const [calibSteps, setCalibSteps] = useState<[boolean, boolean, boolean]>([
    false,
    false,
    false,
  ]);
  const [calibVolumePct, setCalibVolumePct] = useState<number>(0);
  const [calibWaveBars, setCalibWaveBars] = useState<number[]>([
    12, 18, 14, 22, 16, 20, 14, 18, 15, 20, 14, 12,
  ]);
  const [calibSpokenText, setCalibSpokenText] = useState<string>("");
  const [calibErrorMsg, setCalibErrorMsg] = useState<string | null>(null);
  const [calibCompleted, setCalibCompleted] = useState<boolean>(false);

  // Mod A (listen_speak_matrix) için sıralı kart, 3 deneme sayacı, 6sn geri sayım ve mikrofon durumları
  const [matrixStepIndex, setMatrixStepIndex] = useState<number>(0);
  const [matrixCompletedIndices, setMatrixCompletedIndices] = useState<
    number[]
  >([]);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [isEvaluatingStt, setIsEvaluatingStt] = useState<boolean>(false);
  const [isPlayingTargetAudio, setIsPlayingTargetAudio] =
    useState<boolean>(false);
  const [spokenTranscript, setSpokenTranscript] = useState<string>("");
  const [micStatusMessage, setMicStatusMessage] = useState<string>("");
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [micTimedOut, setMicTimedOut] = useState<boolean>(false);
  const [isWrongPronunciationState, setIsWrongPronunciationState] =
    useState<boolean>(false);
  const [micRemainingSec, setMicRemainingSec] = useState<number>(6);
  const [micRemainingPct, setMicRemainingPct] = useState<number>(100);
  const [liveMicLevel, setLiveMicLevel] = useState<number>(0);

  // GÖREV 3: Masaüstü + Mobil %100 Uyumlu Sürükle-Bırak (Drag & Drop) State'leri
  const [isDraggingCard, setIsDraggingCard] = useState<boolean>(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [touchDragPos, setTouchDragPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);

  const recognitionRef = useRef<WebSpeechRecognitionInstance | null>(null);
  const universalSttRef = useRef<UniversalSttController | null>(null);
  const calibRecognitionRef = useRef<WebSpeechRecognitionInstance | null>(null);
  const calibAudioCtxRef = useRef<AudioContext | null>(null);
  const calibStreamRef = useRef<MediaStream | null>(null);
  const calibRafRef = useRef<number | null>(null);
  const calibAutoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const activeMicAudioCtxRef = useRef<AudioContext | null>(null);
  const activeMicStreamRef = useRef<MediaStream | null>(null);
  const activeMicRafRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const hasSpokenRef = useRef<boolean>(false);

  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const micStartDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const micSilenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const micCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const speechSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const autoReplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialAudioDelayRef = useRef<number>(700);
  const failedAttemptsRef = useRef<number>(0);
  const streakRef = useRef<number>(0);
  const verifiedCardLockRef = useRef<boolean>(false);

  const currentQuestion = questions[currentIndex];

  const stopActiveMicAnalyser = useCallback(() => {
    if (activeMicRafRef.current !== null) {
      cancelAnimationFrame(activeMicRafRef.current);
      activeMicRafRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    if (scriptNodeRef.current) {
      try {
        scriptNodeRef.current.onaudioprocess = null;
        scriptNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      scriptNodeRef.current = null;
    }
    if (activeMicStreamRef.current) {
      try {
        activeMicStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      activeMicStreamRef.current = null;
    }
    if (activeMicAudioCtxRef.current) {
      try {
        activeMicAudioCtxRef.current.close();
      } catch {
        // ignore
      }
      activeMicAudioCtxRef.current = null;
    }
    stopAllActiveMediaStreams();
    setLiveMicLevel(0);
  }, []);

  const stopCalibrationResources = useCallback(() => {
    if (calibAutoStartTimerRef.current) {
      clearTimeout(calibAutoStartTimerRef.current);
      calibAutoStartTimerRef.current = null;
    }
    if (calibRafRef.current !== null) {
      cancelAnimationFrame(calibRafRef.current);
      calibRafRef.current = null;
    }
    if (calibRecognitionRef.current) {
      try {
        calibRecognitionRef.current.onresult = null;
        calibRecognitionRef.current.onerror = null;
        calibRecognitionRef.current.onend = null;
        calibRecognitionRef.current.abort();
      } catch {
        // ignore
      }
      calibRecognitionRef.current = null;
    }
    if (calibStreamRef.current) {
      try {
        calibStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      calibStreamRef.current = null;
    }
    stopAllActiveMediaStreams();
    if (calibAudioCtxRef.current) {
      try {
        calibAudioCtxRef.current.close();
      } catch {
        // ignore
      }
      calibAudioCtxRef.current = null;
    }
  }, []);

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
    if (micCountdownIntervalRef.current) {
      clearInterval(micCountdownIntervalRef.current);
      micCountdownIntervalRef.current = null;
    }
    if (speechSettleTimerRef.current) {
      clearTimeout(speechSettleTimerRef.current);
      speechSettleTimerRef.current = null;
    }
    if (autoReplayTimerRef.current) {
      clearTimeout(autoReplayTimerRef.current);
      autoReplayTimerRef.current = null;
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (universalSttRef.current) {
      const ctrl = universalSttRef.current;
      universalSttRef.current = null;
      try {
        ctrl.abort();
      } catch {
        // ignore
      }
    }
    if (micSilenceTimeoutRef.current) {
      clearTimeout(micSilenceTimeoutRef.current);
      micSilenceTimeoutRef.current = null;
    }
    if (micCountdownIntervalRef.current) {
      clearInterval(micCountdownIntervalRef.current);
      micCountdownIntervalRef.current = null;
    }
    if (speechSettleTimerRef.current) {
      clearTimeout(speechSettleTimerRef.current);
      speechSettleTimerRef.current = null;
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
    stopActiveMicAnalyser();
    setIsListeningMic(false);
  }, [stopActiveMicAnalyser]);

  // GÖREV 2: "1 - 2 - 3 Mikrofon Kalibrasyonu" Ekranının Gerçek Ses Seviyesi (RMS) İle Çalışması
  useEffect(() => {
    if (isActivityStarted || !showCalibrationTest) {
      stopCalibrationResources();
      return;
    }

    let isMounted = true;
    let stepCount = 0;
    let isCalibDone = false;
    let voiceBurstActive = false;
    let voiceBurstStartMs = 0;
    let lastBurstIncrementMs = 0;

    const markStep = (targetStep: 1 | 2 | 3) => {
      if (!isMounted || isCalibDone) return;
      if (targetStep <= stepCount) return;
      stepCount = targetStep;

      setCalibSteps([
        stepCount >= 1,
        stepCount >= 2,
        stepCount >= 3,
      ]);

      if (stepCount >= 3 && !isCalibDone) {
        isCalibDone = true;
        setCalibCompleted(true);
        playCorrect({ isSpeech: false });
        try {
          sessionStorage.setItem("visual_quiz_mic_calibrated", "1");
        } catch {
          // ignore
        }

        calibAutoStartTimerRef.current = setTimeout(() => {
          if (!isMounted) return;
          stopCalibrationResources();
          initialAudioDelayRef.current = 700;
          setShowCalibrationTest(false);
          setIsActivityStarted(true);
        }, 800);
      } else {
        playClick();
      }
    };

    // 1. Web Audio AnalyserNode + audioCtx.resume() + getByteTimeDomainData RMS Hesaplaması
    const initMicAnalyser = async () => {
      if (
        typeof window === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCalibErrorMsg(
          "Tarayıcınız mikrofon erişimini desteklemiyor. 'Testi Geç' veya 'Mikrofonsuz Mod' ile devam edebilirsiniz."
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        calibStreamRef.current = stream;
        registerActiveMediaStream(stream);
        setCalibErrorMsg(null);

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const audioCtx = new AudioCtx();
        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }
        calibAudioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);

        const timeData = new Uint8Array(analyser.fftSize);

        const tick = () => {
          if (!isMounted || !calibAudioCtxRef.current) return;
          if (audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
          }
          analyser.getByteTimeDomainData(timeData);

          // RMS (Root Mean Square) ile gerçek ses şiddetini (0-100) hesapla
          let sumSquares = 0;
          for (let i = 0; i < timeData.length; i++) {
            const norm = (timeData[i] - 128) / 128;
            sumSquares += norm * norm;
          }
          const rms = Math.sqrt(sumSquares / timeData.length);
          const pct = Math.min(100, Math.round(rms * 330));
          setCalibVolumePct(pct);

          // 12 sütunlu canlı ses dalgası
          const bars: number[] = [];
          const segmentLen = Math.floor(timeData.length / 12);
          for (let b = 0; b < 12; b++) {
            let segSum = 0;
            const startIdx = b * segmentLen;
            for (let k = 0; k < segmentLen; k++) {
              const dev = Math.abs(timeData[startIdx + k] - 128) / 128;
              segSum += dev;
            }
            const segAvg = segSum / Math.max(1, segmentLen);
            bars.push(
              Math.max(14, Math.min(100, Math.round(segAvg * 420)))
            );
          }
          setCalibWaveBars(bars);

          // Tüm masaüstü ve mobil tarayıcılarda paralel SpeechRecognition kilidi yaratmadan
          // 3 ayrı ses yükselmesini (micLevel > 16) yakalayarak [ 1 ] -> [ 2 ] -> [ 3 ] halkalarını yeşile çevir
          const now = Date.now();
          if (pct > 16) {
            if (!voiceBurstActive) {
              voiceBurstActive = true;
              voiceBurstStartMs = now;
            } else if (
              now - voiceBurstStartMs >= 95 &&
              now - lastBurstIncrementMs >= 430 &&
              stepCount < 3
            ) {
              lastBurstIncrementMs = now;
              voiceBurstStartMs = now + 200;
              const next = (stepCount + 1) as 1 | 2 | 3;
              markStep(next);
            }
          } else if (pct < 10) {
            voiceBurstActive = false;
          }

          calibRafRef.current = requestAnimationFrame(tick);
        };

        calibRafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!isMounted) return;
        setCalibErrorMsg(
          "Mikrofon izni alınamadı. Tarayıcıdan mikrofon izni verebilir veya 'Mikrofonsuz Mod' ile başlayabilirsiniz."
        );
      }
    };

    void initMicAnalyser();

    return () => {
      isMounted = false;
      stopCalibrationResources();
    };
  }, [isActivityStarted, showCalibrationTest, stopCalibrationResources]);

  const formatAr = useCallback(
    (text: string) => {
      const cleaned = sanitizeArabicDisplayText(text);
      if (!cleaned) return "";
      return formatArabicText(cleaned, showHareke, arabicFont);
    },
    [showHareke, arabicFont]
  );

  const getPhraseForMode = useCallback(
    (item: ResimliKelime, mode: ConcreteVisualMode) => {
      if (mode === "speech_bubble_match") {
        const cleanExample = sanitizeArabicDisplayText(item.ornek_ar || "");
        const cleanWord = sanitizeArabicDisplayText(item.arapca || "");
        const bubbleAr = cleanExample.length > 0 ? cleanExample : cleanWord;
        const bubbleTr =
          item.ornek_tr && item.ornek_tr.trim().length > 0
            ? item.ornek_tr.trim()
            : item.turkce;
        return { ar: bubbleAr, tr: bubbleTr };
      }
      return {
        ar: sanitizeArabicDisplayText(item.arapca),
        tr: item.turkce,
      };
    },
    []
  );

  /**
   * GÖREV 1: Mikrofon Yaşam Döngüsü ve Ses Efektleriyle Çakışmayı Önleme:
   * - Önce `sfx.stopAllSfx()` çağrılarak arkada kalan hiçbir efekt/övgü sesinin kelime sesiyle karışmaması garanti edilir.
   * - Hedef Arapça ses dosyası çalarken mikrofon (`SpeechRecognition`) kesinlikle kapatılır.
   * - `playDualGenderAudio` HTMLAudioElement `onended` olayı gerçekleştiğinde çözülür.
   */
  const playItemAudio = useCallback(
    (item: ResimliKelime, mode?: ConcreteVisualMode, onEnded?: () => void) => {
      if (isPaused) return;
      sfx.stopAllSfx();
      stopSpeechRecognition();
      setIsPlayingTargetAudio(true);

      const fallbackText = sanitizeArabicDisplayText(
        mode === "speech_bubble_match" && item.ornek_ar && !item.ses_erkek && !item.ses_kadin
          ? item.ornek_ar
          : item.arapca
      );

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

  /**
   * GÖREV 4.2: Konuşma Balonlu Eşleştirme modunda örnek cümleyi (`ornek_ar`)
   * doğrudan `/api/tts` (`playTTS`) üzerinden seslendirir.
   */
  const speakArabicSentence = useCallback(
    (sentenceAr: string) => {
      if (isPaused) return;
      const cleaned = sanitizeArabicDisplayText(sentenceAr);
      if (!cleaned) return;
      sfx.stopAllSfx();
      stopSpeechRecognition();
      stopAllAudio();
      setIsPlayingTargetAudio(true);
      playTTS(cleaned, speechRate, preferredVoiceGender)
        .then(() => {
          setIsPlayingTargetAudio(false);
        })
        .catch(() => {
          setIsPlayingTargetAudio(false);
        });
    },
    [isPaused, speechRate, preferredVoiceGender, stopSpeechRecognition]
  );

  const advanceToNextQuestion = useCallback(
    (statusForCurrent: QuestionStepStatus) => {
      sfx.stopAllSfx();
      stopSpeechRecognition();
      clearTimers();
      setIsDraggingCard(false);
      setDragOverIndex(null);
      setTouchDragPos(null);
      dragOverIndexRef.current = null;

      const nextStatuses = [...stepStatuses];
      if (currentIndex < nextStatuses.length) {
        nextStatuses[currentIndex] = statusForCurrent;
      }
      setStepStatuses(nextStatuses);

      if (currentIndex + 1 < questions.length) {
        const nextIndex = currentIndex + 1;
        initialAudioDelayRef.current = 260;
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
        setIsEvaluatingStt(false);
        setIsWrongPronunciationState(false);
        verifiedCardLockRef.current = false;
      } else {
        const correctTotal = nextStatuses.filter((s) => s === "correct").length;
        const pct =
          questions.length > 0
            ? Math.round((correctTotal / questions.length) * 100)
            : 100;
        void playFanfare(pct);
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
   * GÖREV 1.2: Mod A (`listen_speak_matrix`):
   * - Doğru cevap verildiğinde `await sfx.playCorrect(...)` tamamlanana kadar (efekt + sözlü övgü `onended`) sıradaki karta veya soruya geçilmez!
   * - Efekt ve sözlü övgü sesi tamamen bittikten **350ms sonra** sıradaki karta (`matrixStepIndex + 1`) veya soruya geçilir ve yeni kelimenin referans sesi başlatılır.
   */
  const handleMatrixCardVerified = useCallback(
    (cardIdx: number, wasSkippedAfterFailed = false) => {
      if (!currentQuestion || verifiedCardLockRef.current) return;
      verifiedCardLockRef.current = true;
      stopSpeechRecognition();
      clearTimers();
      setIsEvaluatingStt(false);
      setIsWrongPronunciationState(false);
      setMicTimedOut(false);
      setMatrixCompletedIndices((prev) =>
        prev.includes(cardIdx) ? prev : [...prev, cardIdx]
      );

      const runSequentialAdvance = async () => {
        if (wasSkippedAfterFailed) {
          playClick();
          setHadWrongOnCurrent(true);
          setMicStatusMessage("Sonraki karta geçiliyor...");
        } else {
          streakRef.current += 1;
          setMicStatusMessage("Harika telaffuz! ✓");
          await sfx.playCorrect({
            isSpeech: true,
            streak: streakRef.current,
            gender: preferredVoiceGender,
          });
        }

        const totalCards = currentQuestion.options.length;
        if (cardIdx + 1 < totalCards) {
          // Efekt ve sözlü övgü tamamen bittikten 350ms sonra sıradaki karta geç
          autoAdvanceTimerRef.current = setTimeout(() => {
            verifiedCardLockRef.current = false;
            initialAudioDelayRef.current = 50;
            setMatrixStepIndex(cardIdx + 1);
            setSpokenTranscript("");
            setMicStatusMessage("");
            setFailedAttempts(0);
            failedAttemptsRef.current = 0;
            setMicTimedOut(false);
            setIsEvaluatingStt(false);
            setIsWrongPronunciationState(false);
          }, 350);
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
          }, 350);
        }
      };

      void runSequentialAdvance();
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
   * GÖREV 1: Brave, Chrome, Safari ve Mobilde %100 Çalışan Hibrit Ses Tanıma Mimarisi
   * (`MediaRecorder` + `/api/stt` + `WebSpeech` + RMS VAD Sessizlik Algılama)
   */
  /**
   * GÖREV 1: Çakışmasız 3 Katmanlı Evrensel Ses Algılama Motoru (`startUniversalSttSession`)
   * - Katman 1: Chrome, Android, iOS Safari ve Edge'de `getUserMedia` açmadan tek başına `SpeechRecognition` (maxAlternatives=5)
   * - Katman 2: Brave, Firefox ve WebView'larda Akıllı VAD (`>15%` 200ms konuşma onayı, `1200ms` sessizlik, ilk `350ms` yankı koruması) + `/api/stt`
   * - Katman 3: Ağ/sunucu gecikmesinde tarayıcı içi `whisperWorker.ts` yedeği
   */
  const startMatrixListening = useCallback(
    function startMatrixListeningImpl(
      targetItem: ResimliKelime,
      cardIdx: number,
      echoGuardMs: number = 0
    ) {
      if (
        !isActivityStarted ||
        isPaused ||
        micFreeMode ||
        verifiedCardLockRef.current
      )
        return;

      stopSpeechRecognition();
      setMicTimedOut(false);
      setIsEvaluatingStt(false);
      setIsWrongPronunciationState(false);
      setMicRemainingSec(7);
      setMicRemainingPct(100);
      setMicStatusMessage("🎙️ Dinleniyor... (Bitirmek için dokunun)");
      hasSpokenRef.current = false;

      let resolvedAttempt = false;

      const triggerWrongAttempt = (detectedText: string) => {
        if (resolvedAttempt || verifiedCardLockRef.current) return;
        resolvedAttempt = true;
        setIsEvaluatingStt(false);
        stopSpeechRecognition();

        streakRef.current = 0;
        const nextAttempts = failedAttemptsRef.current + 1;
        failedAttemptsRef.current = nextAttempts;
        setFailedAttempts(nextAttempts);
        setIsWrongPronunciationState(true);
        setMicTimedOut(false);

        if (nextAttempts < 3) {
          setMicStatusMessage(
            `🗣️ Algılanan: "${detectedText}" • Doğru telaffuzu dinleyin (Deneme ${nextAttempts}/3)`
          );
          if (autoReplayTimerRef.current) {
            clearTimeout(autoReplayTimerRef.current);
          }
          void sfx.playWrong().then(() => {
            if (isPaused || verifiedCardLockRef.current) return;
            autoReplayTimerRef.current = setTimeout(() => {
              if (isPaused || verifiedCardLockRef.current) return;
              playItemAudio(targetItem, "listen_speak_matrix", () => {
                if (micStartDelayTimerRef.current) {
                  clearTimeout(micStartDelayTimerRef.current);
                }
                micStartDelayTimerRef.current = setTimeout(() => {
                  if (
                    !isPaused &&
                    !micFreeMode &&
                    !verifiedCardLockRef.current
                  ) {
                    startMatrixListeningImpl(targetItem, cardIdx, 0);
                  }
                }, 400);
              });
            }, 350);
          });
        } else {
          setMicStatusMessage(
            `🗣️ Algılanan: "${detectedText}" • 3 deneme tamamlandı (Deneme 3/3)`
          );
          if (autoReplayTimerRef.current) {
            clearTimeout(autoReplayTimerRef.current);
          }
          void sfx.playWrong().then(() => {
            if (isPaused || verifiedCardLockRef.current) return;
            autoReplayTimerRef.current = setTimeout(() => {
              if (isPaused || verifiedCardLockRef.current) return;
              playItemAudio(targetItem, "listen_speak_matrix");
            }, 350);
          });
        }
      };

      setIsListeningMic(true);

      universalSttRef.current = startUniversalSttSession({
        targetArabic: targetItem.arapca,
        listenWindowMs: 6500,
        echoGuardMs,
        onListeningStart: () => {
          if (resolvedAttempt || verifiedCardLockRef.current) return;
          setIsListeningMic(true);
          setIsEvaluatingStt(false);
          setMicStatusMessage("🎙️ Dinleniyor... (Bitirmek için dokunun)");
        },
        onVoiceDetected: () => {
          if (resolvedAttempt || verifiedCardLockRef.current) return;
          hasSpokenRef.current = true;
          setMicStatusMessage("🎙️ Sesiniz alınıyor... (Bitirmek için dokunun)");
        },
        onAudioLevel: (pct) => {
          if (resolvedAttempt || verifiedCardLockRef.current) return;
          setLiveMicLevel(pct);
        },
        onCountdownTick: (remSec, remPct) => {
          if (resolvedAttempt || verifiedCardLockRef.current) return;
          setMicRemainingSec(remSec);
          setMicRemainingPct(remPct);
        },
        onInterimTranscript: (primary) => {
          if (resolvedAttempt || verifiedCardLockRef.current) return;
          if (primary) {
            setSpokenTranscript(primary);
          }
        },
        onEvaluating: (statusText) => {
          if (resolvedAttempt || verifiedCardLockRef.current) return;
          setIsListeningMic(false);
          setIsEvaluatingStt(true);
          setMicStatusMessage(statusText || "⏳ Sesiniz kontrol ediliyor...");
        },
        onResult: (res) => {
          universalSttRef.current = null;
          if (resolvedAttempt || verifiedCardLockRef.current) return;

          setIsListeningMic(false);
          setIsEvaluatingStt(false);
          setLiveMicLevel(0);

          if (res.isMatch) {
            resolvedAttempt = true;
            if (res.transcript) {
              setSpokenTranscript(res.transcript);
            }
            handleMatrixCardVerified(cardIdx, false);
            return;
          }

          if (res.timedOutNoSpeech || !res.transcript.trim()) {
            resolvedAttempt = true;
            setMicTimedOut(true);
            setMicStatusMessage("🎙️ Ses algılanmadı • Tekrar Konuş'a dokunun");
            return;
          }

          setSpokenTranscript(res.transcript);
          triggerWrongAttempt(res.transcript);
        },
      });
    },
    [
      isActivityStarted,
      isPaused,
      micFreeMode,
      stopSpeechRecognition,
      handleMatrixCardVerified,
      playItemAudio,
    ]
  );

  // GÖREV 2 & GÖREV 3.1:
  // - Etkinlik başlamadan (Mikrofon Testi / Hazırlık ekranındayken) hiçbir ses otomatik çalmaz (baslangic.mp3 ile çakışmaz).
  // - Etkinlik başladığında ilk referans ses 700ms sonra tek başına ve berrak şekilde çalar.
  // - Referans sesin çalması (onended) tamamen bittikten 400ms sonra mikrofon otomatik açılır.
  useEffect(() => {
    if (
      !isActivityStarted ||
      showCalibrationTest ||
      !currentQuestion ||
      isCompleted ||
      isPaused
    )
      return;

    const startDelay = initialAudioDelayRef.current;
    initialAudioDelayRef.current = 250;

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
            // GÖREV 3.1: Hedef sesin çalması tamamen bittikten 400ms sonra mikrofonu otomatik başlat
            micStartDelayTimerRef.current = setTimeout(() => {
              if (!micFreeMode && !isPaused && !verifiedCardLockRef.current) {
                startMatrixListening(activeCard, matrixStepIndex);
              }
            }, 400);
          }
        });
      }, startDelay);

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
      }, startDelay);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [
    isActivityStarted,
    showCalibrationTest,
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
      sfx.stopAllSfx();
      stopAllAudio();
      stopSpeechRecognition();
      stopCalibrationResources();
      clearTimers();
    };
  }, [stopSpeechRecognition, stopCalibrationResources, clearTimers]);

  const restartQuiz = useCallback(
    (
      customPool?: ResimliKelime[],
      customMode?: VisualInteractionMode,
      forceGlobalFallback?: boolean
    ) => {
      sfx.stopAllSfx();
      void playStart();
      stopAllAudio();
      stopSpeechRecognition();
      clearTimers();
      setIsDraggingCard(false);
      setDragOverIndex(null);
      setTouchDragPos(null);
      dragOverIndexRef.current = null;
      // GÖREV 2: baslangic.mp3 ile ilk kelime sesinin çakışmaması için 700ms gecikme
      initialAudioDelayRef.current = 700;
      const targetPool = customPool || activePool;
      const targetMode = customMode || interactionMode;
      const allowFallback =
        forceGlobalFallback ??
        (isScopeExpanded ||
          (cefrFilter === "all" && selectedCategory === "all"));
      const built = buildVisualQuestions(
        targetPool,
        questionCount,
        targetMode,
        allowFallback
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
      isScopeExpanded,
      cefrFilter,
      selectedCategory,
      questionCount,
      stopSpeechRecognition,
      clearTimers,
    ]
  );

  const handleSelectOption = useCallback(
    (option: ResimliKelime) => {
      if (!currentQuestion || isPaused) return;

      // Mod A'da karta tıklanınca o kartın sesini çal, ses bitince 400ms sonra mikrofonu aç (veya mikrofonsuz moddaysa onayla)
      if (currentQuestion.concreteMode === "listen_speak_matrix") {
        const clickedIdx = currentQuestion.options.findIndex(
          (o) => o.id === option.id
        );
        if (micFreeMode && clickedIdx === matrixStepIndex) {
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
            }, 400);
          }
        });
        return;
      }

      if (selectedOptionId === currentQuestion.target.id) return;
      if (wrongAttemptIds.includes(option.id)) return;

      const isCorrect = option.id === currentQuestion.target.id;

      if (isCorrect) {
        setSelectedOptionId(option.id);
        setIsDraggingCard(false);
        setDragOverIndex(null);
        setTouchDragPos(null);
        dragOverIndexRef.current = null;
        streakRef.current += 1;

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
        stopAllAudio();

        // GÖREV 1: Önce doğru cevap + sözlü övgü efektinin tamamen bitmesini bekle,
        // ardından 350ms sonra kelimenin Arapça sesini çal ve tamamlanınca sonraki soruya geç!
        void sfx
          .playCorrect({
            streak: streakRef.current,
            gender: preferredVoiceGender,
          })
          .then(() => {
            if (isPaused) return;
            autoAdvanceTimerRef.current = setTimeout(() => {
              if (isPaused) return;
              playItemAudio(option, currentQuestion.concreteMode, () => {
                if (isPaused) return;
                autoAdvanceTimerRef.current = setTimeout(() => {
                  advanceToNextQuestion(
                    hadWrongOnCurrent ? "wrong" : "correct"
                  );
                }, 900);
              });
            }, 350);
          });
      } else {
        streakRef.current = 0;
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
        stopAllAudio();
        void sfx.playWrong().then(() => {
          if (isPaused) return;
          setTimeout(() => {
            if (!isPaused) {
              playItemAudio(option, currentQuestion.concreteMode);
            }
          }, 250);
        });
      }
    },
    [
      currentQuestion,
      isPaused,
      micFreeMode,
      matrixStepIndex,
      selectedOptionId,
      wrongAttemptIds,
      hadWrongOnCurrent,
      revealHint,
      preferredVoiceGender,
      handleMatrixCardVerified,
      playItemAudio,
      startMatrixListening,
      recordItemAttempt,
      clearTimers,
      advanceToNextQuestion,
      addMistake,
    ]
  );

  const handleOptionClick = useCallback(
    (idx: number) => {
      if (!currentQuestion) return;
      const opt = currentQuestion.options[idx];
      if (opt) {
        handleSelectOption(opt);
      }
    },
    [currentQuestion, handleSelectOption]
  );

  // Mobil Dokunmatik Sürükle-Bırak (Touch Drag & Drop) Olay Yöneticileri
  const handleTargetTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (selectedOptionId !== null || isPaused) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest("button")) return;
    const touch = e.touches[0];
    if (!touch) return;
    setIsDraggingCard(true);
    setTouchDragPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTargetTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingCard || selectedOptionId !== null) return;
    const touch = e.touches[0];
    if (!touch) return;
    setTouchDragPos({ x: touch.clientX, y: touch.clientY });

    if (typeof document !== "undefined") {
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const cardNode = elem?.closest("[data-option-index]");
      const attr = cardNode?.getAttribute("data-option-index");
      const parsed =
        attr !== null && attr !== undefined ? parseInt(attr, 10) : null;
      const validIdx =
        parsed !== null && !Number.isNaN(parsed) ? parsed : null;
      if (dragOverIndexRef.current !== validIdx) {
        dragOverIndexRef.current = validIdx;
        setDragOverIndex(validIdx);
      }
    }
  };

  const handleTargetTouchEnd = () => {
    if (!isDraggingCard) return;
    const dropIdx = dragOverIndexRef.current;
    setIsDraggingCard(false);
    setTouchDragPos(null);
    setDragOverIndex(null);
    dragOverIndexRef.current = null;
    if (dropIdx !== null && selectedOptionId === null) {
      handleOptionClick(dropIdx);
    }
  };

  if (!currentQuestion) {
    return (
      <div className="p-6 text-center bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] max-w-lg mx-auto space-y-3">
        <p className="text-sm font-extrabold text-[var(--foreground)]">
          Bu filtrede yeterli görsel öğe bulunamadı (en az 4 görsel gerekir).
        </p>
        <p className="text-xs font-semibold text-[var(--muted)]">
          Farklı seviyelerdeki görselleri gizlice karıştırmak yerine kapsamı tek tıkla genişletebilirsiniz.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {!isScopeExpanded && (
            <button
              type="button"
              onClick={() => {
                playClick();
                const fullBase =
                  visualPool && visualPool.length >= 4
                    ? visualPool
                    : gorselKelimeler;
                setExpandedScopeKey(currentScopeKey);
                restartQuiz(fullBase, interactionMode, true);
              }}
              className="px-4 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold cursor-pointer"
            >
              🔓 Kapsamı Genişlet (Tüm Görseller)
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold cursor-pointer"
            >
              Ayarlara Dön
            </button>
          )}
        </div>
      </div>
    );
  }

  // GÖREV 1: Sesli Etkinlik Öncesi "1 - 2 - 3 Mikrofon Testi & Hazırlık" Ekranı (Zero-Scroll)
  if (!isActivityStarted || showCalibrationTest) {
    const startWithMicNow = () => {
      playClick();
      stopCalibrationResources();
      setMicFreeMode(false);
      initialAudioDelayRef.current = 700;
      setShowCalibrationTest(false);
      setIsActivityStarted(true);
    };

    const startMicFreeNow = () => {
      playClick();
      stopCalibrationResources();
      setMicFreeMode(true);
      initialAudioDelayRef.current = 700;
      setShowCalibrationTest(false);
      setIsActivityStarted(true);
    };

    const reopenOneTwoThreeTest = () => {
      playClick();
      setCalibSteps([false, false, false]);
      setCalibCompleted(false);
      setCalibSpokenText("");
      setShowCalibrationTest(true);
    };

    return (
      <div className="min-h-[calc(100dvh-148px)] sm:h-[calc(100dvh-115px)] sm:max-h-[calc(100dvh-115px)] flex flex-col items-center justify-center overflow-y-auto sm:overflow-hidden p-3 sm:p-5 bg-[#F7EFE1]/70 dark:bg-[var(--surface)]/60 rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)]">
        <div className="w-full max-w-lg bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 shadow-md space-y-3.5 text-center">
          {showCalibrationTest ? (
            <>
              {/* Başlık */}
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[#087F5B] dark:text-emerald-300 text-xs font-extrabold">
                  <Mic size={14} />
                  <span>Mikrofon &amp; Ses Kalibrasyonu (1 - 2 - 3 Testi)</span>
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-[var(--foreground)]">
                  Mikrofonunuzu doğrulamak için mikrofona{" "}
                  <span className="text-[#6741D9] dark:text-purple-300">
                    1, 2, 3
                  </span>{" "}
                  (veya{" "}
                  <span lang="ar" dir="rtl" className="arabic font-bold text-[#087F5B]">
                    واحد، اثنان، ثلاثة
                  </span>
                  ) deyin
                </h2>
              </div>

              {/* 1 - 2 - 3 Dairesel Rozetleri */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 py-1">
                {[1, 2, 3].map((num, idx) => {
                  const done = calibSteps[idx];
                  const isNext =
                    !done && (idx === 0 || calibSteps[idx - 1] === true);
                  return (
                    <div
                      key={num}
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-3 flex items-center justify-center text-xl sm:text-2xl font-extrabold transition-all duration-300 shadow-xs ${
                          done
                            ? "bg-emerald-600 border-emerald-700 text-white scale-105 ring-4 ring-emerald-400/30"
                            : isNext
                            ? "bg-white dark:bg-[var(--background)] border-[#6741D9] text-[#6741D9] dark:text-purple-300 ring-4 ring-purple-400/20 animate-pulse"
                            : "bg-white/70 dark:bg-[var(--background)]/60 border-[#E6D7BE] text-[var(--muted)]"
                        }`}
                      >
                        {done ? <Check size={28} strokeWidth={3} /> : num}
                      </div>
                      <span
                        className={`text-[11px] font-extrabold ${
                          done
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {num === 1
                          ? "1 • واحد"
                          : num === 2
                          ? "2 • اثنان"
                          : "3 • ثلاثة"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Canlı Ses Seviyesi Göstergesi (Web Audio AnalyserNode) */}
              <div className="bg-[#1E293B] text-white rounded-2xl p-3 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <Mic size={14} className="animate-pulse" />
                    <span>Canlı Mikrofon Ses Seviyesi</span>
                  </span>
                  <span className="tabular-nums text-slate-300">
                    %{calibVolumePct}
                  </span>
                </div>

                {/* Canlı Yeşil Ses Barı */}
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75"
                    style={{ width: `${Math.max(4, calibVolumePct)}%` }}
                  />
                </div>

                {/* Canlı 12-Sütunlu Ses Dalgası */}
                <div className="h-7 flex items-end justify-center gap-1.5 pt-1">
                  {calibWaveBars.map((barVal, i) => (
                    <span
                      key={i}
                      className={`w-2 rounded-full transition-all duration-75 ${
                        calibVolumePct > 15
                          ? "bg-emerald-400"
                          : "bg-slate-600"
                      }`}
                      style={{
                        height: `${Math.max(20, barVal)}%`,
                      }}
                    />
                  ))}
                </div>

                {calibCompleted ? (
                  <p className="text-xs sm:text-sm font-extrabold text-emerald-300 pt-0.5">
                    ✅ Mikrofon Hazır! Etkinlik başlatılıyor...
                  </p>
                ) : calibSpokenText ? (
                  <p className="text-[11px] text-slate-300 truncate">
                    Algılanan: &ldquo;{calibSpokenText}&rdquo;
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-300">
                    Sesiniz algılandığında yukarıdaki yeşil bar hareket eder ve{" "}
                    <strong>[1] - [2] - [3]</strong> halkaları yeşile döner.
                  </p>
                )}
              </div>

              {calibErrorMsg && (
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5">
                  {calibErrorMsg}
                </p>
              )}

              {/* Kullanıcı Kontrolü ve Alternatif Seçenekler */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={startWithMicNow}
                  className="h-10 px-4 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-xs sm:text-sm border-b-3 border-[#065F46] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play size={15} />
                  <span>
                    {calibCompleted
                      ? "Etkinliği Başlat"
                      : "Testi Geç, Hemen Başla"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={startMicFreeNow}
                  className="h-10 px-4 rounded-xl bg-white dark:bg-[var(--background)] hover:border-[#6741D9] border-2 border-[#E6D7BE] text-[var(--foreground)] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MicOff size={15} className="text-amber-600" />
                  <span>Mikrofonsuz Modda Başlat (Sadece Dinle &amp; Seç)</span>
                </button>
              </div>
            </>
          ) : (
            /* Oturumda Kalibrasyon Zaten Tamamlanmışsa Kompakt "Hazırım, Sesi Dinle & Başla" Kartı */
            <>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[#087F5B] dark:text-emerald-300 text-xs font-extrabold">
                  <Check size={14} />
                  <span>Mikrofon Bu Oturumda Doğrulandı</span>
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold text-[var(--foreground)]">
                  Görsel &amp; Sesli Eşleştirmeye Hazır mısınız?
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
                  Başlat butonuna tıkladığınızda ilk kelimenin Arapça telaffuzu net şekilde çalacak ve ardından mikrofonunuz 6 saniye boyunca sizi dinleyecektir.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={startWithMicNow}
                  className="h-11 px-5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm border-b-3 border-[#065F46] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play size={16} />
                  <span>Hazırım, Sesi Dinle &amp; Başla</span>
                </button>

                <button
                  type="button"
                  onClick={reopenOneTwoThreeTest}
                  className="h-11 px-4 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] hover:border-[#6741D9] text-[var(--foreground)] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Mic size={15} className="text-[#6741D9]" />
                  <span>Mikrofonu Test Et (1-2-3)</span>
                </button>
              </div>

              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={startMicFreeNow}
                  className="text-xs font-extrabold text-[var(--muted)] hover:text-[var(--foreground)] underline cursor-pointer inline-flex items-center gap-1"
                >
                  <MicOff size={13} />
                  <span>Mikrofonsuz Modda Başlat (Sadece Dinle &amp; Seç)</span>
                </button>
              </div>
            </>
          )}
        </div>
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

  // GÖREV 4.2: Konuşma balonlu modda öğenin kendine ait ayrı bir örnek cümlesi var mı?
  const cleanTargetWordAr = sanitizeArabicDisplayText(
    currentQuestion.target.arapca || ""
  );
  const cleanTargetExampleAr = sanitizeArabicDisplayText(
    currentQuestion.target.ornek_ar || ""
  );
  const hasDistinctExampleSentence =
    cleanTargetExampleAr.length > 0 &&
    cleanTargetExampleAr !== cleanTargetWordAr;

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
    <div className="min-h-[calc(100dvh-146px)] sm:min-h-[calc(100dvh-115px)] flex flex-col justify-between overflow-y-auto p-1.5 sm:p-3.5 bg-[#F7EFE1]/60 dark:bg-[var(--surface)]/50 rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] gap-1.5 sm:gap-2">
      {/* Mobil dokunmatik sürükleme sırasında parmak altında yüzen ibare etiketi */}
      {touchDragPos && isDraggingCard && selectedOptionId === null && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full px-3.5 py-1.5 rounded-xl bg-[#6741D9] text-white border-2 border-white shadow-xl flex items-center gap-2"
          style={{
            left: `${touchDragPos.x}px`,
            top: `${Math.max(40, touchDragPos.y - 14)}px`,
          }}
        >
          <GripVertical size={14} className="text-purple-200" />
          <span
            lang="ar"
            dir="rtl"
            className="arabic text-lg font-bold leading-none"
          >
            {formatAr(targetPhrase.ar)}
          </span>
        </div>
      )}

      {/* 1. ÜST KONTROL VE 4 ETKİLEŞİM MODU SEÇİCİ ÇUBUĞU (Mobilde Tek Satır Kaydırılabilir) */}
      <div className="shrink-0 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] px-2 py-1 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 shrink-0">
          {onClose && (
            <button
              type="button"
              onClick={() => {
                playClick();
                sfx.stopAllSfx();
                stopAllAudio();
                stopSpeechRecognition();
                clearTimers();
                onClose();
              }}
              className="sm:hidden h-7 px-2 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[11px] font-extrabold text-[var(--foreground)] flex items-center gap-0.5 shrink-0 cursor-pointer"
              title="Alıştırma Ayarlarına Dön"
            >
              <ChevronLeft size={13} />
              <span>Çık</span>
            </button>
          )}
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

        {/* Sağ Kontroller: Yalnızca Mikrofonlu Modda "Mikrofonu Test Et" + Erkek/Kadın Ses + Kategori */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {!isScopeExpanded &&
            questions.length < questionCount &&
            (cefrFilter !== "all" || selectedCategory !== "all") && (
              <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-[10px] font-extrabold text-amber-800 dark:text-amber-200">
                ℹ️ {questions.length} görsel
              </span>
            )}
          {activeConcreteMode === "listen_speak_matrix" && (
            <button
              type="button"
              onClick={() => {
                playClick();
                sfx.stopAllSfx();
                stopAllAudio();
                stopSpeechRecognition();
                clearTimers();
                setCalibSteps([false, false, false]);
                setCalibCompleted(false);
                setCalibSpokenText("");
                setShowCalibrationTest(true);
              }}
              className="h-7 px-2 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#087F5B] text-[11px] font-extrabold text-[#087F5B] dark:text-emerald-400 flex items-center gap-1 cursor-pointer shrink-0"
              title="1 - 2 - 3 Mikrofon Kalibrasyon Testini Aç"
            >
              <Mic size={12} />
              <span className="hidden sm:inline">Mikrofonu Test Et</span>
              <span className="sm:hidden">Test</span>
            </button>
          )}

          <div className="inline-flex items-center rounded-lg bg-white dark:bg-[var(--background)] p-0.5 border border-[#E6D7BE]">
            <button
              type="button"
              onClick={() => {
                playClick();
                setPreferredVoiceGender("erkek");
              }}
              className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
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
              className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
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
        /* GÖREV 4: Koyu Lacivert/Antrasit Aktif Konuşma Çubuğu — Sıkışmasız & Tek Dokunuşla Bitirme Destekli */
        <div
          className={`shrink-0 text-white rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 border-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-sm transition-colors ${
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
                        startMatrixListening(activeMatrixCard, matrixStepIndex, 0);
                      }, 400);
                    }
                  }
                );
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
              title="Kartın Sesini Dinle"
            >
              <Volume2 size={17} />
            </button>

            <button
              type="button"
              onClick={() => {
                if (micFreeMode) {
                  handleMatrixCardVerified(matrixStepIndex, false);
                } else if (isListeningMic && universalSttRef.current) {
                  playClick();
                  universalSttRef.current.stopManual();
                } else {
                  clearTimers();
                  stopAllAudio();
                  startMatrixListening(activeMatrixCard, matrixStepIndex, 400);
                }
              }}
              disabled={isPlayingTargetAudio || isEvaluatingStt}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                isListeningMic
                  ? "bg-emerald-500 text-white ring-4 ring-emerald-400/40 animate-pulse"
                  : isPlayingTargetAudio || isEvaluatingStt
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-slate-700 hover:bg-slate-600 text-emerald-300"
              }`}
              title={
                micFreeMode
                  ? "Mikrofonsuz Onayla"
                  : isListeningMic
                  ? "Konuşmayı Bitir ve Değerlendir"
                  : isPlayingTargetAudio
                  ? "Önce örnek sesi dinleyin..."
                  : "Mikrofonla Telaffuz Et"
              }
            >
              <Mic size={17} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold shrink-0">
                  KART {matrixStepIndex + 1}/{currentQuestion.options.length}
                </span>
                {failedAttempts > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/25 border border-amber-400/60 text-amber-200 text-[10px] font-extrabold shrink-0">
                    Deneme {Math.min(3, failedAttempts)}/3
                  </span>
                )}
                <span
                  lang="ar"
                  dir="rtl"
                  className="arabic text-lg sm:text-2xl font-bold text-white leading-none"
                >
                  {formatAr(activeMatrixCard.arapca)}
                </span>
                <span
                  dir="ltr"
                  lang="tr"
                  className="font-sans text-[11px] sm:text-xs text-slate-300 font-semibold leading-tight"
                >
                  <MixedText
                    text={formatCleanCardSubtitleTr(activeMatrixCard.turkce)}
                  />
                </span>
              </div>

              {/* Alt Durum Satırı + Geri Sayım ve Canlı Mikrofon Ses Dalgası */}
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p
                  className={`text-[11px] truncate font-semibold ${
                    isWrongPronunciationState
                      ? "text-amber-200"
                      : isEvaluatingStt
                      ? "text-sky-300"
                      : isListeningMic
                      ? "text-emerald-300"
                      : micTimedOut
                      ? "text-amber-300"
                      : "text-slate-300"
                  }`}
                >
                  {micFreeMode
                    ? "Mikrofonsuz Mod: Onaylamak için 'Onayla ✓' butonuna dokunun."
                    : isPlayingTargetAudio
                    ? "🔊 Örnek ses çalıyor..."
                    : isEvaluatingStt
                    ? "⏳ Sesiniz kontrol ediliyor..."
                    : isListeningMic
                    ? `${
                        micStatusMessage ||
                        `🎙️ Dinleniyor (${micRemainingSec}s)...`
                      }${spokenTranscript ? ` "${spokenTranscript}"` : ""}`
                    : micStatusMessage ||
                      (spokenTranscript
                        ? `Algılanan: "${spokenTranscript}"`
                        : "🎙️ Ses algılanmadı")}
                </p>

                {isListeningMic && !micFreeMode && (
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <div className="flex items-end gap-0.5 h-3">
                      {[0.6, 1.0, 0.8, 1.15, 0.7].map((mult, idx) => {
                        const barH = Math.max(
                          25,
                          Math.min(100, Math.round(liveMicLevel * mult))
                        );
                        return (
                          <span
                            key={idx}
                            className="w-1 rounded-full bg-emerald-400 transition-all duration-75"
                            style={{ height: `${barH}%` }}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-300 tabular-nums">
                      %{liveMicLevel}
                    </span>
                    <div className="hidden sm:block w-16 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-100"
                        style={{ width: `${micRemainingPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sağ Aksiyon Butonu ("Onayla ✓" | "🎙️ Dinleniyor... (Bitirmek için dokunun)" | "🎙️ Tekrar Konuş" | "Sonrakine Geç ⏭") */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0 ml-auto">
            {micFreeMode ? (
              <button
                type="button"
                onClick={() => handleMatrixCardVerified(matrixStepIndex, false)}
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] sm:text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Onayla ✓</span>
              </button>
            ) : isListeningMic && !isEvaluatingStt ? (
              <button
                type="button"
                onClick={() => {
                  if (universalSttRef.current) {
                    playClick();
                    universalSttRef.current.stopManual();
                  }
                }}
                className="h-7 sm:h-8 px-2.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] sm:text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                title="Konuşmayı bitirip hemen değerlendirmek için dokunun"
              >
                <span>🎙️ Bitirmek için dokunun</span>
              </button>
            ) : failedAttempts >= 3 && !isEvaluatingStt ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    clearTimers();
                    stopAllAudio();
                    startMatrixListening(activeMatrixCard, matrixStepIndex, 400);
                  }}
                  className="h-7 sm:h-8 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  <span>🎙️ Tekrar Konuş</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleMatrixCardVerified(matrixStepIndex, true)
                  }
                  className="h-7 sm:h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] sm:text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  <span>Sonrakine Geç ⏭</span>
                </button>
              </>
            ) : (micTimedOut || !isListeningMic) &&
              !isPlayingTargetAudio &&
              !isEvaluatingStt ? (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  clearTimers();
                  stopAllAudio();
                  startMatrixListening(activeMatrixCard, matrixStepIndex, 400);
                }}
                className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
              >
                <span>🎙️ Tekrar Konuş</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : activeConcreteMode === "match_header_to_card" ? (
        /* MOD B: Üst-Ortada Sürüklenebilir Sesli Hedef İbare Kartı (🧩 İbareyi Görsele Yerleştir) */
        <div className="shrink-0 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-xl px-3 py-1.5 border-2 border-[#6741D9] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#6741D9]/15 text-[#6741D9] dark:text-purple-300 text-[11px] font-extrabold shrink-0">
              <Puzzle size={13} />
              <span>İbareyi Görsele Yerleştir</span>
            </span>
            <span className="text-[11px] font-semibold text-[var(--muted)] hidden md:inline truncate">
              Arapça kartı doğru görselin yuvasına sürükleyin veya görsele tıklayın:
            </span>
          </div>

          {/* GÖREV 3: Sürüklenebilir Hedef İbare Kartı (Draggable Chip — Masaüstü + Mobil Dokunmatik) */}
          <div
            draggable={selectedOptionId === null}
            onDragStart={(e) => {
              if (selectedOptionId !== null) {
                e.preventDefault();
                return;
              }
              setIsDraggingCard(true);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", currentQuestion.target.id);
            }}
            onDragEnd={() => {
              setIsDraggingCard(false);
              setDragOverIndex(null);
              dragOverIndexRef.current = null;
            }}
            onTouchStart={handleTargetTouchStart}
            onTouchMove={handleTargetTouchMove}
            onTouchEnd={handleTargetTouchEnd}
            onTouchCancel={handleTargetTouchEnd}
            className={`flex items-center gap-2 bg-white dark:bg-[var(--background)] px-3 py-1 rounded-xl border-2 shadow-2xs transition-all select-none touch-none ${
              selectedOptionId === null
                ? "cursor-grab active:cursor-grabbing border-[#6741D9] hover:ring-2 hover:ring-[#6741D9]/30"
                : "border-emerald-600 bg-emerald-50/50"
            } ${isDraggingCard ? "opacity-80 scale-95 ring-2 ring-indigo-400" : ""}`}
            title="Bu ibareyi doğru görselin üst yuvasına sürükleyin"
          >
            <GripVertical
              size={16}
              className="text-[#6741D9] dark:text-purple-300 shrink-0"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playItemAudio(currentQuestion.target, activeConcreteMode);
              }}
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
            {(revealHint || selectedOptionId !== null) && (
              <span className="text-xs font-extrabold text-[#087F5B] dark:text-emerald-400 border-l border-[#E6D7BE] pl-2">
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
        /* MOD C: Konuşma Balonlu Eşleştirme Başlığı — Sürüklenebilir & Kelime + Örnek Cümle Çift Sesli */
        <div className="shrink-0 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-xl px-3 py-1.5 border-2 border-[#087F5B] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
          {/* GÖREV 3 & GÖREV 4: Sürüklenebilir Hedef Kart + Kelime Seslendirme + Örnek Cümle Seslendirme */}
          <div
            draggable={selectedOptionId === null}
            onDragStart={(e) => {
              if (selectedOptionId !== null) {
                e.preventDefault();
                return;
              }
              setIsDraggingCard(true);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", currentQuestion.target.id);
            }}
            onDragEnd={() => {
              setIsDraggingCard(false);
              setDragOverIndex(null);
              dragOverIndexRef.current = null;
            }}
            onTouchStart={handleTargetTouchStart}
            onTouchMove={handleTargetTouchMove}
            onTouchEnd={handleTargetTouchEnd}
            onTouchCancel={handleTargetTouchEnd}
            className={`flex items-center gap-2 min-w-0 flex-1 bg-white dark:bg-[var(--background)] px-2.5 py-1.5 rounded-xl border-2 transition-all select-none touch-none ${
              selectedOptionId === null
                ? "cursor-grab active:cursor-grabbing border-[#087F5B] hover:ring-2 hover:ring-[#087F5B]/30"
                : "border-emerald-600 bg-emerald-50/50"
            } ${isDraggingCard ? "opacity-80 scale-[0.99] ring-2 ring-indigo-400" : ""}`}
            title="Bu ifadeyi doğru görselin konuşma balonuna sürükleyin"
          >
            <GripVertical
              size={16}
              className="text-[#087F5B] dark:text-emerald-400 shrink-0"
            />

            {hasDistinctExampleSentence ? (
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                {/* Üst Satır: Vurgulu Hedef Kelime + 🔊 Kelime Butonu */}
                <div className="flex items-center flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700">
                    <span
                      lang="ar"
                      dir="rtl"
                      className="arabic text-base sm:text-xl font-bold text-emerald-950 dark:text-emerald-200 leading-none"
                    >
                      {formatAr(currentQuestion.target.arapca)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playItemAudio(
                        currentQuestion.target,
                        "match_header_to_card"
                      );
                    }}
                    className="h-6 px-2 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                    title="Hedef Kelimeyi Dinle"
                  >
                    <Volume2 size={12} />
                    <span>Kelime</span>
                  </button>

                  {(revealHint || selectedOptionId !== null) && (
                    <span className="text-xs font-extrabold text-[#087F5B] dark:text-emerald-400 truncate">
                      — {currentQuestion.target.turkce}
                    </span>
                  )}
                </div>

                {/* Alt Satır: Örnek Cümle + 🔊 Cümleyi Oku Butonu */}
                <div className="flex items-center flex-wrap gap-2">
                  <MessageSquare
                    size={13}
                    className="text-[#6741D9] dark:text-purple-300 shrink-0"
                  />
                  <span
                    lang="ar"
                    dir="rtl"
                    className="arabic text-sm sm:text-lg font-bold text-[var(--foreground)] leading-snug"
                  >
                    {formatAr(cleanTargetExampleAr)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakArabicSentence(cleanTargetExampleAr);
                    }}
                    className="h-6 px-2 rounded-lg bg-[#6741D9] hover:bg-[#5230B5] text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                    title="Örnek Cümlenin Tamamını Dinle"
                  >
                    <Volume2 size={12} />
                    <span>Cümleyi Oku</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playItemAudio(
                      currentQuestion.target,
                      "speech_bubble_match"
                    );
                  }}
                  className="w-8 h-8 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white flex items-center justify-center shrink-0 cursor-pointer"
                  title="İfadeyi Dinle"
                >
                  <Volume2 size={16} />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <MessageSquare
                      size={13}
                      className="text-[#087F5B] shrink-0"
                    />
                    <span
                      lang="ar"
                      dir="rtl"
                      className="arabic text-base sm:text-xl font-bold text-[var(--foreground)] leading-tight"
                    >
                      {formatAr(targetPhrase.ar)}
                    </span>
                  </div>
                  {revealHint || selectedOptionId !== null ? (
                    <p className="text-[11px] font-bold text-[#087F5B] dark:text-emerald-400 truncate">
                      {targetPhrase.tr}
                    </p>
                  ) : (
                    <p className="text-[10px] font-semibold text-[var(--muted)] truncate">
                      Bu ifadeyi doğru sahnenin konuşma balonuna sürükleyin veya tıklayın
                    </p>
                  )}
                </div>
              </div>
            )}
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
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  lang="ar"
                  dir="rtl"
                  className="arabic text-lg sm:text-2xl font-bold text-[var(--foreground)] leading-none"
                >
                  {formatAr(currentQuestion.target.arapca)}
                </span>
                {/* GÖREV 2: Cevap verildiğinde veya ipucu açıldığında hedef Arapça kelimenin yanında Türkçe anlamı açılır */}
                {(revealHint || selectedOptionId !== null) && (
                  <span className="text-xs sm:text-sm font-extrabold text-[#087F5B] dark:text-emerald-400">
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
                sfx.stopAllSfx();
                playTTS(
                  sanitizeArabicDisplayText(currentQuestion.target.arapca),
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

      {/* 3. MERKEZ 2x2 / 1x4 KARE GÖRSEL KART IZGARASI (KIRPILMAMIŞ 1:1 OBJECT-CONTAIN & ESNEK MOBİL KAYDIRMA) */}
      <div className="flex-1 min-h-0 flex items-stretch justify-center py-0.5">
        <div
          className={`w-full grid grid-cols-2 ${
            activeConcreteMode === "match_header_to_card"
              ? "lg:grid-cols-4"
              : "sm:grid-cols-2 lg:grid-cols-4"
          } gap-1.5 sm:gap-2.5 items-stretch`}
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
            const isDragHovered =
              dragOverIndex === idx && selectedOptionId === null;
            const isDraggableMode =
              activeConcreteMode === "match_header_to_card" ||
              activeConcreteMode === "speech_bubble_match";

            // GÖREV 2: Soru cevaplandığında (selectedOptionId !== null) tüm 4 kartta veya tamamlanan/denenen kartta Arapça + Türkçe göster
            const showRichCardDetails =
              selectedOptionId !== null ||
              isQuestionSolved ||
              isSelectedCorrect ||
              isWrongAttempt ||
              isMatrixDone;

            let cardStyle =
              "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9]";
            if (isSelectedCorrect || isMatrixDone) {
              cardStyle =
                "bg-emerald-50/90 dark:bg-emerald-950/40 border-[#087F5B] ring-3 ring-[#087F5B]/40";
            } else if (isDragHovered) {
              cardStyle =
                "border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/60 scale-[1.02] ring-2 ring-indigo-300";
            } else if (isMatrixActive) {
              cardStyle = isWrongPronunciationState
                ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-500 ring-3 ring-amber-400/50"
                : "bg-sky-50/90 dark:bg-sky-950/40 border-sky-500 ring-3 ring-sky-400/50";
            } else if (isWrongAttempt) {
              cardStyle =
                "bg-rose-50/80 dark:bg-rose-950/30 border-rose-400 opacity-75";
            }

            const optionBubblePhrase = getPhraseForMode(
              option,
              "speech_bubble_match"
            );

            return (
              <div
                key={`${option.id}_${idx}`}
                data-option-index={idx}
                onClick={() => handleSelectOption(option)}
                onDragOver={(e) => {
                  if (!isDraggableMode || selectedOptionId !== null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverIndexRef.current !== idx) {
                    dragOverIndexRef.current = idx;
                    setDragOverIndex(idx);
                  }
                }}
                onDragLeave={(e) => {
                  if (!isDraggableMode) return;
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (dragOverIndexRef.current === idx) {
                      dragOverIndexRef.current = null;
                    }
                    setDragOverIndex((prev) => (prev === idx ? null : prev));
                  }
                }}
                onDrop={(e) => {
                  if (!isDraggableMode || selectedOptionId !== null) return;
                  e.preventDefault();
                  setIsDraggingCard(false);
                  setDragOverIndex(null);
                  dragOverIndexRef.current = null;
                  handleOptionClick(idx);
                }}
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
                            }, 400);
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
                      className="arabic text-base sm:text-xl font-bold leading-snug truncate"
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
                    className={`shrink-0 rounded-lg sm:rounded-xl px-1.5 sm:px-2 py-0.5 sm:py-1 mb-1 min-h-[26px] sm:min-h-[34px] flex items-center justify-center border-2 transition-all ${
                      isSelectedCorrect
                        ? "bg-[#087F5B] border-[#065F46] text-white shadow-xs"
                        : isWrongAttempt
                        ? "bg-rose-100 dark:bg-rose-950/60 border-rose-400 text-rose-800 dark:text-rose-200"
                        : isDragHovered
                        ? "border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-200 scale-[1.03] ring-2 ring-indigo-300"
                        : isDraggingCard
                        ? "border-indigo-400 border-dashed bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                        : "bg-[#F7EFE1]/60 dark:bg-[var(--background)]/60 border-dashed border-[#cbb692] text-[var(--muted)]"
                    }`}
                  >
                    {isSelectedCorrect ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <Check size={13} strokeWidth={3} className="shrink-0" />
                        <span
                          lang="ar"
                          dir="rtl"
                          className="arabic text-base sm:text-xl font-bold leading-snug truncate"
                        >
                          {formatAr(targetPhrase.ar)}
                        </span>
                      </div>
                    ) : isWrongAttempt ? (
                      <span
                        lang="ar"
                        dir="rtl"
                        className="arabic text-sm sm:text-base font-bold leading-snug truncate"
                      >
                        {formatAr(option.arapca)}
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] font-bold truncate">
                        {isDragHovered
                          ? "✨ Bırakın!"
                          : `Yerleştir (${idx + 1})`}
                      </span>
                    )}
                  </div>
                )}

                {activeConcreteMode === "speech_bubble_match" && (
                  /* MOD C: Görselin Üstünde Üçgen İşaretçili Beyaz Konuşma Balonu */
                  <div className="shrink-0 relative mb-1.5 sm:mb-2">
                    <div
                      className={`rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-0.5 sm:py-1 min-h-[26px] sm:min-h-[34px] flex items-center justify-center border-2 shadow-2xs transition-all ${
                        isSelectedCorrect
                          ? "bg-emerald-600 border-emerald-700 text-white"
                          : isWrongAttempt
                          ? "bg-rose-50 border-rose-300 text-rose-800"
                          : isDragHovered
                          ? "border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-200 scale-[1.03] ring-2 ring-indigo-300"
                          : isDraggingCard
                          ? "border-indigo-400 border-dashed bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                          : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {isSelectedCorrect ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <Check size={13} strokeWidth={3} className="shrink-0" />
                          <span
                            lang="ar"
                            dir="rtl"
                            className="arabic text-xs sm:text-base font-bold leading-tight truncate"
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
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-300 truncate">
                          {isDragHovered
                            ? "💬 Balona bırakın!"
                            : "💬 Balona yerleştir"}
                        </span>
                      )}
                    </div>
                    {/* Balonun aşağı bakan üçgen oku */}
                    <div
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rotate-45 border-r-2 border-b-2 mx-auto -mt-1 sm:-mt-1.5 ${
                        isSelectedCorrect
                          ? "bg-emerald-600 border-emerald-700"
                          : isWrongAttempt
                          ? "bg-rose-50 border-rose-300"
                          : isDragHovered
                          ? "bg-indigo-50 border-indigo-500"
                          : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      }`}
                    />
                  </div>
                )}

                {/* 1:1 KARE GÖRSEL KUTUSU — HİÇBİR ZAMAN KIRPILMAZ (aspect-square + object-contain) */}
                <div className="relative aspect-square w-full min-h-[88px] max-h-[150px] sm:max-h-[220px] flex-1 flex items-center justify-center bg-white dark:bg-slate-900/60 rounded-xl overflow-hidden p-1 sm:p-1.5 mx-auto">
                  <img
                    src={resolveImageUrl(option.gorsel)}
                    alt={cleanDoubleParens(option.turkce)}
                    loading="eager"
                    className="w-full h-full object-contain mx-auto rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
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

                {/* GÖREV 2: Alt Bilgi Alanı — Cevap Verildiğinde Hem Harekeli Arapça (+ 🔊) Hem Türkçe Anlam Birlikte Gösterilir */}
                {showRichCardDetails ? (
                  <div className="shrink-0 pt-1.5 mt-1 border-t border-[#E6D7BE]/70 dark:border-[var(--border)] flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedOptionId !== null) {
                            clearTimers();
                          }
                          playItemAudio(option, activeConcreteMode, () => {
                            if (selectedOptionId !== null && !isPaused) {
                              autoAdvanceTimerRef.current = setTimeout(() => {
                                advanceToNextQuestion(
                                  hadWrongOnCurrent ? "wrong" : "correct"
                                );
                              }, 1200);
                            }
                          });
                        }}
                        className="w-6 h-6 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-[#087F5B] dark:text-emerald-300 flex items-center justify-center shrink-0 cursor-pointer"
                        title="Bu kelimenin Arapça telaffuzunu dinle"
                      >
                        <Volume2 size={13} />
                      </button>

                      <span
                        lang="ar"
                        dir="rtl"
                        className="arabic text-xl sm:text-2xl font-bold font-arabic text-emerald-950 dark:text-emerald-200 leading-snug truncate"
                      >
                        {formatAr(option.arapca)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span
                        dir="ltr"
                        lang="tr"
                        className="font-sans text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate"
                      >
                        <MixedText text={cleanDoubleParens(option.turkce)} />
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#F7EFE1] dark:bg-[var(--background)] text-[10px] font-extrabold text-[var(--muted)] shrink-0">
                        {option.cefr}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="shrink-0 pt-0.5 sm:pt-1 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-bold text-[var(--muted)]">
                    <span className="truncate">#{idx + 1}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#F7EFE1] dark:bg-[var(--background)] text-[10px] font-extrabold text-[var(--muted)]">
                      {option.cefr}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. ALT DAİRESEL İLERLEME ZİNCİRİ VE KONTROL BARI (shrink-0) */}
      <div className="shrink-0 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] px-2.5 py-1.5 flex items-center justify-between gap-2">
        {/* GÖREV 5: Sol Kontrol — Aktif Moda Göre Akıllı Gösterim */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClick();
              setIsPaused((prev) => {
                const next = !prev;
                if (next) {
                  sfx.stopAllSfx();
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

          {activeConcreteMode === "listen_speak_matrix" ? (
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
          ) : activeConcreteMode === "match_header_to_card" ||
            activeConcreteMode === "speech_bubble_match" ? (
            <button
              type="button"
              onClick={() => {
                playItemAudio(currentQuestion.target, activeConcreteMode);
              }}
              className="h-8 px-2.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#6741D9] text-xs font-extrabold text-[#6741D9] dark:text-purple-300 flex items-center gap-1.5 cursor-pointer transition-all"
              title="Üstteki Arapça ibareyi doğru görsele sürükleyin veya görsele tıklayın (Sesi tekrar dinlemek için dokunun)"
            >
              <Hand size={13} />
              <span className="hidden sm:inline">Sürükle veya Tıkla</span>
              <span className="sm:hidden">Sürükle</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                playItemAudio(currentQuestion.target, "audio_to_image");
              }}
              className="h-8 px-2.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#087F5B] text-xs font-extrabold text-[#087F5B] dark:text-emerald-400 flex items-center gap-1.5 cursor-pointer transition-all"
              title="Hedef Sesi Tekrar Dinle"
            >
              <Volume2 size={13} />
              <span className="hidden sm:inline">Sesi Tekrar Dinle</span>
              <span className="sm:hidden">Dinle</span>
            </button>
          )}
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
