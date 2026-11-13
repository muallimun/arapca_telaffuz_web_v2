"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  Trophy,
  Flame,
  Timer,
  Eye,
  RotateCcw,
  Sparkles,
  Check,
  X,
  Footprints,
  Layers,
  Target,
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

interface MemoryPairSource {
  pairId: string;
  canonicalWordId: string;
  audioId?: string;
  cardAAr: string;
  cardASubTr?: string;
  cardBTr: string;
  cardBAr?: string;
  relationBadge?: "= Eş Anlam" | "≠ Zıt Anlam";
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
    labelTr: string;
    labelAr: string;
    gridDesc: string;
    peeksAllowed: number;
  }
> = {
  easy: {
    pairs: 6,
    cards: 12,
    labelTr: "Kolay",
    labelAr: "سَهْل",
    gridDesc: "3×4 (12 Kart • 6 Çift)",
    peeksAllowed: 2,
  },
  medium: {
    pairs: 8,
    cards: 16,
    labelTr: "Orta",
    labelAr: "مُتَوَسِّط",
    gridDesc: "4×4 (16 Kart • 8 Çift)",
    peeksAllowed: 2,
  },
  hard: {
    pairs: 10,
    cards: 20,
    labelTr: "Zor",
    labelAr: "صَعْب",
    gridDesc: "4×5 (20 Kart • 10 Çift)",
    peeksAllowed: 3,
  },
};

