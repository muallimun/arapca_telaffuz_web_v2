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
import { formatArabicText } from "@/lib/arabicTextUtils";

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

/**
 * Kısa Arapça fiil ve isimlerde (örn. سَمِعَ -> سمع, فَتَحَ -> فتح, قَلَبَ -> قلب)
 * STT motorları bazen uzatma harfi ekleyerek (سامع, فاتح, قاطع) veya çekimli (يسمع, سمعت) döndürür.
 * Hedef kelimenin tüm kök harfleri konuşulan kelimenin içinde aynı sırayla geçiyorsa true döner.
 */
function isOrderedSubsequence(targetChars: string, spokenChars: string): boolean {
  const tArr = Array.from(targetChars);
  const sArr = Array.from(spokenChars);
  if (tArr.length < 2 || sArr.length < tArr.length) return false;
  // Çok uzun alakasız bir kelimenin içinde tesadüfen geçmesini önle (en fazla +2 harf farkı)
  if (sArr.length > tArr.length + 2) return false;

  let tIdx = 0;
  for (let sIdx = 0; sIdx < sArr.length && tIdx < tArr.length; sIdx++) {
    if (sArr[sIdx] === tArr[tIdx]) {
      tIdx++;
    }
  }
  return tIdx === tArr.length;
}

/**
 * Uzun ünlüleri (ا, و, ي) ve son ت/ه eklerini sadeleştirerek ünsüz iskeletini çıkarır.
 */
