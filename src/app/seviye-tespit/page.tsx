"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Compass,
  GraduationCap,
  HelpCircle,
  Headphones,
  Lightbulb,
  ListChecks,
  Play,
  Printer,
  RefreshCcw,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import type { Level } from "@/types/data";
import {
  ASSESSMENT_TOPICS,
  getDistractorAnalysisForSelection,
  isSelectedOptionCorrect,
  prepareQuestionOptions,
  type AssessmentQuestion,
  type OptionLetter,
  type PreparedAssessmentOption,
  type RuntimeAssessmentQuestion,
} from "@/types/assessment";
import {
  cumleler1111,
  getDialoguesSortedPedagogically,
} from "@/lib/data";
import { playDualGenderAudio, speakHybrid, stopAllAudio } from "@/lib/audio";
import {
  playClick,
  playCorrect,
  playFanfare,
  playStart,
  playWrong,
} from "@/lib/sfxManager";
import {
  formatArabicByHarekeMode,
  simplifyGrammarTerminology,
} from "@/lib/arabicTextUtils";
import { useSettings } from "@/store/settings";
import { useUserStore, type SkillKey } from "@/store/userStore";
import { MixedText } from "@/components/ui/MixedText";
import {
  escapeHtml,
  hashStringSeed,
  mulberry32,
  seededShuffle,
} from "@/components/ui/DialoguePdfModal";

type AssessmentCenterTab = "cat" | "topic" | "exam";

interface SessionItemRecord {
  question: RuntimeAssessmentQuestion;
  preparedOptions: PreparedAssessmentOption[];
  selectedDisplayHarf: OptionLetter | null;
  selectedOrigHarf: OptionLetter | null;
  skipped: boolean;
  isCorrect: boolean;
  answered: boolean;
}

const DIFFICULTY_LADDER: Array<{ seviye: Level; zorluk: 1 | 2 | 3 }> = [
  { seviye: "A1", zorluk: 1 }, // 0
  { seviye: "A1", zorluk: 2 }, // 1
  { seviye: "A1", zorluk: 3 }, // 2
  { seviye: "A2", zorluk: 1 }, // 3 (CAT başlangıç noktası)
  { seviye: "A2", zorluk: 2 }, // 4
  { seviye: "A2", zorluk: 3 }, // 5
  { seviye: "B1", zorluk: 1 }, // 6
  { seviye: "B1", zorluk: 2 }, // 7
  { seviye: "B1", zorluk: 3 }, // 8
  { seviye: "B2", zorluk: 1 }, // 9
  { seviye: "B2", zorluk: 2 }, // 10
  { seviye: "B2", zorluk: 3 }, // 11
];

const CAT_TOTAL_QUESTIONS = 18; // 16 adaptif okuma/gramer/bağlam + 2 isteğe bağlı sesli dinleme
const CAT_LISTENING_SLOTS = new Set<number>([4, 11]); // 5. ve 12. sorular

function mapQuestionToSkillKey(q: RuntimeAssessmentQuestion): SkillKey {
  if (q.isListeningAudioItem) return "dinleme";
  if (q.beceri_alani === "sarf_nahiv" || q.beceri_alani === "hata_bulma") {
    return "gramer";
  }
  if (q.beceri_alani === "kelime_baglam") {
    return "kelime";
  }
  return "okuma";
}

function getStepIndexForQuestion(q: Pick<AssessmentQuestion, "seviye" | "zorluk_basamagi">): number {
  const idx = DIFFICULTY_LADDER.findIndex(
    (s) => s.seviye === q.seviye && s.zorluk === q.zorluk_basamagi
  );
  return idx >= 0 ? idx : 3;
}

function mapCefrToPreferredTr(level: Level): "Başlangıç" | "Orta" | "İleri" {
  if (level === "A1") return "Başlangıç";
  if (level === "A2") return "Orta";
  return "İleri";
}

function getLevelMeta(level: Level): {
  title: string;
  subtitle: string;
  badgeCls: string;
} {
  switch (level) {
    case "A1":
      return {
        title: "A1 — Temel Başlangıç",
        subtitle: "Temel tanışma, zamirler, isim cümlesi ve günlük iletişim kalıpları",
        badgeCls:
          "bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700",
      };
    case "A2":
      return {
        title: "A2 — Temel Orta (Günlük İletişim)",
        subtitle: "Mâzî/muzâri fiiller, izâfet-sıfat uyumu, harf-i cerler ve günlük hayat",
        badgeCls:
          "bg-sky-100 text-sky-900 border-sky-400 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-700",
      };
    case "B1":
      return {
        title: "B1 — Orta İleri (Akıcı Metin & Üslup)",
        subtitle: "İnne/Kâne babları, ism-i mevsûller, mef'ûller, hâl ve paragraf çıkarımı",
        badgeCls:
          "bg-indigo-100 text-indigo-900 border-indigo-400 dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-700",
      };
    case "B2":
      return {
        title: "B2 — İleri Düzey (Akademik & Edebî Hakimiyet)",
        subtitle: "Şart ve istisnâ üslupları, meçhul/taaccüb yapıları ve ileri i'rab analizi",
        badgeCls:
          "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700",
      };
  }
}

/**
 * Mevcut `cumleler1111` MP3 ses havuzundan o anki hedef seviyeye uygun
 * gerçek sesli bir "🎧 Sesli Dinleme-Anlama" sorusu üretir.
 */
function buildListeningQuestionForStep(
  stepIdx: number,
  usedAudioIds: Set<string>
): RuntimeAssessmentQuestion | null {
  const target = DIFFICULTY_LADDER[Math.max(0, Math.min(11, stepIdx))] || DIFFICULTY_LADDER[3];
  const validPool = cumleler1111.filter(
    (c) =>
      Boolean(c.ses_erkek || c.ses_kadin) &&
      c.arapca.trim().split(/\s+/).length >= 3 &&
      c.turkce.trim().length >= 8
  );
  if (validPool.length < 4) return null;

  const sameLevel = validPool.filter(
    (c) => (c.seviye || c.cefr || "A1") === target.seviye && !usedAudioIds.has(c.id)
  );
  const candidates =
    sameLevel.length > 0
      ? sameLevel
      : validPool.filter((c) => !usedAudioIds.has(c.id));
  if (candidates.length === 0) return null;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const distractorPool = validPool.filter(
    (c) =>
      c.id !== chosen.id &&
      c.turkce.trim().toLowerCase() !== chosen.turkce.trim().toLowerCase() &&
      (c.seviye || c.cefr || "A1") === (chosen.seviye || chosen.cefr || target.seviye)
  );
  const fallbackDistractors =
    distractorPool.length >= 3
      ? distractorPool
      : validPool.filter(
          (c) =>
            c.id !== chosen.id &&
            c.turkce.trim().toLowerCase() !== chosen.turkce.trim().toLowerCase()
        );

  const shuffledDistractors = [...fallbackDistractors];
  for (let i = shuffledDistractors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledDistractors[i], shuffledDistractors[j]] = [
      shuffledDistractors[j],
      shuffledDistractors[i],
    ];
  }
  const picked3 = shuffledDistractors.slice(0, 3);
  if (picked3.length < 3) return null;

  return {
    id: `listen_${chosen.id}`,
    seviye: (chosen.seviye || chosen.cefr || target.seviye) as Level,
    zorluk_basamagi: target.zorluk,
    ust_konu: "Günlük Kelime ve Bağlam",
    alt_grup: "Sesli Dinleme ve Anlama",
    beceri_alani: "diyalog_iletisim",
    soru_tipi: "diyalog_iletisim",
    kaynak_tipi: "1111_cumle_sesli",
    bagli_konu: chosen.odak_kalip || "Sesli İletişim",
    soru_yonergesi_tr:
      "Ses kaydını dinleyiniz ve duyduğunuz Arapça cümlenin doğru Türkçe karşılığını seçiniz.",
    soru_baglam_tr: chosen.odak_kalip
      ? `Odak Yapı: ${chosen.odak_kalip}`
      : "Doğal Arapça Seslendirme (MP3)",
    soru_metni_ar: chosen.arapca,
    secenek_dili: "tr",
    secenekler: [
      { harf: "A", metin: chosen.turkce },
      { harf: "B", metin: picked3[0].turkce },
      { harf: "C", metin: picked3[1].turkce },
      { harf: "D", metin: picked3[2].turkce },
    ],
    dogru_secenek: "A",
    cozum_detayi: {
      soru_cevirisi_tr: chosen.turkce,
      odak_kural:
        chosen.odak_kalip ||
        "Duyulan Arapça cümlenin özne, yüklem ve bağlam bütünlüğünü doğru yakalama.",
      dogru_cevap_gerekcesi: `Dinlediğiniz Arapça cümle "${chosen.arapca}" şeklindedir ve tam Türkçe karşılığı "${chosen.turkce}" ifadesidir.`,
      celdirici_analizi: {
        B: `Bu şık farklı bir cümleye ("${picked3[0].arapca}") aittir.`,
        C: `Bu şık farklı bir cümleye ("${picked3[1].arapca}") aittir.`,
        D: `Bu şık farklı bir cümleye ("${picked3[2].arapca}") aittir.`,
      },
    },
    isListeningAudioItem: true,
    audioTextAr: chosen.arapca,
    audioSentenceId: chosen.id,
    audioMaleUrl: chosen.ses_erkek,
    audioFemaleUrl: chosen.ses_kadin,
  };
}

/**
 * Bir sonraki adaptif CAT sorusunu hedef basamağa (0..11) en yakın ve
 * henüz az sorulmuş `ust_konu` başlıklarına öncelik vererek seçer.
 */
function pickNextAdaptiveBankQuestion(
  bank: AssessmentQuestion[],
  targetStep: number,
  usedIds: Set<string>,
  topicCounts: Record<string, number>,
  preferReadingContext = false
): AssessmentQuestion | null {
  const unused = bank.filter((q) => !usedIds.has(q.id));
  if (unused.length === 0) return null;

  const scored = unused.map((q) => {
    const qStep = getStepIndexForQuestion(q);
    const stepDiff = Math.abs(qStep - targetStep);
    const seenTopicCount = topicCounts[q.ust_konu] || 0;
    const readingBonus =
      preferReadingContext &&
      (q.beceri_alani === "okuma_anlama" ||
        q.beceri_alani === "diyalog_iletisim" ||
        q.beceri_alani === "kelime_baglam")
        ? -0.45
        : 0;
    const jitter = Math.random() * 0.35;
    const penalty = stepDiff * 2.5 + seenTopicCount * 1.15 + readingBonus + jitter;
    return { q, penalty };
  });

  scored.sort((a, b) => a.penalty - b.penalty);
  return scored[0]?.q || null;
}

