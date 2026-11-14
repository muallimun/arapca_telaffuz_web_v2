"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  Trophy,
  Flame,
  Heart,
  Timer,
  Sparkles,
  RotateCcw,
  Download,
  Printer,
  Target,
  Play,
  X,
  Snowflake,
  Search,
  Award,
  CheckCircle2,
  Home,
} from "lucide-react";
import {
  ResimliKelime,
  DictionaryItem,
  Dialogue,
  SynonymAntonymEntry,
  Level,
} from "@/types/data";
import { gorselKelimeler, sozluk, resolveImageUrl } from "@/lib/data";
import { ArabicIdiom } from "@/lib/arabicIdioms";
import { removeArabicHarakat as stripHarakat } from "@/lib/arabicTextUtils";
import { shuffleArray } from "@/lib/quiz";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import { playDualGenderAudio, stopAllAudio } from "@/lib/audio";
import {
  playClick,
  playStart,
  playCorrect,
  playWrong,
  playFanfare,
  sfx,
} from "@/lib/sfxManager";
import { normalizeToCanonicalMistakeId } from "@/lib/mistakeUtils";
import { saveLastExerciseSummary } from "@/lib/learningAnalytics";

export type SafariDifficulty = "easy" | "medium" | "hard";
export type SafariGameMode = "normal" | "time";

export interface SafariWordItem {
  id: string;
  audioId?: string;
  nameAr: string;
  meaningTr: string;
  imageUrl?: string;
  ses_erkek?: string;
  ses_kadin?: string;
  cefr?: Level;
}

type BalloonKind = "word" | "freeze" | "hint" | "golden";

interface ActiveBalloon {
  uid: string;
  kind: BalloonKind;
  word?: SafariWordItem;
  isTarget: boolean;
  x: number;
  y: number;
  baseY: number;
  speedX: number;
  wobblePhase: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  paletteIndex: number;
  popped: boolean;
}

interface PopParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  radius: number;
}

interface FloatingBadge {
  id: string;
  x: number;
  y: number;
  text: string;
  tone: "gold" | "emerald" | "cyan" | "rose";
  life: number;
}

export interface BalloonSafariGameProps {
  visualPool?: ResimliKelime[];
  vocabulary?: DictionaryItem[];
  idioms?: ArabicIdiom[];
  dialogues?: Dialogue[];
  synonymEntries?: SynonymAntonymEntry[];
  isSynonymsAntonymsMode?: boolean;
  cefrFilter?: "all" | Level;
  isMistakesMode?: boolean;
  onClose?: () => void;
}

const STAGE_W = 1120;
const STAGE_H = 620;
const HS_NORMAL_KEY = "muallimun_balloon_safari_hs_normal";
const HS_TIME_KEY = "muallimun_balloon_safari_hs_time";

// Sıcak hava balonu dikey şerit ve alt etiket renk paletleri (#2196F3 mavi / #FF9800 turuncu etiketler)
const HOT_AIR_PALETTES = [
  {
    outerStripe: "#4D7C63",
    midStripe: "#8A9B98",
    tagBg: "#2196F3",
    burst: "#2196F3",
  },
  {
    outerStripe: "#52796F",
    midStripe: "#94A3B8",
    tagBg: "#FF9800",
    burst: "#FF9800",
  },
  {
    outerStripe: "#3D7058",
    midStripe: "#7E8F8C",
    tagBg: "#2196F3",
    burst: "#10B981",
  },
  {
    outerStripe: "#5F856B",
    midStripe: "#8D99AE",
    tagBg: "#FF9800",
    burst: "#F97316",
  },
] as const;

function cleanMeaningTr(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "Kelime";
  const firstPart = trimmed.split(/[;/]/)[0]?.trim() || trimmed;
  return firstPart.length > 34 ? `${firstPart.slice(0, 32)}…` : firstPart;
}

function computeLevelFromRound(roundNum: number): 1 | 2 | 3 | 4 {
  if (roundNum <= 3) return 1;
  if (roundNum <= 7) return 2;
  if (roundNum <= 12) return 3;
  return 4;
}

function getBalloonCountForLevel(level: 1 | 2 | 3 | 4): number {
  if (level === 1) return 2;
  if (level === 2) return 3;
  if (level === 3) return 4;
  return 5;
}

function getSpeedBase(difficulty: SafariDifficulty, level: 1 | 2 | 3 | 4): number {
  const diffBase =
    difficulty === "easy" ? 58 : difficulty === "medium" ? 80 : 106;
  const levelBoost = (level - 1) * 11;
  return diffBase + levelBoost;
}