function shortenMeaning(raw: string): string {
  const clean = (raw || "").trim();
  if (!clean) return "Anlam";
  const first = clean.split(/[;/]/)[0]?.trim() || clean;
  return first.length > 42 ? `${first.slice(0, 40)}…` : first;
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
  const { preferredVoiceGender, speechRate } = useSettings();
  const { addMistake, recordItemAttempt, addStudyMinutes } = useUserStore();

  // Görsel kelime hızlı arama tablosu
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

  // Havuzdan eşleştirme çiftlerini oluştur
  const allPairSources = useMemo<MemoryPairSource[]>(() => {
    const list: MemoryPairSource[] = [];
    const seen = new Set<string>();

    const pushSource = (src: MemoryPairSource) => {
      if (!src.cardAAr || !src.cardBTr) return;
      if (seen.has(src.pairId)) return;
      seen.add(src.pairId);
      list.push(src);
    };

    // 1. Eş ve Zıt Anlamlılar Özel Çift Yapısı
    if (isSynonymsAntonymsMode && synonymEntries.length > 0) {
      for (const ez of synonymEntries) {
        const syn = ez.es_anlamlilar?.[0];
        const ant = ez.zit_anlamlilar?.[0];
        const chosen = syn || ant;
        const bare = stripHarakat(ez.kelime_ar || "").trim();
        const vk = visualLookup.byBareAr.get(bare);
        if (chosen) {
          pushSource({
            pairId: ez.id,
            canonicalWordId: ez.id,
            audioId: vk?.id,
            cardAAr: ez.kelime_ar,
            cardASubTr: shortenMeaning(ez.anlam_tr),
            cardBAr: chosen.ar,
            cardBTr: shortenMeaning(chosen.tr || ez.anlam_tr),
            relationBadge: syn ? "= Eş Anlam" : "≠ Zıt Anlam",
            imageUrl: vk?.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
            ses_erkek: vk?.ses_erkek,
            ses_kadin: vk?.ses_kadin,
          });
        } else {
          pushSource({
            pairId: ez.id,
            canonicalWordId: ez.id,
            audioId: vk?.id,
            cardAAr: ez.kelime_ar,
            cardBTr: shortenMeaning(ez.anlam_tr),
            imageUrl: vk?.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
            ses_erkek: vk?.ses_erkek,
            ses_kadin: vk?.ses_kadin,
          });
        }
      }
    }

    // 2. Doğrudan Görsel Kelime Havuzu
    if (list.length === 0 && visualPool.length > 0 && vocabulary.length === 0) {
      for (const vk of visualPool) {
        pushSource({
          pairId: vk.id,
          canonicalWordId: vk.id,
          audioId: vk.id,
          cardAAr: vk.arapca,
          cardBTr: shortenMeaning(vk.turkce),
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
          visualLookup.byId.get(w.id) || visualLookup.byBareAr.get(bare);
        const imgRaw = w.gorsel || vk?.gorsel;
        pushSource({
          pairId: w.id,
          canonicalWordId: w.id,
          audioId: w.id,
          cardAAr: ar,
          cardBTr: shortenMeaning(w.anlam_tr),
          imageUrl: imgRaw ? resolveImageUrl(imgRaw) : undefined,
          ses_erkek: w.ses_erkek || vk?.ses_erkek,
          ses_kadin: w.ses_kadin || vk?.ses_kadin,
        });
      }
    }

    // 4. Yedek Görsel Havuz / Deyim / Diyalog Satırları
    if (list.length === 0 && visualPool.length > 0) {
      for (const vk of visualPool) {
        pushSource({
          pairId: vk.id,
          canonicalWordId: vk.id,
          audioId: vk.id,
          cardAAr: vk.arapca,
          cardBTr: shortenMeaning(vk.turkce),
          imageUrl: vk.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
          ses_erkek: vk.ses_erkek,
          ses_kadin: vk.ses_kadin,
        });
      }
    }

    if (list.length < 10 && idioms.length > 0) {
      for (const idm of idioms) {
        pushSource({
          pairId: `idiom_${idm.id}`,
          canonicalWordId: `idiom_${idm.id}`,
          cardAAr: idm.arapca,
          cardBTr: shortenMeaning(idm.turkce),
        });
      }
    }

    if (list.length < 10 && dialogues.length > 0) {
      for (const dlg of dialogues) {
        for (const line of dlg.satirlar.slice(0, 5)) {
          if (line.arapca.split(/\s+/).length <= 6) {
            pushSource({
              pairId: `sent_${dlg.id}_${line.sira}`,
              canonicalWordId: `sent_${dlg.id}_${line.sira}`,
              cardAAr: line.arapca,
              cardBTr: shortenMeaning(line.turkce),
            });
          }
        }
      }
    }

    // Minimum 10 çift garantisi (4x5 Zor mod için)
    if (list.length < 10) {
      const fallback =
        cefrFilter === "all"
          ? gorselKelimeler
          : gorselKelimeler.filter((vk) => vk.cefr === cefrFilter);
      for (const vk of fallback) {
        pushSource({
          pairId: vk.id,
          canonicalWordId: vk.id,
          audioId: vk.id,
          cardAAr: vk.arapca,
          cardBTr: shortenMeaning(vk.turkce),
          imageUrl: vk.gorsel ? resolveImageUrl(vk.gorsel) : undefined,
          ses_erkek: vk.ses_erkek,
          ses_kadin: vk.ses_kadin,
        });
        if (list.length >= 20) break;
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
    visualLookup,
  ]);

  const initialBoard = useMemo(() => {
    const cfg = GRID_CONFIG.medium;
    const chosenPairs = allPairSources.slice(
      0,
      Math.min(cfg.pairs, allPairSources.length)
    );
    const rawCards: MemoryDeckCard[] = [];
    for (const pair of chosenPairs) {
      rawCards.push({
        uid: `cardA_${pair.pairId}`,
        pairId: pair.pairId,
        side: "A",
        source: pair,
      });
      rawCards.push({
        uid: `cardB_${pair.pairId}`,
        pairId: pair.pairId,
        side: "B",
        source: pair,
      });
    }
    // Deterministik başlangıç karıştırması (render sırasında saf fonksiyon)
    const permuted = [...rawCards];
    for (let i = permuted.length - 1; i > 0; i--) {
      const j = (i * 7 + 3) % (i + 1);
      const tmp = permuted[i];
      permuted[i] = permuted[j];
      permuted[j] = tmp;
    }
    return { chosenPairs, deck: permuted, peeksAllowed: cfg.peeksAllowed };
  }, [allPairSources]);

  const [difficulty, setDifficulty] = useState<MemoryGridDifficulty>("medium");
  const [customDeckState, setCustomDeckState] = useState<{
    poolRef: MemoryPairSource[];
    activePairs: MemoryPairSource[];
    deck: MemoryDeckCard[];
  } | null>(null);

  const activePairs =
    customDeckState && customDeckState.poolRef === allPairSources
      ? customDeckState.activePairs
      : initialBoard.chosenPairs;
  const deck =
    customDeckState && customDeckState.poolRef === allPairSources
      ? customDeckState.deck
      : initialBoard.deck;

  const [flippedUids, setFlippedUids] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [mismatchedUids, setMismatchedUids] = useState<string[]>([]);
  const [isPeeking, setIsPeeking] = useState(false);
  const [peeksLeft, setPeeksLeft] = useState(initialBoard.peeksAllowed);

  const [moves, setMoves] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [pairMismatches, setPairMismatches] = useState<Record<string, number>>(
    {}
  );
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const boardLockRef = useRef(false);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number>(0);
  const isMutedRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

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

  const buildBoard = useCallback(
    (
      targetDiff: MemoryGridDifficulty,
      customSources?: MemoryPairSource[] | null
    ) => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
      if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
      boardLockRef.current = false;

      const cfg = GRID_CONFIG[targetDiff];
      const basePool =
        customSources && customSources.length >= 2
          ? customSources
          : allPairSources;

      const chosenPairs = shuffleArray([...basePool]).slice(
        0,
        Math.min(cfg.pairs, basePool.length)
      );

      // Eğer özel hata seti küçükse kalan çiftleri ana havuzdan tamamla
      if (chosenPairs.length < cfg.pairs && allPairSources.length > chosenPairs.length) {
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

      setCustomDeckState({
        poolRef: allPairSources,
        activePairs: chosenPairs,
        deck: shuffleArray(cards),
      });
      setFlippedUids([]);
      setMatchedPairIds([]);
      setMismatchedUids([]);
      setIsPeeking(false);
      setPeeksLeft(cfg.peeksAllowed);
      setMoves(0);
      setElapsedSec(0);
      setCombo(0);
      setMaxCombo(0);
      setScore(0);
      setPairMismatches({});
      setIsFinished(false);
      setTimedOut(false);
      sessionStartRef.current = Date.now();
    },
    [allPairSources]
  );

  // Oturum başlangıç zamanı ve unmount temizliği
  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
      if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
      stopAllAudio();
      sfx.stopAllSfx();
    };
  }, []);

  // Süre sayacı (ve opsiyonel üst bar timeLimit geri sayımı)
  useEffect(() => {
    if (isFinished || deck.length === 0) return;
    const timer = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (timeLimit && timeLimit > 0 && next >= timeLimit * 2) {
          clearInterval(timer);
          setTimedOut(true);
          setIsFinished(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished, deck.length, timeLimit]);

  // 🔍 Kartları 1.5 Saniye Göster İpucu Butonu
  const handlePeekCards = useCallback(() => {
    if (isPeeking || peeksLeft <= 0 || isFinished || boardLockRef.current) {
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
  }, [isPeeking, peeksLeft, isFinished]);

  const handleCardSelect = useCallback(
    (card: MemoryDeckCard) => {
      if (
        isFinished ||
        isPeeking ||
        boardLockRef.current ||
        matchedPairIds.includes(card.pairId) ||
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

      const nextFlipped = [...flippedUids, card.uid];
      setFlippedUids(nextFlipped);

      if (nextFlipped.length < 2) {
        return;
      }

      // 2 kart açıldı -> Hamle sayısını artır ve eşleşmeyi kontrol et
      boardLockRef.current = true;
      const nextMoves = moves + 1;
      setMoves(nextMoves);

      const firstCard = deck.find((c) => c.uid === nextFlipped[0]);
      const secondCard = card;

      if (!firstCard) {
        boardLockRef.current = false;
        setFlippedUids([]);
        return;
      }

      if (firstCard.pairId === secondCard.pairId) {
        // EŞLEŞTİ!
        const nextCombo = combo + 1;
        const multiplier = Math.min(5, nextCombo);
        const gained = 100 * multiplier;

        setCombo(nextCombo);
        setMaxCombo((prev) => Math.max(prev, nextCombo));
        setScore((prev) => prev + gained);

        const updatedMatched = [...matchedPairIds, firstCard.pairId];
        setMatchedPairIds(updatedMatched);
        setFlippedUids([]);
        boardLockRef.current = false;

        // SRS kaydı: ilk denemede bilindiyse olumlu kaydet
        const canonical = normalizeToCanonicalMistakeId(
          firstCard.source.canonicalWordId,
          firstCard.source.cardAAr
        );
        if (canonical && !(pairMismatches[firstCard.pairId] > 0)) {
          recordItemAttempt(canonical, "word", true);
        }

        if (updatedMatched.length >= activePairs.length) {
          const studyMin = Math.max(
            1,
            Math.round((Date.now() - sessionStartRef.current) / 60000)
          );
          addStudyMinutes(studyMin);
          saveLastExerciseSummary({
            moduleName: "3D Hafıza Kartları",
            solved: Math.max(updatedMatched.length, nextMoves),
            correct: updatedMatched.length,
            wrong: Math.max(0, nextMoves - updatedMatched.length),
          });
          setTimeout(() => {
            setIsFinished(true);
            if (!isMutedRef.current) {
              void playFanfare(95);
            }
          }, 420);
        } else if (!isMutedRef.current) {
          void playCorrect({ streak: nextCombo });
        }
      } else {
        // EŞLEŞMEDİ -> Kısa süre göster, SRS/Hata Defteri geri bildirimi gönder ve geri kapat
        setCombo(0);
        setMismatchedUids(nextFlipped);
        if (!isMutedRef.current) {
          void playWrong();
        }

        const p1 = firstCard.pairId;
        const p2 = secondCard.pairId;
        const nextMismatches = {
          ...pairMismatches,
          [p1]: (pairMismatches[p1] || 0) + 1,
          [p2]: (pairMismatches[p2] || 0) + 1,
        };
        setPairMismatches(nextMismatches);

        for (const c of [firstCard, secondCard]) {
          const canonical = normalizeToCanonicalMistakeId(
            c.source.canonicalWordId,
            c.source.cardAAr
          );
          if (canonical) {
            recordItemAttempt(canonical, "word", false);
            if ((nextMismatches[c.pairId] || 0) >= 2) {
              addMistake(canonical);
            }
          }
        }

        evalTimerRef.current = setTimeout(() => {
          setFlippedUids([]);
          setMismatchedUids([]);
          boardLockRef.current = false;
        }, 920);
      }
    },
    [
      isFinished,
      isPeeking,
      matchedPairIds,
      flippedUids,
      moves,
      deck,
      combo,
      pairMismatches,
      activePairs.length,
      speakArabicItem,
      recordItemAttempt,
      addMistake,
      addStudyMinutes,
    ]
  );

  const multiplierDisplay = Math.max(1, Math.min(5, combo || 1));

  const missedPairSources = useMemo(() => {
    return activePairs.filter((p) => (pairMismatches[p.pairId] || 0) > 0);
  }, [activePairs, pairMismatches]);

  const accuracyRate = useMemo(() => {
    if (moves === 0) return 100;
    return Math.min(100, Math.round((matchedPairIds.length / moves) * 100));
  }, [moves, matchedPairIds.length]);

  // Mobil & Masaüstü %100 Taşmasız Izgara Sınıfları
  const gridColsClass =
    difficulty === "easy"
      ? "grid-cols-3 sm:grid-cols-4"
      : difficulty === "medium"
      ? "grid-cols-4"
      : "grid-cols-4 sm:grid-cols-5";

  return (
    <div className="rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FAF4E8] dark:bg-[var(--surface)] p-3 sm:p-5 shadow-md space-y-3.5 select-none">
      {/* ÜST BAŞLIK & ZORLUK SEÇİCİ */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6D7BE] dark:border-[var(--border)] pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6741D9] to-indigo-700 text-white flex items-center justify-center text-xl shadow-2xs shrink-0">
            🃏
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                3D Hafıza Kartları
              </h2>
              <span
                dir="rtl"
                className="arabic text-base sm:text-lg font-bold text-[#6741D9] dark:text-purple-300"
              >
                لُعْبَةُ الذَّاكِرَةِ
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-[var(--muted)] font-semibold">
              {GRID_CONFIG[difficulty].gridDesc} • Arapça kelimeyi görsel ve anlamıyla eşleştir
            </p>
          </div>
        </div>

        {/* Zorluk Izgara Seçimi + Çıkış */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1">
            {(["easy", "medium", "hard"] as MemoryGridDifficulty[]).map((d) => {
              const active = difficulty === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    playClick();
                    setDifficulty(d);
                    buildBoard(d, null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    active
                      ? "bg-[#6741D9] text-white shadow-2xs"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {GRID_CONFIG[d].labelTr} ({GRID_CONFIG[d].cards})
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              isMutedRef.current = next;
              if (next) {
                stopAllAudio();
                sfx.stopAllSfx();
              }
            }}
            className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] flex items-center justify-center cursor-pointer"
            aria-label={isMuted ? "Sesi Aç" : "Sesi Kapat"}
          >
            {isMuted ? (
              <VolumeX size={15} className="text-rose-500" />
            ) : (
              <Volume2 size={15} />
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                playClick();
                stopAllAudio();
                sfx.stopAllSfx();
                onClose();
              }}
              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] hover:border-rose-400 flex items-center gap-1 cursor-pointer"
            >
              <X size={14} />
              <span className="hidden sm:inline">Listeye Dön</span>
            </button>
          )}
        </div>
      </div>

      {/* ÜST GÖSTERGE ÇUBUĞU (HUD): Hamle, Süre, Kombo Çarpanı, Eşleşen Çift & 1.5s İpucu */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white/95 dark:bg-[var(--background)] rounded-xl p-2 sm:p-2.5 border border-[#E6D7BE] dark:border-[var(--border)]">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1 tabular-nums">
            <Footprints size={13} className="text-[#6741D9]" />
            <span>Hamle: {moves}</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-extrabold text-[#065F46] dark:text-emerald-300 flex items-center gap-1 tabular-nums">
            <Timer size={13} />
            <span>{formatSeconds(elapsedSec)}</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 text-xs font-extrabold text-orange-700 dark:text-orange-300 flex items-center gap-1 tabular-nums">
            <Flame size={13} className="text-orange-500" />
            <span>Kombo x{multiplierDisplay}</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-xs font-extrabold text-purple-800 dark:text-purple-300 flex items-center gap-1 tabular-nums">
            <Layers size={13} />
            <span>
              Eşleşen: {matchedPairIds.length} / {activePairs.length}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1 tabular-nums">
            <Trophy size={13} className="text-amber-600" />
            <span>{score}p</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handlePeekCards}
            disabled={isPeeking || peeksLeft <= 0 || isFinished}
            className="flex-1 sm:flex-initial min-h-[38px] px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] disabled:opacity-45 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Eye size={14} className="shrink-0" />
            <span>🔍 Kartları 1.5 Saniye Göster ({peeksLeft})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playStart();
              buildBoard(difficulty, null);
            }}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1 cursor-pointer"
            title="Desteyi Yeniden Karıştır"
          >
            <RotateCcw size={14} />
            <span className="hidden md:inline">Yenile</span>
          </button>
        </div>
      </div>

      {/* OYUN SONU ÖZET PANELİ */}
      {isFinished ? (
        <div className="rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#087F5B]/70 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <Trophy size={24} />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-[var(--foreground)]">
                  {timedOut
                    ? "Süre Tamamlandı!"
                    : "Tebrikler! Tüm Çiftler Eşleştirildi!"}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--muted)] font-semibold">
                  {moves} hamlede • {formatSeconds(elapsedSec)} sürede • En yüksek seri: x
                  {Math.max(1, maxCombo)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[11px] font-bold text-[var(--muted)]">
                  TOPLAM SKOR
                </div>
                <div className="text-2xl font-black text-[#087F5B] dark:text-emerald-400 tabular-nums">
                  {score} Puan (%{accuracyRate} İsabet)
                </div>
              </div>
            </div>
          </div>

          {/* Eşleştirilen Çiftlerin Sesli Özeti */}
          <div className="space-y-2">
            <div className="text-xs font-extrabold text-[var(--muted)] uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              <span>Bu Destede Öğrenilen Kelime Çiftleri (Dinlemek için tıklayın)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {activePairs.map((pair) => {
                const missedCount = pairMismatches[pair.pairId] || 0;
                return (
                  <button
                    key={pair.pairId}
                    type="button"
                    onClick={() => speakArabicItem(pair.cardAAr, pair)}
                    className="p-2.5 rounded-xl bg-[#FAF4E8] dark:bg-slate-800/80 border border-[#E6D7BE] dark:border-slate-700 flex items-center justify-between gap-2 text-left hover:border-[#087F5B] cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div
                        dir="rtl"
                        className="arabic text-lg font-bold text-[var(--foreground)] truncate"
                      >
                        {pair.cardAAr}
                        {pair.cardBAr ? `  •  ${pair.cardBAr}` : ""}
                      </div>
                      <div className="text-xs font-semibold text-[var(--muted)] truncate">
                        {pair.cardBTr}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-lg text-[11px] font-black shrink-0 flex items-center gap-1 ${
                        missedCount > 0
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                          : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                      }`}
                    >
                      <Volume2 size={13} />
                      {missedCount > 0 ? `${missedCount} deneme` : "Tam"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {missedPairSources.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  playStart();
                  buildBoard(difficulty, missedPairSources);
                }}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#6741D9] hover:bg-[#5B21B6] text-white font-black text-xs sm:text-sm border-b-4 border-[#4C1D95] active:border-b-0 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Target size={16} />
                <span>
                  🎯 Zorlandığım Çiftlerle Tekrar Oyna ({missedPairSources.length})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                playStart();
                buildBoard(difficulty, null);
              }}
              className={`min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white font-black text-xs sm:text-sm border-b-4 border-[#044E38] active:border-b-0 flex items-center justify-center gap-2 cursor-pointer ${
                missedPairSources.length < 2 ? "sm:col-span-2" : ""
              }`}
            >
              <RotateCcw size={16} />
              <span>Yeni Deste ile Tekrar Oyna</span>
            </button>
          </div>
        </div>
      ) : (
        /* 3D PERSPEKTİFLİ HAFIZA KARTLARI IZGARASI */
        <div className={`grid ${gridColsClass} gap-2 sm:gap-3`}>
          {deck.map((card, idx) => {
            const isMatched = matchedPairIds.includes(card.pairId);
            const isFlipped =
              isPeeking || isMatched || flippedUids.includes(card.uid);
            const isMismatch = mismatchedUids.includes(card.uid);
            const hasImage =
              card.side === "B" &&
              Boolean(card.source.imageUrl) &&
              !card.source.cardBAr &&
              !failedImages[card.source.pairId];

            return (
              <div
                key={card.uid}
                className="relative h-28 sm:h-36 md:h-40 [perspective:1000px]"
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
                  className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] cursor-pointer ${
                    isFlipped ? "[transform:rotateY(180deg)]" : ""
                  }`}
                >
                  {/* KART ARKA YÜZÜ (KAPALI DURUM) */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-[#065F46] bg-gradient-to-br from-[#087F5B] via-[#065F46] to-[#044E38] text-white shadow-sm flex flex-col items-center justify-center p-2 [backface-visibility:hidden] hover:brightness-110 transition-all">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-base sm:text-xl font-black">
                      🃏
                    </div>
                    <span
                      dir="rtl"
                      className="arabic text-xs sm:text-sm font-bold text-emerald-100 mt-1 opacity-90"
                    >
                      اِقْلِبْ
                    </span>
                    <span className="text-[10px] font-bold text-emerald-200/80 tabular-nums">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* KART ÖN YÜZÜ (AÇILMIŞ DURUM — rotateY(180deg)) */}
                  <div
                    className={`absolute inset-0 rounded-2xl border-2 p-1.5 sm:p-2.5 flex flex-col items-center justify-between text-center shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-hidden ${
                      isMatched
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-[#087F5B] ring-2 ring-emerald-400/50"
                        : isMismatch
                        ? "bg-rose-50 dark:bg-rose-950/60 border-rose-500 ring-2 ring-rose-400/50"
                        : "bg-white dark:bg-slate-900 border-[#6741D9]"
                    }`}
                  >
                    {/* Üst Etiket ve Ses Butonu */}
                    <div className="w-full flex items-center justify-between gap-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-black leading-none ${
                          card.side === "A"
                            ? "bg-purple-100 dark:bg-purple-950/80 text-[#6741D9] dark:text-purple-300"
                            : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {card.side === "A"
                          ? "عَرَبِيّ"
                          : card.source.relationBadge || "TR"}
                      </span>

                      {isMatched ? (
                        <span className="w-5 h-5 rounded-full bg-[#087F5B] text-white flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
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
                                  : card.source.cardBAr || card.source.cardAAr,
                                card.source
                              );
                            }}
                            className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-[#065F46] dark:text-emerald-300 flex items-center justify-center shrink-0 cursor-pointer"
                            aria-label="Kelimeyi seslendir"
                          >
                            <Volume2 size={12} />
                          </button>
                        )
                      )}
                    </div>

                    {/* Kart Gövdesi: A Yüzü (Arapça + Ses) | B Yüzü (Kare Görsel + Türkçe veya Eş/Zıt Arapça) */}
                    {card.side === "A" ? (
                      <div className="flex-1 flex flex-col items-center justify-center w-full px-0.5 min-h-0">
                        <div
                          dir="rtl"
                          className="arabic text-lg sm:text-2xl md:text-3xl font-bold text-[var(--foreground)] leading-snug line-clamp-2 break-words"
                        >
                          {card.source.cardAAr}
                        </div>
                        {card.source.cardASubTr && (
                          <span className="text-[10px] font-semibold text-[var(--muted)] line-clamp-1 mt-0.5">
                            {card.source.cardASubTr}
                          </span>
                        )}
                      </div>
                    ) : card.source.cardBAr ? (
                      <div className="flex-1 flex flex-col items-center justify-center w-full px-0.5 min-h-0">
                        <div
                          dir="rtl"
                          className="arabic text-lg sm:text-2xl font-bold text-[#087F5B] dark:text-emerald-300 leading-snug line-clamp-2"
                        >
                          {card.source.cardBAr}
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-[var(--muted)] line-clamp-1 mt-0.5">
                          {card.source.cardBTr}
                        </span>
                      </div>
                    ) : hasImage ? (
                      <div className="flex-1 flex flex-col items-center justify-center w-full gap-1 min-h-0">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 shrink-0">
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
                        <span className="text-[10px] sm:text-xs font-extrabold text-[var(--foreground)] leading-tight line-clamp-2">
                          {card.source.cardBTr}
                        </span>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center w-full px-1 min-h-0">
                        <span className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] leading-snug line-clamp-3">
                          {card.source.cardBTr}
                        </span>
                      </div>
                    )}

                    <div className="h-0.5 w-full" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
