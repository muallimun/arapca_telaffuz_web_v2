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
import { shuffleArray } from "@/lib/quiz";
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
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Soru başına geri sayım (varsayılan 20sn veya üst bardan seçilen timeLimit)
  const perQuestionSeconds = timeLimit || 25;
  const [questionTimer, setQuestionTimer] =
    useState<number>(perQuestionSeconds);

  const fanfarePlayedRef = useRef(false);

  // Yarışma başlangıcında sfx.playStart()
  useEffect(() => {
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

  // Geri sayım sayacı
  useEffect(() => {
    if (isFinished || isRoundResolved || questionTimer <= 0) return;
    const timer = setTimeout(() => {
      if (questionTimer <= 1) {
        setQuestionTimer(0);
        setRoundWinner("none");
        void playWrong();
      } else {
        setQuestionTimer((prev) => Math.max(0, prev - 1));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [questionTimer, isFinished, isRoundResolved]);

  // Yarışma bittiğinde kazanan takım kupasıyla birlikte sfx.playFanfare(100) çalsın
  useEffect(() => {
    if (isFinished && !fanfarePlayedRef.current) {
      fanfarePlayedRef.current = true;
      void playFanfare(100);
    }
  }, [isFinished]);

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
      setRoundWinner(team);
      addStudyMinutes(1);

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
        playTargetAudio();
      }
    }
  };

  const handleNextRound = () => {
    playClick();
    stopAllAudio();
    stopAllSfx();
    if (currentIndex + 1 >= battleQuestions.length) {
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

  // YARIŞMA SONU KUPA EKRANI
  if (isFinished) {
    const isTie = teamAScore === teamBScore;
    const winnerIsA = teamAScore > teamBScore;
    const winnerName = isTie
      ? "Dostluk Kazandı (Berabere!)"
      : winnerIsA
      ? `🟦 ${teamAName}`
      : `🟧 ${teamBName}`;

    return (
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-5 sm:p-7 text-center max-w-2xl mx-auto space-y-4">
        <div className="w-20 h-20 rounded-3xl bg-amber-100 dark:bg-amber-950/70 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-500 shadow-md">
          <Trophy size={42} />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wider text-[#6741D9] dark:text-indigo-300">
            🏆 Sınıf & Tahta Yarışması Tamamlandı
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[var(--foreground)] flex items-center justify-center gap-2">
            <Crown className="text-amber-500 shrink-0" size={26} />
            <span>{winnerName}</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
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
              En İyi Seri: 🔥 {teamABestStreak}
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
              En İyi Seri: 🔥 {teamBBestStreak}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRestartMatch}
            className="px-5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold border-b-3 border-[#065F46] inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCcw size={16} />
            <span>Rövanş Maçı Başlat</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] text-xs sm:text-sm font-extrabold text-[var(--foreground)] hover:border-[#6741D9] cursor-pointer"
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

            const primaryText =
              currentQuestion.primaryDisplayField === "arabic"
                ? opt.arabic
                : opt.turkish;
            const secondaryText =
              currentQuestion.primaryDisplayField === "arabic"
                ? opt.turkish
                : opt.arabic;
            const isPrimaryArabic = /[\u0600-\u06FF]/.test(primaryText);

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

                {/* Ana Seçenek Metni */}
                <div
                  dir={isPrimaryArabic ? "rtl" : "ltr"}
                  lang={isPrimaryArabic ? "ar" : "tr"}
                  className={`w-full font-black text-[var(--foreground)] leading-snug my-auto ${
                    isPrimaryArabic
                      ? "arabic text-lg sm:text-xl text-right"
                      : "text-xs sm:text-sm"
                  }`}
                >
                  {primaryText}
                </div>

                {/* Cevap Sonrasında Hem Arapça Yazılışı Hem Türkçe Anlamı Net Olarak Gösterilir */}
                {isRoundResolved && (
                  <div className="w-full pt-1 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] flex flex-col gap-0.5">
                    <span
                      dir={/[\u0600-\u06FF]/.test(secondaryText) ? "rtl" : "ltr"}
                      lang={/[\u0600-\u06FF]/.test(secondaryText) ? "ar" : "tr"}
                      className={`font-bold text-[#065F46] dark:text-emerald-300 ${
                        /[\u0600-\u06FF]/.test(secondaryText)
                          ? "arabic text-sm text-right"
                          : "text-[11px]"
                      }`}
                    >
                      {secondaryText}
                    </span>
                    {opt.metaNote && (
                      <span className="text-[10px] font-semibold text-[var(--muted)]">
                        {opt.metaNote}
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
              <span>⚡ Aynı Anda (Hızlı Olan)</span>
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
                  questionTimer <= 5
                    ? "bg-rose-100 text-rose-700 animate-pulse"
                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                }`}
              >
                <Timer size={13} />
                {questionTimer}s
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
                  className="arabic text-xl sm:text-2xl font-black text-[var(--foreground)] leading-snug cursor-pointer"
                >
                  {currentQuestion.promptArabic}
                </div>
              )}

              {currentQuestion.promptTurkish && (
                <div className="text-xs sm:text-sm font-extrabold text-[#4C28B5] dark:text-indigo-300">
                  {currentQuestion.promptTurkish}
                </div>
              )}

              <p className="text-[11px] sm:text-xs font-bold text-[var(--muted)] leading-snug">
                {currentQuestion.promptTypeLabel}
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
