"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Volume2,
  Flame,
  CheckCircle2,
  X,
  Zap,
  RotateCcw,
  Target,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trophy,
  Play,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import { Level, ResimliKelime } from "@/types/data";
import { gorselKelimeler, resolveImageUrl } from "@/lib/data";
import { selectSmartVisualDistractors, shuffleArray } from "@/lib/quiz";
import {
  playDualGenderAudio,
  loadAudioManifest,
  stopAllAudio,
} from "@/lib/audio";
import {
  playClick,
  playCorrect,
  playWrong,
  playFanfare,
  playStart,
} from "@/lib/sfxManager";
import { useUserStore } from "@/store/userStore";
import { useSettings } from "@/store/settings";
import {
  formatArabicText,
  splitArabicWordIntoSyllableChunks,
} from "@/lib/arabicTextUtils";
import { saveLastExerciseSummary } from "@/lib/learningAnalytics";
import { useEscapeKey } from "@/lib/modalStack";

export interface VisualSwipeSprintGameProps {
  visualPool?: ResimliKelime[];
  cefrFilter?: "all" | Level;
  onClose?: () => void;
}

type SprintDurationSec = 60 | 120 | 300;
type SprintPhase = "ready" | "playing" | "finished";
type CardInteractionKind =
  | "drop_intro"
  | "up_down_tf"
  | "left_right_pick"
  | "syllable_tap";

export interface SyllableBubbleItem {
  uid: string;
  text: string;
  orderIndex: number;
}

interface SprintCard {
  uid: string;
  kind: CardInteractionKind;
  target: ResimliKelime;
  // B) Yukarı / Aşağı Kaydır (Doğru mu Yanlış mı?)
  displayedWord?: ResimliKelime;
  isMatch?: boolean;
  // C) Sağa / Sola Görsel Seçimi
  leftVisual?: ResimliKelime;
  rightVisual?: ResimliKelime;
  correctSide?: "left" | "right";
  // D) Hızlı Hece / Harf Birleştirme
  orderedChunks?: string[];
  shuffledBubbles?: SyllableBubbleItem[];
  hasWordSpaces?: boolean;
}

interface WrongRevealState {
  target: ResimliKelime;
}

interface RetryQueueItem {
  word: ResimliKelime;
  dueAtStep: number;
}

const CANONICAL_VISUAL_WORDS: ResimliKelime[] = gorselKelimeler.filter((item) =>
  Boolean(item.gorsel && item.arapca && item.turkce)
);

const CANONICAL_VISUAL_MAP = new Map<string, ResimliKelime>(
  CANONICAL_VISUAL_WORDS.map((item) => [item.id, item])
);

const SWIPE_THRESHOLD_PX = 46;
const INTRO_AUTO_ADVANCE_MS = 1500;
const WRONG_REVEAL_HOLD_MS = 1000;

export { splitArabicWordIntoSyllableChunks };

function cleanTrMeaning(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  return trimmed;
}

function formatTimerClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function VisualSwipeSprintGame({
  visualPool = [],
  cefrFilter = "all",
  onClose,
}: VisualSwipeSprintGameProps) {
  const {
    learnedWords,
    srsRecords,
    mistakeIds,
    addMistake,
    recordItemAttempt,
    recordSkillAttempt,
    addStudyMinutes,
  } = useUserStore();

  const {
    speechRate,
    arabicFont,
    preferredVoiceGender,
  } = useSettings();

  const [selectedDuration, setSelectedDuration] =
    useState<SprintDurationSec>(120);
  const [activeTotalDuration, setActiveTotalDuration] =
    useState<SprintDurationSec>(120);
  const [phase, setPhase] = useState<SprintPhase>("ready");
  const [timeLeft, setTimeLeft] = useState<number>(120);

  const [currentCard, setCurrentCard] = useState<SprintCard | null>(null);
  const [wrongReveal, setWrongReveal] = useState<WrongRevealState | null>(null);
  const [flashResult, setFlashResult] = useState<"correct" | "wrong" | null>(
    null
  );

  // D) Hece birleştirme ilerleme durumu
  const [pickedBubbleUids, setPickedBubbleUids] = useState<string[]>([]);

  // Seans metrikleri
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [sessionLearnedWords, setSessionLearnedWords] = useState<
    ResimliKelime[]
  >([]);
  const [sessionStruggledWords, setSessionStruggledWords] = useState<
    ResimliKelime[]
  >([]);
  const [isTargetedReviewMode, setIsTargetedReviewMode] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Oyun içi senkron referanslar (60 FPS gecikmesiz akış ve zamanlayıcı güvenliği)
  const seenIdsRef = useRef<Set<string>>(new Set());
  const deckCursorRef = useRef<number>(0);
  const deckOrderRef = useRef<ResimliKelime[]>([]);
  const retryQueueRef = useRef<RetryQueueItem[]>([]);
  const recentIntroQueueRef = useRef<ResimliKelime[]>([]);
  const quizStepCountRef = useRef<number>(0);
  const cardCounterRef = useRef<number>(0);
  const actionLockedRef = useRef<boolean>(false);
  const summarySavedRef = useRef<boolean>(false);
  const timeoutIdsRef = useRef<number[]>([]);

  // 60 FPS DOM animasyon referansları (sıfır React re-render kaydırma eğimi)
  const cardSurfaceRef = useRef<HTMLDivElement | null>(null);
  const upCueRef = useRef<HTMLDivElement | null>(null);
  const downCueRef = useRef<HTMLDivElement | null>(null);
  const leftCueRef = useRef<HTMLDivElement | null>(null);
  const rightCueRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
  });

  // Yalnızca gorselKelimeler_guncel.json kaynaklı ve görseli bulunan saf havuz
  const activeVisualPool = useMemo((): ResimliKelime[] => {
    const incoming = visualPool
      .map((item) => CANONICAL_VISUAL_MAP.get(item.id))
      .filter((item): item is ResimliKelime => Boolean(item));
    if (incoming.length >= 4) return incoming;

    const byLevel =
      cefrFilter === "all"
        ? CANONICAL_VISUAL_WORDS
        : CANONICAL_VISUAL_WORDS.filter((w) => w.cefr === cefrFilter);

    return byLevel.length >= 4 ? byLevel : CANONICAL_VISUAL_WORDS;
  }, [visualPool, cefrFilter]);

  const clearScheduledTimeouts = useCallback(() => {
    for (const id of timeoutIdsRef.current) {
      window.clearTimeout(id);
    }
    timeoutIdsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timeoutIdsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    void loadAudioManifest();
    return () => {
      clearScheduledTimeouts();
      stopAllAudio();
    };
  }, [clearScheduledTimeouts]);

  const speakWord = useCallback(
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

  const resetDragVisuals = useCallback(() => {
    dragStateRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      dx: 0,
      dy: 0,
    };
    if (cardSurfaceRef.current) {
      cardSurfaceRef.current.style.transition =
        "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 150ms ease";
      cardSurfaceRef.current.style.transform = "translate3d(0px, 0px, 0px) rotate(0deg)";
    }
    for (const cue of [
      upCueRef.current,
      downCueRef.current,
      leftCueRef.current,
      rightCueRef.current,
    ]) {
      if (cue) {
        cue.style.opacity = "0";
        cue.style.transform = "scale(0.92)";
      }
    }
  }, []);

  const handleExit = useCallback(() => {
    clearScheduledTimeouts();
    stopAllAudio();
    playClick();
    if (onClose) {
      onClose();
    }
  }, [clearScheduledTimeouts, onClose]);

  useEscapeKey(handleExit, true, "visual_swipe_sprint_game");

  // Yeni kart üretici (A: Yeni Kelime Damlası | B: Yukarı/Aşağı | C: Sağa/Sola | D: Hece Birleştirme)
  const buildNextCard = useCallback(
    (poolOverride?: ResimliKelime[]): SprintCard => {
      const pool =
        poolOverride && poolOverride.length >= 2
          ? poolOverride
          : activeVisualPool;
      const fullDistractorBank =
        pool.length >= 6 ? pool : CANONICAL_VISUAL_WORDS;

      cardCounterRef.current += 1;
      const uid = `sprint_card_${cardCounterRef.current}`;

      // 1. Öncelik: Yanlış yapılan ve vadesi gelen tekrar kelimesi
      const currentQuizStep = quizStepCountRef.current;
      const dueRetryIdx = retryQueueRef.current.findIndex(
        (r) => r.dueAtStep <= currentQuizStep
      );

      let chosenTarget: ResimliKelime | null = null;
      let forceQuiz = false;

      if (dueRetryIdx !== -1) {
        const [dueItem] = retryQueueRef.current.splice(dueRetryIdx, 1);
        chosenTarget = dueItem.word;
        forceQuiz = true;
      } else if (
        recentIntroQueueRef.current.length > 0 &&
        (currentQuizStep % 2 === 1 || recentIntroQueueRef.current.length >= 2)
      ) {
        // Az önce tanıtım damlasıyla gösterilen yeni kelimeyi sıcağı sıcağına sor
        chosenTarget = recentIntroQueueRef.current.shift() || null;
        forceQuiz = true;
      }

      if (!chosenTarget) {
        if (deckCursorRef.current >= deckOrderRef.current.length) {
          deckOrderRef.current = shuffleArray(pool);
          deckCursorRef.current = 0;
        }
        chosenTarget =
          deckOrderRef.current[deckCursorRef.current] || pool[0];
        deckCursorRef.current += 1;
      }

      // A) Kullanıcının daha önce karşılaşmadığı bir kelimeyse önce 1.5 sn Tanıtım Damlası göster
      if (!forceQuiz && !seenIdsRef.current.has(chosenTarget.id)) {
        seenIdsRef.current.add(chosenTarget.id);
        recentIntroQueueRef.current.push(chosenTarget);
        return {
          uid,
          kind: "drop_intro",
          target: chosenTarget,
        };
      }

      // Aktif soru adımı (B, C, D ritim döngüsü)
      quizStepCountRef.current += 1;
      const stepNum = quizStepCountRef.current;

      // D) Her 4-5 soruda 1 Hızlı Hece / Harf Birleştirme (2+ parça çıkabiliyorsa)
      if (stepNum % 5 === 0) {
        const { chunks, hasWordSpaces } = splitArabicWordIntoSyllableChunks(
          chosenTarget.arapca
        );
        if (chunks.length >= 2 && chunks.length <= 4) {
          const orderedBubbles: SyllableBubbleItem[] = chunks.map(
            (text, idx) => ({
              uid: `${uid}_syl_${idx}`,
              text,
              orderIndex: idx,
            })
          );
          let shuffled = shuffleArray(orderedBubbles);
          if (
            shuffled.length >= 2 &&
            shuffled.every((b, idx) => b.text === chunks[idx])
          ) {
            shuffled = [...shuffled.slice(1), shuffled[0]];
          }
          return {
            uid,
            kind: "syllable_tap",
            target: chosenTarget,
            orderedChunks: chunks,
            shuffledBubbles: shuffled,
            hasWordSpaces,
          };
        }
      }

      const distractors = selectSmartVisualDistractors(
        chosenTarget,
        fullDistractorBank,
        3
      );
      const primaryDistractor =
        distractors[0] ||
        fullDistractorBank.find((w) => w.id !== chosenTarget.id) ||
        chosenTarget;

      // B) Yukarı / Aşağı Kaydır (Doğru mu Yanlış mı?) ve C) Sağa / Sola Görsel Seçimi dönüşümlü
      if (stepNum % 2 === 1) {
        const isMatch = Math.random() < 0.52 || primaryDistractor.id === chosenTarget.id;
        const displayedWord = isMatch ? chosenTarget : primaryDistractor;
        return {
          uid,
          kind: "up_down_tf",
          target: chosenTarget,
          displayedWord,
          isMatch,
        };
      }

      const targetOnLeft = Math.random() < 0.5;
      return {
        uid,
        kind: "left_right_pick",
        target: chosenTarget,
        leftVisual: targetOnLeft ? chosenTarget : primaryDistractor,
        rightVisual: targetOnLeft ? primaryDistractor : chosenTarget,
        correctSide: targetOnLeft ? "left" : "right",
      };
    },
    [activeVisualPool]
  );

  const presentNextCard = useCallback(
    (poolOverride?: ResimliKelime[]) => {
      actionLockedRef.current = false;
      setWrongReveal(null);
      setFlashResult(null);
      setPickedBubbleUids([]);
      resetDragVisuals();

      const next = buildNextCard(poolOverride);
      setCurrentCard(next);
      speakWord(next.target);
    },
    [buildNextCard, resetDragVisuals, speakWord]
  );

  const finalizeSprint = useCallback(
    (
      finalCorrect: number,
      finalWrong: number,
      durationUsed: SprintDurationSec
    ) => {
      if (summarySavedRef.current) return;
      summarySavedRef.current = true;
      clearScheduledTimeouts();
      actionLockedRef.current = true;
      setWrongReveal(null);
      setPhase("finished");

      const totalSolved = finalCorrect + finalWrong;
      if (totalSolved > 0) {
        saveLastExerciseSummary({
          moduleName: "Görsel Hız Seansı (سِبَاقُ الصُّوَرِ)",
          solved: totalSolved,
          correct: finalCorrect,
          wrong: finalWrong,
        });
      }
      addStudyMinutes(Math.max(1, Math.round(durationUsed / 60)));
      playFanfare(
        totalSolved > 0 ? Math.round((finalCorrect / totalSolved) * 100) : 80
      );
    },
    [addStudyMinutes, clearScheduledTimeouts]
  );

  const startSession = useCallback(
    (durationSec: SprintDurationSec, customPool?: ResimliKelime[]) => {
      clearScheduledTimeouts();
      stopAllAudio();
      playStart();

      const effectivePool =
        customPool && customPool.length >= 2 ? customPool : activeVisualPool;

      // Daha önce öğrenilmiş / SRS kaydı olan kelimeleri yükle; özel 1 dk hata tekrarında doğrudan soruya geç
      const knownIds = new Set<string>();
      if (customPool && customPool.length > 0) {
        for (const item of customPool) {
          knownIds.add(item.id);
        }
      } else {
        for (const lw of learnedWords) {
          knownIds.add(lw);
        }
        for (const srsId of Object.keys(srsRecords || {})) {
          knownIds.add(srsId);
        }
      }

      seenIdsRef.current = knownIds;
      deckOrderRef.current = shuffleArray(effectivePool);
      deckCursorRef.current = 0;
      retryQueueRef.current = [];
      recentIntroQueueRef.current = [];
      quizStepCountRef.current = 0;
      summarySavedRef.current = false;
      actionLockedRef.current = false;

      setIsTargetedReviewMode(Boolean(customPool && customPool.length > 0));
      setActiveTotalDuration(durationSec);
      setTimeLeft(durationSec);
      setCombo(0);
      setBestCombo(0);
      setCorrectCount(0);
      setWrongCount(0);
      setSessionLearnedWords([]);
      if (!customPool) {
        setSessionStruggledWords([]);
      }
      setPhase("playing");

      presentNextCard(effectivePool);
    },
    [
      activeVisualPool,
      clearScheduledTimeouts,
      learnedWords,
      presentNextCard,
      srsRecords,
    ]
  );

  // Geri sayım sayacı
  useEffect(() => {
    if (phase !== "playing") return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  // Süre 0 olduğunda seans sonu karnesine geç
  useEffect(() => {
    if (phase !== "playing" || timeLeft > 0) return;
    const id = window.setTimeout(() => {
      finalizeSprint(correctCount, wrongCount, activeTotalDuration);
    }, 60);
    return () => window.clearTimeout(id);
  }, [
    phase,
    timeLeft,
    correctCount,
    wrongCount,
    activeTotalDuration,
    finalizeSprint,
  ]);

  // A) Yeni Kelime Damlası (Tanıtım Kartı) 1.5 saniye sonunda otomatik hız turuna geçiş
  const advanceFromIntroCard = useCallback(() => {
    if (
      phase !== "playing" ||
      !currentCard ||
      currentCard.kind !== "drop_intro" ||
      actionLockedRef.current
    ) {
      return;
    }
    actionLockedRef.current = true;
    clearScheduledTimeouts();
    playClick();
    setSessionLearnedWords((prev) =>
      prev.some((w) => w.id === currentCard.target.id)
        ? prev
        : [...prev, currentCard.target]
    );
    presentNextCard();
  }, [
    clearScheduledTimeouts,
    currentCard,
    phase,
    presentNextCard,
  ]);

  useEffect(() => {
    if (
      phase !== "playing" ||
      !currentCard ||
      currentCard.kind !== "drop_intro"
    ) {
      return;
    }
    const timerId = scheduleTimeout(() => {
      advanceFromIntroCard();
    }, INTRO_AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timerId);
  }, [phase, currentCard, scheduleTimeout, advanceFromIntroCard]);

  // Ortak Doğru / Yanlış değerlendirme ve SRS kaydı
  const commitQuizOutcome = useCallback(
    (target: ResimliKelime, isCorrect: boolean) => {
      recordItemAttempt(target.id, "word", isCorrect);
      recordSkillAttempt("kelime", isCorrect);

      const retryPool = isTargetedReviewMode
        ? sessionStruggledWords.length >= 2
          ? sessionStruggledWords
          : undefined
        : undefined;

      if (isCorrect) {
        playCorrect();
        setFlashResult("correct");
        setCorrectCount((c) => c + 1);
        setCombo((prev) => {
          const next = prev + 1;
          setBestCombo((best) => Math.max(best, next));
          return next;
        });
        setSessionLearnedWords((prev) =>
          prev.some((w) => w.id === target.id) ? prev : [...prev, target]
        );

        scheduleTimeout(() => {
          presentNextCard(retryPool);
        }, 210);
      } else {
        playWrong();
        addMistake(target.id);
        setFlashResult("wrong");
        setWrongCount((w) => w + 1);
        setCombo(0);
        setSessionStruggledWords((prev) =>
          prev.some((w) => w.id === target.id) ? prev : [...prev, target]
        );

        // Birkaç kart sonra tekrar sorulmak üzere kuyruğa ekle
        if (!retryQueueRef.current.some((r) => r.word.id === target.id)) {
          retryQueueRef.current.push({
            word: target,
            dueAtStep: quizStepCountRef.current + 3,
          });
        }

        // Doğru eşleşmeyi 1 saniye sesli ve görselli olarak göster
        setWrongReveal({ target });
        speakWord(target);

        scheduleTimeout(() => {
          presentNextCard(retryPool);
        }, WRONG_REVEAL_HOLD_MS);
      }
    },
    [
      addMistake,
      isTargetedReviewMode,
      presentNextCard,
      recordItemAttempt,
      recordSkillAttempt,
      scheduleTimeout,
      sessionStruggledWords,
      speakWord,
    ]
  );

  // B) Yukarı (Doğru) / Aşağı (Yanlış) cevabı
  const handleUpDownAnswer = useCallback(
    (userSaysMatch: boolean) => {
      if (
        phase !== "playing" ||
        !currentCard ||
        currentCard.kind !== "up_down_tf" ||
        actionLockedRef.current
      ) {
        return;
      }
      actionLockedRef.current = true;
      resetDragVisuals();

      const actualMatch = Boolean(currentCard.isMatch);
      const isCorrect = userSaysMatch === actualMatch;
      commitQuizOutcome(currentCard.target, isCorrect);
    },
    [commitQuizOutcome, currentCard, phase, resetDragVisuals]
  );

  // C) Sol / Sağ görsel seçimi cevabı
  const handleLeftRightAnswer = useCallback(
    (chosenSide: "left" | "right") => {
      if (
        phase !== "playing" ||
        !currentCard ||
        currentCard.kind !== "left_right_pick" ||
        actionLockedRef.current
      ) {
        return;
      }
      actionLockedRef.current = true;
      resetDragVisuals();

      const isCorrect = chosenSide === currentCard.correctSide;
      commitQuizOutcome(currentCard.target, isCorrect);
    },
    [commitQuizOutcome, currentCard, phase, resetDragVisuals]
  );

  // D) Hece / Harf baloncuğu seçimi (Sağdan sola sıra kontrolü)
  const handleSyllableBubbleTap = useCallback(
    (bubble: SyllableBubbleItem) => {
      if (
        phase !== "playing" ||
        !currentCard ||
        currentCard.kind !== "syllable_tap" ||
        actionLockedRef.current
      ) {
        return;
      }
      if (pickedBubbleUids.includes(bubble.uid)) return;

      const orderedChunks = currentCard.orderedChunks || [];
      const expectedIndex = pickedBubbleUids.length;
      const expectedText = orderedChunks[expectedIndex];

      if (bubble.text === expectedText) {
        const nextPicked = [...pickedBubbleUids, bubble.uid];
        setPickedBubbleUids(nextPicked);

        if (nextPicked.length >= orderedChunks.length) {
          actionLockedRef.current = true;
          speakWord(currentCard.target);
          commitQuizOutcome(currentCard.target, true);
        } else {
          playClick();
        }
      } else {
        actionLockedRef.current = true;
        commitQuizOutcome(currentCard.target, false);
      }
    },
    [commitQuizOutcome, currentCard, phase, pickedBubbleUids, speakWord]
  );

  // 60 FPS Dokunmatik ve Fare Kaydırma (Pointer Events)
  const handleArenaPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      phase !== "playing" ||
      !currentCard ||
      actionLockedRef.current ||
      currentCard.kind === "syllable_tap"
    ) {
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;

    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
    };

    if (cardSurfaceRef.current) {
      cardSurfaceRef.current.style.transition = "none";
    }
  };

  const handleArenaPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId || !currentCard) return;

    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    st.dx = dx;
    st.dy = dy;

    const clampedX = Math.max(-130, Math.min(130, dx));
    const clampedY = Math.max(-130, Math.min(130, dy));

    if (currentCard.kind === "up_down_tf") {
      const tiltDeg = Math.max(-9, Math.min(9, (clampedX * 0.04) - (clampedY * 0.05)));
      if (cardSurfaceRef.current) {
        cardSurfaceRef.current.style.transform = `translate3d(${clampedX * 0.25}px, ${clampedY * 0.72}px, 0px) rotate(${tiltDeg.toFixed(2)}deg)`;
      }
      const upRatio = dy < -10 ? Math.min(1, (-dy - 10) / 55) : 0;
      const downRatio = dy > 10 ? Math.min(1, (dy - 10) / 55) : 0;
      if (upCueRef.current) {
        upCueRef.current.style.opacity = upRatio.toFixed(2);
        upCueRef.current.style.transform = `scale(${(0.92 + upRatio * 0.12).toFixed(2)})`;
      }
      if (downCueRef.current) {
        downCueRef.current.style.opacity = downRatio.toFixed(2);
        downCueRef.current.style.transform = `scale(${(0.92 + downRatio * 0.12).toFixed(2)})`;
      }
    } else if (currentCard.kind === "left_right_pick") {
      const tiltDeg = Math.max(-11, Math.min(11, clampedX * 0.08));
      if (cardSurfaceRef.current) {
        cardSurfaceRef.current.style.transform = `translate3d(${clampedX * 0.72}px, ${clampedY * 0.18}px, 0px) rotate(${tiltDeg.toFixed(2)}deg)`;
      }
      const leftRatio = dx < -10 ? Math.min(1, (-dx - 10) / 55) : 0;
      const rightRatio = dx > 10 ? Math.min(1, (dx - 10) / 55) : 0;
      if (leftCueRef.current) {
        leftCueRef.current.style.opacity = leftRatio.toFixed(2);
        leftCueRef.current.style.transform = `scale(${(0.92 + leftRatio * 0.12).toFixed(2)})`;
      }
      if (rightCueRef.current) {
        rightCueRef.current.style.opacity = rightRatio.toFixed(2);
        rightCueRef.current.style.transform = `scale(${(0.92 + rightRatio * 0.12).toFixed(2)})`;
      }
    } else if (currentCard.kind === "drop_intro") {
      const tiltDeg = Math.max(-8, Math.min(8, clampedX * 0.06));
      if (cardSurfaceRef.current) {
        cardSurfaceRef.current.style.transform = `translate3d(${clampedX * 0.5}px, ${clampedY * 0.5}px, 0px) rotate(${tiltDeg.toFixed(2)}deg)`;
      }
    }
  };

  const handleArenaPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId || !currentCard) return;

    const { dx, dy } = st;
    const dist = Math.hypot(dx, dy);

    if (currentCard.kind === "drop_intro") {
      resetDragVisuals();
      if (dist >= 28 || dist < 12) {
        advanceFromIntroCard();
      }
      return;
    }

    if (currentCard.kind === "up_down_tf") {
      if (Math.abs(dy) >= SWIPE_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx) * 0.85) {
        handleUpDownAnswer(dy < 0);
        return;
      }
    } else if (currentCard.kind === "left_right_pick") {
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 0.85) {
        handleLeftRightAnswer(dx < 0 ? "left" : "right");
        return;
      }
    }

    resetDragVisuals();
  };

  // Masaüstü Klavye Kısayolları (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Space, Enter, 1-4)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (phase === "ready") {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startSession(selectedDuration);
        }
        return;
      }

      if (phase !== "playing" || !currentCard || actionLockedRef.current) {
        return;
      }

      if (currentCard.kind === "drop_intro") {
        if (
          e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === " " ||
          e.key === "Enter"
        ) {
          e.preventDefault();
          advanceFromIntroCard();
        }
        return;
      }

      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        speakWord(currentCard.target);
        return;
      }

      if (currentCard.kind === "up_down_tf") {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          handleUpDownAnswer(true);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          handleUpDownAnswer(false);
        }
        return;
      }

      if (currentCard.kind === "left_right_pick") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          handleLeftRightAnswer("left");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          handleLeftRightAnswer("right");
        }
        return;
      }

      if (currentCard.kind === "syllable_tap") {
        const bubbles = currentCard.shuffledBubbles || [];
        const remaining = bubbles.filter(
          (b) => !pickedBubbleUids.includes(b.uid)
        );
        if (e.key >= "1" && e.key <= "4") {
          const idx = Number(e.key) - 1;
          const targetBubble = bubbles[idx];
          if (targetBubble && !pickedBubbleUids.includes(targetBubble.uid)) {
            e.preventDefault();
            handleSyllableBubbleTap(targetBubble);
          }
        } else if (
          (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "ArrowDown") &&
          remaining.length > 0
        ) {
          e.preventDefault();
          const pick =
            e.key === "ArrowLeft"
              ? remaining[remaining.length - 1]
              : remaining[0];
          handleSyllableBubbleTap(pick);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    advanceFromIntroCard,
    currentCard,
    handleLeftRightAnswer,
    handleSyllableBubbleTap,
    handleUpDownAnswer,
    phase,
    pickedBubbleUids,
    selectedDuration,
    speakWord,
    startSession,
  ]);

  // Zorlanılan kelimeler havuzu (bu seans + genel hata defterindeki görsel kelimeler)
  const retryWeakVisualPool = useMemo((): ResimliKelime[] => {
    const map = new Map<string, ResimliKelime>();
    for (const item of sessionStruggledWords) {
      map.set(item.id, item);
    }
    for (const mId of mistakeIds) {
      const found = CANONICAL_VISUAL_MAP.get(mId);
      if (found) {
        map.set(found.id, found);
      }
    }
    const list = Array.from(map.values());
    if (list.length >= 2) return list;
    if (list.length === 1) {
      const filler = activeVisualPool.find((w) => w.id !== list[0].id);
      return filler ? [list[0], filler] : activeVisualPool.slice(0, 4);
    }
    return activeVisualPool.slice(0, Math.min(8, activeVisualPool.length));
  }, [sessionStruggledWords, mistakeIds, activeVisualPool]);

  const progressFraction =
    activeTotalDuration > 0
      ? Math.max(0, Math.min(1, timeLeft / activeTotalDuration))
      : 0;
  const ringDashOffset = Math.round((1 - progressFraction) * 100);
  const barSvgWidth = Math.round(progressFraction * 1000);

  const totalAnswered = correctCount + wrongCount;
  const accuracyPercent =
    totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
  const elapsedMinutes = Math.max(1 / 6, activeTotalDuration / 60);
  const wordsPerMinute =
    Math.round((correctCount / elapsedMinutes) * 10) / 10;

  const renderWordIllustration = (
    word: ResimliKelime,
    sizeClass: string
  ) => {
    const isBroken = Boolean(failedImages[word.id]);
    const resolvedSrc = resolveImageUrl(word.gorsel);

    if (isBroken || !resolvedSrc) {
      return (
        <div
          className={`${sizeClass} rounded-2xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 flex flex-col items-center justify-center p-3 text-center gap-1.5`}
        >
          <ImageIcon
            size={32}
            className="text-[#087F5B] dark:text-emerald-400 opacity-80"
          />
          <span className="text-xs font-bold text-[var(--muted)] line-clamp-2">
            {cleanTrMeaning(word.turkce)}
          </span>
        </div>
      );
    }

    return (
      <div
        className={`${sizeClass} rounded-2xl bg-white dark:bg-slate-900 border border-[#E6D7BE] dark:border-slate-700 overflow-hidden flex items-center justify-center p-1.5 shadow-2xs`}
      >
        <img
          src={resolvedSrc}
          alt={cleanTrMeaning(word.turkce) || "Kelime görseli"}
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() =>
            setFailedImages((prev) => ({ ...prev, [word.id]: true }))
          }
          className="w-full h-full object-contain select-none pointer-events-none"
        />
      </div>
    );
  };

  return (
    <div
      role="application"
      aria-label="Görsel Hız Seansı"
      className="fixed inset-0 z-[9999] h-[100dvh] w-full overflow-hidden bg-[#FDFBF7] dark:bg-[#0F172A] text-[var(--foreground)] flex flex-col select-none"
    >
      {/* TEK SATIR ÜST HUD */}
      <header className="shrink-0 pt-[env(safe-area-inset-top)] bg-[#F7EFE1] dark:bg-slate-900 border-b border-[#E6D7BE] dark:border-slate-800">
        <div className="h-12 sm:h-14 max-w-4xl mx-auto px-2.5 sm:px-5 flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Sol: Dairesel Geri Sayım Halkası veya Süre Seçici */}
          {phase === "playing" ? (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 36 36"
                  className="w-full h-full -rotate-90"
                  aria-hidden="true"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.4"
                    className="text-[#E6D7BE] dark:text-slate-700"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.4"
                    strokeDasharray="100 100"
                    strokeDashoffset={ringDashOffset}
                    strokeLinecap="round"
                    className={
                      timeLeft <= 15
                        ? "text-rose-600 dark:text-rose-400 transition-all duration-500"
                        : "text-[#087F5B] dark:text-emerald-400 transition-all duration-500"
                    }
                  />
                </svg>
                <Zap
                  size={12}
                  className={
                    timeLeft <= 15
                      ? "absolute text-rose-600 dark:text-rose-400"
                      : "absolute text-[#087F5B] dark:text-emerald-400"
                  }
                />
              </div>
              <span
                className={`text-xs sm:text-sm font-extrabold tabular-nums whitespace-nowrap ${
                  timeLeft <= 15
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-[var(--foreground)]"
                }`}
              >
                {formatTimerClock(timeLeft)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <Zap
                size={17}
                className="text-[#087F5B] dark:text-emerald-400 shrink-0"
              />
              <span className="text-xs sm:text-sm font-extrabold truncate">
                Görsel Hız Seansı
              </span>
              <span
                lang="ar"
                dir="rtl"
                className="hidden sm:inline arabic text-sm font-bold text-[#065F46] dark:text-emerald-400 shrink-0"
              >
                سِبَاقُ الصُّوَرِ
              </span>
            </div>
          )}

          {/* Orta: Kombo xN + Öğrenilen / Doğru Sayısı (veya Hazırlıkta 2 Dk / 5 Dk Seçimi) */}
          {phase === "playing" ? (
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div
                className={`inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold tabular-nums whitespace-nowrap ${
                  combo >= 3
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-[var(--muted)]"
                }`}
              >
                <Flame size={15} className="shrink-0" />
                <span>Kombo x{combo}</span>
              </div>

              <span
                aria-hidden="true"
                className="text-[#D5C3A3] dark:text-slate-700"
              >
                ·
              </span>

              <div className="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold text-[#065F46] dark:text-emerald-400 tabular-nums whitespace-nowrap">
                <CheckCircle2 size={15} className="shrink-0" />
                <span className="sm:hidden">
                  {sessionLearnedWords.length}/{correctCount}
                </span>
                <span className="hidden sm:inline">
                  {sessionLearnedWords.length} Öğrenilen · {correctCount} Doğru
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#E6D7BE] dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setSelectedDuration(120);
                }}
                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedDuration === 120
                    ? "bg-[#087F5B] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                ⚡ 2 Dk
              </button>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setSelectedDuration(300);
                }}
                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedDuration === 300
                    ? "bg-[#6741D9] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                🔥 5 Dk
              </button>
            </div>
          )}

          {/* Sağ: 🔊 Tekrar Dinle & ✕ Çıkış */}
          <div className="flex items-center gap-1.5 shrink-0">
            {phase === "playing" && currentCard && (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  speakWord(currentCard.target);
                }}
                aria-label="Kelimeyi Tekrar Dinle"
                title="Tekrar Dinle (R)"
                className="min-h-[36px] px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 hover:border-[#087F5B] text-[#065F46] dark:text-emerald-400 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Volume2 size={15} className="shrink-0" />
                <span className="hidden sm:inline">Tekrar Dinle</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExit}
              aria-label="Oyundan Çık"
              className="min-h-[36px] px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 hover:border-rose-400 text-[var(--foreground)] text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <X size={15} className="shrink-0" />
              <span>Çıkış</span>
            </button>
          </div>
        </div>

        {/* İnce Geri Sayım Çubuğu (Sıfır inline style, saf SVG viewBox) */}
        {phase === "playing" && (
          <svg
            viewBox="0 0 1000 6"
            preserveAspectRatio="none"
            className="w-full h-1.5 block"
            aria-hidden="true"
          >
            <rect
              x="0"
              y="0"
              width="1000"
              height="6"
              className="fill-[#E6D7BE]/60 dark:fill-slate-800"
            />
            <rect
              x="0"
              y="0"
              width={barSvgWidth}
              height="6"
              className={
                timeLeft <= 15
                  ? "fill-rose-600 dark:fill-rose-500 transition-all duration-500"
                  : "fill-[#087F5B] dark:fill-emerald-500 transition-all duration-500"
              }
            />
          </svg>
        )}
      </header>

      {/* 1. AŞAMA: SEANS BAŞLANGIÇ EKRANI */}
      {phase === "ready" && (
        <main className="flex-1 min-h-0 w-full overflow-y-auto flex items-start justify-center p-2.5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="my-auto w-full max-w-xl flex flex-col items-center gap-3.5 sm:gap-5">
            <div className="text-center space-y-1.5">
              <p
                lang="ar"
                dir="rtl"
                className="arabic text-2xl sm:text-3xl font-bold text-[#087F5B] dark:text-emerald-400"
              >
                {formatArabicText("سِبَاقُ الصُّوَرِ", true, arabicFont)}
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-balance">
                Görsel Hız Seansı
              </h1>
              <p className="text-xs sm:text-sm text-[var(--muted)] max-w-md mx-auto leading-relaxed">
                {activeVisualPool.length} resimli ve sesli kelimeyle klavyesiz,
                tek başparmakla kaydırarak veya yön tuşlarıyla refleks pratiği
                yapın.
              </p>
            </div>

            {/* Süre Seçimi (2 Dk Hızlı Seans | 5 Dk Tam Seans) */}
            <div className="w-full grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setSelectedDuration(120);
                }}
                className={`min-h-[56px] p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-center ${
                  selectedDuration === 120
                    ? "bg-[#E6FCF5] dark:bg-emerald-950/50 border-[#087F5B] text-[#065F46] dark:text-emerald-300"
                    : "bg-white dark:bg-slate-900 border-[#E6D7BE] dark:border-slate-800 text-[var(--foreground)] hover:border-[#087F5B]"
                }`}
              >
                <span className="text-xs sm:text-sm font-extrabold whitespace-nowrap">
                  ⚡ 2 Dk Hızlı Seans
                </span>
                <span className="text-[11px] text-[var(--muted)]">
                  Günlük hızlı kelime refleksi
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setSelectedDuration(300);
                }}
                className={`min-h-[56px] p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-center ${
                  selectedDuration === 300
                    ? "bg-[#F3F0FF] dark:bg-indigo-950/50 border-[#6741D9] text-[#4C28B5] dark:text-indigo-200"
                    : "bg-white dark:bg-slate-900 border-[#E6D7BE] dark:border-slate-800 text-[var(--foreground)] hover:border-[#6741D9]"
                }`}
              >
                <span className="text-xs sm:text-sm font-extrabold whitespace-nowrap">
                  🔥 5 Dk Tam Seans
                </span>
                <span className="text-[11px] text-[var(--muted)]">
                  Derin görsel-işitsel pekiştirme
                </span>
              </button>
            </div>

            {/* 3 Mikro-Etkileşim Özeti */}
            <div className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-[#E6D7BE] dark:border-slate-800 divide-y divide-[#E6D7BE]/60 dark:divide-slate-800 text-xs">
              <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3">
                <span className="font-bold text-[var(--foreground)]">
                  ⬆️ Yukarı Doğru · ⬇️ Aşağı Yanlış
                </span>
                <span className="text-[var(--muted)] whitespace-nowrap">
                  Kaydır veya ↑ / ↓
                </span>
              </div>
              <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3">
                <span className="font-bold text-[var(--foreground)]">
                  ⬅️ Sol · ➡️ Sağ Doğru Görsel Seçimi
                </span>
                <span className="text-[var(--muted)] whitespace-nowrap">
                  Kaydır veya ← / →
                </span>
              </div>
              <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3">
                <span className="font-bold text-[var(--foreground)]">
                  🧩 Sağdan Sola Hızlı Hece Birleştirme
                </span>
                <span className="text-[var(--muted)] whitespace-nowrap">
                  Dokun veya 1–4
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => startSession(selectedDuration)}
              className="w-full min-h-[50px] sm:min-h-[52px] mb-1 px-6 rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm sm:text-base border-b-4 border-[#065F46] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Play size={18} fill="currentColor" />
              <span>
                {selectedDuration === 120
                  ? "⚡ 2 Dk Hızlı Seansı Başlat"
                  : "🔥 5 Dk Tam Seansı Başlat"}
              </span>
            </button>
          </div>
        </main>
      )}

      {/* 2. AŞAMA: AKTİF 60 FPS KAYDIRMA SAHNESİ */}
      {phase === "playing" && currentCard && (
        <main
          onPointerDown={handleArenaPointerDown}
          onPointerMove={handleArenaPointerMove}
          onPointerUp={handleArenaPointerEnd}
          onPointerCancel={handleArenaPointerEnd}
          className="relative flex-1 min-h-0 w-full max-w-2xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex flex-col items-center justify-between gap-2 sm:gap-3 overflow-hidden touch-none"
        >
          {/* YANLIŞ KAYDIRMADA 1 SANİYE DOĞRU EŞLEŞME GÖSTERİMİ */}
          {wrongReveal ? (
            <div className="my-auto w-full max-w-sm rounded-3xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-400 dark:border-rose-700 p-4 sm:p-5 flex flex-col items-center text-center gap-2.5 animate-in zoom-in-95 duration-150">
              <span className="text-xs font-extrabold text-rose-700 dark:text-rose-300">
                Hata Defterine Eklendi · Doğru Eşleşme:
              </span>
              {renderWordIllustration(
                wrongReveal.target,
                "w-36 h-36 sm:w-44 sm:h-44"
              )}
              <p
                lang="ar"
                dir="rtl"
                className="arabic text-3xl sm:text-4xl font-bold text-[var(--foreground)] leading-relaxed"
              >
                {formatArabicText(wrongReveal.target.arapca, true, arabicFont)}
              </p>
              <p className="text-sm sm:text-base font-extrabold text-[#065F46] dark:text-emerald-300">
                {cleanTrMeaning(wrongReveal.target.turkce)}
              </p>
            </div>
          ) : (
            <>
              {/* A) YENİ KELİME DAMLASI (1.5 SN TANITIM KARTI) */}
              {currentCard.kind === "drop_intro" && (
                <div className="my-auto w-full max-w-sm flex flex-col items-center gap-3">
                  <div className="text-xs font-extrabold text-[#087F5B] dark:text-emerald-400 flex items-center gap-1.5">
                    <span>💧 Yeni Kelime Damlası</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--muted)] font-semibold">
                      Geçmek için dokun veya kaydır
                    </span>
                  </div>

                  <div
                    ref={cardSurfaceRef}
                    onClick={advanceFromIntroCard}
                    className="w-full rounded-3xl bg-white dark:bg-slate-900 border-2 border-[#087F5B] p-4 sm:p-6 shadow-md flex flex-col items-center text-center gap-3 cursor-pointer"
                  >
                    {renderWordIllustration(
                      currentCard.target,
                      "w-[min(52vw,25vh)] h-[min(52vw,25vh)] sm:w-48 sm:h-48"
                    )}

                    <p
                      lang="ar"
                      dir="rtl"
                      className="arabic text-3xl sm:text-4xl font-bold text-[var(--foreground)] leading-relaxed"
                    >
                      {formatArabicText(
                        currentCard.target.arapca,
                        true,
                        arabicFont
                      )}
                    </p>

                    <p className="text-base sm:text-lg font-extrabold text-[#087F5B] dark:text-emerald-400">
                      {cleanTrMeaning(currentCard.target.turkce)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={advanceFromIntroCard}
                    className="min-h-[42px] px-5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Hız Turuna Geç →
                  </button>
                </div>
              )}

              {/* B) YUKARI / AŞAĞI KAYDIR (DOĞRU MU YANLIŞ MI?) */}
              {currentCard.kind === "up_down_tf" && currentCard.displayedWord && (
                <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-between py-1 gap-2">
                  {/* Üst Yön İpucu + Canlı Kaydırma Rozeti */}
                  <div className="relative flex items-center justify-center h-8 shrink-0">
                    <span className="text-xs font-bold text-[var(--muted)] flex items-center gap-1">
                      <ArrowUp size={14} className="text-emerald-600" />
                      <span>Doğruysa Yukarı Kaydır</span>
                    </span>
                    <div
                      ref={upCueRef}
                      className="pointer-events-none absolute inset-x-0 -top-0.5 flex justify-center opacity-0 transition-opacity"
                    >
                      <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shadow-sm whitespace-nowrap">
                        ⬆️ DOĞRU EŞLEŞME
                      </span>
                    </div>
                  </div>

                  {/* Ortadaki Sürüklenebilir Kart */}
                  <div
                    ref={cardSurfaceRef}
                    className={`w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border-2 p-4 sm:p-5 shadow-md flex flex-col items-center text-center gap-2.5 sm:gap-3 cursor-grab active:cursor-grabbing ${
                      flashResult === "correct"
                        ? "border-emerald-500"
                        : "border-[#E6D7BE] dark:border-slate-700"
                    }`}
                  >
                    {renderWordIllustration(
                      currentCard.target,
                      "w-[min(52vw,25vh)] h-[min(52vw,25vh)] sm:w-48 sm:h-48"
                    )}

                    <div className="space-y-1">
                      <p
                        lang="ar"
                        dir="rtl"
                        className="arabic text-3xl sm:text-4xl font-bold text-[var(--foreground)] leading-relaxed"
                      >
                        {formatArabicText(
                          currentCard.displayedWord.arapca,
                          true,
                          arabicFont
                        )}
                      </p>
                      <p className="text-[11px] sm:text-xs font-semibold text-[var(--muted)]">
                        Görsel ile Arapça kelime eşleşiyor mu?
                      </p>
                    </div>
                  </div>

                  {/* Alt Yön İpucu + Dokunmatik Hızlı Butonlar (↓ Yanlış / ↑ Doğru) */}
                  <div className="w-full max-w-sm space-y-2 shrink-0">
                    <div className="relative flex items-center justify-center h-6">
                      <span className="text-xs font-bold text-[var(--muted)] flex items-center gap-1">
                        <ArrowDown size={14} className="text-rose-600" />
                        <span>Yanlışsa Aşağı Kaydır</span>
                      </span>
                      <div
                        ref={downCueRef}
                        className="pointer-events-none absolute inset-x-0 -bottom-0.5 flex justify-center opacity-0 transition-opacity"
                      >
                        <span className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs font-extrabold shadow-sm whitespace-nowrap">
                          ⬇️ YANLIŞ EŞLEŞME
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleUpDownAnswer(false)}
                        className="min-h-[46px] px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border-2 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <X size={16} strokeWidth={2.6} />
                        <span>✕ Yanlış (↓)</span>
                      </button>

                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleUpDownAnswer(true)}
                        className="min-h-[46px] px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 border-2 border-emerald-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <Check size={16} strokeWidth={2.8} />
                        <span>✓ Doğru (↑)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* C) SAĞA / SOLA GÖRSEL SEÇİMİ */}
              {currentCard.kind === "left_right_pick" &&
                currentCard.leftVisual &&
                currentCard.rightVisual && (
                  <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-between py-1 gap-2.5">
                    {/* Üstte Seslendirilen Arapça Kelime Kartı */}
                    <div
                      ref={cardSurfaceRef}
                      className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border-2 border-[#E6D7BE] dark:border-slate-700 px-4 py-3 sm:py-4 text-center shadow-sm space-y-1 cursor-grab active:cursor-grabbing shrink-0"
                    >
                      <span className="text-[11px] sm:text-xs font-bold text-[var(--muted)]">
                        Doğru görselin yönüne kaydırın veya dokunun
                      </span>
                      <div className="flex items-center justify-center gap-2.5">
                        <p
                          lang="ar"
                          dir="rtl"
                          className="arabic text-3xl sm:text-4xl font-bold text-[var(--foreground)] leading-relaxed"
                        >
                          {formatArabicText(
                            currentCard.target.arapca,
                            true,
                            arabicFont
                          )}
                        </p>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            playClick();
                            speakWord(currentCard.target);
                          }}
                          aria-label="Kelimeyi Dinle"
                          className="w-9 h-9 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-center text-[#087F5B] dark:text-emerald-400 shrink-0 cursor-pointer"
                        >
                          <Volume2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Sol ve Sağ Görsel Seçim Kartları */}
                    <div className="w-full grid grid-cols-2 gap-3 sm:gap-4 items-center my-auto">
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleLeftRightAnswer("left")}
                        className="group relative rounded-3xl bg-white dark:bg-slate-900 border-2 border-[#E6D7BE] dark:border-slate-700 hover:border-[#087F5B] p-2.5 sm:p-3.5 flex flex-col items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <div
                          ref={leftCueRef}
                          className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 transition-opacity z-10"
                        >
                          <span className="px-2.5 py-0.5 rounded-lg bg-[#087F5B] text-white text-[11px] font-extrabold whitespace-nowrap">
                            ⬅️ SOL SEÇİM
                          </span>
                        </div>

                        {renderWordIllustration(
                          currentCard.leftVisual,
                          "w-full aspect-square max-h-[26vh] sm:max-h-[30vh]"
                        )}

                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--foreground)] group-hover:text-[#087F5B] dark:group-hover:text-emerald-400 whitespace-nowrap">
                          <ArrowLeft size={14} />
                          <span>Sol Görsel</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => handleLeftRightAnswer("right")}
                        className="group relative rounded-3xl bg-white dark:bg-slate-900 border-2 border-[#E6D7BE] dark:border-slate-700 hover:border-[#087F5B] p-2.5 sm:p-3.5 flex flex-col items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <div
                          ref={rightCueRef}
                          className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 transition-opacity z-10"
                        >
                          <span className="px-2.5 py-0.5 rounded-lg bg-[#087F5B] text-white text-[11px] font-extrabold whitespace-nowrap">
                            ➡️ SAĞ SEÇİM
                          </span>
                        </div>

                        {renderWordIllustration(
                          currentCard.rightVisual,
                          "w-full aspect-square max-h-[26vh] sm:max-h-[30vh]"
                        )}

                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--foreground)] group-hover:text-[#087F5B] dark:group-hover:text-emerald-400 whitespace-nowrap">
                          <span>Sağ Görsel</span>
                          <ArrowRight size={14} />
                        </span>
                      </button>
                    </div>

                    <p className="text-[11px] font-semibold text-[var(--muted)] shrink-0">
                      ⬅️ Sola veya ➡️ Sağa kaydırarak ya da görsele dokunarak
                      eşleştirin
                    </p>
                  </div>
                )}

              {/* D) HIZLI HECE / HARF BİRLEŞTİRME (SAĞDAN SOLA) */}
              {currentCard.kind === "syllable_tap" &&
                currentCard.orderedChunks &&
                currentCard.shuffledBubbles && (
                  <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-between py-1 gap-2.5">
                    <span className="text-xs font-bold text-[#6741D9] dark:text-indigo-300 shrink-0">
                      🧩 Hece / Harf Birleştirme (Sağdan Sola Sırayla Dokunun)
                    </span>

                    <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border-2 border-[#E6D7BE] dark:border-slate-700 p-3.5 sm:p-4 flex flex-col items-center gap-2.5 shadow-sm">
                      {renderWordIllustration(
                        currentCard.target,
                        "w-[min(44vw,22vh)] h-[min(44vw,22vh)] sm:w-40 sm:h-40"
                      )}

                      <p className="text-xs sm:text-sm font-bold text-[var(--muted)]">
                        {cleanTrMeaning(currentCard.target.turkce)}
                      </p>

                      {/* Sağdan Sola (RTL) Birleştirme Yuvaları */}
                      <div
                        dir="rtl"
                        lang="ar"
                        className="w-full min-h-[52px] rounded-2xl bg-[#F7EFE1] dark:bg-slate-800/80 border border-[#E6D7BE] dark:border-slate-700 px-3 py-2 flex flex-wrap items-center justify-center gap-1.5"
                      >
                        {currentCard.orderedChunks.map((chunkText, slotIdx) => {
                          const isFilled = slotIdx < pickedBubbleUids.length;
                          const isCurrentTarget =
                            slotIdx === pickedBubbleUids.length;
                          return (
                            <span
                              key={`slot_${slotIdx}`}
                              className={`arabic min-w-[44px] min-h-[38px] px-2.5 py-1 rounded-xl text-xl sm:text-2xl font-bold inline-flex items-center justify-center transition-all ${
                                isFilled
                                  ? "bg-[#087F5B] text-white"
                                  : isCurrentTarget
                                  ? "bg-white dark:bg-slate-900 border-2 border-dashed border-[#6741D9] text-transparent"
                                  : "bg-white/60 dark:bg-slate-900/50 border border-dashed border-[#D5C3A3] dark:border-slate-700 text-transparent"
                              }`}
                            >
                              {isFilled ? (
                                formatArabicText(chunkText, true, arabicFont)
                              ) : (
                                "••"
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Karıştırılmış Hece Baloncukları */}
                    <div
                      dir="rtl"
                      lang="ar"
                      className="w-full max-w-md flex flex-wrap items-center justify-center gap-2.5 shrink-0 pb-1"
                    >
                      {currentCard.shuffledBubbles.map((bubble) => {
                        const used = pickedBubbleUids.includes(bubble.uid);
                        return (
                          <button
                            key={bubble.uid}
                            type="button"
                            disabled={used}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => handleSyllableBubbleTap(bubble)}
                            className={`arabic min-w-[68px] min-h-[50px] px-4 py-2 rounded-2xl border-2 border-b-4 text-2xl sm:text-3xl font-bold transition-all cursor-pointer ${
                              used
                                ? "opacity-25 scale-95 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 pointer-events-none"
                                : "bg-white dark:bg-slate-900 border-[#6741D9] text-[var(--foreground)] hover:bg-[#F3F0FF] dark:hover:bg-indigo-950/50 active:translate-y-0.5"
                            }`}
                          >
                            {formatArabicText(bubble.text, true, arabicFont)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
            </>
          )}
        </main>
      )}

      {/* 3. AŞAMA: SEANS SONU HIZ KARNESİ */}
      {phase === "finished" && (
        <main className="flex-1 min-h-0 w-full max-w-2xl mx-auto px-4 py-4 sm:py-6 flex flex-col gap-4 overflow-y-auto touch-pan-y">
          {/* Başlık */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] flex items-center gap-2">
                <Trophy size={20} className="text-amber-500 shrink-0" />
                <span>Seans Sonu Hız Karnesi</span>
              </h2>
              <p className="text-xs text-[var(--muted)]">
                {Math.round(activeTotalDuration / 60)} dakikalık görsel-işitsel
                kelime refleksi tamamlandı
              </p>
            </div>
          </div>

          {/* 3 Temel Performans Metriği */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E6D7BE] dark:border-slate-800 p-3 text-center space-y-0.5">
              <span className="block text-lg sm:text-2xl font-extrabold text-[#087F5B] dark:text-emerald-400 tabular-nums">
                {wordsPerMinute}
              </span>
              <span className="block text-[11px] font-semibold text-[var(--muted)]">
                Kelime / Dk
              </span>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E6D7BE] dark:border-slate-800 p-3 text-center space-y-0.5">
              <span className="block text-lg sm:text-2xl font-extrabold text-[#6741D9] dark:text-indigo-400 tabular-nums">
                %{accuracyPercent}
              </span>
              <span className="block text-[11px] font-semibold text-[var(--muted)]">
                İsabet ({correctCount}/{totalAnswered})
              </span>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E6D7BE] dark:border-slate-800 p-3 text-center space-y-0.5">
              <span className="block text-lg sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                x{bestCombo}
              </span>
              <span className="block text-[11px] font-semibold text-[var(--muted)]">
                En Yüksek Kombo
              </span>
            </div>
          </div>

          {/* Öğrenilen Kelimelerin Sesli Listesi */}
          <div className="flex-1 min-h-[150px] rounded-2xl bg-white dark:bg-slate-900 border border-[#E6D7BE] dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-[#E6D7BE] dark:border-slate-800 flex items-center justify-between text-xs font-extrabold">
              <span>
                Bu Seansta Çalışılan Kelimeler ({sessionLearnedWords.length})
              </span>
              <span className="text-[11px] font-semibold text-[var(--muted)]">
                Dinlemek için dokunun
              </span>
            </div>

            {sessionLearnedWords.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6 text-xs text-[var(--muted)] text-center">
                Henüz tamamlanan kelime kaydı yok. Yeni bir hız seansı başlatarak
                kelimeleri biriktirebilirsiniz.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-[#E6D7BE]/60 dark:divide-slate-800">
                {sessionLearnedWords.map((word) => (
                  <button
                    key={word.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      speakWord(word);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[#F7EFE1]/60 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {renderWordIllustration(word, "w-10 h-10 shrink-0")}
                      <div className="min-w-0">
                        <span className="block text-xs sm:text-sm font-bold text-[var(--foreground)] truncate">
                          {cleanTrMeaning(word.turkce)}
                        </span>
                        <span className="block text-[11px] text-[var(--muted)]">
                          {word.cefr} · {word.kategori_tr}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        lang="ar"
                        dir="rtl"
                        className="arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-400"
                      >
                        {formatArabicText(word.arapca, true, arabicFont)}
                      </span>
                      <Volume2
                        size={15}
                        className="text-[var(--muted)] shrink-0"
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Alt Aksiyon Butonları: 🎯 Zorlandığım Kelimelerle 1 Dk Tekrar Yap + Yeni Seans */}
          <div className="space-y-2 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => startSession(60, retryWeakVisualPool)}
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs sm:text-sm font-extrabold border-b-4 border-[#3b1f8c] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Target size={16} className="shrink-0" />
              <span>
                🎯 Zorlandığım Kelimelerle 1 Dk Tekrar Yap
                {sessionStruggledWords.length > 0
                  ? ` (${sessionStruggledWords.length})`
                  : ""}
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => startSession(selectedDuration)}
                className="min-h-[44px] px-3.5 rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw size={15} className="shrink-0" />
                <span>Tekrar Oyna ({Math.round(selectedDuration / 60)} Dk)</span>
              </button>

              <button
                type="button"
                onClick={handleExit}
                className="min-h-[44px] px-3.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#E6D7BE] dark:border-slate-700 text-[var(--foreground)] text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <X size={15} className="shrink-0" />
                <span>Vitrine Dön</span>
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
