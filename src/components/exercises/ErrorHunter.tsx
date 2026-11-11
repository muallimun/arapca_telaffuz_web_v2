"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Timer,
  Trophy,
  Volume2,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import {
  diyalogGramerNotlari,
  diyaloglar,
  metinGramerNotlari,
  metinler,
} from "@/lib/data";
import type { GramerHapBilgi, Level } from "@/types/data";
import { speakHybrid, stopAllAudio } from "@/lib/audio";
import {
  fixArabicTypography,
  normalizeArabicText,
  simplifyGrammarTerminology,
  splitArabicSentenceWithTurkishNote,
} from "@/lib/arabicTextUtils";
import { MixedText } from "@/components/ui/MixedText";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import {
  playClick,
  playFanfare,
  playSuccess,
  playWrong,
} from "@/lib/sfxManager";

export interface ErrorHunterProps {
  cefrFilter?: "all" | Level;
  grammarFilter?: string;
  questionCount?: 10 | 20 | 30;
  timeLimit?: number | null;
  onClose?: () => void;
}

interface ErrorHunterItem {
  id: string;
  sourceId: string;
  level: Level;
  sourceTitleTr: string;
  konuBasligi: string;
  hapKural: string;
  wrongSentenceAr: string;
  correctSentenceAr: string;
  nedenTr: string;
  hasSingleSpanDiff: boolean;
  wrongTokens: string[];
  diffStart: number;
  diffEndExclusive: number;
  wrongSpanText: string;
  correctSpanText: string;
  repairOptions: string[];
}