function estimateFinalCefrFromCat(records: SessionItemRecord[]): {
  level: Level;
  confidencePct: number;
  correctCount: number;
  answeredCount: number;
} {
  if (records.length === 0) {
    return { level: "A1", confidencePct: 60, correctCount: 0, answeredCount: 0 };
  }

  let weightedEarned = 0;
  let weightedPossible = 0;
  let correctCount = 0;

  const levelCorrect: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  const levelTotal: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };

  for (const rec of records) {
    const step = getStepIndexForQuestion(rec.question); // 0..11
    const weight = 1 + step * 0.28;
    weightedPossible += weight;
    levelTotal[rec.question.seviye] += 1;
    if (rec.isCorrect && !rec.skipped) {
      weightedEarned += weight;
      correctCount += 1;
      levelCorrect[rec.question.seviye] += 1;
    }
  }

  // Son 6 sorudaki ortalama basamak yakınsaması + ağırlıklı başarı birleşimi
  const tail = records.slice(-6);
  const avgTailStep =
    tail.reduce((sum, r) => {
      const s = getStepIndexForQuestion(r.question);
      return sum + (r.isCorrect ? Math.min(11, s + 0.8) : Math.max(0, s - 0.8));
    }, 0) / Math.max(1, tail.length);

  const overallRatio = weightedPossible > 0 ? weightedEarned / weightedPossible : 0;
  const compositeStep = avgTailStep * 0.65 + overallRatio * 11 * 0.35;

  let level: Level = "A1";
  if (compositeStep >= 8.2 && (levelCorrect.B2 >= 2 || correctCount >= 13)) {
    level = "B2";
  } else if (compositeStep >= 5.3 && (levelCorrect.B1 + levelCorrect.B2 >= 2 || correctCount >= 9)) {
    level = "B1";
  } else if (compositeStep >= 2.6 && correctCount >= 5) {
    level = "A2";
  } else {
    level = "A1";
  }

  const confidencePct = Math.min(
    98,
    Math.max(68, Math.round(72 + (records.filter((r) => !r.skipped).length / records.length) * 24))
  );

  return {
    level,
    confidencePct,
    correctCount,
    answeredCount: records.length,
  };
}

function renderArabicQuestionWithStyledBlank(
  rawArabic: string,
  formattedArabic: string
): React.ReactNode {
  if (!rawArabic.includes("___")) {
    return formattedArabic;
  }
  const parts = formattedArabic.split(/_{3,}/g);
  return parts.map((part, idx) => (
    <React.Fragment key={idx}>
      {part}
      {idx < parts.length - 1 && (
        <span
          aria-label="Boşluk"
          className="inline-flex items-center justify-center min-w-[68px] sm:min-w-[84px] mx-1.5 px-2.5 py-0.5 rounded-xl border-2 border-dashed border-[#087F5B] dark:border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/60 text-[#065F46] dark:text-emerald-300 text-sm sm:text-base font-sans font-black align-middle select-none"
        >
          ؟
        </span>
      )}
    </React.Fragment>
  ));
}

