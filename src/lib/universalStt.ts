// src/lib/universalStt.ts
// Masaüstü (Chrome, Brave, Edge, Firefox, Safari) ve Mobil (Android Chrome, iOS Safari, WebView)
// için Çakışmasız 3 Katmanlı Evrensel Arapça Ses Algılama Motoru (Universal STT)

import { stopAllAudio } from "@/lib/audio";
import { sfx } from "@/lib/sfxManager";
import type { WhisperWorkerResponse } from "./whisperWorker";

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
  "11": ["احد عشر", "احدي عشره", "احدى عشره"],
  "12": ["اثنا عشر", "اثني عشر"],
};

// Modül düzeyinde aktif MediaStream kayıt defteri (SpeechRecognition öncesi %100 mikrofon kilidi temizliği için)
const activeMediaStreams = new Set<MediaStream>();

export function registerActiveMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  activeMediaStreams.add(stream);
}

export function stopAllActiveMediaStreams(): void {
  for (const stream of Array.from(activeMediaStreams)) {
    try {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
    activeMediaStreams.delete(stream);
  }
}

export function stopAllAudioOutputs(): void {
  try {
    sfx.stopAllSfx();
  } catch {
    // ignore
  }
  try {
    stopAllAudio();
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

// Tarayıcı & WebSpeech oturum engeli durumu
let webSpeechBlockedInSession = false;
let cachedIsBrave: boolean | null = null;

export function isWebSpeechBlocked(): boolean {
  return webSpeechBlockedInSession;
}

export function markWebSpeechBlocked(): void {
  webSpeechBlockedInSession = true;
}

interface BraveNavigator extends Navigator {
  brave?: {
    isBrave?: () => Promise<boolean>;
  };
}

export async function detectIsBraveBrowser(): Promise<boolean> {
  if (cachedIsBrave !== null) return cachedIsBrave;
  if (typeof navigator === "undefined") {
    cachedIsBrave = false;
    return false;
  }
  try {
    const nav = navigator as BraveNavigator;
    if (nav.brave && typeof nav.brave.isBrave === "function") {
      cachedIsBrave = Boolean(await nav.brave.isBrave().catch(() => false));
      if (cachedIsBrave) {
        webSpeechBlockedInSession = true;
      }
      return cachedIsBrave;
    }
  } catch {
    // ignore
  }
  cachedIsBrave = false;
  return false;
}

interface SpeechRecognitionAlternativeLike {
  transcript?: string;
  confidence?: number;
}

interface SpeechRecognitionResultItemLike {
  isFinal?: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results?: {
    length: number;
    [index: number]: SpeechRecognitionResultItemLike;
  };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type WindowWithSpeechRec = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const win = window as WindowWithSpeechRec;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

// ============================================================================
// ESNEK ARAPÇA SES-KÖK (FONO-MORFOLOJİK) EŞLEŞTİRME MOTORU
// ============================================================================

export function normalizeArabicForMatch(str: string): string {
  const withWesternDigits = (str || "").replace(
    /[٠-٩]/g,
    (d) => EASTERN_DIGIT_MAP[d] ?? d
  );

  return withWesternDigits
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // hareke, tenvin, şedde, tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0621-\u064A0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingAl(word: string): string {
  return word.startsWith("ال") && word.length > 3 ? word.slice(2) : word;
}

function canonicalizeNumbersForTarget(
  normalizedSpoken: string,
  normalizedTarget: string
): string {
  if (!normalizedSpoken || !normalizedTarget) return normalizedSpoken;
  let result = normalizedSpoken;

  for (const [digit, wordVariants] of Object.entries(ARABIC_NUMBER_EQUIVALENTS)) {
    const targetHasDigit = normalizedTarget.split(" ").includes(digit);
    const matchingTargetWord = wordVariants.find((w) =>
      normalizedTarget.includes(w)
    );

    if (matchingTargetWord) {
      const digitRegex = new RegExp(`\\b${digit}\\b`, "g");
      result = result.replace(digitRegex, matchingTargetWord);
      for (const variant of wordVariants) {
        if (variant !== matchingTargetWord && result.includes(variant)) {
          result = result.replace(new RegExp(variant, "g"), matchingTargetWord);
        }
      }
    } else if (targetHasDigit) {
      for (const variant of wordVariants) {
        if (result.includes(variant)) {
          result = result.replace(new RegExp(variant, "g"), digit);
        }
      }
    }
  }

  return result.replace(/\s+/g, " ").trim();
}

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

function isOrderedSubsequence(targetChars: string, spokenChars: string): boolean {
  const tArr = Array.from(targetChars);
  const sArr = Array.from(spokenChars);
  if (tArr.length < 2 || sArr.length < tArr.length) return false;
  // Alakasız çok uzun kelimelerde tesadüfi eşleşmeyi önle (en fazla +3 harf çekim/uzatma farkı)
  if (sArr.length > tArr.length + 3) return false;

  let tIdx = 0;
  for (let sIdx = 0; sIdx < sArr.length && tIdx < tArr.length; sIdx++) {
    if (sArr[sIdx] === tArr[tIdx]) {
      tIdx++;
    }
  }
  return tIdx === tArr.length;
}

function extractConsonantSkeleton(word: string): string {
  if (word.length <= 2) return word;
  return (
    word[0] +
    word
      .slice(1)
      .replace(/[اوي]/g, "")
      .replace(/[هت]$/, "")
  );
}

function matchSingleWordFlexible(
  targetWord: string,
  spokenWord: string
): { matched: boolean; similarity: number; distance: number } {
  if (!targetWord || !spokenWord) {
    return { matched: false, similarity: 0, distance: 99 };
  }
  if (targetWord === spokenWord) {
    return { matched: true, similarity: 100, distance: 0 };
  }

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

  // Kısa kelimelerde (2-4 harfli: سلم, سمع, فرن, فتح, يد vb.) kök harfleri sırayla mevcutsa veya benzerlik >= %72 ise DOĞRU!
  if (targetLen >= 2 && targetLen <= 4) {
    if (
      isOrderedSubsequence(bareTarget, bareSpoken) ||
      (targetLen >= 3 && isOrderedSubsequence(bareSpoken, bareTarget))
    ) {
      return {
        matched: true,
        similarity: Math.max(88, bestSim),
        distance: Math.min(1, bestDist),
      };
    }

    const skelTarget = extractConsonantSkeleton(bareTarget);
    const skelSpoken = extractConsonantSkeleton(bareSpoken);
    if (skelTarget.length >= 2 && skelTarget === skelSpoken) {
      return {
        matched: true,
        similarity: Math.max(85, bestSim),
        distance: Math.min(1, bestDist),
      };
    }

    if (bestSim >= 72 || (targetLen >= 3 && bestDist <= 1)) {
      return {
        matched: true,
        similarity: Math.max(72, bestSim),
        distance: bestDist,
      };
    }
  }

  // 5+ harfli kelimelerde sıralı kök uyumu veya >= %72 benzerlik
  if (targetLen >= 5) {
    if (
      isOrderedSubsequence(bareTarget, bareSpoken) ||
      isOrderedSubsequence(bareSpoken, bareTarget)
    ) {
      return {
        matched: true,
        similarity: Math.max(86, bestSim),
        distance: Math.min(1, bestDist),
      };
    }
    if (bestSim >= 72 || bestDist <= 1) {
      return {
        matched: true,
        similarity: Math.max(72, bestSim),
        distance: bestDist,
      };
    }
  }

  return {
    matched: bestDist === 0 || bestSim >= 72,
    similarity: bestSim,
    distance: bestDist,
  };
}

export interface ArabicMatchEvaluation {
  isMatch: boolean;
  isExact100: boolean;
  similarity: number;
  matchedText: string;
}

export function evaluateSingleTranscriptMatch(
  targetAr: string,
  spokenTranscript: string
): ArabicMatchEvaluation {
  const normTarget = normalizeArabicForMatch(targetAr);
  const rawNormSpoken = normalizeArabicForMatch(spokenTranscript);
  const normSpoken = canonicalizeNumbersForTarget(rawNormSpoken, normTarget);

  if (!normTarget || !normSpoken) {
    return {
      isMatch: false,
      isExact100: false,
      similarity: 0,
      matchedText: spokenTranscript || "",
    };
  }

  if (normTarget === normSpoken) {
    return {
      isMatch: true,
      isExact100: true,
      similarity: 100,
      matchedText: spokenTranscript,
    };
  }

  const targetWords = normTarget.split(" ").filter(Boolean);
  const spokenWords = normSpoken.split(" ").filter(Boolean);

  if (targetWords.length === 1) {
    const tWord = targetWords[0];
    let bestSingle = matchSingleWordFlexible(
      tWord,
      normSpoken.replace(/\s+/g, "")
    );
    for (const sWord of spokenWords) {
      const candidate = matchSingleWordFlexible(tWord, sWord);
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
      matchedText: spokenTranscript,
    };
  }

  const fullDist = levenshteinDistance(normTarget, normSpoken);
  const maxFullLen = Math.max(
    Array.from(normTarget).length,
    Array.from(normSpoken).length,
    1
  );
  const fullSimilarity = Math.round(((maxFullLen - fullDist) / maxFullLen) * 100);

  let matchedWordCount = 0;
  let wordSimSum = 0;
  for (const tWord of targetWords) {
    let bestWordMatch = { matched: false, similarity: 0, distance: 99 };
    for (const sWord of spokenWords) {
      const res = matchSingleWordFlexible(tWord, sWord);
      if (
        (res.matched && !bestWordMatch.matched) ||
        res.similarity > bestWordMatch.similarity
      ) {
        bestWordMatch = res;
      }
    }
    if (bestWordMatch.matched) matchedWordCount++;
    wordSimSum += bestWordMatch.similarity;
  }

  const avgWordSimilarity = Math.round(wordSimSum / targetWords.length);
  const allTargetWordsPresent = matchedWordCount === targetWords.length;
  const effectiveSim = Math.max(fullSimilarity, avgWordSimilarity);

  const isPhraseMatch =
    (allTargetWordsPresent &&
      (fullSimilarity >= 72 || avgWordSimilarity >= 72)) ||
    fullSimilarity >= 72;

  return {
    isMatch: isPhraseMatch,
    isExact100:
      allTargetWordsPresent &&
      (fullSimilarity >= 95 || avgWordSimilarity === 100),
    similarity: effectiveSim,
    matchedText: spokenTranscript,
  };
}

export function matchArabicPronunciation(
  targetAr: string,
  candidates: string[]
): ArabicMatchEvaluation {
  let best: ArabicMatchEvaluation = {
    isMatch: false,
    isExact100: false,
    similarity: 0,
    matchedText: candidates[0] || "",
  };

  for (const raw of candidates) {
    const trimmed = (raw || "").trim();
    if (!trimmed) continue;
    const res = evaluateSingleTranscriptMatch(targetAr, trimmed);
    if (
      (res.isMatch && !best.isMatch) ||
      (res.isMatch === best.isMatch && res.similarity > best.similarity)
    ) {
      best = res;
    }
  }

  return best;
}

// ============================================================================
// 16kHz PCM & WAV DÖNÜŞTÜRÜCÜ + WHISPER WORKER YEDEK KATMANI (KATMAN 2 & 3)
// ============================================================================

function resampleFloat32To16k(
  samples: Float32Array,
  sourceSampleRate: number
): Float32Array {
  const targetRate = 16000;
  if (!samples || samples.length === 0) return new Float32Array(0);
  if (!sourceSampleRate || sourceSampleRate <= 0 || sourceSampleRate === targetRate) {
    return samples;
  }
  const ratio = sourceSampleRate / targetRate;
  const newLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(samples.length - 1, idx0 + 1);
    const frac = srcIdx - idx0;
    out[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac;
  }
  return out;
}

export function encodePcm16kToWavBlob(samples16k: Float32Array): Blob {
  const targetSampleRate = 16000;
  let peak = 0;
  for (let i = 0; i < samples16k.length; i++) {
    const abs = Math.abs(samples16k[i]);
    if (abs > peak) peak = abs;
  }
  const gain = peak > 0.006 && peak < 0.85 ? Math.min(4.0, 0.86 / peak) : 1.0;

  // Başına 0.20sn (3200 örnek) ve sonuna 0.25sn (4000 örnek) sessizlik yastığı ekle
  const prePad = 3200;
  const postPad = 4000;
  const minSamples = 16000;
  const totalSamples = Math.max(
    minSamples,
    prePad + samples16k.length + postPad
  );

  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, totalSamples * 2, true);

  let byteOffset = 44 + prePad * 2;
  for (let i = 0; i < samples16k.length; i++) {
    const s = Math.max(-1, Math.min(1, samples16k[i] * gain));
    view.setInt16(byteOffset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    byteOffset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function extractPcm16kFromRecordedAudio(
  pcmFrames: Float32Array[],
  pcmSampleRate: number,
  mediaChunks: BlobPart[],
  mimeType: string
): Promise<Float32Array> {
  if (pcmFrames.length > 0) {
    let totalLen = 0;
    for (const f of pcmFrames) totalLen += f.length;
    if (totalLen > 1200) {
      const merged = new Float32Array(totalLen);
      let offset = 0;
      for (const f of pcmFrames) {
        merged.set(f, offset);
        offset += f.length;
      }
      return resampleFloat32To16k(merged, pcmSampleRate || 48000);
    }
  }

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
        return resampleFloat32To16k(copy, decoded.sampleRate);
      } finally {
        tempCtx.close().catch(() => {});
      }
    } catch {
      // ignore decode error
    }
  }

  return new Float32Array(0);
}

// Singleton Tarayıcı İçi Whisper Worker (Katman 3 Fallback)
let sharedWhisperWorker: Worker | null = null;
let sharedWhisperCounter = 0;

function getSharedWhisperWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (!sharedWhisperWorker) {
    try {
      sharedWhisperWorker = new Worker(
        new URL("./whisperWorker.ts", import.meta.url),
        { type: "module" }
      );
    } catch {
      sharedWhisperWorker = null;
    }
  }
  return sharedWhisperWorker;
}

export function transcribeWithLocalWhisperFallback(
  pcm16k: Float32Array,
  onStatus?: (msg: string) => void
): Promise<string> {
  const worker = getSharedWhisperWorker();
  if (!worker || !pcm16k || pcm16k.length < 1600) {
    return Promise.resolve("");
  }

  const requestId = `req_ustt_${Date.now()}_${++sharedWhisperCounter}`;

  return new Promise<string>((resolve) => {
    let settled = false;
    let phaseTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (txt: string) => {
      if (settled) return;
      settled = true;
      if (phaseTimer) clearTimeout(phaseTimer);
      worker.removeEventListener("message", onMsg);
      resolve((txt || "").trim());
    };

    const resetTimer = (ms: number) => {
      if (phaseTimer) clearTimeout(phaseTimer);
      phaseTimer = setTimeout(() => {
        try {
          worker.postMessage({ type: "abort", requestId });
        } catch {
          // ignore
        }
        finish("");
      }, ms);
    };

    resetTimer(65000);

    const onMsg = (evt: MessageEvent<WhisperWorkerResponse>) => {
      const msg = evt.data;
      if (!msg) return;
      if (msg.requestId && msg.requestId !== requestId) return;

      if (msg.status === "progress") {
        const pct = Math.round(msg.data?.progress || 0);
        resetTimer(65000);
        onStatus?.(`⏳ Cihaz içi ses modeli hazırlanıyor (%${pct})...`);
      } else if (msg.status === "loading" || msg.status === "ready") {
        resetTimer(65000);
        onStatus?.("⏳ Cihaz içi ses modeli hazırlanıyor...");
      } else if (msg.status === "transcribing") {
        resetTimer(20000);
        onStatus?.("⏳ Sesiniz çözümleniyor...");
      } else if (msg.status === "completed") {
        finish(msg.ignored ? "" : msg.text || "");
      } else if (msg.status === "error") {
        finish("");
      }
    };

    worker.addEventListener("message", onMsg);
    try {
      worker.postMessage({
        type: "transcribe",
        requestId,
        audioData: pcm16k,
        sampleRate: 16000,
        language: "arabic",
      });
    } catch {
      finish("");
    }
  });
}

export async function transcribePcmViaServerOrWorker(
  pcm16k: Float32Array,
  options?: {
    localSttOnly?: boolean;
    serverTimeoutMs?: number;
    onStatus?: (msg: string) => void;
  }
): Promise<{ text: string; source: "server-stt" | "whisper-worker" | "none" }> {
  if (!pcm16k || pcm16k.length < 1600) {
    return { text: "", source: "none" };
  }

  const localOnly = Boolean(options?.localSttOnly);
  const timeoutMs = options?.serverTimeoutMs ?? 5500;

  if (!localOnly) {
    try {
      options?.onStatus?.("⏳ Sesiniz kontrol ediliyor...");
      const wavBlob = encodePcm16kToWavBlob(pcm16k);
      const formData = new FormData();
      formData.append("audio", wavBlob, "speech.wav");
      formData.append("lang", "ar");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch("/api/stt", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as { text?: string };
          const serverText = (data?.text || "").trim();
          if (serverText && /[\u0600-\u06FF]/.test(serverText)) {
            return { text: serverText, source: "server-stt" };
          }
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Sunucu zaman aşımı veya ağ hatası -> Katman 3 (Tarayıcı içi Whisper Worker) devreye girer
    }
  }

  const workerText = await transcribeWithLocalWhisperFallback(
    pcm16k,
    options?.onStatus
  );
  if (workerText) {
    return { text: workerText, source: "whisper-worker" };
  }

  return { text: "", source: "none" };
}

// ============================================================================
// 3 KATMANLI EVRENSEL OTURUM YÖNETİCİSİ (`startUniversalSttSession`)
// ============================================================================

export interface UniversalSttResult {
  ok: boolean;
  isMatch: boolean;
  isExact100: boolean;
  similarity: number;
  transcript: string;
  allCandidates: string[];
  timedOutNoSpeech: boolean;
  layerUsed: "webspeech" | "server-stt" | "whisper-worker" | "none";
}

export interface UniversalSttOptions {
  targetArabic?: string;
  listenWindowMs?: number;
  echoGuardMs?: number;
  forceRecorderLayer?: boolean;
  localSttOnly?: boolean;
  onListeningStart?: (layer: "webspeech" | "recorder") => void;
  onAudioLevel?: (pct: number) => void;
  onInterimTranscript?: (primary: string, candidates: string[]) => void;
  onVoiceDetected?: () => void;
  onEvaluating?: (statusText: string) => void;
  onCountdownTick?: (remainingSec: number, remainingPct: number) => void;
  onResult: (result: UniversalSttResult) => void;
}

export interface UniversalSttController {
  stopManual: () => void;
  abort: () => void;
  isActive: () => boolean;
}

export function startUniversalSttSession(
  options: UniversalSttOptions
): UniversalSttController {
  const listenWindowMs = options.listenWindowMs ?? 6500;
  const echoGuardMs = options.echoGuardMs ?? 0;

  let aborted = false;
  let resolved = false;
  let manualStopRequested = false;

  let echoGuardTimer: ReturnType<typeof setTimeout> | null = null;
  let windowTimeout: ReturnType<typeof setTimeout> | null = null;
  let countdownInterval: ReturnType<typeof setInterval> | null = null;
  let pulseInterval: ReturnType<typeof setInterval> | null = null;
  let speechSettleTimer: ReturnType<typeof setTimeout> | null = null;

  let activeRec: SpeechRecognitionLike | null = null;
  let activeStream: MediaStream | null = null;
  let activeAudioCtx: AudioContext | null = null;
  let activeScriptNode: ScriptProcessorNode | null = null;
  let activeRecorder: MediaRecorder | null = null;
  let activeVadRaf: number | null = null;

  let finalizeRecorderFn: (() => Promise<void>) | null = null;
  let finalizeWebSpeechFn: (() => void) | null = null;

  const cleanupAll = () => {
    if (echoGuardTimer) {
      clearTimeout(echoGuardTimer);
      echoGuardTimer = null;
    }
    if (windowTimeout) {
      clearTimeout(windowTimeout);
      windowTimeout = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (pulseInterval) {
      clearInterval(pulseInterval);
      pulseInterval = null;
    }
    if (speechSettleTimer) {
      clearTimeout(speechSettleTimer);
      speechSettleTimer = null;
    }
    if (activeVadRaf !== null) {
      cancelAnimationFrame(activeVadRaf);
      activeVadRaf = null;
    }
    if (activeRec) {
      const r = activeRec;
      activeRec = null;
      try {
        r.onstart = null;
        r.onsoundstart = null;
        r.onspeechstart = null;
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        r.abort();
      } catch {
        // ignore
      }
    }
    if (activeRecorder) {
      const mr = activeRecorder;
      activeRecorder = null;
      try {
        if (mr.state !== "inactive") mr.stop();
      } catch {
        // ignore
      }
    }
    if (activeScriptNode) {
      const sn = activeScriptNode;
      activeScriptNode = null;
      try {
        sn.onaudioprocess = null;
        sn.disconnect();
      } catch {
        // ignore
      }
    }
    if (activeStream) {
      const st = activeStream;
      activeStream = null;
      try {
        st.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
    }
    stopAllActiveMediaStreams();
    if (activeAudioCtx) {
      const ctx = activeAudioCtx;
      activeAudioCtx = null;
      try {
        ctx.close().catch(() => {});
      } catch {
        // ignore
      }
    }
    options.onAudioLevel?.(0);
  };

  const emitFinalResult = (res: UniversalSttResult) => {
    if (aborted || resolved) return;
    resolved = true;
    cleanupAll();
    options.onResult(res);
  };

  // Önce dış sesleri ve açık kalmış tüm MediaStream mikrofon izlerini tamamen temizle
  stopAllAudioOutputs();
  stopAllActiveMediaStreams();

  const beginSessionAfterGuard = async () => {
    if (aborted || resolved) return;

    const isBrave = await detectIsBraveBrowser();
    if (aborted || resolved) return;

    const SpeechRecCtor = getSpeechRecognitionCtor();
    const canUseLayer1 =
      Boolean(SpeechRecCtor) &&
      !isBrave &&
      !webSpeechBlockedInSession &&
      !options.forceRecorderLayer &&
      !options.localSttOnly;

    const windowStartMs = Date.now();

    const startWindowCountdown = (onExpire: () => void) => {
      if (countdownInterval) clearInterval(countdownInterval);
      if (windowTimeout) clearTimeout(windowTimeout);

      countdownInterval = setInterval(() => {
        if (aborted || resolved) return;
        const elapsed = Date.now() - windowStartMs;
        const remaining = Math.max(0, listenWindowMs - elapsed);
        options.onCountdownTick?.(
          Math.max(1, Math.ceil(remaining / 1000)),
          Math.round((remaining / listenWindowMs) * 100)
        );
      }, 100);

      windowTimeout = setTimeout(() => {
        if (aborted || resolved) return;
        onExpire();
      }, listenWindowMs);
    };

    // ------------------------------------------------------------------------
    // KATMAN 2 & 3: MediaRecorder + 16kHz PCM + Akıllı VAD -> /api/stt -> WhisperWorker
    // ------------------------------------------------------------------------
    const startLayer2Recorder = async () => {
      if (aborted || resolved) return;
      finalizeWebSpeechFn = null;

      if (
        typeof window === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        emitFinalResult({
          ok: false,
          isMatch: false,
          isExact100: false,
          similarity: 0,
          transcript: "",
          allCandidates: [],
          timedOutNoSpeech: true,
          layerUsed: "none",
        });
        return;
      }

      stopAllActiveMediaStreams();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          emitFinalResult({
            ok: false,
            isMatch: false,
            isExact100: false,
            similarity: 0,
            transcript: "",
            allCandidates: [],
            timedOutNoSpeech: true,
            layerUsed: "none",
          });
          return;
        }
      }

      if (aborted || resolved) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      activeStream = stream;
      registerActiveMediaStream(stream);

      const mediaChunks: BlobPart[] = [];
      let recorderMimeType = "audio/webm";
      const pcmFrames: Float32Array[] = [];
      let pcmSampleRate = 48000;
      let hasSpoken = false;
      let peakMicPct = 0;
      let finalizingRecorder = false;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume().catch(() => {});
      }
      if (aborted || resolved) {
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close().catch(() => {});
        return;
      }

      activeAudioCtx = audioCtx;
      pcmSampleRate = audioCtx.sampleRate || 48000;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      try {
        const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
        activeScriptNode = scriptNode;
        scriptNode.onaudioprocess = (evt) => {
          if (aborted || resolved || finalizingRecorder) return;
          const chan = evt.inputBuffer.getChannelData(0);
          const copy = new Float32Array(chan.length);
          copy.set(chan);
          pcmFrames.push(copy);
        };
        source.connect(scriptNode);
        scriptNode.connect(audioCtx.destination);
      } catch {
        // ignore ScriptProcessor fallback error
      }

      if (typeof MediaRecorder !== "undefined") {
        try {
          const chosenMime =
            typeof MediaRecorder.isTypeSupported === "function" &&
            MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
              ? "audio/webm;codecs=opus"
              : typeof MediaRecorder.isTypeSupported === "function" &&
                MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : "";
          const mr = chosenMime
            ? new MediaRecorder(stream, { mimeType: chosenMime })
            : new MediaRecorder(stream);
          recorderMimeType = mr.mimeType || chosenMime || "audio/webm";
          mr.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              mediaChunks.push(e.data);
            }
          };
          activeRecorder = mr;
          mr.start(120);
        } catch {
          // ignore MediaRecorder error (pcmFrames is primary)
        }
      }

      const recorderOpenedAt = Date.now();
      let sustainedVoiceStartMs: number | null = null;
      let silenceStartMs: number | null = null;
      const timeData = new Uint8Array(analyser.fftSize);

      const finishAndTranscribeRecorder = async () => {
        if (aborted || resolved || finalizingRecorder) return;
        finalizingRecorder = true;

        if (activeVadRaf !== null) {
          cancelAnimationFrame(activeVadRaf);
          activeVadRaf = null;
        }
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
        if (windowTimeout) {
          clearTimeout(windowTimeout);
          windowTimeout = null;
        }

        // MediaRecorder son veri parçasını al
        if (activeRecorder && activeRecorder.state !== "inactive") {
          const mr = activeRecorder;
          activeRecorder = null;
          await new Promise<void>((res) => {
            const safety = setTimeout(res, 180);
            mr.onstop = () => {
              clearTimeout(safety);
              res();
            };
            try {
              mr.stop();
            } catch {
              clearTimeout(safety);
              res();
            }
          });
        }

        // Mikrofon donanımını hemen serbest bırak
        if (activeScriptNode) {
          try {
            activeScriptNode.onaudioprocess = null;
            activeScriptNode.disconnect();
          } catch {
            // ignore
          }
          activeScriptNode = null;
        }
        if (activeStream) {
          try {
            activeStream.getTracks().forEach((t) => t.stop());
          } catch {
            // ignore
          }
          activeStream = null;
        }
        stopAllActiveMediaStreams();
        if (activeAudioCtx) {
          try {
            activeAudioCtx.close().catch(() => {});
          } catch {
            // ignore
          }
          activeAudioCtx = null;
        }
        options.onAudioLevel?.(0);

        if (!hasSpoken && peakMicPct < 12 && !manualStopRequested) {
          emitFinalResult({
            ok: false,
            isMatch: false,
            isExact100: false,
            similarity: 0,
            transcript: "",
            allCandidates: [],
            timedOutNoSpeech: true,
            layerUsed: "none",
          });
          return;
        }

        options.onEvaluating?.("⏳ Sesiniz kontrol ediliyor...");

        const pcm16k = await extractPcm16kFromRecordedAudio(
          pcmFrames,
          pcmSampleRate,
          mediaChunks,
          recorderMimeType
        );

        if (aborted || resolved) return;

        if (!pcm16k || pcm16k.length < 1600) {
          emitFinalResult({
            ok: false,
            isMatch: false,
            isExact100: false,
            similarity: 0,
            transcript: "",
            allCandidates: [],
            timedOutNoSpeech: true,
            layerUsed: "none",
          });
          return;
        }

        const { text: sttText, source } = await transcribePcmViaServerOrWorker(
          pcm16k,
          {
            localSttOnly: options.localSttOnly,
            serverTimeoutMs: 5500,
            onStatus: options.onEvaluating,
          }
        );

        if (aborted || resolved) return;

        const cleanedText = (sttText || "").trim();
        if (!cleanedText) {
          emitFinalResult({
            ok: false,
            isMatch: false,
            isExact100: false,
            similarity: 0,
            transcript: "",
            allCandidates: [],
            timedOutNoSpeech: true,
            layerUsed: source,
          });
          return;
        }

        const evalRes = options.targetArabic
          ? matchArabicPronunciation(options.targetArabic, [cleanedText])
          : {
              isMatch: true,
              isExact100: false,
              similarity: 100,
              matchedText: cleanedText,
            };

        emitFinalResult({
          ok: true,
          isMatch: evalRes.isMatch,
          isExact100: evalRes.isExact100,
          similarity: evalRes.similarity,
          transcript: evalRes.matchedText || cleanedText,
          allCandidates: [cleanedText],
          timedOutNoSpeech: false,
          layerUsed: source,
        });
      };

      finalizeRecorderFn = finishAndTranscribeRecorder;
      options.onListeningStart?.("recorder");

      startWindowCountdown(() => {
        void finishAndTranscribeRecorder();
      });

      const tickSmartVad = () => {
        if (aborted || resolved || finalizingRecorder || !activeAudioCtx) return;
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }

        analyser.getByteTimeDomainData(timeData);
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          const norm = (timeData[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        const micLevel = Math.min(100, Math.round(rms * 330));

        const now = Date.now();
        const sinceMicOpenMs = now - recorderOpenedAt;

        // İLK 350ms KORUMASI: Hoparlör yankısı veya donanım açılış sıçramasını yoksay!
        if (sinceMicOpenMs < 350) {
          options.onAudioLevel?.(Math.min(12, Math.round(micLevel * 0.35)));
          activeVadRaf = requestAnimationFrame(tickSmartVad);
          return;
        }

        options.onAudioLevel?.(micLevel);
        if (micLevel > peakMicPct) peakMicPct = micLevel;

        // AKILLI VAD: Ses seviyesi > %15 ve en az 200ms kesintisiz sürerse hasSpoken = true!
        if (micLevel > 15) {
          silenceStartMs = null;
          if (sustainedVoiceStartMs === null) {
            sustainedVoiceStartMs = now;
          } else if (!hasSpoken && now - sustainedVoiceStartMs >= 200) {
            hasSpoken = true;
            options.onVoiceDetected?.();
          }
        } else {
          sustainedVoiceStartMs = null;
          // Konuşma başladıktan sonra >= 1200ms (1.2 sn) kesintisiz sessizlik olursa otomatik değerlendir!
          if (hasSpoken && micLevel < 10) {
            if (silenceStartMs === null) {
              silenceStartMs = now;
            } else if (now - silenceStartMs >= 1200) {
              void finishAndTranscribeRecorder();
              return;
            }
          }
        }

        activeVadRaf = requestAnimationFrame(tickSmartVad);
      };

      activeVadRaf = requestAnimationFrame(tickSmartVad);
    };

    // ------------------------------------------------------------------------
    // KATMAN 1: Çakışmasız Doğrudan SpeechRecognition (SIFIR getUserMedia!)
    // ------------------------------------------------------------------------
    if (canUseLayer1 && SpeechRecCtor) {
      stopAllActiveMediaStreams();

      const candidateSet = new Set<string>();
      let lastInterimTranscript = "";
      let speechDetectedInLayer1 = false;
      let lastSpeechActivityMs = 0;
      let simAudioEnergy = 18;
      let fallingBackToLayer2 = false;

      const collectAllCandidates = (): string[] => {
        const list = Array.from(candidateSet);
        if (
          lastInterimTranscript &&
          !candidateSet.has(lastInterimTranscript)
        ) {
          list.push(lastInterimTranscript);
        }
        return list.filter(Boolean);
      };

      const finishLayer1Evaluation = () => {
        if (aborted || resolved || fallingBackToLayer2) return;
        const allCands = collectAllCandidates();

        if (allCands.length === 0) {
          emitFinalResult({
            ok: false,
            isMatch: false,
            isExact100: false,
            similarity: 0,
            transcript: "",
            allCandidates: [],
            timedOutNoSpeech: true,
            layerUsed: "webspeech",
          });
          return;
        }

        if (options.targetArabic) {
          const matchRes = matchArabicPronunciation(
            options.targetArabic,
            allCands
          );
          emitFinalResult({
            ok: true,
            isMatch: matchRes.isMatch,
            isExact100: matchRes.isExact100,
            similarity: matchRes.similarity,
            transcript: matchRes.matchedText || allCands[0],
            allCandidates: allCands,
            timedOutNoSpeech: false,
            layerUsed: "webspeech",
          });
        } else {
          emitFinalResult({
            ok: true,
            isMatch: true,
            isExact100: false,
            similarity: 100,
            transcript: allCands[0],
            allCandidates: allCands,
            timedOutNoSpeech: false,
            layerUsed: "webspeech",
          });
        }
      };

      finalizeWebSpeechFn = () => {
        if (speechSettleTimer) {
          clearTimeout(speechSettleTimer);
          speechSettleTimer = null;
        }
        if (activeRec) {
          const r = activeRec;
          // Son hecenin gelmesi için stop() çağırıp 320ms bekle
          try {
            r.stop();
          } catch {
            finishLayer1Evaluation();
            return;
          }
          setTimeout(() => {
            if (!aborted && !resolved && !fallingBackToLayer2) {
              finishLayer1Evaluation();
            }
          }, 320);
        } else {
          finishLayer1Evaluation();
        }
      };

      // Katman 1 çalışırken getUserMedia açmadan canlı görsel ses çubuğu darbesi
      pulseInterval = setInterval(() => {
        if (aborted || resolved || fallingBackToLayer2) return;
        simAudioEnergy = Math.max(16, Math.round(simAudioEnergy * 0.78));
        const jitter = Math.round(Math.sin(Date.now() / 110) * 6);
        options.onAudioLevel?.(
          Math.max(14, Math.min(96, simAudioEnergy + jitter))
        );
      }, 90);

      startWindowCountdown(() => {
        finalizeWebSpeechFn?.();
      });

      const launchWebSpeech = () => {
        if (aborted || resolved || fallingBackToLayer2) return;
        try {
          const rec = new SpeechRecCtor();
          rec.lang = "ar-SA";
          rec.continuous = false;
          rec.interimResults = true;
          rec.maxAlternatives = 5;

          rec.onsoundstart = () => {
            simAudioEnergy = Math.max(simAudioEnergy, 55);
          };

          rec.onspeechstart = () => {
            simAudioEnergy = Math.max(simAudioEnergy, 72);
            if (!speechDetectedInLayer1) {
              speechDetectedInLayer1 = true;
              options.onVoiceDetected?.();
            }
            lastSpeechActivityMs = Date.now();
          };

          rec.onresult = (evt: SpeechRecognitionEventLike) => {
            if (aborted || resolved || fallingBackToLayer2) return;
            if (!evt.results || evt.results.length === 0) return;

            lastSpeechActivityMs = Date.now();
            simAudioEnergy = 82;
            if (!speechDetectedInLayer1) {
              speechDetectedInLayer1 = true;
              options.onVoiceDetected?.();
            }

            let primaryLatest = "";
            let sawFinal = false;

            // Tüm sonuçların tüm 5 alternatifini (maxAlternatives = 5) eksiksiz topla!
            const maxAltSegments: string[][] = [[], [], [], [], []];

            for (let i = 0; i < evt.results.length; i++) {
              const resItem = evt.results[i];
              if (!resItem) continue;
              if (resItem.isFinal) sawFinal = true;

              const altLen =
                typeof resItem.length === "number" ? resItem.length : 1;
              for (let a = 0; a < Math.min(5, altLen); a++) {
                const altText = (resItem[a]?.transcript || "").trim();
                if (altText) {
                  candidateSet.add(altText);
                  maxAltSegments[a].push(altText);
                  if (a === 0) {
                    primaryLatest = altText;
                  }
                }
              }
            }

            for (let a = 0; a < 5; a++) {
              if (maxAltSegments[a].length > 1) {
                const joined = maxAltSegments[a].join(" ").trim();
                if (joined) candidateSet.add(joined);
              }
            }

            if (primaryLatest) {
              lastInterimTranscript = primaryLatest;
            }

            const currentCandidates = collectAllCandidates();
            if (primaryLatest || currentCandidates.length > 0) {
              options.onInterimTranscript?.(
                primaryLatest || currentCandidates[0],
                currentCandidates
              );
            }

            // Hedef Arapça kelime/cümle verilmişse tüm alternatifleri ANINDA kontrol et:
            // Eşleştiği salisede kullanıcıyı bekletmeden DOĞRU kabul et!
            if (options.targetArabic && currentCandidates.length > 0) {
              const quickEval = matchArabicPronunciation(
                options.targetArabic,
                currentCandidates
              );
              if (quickEval.isMatch) {
                emitFinalResult({
                  ok: true,
                  isMatch: true,
                  isExact100: quickEval.isExact100,
                  similarity: quickEval.similarity,
                  transcript: quickEval.matchedText || primaryLatest,
                  allCandidates: currentCandidates,
                  timedOutNoSpeech: false,
                  layerUsed: "webspeech",
                });
                return;
              }
            }

            // Konuşma sonrası 1200ms sessizlikte değerlendirmeyi tamamla (erken kesmeyi önler)
            if (speechSettleTimer) clearTimeout(speechSettleTimer);
            speechSettleTimer = setTimeout(
              () => {
                if (!aborted && !resolved && !fallingBackToLayer2) {
                  finalizeWebSpeechFn?.();
                }
              },
              sawFinal ? 750 : 1250
            );
          };

          rec.onerror = (errEvt: { error?: string }) => {
            if (aborted || resolved || fallingBackToLayer2) return;
            const code = errEvt?.error || "";

            // Brave, ağ engeli veya mikrofon çakışması durumunda ANINDA Katman 2'ye (MediaRecorder + /api/stt + Whisper) geç!
            if (
              code === "network" ||
              code === "service-not-allowed" ||
              code === "not-allowed" ||
              code === "audio-capture"
            ) {
              webSpeechBlockedInSession = true;
              fallingBackToLayer2 = true;
              if (pulseInterval) {
                clearInterval(pulseInterval);
                pulseInterval = null;
              }
              activeRec = null;
              void startLayer2Recorder();
              return;
            }

            if (
              code === "aborted" &&
              !manualStopRequested &&
              collectAllCandidates().length === 0 &&
              Date.now() - windowStartMs < 1800
            ) {
              webSpeechBlockedInSession = true;
              fallingBackToLayer2 = true;
              if (pulseInterval) {
                clearInterval(pulseInterval);
                pulseInterval = null;
              }
              activeRec = null;
              void startLayer2Recorder();
            }
          };

          rec.onend = () => {
            if (aborted || resolved || fallingBackToLayer2) return;
            const allCands = collectAllCandidates();

            // Eğer aday metinler yakalandıysa tüm alternatifleri + lastInterimTranscript'i kontrol et
            if (allCands.length > 0 && options.targetArabic) {
              const check = matchArabicPronunciation(
                options.targetArabic,
                allCands
              );
              if (check.isMatch) {
                emitFinalResult({
                  ok: true,
                  isMatch: true,
                  isExact100: check.isExact100,
                  similarity: check.similarity,
                  transcript: check.matchedText || allCands[0],
                  allCandidates: allCands,
                  timedOutNoSpeech: false,
                  layerUsed: "webspeech",
                });
                return;
              }
            }

            if (manualStopRequested) {
              finishLayer1Evaluation();
              return;
            }

            // Kullanıcı konuştuysa ve son kelimenin üzerinden >= 900ms geçtiyse değerlendir
            if (
              allCands.length > 0 &&
              Date.now() - lastSpeechActivityMs >= 900
            ) {
              finishLayer1Evaluation();
              return;
            }

            // Pencere süresi devam ediyorsa dinlemeyi sürdür
            const elapsed = Date.now() - windowStartMs;
            if (elapsed < listenWindowMs - 650 && activeRec === rec) {
              setTimeout(() => {
                if (
                  !aborted &&
                  !resolved &&
                  !fallingBackToLayer2 &&
                  !manualStopRequested
                ) {
                  launchWebSpeech();
                }
              }, 80);
            } else {
              finishLayer1Evaluation();
            }
          };

          activeRec = rec;
          rec.start();
          options.onListeningStart?.("webspeech");
        } catch {
          webSpeechBlockedInSession = true;
          fallingBackToLayer2 = true;
          if (pulseInterval) {
            clearInterval(pulseInterval);
            pulseInterval = null;
          }
          activeRec = null;
          void startLayer2Recorder();
        }
      };

      launchWebSpeech();
      return;
    }

    // Brave, Firefox veya WebSpeech desteklemeyen tarayıcılarda doğrudan Katman 2 & 3!
    await startLayer2Recorder();
  };

  if (echoGuardMs > 0) {
    echoGuardTimer = setTimeout(() => {
      echoGuardTimer = null;
      void beginSessionAfterGuard();
    }, echoGuardMs);
  } else {
    void beginSessionAfterGuard();
  }

  return {
    stopManual: () => {
      if (aborted || resolved) return;
      manualStopRequested = true;
      if (finalizeWebSpeechFn) {
        finalizeWebSpeechFn();
      } else if (finalizeRecorderFn) {
        void finalizeRecorderFn();
      }
    },
    abort: () => {
      if (aborted || resolved) return;
      aborted = true;
      cleanupAll();
    },
    isActive: () => !aborted && !resolved,
  };
}
