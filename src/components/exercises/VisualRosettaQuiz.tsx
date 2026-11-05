"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Volume2,
  Check,
  X,
  RotateCcw,
  Trophy,
  Eye,
  EyeOff,
  ArrowRight,
  Mic,
  Share2,
  UserCheck,
  Headphones,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";
import { ResimliKelime, Level } from "@/types/data";
import { gorselKelimeler, getVisualWordCoverUrl } from "@/lib/data";
import {
  selectSmartVisualDistractors,
  shuffleArray,
  normalizeWordPartOfSpeech,
} from "@/lib/quiz";
import {
  playDualGenderAudio,
  getDualGenderAudioUrl,
  speakHybrid,
  stopAllAudio,
} from "@/lib/audio";
import { useSettings, VoiceGender } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import { playClick, playSuccess, playError } from "@/lib/sfxManager";
import WordTooltip from "@/components/ui/WordTooltip";
import ShadowingModal from "@/components/ui/ShadowingModal";
import ShareAchievementModal from "@/components/ui/ShareAchievementModal";

export type RosettaSubMode =
  | "listen-to-image"
  | "image-to-arabic"
  | "sentence-to-image";

interface VisualRosettaQuizProps {
  visualPool?: ResimliKelime[];
  cefrFilter?: Level | "all";
  questionCount?: 10 | 20 | 30;
  initialSubMode?: RosettaSubMode;
  onClose: () => void;
}

interface RosettaQuestion {
  target: ResimliKelime;
  options: {
    item: ResimliKelime;
    isCorrect: boolean;
  }[];
}