function stripPunctuationEdge(token: string): {
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

function shuffleList<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Yanlış ve doğru Arapça cümleleri token bazında karşılaştırır.
 * Yalnızca 1 veya 2 ardışık kelimelik net bir fark varsa Adım 1 (Hatayı Yakala) açılır;
 * cümle dizilimi tamamen farklıysa doğrudan Adım 2'ye (Tamir Et) geçilir.
 */
function computeSpanDiff(
  wrongAr: string,
  correctAr: string
): {
  hasSingleSpanDiff: boolean;
  wrongTokens: string[];
  diffStart: number;
  diffEndExclusive: number;
  wrongSpanText: string;
  correctSpanText: string;
} {
  const wrongTokens = wrongAr
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const correctTokens = correctAr
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (wrongTokens.length < 2 || correctTokens.length < 2) {
    return {
      hasSingleSpanDiff: false,
      wrongTokens,
      diffStart: 0,
      diffEndExclusive: wrongTokens.length,
      wrongSpanText: wrongAr.trim(),
      correctSpanText: correctAr.trim(),
    };
  }

  const cleanToken = (t: string) => stripPunctuationEdge(t).core.trim();

  let prefixLen = 0;
  while (
    prefixLen < wrongTokens.length &&
    prefixLen < correctTokens.length &&
    cleanToken(wrongTokens[prefixLen]) === cleanToken(correctTokens[prefixLen])
  ) {
    prefixLen += 1;
  }

  let wrongEnd = wrongTokens.length;
  let correctEnd = correctTokens.length;
  while (
    wrongEnd > prefixLen &&
    correctEnd > prefixLen &&
    cleanToken(wrongTokens[wrongEnd - 1]) ===
      cleanToken(correctTokens[correctEnd - 1])
  ) {
    wrongEnd -= 1;
    correctEnd -= 1;
  }

  const wrongSpanCount = wrongEnd - prefixLen;
  const correctSpanCount = correctEnd - prefixLen;

  if (
    wrongSpanCount >= 1 &&
    wrongSpanCount <= 2 &&
    correctSpanCount >= 1 &&
    correctSpanCount <= 2 &&
    wrongSpanCount < wrongTokens.length
  ) {
    const wrongSpanText = wrongTokens
      .slice(prefixLen, wrongEnd)
      .map((t) => stripPunctuationEdge(t).core || t)
      .join(" ")
      .trim();
    const correctSpanText = correctTokens
      .slice(prefixLen, correctEnd)
      .map((t) => stripPunctuationEdge(t).core || t)
      .join(" ")
      .trim();

    if (wrongSpanText && correctSpanText && wrongSpanText !== correctSpanText) {
      return {
        hasSingleSpanDiff: true,
        wrongTokens,
        diffStart: prefixLen,
        diffEndExclusive: wrongEnd,
        wrongSpanText,
        correctSpanText,
      };
    }
  }

  return {
    hasSingleSpanDiff: false,
    wrongTokens,
    diffStart: 0,
    diffEndExclusive: wrongTokens.length,
    wrongSpanText: wrongAr.trim(),
    correctSpanText: correctAr.trim(),
  };
}

/**
 * Doğru onarım formundan türetilmiş gerçekçi hareke / sarf çeldiricileri üretir.
 */
function buildRealisticArabicMutations(
  correctForm: string,
  forbiddenSet: Set<string>,
  peerForms: string[]
): string[] {
  const candidates: string[] = [];
  const pushUnique = (val: string) => {
    const cleaned = val.trim();
    if (
      cleaned &&
      !forbiddenSet.has(cleaned) &&
      !candidates.includes(cleaned)
    ) {
      candidates.push(cleaned);
    }
  };

  const tokens = correctForm.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    const lastIdx = tokens.length - 1;
    const { leading, core, trailing } = stripPunctuationEdge(tokens[lastIdx]);

    if (core.length >= 2) {
      // 1. Son hareke / tenvin varyasyonları
      const stemNoFinalMark = core
        .replace(/ًا$/u, "")
        .replace(/[\u064B-\u0650\u0652]+$/u, "");

      const endings = [
        "\u064F", // damme
        "\u064E", // fetha
        "\u0650", // kesra
        "\u0652", // sükun
        "\u064C", // tenvin damme
        "\u064D", // tenvin kesra
        "ًا", // tenvin fetha
      ];

      for (const ending of endings) {
        if (
          ending === "ًا" &&
          (stemNoFinalMark.endsWith("ة") ||
            stemNoFinalMark.endsWith("ى") ||
            stemNoFinalMark.startsWith("ال") ||
            stemNoFinalMark.startsWith("اَل"))
        ) {
          const femTanwin = `${stemNoFinalMark}\u064B`;
          const rebuiltFem = [
            ...tokens.slice(0, lastIdx),
            `${leading}${femTanwin}${trailing}`,
          ].join(" ");
          pushUnique(rebuiltFem);
          continue;
        }
        if (
          (ending === "\u064C" || ending === "\u064D") &&
          (stemNoFinalMark.startsWith("ال") || stemNoFinalMark.startsWith("اَل"))
        ) {
          continue;
        }
        const mutatedWord = `${leading}${stemNoFinalMark}${ending}${trailing}`;
        const rebuilt = [...tokens.slice(0, lastIdx), mutatedWord].join(" ");
        pushUnique(rebuilt);
      }

      // 2. Müenneslik tâ'sı veya muzâri önek varyasyonu
      if (stemNoFinalMark.endsWith("ة")) {
        const droppedTa = `${leading}${stemNoFinalMark.slice(0, -1)}\u064C${trailing}`;
        pushUnique([...tokens.slice(0, lastIdx), droppedTa].join(" "));
      } else if (/^[يتأن][\u064E\u064F\u0650]/.test(core)) {
        const swappedPrefix = core.startsWith("ي")
          ? `ت${core.slice(1)}`
          : core.startsWith("ت")
          ? `ي${core.slice(1)}`
          : `ن${core.slice(1)}`;
        pushUnique(
          [...tokens.slice(0, lastIdx), `${leading}${swappedPrefix}${trailing}`].join(
            " "
          )
        );
      }
    }

    // Birden fazla kelimeli öbek/cümle ise ilk kelimenin de harekesini/öneğini değiştir
    if (tokens.length >= 2 && candidates.length < 4) {
      const firstParts = stripPunctuationEdge(tokens[0]);
      const firstStem = firstParts.core.replace(/[\u064B-\u0650\u0652]+$/u, "");
      if (firstStem.length >= 2) {
        for (const mark of ["\u064E", "\u064F", "\u0650", "\u0652"]) {
          const rebuiltFirst = [
            `${firstParts.leading}${firstStem}${mark}${firstParts.trailing}`,
            ...tokens.slice(1),
          ].join(" ");
          pushUnique(rebuiltFirst);
        }
      }
    }
  }

  for (const peer of peerForms) {
    if (candidates.length >= 5) break;
    pushUnique(peer);
  }

  return candidates.slice(0, 3);
}

