"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  Trophy,
  Timer,
  Eye,
  RotateCcw,
  Sparkles,
  Check,
  X,
  Layers,
  Target,
  Bot,
  Users,
  BookOpen,
  Waves,
  HelpCircle,
  Moon,
  Sun,
  Lightbulb,
  BarChart3,
  Shell,
  User,
} from "lucide-react";
import {
  ResimliKelime,
  DictionaryItem,
  Dialogue,
  SynonymAntonymEntry,
  Level,
} from "@/types/data";
import {
  gorselKelimeler,
  sozluk,
  esZitAnlamlilar,
  resolveImageUrl,
} from "@/lib/data";
import { ArabicIdiom } from "@/lib/arabicIdioms";
import { removeArabicHarakat as stripHarakat } from "@/lib/arabicTextUtils";
import { shuffleArray } from "@/lib/quiz";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import { playDualGenderAudio, stopAllAudio } from "@/lib/audio";
import {
  playClick,
  playFlip,
  playStart,
  playCorrect,
  playWrong,
  playFanfare,
  sfx,
} from "@/lib/sfxManager";
import { normalizeToCanonicalMistakeId } from "@/lib/mistakeUtils";
import { saveLastExerciseSummary } from "@/lib/learningAnalytics";

export type MemoryGridDifficulty = "easy" | "medium" | "hard";
export type MemoryPlayMode = "ai" | "two_player" | "practice";
type TurnActor = "P1" | "P2" | "AI";
type MatchOwnerTag = "SEN" | "YZ" | "P1" | "P2";

interface MemoryPairSource {
  pairId: string;
  canonicalWordId: string;
  audioId?: string;
  cardAAr: string;
  cardBTr: string;
  cardBAr?: string;
  relationBadge?: "= Eş Anlam" | "≠ Zıt Anlam";
  fullMeaningTr: string;
  ornekAr?: string;
  ornekTr?: string;
  nuanceNote?: string;
  kok?: string;
  imageUrl?: string;
  ses_erkek?: string;
  ses_kadin?: string;
}

interface MemoryDeckCard {
  uid: string;
  pairId: string;
  side: "A" | "B";
  source: MemoryPairSource;
}

export interface MemoryFlipGameProps {
  visualPool?: ResimliKelime[];
  vocabulary?: DictionaryItem[];
  idioms?: ArabicIdiom[];
  dialogues?: Dialogue[];
  synonymEntries?: SynonymAntonymEntry[];
  isSynonymsAntonymsMode?: boolean;
  cefrFilter?: "all" | Level;
  timeLimit?: number | null;
  isMistakesMode?: boolean;
  onClose?: () => void;
}

const GRID_CONFIG: Record<
  MemoryGridDifficulty,
  {
    pairs: number;
    cards: number;
    turnSeconds: number;
    labelTr: string;
    labelAr: string;
    summaryChip: string;
    aiRecallProb: number;
    peeksAllowed: number;
  }
> = {
  easy: {
    pairs: 4,
    cards: 8,
    turnSeconds: 20,
    labelTr: "Kolay",
    labelAr: "سَهْل",
    summaryChip: "4 çift • 20 sn",
    aiRecallProb: 0.48,
    peeksAllowed: 2,
  },
  medium: {
    pairs: 6,
    cards: 12,
    turnSeconds: 15,
    labelTr: "Orta",
    labelAr: "مُتَوَسِّط",
    summaryChip: "6 çift • 15 sn",
    aiRecallProb: 0.7,
    peeksAllowed: 2,
  },
  hard: {
    pairs: 8,
    cards: 16,
    turnSeconds: 10,
    labelTr: "Zor",
    labelAr: "صَعْب",
    summaryChip: "8 çift • 10 sn",
    aiRecallProb: 0.86,
    peeksAllowed: 3,
  },
};

