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
  Snowflake,
  Search,
  Award,
  CheckCircle2,
  Home,
  ChevronLeft,
} from "lucide-react";
import {
  ResimliKelime,
  DictionaryItem,
  Dialogue,
  SynonymAntonymEntry,
  Level,
} from "@/types/data";
import { gorselKelimeler, resolveImageUrl } from "@/lib/data";
import { ArabicIdiom } from "@/lib/arabicIdioms";
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
import { useEscapeKey } from "@/lib/modalStack";
import {
  SAFARI_DESKTOP_STAGE,
  SAFARI_PORTRAIT_STAGE,
  computeSafariLevelFromRound,
  getSafariBalloonCountForLevel,
  computeSafariWavePlacements,
  computeWrappedBalloonX,
  resolveSafariAtmosphere,
  getNextSafariAtmosphereMode,
  type SafariAtmosphereMode,
  type SafariStageLevel,
} from "@/lib/balloonSafariLayout";

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
const PORTRAIT_STAGE_W = 540;
const PORTRAIT_STAGE_H = 860;
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

function getSpeedBase(
  difficulty: SafariDifficulty,
  level: SafariStageLevel
): number {
  const diffBase =
    difficulty === "easy" ? 58 : difficulty === "medium" ? 80 : 106;
  const levelBoost = (level - 1) * 11;
  return diffBase + levelBoost;
}

const NIGHT_STARFIELD = [
  { rx: 0.07, ry: 0.11, r: 1.8, op: 0.85 },
  { rx: 0.14, ry: 0.24, r: 1.3, op: 0.55 },
  { rx: 0.21, ry: 0.14, r: 2.1, op: 0.92 },
  { rx: 0.28, ry: 0.34, r: 1.4, op: 0.48 },
  { rx: 0.35, ry: 0.18, r: 1.7, op: 0.78 },
  { rx: 0.42, ry: 0.09, r: 2.2, op: 0.9 },
  { rx: 0.48, ry: 0.29, r: 1.3, op: 0.52 },
  { rx: 0.55, ry: 0.15, r: 1.9, op: 0.82 },
  { rx: 0.62, ry: 0.38, r: 1.4, op: 0.46 },
  { rx: 0.68, ry: 0.12, r: 2.0, op: 0.88 },
  { rx: 0.74, ry: 0.31, r: 1.5, op: 0.62 },
  { rx: 0.86, ry: 0.14, r: 1.8, op: 0.84 },
  { rx: 0.92, ry: 0.27, r: 1.4, op: 0.58 },
  { rx: 0.11, ry: 0.46, r: 1.5, op: 0.5 },
  { rx: 0.24, ry: 0.54, r: 1.8, op: 0.72 },
  { rx: 0.39, ry: 0.48, r: 1.3, op: 0.44 },
  { rx: 0.53, ry: 0.58, r: 1.6, op: 0.64 },
  { rx: 0.67, ry: 0.51, r: 1.9, op: 0.76 },
  { rx: 0.82, ry: 0.44, r: 1.4, op: 0.52 },
  { rx: 0.91, ry: 0.56, r: 1.7, op: 0.68 },
] as const;

