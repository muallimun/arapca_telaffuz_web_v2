"use client";

import React, { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import {
  Play,
  Square,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Heart,
  CheckCircle2,
  Mic,
  Sparkles,
  Maximize2,
  X,
  HelpCircle,
  Eye,
  Headphones,
  Share2,
  Check,
  XCircle,
} from "lucide-react";
import {
  metinler,
  getReadingTextById,
  getReadingTextCoverUrl,
  getReadingTextGrammarNote,
} from "@/lib/data";
import {
  hasMp3,
  getMp3Path,
  speakHybrid,
} from "@/lib/audio";
import { useAudioStore } from "@/store/audioStore";
import { useSettings, ViewMode } from "@/store/settings";
import { useUserStore } from "@/store/userStore";
import { playClick, playSuccess, playError } from "@/lib/sfxManager";
import WordTooltip from "@/components/ui/WordTooltip";
import ShadowingModal from "@/components/ui/ShadowingModal";
import ShadowingButton from "@/components/ui/ShadowingButton";
import ShareAchievementModal from "@/components/ui/ShareAchievementModal";
import {
  GrammarHapBilgiPanel,
  GrammarHapBilgiModal,
} from "@/components/ui/GrammarHapBilgiPanel";
import {
  getReadingTextVocabulary,
  DialogueVocabularyEntry,
  getWordCategory,
} from "@/lib/dict";
import { ReadingTextLine, DictionaryItem } from "@/types/data";
import { formatArabicText, splitMixedBidiText } from "@/lib/arabicTextUtils";

type TextStudyMode =
  | "listen"
  | "shadowing"
  | "questions"
  | "gramer"
  | "vocabulary";

export default function ReadingTextDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const rawText = getReadingTextById(resolvedParams.id);
  const readingText = rawText ?? metinler[0];

  const {
    stop,
    playAudio,
    playTTS,
    setPlaybackRate,
    playingLineId,
    activeWordIndex,
    activeWordProgress,
  } = useAudioStore();

  const {
    viewMode,
    setViewMode,
    showHareke,
    toggleHareke,
    arabicFont,
    arabicFontSize,
    turkishFontSize,
    speechRate,
    setSpeechRate,
    preferredVoiceGender,
  } = useSettings();

  const {
    toggleFavoriteDialogue,
    isDialogueFavorite,
    toggleCompletedDialogue,
    isDialogueCompleted,
    toggleFavoriteWord,
    isWordFavorite,
    toggleLearnedWord,
    isWordLearned,
  } = useUserStore();

  const [mounted, setMounted] = useState(false);
  const [studyMode, setStudyMode] = useState<TextStudyMode>("listen");
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isGrammarModalOpen, setIsGrammarModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [blindListeningMode, setBlindListeningMode] = useState(false);
  const [listenedLines, setListenedLines] = useState<Record<number, boolean>>({});
  const [revealedLines, setRevealedLines] = useState<Record<number, boolean>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [selectedQuestionChoice, setSelectedQuestionChoice] = useState<
    Record<number, number>
  >({});

  const [shadowingTarget, setShadowingTarget] = useState<{
    text: string;
    itemId?: string;
    audioUrl?: string;
    forms?: { label: string; arabic: string }[];
  } | null>(null);

  const playToken = useRef(0);
  const lineRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => {
      cancelAnimationFrame(raf);
      playToken.current += 1;
      stop();
    };
  }, [resolvedParams.id, stop]);

  useEffect(() => {
    if (playingLineId !== null && lineRefs.current[playingLineId]) {
      lineRefs.current[playingLineId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [playingLineId]);

  const currentIndex = metinler.findIndex((m) => m.id === readingText.id);
  const prevText = currentIndex > 0 ? metinler[currentIndex - 1] : null;
  const nextText =
    currentIndex < metinler.length - 1 ? metinler[currentIndex + 1] : null;

  const rawNum = parseInt(readingText.id.replace(/\D+/g, ""), 10) || 1;
  const imagePath = readingText.gorsel || getReadingTextCoverUrl(readingText.id);
  const grammarNote = getReadingTextGrammarNote(readingText.id);
  const vocabEntries: DialogueVocabularyEntry[] = useMemo(
    () => getReadingTextVocabulary(readingText.id),
    [readingText.id]
  );

  // Çoktan seçmeli anlama soruları için deterministik 4 şık üretimi
  const questionChoicesList = useMemo(() => {
    const questions = readingText.sorular || [];
    const fallbackPool = metinler
      .flatMap((m) => m.sorular || [])
      .filter((q) => q.cevap_ar && q.cevap_tr);

    return questions.map((q, qIdx) => {
      const otherAnswers = [
        ...questions.filter((_, i) => i !== qIdx),
        ...fallbackPool.filter((fq) => fq.cevap_ar !== q.cevap_ar),
      ];
      const distractors: { ar: string; tr: string; isCorrect: boolean }[] = [];
      const seen = new Set<string>([q.cevap_ar]);
      const startOffset = (rawNum * 3 + qIdx * 5) % Math.max(1, otherAnswers.length);

      for (let i = 0; i < otherAnswers.length && distractors.length < 3; i++) {
        const cand = otherAnswers[(startOffset + i) % otherAnswers.length];
        if (cand && !seen.has(cand.cevap_ar)) {
          seen.add(cand.cevap_ar);
          distractors.push({
            ar: cand.cevap_ar,
            tr: cand.cevap_tr,
            isCorrect: false,
          });
        }
      }

      const rawChoices = [
        { ar: q.cevap_ar, tr: q.cevap_tr, isCorrect: true },
        ...distractors,
      ];

      // Deterministik karıştırma
      const rotated: typeof rawChoices = [];
      const shift = (rawNum + qIdx) % rawChoices.length;
      for (let i = 0; i < rawChoices.length; i++) {
        rotated.push(rawChoices[(i + shift) % rawChoices.length]);
      }
      return rotated;
    });
  }, [readingText.sorular, rawNum]);

  if (!rawText) return notFound();

  const isFav = mounted ? isDialogueFavorite(readingText.id) : false;
  const isCompleted = mounted ? isDialogueCompleted(readingText.id) : false;
  const currentViewMode: ViewMode = mounted ? viewMode : "stacked";

  const getDisplayText = (text: string) =>
    formatArabicText(text, !mounted || showHareke, arabicFont);

  const playLine = async (line: ReadingTextLine, autoAdvance = false) => {
    const currentToken = playToken.current;
    setListenedLines((prev) => ({ ...prev, [line.sira]: true }));
    const lineHasMp3 = hasMp3(readingText.id, line.sira);
    const lineAudioUrl = lineHasMp3
      ? getMp3Path(readingText.id, line.sira)
      : undefined;

    if (lineHasMp3 && lineAudioUrl) {
      await playAudio(lineAudioUrl, line.sira, speechRate, line.arapca);
    } else {
      await playTTS(
        line.arapca,
        line.sira,
        speechRate,
        preferredVoiceGender === "kadin"
          ? "ar-SA-ZariyahNeural"
          : "ar-SA-HamedNeural"
      );
    }

    if (playToken.current !== currentToken) return;

    if (autoAdvance) {
      const nextLine = readingText.satirlar.find(
        (s) => s.sira === line.sira + 1
      );
      if (nextLine) {
        await new Promise((r) => setTimeout(r, 320));
        if (playToken.current !== currentToken) return;
        await playLine(nextLine, true);
      } else {
        setIsPlayingAll(false);
        stop();
      }
    }
  };

  const handlePlaySingleLine = (line: ReadingTextLine) => {
    playClick();
    if (playingLineId === line.sira && !isPlayingAll) {
      playToken.current += 1;
      stop();
      return;
    }
    playToken.current += 1;
    stop();
    setIsPlayingAll(false);
    void playLine(line, false);
  };

  const handleTogglePlayAll = () => {
    playClick();
    if (isPlayingAll) {
      playToken.current += 1;
      stop();
      setIsPlayingAll(false);
    } else {
      playToken.current += 1;
      stop();
      setIsPlayingAll(true);
      if (readingText.satirlar.length > 0) {
        void playLine(readingText.satirlar[0], true);
      }
    }
  };

  const openShadowingCoach = (target: {
    text: string;
    itemId?: string;
    audioUrl?: string;
    forms?: { label: string; arabic: string }[];
  }) => {
    playToken.current += 1;
    stop();
    setIsPlayingAll(false);
    setShadowingTarget(target);
  };

  const prepareWordForms = (word: DictionaryItem) => {
    const forms: { label: string; arabic: string }[] = [];
    if (word.tur === "isim") {
      if (word.mufret)
        forms.push({
          label: "Müfret (Tekil)",
          arabic: word.mufret.split("/")[0].trim(),
        });
      if (word.cemi && word.cemi !== "-")
        forms.push({
          label: "Cemî (Çoğul)",
          arabic: word.cemi.split("/")[0].trim(),
        });
    } else if (word.tur === "fiil") {
      if (word.mazi)
        forms.push({
          label: "Mâzî (Geçmiş)",
          arabic: word.mufret || word.mazi.split("/")[0].trim(),
        });
      if (word.muzari)
        forms.push({
          label: "Muzâri (Şimdiki)",
          arabic: word.muzari.split("/")[0].trim(),
        });
      if (word.masdar)
        forms.push({
          label: "Masdar (İsim)",
          arabic: word.masdar.split("/")[0].trim(),
        });
    }
    return forms.length > 0 ? forms : undefined;
  };

  const handleCompleteAndContinue = () => {
    playClick();
    if (!isDialogueCompleted(readingText.id)) {
      toggleCompletedDialogue(readingText.id);
      playSuccess();
    }
    if (nextText) {
      router.push(`/metin/${nextText.id}`);
    } else {
      router.push("/kutuphane?tab=metinler");
    }
  };

  const viewModeOptions: { id: ViewMode; label: string }[] = [
    { id: "stacked", label: "Alt Alta" },
    { id: "columns", label: "İki Sütun" },
    { id: "arabic-only", label: "Sadece Arapça" },
    { id: "turkish-only", label: "Sadece Türkçe" },
    { id: "click-reveal", label: "Tıkla-Gör" },
  ];

  return (
    <div className="space-y-3 pb-28 md:pb-10">
      {/* GÖLGELEME VE TELAFFUZ KOÇU MODALI */}
      {shadowingTarget && (
        <ShadowingModal
          text={shadowingTarget.text}
          itemId={shadowingTarget.itemId}
          refAudioUrl={shadowingTarget.audioUrl}
          forms={shadowingTarget.forms}
          level={readingText.seviye}
          onClose={() => setShadowingTarget(null)}
        />
      )}

      {/* ODAK GRAMER & HAP BİLGİ HIZLI MODALI */}
      {grammarNote && (
        <GrammarHapBilgiModal
          isOpen={isGrammarModalOpen}
          onClose={() => setIsGrammarModalOpen(false)}
          grammarNote={grammarNote}
          onOpenShadowing={(ar) => openShadowingCoach({ text: ar })}
        />
      )}

      {/* BAŞARI KARTI PAYLAŞIM MODALI */}
      <ShareAchievementModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={readingText.baslik_tr}
        arabicTitle={readingText.baslik_ar}
        subtitle={`Okuma Metni #${String(rawNum).padStart(2, "0")} Tamamlandı`}
        levelLabel={`Seviye ${readingText.seviye}`}
        scorePercent={100}
        wordsCount={vocabEntries.length}
        badgeType="dialogue"
        dialogueId={readingText.id}
      />

      {/* LIGHTBOX KAPAK GÖRSELİ */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-3xl w-full bg-[#FDFBF7] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] border-b-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-black/5">
              <img
                src={imagePath}
                alt={readingText.baslik_tr}
                referrerPolicy="no-referrer"
                className="w-full max-h-[70vh] object-contain mx-auto"
              />
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="absolute top-3 right-3 h-9 px-3.5 rounded-xl bg-black/75 hover:bg-black text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <X size={15} />
                <span>Kapat</span>
              </button>
            </div>
            <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-[#F7EFE1] dark:bg-[var(--background)] border-t border-[#E6D7BE]">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-[#087F5B] text-white font-extrabold text-xs">
                  Metin #{String(rawNum).padStart(2, "0")} • {readingText.seviye}
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)]">
                  {readingText.baslik_tr}
                </h3>
              </div>
              <span
                dir="rtl"
                className="arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-400"
              >
                {getDisplayText(readingText.baslik_ar)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ÜST BİLGİ VE KONTROL KARTI */}
      <section className="relative bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-sm p-2.5 sm:p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2 py-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link
              href="/kutuphane?tab=metinler"
              onClick={() => playClick()}
              title="Okuma Metinlerine Dön"
              className="w-8 h-8 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center justify-center text-[var(--foreground)] hover:border-[#087F5B] shrink-0 transition-all"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </Link>

            <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-extrabold text-[10px] sm:text-[11px] tabular-nums shrink-0">
              Metin #{String(rawNum).padStart(2, "0")} • {readingText.seviye}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap leading-tight">
                <h1 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] truncate">
                  {readingText.baslik_tr}
                </h1>
                <span className="hidden sm:inline text-slate-600 dark:text-slate-300 font-bold">
                  |
                </span>
                <span
                  dir="rtl"
                  className="arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 leading-none"
                >
                  {getDisplayText(readingText.baslik_ar)}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-tight mt-0.5 truncate">
                {readingText.tema
                  ? `${readingText.tema.replace(/_/g, " ")} • `
                  : ""}
                {readingText.satirlar.length} Cümle •{" "}
                {readingText.sorular?.length || 0} Soru • {vocabEntries.length}{" "}
                Kelime
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playClick();
              setIsLightboxOpen(true);
            }}
            title="Görseli Büyüt"
            className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover shrink-0 shadow-xs overflow-hidden border-2 border-white/80 dark:border-slate-700 relative group cursor-pointer"
          >
            <img
              src={imagePath}
              alt={readingText.baslik_tr}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <span className="absolute bottom-0.5 right-0.5 p-1 rounded-md bg-black/65 text-white flex items-center justify-center">
              <Maximize2 size={9} />
            </span>
          </button>
        </div>

        {/* ÇALIŞMA MODU SEKMELERİ */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
          {(
            [
              { id: "listen", label: "📖 Metni Oku & Dinle" },
              { id: "shadowing", label: "🎙️ Telaffuz Stüdyosu" },
              {
                id: "questions",
                label: `❓ Sorular (${readingText.sorular?.length || 0})`,
              },
              ...(grammarNote
                ? [{ id: "gramer" as TextStudyMode, label: "📌 Odak Gramer" }]
                : []),
              {
                id: "vocabulary",
                label: `📚 Sözlük (${vocabEntries.length})`,
              },
            ] as { id: TextStudyMode; label: string }[]
          ).map((tab) => {
            const isSelected = studyMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playClick();
                  setStudyMode(tab.id);
                }}
                className={`text-xs py-1.5 px-2 whitespace-nowrap rounded-lg font-extrabold transition-all text-center cursor-pointer ${
                  isSelected
                    ? "bg-[#6741D9] text-white shadow-2xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] bg-white/60 dark:bg-transparent"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ALT ARAÇ ÇUBUĞU */}
        <div className="pt-1 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleTogglePlayAll}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-xs border-b-2 transition-all flex items-center gap-1 cursor-pointer ${
                isPlayingAll
                  ? "bg-red-600 hover:bg-red-700 text-white border-red-800"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800"
              }`}
            >
              {isPlayingAll ? (
                <Square size={11} fill="currentColor" />
              ) : (
                <Play size={11} fill="currentColor" />
              )}
              <span>{isPlayingAll ? "Durdur" : "Tüm Metni Dinle"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                const nextRate = speechRate === 0.75 ? 1 : 0.75;
                setSpeechRate(nextRate);
                setPlaybackRate(nextRate);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold tabular-nums transition-all cursor-pointer ${
                mounted && speechRate === 0.75
                  ? "bg-[#087F5B] border-[#087F5B] text-white"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
              }`}
            >
              {mounted ? (speechRate === 1 ? "1.0x" : `${speechRate}x`) : "1.0x"}
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                toggleHareke();
              }}
              className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1 text-xs font-extrabold transition-all cursor-pointer ${
                !mounted || showHareke
                  ? "bg-[#087F5B]/15 border-[#087F5B] text-[#065F46] dark:text-emerald-400"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)]"
              }`}
            >
              <Sparkles size={13} />
              <span>Hareke</span>
            </button>

            <select
              value={currentViewMode}
              onChange={(e) => {
                playClick();
                setViewMode(e.target.value as ViewMode);
              }}
              aria-label="Görünüm Modu"
              className="px-2.5 py-1.5 rounded-xl border bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] cursor-pointer"
            >
              {viewModeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  👁️ {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                playClick();
                setBlindListeningMode((v) => !v);
              }}
              className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1 text-xs font-extrabold transition-all cursor-pointer ${
                blindListeningMode
                  ? "bg-[#6741D9] border-[#5230B5] text-white"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)]"
              }`}
              title="Kör Dinleme Modu: Cümle dinlenene kadar metin bulanık kalır"
            >
              <Headphones size={13} />
              <span>Kör Dinleme</span>
            </button>

            {grammarNote && (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setIsGrammarModalOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-100/90 dark:bg-amber-950/60 border border-amber-400 hover:border-amber-600 text-amber-900 dark:text-amber-200 flex items-center gap-1 text-xs font-extrabold transition-all cursor-pointer"
              >
                <span>📌 Hap Bilgi</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                playClick();
                toggleFavoriteDialogue(readingText.id);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                isFav
                  ? "bg-red-50 border-red-300 text-red-600"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)]"
              }`}
            >
              <Heart size={13} fill={isFav ? "currentColor" : "none"} />
              <span className="hidden sm:inline">
                {isFav ? "Favoride" : "Favori"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                toggleCompletedDialogue(readingText.id);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                isCompleted
                  ? "bg-[#F3F0FF] border-[#6741D9] text-[#6741D9]"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)]"
              }`}
            >
              <CheckCircle2 size={13} />
              <span className="hidden sm:inline">
                {isCompleted ? "Tamamlandı" : "Tamamla"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                setIsShareModalOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#6741D9] text-xs font-extrabold text-[#6741D9] flex items-center gap-1 transition-all cursor-pointer"
              title="Başarı Kartı Paylaş"
            >
              <Share2 size={13} />
              <span className="hidden sm:inline">Paylaş</span>
            </button>
          </div>
        </div>
      </section>

      {/* İÇERİK BÖLÜMÜ */}
      {studyMode === "gramer" && grammarNote ? (
        <GrammarHapBilgiPanel
          grammarNote={grammarNote}
          onOpenShadowing={(ar) => openShadowingCoach({ text: ar })}
        />
      ) : studyMode === "questions" ? (
        <section className="space-y-4">
          <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#6741D9]/15 border border-[#6741D9]/30 flex items-center justify-center text-[#6741D9]">
                <HelpCircle size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                  Okuduğunu Anlama Soruları (أسئلة الفهم والاستيعاب)
                </h2>
                <p className="text-xs font-semibold text-[var(--muted)]">
                  Soruları sesli dinleyin, doğru şıkkı seçerek kendinizi test edin veya kelimelerin üzerine tıklayarak kök analizini inceleyin.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            {(readingText.sorular || []).map((q, idx) => {
              const isRevealed = Boolean(revealedAnswers[idx]);
              const choices = questionChoicesList[idx] || [];
              const selectedChoiceIdx = selectedQuestionChoice[idx];
              const hasSelected = selectedChoiceIdx !== undefined;

              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-5 space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#6741D9] text-white text-xs font-extrabold">
                      Soru #{idx + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          void speakHybrid({
                            text: q.soru_ar,
                            rate: speechRate,
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#087F5B] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 size={13} className="text-[#065F46]" />
                        <span>Soruyu Dinle</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          openShadowingCoach({ text: q.soru_ar });
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/60 border border-[#6741D9]/40 text-[#6741D9] dark:text-indigo-200 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <Mic size={13} />
                        <span>Telaffuz</span>
                      </button>
                    </div>
                  </div>

                  <div
                    dir="rtl"
                    className="arabic font-arabic text-xl sm:text-2xl md:text-3xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[2.1] bg-white/85 dark:bg-[var(--background)] rounded-xl p-3.5 border border-[#E6D7BE]"
                  >
                    <WordTooltip
                      text={q.soru_ar}
                      contextSentenceTr={q.soru_tr}
                    />
                  </div>

                  <p className="text-xs sm:text-sm font-bold text-[var(--foreground)]">
                    🇹🇷 {q.soru_tr}
                  </p>

                  {/* İnteraktif Çoktan Seçmeli Şıklar */}
                  {choices.length > 1 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {choices.map((choice, cIdx) => {
                        const isPicked = selectedChoiceIdx === cIdx;
                        let btnStyle =
                          "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9]";
                        if (hasSelected) {
                          if (choice.isCorrect) {
                            btnStyle =
                              "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200";
                          } else if (isPicked && !choice.isCorrect) {
                            btnStyle =
                              "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-900 dark:text-rose-200";
                          }
                        }
                        return (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => {
                              setSelectedQuestionChoice((prev) => ({
                                ...prev,
                                [idx]: cIdx,
                              }));
                              if (choice.isCorrect) {
                                playSuccess();
                                setRevealedAnswers((prev) => ({
                                  ...prev,
                                  [idx]: true,
                                }));
                              } else {
                                playError();
                              }
                            }}
                            className={`p-3 rounded-xl border-2 border-b-3 text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${btnStyle}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="w-6 h-6 rounded-lg bg-[#F7EFE1] dark:bg-slate-800 text-[11px] font-black flex items-center justify-center shrink-0">
                                {["A", "B", "C", "D"][cIdx]}
                              </span>
                              {hasSelected && choice.isCorrect && (
                                <Check
                                  size={15}
                                  className="text-emerald-600 shrink-0"
                                />
                              )}
                              {hasSelected && isPicked && !choice.isCorrect && (
                                <XCircle
                                  size={15}
                                  className="text-rose-600 shrink-0"
                                />
                              )}
                            </div>
                            <div
                              dir="rtl"
                              className="arabic font-arabic text-lg sm:text-xl font-bold text-right w-full text-[var(--foreground)]"
                            >
                              {getDisplayText(choice.ar)}
                            </div>
                            <span className="text-xs font-semibold text-[var(--muted)]">
                              {choice.tr}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-1">
                    {!isRevealed ? (
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setRevealedAnswers((prev) => ({
                            ...prev,
                            [idx]: true,
                          }));
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold border-b-2 border-emerald-800 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye size={14} />
                        <span>Cevap Analizini Göster</span>
                      </button>
                    ) : (
                      <div className="rounded-xl bg-emerald-50/90 dark:bg-emerald-950/50 border-2 border-emerald-500/60 p-3.5 space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            ✓ Doğru Cevap & Kök Analizi
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                playClick();
                                void speakHybrid({
                                  text: q.cevap_ar,
                                  rate: speechRate,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-400 text-emerald-800 dark:text-emerald-200 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                            >
                              <Volume2 size={12} />
                              <span>Cevabı Dinle</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playClick();
                                openShadowingCoach({ text: q.cevap_ar });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#6741D9] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                            >
                              <Mic size={12} />
                              <span>Cevabı Seslendir</span>
                            </button>
                          </div>
                        </div>

                        <div
                          dir="rtl"
                          className="arabic font-arabic text-xl sm:text-2xl font-bold text-[#1C1E21] dark:text-white text-right leading-[2]"
                        >
                          <WordTooltip
                            text={q.cevap_ar}
                            contextSentenceTr={q.cevap_tr}
                          />
                        </div>

                        <p className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200">
                          {q.cevap_tr}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : studyMode === "vocabulary" ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {vocabEntries.map((entry) => {
            const word = entry.item;
            const isFavWord = mounted && isWordFavorite(word.id);
            const isLearned = mounted && isWordLearned(word.id);
            const mainAr = word.mufret || word.mazi || "";
            const category = getWordCategory(word);

            return (
              <div
                key={word.id}
                className={`rounded-2xl border-2 border-b-4 border-l-4 ${
                  category === "fiil"
                    ? "border-l-amber-500"
                    : category === "edat"
                    ? "border-l-purple-500"
                    : "border-l-sky-500"
                } p-4 flex flex-col justify-between space-y-3 ${
                  isLearned
                    ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9]"
                    : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2 border-b border-dashed border-[#E2D3B8] pb-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-md border text-[10px] font-extrabold bg-white/80 text-[var(--foreground)]">
                        {category === "fiil"
                          ? "⚡ Fiil"
                          : category === "edat"
                          ? "🔗 Edat / Kalıp"
                          : "📘 İsim"}
                      </span>
                      <p className="text-sm font-extrabold text-[var(--foreground)] mt-1">
                        {splitMixedBidiText(word.anlam_tr).map((seg, sIdx) =>
                          seg.isArabic ? (
                            <bdi
                              key={sIdx}
                              dir="rtl"
                              className="arabic font-arabic font-bold inline-block mx-0.5"
                            >
                              {getDisplayText(seg.text)}
                            </bdi>
                          ) : (
                            <span key={sIdx}>{seg.text}</span>
                          )
                        )}
                      </p>
                    </div>
                    <span
                      dir="rtl"
                      className="arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-400"
                    >
                      {getDisplayText(mainAr)}
                    </span>
                  </div>

                  {entry.morphologyNote && (
                    <div className="bg-white dark:bg-[var(--background)] rounded-xl px-3 py-1.5 border border-[#E6D7BE] text-[11px] font-bold text-[#4C28B5] dark:text-[#d0bfff]">
                      Cümle #{entry.lineNumber}: {entry.morphologyNote}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      void speakHybrid({
                        text: mainAr.split("/")[0].trim(),
                        wordId: word.id,
                        rate: speechRate,
                      });
                    }}
                    className="flex-1 h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-3 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 size={14} className="text-[#065F46]" />
                    <span>Dinle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      const forms = prepareWordForms(word);
                      openShadowingCoach({
                        text: forms?.[0]?.arabic || mainAr.split("/")[0].trim(),
                        itemId: word.id,
                        forms,
                      });
                    }}
                    className="h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] border-b-3 text-xs font-extrabold text-[#6741D9] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Mic size={14} />
                    <span>Telaffuz</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      toggleFavoriteWord(word);
                    }}
                    className={`h-9 w-9 rounded-xl border-2 border-b-3 flex items-center justify-center cursor-pointer ${
                      isFavWord
                        ? "bg-red-50 border-red-300 text-red-600"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)]"
                    }`}
                  >
                    <Heart size={14} fill={isFavWord ? "currentColor" : "none"} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      toggleLearnedWord(word.id);
                    }}
                    className={`h-9 w-9 rounded-xl border-2 border-b-3 flex items-center justify-center cursor-pointer ${
                      isLearned
                        ? "bg-[#6741D9] border-[#5230B5] text-white"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)]"
                    }`}
                  >
                    <CheckCircle2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        /* OKUMA METNİ CÜMLELERİ (listen & shadowing modları) */
        <section className="space-y-2.5">
          {readingText.satirlar.map((line) => {
            const isPlaying = playingLineId === line.sira;
            const lineAudioUrl = getMp3Path(readingText.id, line.sira);
            const isBlindHidden =
              blindListeningMode &&
              !listenedLines[line.sira] &&
              !revealedLines[line.sira];
            const isClickRevealHidden =
              currentViewMode === "click-reveal" && !revealedLines[line.sira];

            return (
              <div
                key={line.sira}
                ref={(el) => {
                  lineRefs.current[line.sira] = el;
                }}
                className={`rounded-2xl border-2 border-b-4 p-3.5 sm:p-4 transition-all ${
                  isPlaying
                    ? "bg-emerald-50/95 dark:bg-emerald-950/60 border-[#087F5B] ring-2 ring-[#087F5B]/40"
                    : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B]/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#087F5B] text-white text-xs font-extrabold flex items-center justify-center tabular-nums">
                      {line.sira}
                    </span>
                    <span className="text-xs font-bold text-[var(--muted)]">
                      Paragraf / Cümle #{line.sira}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePlaySingleLine(line)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border-b-2 flex items-center gap-1.5 cursor-pointer transition-all ${
                        isPlaying
                          ? "bg-red-600 text-white border-red-800"
                          : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] hover:border-[#087F5B]"
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square size={12} fill="currentColor" />
                          <span>Durdur</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={14} className="text-[#065F46]" />
                          <span>Dinle</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        openShadowingCoach({
                          text: line.arapca,
                          audioUrl: lineAudioUrl,
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/75 hover:bg-[#e8e2ff] border border-[#6741D9]/50 text-[#6741D9] dark:text-indigo-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Mic size={13} />
                      <span>Mahreç Koçu</span>
                    </button>
                  </div>
                </div>

                {/* Cümle Gövdesi (Alt Alta veya İki Sütun) */}
                <div
                  className={
                    currentViewMode === "columns"
                      ? "grid grid-cols-1 md:grid-cols-2 gap-3 items-start"
                      : "space-y-2.5"
                  }
                >
                  {/* Arapça Metin */}
                  {currentViewMode !== "turkish-only" && (
                    <div
                      dir="rtl"
                      onClick={() => {
                        if (isBlindHidden) {
                          setRevealedLines((prev) => ({
                            ...prev,
                            [line.sira]: true,
                          }));
                        }
                      }}
                      style={{ fontSize: `${arabicFontSize}px` }}
                      className={`arabic font-arabic font-bold text-[#1C1E21] dark:text-white text-right leading-[2.1] bg-white/80 dark:bg-[var(--background)] rounded-xl p-3.5 border border-[#E6D7BE] dark:border-[var(--border)] transition-all ${
                        isBlindHidden
                          ? "blur-sm select-none cursor-pointer"
                          : ""
                      }`}
                    >
                      <WordTooltip
                        text={line.arapca}
                        contextSentenceTr={line.turkce}
                        isLineSpeaking={isPlaying}
                        activeWordIndex={activeWordIndex}
                        activeWordProgress={activeWordProgress}
                      />
                    </div>
                  )}

                  {/* Türkçe Çeviri */}
                  {currentViewMode !== "arabic-only" && (
                    <div
                      onClick={() => {
                        if (isClickRevealHidden || isBlindHidden) {
                          playClick();
                          setRevealedLines((prev) => ({
                            ...prev,
                            [line.sira]: true,
                          }));
                        }
                      }}
                      className={
                        currentViewMode === "columns"
                          ? "bg-white/60 dark:bg-[var(--background)] rounded-xl p-3.5 border border-[#E6D7BE] dark:border-[var(--border)]"
                          : "pl-1"
                      }
                    >
                      {isClickRevealHidden || isBlindHidden ? (
                        <button
                          type="button"
                          className="text-xs font-extrabold text-[#6741D9] underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={13} />
                          <span>Türkçe Çeviriyi Görmek İçin Tıklayın</span>
                        </button>
                      ) : (
                        <p
                          style={{ fontSize: `${turkishFontSize}px` }}
                          className="font-semibold text-slate-700 dark:text-slate-200 leading-relaxed"
                        >
                          {line.turkce}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Telaffuz Stüdyosu Modunda Hızlı 16kHz Kayıt & Karşılaştırma Barı */}
                {studyMode === "shadowing" && (
                  <div className="mt-3 pt-2.5 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                    <ShadowingButton
                      text={line.arapca}
                      onOpenCoach={() =>
                        openShadowingCoach({
                          text: line.arapca,
                          audioUrl: lineAudioUrl,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* ALT TAMAMLAMA VE ÖNCEKİ / SONRAKİ METİN GEÇİŞİ */}
      <section className="space-y-3 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={handleCompleteAndContinue}
            className="sm:col-span-2 py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-2xl border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
          >
            <CheckCircle2 size={20} className="shrink-0" />
            <span>
              {isCompleted
                ? nextText
                  ? `Sonraki Metne Geç (${nextText.baslik_tr})`
                  : "Kütüphaneye Dön"
                : nextText
                ? `Metni Tamamla ve Sonrakine Geç (${nextText.baslik_tr})`
                : "Metni Tamamlandı Olarak İşaretle"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              setIsShareModalOpen(true);
            }}
            className="py-3.5 px-4 bg-[#6741D9] hover:bg-[#5230B5] text-white font-extrabold text-xs sm:text-sm rounded-2xl border-b-4 border-indigo-900 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Share2 size={17} />
            <span>🏆 Başarı Kartı Paylaş</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prevText ? (
            <Link
              href={`/metin/${prevText.id}`}
              onClick={() => playClick()}
              className="w-full p-3 rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 flex items-center gap-2.5 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B] transition-all"
            >
              <ChevronLeft size={18} className="text-[#065F46] shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] text-slate-600 dark:text-slate-300 uppercase">
                  Önceki Okuma Metni
                </span>
                <span className="truncate block">{prevText.baslik_tr}</span>
              </div>
            </Link>
          ) : (
            <div className="hidden sm:block" />
          )}

          {nextText ? (
            <Link
              href={`/metin/${nextText.id}`}
              onClick={() => playClick()}
              className="w-full p-3 rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 flex items-center justify-end gap-2.5 text-xs font-extrabold text-[var(--foreground)] hover:border-[#087F5B] transition-all text-right"
            >
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] text-slate-600 dark:text-slate-300 uppercase">
                  Sonraki Okuma Metni
                </span>
                <span className="truncate block">{nextText.baslik_tr}</span>
              </div>
              <ChevronRight size={18} className="text-[#065F46] shrink-0" />
            </Link>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>
      </section>
    </div>
  );
}
