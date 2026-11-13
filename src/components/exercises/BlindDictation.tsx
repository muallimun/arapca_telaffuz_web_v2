"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Delete,
  Eye,
  Headphones,
  Keyboard,
  Puzzle,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Timer,
  Trophy,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import {
  cumleler1111,
  diyaloglar,
  gorselKelimeler,
  resolveAudioUrl,
} from "@/lib/data";
import type { Level } from "@/types/data";
import {
  playAudioElement,
  playDualGenderAudio,
  speakHybrid,
  stopAllAudio,
} from "@/lib/audio";
import {
  canonicalizeArabicDiacritics,
  fixArabicTypography,
  normalizeArabicText,
  removeArabicHarakat,
} from "@/lib/arabicTextUtils";
import ArabicVirtualKeyboard from "@/components/ui/ArabicVirtualKeyboard";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import {
  playClick,
  playFanfare,
  playSuccess,
  playWrong,
} from "@/lib/sfxManager";

export type BlindWorkshopTab = "dictation" | "tashkeel";
export type DictationInputStyle = "tiles" | "keyboard";

export interface BlindDictationProps {
  cefrFilter?: "all" | Level;
  grammarFilter?: string;
  questionCount?: 10 | 20 | 30;
  timeLimit?: number | null;
  initialWorkshopTab?: BlindWorkshopTab;
  onClose?: () => void;
}

interface AudioSentenceEntry {
  id: string;
  sourceItemId: string;
  level: Level;
  arabic: string;
  turkish: string;
  sourceLabel: string;
  sesErkek?: string;
  sesKadin?: string;
  directAudioUrl?: string;
  dialogueId?: string;
  lineSira?: number;
}

interface WordTile {
  tileId: string;
  text: string;
}

interface TashkeelTargetSlot {
  wordIndex: number;
  originalWord: string;
  maskedStem: string;
  leadingPunct: string;
  trailingPunct: string;
  expectedHarakaId: string;
  expectedDisplayWord: string;
}