export default function BalloonSafariGame({
  visualPool = [],
  vocabulary = [],
  idioms = [],
  dialogues = [],
  synonymEntries = [],
  isSynonymsAntonymsMode = false,
  cefrFilter = "all",
  onClose,
}: BalloonSafariGameProps) {
  const { preferredVoiceGender, speechRate } = useSettings();
  const { addMistake, recordItemAttempt, addStudyMinutes } = useUserStore();

  // Görsel kelime hızlı eşleme dizini
  const visualLookup = useMemo(() => {
    const byId = new Map<string, ResimliKelime>();
    const byBareAr = new Map<string, ResimliKelime>();
    for (const vk of gorselKelimeler) {
      byId.set(vk.id, vk);
      const bare = stripHarakat(vk.arapca || "").trim();
      if (bare && !byBareAr.has(bare)) {
        byBareAr.set(bare, vk);
      }
    }
    return { byId, byBareAr };
  }, []);

  // Seçili havuzdan birleşik Safari kelime havuzu üretimi
  const fullSafariPool = useMemo<SafariWordItem[]>(() => {
    const items: SafariWordItem[] = [];
    const seenIds = new Set<string>();

    const pushUnique = (item: SafariWordItem) => {
      if (!item.nameAr || !item.meaningTr) return;
      if (seenIds.has(item.id)) return;
      seenIds.add(item.id);
      items.push(item);
    };

    if (isSynonymsAntonymsMode && synonymEntries.length > 0) {
      for (const ez of synonymEntries) {
        const bare = stripHarakat(ez.kelime_ar || "").trim();
        const matchedVk = visualLookup.byBareAr.get(bare);
        const matchedDict = sozluk.find(
          (w) => stripHarakat(w.mufret || w.mazi || "").trim() === bare
        );
        pushUnique({
          id: ez.id,
          audioId: matchedVk?.id || matchedDict?.id,
          nameAr: ez.kelime_ar,
          meaningTr: cleanMeaningTr(ez.anlam_tr),
          imageUrl: matchedVk?.gorsel
            ? resolveImageUrl(matchedVk.gorsel)
            : matchedDict?.gorsel
            ? resolveImageUrl(matchedDict.gorsel)
            : undefined,
          ses_erkek: matchedVk?.ses_erkek || matchedDict?.ses_erkek,
          ses_kadin: matchedVk?.ses_kadin || matchedDict?.ses_kadin,
          cefr: ez.cefr,
        });
      }
    }

    if (items.length === 0 && visualPool.length > 0 && vocabulary.length === 0) {
      for (const vk of visualPool) {
        pushUnique({
          id: vk.id,
          audioId: vk.id,
          nameAr: vk.arapca,
          meaningTr: cleanMeaningTr(vk.turkce),
          imageUrl: vk.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
          ses_erkek: vk.ses_erkek,
          ses_kadin: vk.ses_kadin,
          cefr: vk.cefr,
        });
      }
    }

    if (items.length === 0 && vocabulary.length > 0) {
      for (const word of vocabulary) {
        const ar = (word.mufret || word.mazi || "").trim();
        if (!ar) continue;
        const bare = stripHarakat(ar).trim();
        const matchedVk =
          visualLookup.byId.get(word.id) || visualLookup.byBareAr.get(bare);
        const imgRaw = word.gorsel || matchedVk?.gorsel;
        pushUnique({
          id: word.id,
          audioId: word.id,
          nameAr: ar,
          meaningTr: cleanMeaningTr(word.anlam_tr),
          imageUrl: imgRaw ? resolveImageUrl(imgRaw) : undefined,
          ses_erkek: word.ses_erkek || matchedVk?.ses_erkek,
          ses_kadin: word.ses_kadin || matchedVk?.ses_kadin,
          cefr: (word.cefr as Level | undefined) || matchedVk?.cefr,
        });
      }
    }

    if (items.length === 0 && visualPool.length > 0) {
      for (const vk of visualPool) {
        pushUnique({
          id: vk.id,
          audioId: vk.id,
          nameAr: vk.arapca,
          meaningTr: cleanMeaningTr(vk.turkce),
          imageUrl: vk.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
          ses_erkek: vk.ses_erkek,
          ses_kadin: vk.ses_kadin,
          cefr: vk.cefr,
        });
      }
    }

    if (items.length < 6 && idioms.length > 0) {
      for (const idm of idioms) {
        pushUnique({
          id: `idiom_${idm.id}`,
          nameAr: idm.arabic,
          meaningTr: cleanMeaningTr(idm.meaningTr),
        });
      }
    }

    if (items.length < 6 && dialogues.length > 0) {
      for (const dlg of dialogues) {
        for (const line of dlg.satirlar.slice(0, 4)) {
          if (line.arapca.split(/\s+/).length <= 5) {
            pushUnique({
              id: `sent_${dlg.id}_${line.sira}`,
              nameAr: line.arapca,
              meaningTr: cleanMeaningTr(line.turkce),
              cefr: dlg.seviye,
            });
          }
        }
      }
    }

    if (items.length < 8) {
      const fallbackPool =
        cefrFilter === "all"
          ? gorselKelimeler
          : gorselKelimeler.filter((w) => w.cefr === cefrFilter);
      for (const vk of fallbackPool.slice(0, 30)) {
        pushUnique({
          id: vk.id,
          audioId: vk.id,
          nameAr: vk.arapca,
          meaningTr: cleanMeaningTr(vk.turkce),
          imageUrl: vk.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
          ses_erkek: vk.ses_erkek,
          ses_kadin: vk.ses_kadin,
          cefr: vk.cefr,
        });
        if (items.length >= 24) break;
      }
    }

    return items;
  }, [
    isSynonymsAntonymsMode,
    synonymEntries,
    visualPool,
    vocabulary,
    idioms,
    dialogues,
    cefrFilter,
    visualLookup,
  ]);

  // Ekran ve oyun durumları
  const [phase, setPhase] = useState<"menu" | "playing" | "gameover">("menu");
  const [difficulty, setDifficulty] = useState<SafariDifficulty>("medium");
  const [gameMode, setGameMode] = useState<SafariGameMode>("normal");
  const [isMuted, setIsMuted] = useState(false);

  // Opsiyonel yerel public/images/background.png ve public/images/balon.png algılama (kırık görsel üretmeden)
  const [hasCustomBg, setHasCustomBg] = useState(false);
  const [hasCustomBalloon, setHasCustomBalloon] = useState(false);

  const [hsNormal, setHsNormal] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const saved = Number(window.localStorage.getItem(HS_NORMAL_KEY) || "0");
      return Number.isFinite(saved) && saved > 0 ? saved : 0;
    } catch {
      return 0;
    }
  });
  const [hsTime, setHsTime] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const saved = Number(window.localStorage.getItem(HS_TIME_KEY) || "0");
      return Number.isFinite(saved) && saved > 0 ? saved : 0;
    } catch {
      return 0;
    }
  });
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  // Oyun içi HUD durumları
  const [score, setScore] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [targetWord, setTargetWord] = useState<SafariWordItem | null>(null);
  const [balloons, setBalloons] = useState<ActiveBalloon[]>([]);
  const [particles, setParticles] = useState<PopParticle[]>([]);
  const [floatingBadges, setFloatingBadges] = useState<FloatingBadge[]>([]);
  const [freezeRemainingMs, setFreezeRemainingMs] = useState(0);
  const [hintActive, setHintActive] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [comboMilestoneBanner, setComboMilestoneBanner] = useState<
    string | null
  >(null);

  // İstatistik ve Hata Analizi
  const [correctPops, setCorrectPops] = useState(0);
  const [wrongPops, setWrongPops] = useState(0);
  const [wrongCounts, setWrongCounts] = useState<Record<string, number>>({});
  const [practiceSubset, setPracticeSubset] = useState<SafariWordItem[] | null>(
    null
  );
  const [studentName, setStudentName] = useState("");
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Animasyon döngüsü için güncel referanslar
  const balloonsRef = useRef<ActiveBalloon[]>([]);
  const particlesRef = useRef<PopParticle[]>([]);
  const badgesRef = useRef<FloatingBadge[]>([]);
  const freezeUntilRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const roundDeckRef = useRef<SafariWordItem[]>([]);
  const sessionStartRef = useRef<number>(0);
  const roundLockRef = useRef<boolean>(false);
  const scoreRef = useRef<number>(0);
  const correctPopsRef = useRef<number>(0);
  const wrongPopsRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    correctPopsRef.current = correctPops;
  }, [correctPops]);

  useEffect(() => {
    wrongPopsRef.current = wrongPops;
  }, [wrongPops]);

  // Eğer public/images/background.png veya public/images/balon.png dizinde mevcutsa sessizce algıla
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const bgProbe = new window.Image();
    bgProbe.onload = () => {
      if (!cancelled && bgProbe.naturalWidth > 0) {
        setHasCustomBg(true);
      }
    };
    bgProbe.src = "/images/background.png";

    const balloonProbe = new window.Image();
    balloonProbe.onload = () => {
      if (!cancelled && balloonProbe.naturalWidth > 0) {
        setHasCustomBalloon(true);
      }
    };
    balloonProbe.src = "/images/balon.png";

    return () => {
      cancelled = true;
    };
  }, []);

  // Unmount temizliği
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      stopAllAudio();
      sfx.stopAllSfx();
    };
  }, []);

  const currentLevel = useMemo(
    () => computeLevelFromRound(roundNumber),
    [roundNumber]
  );

  const speakSafariWord = useCallback(
    (word: SafariWordItem | null) => {
      if (!word || isMutedRef.current) return;
      stopAllAudio();
      void playDualGenderAudio({
        text: word.nameAr,
        id: word.audioId,
        ses_erkek: word.ses_erkek,
        ses_kadin: word.ses_kadin,
        gender: preferredVoiceGender,
        rate: speechRate || 1,
      }).catch(() => {
        // ignore
      });
    },
    [preferredVoiceGender, speechRate]
  );

  const returnToSafariHome = useCallback(() => {
    playClick();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopAllAudio();
    sfx.stopAllSfx();
    setPhase("menu");
  }, []);

  const finishGame = useCallback(
    (finalScoreValue: number, modeUsed: SafariGameMode) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      stopAllAudio();
      const elapsedMin = Math.max(
        1,
        Math.round((Date.now() - sessionStartRef.current) / 60000)
      );
      addStudyMinutes(elapsedMin);

      const solvedTotal = correctPopsRef.current + wrongPopsRef.current;
      if (solvedTotal > 0) {
        saveLastExerciseSummary({
          moduleName: "🎈 Balon Safari",
          solved: solvedTotal,
          correct: correctPopsRef.current,
          wrong: wrongPopsRef.current,
        });
      }

      let beatRecord = false;
      try {
        if (modeUsed === "normal") {
          const prev = Number(window.localStorage.getItem(HS_NORMAL_KEY) || "0");
          if (finalScoreValue > prev) {
            window.localStorage.setItem(HS_NORMAL_KEY, String(finalScoreValue));
            setHsNormal(finalScoreValue);
            beatRecord = true;
          }
        } else {
          const prev = Number(window.localStorage.getItem(HS_TIME_KEY) || "0");
          if (finalScoreValue > prev) {
            window.localStorage.setItem(HS_TIME_KEY, String(finalScoreValue));
            setHsTime(finalScoreValue);
            beatRecord = true;
          }
        }
      } catch {
        // ignore
      }
      setIsNewHighScore(beatRecord);
      setPhase("gameover");
      if (!isMutedRef.current) {
        void playFanfare(finalScoreValue >= 300 ? 90 : 70);
      }
    },
    [addStudyMinutes]
  );

  const spawnRoundWave = useCallback(
    (
      nextRoundNum: number,
      diff: SafariDifficulty,
      activeTargetPool: SafariWordItem[]
    ) => {
      roundLockRef.current = false;
      setHintActive(false);

      if (roundDeckRef.current.length === 0) {
        roundDeckRef.current = shuffleArray([...activeTargetPool]);
      }
      const pickedTarget =
        roundDeckRef.current.pop() || activeTargetPool[0] || fullSafariPool[0];
      if (!pickedTarget) return;

      setTargetWord(pickedTarget);
      setRoundNumber(nextRoundNum);

      const lvl = computeLevelFromRound(nextRoundNum);
      const count = getBalloonCountForLevel(lvl);
      const baseSpeed = getSpeedBase(diff, lvl);

      const distractorCandidates = shuffleArray(
        fullSafariPool.filter(
          (item) =>
            item.id !== pickedTarget.id &&
            item.nameAr !== pickedTarget.nameAr &&
            item.meaningTr !== pickedTarget.meaningTr
        )
      );
      const distractors = distractorCandidates.slice(0, Math.max(1, count - 1));
      const waveWords = shuffleArray([pickedTarget, ...distractors]);

      // Sıcak hava balonları (kubbe + hasır sepet + alt Arapça etiket) taşmayacak şekilde şeritlere dağıtılır
      const minY = 175;
      const maxY = STAGE_H - 185;
      const laneStep =
        waveWords.length > 1 ? (maxY - minY) / (waveWords.length - 1) : 0;
      const shuffledLanes = shuffleArray(
        waveWords.map((_, idx) =>
          waveWords.length === 1 ? (minY + maxY) / 2 : minY + idx * laneStep
        )
      );

      const created: ActiveBalloon[] = waveWords.map((w, idx) => {
        const startX = STAGE_W + 95 + idx * 195 + (idx % 2) * 32;
        const baseY = shuffledLanes[idx] ?? 290;
        return {
          uid: `b_${nextRoundNum}_${idx}_${w.id}`,
          kind: "word",
          word: w,
          isTarget: w.id === pickedTarget.id,
          x: startX,
          y: baseY,
          baseY,
          speedX: baseSpeed * (0.92 + (idx % 3) * 0.09),
          wobblePhase: idx * 1.35,
          wobbleSpeed: 2.0 + (idx % 3) * 0.32,
          wobbleAmp: 12 + (idx % 2) * 6,
          paletteIndex: (nextRoundNum + idx) % HOT_AIR_PALETTES.length,
          popped: false,
        };
      });

      // Her birkaç turda güçlendirici veya 5x Altın Sıcak Hava Balonu ekle
      if (nextRoundNum % 3 === 0) {
        const powerKind: BalloonKind =
          nextRoundNum % 6 === 0 ? "freeze" : "hint";
        created.push({
          uid: `pwr_${nextRoundNum}_${powerKind}`,
          kind: powerKind,
          isTarget: false,
          x: STAGE_W + 250,
          y: 195,
          baseY: 195,
          speedX: baseSpeed * 1.12,
          wobblePhase: 0.7,
          wobbleSpeed: 2.6,
          wobbleAmp: 14,
          paletteIndex: 2,
          popped: false,
        });
      }

      if (nextRoundNum % 4 === 0) {
        created.push({
          uid: `gold_${nextRoundNum}`,
          kind: "golden",
          isTarget: false,
          x: STAGE_W + 390,
          y: STAGE_H - 195,
          baseY: STAGE_H - 195,
          speedX: baseSpeed * 1.45,
          wobblePhase: 1.9,
          wobbleSpeed: 3.1,
          wobbleAmp: 16,
          paletteIndex: 1,
          popped: false,
        });
      }

      balloonsRef.current = created;
      setBalloons(created);

      setTimeout(() => {
        speakSafariWord(pickedTarget);
      }, 140);
    },
    [fullSafariPool, speakSafariWord]
  );

  // Zamana karşı mod geri sayım sayacı
  useEffect(() => {
    if (phase !== "playing" || gameMode !== "time") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            finishGame(scoreRef.current, "time");
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, gameMode, finishGame]);

  // requestAnimationFrame sıcak hava balonu fiziği ve parçacık döngüsü
  useEffect(() => {
    if (phase !== "playing") {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastFrameTimeRef.current = performance.now();

    const step = (now: number) => {
      const dt = Math.min(
        0.05,
        Math.max(0.001, (now - lastFrameTimeRef.current) / 1000)
      );
      lastFrameTimeRef.current = now;

      const frozenLeft = Math.max(0, freezeUntilRef.current - now);
      setFreezeRemainingMs(frozenLeft > 50 ? frozenLeft : 0);
      const isFrozen = frozenLeft > 0;

      const nextBalloons: ActiveBalloon[] = [];
      for (const b of balloonsRef.current) {
        if (b.popped) continue;
        const nextPhase =
          b.wobblePhase + (isFrozen ? dt * 0.55 : dt * b.wobbleSpeed);
        let nextX = isFrozen ? b.x : b.x - b.speedX * dt;
        const nextY = b.baseY + Math.sin(nextPhase) * b.wobbleAmp;

        if (nextX < -125) {
          if (b.kind === "word") {
            nextX = STAGE_W + 115;
          } else {
            continue;
          }
        }

        nextBalloons.push({
          ...b,
          x: nextX,
          y: nextY,
          wobblePhase: nextPhase,
        });
      }
      balloonsRef.current = nextBalloons;
      setBalloons(nextBalloons);

      if (particlesRef.current.length > 0) {
        const updatedParticles = particlesRef.current
          .map((p) => ({
            ...p,
            x: p.x + p.vx * dt,
            y: p.y + p.vy * dt,
            vy: p.vy + 180 * dt,
            life: p.life - dt * 1.9,
          }))
          .filter((p) => p.life > 0);
        particlesRef.current = updatedParticles;
        setParticles(updatedParticles);
      }

      if (badgesRef.current.length > 0) {
        const updatedBadges = badgesRef.current
          .map((fb) => ({
            ...fb,
            y: fb.y - 42 * dt,
            life: fb.life - dt * 1.15,
          }))
          .filter((fb) => fb.life > 0);
        badgesRef.current = updatedBadges;
        setFloatingBadges(updatedBadges);
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [phase]);

  const spawnBurst = useCallback((x: number, y: number, color: string) => {
    const burst: PopParticle[] = Array.from({ length: 14 }, (_, idx) => {
      const angle = (Math.PI * 2 * idx) / 14;
      const speed = 80 + (idx % 3) * 48;
      return {
        id: `pt_${Date.now()}_${idx}_${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 25,
        life: 1,
        color,
        radius: idx % 2 === 0 ? 7 : 5,
      };
    });
    particlesRef.current = [...particlesRef.current, ...burst];
    setParticles(particlesRef.current);
  }, []);

  const pushFloatingBadge = useCallback(
    (x: number, y: number, text: string, tone: FloatingBadge["tone"]) => {
      const badge: FloatingBadge = {
        id: `fb_${Date.now()}_${Math.random()}`,
        x: Math.max(105, Math.min(STAGE_W - 105, x)),
        y: Math.max(92, y),
        text,
        tone,
        life: 1,
      };
      badgesRef.current = [...badgesRef.current, badge];
      setFloatingBadges(badgesRef.current);
    },
    []
  );

  const startNewSession = useCallback(
    (customSubset: SafariWordItem[] | null = null) => {
      const activePool =
        customSubset && customSubset.length > 0 ? customSubset : fullSafariPool;
      setPracticeSubset(customSubset);
      roundDeckRef.current = shuffleArray([...activePool]);
      sessionStartRef.current = Date.now();
      freezeUntilRef.current = 0;
      particlesRef.current = [];
      badgesRef.current = [];

      setScore(0);
      scoreRef.current = 0;
      setRoundNumber(1);
      setCombo(0);
      setMaxCombo(0);
      setLives(3);
      setTimeLeft(60);
      setCorrectPops(0);
      setWrongPops(0);
      setWrongCounts({});
      setParticles([]);
      setFloatingBadges([]);
      setFreezeRemainingMs(0);
      setHintActive(false);
      setIsNewHighScore(false);
      setComboMilestoneBanner(null);
      setPhase("playing");

      if (!isMutedRef.current) {
        void playStart();
      }
      spawnRoundWave(1, difficulty, activePool);
    },
    [fullSafariPool, difficulty, spawnRoundWave]
  );

  const handleBalloonPop = useCallback(
    (balloon: ActiveBalloon) => {
      if (phase !== "playing" || balloon.popped) return;

      // 1. Buz Balonu (تَجْمِيد)
      if (balloon.kind === "freeze") {
        balloonsRef.current = balloonsRef.current.filter(
          (b) => b.uid !== balloon.uid
        );
        setBalloons(balloonsRef.current);
        freezeUntilRef.current = performance.now() + 4000;
        setFreezeRemainingMs(4000);
        spawnBurst(balloon.x, balloon.y - 20, "#38BDF8");
        pushFloatingBadge(balloon.x, balloon.y - 45, "🧊 تَجْمِيد 4s!", "cyan");
        if (!isMutedRef.current) playClick();
        return;
      }

      // 2. İpucu Balonu (تَلْمِيحَة)
      if (balloon.kind === "hint") {
        balloonsRef.current = balloonsRef.current.filter(
          (b) => b.uid !== balloon.uid
        );
        setBalloons(balloonsRef.current);
        setHintActive(true);
        spawnBurst(balloon.x, balloon.y - 20, "#A855F7");
        pushFloatingBadge(
          balloon.x,
          balloon.y - 45,
          "🔍 تَلْمِيحَة!",
          "emerald"
        );
        if (!isMutedRef.current) playClick();
        return;
      }

      // 3. Altın Balon (جَائِزَة 5x)
      if (balloon.kind === "golden") {
        balloonsRef.current = balloonsRef.current.filter(
          (b) => b.uid !== balloon.uid
        );
        setBalloons(balloonsRef.current);
        const bonusPts = 500;
        const updatedScore = scoreRef.current + bonusPts;
        scoreRef.current = updatedScore;
        setScore(updatedScore);
        spawnBurst(balloon.x, balloon.y - 20, "#FACC15");
        pushFloatingBadge(
          balloon.x,
          balloon.y - 50,
          `🌟 جَائِزَة 5x (+${bonusPts})`,
          "gold"
        );
        if (!isMutedRef.current) {
          void playCorrect({ streak: 3 });
        }
        return;
      }

      // 4. Sıcak Hava Kelime Balonları
      if (roundLockRef.current) return;

      if (balloon.isTarget && targetWord) {
        roundLockRef.current = true;
        const pal =
          HOT_AIR_PALETTES[balloon.paletteIndex % HOT_AIR_PALETTES.length];
        balloonsRef.current = balloonsRef.current.filter(
          (b) => b.uid !== balloon.uid
        );
        setBalloons(balloonsRef.current);
        spawnBurst(balloon.x, balloon.y - 24, pal.burst);

        const nextCombo = combo + 1;
        setCombo(nextCombo);
        setMaxCombo((prev) => Math.max(prev, nextCombo));
        setCorrectPops((prev) => prev + 1);

        const basePts = 100 + (currentLevel - 1) * 25;
        const comboBonus = Math.min(150, (nextCombo - 1) * 15);
        const gained = basePts + comboBonus;
        const updatedScore = scoreRef.current + gained;
        scoreRef.current = updatedScore;
        setScore(updatedScore);

        const canonicalId = normalizeToCanonicalMistakeId(
          targetWord.id,
          targetWord.nameAr
        );
        if (canonicalId) {
          recordItemAttempt(canonicalId, "word", true);
        }

        if (gameMode === "time") {
          setTimeLeft((prev) => prev + 2);
          pushFloatingBadge(
            balloon.x,
            balloon.y - 45,
            `+${gained} • +2s ⏳`,
            "emerald"
          );
        } else {
          pushFloatingBadge(
            balloon.x,
            balloon.y - 45,
            `+${gained}`,
            "emerald"
          );
        }

        if (nextCombo > 0 && nextCombo % 10 === 0) {
          if (gameMode === "normal") {
            setLives((prev) => Math.min(6, prev + 1));
            setComboMilestoneBanner(`🔥 ${nextCombo} سِلْسِلَة! +1 💚 إِضَافِيّ`);
          } else {
            setTimeLeft((prev) => prev + 5);
            setComboMilestoneBanner(`🔥 ${nextCombo} سِلْسِلَة! +5 ثَوَانٍ ⏳`);
          }
          if (!isMutedRef.current) {
            void playFanfare(95);
          }
          setTimeout(() => setComboMilestoneBanner(null), 2600);
        } else if (!isMutedRef.current) {
          void playCorrect({ streak: nextCombo });
        }

        const activePool =
          practiceSubset && practiceSubset.length > 0
            ? practiceSubset
            : fullSafariPool;
        setTimeout(() => {
          spawnRoundWave(roundNumber + 1, difficulty, activePool);
        }, 460);
      } else {
        // YANLIŞ BALON PATLATILDI
        balloonsRef.current = balloonsRef.current.filter(
          (b) => b.uid !== balloon.uid
        );
        setBalloons(balloonsRef.current);
        spawnBurst(balloon.x, balloon.y - 24, "#64748B");

        setCombo(0);
        setWrongPops((prev) => prev + 1);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 380);

        if (!isMutedRef.current) {
          void playWrong();
        }

        if (targetWord) {
          setWrongCounts((prev) => ({
            ...prev,
            [targetWord.id]: (prev[targetWord.id] || 0) + 1,
          }));
          const canonicalTarget = normalizeToCanonicalMistakeId(
            targetWord.id,
            targetWord.nameAr
          );
          if (canonicalTarget) {
            addMistake(canonicalTarget);
            recordItemAttempt(canonicalTarget, "word", false);
          }
        }

        if (balloon.word) {
          const canonicalWrong = normalizeToCanonicalMistakeId(
            balloon.word.id,
            balloon.word.nameAr
          );
          if (canonicalWrong) {
            addMistake(canonicalWrong);
          }
        }

        if (gameMode === "normal") {
          pushFloatingBadge(balloon.x, balloon.y - 45, "خَطَأ! -1 ❤️", "rose");
          const remaining = lives - 1;
          setLives(remaining);
          if (remaining <= 0) {
            roundLockRef.current = true;
            setTimeout(() => {
              finishGame(scoreRef.current, "normal");
            }, 420);
          }
        } else {
          pushFloatingBadge(
            balloon.x,
            balloon.y - 45,
            "خَطَأ! -3s ⏳",
            "rose"
          );
          setTimeLeft((prev) => {
            const nextT = Math.max(0, prev - 3);
            if (nextT <= 0) {
              roundLockRef.current = true;
              setTimeout(() => {
                finishGame(scoreRef.current, "time");
              }, 350);
            }
            return nextT;
          });
        }
      }
    },
    [
      phase,
      targetWord,
      combo,
      currentLevel,
      gameMode,
      practiceSubset,
      fullSafariPool,
      roundNumber,
      difficulty,
      lives,
      spawnBurst,
      pushFloatingBadge,
      recordItemAttempt,
      addMistake,
      spawnRoundWave,
      finishGame,
    ]
  );

  // En çok hata yapılan 3 kelime ve tüm hatalı kelimeler
  const missedWordsAnalytics = useMemo(() => {
    const entries = Object.entries(wrongCounts)
      .filter(([, cnt]) => cnt > 0)
      .sort((a, b) => b[1] - a[1]);

    const mapped = entries
      .map(([id, count]) => {
        const found = fullSafariPool.find((w) => w.id === id);
        return found ? { word: found, count } : null;
      })
      .filter(Boolean) as Array<{ word: SafariWordItem; count: number }>;

    return {
      allMissed: mapped.map((m) => m.word),
      top3: mapped.slice(0, 3),
    };
  }, [wrongCounts, fullSafariPool]);

  const accuracyPercent = useMemo(() => {
    const total = correctPops + wrongPops;
    if (total === 0) return 100;
    return Math.round((correctPops / total) * 100);
  }, [correctPops, wrongPops]);

  // PNG Başarı Sertifikası (شَهَادَة نَجَاح) indirici
  const handleDownloadCertificatePng = useCallback(() => {
    if (typeof document === "undefined") return;
    playClick();

    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1130;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 1600, 1130);
    grad.addColorStop(0, "#FFFDF7");
    grad.addColorStop(1, "#F3EAD6");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1600, 1130);

    ctx.strokeStyle = "#065F46";
    ctx.lineWidth = 18;
    ctx.strokeRect(38, 38, 1524, 1054);

    ctx.strokeStyle = "#D97706";
    ctx.lineWidth = 5;
    ctx.strokeRect(62, 62, 1476, 1006);

    ctx.fillStyle = "#065F46";
    ctx.fillRect(92, 95, 1416, 150);

    ctx.fillStyle = "#FDE68A";
    ctx.textAlign = "center";
    ctx.font = "bold 62px serif";
    ctx.fillText("شَهَادَة نَجَاح", 800, 172);

    ctx.fillStyle = "#ECFDF5";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(
      "سَفَارِي البَالُونَات • BALON SAFARİ BAŞARI SERTİFİKASI",
      800,
      222
    );

    const displayStudent =
      studentName.trim() || "Muallimun Arapça Öğrencisi";
    ctx.fillStyle = "#1E293B";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText(displayStudent, 800, 335);

    ctx.fillStyle = "#475569";
    ctx.font = "26px sans-serif";
    ctx.fillText(
      "Balon Safari görsel ve işitsel Arapça kelime avı görevini başarıyla tamamlamıştır.",
      800,
      388
    );

    const cards = [
      {
        titleAr: "النِّقَاط",
        titleTr: "TOPLAM PUAN",
        val: `${score}`,
        bg: "#FEF3C7",
        border: "#D97706",
        color: "#92400E",
      },
      {
        titleAr: "مُعَدَّل الدِّقَّة",
        titleTr: "DOĞRULUK ORANI",
        val: `%${accuracyPercent}`,
        bg: "#ECFDF5",
        border: "#059669",
        color: "#065F46",
      },
      {
        titleAr: "المُسْتَوَى وَالسِّلْسِلَة",
        titleTr: "SEVİYE & EN YÜKSEK KOMBO",
        val: `Lv.${currentLevel} • ${maxCombo}🔥`,
        bg: "#F3E8FF",
        border: "#7C3AED",
        color: "#5B21B6",
      },
    ];

    cards.forEach((c, idx) => {
      const bx = 130 + idx * 460;
      const by = 445;
      ctx.fillStyle = c.bg;
      ctx.fillRect(bx, by, 420, 215);
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 4;
      ctx.strokeRect(bx, by, 420, 215);

      ctx.fillStyle = c.color;
      ctx.font = "bold 30px serif";
      ctx.fillText(c.titleAr, bx + 210, by + 54);

      ctx.font = "bold 20px sans-serif";
      ctx.fillText(c.titleTr, bx + 210, by + 88);

      ctx.font = "bold 58px sans-serif";
      ctx.fillText(c.val, bx + 210, by + 168);
    });

    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(
      "كَلِمَاتٌ لِلْمُرَاجَعَةِ • Tekrar Edilmesi Önerilen Kelimeler",
      800,
      735
    );

    if (missedWordsAnalytics.top3.length === 0) {
      ctx.fillStyle = "#047857";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText(
        "🌟 صِفْر أَخْطَاء! Hiç hata yapmadan tam isabetle tamamlandı!",
        800,
        805
      );
    } else {
      missedWordsAnalytics.top3.forEach((entry, idx) => {
        const yPos = 795 + idx * 58;
        ctx.fillStyle = "#334155";
        ctx.font = "bold 28px sans-serif";
        ctx.fillText(
          `${idx + 1}. ${entry.word.nameAr}  —  ${entry.word.meaningTr} (${entry.count} hata)`,
          800,
          yPos
        );
      });
    }

    const dateStr = new Date().toLocaleDateString("tr-TR");
    ctx.fillStyle = "#64748B";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(
      `Tarih: ${dateStr}  •  Mod: ${
        gameMode === "normal"
          ? "Normal Mod (الوَضْعُ العادِيّ)"
          : "Zamana Karşı (تَحَدِّي الوَقْت)"
      }  •  Muallimun Arapça Öğrenme Stüdyosu`,
      800,
      1020
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `balon-safari-sertifika-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }, "image/png");
  }, [
    studentName,
    score,
    accuracyPercent,
    currentLevel,
    maxCombo,
    missedWordsAnalytics.top3,
    gameMode,
  ]);

  // Gizli iframe üzerinden vektörel A4 sertifika yazdırma
  const handlePrintCertificate = useCallback(() => {
    if (typeof document === "undefined") return;
    playClick();

    const displayStudent = (
      studentName.trim() || "Muallimun Arapça Öğrencisi"
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const reviewRowsHtml =
      missedWordsAnalytics.top3.length === 0
        ? `<p style="color:#047857;font-weight:800;font-size:16px;">🌟 صِفْر أَخْطَاء! Hiç hata yapmadan tam isabetle tamamlandı.</p>`
        : `<ul style="list-style:none;padding:0;margin:8px 0;">${missedWordsAnalytics.top3
            .map(
              (m) =>
                `<li style="padding:6px 0;font-size:16px;font-weight:700;"><span dir="rtl" style="font-size:22px;color:#065F46;">${m.word.nameAr}</span> — ${m.word.meaningTr} (${m.count} hata)</li>`
            )
            .join("")}</ul>`;

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>شَهَادَة نَجَاح - Balon Safari Sertifikası</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; background: #fffdf7; color: #0f172a; }
  .frame { border: 8px solid #065f46; outline: 3px solid #d97706; outline-offset: -14px; padding: 28px 36px; text-align: center; box-sizing: border-box; min-height: 180mm; display: flex; flex-direction: column; justify-content: space-between; }
  .banner { background: #065f46; color: #fde68a; padding: 16px; border-radius: 12px; }
  .banner h1 { margin: 0; font-size: 38px; }
  .banner p { margin: 4px 0 0; color: #ecfdf5; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
  .badges { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 18px 0; }
  .badge { border: 2px solid #cbd5e1; border-radius: 12px; padding: 14px; background: #f8fafc; }
  .badge .ar { font-size: 20px; font-weight: 800; color: #065f46; }
  .badge .val { font-size: 32px; font-weight: 900; margin-top: 6px; color: #0f172a; }
</style>
</head>
<body>
  <div class="frame">
    <div class="banner">
      <h1 dir="rtl">شَهَادَة نَجَاح</h1>
      <p>سَفَارِي البَالُونَات • BALON SAFARİ BAŞARI SERTİFİKASI</p>
    </div>
    <div>
      <h2 style="font-size:28px;margin:14px 0 6px;">${displayStudent}</h2>
      <p style="margin:0;color:#475569;font-size:15px;">Balon Safari görsel ve işitsel Arapça kelime avı görevini başarıyla tamamlamıştır.</p>
    </div>
    <div class="badges">
      <div class="badge"><div class="ar" dir="rtl">النِّقَاط</div><div style="font-size:12px;font-weight:700;color:#64748b;">TOPLAM PUAN</div><div class="val">${score}</div></div>
      <div class="badge"><div class="ar" dir="rtl">مُعَدَّل الدِّقَّة</div><div style="font-size:12px;font-weight:700;color:#64748b;">DOĞRULUK ORANI</div><div class="val">%${accuracyPercent}</div></div>
      <div class="badge"><div class="ar" dir="rtl">المُسْتَوَى وَالسِّلْسِلَة</div><div style="font-size:12px;font-weight:700;color:#64748b;">SEVİYE & KOMBO</div><div class="val">Lv.${currentLevel} • ${maxCombo}🔥</div></div>
    </div>
    <div>
      <h3 style="margin:0 0 6px;font-size:16px;color:#1e293b;">كَلِمَاتٌ لِلْمُرَاجَعَةِ • Tekrar Edilmesi Önerilen Kelimeler</h3>
      ${reviewRowsHtml}
    </div>
    <div style="font-size:12px;color:#64748b;font-weight:700;">Tarih: ${new Date().toLocaleDateString("tr-TR")} • Muallimun Arapça Öğrenme Stüdyosu</div>
  </div>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.className =
      "fixed -left-[9999px] top-0 w-0 h-0 border-0 opacity-0 pointer-events-none";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 2000);
      }, 300);
    }
  }, [
    studentName,
    score,
    accuracyPercent,
    currentLevel,
    maxCombo,
    missedWordsAnalytics.top3,
  ]);

  // ---------------- 1. BAŞLANGIÇ / MOD VE ZORLUK SEÇİM EKRANI ----------------
  if (phase === "menu") {
    return (
      <div className="rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FAF4E8] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-md space-y-5 select-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D7BE] dark:border-[var(--border)] pb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles size={24} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[var(--foreground)]">
                  Balon Safari
                </h2>
                <span
                  dir="rtl"
                  className="arabic text-lg sm:text-xl font-bold text-[#087F5B] dark:text-emerald-400"
                >
                  سَفَارِي البَالُونَات
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--muted)] font-semibold">
                Sıcak hava balonlarında süzülen doğru görseli ve Arapça kelimeyi
                sesinden yakala! ({fullSafariPool.length} kelime hazır)
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                playClick();
                stopAllAudio();
                onClose();
              }}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] hover:border-rose-400 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <X size={15} />
              <span>Listeye Dön</span>
            </button>
          )}
        </div>

        {/* Yüksek Skor Rekor Kartları */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white dark:bg-[var(--background)] border-2 border-amber-300/80 dark:border-amber-700/60 p-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <Trophy size={13} />
                <span>Normal Mod Rekoru</span>
              </div>
              <div
                dir="rtl"
                className="arabic text-xs font-bold text-[var(--muted)]"
              >
                الوَضْعُ العادِيّ
              </div>
            </div>
            <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {hsNormal}
            </span>
          </div>

          <div className="rounded-xl bg-white dark:bg-[var(--background)] border-2 border-purple-300/80 dark:border-purple-700/60 p-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-extrabold text-purple-800 dark:text-purple-300 flex items-center gap-1">
                <Timer size={13} />
                <span>Zamana Karşı Rekoru</span>
              </div>
              <div
                dir="rtl"
                className="arabic text-xs font-bold text-[var(--muted)]"
              >
                تَحَدِّي الوَقْت
              </div>
            </div>
            <span className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
              {hsTime}
            </span>
          </div>
        </div>

        {/* Oyun Modu Seçimi */}
        <div className="space-y-2">
          <label className="block text-xs font-extrabold text-[var(--muted)]">
            1. Oyun Modunu Seçin
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                playClick();
                setGameMode("normal");
              }}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                gameMode === "normal"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-[#087F5B] shadow-sm"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-[var(--foreground)] flex items-center gap-1.5">
                  <Heart size={16} className="text-rose-500 fill-rose-500" />
                  Normal Mod (3 Can)
                </span>
                <span
                  dir="rtl"
                  className="arabic text-base font-bold text-[#087F5B] dark:text-emerald-400"
                >
                  الوَضْعُ العادِيّ
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-1 font-medium">
                ❤️❤️❤️ 3 hakla başla; her 10&apos;lu komboda ekstra 💚 kazan!
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                setGameMode("time");
              }}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                gameMode === "time"
                  ? "bg-purple-50 dark:bg-purple-950/40 border-[#6741D9] shadow-sm"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-[var(--foreground)] flex items-center gap-1.5">
                  <Timer size={16} className="text-[#6741D9]" />
                  Zamana Karşı (60 Saniye)
                </span>
                <span
                  dir="rtl"
                  className="arabic text-base font-bold text-[#6741D9] dark:text-purple-300"
                >
                  تَحَدِّي الوَقْت
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-1 font-medium">
                Doğru sıcak hava balonu +2 sn kazandırır, yanlış balon -3 sn
                düşürür!
              </p>
            </button>
          </div>
        </div>

        {/* Zorluk Seçimi */}
        <div className="space-y-2">
          <label className="block text-xs font-extrabold text-[var(--muted)]">
            2. Uçuş Hızı &amp; Zorluk (سَهْل / مُتَوَسِّط / صَعْب)
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: "easy", tr: "Kolay", ar: "سَهْل", desc: "Sakin Rüzgâr" },
                {
                  id: "medium",
                  tr: "Orta",
                  ar: "مُتَوَسِّط",
                  desc: "Dengeli Safari",
                },
                { id: "hard", tr: "Zor", ar: "صَعْب", desc: "Hızlı Fırtına" },
              ] as const
            ).map((d) => {
              const active = difficulty === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    playClick();
                    setDifficulty(d.id);
                  }}
                  className={`min-h-[60px] p-2.5 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    active
                      ? "bg-[#087F5B] text-white border-[#065F46] shadow-sm"
                      : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)]"
                  }`}
                >
                  <span
                    dir="rtl"
                    className="arabic text-base sm:text-lg font-bold leading-none"
                  >
                    {d.ar}
                  </span>
                  <span className="text-xs font-extrabold mt-1">{d.tr}</span>
                  <span
                    className={`text-[10px] ${
                      active ? "text-emerald-100" : "text-[var(--muted)]"
                    }`}
                  >
                    {d.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pedagojik Kademe Rehberi */}
        <div className="rounded-xl bg-white/90 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 text-xs text-[var(--muted)] space-y-1">
          <div className="font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" />
            <span>Sıcak Hava Balonu Kademeleri &amp; Güçlendiriciler:</span>
          </div>
          <p>
            <strong>Seviye 1:</strong> Hasır sepetin altında tam boy harekeli
            Arapça etiket · <strong>Seviye 2:</strong> Küçültülmüş etiket ·{" "}
            <strong>Seviye 3 &amp; 4 (اِحْتِرَاف):</strong> Etiket gizlenir,
            yalnızca sesi dinleyerek doğru görselli sıcak hava balonu seçilir!
          </p>
        </div>

        <button
          type="button"
          onClick={() => startNewSession(null)}
          className="w-full min-h-[52px] rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white font-black text-base border-b-4 border-[#044E38] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer"
        >
          <Play size={18} fill="currentColor" />
          <span>Safariyi Başlat</span>
          <span dir="rtl" className="arabic text-lg font-bold">
            اِبْدَأ اللَّعِب
          </span>
        </button>
      </div>
    );
  }

  // ---------------- 2. OYUN SONU & BAŞARI SERTİFİKASI EKRANI ----------------
  if (phase === "gameover") {
    const maxWrongVal = Math.max(
      1,
      ...missedWordsAnalytics.top3.map((item) => item.count)
    );

    return (
      <div className="rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FAF4E8] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-md space-y-5 select-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D7BE] dark:border-[var(--border)] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Award size={26} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[var(--foreground)]">
                  Safari Tamamlandı!
                </h2>
                <span
                  dir="rtl"
                  className="arabic text-xl font-bold text-[#087F5B] dark:text-emerald-400"
                >
                  شَهَادَة نَجَاح
                </span>
                {isNewHighScore && (
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                    · YENİ REKOR!
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--muted)] font-semibold">
                Toplam {correctPops} doğru balon yakalandı · En yüksek seri:{" "}
                {maxCombo}🔥
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={returnToSafariHome}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Home size={14} />
              <span>Mod Seçimi</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  stopAllAudio();
                  onClose();
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <X size={14} />
                <span>Çıkış</span>
              </button>
            )}
          </div>
        </div>

        {/* Özet Skor ve Doğruluk Kartları */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-white dark:bg-[var(--background)] border-2 border-amber-300 dark:border-amber-700/70 p-3 text-center">
            <div
              dir="rtl"
              className="arabic text-sm font-bold text-amber-700 dark:text-amber-300"
            >
              النِّقَاط
            </div>
            <div className="text-[11px] font-bold text-[var(--muted)]">
              Toplam Puan
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
              {score}
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-[var(--background)] border-2 border-emerald-300 dark:border-emerald-700/70 p-3 text-center">
            <div
              dir="rtl"
              className="arabic text-sm font-bold text-emerald-700 dark:text-emerald-300"
            >
              مُعَدَّل الدِّقَّة
            </div>
            <div className="text-[11px] font-bold text-[var(--muted)]">
              Doğruluk Oranı
            </div>
            <div className="text-2xl font-black text-[#087F5B] dark:text-emerald-400 tabular-nums mt-0.5">
              %{accuracyPercent}
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-[var(--background)] border-2 border-purple-300 dark:border-purple-700/70 p-3 text-center">
            <div
              dir="rtl"
              className="arabic text-sm font-bold text-purple-700 dark:text-purple-300"
            >
              المُسْتَوَى
            </div>
            <div className="text-[11px] font-bold text-[var(--muted)]">
              Ulaşılan Seviye
            </div>
            <div className="text-2xl font-black text-[#6741D9] dark:text-purple-300 tabular-nums mt-0.5">
              {currentLevel} / 4
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-[var(--background)] border-2 border-rose-300 dark:border-rose-700/70 p-3 text-center">
            <div
              dir="rtl"
              className="arabic text-sm font-bold text-rose-700 dark:text-rose-300"
            >
              سِلْسِلَة
            </div>
            <div className="text-[11px] font-bold text-[var(--muted)]">
              En Yüksek Kombo
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
              {maxCombo} 🔥
            </div>
          </div>
        </div>

        {/* En Çok Hata Yapılan 3 Kelime Sütun Grafiği (أَكْثَرُ الأَخْطَاء) */}
        <div className="rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-[var(--foreground)]">
                En Çok Hata Yapılan 3 Kelime
              </span>
              <span
                dir="rtl"
                className="arabic text-base font-bold text-rose-600 dark:text-rose-400"
              >
                أَكْثَرُ الأَخْطَاء
              </span>
            </div>
            {missedWordsAnalytics.allMissed.length > 0 && (
              <span className="text-[11px] font-bold text-[var(--muted)]">
                Hata Defterim&apos;e otomatik eklendi
              </span>
            )}
          </div>

          {missedWordsAnalytics.top3.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 p-3.5 flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs sm:text-sm">
              <CheckCircle2 size={20} className="shrink-0" />
              <span>
                Kusursuz Safari! Bu oturumda hiç yanlış balon patlatmadınız
                (صِفْر أَخْطَاء).
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <svg
                viewBox="0 0 480 155"
                className="w-full h-36 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800"
                role="img"
                aria-label="En çok hata yapılan 3 kelime sütun grafiği"
              >
                {missedWordsAnalytics.top3.map((entry, idx) => {
                  const colW = 92;
                  const gap = 58;
                  const x = 48 + idx * (colW + gap);
                  const barH = Math.max(
                    24,
                    Math.round((entry.count / maxWrongVal) * 86)
                  );
                  const y = 114 - barH;
                  const barColors = ["#EF4444", "#F97316", "#F59E0B"];
                  return (
                    <g key={entry.word.id}>
                      <rect
                        x={x}
                        y={y}
                        width={colW}
                        height={barH}
                        rx={10}
                        fill={barColors[idx % barColors.length]}
                      />
                      <text
                        x={x + colW / 2}
                        y={y - 7}
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight="800"
                        fill="#DC2626"
                      >
                        {entry.count} hata
                      </text>
                      <text
                        x={x + colW / 2}
                        y={136}
                        textAnchor="middle"
                        direction="rtl"
                        fontSize="16"
                        fontWeight="700"
                        fill="currentColor"
                        className="arabic fill-slate-800 dark:fill-slate-100"
                      >
                        {entry.word.nameAr}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {missedWordsAnalytics.top3.map((entry) => (
                  <button
                    key={entry.word.id}
                    type="button"
                    onClick={() => speakSafariWord(entry.word)}
                    className="p-2.5 rounded-xl bg-[#FAF4E8] dark:bg-slate-800/80 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-between gap-2 text-left hover:border-[#087F5B] cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div
                        dir="rtl"
                        className="arabic text-lg font-bold text-[var(--foreground)] truncate"
                      >
                        {entry.word.nameAr}
                      </div>
                      <div className="text-xs font-semibold text-[var(--muted)] truncate">
                        {entry.word.meaningTr}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-black shrink-0">
                      <Volume2 size={13} />
                      {entry.count}x
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Arapça Başarı Sertifikası (شَهَادَة نَجَاح) */}
        <div className="rounded-2xl border-2 border-[#087F5B]/60 bg-gradient-to-br from-[#FFFDF7] to-[#F4EBDC] dark:from-slate-900 dark:to-slate-800 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[#065F46] dark:text-emerald-400">
                  Başarı Sertifikası Hazır
                </span>
                <span
                  dir="rtl"
                  className="arabic text-base font-bold text-amber-600 dark:text-amber-400"
                >
                  شَهَادَة نَجَاح
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] font-medium">
                Sertifika üzerine yazılacak öğrenci adını girebilir, PNG
                indirebilir veya A4 yazdırabilirsiniz.
              </p>
            </div>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Öğrenci Adı Soyadı (isteğe bağlı)"
              className="w-full sm:w-64 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border-2 border-[#E6D7BE] dark:border-slate-700 text-xs font-bold text-[var(--foreground)] focus:outline-none focus:border-[#087F5B]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleDownloadCertificatePng}
              className="min-h-[46px] px-4 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Download size={16} />
              <span>Başarı Sertifikası İndir (PNG)</span>
              <span dir="rtl" className="arabic text-sm font-bold">
                تَحْمِيل الشَّهَادَة
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrintCertificate}
              className="min-h-[46px] px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-50 text-[#065F46] dark:text-emerald-300 border-2 border-[#087F5B] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer size={16} />
              <span>A4 Sertifika Yazdır</span>
            </button>
          </div>
        </div>

        {/* Alt Aksiyon Butonları */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {missedWordsAnalytics.allMissed.length > 0 && (
            <button
              type="button"
              onClick={() => startNewSession(missedWordsAnalytics.allMissed)}
              className="min-h-[50px] px-4 py-3 rounded-2xl bg-[#6741D9] hover:bg-[#5B21B6] text-white font-black text-xs sm:text-sm border-b-4 border-[#4C1D95] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Target size={17} />
              <span>
                Hatalarımla Pratik Yap ({missedWordsAnalytics.allMissed.length})
              </span>
              <span dir="rtl" className="arabic text-base font-bold">
                تَدَرَّبْ عَلَى الأَخْطَاء
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => startNewSession(null)}
            className={`min-h-[50px] px-4 py-3 rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white font-black text-xs sm:text-sm border-b-4 border-[#044E38] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              missedWordsAnalytics.allMissed.length === 0 ? "sm:col-span-2" : ""
            }`}
          >
            <RotateCcw size={17} />
            <span>Yeni Safari Başlat</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------------- 3. AKTİF PANORAMİK DOĞA & SICAK HAVA BALONU SAHNESİ ----------------
  return (
    <div
      className={`rounded-3xl border-2 border-sky-300 dark:border-sky-800 shadow-lg overflow-hidden select-none transition-transform bg-gradient-to-b from-[#4AA8EE] via-[#8CD0FA] to-[#52B788] ${
        isShaking ? "translate-x-1.5 border-rose-500" : ""
      }`}
    >
      <div className="relative w-full">
        {/* C) ÜST YÜZER HAP (PILL) HUD TASARIMI — Arka planı kapatmayan beyaz & sarı hap kutular + sağda kırmızı Yuva */}
        <div className="relative sm:absolute sm:top-3 sm:inset-x-3 z-20 px-2.5 pt-2.5 pb-1 sm:p-0 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pointer-events-none">
          {/* EN SOLDA: Sarı renkli 🔊 ve 🔊 إِعَادَة الصَّوْت (Sesi Tekrar Dinle) hap butonları */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                playClick();
                const next = !isMuted;
                setIsMuted(next);
                isMutedRef.current = next;
                if (next) {
                  stopAllAudio();
                  sfx.stopAllSfx();
                }
              }}
              className="min-h-[38px] min-w-[38px] px-2.5 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-slate-900 border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition-transform active:scale-95"
              aria-label={isMuted ? "Sesi Aç" : "Sesi Kapat"}
              title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
            >
              {isMuted ? (
                <VolumeX size={17} className="text-rose-700" />
              ) : (
                <Volume2 size={17} />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (isMuted) {
                  setIsMuted(false);
                  isMutedRef.current = false;
                }
                speakSafariWord(targetWord);
              }}
              className="min-h-[38px] px-3 sm:px-4 py-1 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-slate-900 border-2 border-white shadow-md flex items-center gap-1.5 font-black cursor-pointer transition-transform active:scale-95 whitespace-nowrap shrink-0"
              title="Hedef Kelime Sesini Tekrar Dinle"
            >
              <Volume2 size={16} className="shrink-0" />
              <span dir="rtl" className="arabic text-sm sm:text-base font-bold">
                إِعَادَة الصَّوْت
              </span>
            </button>
          </div>

          {/* ORTA / SAĞ: Beyaz yuvarlatılmış hap kutular + En Sağda Kırmızı Yuva (🏠) butonu */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 ml-auto pointer-events-auto">
            {/* النِّقَاط: 0 */}
            <div className="min-h-[36px] px-3 py-1 rounded-full bg-white/95 text-slate-900 border border-white shadow-md flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <span dir="rtl" className="arabic text-xs sm:text-sm font-bold">
                النِّقَاط:
              </span>
              <span className="text-xs sm:text-sm font-black text-amber-600 tabular-nums">
                {score}
              </span>
            </div>

            {/* المُسْتَوَى: 1 */}
            <div className="min-h-[36px] px-3 py-1 rounded-full bg-white/95 text-slate-900 border border-white shadow-md flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <span dir="rtl" className="arabic text-xs sm:text-sm font-bold">
                المُسْتَوَى: {currentLevel}
              </span>
              {currentLevel >= 3 && (
                <span
                  dir="rtl"
                  className="arabic text-[11px] font-bold text-[#6741D9]"
                >
                  · اِحْتِرَاف
                </span>
              )}
              {combo > 1 && (
                <span className="text-xs font-black text-orange-600 flex items-center gap-0.5 tabular-nums">
                  <Flame size={12} className="text-orange-500" />
                  {combo}
                </span>
              )}
            </div>

            {/* المُحَاوَلَات: ❤️❤️❤️ (veya Süre) */}
            {gameMode === "normal" ? (
              <div className="min-h-[36px] px-3 py-1 rounded-full bg-white/95 text-slate-900 border border-white shadow-md flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <span
                  dir="rtl"
                  className="arabic text-xs sm:text-sm font-bold hidden md:inline"
                >
                  المُحَاوَلَات:
                </span>
                <span
                  className="text-xs sm:text-sm tracking-tight"
                  aria-label={`${lives} can`}
                >
                  {"❤️".repeat(Math.min(3, lives))}
                  {lives > 3 ? "💚".repeat(lives - 3) : ""}
                </span>
              </div>
            ) : (
              <div
                className={`min-h-[36px] px-3 py-1 rounded-full border shadow-md flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  timeLeft <= 10
                    ? "bg-rose-600 text-white border-white"
                    : "bg-white/95 text-slate-900 border-white"
                }`}
              >
                <span dir="rtl" className="arabic text-xs sm:text-sm font-bold">
                  الوَقْت:
                </span>
                <span className="text-xs sm:text-sm font-black tabular-nums">
                  {timeLeft} ⏳
                </span>
              </div>
            )}

            {/* Sertifika / Karne Hap Butonu */}
            <button
              type="button"
              onClick={() => finishGame(scoreRef.current, gameMode)}
              className="min-h-[36px] px-2.5 sm:px-3 py-1 rounded-full bg-white/95 hover:bg-amber-50 text-amber-800 border border-white shadow-md text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0"
              title="Oyunu Tamamla ve Sertifika Ekranını Aç"
            >
              Karne
            </button>

            {/* SAĞDA KIRMIZI YUVA (🏠) BUTONU */}
            <button
              type="button"
              onClick={returnToSafariHome}
              className="min-h-[38px] min-w-[38px] px-2.5 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white border-2 border-white shadow-md flex items-center justify-center gap-1 cursor-pointer transition-transform active:scale-95 shrink-0"
              aria-label="Safari Ana Menüsü (Yuva)"
              title="Safari Ana Menüsü (Yuva)"
            >
              <Home size={17} />
            </button>
          </div>
        </div>

        {/* Aktif Güçlendirici / Kombo Yüzer Bildirimi */}
        {(freezeRemainingMs > 0 ||
          hintActive ||
          comboMilestoneBanner ||
          practiceSubset) && (
          <div className="relative sm:absolute sm:top-14 sm:inset-x-4 z-20 px-2 pb-1 flex flex-wrap items-center justify-center gap-2 text-xs font-extrabold pointer-events-none">
            {practiceSubset && (
              <span className="px-3 py-0.5 rounded-full bg-white/95 text-purple-800 shadow-sm">
                Hatalarımla Pratik ({practiceSubset.length} kelime)
              </span>
            )}
            {freezeRemainingMs > 0 && (
              <span className="px-3 py-0.5 rounded-full bg-sky-500 text-white shadow-sm flex items-center gap-1">
                <Snowflake size={13} />
                <span>
                  🧊 تَجْمِيد ({(freezeRemainingMs / 1000).toFixed(1)}s)
                </span>
              </span>
            )}
            {hintActive && (
              <span className="px-3 py-0.5 rounded-full bg-purple-600 text-white shadow-sm flex items-center gap-1">
                <Search size={13} />
                <span>🔍 تَلْمِيحَة Aktif</span>
              </span>
            )}
            {comboMilestoneBanner && (
              <span
                dir="rtl"
                className="arabic px-3.5 py-0.5 rounded-full bg-amber-500 text-white text-sm font-bold shadow-sm"
              >
                {comboMilestoneBanner}
              </span>
            )}
          </div>
        )}

        {/* A) PANORAMİK DOĞA & SAFARİ MANZARASI + B) GERÇEK SICAK HAVA BALONLARI (60FPS SVG) */}
        <svg
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          className="w-full h-[330px] sm:h-[470px] lg:h-[550px] block touch-manipulation"
          role="application"
          aria-label="Balon Safari Oyun Alanı"
        >
          <defs>
            <linearGradient id="safariSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#46A5ED" />
              <stop offset="52%" stopColor="#8ED1FC" />
              <stop offset="82%" stopColor="#D7F3E3" />
              <stop offset="100%" stopColor="#B7E4C7" />
            </linearGradient>

            <linearGradient id="safariRiverGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67D4FA" />
              <stop offset="45%" stopColor="#29B6F6" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            <linearGradient id="safariSandPathGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F8E2B0" />
              <stop offset="100%" stopColor="#E3BA73" />
            </linearGradient>

            {/* Sıcak Hava Balonu Kubbe Kırpma Maskesi */}
            <clipPath id="hotAirDomeClip">
              <path d="M 0 -98 C 60 -98, 84 -52, 73 2 C 64 40, 35 58, 24 72 L -24 72 C -35 58, -64 40, -73 2 C -84 -52, -60 -98, 0 -98 Z" />
            </clipPath>

            {/* Kubbe Ortasındaki Kelime Görseli Yuvarlatılmış Kare Maskesi */}
            <clipPath id="hotAirWordImgClip">
              <rect x="-42" y="-68" width="84" height="84" rx="18" />
            </clipPath>
          </defs>

          {/* 1. Gökyüzü Katmanı */}
          <rect
            x="0"
            y="0"
            width={STAGE_W}
            height={STAGE_H}
            fill="url(#safariSkyGrad)"
          />

          {/* Eğer public/images/background.png mevcutsa en arka plana çiz */}
          {hasCustomBg && (
            <image
              href="/images/background.png"
              x="0"
              y="0"
              width={STAGE_W}
              height={STAGE_H}
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {!hasCustomBg && (
            <g aria-hidden="true">
              {/* Yumuşak Bulut Kümeleri */}
              <g opacity="0.88" fill="#FFFFFF">
                <ellipse cx="185" cy="96" rx="58" ry="20" />
                <ellipse cx="222" cy="88" rx="44" ry="22" />
                <ellipse cx="148" cy="100" rx="36" ry="15" />

                <ellipse cx="520" cy="78" rx="64" ry="19" />
                <ellipse cx="562" cy="72" rx="44" ry="18" />

                <ellipse cx="890" cy="105" rx="68" ry="21" />
                <ellipse cx="938" cy="96" rx="48" ry="19" />
                <ellipse cx="845" cy="108" rx="38" ry="15" />
              </g>

              {/* Uzak Sisli Sıradağlar */}
              <path
                d="M 0 365 L 130 278 L 255 335 L 395 248 L 515 318 L 690 232 L 835 322 L 980 258 L 1120 332 L 1120 420 L 0 420 Z"
                fill="#93B7D6"
                opacity="0.65"
              />

              {/* Arka Planda Karlı Dağ Zirveleri (Sol Işıklı Yamacı + Sağ Gölgeli Yamacı + Beyaz Kar Örtüsü) */}
              <g>
                {/* Ana Merkez Karlı Dağ */}
                <polygon
                  points="350,375 565,142 565,375"
                  fill="#647D96"
                />
                <polygon
                  points="565,142 785,375 565,375"
                  fill="#496178"
                />
                {/* Karlı Zirve Başlığı */}
                <polygon
                  points="565,142 496,217 522,208 544,228 565,205 565,142"
                  fill="#FFFFFF"
                />
                <polygon
                  points="565,142 565,205 588,226 610,209 636,219"
                  fill="#E2E8F0"
                />

                {/* Sağ Yan Karlı Zirve */}
                <polygon
                  points="645,380 805,195 805,380"
                  fill="#5C758E"
                />
                <polygon
                  points="805,195 965,380 805,380"
                  fill="#41586E"
                />
                <polygon
                  points="805,195 754,250 778,244 805,260"
                  fill="#F8FAFC"
                />
                <polygon
                  points="805,195 805,260 828,246 856,252"
                  fill="#CBD5E1"
                />
              </g>

              {/* Orta Plan Yeşil Tepeler */}
              <path
                d="M 0 392 Q 210 326 455 372 T 890 356 Q 1020 346 1120 374 L 1120 510 L 0 510 Z"
                fill="#74C69D"
              />
              <path
                d="M 0 426 Q 260 374 548 408 T 1120 398 L 1120 560 L 0 560 Z"
                fill="#52B788"
              />

              {/* Vadi Sırtındaki Çam Ağaçları (Pine Trees) */}
              {[
                { x: 245, y: 366, s: 0.9 },
                { x: 278, y: 372, s: 1.08 },
                { x: 312, y: 378, s: 0.85 },
                { x: 668, y: 378, s: 0.92 },
                { x: 702, y: 384, s: 0.8 },
              ].map((pt, idx) => (
                <g
                  key={`pine_${idx}`}
                  transform={`translate(${pt.x}, ${pt.y}) scale(${pt.s})`}
                >
                  <rect x="-4" y="14" width="8" height="16" fill="#5D4037" />
                  <polygon points="0,-34 -20,-4 20,-4" fill="#1B4332" />
                  <polygon points="0,-20 -24,10 24,10" fill="#2D6A4F" />
                  <polygon points="0,-6 -28,20 28,20" fill="#1B4332" />
                </g>
              ))}

              {/* Ön Plan Zengin Yeşil Çayır Zemini */}
              <path
                d={`M 0 468 Q 290 438 560 462 T 1120 452 L 1120 ${STAGE_H} L 0 ${STAGE_H} Z`}
                fill="#40916C"
              />
              <path
                d={`M 0 522 Q 280 492 580 524 T 1120 508 L 1120 ${STAGE_H} L 0 ${STAGE_H} Z`}
                fill="#2D6A4F"
              />

              {/* Kumsal Patika (Nehrin Yanında Kıvrılan Altın Kumsal Yol) */}
              <path
                d={`M 518 392 C 472 426, 404 456, 434 504 C 458 544, 392 582, 345 ${STAGE_H} L 468 ${STAGE_H} C 504 580, 548 542, 520 500 C 494 460, 526 426, 556 392 Z`}
                fill="url(#safariSandPathGrad)"
              />

              {/* Ortada Kıvrılan Mavi Nehir */}
              <path
                d={`M 562 390 C 594 424, 650 452, 608 500 C 570 544, 622 582, 668 ${STAGE_H} L 502 ${STAGE_H} C 476 580, 444 544, 488 498 C 528 456, 538 424, 542 390 Z`}
                fill="url(#safariRiverGrad)"
              />
              {/* Nehir Su Parıltıları */}
              <path
                d="M 552 426 Q 576 432 562 444 M 536 488 Q 566 496 544 512 M 554 556 Q 594 566 572 584"
                stroke="#E0F7FA"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                opacity="0.78"
              />

              {/* Sağda Safari Akasya Ağaçları (Flat-Topped Acacia Trees) */}
              <g transform="translate(955, 442)">
                {/* Gövde ve Çatallı Dallar */}
                <path
                  d="M -6 38 L -3 -18 L -48 -54 M 0 38 L 3 -20 L 46 -56 M 0 -18 L -12 -60 M 2 -18 L 18 -60"
                  stroke="#5D4037"
                  strokeWidth="7"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Düz Tepeli Akasya Taç Katmanları */}
                <ellipse cx="-42" cy="-58" rx="46" ry="12" fill="#1B4332" />
                <ellipse cx="42" cy="-60" rx="48" ry="12" fill="#1B4332" />
                <ellipse cx="0" cy="-68" rx="74" ry="16" fill="#2D6A4F" />
                <ellipse cx="-6" cy="-72" rx="60" ry="12" fill="#52B788" />
              </g>

              <g transform="translate(832, 434) scale(0.72)">
                <path
                  d="M -4 34 L -2 -16 L -38 -46 M 2 34 L 3 -16 L 38 -48 M 0 -16 L 0 -52"
                  stroke="#5D4037"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
                <ellipse cx="-34" cy="-50" rx="38" ry="10" fill="#1B4332" />
                <ellipse cx="34" cy="-52" rx="38" ry="10" fill="#1B4332" />
                <ellipse cx="0" cy="-58" rx="58" ry="14" fill="#2D6A4F" />
                <ellipse cx="0" cy="-62" rx="44" ry="10" fill="#52B788" />
              </g>

              {/* Solda Büyük Gövdeli Ağaç */}
              <g transform="translate(88, 468)">
                {/* Kökler ve Kalın Gövde */}
                <path
                  d="M -28 74 Q -16 42 -16 -22 L 18 -22 Q 18 42 32 74 Z"
                  fill="#5D4037"
                />
                <path
                  d="M -6 66 Q -4 22 -6 -20"
                  stroke="#795548"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d="M -10 -18 L -42 -58 M 10 -18 L 44 -54 M 0 -22 L 0 -68"
                  stroke="#5D4037"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                {/* Gür Yaprak Kümeleri */}
                <circle cx="-46" cy="-68" r="38" fill="#1B4332" />
                <circle cx="46" cy="-64" r="38" fill="#1B4332" />
                <circle cx="0" cy="-94" r="48" fill="#2D6A4F" />
                <circle cx="-22" cy="-84" r="36" fill="#40916C" />
                <circle cx="24" cy="-82" r="34" fill="#52B788" />
              </g>

              {/* Ahşap Çiftlik Çiti (Sol Çayır ve Sağ Çayır Kenarı) */}
              <g>
                {/* Sol Ahşap Çit */}
                <rect
                  x="164"
                  y="492"
                  width="196"
                  height="7"
                  rx="2"
                  fill="#8D6E63"
                />
                <rect
                  x="164"
                  y="508"
                  width="196"
                  height="7"
                  rx="2"
                  fill="#795548"
                />
                {[172, 216, 260, 304, 348].map((fx) => (
                  <polygon
                    key={`fence_l_${fx}`}
                    points={`${fx},480 ${fx + 10},480 ${fx + 10},526 ${fx},526`}
                    fill="#6D4C41"
                  />
                ))}

                {/* Sağ Ahşap Çit */}
                <rect
                  x="706"
                  y="494"
                  width="174"
                  height="7"
                  rx="2"
                  fill="#8D6E63"
                />
                <rect
                  x="706"
                  y="510"
                  width="174"
                  height="7"
                  rx="2"
                  fill="#795548"
                />
                {[714, 756, 798, 840, 870].map((fx) => (
                  <polygon
                    key={`fence_r_${fx}`}
                    points={`${fx},482 ${fx + 10},482 ${fx + 10},528 ${fx},528`}
                    fill="#6D4C41"
                  />
                ))}
              </g>

              {/* Ön Planda Çimen Kümeleri ve Renkli Papatyalar / Çiçekler */}
              {[
                { x: 64, y: 576, petal: "#FFFFFF", center: "#FACC15" },
                { x: 136, y: 590, petal: "#FB7185", center: "#FEF08A" },
                { x: 218, y: 568, petal: "#FFFFFF", center: "#FACC15" },
                { x: 292, y: 592, petal: "#FDE047", center: "#D97706" },
                { x: 734, y: 574, petal: "#FFFFFF", center: "#FACC15" },
                { x: 818, y: 592, petal: "#C084FC", center: "#FEF08A" },
                { x: 912, y: 568, petal: "#FFFFFF", center: "#FACC15" },
                { x: 1004, y: 586, petal: "#FB7185", center: "#FACC15" },
                { x: 1062, y: 564, petal: "#FFFFFF", center: "#FACC15" },
              ].map((fl, idx) => (
                <g
                  key={`flower_${idx}`}
                  transform={`translate(${fl.x}, ${fl.y})`}
                >
                  {/* Çimen Kümesi */}
                  <path
                    d="M -12 14 Q -16 -2 -22 -6 M -6 14 Q -6 -6 -10 -12 M 2 14 Q 6 -4 12 -10 M 10 14 Q 16 0 22 -4"
                    stroke="#1B4332"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                  {/* Çiçek / Papatya Taç Yaprakları */}
                  <circle cx="-6" cy="-8" r="5" fill={fl.petal} />
                  <circle cx="6" cy="-8" r="5" fill={fl.petal} />
                  <circle cx="0" cy="-14" r="5" fill={fl.petal} />
                  <circle cx="0" cy="-2" r="5" fill={fl.petal} />
                  <circle cx="0" cy="-8" r="4.2" fill={fl.center} />
                </g>
              ))}
            </g>
          )}

          {/* B) GERÇEK SICAK HAVA BALONLARI (Kubbe + Merkez Görsel + Çapraz Halatlar + Hasır Sepet + Alt Mavi/Turuncu Etiket) */}
          {balloons.map((b) => {
            const pal =
              HOT_AIR_PALETTES[b.paletteIndex % HOT_AIR_PALETTES.length];
            const isDimmedByHint =
              hintActive && b.kind === "word" && !b.isTarget;
            const hasValidImage =
              Boolean(b.word?.imageUrl) && !failedImages[b.word?.id || ""];

            const stripeOuterColor =
              b.kind === "freeze"
                ? "#0284C7"
                : b.kind === "hint"
                ? "#7C3AED"
                : b.kind === "golden"
                ? "#D97706"
                : pal.outerStripe;

            const stripeMidColor =
              b.kind === "freeze"
                ? "#7DD3FC"
                : b.kind === "hint"
                ? "#C4B5FD"
                : b.kind === "golden"
                ? "#FDE047"
                : pal.midStripe;

            // Pedagojik Kademe: Seviye 1 tam boy, Seviye 2 biraz küçük, Seviye 3 ve 4 etiket gizli!
            const showArabicLabel = b.kind === "word" && currentLevel <= 2;
            const labelScale = currentLevel === 2 ? 0.8 : 1;

            return (
              <g
                key={b.uid}
                transform={`translate(${b.x.toFixed(1)}, ${b.y.toFixed(1)})`}
                opacity={isDimmedByHint ? 0.25 : 1}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleBalloonPop(b);
                }}
                className="cursor-pointer"
              >
                {/* Geniş Dokunmatik Yakalama Alanı (Mobil ergonomisi) */}
                <rect
                  x="-86"
                  y="-106"
                  width="172"
                  height="274"
                  rx="40"
                  fill="transparent"
                />

                {/* Altın Sıcak Hava Balonu Parıltı Halesi */}
                {b.kind === "golden" && (
                  <circle
                    cx="0"
                    cy="-22"
                    r="88"
                    fill="none"
                    stroke="#FDE047"
                    strokeWidth="4"
                    strokeDasharray="10 6"
                  />
                )}

                {hasCustomBalloon && b.kind === "word" ? (
                  <image
                    href="/images/balon.png"
                    x="-82"
                    y="-102"
                    width="164"
                    height="224"
                    preserveAspectRatio="xMidYMid contain"
                  />
                ) : (
                  <g>
                    {/* 1. SICAK HAVA BALONU KUBBESİ (#F4F6F0 Krem/Fildişi + Dikey Yeşil/Gri Şeritler) */}
                    <g clipPath="url(#hotAirDomeClip)">
                      {/* Fildişi Zemin */}
                      <rect
                        x="-90"
                        y="-105"
                        width="180"
                        height="185"
                        fill="#F4F6F0"
                      />
                      {/* Dış Sol ve Dış Sağ Yeşil Dikey Şeritler */}
                      <path
                        d="M -90 -105 L -46 -105 C -62 -46, -54 24, -22 76 L -90 76 Z"
                        fill={stripeOuterColor}
                      />
                      <path
                        d="M 90 -105 L 46 -105 C 62 -46, 54 24, 22 76 L 90 76 Z"
                        fill={stripeOuterColor}
                      />
                      {/* İç Sol ve İç Sağ Gri/Yeşil İnce Şeritler */}
                      <path
                        d="M -46 -105 L -28 -105 C -38 -46, -32 24, -13 76 L -22 76 C -54 24, -62 -46, -46 -105 Z"
                        fill={stripeMidColor}
                      />
                      <path
                        d="M 46 -105 L 28 -105 C 38 -46, 32 24, 13 76 L 22 76 C 54 24, 62 -46, 46 -105 Z"
                        fill={stripeMidColor}
                      />
                      {/* Yatay Kubbe Dikiş Kuşakları */}
                      <path
                        d="M -84 -42 Q 0 -30 84 -42 M -76 16 Q 0 26 76 16"
                        stroke="#CBD5CE"
                        strokeWidth="1.6"
                        fill="none"
                        opacity="0.75"
                      />
                      {/* Üst Kubbe Tepesi */}
                      <ellipse
                        cx="0"
                        cy="-96"
                        rx="26"
                        ry="7"
                        fill={stripeOuterColor}
                      />
                    </g>

                    {/* Kubbe Dış Konturu */}
                    <path
                      d="M 0 -98 C 60 -98, 84 -52, 73 2 C 64 40, 35 58, 24 72 L -24 72 C -35 58, -64 40, -73 2 C -84 -52, -60 -98, 0 -98 Z"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="3"
                    />

                    {/* Kubbe Boğaz Bileziği & Brülör Alevi */}
                    <rect
                      x="-25"
                      y="69"
                      width="50"
                      height="7"
                      rx="3"
                      fill="#475569"
                    />
                    <ellipse cx="0" cy="81" rx="5" ry="6" fill="#F59E0B" />
                    <ellipse cx="0" cy="82" rx="2.5" ry="3.5" fill="#FEF08A" />

                    {/* 3. ÇAPRAZ HALATLAR & DOKULU HASIR SEPET (#F3E5AB) */}
                    <g stroke="#5D4037" strokeWidth="1.9" strokeLinecap="round">
                      <line x1="-21" y1="76" x2="-18" y2="92" />
                      <line x1="21" y1="76" x2="18" y2="92" />
                      {/* Çapraz Halatlar */}
                      <line x1="-18" y1="76" x2="14" y2="92" />
                      <line x1="18" y1="76" x2="-14" y2="92" />
                    </g>

                    {/* Dokulu Hasır Sepet (#F3E5AB) */}
                    <rect
                      x="-22"
                      y="92"
                      width="44"
                      height="27"
                      rx="5"
                      fill="#F3E5AB"
                      stroke="#B4863E"
                      strokeWidth="2.2"
                    />
                    {/* Sepet Hasır Örgü Çizgileri */}
                    <path
                      d="M -20 101 L 20 101 M -20 110 L 20 110 M -10 93 L -10 118 M 0 93 L 0 118 M 10 93 L 10 118"
                      stroke="#CCA15A"
                      strokeWidth="1.4"
                    />
                    {/* Sepet Üst Deri/Ahşap Kenarlığı */}
                    <rect
                      x="-24"
                      y="90"
                      width="48"
                      height="6"
                      rx="3"
                      fill="#BC8A42"
                    />
                  </g>
                )}

                {/* 2. KUBBENİN TAM ORTASINDA BÜYÜK VE NET KELİME GÖRSELİ */}
                {b.kind === "word" && b.word ? (
                  hasValidImage ? (
                    <g>
                      <rect
                        x="-45"
                        y="-71"
                        width="90"
                        height="90"
                        rx="20"
                        fill="#FFFFFF"
                        stroke="#E2E8F0"
                        strokeWidth="2.5"
                      />
                      <image
                        href={b.word.imageUrl}
                        x="-42"
                        y="-68"
                        width="84"
                        height="84"
                        preserveAspectRatio="xMidYMid slice"
                        clipPath="url(#hotAirWordImgClip)"
                        onError={() => {
                          if (b.word?.id) {
                            setFailedImages((prev) => ({
                              ...prev,
                              [b.word!.id]: true,
                            }));
                          }
                        }}
                      />
                    </g>
                  ) : (
                    <g>
                      <rect
                        x="-48"
                        y="-60"
                        width="96"
                        height="68"
                        rx="16"
                        fill="#FFFFFF"
                        stroke="#CBD5E1"
                        strokeWidth="2"
                      />
                      <text
                        x="0"
                        y="-28"
                        textAnchor="middle"
                        fill="#0F172A"
                        fontSize="14"
                        fontWeight="800"
                      >
                        {b.word.meaningTr.slice(0, 15)}
                      </text>
                      {b.word.meaningTr.length > 15 && (
                        <text
                          x="0"
                          y="-10"
                          textAnchor="middle"
                          fill="#334155"
                          fontSize="12"
                          fontWeight="700"
                        >
                          {b.word.meaningTr.slice(15, 30)}
                        </text>
                      )}
                    </g>
                  )
                ) : b.kind === "freeze" ? (
                  <g>
                    <rect
                      x="-42"
                      y="-64"
                      width="84"
                      height="76"
                      rx="18"
                      fill="#FFFFFF"
                      opacity="0.95"
                    />
                    <text x="0" y="-26" textAnchor="middle" fontSize="32">
                      🧊
                    </text>
                    <text
                      x="0"
                      y="2"
                      textAnchor="middle"
                      direction="rtl"
                      fill="#0369A1"
                      fontSize="18"
                      fontWeight="900"
                      className="arabic"
                    >
                      تَجْمِيد
                    </text>
                  </g>
                ) : b.kind === "hint" ? (
                  <g>
                    <rect
                      x="-42"
                      y="-64"
                      width="84"
                      height="76"
                      rx="18"
                      fill="#FFFFFF"
                      opacity="0.95"
                    />
                    <text x="0" y="-26" textAnchor="middle" fontSize="32">
                      🔍
                    </text>
                    <text
                      x="0"
                      y="2"
                      textAnchor="middle"
                      direction="rtl"
                      fill="#6D28D9"
                      fontSize="18"
                      fontWeight="900"
                      className="arabic"
                    >
                      تَلْمِيحَة
                    </text>
                  </g>
                ) : (
                  <g>
                    <rect
                      x="-44"
                      y="-64"
                      width="88"
                      height="76"
                      rx="18"
                      fill="#FFFBEB"
                      stroke="#F59E0B"
                      strokeWidth="2"
                    />
                    <text x="0" y="-26" textAnchor="middle" fontSize="30">
                      🌟
                    </text>
                    <text
                      x="0"
                      y="2"
                      textAnchor="middle"
                      direction="rtl"
                      fill="#B45309"
                      fontSize="17"
                      fontWeight="900"
                      className="arabic"
                    >
                      جَائِزَة 5x
                    </text>
                  </g>
                )}

                {/* 4. SEPETİN HEMEN ALTINDA BEYAZ ÇERÇEVELİ MAVİ (#2196F3) / TURUNCU (#FF9800) ARAPÇA KELİME KUTUSU */}
                {showArabicLabel && b.word && (
                  <g transform={`translate(0, 144) scale(${labelScale})`}>
                    <rect
                      x="-76"
                      y="-21"
                      width="152"
                      height="42"
                      rx="12"
                      fill={pal.tagBg}
                      stroke="#FFFFFF"
                      strokeWidth="3.5"
                    />
                    <text
                      x="0"
                      y="8"
                      textAnchor="middle"
                      direction="rtl"
                      fill="#FFFFFF"
                      fontSize="24"
                      fontWeight="800"
                      className="arabic"
                    >
                      {b.word.nameAr.length > 16
                        ? `${b.word.nameAr.slice(0, 15)}…`
                        : b.word.nameAr}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Patlama Parçacıkları */}
          {particles.map((pt) => (
            <circle
              key={pt.id}
              cx={pt.x}
              cy={pt.y}
              r={pt.radius}
              fill={pt.color}
              opacity={Math.max(0, pt.life)}
            />
          ))}

          {/* Uçan Puan / Süre / Hata Geri Bildirim Rozetleri */}
          {floatingBadges.map((fb) => {
            const bgFill =
              fb.tone === "gold"
                ? "#F59E0B"
                : fb.tone === "cyan"
                ? "#0284C7"
                : fb.tone === "rose"
                ? "#E11D48"
                : "#059669";
            return (
              <g
                key={fb.id}
                transform={`translate(${fb.x.toFixed(1)}, ${fb.y.toFixed(1)})`}
                opacity={Math.max(0, fb.life)}
                className="pointer-events-none"
              >
                <rect
                  x="-76"
                  y="-18"
                  width="152"
                  height="34"
                  rx="17"
                  fill={bgFill}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <text
                  x="0"
                  y="5"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="15"
                  fontWeight="900"
                >
                  {fb.text}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
