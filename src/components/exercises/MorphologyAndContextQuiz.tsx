"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Dialogue,
  DictionaryItem,
  Level,
  ResimliKelime,
} from "@/types/data";
import {
  gorselKelimeler,
  sozluk,
  atasozleri,
  cumleler1111,
  resolveImageUrl,
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
import { useCountdown } from "@/lib/useTimer";
import { GrammarQuickModal } from "@/components/ui/GrammarHapBilgiPanel";
import { MixedText } from "@/components/ui/MixedText";
import {
  formatTurkishCategory,
  hasLatinCharacters,
  extractPureArabicFromMixed,
} from "@/lib/arabicTextUtils";
import {
  Volume2,
  CheckCircle2,
  XCircle,
  Trophy,
  RefreshCcw,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  GitBranch,
  Repeat,
  HelpCircle,
  Lightbulb,
  Shuffle,
  Flame,
  Timer,
  BookOpen,
  Layers,
} from "lucide-react";

export type WorkshopSubMode =
  | "mixed"
  | "root_hunter"
  | "morphology_transform"
  | "question_prompt_match"
  | "context_proverb_grammar";

interface MorphologyOption {
  id: string;
  arabic: string;
  turkish: string;
  rootFormatted?: string;
  morphBadge?: string;
  isCorrect: boolean;
  isGrammarPatternOption?: boolean;
  sampleArabic?: string;
  audioItem?: {
    id?: string;
    ses_erkek?: string;
    ses_kadin?: string;
  };
}

interface RootSiblingItem {
  id: string;
  arabic: string;
  turkish: string;
  posLabel: string;
  ses_erkek?: string;
  ses_kadin?: string;
}

interface WorkshopQuestion {
  id: string;
  subMode: Exclude<WorkshopSubMode, "mixed">;
  badgeTitle: string;
  promptTitleTr: string;
  promptSubtitleTr?: string;
  /** Üstte gösterilen ana Arapça rozet/ifade (Kök harfler, Müfret/Mâzî kelime, Soru kalıbı veya Cümle) */
  heroArabic?: string;
  heroTurkish?: string;
  /** 1:1 kare görsel (Mod 2, Mod 3, Mod 4 Atasözü) */
  imageUrl?: string;
  /** Seslendirme bilgisi */
  heroAudio?: {
    text: string;
    id?: string;
    ses_erkek?: string;
    ses_kadin?: string;
  };
  /** Mod 1: Kök ailesi kardeş kelimeler özeti */
  rootKeyDisplay?: string;
  rootFamily?: RootSiblingItem[];
  /** Mod 2: Sarf dönüşüm şeması */
  morphChain?: {
    posLabel: string;
    steps: { label: string; arabic: string }[];
  };
  /** Mod 3: Örnek cümle */
  exampleSentence?: {
    arabic: string;
    turkish: string;
    id?: string;
    ses_erkek?: string;
    ses_kadin?: string;
  };
  /** Mod 4: Atasözü lafzi çevirisi veya 1111 Cümle Gramer Başlığı */
  proverbMeta?: {
    literalTr: string;
    contextTr: string;
    proverbArabic: string;
    proverbTurkish: string;
  };
  grammarTopicToOpen?: string;
  grammarSourceId?: string;
  options: MorphologyOption[];
}

interface MorphologyAndContextQuizProps {
  visualPool?: ResimliKelime[];
  vocabulary?: DictionaryItem[];
  dialogues?: Dialogue[];
  cefrFilter?: "all" | Level;
  questionCount?: number;
  timeLimit?: number | null;
  initialSubMode?: WorkshopSubMode;
  onClose?: () => void;
}

const QUESTION_PROMPT_TR_MAP: Record<string, string> = {
  "مَا هَذَا؟": "Bu nedir? (Müzekker / Eril Nesne veya Kavram)",
  "مَا هَذِهِ؟": "Bu nedir? (Müennes / Dişil Nesne veya Kavram)",
  "مَنْ هَذَا؟": "Bu kimdir? (Müzekker / Eril Kişi veya Meslek)",
  "مَنْ هَذِهِ؟": "Bu kimdir? (Müennes / Dişil Kişi veya Meslek)",
  "مَاذَا يَفْعَلُ؟": "Ne yapıyor? (Eylem / Fiil)",
  "كَيْفَ يَبْدُو؟": "Nasıl görünüyor? (Sıfat / Nitelik / Durum)",
};

function normalizeRootKey(rawRoot?: string): string {
  if (!rawRoot || rawRoot === "-") return "";
  const letters = (rawRoot.match(/[\u0621-\u064A]/g) || []).join("");
  return letters.length >= 2 ? letters : "";
}

function formatRootBadge(rawRoot?: string): string {
  const key = normalizeRootKey(rawRoot);
  if (!key) return "-";
  return key.split("").join(" - ");
}

function formatPosLabel(rawTur?: string): string {
  const t = (rawTur || "").toLowerCase().trim();
  if (t === "fiil") return "Fiil";
  if (t === "sifat" || t === "sıfat") return "Sıfat";
  if (t === "isim") return "İsim";
  if (t === "ifade") return "Kalıp İfade";
  return "İsim";
}

function isValidMorphForm(val?: string): boolean {
  if (!val) return false;
  const clean = val.trim();
  return clean.length > 0 && clean !== "-" && clean !== "—";
}

export default function MorphologyAndContextQuiz({
  visualPool = [],
  vocabulary = [],
  cefrFilter = "all",
  questionCount = 10,
  timeLimit = null,
  initialSubMode = "mixed",
  onClose,
}: MorphologyAndContextQuizProps) {
  const { preferredVoiceGender, speechRate } = useSettings();
  const { recordItemAttempt, addMistake, addStudyMinutes } = useUserStore();

  const [subMode, setSubMode] = useState<WorkshopSubMode>(initialSubMode);
  const [sessionSeed, setSessionSeed] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [grammarModalTopic, setGrammarModalTopic] = useState<{
    topic: string;
    sourceId?: string;
  } | null>(null);
  const [showLiteralHint, setShowLiteralHint] = useState<boolean>(false);
  const [expandedScopeKey, setExpandedScopeKey] = useState<string | null>(null);

  const currentScopeKey = `${cefrFilter}::${subMode}`;
  const isScopeExpanded = expandedScopeKey === currentScopeKey;

  const fanfarePlayedRef = useRef(false);

  // Kök Ailesi (Müştakât) Haritası: gorselKelimeler + sozluk üzerinden tüm kök grupları
  const rootGroupsMap = useMemo(() => {
    const map = new Map<string, RootSiblingItem[]>();

    const addEntry = (item: {
      id: string;
      kok?: string;
      arabic?: string;
      turkish?: string;
      tur?: string;
      ses_erkek?: string;
      ses_kadin?: string;
    }) => {
      const rKey = normalizeRootKey(item.kok);
      const ar = (item.arabic || "").trim();
      const tr = (item.turkish || "").trim();
      if (!rKey || rKey.length < 3 || !ar || !tr) return;

      const list = map.get(rKey) || [];
      if (!list.some((x) => x.arabic === ar)) {
        list.push({
          id: item.id,
          arabic: ar,
          turkish: tr,
          posLabel: formatPosLabel(item.tur),
          ses_erkek: item.ses_erkek,
          ses_kadin: item.ses_kadin,
        });
        map.set(rKey, list);
      }
    };

    for (const gk of gorselKelimeler) {
      addEntry({
        id: gk.id,
        kok: gk.kok,
        arabic: gk.arapca,
        turkish: gk.turkce,
        tur: gk.tur,
        ses_erkek: gk.ses_erkek,
        ses_kadin: gk.ses_kadin,
      });
    }

    for (const w of sozluk) {
      addEntry({
        id: w.id,
        kok: w.kok,
        arabic: w.mufret || w.mazi || "",
        turkish: w.anlam_tr,
        tur: w.tur,
        ses_erkek: w.ses_erkek,
        ses_kadin: w.ses_kadin,
      });
    }

    return map;
  }, []);

  // Havuz hazırlığı (Seviye filtresi ve aktif görsel havuz uyumu — sessiz seviye karıştırma yok)
  const effectiveVisualPool = useMemo(() => {
    const base =
      visualPool && visualPool.length >= 4
        ? visualPool.filter((gk) =>
            gorselKelimeler.some((orig) => orig.id === gk.id)
          )
        : [];
    const pool = base.length >= 4 ? base : gorselKelimeler;
    if (cefrFilter === "all" || isScopeExpanded) return pool;
    return pool.filter((gk) => gk.cefr === cefrFilter);
  }, [visualPool, cefrFilter, isScopeExpanded]);

  // 1. Mod 1 Soru Üreticisi: Kök & Müştakât Avcısı (root_hunter)
  const buildRootHunterQuestions = useCallback(
    (count: number): WorkshopQuestion[] => {
      const candidates = effectiveVisualPool.filter((gk) => {
        const rKey = normalizeRootKey(gk.kok);
        return rKey.length >= 3;
      });

      const allowGlobalFallback = cefrFilter === "all" || isScopeExpanded;
      const sourceList =
        candidates.length >= 4
          ? shuffleArray([...candidates])
          : allowGlobalFallback
          ? shuffleArray(
              gorselKelimeler.filter(
                (gk) => normalizeRootKey(gk.kok).length >= 3
              )
            )
          : [];

      const questions: WorkshopQuestion[] = [];
      const usedIds = new Set<string>();

      for (const target of sourceList) {
        if (questions.length >= count) break;
        if (usedIds.has(target.id)) continue;
        const targetRootKey = normalizeRootKey(target.kok);
        if (!targetRootKey) continue;

        const distractors = shuffleArray(
          sourceList.filter(
            (other) =>
              other.id !== target.id &&
              normalizeRootKey(other.kok) !== targetRootKey &&
              other.arapca !== target.arapca
          )
        ).slice(0, 3);

        if (distractors.length < 3) continue;
        usedIds.add(target.id);

        const family = rootGroupsMap.get(targetRootKey) || [
          {
            id: target.id,
            arabic: target.arapca,
            turkish: target.turkce,
            posLabel: formatPosLabel(target.tur),
            ses_erkek: target.ses_erkek,
            ses_kadin: target.ses_kadin,
          },
        ];

        const askRootFromWord = questions.length % 3 === 2;

        if (askRootFromWord) {
          const options: MorphologyOption[] = shuffleArray([
            {
              id: target.id,
              arabic: formatRootBadge(target.kok),
              turkish: `${target.arapca} (${target.turkce})`,
              rootFormatted: formatRootBadge(target.kok),
              morphBadge: formatPosLabel(target.tur),
              isCorrect: true,
              audioItem: {
                id: target.id,
                ses_erkek: target.ses_erkek,
                ses_kadin: target.ses_kadin,
              },
            },
            ...distractors.map((d) => ({
              id: d.id,
              arabic: formatRootBadge(d.kok),
              turkish: `${d.arapca} (${d.turkce})`,
              rootFormatted: formatRootBadge(d.kok),
              morphBadge: formatPosLabel(d.tur),
              isCorrect: false,
              audioItem: {
                id: d.id,
                ses_erkek: d.ses_erkek,
                ses_kadin: d.ses_kadin,
              },
            })),
          ]);

          questions.push({
            id: `root_rev_${target.id}`,
            subMode: "root_hunter",
            badgeTitle: "🌳 Kök & Müştakât Avcısı",
            promptTitleTr:
              "Verilen Arapça kelimenin 3 harfli sülâsî kökü (الأصل الثلاثي) hangisidir?",
            promptSubtitleTr: `Kelime Anlamı: "${target.turkce}" (${formatPosLabel(
              target.tur
            )})`,
            heroArabic: target.arapca,
            heroTurkish: target.turkce,
            imageUrl: target.gorsel,
            heroAudio: {
              text: target.arapca,
              id: target.id,
              ses_erkek: target.ses_erkek,
              ses_kadin: target.ses_kadin,
            },
            rootKeyDisplay: formatRootBadge(target.kok),
            rootFamily: family.slice(0, 6),
            options,
          });
        } else {
          const siblingPreview = family
            .filter((f) => f.arabic !== target.arapca)
            .slice(0, 2)
            .map((f) => `${f.arabic} (${f.turkish})`)
            .join(" • ");

          const options: MorphologyOption[] = shuffleArray([
            {
              id: target.id,
              arabic: target.arapca,
              turkish: target.turkce,
              rootFormatted: formatRootBadge(target.kok),
              morphBadge: formatPosLabel(target.tur),
              isCorrect: true,
              audioItem: {
                id: target.id,
                ses_erkek: target.ses_erkek,
                ses_kadin: target.ses_kadin,
              },
            },
            ...distractors.map((d) => ({
              id: d.id,
              arabic: d.arapca,
              turkish: d.turkce,
              rootFormatted: formatRootBadge(d.kok),
              morphBadge: formatPosLabel(d.tur),
              isCorrect: false,
              audioItem: {
                id: d.id,
                ses_erkek: d.ses_erkek,
                ses_kadin: d.ses_kadin,
              },
            })),
          ]);

          questions.push({
            id: `root_${target.id}`,
            subMode: "root_hunter",
            badgeTitle: "🌳 Kök & Müştakât Avcısı",
            promptTitleTr:
              "Aşağıdaki kelimelerden hangisi bu 3 kök harften türemiştir?",
            promptSubtitleTr: siblingPreview
              ? `Kardeş türev ipucu: ${siblingPreview}`
              : `Hedef anlam ipucu: "${target.turkce}"`,
            heroArabic: formatRootBadge(target.kok),
            heroTurkish: `Kök Harfler: ${formatRootBadge(target.kok)}`,
            heroAudio: {
              text: target.arapca,
              id: target.id,
              ses_erkek: target.ses_erkek,
              ses_kadin: target.ses_kadin,
            },
            rootKeyDisplay: formatRootBadge(target.kok),
            rootFamily: family.slice(0, 6),
            options,
          });
        }
      }

      return questions;
    },
    [effectiveVisualPool, rootGroupsMap, cefrFilter, isScopeExpanded]
  );

  // 2. Mod 2 Soru Üreticisi: Sarf Dönüştürücü (Müfret–Cemî & Mâzî–Muzâri–Masdar)
  const buildMorphologyTransformQuestions = useCallback(
    (count: number): WorkshopQuestion[] => {
      const candidates = effectiveVisualPool.filter(
        (gk) =>
          isValidMorphForm(gk.ikincil_form) || isValidMorphForm(gk.ucuncul_form)
      );

      const allowGlobalFallback = cefrFilter === "all" || isScopeExpanded;
      const sourceList =
        candidates.length >= 4
          ? shuffleArray([...candidates])
          : allowGlobalFallback
          ? shuffleArray(
              gorselKelimeler.filter(
                (gk) =>
                  isValidMorphForm(gk.ikincil_form) ||
                  isValidMorphForm(gk.ucuncul_form)
              )
            )
          : [];

      const questions: WorkshopQuestion[] = [];

      for (const target of sourceList) {
        if (questions.length >= count) break;

        const tur = (target.tur || "isim").toLowerCase().trim();
        const hasSecond = isValidMorphForm(target.ikincil_form);
        const hasThird = isValidMorphForm(target.ucuncul_form);

        let promptQuestionTr = "";
        let targetAnswerAr = "";
        let answerFormBadge = "";
        let baseFormBadge = "";

        if (tur === "fiil") {
          const askMasdar = hasThird && (!hasSecond || questions.length % 2 === 1);
          if (askMasdar) {
            promptQuestionTr = `Bu fiilin MASDAR (المصدر) formu aşağıdakilerden hangisidir?`;
            targetAnswerAr = target.ucuncul_form;
            answerFormBadge = "Masdar";
            baseFormBadge = "Mâzî Fiil";
          } else if (hasSecond) {
            promptQuestionTr = `Bu fiilin MUZÂRİ (المضارع — Şimdiki/Geniş Zaman) formu hangisidir?`;
            targetAnswerAr = target.ikincil_form;
            answerFormBadge = "Muzâri";
            baseFormBadge = "Mâzî Fiil";
          } else {
            continue;
          }
        } else if (tur === "sifat") {
          const askMuennes = hasThird && (!hasSecond || questions.length % 2 === 0);
          if (askMuennes) {
            promptQuestionTr = `Bu sıfatın MÜENNES (المؤنث — Dişil) formu aşağıdakilerden hangisidir?`;
            targetAnswerAr = target.ucuncul_form;
            answerFormBadge = "Müennes";
            baseFormBadge = "Müzekker Sıfat";
          } else if (hasSecond) {
            promptQuestionTr = `Bu sıfatın CEMÎ (الجمع — Çoğul) formu aşağıdakilerden hangisidir?`;
            targetAnswerAr = target.ikincil_form;
            answerFormBadge = "Cemî (Çoğul)";
            baseFormBadge = "Müfret Sıfat";
          } else {
            continue;
          }
        } else {
          // isim
          if (!hasSecond) continue;
          const reverseAskSingular = questions.length % 4 === 3;
          if (reverseAskSingular) {
            promptQuestionTr = `Çoğulu (Cemî) verilen bu ismin MÜFRET (المفرد — Tekil) hali hangisidir?`;
            targetAnswerAr = target.arapca;
            answerFormBadge = "Müfret (Tekil)";
            baseFormBadge = "Cemî (Çoğul)";
          } else {
            promptQuestionTr = `Tekili (Müfret) verilen bu ismin CEMÎ (الجمع — Çoğul) formu hangisidir?`;
            targetAnswerAr = target.ikincil_form;
            answerFormBadge = "Cemî (Çoğul)";
            baseFormBadge = "Müfret (Tekil)";
          }
        }

        const sameTurPool = sourceList.filter(
          (other) =>
            other.id !== target.id &&
            (other.tur || "isim").toLowerCase().trim() === tur
        );
        const fallbackDistractorPool =
          sameTurPool.length >= 3
            ? sameTurPool
            : sourceList.filter((other) => other.id !== target.id);

        const distractors: {
          item: ResimliKelime;
          formAr: string;
        }[] = [];

        for (const d of shuffleArray(fallbackDistractorPool)) {
          if (distractors.length >= 3) break;
          let dAr = "";
          if (answerFormBadge === "Masdar" || answerFormBadge === "Müennes") {
            dAr = isValidMorphForm(d.ucuncul_form)
              ? d.ucuncul_form
              : isValidMorphForm(d.ikincil_form)
              ? d.ikincil_form
              : d.arapca;
          } else if (answerFormBadge === "Müfret (Tekil)") {
            dAr = d.arapca;
          } else {
            dAr = isValidMorphForm(d.ikincil_form) ? d.ikincil_form : d.arapca;
          }

          if (
            dAr &&
            dAr !== targetAnswerAr &&
            !distractors.some((x) => x.formAr === dAr)
          ) {
            distractors.push({ item: d, formAr: dAr });
          }
        }

        if (distractors.length < 3) continue;

        const shownHeroAr =
          answerFormBadge === "Müfret (Tekil)"
            ? target.ikincil_form
            : target.arapca;

        const steps: { label: string; arabic: string }[] = [];
        if (tur === "fiil") {
          steps.push({ label: "Mâzî", arabic: target.arapca });
          if (hasSecond) {
            steps.push({ label: "Muzâri", arabic: target.ikincil_form });
          }
          if (hasThird) {
            steps.push({ label: "Masdar", arabic: target.ucuncul_form });
          }
        } else if (tur === "sifat") {
          steps.push({ label: "Müzekker", arabic: target.arapca });
          if (hasThird) {
            steps.push({ label: "Müennes", arabic: target.ucuncul_form });
          }
          if (hasSecond) {
            steps.push({ label: "Cemî", arabic: target.ikincil_form });
          }
        } else {
          steps.push({ label: "Müfret (Tekil)", arabic: target.arapca });
          if (hasSecond) {
            steps.push({ label: "Cemî (Çoğul)", arabic: target.ikincil_form });
          }
          if (hasThird) {
            steps.push({ label: "Müennes", arabic: target.ucuncul_form });
          }
        }

        const options: MorphologyOption[] = shuffleArray([
          {
            id: target.id,
            arabic: targetAnswerAr,
            turkish: `${target.turkce} (${ steps.map((s) => s.arabic).join(" ➔ ") })`,
            rootFormatted: formatRootBadge(target.kok),
            morphBadge: answerFormBadge,
            isCorrect: true,
            audioItem: {
              id: target.id,
              ses_erkek: target.ses_erkek,
              ses_kadin: target.ses_kadin,
            },
          },
          ...distractors.map(({ item: d, formAr }) => {
            const dSteps = [
              d.arapca,
              isValidMorphForm(d.ikincil_form) ? d.ikincil_form : null,
              isValidMorphForm(d.ucuncul_form) ? d.ucuncul_form : null,
            ]
              .filter(Boolean)
              .join(" ➔ ");
            return {
              id: d.id,
              arabic: formAr,
              turkish: `${d.turkce} (${dSteps})`,
              rootFormatted: formatRootBadge(d.kok),
              morphBadge: formatPosLabel(d.tur),
              isCorrect: false,
              audioItem: {
                id: d.id,
                ses_erkek: d.ses_erkek,
                ses_kadin: d.ses_kadin,
              },
            };
          }),
        ]);

        questions.push({
          id: `morph_${target.id}`,
          subMode: "morphology_transform",
          badgeTitle: "🔄 Sarf Dönüştürücü",
          promptTitleTr: promptQuestionTr,
          promptSubtitleTr: `${baseFormBadge}: ${shownHeroAr} — "${target.turkce}"`,
          heroArabic: shownHeroAr,
          heroTurkish: target.turkce,
          imageUrl: target.gorsel,
          heroAudio: {
            text: target.arapca,
            id: target.id,
            ses_erkek: target.ses_erkek,
            ses_kadin: target.ses_kadin,
          },
          rootKeyDisplay: formatRootBadge(target.kok),
          morphChain: {
            posLabel: formatPosLabel(target.tur),
            steps,
          },
          options,
        });
      }

      return questions;
    },
    [effectiveVisualPool, cefrFilter, isScopeExpanded]
  );

  // 3. Mod 3 Soru Üreticisi: Soru Kalıbı & Görsel Cevap (question_prompt_match)
  const buildQuestionPromptMatchQuestions = useCallback(
    (count: number): WorkshopQuestion[] => {
      const candidates = effectiveVisualPool.filter(
        (gk) => gk.soru_kalibi && gk.soru_kalibi.trim().length > 0 && gk.gorsel
      );

      const allowGlobalFallback = cefrFilter === "all" || isScopeExpanded;
      const sourceList =
        candidates.length >= 4
          ? shuffleArray([...candidates])
          : allowGlobalFallback
          ? shuffleArray(
              gorselKelimeler.filter(
                (gk) =>
                  gk.soru_kalibi && gk.soru_kalibi.trim().length > 0 && gk.gorsel
              )
            )
          : [];

      const questions: WorkshopQuestion[] = [];

      for (const target of sourceList) {
        if (questions.length >= count) break;

        const qAr = target.soru_kalibi.trim();
        const qTr =
          QUESTION_PROMPT_TR_MAP[qAr] || "Görsele uygun Arapça cevap hangisidir?";

        const sameQuestionGroup = sourceList.filter(
          (other) =>
            other.id !== target.id &&
            other.soru_kalibi === target.soru_kalibi &&
            other.arapca !== target.arapca
        );

        const distractorSource =
          sameQuestionGroup.length >= 3
            ? sameQuestionGroup
            : sourceList.filter((other) => other.id !== target.id);

        const distractors = shuffleArray(distractorSource).slice(0, 3);
        if (distractors.length < 3) continue;

        const options: MorphologyOption[] = shuffleArray([
          {
            id: target.id,
            arabic: target.arapca,
            turkish: target.turkce,
            rootFormatted: formatRootBadge(target.kok),
            morphBadge: target.soru_kalibi,
            isCorrect: true,
            audioItem: {
              id: target.id,
              ses_erkek: target.ses_erkek,
              ses_kadin: target.ses_kadin,
            },
          },
          ...distractors.map((d) => ({
            id: d.id,
            arabic: d.arapca,
            turkish: d.turkce,
            rootFormatted: formatRootBadge(d.kok),
            morphBadge: d.soru_kalibi,
            isCorrect: false,
            audioItem: {
              id: d.id,
              ses_erkek: d.ses_erkek,
              ses_kadin: d.ses_kadin,
            },
          })),
        ]);

        questions.push({
          id: `qprompt_${target.id}`,
          subMode: "question_prompt_match",
          badgeTitle: "❓ Soru Kalıbı & Görsel Cevap",
          promptTitleTr: `${qAr} — ${qTr}`,
          promptSubtitleTr:
            "Yandaki 1:1 görsele ve soru kalıbına karşılık gelen doğru Arapça ifadeyi seçin:",
          heroArabic: qAr,
          heroTurkish: qTr,
          imageUrl: target.gorsel,
          heroAudio: {
            text: qAr,
          },
          exampleSentence: target.ornek_ar
            ? {
                arabic: target.ornek_ar,
                turkish: target.ornek_tr || target.turkce,
                id: target.id,
                ses_erkek: target.ornek_ses_erkek || target.ses_erkek,
                ses_kadin: target.ornek_ses_kadin || target.ses_kadin,
              }
            : undefined,
          options,
        });
      }

      return questions;
    },
    [effectiveVisualPool, cefrFilter, isScopeExpanded]
  );

  // 4. Mod 4 Soru Üreticisi: Bağlamdan Atasözü & Kalıp Bulma (context_proverb_grammar)
  const buildContextProverbAndGrammarQuestions = useCallback(
    (count: number): WorkshopQuestion[] => {
      const allowGlobalFallback = cefrFilter === "all" || isScopeExpanded;
      const proverbPool = allowGlobalFallback
        ? atasozleri
        : atasozleri.filter((a) => a.cefr === cefrFilter);
      const effectiveProverbs =
        proverbPool.length >= 4
          ? proverbPool
          : allowGlobalFallback
          ? atasozleri
          : [];

      const sentencePool = allowGlobalFallback
        ? cumleler1111
        : cumleler1111.filter(
            (c) => c.seviye === cefrFilter || c.cefr === cefrFilter
          );
      const effectiveSentences =
        sentencePool.length >= 4
          ? sentencePool
          : allowGlobalFallback
          ? cumleler1111
          : [];

      const allGrammarTopics = Array.from(
        new Set(cumleler1111.map((c) => c.odak_kalip).filter(Boolean))
      );

      const shuffledProverbs = shuffleArray([...effectiveProverbs]);
      const shuffledSentences = shuffleArray([...effectiveSentences]);

      const questions: WorkshopQuestion[] = [];
      let pIdx = 0;
      let sIdx = 0;

      while (
        questions.length < count &&
        (pIdx < shuffledProverbs.length || sIdx < shuffledSentences.length)
      ) {
        const pickProverb =
          (questions.length % 2 === 0 && pIdx < shuffledProverbs.length) ||
          sIdx >= shuffledSentences.length;

        if (pickProverb && pIdx < shuffledProverbs.length) {
          const target = shuffledProverbs[pIdx++];
          const distractors = shuffleArray(
            effectiveProverbs.filter((other) => other.id !== target.id)
          ).slice(0, 3);

          if (distractors.length < 3) continue;

          const options: MorphologyOption[] = shuffleArray([
            {
              id: target.id,
              arabic: target.arapca,
              turkish: target.turkce,
              morphBadge: formatTurkishCategory(target.tema || "Atasözü"),
              isCorrect: true,
              audioItem: {
                id: target.id,
                ses_erkek: target.ses_erkek,
                ses_kadin: target.ses_kadin,
              },
            },
            ...distractors.map((d) => ({
              id: d.id,
              arabic: d.arapca,
              turkish: d.turkce,
              morphBadge: formatTurkishCategory(d.tema || "Atasözü"),
              isCorrect: false,
              audioItem: {
                id: d.id,
                ses_erkek: d.ses_erkek,
                ses_kadin: d.ses_kadin,
              },
            })),
          ]);

          questions.push({
            id: `ctx_ata_${target.id}`,
            subMode: "context_proverb_grammar",
            badgeTitle: "💡 Bağlamdan Atasözü Bulma",
            promptTitleTr: `💡 Kullanım Bağlamı (Senaryo): "${target.kullanim_baglami}"`,
            promptSubtitleTr: `Tema: ${formatTurkishCategory(
              target.tema || "Atasözü & Hikmet"
            )} — Senaryoya uygun atasözünü seçin`,
            imageUrl:
              target.gorsel ||
              resolveImageUrl(
                `/gorseller/atasozleri/ata_${String(target.sira || 1).padStart(
                  4,
                  "0"
                )}.webp`
              ),
            heroAudio: {
              text: target.arapca,
              id: target.id,
              ses_erkek: target.ses_erkek,
              ses_kadin: target.ses_kadin,
            },
            proverbMeta: {
              literalTr: target.lafzi_ceviri,
              contextTr: target.kullanim_baglami,
              proverbArabic: target.arapca,
              proverbTurkish: target.turkce,
            },
            options,
          });
        } else if (sIdx < shuffledSentences.length) {
          const target = shuffledSentences[sIdx++];
          if (!target.odak_kalip) continue;

          const distractorTopics = shuffleArray(
            allGrammarTopics.filter((t) => t !== target.odak_kalip)
          ).slice(0, 3);

          if (distractorTopics.length < 3) continue;

          const options: MorphologyOption[] = shuffleArray([
            {
              id: `${target.id}_correct`,
              arabic: `📌 ${target.odak_kalip}`,
              turkish: `${target.arapca} — "${target.turkce}"`,
              morphBadge: `Seviye ${target.seviye}`,
              isCorrect: true,
              isGrammarPatternOption: true,
              sampleArabic: target.arapca,
              audioItem: {
                id: target.id,
                ses_erkek: target.ses_erkek,
                ses_kadin: target.ses_kadin,
              },
            },
            ...distractorTopics.map((topic, idx) => {
              const sampleForTopic = cumleler1111.find(
                (c) => c.odak_kalip === topic && c.id !== target.id
              );
              return {
                id: `${target.id}_dist_${idx}`,
                arabic: `📌 ${topic}`,
                turkish: sampleForTopic
                  ? `Örnek: ${sampleForTopic.arapca} (${sampleForTopic.turkce})`
                  : "Farklı nahiv/sarf cümle kalıbı",
                morphBadge: sampleForTopic
                  ? `Seviye ${sampleForTopic.seviye}`
                  : "Gramer",
                isCorrect: false,
                isGrammarPatternOption: true,
                sampleArabic: sampleForTopic?.arapca,
                audioItem: sampleForTopic
                  ? {
                      id: sampleForTopic.id,
                      ses_erkek: sampleForTopic.ses_erkek,
                      ses_kadin: sampleForTopic.ses_kadin,
                    }
                  : undefined,
              };
            }),
          ]);

          questions.push({
            id: `ctx_gram_${target.id}`,
            subMode: "context_proverb_grammar",
            badgeTitle: "📌 Cümleden Gramer Kalıbı Bulma",
            promptTitleTr:
              "Bu Arapça cümlenin inşa edildiği odak gramer kalıbı aşağıdakilerden hangisidir?",
            promptSubtitleTr: `Türkçe Anlamı: "${target.turkce}" (${formatTurkishCategory(
              target.tema || "Günlük Hayat"
            )})`,
            heroArabic: target.arapca,
            heroTurkish: target.turkce,
            heroAudio: {
              text: target.arapca,
              id: target.id,
              ses_erkek: target.ses_erkek,
              ses_kadin: target.ses_kadin,
            },
            grammarTopicToOpen: target.odak_kalip,
            grammarSourceId: target.id,
            options,
          });
        }
      }

      return questions;
    },
    [cefrFilter, isScopeExpanded]
  );

  // Seçili alt moda göre soru dizisini oluştur
  const questions = useMemo(() => {
    void sessionSeed;
    void vocabulary.length;
    const total = Math.max(4, questionCount);

    if (subMode === "root_hunter") {
      return buildRootHunterQuestions(total);
    }
    if (subMode === "morphology_transform") {
      return buildMorphologyTransformQuestions(total);
    }
    if (subMode === "question_prompt_match") {
      return buildQuestionPromptMatchQuestions(total);
    }
    if (subMode === "context_proverb_grammar") {
      return buildContextProverbAndGrammarQuestions(total);
    }

    // "mixed" (🔄 Karma Akış): 4 moddan dengeli soru karışımı
    const perMode = Math.ceil(total / 4) + 1;
    const q1 = buildRootHunterQuestions(perMode);
    const q2 = buildMorphologyTransformQuestions(perMode);
    const q3 = buildQuestionPromptMatchQuestions(perMode);
    const q4 = buildContextProverbAndGrammarQuestions(perMode);

    const interleaved: WorkshopQuestion[] = [];
    const maxLen = Math.max(q1.length, q2.length, q3.length, q4.length);
    for (let i = 0; i < maxLen; i++) {
      if (q1[i]) interleaved.push(q1[i]);
      if (q2[i]) interleaved.push(q2[i]);
      if (q3[i]) interleaved.push(q3[i]);
      if (q4[i]) interleaved.push(q4[i]);
    }
    return interleaved.slice(0, total);
  }, [
    subMode,
    sessionSeed,
    questionCount,
    vocabulary.length,
    buildRootHunterQuestions,
    buildMorphologyTransformQuestions,
    buildQuestionPromptMatchQuestions,
    buildContextProverbAndGrammarQuestions,
  ]);

  const currentQuestion = questions[currentIndex] || null;
  const isAnswered = selectedOptionId !== null;

  const secondsLeft = useCountdown(
    timeLimit,
    () => {
      if (!isFinished) {
        setIsFinished(true);
      }
    },
    Boolean(timeLimit && !isFinished)
  );

  const playQuestionAudio = useCallback(
    (audioSpec?: {
      text: string;
      id?: string;
      ses_erkek?: string;
      ses_kadin?: string;
    }) => {
      if (!audioSpec || !audioSpec.text) return;
      stopAllAudio();
      if (audioSpec.id || audioSpec.ses_erkek || audioSpec.ses_kadin) {
        void playDualGenderAudio({
          text: audioSpec.text,
          id: audioSpec.id,
          ses_erkek: audioSpec.ses_erkek,
          ses_kadin: audioSpec.ses_kadin,
          gender: preferredVoiceGender,
          rate: speechRate,
        });
      } else {
        void speakHybrid({
          text: audioSpec.text,
          voice: preferredVoiceGender,
          rate: speechRate,
        });
      }
    },
    [preferredVoiceGender, speechRate]
  );

  // Bitiş fanfarı
  useEffect(() => {
    if (isFinished && !fanfarePlayedRef.current && questions.length > 0) {
      fanfarePlayedRef.current = true;
      const pct = Math.round((score / questions.length) * 100);
      void playFanfare(pct);
    }
  }, [isFinished, score, questions.length]);

  useEffect(() => {
    return () => {
      stopAllAudio();
      stopAllSfx();
    };
  }, []);

  const handleSelectSubMode = (nextMode: WorkshopSubMode) => {
    playClick();
    stopAllAudio();
    stopAllSfx();
    setSubMode(nextMode);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setShowLiteralHint(false);
    setScore(0);
    setStreak(0);
    setIsFinished(false);
    fanfarePlayedRef.current = false;
  };

  const handleOptionSelect = async (option: MorphologyOption) => {
    if (isAnswered || !currentQuestion) return;
    setSelectedOptionId(option.id);

    if (option.isCorrect) {
      const nextStreak = streak + 1;
      setScore((prev) => prev + 1);
      setStreak(nextStreak);
      setBestStreak((prev) => Math.max(prev, nextStreak));
      addStudyMinutes(1);
      if (option.audioItem?.id) {
        recordItemAttempt(option.audioItem.id, "word", true, false, 100);
      }
      await playCorrect({
        streak: nextStreak,
        gender: preferredVoiceGender,
      });
      if (currentQuestion.heroAudio) {
        playQuestionAudio(currentQuestion.heroAudio);
      }
    } else {
      setStreak(0);
      if (currentQuestion.heroAudio?.id) {
        addMistake(currentQuestion.heroAudio.id);
        recordItemAttempt(
          currentQuestion.heroAudio.id,
          "word",
          false,
          false,
          0
        );
      }
      await playWrong();
    }
  };

  const handleNextQuestion = () => {
    playClick();
    stopAllAudio();
    stopAllSfx();
    setShowLiteralHint(false);
    if (currentIndex + 1 >= questions.length) {
      setIsFinished(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionId(null);
    }
  };

  const handlePrevQuestion = () => {
    if (currentIndex <= 0) return;
    playClick();
    stopAllAudio();
    stopAllSfx();
    setShowLiteralHint(false);
    setCurrentIndex((prev) => prev - 1);
    setSelectedOptionId(null);
  };

  const handleRestart = () => {
    playStart();
    stopAllAudio();
    stopAllSfx();
    fanfarePlayedRef.current = false;
    setSessionSeed((s) => s + 1);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setShowLiteralHint(false);
    setScore(0);
    setStreak(0);
    setIsFinished(false);
  };

  const subModeTabs: {
    id: WorkshopSubMode;
    label: string;
    shortLabel: string;
    icon: typeof Shuffle;
  }[] = [
    {
      id: "mixed",
      label: "🔄 Karma Akış",
      shortLabel: "🔄 Karma",
      icon: Shuffle,
    },
    {
      id: "root_hunter",
      label: "🌳 Kök & Müştakât Avcısı",
      shortLabel: "🌳 Kök Avcısı",
      icon: GitBranch,
    },
    {
      id: "morphology_transform",
      label: "🔄 Sarf Dönüştürücü",
      shortLabel: "🔄 Sarf",
      icon: Repeat,
    },
    {
      id: "question_prompt_match",
      label: "❓ Soru Kalıbı & Görsel",
      shortLabel: "❓ Soru Kalıbı",
      icon: HelpCircle,
    },
    {
      id: "context_proverb_grammar",
      label: "💡 Bağlam & Kalıp Bulma",
      shortLabel: "💡 Bağlam",
      icon: Lightbulb,
    },
  ];

  if (!currentQuestion) {
    return (
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] p-6 text-center space-y-3 max-w-lg mx-auto">
        <p className="text-sm font-extrabold text-[var(--foreground)]">
          {cefrFilter !== "all" && !isScopeExpanded
            ? `Seçili seviyede (${cefrFilter}) bu mod için yeterli soru bulunamadı.`
            : "Seçili filtrede yeterli sarf/bağlam sorusu bulunamadı."}
        </p>
        <p className="text-xs font-semibold text-[var(--muted)]">
          Üst seviyelerdeki soruları gizlice karıştırmak yerine kapsamı sizin onayınızla genişletebilirsiniz.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {cefrFilter !== "all" && !isScopeExpanded && (
            <button
              type="button"
              onClick={() => {
                playClick();
                setExpandedScopeKey(currentScopeKey);
                setCurrentIndex(0);
                setSelectedOptionId(null);
                setShowLiteralHint(false);
              }}
              className="px-4 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold cursor-pointer"
            >
              🔓 Kapsamı Genişlet (Tüm Seviyeler)
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold cursor-pointer"
            >
              Ayarlara Dön
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isFinished) {
    const pct = Math.round((score / Math.max(1, questions.length)) * 100);
    return (
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-5 sm:p-7 text-center max-w-xl mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-600">
          <Trophy size={34} />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wider text-[#087F5B] dark:text-emerald-400">
            🌿 Sarf, Kök & Bağlam Atölyesi Tamamlandı
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--foreground)]">
            {pct >= 80
              ? "Mümtaz! Kök ve Bağlam Hakimiyetiniz Harika!"
              : pct >= 50
              ? "Güzel Çalışma! Kök ve Kalıp Bilginiz Gelişiyor"
              : "Tekrar Pratik Yaparak Kök Ailelerini Pekiştirelim"}
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2.5 max-w-md mx-auto">
          <div className="bg-white dark:bg-[var(--background)] rounded-2xl p-3 border border-[#E6D7BE]">
            <div className="text-lg sm:text-xl font-black text-[#087F5B]">
              {score} / {questions.length}
            </div>
            <div className="text-[11px] font-bold text-[var(--muted)]">
              Doğru Cevap
            </div>
          </div>
          <div className="bg-white dark:bg-[var(--background)] rounded-2xl p-3 border border-[#E6D7BE]">
            <div className="text-lg sm:text-xl font-black text-[#6741D9]">
              %{pct}
            </div>
            <div className="text-[11px] font-bold text-[var(--muted)]">
              Başarı Oranı
            </div>
          </div>
          <div className="bg-white dark:bg-[var(--background)] rounded-2xl p-3 border border-[#E6D7BE]">
            <div className="text-lg sm:text-xl font-black text-amber-600">
              🔥 {bestStreak}
            </div>
            <div className="text-[11px] font-bold text-[var(--muted)]">
              En İyi Seri
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleRestart}
            className="px-4 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs sm:text-sm font-extrabold border-b-3 border-[#065F46] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCcw size={15} />
            <span>Yeni Sorularla Tekrar Oyna</span>
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

  return (
    <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-2.5 sm:p-3.5 flex flex-col justify-between gap-2.5">
      {/* 1. ÜST BAR: 5 Alt Mod Sekmesi (Tek Tıkla Geçişli) + Skor / Seri / Sayaç */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 flex-1">
          {subModeTabs.map((tab) => {
            const active = subMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectSubMode(tab.id)}
                className={`px-2.5 py-1.5 rounded-xl border-2 text-[11px] sm:text-xs font-extrabold transition-all flex items-center justify-center gap-1 text-center cursor-pointer ${
                  active
                    ? "bg-[#6741D9] border-[#5230B5] text-white shadow-2xs"
                    : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#6741D9]"
                }`}
              >
                <span className="hidden xl:inline truncate">{tab.label}</span>
                <span className="xl:hidden truncate">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {cefrFilter !== "all" &&
            !isScopeExpanded &&
            questions.length < questionCount && (
              <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-[10px] font-extrabold text-amber-800 dark:text-amber-200">
                ℹ️ {cefrFilter}: {questions.length} soru
              </span>
            )}
          <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-xs font-extrabold text-[var(--foreground)] tabular-nums">
            Soru {currentIndex + 1} / {questions.length}
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-xs font-extrabold text-[#065F46] dark:text-emerald-300 tabular-nums">
            ✓ {score} Doğru
          </span>
          {streak > 0 && (
            <span className="px-2 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/70 border border-amber-400 text-xs font-black text-amber-800 dark:text-amber-300 inline-flex items-center gap-1 tabular-nums">
              <Flame size={13} className="text-amber-600" />
              {streak}
            </span>
          )}
          {timeLimit && secondsLeft !== null && (
            <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-300 text-xs font-black text-[#6741D9] dark:text-indigo-300 inline-flex items-center gap-1 tabular-nums">
              <Timer size={13} />
              {secondsLeft}s
            </span>
          )}
        </div>
      </div>

      {/* 2. ORTA ANA ALAN (ZERO-SCROLL SPLIT): Sol/Üst Hedef Soru & Görsel Kartı + Sağ/Alt 4 Seçenek */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* SOL KART: Hedef Kök / Görsel / Soru Kalıbı / Bağlam (5 Sütun) */}
        <div className="lg:col-span-5 bg-white dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-[#F3F0FF] dark:bg-indigo-950/70 border border-[#6741D9]/30 text-[11px] font-extrabold text-[#6741D9] dark:text-indigo-300">
              {currentQuestion.badgeTitle}
            </span>

            {currentQuestion.heroAudio && (
              <button
                type="button"
                onClick={() => playQuestionAudio(currentQuestion.heroAudio)}
                className="px-2.5 py-1 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Volume2 size={14} />
                <span>Dinle</span>
              </button>
            )}
          </div>

          {/* 1:1 Kare Görsel + Hedef Arapça Kök/Kelime/Soru */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-2.5 my-auto">
            {currentQuestion.imageUrl && (
              <div className="w-28 h-28 sm:w-32 sm:h-32 lg:w-36 lg:h-36 aspect-square rounded-2xl bg-[#FDFBF7] dark:bg-slate-900 border-2 border-[#E6D7BE] dark:border-[var(--border)] p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={currentQuestion.imageUrl}
                  alt={currentQuestion.heroTurkish || "Görsel"}
                  className="w-full h-full aspect-square object-contain rounded-xl"
                />
              </div>
            )}

            <div className="flex-1 text-center space-y-1.5 w-full">
              {currentQuestion.heroArabic && (
                <div
                  dir="rtl"
                  lang="ar"
                  onClick={() =>
                    currentQuestion.heroAudio &&
                    playQuestionAudio(currentQuestion.heroAudio)
                  }
                  className={`arabic font-black text-[var(--foreground)] leading-relaxed px-3 py-2 rounded-2xl bg-[#F7EFE1]/80 dark:bg-[var(--surface)] border border-[#E6D7BE] ${
                    currentQuestion.subMode === "root_hunter"
                      ? "text-2xl sm:text-3xl text-[#4C28B5] dark:text-indigo-300 tracking-wider"
                      : "text-xl sm:text-2xl"
                  } ${currentQuestion.heroAudio ? "cursor-pointer hover:border-[#087F5B]" : ""}`}
                >
                  {currentQuestion.heroArabic}
                </div>
              )}

              <div className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] leading-snug text-center">
                <MixedText
                  text={currentQuestion.promptTitleTr}
                  arabicClassName="arabic font-arabic text-base sm:text-lg font-bold text-[#065F46] dark:text-emerald-300 mx-0.5 inline-block"
                />
              </div>

              {currentQuestion.promptSubtitleTr && (
                <div className="text-[11px] sm:text-xs font-semibold text-[#065F46] dark:text-emerald-400 leading-snug text-center">
                  <MixedText
                    text={currentQuestion.promptSubtitleTr}
                    arabicClassName="arabic font-arabic text-sm sm:text-base font-bold text-[#065F46] dark:text-emerald-300 mx-0.5 inline-block"
                  />
                </div>
              )}

              {!isAnswered && currentQuestion.proverbMeta?.literalTr && (
                <div className="pt-1 flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setShowLiteralHint((prev) => !prev);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-[11px] font-extrabold text-amber-800 dark:text-amber-200 hover:bg-amber-100 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Lightbulb size={12} />
                    <span>
                      {showLiteralHint
                        ? "Lafzî İpucunu Gizle"
                        : "💡 Lafzî İpucunu Göster"}
                    </span>
                  </button>
                  {showLiteralHint && (
                    <div
                      dir="ltr"
                      lang="tr"
                      className="w-full rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200 text-center"
                    >
                      Lafzî İpucu: &ldquo;
                      <MixedText text={currentQuestion.proverbMeta.literalTr} />
                      &rdquo;
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cevap Sonrası Pedagojik Açıklama Kutusu (Kök Ailesi / Sarf Şeması / Örnek Cümle / Gramer Modal Butonu) */}
          {isAnswered && (
            <div className="rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#087F5B]/40 p-2.5 space-y-1.5 animate-in fade-in duration-150">
              {/* Mod 1: Kök Ailesi (Müştakât) Özeti */}
              {currentQuestion.subMode === "root_hunter" &&
                currentQuestion.rootFamily && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-black text-[#4C28B5] dark:text-indigo-300">
                      <span>
                        🌳 Kök Ailesi ({currentQuestion.rootKeyDisplay}):
                      </span>
                      <span>{currentQuestion.rootFamily.length} Kardeş Türev</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {currentQuestion.rootFamily.map((sib) => (
                        <button
                          key={sib.id}
                          type="button"
                          onClick={() =>
                            playQuestionAudio({
                              text: sib.arabic,
                              id: sib.id,
                              ses_erkek: sib.ses_erkek,
                              ses_kadin: sib.ses_kadin,
                            })
                          }
                          className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#087F5B] text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 size={11} className="text-[#087F5B]" />
                          <span dir="rtl" lang="ar" className="arabic font-bold">
                            {sib.arabic}
                          </span>
                          <span
                            dir="ltr"
                            lang="tr"
                            className="font-sans text-[var(--muted)] font-semibold"
                          >
                            (<MixedText text={sib.turkish} />)
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Mod 2: Sarf Dönüşüm Şeması */}
              {currentQuestion.subMode === "morphology_transform" &&
                currentQuestion.morphChain && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-black text-[#065F46] dark:text-emerald-400 flex items-center gap-1">
                      <Layers size={12} />
                      <span>
                        Sarf Çekim Şeması ({currentQuestion.morphChain.posLabel}
                        ):
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {currentQuestion.morphChain.steps.map((st, i) => (
                        <React.Fragment key={st.label}>
                          <button
                            type="button"
                            onClick={() =>
                              playQuestionAudio({ text: st.arabic })
                            }
                            className="px-2 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-xs inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <span className="text-[10px] font-bold text-[var(--muted)]">
                              {st.label}:
                            </span>
                            <span
                              dir="rtl"
                              lang="ar"
                              className="arabic font-black text-sm text-[#4C28B5] dark:text-indigo-300"
                            >
                              {st.arabic}
                            </span>
                            <Volume2 size={11} className="text-[#087F5B]" />
                          </button>
                          {i < currentQuestion.morphChain!.steps.length - 1 && (
                            <span className="text-xs font-black text-[var(--muted)]">
                              ➔
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

              {/* Mod 3: Soru Kalıbı Örnek Cümlesi */}
              {currentQuestion.subMode === "question_prompt_match" &&
                currentQuestion.exampleSentence && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-[#065F46] dark:text-emerald-400">
                        💬 Örnek Cümle İçinde Kullanımı:
                      </div>
                      <div
                        dir="rtl"
                        lang="ar"
                        className="arabic text-sm sm:text-base font-bold text-[var(--foreground)]"
                      >
                        {currentQuestion.exampleSentence.arabic}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        playQuestionAudio({
                          text: currentQuestion.exampleSentence!.arabic,
                          id: currentQuestion.exampleSentence!.id,
                          ses_erkek: currentQuestion.exampleSentence!.ses_erkek,
                          ses_kadin: currentQuestion.exampleSentence!.ses_kadin,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Volume2 size={13} />
                      <span>Cümleyi Dinle</span>
                    </button>
                  </div>
                )}

              {/* Mod 4: Atasözü veya Bağımsız Gramer Penceresi Butonu */}
              {currentQuestion.subMode === "context_proverb_grammar" && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {currentQuestion.proverbMeta && (
                    <div
                      dir="ltr"
                      lang="tr"
                      className="font-sans text-[11px] space-y-0.5 text-left"
                    >
                      <div className="font-extrabold text-[#065F46] dark:text-emerald-400">
                        📜 Türkçe Karşılığı:{" "}
                        <span className="text-[var(--foreground)]">
                          <MixedText
                            text={currentQuestion.proverbMeta.proverbTurkish}
                          />
                        </span>
                      </div>
                      <div className="text-[var(--muted)] font-semibold">
                        Lafzî Çeviri:{" "}
                        <MixedText
                          text={currentQuestion.proverbMeta.literalTr}
                        />
                      </div>
                    </div>
                  )}

                  {currentQuestion.grammarTopicToOpen && (
                    <div className="flex items-center justify-between w-full gap-2">
                      <span
                        dir="ltr"
                        lang="tr"
                        className="font-sans text-xs font-extrabold text-[#4C28B5] dark:text-indigo-300 text-left inline-flex items-center gap-1"
                      >
                        <span className="shrink-0">📌 Kalıp:</span>
                        <MixedText
                          text={currentQuestion.grammarTopicToOpen}
                          arabicClassName="arabic font-arabic text-sm font-bold text-[#4C28B5] dark:text-indigo-200 mx-0.5 inline-block"
                        />
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setGrammarModalTopic({
                            topic: currentQuestion.grammarTopicToOpen!,
                            sourceId: currentQuestion.grammarSourceId,
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                      >
                        <BookOpen size={13} />
                        <span>📌 Gramer Notunu Aç</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SAĞ KART: 4 Seçenek Kartı (7 Sütun) */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = selectedOptionId === opt.id;
              let cardStyle =
                "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9]";

              if (isAnswered) {
                if (opt.isCorrect) {
                  cardStyle =
                    "bg-emerald-50 dark:bg-emerald-950/60 border-[#087F5B] text-[#065F46] dark:text-emerald-200 ring-2 ring-[#087F5B]/30";
                } else if (isSelected) {
                  cardStyle =
                    "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-900 dark:text-rose-200";
                } else {
                  cardStyle =
                    "bg-white/80 dark:bg-[var(--background)] border-[#E6D7BE] opacity-85";
                }
              }

              const optionLetter = ["A", "B", "C", "D"][idx] || String(idx + 1);
              const isTurkishGrammarOption =
                Boolean(opt.isGrammarPatternOption) ||
                hasLatinCharacters(opt.arabic);
              const hasLeadingPin = opt.arabic.trim().startsWith("📌");
              const cleanOptionText = opt.arabic.replace(/^📌\s*/, "").trim();

              return (
                <div
                  key={opt.id}
                  onClick={() => handleOptionSelect(opt)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void handleOptionSelect(opt);
                    }
                  }}
                  className={`rounded-2xl border-2 border-b-4 p-3 transition-all flex flex-col justify-between gap-2 text-left ${cardStyle} ${
                    isAnswered ? "cursor-default" : "cursor-pointer active:translate-y-0.5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        isAnswered && opt.isCorrect
                          ? "bg-[#087F5B] text-white"
                          : isAnswered && isSelected && !opt.isCorrect
                          ? "bg-rose-600 text-white"
                          : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[var(--foreground)] border border-[#E6D7BE]"
                      }`}
                    >
                      {optionLetter}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {opt.morphBadge && (
                        <span
                          dir="ltr"
                          className="px-2 py-0.5 rounded-md bg-[#F7EFE1] dark:bg-[var(--surface)] text-[10px] font-extrabold text-[var(--muted)] border border-[#E6D7BE]"
                        >
                          <MixedText
                            text={opt.morphBadge}
                            arabicClassName="arabic font-arabic text-xs font-bold text-[#065F46] dark:text-emerald-300 mx-0.5 inline-block"
                          />
                        </span>
                      )}

                      {isTurkishGrammarOption ? (
                        <span
                          dir="ltr"
                          className="px-2 py-0.5 rounded-md bg-[#F3F0FF] dark:bg-indigo-950/70 text-[10px] font-extrabold text-[#4C28B5] dark:text-indigo-300 border border-[#6741D9]/30"
                        >
                          📌 Kalıp
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const pureAr =
                              opt.sampleArabic ||
                              extractPureArabicFromMixed(opt.arabic) ||
                              cleanOptionText;
                            if (!pureAr) return;
                            playQuestionAudio({
                              text: pureAr,
                              id: opt.audioItem?.id,
                              ses_erkek: opt.audioItem?.ses_erkek,
                              ses_kadin: opt.audioItem?.ses_kadin,
                            });
                          }}
                          className="w-7 h-7 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] hover:bg-[#087F5B] hover:text-white flex items-center justify-center text-[#087F5B] transition-colors cursor-pointer"
                          title="Seçeneği Sesli Dinle"
                        >
                          <Volume2 size={14} />
                        </button>
                      )}

                      {isAnswered && opt.isCorrect && (
                        <CheckCircle2
                          size={18}
                          className="text-[#087F5B] shrink-0"
                        />
                      )}
                      {isAnswered && isSelected && !opt.isCorrect && (
                        <XCircle size={18} className="text-rose-600 shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Seçenek Ana Metin (Türkçe+Arapça Karma Gramer Kalıbı veya Saf Arapça) */}
                  {isTurkishGrammarOption ? (
                    <div
                      dir="ltr"
                      lang="tr"
                      className="font-sans text-sm sm:text-base font-extrabold text-[var(--foreground)] text-left leading-snug my-auto flex items-start gap-1.5"
                    >
                      {hasLeadingPin && (
                        <span className="shrink-0 select-none mt-0.5">📌</span>
                      )}
                      <MixedText
                        text={cleanOptionText}
                        className="font-sans font-extrabold text-[var(--foreground)] leading-snug"
                        arabicClassName="arabic font-arabic text-base sm:text-lg font-bold text-[#065F46] dark:text-emerald-300 mx-0.5 inline-block"
                      />
                    </div>
                  ) : (
                    <div
                      dir="rtl"
                      lang="ar"
                      className="arabic font-arabic text-xl sm:text-2xl font-black text-[var(--foreground)] text-right leading-snug my-auto"
                    >
                      {opt.arabic}
                    </div>
                  )}

                  {/* Cevap Sonrası Tüm Seçeneklerin Türkçe Anlamı ve Kök Harfleri */}
                  {isAnswered ? (
                    <div
                      dir="ltr"
                      lang="tr"
                      className="pt-1.5 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold text-left"
                    >
                      <span className="font-sans text-[var(--foreground)] inline-flex items-start gap-1">
                        <span className="shrink-0">🇹🇷</span>
                        <MixedText
                          text={opt.turkish}
                          arabicClassName="arabic font-arabic text-sm font-bold text-[#065F46] dark:text-emerald-300 mx-0.5 inline-block"
                        />
                      </span>
                      {opt.rootFormatted && opt.rootFormatted !== "-" && (
                        <span
                          dir="ltr"
                          lang="tr"
                          className="font-sans px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-[#4C28B5] dark:text-indigo-300 text-[11px] font-bold inline-flex items-center gap-1"
                        >
                          <span>Kök:</span>
                          <bdi
                            dir="rtl"
                            lang="ar"
                            className="arabic font-arabic text-xs font-bold"
                          >
                            {opt.rootFormatted}
                          </bdi>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] font-semibold text-[var(--muted)]">
                      Seçmek için tıklayın
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Alt Navigasyon Çubuğu */}
          <div className="flex items-center justify-between gap-2 bg-white dark:bg-[var(--background)] rounded-xl px-3 py-2 border border-[#E6D7BE] dark:border-[var(--border)]">
            <button
              type="button"
              onClick={handlePrevQuestion}
              disabled={currentIndex === 0}
              className="px-3 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] disabled:opacity-40 text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Önceki</span>
            </button>

            <div className="text-xs font-bold text-[var(--muted)] text-center">
              {isAnswered ? (
                <span className="text-[#065F46] dark:text-emerald-400 font-extrabold inline-flex items-center gap-1">
                  <Sparkles size={13} />
                  Tüm şıkların anlam ve kök analizlerini inceleyebilirsiniz
                </span>
              ) : (
                <span>Doğru şıkkı seçin veya 🔊 butonlarıyla dinleyin</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextQuestion}
              className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                isAnswered
                  ? "bg-[#087F5B] hover:bg-[#065F46] text-white shadow-xs"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[var(--foreground)] hover:bg-[#EFE3CE]"
              }`}
            >
              <span>
                {currentIndex + 1 >= questions.length
                  ? "Sonuçları Gör"
                  : "Sonraki Soru"}
              </span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Bağımsız Gramer Hap Bilgi Penceresi (Mod 4 için) */}
      {grammarModalTopic && (
        <GrammarQuickModal
          isOpen={Boolean(grammarModalTopic)}
          onClose={() => setGrammarModalTopic(null)}
          grammarTopic={grammarModalTopic.topic}
          sourceId={grammarModalTopic.sourceId}
          initialViewMode="drawer"
        />
      )}
    </div>
  );
}