const HARAKA_STONES = [
  { id: "damma", char: "\u064F", label: "ـُ", name: "Damme (Ötre)" },
  { id: "fatha", char: "\u064E", label: "ـَ", name: "Fetha (Üstün)" },
  { id: "kasra", char: "\u0650", label: "ـِ", name: "Kesra (Esre)" },
  { id: "tanwin_damma", char: "\u064C", label: "ـٌ", name: "Tenvîn Damme" },
  { id: "tanwin_fatha", char: "\u064B", label: "ـً", name: "Tenvîn Fetha" },
  { id: "tanwin_kasra", char: "\u064D", label: "ـٍ", name: "Tenvîn Kesra" },
  { id: "sukun", char: "\u0652", label: "ـْ", name: "Sükûn (Cezim)" },
] as const;

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cleanWordPunctuation(token: string): {
  leading: string;
  core: string;
  trailing: string;
} {
  const leadMatch = token.match(/^([.,،؛؟?!()"'«»[\]{}:…]+)/);
  const leading = leadMatch ? leadMatch[1] : "";
  const rest = leading ? token.slice(leading.length) : token;
  const trailMatch = rest.match(/([.,،؛؟?!()"'«»[\]{}:…]+)$/);
  const trailing = trailMatch ? trailMatch[1] : "";
  const core = trailing ? rest.slice(0, -trailing.length) : rest;
  return { leading, core, trailing };
}

function tokenizeSentenceWords(sentence: string): string[] {
  return sentence
    .trim()
    .split(/\s+/)
    .map((w) => cleanWordPunctuation(w).core.trim())
    .filter((w) => w.length > 0);
}

/**
 * Kelimenin son harfindeki i'rab harekesini çözümler ve maskelenmiş gövdeyi döndürür.
 * Tenvîn fetha + sessiz elif (`كِتَابًا` veya `كِتَاباً`) kopya vermemesi için gövdeden temizlenir.
 */
function extractFinalIrabSlot(
  rawWord: string,
  wordIndex: number
): TashkeelTargetSlot | null {
  const { leading, core, trailing } = cleanWordPunctuation(rawWord);
  const canon = canonicalizeArabicDiacritics(core.normalize("NFC"));
  const baseLetters = removeArabicHarakat(canon);
  if (baseLetters.length < 2) return null;

  // Tenvin fetha + elif (ـًا veya ـاً) kontrolü
  if (/\u064Bا$/u.test(canon) || /ا\u064B$/u.test(canon)) {
    const stem = canon.replace(/(?:\u064Bا|ا\u064B)$/u, "");
    if (removeArabicHarakat(stem).length >= 2) {
      return {
        wordIndex,
        originalWord: rawWord,
        maskedStem: stem,
        leadingPunct: leading,
        trailingPunct: trailing,
        expectedHarakaId: "tanwin_fatha",
        expectedDisplayWord: `${leading}${core}${trailing}`,
      };
    }
  }

  // Son harfin üzerindeki harekeleri ayır
  const match = canon.match(/^([\s\S]*?[\u0621-\u064A])([\u064B-\u0652\u0670]+)$/u);
  if (!match) return null;

  const stemWithLastLetter = match[1];
  const marks = match[2];

  // Med harfiyle (harekesiz ا / و / ي / ى) biten mebni kelimeleri eleme: match zaten sonunda hareke olanları yakalar
  const hasShadda = marks.includes("\u0651");
  const vocalicMark = marks.replace(/\u0651/g, "");

  let harakaId: string | null = null;
  if (vocalicMark === "\u064F") harakaId = "damma";
  else if (vocalicMark === "\u064E") harakaId = "fatha";
  else if (vocalicMark === "\u0650") harakaId = "kasra";
  else if (vocalicMark === "\u064C") harakaId = "tanwin_damma";
  else if (vocalicMark === "\u064B") harakaId = "tanwin_fatha";
  else if (vocalicMark === "\u064D") harakaId = "tanwin_kasra";
  else if (vocalicMark === "\u0652") harakaId = "sukun";

  if (!harakaId) return null;

  const maskedStem = hasShadda
    ? `${stemWithLastLetter}\u0651`
    : stemWithLastLetter;

  return {
    wordIndex,
    originalWord: rawWord,
    maskedStem,
    leadingPunct: leading,
    trailingPunct: trailing,
    expectedHarakaId: harakaId,
    expectedDisplayWord: `${leading}${core}${trailing}`,
  };
}

function applyHarakaPreview(slot: TashkeelTargetSlot, harakaId: string): string {
  const stone = HARAKA_STONES.find((s) => s.id === harakaId);
  if (!stone) return `${slot.leadingPunct}${slot.maskedStem}${slot.trailingPunct}`;
  if (harakaId === slot.expectedHarakaId) {
    return slot.expectedDisplayWord;
  }
  if (
    harakaId === "tanwin_fatha" &&
    !slot.maskedStem.endsWith("ة") &&
    !slot.maskedStem.endsWith("ى") &&
    !slot.maskedStem.startsWith("ال")
  ) {
    return `${slot.leadingPunct}${slot.maskedStem}\u064Bا${slot.trailingPunct}`;
  }
  return `${slot.leadingPunct}${slot.maskedStem}${stone.char}${slot.trailingPunct}`;
}

export interface SpellingWordDiff {
  expectedWord: string;
  typedWord: string;
  status: "exact" | "hamza_ya_ta_diff" | "wrong";
  hintNote?: string;
}

/**
 * Klavyeyle imla modunda NFC normalize edilmiş harekesiz harf uyumunu inceler;
 * hemze (أ/إ/آ/ء vs ا), elif-i maksûre / yâ (ى vs ي) ve tâ-i merbûta (ة vs ه) farklarını renkli diff olarak raporlar.
 */
function evaluateUnvocalizedSpelling(
  expectedSentence: string,
  typedSentence: string
): {
  isExactSkeleton: boolean;
  isPhoneticNearMatch: boolean;
  wordDiffs: SpellingWordDiff[];
} {
  const cleanSkeleton = (str: string) =>
    removeArabicHarakat(str.normalize("NFC"))
      .replace(/\u0640+/g, "")
      .replace(/[.,،؛؟?!()"'«»[\]{}\-–—:…]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const expWords = cleanSkeleton(expectedSentence).split(" ").filter(Boolean);
  const typWords = cleanSkeleton(typedSentence).split(" ").filter(Boolean);

  const wordDiffs: SpellingWordDiff[] = expWords.map((expW, idx) => {
    const typW = typWords[idx] || "";
    if (expW === typW) {
      return { expectedWord: expW, typedWord: typW, status: "exact" };
    }

    if (typW && normalizeArabicText(expW) === normalizeArabicText(typW)) {
      const notes: string[] = [];
      if (/[أإآءؤئ]/.test(expW) !== /[أإآءؤئ]/.test(typW) || expW.replace(/[^أإآا]/g, "") !== typW.replace(/[^أإآا]/g, "")) {
        notes.push("Hemze (أ / إ / آ / ا) yazımına dikkat");
      }
      if (expW.includes("ى") !== typW.includes("ى")) {
        notes.push("Elif-i maksûre (ى) / Yâ (ي) farkı");
      }
      if (expW.includes("ة") !== typW.includes("ة")) {
        notes.push("Kapalı tâ (ة) / Hâ (ه) farkı");
      }
      return {
        expectedWord: expW,
        typedWord: typW,
        status: "hamza_ya_ta_diff",
        hintNote: notes.join(" · ") || "İmla inceliği farkı",
      };
    }

    return {
      expectedWord: expW,
      typedWord: typW || "—",
      status: "wrong",
    };
  });

  const sameLength = expWords.length === typWords.length;
  const isExactSkeleton =
    sameLength && wordDiffs.every((d) => d.status === "exact");
  const isPhoneticNearMatch =
    sameLength &&
    wordDiffs.every(
      (d) => d.status === "exact" || d.status === "hamza_ya_ta_diff"
    );

  return { isExactSkeleton, isPhoneticNearMatch, wordDiffs };
}

function buildAudioSentenceCatalog(): AudioSentenceEntry[] {
  const entries: AudioSentenceEntry[] = [];

  // 1. 1111 Kalıp Cümle (2–8 kelimelik net cümleler)
  for (const c of cumleler1111) {
    const wordCount = tokenizeSentenceWords(c.arapca).length;
    if (wordCount < 2 || wordCount > 9) continue;
    entries.push({
      id: `bd_c_${c.id}`,
      sourceItemId: c.id,
      level: c.seviye || "A1",
      arabic: c.arapca,
      turkish: c.turkce,
      sourceLabel: `Günlük Cümle · ${c.tema}`,
      sesErkek: c.ses_erkek,
      sesKadin: c.ses_kadin,
    });
  }

  // 2. Diyalog satırları
  for (const dlg of diyaloglar) {
    for (const line of dlg.satirlar) {
      const wordCount = tokenizeSentenceWords(line.arapca).length;
      if (wordCount < 3 || wordCount > 8) continue;
      entries.push({
        id: `bd_d_${dlg.id}_${line.sira}`,
        sourceItemId: dlg.id,
        level: dlg.seviye,
        arabic: line.arapca,
        turkish: line.turkce,
        sourceLabel: `Diyalog · ${dlg.baslik_tr}`,
        directAudioUrl: line.ses_dosyasi
          ? resolveAudioUrl(line.ses_dosyasi)
          : undefined,
        dialogueId: dlg.id,
        lineSira: line.sira,
      });
    }
  }

  // 3. Görsel Kelime örnek cümleleri
  for (const gk of gorselKelimeler) {
    if (!gk.ornek_ar || !gk.ornek_tr) continue;
    const wordCount = tokenizeSentenceWords(gk.ornek_ar).length;
    if (wordCount < 2 || wordCount > 8) continue;
    entries.push({
      id: `bd_v_${gk.id}`,
      sourceItemId: gk.id,
      level: gk.cefr || "A1",
      arabic: gk.ornek_ar,
      turkish: gk.ornek_tr,
      sourceLabel: `Görsel Kelime Örneği · ${gk.kategori_tr}`,
      sesErkek: gk.ornek_ses_erkek || undefined,
      sesKadin: gk.ornek_ses_kadin || undefined,
    });
  }

  return entries;
}

export default function BlindDictation({
  cefrFilter = "all",
  questionCount = 10,
  timeLimit = null,
  initialWorkshopTab = "dictation",
  onClose,
}: BlindDictationProps) {
  const { arabicFont, preferredVoiceGender } = useSettings();
  const {
    recordSkillAttempt,
    recordItemAttempt,
    addMistake,
    addStudyMinutes,
  } = useUserStore();

  const [workshopTab, setWorkshopTab] =
    useState<BlindWorkshopTab>(initialWorkshopTab);
  const [dictationStyle, setDictationStyle] =
    useState<DictationInputStyle>("tiles");
  const [useDeviceKeyboard, setUseDeviceKeyboard] = useState(false);
  const [showTurkishHint, setShowTurkishHint] = useState(false);

  const [roundSeed, setRoundSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [playingSpeed, setPlayingSpeed] = useState<"1x" | "0.75x" | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    timeLimit
  );

  // MOD A (Kör Dikte) state
  const [placedTileIds, setPlacedTileIds] = useState<string[]>([]);
  const [typedText, setTypedText] = useState("");
  const [dictationEval, setDictationEval] = useState<
    "idle" | "correct" | "near" | "wrong"
  >("idle");
  const [spellingDiffs, setSpellingDiffs] = useState<SpellingWordDiff[]>([]);

  // MOD B (İ'rab & Son Hareke Atölyesi) state
  const [activeSlotIdx, setActiveSlotIdx] = useState(0);
  const [slotSelections, setSlotSelections] = useState<Record<number, string>>(
    {}
  );
  const [tashkeelEval, setTashkeelEval] = useState<"idle" | "correct" | "wrong">(
    "idle"
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimers = useCallback(() => {
    if (audioTimerRef.current) {
      clearTimeout(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const fullCatalog = useMemo(() => buildAudioSentenceCatalog(), []);

  const sessionEntries = useMemo(() => {
    void roundSeed;
    let pool =
      cefrFilter === "all"
        ? fullCatalog
        : fullCatalog.filter((e) => e.level === cefrFilter);
    if (pool.length < 4) pool = fullCatalog;

    if (workshopTab === "tashkeel") {
      const validTashkeel = pool.filter((entry) => {
        const rawWords = entry.arabic.trim().split(/\s+/).filter(Boolean);
        return rawWords.some((w, idx) => extractFinalIrabSlot(w, idx) !== null);
      });
      if (validTashkeel.length >= 4) {
        pool = validTashkeel;
      }
    }

    return shuffleArray(pool).slice(0, Math.min(questionCount, pool.length));
  }, [cefrFilter, fullCatalog, questionCount, roundSeed, workshopTab]);

  const currentEntry = sessionEntries[currentIndex] || null;

  // Kör Dikte için karıştırılmış kelime taşları (+2 yanıltıcı kelime)
  const currentWordTiles: WordTile[] = useMemo(() => {
    if (!currentEntry) return [];
    const targetWords = tokenizeSentenceWords(currentEntry.arabic);
    const targetNormSet = new Set(targetWords.map((w) => normalizeArabicText(w)));

    const distractorCandidates = shuffleArray(
      fullCatalog
        .filter((e) => e.level === currentEntry.level && e.id !== currentEntry.id)
        .slice(0, 25)
        .flatMap((e) => tokenizeSentenceWords(e.arabic))
        .filter(
          (w) =>
            w.length >= 2 &&
            !targetNormSet.has(normalizeArabicText(w))
        )
    );

    const uniqueDistractors: string[] = [];
    for (const cand of distractorCandidates) {
      if (uniqueDistractors.length >= 2) break;
      if (
        !uniqueDistractors.some(
          (u) => normalizeArabicText(u) === normalizeArabicText(cand)
        )
      ) {
        uniqueDistractors.push(cand);
      }
    }

    const allWords = [...targetWords, ...uniqueDistractors];
    return shuffleArray(
      allWords.map((text, idx) => ({
        tileId: `${currentEntry.id}_tile_${idx}`,
        text,
      }))
    );
  }, [currentEntry, fullCatalog]);

  // MOD B (Tashkeel) için hedef kelime slotları (1 veya B1/B2'de 2 kelime)
  const tashkeelSlots: TashkeelTargetSlot[] = useMemo(() => {
    if (!currentEntry) return [];
    const rawWords = currentEntry.arabic.trim().split(/\s+/).filter(Boolean);
    const candidates: TashkeelTargetSlot[] = [];
    rawWords.forEach((w, idx) => {
      const slot = extractFinalIrabSlot(w, idx);
      if (slot) candidates.push(slot);
    });
    if (candidates.length === 0) return [];
    const maxTargets =
      (currentEntry.level === "B1" || currentEntry.level === "B2") &&
      candidates.length >= 3
        ? 2
        : 1;
    // Cümlenin sonundaki ve ortasındaki anlamlı isim/fiilleri önceliklendir
    const picked = candidates.slice(-maxTargets);
    return picked;
  }, [currentEntry]);

  const playEntryAudio = useCallback(
    async (entry: AudioSentenceEntry, rate: number) => {
      setPlayingSpeed(rate < 0.9 ? "0.75x" : "1x");
      try {
        if (entry.dialogueId && entry.lineSira !== undefined) {
          await speakHybrid({
            text: entry.arabic,
            dialogueId: entry.dialogueId,
            lineSira: entry.lineSira,
            rate,
          });
        } else if (entry.sesErkek || entry.sesKadin || entry.sourceItemId.startsWith("cumle_")) {
          await playDualGenderAudio({
            text: entry.arabic,
            id: entry.sourceItemId,
            ses_erkek: entry.sesErkek,
            ses_kadin: entry.sesKadin,
            gender: preferredVoiceGender,
            rate,
          });
        } else if (entry.directAudioUrl) {
          await playAudioElement(entry.directAudioUrl, rate);
        } else {
          await speakHybrid({ text: entry.arabic, rate });
        }
      } finally {
        setPlayingSpeed(null);
      }
    },
    [preferredVoiceGender]
  );

  // Kör Dikte modunda yeni soru geldiğinde otomatik 1 kez seslendir
  useEffect(() => {
    if (!currentEntry || isCompleted || workshopTab !== "dictation") return;
    const t = setTimeout(() => {
      void playEntryAudio(currentEntry, 1.0);
    }, 280);
    return () => clearTimeout(t);
  }, [currentEntry, isCompleted, playEntryAudio, workshopTab]);

  useEffect(() => {
    return () => {
      clearPendingTimers();
      stopAllAudio();
    };
  }, [clearPendingTimers]);

  const resetQuestionState = useCallback(() => {
    clearPendingTimers();
    stopAllAudio();
    setPlacedTileIds([]);
    setTypedText("");
    setDictationEval("idle");
    setSpellingDiffs([]);
    setShowTurkishHint(false);
    setActiveSlotIdx(0);
    setSlotSelections({});
    setTashkeelEval("idle");
    setRemainingSeconds(timeLimit);
  }, [clearPendingTimers, timeLimit]);

  // İsteğe bağlı süre sayacı
  useEffect(() => {
    if (
      !timeLimit ||
      isCompleted ||
      remainingSeconds === null ||
      remainingSeconds <= 0 ||
      dictationEval === "correct" ||
      dictationEval === "near" ||
      dictationEval === "wrong" ||
      tashkeelEval === "correct" ||
      tashkeelEval === "wrong"
    ) {
      return;
    }
    const timer = setTimeout(() => {
      if (remainingSeconds <= 1) {
        setRemainingSeconds(0);
        if (currentEntry) {
          void playWrong();
          recordSkillAttempt("imla", false);
          recordSkillAttempt("dinleme", false);
          recordItemAttempt(
            currentEntry.sourceItemId,
            "sentence",
            false,
            showTurkishHint,
            20,
            "Kör Dikte: Süre doldu"
          );
          addMistake(currentEntry.sourceItemId);
          setStreak(0);
          if (workshopTab === "dictation") setDictationEval("wrong");
          else setTashkeelEval("wrong");
        }
      } else {
        setRemainingSeconds((s) => (s !== null ? s - 1 : null));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    addMistake,
    currentEntry,
    dictationEval,
    isCompleted,
    recordItemAttempt,
    recordSkillAttempt,
    remainingSeconds,
    showTurkishHint,
    tashkeelEval,
    timeLimit,
    workshopTab,
  ]);

  const handleCheckDictation = async () => {
    if (!currentEntry || dictationEval !== "idle") return;

    if (dictationStyle === "tiles") {
      const targetWords = tokenizeSentenceWords(currentEntry.arabic);
      const chosenWords = placedTileIds
        .map((id) => currentWordTiles.find((t) => t.tileId === id)?.text || "")
        .filter(Boolean);

      const isRight =
        chosenWords.length === targetWords.length &&
        chosenWords.every(
          (w, idx) =>
            normalizeArabicText(w) === normalizeArabicText(targetWords[idx])
        );

      recordSkillAttempt("dinleme", isRight);
      recordSkillAttempt("imla", isRight);
      recordItemAttempt(
        currentEntry.sourceItemId,
        "sentence",
        isRight,
        showTurkishHint,
        isRight ? 100 : 35,
        "Kör Dikte (Kelime Taşları)"
      );

      if (isRight) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        setCorrectCount((c) => c + 1);
        setDictationEval("correct");
        await playSuccess({ streak: nextStreak });
        clearPendingTimers();
        audioTimerRef.current = setTimeout(() => {
          audioTimerRef.current = null;
          void playEntryAudio(currentEntry, 1.0);
        }, 250);
      } else {
        setStreak(0);
        addMistake(currentEntry.sourceItemId);
        setDictationEval("wrong");
        await playWrong();
      }
      return;
    }

    // Klavyeyle İmla değerlendirmesi
    const result = evaluateUnvocalizedSpelling(currentEntry.arabic, typedText);
    setSpellingDiffs(result.wordDiffs);

    const passed = result.isExactSkeleton || result.isPhoneticNearMatch;
    recordSkillAttempt("imla", result.isExactSkeleton);
    recordSkillAttempt("dinleme", passed);
    recordItemAttempt(
      currentEntry.sourceItemId,
      "sentence",
      passed,
      showTurkishHint,
      result.isExactSkeleton ? 100 : result.isPhoneticNearMatch ? 80 : 30,
      "Kör Dikte (Klavye İmla)"
    );

    if (passed) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setCorrectCount((c) => c + 1);
      setDictationEval(result.isExactSkeleton ? "correct" : "near");
      await playSuccess({ streak: nextStreak });
      clearPendingTimers();
      audioTimerRef.current = setTimeout(() => {
        audioTimerRef.current = null;
        void playEntryAudio(currentEntry, 1.0);
      }, 250);
    } else {
      setStreak(0);
      addMistake(currentEntry.sourceItemId);
      setDictationEval("wrong");
      await playWrong();
    }
  };

  const handleApplyHarakaStone = useCallback(
    async (harakaId: string) => {
      if (!currentEntry || tashkeelEval !== "idle" || tashkeelSlots.length === 0) {
        return;
      }
      playClick();

      const targetSlot = tashkeelSlots[activeSlotIdx] || tashkeelSlots[0];
      const updated = {
        ...slotSelections,
        [targetSlot.wordIndex]: harakaId,
      };
      setSlotSelections(updated);

      // Eğer birden fazla boşluk varsa sıradaki boşluğa odaklan
      const nextUnfilledIdx = tashkeelSlots.findIndex(
        (s) => !updated[s.wordIndex]
      );
      if (nextUnfilledIdx !== -1) {
        setActiveSlotIdx(nextUnfilledIdx);
        return;
      }

      // Tüm boşluklar doldurulduysa anında değerlendir
      const allRight = tashkeelSlots.every(
        (s) => updated[s.wordIndex] === s.expectedHarakaId
      );

      recordSkillAttempt("imla", allRight);
      recordSkillAttempt("gramer", allRight);
      recordItemAttempt(
        currentEntry.sourceItemId,
        "sentence",
        allRight,
        false,
        allRight ? 100 : 40,
        "İ'rab & Son Hareke Atölyesi"
      );

      if (allRight) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        setCorrectCount((c) => c + 1);
        setTashkeelEval("correct");
        await playSuccess({ streak: nextStreak });
        clearPendingTimers();
        audioTimerRef.current = setTimeout(() => {
          audioTimerRef.current = null;
          void playEntryAudio(currentEntry, 1.0);
        }, 250);
      } else {
        setStreak(0);
        addMistake(currentEntry.sourceItemId);
        setTashkeelEval("wrong");
        await playWrong();
      }
    },
    [
      activeSlotIdx,
      addMistake,
      clearPendingTimers,
      currentEntry,
      playEntryAudio,
      recordItemAttempt,
      recordSkillAttempt,
      slotSelections,
      streak,
      tashkeelEval,
      tashkeelSlots,
    ]
  );

  const handleNextQuestion = useCallback(() => {
    clearPendingTimers();
    playClick();
    if (currentIndex + 1 < sessionEntries.length) {
      setCurrentIndex((i) => i + 1);
      resetQuestionState();
    } else {
      stopAllAudio();
      addStudyMinutes(3);
      const pct =
        sessionEntries.length > 0
          ? Math.round((correctCount / sessionEntries.length) * 100)
          : 100;
      void playFanfare(pct);
      setIsCompleted(true);
    }
  }, [
    addStudyMinutes,
    clearPendingTimers,
    correctCount,
    currentIndex,
    resetQuestionState,
    sessionEntries.length,
  ]);

  const isQuestionDoneForShortcuts =
    workshopTab === "dictation"
      ? dictationEval !== "idle"
      : tashkeelEval !== "idle";

  useEffect(() => {
    if (isCompleted || !currentEntry) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.querySelector(
          '[role="dialog"], .fixed.inset-0:not(svg):not([data-smartboard-canvas])'
        )
      ) {
        return;
      }
      const targetEl = e.target as HTMLElement | null;
      const isTypingTarget =
        targetEl?.tagName === "INPUT" ||
        targetEl?.tagName === "TEXTAREA" ||
        targetEl?.isContentEditable;

      if (isQuestionDoneForShortcuts && e.key === "Enter" && !isTypingTarget) {
        e.preventDefault();
        handleNextQuestion();
        return;
      }

      if (
        workshopTab === "tashkeel" &&
        tashkeelEval === "idle" &&
        !isTypingTarget
      ) {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < HARAKA_STONES.length) {
          e.preventDefault();
          void handleApplyHarakaStone(HARAKA_STONES[idx].id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentEntry,
    handleApplyHarakaStone,
    handleNextQuestion,
    isCompleted,
    isQuestionDoneForShortcuts,
    tashkeelEval,
    workshopTab,
  ]);

  const switchWorkshopTab = (nextTab: BlindWorkshopTab) => {
    if (nextTab === workshopTab) return;
    playClick();
    setWorkshopTab(nextTab);
    setCurrentIndex(0);
    setCorrectCount(0);
    setStreak(0);
    setIsCompleted(false);
    resetQuestionState();
  };

  if (!currentEntry) {
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 text-center space-y-4">
        <p className="text-sm font-bold text-[var(--foreground)]">
          Bu filtre için sesli cümle kaydı bulunamadı.
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
    const accuracy = Math.round((correctCount / sessionEntries.length) * 100);
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 sm:p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-400 flex items-center justify-center text-[#087F5B] dark:text-emerald-300">
          <Trophy size={32} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-[var(--foreground)]">
            {workshopTab === "dictation"
              ? "Kör Dikte Oturumu Tamamlandı!"
              : "İ'rab & Son Hareke Atölyesi Tamamlandı!"}
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
            Doğruluk Oranı:{" "}
            <strong className="text-[#087F5B] dark:text-emerald-400 tabular-nums">
              %{accuracy} ({correctCount}/{sessionEntries.length})
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
              setCorrectCount(0);
              setStreak(0);
              setIsCompleted(false);
              resetQuestionState();
            }}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCcw size={16} />
            <span>Yeni Cümlelerle Tekrarla</span>
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

  const rawSentenceWords = currentEntry.arabic.trim().split(/\s+/).filter(Boolean);
  const isQuestionFinished =
    workshopTab === "dictation"
      ? dictationEval !== "idle"
      : tashkeelEval !== "idle";

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Üst Sekmeli Mod Seçici: MOD A (Kör Dikte) | MOD B (İ'rab & Son Hareke Atölyesi) */}
      <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => switchWorkshopTab("dictation")}
          className={`min-h-[48px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
            workshopTab === "dictation"
              ? "bg-[#6741D9] text-white shadow-xs"
              : "text-[var(--foreground)] hover:bg-white/70 dark:hover:bg-[var(--background)]"
          }`}
        >
          <Headphones size={16} className="shrink-0" />
          <span>Kör Dikte (Dinle &amp; Yaz / Diz)</span>
        </button>

        <button
          type="button"
          onClick={() => switchWorkshopTab("tashkeel")}
          className={`min-h-[48px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
            workshopTab === "tashkeel"
              ? "bg-[#087F5B] text-white shadow-xs"
              : "text-[var(--foreground)] hover:bg-white/70 dark:hover:bg-[var(--background)]"
          }`}
        >
          <Sparkles size={16} className="shrink-0" />
          <span>İ&apos;rab &amp; Son Hareke Atölyesi</span>
        </button>
      </div>

      {/* Üst İlerleme Satırı */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-extrabold text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--foreground)] tabular-nums">
            Soru {currentIndex + 1} / {sessionEntries.length}
          </span>
          <span aria-hidden="true">·</span>
          <span>Seviye {currentEntry.level}</span>
          <span aria-hidden="true">·</span>
          <span>{currentEntry.sourceLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          {streak >= 2 && (
            <span className="text-amber-700 dark:text-amber-300 tabular-nums">
              Seri: {streak}x
            </span>
          )}
          {remainingSeconds !== null && (
            <span className="inline-flex items-center gap-1 tabular-nums text-[var(--foreground)]">
              <Timer size={14} />
              <span>{remainingSeconds}s</span>
            </span>
          )}
        </div>
      </div>

      {/* ANA ATÖLYE KARTI */}
      <div className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-4 sm:p-6 space-y-5 shadow-xs">
        {workshopTab === "dictation" ? (
          <>
            {/* MOD A ÜST BAR: Kelime Taşları vs Klavyeyle İmla + Türkçe İpucu */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E6D7BE]/70 dark:border-[var(--border)]">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    if (dictationEval !== "idle") return;
                    playClick();
                    setDictationStyle("tiles");
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                    dictationStyle === "tiles"
                      ? "bg-[#087F5B] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Puzzle size={14} />
                  <span>Kelime Taşları</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (dictationEval !== "idle") return;
                    playClick();
                    setDictationStyle("keyboard");
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                    dictationStyle === "keyboard"
                      ? "bg-[#6741D9] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Keyboard size={14} />
                  <span>Klavyeyle İmla</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setShowTurkishHint((v) => !v);
                }}
                className="min-h-[48px] px-3.5 py-2 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Eye size={14} className="text-[#6741D9] shrink-0" />
                <span>
                  {showTurkishHint ? "Anlam İpucunu Gizle" : "🇹🇷 Türkçe Anlam İpucu"}
                </span>
              </button>
            </div>

            {/* SESLENDİRME KONTROLLERİ (Normal 1.0x & Yavaş 0.75x) */}
            <div className="rounded-2xl bg-[#F3F0FF]/80 dark:bg-indigo-950/35 border border-[#6741D9]/30 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-extrabold text-[#4C28B5] dark:text-indigo-200">
                  {dictationEval === "idle"
                    ? "Arapça metin gizlidir. Cümleyi dinleyip duyduğunuz sırayla oluşturun:"
                    : "Cümlenin Orijinal Harekeli Metni:"}
                </p>
                {showTurkishHint && (
                  <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    “{currentEntry.turkish}”
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    void playEntryAudio(currentEntry, 1.0);
                  }}
                  className={`min-h-[48px] px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 border-2 cursor-pointer ${
                    playingSpeed === "1x"
                      ? "bg-[#6741D9] text-white border-[#5230B5]"
                      : "bg-white dark:bg-[var(--background)] border-[#6741D9]/45 text-[#4C28B5] dark:text-indigo-200 hover:border-[#6741D9]"
                  }`}
                >
                  <Volume2 size={16} />
                  <span>Normal (1.0x)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    void playEntryAudio(currentEntry, 0.75);
                  }}
                  className={`min-h-[48px] px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 border-2 cursor-pointer ${
                    playingSpeed === "0.75x"
                      ? "bg-amber-500 text-slate-950 border-amber-600"
                      : "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:border-amber-500"
                  }`}
                >
                  <span>🐢 Yavaş (0.75x)</span>
                </button>
              </div>
            </div>

            {/* KELİME TAŞLARI MODU */}
            {dictationStyle === "tiles" ? (
              <div className="space-y-4">
                {/* Kurulan sağdan sola cümle kutusu */}
                <div
                  dir="rtl"
                  lang="ar"
                  className="min-h-[76px] rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-dashed border-[#087F5B]/45 p-3.5 flex flex-wrap items-center justify-start gap-2.5 leading-[1.95]"
                >
                  {placedTileIds.length === 0 ? (
                    <span
                      dir="ltr"
                      lang="tr"
                      className="font-sans text-xs font-semibold text-[var(--muted)] mx-auto"
                    >
                      Aşağıdaki kelime taşlarına duyduğunuz sırayla dokunun...
                    </span>
                  ) : (
                    placedTileIds.map((id) => {
                      const tile = currentWordTiles.find((t) => t.tileId === id);
                      if (!tile) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={dictationEval !== "idle"}
                          onClick={() => {
                            playClick();
                            setPlacedTileIds((prev) =>
                              prev.filter((x) => x !== id)
                            );
                          }}
                          className="min-h-[48px] px-3.5 py-1.5 rounded-xl bg-[#087F5B] text-white arabic font-arabic text-2xl font-bold leading-[1.95] cursor-pointer hover:bg-[#065F46]"
                        >
                          {fixArabicTypography(tile.text, arabicFont)}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Karışık kelime taşları havuzu */}
                {dictationEval === "idle" && (
                  <div
                    dir="rtl"
                    lang="ar"
                    className="flex flex-wrap items-center justify-center gap-2.5 leading-[1.95]"
                  >
                    {currentWordTiles.map((tile) => {
                      const used = placedTileIds.includes(tile.tileId);
                      return (
                        <button
                          key={tile.tileId}
                          type="button"
                          disabled={used}
                          onClick={() => {
                            playClick();
                            setPlacedTileIds((prev) => [...prev, tile.tileId]);
                          }}
                          className={`min-h-[48px] px-4 py-2 rounded-2xl border-2 border-b-4 arabic font-arabic text-2xl font-bold leading-[1.95] transition-all ${
                            used
                              ? "opacity-25 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 cursor-default"
                              : "bg-[#F7EFE1] dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-[var(--foreground)] active:translate-y-0.5 cursor-pointer"
                          }`}
                        >
                          {fixArabicTypography(tile.text, arabicFont)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {dictationEval === "idle" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      disabled={placedTileIds.length === 0}
                      onClick={() => {
                        playClick();
                        setPlacedTileIds([]);
                      }}
                      className="min-h-[48px] px-4 py-2 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] disabled:opacity-40 text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw size={14} />
                      <span>Sıfırla</span>
                    </button>

                    <button
                      type="button"
                      disabled={placedTileIds.length === 0}
                      onClick={() => void handleCheckDictation()}
                      className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] disabled:opacity-45 text-white text-xs sm:text-sm font-extrabold cursor-pointer"
                    >
                      Cümleyi Kontrol Et
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* KLAVYEYLE İMLA MODU (<input inputMode="none" /> + Sanal Klavye) */
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--muted)]">
                    <span>Harekesiz yazabilirsiniz; harf, hemze ve kapalı tâ doğruluğu ölçülür.</span>
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setUseDeviceKeyboard((v) => !v);
                        setTimeout(() => inputRef.current?.focus(), 40);
                      }}
                      className="min-h-[40px] px-3 py-1 rounded-lg bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[#6741D9] dark:text-indigo-300 cursor-pointer shrink-0"
                    >
                      {useDeviceKeyboard ? "Sanal Klavyeye Geç" : "Sistem Klavyesi"}
                    </button>
                  </div>

                  <input
                    ref={inputRef}
                    type="text"
                    dir="rtl"
                    lang="ar"
                    inputMode={useDeviceKeyboard ? "text" : "none"}
                    disabled={dictationEval !== "idle"}
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        document.querySelector(
                          '[role="dialog"], .fixed.inset-0:not(svg):not([data-smartboard-canvas])'
                        )
                      ) {
                        return;
                      }
                      if (e.key === "Enter" && typedText.trim().length > 0) {
                        e.preventDefault();
                        void handleCheckDictation();
                      }
                    }}
                    placeholder="اُكْتُبِ الْجُمْلَةَ هُنَا..."
                    className="w-full min-h-[60px] px-4 py-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#6741D9]/50 focus:border-[#6741D9] focus:outline-none arabic font-arabic text-2xl sm:text-3xl font-bold text-right leading-[1.95] text-[var(--foreground)]"
                  />
                </div>

                {dictationEval === "idle" && !useDeviceKeyboard && (
                  <ArabicVirtualKeyboard
                    useDeviceKeyboard={useDeviceKeyboard}
                    onToggleDeviceKeyboard={() =>
                      setUseDeviceKeyboard((prev) => !prev)
                    }
                    onKeyPress={(ch) => setTypedText((prev) => prev + ch)}
                    onBackspace={() =>
                      setTypedText((prev) => prev.slice(0, -1))
                    }
                    onClear={() => setTypedText("")}
                    onEnter={() => {
                      if (typedText.trim().length > 0) {
                        void handleCheckDictation();
                      }
                    }}
                  />
                )}

                {dictationEval === "idle" && useDeviceKeyboard && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={typedText.trim().length === 0}
                      onClick={() => void handleCheckDictation()}
                      className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] disabled:opacity-45 text-white text-sm font-extrabold cursor-pointer"
                    >
                      İmlayı Kontrol Et
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* MOD B: İ'RAB & SON HAREKE ATÖLYESİ (TASHKEEL) */
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E6D7BE]/70 dark:border-[var(--border)]">
              <p className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                Parlayan <span className="text-[#6741D9] dark:text-indigo-300">?</span> halkalı kelimenin son harfine doğru i&apos;rab harekesini yerleştirin:
              </p>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  void playEntryAudio(currentEntry, 1.0);
                }}
                className="min-h-[48px] px-3.5 py-2 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[#087F5B] dark:text-emerald-400 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 size={15} />
                <span>Cümleyi Dinle</span>
              </button>
            </div>

            {/* Cümle ve ? halkalı hedef kelimeler */}
            <div className="rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-6 space-y-4">
              <div
                dir="rtl"
                lang="ar"
                className="flex flex-wrap items-center justify-start gap-2.5 sm:gap-3 leading-[1.95]"
              >
                {rawSentenceWords.map((word, wIdx) => {
                  const slotIdx = tashkeelSlots.findIndex(
                    (s) => s.wordIndex === wIdx
                  );
                  if (slotIdx === -1) {
                    return (
                      <span
                        key={`${word}-${wIdx}`}
                        className="arabic font-arabic text-2xl sm:text-4xl font-bold text-[var(--foreground)] leading-[1.95]"
                      >
                        {fixArabicTypography(word, arabicFont)}
                      </span>
                    );
                  }

                  const slot = tashkeelSlots[slotIdx];
                  const chosenHaraka = slotSelections[wIdx];
                  const isFocused = activeSlotIdx === slotIdx && tashkeelEval === "idle";
                  const isSlotRight = chosenHaraka === slot.expectedHarakaId;

                  const renderedWord =
                    tashkeelEval !== "idle"
                      ? slot.expectedDisplayWord
                      : chosenHaraka
                      ? applyHarakaPreview(slot, chosenHaraka)
                      : `${slot.leadingPunct}${slot.maskedStem}${slot.trailingPunct}`;

                  return (
                    <button
                      key={`slot-${wIdx}`}
                      type="button"
                      disabled={tashkeelEval !== "idle"}
                      onClick={() => {
                        playClick();
                        setActiveSlotIdx(slotIdx);
                      }}
                      className={`min-h-[54px] px-3.5 py-1.5 rounded-2xl border-2 inline-flex items-center gap-2 transition-all cursor-pointer ${
                        tashkeelEval === "correct"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-[#065F46] dark:text-emerald-300"
                          : tashkeelEval === "wrong" && !isSlotRight
                          ? "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-200"
                          : isFocused
                          ? "bg-[#F3F0FF] dark:bg-indigo-950/70 border-[#6741D9] ring-2 ring-[#6741D9]/30 text-[#4C28B5] dark:text-indigo-200"
                          : "bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 text-[var(--foreground)]"
                      }`}
                    >
                      <span className="arabic font-arabic text-2xl sm:text-4xl font-bold leading-[1.95]">
                        {fixArabicTypography(renderedWord, arabicFont)}
                      </span>
                      {!chosenHaraka && tashkeelEval === "idle" && (
                        <span
                          dir="ltr"
                          className="w-6 h-6 rounded-full bg-[#6741D9] text-white font-sans text-xs font-black inline-flex items-center justify-center shrink-0 shadow-xs"
                        >
                          ?
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <p
                dir="ltr"
                lang="tr"
                className="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-200 pt-3 border-t border-[#E6D7BE]/60 dark:border-[var(--border)]"
              >
                Türkçe Anlamı: “{currentEntry.turkish}”
              </p>
            </div>

            {/* 7 HAREKE TAŞI ÇUBUĞU */}
            {tashkeelEval === "idle" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--muted)]">
                  <span>Son Harf Hareke Taşları (Dokunarak Uygula):</span>
                  {Object.keys(slotSelections).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setSlotSelections({});
                        setActiveSlotIdx(0);
                      }}
                      className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-extrabold cursor-pointer"
                    >
                      <Delete size={13} />
                      <span>Temizle</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {HARAKA_STONES.map((stone) => (
                    <button
                      key={stone.id}
                      type="button"
                      onClick={() => void handleApplyHarakaStone(stone.id)}
                      className="min-h-[56px] p-2 rounded-2xl bg-[#F7EFE1] dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 hover:border-[#087F5B] active:translate-y-0.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all"
                    >
                      <span
                        dir="rtl"
                        lang="ar"
                        className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-300 leading-none"
                      >
                        {stone.label}
                      </span>
                      <span className="text-[10px] font-extrabold text-[var(--muted)] text-center leading-tight">
                        {stone.name.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* GERİ BİLDİRİM & DOĞRU CÜMLE KARTI */}
        {isQuestionFinished && (
          <div
            className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3 ${
              dictationEval === "correct" ||
              dictationEval === "near" ||
              tashkeelEval === "correct"
                ? "bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-400 dark:border-emerald-700"
                : "bg-rose-50/90 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black">
                {dictationEval === "correct" ||
                dictationEval === "near" ||
                tashkeelEval === "correct" ? (
                  <span className="inline-flex items-center gap-1.5 text-[#065F46] dark:text-emerald-300">
                    <CheckCircle2 size={18} />
                    <span>
                      {dictationEval === "near"
                        ? "Doğru! Küçük hemze / yâ imla inceliğine göz atın:"
                        : "Tebrikler, tam isabet!"}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <XCircle size={18} />
                    <span>Doğru yazılış ve harekelemeyi inceleyin:</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  void playEntryAudio(currentEntry, 1.0);
                }}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 size={15} />
                <span>Sesli Dinle</span>
              </button>
            </div>

            <p
              dir="rtl"
              lang="ar"
              className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-300 text-right leading-[1.95] break-words"
            >
              {fixArabicTypography(currentEntry.arabic, arabicFont)}
            </p>

            <p className="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-200">
              “{currentEntry.turkish}”
            </p>

            {/* Klavye modunda renkli harf/kelime imla diff gösterimi */}
            {workshopTab === "dictation" &&
              dictationStyle === "keyboard" &&
              spellingDiffs.length > 0 && (
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
                  <span className="text-xs font-extrabold text-[var(--muted)] block">
                    Kelime Bazlı İmla Karşılaştırması:
                  </span>
                  <div
                    dir="rtl"
                    lang="ar"
                    className="flex flex-wrap items-center gap-2 leading-[1.95]"
                  >
                    {spellingDiffs.map((d, idx) => (
                      <div
                        key={idx}
                        className={`px-3 py-1.5 rounded-xl border text-right ${
                          d.status === "exact"
                            ? "bg-emerald-100/80 dark:bg-emerald-950/60 border-emerald-400 text-[#065F46] dark:text-emerald-300"
                            : d.status === "hamza_ya_ta_diff"
                            ? "bg-amber-100/90 dark:bg-amber-950/60 border-amber-400 text-amber-900 dark:text-amber-200"
                            : "bg-rose-100/90 dark:bg-rose-950/60 border-rose-400 text-rose-900 dark:text-rose-200"
                        }`}
                      >
                        <div className="arabic font-arabic text-xl font-bold leading-[1.95]">
                          {d.expectedWord}
                        </div>
                        {d.status !== "exact" && (
                          <div
                            dir="ltr"
                            lang="tr"
                            className="font-sans text-[11px] font-bold"
                          >
                            Siz: {d.typedWord}
                            {d.hintNote ? ` (${d.hintNote})` : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleNextQuestion}
                className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {currentIndex + 1 < sessionEntries.length
                    ? "Sonraki Cümleye Geç"
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