function shortenMeaning(raw: string): string {
  const clean = (raw || "").trim();
  if (!clean) return "Anlam";
  const first = clean.split(/[;/]/)[0]?.trim() || clean;
  return first.length > 36 ? `${first.slice(0, 34)}…` : first;
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildNuanceSummary(ez?: SynonymAntonymEntry): string | undefined {
  if (!ez) return undefined;
  const parts: string[] = [];
  const syn = ez.es_anlamlilar?.[0];
  const ant = ez.zit_anlamlilar?.[0];
  if (syn) {
    parts.push(
      `Eş anlam: ${syn.ar} (${syn.tr})${syn.nuans_tr ? ` — ${syn.nuans_tr}` : ""}`
    );
  }
  if (ant) {
    parts.push(
      `Zıt anlam: ${ant.ar} (${ant.tr})${ant.nuans_tr ? ` — ${ant.nuans_tr}` : ""}`
    );
  }
  return parts.length > 0 ? parts.join(" • ") : undefined;
}

export default function MemoryFlipGame({
  visualPool = [],
  vocabulary = [],
  idioms = [],
  dialogues = [],
  synonymEntries = [],
  isSynonymsAntonymsMode = false,
  cefrFilter = "all",
  timeLimit = null,
  onClose,
}: MemoryFlipGameProps) {
  const { theme, toggleTheme, preferredVoiceGender, speechRate } = useSettings();
  const { addMistake, recordItemAttempt, addStudyMinutes } = useUserStore();

  // Hızlı görsel, sözlük ve eş/zıt anlam dizinleri (Bilgi Notu kutusu & görsel eşleme için)
  const enrichmentLookups = useMemo(() => {
    const visualById = new Map<string, ResimliKelime>();
    const visualByBare = new Map<string, ResimliKelime>();
    for (const vk of gorselKelimeler) {
      visualById.set(vk.id, vk);
      const bare = stripHarakat(vk.arapca || "").trim();
      if (bare && !visualByBare.has(bare)) {
        visualByBare.set(bare, vk);
      }
    }

    const dictById = new Map<string, DictionaryItem>();
    const dictByBare = new Map<string, DictionaryItem>();
    for (const d of sozluk) {
      dictById.set(d.id, d);
      const bare = stripHarakat(d.mufret || d.mazi || "").trim();
      if (bare && !dictByBare.has(bare)) {
        dictByBare.set(bare, d);
      }
    }

    const synById = new Map<string, SynonymAntonymEntry>();
    const synByBare = new Map<string, SynonymAntonymEntry>();
    for (const ez of esZitAnlamlilar) {
      synById.set(ez.id, ez);
      const bare = (ez.kelime_harekesiz || stripHarakat(ez.kelime_ar || "")).trim();
      if (bare && !synByBare.has(bare)) {
        synByBare.set(bare, ez);
      }
    }

    return {
      visualById,
      visualByBare,
      dictById,
      dictByBare,
      synById,
      synByBare,
    };
  }, []);

  // Seçili havuzdan zenginleştirilmiş eşleştirme çiftleri
  const allPairSources = useMemo<MemoryPairSource[]>(() => {
    const list: MemoryPairSource[] = [];
    const seen = new Set<string>();

    const pushSource = (src: MemoryPairSource) => {
      if (!src.cardAAr || !src.cardBTr) return;
      if (seen.has(src.pairId)) return;
      seen.add(src.pairId);
      list.push(src);
    };

    // 1. Eş ve Zıt Anlamlılar Modu
    if (isSynonymsAntonymsMode && synonymEntries.length > 0) {
      for (const ez of synonymEntries) {
        const syn = ez.es_anlamlilar?.[0];
        const ant = ez.zit_anlamlilar?.[0];
        const chosen = syn || ant;
        const bare = stripHarakat(ez.kelime_ar || "").trim();
        const vk = enrichmentLookups.visualByBare.get(bare);
        const dict = enrichmentLookups.dictByBare.get(bare);

        if (chosen) {
          pushSource({
            pairId: ez.id,
            canonicalWordId: ez.id,
            audioId: vk?.id || dict?.id,
            cardAAr: ez.kelime_ar,
            cardBAr: chosen.ar,
            cardBTr: shortenMeaning(chosen.tr || ez.anlam_tr),
            relationBadge: syn ? "= Eş Anlam" : "≠ Zıt Anlam",
            fullMeaningTr: ez.anlam_tr,
            ornekAr: ez.ornek_cumle_ar || vk?.ornek_ar || dict?.ornek_ar,
            ornekTr: ez.ornek_cumle_tr || vk?.ornek_tr || dict?.ornek_tr,
            nuanceNote: buildNuanceSummary(ez),
            kok: vk?.kok || dict?.kok,
            imageUrl: vk?.gorsel
              ? resolveImageUrl(vk.gorsel)
              : dict?.gorsel
              ? resolveImageUrl(dict.gorsel)
              : undefined,
            ses_erkek: vk?.ses_erkek || dict?.ses_erkek,
            ses_kadin: vk?.ses_kadin || dict?.ses_kadin,
          });
        } else {
          pushSource({
            pairId: ez.id,
            canonicalWordId: ez.id,
            audioId: vk?.id || dict?.id,
            cardAAr: ez.kelime_ar,
            cardBTr: shortenMeaning(ez.anlam_tr),
            fullMeaningTr: ez.anlam_tr,
            ornekAr: ez.ornek_cumle_ar || vk?.ornek_ar || dict?.ornek_ar,
            ornekTr: ez.ornek_cumle_tr || vk?.ornek_tr || dict?.ornek_tr,
            nuanceNote: buildNuanceSummary(ez),
            kok: vk?.kok || dict?.kok,
            imageUrl: vk?.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
            ses_erkek: vk?.ses_erkek || dict?.ses_erkek,
            ses_kadin: vk?.ses_kadin || dict?.ses_kadin,
          });
        }
      }
    }

    // 2. Doğrudan Görsel Kelime Havuzu
    if (list.length === 0 && visualPool.length > 0 && vocabulary.length === 0) {
      for (const vk of visualPool) {
        const bare = stripHarakat(vk.arapca || "").trim();
        const ez = enrichmentLookups.synByBare.get(bare);
        const dict =
          enrichmentLookups.dictById.get(vk.id) ||
          enrichmentLookups.dictByBare.get(bare);
        pushSource({
          pairId: vk.id,
          canonicalWordId: vk.id,
          audioId: vk.id,
          cardAAr: vk.arapca,
          cardBTr: shortenMeaning(vk.turkce),
          fullMeaningTr: vk.turkce,
          ornekAr: vk.ornek_ar || dict?.ornek_ar || ez?.ornek_cumle_ar,
          ornekTr: vk.ornek_tr || dict?.ornek_tr || ez?.ornek_cumle_tr,
          nuanceNote: buildNuanceSummary(ez),
          kok: vk.kok || dict?.kok,
          imageUrl: vk.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
          ses_erkek: vk.ses_erkek,
          ses_kadin: vk.ses_kadin,
        });
      }
    }

    // 3. Sözlük / Diyalog Kelimeleri / Hata Defteri / Favoriler
    if (list.length === 0 && vocabulary.length > 0) {
      for (const w of vocabulary) {
        const ar = (w.mufret || w.mazi || "").trim();
        if (!ar) continue;
        const bare = stripHarakat(ar).trim();
        const vk =
          enrichmentLookups.visualById.get(w.id) ||
          enrichmentLookups.visualByBare.get(bare);
        const ez =
          enrichmentLookups.synById.get(w.id) ||
          enrichmentLookups.synByBare.get(bare);
        const imgRaw = w.gorsel || vk?.gorsel;
        pushSource({
          pairId: w.id,
          canonicalWordId: w.id,
          audioId: w.id,
          cardAAr: ar,
          cardBTr: shortenMeaning(w.anlam_tr),
          fullMeaningTr: w.anlam_tr,
          ornekAr: w.ornek_ar || vk?.ornek_ar || ez?.ornek_cumle_ar,
          ornekTr: w.ornek_tr || vk?.ornek_tr || ez?.ornek_cumle_tr,
          nuanceNote: buildNuanceSummary(ez),
          kok: w.kok || vk?.kok,
          imageUrl: imgRaw ? resolveImageUrl(imgRaw) : undefined,
          ses_erkek: w.ses_erkek || vk?.ses_erkek,
          ses_kadin: w.ses_kadin || vk?.ses_kadin,
        });
      }
    }

    // 4. Yedek Görsel Havuz / Deyim / Diyalog Satırları
    if (list.length === 0 && visualPool.length > 0) {
      for (const vk of visualPool) {
        const bare = stripHarakat(vk.arapca || "").trim();
        const ez = enrichmentLookups.synByBare.get(bare);
        pushSource({
          pairId: vk.id,
          canonicalWordId: vk.id,
          audioId: vk.id,
          cardAAr: vk.arapca,
          cardBTr: shortenMeaning(vk.turkce),
          fullMeaningTr: vk.turkce,
          ornekAr: vk.ornek_ar || ez?.ornek_cumle_ar,
          ornekTr: vk.ornek_tr || ez?.ornek_cumle_tr,
          nuanceNote: buildNuanceSummary(ez),
          kok: vk.kok,
          imageUrl: vk.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
          ses_erkek: vk.ses_erkek,
          ses_kadin: vk.ses_kadin,
        });
      }
    }

    if (list.length < 8 && idioms.length > 0) {
      for (const idm of idioms) {
        pushSource({
          pairId: `idiom_${idm.id}`,
          canonicalWordId: `idiom_${idm.id}`,
          cardAAr: idm.arabic,
          cardBTr: shortenMeaning(idm.meaningTr),
          fullMeaningTr: idm.meaningTr,
          nuanceNote: idm.literalTr ? `Lafzî çeviri: ${idm.literalTr}` : undefined,
        });
      }
    }

    if (list.length < 8 && dialogues.length > 0) {
      for (const dlg of dialogues) {
        for (const line of dlg.satirlar.slice(0, 5)) {
          if (line.arapca.split(/\s+/).length <= 6) {
            pushSource({
              pairId: `sent_${dlg.id}_${line.sira}`,
              canonicalWordId: `sent_${dlg.id}_${line.sira}`,
              cardAAr: line.arapca,
              cardBTr: shortenMeaning(line.turkce),
              fullMeaningTr: line.turkce,
              nuanceNote: dlg.baslik_tr ? `Diyalog: ${dlg.baslik_tr}` : undefined,
            });
          }
        }
      }
    }

    // En az 8 çift garantisi (Zor seviye 8 çift için)
    if (list.length < 8) {
      const fallback =
        cefrFilter === "all"
          ? gorselKelimeler
          : gorselKelimeler.filter((vk) => vk.cefr === cefrFilter);
      for (const vk of fallback) {
        const bare = stripHarakat(vk.arapca || "").trim();
        const ez = enrichmentLookups.synByBare.get(bare);
        pushSource({
          pairId: vk.id,
          canonicalWordId: vk.id,
          audioId: vk.id,
          cardAAr: vk.arapca,
          cardBTr: shortenMeaning(vk.turkce),
          fullMeaningTr: vk.turkce,
          ornekAr: vk.ornek_ar || ez?.ornek_cumle_ar,
          ornekTr: vk.ornek_tr || ez?.ornek_cumle_tr,
          nuanceNote: buildNuanceSummary(ez),
          kok: vk.kok,
          imageUrl: vk.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
          ses_erkek: vk.ses_erkek,
          ses_kadin: vk.ses_kadin,
        });
        if (list.length >= 16) break;
      }
    }

    return list;
  }, [
    isSynonymsAntonymsMode,
    synonymEntries,
    visualPool,
    vocabulary,
    idioms,
    dialogues,
    cefrFilter,
    enrichmentLookups,
  ]);

  // Ekran aşaması ve temel ayarlar
  const [phase, setPhase] = useState<"menu" | "playing" | "finished">("menu");
  const [difficulty, setDifficulty] = useState<MemoryGridDifficulty>("medium");
  const [playMode, setPlayMode] = useState<MemoryPlayMode>("ai");
  const [showHowToModal, setShowHowToModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Oyun tahtası durumları
  const [activePairs, setActivePairs] = useState<MemoryPairSource[]>([]);
  const [deck, setDeck] = useState<MemoryDeckCard[]>([]);
  const [flippedUids, setFlippedUids] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [matchedOwners, setMatchedOwners] = useState<
    Record<string, MatchOwnerTag>
  >({});
  const [mismatchedUids, setMismatchedUids] = useState<string[]>([]);
  const [isPeeking, setIsPeeking] = useState(false);
  const [peeksLeft, setPeeksLeft] = useState(GRID_CONFIG.medium.peeksAllowed);

  // Oyuncu sırası, skorlar, süreler ve Bilgi Notu
  const [currentTurn, setCurrentTurn] = useState<TurnActor>("P1");
  const [aiTurnTrigger, setAiTurnTrigger] = useState(0);
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [moves, setMoves] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [turnSecLeft, setTurnSecLeft] = useState(GRID_CONFIG.medium.turnSeconds);
  const [timedOutGlobal, setTimedOutGlobal] = useState(false);
  const [lastMatchedSource, setLastMatchedSource] =
    useState<MemoryPairSource | null>(null);
  const [pairMismatches, setPairMismatches] = useState<Record<string, number>>(
    {}
  );
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Güncel referanslar (Zamanlayıcı ve Yapay Zekâ hamle motoru için)
  const boardLockRef = useRef(false);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiThinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiSecondPickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number>(0);
  const isMutedRef = useRef(false);

  // Yapay zekâ hafıza haritası: uid -> pairId
  const aiMemoryRef = useRef<Map<string, string>>(new Map());
  const deckRef = useRef<MemoryDeckCard[]>([]);
  const activePairsRef = useRef<MemoryPairSource[]>([]);
  const matchedPairIdsRef = useRef<string[]>([]);
  const flippedUidsRef = useRef<string[]>([]);
  const currentTurnRef = useRef<TurnActor>("P1");
  const playModeRef = useRef<MemoryPlayMode>("ai");
  const difficultyRef = useRef<MemoryGridDifficulty>("medium");
  const movesRef = useRef(0);
  const pairMismatchesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    activePairsRef.current = activePairs;
  }, [activePairs]);

  useEffect(() => {
    matchedPairIdsRef.current = matchedPairIds;
  }, [matchedPairIds]);

  useEffect(() => {
    flippedUidsRef.current = flippedUids;
  }, [flippedUids]);

  useEffect(() => {
    currentTurnRef.current = currentTurn;
  }, [currentTurn]);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    movesRef.current = moves;
  }, [moves]);

  useEffect(() => {
    pairMismatchesRef.current = pairMismatches;
  }, [pairMismatches]);

  const clearAllTimers = useCallback(() => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
    if (aiThinkTimerRef.current) clearTimeout(aiThinkTimerRef.current);
    if (aiSecondPickTimerRef.current) clearTimeout(aiSecondPickTimerRef.current);
    peekTimerRef.current = null;
    evalTimerRef.current = null;
    aiThinkTimerRef.current = null;
    aiSecondPickTimerRef.current = null;
  }, []);

  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => {
      clearAllTimers();
      stopAllAudio();
      sfx.stopAllSfx();
    };
  }, [clearAllTimers]);

  const speakArabicItem = useCallback(
    (textAr: string, src?: MemoryPairSource) => {
      if (!textAr || isMutedRef.current) return;
      stopAllAudio();
      const matchedDict = src?.audioId
        ? sozluk.find((w) => w.id === src.audioId)
        : undefined;
      void playDualGenderAudio({
        text: textAr,
        id: src?.audioId,
        ses_erkek: src?.ses_erkek || matchedDict?.ses_erkek,
        ses_kadin: src?.ses_kadin || matchedDict?.ses_kadin,
        gender: preferredVoiceGender,
        rate: speechRate || 1,
      }).catch(() => {
        // ignore
      });
    },
    [preferredVoiceGender, speechRate]
  );

  // Yapay zekâ hafızasına açılan kartı kaydet ("rakibin bazen unutur" davranışı ile)
  const rememberCardForAi = useCallback((card: MemoryDeckCard) => {
    const mem = aiMemoryRef.current;
    mem.set(card.uid, card.pairId);
    // Hafıza büyüdüğünde zaman zaman eski bir kartı unutarak insani rakip davranışı sergile
    const diff = difficultyRef.current;
    const maxCap = diff === "easy" ? 4 : diff === "medium" ? 7 : 12;
    if (mem.size > maxCap) {
      const oldestKey = mem.keys().next().value;
      if (oldestKey && oldestKey !== card.uid) {
        mem.delete(oldestKey);
      }
    }
  }, []);

  const startGameSession = useCallback(
    (
      targetMode: MemoryPlayMode,
      targetDiff: MemoryGridDifficulty,
      customSources?: MemoryPairSource[] | null
    ) => {
      clearAllTimers();
      boardLockRef.current = false;
      aiMemoryRef.current = new Map();

      const cfg = GRID_CONFIG[targetDiff];
      const basePool =
        customSources && customSources.length >= 2
          ? customSources
          : allPairSources;

      const chosenPairs = shuffleArray([...basePool]).slice(
        0,
        Math.min(cfg.pairs, basePool.length)
      );

      if (
        chosenPairs.length < cfg.pairs &&
        allPairSources.length > chosenPairs.length
      ) {
        const chosenSet = new Set(chosenPairs.map((p) => p.pairId));
        const extras = shuffleArray(
          allPairSources.filter((p) => !chosenSet.has(p.pairId))
        ).slice(0, cfg.pairs - chosenPairs.length);
        chosenPairs.push(...extras);
      }

      const cards: MemoryDeckCard[] = [];
      for (const pair of chosenPairs) {
        cards.push({
          uid: `cardA_${pair.pairId}`,
          pairId: pair.pairId,
          side: "A",
          source: pair,
        });
        cards.push({
          uid: `cardB_${pair.pairId}`,
          pairId: pair.pairId,
          side: "B",
          source: pair,
        });
      }

      const shuffledDeck = shuffleArray(cards);

      setPlayMode(targetMode);
      playModeRef.current = targetMode;
      setDifficulty(targetDiff);
      difficultyRef.current = targetDiff;

      setActivePairs(chosenPairs);
      activePairsRef.current = chosenPairs;
      setDeck(shuffledDeck);
      deckRef.current = shuffledDeck;

      setFlippedUids([]);
      flippedUidsRef.current = [];
      setMatchedPairIds([]);
      matchedPairIdsRef.current = [];
      setMatchedOwners({});
      setMismatchedUids([]);
      setIsPeeking(false);
      setPeeksLeft(cfg.peeksAllowed);

      setCurrentTurn("P1");
      currentTurnRef.current = "P1";
      setAiTurnTrigger(0);
      setP1Score(0);
      setP2Score(0);
      setMoves(0);
      movesRef.current = 0;
      setElapsedSec(0);
      setTurnSecLeft(cfg.turnSeconds);
      setTimedOutGlobal(false);
      setLastMatchedSource(null);
      setPairMismatches({});
      pairMismatchesRef.current = {};
      setPhase("playing");
      sessionStartRef.current = Date.now();

      if (!isMutedRef.current) {
        playStart();
      }
    },
    [allPairSources, clearAllTimers]
  );

  // Ortak 2. kart değerlendirme fonksiyonu (hem oyuncu hem Yapay Zekâ için)
  const evaluateTwoCards = useCallback(
    (
      firstCard: MemoryDeckCard,
      secondCard: MemoryDeckCard,
      actor: TurnActor
    ) => {
      boardLockRef.current = true;
      const nextMoves = movesRef.current + 1;
      movesRef.current = nextMoves;
      setMoves(nextMoves);

      const cfg = GRID_CONFIG[difficultyRef.current];
      const mode = playModeRef.current;

      if (firstCard.pairId === secondCard.pairId) {
        // DOĞRU EŞLEŞME! (+10 puan ve sıra doğru bilende kalır)
        const ownerLabel: MatchOwnerTag =
          mode === "ai"
            ? actor === "AI"
              ? "YZ"
              : "SEN"
            : mode === "two_player"
            ? actor === "P2"
              ? "P2"
              : "P1"
            : "SEN";

        if (actor === "P1") {
          setP1Score((prev) => prev + 10);
        } else {
          setP2Score((prev) => prev + 10);
        }

        const updatedMatched = [
          ...matchedPairIdsRef.current,
          firstCard.pairId,
        ];
        matchedPairIdsRef.current = updatedMatched;
        setMatchedPairIds(updatedMatched);
        setMatchedOwners((prev) => ({
          ...prev,
          [firstCard.pairId]: ownerLabel,
        }));
        setLastMatchedSource(firstCard.source);
        setFlippedUids([]);
        flippedUidsRef.current = [];

        // Eşleşen çifti YZ hafızasından temizle
        aiMemoryRef.current.delete(firstCard.uid);
        aiMemoryRef.current.delete(secondCard.uid);

        // Oyuncu eşleştirdiyse SRS olumlu kayıt
        if (actor === "P1" || actor === "P2") {
          const canonical = normalizeToCanonicalMistakeId(
            firstCard.source.canonicalWordId,
            firstCard.source.cardAAr
          );
          if (
            canonical &&
            !(pairMismatchesRef.current[firstCard.pairId] > 0)
          ) {
            recordItemAttempt(canonical, "word", true);
          }
        }

        const totalPairsCount = activePairsRef.current.length;
        if (updatedMatched.length >= totalPairsCount && totalPairsCount > 0) {
          boardLockRef.current = false;
          const studyMin = Math.max(
            1,
            Math.round((Date.now() - sessionStartRef.current) / 60000)
          );
          addStudyMinutes(studyMin);
          saveLastExerciseSummary({
            moduleName: "Hafızanı Yokla",
            solved: Math.max(updatedMatched.length, nextMoves),
            correct: updatedMatched.length,
            wrong: Math.max(0, nextMoves - updatedMatched.length),
          });
          evalTimerRef.current = setTimeout(() => {
            setPhase("finished");
            if (!isMutedRef.current) {
              void playFanfare(95);
            }
          }, 480);
          return;
        }

        if (!isMutedRef.current) {
          void playCorrect({ streak: 2 });
        }

        // Sıra aynı oyuncuda kalır, tur süresi yenilenir
        setTurnSecLeft(cfg.turnSeconds);
        boardLockRef.current = false;

        if (mode === "ai" && actor === "AI") {
          // Yapay zekâ doğru bildiği için sırasını sürdürür
          setAiTurnTrigger((prev) => prev + 1);
        }
      } else {
        // EŞLEŞMEDİ!
        setMismatchedUids([firstCard.uid, secondCard.uid]);
        if (!isMutedRef.current) {
          void playWrong();
        }

        if (actor !== "AI") {
          const p1 = firstCard.pairId;
          const p2 = secondCard.pairId;
          const nextMis = {
            ...pairMismatchesRef.current,
            [p1]: (pairMismatchesRef.current[p1] || 0) + 1,
            [p2]: (pairMismatchesRef.current[p2] || 0) + 1,
          };
          pairMismatchesRef.current = nextMis;
          setPairMismatches(nextMis);

          for (const c of [firstCard, secondCard]) {
            const canonical = normalizeToCanonicalMistakeId(
              c.source.canonicalWordId,
              c.source.cardAAr
            );
            if (canonical) {
              recordItemAttempt(canonical, "word", false);
              if ((nextMis[c.pairId] || 0) >= 2) {
                addMistake(canonical);
              }
            }
          }
        }

        evalTimerRef.current = setTimeout(() => {
          setFlippedUids([]);
          flippedUidsRef.current = [];
          setMismatchedUids([]);
          boardLockRef.current = false;
          setTurnSecLeft(cfg.turnSeconds);

          // Sıra değişimi
          if (mode === "ai") {
            const nextActor: TurnActor = actor === "P1" ? "AI" : "P1";
            currentTurnRef.current = nextActor;
            setCurrentTurn(nextActor);
            if (nextActor === "AI") {
              setAiTurnTrigger((prev) => prev + 1);
            }
          } else if (mode === "two_player") {
            const nextActor: TurnActor = actor === "P1" ? "P2" : "P1";
            currentTurnRef.current = nextActor;
            setCurrentTurn(nextActor);
          }
        }, 900);
      }
    },
    [addMistake, addStudyMinutes, recordItemAttempt]
  );

  // Genel oyun süresi + Dairesel Tur Geri Sayım Halkası sayacı
  useEffect(() => {
    if (phase !== "playing" || deck.length === 0) return;

    const timer = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (timeLimit && timeLimit > 0 && next >= timeLimit * 2) {
          clearInterval(timer);
          setTimedOutGlobal(true);
          setPhase("finished");
        }
        return next;
      });

      // Değerlendirme animasyonu veya ipucu esnasında tur geri sayımını beklet
      if (boardLockRef.current || isPeeking) return;

      setTurnSecLeft((prev) => {
        if (prev > 1) return prev - 1;

        // Tur süresi doldu -> açık tek kart varsa kapat ve sırayı devret
        const cfg = GRID_CONFIG[difficultyRef.current];
        const mode = playModeRef.current;
        const actor = currentTurnRef.current;

        if (flippedUidsRef.current.length > 0) {
          setFlippedUids([]);
          flippedUidsRef.current = [];
        }

        if (mode === "ai" && actor === "P1") {
          currentTurnRef.current = "AI";
          setCurrentTurn("AI");
          setAiTurnTrigger((n) => n + 1);
        } else if (mode === "two_player") {
          const nextActor: TurnActor = actor === "P1" ? "P2" : "P1";
          currentTurnRef.current = nextActor;
          setCurrentTurn(nextActor);
        }

        return cfg.turnSeconds;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, deck.length, timeLimit, isPeeking]);

  // 🤖 YAPAY ZEKÂ HAMLE MOTORU: 1.2 sn düşünüp otomatik hamle yapar ("rakibin bazen unutur")
  useEffect(() => {
    if (
      phase !== "playing" ||
      playMode !== "ai" ||
      currentTurn !== "AI"
    ) {
      return;
    }

    aiThinkTimerRef.current = setTimeout(() => {
      if (
        playModeRef.current !== "ai" ||
        currentTurnRef.current !== "AI" ||
        boardLockRef.current
      ) {
        return;
      }

      const currentDeck = deckRef.current;
      const matchedSet = new Set(matchedPairIdsRef.current);
      const available = currentDeck.filter((c) => !matchedSet.has(c.pairId));
      if (available.length < 2) return;

      const cfg = GRID_CONFIG[difficultyRef.current];
      const mem = aiMemoryRef.current;

      // 1) Hafızada aynı çifte ait iki kart biliniyor mu?
      const knownByPair = new Map<string, string[]>();
      for (const [uid, pid] of mem.entries()) {
        if (matchedSet.has(pid)) continue;
        const arr = knownByPair.get(pid) || [];
        arr.push(uid);
        knownByPair.set(pid, arr);
      }

      let firstPick: MemoryDeckCard | undefined;
      let plannedSecondPick: MemoryDeckCard | undefined;

      for (const [, uids] of knownByPair.entries()) {
        if (uids.length >= 2 && Math.random() < cfg.aiRecallProb) {
          const c1 = available.find((c) => c.uid === uids[0]);
          const c2 = available.find((c) => c.uid === uids[1]);
          if (c1 && c2 && c1.uid !== c2.uid) {
            firstPick = c1;
            plannedSecondPick = c2;
            break;
          }
        }
      }

      // 2) Bilinen tam çift yoksa, önce henüz açılmamış kartlardan rastgele birini dene
      if (!firstPick) {
        const unseen = available.filter((c) => !mem.has(c.uid));
        const poolForFirst = unseen.length > 0 ? unseen : available;
        firstPick =
          poolForFirst[Math.floor(Math.random() * poolForFirst.length)] ||
          available[0];
      }

      boardLockRef.current = true;
      rememberCardForAi(firstPick);

      if (!isMutedRef.current) {
        playFlip();
      }
      if (firstPick.side === "A") {
        speakArabicItem(firstPick.source.cardAAr, firstPick.source);
      } else if (firstPick.source.cardBAr) {
        speakArabicItem(firstPick.source.cardBAr, firstPick.source);
      }

      setFlippedUids([firstPick.uid]);
      flippedUidsRef.current = [firstPick.uid];

      // Kısa bir bekleme ardından 2. kartı çevir
      aiSecondPickTimerRef.current = setTimeout(() => {
        const stillAvailable = deckRef.current.filter(
          (c) =>
            !matchedPairIdsRef.current.includes(c.pairId) &&
            c.uid !== firstPick!.uid
        );
        if (stillAvailable.length === 0) {
          boardLockRef.current = false;
          return;
        }

        let secondPick = plannedSecondPick;

        // İlk açılan kartın eşi hafızada var mı kontrol et
        if (!secondPick) {
          const matchingPartnerInMem = stillAvailable.find(
            (c) =>
              c.pairId === firstPick!.pairId && aiMemoryRef.current.has(c.uid)
          );
          if (
            matchingPartnerInMem &&
            Math.random() < cfg.aiRecallProb
          ) {
            secondPick = matchingPartnerInMem;
          }
        }

        if (!secondPick) {
          const unseenSecond = stillAvailable.filter(
            (c) => !aiMemoryRef.current.has(c.uid)
          );
          const poolSecond =
            unseenSecond.length > 0 ? unseenSecond : stillAvailable;
          secondPick =
            poolSecond[Math.floor(Math.random() * poolSecond.length)] ||
            stillAvailable[0];
        }

        rememberCardForAi(secondPick);
        if (!isMutedRef.current) {
          playFlip();
        }
        if (secondPick.side === "A") {
          speakArabicItem(secondPick.source.cardAAr, secondPick.source);
        } else if (secondPick.source.cardBAr) {
          speakArabicItem(secondPick.source.cardBAr, secondPick.source);
        }

        const pairFlipped = [firstPick!.uid, secondPick.uid];
        setFlippedUids(pairFlipped);
        flippedUidsRef.current = pairFlipped;

        evaluateTwoCards(firstPick!, secondPick, "AI");
      }, 720);
    }, 1200);

    return () => {
      if (aiThinkTimerRef.current) clearTimeout(aiThinkTimerRef.current);
      if (aiSecondPickTimerRef.current)
        clearTimeout(aiSecondPickTimerRef.current);
    };
  }, [
    phase,
    playMode,
    currentTurn,
    aiTurnTrigger,
    rememberCardForAi,
    speakArabicItem,
    evaluateTwoCards,
  ]);

  // 🔍 Kartları 1.5 Saniye Göster (Antrenman modunda yardımcı ipucu)
  const handlePeekCards = useCallback(() => {
    if (
      playMode !== "practice" ||
      isPeeking ||
      peeksLeft <= 0 ||
      phase !== "playing" ||
      boardLockRef.current
    ) {
      return;
    }
    playClick();
    boardLockRef.current = true;
    setIsPeeking(true);
    setPeeksLeft((prev) => Math.max(0, prev - 1));

    peekTimerRef.current = setTimeout(() => {
      setIsPeeking(false);
      boardLockRef.current = false;
    }, 1500);
  }, [playMode, isPeeking, peeksLeft, phase]);

  // Oyuncu kart seçimi
  const handleCardSelect = useCallback(
    (card: MemoryDeckCard) => {
      // Eşleşmiş bir karta tıklandığında Bilgi Notu kutusunu güncelle ve sesini çal
      if (matchedPairIds.includes(card.pairId)) {
        setLastMatchedSource(card.source);
        speakArabicItem(card.source.cardAAr, card.source);
        return;
      }

      if (
        phase !== "playing" ||
        isPeeking ||
        boardLockRef.current ||
        (playMode === "ai" && currentTurn === "AI") ||
        flippedUids.includes(card.uid)
      ) {
        return;
      }

      if (!isMutedRef.current) {
        playFlip();
      }

      // Arapça yüz açıldığında sesi otomatik çal
      if (card.side === "A") {
        speakArabicItem(card.source.cardAAr, card.source);
      } else if (card.source.cardBAr) {
        speakArabicItem(card.source.cardBAr, card.source);
      }

      // Açılan kartı Yapay Zekâ da görür (kısmi hafızasına kaydeder)
      rememberCardForAi(card);

      const nextFlipped = [...flippedUids, card.uid];
      setFlippedUids(nextFlipped);
      flippedUidsRef.current = nextFlipped;

      if (nextFlipped.length < 2) {
        return;
      }

      const firstCard = deck.find((c) => c.uid === nextFlipped[0]);
      if (!firstCard) {
        setFlippedUids([]);
        flippedUidsRef.current = [];
        return;
      }

      evaluateTwoCards(firstCard, card, currentTurn);
    },
    [
      matchedPairIds,
      phase,
      isPeeking,
      playMode,
      currentTurn,
      flippedUids,
      deck,
      speakArabicItem,
      rememberCardForAi,
      evaluateTwoCards,
    ]
  );

  const missedPairSources = useMemo(() => {
    return activePairs.filter((p) => (pairMismatches[p.pairId] || 0) > 0);
  }, [activePairs, pairMismatches]);

  const poolSummaryText = useMemo(() => {
    const withImageCount = allPairSources.filter((p) => Boolean(p.imageUrl))
      .length;
    if (isSynonymsAntonymsMode) {
      return `Eş & Zıt Anlamlılar Havuzu • ${allPairSources.length} çift hazır`;
    }
    if (withImageCount > 0) {
      return `Görselli & Sesli Kelime Havuzu • ${allPairSources.length} kelime hazır`;
    }
    return `Seçili Çalışma Havuzu • ${allPairSources.length} eşleştirme çifti hazır`;
  }, [allPairSources, isSynonymsAntonymsMode]);

  const handleToggleMute = useCallback(() => {
    playClick();
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
    if (next) {
      stopAllAudio();
      sfx.stopAllSfx();
    }
  }, [isMuted]);

  // Nasıl Oynanır Modal İçeriği
  const howToModalNode = showHowToModal && (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hafızanı Yokla Nasıl Oynanır"
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => setShowHowToModal(false)}
    >
      <div
        className="w-full max-w-lg rounded-3xl border-2 border-[#D8CBB0] dark:border-slate-700 bg-[#FFFDF8] dark:bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#E6D7BE] dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0F766E] text-white flex items-center justify-center shrink-0">
              <HelpCircle size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                Hafızanı Yokla — Nasıl Oynanır?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                Görsel, sesli telaffuz ve anlam eşleştirme kuralları
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHowToModal(false)}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>
            <strong>1. Kartları Çevir ve Dinle:</strong> Her turda iki kapalı
            deniz kabuğu kartı çevir. Arapça kart açıldığında kelimenin doğru
            telaffuzu otomatik seslendirilir.
          </p>
          <p>
            <strong>2. Eşleştir ve Sıranı Koru:</strong> Aynı kelimenin{" "}
            <em>Türkçe + Görsel</em> kartı ile <em>Arapça + Görsel</em> kartını
            bulduğunda <strong>+10 puan</strong> kazanırsın ve hamle sırası sende
            kalır!
          </p>
          <p>
            <strong>3. Üç Oyun Modu:</strong>{" "}
            <strong>Yapay zekâya karşı</strong> modunda rakibin açılan kartların
            bir kısmını aklında tutar (bazen unutur!) ve 1.2 sn düşünüp hamle
            yapar. <strong>İki kişilik</strong> modda aynı ekranda arkadaşınla
            yarışırsın. <strong>Antrenman</strong> modunda ise tek başına
            çalışırsın.
          </p>
          <p>
            <strong>4. Canlı Bilgi Notu:</strong> Eşleştirilen her kelimenin tam
            anlamı, örnek cümlesi ve varsa eş/zıt anlam nüansı sağ alttaki{" "}
            <strong>Bilgi Notu</strong> kutusunda anında gösterilir.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowHowToModal(false)}
          className="w-full min-h-[44px] rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-extrabold cursor-pointer"
        >
          Anladım, Oyuna Dön
        </button>
      </div>
    </div>
  );

  // ============================================================================
  // A) BAŞLANGIÇ / MOD SEÇİM EKRANI (2 SÜTUNLU ŞIK KART)
  // ============================================================================
  if (phase === "menu") {
    return (
      <div className="rounded-3xl border-2 border-[#D8CBB0] dark:border-slate-700 bg-[#FBF6EA] dark:bg-slate-900 shadow-lg overflow-hidden select-none">
        {howToModalNode}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 p-4 sm:p-7 items-stretch">
          {/* SOL SÜTUN: Kitap/Dalga İkonu + Büyük "Hafızanı Yokla" Başlığı + Seçili Havuz Bilgisi */}
          <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-[#0F766E] via-[#0E7490] to-[#134E4A] text-white p-5 sm:p-7 flex flex-col justify-between gap-6 shadow-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-sm">
                  <div className="relative flex items-center justify-center">
                    <BookOpen size={30} className="text-[#FDE68A]" />
                    <Waves
                      size={18}
                      className="text-cyan-200 absolute -bottom-2 -right-2"
                    />
                  </div>
                </div>
                <span
                  dir="rtl"
                  className="arabic text-xl sm:text-2xl font-bold text-[#FDE68A]"
                >
                  لُعْبَةُ الذَّاكِرَةِ
                </span>
              </div>

              <div className="space-y-2 pt-1">
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-balance">
                  Hafızanı Yokla
                </h2>
                <p className="text-sm sm:text-base text-teal-50/95 font-medium leading-relaxed">
                  Deniz kabuğu kartlarını çevir; büyük görselleri, sesli Arapça
                  kelimeleri ve Türkçe anlamlarını hafızanda tutarak eşleştir.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-black/20 border border-white/15 p-3.5 space-y-1.5">
              <div className="text-[11px] font-bold text-teal-200 tracking-wide">
                AKTİF KELİME HAVUZU
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                {poolSummaryText}
              </div>
              <div className="text-xs text-teal-100/85">
                Seçili seviye:{" "}
                <strong className="text-[#FDE68A]">
                  {GRID_CONFIG[difficulty].labelTr} (
                  {GRID_CONFIG[difficulty].summaryChip})
                </strong>
              </div>
            </div>
          </div>

          {/* SAĞ SÜTUN: Üstte Seviye (3'lü Seçim) + Altta Bir Mod Seç (3 Büyük Kart) */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-5">
            {/* Sağ Sütun Üst: Seviye */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <BarChart3 size={16} className="text-[#0F766E] dark:text-teal-400" />
                  <span>Seviye</span>
                </span>
                {onClose && (
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      stopAllAudio();
                      sfx.stopAllSfx();
                      onClose();
                    }}
                    className="min-h-[36px] px-3 py-1 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:border-rose-400 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <X size={14} />
                    <span>Listeye Dön</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(["easy", "medium", "hard"] as MemoryGridDifficulty[]).map(
                  (d) => {
                    const cfg = GRID_CONFIG[d];
                    const active = difficulty === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          playClick();
                          setDifficulty(d);
                        }}
                        className={`min-h-[58px] px-3.5 py-2.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-center ${
                          active
                            ? "bg-[#0F766E] text-white border-[#0D9488] shadow-sm"
                            : "bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border-[#E2D5BC] dark:border-slate-700 hover:border-[#0F766E]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-sm font-black">
                            📊 {cfg.labelTr}
                          </span>
                          <span
                            dir="rtl"
                            className={`arabic text-sm font-bold ${
                              active
                                ? "text-amber-200"
                                : "text-[#0F766E] dark:text-teal-400"
                            }`}
                          >
                            {cfg.labelAr}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-bold mt-0.5 tabular-nums ${
                            active
                              ? "text-teal-50"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {cfg.summaryChip}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Sağ Sütun Alt: Bir mod seç (3 Büyük Resimli/İkonlu Mod Kartı) */}
            <div className="space-y-2.5">
              <div className="text-sm font-black text-slate-800 dark:text-slate-100">
                Bir mod seç
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1) Yapay zekâya karşı */}
                <button
                  type="button"
                  onClick={() => startGameSession("ai", difficulty, null)}
                  className="group rounded-2xl border-2 border-[#E2D5BC] dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:border-[#EA580C] dark:hover:border-orange-500 p-4 text-left flex sm:flex-col items-center sm:items-start gap-3.5 transition-all hover:-translate-y-0.5 shadow-2xs cursor-pointer"
                >
                  <div className="w-14 h-14 sm:w-full sm:h-24 rounded-xl bg-gradient-to-br from-orange-100 via-amber-50 to-rose-100 dark:from-orange-950/60 dark:to-rose-950/50 border border-orange-200/80 dark:border-orange-800/50 flex items-center justify-center shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#EA580C] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      <Bot size={26} />
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="text-base font-black text-slate-900 dark:text-white leading-snug">
                      Yapay zekâya karşı
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                      1 • Sırayla oyna; rakibin bazen unutur.
                    </p>
                  </div>
                </button>

                {/* 2) İki kişilik */}
                <button
                  type="button"
                  onClick={() =>
                    startGameSession("two_player", difficulty, null)
                  }
                  className="group rounded-2xl border-2 border-[#E2D5BC] dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:border-[#0E7490] dark:hover:border-cyan-400 p-4 text-left flex sm:flex-col items-center sm:items-start gap-3.5 transition-all hover:-translate-y-0.5 shadow-2xs cursor-pointer"
                >
                  <div className="w-14 h-14 sm:w-full sm:h-24 rounded-xl bg-gradient-to-br from-cyan-100 via-sky-50 to-teal-100 dark:from-cyan-950/60 dark:to-teal-950/50 border border-cyan-200/80 dark:border-cyan-800/50 flex items-center justify-center shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#0E7490] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      <Users size={25} />
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="text-base font-black text-slate-900 dark:text-white leading-snug">
                      İki kişilik
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                      2 • Aynı ekranda arkadaşınla yarış.
                    </p>
                  </div>
                </button>

                {/* 3) Antrenman */}
                <button
                  type="button"
                  onClick={() => startGameSession("practice", difficulty, null)}
                  className="group rounded-2xl border-2 border-[#E2D5BC] dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:border-[#1F6E50] dark:hover:border-emerald-400 p-4 text-left flex sm:flex-col items-center sm:items-start gap-3.5 transition-all hover:-translate-y-0.5 shadow-2xs cursor-pointer"
                >
                  <div className="w-14 h-14 sm:w-full sm:h-24 rounded-xl bg-gradient-to-br from-emerald-100 via-teal-50 to-lime-100 dark:from-emerald-950/60 dark:to-teal-950/50 border border-emerald-200/80 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#1F6E50] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      <Target size={25} />
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="text-base font-black text-slate-900 dark:text-white leading-snug">
                      Antrenman
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                      3 • Tek başına çalış, hafızanı ısıt.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ALT ÇUBUK: Nasıl oynanır? | Tema | Ses */}
        <div className="border-t border-[#E6D7BE] dark:border-slate-800 bg-[#F3E9D6]/85 dark:bg-slate-950/70 px-4 sm:px-7 py-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              playClick();
              setShowHowToModal(true);
            }}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 hover:border-[#0F766E] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <HelpCircle size={15} className="text-[#0F766E] dark:text-teal-400" />
            <span>Nasıl oynanır?</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playClick();
                toggleTheme();
              }}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 hover:border-[#0F766E] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {theme === "dark" ? (
                <Sun size={15} className="text-amber-400" />
              ) : (
                <Moon size={15} className="text-slate-700" />
              )}
              <span>Tema</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 hover:border-[#0F766E] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isMuted ? (
                <VolumeX size={15} className="text-rose-500" />
              ) : (
                <Volume2 size={15} className="text-[#0F766E] dark:text-teal-400" />
              )}
              <span>{isMuted ? "Ses: Kapalı" : "Ses"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // OYUN SONU ÖZET PANELİ
  // ============================================================================
  if (phase === "finished") {
    const winnerHeadline =
      playMode === "ai"
        ? p1Score > p2Score
          ? "Tebrikler! Yapay Zekâyı Yendin!"
          : p1Score === p2Score
          ? "Baş Başa Mücadele! Berabere!"
          : "Bu Turu Yapay Zekâ Kazandı — Rövanşa Hazır mısın?"
        : playMode === "two_player"
        ? p1Score > p2Score
          ? "1. Oyuncu (P1) Kazandı!"
          : p1Score === p2Score
          ? "Dostluk Kazandı — Berabere!"
          : "2. Oyuncu (P2) Kazandı!"
        : timedOutGlobal
        ? "Süre Tamamlandı!"
        : "Tebrikler! Tüm Çiftler Eşleştirildi!";

    return (
      <div className="rounded-3xl border-2 border-[#D8CBB0] dark:border-slate-700 bg-[#FBF6EA] dark:bg-slate-900 p-4 sm:p-6 shadow-lg space-y-5 select-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D7BE] dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1F6E50] text-white flex items-center justify-center shadow-sm shrink-0">
              <Trophy size={24} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {winnerHeadline}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-semibold tabular-nums">
                {moves} hamle · {formatSeconds(elapsedSec)} süre ·{" "}
                {GRID_CONFIG[difficulty].labelTr} ({GRID_CONFIG[difficulty].summaryChip})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playClick();
                clearAllTimers();
                stopAllAudio();
                setPhase("menu");
              }}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-xs font-extrabold text-slate-800 dark:text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
            >
              Mod Seçimi
            </button>
            {onClose && (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  clearAllTimers();
                  stopAllAudio();
                  onClose();
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <X size={14} />
                <span>Çıkış</span>
              </button>
            )}
          </div>
        </div>

        {/* Skor Özeti */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-[#E2D5BC] dark:border-slate-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-[#1F6E50] dark:text-emerald-300 flex items-center justify-center">
                <User size={20} />
              </div>
              <div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {playMode === "two_player" ? "1. Oyuncu (P1)" : "Sen"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Doğru eşleşmelerden kazanılan puan
                </div>
              </div>
            </div>
            <span className="text-2xl font-black text-[#1F6E50] dark:text-emerald-400 tabular-nums">
              {p1Score}p
            </span>
          </div>

          {playMode !== "practice" && (
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-[#E2D5BC] dark:border-slate-700 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-[#EA580C] dark:text-orange-300 flex items-center justify-center">
                  {playMode === "ai" ? <Bot size={20} /> : <Users size={20} />}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white">
                    {playMode === "ai" ? "Yapay zekâ" : "2. Oyuncu (P2)"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Rakip toplam puanı
                  </div>
                </div>
              </div>
              <span className="text-2xl font-black text-[#EA580C] dark:text-orange-400 tabular-nums">
                {p2Score}p
              </span>
            </div>
          )}
        </div>

        {/* Öğrenilen Çiftler (Dinlemek için tıklayın) */}
        <div className="space-y-2">
          <div className="text-xs font-extrabold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" />
            <span>Bu Destede Eşleştirilen Kelimeler (Dinlemek için tıklayın)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activePairs.map((pair) => {
              const owner = matchedOwners[pair.pairId];
              return (
                <button
                  key={pair.pairId}
                  type="button"
                  onClick={() => speakArabicItem(pair.cardAAr, pair)}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-[#E2D5BC] dark:border-slate-700 flex items-center justify-between gap-2 text-left hover:border-[#1F6E50] cursor-pointer"
                >
                  <div className="min-w-0">
                    <div
                      dir="rtl"
                      className="arabic text-xl font-bold text-slate-900 dark:text-white truncate"
                    >
                      {pair.cardAAr}
                      {pair.cardBAr ? ` • ${pair.cardBAr}` : ""}
                    </div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                      {pair.fullMeaningTr}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {owner && (
                      <span className="text-[11px] font-black text-[#1F6E50] dark:text-emerald-300">
                        {owner}
                      </span>
                    )}
                    <Volume2 size={15} className="text-[#0F766E] dark:text-teal-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {missedPairSources.length >= 2 && (
            <button
              type="button"
              onClick={() =>
                startGameSession(playMode, difficulty, missedPairSources)
              }
              className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#0E7490] hover:bg-[#155E75] text-white font-black text-xs sm:text-sm border-b-4 border-[#164E63] active:border-b-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Target size={16} />
              <span>
                Zorlandığım Çiftlerle Tekrar Oyna ({missedPairSources.length})
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => startGameSession(playMode, difficulty, null)}
            className={`min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#1F6E50] hover:bg-[#16533C] text-white font-black text-xs sm:text-sm border-b-4 border-[#113F2E] active:border-b-0 flex items-center justify-center gap-2 cursor-pointer ${
              missedPairSources.length < 2 ? "sm:col-span-2" : ""
            }`}
          >
            <RotateCcw size={16} />
            <span>Yeni Deste ile Tekrar Oyna</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // B) AKTİF OYUN TAHTASI + BÜYÜK YAZILI/GÖRSELLİ KARTLAR + SAĞ YAN PANEL
  // ============================================================================
  const cfg = GRID_CONFIG[difficulty];
  const ringRadius = 25;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgress = Math.max(0, Math.min(1, turnSecLeft / cfg.turnSeconds));
  const ringDashOffset = ringCircumference * (1 - ringProgress);

  const isP1Active = currentTurn === "P1";
  const isOpponentActive = currentTurn === "AI" || currentTurn === "P2";

  const turnStatusText =
    playMode === "ai"
      ? currentTurn === "AI"
        ? "Yapay zekâ düşünüyor..."
        : "Sıra sende: iki kart çevir."
      : playMode === "two_player"
      ? currentTurn === "P1"
        ? "Sıra 1. Oyuncuda: iki kart çevir."
        : "Sıra 2. Oyuncuda: iki kart çevir."
      : "Sıra sende: iki kart çevir.";

  // Mobil (360px+) ve Masaüstü için tam dikdörtgen ve geniş kart ızgarası
  const boardGridClass =
    difficulty === "easy"
      ? "grid-cols-2 sm:grid-cols-4"
      : difficulty === "medium"
      ? "grid-cols-2 min-[430px]:grid-cols-3 sm:grid-cols-4"
      : "grid-cols-2 min-[480px]:grid-cols-4";

  return (
    <div className="rounded-3xl border-2 border-[#D8CBB0] dark:border-slate-700 bg-[#FBF6EA] dark:bg-slate-900 p-3 sm:p-5 shadow-lg space-y-3.5 select-none">
      {howToModalNode}

      {/* Üst Kompakt Navigasyon ve Mod Başlığı */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6D7BE] dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#0F766E] text-white flex items-center justify-center shrink-0">
            <BookOpen size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white whitespace-nowrap">
                Hafızanı Yokla
              </h2>
              <span
                dir="rtl"
                className="arabic text-base sm:text-lg font-bold text-[#0F766E] dark:text-teal-300"
              >
                لُعْبَةُ الذَّاكِرَةِ
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {cfg.labelTr} ({cfg.summaryChip}) ·{" "}
              {playMode === "ai"
                ? "Yapay zekâya karşı"
                : playMode === "two_player"
                ? "İki kişilik"
                : "Antrenman"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {playMode === "practice" && (
            <button
              type="button"
              onClick={handlePeekCards}
              disabled={isPeeking || peeksLeft <= 0}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-[#1F6E50] hover:bg-[#16533C] disabled:opacity-45 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              title="Kartları 1.5 Saniye Göster"
            >
              <Eye size={14} />
              <span className="hidden sm:inline">
                Kartları 1.5 Saniye Göster ({peeksLeft})
              </span>
              <span className="sm:hidden">İpucu ({peeksLeft})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              playClick();
              setShowHowToModal(true);
            }}
            className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
            aria-label="Nasıl oynanır?"
            title="Nasıl oynanır?"
          >
            <HelpCircle size={15} />
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              toggleTheme();
            }}
            className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
            aria-label="Tema değiştir"
            title="Tema değiştir"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
            aria-label={isMuted ? "Sesi Aç" : "Sesi Kapat"}
            title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
          >
            {isMuted ? (
              <VolumeX size={15} className="text-rose-500" />
            ) : (
              <Volume2 size={15} />
            )}
          </button>

          <button
            type="button"
            onClick={() => startGameSession(playMode, difficulty, null)}
            className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            title="Desteyi Yenile"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Yenile</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              clearAllTimers();
              stopAllAudio();
              setPhase("menu");
            }}
            className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:border-[#0F766E] cursor-pointer whitespace-nowrap shrink-0"
          >
            Modlar
          </button>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                playClick();
                clearAllTimers();
                stopAllAudio();
                onClose();
              }}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-[#D8CBB0] dark:border-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:border-rose-400 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <X size={14} />
              <span className="hidden md:inline">Çıkış</span>
            </button>
          )}
        </div>
      </div>

      {/* ANA 2 BÖLMELİ OYUN DÜZENİ: Sol Deniz/Turkuaz Kart Masası + Sağ Yan Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* SAĞ ÜST (Mobilde Üst Kompakt Bar, Masaüstünde Sağ Sütun Üstü): Skorlar + Dairesel Geri Sayım + Durum */}
        <div className="order-1 lg:order-2 lg:col-span-4 space-y-3">
          {/* Oyuncu Skor Kartları */}
          <div
            className={`grid gap-2.5 ${
              playMode === "practice" ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-1"
            }`}
          >
            {/* Oyuncu 1 / Sen Kartı */}
            <div
              className={`rounded-2xl p-3 border-2 transition-all flex items-center justify-between gap-2 ${
                isP1Active
                  ? "border-[#EA580C] bg-orange-50/90 dark:bg-orange-950/35 ring-2 ring-orange-400/35"
                  : "border-[#E2D5BC] dark:border-slate-700 bg-white dark:bg-slate-800/90"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                    isP1Active
                      ? "bg-[#EA580C] text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <User size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                    {playMode === "two_player" ? "1. Oyuncu (P1)" : "Sen"}
                  </div>
                  <div
                    className={`text-[11px] font-bold truncate ${
                      isP1Active
                        ? "text-[#EA580C] dark:text-orange-300"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {isP1Active ? "Sırada" : "Bekliyor"}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tabular-nums">
                  {p1Score}
                </div>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  Puan
                </div>
              </div>
            </div>

            {/* Rakip Kartı: Yapay zekâ veya 2. Oyuncu */}
            {playMode !== "practice" && (
              <div
                className={`rounded-2xl p-3 border-2 transition-all flex items-center justify-between gap-2 ${
                  isOpponentActive
                    ? "border-[#EA580C] bg-orange-50/90 dark:bg-orange-950/35 ring-2 ring-orange-400/35"
                    : "border-[#E2D5BC] dark:border-slate-700 bg-white dark:bg-slate-800/90"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                      isOpponentActive
                        ? "bg-[#EA580C] text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {playMode === "ai" ? <Bot size={18} /> : <Users size={18} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      {playMode === "ai" ? "Yapay zekâ" : "2. Oyuncu (P2)"}
                    </div>
                    <div
                      className={`text-[11px] font-bold truncate ${
                        isOpponentActive
                          ? "text-[#EA580C] dark:text-orange-300"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {playMode === "ai"
                        ? isOpponentActive
                          ? "Düşünüyor..."
                          : "Bekliyor"
                        : isOpponentActive
                        ? "Sırada"
                        : "Bekliyor"}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tabular-nums">
                    {p2Score}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    Puan
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dairesel Tur Geri Sayım Halkası + Süre & Hamle + Durum Metni */}
          <div className="rounded-2xl border border-[#E2D5BC] dark:border-slate-700 bg-white dark:bg-slate-800/90 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              {/* SVG Circular Countdown Ring */}
              <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 64 64"
                  className="w-16 h-16 -rotate-90"
                  aria-label={`Tur geri sayımı: ${turnSecLeft} saniye`}
                >
                  <circle
                    cx="32"
                    cy="32"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-slate-200 dark:text-slate-700"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r={ringRadius}
                    fill="none"
                    stroke={turnSecLeft <= 4 ? "#EF4444" : "#0D9488"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringDashOffset}
                  />
                </svg>
                <span
                  className={`absolute text-xs font-black tabular-nums ${
                    turnSecLeft <= 4
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {turnSecLeft} sn
                </span>
              </div>

              {/* Sağında Toplam Süre, Hamle ve Eşleşen Çift */}
              <div className="flex-1 grid grid-cols-2 gap-2 text-xs font-extrabold">
                <div className="rounded-xl bg-[#FBF6EA] dark:bg-slate-900/70 px-2.5 py-2 border border-[#E6D7BE] dark:border-slate-700">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Timer size={12} />
                    <span>Süre</span>
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {formatSeconds(elapsedSec)}
                  </div>
                </div>

                <div className="rounded-xl bg-[#FBF6EA] dark:bg-slate-900/70 px-2.5 py-2 border border-[#E6D7BE] dark:border-slate-700">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Layers size={12} />
                    <span>Hamle</span>
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {moves} ({matchedPairIds.length}/{activePairs.length})
                  </div>
                </div>
              </div>
            </div>

            {/* Canlı Sıra / Durum Metni */}
            <div
              className={`rounded-xl px-3 py-2 text-xs sm:text-sm font-extrabold text-center ${
                isOpponentActive && playMode === "ai"
                  ? "bg-orange-100/90 dark:bg-orange-950/50 text-[#C2410C] dark:text-orange-300"
                  : "bg-teal-50 dark:bg-teal-950/40 text-[#0F766E] dark:text-teal-300"
              }`}
            >
              {turnStatusText}
            </div>
          </div>
        </div>

        {/* SOL OYUN ALANI: Deniz/Turkuaz Zemin Üzerinde Sıcak Krem Deniz Kabuğu Kartları */}
        <div className="order-2 lg:order-1 lg:col-span-8 lg:row-span-2 rounded-3xl p-3 sm:p-5 bg-gradient-to-br from-[#0E7490] via-[#0D9488] to-[#115E59] dark:from-[#083344] dark:via-[#115E59] dark:to-[#0F172A] border-2 border-[#0F766E]/70 shadow-inner">
          <div className={`grid ${boardGridClass} gap-2.5 sm:gap-3.5`}>
            {deck.map((card, idx) => {
              const isMatched = matchedPairIds.includes(card.pairId);
              const ownerTag = matchedOwners[card.pairId];
              const isFlipped =
                isPeeking || isMatched || flippedUids.includes(card.uid);
              const isMismatch = mismatchedUids.includes(card.uid);
              const hasValidImage =
                Boolean(card.source.imageUrl) &&
                !failedImages[card.source.pairId];

              return (
                <div
                  key={card.uid}
                  className="relative h-44 sm:h-52 md:h-56 [perspective:1000px]"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Hafıza kartı ${idx + 1}`}
                    onClick={() => handleCardSelect(card)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleCardSelect(card);
                      }
                    }}
                    className={`relative w-full h-full transition-transform duration-300 [transform-style:preserve-3d] cursor-pointer ${
                      isFlipped ? "[transform:rotateY(180deg)]" : ""
                    }`}
                  >
                    {/* KAPALI KART TASARIMI: Sıcak krem/kum dokulu (#EFE3C8), kalın alt kenarlı, mercan kırmızısı deniz kabuğu amblemli */}
                    <div className="absolute inset-0 rounded-2xl bg-[#EFE3C8] hover:bg-[#F5EAD2] border-2 border-[#D4C19C] border-b-[6px] border-b-[#B59B6D] shadow-md flex flex-col items-center justify-center p-3 [backface-visibility:hidden] transition-colors">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#E8D7B4]/75 border border-[#D4C19C] flex items-center justify-center shadow-2xs">
                        <Shell
                          size={34}
                          strokeWidth={2.2}
                          className="text-[#E05A47]"
                        />
                      </div>
                      <span className="mt-2 text-[11px] font-extrabold text-[#8C734B] tabular-nums">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* AÇIK / EŞLEŞMİŞ KART TASARIMI */}
                    <div
                      className={`absolute inset-0 rounded-2xl border-2 border-b-[6px] p-2 sm:p-3 flex flex-col items-center justify-between text-center shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-hidden ${
                        isMatched
                          ? "bg-[#1F6E50] border-[#34D399] border-b-[#134733] text-white"
                          : isMismatch
                          ? "bg-rose-50 dark:bg-rose-950 border-rose-500 border-b-rose-700 text-slate-900 dark:text-white"
                          : "bg-[#FFFDF8] dark:bg-slate-800 border-[#F59E0B] border-b-[#B45309] text-slate-900 dark:text-white"
                      }`}
                    >
                      {/* Üst Satır: Dil/İlişki Etiketi + Eşleşme ✓ veya Ses Butonu */}
                      <div className="w-full flex items-center justify-between gap-1 shrink-0">
                        <span
                          className={`text-[10px] sm:text-[11px] font-black leading-none ${
                            isMatched
                              ? "text-emerald-100"
                              : card.side === "A"
                              ? "text-[#0F766E] dark:text-teal-300"
                              : "text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {card.side === "A"
                            ? "عَرَبِيّ"
                            : card.source.relationBadge || "TÜRKÇE"}
                        </span>

                        {isMatched ? (
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-400/30 border border-emerald-200 text-white flex items-center justify-center shrink-0">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        ) : (
                          (card.side === "A" || Boolean(card.source.cardBAr)) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                speakArabicItem(
                                  card.side === "A"
                                    ? card.source.cardAAr
                                    : card.source.cardBAr ||
                                        card.source.cardAAr,
                                  card.source
                                );
                              }}
                              className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/70 text-[#0F766E] dark:text-teal-200 flex items-center justify-center shrink-0 cursor-pointer"
                              aria-label="Kelimeyi seslendir"
                            >
                              <Volume2 size={13} />
                            </button>
                          )
                        )}
                      </div>

                      {/* KART GÖVDESİ: BÜYÜK KARE RESİM (veya ikon) + ÇOK BÜYÜK ARAPÇA / BÜYÜK TÜRKÇE */}
                      <div className="flex-1 w-full flex flex-col items-center justify-center gap-1.5 min-h-0 px-0.5">
                        {hasValidImage ? (
                          <div
                            className={`w-16 h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 aspect-square rounded-xl overflow-hidden border shrink-0 ${
                              isMatched
                                ? "border-emerald-300/60 bg-white"
                                : "border-slate-200 dark:border-slate-600 bg-white"
                            }`}
                          >
                            <img
                              src={card.source.imageUrl}
                              alt={card.source.cardBTr}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setFailedImages((prev) => ({
                                  ...prev,
                                  [card.source.pairId]: true,
                                }))
                              }
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 ${
                              isMatched
                                ? "bg-white/15 text-emerald-100"
                                : "bg-amber-100/80 dark:bg-slate-700 text-[#0F766E] dark:text-teal-300"
                            }`}
                          >
                            {card.side === "A" ? (
                              <Volume2 size={22} />
                            ) : (
                              <BookOpen size={22} />
                            )}
                          </div>
                        )}

                        {card.side === "A" ? (
                          <div
                            dir="rtl"
                            className={`arabic text-2xl sm:text-3xl md:text-4xl font-bold leading-relaxed line-clamp-2 break-words ${
                              isMatched
                                ? "text-white"
                                : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {card.source.cardAAr}
                          </div>
                        ) : card.source.cardBAr ? (
                          <div className="flex flex-col items-center min-h-0">
                            <div
                              dir="rtl"
                              className={`arabic text-2xl sm:text-3xl md:text-4xl font-bold leading-relaxed line-clamp-1 ${
                                isMatched
                                  ? "text-white"
                                  : "text-[#0F766E] dark:text-teal-300"
                              }`}
                            >
                              {card.source.cardBAr}
                            </div>
                            <span
                              className={`text-sm sm:text-base md:text-lg font-extrabold leading-tight line-clamp-1 ${
                                isMatched
                                  ? "text-emerald-100"
                                  : "text-slate-700 dark:text-slate-200"
                              }`}
                            >
                              {card.source.cardBTr}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`text-sm sm:text-base md:text-lg font-extrabold leading-snug line-clamp-2 break-words ${
                              isMatched
                                ? "text-white"
                                : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {card.source.cardBTr}
                          </span>
                        )}
                      </div>

                      {/* Alt Satır: Eşleştiğinde Sol Altta Bulucu Etiketi (SEN / YZ / P1 / P2) */}
                      <div className="w-full flex items-center justify-between min-h-[18px] shrink-0">
                        {isMatched && ownerTag ? (
                          <span className="px-2 py-0.5 rounded-md bg-black/25 text-[10px] sm:text-xs font-black tracking-wide text-emerald-50">
                            {ownerTag}
                          </span>
                        ) : (
                          <span />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SAĞ ALT: 💡 Bilgi Notu Kutusu (Eşleştirilen kelimenin anlamı, örnek cümlesi, eş/zıt nüansı) */}
        <div className="order-3 lg:order-3 lg:col-span-4 rounded-2xl border-2 border-[#E2D5BC] dark:border-slate-700 bg-white dark:bg-slate-800/95 p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2 border-b border-[#EFE5D2] dark:border-slate-700 pb-2">
            <div className="flex items-center gap-1.5 text-sm font-black text-amber-800 dark:text-amber-300">
              <Lightbulb size={17} className="text-amber-500 shrink-0" />
              <span>Bilgi Notu</span>
            </div>
            {lastMatchedSource && (
              <button
                type="button"
                onClick={() =>
                  speakArabicItem(lastMatchedSource.cardAAr, lastMatchedSource)
                }
                className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <Volume2 size={13} />
                <span>Dinle</span>
              </button>
            )}
          </div>

          {lastMatchedSource ? (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span
                  dir="rtl"
                  className="arabic text-2xl sm:text-3xl font-bold text-[#1F6E50] dark:text-emerald-300 leading-relaxed"
                >
                  {lastMatchedSource.cardAAr}
                </span>
                {lastMatchedSource.kok && (
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Kök: {lastMatchedSource.kok}
                  </span>
                )}
              </div>

              <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {lastMatchedSource.fullMeaningTr}
              </div>

              {(lastMatchedSource.ornekAr || lastMatchedSource.ornekTr) && (
                <div className="rounded-xl bg-[#FBF6EA] dark:bg-slate-900/80 border border-[#E6D7BE] dark:border-slate-700 p-2.5 space-y-1">
                  {lastMatchedSource.ornekAr && (
                    <div
                      dir="rtl"
                      className="arabic text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-relaxed"
                    >
                      {lastMatchedSource.ornekAr}
                    </div>
                  )}
                  {lastMatchedSource.ornekTr && (
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {lastMatchedSource.ornekTr}
                    </div>
                  )}
                </div>
              )}

              {lastMatchedSource.nuanceNote && (
                <div className="text-xs font-semibold text-[#0F766E] dark:text-teal-300 leading-relaxed">
                  {lastMatchedSource.nuanceNote}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Bir kelime çiftini eşleştirdiğinde anlamı, varsa örnek cümlesi ve
              eş/zıt anlam nüansı bu kutuda canlı olarak gösterilir.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
