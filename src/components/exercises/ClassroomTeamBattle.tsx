"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Dialogue,
  DictionaryItem,
  Level,
  ResimliKelime,
} from "@/types/data";
import { ArabicIdiom } from "@/lib/arabicIdioms";
import {
  gorselKelimeler,
  sozluk,
  atasozleri,
  cumleler1111,
} from "@/lib/data";
import {
  shuffleArray,
  stripParentheticalArabicExamples,
} from "@/lib/quiz";
import { MixedText } from "@/components/ui/MixedText";
import { hasLatinCharacters } from "@/lib/arabicTextUtils";
import {
  playClick,
  playStart,
  playCorrect,
  playWrong,
  playFanfare,
  stopAllSfx,
} from "@/lib/sfxManager";
import {
  playDualGenderAudio,
  speakHybrid,
  stopAllAudio,
} from "@/lib/audio";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import {
  Trophy,
  Flame,
  Volume2,
  Timer,
  Zap,
  RefreshCcw,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Settings2,
  Play,
  Users,
  Crown,
  Download,
  Printer,
} from "lucide-react";

export type BattlePlayMode = "simultaneous" | "turn_based";
export type BattleQuestionFocus =
  | "mixed"
  | "ar_to_tr"
  | "visual_to_ar"
  | "root_and_plural";

interface BattleOption {
  id: string;
  arabic: string;
  turkish: string;
  metaNote?: string;
  isCorrect: boolean;
}

interface BattleQuestion {
  id: string;
  categoryBadge: string;
  promptTypeLabel: string;
  promptArabic?: string;
  promptTurkish?: string;
  imageUrl?: string;
  audioSpec?: {
    text: string;
    id?: string;
    ses_erkek?: string;
    ses_kadin?: string;
  };
  primaryDisplayField: "arabic" | "turkish";
  options: BattleOption[];
}

interface ClassroomTeamBattleProps {
  vocabulary?: DictionaryItem[];
  idioms?: ArabicIdiom[];
  dialogues?: Dialogue[];
  visualPool?: ResimliKelime[];
  cefrFilter?: "all" | Level;
  questionCount?: number;
  timeLimit?: number | null;
  onClose?: () => void;
}

interface BattleRoundSummary {
  roundNumber: number;
  categoryBadge: string;
  promptTypeLabel: string;
  targetArabic: string;
  targetTurkish: string;
  metaNote?: string;
  winner: "A" | "B" | "none";
  hadWrongAttempt: boolean;
}

function escapePrintHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRootDisplay(rawRoot?: string): string {
  if (!rawRoot || rawRoot === "-") return "";
  const letters = (rawRoot.match(/[\u0621-\u064A]/g) || []).join(" - ");
  return letters || "";
}