export default function BalloonSafariGame({
  visualPool = [],
  cefrFilter = "all",
  onClose,
}: BalloonSafariGameProps) {
  const { preferredVoiceGender, speechRate, theme } = useSettings();
  const { addMistake, recordItemAttempt, addStudyMinutes } = useUserStore();

  // Sadece gerçek Görsel Kelimeler (gorselKelimeler_guncel.json) doğrulama dizini
  const canonicalVisualById = useMemo(() => {
    const map = new Map<string, ResimliKelime>();
    for (const vk of gorselKelimeler) {
      if (vk.gorsel && vk.arapca && vk.turkce) {
        map.set(vk.id, vk);
      }
    }
    return map;
  }, []);

  // YALNIZCA Görsel Kelimeler (gorselKelimeler_guncel.json) veri setinden beslenen öğrenci dostu Safari kelime havuzu
  const fullSafariPool = useMemo<SafariWordItem[]>(() => {
    const items: SafariWordItem[] = [];
    const seenIds = new Set<string>();

    const pushVisualWord = (candidate: ResimliKelime) => {
      const vk = canonicalVisualById.get(candidate.id);
      if (!vk) return;
      if (seenIds.has(vk.id)) return;
      seenIds.add(vk.id);
      items.push({
        id: vk.id,
        audioId: vk.id,
        nameAr: vk.arapca,
        meaningTr: cleanMeaningTr(vk.turkce),
        imageUrl: resolveImageUrl(vk.gorsel),
        ses_erkek: vk.ses_erkek,
        ses_kadin: vk.ses_kadin,
        cefr: vk.cefr,
      });
    };

    // 1. Seçili görsel kelime alt kümesi (yalnızca gorselKelimeler_guncel.json kayıtları)
    for (const candidate of visualPool) {
      if (
        cefrFilter === "all" ||
        !candidate.cefr ||
        candidate.cefr === cefrFilter
      ) {
        pushVisualWord(candidate);
      }
    }

    // 2. En az 8 resimli kelime garantisi (aynı CEFR seviyesindeki gorselKelimeler)
    if (items.length < 8) {
      const levelPool =
        cefrFilter === "all"
          ? gorselKelimeler
          : gorselKelimeler.filter((w) => w.cefr === cefrFilter);
      for (const vk of levelPool) {
        pushVisualWord(vk);
      }
    }

    // 3. Nihai emniyet: tüm gorselKelimeler (asla düz sözlük, metin veya atasözü eklenmez)
    if (items.length < 8) {
      for (const vk of gorselKelimeler) {
        pushVisualWord(vk);
        if (items.length >= 24) break;
      }
    }

    return items;
  }, [visualPool, cefrFilter, canonicalVisualById]);

  // Ekran ve oyun durumları
  const [phase, setPhase] = useState<"menu" | "playing" | "gameover">("menu");
  const [difficulty, setDifficulty] = useState<SafariDifficulty>("medium");
  const [gameMode, setGameMode] = useState<SafariGameMode>("normal");
  const [isMuted, setIsMuted] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [atmosphereMode, setAtmosphereMode] =
    useState<SafariAtmosphereMode>("auto");

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
  const balloonGroupRefs = useRef<Map<string, SVGGElement>>(new Map());
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
  const isPortraitMobileRef = useRef<boolean>(false);

  const activeStageW = isPortraitMobile ? PORTRAIT_STAGE_W : STAGE_W;
  const activeStageH = isPortraitMobile ? PORTRAIT_STAGE_H : STAGE_H;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncViewportOrientation = () => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const isPortrait = windowWidth < 640 && windowHeight > windowWidth;
      const prevPortrait = isPortraitMobileRef.current;
      isPortraitMobileRef.current = isPortrait;
      setIsPortraitMobile(isPortrait);

      if (prevPortrait !== isPortrait && balloonsRef.current.length > 0) {
        const wordBalloons = balloonsRef.current.filter(
          (b) => b.kind === "word"
        );
        const lvl = computeSafariLevelFromRound(roundNumber);
        const baseSpeed = getSpeedBase(difficulty, lvl);
        const placements = computeSafariWavePlacements({
          isPortraitMobile: isPortrait,
          count: Math.max(1, wordBalloons.length),
          baseSpeed,
          roundNum: roundNumber,
        });
        const stageCfg = isPortrait
          ? SAFARI_PORTRAIT_STAGE
          : SAFARI_DESKTOP_STAGE;
        let wordIdx = 0;
        let bonusIdx = 0;
        const remapped = balloonsRef.current.map((b) => {
          if (b.kind === "word") {
            const slot = placements[wordIdx] ?? placements[0];
            wordIdx += 1;
            return {
              ...b,
              x: slot ? slot.x : stageCfg.width + stageCfg.firstSpawnOffset,
              baseY: slot ? slot.baseY : (stageCfg.minY + stageCfg.maxY) / 2,
              y: slot ? slot.baseY : (stageCfg.minY + stageCfg.maxY) / 2,
              speedX: slot ? slot.speedX : b.speedX,
            };
          }
          const lastWordX =
            placements.length > 0
              ? placements[placements.length - 1]!.x
              : stageCfg.width + stageCfg.firstSpawnOffset;
          bonusIdx += 1;
          const bonusY =
            bonusIdx % 2 === 1 ? stageCfg.minY + 24 : stageCfg.maxY - 24;
          return {
            ...b,
            x: lastWordX + bonusIdx * stageCfg.horizontalSpacing,
            baseY: bonusY,
            y: bonusY,
            speedX: placements[0]?.speedX ?? b.speedX,
          };
        });
        balloonsRef.current = remapped;
        setBalloons(remapped);
      }
    };

    syncViewportOrientation();
    window.addEventListener("resize", syncViewportOrientation);
    window.addEventListener("orientationchange", syncViewportOrientation);
    return () => {
      window.removeEventListener("resize", syncViewportOrientation);
      window.removeEventListener("orientationchange", syncViewportOrientation);
    };
  }, [roundNumber, difficulty]);

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
    () => computeSafariLevelFromRound(roundNumber),
    [roundNumber]
  );

  const resolvedAtmosphere = useMemo(
    () =>
      resolveSafariAtmosphere({
        mode: atmosphereMode,
        level: currentLevel,
        isDarkTheme: theme === "dark",
      }),
    [atmosphereMode, currentLevel, theme]
  );

  const handleCycleAtmosphere = useCallback(() => {
    playClick();
    setBalloons([...balloonsRef.current]);
    setAtmosphereMode((prev) => getNextSafariAtmosphereMode(prev));
  }, []);

  const atmosphereBadgeMeta = useMemo(() => {
    const icon =
      resolvedAtmosphere === "day"
        ? "🌤️"
        : resolvedAtmosphere === "sunset"
        ? "🌅"
        : "🌌";
    if (atmosphereMode === "auto") {
      return {
        icon,
        shortLabel: `${icon} Oto`,
        desktopLabel: `${icon} Otomatik`,
        title:
          "Atmosfer: Otomatik (Seviye ve temaya göre değişir — değiştirmek için tıklayın)",
      };
    }
    if (atmosphereMode === "day") {
      return {
        icon: "🌤️",
        shortLabel: "🌤️",
        desktopLabel: "🌤️ Gündüz",
        title: "Atmosfer: Gündüz Ufku (Değiştirmek için tıklayın)",
      };
    }
    if (atmosphereMode === "sunset") {
      return {
        icon: "🌅",
        shortLabel: "🌅",
        desktopLabel: "🌅 Gün Batımı",
        title: "Atmosfer: Altın Saat / Gün Batımı (Değiştirmek için tıklayın)",
      };
    }
    return {
      icon: "🌌",
      shortLabel: "🌌",
      desktopLabel: "🌌 Gece",
      title: "Atmosfer: Yıldızlı Gece Seması (Değiştirmek için tıklayın)",
    };
  }, [atmosphereMode, resolvedAtmosphere]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.state = phase === "menu" ? "title" : phase;
    return () => {
      delete document.body.dataset.state;
    };
  }, [phase]);

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

  const handleExitToList = useCallback(() => {
    playClick();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopAllAudio();
    sfx.stopAllSfx();
    if (onClose) {
      onClose();
    } else {
      setPhase("menu");
    }
  }, [onClose]);

  useEscapeKey(handleExitToList, Boolean(onClose));

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

      const lvl = computeSafariLevelFromRound(nextRoundNum);
      const count = getSafariBalloonCountForLevel(lvl);
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

      // Dikey mobil (540x860: minY=185, maxY=610, spacing=210) ve masaüstü (1120x620: minY=165, maxY=415, spacing=235)
      // için birebir aynı yatay hızda (speedX = baseSpeed * speedScale) ve kademeli zikzak düzende yerleştir
      const portraitNow = isPortraitMobileRef.current;
      const stageCfg = portraitNow
        ? SAFARI_PORTRAIT_STAGE
        : SAFARI_DESKTOP_STAGE;
      const placements = computeSafariWavePlacements({
        isPortraitMobile: portraitNow,
        count: waveWords.length,
        baseSpeed,
        roundNum: nextRoundNum,
      });
      const uniformSpeedX =
        placements[0]?.speedX ?? baseSpeed * (portraitNow ? 0.78 : 1);

      const created: ActiveBalloon[] = waveWords.map((w, idx) => {
        const slot = placements[idx]!;
        return {
          uid: `b_${nextRoundNum}_${idx}_${w.id}`,
          kind: "word",
          word: w,
          isTarget: w.id === pickedTarget.id,
          x: slot.x,
          y: slot.baseY,
          baseY: slot.baseY,
          speedX: uniformSpeedX,
          wobblePhase: idx * 1.15,
          wobbleSpeed: 2.0,
          wobbleAmp: portraitNow ? 10 : 9,
          paletteIndex: (nextRoundNum + idx) % HOT_AIR_PALETTES.length,
          popped: false,
        };
      });

      let trailingX =
        placements.length > 0
          ? placements[placements.length - 1]!.x
          : stageCfg.width + stageCfg.firstSpawnOffset;

      // Güçlendirici ve Altın Balonları kelime dalgasının arkasına aynı hızla ekle ki hiçbir balon üst üste binmesin
      if (nextRoundNum % 3 === 0) {
        const powerKind: BalloonKind =
          nextRoundNum % 6 === 0 ? "freeze" : "hint";
        trailingX += stageCfg.horizontalSpacing;
        const pwrY = portraitNow ? stageCfg.minY + 30 : stageCfg.minY + 25;
        created.push({
          uid: `pwr_${nextRoundNum}_${powerKind}`,
          kind: powerKind,
          isTarget: false,
          x: trailingX,
          y: pwrY,
          baseY: pwrY,
          speedX: uniformSpeedX,
          wobblePhase: 0.7,
          wobbleSpeed: 2.2,
          wobbleAmp: 10,
          paletteIndex: 2,
          popped: false,
        });
      }

      if (nextRoundNum % 4 === 0) {
        trailingX += stageCfg.horizontalSpacing;
        const goldY = portraitNow ? stageCfg.maxY - 30 : stageCfg.maxY - 20;
        created.push({
          uid: `gold_${nextRoundNum}`,
          kind: "golden",
          isTarget: false,
          x: trailingX,
          y: goldY,
          baseY: goldY,
          speedX: uniformSpeedX,
          wobblePhase: 1.9,
          wobbleSpeed: 2.4,
          wobbleAmp: 11,
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
      const quantizedFreeze =
        frozenLeft > 50 ? Math.ceil(frozenLeft / 100) * 100 : 0;
      setFreezeRemainingMs((prev) =>
        prev === quantizedFreeze ? prev : quantizedFreeze
      );
      const isFrozen = frozenLeft > 0;

      const portraitNow = isPortraitMobileRef.current;
      const scaleVal = portraitNow ? 1.06 : 1;
      const activeList = balloonsRef.current.filter((item) => !item.popped);
      const advancedXByUid = new Map<string, number>();
      for (const item of activeList) {
        advancedXByUid.set(
          item.uid,
          isFrozen ? item.x : item.x - item.speedX * dt
        );
      }

      const nextBalloons: ActiveBalloon[] = [];
      for (const b of activeList) {
        const nextPhase =
          b.wobblePhase + (isFrozen ? dt * 0.55 : dt * b.wobbleSpeed);
        let nextX = advancedXByUid.get(b.uid) ?? b.x;
        const nextY = b.baseY + Math.sin(nextPhase) * b.wobbleAmp;

        if (nextX < -125) {
          if (b.kind === "word") {
            const otherXs: number[] = [];
            for (const placed of nextBalloons) {
              otherXs.push(placed.x);
            }
            for (const candidate of activeList) {
              if (candidate.uid === b.uid) continue;
              const candX = advancedXByUid.get(candidate.uid) ?? candidate.x;
              if (candX >= -125) {
                otherXs.push(candX);
              }
            }
            nextX = computeWrappedBalloonX({
              isPortraitMobile: portraitNow,
              otherActiveBalloonXs: otherXs,
            });
            advancedXByUid.set(b.uid, nextX);
          } else {
            continue;
          }
        }

        const domGroup = balloonGroupRefs.current.get(b.uid);
        if (domGroup) {
          domGroup.setAttribute(
            "transform",
            `translate(${nextX.toFixed(1)}, ${nextY.toFixed(1)}) scale(${scaleVal})`
          );
        }

        nextBalloons.push({
          ...b,
          x: nextX,
          y: nextY,
          wobblePhase: nextPhase,
        });
      }
      balloonsRef.current = nextBalloons;
      if (nextBalloons.length !== activeList.length) {
        setBalloons(nextBalloons);
      }

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
      const curStageW = isPortraitMobileRef.current
        ? PORTRAIT_STAGE_W
        : STAGE_W;
      const badge: FloatingBadge = {
        id: `fb_${Date.now()}_${Math.random()}`,
        x: Math.max(92, Math.min(curStageW - 92, x)),
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
    (rawBalloon: ActiveBalloon) => {
      const balloon =
        balloonsRef.current.find((item) => item.uid === rawBalloon.uid) ??
        rawBalloon;
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

  // ---------------- 1. BAŞLANGIÇ / MOD VE ZORLUK SEÇİM EKRANI (TAM EKRAN 100dvh) ----------------
  if (phase === "menu") {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#FAF4E8] dark:bg-[var(--surface)] flex flex-col overflow-hidden h-[100dvh] select-none">
        <header className="shrink-0 bg-[#F3E9D6]/90 dark:bg-[var(--background)] border-b border-[#E6D7BE] dark:border-[var(--border)] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                  Balon Safari
                </h2>
                <span
                  dir="rtl"
                  className="arabic text-base sm:text-lg font-bold text-[#087F5B] dark:text-emerald-400"
                >
                  سَفَارِي البَالُونَات
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[var(--muted)] font-semibold truncate">
                🖼️ Görsel Kelimeler Havuzu ({fullSafariPool.length} resimli
                kelime hazır)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExitToList}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs sm:text-sm font-extrabold text-[var(--foreground)] hover:border-rose-500 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
          >
            <span>✕ Çıkış / Listeye Dön</span>
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-3xl rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDF9F0] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-xl space-y-5">

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
            <strong>Seviye 1–2 (🌤️ Gündüz):</strong> Hasır sepetin altında
            harekeli Arapça etiket ·{" "}
            <strong>Seviye 3–4 (🌅 Gün Batımı · اِحْتِرَاف):</strong> Etiket
            gizlenir, sesi dinleyerek görsel seçilir ·{" "}
            <strong>Seviye 5+ (🌌 Gece Seması):</strong> Usta uçuş!
          </p>
        </div>

        <button
          type="button"
          data-start="true"
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
        </div>
      </div>
    );
  }

  // ---------------- 2. OYUN SONU & BAŞARI SERTİFİKASI EKRANI (TAM EKRAN 100dvh) ----------------
  if (phase === "gameover") {
    const maxWrongVal = Math.max(
      1,
      ...missedWordsAnalytics.top3.map((item) => item.count)
    );

    return (
      <div className="fixed inset-0 z-[9999] bg-[#FAF4E8] dark:bg-[var(--surface)] flex flex-col overflow-hidden h-[100dvh] select-none">
        <header className="shrink-0 bg-[#F3E9D6]/90 dark:bg-[var(--background)] border-b border-[#E6D7BE] dark:border-[var(--border)] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Award size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                  Safari Tamamlandı!
                </h2>
                <span
                  dir="rtl"
                  className="arabic text-lg font-bold text-[#087F5B] dark:text-emerald-400"
                >
                  شَهَادَة نَجَاح
                </span>
                {isNewHighScore && (
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                    · YENİ REKOR!
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--muted)] font-semibold truncate">
                Toplam {correctPops} doğru balon yakalandı · En yüksek seri:{" "}
                {maxCombo}🔥
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={returnToSafariHome}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Home size={14} />
              <span>Mod Seçimi</span>
            </button>
            <button
              type="button"
              onClick={handleExitToList}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] hover:border-rose-500 text-xs sm:text-sm font-extrabold text-[var(--foreground)] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>✕ Çıkış / Listeye Dön</span>
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 flex items-start justify-center">
          <div className="w-full max-w-4xl rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDF9F0] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-xl space-y-5">

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
              {currentLevel} / 5
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
        </div>
      </div>
    );
  }

  // ---------------- 3. AKTİF PANORAMİK UFUK & SICAK HAVA BALONU SAHNESİ (TAM EKRAN 100dvh) ----------------
  const stageWrapperBgClass =
    resolvedAtmosphere === "night"
      ? "bg-gradient-to-b from-[#081021] via-[#132347] to-[#0C1A2E]"
      : resolvedAtmosphere === "sunset"
      ? "bg-gradient-to-b from-[#35235D] via-[#DF765B] to-[#3B203E]"
      : "bg-gradient-to-b from-[#3898EC] via-[#85CEFA] to-[#2D6366]";

  const skyFillUrl =
    resolvedAtmosphere === "night"
      ? "url(#safariNightSkyGrad)"
      : resolvedAtmosphere === "sunset"
      ? "url(#safariSunsetSkyGrad)"
      : "url(#safariSkyGrad)";

  const farRidgeFill =
    resolvedAtmosphere === "night"
      ? "#26476E"
      : resolvedAtmosphere === "sunset"
      ? "#9B5A78"
      : "#86B8BD";
  const midRidgeFill =
    resolvedAtmosphere === "night"
      ? "#172E4B"
      : resolvedAtmosphere === "sunset"
      ? "#69395A"
      : "#538D8B";
  const nearRidgeFill =
    resolvedAtmosphere === "night"
      ? "#0C1A2E"
      : resolvedAtmosphere === "sunset"
      ? "#3B203E"
      : "#2D6366";

  const farRidgePath = `M 0 ${Math.round(activeStageH * 0.81)} C ${Math.round(
    activeStageW * 0.18
  )} ${Math.round(activeStageH * 0.765)}, ${Math.round(
    activeStageW * 0.36
  )} ${Math.round(activeStageH * 0.825)}, ${Math.round(
    activeStageW * 0.56
  )} ${Math.round(activeStageH * 0.785)} C ${Math.round(
    activeStageW * 0.76
  )} ${Math.round(activeStageH * 0.752)}, ${Math.round(
    activeStageW * 0.9
  )} ${Math.round(activeStageH * 0.805)}, ${activeStageW} ${Math.round(
    activeStageH * 0.782
  )} L ${activeStageW} ${activeStageH} L 0 ${activeStageH} Z`;

  const midRidgePath = `M 0 ${Math.round(activeStageH * 0.865)} C ${Math.round(
    activeStageW * 0.24
  )} ${Math.round(activeStageH * 0.835)}, ${Math.round(
    activeStageW * 0.48
  )} ${Math.round(activeStageH * 0.892)}, ${Math.round(
    activeStageW * 0.72
  )} ${Math.round(activeStageH * 0.848)} C ${Math.round(
    activeStageW * 0.86
  )} ${Math.round(activeStageH * 0.828)}, ${Math.round(
    activeStageW * 0.94
  )} ${Math.round(activeStageH * 0.862)}, ${activeStageW} ${Math.round(
    activeStageH * 0.855
  )} L ${activeStageW} ${activeStageH} L 0 ${activeStageH} Z`;

  const nearRidgePath = `M 0 ${Math.round(activeStageH * 0.922)} C ${Math.round(
    activeStageW * 0.28
  )} ${Math.round(activeStageH * 0.896)}, ${Math.round(
    activeStageW * 0.62
  )} ${Math.round(activeStageH * 0.946)}, ${activeStageW} ${Math.round(
    activeStageH * 0.912
  )} L ${activeStageW} ${activeStageH} L 0 ${activeStageH} Z`;

  const sunOrMoonX = Math.round(
    activeStageW * (resolvedAtmosphere === "night" ? 0.78 : 0.68)
  );
  const sunOrMoonY = Math.round(
    activeStageH *
      (resolvedAtmosphere === "night"
        ? 0.18
        : resolvedAtmosphere === "sunset"
        ? 0.75
        : 0.72)
  );
  const moonRadius = Math.round(Math.min(activeStageW, activeStageH) * 0.042);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#FAF4E8] dark:bg-[var(--surface)] flex flex-col overflow-hidden h-[100dvh] select-none transition-transform ${
        isShaking ? "translate-x-1.5" : ""
      }`}
    >
      <div
        className={`relative flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden ${stageWrapperBgClass}`}
      >
        {/* C-1) MOBİL (< 640px) TEK SATIR KOMPAKT HUD: Sol [← Çık + 🔊 إِعَادَة + 🔇 + Atmosfer] | Sağ [⭐ Puan · Lv.X · ❤️❤️❤️/⏳ + 🏆 Karne] */}
        <div className="sm:hidden absolute top-2 inset-x-2 z-20 h-10 flex items-center justify-between gap-1 flex-nowrap pointer-events-none">
          {/* Sol Kompakt Grup */}
          <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
            <button
              type="button"
              onClick={handleExitToList}
              className="h-9 px-2 rounded-full bg-slate-900/85 text-white border border-white/85 shadow-sm flex items-center gap-0.5 text-[11px] font-extrabold cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
              aria-label="Oyundan Çık"
            >
              <ChevronLeft size={14} strokeWidth={2.6} />
              <span>Çık</span>
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
              className="h-9 px-2 rounded-full bg-[#FACC15] active:bg-[#EAB308] text-slate-900 border border-white shadow-sm flex items-center gap-1 text-[11px] font-black cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
              title="Hedef Kelime Sesini Tekrar Dinle"
            >
              <Volume2 size={14} className="shrink-0" />
              <span dir="rtl" className="arabic text-xs font-bold">
                إِعَادَة
              </span>
            </button>

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
              className="h-9 w-8 rounded-full bg-white/95 text-slate-900 border border-white shadow-sm flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
              aria-label={isMuted ? "Sesi Aç" : "Sesi Kapat"}
            >
              {isMuted ? (
                <VolumeX size={14} className="text-rose-600" />
              ) : (
                <Volume2 size={14} className="text-slate-800" />
              )}
            </button>

            <button
              type="button"
              onClick={handleCycleAtmosphere}
              className="h-9 px-2 rounded-full bg-white/95 text-slate-900 border border-white shadow-sm flex items-center justify-center text-[11px] font-extrabold cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
              aria-label={atmosphereBadgeMeta.title}
              title={atmosphereBadgeMeta.title}
            >
              <span>{atmosphereBadgeMeta.shortLabel}</span>
            </button>
          </div>

          {/* Sağ Kompakt Durum Kapsülü + Karne */}
          <div className="flex items-center gap-1 min-w-0 pointer-events-auto">
            <div
              className={`h-9 px-2 rounded-full border shadow-sm flex items-center gap-1 text-[11px] font-black tabular-nums whitespace-nowrap shrink-0 ${
                gameMode === "time" && timeLeft <= 10
                  ? "bg-rose-600 text-white border-white"
                  : "bg-white/95 text-slate-900 border-white"
              }`}
            >
              <span className="text-amber-600">⭐{score}</span>
              <span className="opacity-45">·</span>
              <span className="text-[#065F46]">Lv.{currentLevel}</span>
              <span className="opacity-45">·</span>
              {gameMode === "normal" ? (
                <span
                  className="text-[10px] tracking-tighter"
                  aria-label={`${lives} can`}
                >
                  {"❤️".repeat(Math.min(3, lives))}
                  {lives > 3 ? `+${lives - 3}` : ""}
                </span>
              ) : (
                <span>{timeLeft}s⏳</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => finishGame(scoreRef.current, gameMode)}
              className="h-9 px-2 rounded-full bg-amber-500 active:bg-amber-600 text-white border border-white shadow-sm flex items-center gap-1 text-[11px] font-extrabold cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
              title="Oyunu Tamamla ve Karne Ekranını Aç"
            >
              <Trophy size={13} className="shrink-0" />
              <span className="hidden min-[400px]:inline">Karne</span>
            </button>
          </div>
        </div>

        {/* C-2) MASAÜSTÜ (sm: ve üzeri) YÜZER HAP HUD TASARIMI + ATMOSFER SEÇİCİ + NET "✕ Çıkış / Listeye Dön" BUTONU */}
        <div className="hidden sm:flex sm:absolute sm:top-3 sm:inset-x-4 z-20 items-center justify-between gap-2 pointer-events-none shrink-0">
          {/* EN SOLDA: Sarı renkli 🔊, 🔊 إِعَادَة الصَّوْت ve Atmosfer değiştirici hap butonları */}
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

            <button
              type="button"
              onClick={handleCycleAtmosphere}
              className="min-h-[38px] px-3 py-1 rounded-full bg-white/95 hover:bg-amber-50 text-slate-900 border-2 border-white shadow-md text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95 whitespace-nowrap shrink-0"
              aria-label={atmosphereBadgeMeta.title}
              title={atmosphereBadgeMeta.title}
            >
              <span>{atmosphereBadgeMeta.desktopLabel}</span>
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

            {/* SAĞDA KIRMIZI YUVA (🏠) + NET "✕ Çıkış / Listeye Dön" BUTONU */}
            <button
              type="button"
              onClick={returnToSafariHome}
              className="min-h-[38px] min-w-[38px] px-2.5 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white border-2 border-white shadow-md flex items-center justify-center gap-1 cursor-pointer transition-transform active:scale-95 shrink-0"
              aria-label="Safari Ana Menüsü (Yuva)"
              title="Safari Ana Menüsü (Yuva)"
            >
              <Home size={17} />
            </button>

            <button
              type="button"
              onClick={handleExitToList}
              className="min-h-[38px] px-3 py-1 rounded-full bg-slate-900/90 hover:bg-rose-600 text-white border-2 border-white shadow-md text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-transform active:scale-95 whitespace-nowrap shrink-0"
              title="✕ Çıkış / Listeye Dön"
            >
              <span>✕ Çıkış / Listeye Dön</span>
            </button>
          </div>
        </div>

        {/* Aktif Güçlendirici / Kombo Yüzer Bildirimi (Sahne alanını daraltmadan üstte yüzer) */}
        {(freezeRemainingMs > 0 ||
          hintActive ||
          comboMilestoneBanner ||
          practiceSubset) && (
          <div className="absolute top-13 sm:top-14 inset-x-2 sm:inset-x-4 z-20 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-extrabold pointer-events-none">
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

        {/* A) 3 ATMOSFERLİ PANORAMİK UFUK MANZARASI (🌤️ Gündüz / 🌅 Gün Batımı / 🌌 Gece) + B) SICAK HAVA BALONLARI (60FPS TAM EKRAN SVG) */}
        <svg
          viewBox={`0 0 ${activeStageW} ${activeStageH}`}
          preserveAspectRatio="xMidYMid slice"
          className="flex-1 min-h-0 w-full h-full block touch-manipulation"
          role="application"
          aria-label="Balon Safari Oyun Alanı"
        >
          <defs>
            {/* 1) Gündüz Ufku (day) */}
            <linearGradient id="safariSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3898EC" />
              <stop offset="48%" stopColor="#85CEFA" />
              <stop offset="80%" stopColor="#CBEFF0" />
              <stop offset="100%" stopColor="#F5F0DC" />
            </linearGradient>

            {/* 2) Altın Saat / Kapadokya Gün Batımı (sunset) */}
            <linearGradient
              id="safariSunsetSkyGrad"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#35235D" />
              <stop offset="35%" stopColor="#7A3B69" />
              <stop offset="68%" stopColor="#DF765B" />
              <stop offset="90%" stopColor="#F6BC66" />
              <stop offset="100%" stopColor="#FDE8B8" />
            </linearGradient>

            {/* 3) Yıldızlı Gece Seması (night) */}
            <linearGradient id="safariNightSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#081021" />
              <stop offset="48%" stopColor="#122344" />
              <stop offset="82%" stopColor="#1C395E" />
              <stop offset="100%" stopColor="#284F7A" />
            </linearGradient>

            {/* Ufuk Işık Halesi (Gündüz & Gün Batımı & Ay Halesi) */}
            <radialGradient id="safariDaySunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFDF2" stopOpacity="0.92" />
              <stop offset="42%" stopColor="#FDE68A" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="safariSunsetSunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.95" />
              <stop offset="36%" stopColor="#FBBF24" stopOpacity="0.58" />
              <stop offset="72%" stopColor="#FB923C" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#FB923C" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="safariNightMoonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FEF9C3" stopOpacity="0.32" />
              <stop offset="55%" stopColor="#93C5FD" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#93C5FD" stopOpacity="0" />
            </radialGradient>

            {/* Hilal Ay Kesim Maskesi */}
            <mask id="safariCrescentMask">
              <rect
                x="0"
                y="0"
                width={activeStageW}
                height={activeStageH}
                fill="#FFFFFF"
              />
              <circle
                cx={sunOrMoonX - Math.round(moonRadius * 0.42)}
                cy={sunOrMoonY - Math.round(moonRadius * 0.18)}
                r={Math.round(moonRadius * 0.88)}
                fill="#000000"
              />
            </mask>

            {/* Sıcak Hava Balonu Kubbe Kırpma Maskesi */}
            <clipPath id="hotAirDomeClip">
              <path d="M 0 -98 C 60 -98, 84 -52, 73 2 C 64 40, 35 58, 24 72 L -24 72 C -35 58, -64 40, -73 2 C -84 -52, -60 -98, 0 -98 Z" />
            </clipPath>

            {/* Kubbe Ortasındaki Kelime Görseli Yuvarlatılmış Kare Maskesi */}
            <clipPath id="hotAirWordImgClip">
              <rect x="-42" y="-68" width="84" height="84" rx="18" />
            </clipPath>
          </defs>

          {/* 1. Panoramik Gökyüzü Katmanı */}
          <rect
            x="0"
            y="0"
            width={activeStageW}
            height={activeStageH}
            fill={skyFillUrl}
          />

          {/* Eğer public/images/background.png mevcutsa en arka plana çiz */}
          {hasCustomBg && (
            <image
              href="/images/background.png"
              x="0"
              y="0"
              width={activeStageW}
              height={activeStageH}
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* 2. Koordinat Duyarlı 3 Atmosferli Panoramik Ufuk & Vadi Manzarası */}
          {!hasCustomBg && (
            <g aria-hidden="true">
              {/* Gece Seması: Parıldayan Yıldızlar ve Zarif Hilal */}
              {resolvedAtmosphere === "night" && (
                <g>
                  {NIGHT_STARFIELD.map((st, idx) => (
                    <circle
                      key={`star_${idx}`}
                      cx={Math.round(activeStageW * st.rx)}
                      cy={Math.round(activeStageH * st.ry)}
                      r={st.r}
                      fill={idx % 4 === 0 ? "#FEF08A" : "#F8FAFC"}
                      opacity={st.op}
                    />
                  ))}
                  <circle
                    cx={sunOrMoonX}
                    cy={sunOrMoonY}
                    r={moonRadius * 3.1}
                    fill="url(#safariNightMoonGlow)"
                  />
                  <circle
                    cx={sunOrMoonX}
                    cy={sunOrMoonY}
                    r={moonRadius}
                    fill="#FEF9C3"
                    mask="url(#safariCrescentMask)"
                  />
                </g>
              )}

              {/* Gündüz Ufku: Yumuşak Güneş Halesi */}
              {resolvedAtmosphere === "day" && (
                <circle
                  cx={sunOrMoonX}
                  cy={sunOrMoonY}
                  r={Math.round(Math.max(activeStageW, activeStageH) * 0.28)}
                  fill="url(#safariDaySunGlow)"
                />
              )}

              {/* Altın Saat / Gün Batımı: Altın Güneş Küresi & Kehribar Hale */}
              {resolvedAtmosphere === "sunset" && (
                <g>
                  <circle
                    cx={sunOrMoonX}
                    cy={sunOrMoonY}
                    r={Math.round(Math.max(activeStageW, activeStageH) * 0.32)}
                    fill="url(#safariSunsetSunGlow)"
                  />
                  <circle
                    cx={sunOrMoonX}
                    cy={sunOrMoonY}
                    r={Math.round(Math.min(activeStageW, activeStageH) * 0.058)}
                    fill="#FEF3C7"
                    opacity="0.88"
                  />
                </g>
              )}

              {/* Yumuşak Katmanlı Panoramik Bulut Kuşakları */}
              <g
                fill={
                  resolvedAtmosphere === "night"
                    ? "#94A3B8"
                    : resolvedAtmosphere === "sunset"
                    ? "#FED7AA"
                    : "#FFFFFF"
                }
                opacity={
                  resolvedAtmosphere === "night"
                    ? 0.14
                    : resolvedAtmosphere === "sunset"
                    ? 0.36
                    : 0.72
                }
              >
                <g
                  transform={`translate(${Math.round(
                    activeStageW * 0.18
                  )}, ${Math.round(activeStageH * 0.17)})`}
                >
                  <ellipse cx="0" cy="0" rx="64" ry="18" />
                  <ellipse cx="34" cy="-7" rx="44" ry="17" />
                  <ellipse cx="-34" cy="4" rx="38" ry="13" />
                </g>
                <g
                  transform={`translate(${Math.round(
                    activeStageW * 0.54
                  )}, ${Math.round(activeStageH * 0.13)})`}
                >
                  <ellipse cx="0" cy="0" rx="72" ry="17" />
                  <ellipse cx="42" cy="-6" rx="46" ry="16" />
                </g>
                <g
                  transform={`translate(${Math.round(
                    activeStageW * 0.84
                  )}, ${Math.round(activeStageH * 0.22)})`}
                >
                  <ellipse cx="0" cy="0" rx="58" ry="16" />
                  <ellipse cx="-32" cy="-5" rx="40" ry="15" />
                </g>
                {isPortraitMobile && (
                  <g
                    transform={`translate(${Math.round(
                      activeStageW * 0.32
                    )}, ${Math.round(activeStageH * 0.38)})`}
                    opacity="0.65"
                  >
                    <ellipse cx="0" cy="0" rx="56" ry="15" />
                    <ellipse cx="32" cy="-5" rx="38" ry="14" />
                  </g>
                )}
              </g>

              {/* Ufukta Çok Uzakta Süzülen Dekoratif Silüet Balonlar (Derinlik Hissi) */}
              <g
                fill={
                  resolvedAtmosphere === "night"
                    ? "#64748B"
                    : resolvedAtmosphere === "sunset"
                    ? "#582F4D"
                    : "#5B8E93"
                }
                opacity="0.24"
              >
                <g
                  transform={`translate(${Math.round(
                    activeStageW * 0.22
                  )}, ${Math.round(activeStageH * 0.71)}) scale(0.14)`}
                >
                  <path d="M 0 -98 C 60 -98, 84 -52, 73 2 C 64 40, 35 58, 24 72 L -24 72 C -35 58, -64 40, -73 2 C -84 -52, -60 -98, 0 -98 Z" />
                  <rect x="-18" y="88" width="36" height="24" rx="4" />
                </g>
                <g
                  transform={`translate(${Math.round(
                    activeStageW * 0.79
                  )}, ${Math.round(activeStageH * 0.68)}) scale(0.1)`}
                >
                  <path d="M 0 -98 C 60 -98, 84 -52, 73 2 C 64 40, 35 58, 24 72 L -24 72 C -35 58, -64 40, -73 2 C -84 -52, -60 -98, 0 -98 Z" />
                  <rect x="-18" y="88" width="36" height="24" rx="4" />
                </g>
              </g>

              {/* Alt %22: 3 Katmanlı Yumuşak Sisli Vadi & Panoramik Ufuk Tepeleri */}
              <path
                d={farRidgePath}
                fill={farRidgeFill}
                opacity={resolvedAtmosphere === "day" ? 0.68 : 0.74}
              />
              <path
                d={midRidgePath}
                fill={midRidgeFill}
                opacity={resolvedAtmosphere === "day" ? 0.86 : 0.9}
              />
              <path d={nearRidgePath} fill={nearRidgeFill} />
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
            const balloonScale = isPortraitMobile ? 1.06 : 1;

            return (
              <g
                key={b.uid}
                ref={(el) => {
                  if (el) {
                    balloonGroupRefs.current.set(b.uid, el);
                  } else {
                    balloonGroupRefs.current.delete(b.uid);
                  }
                }}
                transform={`translate(${b.x.toFixed(1)}, ${b.y.toFixed(1)}) scale(${balloonScale})`}
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