export default function VisualRosettaQuiz({
  visualPool,
  cefrFilter = "all",
  questionCount = 10,
  initialSubMode = "listen-to-image",
  onClose,
}: VisualRosettaQuizProps) {
  const {
    showHareke,
    speechRate,
    preferredVoiceGender,
    setPreferredVoiceGender,
  } = useSettings();
  const { addMistake, recordItemAttempt } = useUserStore();

  const [subMode, setSubMode] = useState<RosettaSubMode>(initialSubMode);
  const [audioOnlyMode, setAudioOnlyMode] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [wrongItems, setWrongItems] = useState<ResimliKelime[]>([]);
  const [customRetryPool, setCustomRetryPool] = useState<
    ResimliKelime[] | null
  >(null);
  const [quizSeed, setQuizSeed] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [shadowingTarget, setShadowingTarget] = useState<{
    text: string;
    refAudioUrl?: string;
    forms?: { label: string; arabic: string }[];
  } | null>(null);

  const removeTashkeel = (text: string) => text.replace(/[\u064B-\u0652]/g, "");
  const getDisplayArabic = (text: string) =>
    showHareke ? text : removeTashkeel(text);

  const activePool = useMemo(() => {
    if (customRetryPool && customRetryPool.length > 0) {
      return customRetryPool;
    }
    const base =
      visualPool && visualPool.length >= 4 ? visualPool : gorselKelimeler;
    if (cefrFilter === "all") return base;
    const byCefr = base.filter((item) => item.cefr === cefrFilter);
    return byCefr.length >= 4 ? byCefr : base;
  }, [visualPool, cefrFilter, customRetryPool]);

  const questions: RosettaQuestion[] = useMemo(() => {
    void quizSeed;
    const candidateTargets =
      subMode === "sentence-to-image"
        ? activePool.filter((w) => Boolean(w.ornek_ar && w.ornek_ar.trim()))
        : activePool;
    const effectiveTargets =
      candidateTargets.length > 0 ? candidateTargets : activePool;

    const pickedTargets = shuffleArray(effectiveTargets).slice(
      0,
      customRetryPool ? customRetryPool.length : questionCount
    );

    return pickedTargets.map((target) => {
      // Kural 1: Soruda fiil varsa çeldiriciler kesinlikle fiil, isim varsa kesinlikle isim
      const distractors = selectSmartVisualDistractors(
        target,
        gorselKelimeler,
        3
      );
      const options = shuffleArray([
        { item: target, isCorrect: true },
        ...distractors.map((d) => ({ item: d, isCorrect: false })),
      ]);
      return { target, options };
    });
  }, [activePool, subMode, questionCount, customRetryPool, quizSeed]);

  const currentQuestion = questions[currentIndex];

  const playQuestionAudio = useCallback(
    async (qItem: ResimliKelime, mode: RosettaSubMode) => {
      if (!qItem) return;
      if (mode === "sentence-to-image" && qItem.ornek_ar) {
        if (qItem.ornek_ses_erkek || qItem.ornek_ses_kadin) {
          await playDualGenderAudio({
            text: qItem.ornek_ar,
            ses_erkek: qItem.ornek_ses_erkek,
            ses_kadin: qItem.ornek_ses_kadin,
            rate: speechRate,
            gender: preferredVoiceGender,
          });
        } else {
          await speakHybrid({
            text: qItem.ornek_ar,
            rate: speechRate,
            voice: preferredVoiceGender,
          });
        }
      } else {
        await playDualGenderAudio({
          text: qItem.arapca,
          id: qItem.id,
          ses_erkek: qItem.ses_erkek,
          ses_kadin: qItem.ses_kadin,
          rate: speechRate,
          gender: preferredVoiceGender,
        });
      }
    },
    [speechRate, preferredVoiceGender]
  );

  // Yeni soru açıldığında (Mod A ve Mod C'de) sesi otomatik çal
  useEffect(() => {
    if (isFinished || !currentQuestion) return;
    if (subMode === "listen-to-image" || subMode === "sentence-to-image") {
      const timer = setTimeout(() => {
        void playQuestionAudio(currentQuestion.target, subMode);
      }, 180);
      return () => {
        clearTimeout(timer);
        stopAllAudio();
      };
    }
    return () => {
      stopAllAudio();
    };
  }, [currentIndex, subMode, isFinished, currentQuestion, playQuestionAudio]);

  const handleSelectOption = (option: {
    item: ResimliKelime;
    isCorrect: boolean;
  }) => {
    if (selectedOptionId !== null || !currentQuestion) return;
    setSelectedOptionId(option.item.id);

    if (option.isCorrect) {
      playSuccess();
      setScore((s) => s + 1);
      recordItemAttempt(
        currentQuestion.target.id,
        "word",
        true,
        false,
        100,
        "Rosetta Görsel Eşleştirme"
      );
      void playDualGenderAudio({
        text: currentQuestion.target.arapca,
        id: currentQuestion.target.id,
        ses_erkek: currentQuestion.target.ses_erkek,
        ses_kadin: currentQuestion.target.ses_kadin,
        rate: speechRate,
        gender: preferredVoiceGender,
      });
    } else {
      playError();
      addMistake(currentQuestion.target.id);
      recordItemAttempt(
        currentQuestion.target.id,
        "word",
        false,
        false,
        0,
        "Rosetta Görsel Eşleştirmede karıştırıldı"
      );
      setWrongItems((prev) =>
        prev.some((w) => w.id === currentQuestion.target.id)
          ? prev
          : [...prev, currentQuestion.target]
      );
    }
  };

  const handleNextQuestion = () => {
    playClick();
    stopAllAudio();
    if (currentIndex + 1 < questions.length) {
      setSelectedOptionId(null);
      setCurrentIndex((i) => i + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handleRestart = (onlyWrong = false) => {
    playClick();
    stopAllAudio();
    if (onlyWrong && wrongItems.length > 0) {
      setCustomRetryPool([...wrongItems]);
    } else {
      setCustomRetryPool(null);
    }
    setWrongItems([]);
    setScore(0);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setIsFinished(false);
    setQuizSeed((s) => s + 1);
  };

  if (!currentQuestion && !isFinished) {
    return null;
  }

  // BİTİŞ EKRANI
  if (isFinished) {
    const percent =
      questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-5 sm:p-8 text-center space-y-5 max-w-2xl mx-auto">
        <ShareAchievementModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          title="Görsel & Sesli Eşleştirme (Rosetta Modu)"
          arabicTitle="التَّعَلُّمُ الْبَصَرِيُّ وَالصَّوْتِيُّ"
          subtitle={`${questions.length} Soruda ${score} Doğru Cevap`}
          levelLabel={
            cefrFilter === "all" ? "Tüm Kurlar (A1-B2)" : `Seviye ${cefrFilter}`
          }
          scorePercent={percent}
          wordsCount={questions.length}
          badgeType="exercise"
        />

        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 border-2 border-[#087F5B] flex items-center justify-center mx-auto text-[#087F5B]">
          <Trophy size={32} />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--foreground)]">
            Görsel Eşleştirme Tamamlandı!
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
            Toplam <strong>{questions.length}</strong> sorudan{" "}
            <strong className="text-[#087F5B]">{score}</strong> doğru yaptınız (
            <strong>%{percent}</strong> başarı).
          </p>
        </div>

        {wrongItems.length > 0 && (
          <div className="bg-white/85 dark:bg-[var(--background)] rounded-2xl border-2 border-amber-300 p-4 text-left space-y-2.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
              ⚡ Tekrar Edilecek Kelimeler ({wrongItems.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {wrongItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE]"
                >
                  <img
                    src={getVisualWordCoverUrl(item)}
                    alt={item.turkce}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 aspect-square rounded-lg object-cover border border-[#E6D7BE] bg-white shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      dir="rtl"
                      className="arabic font-arabic text-lg font-bold text-[#065F46] dark:text-emerald-400 truncate"
                    >
                      {getDisplayArabic(item.arapca)}
                    </p>
                    <p className="text-xs font-bold text-[var(--foreground)] truncate">
                      {item.turkce}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {wrongItems.length > 0 && (
            <button
              type="button"
              onClick={() => handleRestart(true)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-extrabold border-b-3 border-amber-800 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>Yanlışlarımı Tekrarla ({wrongItems.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleRestart(false)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold border-b-3 border-[#065F46] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>Yeni Test Başlat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              setIsShareOpen(true);
            }}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs sm:text-sm font-extrabold border-b-3 border-indigo-900 flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 size={15} />
            <span>🏆 Başarı Kartı Paylaş</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] text-xs sm:text-sm font-extrabold text-[var(--foreground)] cursor-pointer"
          >
            Merkeze Dön
          </button>
        </div>
      </div>
    );
  }

  const target = currentQuestion.target;
  const posType = normalizeWordPartOfSpeech(target.tur);
  const isAnswered = selectedOptionId !== null;
  const forms: { label: string; arabic: string }[] = [
    { label: "Temel Form", arabic: target.arapca },
  ];
  if (target.ikincil_form && target.ikincil_form !== "-") {
    forms.push({ label: "Çoğul / Muzâri", arabic: target.ikincil_form });
  }
  if (target.ucuncul_form && target.ucuncul_form !== "-") {
    forms.push({ label: "Masdar", arabic: target.ucuncul_form });
  }

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {shadowingTarget && (
        <ShadowingModal
          text={shadowingTarget.text}
          refAudioUrl={shadowingTarget.refAudioUrl}
          forms={shadowingTarget.forms}
          onClose={() => setShadowingTarget(null)}
        />
      )}

      {/* ÜST MOD VE İLERLEME BARI */}
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold tabular-nums">
              Soru {currentIndex + 1} / {questions.length}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-xs font-extrabold text-[#065F46] dark:text-emerald-400 tabular-nums">
              ✓ {score} Doğru
            </span>
            <span
              className={`px-2.5 py-1 rounded-xl border text-xs font-extrabold ${
                posType === "fiil"
                  ? "bg-amber-100 border-amber-300 text-amber-900"
                  : "bg-sky-100 border-sky-300 text-sky-900"
              }`}
            >
              {posType === "fiil" ? "⚡ Fiil (4 Şık Fiil)" : "📘 İsim (4 Şık İsim)"}
            </span>
          </div>

          {/* Hızlı Erkek / Kadın Seslendirici Seçici */}
          <div className="flex items-center gap-1 bg-white dark:bg-[var(--background)] px-2 py-1 rounded-xl border border-[#E6D7BE]">
            <UserCheck size={13} className="text-[#087F5B]" />
            {(
              [
                { id: "erkek", label: "👨 Erkek" },
                { id: "kadin", label: "👩 Kadın" },
              ] as { id: VoiceGender; label: string }[]
            ).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  playClick();
                  setPreferredVoiceGender(g.id);
                }}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                  preferredVoiceGender === g.id
                    ? "bg-[#087F5B] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3 Alt Mod Seçicisi */}
        <div className="grid grid-cols-3 gap-1.5 bg-white/80 dark:bg-[var(--background)] p-1 rounded-xl border border-[#E6D7BE]">
          {(
            [
              {
                id: "listen-to-image",
                label: "🎧 Dinle & Görseli Seç",
                icon: Headphones,
              },
              {
                id: "image-to-arabic",
                label: "🖼️ Görselden Arapça",
                icon: ImageIcon,
              },
              {
                id: "sentence-to-image",
                label: "🗣️ Cümleden Görsel",
                icon: MessageSquare,
              },
            ] as { id: RosettaSubMode; label: string; icon: typeof Headphones }[]
          ).map((m) => {
            const active = subMode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  playClick();
                  setSubMode(m.id);
                  setSelectedOptionId(null);
                }}
                className={`min-h-[38px] px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  active
                    ? "bg-[#6741D9] text-white shadow-2xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon size={13} className="shrink-0 hidden sm:inline" />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SORU KARTI */}
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-5 space-y-4">
        {/* MOD A & MOD C: ÜSTTE SES + ARAPÇA KELİME VEYA ÖRNEK CÜMLE */}
        {(subMode === "listen-to-image" || subMode === "sentence-to-image") && (
          <div className="bg-white/90 dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] p-4 flex flex-col items-center text-center space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  void playQuestionAudio(target, subMode);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold border-b-3 border-[#065F46] flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Volume2 size={18} />
                <span>
                  {subMode === "sentence-to-image"
                    ? "🔊 Örnek Cümleyi Tekrar Dinle"
                    : "🔊 Kelimeyi Tekrar Dinle"}
                </span>
              </button>

              {subMode === "listen-to-image" && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setAudioOnlyMode((v) => !v);
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
                    audioOnlyMode
                      ? "bg-[#6741D9] border-[#5230B5] text-white"
                      : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] text-[var(--foreground)]"
                  }`}
                >
                  {audioOnlyMode ? <Eye size={14} /> : <EyeOff size={14} />}
                  <span>
                    {audioOnlyMode ? "Yazıyı Göster" : "🙈 Sadece Sesle Çöz"}
                  </span>
                </button>
              )}
            </div>

            {!audioOnlyMode || isAnswered ? (
              <div
                dir="rtl"
                className="arabic font-arabic text-3xl sm:text-4xl font-bold text-[#065F46] dark:text-emerald-400 leading-[1.85]"
              >
                {subMode === "sentence-to-image" ? (
                  <WordTooltip
                    text={target.ornek_ar || target.arapca}
                    contextSentenceTr={target.ornek_tr || target.turkce}
                  />
                ) : (
                  <WordTooltip
                    text={target.arapca}
                    contextSentenceTr={target.turkce}
                  />
                )}
              </div>
            ) : (
              <p className="text-xs font-bold text-[#6741D9] py-2">
                🎧 Sesi dinleyerek doğru kare görsele dokunun
              </p>
            )}
          </div>
        )}

        {/* MOD B: ÜSTTE 1:1 KARE GÖRSEL */}
        {subMode === "image-to-arabic" && (
          <div className="flex flex-col items-center space-y-2">
            <div className="relative aspect-square w-48 sm:w-56 mx-auto rounded-2xl overflow-hidden border-2 border-[#E6D7BE] bg-white shadow-sm">
              <img
                src={getVisualWordCoverUrl(target)}
                alt="Görsel Soru"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-[#087F5B] text-white text-[10px] font-extrabold">
                {target.cefr} • {target.kategori_tr}
              </span>
            </div>
            {target.soru_kalibi && (
              <div
                dir="rtl"
                className="arabic font-arabic text-xl font-bold text-[#6741D9] dark:text-indigo-300"
              >
                {getDisplayArabic(target.soru_kalibi)}
              </div>
            )}
          </div>
        )}

        {/* ŞIKLAR: MOD A & C İÇİN 2x2 KARE GÖRSEL IZGARASI */}
        {(subMode === "listen-to-image" || subMode === "sentence-to-image") && (
          <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
            {currentQuestion.options.map((opt, idx) => {
              const isPicked = selectedOptionId === opt.item.id;
              let borderStyle =
                "border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] bg-white";
              if (isAnswered) {
                if (opt.isCorrect) {
                  borderStyle =
                    "border-[#087F5B] ring-4 ring-[#087F5B]/40 bg-emerald-50";
                } else if (isPicked && !opt.isCorrect) {
                  borderStyle =
                    "border-rose-500 ring-4 ring-rose-500/30 bg-rose-50 opacity-85";
                } else {
                  borderStyle = "border-[#E6D7BE] opacity-55 bg-white";
                }
              }

              return (
                <button
                  key={opt.item.id}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(opt)}
                  className={`relative aspect-square w-full rounded-2xl border-2 border-b-4 overflow-hidden transition-all cursor-pointer group ${borderStyle}`}
                >
                  <img
                    src={getVisualWordCoverUrl(opt.item)}
                    alt={`Seçenek ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-200"
                  />
                  <span className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/65 text-white text-xs font-black flex items-center justify-center">
                    {["A", "B", "C", "D"][idx]}
                  </span>

                  {isAnswered && (
                    <div
                      className={`absolute inset-x-0 bottom-0 p-2 text-center backdrop-blur-xs ${
                        opt.isCorrect
                          ? "bg-[#087F5B]/90 text-white"
                          : isPicked
                          ? "bg-rose-600/90 text-white"
                          : "bg-black/70 text-white"
                      }`}
                    >
                      <p
                        dir="rtl"
                        className="arabic font-arabic text-base sm:text-lg font-bold leading-tight"
                      >
                        {getDisplayArabic(opt.item.arapca)}
                      </p>
                      <p className="text-[11px] font-extrabold truncate">
                        {opt.item.turkce}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ŞIKLAR: MOD B İÇİN 4 SESLİ ARAPÇA SEÇENEK */}
        {subMode === "image-to-arabic" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentQuestion.options.map((opt, idx) => {
              const isPicked = selectedOptionId === opt.item.id;
              let cardClass =
                "bg-white dark:bg-[var(--background)] border-[#E6D7BE] hover:border-[#6741D9]";
              if (isAnswered) {
                if (opt.isCorrect) {
                  cardClass =
                    "bg-emerald-50 dark:bg-emerald-950/60 border-[#087F5B] ring-2 ring-[#087F5B]";
                } else if (isPicked && !opt.isCorrect) {
                  cardClass =
                    "bg-rose-50 dark:bg-rose-950/60 border-rose-500";
                } else {
                  cardClass =
                    "bg-white/60 dark:bg-[var(--background)] border-[#E6D7BE] opacity-60";
                }
              }

              return (
                <div
                  key={opt.item.id}
                  onClick={() => {
                    if (!isAnswered) handleSelectOption(opt);
                  }}
                  className={`min-h-[64px] p-3 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-2.5 transition-all ${
                    isAnswered ? "" : "cursor-pointer"
                  } ${cardClass}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#F7EFE1] dark:bg-slate-800 text-xs font-black flex items-center justify-center shrink-0">
                      {["A", "B", "C", "D"][idx]}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playClick();
                        void playDualGenderAudio({
                          text: opt.item.arapca,
                          id: opt.item.id,
                          ses_erkek: opt.item.ses_erkek,
                          ses_kadin: opt.item.ses_kadin,
                          rate: speechRate,
                          gender: preferredVoiceGender,
                        });
                      }}
                      title="Şıkkı Dinle"
                      className="w-9 h-9 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] hover:border-[#087F5B] flex items-center justify-center text-[#087F5B] shrink-0 cursor-pointer"
                    >
                      <Volume2 size={15} />
                    </button>
                  </div>

                  <div className="flex-1 text-right min-w-0">
                    <p
                      dir="rtl"
                      className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-400 leading-normal"
                    >
                      {getDisplayArabic(opt.item.arapca)}
                    </p>
                    {isAnswered && (
                      <p className="text-xs font-extrabold text-[var(--foreground)]">
                        {opt.item.turkce}
                      </p>
                    )}
                  </div>

                  {isAnswered && opt.isCorrect && (
                    <Check size={18} className="text-[#087F5B] shrink-0" />
                  )}
                  {isAnswered && isPicked && !opt.isCorrect && (
                    <X size={18} className="text-rose-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CEVAP SONRASI PEDAGOJİK GERİ BİLDİRİM & DEVAM BUTONU */}
        {isAnswered && (
          <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/50 border-2 border-[#087F5B] p-3.5 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#087F5B] dark:text-emerald-300 block">
                  {selectedOptionId === target.id
                    ? "✓ Harika! Doğru Eşleştirme"
                    : "💡 Doğru Kelime & Anlamı"}
                </span>
                <p className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                  {target.turkce}{" "}
                  <span
                    dir="rtl"
                    className="arabic font-arabic text-xl font-bold text-[#065F46] dark:text-emerald-400 mx-1"
                  >
                    ({getDisplayArabic(target.arapca)})
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setShadowingTarget({
                      text: target.arapca,
                      refAudioUrl: getDualGenderAudioUrl(
                        target,
                        preferredVoiceGender
                      ),
                      forms,
                    });
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F3F0FF] border-2 border-[#6741D9] text-[#6741D9] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <Mic size={14} />
                  <span>Telaffuz Et</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold border-b-3 border-[#065F46] flex items-center gap-1.5 cursor-pointer"
                >
                  <span>
                    {currentIndex + 1 < questions.length
                      ? "Sonraki Soru"
                      : "Sonuçları Gör"}
                  </span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {target.ornek_ar && (
              <div className="bg-white/85 dark:bg-[var(--background)] rounded-xl p-2.5 border border-[#E6D7BE] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    void playQuestionAudio(target, "sentence-to-image");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#087F5B]/15 text-[#065F46] dark:text-emerald-300 text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Volume2 size={13} />
                  <span>Cümle</span>
                </button>
                <div className="text-right flex-1 min-w-0">
                  <div
                    dir="rtl"
                    className="arabic font-arabic text-lg font-bold text-[var(--foreground)]"
                  >
                    <WordTooltip
                      text={target.ornek_ar}
                      contextSentenceTr={target.ornek_tr || target.turkce}
                    />
                  </div>
                  {target.ornek_tr && (
                    <p className="text-xs font-semibold text-[var(--muted)]">
                      {target.ornek_tr}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