// ============================================================================
// ÖĞRETMEN A4 YAPRAK TEST + ÇÖZÜMLÜ CEVAP ANAHTARI YAZDIRMA MODALI
// ============================================================================
function AssessmentPrintModal({
  bank,
  initialTopic,
  initialLevel,
  onClose,
}: {
  bank: AssessmentQuestion[];
  initialTopic?: string | null;
  initialLevel?: Level | null;
  onClose: () => void;
}) {
  const [filterType, setFilterType] = useState<"level" | "topic">(
    initialTopic ? "topic" : "level"
  );
  const [selectedLevel, setSelectedLevel] = useState<Level | "ALL">(
    initialLevel || "A1"
  );
  const [selectedTopic, setSelectedTopic] = useState<string>(
    initialTopic || ASSESSMENT_TOPICS[0].ust_konu
  );
  const [questionCount, setQuestionCount] = useState<10 | 15 | 20>(10);
  const [bookletMode, setBookletMode] = useState<"A" | "B" | "AB">("AB");
  const [printScope, setPrintScope] = useState<"both" | "student" | "key">("both");
  const [institutionTitle, setInstitutionTitle] = useState<string>(
    "Arapça Ölçme, Konu Tarama ve Değerlendirme Yaprak Testi"
  );
  const [isPrinting, setIsPrinting] = useState(false);

  const candidatePool = useMemo(() => {
    if (filterType === "topic") {
      return bank.filter((q) => q.ust_konu === selectedTopic);
    }
    if (selectedLevel === "ALL") {
      return bank;
    }
    return bank.filter((q) => q.seviye === selectedLevel);
  }, [bank, filterType, selectedLevel, selectedTopic]);

  const effectiveCount = Math.min(questionCount, candidatePool.length);

  const handlePrint = async () => {
    if (candidatePool.length === 0 || isPrinting) return;
    playClick();
    setIsPrinting(true);

    try {
      const baseSeed = hashStringSeed(
        `assessment_sheet_${filterType}_${selectedLevel}_${selectedTopic}_${effectiveCount}`
      );
      const pickRng = mulberry32(baseSeed);
      const baseSelected = seededShuffle(candidatePool, pickRng).slice(
        0,
        effectiveCount
      );

      const bookletsToRender: Array<"A" | "B"> =
        bookletMode === "AB" ? ["A", "B"] : [bookletMode];

      const scopeSubtitle =
        filterType === "topic"
          ? `Üst Konu: ${selectedTopic}`
          : selectedLevel === "ALL"
          ? "Seviye: A1–B2 Genel Tarama"
          : `Seviye: CEFR ${selectedLevel}`;

      const preparedBooklets = bookletsToRender.map((bk) => {
        const bkRng = mulberry32(
          hashStringSeed(`${baseSeed}_booklet_${bk}`)
        );
        const orderedQuestions =
          bk === "A" ? [...baseSelected] : seededShuffle(baseSelected, bkRng);
        const items = orderedQuestions.map((q, idx) => {
          const optRng = mulberry32(
            hashStringSeed(`${baseSeed}_${bk}_q_${q.id}_${idx}`)
          );
          const opts = prepareQuestionOptions(q, optRng);
          const correctDisplay =
            opts.find((o) => o.origHarf === q.dogru_secenek)?.displayHarf ||
            q.dogru_secenek;
          return {
            num: idx + 1,
            q,
            opts,
            correctDisplay,
          };
        });
        return { booklet: bk, items };
      });

      const studentPagesHtml =
        printScope === "key"
          ? ""
          : preparedBooklets
              .map(({ booklet, items }, bIdx) => {
                const pageBreakCls =
                  bIdx > 0 || printScope === "both" ? "page-break-after" : "";
                const questionsHtml = items
                  .map(({ num, q, opts }) => {
                    const formattedAr = escapeHtml(q.soru_metni_ar).replace(
                      /_{3,}/g,
                      '<span class="blank-slot">..........</span>'
                    );
                    const optsHtml = opts
                      .map((o) => {
                        const isAr = q.secenek_dili === "ar";
                        return `<div class="opt-cell ${isAr ? "opt-ar" : "opt-tr"}">
                          <span class="opt-letter">${escapeHtml(o.displayHarf)})</span>
                          <span class="${isAr ? "ar-text" : "tr-text"}" dir="${isAr ? "rtl" : "ltr"}">${escapeHtml(o.metin)}</span>
                        </div>`;
                      })
                      .join("");

                    return `<div class="q-block">
                      <div class="q-head">
                        <span class="q-num">${num}.</span>
                        <span class="q-prompt">${escapeHtml(q.soru_yonergesi_tr)}</span>
                        <span class="q-meta">[${escapeHtml(q.seviye)} · ${escapeHtml(q.ust_konu)}]</span>
                      </div>
                      ${
                        q.soru_baglam_tr
                          ? `<div class="q-context">Bağlam: ${escapeHtml(q.soru_baglam_tr)}</div>`
                          : ""
                      }
                      <div class="q-arabic ar-text" dir="rtl" lang="ar">${formattedAr}</div>
                      <div class="opts-grid ${q.secenek_dili === "ar" ? "opts-grid-ar" : "opts-grid-tr"}">
                        ${optsHtml}
                      </div>
                    </div>`;
                  })
                  .join("");

                return `<section class="sheet-section ${pageBreakCls}">
                  <header class="sheet-header">
                    <div>
                      <div class="sheet-title">${escapeHtml(institutionTitle)}</div>
                      <div class="sheet-sub">${escapeHtml(scopeSubtitle)} • Toplam ${items.length} Soru</div>
                    </div>
                    <div class="booklet-badge">${booklet} KİTAPÇIĞI</div>
                  </header>
                  <div class="student-info-bar">
                    <div>Adı Soyadı: ....................................................</div>
                    <div>Sınıf / No: ..........................</div>
                    <div>Puan: .......... / 100</div>
                  </div>
                  <div class="questions-container">
                    ${questionsHtml}
                  </div>
                </section>`;
              })
              .join("");

      const answerKeyHtml =
        printScope === "student"
          ? ""
          : `<section class="sheet-section key-section">
              <header class="sheet-header">
                <div>
                  <div class="sheet-title">Öğretmen Gerekçeli Cevap Anahtarı</div>
                  <div class="sheet-sub">${escapeHtml(scopeSubtitle)} • ${preparedBooklets.map((b) => `${b.booklet} Kitapçığı`).join(" & ")}</div>
                </div>
                <div class="booklet-badge key-badge">ÇÖZÜMLÜ ANAHTAR</div>
              </header>

              <div class="quick-key-strips">
                ${preparedBooklets
                  .map(
                    ({ booklet, items }) => `
                  <div class="quick-strip">
                    <strong>${booklet} Kitapçığı Hızlı Anahtar:</strong>
                    <span>${items.map((it) => `${it.num}-${it.correctDisplay}`).join("  |  ")}</span>
                  </div>`
                  )
                  .join("")}
              </div>

              <div class="solutions-list">
                ${preparedBooklets[0].items
                  .map(({ num, q, correctDisplay }) => {
                    const bMatch =
                      preparedBooklets[1]?.items.find((x) => x.q.id === q.id);
                    const crossRef = bMatch
                      ? ` (B Kitapçığı: Soru ${bMatch.num} → ${bMatch.correctDisplay})`
                      : "";
                    return `<div class="sol-card">
                      <div class="sol-top">
                        <strong>Soru ${num}: Doğru Şık ${correctDisplay}${escapeHtml(crossRef)}</strong>
                        <span class="q-meta">${escapeHtml(q.id)} • ${escapeHtml(q.seviye)} • ${escapeHtml(q.ust_konu)}</span>
                      </div>
                      <div class="sol-row"><strong>Çeviri:</strong> ${escapeHtml(q.cozum_detayi.soru_cevirisi_tr)}</div>
                      <div class="sol-row"><strong>Odak Kural:</strong> ${escapeHtml(q.cozum_detayi.odak_kural)}</div>
                      <div class="sol-row"><strong>Doğru Cevap Gerekçesi:</strong> ${escapeHtml(q.cozum_detayi.dogru_cevap_gerekcesi)}</div>
                    </div>`;
                  })
                  .join("")}
              </div>
            </section>`;

      const fullHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(institutionTitle)}</title>
  <style>
    @font-face {
      font-family: "ArakomPrint";
      src: url("/fonts/Arakom.ttf") format("truetype");
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: "WinSoftPrint";
      src: url("/fonts/WinSoftPro-Med.otf") format("opentype");
      font-weight: 500;
      font-style: normal;
    }
    @page {
      size: A4 portrait;
      margin: 11mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: "WinSoftPrint", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #111827;
      font-size: 10.5pt;
      line-height: 1.4;
      background: #fff;
    }
    .ar-text {
      font-family: "ArakomPrint", "Traditional Arabic", "Amiri", serif;
      font-size: 14.5pt;
      line-height: 1.95;
    }
    .page-break-after {
      page-break-after: always;
      break-after: page;
    }
    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #065F46;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .sheet-title {
      font-size: 13pt;
      font-weight: 800;
      color: #065F46;
    }
    .sheet-sub {
      font-size: 9pt;
      color: #4b5563;
      margin-top: 2px;
    }
    .booklet-badge {
      padding: 4px 10px;
      border: 2px solid #065F46;
      border-radius: 8px;
      font-weight: 800;
      font-size: 10pt;
      color: #065F46;
    }
    .key-badge {
      border-color: #6741D9;
      color: #6741D9;
    }
    .student-info-bar {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 10px;
      border: 1px dashed #9ca3af;
      border-radius: 6px;
      font-size: 9.5pt;
      margin-bottom: 10px;
      background: #f9fafb;
    }
    .q-block {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 7px 10px;
      margin-bottom: 8px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .q-head {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 9.5pt;
    }
    .q-num {
      font-weight: 800;
      color: #065F46;
    }
    .q-prompt {
      font-weight: 700;
      flex: 1;
    }
    .q-meta {
      font-size: 8pt;
      color: #6b7280;
    }
    .q-context {
      font-size: 8.5pt;
      color: #4b5563;
      font-style: italic;
      margin-top: 2px;
    }
    .q-arabic {
      margin: 4px 0 6px 0;
      padding: 4px 8px;
      background: #fdfbf7;
      border-right: 3px solid #087F5B;
      border-radius: 4px;
      text-align: right;
    }
    .blank-slot {
      font-family: sans-serif;
      font-weight: 700;
      color: #065F46;
      padding: 0 4px;
    }
    .opts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px 12px;
    }
    .opt-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 6px;
      border: 1px solid #f3f4f6;
      border-radius: 5px;
    }
    .opt-ar {
      justify-content: space-between;
    }
    .opt-letter {
      font-weight: 800;
      font-size: 9.5pt;
      color: #374151;
      flex-shrink: 0;
    }
    .tr-text {
      font-size: 9.5pt;
    }
    .quick-key-strips {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
    }
    .quick-strip {
      padding: 6px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #f8fafc;
      font-size: 9pt;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sol-card {
      border: 1px solid #e5e7eb;
      border-radius: 7px;
      padding: 6px 9px;
      margin-bottom: 6px;
      font-size: 9pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .sol-top {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed #e5e7eb;
      padding-bottom: 3px;
      margin-bottom: 3px;
      color: #065F46;
    }
    .sol-row {
      margin-top: 2px;
    }
  </style>
</head>
<body>
  ${studentPagesHtml}
  ${answerKeyHtml}
</body>
</html>`;

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || !iframe.contentWindow) {
        document.body.removeChild(iframe);
        setIsPrinting(false);
        return;
      }

      doc.open();
      doc.write(fullHtml);
      doc.close();

      const waitAssetsPromise = (async () => {
        const imgs = Array.from(doc.images || []);
        await Promise.all(
          imgs.map(
            (img) =>
              new Promise<void>((res) => {
                if (img.complete) return res();
                img.onload = () => res();
                img.onerror = () => res();
              })
          )
        );
        if (doc.fonts && doc.fonts.ready) {
          await doc.fonts.ready.catch(() => {});
        }
      })();

      await Promise.race([
        waitAssetsPromise,
        new Promise<void>((res) => setTimeout(res, 1500)),
      ]);

      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      setTimeout(() => {
        try {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        } catch {
          // ignore
        }
        setIsPrinting(false);
      }, 2000);
    } catch {
      setIsPrinting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#FDFBF7] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#F7EFE1] dark:bg-[var(--background)] px-4 sm:px-5 py-3.5 border-b-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#087F5B] text-white flex items-center justify-center shrink-0">
              <Printer size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                A4 Yaprak Test &amp; Çözümlü Anahtar Yazdır
              </h2>
              <p className="text-[11px] font-semibold text-[var(--muted)]">
                A/B kitapçık karıştırmalı, Arakom fontlu ve gerekçeli öğretmen anahtarlı A4 çıktı
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Başlık */}
          <div className="space-y-1">
            <label className="block text-xs font-extrabold text-[var(--foreground)]">
              Kağıt Üst Başlığı
            </label>
            <input
              type="text"
              value={institutionTitle}
              onChange={(e) => setInstitutionTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs sm:text-sm font-bold text-[var(--foreground)] focus:outline-none focus:border-[#087F5B]"
            />
          </div>

          {/* Kapsam Türü */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                playClick();
                setFilterType("level");
              }}
              className={`py-2 px-3 rounded-xl border-2 text-xs font-extrabold cursor-pointer transition-all ${
                filterType === "level"
                  ? "bg-[#087F5B] border-[#087F5B] text-white"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
              }`}
            >
              🎓 Seviyeye Göre (CEFR)
            </button>
            <button
              type="button"
              onClick={() => {
                playClick();
                setFilterType("topic");
              }}
              className={`py-2 px-3 rounded-xl border-2 text-xs font-extrabold cursor-pointer transition-all ${
                filterType === "topic"
                  ? "bg-[#6741D9] border-[#6741D9] text-white"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
              }`}
            >
              📚 13 Üst Konuya Göre
            </button>
          </div>

          {filterType === "level" ? (
            <div className="grid grid-cols-5 gap-1.5">
              {(["A1", "A2", "B1", "B2", "ALL"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    playClick();
                    setSelectedLevel(lvl);
                  }}
                  className={`py-2 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                    selectedLevel === lvl
                      ? "bg-[#087F5B]/15 border-[#087F5B] text-[#065F46] dark:text-emerald-300"
                      : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {lvl === "ALL" ? "Tümü" : lvl}
                </button>
              ))}
            </div>
          ) : (
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs sm:text-sm font-extrabold text-[var(--foreground)]"
            >
              {ASSESSMENT_TOPICS.map((t) => (
                <option key={t.ust_konu} value={t.ust_konu}>
                  {t.icon} {t.ust_konu} ({t.questionCount} Soru)
                </option>
              ))}
            </select>
          )}

          {/* Soru Sayısı & Kitapçık */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="block text-xs font-extrabold text-[var(--foreground)]">
                Soru Sayısı (Havuz: {candidatePool.length})
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {([10, 15, 20] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => {
                      playClick();
                      setQuestionCount(cnt);
                    }}
                    className={`py-2 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                      questionCount === cnt
                        ? "bg-[#087F5B] border-[#087F5B] text-white"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                    }`}
                  >
                    {Math.min(cnt, candidatePool.length)} Soru
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="block text-xs font-extrabold text-[var(--foreground)]">
                Kitapçık Türü
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "A", label: "Sadece A" },
                    { id: "B", label: "Sadece B" },
                    { id: "AB", label: "A + B" },
                  ] as const
                ).map((bk) => (
                  <button
                    key={bk.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setBookletMode(bk.id);
                    }}
                    className={`py-2 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                      bookletMode === bk.id
                        ? "bg-[#6741D9] border-[#6741D9] text-white"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                    }`}
                  >
                    {bk.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Çıktı Kapsamı */}
          <div className="space-y-1">
            <span className="block text-xs font-extrabold text-[var(--foreground)]">
              Yazdırılacak Bölümler
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: "both", label: "📄 Test + Çözümlü Anahtar" },
                { id: "student", label: "📝 Sadece Öğrenci Testi" },
                { id: "key", label: "🔑 Sadece Çözümlü Anahtar" },
              ].map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    playClick();
                    setPrintScope(sc.id as "both" | "student" | "key");
                  }}
                  className={`py-2 px-2.5 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                    printScope === sc.id
                      ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200"
                      : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#F7EFE1] dark:bg-[var(--background)] px-4 sm:px-5 py-3.5 border-t-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-[var(--muted)]">
            Seçili: {effectiveCount} soru • {bookletMode === "AB" ? "A & B Kitapçığı" : `${bookletMode} Kitapçığı`}
          </span>

          <button
            type="button"
            disabled={effectiveCount === 0 || isPrinting}
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] disabled:opacity-50 text-white border-b-3 border-emerald-900 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
          >
            <Printer size={16} />
            <span>{isPrinting ? "Hazırlanıyor..." : "A4 Yazdır / PDF Kaydet"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// GEREKÇELİ ÇÖZÜM & HEDEFLİ ÇELDİRİCİ TEŞHİS PANELİ
// ============================================================================
function DetailedSolutionBox({
  record,
}: {
  record: SessionItemRecord;
}) {
  const {
    grammarDepthMode,
    setGrammarDepthMode,
    harekeMode,
    arabicFont,
  } = useSettings();
  const [showOtherDistractors, setShowOtherDistractors] = useState(false);

  const { question, preparedOptions, selectedOrigHarf, skipped, isCorrect } =
    record;

  const isSimple = grammarDepthMode === "simple";
  const formatRuleText = (txt: string) =>
    isSimple ? simplifyGrammarTerminology(txt) : txt;

  const selectedDistractorReason = getDistractorAnalysisForSelection(
    question,
    selectedOrigHarf
  );

  const correctPrepared = preparedOptions.find(
    (o) => o.origHarf === question.dogru_secenek
  );

  const otherDistractors = preparedOptions.filter(
    (o) =>
      o.origHarf !== question.dogru_secenek && o.origHarf !== selectedOrigHarf
  );

  return (
    <div className="rounded-2xl border-2 border-[#087F5B]/45 dark:border-emerald-600/50 bg-[#FDFBF7] dark:bg-[var(--background)] p-3.5 sm:p-4 space-y-3 shadow-xs">
      {/* Üst Başlık + Sade / Akademik Seçici */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#087F5B]/15 text-[#065F46] dark:text-emerald-300 text-xs font-extrabold">
            <Lightbulb size={14} />
            <span>💡 Gerekçeli Çözüm</span>
          </span>
          {correctPrepared && (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold">
              Doğru Şık: {correctPrepared.displayHarf}
            </span>
          )}
        </div>

        <div
          role="group"
          aria-label="Çözüm Anlatım Derinliği"
          className="inline-flex items-center rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] p-0.5 border border-[#E6D7BE] dark:border-[var(--border)]"
        >
          <button
            type="button"
            onClick={() => {
              playClick();
              setGrammarDepthMode("simple");
            }}
            className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold cursor-pointer transition-all ${
              isSimple
                ? "bg-emerald-600 text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            🌱 Sade Anlatım
          </button>
          <button
            type="button"
            onClick={() => {
              playClick();
              setGrammarDepthMode("academic");
            }}
            className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold cursor-pointer transition-all ${
              !isSimple
                ? "bg-[#6741D9] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            🎓 Akademik &amp; İ&apos;rab
          </button>
        </div>
      </div>

      {/* HEDEFLİ ÇELDİRİCİ TEŞHİSİ: Yanlış şık seçildiyse en üstte belirgin kutu */}
      {!isCorrect && !skipped && selectedDistractorReason && (
        <div className="rounded-xl border-2 border-rose-400 dark:border-rose-700 bg-rose-50/90 dark:bg-rose-950/45 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-black text-rose-800 dark:text-rose-200">
            <AlertTriangle size={15} className="shrink-0" />
            <span>
              ⚠️ Seçtiğiniz Şık ({record.selectedDisplayHarf}) Neden Yanlış?
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-rose-950 dark:text-rose-100 leading-relaxed">
            <MixedText
              text={formatRuleText(selectedDistractorReason)}
              arabicClassName="arabic font-arabic text-base font-bold text-rose-900 dark:text-rose-200 mx-0.5 inline-block"
            />
          </p>
        </div>
      )}

      {skipped && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-200">
          🤔 Bu soruyu tahmin yürütmeden pas geçtiniz. Aşağıdan kuralı ve doğru cevabın gerekçesini inceleyebilirsiniz.
        </div>
      )}

      {/* Dinleme sorusu ise Arapça cümleyi çözümde göster */}
      {question.isListeningAudioItem && (
        <div className="rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] bg-[#F7EFE1]/60 dark:bg-[var(--surface)] p-3 text-right">
          <span className="block text-[10px] font-extrabold text-[var(--muted)] text-left mb-1">
            🎧 DİNLEDİĞİNİZ ARAPÇA CÜMLE:
          </span>
          <p
            dir="rtl"
            lang="ar"
            className="arabic font-arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-300 leading-[2.0]"
          >
            {formatArabicByHarekeMode(
              question.soru_metni_ar,
              harekeMode,
              arabicFont
            )}
          </p>
        </div>
      )}

      {/* 1. Cümle Çevirisi */}
      <div className="rounded-xl bg-[#F7EFE1]/75 dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 space-y-1">
        <span className="block text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400">
          🇹🇷 Cümle Çevirisi
        </span>
        <p className="text-xs sm:text-sm font-bold text-[var(--foreground)] leading-relaxed">
          “{question.cozum_detayi.soru_cevirisi_tr}”
        </p>
      </div>

      {/* 2. Odak Kural */}
      <div className="rounded-xl bg-[#F3F0FF]/80 dark:bg-[var(--lavender-bg)] border border-[#6741D9]/35 p-3 space-y-1">
        <span className="block text-[11px] font-extrabold text-[#6741D9] dark:text-[#d0bfff]">
          📌 Odak Kural ({question.ust_konu})
        </span>
        <p className="text-xs sm:text-sm font-semibold text-[var(--foreground)] leading-relaxed">
          <MixedText
            text={formatRuleText(question.cozum_detayi.odak_kural)}
            arabicClassName="arabic font-arabic text-base font-bold text-[#4C28B5] dark:text-[#d0bfff] mx-0.5 inline-block"
          />
        </p>
      </div>

      {/* 3. Doğru Cevap Gerekçesi */}
      <div className="rounded-xl bg-emerald-50/85 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/70 p-3 space-y-1">
        <span className="block text-[11px] font-extrabold text-emerald-900 dark:text-emerald-300">
          ✅ Doğru Cevap Gerekçesi
        </span>
        <p className="text-xs sm:text-sm font-semibold text-emerald-950 dark:text-emerald-100 leading-relaxed">
          <MixedText
            text={formatRuleText(question.cozum_detayi.dogru_cevap_gerekcesi)}
            arabicClassName="arabic font-arabic text-base font-bold text-emerald-900 dark:text-emerald-200 mx-0.5 inline-block"
          />
        </p>
      </div>

      {/* 4. Diğer Çeldiricilerin Analizi */}
      {otherDistractors.length > 0 && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => {
              playClick();
              setShowOtherDistractors((v) => !v);
            }}
            className="text-xs font-extrabold text-[var(--muted)] hover:text-[var(--foreground)] inline-flex items-center gap-1 cursor-pointer"
          >
            {showOtherDistractors ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
            <span>
              Diğer Şıkların Çeldirici Analizini{" "}
              {showOtherDistractors ? "Gizle" : "Göster"} ({otherDistractors.length})
            </span>
          </button>

          {showOtherDistractors && (
            <div className="mt-2 space-y-1.5">
              {otherDistractors.map((opt) => {
                const reason =
                  question.cozum_detayi.celdirici_analizi?.[opt.origHarf];
                if (!reason) return null;
                return (
                  <div
                    key={opt.displayHarf}
                    className="rounded-xl bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] px-3 py-2 text-xs leading-relaxed"
                  >
                    <strong className="text-[var(--foreground)]">
                      Şık {opt.displayHarf}:{" "}
                    </strong>
                    <MixedText
                      text={formatRuleText(reason)}
                      arabicClassName="arabic font-arabic text-sm font-bold text-[#065F46] dark:text-emerald-300 mx-0.5 inline-block"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ANA BİLEŞEN İÇERİĞİ
// ============================================================================
const subscribeNoop = () => () => {};

function SeviyeTespitContent() {
  const searchParams = useSearchParams();
  const autoLaunchedQueryRef = useRef<string>("");

  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const [bank, setBank] = useState<AssessmentQuestion[]>([]);
  const [loadingBank, setLoadingBank] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AssessmentCenterTab>(() => {
    const m = searchParams.get("mode");
    return m === "topic" || m === "exam" || m === "cat" ? m : "cat";
  });
  const [topicQuizLength, setTopicQuizLength] = useState<"10" | "all">("10");
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Aktif oturum state'leri
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionMode, setSessionMode] = useState<AssessmentCenterTab>("cat");
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [sessionTopic, setSessionTopic] = useState<string | null>(null);
  const [sessionExamLevel, setSessionExamLevel] = useState<Level | null>(null);
  const [sessionItems, setSessionItems] = useState<SessionItemRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [showReviewList, setShowReviewList] = useState(false);
  const [appliedPlanFeedback, setAppliedPlanFeedback] = useState(false);

  // CAT Adaptif takip referansları
  const catStepRef = useRef<number>(3);
  const catStreakRef = useRef<number>(0);
  const catUsedIdsRef = useRef<Set<string>>(new Set());
  const catUsedAudioIdsRef = useRef<Set<string>>(new Set());
  const catTopicCountsRef = useRef<Record<string, number>>({});

  const {
    harekeMode,
    cycleHarekeMode,
    arabicFont,
    speechRate,
    preferredVoiceGender,
    setPreferredLevel,
  } = useSettings();

  const {
    detectedCefrLevel,
    topicMastery,
    completedLevelExams,
    setDetectedCefrLevel,
    recordTopicAttempt,
    recordSkillAttempt,
    markLevelExamCompleted,
    addStudyMinutes,
  } = useUserStore();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("@/data/seviye_tespit_sorulari.json");
        const loaded = (mod.default || mod) as AssessmentQuestion[];
        if (!cancelled) {
          setBank(Array.isArray(loaded) ? loaded : []);
          setLoadingBank(false);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Soru bankası yüklenirken bir hata oluştu.");
          setLoadingBank(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      stopAllAudio();
    };
  }, []);

  const pedagogicalDialogues = useMemo(
    () => getDialoguesSortedPedagogically(),
    []
  );

  // Her üst konu için gerçek soru sayıları
  const topicActualCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of bank) {
      counts[q.ust_konu] = (counts[q.ust_konu] || 0) + 1;
    }
    return counts;
  }, [bank]);

  const makeSessionRecord = useCallback(
    (q: RuntimeAssessmentQuestion): SessionItemRecord => ({
      question: q,
      preparedOptions: prepareQuestionOptions(q),
      selectedDisplayHarf: null,
      selectedOrigHarf: null,
      skipped: false,
      isCorrect: false,
      answered: false,
    }),
    []
  );

  // 1. MOD 1: Adaptif Seviye Tespit (CAT) Başlat
  const startCatSession = useCallback(
    (sourceBank: AssessmentQuestion[] = bank) => {
      if (sourceBank.length === 0) return;
      stopAllAudio();
      playStart();

      catStepRef.current = 3; // A2.1 / A1.3 başlangıç basamağı
      catStreakRef.current = 0;
      catUsedIdsRef.current = new Set();
      catUsedAudioIdsRef.current = new Set();
      catTopicCountsRef.current = {};

      const firstQ = pickNextAdaptiveBankQuestion(
        sourceBank,
        catStepRef.current,
        catUsedIdsRef.current,
        catTopicCountsRef.current
      );
      if (!firstQ) return;

      catUsedIdsRef.current.add(firstQ.id);
      catTopicCountsRef.current[firstQ.ust_konu] = 1;

      setSessionMode("cat");
      setSessionTitle("Adaptif Seviye Tespit Sınavı (CAT)");
      setSessionTopic(null);
      setSessionExamLevel(null);
      setSessionItems([makeSessionRecord(firstQ)]);
      setCurrentIndex(0);
      setSessionCompleted(false);
      setShowReviewList(false);
      setAppliedPlanFeedback(false);
      setSessionActive(true);
    },
    [bank, makeSessionRecord]
  );

  // 2. MOD 2: Konu Tarama Testi (KTT) Başlat
  const startTopicSession = useCallback(
    (
      topicName: string,
      lengthMode: "10" | "all" = topicQuizLength,
      sourceBank: AssessmentQuestion[] = bank
    ) => {
      const topicPool = sourceBank.filter((q) => q.ust_konu === topicName);
      if (topicPool.length === 0) return;
      stopAllAudio();
      playStart();

      const shuffled = [...topicPool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      // Zorluk sırasını yumuşak artan tutmak için hafif grupla
      const picked =
        lengthMode === "10" ? shuffled.slice(0, 10) : shuffled;
      picked.sort((a, b) => getStepIndexForQuestion(a) - getStepIndexForQuestion(b));

      setSessionMode("topic");
      setSessionTitle(`Konu Tarama: ${topicName}`);
      setSessionTopic(topicName);
      setSessionExamLevel(null);
      setSessionItems(picked.map((q) => makeSessionRecord(q)));
      setCurrentIndex(0);
      setSessionCompleted(false);
      setShowReviewList(false);
      setAppliedPlanFeedback(false);
      setSessionActive(true);
    },
    [bank, makeSessionRecord, topicQuizLength]
  );

  // 3. MOD 3: Kur Bitirme / Seviye Atlama Sınavı Başlat (20 Soru)
  const startLevelExamSession = useCallback(
    (level: Level, sourceBank: AssessmentQuestion[] = bank) => {
      const levelPool = sourceBank.filter((q) => q.seviye === level);
      if (levelPool.length === 0) return;
      stopAllAudio();
      playStart();

      const shuffled = [...levelPool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const picked = shuffled.slice(0, Math.min(20, shuffled.length));
      picked.sort((a, b) => a.zorluk_basamagi - b.zorluk_basamagi);

      setSessionMode("exam");
      setSessionTitle(`${level} Kur Bitirme Sınavı`);
      setSessionTopic(null);
      setSessionExamLevel(level);
      setSessionItems(picked.map((q) => makeSessionRecord(q)));
      setCurrentIndex(0);
      setSessionCompleted(false);
      setShowReviewList(false);
      setAppliedPlanFeedback(false);
      setSessionActive(true);
    },
    [bank, makeSessionRecord]
  );

  // URL Parametreleri (?mode=cat|topic|exam & ?topic=... & ?level=A1)
  useEffect(() => {
    if (loadingBank || bank.length === 0) return;
    const modeParam = searchParams.get("mode");
    const topicParam = searchParams.get("topic");
    const levelParam = searchParams.get("level") as Level | null;
    const sig = `${modeParam || ""}|${topicParam || ""}|${levelParam || ""}`;
    if (!sig.replace(/\|/g, "") || autoLaunchedQueryRef.current === sig) return;
    autoLaunchedQueryRef.current = sig;

    const timer = window.setTimeout(() => {
      if (modeParam === "topic") {
        setActiveTab("topic");
        if (topicParam && bank.some((q) => q.ust_konu === topicParam)) {
          startTopicSession(topicParam, "10", bank);
        }
      } else if (modeParam === "exam") {
        setActiveTab("exam");
        if (levelParam && ["A1", "A2", "B1", "B2"].includes(levelParam)) {
          startLevelExamSession(levelParam, bank);
        }
      } else if (modeParam === "cat" && searchParams.get("autostart") === "1") {
        setActiveTab("cat");
        startCatSession(bank);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    bank,
    loadingBank,
    searchParams,
    startCatSession,
    startLevelExamSession,
    startTopicSession,
  ]);

  const currentRecord = sessionItems[currentIndex] || null;

  const playQuestionAudio = useCallback(
    (q: RuntimeAssessmentQuestion, customRate?: number) => {
      const effectiveRate = customRate ?? (mounted ? speechRate : 1);
      if (q.isListeningAudioItem) {
        void playDualGenderAudio({
          text: q.audioTextAr || q.soru_metni_ar,
          id: q.audioSentenceId,
          ses_erkek: q.audioMaleUrl,
          ses_kadin: q.audioFemaleUrl,
          gender: mounted ? preferredVoiceGender : "erkek",
          rate: effectiveRate,
        });
      } else {
        const cleanForSpeech = q.soru_metni_ar.replace(/_{2,}/g, " ... ");
        void speakHybrid({
          text: cleanForSpeech,
          rate: effectiveRate,
        });
      }
    },
    [mounted, preferredVoiceGender, speechRate]
  );

  // Dinleme sorusu ekrana geldiğinde otomatik bir kez seslendir
  useEffect(() => {
    if (
      !sessionActive ||
      sessionCompleted ||
      !currentRecord ||
      !currentRecord.question.isListeningAudioItem ||
      currentRecord.answered
    ) {
      return;
    }
    const timer = setTimeout(() => {
      playQuestionAudio(currentRecord.question);
    }, 280);
    return () => clearTimeout(timer);
  }, [
    currentIndex,
    currentRecord,
    playQuestionAudio,
    sessionActive,
    sessionCompleted,
  ]);

  // Dinleme sorusunu tek tıkla okuma sorusuyla değiştirme (Ceza puanı olmadan!)
  const handleSwapListeningToReading = () => {
    if (!currentRecord || !currentRecord.question.isListeningAudioItem) return;
    stopAllAudio();
    playClick();

    const replacement = pickNextAdaptiveBankQuestion(
      bank,
      catStepRef.current,
      catUsedIdsRef.current,
      catTopicCountsRef.current,
      true
    );
    if (!replacement) return;

    catUsedIdsRef.current.add(replacement.id);
    catTopicCountsRef.current[replacement.ust_konu] =
      (catTopicCountsRef.current[replacement.ust_konu] || 0) + 1;

    setSessionItems((prev) =>
      prev.map((item, idx) =>
        idx === currentIndex ? makeSessionRecord(replacement) : item
      )
    );
  };

  const finalizeSession = useCallback(
    (finalRecords: SessionItemRecord[]) => {
      stopAllAudio();
      setSessionCompleted(true);
      addStudyMinutes(3);

      const correctTotal = finalRecords.filter((r) => r.isCorrect).length;
      const pct =
        finalRecords.length > 0
          ? Math.round((correctTotal / finalRecords.length) * 100)
          : 0;

      if (sessionMode === "exam" && sessionExamLevel && pct >= 75) {
        markLevelExamCompleted(sessionExamLevel);
      }
      playFanfare(pct);
    },
    [addStudyMinutes, markLevelExamCompleted, sessionExamLevel, sessionMode]
  );

  const advanceToNextOrFinish = useCallback(
    (updatedRecords: SessionItemRecord[]) => {
      stopAllAudio();
      if (sessionMode === "cat") {
        const nextSlot = currentIndex + 1;
        if (nextSlot >= CAT_TOTAL_QUESTIONS) {
          finalizeSession(updatedRecords);
          return;
        }

        let nextQuestion: RuntimeAssessmentQuestion | null = null;
        if (CAT_LISTENING_SLOTS.has(nextSlot)) {
          const listenQ = buildListeningQuestionForStep(
            catStepRef.current,
            catUsedAudioIdsRef.current
          );
          if (listenQ) {
            if (listenQ.audioSentenceId) {
              catUsedAudioIdsRef.current.add(listenQ.audioSentenceId);
            }
            nextQuestion = listenQ;
          }
        }

        if (!nextQuestion) {
          const bankQ = pickNextAdaptiveBankQuestion(
            bank,
            catStepRef.current,
            catUsedIdsRef.current,
            catTopicCountsRef.current
          );
          if (bankQ) {
            catUsedIdsRef.current.add(bankQ.id);
            catTopicCountsRef.current[bankQ.ust_konu] =
              (catTopicCountsRef.current[bankQ.ust_konu] || 0) + 1;
            nextQuestion = bankQ;
          }
        }

        if (!nextQuestion) {
          finalizeSession(updatedRecords);
          return;
        }

        const nextRec = makeSessionRecord(nextQuestion);
        setSessionItems([...updatedRecords, nextRec]);
        setCurrentIndex(nextSlot);
        return;
      }

      // KTT veya Kur Sınavı
      if (currentIndex + 1 < updatedRecords.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        finalizeSession(updatedRecords);
      }
    },
    [
      bank,
      currentIndex,
      finalizeSession,
      makeSessionRecord,
      sessionMode,
    ]
  );

  const handleAnswerOrSkip = (
    chosenOption: PreparedAssessmentOption | null,
    isSkip: boolean
  ) => {
    if (!currentRecord || currentRecord.answered) return;

    const q = currentRecord.question;
    const selectedOrig = isSkip ? null : chosenOption?.origHarf || null;
    const selectedDisp = isSkip ? null : chosenOption?.displayHarf || null;
    const right = !isSkip && isSelectedOptionCorrect(q, selectedOrig);

    // Konu ve 6-Beceri istatistiklerini kaydet
    if (!q.isListeningAudioItem) {
      recordTopicAttempt(q.ust_konu, right);
    }
    recordSkillAttempt(mapQuestionToSkillKey(q), right);

    // CAT adaptif zorluk basamağını güncelle
    if (sessionMode === "cat") {
      if (right) {
        catStreakRef.current =
          catStreakRef.current >= 0 ? catStreakRef.current + 1 : 1;
        const delta = catStreakRef.current >= 2 ? 2 : 1;
        catStepRef.current = Math.min(11, catStepRef.current + delta);
      } else {
        catStreakRef.current =
          catStreakRef.current <= 0 ? catStreakRef.current - 1 : -1;
        const delta = catStreakRef.current <= -2 || isSkip ? 2 : 1;
        catStepRef.current = Math.max(0, catStepRef.current - delta);
      }
    }

    const updatedItem: SessionItemRecord = {
      ...currentRecord,
      selectedDisplayHarf: selectedDisp,
      selectedOrigHarf: selectedOrig,
      skipped: isSkip,
      isCorrect: right,
      answered: true,
    };

    const nextItems = sessionItems.map((it, idx) =>
      idx === currentIndex ? updatedItem : it
    );
    setSessionItems(nextItems);

    if (sessionMode === "topic") {
      // Konu Taramada anında gerekçeli çözümü aç (kaydırma zıplaması olmadan)
      if (isSkip) {
        playClick();
      } else if (right) {
        playCorrect({ streak: 1 });
      } else {
        playWrong();
      }
      return;
    }

    // CAT ve Kur Bitirme Sınavında ipucu sızmasını önlemek için doğrudan sonraki soruya geç
    playClick();
    setTimeout(() => {
      advanceToNextOrFinish(nextItems);
    }, 180);
  };

  // Oturum Sonu Hesaplamaları
  const catEvaluation = useMemo(
    () => estimateFinalCefrFromCat(sessionItems),
    [sessionItems]
  );

  const recommendedStartDialogue = useMemo(() => {
    const targetLvl =
      sessionMode === "exam" && sessionExamLevel
        ? sessionExamLevel
        : catEvaluation.level;
    return (
      pedagogicalDialogues.find((d) => d.seviye === targetLvl) ||
      pedagogicalDialogues[0]
    );
  }, [catEvaluation.level, pedagogicalDialogues, sessionExamLevel, sessionMode]);

  const sessionTopicBreakdown = useMemo(() => {
    const map: Record<string, { correct: number; total: number }> = {};
    for (const r of sessionItems) {
      if (r.question.isListeningAudioItem) continue;
      const key = r.question.ust_konu;
      if (!map[key]) map[key] = { correct: 0, total: 0 };
      map[key].total += 1;
      if (r.isCorrect) map[key].correct += 1;
    }
    return Object.entries(map)
      .map(([ust_konu, val]) => ({
        ust_konu,
        correct: val.correct,
        total: val.total,
        pct: Math.round((val.correct / Math.max(1, val.total)) * 100),
      }))
      .sort((a, b) => a.pct - b.pct);
  }, [sessionItems]);

  const displayArabic = (text: string) =>
    formatArabicByHarekeMode(
      text,
      mounted ? harekeMode : "full",
      mounted ? arabicFont : "arakom"
    );

  // ============================================================================
  // YÜKLENİYOR / HATA DURUMU
  // ============================================================================
  if (loadingBank) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 py-4">
        <div className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#F7EFE1] dark:bg-[var(--surface)] p-6 sm:p-8 animate-pulse space-y-4">
          <div className="h-6 w-64 rounded-xl bg-[#E6D7BE]/80 dark:bg-slate-700" />
          <div className="h-4 w-96 max-w-full rounded-lg bg-[#E6D7BE]/60 dark:bg-slate-800" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="h-32 rounded-2xl bg-white/80 dark:bg-slate-800/70" />
            <div className="h-32 rounded-2xl bg-white/80 dark:bg-slate-800/70" />
            <div className="h-32 rounded-2xl bg-white/80 dark:bg-slate-800/70" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="rounded-3xl border-2 border-rose-400 bg-rose-50 dark:bg-rose-950/40 p-6 text-center space-y-3">
          <p className="text-sm font-extrabold text-rose-900 dark:text-rose-200">
            {loadError}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold"
          >
            <ChevronLeft size={14} />
            <span>Ana Sayfaya Dön</span>
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================================
  // AKTİF SINAV / TARAMA EKRANI VEYA SONUÇ EKRANI
  // ============================================================================
  if (sessionActive) {
    const totalCount =
      sessionMode === "cat" ? CAT_TOTAL_QUESTIONS : sessionItems.length;
    const correctCount = sessionItems.filter((r) => r.isCorrect).length;
    const scorePct =
      sessionItems.length > 0
        ? Math.round((correctCount / sessionItems.length) * 100)
        : 0;

    if (sessionCompleted) {
      const finalLevel = catEvaluation.level;
      const lvlMeta = getLevelMeta(finalLevel);
      const examPassed = sessionMode === "exam" && scorePct >= 75;

      return (
        <div className="max-w-4xl mx-auto space-y-4 pb-16">
          {/* Üst Geri Dönüş Barı */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                playClick();
                stopAllAudio();
                setSessionActive(false);
                setSessionCompleted(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 text-xs font-extrabold text-[var(--foreground)] cursor-pointer"
            >
              <ChevronLeft size={15} />
              <span>Ölçme Merkezine Dön</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                setPrintModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 text-xs font-extrabold text-[#065F46] dark:text-emerald-400 cursor-pointer"
            >
              <Printer size={14} />
              <span>A4 Yaprak Test Yazdır</span>
            </button>
          </div>

          {/* ANA SONUÇ KARNESİ */}
          <section className="rounded-3xl border-2 border-[#087F5B] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 sm:p-6 space-y-4">
            {sessionMode === "cat" ? (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] pb-4">
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#087F5B] text-white text-xs font-extrabold">
                      <Compass size={14} />
                      <span>Adaptif Seviye Tespit Sonucunuz</span>
                    </span>
                    <h1 className="text-xl sm:text-2xl font-black text-[var(--foreground)]">
                      {lvlMeta.title}
                    </h1>
                    <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
                      {lvlMeta.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div
                      className={`px-4 py-3 rounded-2xl border-2 text-center ${lvlMeta.badgeCls}`}
                    >
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider">
                        Tespit Edilen Kur
                      </span>
                      <span className="block text-3xl font-black leading-tight">
                        {finalLevel}
                      </span>
                    </div>
                    <div className="px-4 py-3 rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-white dark:bg-[var(--background)] text-center">
                      <span className="block text-[10px] font-extrabold text-[var(--muted)] uppercase">
                        Doğruluk
                      </span>
                      <span className="block text-2xl font-black text-[var(--foreground)] tabular-nums">
                        {correctCount}/{sessionItems.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Aksiyon Kartları: Seviyeyi Çalışma Planına Uygula + Önerilen Diyalog */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-extrabold text-[#065F46] dark:text-emerald-400">
                        🎯 Kişisel Çalışma Planı Senkronizasyonu
                      </span>
                      <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                        Tespit edilen <strong>{finalLevel}</strong> seviyesini onayladığınızda Ana Sayfadaki 12 dakikalık günlük paket, okuma metinleri ve kalıp cümleler bu seviyeye göre uyarlanır.
                      </p>
                    </div>

                    {appliedPlanFeedback ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 px-3 py-2.5">
                        <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200 inline-flex items-center gap-1.5">
                          <CheckCircle2 size={15} />
                          <span>{finalLevel} seviyesi çalışma planınıza uygulandı!</span>
                        </span>
                        <Link
                          href="/"
                          onClick={() => playClick()}
                          className="text-xs font-black text-[#065F46] dark:text-emerald-300 underline"
                        >
                          Pakete Git →
                        </Link>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setDetectedCefrLevel(finalLevel);
                          setPreferredLevel(mapCefrToPreferredTr(finalLevel));
                          setAppliedPlanFeedback(true);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-3 border-emerald-900 text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Target size={16} />
                        <span>🎯 Bu Seviyeyi Çalışma Planıma Uygula</span>
                      </button>
                    )}
                  </div>

                  <div className="rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-extrabold text-[#6741D9] dark:text-[#d0bfff]">
                        💬 Önerilen Başlangıç Diyaloğu ({recommendedStartDialogue.seviye})
                      </span>
                      <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                        Diyalog #{recommendedStartDialogue.id.replace("dlg_", "")}:{" "}
                        {recommendedStartDialogue.baslik_tr}
                      </h3>
                      <p
                        dir="rtl"
                        lang="ar"
                        className="arabic font-arabic text-lg font-bold text-[#065F46] dark:text-emerald-300"
                      >
                        {displayArabic(recommendedStartDialogue.baslik_ar)}
                      </p>
                    </div>

                    <Link
                      href={`/diyalog/${recommendedStartDialogue.id}`}
                      onClick={() => playClick()}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#6741D9] hover:bg-[#5432B8] text-white border-b-3 border-[#3d2191] text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2"
                    >
                      <BookOpen size={15} />
                      <span>Önerilen Diyalogdan Başla →</span>
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#6741D9] text-white text-xs font-extrabold">
                    <Trophy size={14} />
                    <span>{sessionTitle} Tamamlandı</span>
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-[var(--foreground)]">
                    {sessionMode === "exam"
                      ? examPassed
                        ? `🎉 Tebrikler! ${sessionExamLevel} Kur Bitirme Rozetini Kazandınız!`
                        : `${sessionExamLevel} Kur Sınavı Tamamlandı (%75 Barajı İçin Tekrar Deneyin)`
                      : `${correctCount} / ${sessionItems.length} Doğru (%${scorePct})`}
                  </h1>
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
                    Aşağıdan tüm sorularınızı, odak gramer kurallarını ve çeldirici analizlerini tek tek inceleyebilirsiniz.
                  </p>
                </div>

                <div className="px-5 py-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#087F5B] text-center shrink-0">
                  <span className="block text-[10px] font-extrabold text-[var(--muted)] uppercase">
                    Başarı Oranı
                  </span>
                  <span className="block text-3xl font-black text-[#065F46] dark:text-emerald-400 tabular-nums">
                    %{scorePct}
                  </span>
                </div>
              </div>
            )}

            {/* Konu Bazlı Güçlü & Geliştirilmesi Gereken Alanlar */}
            {sessionTopicBreakdown.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-2.5">
                <span className="block text-xs font-extrabold text-[var(--foreground)]">
                  📊 Konu Bazlı Performans Özeti (Tek Tıkla Konu Taraması Başlatın)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sessionTopicBreakdown.map((tb) => {
                    const isWeak = tb.pct < 65;
                    return (
                      <div
                        key={tb.ust_konu}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#F7EFE1]/65 dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)]"
                      >
                        <div className="min-w-0">
                          <span className="block text-xs font-extrabold text-[var(--foreground)] truncate">
                            {tb.ust_konu}
                          </span>
                          <span
                            className={`text-[11px] font-bold ${
                              isWeak
                                ? "text-rose-700 dark:text-rose-300"
                                : "text-emerald-700 dark:text-emerald-300"
                            }`}
                          >
                            {tb.correct}/{tb.total} Doğru (%{tb.pct})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => startTopicSession(tb.ust_konu, "10")}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] hover:border-[#087F5B] text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400 shrink-0 cursor-pointer"
                        >
                          Tarama Çöz →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Soruları ve Gerekçeli Çözümleri İncele Butonu */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setShowReviewList((v) => !v);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#6741D9] hover:bg-[#5432B8] text-white border-b-3 border-[#3d2191] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <BookOpen size={16} />
                <span>
                  📖 Sorularımı ve Gerekçeli Çözümlerini{" "}
                  {showReviewList ? "Gizle" : "İncele"} ({sessionItems.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (sessionMode === "cat") startCatSession();
                  else if (sessionMode === "topic" && sessionTopic)
                    startTopicSession(sessionTopic, topicQuizLength);
                  else if (sessionMode === "exam" && sessionExamLevel)
                    startLevelExamSession(sessionExamLevel);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCcw size={14} />
                <span>Yeniden Çöz</span>
              </button>
            </div>
          </section>

          {/* TAM GEREKÇELİ ÇÖZÜM İNCELEME LİSTESİ */}
          {showReviewList && (
            <section className="space-y-4">
              {sessionItems.map((rec, idx) => (
                <div
                  key={`${rec.question.id}_${idx}`}
                  className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#087F5B] text-white text-xs font-extrabold">
                        Soru {idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[11px] font-extrabold text-[var(--foreground)]">
                        {rec.question.seviye} • {rec.question.ust_konu}
                      </span>
                    </div>

                    {rec.skipped ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-xs font-extrabold">
                        🤔 Pas Geçildi
                      </span>
                    ) : rec.isCorrect ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-extrabold inline-flex items-center gap-1">
                        <CheckCircle2 size={13} /> Doğru ({rec.selectedDisplayHarf})
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-900 text-xs font-extrabold inline-flex items-center gap-1">
                        <XCircle size={13} /> Yanlış (Seçilen: {rec.selectedDisplayHarf})
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm font-bold text-[var(--foreground)]">
                    {rec.question.soru_yonergesi_tr}
                  </p>

                  <div
                    dir="rtl"
                    lang="ar"
                    className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 text-right arabic font-arabic text-xl sm:text-2xl font-bold leading-[2.0] text-[var(--foreground)]"
                  >
                    {renderArabicQuestionWithStyledBlank(
                      rec.question.soru_metni_ar,
                      displayArabic(rec.question.soru_metni_ar)
                    )}
                  </div>

                  <DetailedSolutionBox record={rec} />
                </div>
              ))}
            </section>
          )}

          {printModalOpen && (
            <AssessmentPrintModal
              bank={bank}
              initialTopic={sessionTopic}
              initialLevel={sessionExamLevel || catEvaluation.level}
              onClose={() => setPrintModalOpen(false)}
            />
          )}
        </div>
      );
    }

    // AKTİF SORU EKRANI
    if (!currentRecord) return null;
    const q = currentRecord.question;
    const progressPct = Math.round(((currentIndex + 1) / totalCount) * 100);

    return (
      <div className="max-w-3xl mx-auto space-y-3 pb-16">
        {/* Üst Kompakt İlerleme ve Çıkış Çubuğu */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              playClick();
              stopAllAudio();
              setSessionActive(false);
            }}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <ChevronLeft size={15} />
            <span>Çık</span>
          </button>

          <div className="min-w-0 text-center flex-1">
            <span className="block text-xs sm:text-sm font-extrabold text-[var(--foreground)] truncate">
              {sessionTitle}
            </span>
            <span className="block text-[11px] font-bold text-[var(--muted)] tabular-nums">
              Soru {currentIndex + 1} / {totalCount}
              {sessionMode !== "cat" && ` • ${q.seviye}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              playClick();
              cycleHarekeMode();
            }}
            title="Hareke Modunu Değiştir (Tam / İ'rab / Harekesiz)"
            className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border-2 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0 ${
              harekeMode === "full"
                ? "bg-[#087F5B]/15 border-[#087F5B] text-[#065F46] dark:text-emerald-300"
                : harekeMode === "irab-only"
                ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300"
                : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            <Sparkles size={13} />
            <span>
              {harekeMode === "full"
                ? "Tam"
                : harekeMode === "irab-only"
                ? "İ'rab"
                : "Yalın"}
            </span>
          </button>
        </div>

        {/* İlerleme Çubuğu */}
        <div className="w-full h-2 rounded-full bg-[#E6D7BE]/60 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-[#087F5B] rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* SORU KARTI */}
        <div className="rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 sm:p-5 space-y-3.5">
          {/* Dinleme Sorusu İse En Üstte Tek Tıkla Okuma Sorusuna Değiştirme Butonu */}
          {q.isListeningAudioItem && !currentRecord.answered && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700 p-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900 dark:text-amber-200">
                <Headphones size={16} className="shrink-0" />
                <span>🎧 İsteğe Bağlı Sesli Dinleme-Anlama Sorusu</span>
              </div>

              <button
                type="button"
                onClick={handleSwapListeningToReading}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-amber-400 hover:border-amber-600 text-xs font-extrabold text-amber-950 dark:text-amber-200 inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <VolumeX size={14} />
                <span>🔇 Şu an dinleyemiyorum (Okuma sorusuyla değiştir)</span>
              </button>
            </div>
          )}

          {/* Üst Etiket Satırı */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {sessionMode !== "cat" && (
                <span className="px-2 py-0.5 rounded-md bg-[#087F5B] text-white text-[11px] font-extrabold">
                  {q.seviye}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-md bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-[11px] font-extrabold text-[var(--foreground)]">
                {q.isListeningAudioItem ? "🎧 Dinleme & Anlama" : q.ust_konu}
              </span>
            </div>

            {!q.isListeningAudioItem && (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  playQuestionAudio(q);
                }}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-xs font-extrabold text-[#065F46] dark:text-emerald-400 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 size={14} />
                <span>Soruyu Dinle</span>
              </button>
            )}
          </div>

          {/* Türkçe Soru Yönergesi ve Bağlam */}
          <div className="space-y-1">
            <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] leading-snug">
              {q.soru_yonergesi_tr}
            </h2>
            {q.soru_baglam_tr && (
              <p className="text-xs font-semibold text-[#6741D9] dark:text-[#d0bfff] bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border border-[#6741D9]/30 rounded-xl px-3 py-1.5 inline-block">
                💡 Bağlam: {q.soru_baglam_tr}
              </p>
            )}
          </div>

          {/* Arapça Soru Kökü VEYA Dinleme Oynatıcısı */}
          {q.isListeningAudioItem ? (
            <div className="rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#087F5B] p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 text-center sm:text-left">
                <span className="block text-sm font-extrabold text-[var(--foreground)]">
                  🔊 Arapça Ses Kaydını Dinleyin
                </span>
                <span className="block text-xs font-medium text-[var(--muted)]">
                  Kaydı dilediğiniz kadar normal veya yavaş hızda tekrar dinleyebilirsiniz.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    playQuestionAudio(q, 1);
                  }}
                  className="flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-3 border-emerald-900 text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Volume2 size={16} />
                  <span>Tekrar Dinle (1.0x)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    playQuestionAudio(q, 0.75);
                  }}
                  className="min-h-[48px] px-3 py-2.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] cursor-pointer"
                >
                  🐢 0.75x
                </button>
              </div>
            </div>
          ) : (
            <div
              dir="rtl"
              lang="ar"
              className="rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 text-right shadow-2xs"
            >
              <p className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[var(--foreground)] leading-[2.0] break-words">
                {renderArabicQuestionWithStyledBlank(
                  q.soru_metni_ar,
                  displayArabic(q.soru_metni_ar)
                )}
              </p>
            </div>
          )}

          {/* ŞIKLAR: Mobilde tek sütun (grid-cols-1), masaüstünde 2 sütun (md:grid-cols-2), min-h-[48px] */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {currentRecord.preparedOptions.map((opt) => {
              const isArOpt = q.secenek_dili === "ar";
              const isSelected =
                currentRecord.selectedDisplayHarf === opt.displayHarf;
              const isRightOpt = opt.origHarf === q.dogru_secenek;

              let btnStyle =
                "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]";

              if (currentRecord.answered) {
                if (sessionMode === "topic") {
                  if (isRightOpt) {
                    btnStyle =
                      "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/30";
                  } else if (isSelected) {
                    btnStyle =
                      "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-950 dark:text-rose-200";
                  } else {
                    btnStyle =
                      "bg-white/60 dark:bg-[var(--background)]/60 border-[#E6D7BE]/60 text-[var(--muted)] opacity-80";
                  }
                } else if (isSelected) {
                  btnStyle =
                    "bg-[#087F5B]/15 border-[#087F5B] text-[#065F46] dark:text-emerald-200";
                }
              }

              return (
                <button
                  key={opt.displayHarf}
                  type="button"
                  disabled={currentRecord.answered}
                  onClick={() => handleAnswerOrSkip(opt, false)}
                  className={`min-h-[52px] px-3.5 py-2.5 rounded-2xl border-2 border-b-3 transition-all flex items-center justify-between gap-3 cursor-pointer disabled:cursor-default ${btnStyle}`}
                >
                  <span className="w-7 h-7 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-xs font-black text-[var(--foreground)] shrink-0">
                    {opt.displayHarf}
                  </span>

                  <span
                    dir={isArOpt ? "rtl" : "ltr"}
                    lang={isArOpt ? "ar" : "tr"}
                    className={
                      isArOpt
                        ? "arabic font-arabic text-xl sm:text-2xl font-bold leading-[1.85] text-right flex-1"
                        : "text-xs sm:text-sm font-bold leading-snug text-left flex-1"
                    }
                  >
                    {isArOpt ? displayArabic(opt.metin) : opt.metin}
                  </span>

                  {currentRecord.answered &&
                    sessionMode === "topic" &&
                    isRightOpt && (
                      <CheckCircle2
                        size={18}
                        className="text-emerald-600 shrink-0"
                      />
                    )}
                  {currentRecord.answered &&
                    sessionMode === "topic" &&
                    isSelected &&
                    !isRightOpt && (
                      <XCircle size={18} className="text-rose-600 shrink-0" />
                    )}
                </button>
              );
            })}
          </div>

          {/* Alt Aksiyon Satırı: 🤔 Emin Değilim / Pas Geç VEYA Sonraki Soru */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {!currentRecord.answered ? (
              <button
                type="button"
                onClick={() => handleAnswerOrSkip(null, true)}
                className="min-h-[48px] w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] hover:border-amber-500 text-xs sm:text-sm font-extrabold text-[var(--muted)] hover:text-amber-800 dark:hover:text-amber-300 inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <HelpCircle size={16} />
                <span>🤔 Emin Değilim / Pas Geç (Tahmin yürütme)</span>
              </button>
            ) : (
              sessionMode === "topic" && (
                <div className="w-full flex items-center justify-between gap-2">
                  {currentIndex > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        stopAllAudio();
                        setCurrentIndex((i) => Math.max(0, i - 1));
                      }}
                      className="min-h-[48px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft size={15} />
                      <span>Önceki</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <button
                    type="button"
                    onClick={() => advanceToNextOrFinish(sessionItems)}
                    className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-3 border-emerald-900 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <span>
                      {currentIndex + 1 < totalCount
                        ? "Sonraki Soruya Geç"
                        : "Taramayı Bitir & Özeti Gör"}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )
            )}
          </div>

          {/* KTT Modunda Anında Açılan Gerekçeli Çözüm ve Çeldirici Teşhis Kutusu */}
          {sessionMode === "topic" && currentRecord.answered && (
            <DetailedSolutionBox record={currentRecord} />
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // ANA ÖLÇME, SEVİYE TESPİT VE 13 KONU TARAMA MERKEZİ SEÇİM EKRANI
  // ============================================================================
  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-16">
      {/* ÜST BAŞLIK + A4 YAZDIRMA BUTONU */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            onClick={() => playClick()}
            aria-label="Ana Sayfaya Dön"
            className="w-9 h-9 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 flex items-center justify-center text-[var(--foreground)] hover:border-[#087F5B] shrink-0"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight">
                Seviye Tespit, 13 Konu Tarama &amp; Kur Sınav Merkezi
              </h1>
              {mounted && detectedCefrLevel && (
                <span className="px-2.5 py-0.5 rounded-lg bg-[#087F5B] text-white text-xs font-extrabold">
                  Aktif Seviyeniz: {detectedCefrLevel}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-[var(--muted)]">
              {bank.length} doğrulanmış soru • Adaptif CAT Seviye Tespit • Hedefli Çeldirici Teşhisi • A/B Yaprak Test
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playClick();
            setPrintModalOpen(true);
          }}
          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#087F5B] border-b-3 text-xs font-extrabold text-[#065F46] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Printer size={15} />
          <span>🖨️ A4 Yaprak Test Yazdır (A/B + Anahtar)</span>
        </button>
      </div>

      {/* 3 ANA MOD SEKMESİ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {[
          {
            id: "cat" as const,
            title: "🧭 1. Adaptif Seviye Tespit",
            sub: "16+2 Soru • ~3-4 Dk Akıllı CAT",
            icon: Compass,
          },
          {
            id: "topic" as const,
            title: "📚 2. 13 Konu Tarama Testi",
            sub: "Anında Gerekçeli Çözümlü KTT",
            icon: ListChecks,
          },
          {
            id: "exam" as const,
            title: "🎓 3. Kur Bitirme Sınavları",
            sub: "A1 • A2 • B1 • B2 (20 Soru)",
            icon: GraduationCap,
          },
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                playClick();
                setActiveTab(tab.id);
              }}
              className={`p-3.5 rounded-2xl border-2 border-b-4 text-left transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#087F5B] border-[#065F46] text-white"
                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
              }`}
            >
              <span className="block text-sm font-extrabold">{tab.title}</span>
              <span
                className={`block text-[11px] font-semibold mt-0.5 ${
                  isSelected ? "text-emerald-100" : "text-[var(--muted)]"
                }`}
              >
                {tab.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* MOD 1 İÇERİĞİ: ADAPTİF SEVİYE TESPİT */}
      {activeTab === "cat" && (
        <section className="rounded-3xl border-2 border-[#087F5B] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#087F5B]/15 text-[#065F46] dark:text-emerald-300 text-xs font-extrabold">
                <Compass size={14} />
                <span>Bilgisayarlı Adaptif Test (CAT) Motoru</span>
              </span>
              <h2 className="text-lg sm:text-2xl font-black text-[var(--foreground)]">
                3–4 Dakikada Gerçek CEFR Arapça Seviyenizi Belirleyin
              </h2>
              <p className="text-xs sm:text-sm font-medium text-[var(--muted)] leading-relaxed">
                Test orta-başlangıç sınırından başlar; doğru cevaplarınızda zorluk basamağı yükselir, yanlış veya{" "}
                <strong>“Emin Değilim / Pas Geç”</strong> yanıtlarınızda düşer. İçerisinde tek tıkla okuma sorusuyla değiştirilebilen{" "}
                <strong>2 sesli dinleme-anlama sorusu</strong> yer alır.
              </p>
            </div>

            <button
              type="button"
              onClick={() => startCatSession()}
              className="min-h-[52px] px-6 py-3 rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-4 border-emerald-900 text-sm font-black inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-sm"
            >
              <Play size={18} fill="currentColor" />
              <span>Adaptif Seviye Tespiti Başlat</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-1">
              <span className="text-xs font-extrabold text-[#065F46] dark:text-emerald-400 block">
                🎯 Akıllı Zorluk Kalibrasyonu
              </span>
              <p className="text-xs text-[var(--muted)]">
                A1.1&apos;den B2.3&apos;e 12 kademeli zorluk merdiveni ile gereksiz kolay veya aşırı zor sorularla vakit kaybetmezsiniz.
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-1">
              <span className="text-xs font-extrabold text-[#6741D9] dark:text-[#d0bfff] block">
                🎧 Esnek Sesli Dinleme
              </span>
              <p className="text-xs text-[var(--muted)]">
                Müsait olmadığınız ortamlarda tek tıkla dinleme sorusunu ceza almadan okuma sorusuna çevirebilirsiniz.
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-1">
              <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300 block">
                📖 Tam Gerekçeli Karne
              </span>
              <p className="text-xs text-[var(--muted)]">
                Sınav sonunda seviyenizi çalışma planınıza uygulayabilir ve tüm soruların çeldirici analizlerini inceleyebilirsiniz.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* MOD 2 İÇERİĞİ: 13 KONU TARAMA TESTİ (KTT) */}
      {activeTab === "topic" && (
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] p-3.5">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                📚 13 Üst Konu Tarama Testi (Anında Gerekçeli Çözümlü)
              </h2>
              <p className="text-xs font-medium text-[var(--muted)]">
                Her sorudan hemen sonra cümle çevirisi, odak kural ve seçtiğiniz yanlış şıkkın özel teşhisi açılır.
              </p>
            </div>

            <div className="inline-flex items-center rounded-xl bg-white dark:bg-[var(--background)] p-1 border border-[#E6D7BE] dark:border-[var(--border)] shrink-0">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setTopicQuizLength("10");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                  topicQuizLength === "10"
                    ? "bg-[#087F5B] text-white"
                    : "text-[var(--muted)]"
                }`}
              >
                10 Soru (Hızlı)
              </button>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setTopicQuizLength("all");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                  topicQuizLength === "all"
                    ? "bg-[#6741D9] text-white"
                    : "text-[var(--muted)]"
                }`}
              >
                Tüm Sorular
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ASSESSMENT_TOPICS.map((topic) => {
              const qCount =
                topicActualCounts[topic.ust_konu] || topic.questionCount;
              const stat = mounted ? topicMastery[topic.ust_konu] : undefined;
              const masteryPct =
                stat && stat.total > 0
                  ? Math.round((stat.correct / stat.total) * 100)
                  : null;

              return (
                <div
                  key={topic.ust_konu}
                  className="rounded-2xl border-2 border-b-4 border-[#E6D7BE] dark:border-[var(--border)] bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 flex flex-col justify-between gap-3 hover:border-[#087F5B] transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xl">{topic.icon}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[var(--background)] border border-[#E6D7BE] text-[10px] font-extrabold text-[var(--muted)]">
                          {topic.levelRange}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#087F5B]/15 text-[#065F46] dark:text-emerald-300 text-[10px] font-extrabold">
                          {qCount} Soru
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] leading-snug">
                      {topic.ust_konu}
                    </h3>
                    <p className="text-xs text-[var(--muted)] leading-relaxed">
                      {topic.summaryTr}
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    {/* Hakimiyet Barı */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-[var(--muted)]">Konu Hakimiyeti</span>
                        <span className="text-[var(--foreground)] tabular-nums">
                          {masteryPct !== null
                            ? `%${masteryPct} (${stat?.correct}/${stat?.total})`
                            : "Henüz çözülmedi"}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white dark:bg-[var(--background)] overflow-hidden border border-[#E6D7BE]/70">
                        <div
                          className="h-full bg-[#087F5B] rounded-full transition-all"
                          style={{ width: `${masteryPct ?? 0}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        startTopicSession(topic.ust_konu, topicQuizLength)
                      }
                      className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-white dark:bg-[var(--background)] hover:bg-[#087F5B] hover:text-white border-2 border-[#E6D7BE] hover:border-[#087F5B] text-xs font-extrabold text-[#065F46] dark:text-emerald-400 inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Play size={13} fill="currentColor" />
                      <span>
                        {topicQuizLength === "10"
                          ? `${Math.min(10, qCount)} Soruluk Tarama Başlat`
                          : `${qCount} Sorunun Tümünü Çöz`}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* MOD 3 İÇERİĞİ: KUR BİTİRME / SEVİYE ATLAMA SINAVLARI */}
      {activeTab === "exam" && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {(["A1", "A2", "B1", "B2"] as Level[]).map((lvl) => {
            const meta = getLevelMeta(lvl);
            const isCompleted = mounted && completedLevelExams.includes(lvl);
            const lvlCount = bank.filter((q) => q.seviye === lvl).length;

            return (
              <div
                key={lvl}
                className="rounded-3xl border-2 border-b-4 border-[#E6D7BE] dark:border-[var(--border)] bg-[#F7EFE1] dark:bg-[var(--surface)] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-xl border text-xs font-black ${meta.badgeCls}`}
                    >
                      CEFR {lvl} KUR SINAVI
                    </span>
                    {isCompleted ? (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-xs font-extrabold inline-flex items-center gap-1">
                        <Award size={14} /> Tamamlandı
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-[var(--muted)]">
                        Baraj: %75 (15/20)
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)]">
                    {meta.title}
                  </h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    {meta.subtitle}. Havuzdaki {lvlCount} sorudan dengeli 20 soru seçilir; sınav sonunda tam gerekçeli karne açılır.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => startLevelExamSession(lvl)}
                  className="min-h-[48px] w-full py-2.5 px-4 rounded-xl bg-[#6741D9] hover:bg-[#5432B8] text-white border-b-3 border-[#3d2191] text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <GraduationCap size={16} />
                  <span>{lvl} Kur Bitirme Sınavını Başlat (20 Soru)</span>
                </button>
              </div>
            );
          })}
        </section>
      )}

      {printModalOpen && (
        <AssessmentPrintModal
          bank={bank}
          onClose={() => setPrintModalOpen(false)}
        />
      )}
    </div>
  );
}

export default function SeviyeTespitPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto py-6">
          <div className="h-44 rounded-3xl border-2 border-[#E6D7BE] bg-[#F7EFE1] dark:bg-[var(--surface)] animate-pulse" />
        </div>
      }
    >
      <SeviyeTespitContent />
    </Suspense>
  );
}