function extractArabicConsonantSkeleton(word: string): string {
  if (word.length <= 2) return word;
  return (
    word[0] +
    word
      .slice(1)
      .replace(/[اوي]/g, "")
      .replace(/[هت]$/, "")
  );
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

  // 1) Kök / Sıralı Harf Uyumu (Subsequence) veya Ünsüz İskeleti Uyumu:
  // Özellikle 3-4 harfli fiillerde (سمع, فتح, اخذ, دخل, قلب, بحث, قطع)
  if (targetLen >= 3) {
    if (
      isOrderedSubsequence(bareTarget, bareSpoken) ||
      isOrderedSubsequence(bareSpoken, bareTarget)
    ) {
      return {
        matched: true,
        similarity: Math.max(88, bestSim),
        distance: Math.min(1, bestDist),
      };
    }

    const skelTarget = extractArabicConsonantSkeleton(bareTarget);
    const skelSpoken = extractArabicConsonantSkeleton(bareSpoken);
    if (skelTarget.length >= 2 && skelTarget === skelSpoken) {
      return {
        matched: true,
        similarity: Math.max(85, bestSim),
        distance: Math.min(1, bestDist),
      };
    }
  }

  // 2) Levenshtein Benzerlik Oranı >= %75 (0.75) veya <= 1 harf farkı (3+ harfli kelimelerde)
  if (targetLen >= 3 && (bestSim >= 75 || bestDist <= 1)) {
    return {
      matched: true,
      similarity: Math.max(75, bestSim),
      distance: bestDist,
    };
  }

  // Çok kısa (2 harfli) kelimelerde tam eşleşme veya %75+ benzerlik
  const isMatch = bestDist === 0 || bestSim >= 75;
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
 * Hedef Arapça ibare ile kullanıcının söylediği metni esnek harekesiz kök ve >= %75 harf uyumuna göre doğrular.
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

  // 1) TEK KELİMELİK HEDEFLER (örn. سَمِعَ, فَتَحَ, قَلَبَ, يَوْم, أُسْبُوع)
  if (targetWords.length === 1) {
    const tWord = targetWords[0];
    let bestSingle = isSingleWordStrictMatch(
      tWord,
      normSpoken.replace(/\s+/g, "")
    );
    for (const sWord of spokenWords) {
      const candidate = isSingleWordStrictMatch(tWord, sWord);
      if (
        (candidate.matched && !bestSingle.matched) ||
        candidate.similarity > bestSingle.similarity
      ) {
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

  let matchedWordCount = 0;
  let wordSimSum = 0;
  for (const tWord of targetWords) {
    let bestWordMatch = { matched: false, similarity: 0, distance: 99 };
    for (const sWord of spokenWords) {
      const res = isSingleWordStrictMatch(tWord, sWord);
      if (
        (res.matched && !bestWordMatch.matched) ||
        res.similarity > bestWordMatch.similarity
      ) {
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
    (allTargetWordsPresent && (fullSimilarity >= 75 || avgWordSimilarity >= 75)) ||
    fullSimilarity >= 75;

  return {
    isMatch: isPhraseMatch,
    isExact100:
      allTargetWordsPresent &&
      (fullSimilarity >= 95 || avgWordSimilarity === 100),
    similarity: effectiveSim,
  };
}

/**
 * Float32 PCM ses örneklerini 16kHz 16-bit Mono RIFF WAV Blob formatına dönüştürür.
 * `/api/stt` (Whisper) rotasının tüm tarayıcılarda (Brave, Chrome, Safari, Mobil) %100 doğru çözümleme yapmasını sağlar.
 */
function encodeFloat32ToWav16kBlob(
  samples: Float32Array,
  sourceSampleRate: number
): Blob {
  const targetSampleRate = 16000;
  let resampled: Float32Array;

  if (sourceSampleRate === targetSampleRate || sourceSampleRate <= 0) {
    resampled = samples;
  } else {
    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.max(1, Math.round(samples.length / ratio));
    resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIdx = i * ratio;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(samples.length - 1, idx0 + 1);
      const frac = srcIdx - idx0;
      resampled[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac;
    }
  }

  // Düşük mikrofon kazancını normalize et (fısıltı veya kısık seslerin Whisper tarafından net algılanması için)
  let peak = 0;
  for (let i = 0; i < resampled.length; i++) {
    const abs = Math.abs(resampled[i]);
    if (abs > peak) peak = abs;
  }
  const gain = peak > 0.008 && peak < 0.85 ? Math.min(4.0, 0.85 / peak) : 1.0;

  const numSamples = resampled.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, 1, true); // Mono = 1 channel
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // 16-bit
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, resampled[i] * gain));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function buildWav16kFromRecordedData(
  mediaChunks: BlobPart[],
  mimeType: string,
  pcmFrames: Float32Array[],
  pcmSampleRate: number
): Promise<Blob | null> {
  // 1) Öncelikle canlı AudioContext PCM çerçeveleri mevcutsa doğrudan kayıpsız 16kHz WAV üret
  if (pcmFrames.length > 0) {
    let totalLen = 0;
    for (const f of pcmFrames) totalLen += f.length;
    if (totalLen > 1600) {
      const merged = new Float32Array(totalLen);
      let offset = 0;
      for (const f of pcmFrames) {
        merged.set(f, offset);
        offset += f.length;
      }
      return encodeFloat32ToWav16kBlob(merged, pcmSampleRate || 48000);
    }
  }

  // 2) MediaRecorder Blob'unu AudioContext ile decode edip 16kHz WAV'a dönüştür
  if (mediaChunks.length > 0 && typeof window !== "undefined") {
    try {
      const rawBlob = new Blob(mediaChunks, { type: mimeType || "audio/webm" });
      const arrayBuf = await rawBlob.arrayBuffer();
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const tempCtx = new AudioCtx();
      try {
        const decoded = await tempCtx.decodeAudioData(arrayBuf);
        const chanData = decoded.getChannelData(0);
        const copy = new Float32Array(chanData.length);
        copy.set(chanData);
        return encodeFloat32ToWav16kBlob(copy, decoded.sampleRate);
      } finally {
        tempCtx.close().catch(() => {});
      }
    } catch {
      // ignore decode error
    }
  }

  return null;
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
    arabicFont,
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

  const recognitionRef = useRef<WebSpeechRecognitionInstance | null>(null);
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

          // Brave ve tüm tarayıcılarda 3 ayrı ses yükselmesini (micLevel > 18) yakalayarak
          // [ 1 ] -> [ 2 ] -> [ 3 ] halkalarını sırasıyla yeşile çevir
          const now = Date.now();
          if (pct > 18) {
            if (!voiceBurstActive) {
              voiceBurstActive = true;
              voiceBurstStartMs = now;
            } else if (
              now - voiceBurstStartMs >= 100 &&
              now - lastBurstIncrementMs >= 460 &&
              stepCount < 3
            ) {
              lastBurstIncrementMs = now;
              voiceBurstStartMs = now + 220;
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

    // 2. SpeechRecognition destekleyen tarayıcılarda ek olarak kelime bazlı "1 - 2 - 3" algılama
    const initCalibSpeechRec = () => {
      const win =
        typeof window !== "undefined"
          ? (window as unknown as Record<string, unknown>)
          : null;
      const SpeechRecCtor = win
        ? ((win.SpeechRecognition || win.webkitSpeechRecognition) as
            | (new () => WebSpeechRecognitionInstance)
            | undefined)
        : undefined;
      if (!SpeechRecCtor) return;

      let calibWebSpeechBlocked = false;
      try {
        const rec = new SpeechRecCtor();
        rec.lang = "ar-SA";
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 3;

        rec.onresult = (evt: unknown) => {
          if (!isMounted || isCalibDone) return;
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
          if (!event.results) return;

          let fullTranscript = "";
          for (let i = 0; i < event.results.length; i++) {
            const r = event.results[i];
            if (r && r[0]?.transcript) {
              fullTranscript += " " + r[0].transcript;
            }
          }
          const clean = fullTranscript.trim().toLowerCase();
          if (!clean) return;
          setCalibSpokenText(clean);

          const hasOne =
            /\b(1|١|واحد|واحده|bir)\b/i.test(clean) ||
            clean.includes("واحد") ||
            clean.includes("1") ||
            clean.includes("١");
          const hasTwo =
            /\b(2|٢|اثنان|اثنين|iki)\b/i.test(clean) ||
            clean.includes("اثن") ||
            clean.includes("2") ||
            clean.includes("٢");
          const hasThree =
            /\b(3|٣|ثلاثة|ثلاثه|ثلاث|üç|uc)\b/i.test(clean) ||
            clean.includes("ثلاث") ||
            clean.includes("3") ||
            clean.includes("٣");

          const words = clean.split(/\s+/).filter(Boolean);

          if (hasThree || words.length >= 3) {
            markStep(1);
            markStep(2);
            markStep(3);
          } else if (hasTwo || words.length >= 2) {
            markStep(1);
            markStep(2);
          } else if (hasOne || words.length >= 1) {
            markStep(1);
          }
        };

        rec.onerror = (errEvt: unknown) => {
          const code = (errEvt as { error?: string })?.error || "";
          if (
            code === "network" ||
            code === "not-allowed" ||
            code === "service-not-allowed"
          ) {
            calibWebSpeechBlocked = true;
          }
        };

        rec.onend = () => {
          if (!isMounted || isCalibDone || calibWebSpeechBlocked) return;
          setTimeout(() => {
            if (
              !isMounted ||
              isCalibDone ||
              calibWebSpeechBlocked ||
              calibRecognitionRef.current !== rec
            )
              return;
            try {
              rec.start();
            } catch {
              // ignore
            }
          }, 120);
        };

        calibRecognitionRef.current = rec;
        rec.start();
      } catch {
        // ignore
      }
    };

    initMicAnalyser();
    initCalibSpeechRec();

    return () => {
      isMounted = false;
      stopCalibrationResources();
    };
  }, [isActivityStarted, showCalibrationTest, stopCalibrationResources]);

  const formatAr = useCallback(
    (text: string) => {
      if (!text) return "";
      return formatArabicText(text, showHareke, arabicFont);
    },
    [showHareke, arabicFont]
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
   * `playDualGenderAudio` HTMLAudioElement `onended` olayı gerçekleştiğinde çözülür.
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
      setIsEvaluatingStt(false);

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
          initialAudioDelayRef.current = 240;
          setMatrixStepIndex(cardIdx + 1);
          setSpokenTranscript("");
          setMicStatusMessage("");
          setFailedAttempts(0);
          failedAttemptsRef.current = 0;
          setMicTimedOut(false);
          setIsEvaluatingStt(false);
          setIsWrongPronunciationState(false);
        }, 700);
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
        }, 700);
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
   * GÖREV 1: Brave, Chrome, Safari ve Mobilde %100 Çalışan Hibrit Ses Tanıma Mimarisi
   * (`MediaRecorder` + `/api/stt` + `WebSpeech` + RMS VAD Sessizlik Algılama)
   */
  const startMatrixListening = useCallback(
    function startMatrixListeningImpl(
      targetItem: ResimliKelime,
      cardIdx: number
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
      setMicRemainingSec(6);
      setMicRemainingPct(100);
      setMicStatusMessage("");
      hasSpokenRef.current = false;

      const LISTEN_WINDOW_MS = 6000;
      const windowStartMs = Date.now();
      let resolvedAttempt = false;
      let finalizingSpeech = false;
      let receivedAnySpeech = false;
      let lastSpokenTranscript = "";
      let webSpeechBlocked = false;

      const mediaChunks: BlobPart[] = [];
      let recorderMimeType = "audio/webm";
      const pcmFrames: Float32Array[] = [];
      let pcmSampleRate = 48000;

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
        playWrong();

        if (nextAttempts < 3) {
          setMicStatusMessage(
            `🗣️ Algılanan: "${detectedText}" • Doğru telaffuzu dinleyin (Deneme ${nextAttempts}/3)`
          );
          if (autoReplayTimerRef.current) {
            clearTimeout(autoReplayTimerRef.current);
          }
          // Yanlış telaffuzda 600ms sonra doğru Arapça sesi otomatik tekrar çal,
          // ses bittikten 400ms sonra mikrofonu tekrar aç
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
                  startMatrixListeningImpl(targetItem, cardIdx);
                }
              }, 400);
            });
          }, 600);
        } else {
          setMicStatusMessage(
            `🗣️ Algılanan: "${detectedText}" • 3 deneme tamamlandı (Deneme 3/3)`
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

      // Konuşma tamamlandığında (750ms sessizlik VAD veya 6sn bitimi):
      // WebSpeech yakalayamadıysa veya Brave'de engellendiyse `/api/stt` (Whisper) ile değerlendir!
      const finalizeAndEvaluateSpeech = async () => {
        if (
          resolvedAttempt ||
          finalizingSpeech ||
          verifiedCardLockRef.current
        ) {
          return;
        }
        finalizingSpeech = true;

        // 1) Eğer WebSpeech bir metin döndürdüyse önce onu kontrol et
        if (lastSpokenTranscript) {
          const checkWeb = strictArabicSpeechMatch(
            targetItem.arapca,
            lastSpokenTranscript
          );
          if (checkWeb.isMatch) {
            resolvedAttempt = true;
            setSpokenTranscript(lastSpokenTranscript);
            handleMatrixCardVerified(cardIdx, false);
            return;
          }
        }

        // 2) Eğer kullanıcı hiç konuşmadıysa (!hasSpokenRef.current ve WebSpeech boş)
        if (!hasSpokenRef.current && !receivedAnySpeech) {
          resolvedAttempt = true;
          stopSpeechRecognition();
          setMicTimedOut(true);
          setMicStatusMessage("🎙️ Ses algılanmadı");
          return;
        }

        // 3) Kullanıcı konuştu (`hasSpokenRef.current === true`), ancak WebSpeech boş döndü
        // veya Brave'de `network` hatası verdi ya da kısa kelimeyi tam yakalayamadı -> `/api/stt`'ye gönder!
        setIsListeningMic(false);
        setIsEvaluatingStt(true);
        setMicStatusMessage("⏳ Sesiniz kontrol ediliyor...");

        // MediaRecorder'ı durdurup son parçanın (dataavailable) gelmesini kısa süre bekle
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          await new Promise<void>((resolve) => {
            const recInst = mediaRecorderRef.current;
            if (!recInst) {
              resolve();
              return;
            }
            const doneTimer = setTimeout(resolve, 180);
            recInst.onstop = () => {
              clearTimeout(doneTimer);
              resolve();
            };
            try {
              recInst.stop();
            } catch {
              clearTimeout(doneTimer);
              resolve();
            }
          });
        }

        stopSpeechRecognition();

        try {
          const wavBlob = await buildWav16kFromRecordedData(
            mediaChunks,
            recorderMimeType,
            pcmFrames,
            pcmSampleRate
          );

          if (wavBlob && !resolvedAttempt && !verifiedCardLockRef.current) {
            const formData = new FormData();
            formData.append("audio", wavBlob, "speech.wav");
            formData.append("lang", "ar");

            const response = await fetch("/api/stt", {
              method: "POST",
              body: formData,
            });

            if (response.ok) {
              const data = (await response.json()) as { text?: string };
              const sttText = (data.text || "").trim();

              if (sttText && !resolvedAttempt && !verifiedCardLockRef.current) {
                setSpokenTranscript(sttText);
                const sttEval = strictArabicSpeechMatch(
                  targetItem.arapca,
                  sttText
                );
                if (sttEval.isMatch) {
                  resolvedAttempt = true;
                  setIsEvaluatingStt(false);
                  handleMatrixCardVerified(cardIdx, false);
                  return;
                }
                triggerWrongAttempt(sttText);
                return;
              }
            }
          }
        } catch {
          // /api/stt hata verirse aşağıda fallback'e düş
        }

        if (resolvedAttempt || verifiedCardLockRef.current) return;
        setIsEvaluatingStt(false);

        if (lastSpokenTranscript) {
          triggerWrongAttempt(lastSpokenTranscript);
        } else {
          resolvedAttempt = true;
          stopSpeechRecognition();
          setMicTimedOut(true);
          setMicStatusMessage("🎙️ Ses algılanmadı");
        }
      };

      // 1) Gerçek Mikrofon Akışı (`getUserMedia`) + RMS VAD + `MediaRecorder` Başlat
      const startHybridMicStream = async () => {
        if (
          typeof window === "undefined" ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
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

          if (resolvedAttempt || verifiedCardLockRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          activeMicStreamRef.current = stream;

          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const audioCtx = new AudioCtx();
          if (audioCtx.state === "suspended") {
            await audioCtx.resume();
          }
          activeMicAudioCtxRef.current = audioCtx;
          pcmSampleRate = audioCtx.sampleRate || 48000;

          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.65;
          source.connect(analyser);

          // Canlı PCM yedek kaydı (tüm tarayıcılarda 16kHz WAV üretiminin %100 garantisi)
          try {
            const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
            scriptNodeRef.current = scriptNode;
            scriptNode.onaudioprocess = (audioEvt) => {
              if (resolvedAttempt || finalizingSpeech) return;
              const input = audioEvt.inputBuffer.getChannelData(0);
              const copy = new Float32Array(input.length);
              copy.set(input);
              pcmFrames.push(copy);
            };
            source.connect(scriptNode);
            scriptNode.connect(audioCtx.destination);
          } catch {
            // ignore
          }

          // MediaRecorder paralel kaydı
          if (typeof MediaRecorder !== "undefined") {
            try {
              const preferredTypes = [
                "audio/webm;codecs=opus",
                "audio/webm",
                "audio/mp4",
              ];
              let chosenType = "";
              for (const t of preferredTypes) {
                if (
                  typeof MediaRecorder.isTypeSupported === "function" &&
                  MediaRecorder.isTypeSupported(t)
                ) {
                  chosenType = t;
                  break;
                }
              }
              const recorder = chosenType
                ? new MediaRecorder(stream, { mimeType: chosenType })
                : new MediaRecorder(stream);
              recorderMimeType = recorder.mimeType || chosenType || "audio/webm";
              recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                  mediaChunks.push(e.data);
                }
              };
              mediaRecorderRef.current = recorder;
              recorder.start(150);
            } catch {
              // ignore
            }
          }

          // RMS Ses Seviyesi (0-100) + Akıllı VAD (750ms Sessizlikte Otomatik Değerlendirme)
          const timeData = new Uint8Array(analyser.fftSize);
          let silenceStartMs: number | null = null;

          const updateVadAndMeter = () => {
            if (
              resolvedAttempt ||
              finalizingSpeech ||
              !activeMicAudioCtxRef.current
            ) {
              return;
            }
            if (audioCtx.state === "suspended") {
              audioCtx.resume().catch(() => {});
            }

            analyser.getByteTimeDomainData(timeData);
            let sumSquares = 0;
            for (let i = 0; i < timeData.length; i++) {
              const norm = (timeData[i] - 128) / 128;
              sumSquares += norm * norm;
            }
            const rms = Math.sqrt(sumSquares / timeData.length);
            const micLevel = Math.min(100, Math.round(rms * 330));
            setLiveMicLevel(micLevel);

            const now = Date.now();
            if (micLevel >= 12) {
              if (!hasSpokenRef.current) {
                hasSpokenRef.current = true;
                setMicStatusMessage("🎙️ Sesiniz alınıyor...");
              }
              silenceStartMs = null;
            } else if (hasSpokenRef.current && micLevel < 8) {
              if (silenceStartMs === null) {
                silenceStartMs = now;
              } else if (now - silenceStartMs >= 750) {
                // Kullanıcı kelimeyi söyleyip bitirdi (750ms sessizlik) -> 6 saniyeyi beklemeden hemen değerlendir!
                void finalizeAndEvaluateSpeech();
                return;
              }
            }

            activeMicRafRef.current = requestAnimationFrame(updateVadAndMeter);
          };

          activeMicRafRef.current = requestAnimationFrame(updateVadAndMeter);
        } catch {
          // getUserMedia başarısız olursa
        }
      };

      void startHybridMicStream();

      // 6.0 Saniyelik Geri Sayım Çubuğu (6s -> 0s)
      micCountdownIntervalRef.current = setInterval(() => {
        if (resolvedAttempt || finalizingSpeech) return;
        const elapsed = Date.now() - windowStartMs;
        const remaining = Math.max(0, LISTEN_WINDOW_MS - elapsed);
        setMicRemainingSec(Math.max(1, Math.ceil(remaining / 1000)));
        setMicRemainingPct(Math.round((remaining / LISTEN_WINDOW_MS) * 100));
      }, 100);

      // 6.0 Saniye Pencere Sonu Kontrolü
      micSilenceTimeoutRef.current = setTimeout(() => {
        if (resolvedAttempt || finalizingSpeech || verifiedCardLockRef.current)
          return;
        void finalizeAndEvaluateSpeech();
      }, LISTEN_WINDOW_MS);

      setIsListeningMic(true);

      // 2) Paralel Web Speech API (`continuous = false`, `interimResults = true`, `lang = "ar-SA"`)
      const win =
        typeof window !== "undefined"
          ? (window as unknown as Record<string, unknown>)
          : null;
      const SpeechRecCtor = win
        ? ((win.SpeechRecognition || win.webkitSpeechRecognition) as
            | (new () => WebSpeechRecognitionInstance)
            | undefined)
        : undefined;

      if (SpeechRecCtor) {
        try {
          const rec = new SpeechRecCtor();
          rec.lang = "ar-SA";
          rec.continuous = false;
          rec.interimResults = true;
          rec.maxAlternatives = 5;

          rec.onresult = (evt: unknown) => {
            if (
              resolvedAttempt ||
              finalizingSpeech ||
              verifiedCardLockRef.current
            )
              return;
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

            const alternatives: string[] = [];
            const latestRes = event.results[event.results.length - 1];
            if (latestRes) {
              const altCount =
                typeof latestRes.length === "number" ? latestRes.length : 1;
              for (let i = 0; i < altCount; i++) {
                const t = (latestRes[i]?.transcript || "").trim();
                if (t) alternatives.push(t);
              }
            }

            let combinedTranscript = "";
            for (let i = 0; i < event.results.length; i++) {
              const seg = (event.results[i]?.[0]?.transcript || "").trim();
              if (seg)
                combinedTranscript += (combinedTranscript ? " " : "") + seg;
            }
            if (
              combinedTranscript &&
              !alternatives.includes(combinedTranscript)
            ) {
              alternatives.push(combinedTranscript);
            }

            const primaryTranscript = alternatives[0] || "";
            if (!primaryTranscript) return;

            receivedAnySpeech = true;
            hasSpokenRef.current = true;
            lastSpokenTranscript = primaryTranscript;
            setSpokenTranscript(primaryTranscript);

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

            // Hedef kelimeyle eşleşme yakalandığı AN anında doğru kabul et!
            if (bestMatch.isMatch) {
              resolvedAttempt = true;
              if (speechSettleTimerRef.current) {
                clearTimeout(speechSettleTimerRef.current);
                speechSettleTimerRef.current = null;
              }
              setSpokenTranscript(matchedTranscript);
              handleMatrixCardVerified(cardIdx, false);
              return;
            }
          };

          rec.onerror = (errEvt: unknown) => {
            if (
              resolvedAttempt ||
              finalizingSpeech ||
              verifiedCardLockRef.current
            )
              return;
            const errCode = (errEvt as { error?: string })?.error || "";
            // Brave'de "network" hatası geldiğinde WebSpeech'i sessizce devre dışı bırak;
            // MediaRecorder + /api/stt + VAD motoru kesintisiz devam eder!
            if (
              errCode === "network" ||
              errCode === "not-allowed" ||
              errCode === "service-not-allowed"
            ) {
              webSpeechBlocked = true;
            }
          };

          rec.onend = () => {
            if (
              resolvedAttempt ||
              finalizingSpeech ||
              verifiedCardLockRef.current ||
              webSpeechBlocked
            ) {
              return;
            }
            const elapsed = Date.now() - windowStartMs;
            if (
              elapsed < LISTEN_WINDOW_MS - 300 &&
              recognitionRef.current === rec &&
              !isPaused &&
              !micFreeMode
            ) {
              setTimeout(() => {
                if (
                  !resolvedAttempt &&
                  !finalizingSpeech &&
                  !verifiedCardLockRef.current &&
                  !webSpeechBlocked &&
                  recognitionRef.current === rec &&
                  !isPaused &&
                  !micFreeMode
                ) {
                  try {
                    rec.start();
                  } catch {
                    // ignore
                  }
                }
              }, 80);
            }
          };

          recognitionRef.current = rec;
          rec.start();
        } catch {
          webSpeechBlocked = true;
        }
      }
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
      stopAllAudio();
      stopSpeechRecognition();
      stopCalibrationResources();
      clearTimers();
    };
  }, [stopSpeechRecognition, stopCalibrationResources, clearTimers]);

  const restartQuiz = useCallback(
    (customPool?: ResimliKelime[], customMode?: VisualInteractionMode) => {
      playStart();
      stopAllAudio();
      stopSpeechRecognition();
      clearTimers();
      // GÖREV 2: baslangic.mp3 ile ilk kelime sesinin çakışmaması için 700ms gecikme
      initialAudioDelayRef.current = 700;
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

    // Mod A'da karta tıklanınca o kartın sesini çal, ses bitince 400ms sonra mikrofonu aç (veya mikrofonsuz moddaysa onayla)
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
      <div className="h-[calc(100dvh-105px)] max-h-[calc(100dvh-105px)] flex flex-col items-center justify-center overflow-hidden p-3 sm:p-5 bg-[#F7EFE1]/70 dark:bg-[var(--surface)]/60 rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)]">
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

        {/* Sağ Kontroller: Mikrofonu Test Et + Erkek/Kadın Ses + Kategori */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              playClick();
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
        /* GÖREV 4: Koyu Lacivert/Antrasit Aktif Konuşma Çubuğu — Canlı RMS Ses Seviyesi ve Hibrit STT Durumu */
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
                      }, 400);
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
              disabled={isPlayingTargetAudio || isEvaluatingStt}
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                isListeningMic
                  ? "bg-emerald-500 text-white ring-4 ring-emerald-400/40 animate-pulse"
                  : isPlayingTargetAudio || isEvaluatingStt
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

              {/* Alt Durum Satırı + 6 Saniyelik Geri Sayım ve Canlı Mikrofon Ses Dalgası */}
              <div className="flex items-center gap-2 mt-0.5">
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
                    ? "Mikrofonsuz Mod aktif: Onaylamak için 'Onayla ✓' butonuna dokunun."
                    : isPlayingTargetAudio
                    ? "🔊 Örnek ses çalıyor..."
                    : isEvaluatingStt
                    ? "⏳ Sesiniz kontrol ediliyor..."
                    : isListeningMic
                    ? `${
                        micStatusMessage || `🎙️ Dinleniyor (${micRemainingSec}s)...`
                      }${spokenTranscript ? ` "${spokenTranscript}"` : ""}`
                    : micStatusMessage ||
                      (spokenTranscript
                        ? `Algılanan: "${spokenTranscript}"`
                        : "🎙️ Ses algılanmadı")}
                </p>

                {/* Aktif dinleme sırasında canlı ses dalgası, RMS ses seviyesi (%) ve 6sn ilerleme çubuğu */}
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

          {/* Sağ Aksiyon Butonu: Tek ve net buton ("Onayla ✓" | "🎙️ Tekrar Konuş" | "Sonrakine Geç ⏭") */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {micFreeMode ? (
              <button
                type="button"
                onClick={() => handleMatrixCardVerified(matrixStepIndex, false)}
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Onayla ✓</span>
              </button>
            ) : failedAttempts >= 3 && !isEvaluatingStt ? (
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
                  <span>🎙️ Tekrar Konuş</span>
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
            ) : (micTimedOut || !isListeningMic) &&
              !isPlayingTargetAudio &&
              !isEvaluatingStt ? (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  clearTimers();
                  stopAllAudio();
                  startMatrixListening(activeMatrixCard, matrixStepIndex);
                }}
                className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
              >
                <span>🎙️ Tekrar Konuş</span>
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