function buildErrorHunterCatalog(): Omit<ErrorHunterItem, "repairOptions">[] {
  const dlgMap = new Map(diyaloglar.map((d) => [d.id, d]));
  const metinMap = new Map(metinler.map((m) => [m.id, m]));

  const combined: Array<{
    note: GramerHapBilgi;
    level: Level;
    sourceTitleTr: string;
  }> = [];

  for (const note of diyalogGramerNotlari) {
    if (!note.ayrintili_anlatim?.dikkat_sik_hata) continue;
    const dlg = dlgMap.get(note.bagli_id);
    combined.push({
      note,
      level: dlg?.seviye || "A1",
      sourceTitleTr: dlg?.baslik_tr || note.bagli_id,
    });
  }

  for (const note of metinGramerNotlari) {
    if (!note.ayrintili_anlatim?.dikkat_sik_hata) continue;
    const txt = metinMap.get(note.bagli_id);
    combined.push({
      note,
      level: txt?.seviye || "A2",
      sourceTitleTr: txt?.baslik_tr || note.bagli_id,
    });
  }

  const out: Omit<ErrorHunterItem, "repairOptions">[] = [];

  for (const { note, level, sourceTitleTr } of combined) {
    const dsh = note.ayrintili_anlatim?.dikkat_sik_hata;
    if (!dsh?.yanlis || !dsh?.dogru) continue;

    // Soru anında parantez içi Türkçe açıklama ipucunu gizle
    const cleanWrong = splitArabicSentenceWithTurkishNote(dsh.yanlis).arabicPart.trim();
    const rawPrimaryDogru = dsh.dogru.split("/")[0]?.trim() || dsh.dogru.trim();
    const cleanCorrect = splitArabicSentenceWithTurkishNote(
      rawPrimaryDogru
    ).arabicPart.trim();

    if (!cleanWrong || !cleanCorrect || cleanWrong === cleanCorrect) continue;

    const spanDiff = computeSpanDiff(cleanWrong, cleanCorrect);
    out.push({
      id: `errhunt_${note.bagli_id}`,
      sourceId: note.bagli_id,
      level,
      sourceTitleTr,
      konuBasligi: note.konu_basligi,
      hapKural: note.hap_kural,
      wrongSentenceAr: cleanWrong,
      correctSentenceAr: cleanCorrect,
      nedenTr: dsh.neden,
      ...spanDiff,
    });
  }

  return out;
}