export default function ClassroomTeamBattle({
  vocabulary = [],
  idioms = [],
  dialogues: _dialogues = [],
  visualPool = [],
  cefrFilter = "all",
  questionCount = 10,
  timeLimit = null,
  onClose,
}: ClassroomTeamBattleProps) {
  const { preferredVoiceGender, speechRate } = useSettings();
  const { addStudyMinutes } = useUserStore();

  // Takım Ayarları ve Kurulum State'i
  const [teamAName, setTeamAName] = useState<string>("A Takımı (1. Grup)");
  const [teamBName, setTeamBName] = useState<string>("B Takımı (2. Grup)");
  const [playMode, setPlayMode] = useState<BattlePlayMode>("simultaneous");
  const [questionFocus, setQuestionFocus] =
    useState<BattleQuestionFocus>("mixed");
  const [showSetupBar, setShowSetupBar] = useState<boolean>(false);

  // Yarışma Durumu State'leri
  const [sessionSeed, setSessionSeed] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [teamAScore, setTeamAScore] = useState<number>(0);
  const [teamBScore, setTeamBScore] = useState<number>(0);
  const [teamAStreak, setTeamAStreak] = useState<number>(0);
  const [teamBStreak, setTeamBStreak] = useState<number>(0);
  const [teamABestStreak, setTeamABestStreak] = useState<number>(0);
  const [teamBBestStreak, setTeamBBestStreak] = useState<number>(0);

  // Her soru için takımların seçimleri ve turun kilit durumu
  const [teamAChoiceId, setTeamAChoiceId] = useState<string | null>(null);
  const [teamBChoiceId, setTeamBChoiceId] = useState<string | null>(null);
  const [roundWinner, setRoundWinner] = useState<"A" | "B" | "none" | null>(
    null
  );
  const [roundHistory, setRoundHistory] = useState<BattleRoundSummary[]>([]);
  const [matchDurationSec, setMatchDurationSec] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Soru başına geri sayım (Süresiz seçildiğinde timeLimit === null veya 0 olur)
  const isUnlimitedTime = timeLimit === null || timeLimit === 0;
  const perQuestionSeconds = isUnlimitedTime ? 0 : timeLimit;
  const [questionTimer, setQuestionTimer] =
    useState<number>(perQuestionSeconds);

  const fanfarePlayedRef = useRef(false);
  const battleStartedAtRef = useRef<number>(0);
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Yarışma başlangıcında sfx.playStart() ve başlangıç zaman damgası
  useEffect(() => {
    battleStartedAtRef.current = Date.now();
    void playStart();
    return () => {
      stopAllAudio();
      stopAllSfx();
    };
  }, []);

  // Seçili havuzdan zengin soru bankası üretimi
  const battleQuestions: BattleQuestion[] = useMemo(() => {
    void sessionSeed;
    const total = Math.max(4, questionCount);
    const generated: BattleQuestion[] = [];

    // 1. Görsel Kelime Adayları
    const baseVisual =
      visualPool && visualPool.length >= 4 ? visualPool : gorselKelimeler;
    const levelVisual =
      cefrFilter === "all"
        ? baseVisual
        : baseVisual.filter((gk) => gk.cefr === cefrFilter);
    const activeVisualList = shuffleArray(
      levelVisual.length >= 4 ? [...levelVisual] : [...baseVisual]
    );

    // 2. Kelime/Sözlük Adayları
    const baseVocab = vocabulary && vocabulary.length >= 4 ? vocabulary : sozluk;
    const activeVocabList = shuffleArray([...baseVocab]);

    // 3. Atasözü ve Cümle Adayları
    const activeProverbs = shuffleArray([...atasozleri]);
    const activeSentences = shuffleArray([...cumleler1111]);

    // A) Görsel <-> Arapça Soruları
    const buildVisualQuestion = (gk: ResimliKelime): BattleQuestion | null => {
      const distractors = shuffleArray(
        activeVisualList.filter(
          (other) => other.id !== gk.id && other.arapca !== gk.arapca
        )
      ).slice(0, 3);
      if (distractors.length < 3) return null;

      const options: BattleOption[] = shuffleArray([
        {
          id: gk.id,
          arabic: gk.arapca,
          turkish: gk.turkce,
          metaNote:
            gk.ikincil_form && gk.ikincil_form !== "-"
              ? `Çoğul/Muzâri: ${gk.ikincil_form}`
              : undefined,
          isCorrect: true,
        },
        ...distractors.map((d) => ({
          id: d.id,
          arabic: d.arapca,
          turkish: d.turkce,
          metaNote:
            d.ikincil_form && d.ikincil_form !== "-"
              ? `Çoğul/Muzâri: ${d.ikincil_form}`
              : undefined,
          isCorrect: false,
        })),
      ]);

      return {
        id: `battle_vis_${gk.id}`,
        categoryBadge: "🖼️ Görsel ↔ Arapça",
        promptTypeLabel:
          gk.soru_kalibi && gk.soru_kalibi !== "-"
            ? `${gk.soru_kalibi} — Görseldeki kavramın Arapça karşılığı hangisidir?`
            : "Görseldeki kavramın Arapça karşılığı hangisidir?",
        promptTurkish: gk.turkce,
        imageUrl: gk.gorsel,
        audioSpec: {
          text: gk.arapca,
          id: gk.id,
          ses_erkek: gk.ses_erkek,
          ses_kadin: gk.ses_kadin,
        },
        primaryDisplayField: "arabic",
        options,
      };
    };

    // B) Arapça <-> Türkçe Anlam Soruları (Sözlük, Diyalog, Cümle, Atasözü)
    const buildArToTrQuestion = (idx: number): BattleQuestion | null => {
      if (idx % 3 === 1 && idioms.length >= 4) {
        const targetIdiom = idioms[idx % idioms.length];
        const distractors = shuffleArray(
          idioms.filter((i) => i.id !== targetIdiom.id)
        ).slice(0, 3);
        if (distractors.length >= 3) {
          return {
            id: `battle_idiom_${targetIdiom.id}_${idx}`,
            categoryBadge: "📜 Atasözü & Kalıp İfade",
            promptTypeLabel:
              "Bu Arapça atasözü / kalıp ifadenin Türkçe anlamı hangisidir?",
            promptArabic: targetIdiom.arabic,
            audioSpec: {
              text: targetIdiom.arabic,
              id: targetIdiom.id,
            },
            primaryDisplayField: "turkish",
            options: shuffleArray([
              {
                id: targetIdiom.id,
                arabic: targetIdiom.arabic,
                turkish: targetIdiom.meaningTr,
                isCorrect: true,
              },
              ...distractors.map((d) => ({
                id: d.id,
                arabic: d.arabic,
                turkish: d.meaningTr,
                isCorrect: false,
              })),
            ]),
          };
        }
      }

      if (idx % 3 === 2 && activeSentences.length >= 4) {
        const targetSent = activeSentences[idx % activeSentences.length];
        const distractors = shuffleArray(
          activeSentences.filter((s) => s.id !== targetSent.id)
        ).slice(0, 3);
        if (distractors.length >= 3) {
          return {
            id: `battle_sent_${targetSent.id}_${idx}`,
            categoryBadge: `🗣️ Günlük Cümle (${targetSent.seviye})`,
            promptTypeLabel: "Bu Arapça cümlenin Türkçe anlamı hangisidir?",
            promptArabic: targetSent.arapca,
            audioSpec: {
              text: targetSent.arapca,
              id: targetSent.id,
              ses_erkek: targetSent.ses_erkek,
              ses_kadin: targetSent.ses_kadin,
            },
            primaryDisplayField: "turkish",
            options: shuffleArray([
              {
                id: targetSent.id,
                arabic: targetSent.arapca,
                turkish: targetSent.turkce,
                metaNote: targetSent.odak_kalip,
                isCorrect: true,
              },
              ...distractors.map((d) => ({
                id: d.id,
                arabic: d.arapca,
                turkish: d.turkce,
                metaNote: d.odak_kalip,
                isCorrect: false,
              })),
            ]),
          };
        }
      }

      const w = activeVocabList[idx % activeVocabList.length];
      if (!w) return null;
      const wAr = w.mufret || w.mazi || "";
      if (!wAr || !w.anlam_tr) return null;

      const distractors = shuffleArray(
        activeVocabList.filter(
          (other) =>
            other.id !== w.id &&
            Boolean(other.mufret || other.mazi) &&
            other.anlam_tr !== w.anlam_tr
        )
      ).slice(0, 3);
      if (distractors.length < 3) return null;

      return {
        id: `battle_voc_${w.id}_${idx}`,
        categoryBadge: "🔤 Arapça ↔ Türkçe",
        promptTypeLabel: "Verilen Arapça kelimenin Türkçe karşılığı hangisidir?",
        promptArabic: wAr,
        imageUrl: w.gorsel,
        audioSpec: {
          text: wAr,
          id: w.id,
          ses_erkek: w.ses_erkek,
          ses_kadin: w.ses_kadin,
        },
        primaryDisplayField: "turkish",
        options: shuffleArray([
          {
            id: w.id,
            arabic: wAr,
            turkish: w.anlam_tr,
            metaNote: formatRootDisplay(w.kok)
              ? `Kök: ${formatRootDisplay(w.kok)}`
              : undefined,
            isCorrect: true,
          },
          ...distractors.map((d) => ({
            id: d.id,
            arabic: d.mufret || d.mazi || "",
            turkish: d.anlam_tr,
            metaNote: formatRootDisplay(d.kok)
              ? `Kök: ${formatRootDisplay(d.kok)}`
              : undefined,
            isCorrect: false,
          })),
        ]),
      };
    };

    // C) Kök & Çoğul / Muzâri (Sarf) Soruları
    const buildRootAndPluralQuestion = (
      gk: ResimliKelime,
      idx: number
    ): BattleQuestion | null => {
      const hasMorph =
        gk.ikincil_form &&
        gk.ikincil_form.trim().length > 0 &&
        gk.ikincil_form !== "-";
      const rootDisp = formatRootDisplay(gk.kok);

      if (hasMorph && idx % 2 === 0) {
        const isVerb = (gk.tur || "").toLowerCase() === "fiil";
        const distractors = shuffleArray(
          activeVisualList.filter(
            (other) =>
              other.id !== gk.id &&
              other.ikincil_form &&
              other.ikincil_form !== "-" &&
              other.ikincil_form !== gk.ikincil_form
          )
        ).slice(0, 3);

        if (distractors.length >= 3) {
          return {
            id: `battle_morph_${gk.id}_${idx}`,
            categoryBadge: isVerb
              ? "🔄 Mâzî ➔ Muzâri"
              : "🔄 Müfret ➔ Cemî (Çoğul)",
            promptTypeLabel: isVerb
              ? `"${gk.turkce}" fiilinin Muzâri (Şimdiki/Geniş Zaman) formu hangisidir?`
              : `"${gk.turkce}" isminin Cemî (Çoğul) formu hangisidir?`,
            promptArabic: gk.arapca,
            promptTurkish: gk.turkce,
            imageUrl: gk.gorsel,
            audioSpec: {
              text: gk.arapca,
              id: gk.id,
              ses_erkek: gk.ses_erkek,
              ses_kadin: gk.ses_kadin,
            },
            primaryDisplayField: "arabic",
            options: shuffleArray([
              {
                id: gk.id,
                arabic: gk.ikincil_form,
                turkish: `${gk.turkce} (${gk.arapca} ➔ ${gk.ikincil_form})`,
                isCorrect: true,
              },
              ...distractors.map((d) => ({
                id: d.id,
                arabic: d.ikincil_form,
                turkish: `${d.turkce} (${d.arapca} ➔ ${d.ikincil_form})`,
                isCorrect: false,
              })),
            ]),
          };
        }
      }

      if (rootDisp) {
        const distractors = shuffleArray(
          activeVisualList.filter(
            (other) =>
              other.id !== gk.id &&
              formatRootDisplay(other.kok) &&
              formatRootDisplay(other.kok) !== rootDisp
          )
        ).slice(0, 3);

        if (distractors.length >= 3) {
          return {
            id: `battle_root_${gk.id}_${idx}`,
            categoryBadge: "🌳 Kök & Müştakât",
            promptTypeLabel: `Aşağıdaki kelimelerden hangisi [ ${rootDisp} ] kökünden türemiştir?`,
            promptArabic: rootDisp,
            promptTurkish: `İpucu Anlam: "${gk.turkce}"`,
            imageUrl: gk.gorsel,
            audioSpec: {
              text: gk.arapca,
              id: gk.id,
              ses_erkek: gk.ses_erkek,
              ses_kadin: gk.ses_kadin,
            },
            primaryDisplayField: "arabic",
            options: shuffleArray([
              {
                id: gk.id,
                arabic: gk.arapca,
                turkish: `${gk.turkce} (Kök: ${rootDisp})`,
                isCorrect: true,
              },
              ...distractors.map((d) => ({
                id: d.id,
                arabic: d.arapca,
                turkish: `${d.turkce} (Kök: ${formatRootDisplay(d.kok)})`,
                isCorrect: false,
              })),
            ]),
          };
        }
      }

      return buildVisualQuestion(gk);
    };

    let cursor = 0;
    while (generated.length < total && cursor < total * 4) {
      const gk = activeVisualList[cursor % activeVisualList.length];
      let q: BattleQuestion | null = null;

      if (questionFocus === "visual_to_ar") {
        q = gk ? buildVisualQuestion(gk) : null;
      } else if (questionFocus === "ar_to_tr") {
        q = buildArToTrQuestion(cursor);
      } else if (questionFocus === "root_and_plural") {
        q = gk ? buildRootAndPluralQuestion(gk, cursor) : null;
      } else {
        // mixed
        const mod = cursor % 3;
        if (mod === 0 && gk) {
          q = buildVisualQuestion(gk);
        } else if (mod === 1) {
          q = buildArToTrQuestion(cursor);
        } else if (gk) {
          q = buildRootAndPluralQuestion(gk, cursor);
        }
      }

      if (q && !generated.some((existing) => existing.id === q!.id)) {
        generated.push(q);
      }
      cursor++;
    }

    // Fallback: Eğer hala eksikse activeProverbs ile tamamla
    for (const p of activeProverbs) {
      if (generated.length >= total) break;
      const dist = activeProverbs.filter((o) => o.id !== p.id).slice(0, 3);
      if (dist.length < 3) continue;
      generated.push({
        id: `battle_prov_fb_${p.id}`,
        categoryBadge: "📜 Atasözü",
        promptTypeLabel: "Bu atasözünün Türkçe karşılığı hangisidir?",
        promptArabic: p.arapca,
        imageUrl: p.gorsel,
        audioSpec: {
          text: p.arapca,
          id: p.id,
          ses_erkek: p.ses_erkek,
          ses_kadin: p.ses_kadin,
        },
        primaryDisplayField: "turkish",
        options: shuffleArray([
          {
            id: p.id,
            arabic: p.arapca,
            turkish: p.turkce,
            isCorrect: true,
          },
          ...dist.map((d) => ({
            id: d.id,
            arabic: d.arapca,
            turkish: d.turkce,
            isCorrect: false,
          })),
        ]),
      });
    }

    return generated.slice(0, total);
  }, [
    sessionSeed,
    questionCount,
    visualPool,
    vocabulary,
    idioms,
    cefrFilter,
    questionFocus,
  ]);

  const currentQuestion = battleQuestions[currentIndex] || null;
  const isRoundResolved = roundWinner !== null;

  // Sırayla yarış modunda aktif takım ("A" veya "B")
  const activeTurnTeam: "A" | "B" = currentIndex % 2 === 0 ? "A" : "B";

  const playTargetAudio = useCallback(() => {
    if (!currentQuestion?.audioSpec) return;
    const spec = currentQuestion.audioSpec;
    stopAllAudio();
    if (spec.id || spec.ses_erkek || spec.ses_kadin) {
      void playDualGenderAudio({
        text: spec.text,
        id: spec.id,
        ses_erkek: spec.ses_erkek,
        ses_kadin: spec.ses_kadin,
        gender: preferredVoiceGender,
        rate: speechRate,
      });
    } else {
      void speakHybrid({
        text: spec.text,
        voice: preferredVoiceGender,
        rate: speechRate,
      });
    }
  }, [currentQuestion, preferredVoiceGender, speechRate]);

  const appendRoundSummary = useCallback(
    (
      q: BattleQuestion,
      roundIdx: number,
      winner: "A" | "B" | "none",
      hadWrongAttempt: boolean
    ) => {
      const correctOpt = q.options.find((o) => o.isCorrect) || q.options[0];
      const entry: BattleRoundSummary = {
        roundNumber: roundIdx + 1,
        categoryBadge: q.categoryBadge,
        promptTypeLabel: q.promptTypeLabel,
        targetArabic: correctOpt?.arabic || q.promptArabic || "",
        targetTurkish: correctOpt?.turkish || q.promptTurkish || "",
        metaNote: correctOpt?.metaNote,
        winner,
        hadWrongAttempt,
      };
      setRoundHistory((prev) => {
        const filtered = prev.filter((r) => r.roundNumber !== entry.roundNumber);
        return [...filtered, entry].sort(
          (a, b) => a.roundNumber - b.roundNumber
        );
      });
    },
    []
  );

  // Geri sayım sayacı (Süresiz modda çalışmaz)
  useEffect(() => {
    if (
      isUnlimitedTime ||
      isFinished ||
      isRoundResolved ||
      questionTimer <= 0
    ) {
      return;
    }
    const timer = setTimeout(() => {
      if (questionTimer <= 1) {
        setQuestionTimer(0);
        setRoundWinner("none");
        if (currentQuestion) {
          appendRoundSummary(currentQuestion, currentIndex, "none", true);
        }
        void playWrong();
      } else {
        setQuestionTimer((prev) => Math.max(0, prev - 1));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    isUnlimitedTime,
    questionTimer,
    isFinished,
    isRoundResolved,
    currentQuestion,
    currentIndex,
    appendRoundSummary,
  ]);

  // Yarışma bittiğinde gerçek geçen süreyi tek seferde kaydet ve fanfar çal
  useEffect(() => {
    if (isFinished && !fanfarePlayedRef.current) {
      fanfarePlayedRef.current = true;
      const startedAt = battleStartedAtRef.current || Date.now();
      const elapsedMinutes = Math.max(
        1,
        Math.min(30, Math.round((Date.now() - startedAt) / 60000))
      );
      addStudyMinutes(elapsedMinutes);
      void playFanfare(100);
    }
  }, [isFinished, addStudyMinutes]);

  const handleTeamSelectOption = async (
    team: "A" | "B",
    option: BattleOption
  ) => {
    if (isRoundResolved || !currentQuestion) return;

    // Sırayla yarış modunda diğer takım ancak ilk takım yanlış yaptıysa cevap verebilir
    if (playMode === "turn_based") {
      const otherTeamChoice = team === "A" ? teamBChoiceId : teamAChoiceId;
      if (team !== activeTurnTeam && otherTeamChoice === null) {
        return;
      }
    }

    if (team === "A" && teamAChoiceId !== null) return;
    if (team === "B" && teamBChoiceId !== null) return;

    if (team === "A") {
      setTeamAChoiceId(option.id);
    } else {
      setTeamBChoiceId(option.id);
    }

    if (option.isCorrect) {
      // Doğru cevap veren takım turu kazanır!
      const otherTeamHadWrong =
        team === "A" ? teamBChoiceId !== null : teamAChoiceId !== null;
      setRoundWinner(team);
      appendRoundSummary(currentQuestion, currentIndex, team, otherTeamHadWrong);

      if (team === "A") {
        const nextStreak = teamAStreak + 1;
        const bonus = nextStreak >= 3 ? 5 : 0;
        setTeamAScore((s) => s + 10 + bonus);
        setTeamAStreak(nextStreak);
        setTeamABestStreak((b) => Math.max(b, nextStreak));
        await playCorrect({
          streak: nextStreak,
          gender: preferredVoiceGender,
        });
      } else {
        const nextStreak = teamBStreak + 1;
        const bonus = nextStreak >= 3 ? 5 : 0;
        setTeamBScore((s) => s + 10 + bonus);
        setTeamBStreak(nextStreak);
        setTeamBBestStreak((b) => Math.max(b, nextStreak));
        await playCorrect({
          streak: nextStreak,
          gender: preferredVoiceGender,
        });
      }

      playTargetAudio();
    } else {
      // Yanlış cevap!
      if (team === "A") {
        setTeamAStreak(0);
      } else {
        setTeamBStreak(0);
      }
      await playWrong();

      // Eğer diğer takım da daha önce yanlış cevap vermişse tur kimsenin puan alamadığı şekilde kapanır
      const otherAlreadyWrong =
        team === "A" ? teamBChoiceId !== null : teamAChoiceId !== null;
      if (otherAlreadyWrong) {
        setRoundWinner("none");
        appendRoundSummary(currentQuestion, currentIndex, "none", true);
        playTargetAudio();
      }
    }
  };

  const handleNextRound = () => {
    playClick();
    stopAllAudio();
    stopAllSfx();
    if (currentIndex + 1 >= battleQuestions.length) {
      const startedAt = battleStartedAtRef.current || Date.now();
      setMatchDurationSec(
        Math.max(5, Math.round((Date.now() - startedAt) / 1000))
      );
      setIsFinished(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setTeamAChoiceId(null);
      setTeamBChoiceId(null);
      setRoundWinner(null);
      setQuestionTimer(perQuestionSeconds);
    }
  };

  const handleRestartMatch = () => {
    void playStart();
    stopAllAudio();
    stopAllSfx();
    fanfarePlayedRef.current = false;
    battleStartedAtRef.current = Date.now();
    setSessionSeed((s) => s + 1);
    setCurrentIndex(0);
    setTeamAScore(0);
    setTeamBScore(0);
    setTeamAStreak(0);
    setTeamBStreak(0);
    setTeamABestStreak(0);
    setTeamBBestStreak(0);
    setTeamAChoiceId(null);
    setTeamBChoiceId(null);
    setRoundWinner(null);
    setRoundHistory([]);
    setMatchDurationSec(0);
    setQuestionTimer(perQuestionSeconds);
    setIsFinished(false);
  };

  if (!currentQuestion) {
    return (
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] p-6 text-center">
        <p className="text-sm font-bold">Yarışma soruları hazırlanıyor...</p>
      </div>
    );
  }

  // YARIŞMA SONU KUPA VE SINIF ÖZET RAPORU EKRANI
  if (isFinished) {
    const isTie = teamAScore === teamBScore;
    const winnerIsA = teamAScore > teamBScore;
    const winnerName = isTie
      ? "Dostluk Kazandı (Berabere!)"
      : winnerIsA
      ? `🟦 ${teamAName}`
      : `🟧 ${teamBName}`;

    const totalRounds = Math.max(1, battleQuestions.length);
    const teamAWins = roundHistory.filter((r) => r.winner === "A").length;
    const teamBWins = roundHistory.filter((r) => r.winner === "B").length;
    const solvedRounds = teamAWins + teamBWins;
    const accuracyPct = Math.round((solvedRounds / totalRounds) * 100);
    const reviewNeededItems = roundHistory.filter(
      (r) => r.winner === "none" || r.hadWrongAttempt
    );
    const mins = Math.floor(matchDurationSec / 60);
    const secs = matchDurationSec % 60;
    const durationText =
      mins > 0 ? `${mins} dk ${secs} sn` : `${Math.max(1, secs)} sn`;
    const formattedDate = new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date());
    const focusLabel =
      questionFocus === "visual_to_ar"
        ? "Görsel ↔ Arapça"
        : questionFocus === "ar_to_tr"
        ? "Arapça ↔ Türkçe"
        : questionFocus === "root_and_plural"
        ? "Kök & Çoğul (Sarf)"
        : "Karışık (Görsel + Anlam + Sarf)";

    const handleDownloadResultPng = () => {
      playClick();
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = 820;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Arka plan degrade
      const bgGrad = ctx.createLinearGradient(0, 0, 1400, 820);
      bgGrad.addColorStop(0, "#064E3B");
      bgGrad.addColorStop(0.55, "#087F5B");
      bgGrad.addColorStop(1, "#1E1B4B");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1400, 820);

      // İç krem çerçeve kartı
      ctx.fillStyle = "#FDFBF7";
      ctx.beginPath();
      ctx.roundRect(44, 44, 1312, 732, 32);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#F59E0B";
      ctx.stroke();

      // Üst rozet
      ctx.fillStyle = "#087F5B";
      ctx.beginPath();
      ctx.roundRect(440, 78, 520, 48, 24);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 22px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏆 SINIF & TAHTA YARIŞMASI SONUÇ KARTI", 700, 110);

      // Kazanan Başlığı
      ctx.fillStyle = "#1E293B";
      ctx.font = "900 44px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        isTie ? "🤝 Dostluk Kazandı (Berabere!)" : `👑 Kazanan: ${winnerName.replace(/^[🟦🟧]\s*/, "")}`,
        700,
        186
      );

      ctx.fillStyle = "#64748B";
      ctx.font = "700 21px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        `Tarih: ${formattedDate}  •  Konu: ${focusLabel}  •  Seviye: ${
          cefrFilter === "all" ? "Tüm Seviyeler" : cefrFilter
        }  •  Süre: ${durationText}`,
        700,
        232
      );

      // A Takımı Kartı
      ctx.fillStyle = "#EFF6FF";
      ctx.beginPath();
      ctx.roundRect(96, 276, 576, 300, 26);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#2563EB";
      ctx.stroke();

      ctx.fillStyle = "#1D4ED8";
      ctx.font = "800 28px system-ui, -apple-system, sans-serif";
      ctx.fillText(teamAName.slice(0, 28), 384, 336);
      ctx.fillStyle = "#1E3A8A";
      ctx.font = "900 72px system-ui, -apple-system, sans-serif";
      ctx.fillText(`${teamAScore} Puan`, 384, 430);
      ctx.fillStyle = "#334155";
      ctx.font = "700 23px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        `Doğru Tur: ${teamAWins}/${totalRounds}  •  En Uzun Seri: ${teamABestStreak}`,
        384,
        515
      );

      // B Takımı Kartı
      ctx.fillStyle = "#FFF7ED";
      ctx.beginPath();
      ctx.roundRect(728, 276, 576, 300, 26);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#EA580C";
      ctx.stroke();

      ctx.fillStyle = "#C2410C";
      ctx.font = "800 28px system-ui, -apple-system, sans-serif";
      ctx.fillText(teamBName.slice(0, 28), 1016, 336);
      ctx.fillStyle = "#7C2D12";
      ctx.font = "900 72px system-ui, -apple-system, sans-serif";
      ctx.fillText(`${teamBScore} Puan`, 1016, 430);
      ctx.fillStyle = "#334155";
      ctx.font = "700 23px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        `Doğru Tur: ${teamBWins}/${totalRounds}  •  En Uzun Seri: ${teamBBestStreak}`,
        1016,
        515
      );

      // Alt İstatistik Şeridi
      ctx.fillStyle = "#F3F0FF";
      ctx.beginPath();
      ctx.roundRect(96, 610, 1208, 78, 20);
      ctx.fill();
      ctx.fillStyle = "#4C28B5";
      ctx.font = "800 23px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        `📊 Sınıf Başarı Oranı: %${accuracyPct} (${solvedRounds}/${totalRounds} Soru)   •   📌 Tekrar Listesi: ${reviewNeededItems.length} Kelime`,
        700,
        658
      );

      // Alt Kurumsal İmza
      ctx.fillStyle = "#087F5B";
      ctx.font = "800 20px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        "Arapça Telaffuz ve Diyalog Asistanı — www.muallimun.net",
        700,
        738
      );

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `sinif-yarisma-sonucu-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const handlePrintBattleSummaryA4 = () => {
      playClick();
      const originStr =
        typeof window !== "undefined" ? window.location.origin : "";
      const reviewRowsHtml =
        reviewNeededItems.length > 0
          ? reviewNeededItems
              .map(
                (item, idx) => `
              <tr style="background:${idx % 2 === 0 ? "#fffbeb" : "#ffffff"};">
                <td style="font-weight:800;color:#92400e;">#${item.roundNumber} (${escapePrintHtml(
                  item.categoryBadge
                )})</td>
                <td dir="rtl" style="text-align:right;font-family:'ArakomFont','Amiri',serif;font-size:21px;font-weight:700;color:#087f5b;line-height:1.85;">${escapePrintHtml(
                  item.targetArabic
                )}</td>
                <td style="font-weight:700;color:#1e293b;">${escapePrintHtml(
                  item.targetTurkish
                )}${
                  item.metaNote
                    ? ` <span style="font-size:10.5px;color:#64748b;">(${escapePrintHtml(
                        item.metaNote
                      )})</span>`
                    : ""
                }</td>
                <td style="font-size:11px;font-weight:800;color:#dc2626;">${
                  item.winner === "none"
                    ? "Cevaplanamadı / Süre Doldu"
                    : "Yanlış Deneme Sonrası Çözüldü"
                }</td>
              </tr>
            `
              )
              .join("")
          : "";

      const allRowsHtml = roundHistory
        .map(
          (item, idx) => `
          <tr style="background:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};">
            <td style="font-weight:800;">#${item.roundNumber}</td>
            <td dir="rtl" style="text-align:right;font-family:'ArakomFont','Amiri',serif;font-size:19px;font-weight:700;color:#0f172a;line-height:1.8;">${escapePrintHtml(
              item.targetArabic
            )}</td>
            <td style="font-weight:600;color:#1e293b;">${escapePrintHtml(
              item.targetTurkish
            )}</td>
            <td style="font-weight:800;color:${
              item.winner === "A"
                ? "#1d4ed8"
                : item.winner === "B"
                ? "#c2410c"
                : "#dc2626"
            };">${
              item.winner === "A"
                ? escapePrintHtml(teamAName)
                : item.winner === "B"
                ? escapePrintHtml(teamBName)
                : "Puan Alınamadı"
            }</td>
          </tr>
        `
        )
        .join("");

      const htmlDoc = `<!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8" />
        <title>Sınıf Yarışması Özeti ve Tekrar Listesi | Muallimun</title>
        <style>
          @font-face {
            font-family: "ArakomFont";
            src: url("${originStr}/fonts/Arakom.ttf") format("truetype");
            font-weight: 100 900;
            font-style: normal;
          }
          @page { size: A4 portrait; margin: 11mm 13mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; font-size: 12px; }
          .header { border: 2px solid #087f5b; border-bottom-width: 4px; border-radius: 14px; padding: 12px 16px; background: #fdfbf7; margin-bottom: 12px; }
          .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
          .score-card { border-radius: 12px; padding: 10px 14px; border: 2px solid #cbd5e1; }
          .section-title { font-size: 12.5px; font-weight: 800; padding: 6px 12px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #cbd5e1; }
          table { width: 100%; border-collapse: collapse; border: 1.5px solid #cbd5e1; margin-bottom: 14px; }
          th, td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: middle; }
          th { background: #f1f5f9; font-size: 11px; font-weight: 800; }
          tr { page-break-inside: avoid; break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size:10.5px;font-weight:800;color:#087f5b;margin-bottom:4px;">🏆 SINIF &amp; TAHTA YARIŞMASI SONUÇ RAPORU • ${escapePrintHtml(
            formattedDate
          )}</div>
          <div style="font-size:18px;font-weight:900;color:#0f172a;">${escapePrintHtml(
            winnerName
          )}</div>
          <div style="font-size:11px;color:#475569;margin-top:4px;font-weight:600;">
            Odak: ${escapePrintHtml(focusLabel)} • Seviye: ${escapePrintHtml(
        cefrFilter === "all" ? "Tüm Seviyeler" : cefrFilter
      )} • Süre: ${escapePrintHtml(
        durationText
      )} • Sınıf Başarı Oranı: %${accuracyPct} (${solvedRounds}/${totalRounds})
          </div>
        </div>

        <div class="score-grid">
          <div class="score-card" style="background:#eff6ff;border-color:#2563eb;">
            <div style="font-weight:800;color:#1d4ed8;">🟦 ${escapePrintHtml(
              teamAName
            )}</div>
            <div style="font-size:22px;font-weight:900;color:#1e3a8a;margin:3px 0;">${teamAScore} Puan</div>
            <div style="font-size:11px;color:#334155;font-weight:700;">Kazanılan Tur: ${teamAWins} • En Uzun Seri: ${teamABestStreak}</div>
          </div>
          <div class="score-card" style="background:#fff7ed;border-color:#ea580c;">
            <div style="font-weight:800;color:#c2410c;">🟧 ${escapePrintHtml(
              teamBName
            )}</div>
            <div style="font-size:22px;font-weight:900;color:#7c2d12;margin:3px 0;">${teamBScore} Puan</div>
            <div style="font-size:11px;color:#334155;font-weight:700;">Kazanılan Tur: ${teamBWins} • En Uzun Seri: ${teamBBestStreak}</div>
          </div>
        </div>

        <div class="section-title" style="background:#fffbeb;border-color:#f59e0b;color:#92400e;">
          📌 Sınıfça Tekrar Edilecek Kelimeler &amp; İfadeler (${
            reviewNeededItems.length
          } Öğe)
        </div>
        ${
          reviewNeededItems.length > 0
            ? `
          <table>
            <thead>
              <tr>
                <th style="width:16%;">Tur / Kategori</th>
                <th style="width:34%;text-align:right;" dir="rtl">Arapça Hedef İfade</th>
                <th style="width:30%;">Türkçe Anlamı</th>
                <th style="width:20%;">Durum</th>
              </tr>
            </thead>
            <tbody>${reviewRowsHtml}</tbody>
          </table>
        `
            : `<div style="padding:10px 14px;border:1px solid #a7f3d0;background:#ecfdf5;border-radius:10px;color:#065f46;font-weight:800;margin-bottom:14px;">🎉 Harika! Sınıftaki tüm sorular ilk denemede hatasız cevaplandı.</div>`
        }

        <div class="section-title" style="background:#f8fafc;color:#087f5b;">
          📋 Yarışmada Sorulan Tüm Kelimeler (${roundHistory.length} Soru)
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:10%;">Soru</th>
              <th style="width:36%;text-align:right;" dir="rtl">Arapça Kelime / İfade</th>
              <th style="width:32%;">Türkçe Doğru Karşılığı</th>
              <th style="width:22%;">Turu Kazanan</th>
            </tr>
          </thead>
          <tbody>${allRowsHtml}</tbody>
        </table>

        <footer style="margin-top:12px;padding-top:8px;border-top:2px solid #087f5b;display:flex;justify-content:space-between;font-size:10.5px;color:#475569;font-weight:700;">
          <span>Arapça Telaffuz ve Diyalog Asistanı — Sınıf Yarışması Çalışma Özeti</span>
          <span style="color:#087f5b;font-weight:800;">www.muallimun.net</span>
        </footer>
      </body>
      </html>`;

      const iframe = printIframeRef.current;
      if (iframe) {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(htmlDoc);
          doc.close();
          const runPrint = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          };
          if (doc.fonts && typeof doc.fonts.ready?.then === "function") {
            doc.fonts.ready
              .then(() => setTimeout(runPrint, 120))
              .catch(() => setTimeout(runPrint, 150));
          } else {
            setTimeout(runPrint, 150);
          }
        }
      }
    };

    return (
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-5 sm:p-7 text-center max-w-3xl mx-auto space-y-4">
        <iframe
          ref={printIframeRef}
          title="Sınıf Yarışması A4 Özet Yazdırma Katmanı"
          className="fixed w-0 h-0 border-0 opacity-0 pointer-events-none"
        />

        <div className="w-20 h-20 rounded-3xl bg-amber-100 dark:bg-amber-950/70 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-500 shadow-md">
          <Trophy size={42} />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wider text-[#6741D9] dark:text-indigo-300">
            🏆 Sınıf &amp; Tahta Yarışması Tamamlandı • Başarı: %{accuracyPct} • Süre: {durationText}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[var(--foreground)] flex items-center justify-center gap-2">
            <Crown className="text-amber-500 shrink-0" size={26} />
            <span>{winnerName}</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
          {/* A Takımı Sonuç Kartı */}
          <div
            className={`rounded-2xl p-4 border-2 ${
              winnerIsA || isTie
                ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500"
                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE]"
            }`}
          >
            <div className="text-xs font-black text-blue-700 dark:text-blue-300 truncate">
              🟦 {teamAName}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-blue-800 dark:text-blue-200 my-1 tabular-nums">
              {teamAScore} Puan
            </div>
            <div className="text-[11px] font-bold text-[var(--muted)]">
              Doğru Tur: {teamAWins} • En İyi Seri: 🔥 {teamABestStreak}
            </div>
          </div>

          {/* B Takımı Sonuç Kartı */}
          <div
            className={`rounded-2xl p-4 border-2 ${
              !winnerIsA || isTie
                ? "bg-orange-50 dark:bg-orange-950/60 border-orange-500"
                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE]"
            }`}
          >
            <div className="text-xs font-black text-orange-700 dark:text-orange-300 truncate">
              🟧 {teamBName}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-orange-800 dark:text-orange-200 my-1 tabular-nums">
              {teamBScore} Puan
            </div>
            <div className="text-[11px] font-bold text-[var(--muted)]">
              Doğru Tur: {teamBWins} • En İyi Seri: 🔥 {teamBBestStreak}
            </div>
          </div>
        </div>

        {/* 📌 Sınıfça Tekrar Edilecek Kelimeler Önizlemesi */}
        {reviewNeededItems.length > 0 && (
          <div className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/35 border-2 border-amber-300 dark:border-amber-700 p-3.5 text-left space-y-2 max-w-2xl mx-auto">
            <div className="text-xs sm:text-sm font-extrabold text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
              <span>
                📌 Sınıfça Tekrar Edilecek Kelimeler ({reviewNeededItems.length})
              </span>
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                Yanlış yapılan / süresi dolan sorular
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {reviewNeededItems.map((item) => (
                <div
                  key={item.roundNumber}
                  className="rounded-xl bg-white dark:bg-[var(--background)] border border-amber-200 dark:border-amber-800 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-bold text-[var(--foreground)]">
                    #{item.roundNumber} {item.targetTurkish}
                  </span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="arabic text-lg font-bold text-[#065F46] dark:text-emerald-300 leading-[1.95] shrink-0"
                  >
                    {item.targetArabic}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PNG Sonuç Kartı & A4 Özet Yazdırma Aksiyonları */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleDownloadResultPng}
            className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs sm:text-sm font-extrabold border-b-3 border-[#422399] inline-flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Download size={16} />
            <span>🖼️ Yarışma Sonuç Kartını İndir (PNG)</span>
          </button>

          <button
            type="button"
            onClick={handlePrintBattleSummaryA4}
            className="min-h-[48px] px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-extrabold border-b-3 border-amber-800 inline-flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Printer size={16} />
            <span>🖨️ Yarışma Özeti &amp; Tekrar Listesi Yazdır (A4)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleRestartMatch}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold border-b-3 border-[#065F46] inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCcw size={16} />
            <span>Rövanş Maçı Başlat</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] text-xs sm:text-sm font-extrabold text-[var(--foreground)] hover:border-[#6741D9] cursor-pointer"
            >
              Alıştırma Merkezine Dön
            </button>
          )}
        </div>
      </div>
    );
  }

  const renderTeamPanel = (team: "A" | "B") => {
    const isTeamA = team === "A";
    const teamChoiceId = isTeamA ? teamAChoiceId : teamBChoiceId;
    const otherTeamChoiceId = isTeamA ? teamBChoiceId : teamAChoiceId;
    const isWaitingForTurn =
      playMode === "turn_based" &&
      activeTurnTeam !== team &&
      otherTeamChoiceId === null &&
      !isRoundResolved;

    const headerColor = isTeamA
      ? "bg-blue-600 text-white border-blue-700"
      : "bg-orange-500 text-white border-orange-600";

    const panelBorder = isTeamA
      ? roundWinner === "A"
        ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20"
        : "border-blue-300 dark:border-blue-800 bg-white/95 dark:bg-[var(--background)]"
      : roundWinner === "B"
      ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20"
      : "border-orange-300 dark:border-orange-800 bg-white/95 dark:bg-[var(--background)]";

    return (
      <div
        className={`rounded-2xl border-2 border-b-4 p-2.5 sm:p-3 flex flex-col justify-between gap-2 transition-all ${panelBorder}`}
      >
        {/* Takım Panel Başlığı */}
        <div
          className={`rounded-xl px-3 py-1.5 border-b-2 flex items-center justify-between gap-2 ${headerColor}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Users size={15} className="shrink-0" />
            <span className="text-xs sm:text-sm font-black truncate">
              {isTeamA ? `🟦 ${teamAName}` : `🟧 ${teamBName}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {roundWinner === team && (
              <span className="px-2 py-0.5 rounded-md bg-white text-[#087F5B] text-[11px] font-black">
                +10 Puan Kazandı!
              </span>
            )}
            {isWaitingForTurn && (
              <span className="px-2 py-0.5 rounded-md bg-black/25 text-white text-[10px] font-bold">
                Rakip Sırası
              </span>
            )}
            {!isRoundResolved && !isWaitingForTurn && teamChoiceId === null && (
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-extrabold">
                ⚡ Cevapla!
              </span>
            )}
          </div>
        </div>

        {/* 4 Büyük Seçenek Butonu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
          {currentQuestion.options.map((opt, idx) => {
            const isChosenByThisTeam = teamChoiceId === opt.id;
            const optionLetter = ["A", "B", "C", "D"][idx] || String(idx + 1);

            let btnStyle = isTeamA
              ? "bg-[#FDFBF7] dark:bg-[var(--surface)] border-[#E6D7BE] hover:border-blue-500"
              : "bg-[#FDFBF7] dark:bg-[var(--surface)] border-[#E6D7BE] hover:border-orange-500";

            if (isRoundResolved) {
              if (opt.isCorrect) {
                btnStyle =
                  "bg-emerald-50 dark:bg-emerald-950/70 border-[#087F5B] text-[#065F46] dark:text-emerald-200 ring-2 ring-[#087F5B]/30";
              } else if (isChosenByThisTeam) {
                btnStyle =
                  "bg-rose-50 dark:bg-rose-950/70 border-rose-500 text-rose-900 dark:text-rose-200";
              } else {
                btnStyle =
                  "bg-white/70 dark:bg-[var(--surface)] border-[#E6D7BE] opacity-80";
              }
            } else if (isChosenByThisTeam && !opt.isCorrect) {
              btnStyle =
                "bg-rose-50 dark:bg-rose-950/70 border-rose-500 text-rose-900 dark:text-rose-200 opacity-75";
            }

            const rawPrimaryText =
              currentQuestion.primaryDisplayField === "arabic"
                ? opt.arabic
                : opt.turkish;
            const displayPrimaryText =
              currentQuestion.primaryDisplayField === "turkish" &&
              !isRoundResolved
                ? stripParentheticalArabicExamples(rawPrimaryText)
                : rawPrimaryText;
            const secondaryText =
              currentQuestion.primaryDisplayField === "arabic"
                ? opt.turkish
                : opt.arabic;
            const isPrimaryPureArabic =
              currentQuestion.primaryDisplayField === "arabic" &&
              /[\u0600-\u06FF]/.test(displayPrimaryText) &&
              !hasLatinCharacters(displayPrimaryText);
            const isSecondaryPureArabic =
              /[\u0600-\u06FF]/.test(secondaryText) &&
              !hasLatinCharacters(secondaryText);

            return (
              <button
                key={`${team}_${opt.id}`}
                type="button"
                disabled={
                  isRoundResolved ||
                  teamChoiceId !== null ||
                  isWaitingForTurn
                }
                onClick={() => void handleTeamSelectOption(team, opt)}
                className={`rounded-xl border-2 border-b-4 p-2.5 text-left flex flex-col justify-between gap-1.5 transition-all ${btnStyle} ${
                  isRoundResolved || teamChoiceId !== null || isWaitingForTurn
                    ? "cursor-default"
                    : "cursor-pointer active:translate-y-0.5"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 w-full">
                  <span
                    className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                      isRoundResolved && opt.isCorrect
                        ? "bg-[#087F5B] text-white"
                        : isChosenByThisTeam && !opt.isCorrect
                        ? "bg-rose-600 text-white"
                        : isTeamA
                        ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200"
                        : "bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200"
                    }`}
                  >
                    {optionLetter}
                  </span>

                  {isRoundResolved && opt.isCorrect && (
                    <CheckCircle2 size={16} className="text-[#087F5B] shrink-0" />
                  )}
                  {isChosenByThisTeam && !opt.isCorrect && (
                    <XCircle size={16} className="text-rose-600 shrink-0" />
                  )}
                </div>

                {/* Ana Seçenek Metni — Türkçe/Karma metinler kesinlikle LTR + MixedText ile izole edilir */}
                {isPrimaryPureArabic ? (
                  <div
                    dir="rtl"
                    lang="ar"
                    className="w-full font-black text-[var(--foreground)] leading-relaxed my-auto arabic text-xl sm:text-2xl text-right break-words"
                  >
                    {displayPrimaryText}
                  </div>
                ) : (
                  <div
                    dir="ltr"
                    lang="tr"
                    className="w-full font-sans font-extrabold text-[var(--foreground)] leading-snug my-auto text-sm sm:text-base text-left break-words"
                  >
                    <MixedText
                      text={displayPrimaryText}
                      arabicClassName="arabic font-arabic text-lg sm:text-xl font-bold mx-0.5 inline-block"
                    />
                  </div>
                )}

                {/* Cevap Sonrasında Hem Arapça Yazılışı Hem Türkçe Anlamı Net Olarak Gösterilir */}
                {isRoundResolved && (
                  <div className="w-full pt-1 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] flex flex-col gap-0.5">
                    {isSecondaryPureArabic ? (
                      <span
                        dir="rtl"
                        lang="ar"
                        className="font-bold text-[#065F46] dark:text-emerald-300 arabic text-base sm:text-lg text-right"
                      >
                        {secondaryText}
                      </span>
                    ) : (
                      <span
                        dir="ltr"
                        lang="tr"
                        className="font-sans font-bold text-[#065F46] dark:text-emerald-300 text-xs text-left"
                      >
                        <MixedText
                          text={secondaryText}
                          arabicClassName="arabic font-arabic text-base font-bold mx-0.5 inline-block"
                        />
                      </span>
                    )}
                    {opt.metaNote && (
                      <span
                        dir="ltr"
                        lang="tr"
                        className="font-sans text-[10px] font-semibold text-[var(--muted)] text-left"
                      >
                        <MixedText
                          text={opt.metaNote}
                          arabicClassName="arabic font-arabic text-xs font-bold mx-0.5 inline-block"
                        />
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-2.5 sm:p-3 flex flex-col justify-between gap-2.5">
      {/* 1. YARIŞMA KURULUM ŞERİDİ (Açılır/Kapanır Kompakt Ayar Barı) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[var(--background)] rounded-xl px-3 py-1.5 border border-[#E6D7BE] dark:border-[var(--border)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-black text-[#6741D9] dark:text-indigo-300 inline-flex items-center gap-1">
            <Trophy size={14} className="text-amber-500" />
            <span>Sınıf & Tahta Yarışması</span>
          </span>

          <div className="inline-flex items-center rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] p-0.5 border border-[#E6D7BE]">
            <button
              type="button"
              onClick={() => {
                playClick();
                setPlayMode("simultaneous");
              }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer ${
                playMode === "simultaneous"
                  ? "bg-[#6741D9] text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              <Zap size={11} />
              <span>Aynı Anda (Hızlı Olan)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playClick();
                setPlayMode("turn_based");
              }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer ${
                playMode === "turn_based"
                  ? "bg-[#6741D9] text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              <span>🔄 Sırayla Yarış</span>
            </button>
          </div>

          <select
            value={questionFocus}
            onChange={(e) => {
              playClick();
              setQuestionFocus(e.target.value as BattleQuestionFocus);
              handleRestartMatch();
            }}
            aria-label="Soru Türü"
            className="h-7 px-2 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] text-[11px] font-extrabold text-[var(--foreground)] cursor-pointer"
          >
            <option value="mixed">🎯 Soru Türü: Karışık (Görsel + Anlam + Sarf)</option>
            <option value="visual_to_ar">🖼️ Görsel ↔ Arapça</option>
            <option value="ar_to_tr">🔤 Arapça ↔ Türkçe</option>
            <option value="root_and_plural">🌳 Kök & Çoğul (Sarf)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            playClick();
            setShowSetupBar((s) => !s);
          }}
          className="px-2.5 py-1 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] text-[11px] font-extrabold text-[var(--foreground)] inline-flex items-center gap-1 cursor-pointer"
        >
          <Settings2 size={12} />
          <span>Takım İsimleri</span>
        </button>
      </div>

      {showSetupBar && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white dark:bg-[var(--background)] rounded-xl p-2.5 border border-[#6741D9]/40 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-blue-600 shrink-0">
              🟦 1. Takım:
            </span>
            <input
              type="text"
              value={teamAName}
              onChange={(e) => setTeamAName(e.target.value)}
              className="w-full px-2.5 py-1 rounded-lg border border-[#E6D7BE] text-xs font-bold bg-[#FDFBF7] dark:bg-[var(--surface)]"
              placeholder="A Takımı (1. Grup)"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-orange-600 shrink-0">
              🟧 2. Takım:
            </span>
            <input
              type="text"
              value={teamBName}
              onChange={(e) => setTeamBName(e.target.value)}
              className="w-full px-2.5 py-1 rounded-lg border border-[#E6D7BE] text-xs font-bold bg-[#FDFBF7] dark:bg-[var(--surface)]"
              placeholder="B Takımı (2. Grup)"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowSetupBar(false);
                handleRestartMatch();
              }}
              className="px-3 py-1 rounded-lg bg-[#087F5B] text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
            >
              <Play size={12} fill="currentColor" />
              <span>Yarışmayı Yeniden Başlat</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. ÜST SKOR VE MERKEZİ HEDEF SORU KARTI BARI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
        {/* SOL UÇ: 🟦 A Takımı Puanı & Seri (🔥) */}
        <div className="lg:col-span-3 bg-blue-50 dark:bg-blue-950/50 rounded-2xl border-2 border-blue-400 dark:border-blue-700 p-2.5 flex items-center justify-between lg:flex-col lg:justify-center gap-1 text-center">
          <div className="text-xs font-black text-blue-800 dark:text-blue-200 truncate max-w-full">
            🟦 {teamAName}
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-300 tabular-nums">
            {teamAScore} Puan
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 dark:bg-blue-900/60 text-[11px] font-extrabold text-amber-600">
            <Flame size={12} />
            <span>Seri: {teamAStreak}</span>
          </div>
        </div>

        {/* ORTA: Soru X/Y + ⏱️ Süre + 🔊 Sesi Dinle + Hedef Soru Kartı (1:1 Kare Görselli) */}
        <div className="lg:col-span-6 bg-white dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] p-2.5 sm:p-3 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-lg bg-[#F3F0FF] dark:bg-indigo-950/70 text-[#6741D9] dark:text-indigo-300 text-[11px] font-black tabular-nums">
                Soru {currentIndex + 1} / {battleQuestions.length}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] text-[11px] font-extrabold text-[var(--muted)]">
                {currentQuestion.categoryBadge}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded-lg text-xs font-black inline-flex items-center gap-1 tabular-nums ${
                  !isUnlimitedTime && questionTimer <= 5
                    ? "bg-rose-100 text-rose-700 animate-pulse"
                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                }`}
              >
                <Timer size={13} />
                {isUnlimitedTime ? "∞ Süresiz" : `${questionTimer}s`}
              </span>

              {currentQuestion.audioSpec && (
                <button
                  type="button"
                  onClick={playTargetAudio}
                  className="px-2.5 py-1 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 size={13} />
                  <span>Sesi Dinle</span>
                </button>
              )}
            </div>
          </div>

          {/* Hedef Soru Gövdesi + 1:1 Kare Görsel */}
          <div className="flex items-center justify-center gap-3 my-auto py-0.5">
            {currentQuestion.imageUrl && (
              <div className="w-20 h-20 sm:w-24 sm:h-24 aspect-square rounded-2xl bg-[#FDFBF7] dark:bg-slate-900 border-2 border-[#E6D7BE] p-1 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={currentQuestion.imageUrl}
                  alt="Soru Görseli"
                  className="w-full h-full aspect-square object-contain rounded-xl"
                />
              </div>
            )}

            <div className="flex-1 min-w-0 text-center space-y-1">
              {currentQuestion.promptArabic && (
                <div
                  dir="rtl"
                  lang="ar"
                  onClick={playTargetAudio}
                  className="arabic text-2xl sm:text-3xl font-black text-[var(--foreground)] leading-relaxed cursor-pointer break-words"
                >
                  {currentQuestion.promptArabic}
                </div>
              )}

              {currentQuestion.promptTurkish && (
                <div
                  dir="ltr"
                  lang="tr"
                  className="font-sans text-sm sm:text-base font-extrabold text-[#4C28B5] dark:text-indigo-300"
                >
                  <MixedText text={currentQuestion.promptTurkish} />
                </div>
              )}

              <p
                dir="ltr"
                lang="tr"
                className="font-sans text-xs sm:text-sm font-bold text-[var(--muted)] leading-snug"
              >
                <MixedText text={currentQuestion.promptTypeLabel} />
              </p>
            </div>
          </div>

          {/* Tur Sonucu ve Sonraki Soru Butonu */}
          {isRoundResolved && (
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
              <span className="text-xs font-black text-[#065F46] dark:text-emerald-400">
                {roundWinner === "A"
                  ? `🎉 Bu turu 🟦 ${teamAName} kazandı!`
                  : roundWinner === "B"
                  ? `🎉 Bu turu 🟧 ${teamBName} kazandı!`
                  : "⏱️ Tur tamamlandı! Doğru cevabı inceleyin."}
              </span>
              <button
                type="button"
                onClick={handleNextRound}
                className="px-4 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                <span>
                  {currentIndex + 1 >= battleQuestions.length
                    ? "Kupayı Gör 🏆"
                    : "Sıradaki Soru"}
                </span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* SAĞ UÇ: 🟧 B Takımı Puanı & Seri (🔥) */}
        <div className="lg:col-span-3 bg-orange-50 dark:bg-orange-950/50 rounded-2xl border-2 border-orange-400 dark:border-orange-700 p-2.5 flex items-center justify-between lg:flex-col lg:justify-center gap-1 text-center">
          <div className="text-xs font-black text-orange-800 dark:text-orange-200 truncate max-w-full">
            🟧 {teamBName}
          </div>
          <div className="text-xl sm:text-2xl font-black text-orange-700 dark:text-orange-300 tabular-nums">
            {teamBScore} Puan
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 dark:bg-orange-900/60 text-[11px] font-extrabold text-amber-600">
            <Flame size={12} />
            <span>Seri: {teamBStreak}</span>
          </div>
        </div>
      </div>

      {/* 3. İKİYE BÖLÜNMÜŞ YARIŞMA ALANI (Sol: 🟦 A Takımı Paneli | Sağ: 🟧 B Takımı Paneli) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        {renderTeamPanel("A")}
        {renderTeamPanel("B")}
      </div>
    </div>
  );
}