export default function ErrorHunter({
  cefrFilter = "all",
  grammarFilter = "all",
  questionCount = 10,
  timeLimit = null,
  onClose,
}: ErrorHunterProps) {
  const { arabicFont, speechRate, grammarDepthMode } = useSettings();
  const {
    recordSkillAttempt,
    recordItemAttempt,
    addMistake,
    addStudyMinutes,
  } = useUserStore();

  const [roundSeed, setRoundSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<"spot" | "repair" | "repaired">("spot");
  const [spotWrongIndices, setSpotWrongIndices] = useState<number[]>([]);
  const [wrongRepairChoices, setWrongRepairChoices] = useState<string[]>([]);
  const [selectedRepair, setSelectedRepair] = useState<string | null>(null);
  const [hadAnyMistakeOnCurrent, setHadAnyMistakeOnCurrent] = useState(false);
  const [streak, setStreak] = useState(0);
  const [correctFirstTryCount, setCorrectFirstTryCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    timeLimit
  );

  const audioDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const baseCatalog = useMemo(() => buildErrorHunterCatalog(), []);

  const sessionQuestions: ErrorHunterItem[] = useMemo(() => {
    void roundSeed;
    let pool =
      cefrFilter === "all"
        ? baseCatalog
        : baseCatalog.filter((item) => item.level === cefrFilter);
    if (pool.length === 0) pool = baseCatalog;

    let prioritized: typeof baseCatalog = [];
    if (grammarFilter && grammarFilter !== "all") {
      const normQuery = grammarFilter
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/\u0307/g, "");
      const normQueryAr = normalizeArabicText(grammarFilter);
      prioritized = pool.filter((it) => {
        const titleLower = it.konuBasligi
          .toLocaleLowerCase("tr-TR")
          .replace(/\u0307/g, "");
        return (
          titleLower.includes(normQuery) ||
          normQuery.includes(titleLower) ||
          (normQueryAr.length >= 2 &&
            normalizeArabicText(it.konuBasligi).includes(normQueryAr))
        );
      });
    }

    const rest = shuffleList(
      pool.filter((it) => !prioritized.some((p) => p.id === it.id))
    );
    const ordered = [...shuffleList(prioritized), ...rest].slice(
      0,
      Math.min(questionCount, pool.length)
    );

    const spanPeersByLevel = new Map<Level, string[]>();
    const sentPeersByLevel = new Map<Level, string[]>();
    for (const item of baseCatalog) {
      if (item.hasSingleSpanDiff) {
        const list = spanPeersByLevel.get(item.level) || [];
        list.push(item.correctSpanText);
        spanPeersByLevel.set(item.level, list);
      } else {
        const list = sentPeersByLevel.get(item.level) || [];
        list.push(item.correctSentenceAr);
        sentPeersByLevel.set(item.level, list);
      }
    }

    return ordered.map((item) => {
      const targetText = item.hasSingleSpanDiff
        ? item.correctSpanText
        : item.correctSentenceAr;
      const forbidden = new Set<string>([
        targetText.trim(),
        item.wrongSpanText.trim(),
        item.wrongSentenceAr.trim(),
        item.correctSentenceAr.trim(),
      ]);
      // Yanlış formun kendisini de gerçekçi çeldiricilerden biri olarak ekleyebiliriz
      // ancak öğrenci zaten onu hatalı bildiği için 3 taze çeldirici üretelim:
      const peers = shuffleList(
        (item.hasSingleSpanDiff
          ? spanPeersByLevel.get(item.level)
          : sentPeersByLevel.get(item.level)) || []
      );
      const distractors = buildRealisticArabicMutations(
        targetText,
        forbidden,
        peers
      );
      // Eğer çok kısa kelimede 3 varyasyon çıkmadıysa yanlış formu 3. çeldirici olarak tamamla
      if (
        distractors.length < 3 &&
        item.wrongSpanText.trim() !== targetText.trim() &&
        !distractors.includes(item.wrongSpanText.trim())
      ) {
        distractors.push(item.wrongSpanText.trim());
      }
      const options = shuffleList([targetText.trim(), ...distractors.slice(0, 3)]);
      return {
        ...item,
        repairOptions: options,
      };
    });
  }, [baseCatalog, cefrFilter, grammarFilter, questionCount, roundSeed]);

  const currentItem = sessionQuestions[currentIndex] || null;

  const resetForQuestion = useCallback((item: ErrorHunterItem | null) => {
    if (audioDelayTimerRef.current) {
      clearTimeout(audioDelayTimerRef.current);
      audioDelayTimerRef.current = null;
    }
    stopAllAudio();
    setSpotWrongIndices([]);
    setWrongRepairChoices([]);
    setSelectedRepair(null);
    setHadAnyMistakeOnCurrent(false);
    setIsPlayingAudio(false);
    setStage(item?.hasSingleSpanDiff ? "spot" : "repair");
    setRemainingSeconds(timeLimit);
  }, [timeLimit]);

  useEffect(() => {
    return () => {
      if (audioDelayTimerRef.current) {
        clearTimeout(audioDelayTimerRef.current);
      }
      stopAllAudio();
    };
  }, []);

  // Süre sayacı (isteğe bağlı timeLimit aktifse)
  useEffect(() => {
    if (
      !timeLimit ||
      isCompleted ||
      stage === "repaired" ||
      remainingSeconds === null ||
      remainingSeconds <= 0
    ) {
      return;
    }
    const t = setTimeout(() => {
      if (remainingSeconds <= 1) {
        setRemainingSeconds(0);
        if (currentItem) {
          void playWrong();
          recordSkillAttempt("gramer", false);
          recordItemAttempt(
            currentItem.sourceId,
            "sentence",
            false,
            false,
            20,
            "Hata Avcısı: Süre doldu"
          );
          addMistake(currentItem.sourceId);
          setStreak(0);
          setHadAnyMistakeOnCurrent(true);
          setStage("repaired");
        }
      } else {
        setRemainingSeconds((prev) => (prev !== null ? prev - 1 : null));
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [
    addMistake,
    currentItem,
    isCompleted,
    recordItemAttempt,
    recordSkillAttempt,
    remainingSeconds,
    stage,
    timeLimit,
  ]);

  const playSentenceAudio = useCallback(
    async (arabicText: string) => {
      setIsPlayingAudio(true);
      try {
        await speakHybrid({ text: arabicText, rate: speechRate });
      } finally {
        setIsPlayingAudio(false);
      }
    },
    [speechRate]
  );

  const handleTokenTap = (tokenIdx: number) => {
    if (!currentItem || stage !== "spot") return;

    const isInsideErrorSpan =
      tokenIdx >= currentItem.diffStart &&
      tokenIdx < currentItem.diffEndExclusive;

    if (isInsideErrorSpan) {
      playClick();
      setStage("repair");
      return;
    }

    setHadAnyMistakeOnCurrent(true);
    if (!spotWrongIndices.includes(tokenIdx)) {
      const nextWrong = [...spotWrongIndices, tokenIdx];
      setSpotWrongIndices(nextWrong);
      void playWrong();
      // 2 kez yanlış kelimeye dokunulursa öğrenciyi yormadan hatalı bölgeyi açıp Adım 2'ye geçir
      if (nextWrong.length >= 2) {
        setTimeout(() => {
          setStage("repair");
        }, 450);
      }
    } else {
      playClick();
    }
  };

  const handleSelectRepairOption = async (optionText: string) => {
    if (!currentItem || stage !== "repair") return;

    const expected = currentItem.hasSingleSpanDiff
      ? currentItem.correctSpanText.trim()
      : currentItem.correctSentenceAr.trim();

    if (optionText.trim() === expected) {
      const cleanFirstTry = !hadAnyMistakeOnCurrent && wrongRepairChoices.length === 0;
      const nextStreak = cleanFirstTry ? streak + 1 : 1;
      setSelectedRepair(optionText);
      setStage("repaired");
      setStreak(nextStreak);
      if (cleanFirstTry) {
        setCorrectFirstTryCount((c) => c + 1);
      }

      recordSkillAttempt("gramer", cleanFirstTry);
      recordItemAttempt(
        currentItem.sourceId,
        "sentence",
        cleanFirstTry,
        false,
        cleanFirstTry ? 100 : 65,
        "Hata Avcısı"
      );
      if (!cleanFirstTry) {
        addMistake(currentItem.sourceId);
      }

      await playSuccess({ streak: nextStreak });
      audioDelayTimerRef.current = setTimeout(() => {
        void playSentenceAudio(currentItem.correctSentenceAr);
      }, 250);
      return;
    }

    // Yanlış tamir şıkkı
    setHadAnyMistakeOnCurrent(true);
    setStreak(0);
    if (!wrongRepairChoices.includes(optionText)) {
      setWrongRepairChoices((prev) => [...prev, optionText]);
    }
    await playWrong();
  };

  const handleNext = () => {
    playClick();
    if (currentIndex + 1 < sessionQuestions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      resetForQuestion(sessionQuestions[nextIdx] || null);
    } else {
      stopAllAudio();
      addStudyMinutes(2);
      const pct =
        sessionQuestions.length > 0
          ? Math.round((correctFirstTryCount / sessionQuestions.length) * 100)
          : 100;
      void playFanfare(pct);
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    playClick();
    const nextSeed = roundSeed + 1;
    setRoundSeed(nextSeed);
    setCurrentIndex(0);
    setCorrectFirstTryCount(0);
    setStreak(0);
    setIsCompleted(false);
    setTimeout(() => {
      setStage("spot");
      setSpotWrongIndices([]);
      setWrongRepairChoices([]);
      setSelectedRepair(null);
      setHadAnyMistakeOnCurrent(false);
      setRemainingSeconds(timeLimit);
    }, 0);
  };

  // İlk soru yüklendiğinde stage senkronizasyonu
  const effectiveStage =
    stage === "spot" && currentItem && !currentItem.hasSingleSpanDiff
      ? "repair"
      : stage;

  const formatExplanation = (txt: string) =>
    grammarDepthMode === "simple" ? simplifyGrammarTerminology(txt) : txt;

  if (sessionQuestions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 text-center space-y-4">
        <p className="text-sm font-bold text-[var(--foreground)]">
          Bu filtre için uygun Hata Avcısı sorusu bulunamadı.
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold cursor-pointer"
          >
            Alıştırma Merkezine Dön
          </button>
        )}
      </div>
    );
  }

  if (isCompleted) {
    const accuracy = Math.round(
      (correctFirstTryCount / sessionQuestions.length) * 100
    );
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-6 sm:p-8 text-center space-y-5 shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-400 flex items-center justify-center text-[#087F5B] dark:text-emerald-300">
          <Trophy size={32} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-[var(--foreground)]">
            Hata Avcısı Tamamlandı!
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
            {sessionQuestions.length} hatalı cümleyi başarıyla onardınız · İlk deneme isabeti:{" "}
            <strong className="text-[#087F5B] dark:text-emerald-400 tabular-nums">
              %{accuracy} ({correctFirstTryCount}/{sessionQuestions.length})
            </strong>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRestart}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCcw size={16} />
            <span>Yeni Setle Tekrar Oyna</span>
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

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Üst İlerleme Çubuğu */}
      <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
          <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Hata Avcısı</span>
          <span aria-hidden="true" className="text-[var(--muted)]">·</span>
          <span className="tabular-nums text-[#087F5B] dark:text-emerald-400">
            Soru {currentIndex + 1} / {sessionQuestions.length}
          </span>
          <span aria-hidden="true" className="text-[var(--muted)]">·</span>
          <span className="text-[var(--muted)]">Seviye {currentItem.level}</span>
        </div>

        <div className="flex items-center gap-3 text-xs font-extrabold">
          {streak >= 2 && (
            <span className="text-amber-700 dark:text-amber-300 tabular-nums">
              Seri: {streak}x
            </span>
          )}
          {remainingSeconds !== null && (
            <span
              className={`inline-flex items-center gap-1 tabular-nums ${
                remainingSeconds <= 10
                  ? "text-rose-600 dark:text-rose-400 font-black"
                  : "text-[var(--foreground)]"
              }`}
            >
              <Timer size={14} />
              <span>{remainingSeconds}s</span>
            </span>
          )}
        </div>
      </div>

      {/* Ana Çalışma Sahnesi */}
      <div className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] p-4 sm:p-7 space-y-5 shadow-xs">
        {/* Aşama Göstergesi */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E6D7BE]/70 dark:border-[var(--border)]">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold">
            {effectiveStage === "spot" && (
              <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                <AlertTriangle size={16} className="shrink-0" />
                <span>Adım 1/2: Cümledeki hatalı kelimeye dokunun</span>
              </span>
            )}
            {effectiveStage === "repair" && (
              <span className="inline-flex items-center gap-1.5 text-[#6741D9] dark:text-indigo-300">
                <Wrench size={16} className="shrink-0" />
                <span>
                  {currentItem.hasSingleSpanDiff
                    ? "Adım 2/2: Hatalı ifadeyi doğru formla tamir edin"
                    : "Cümlenin dilbilgisi açısından doğru biçimini seçin"}
                </span>
              </span>
            )}
            {effectiveStage === "repaired" && (
              <span className="inline-flex items-center gap-1.5 text-[#087F5B] dark:text-emerald-400">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>Cümle başarıyla tamir edildi!</span>
              </span>
            )}
          </div>

          <span className="text-xs font-semibold text-[var(--muted)]">
            Kaynak: {currentItem.sourceTitleTr}
          </span>
        </div>

        {/* ADIM 1 VE ADIM 2 SIRASINDA CÜMLE SAHNESİ */}
        {effectiveStage !== "repaired" ? (
          <div className="rounded-2xl bg-rose-50/70 dark:bg-rose-950/25 border-2 border-rose-200 dark:border-rose-800/70 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-rose-800 dark:text-rose-300">
              <span>Onarılacak Hatalı Cümle</span>
              {effectiveStage === "spot" && spotWrongIndices.length > 0 && (
                <span>Bu kelimede hata yok, diğer kelimeleri inceleyin</span>
              )}
            </div>

            {currentItem.hasSingleSpanDiff ? (
              <div
                dir="rtl"
                lang="ar"
                className="flex flex-wrap items-center justify-start gap-2.5 sm:gap-3 leading-[1.95]"
              >
                {currentItem.wrongTokens.map((tok, idx) => {
                  const isErrorPart =
                    idx >= currentItem.diffStart &&
                    idx < currentItem.diffEndExclusive;
                  const wasTappedWrong = spotWrongIndices.includes(idx);

                  if (effectiveStage === "spot") {
                    return (
                      <button
                        key={`${tok}-${idx}`}
                        type="button"
                        onClick={() => handleTokenTap(idx)}
                        className={`min-h-[48px] px-3.5 sm:px-4 py-2 rounded-2xl border-2 border-b-4 arabic font-arabic text-2xl sm:text-3xl font-bold leading-[1.95] transition-all cursor-pointer ${
                          wasTappedWrong
                            ? "bg-slate-100 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                            : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-rose-500 text-[var(--foreground)] active:translate-y-0.5"
                        }`}
                      >
                        {fixArabicTypography(tok, arabicFont)}
                      </button>
                    );
                  }

                  // Adım 2'de hatalı öbeği belirgin kırmızı çerçeveyle göster
                  return (
                    <span
                      key={`${tok}-${idx}`}
                      className={`min-h-[48px] inline-flex items-center px-3.5 py-1.5 rounded-2xl arabic font-arabic text-2xl sm:text-3xl font-bold leading-[1.95] ${
                        isErrorPart
                          ? "bg-rose-100 dark:bg-rose-950/80 border-2 border-dashed border-rose-500 text-rose-800 dark:text-rose-200 line-through decoration-rose-500/80"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {fixArabicTypography(tok, arabicFont)}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p
                dir="rtl"
                lang="ar"
                className="arabic font-arabic text-2xl sm:text-3xl font-bold text-rose-900 dark:text-rose-200 text-right leading-[1.95] break-words"
              >
                {fixArabicTypography(currentItem.wrongSentenceAr, arabicFont)}
              </p>
            )}
          </div>
        ) : (
          /* FINAL ONARILMIŞ DOĞRU CÜMLE KARTI (Asla yanlış cümle tek başına kalmaz!) */
          <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/35 border-2 border-emerald-400 dark:border-emerald-600 p-4 sm:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-[#065F46] dark:text-emerald-300">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>Tamir Edilmiş Doğru Cümle</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  void playSentenceAudio(currentItem.correctSentenceAr);
                }}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Volume2 size={16} className="shrink-0" />
                <span>
                  {isPlayingAudio ? "Dinleniyor..." : "🔊 Doğrusunu Dinle"}
                </span>
              </button>
            </div>

            <p
              dir="rtl"
              lang="ar"
              className="arabic font-arabic text-2xl sm:text-4xl font-bold text-[#065F46] dark:text-emerald-300 text-right leading-[1.95] break-words"
            >
              {fixArabicTypography(currentItem.correctSentenceAr, arabicFont)}
            </p>

            <div className="pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>Hatalı kullanım onarıldı:</span>
              <span
                dir="rtl"
                lang="ar"
                className="arabic font-arabic text-lg font-bold text-rose-700/80 dark:text-rose-300/80 line-through leading-[1.95]"
              >
                {fixArabicTypography(
                  currentItem.hasSingleSpanDiff
                    ? currentItem.wrongSpanText
                    : currentItem.wrongSentenceAr,
                  arabicFont
                )}
              </span>
            </div>
          </div>
        )}

        {/* ADIM 2: 4 ŞIKLI TAMİR SEÇENEKLERİ */}
        {effectiveStage === "repair" && (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
              {currentItem.hasSingleSpanDiff
                ? "Altı çizili hatalı kelimenin yerine gelmesi gereken doğru formu seçin:"
                : "Hatalı cümlenin doğru kurulmuş biçimini seçin:"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentItem.repairOptions.map((opt, idx) => {
                const isEliminated = wrongRepairChoices.includes(opt);
                const isSelectedRight = selectedRepair === opt;
                return (
                  <button
                    key={`${opt}-${idx}`}
                    type="button"
                    disabled={isEliminated}
                    onClick={() => void handleSelectRepairOption(opt)}
                    className={`min-h-[56px] px-4 py-3 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-3 transition-all ${
                      isSelectedRight
                        ? "bg-emerald-100 dark:bg-emerald-950/70 border-emerald-500 text-[#065F46] dark:text-emerald-200"
                        : isEliminated
                        ? "opacity-45 bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 cursor-not-allowed"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] text-[var(--foreground)] active:translate-y-0.5 cursor-pointer"
                    }`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-black text-[var(--muted)] flex items-center justify-center shrink-0">
                      {["A", "B", "C", "D"][idx] || idx + 1}
                    </span>
                    <span
                      dir="rtl"
                      lang="ar"
                      className="arabic font-arabic text-2xl sm:text-3xl font-bold text-right leading-[1.95] flex-1 break-words"
                    >
                      {fixArabicTypography(opt, arabicFont)}
                    </span>
                    {isEliminated && (
                      <XCircle size={18} className="text-rose-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ONARIM SONRASI NEDEN & HAP BİLGİ KARTI */}
        {effectiveStage === "repaired" && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-700 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-amber-900 dark:text-amber-300">
                <Lightbulb size={16} className="shrink-0" />
                <span>Neden Bu Şekilde Onarıldı?</span>
              </div>
              <MixedText
                mode="block"
                text={formatExplanation(currentItem.nedenTr)}
                className="text-xs sm:text-sm font-semibold text-amber-950 dark:text-amber-100 leading-relaxed"
              />
            </div>

            <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#6741D9] dark:text-indigo-300">
                <BookOpen size={15} className="shrink-0" />
                <MixedText text={formatExplanation(currentItem.konuBasligi)} />
              </div>
              <MixedText
                mode="block"
                text={formatExplanation(currentItem.hapKural)}
                className="text-xs font-medium text-[var(--muted)] leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {currentIndex + 1 < sessionQuestions.length
                    ? "Sonraki Cümleye Geç"
                    : "Sonuçları Gör"}
                </span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Adım 1'de takılanlar için doğrudan Tamir adımına geçme yardımcısı */}
        {effectiveStage === "spot" && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-[var(--muted)] inline-flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-600 shrink-0" />
              <span>İpucu: Hareke, cinsiyet veya edat uyumunu kontrol edin.</span>
            </span>
            <button
              type="button"
              onClick={() => {
                playClick();
                setHadAnyMistakeOnCurrent(true);
                setStage("repair");
              }}
              className="min-h-[48px] px-3.5 py-2 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[#6741D9] dark:text-indigo-300 hover:border-[#6741D9] cursor-pointer shrink-0"
            >
              Hatayı Göster
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
