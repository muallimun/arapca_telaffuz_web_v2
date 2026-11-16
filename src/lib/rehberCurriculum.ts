import seviyetespitJson from "@/data/seviye_tespit_sorulari.json";
import { CONTENT_INVENTORY } from "@/lib/contentInventory";
import {
  getDialoguesSortedPedagogically,
  getReadingTextsSortedPedagogically,
  getDialogueGrammarNote,
} from "@/lib/data";
import {
  ASSESSMENT_TOPICS,
  buildDynamicAssessmentTopics,
  type AssessmentQuestion,
  type DynamicAssessmentTopicMeta,
} from "@/types/assessment";
import type { Level } from "@/types/data";

export type RehberRole = "learner" | "teacher";
export type RehberTabId = "map" | "methodology" | "schedule" | "curriculum";

export const REHBER_ROLE_STORAGE_KEY = "muallimun_rehber_role_v1";

export interface CurriculumLessonChip {
  id: string;
  codeLabel: string;
  baslikTr: string;
  baslikAr: string;
  seviye: Level;
  grammarTopicTr?: string;
  href: string;
  kind: "dialogue" | "reading";
}

export interface CurriculumKttTopicLink {
  ustKonu: string;
  icon: string;
  questionCount: number;
  href: string;
}

export interface CurriculumMilestoneExam {
  level: Level;
  labelTr: string;
  href: string;
}

export interface CurriculumWeekPlan {
  weekNumber: number; // 1..24
  level: Level;
  levelWeekIndex: number; // 1..6 within CEFR level
  phaseTitleTr: string;
  focusSummaryTr: string;
  dialogues: CurriculumLessonChip[];
  readings: CurriculumLessonChip[];
  visualWordsQuota: number;
  sentencesQuota: number;
  proverbsQuota: number;
  synonymsQuota: number;
  videosQuota: number;
  kttTopics: CurriculumKttTopicLink[];
  milestoneExam: CurriculumMilestoneExam | null;
}

export interface CurriculumWeekProgress {
  weekNumber: number;
  level: Level;
  completedDialogueIds: string[];
  completedReadingIds: string[];
  completedDialoguesCount: number;
  totalDialoguesCount: number;
  completedReadingsCount: number;
  totalReadingsCount: number;
  completedUnits: number;
  totalUnits: number;
  percent: number;
  isWeekCompleted: boolean;
}

export interface CurriculumLevelSummary {
  level: Level;
  weeksRangeLabel: string;
  completedDialoguesCount: number;
  totalDialoguesCount: number;
  completedReadingsCount: number;
  totalReadingsCount: number;
  completedUnits: number;
  totalUnits: number;
  completedWeeksCount: number;
  totalWeeksCount: number;
  percent: number;
  examCompleted: boolean;
}

export interface CurriculumProgressSummary {
  byWeek: Record<number, CurriculumWeekProgress>;
  byLevel: Record<Level, CurriculumLevelSummary>;
  completedDialoguesTotal: number;
  totalDialoguesTotal: number;
  completedReadingsTotal: number;
  totalReadingsTotal: number;
  completedUnitsTotal: number;
  totalUnitsTotal: number;
  completedWeeksTotal: number;
  totalWeeksTotal: number;
  overallPercent: number;
}

const CANONICAL_LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

const READING_SLICES_BY_LEVEL: Record<Level, number[]> = {
  A1: [3, 3, 3, 3, 4, 4], // 20 okuma metni
  A2: [3, 3, 3, 3, 4, 4], // 20 okuma metni
  B1: [2, 2, 2, 2, 1, 1], // 10 okuma metni
  B2: [2, 2, 2, 2, 1, 1], // 10 okuma metni
};

const LEVEL_PHASE_TITLES: Record<Level, string[]> = {
  A1: [
    "Tanışma, Zamirler ve İlk İletişim",
    "İşaret İsimleri, Belirlilik ve Mekânlar",
    "İsim Cümlesi, Var-Yok Kalıpları ve Aile",
    "İsim/Sıfat Tamlaması ve Çarşı-Pazar",
    "Temel Fiiller (Mâzî-Muzâri-Emir) ve Rutinler",
    "Sayılar, Saatler ve A1 Kur Kapanışı",
  ],
  A2: [
    "İkil (Tesniye) Yapılar ve İkili İletişim",
    "Çoğul Türleri ve Akılsız Çoğul Uyumu",
    "Fiil Cümlesi ve Bitişik Nesne Zamirleri",
    "Zaman Ekleri, Olumsuzluk ve Seyahat",
    "Kâne ve İnne Grubu (Nevâsih) ile Anlatım",
    "Mastar, İsm-i Tafdîl ve A2 Kur Kapanışı",
  ],
  B1: [
    "Mezîd Fiil Bâbları (II–IV) ve Sosyal Hayat",
    "Mezîd Fiil Bâbları (V–X) ve İş Dünyası",
    "İsm-i Mevsûl ve Sıla Cümleleriyle Bağlama",
    "Mef'ûl Türleri (Mutlak, Leh, Fîh) ve Sebep-Amaç",
    "Hâl Cümlesi, Temyîz ve Sayı Sistematiği",
    "İleri Bağlaçlar, Medya Dili ve B1 Kur Kapanışı",
  ],
  B2: [
    "Meçhul Fiil, Nâib-i Fâil ve Akademik Üslup",
    "Cezimli/Cezimsiz Şart Edatları ve Müzakere",
    "İstisnâ Üslubu (İllâ / Gayr / Sivâ) ve Tartışma",
    "İlletli Fiillerin İleri Çekimi ve Edebî Metinler",
    "Taaccüb, Medih-Zem, İhtisas ve Belâgat Dokusu",
    "Harekesiz Okuma Hakimiyeti ve B2 Mezuniyet",
  ],
};

let cachedDynamicTopics: DynamicAssessmentTopicMeta[] | null = null;
let cachedCurriculumWeeks: CurriculumWeekPlan[] | null = null;

export function getDynamicKttTopics(): DynamicAssessmentTopicMeta[] {
  if (cachedDynamicTopics) return cachedDynamicTopics;
  const bank = (seviyetespitJson as AssessmentQuestion[]) || [];
  cachedDynamicTopics = buildDynamicAssessmentTopics(bank);
  return cachedDynamicTopics;
}

export function getDynamicKttTopicCount(): number {
  const topics = getDynamicKttTopics();
  return topics.length > 0 ? topics.length : ASSESSMENT_TOPICS.length;
}

function distributeQuota(total: number, slots: number): number[] {
  const base = Math.floor(total / slots);
  const rem = total % slots;
  return Array.from({ length: slots }, (_, idx) =>
    idx < rem ? base + 1 : base
  );
}

/**
 * 120 Diyalog (her hafta 5 diyalog = 24x5) ve 60 Okuma Metnini (A1:20, A2:20, B1:10, B2:10)
 * 24 haftalık (A1 -> B2, her kur 6 hafta) pedagojik müfredata sıfır kayıpla dağıtır.
 */
export function build24WeekCurriculum(): CurriculumWeekPlan[] {
  if (cachedCurriculumWeeks) return cachedCurriculumWeeks;

  const sortedDialogues = getDialoguesSortedPedagogically();
  const sortedReadings = getReadingTextsSortedPedagogically();
  const dynamicTopics = getDynamicKttTopics();

  const visualQuotas = distributeQuota(CONTENT_INVENTORY.visualWordsCount, 24);
  const sentenceQuotas = distributeQuota(CONTENT_INVENTORY.sentencesCount, 24);
  const proverbQuotas = distributeQuota(CONTENT_INVENTORY.proverbsCount, 24);
  const synonymQuotas = distributeQuota(
    CONTENT_INVENTORY.synonymsAntonymsCount,
    24
  );
  const videoQuotas = distributeQuota(CONTENT_INVENTORY.youtubeVideosCount, 24);

  const weeks: CurriculumWeekPlan[] = [];

  for (let levelIdx = 0; levelIdx < CANONICAL_LEVELS.length; levelIdx++) {
    const level = CANONICAL_LEVELS[levelIdx];
    const levelDialogues = sortedDialogues.filter((d) => d.seviye === level);
    const levelReadings = sortedReadings.filter((m) => m.seviye === level);
    const levelTopics = dynamicTopics.filter((t) => t.primaryLevel === level);
    const readingSlices = READING_SLICES_BY_LEVEL[level];

    let readingCursor = 0;
    const topicBucketSizes = distributeQuota(levelTopics.length, 6);
    let topicCursor = 0;

    for (let weekInLevel = 0; weekInLevel < 6; weekInLevel++) {
      const globalWeekIdx = levelIdx * 6 + weekInLevel;
      const weekNumber = globalWeekIdx + 1;

      const weekDialoguesRaw = levelDialogues.slice(
        weekInLevel * 5,
        (weekInLevel + 1) * 5
      );
      const readingCountForWeek = readingSlices[weekInLevel] ?? 2;
      const weekReadingsRaw = levelReadings.slice(
        readingCursor,
        readingCursor + readingCountForWeek
      );
      readingCursor += readingCountForWeek;

      const topicTake = topicBucketSizes[weekInLevel] ?? 1;
      const weekTopicsRaw = levelTopics.slice(
        topicCursor,
        topicCursor + topicTake
      );
      topicCursor += topicTake;

      const dialogueChips: CurriculumLessonChip[] = weekDialoguesRaw.map(
        (d, idx) => {
          const gNote = getDialogueGrammarNote(d.id);
          const num = parseInt(d.id.replace(/\D+/g, ""), 10) || idx + 1;
          return {
            id: d.id,
            codeLabel: `Diyalog ${num}`,
            baslikTr: d.baslik_tr,
            baslikAr: d.baslik_ar,
            seviye: d.seviye,
            grammarTopicTr: gNote?.konu_basligi,
            href: `/diyalog/${d.id}`,
            kind: "dialogue",
          };
        }
      );

      const readingChips: CurriculumLessonChip[] = weekReadingsRaw.map(
        (m, idx) => {
          const num = parseInt(m.id.replace(/\D+/g, ""), 10) || idx + 1;
          return {
            id: m.id,
            codeLabel: `Metin ${num}`,
            baslikTr: m.baslik_tr,
            baslikAr: m.baslik_ar,
            seviye: m.seviye,
            grammarTopicTr: m.odak_gramer,
            href: `/metin/${m.id}`,
            kind: "reading",
          };
        }
      );

      const kttTopics: CurriculumKttTopicLink[] = weekTopicsRaw.map((t) => ({
        ustKonu: t.ust_konu,
        icon: t.icon,
        questionCount: t.questionCount,
        href: `/seviye-tespit?mode=topic&topic=${encodeURIComponent(t.ust_konu)}`,
      }));

      const grammarHighlights = dialogueChips
        .map((d) => d.grammarTopicTr)
        .filter((x): x is string => Boolean(x))
        .slice(0, 2);

      const focusSummaryTr =
        grammarHighlights.length > 0
          ? grammarHighlights.join(" • ")
          : `${level} Kuru ${weekInLevel + 1}. Hafta İletişim ve Okuma Pekiştirmesi`;

      const isMilestoneWeek = weekInLevel === 5;
      const milestoneExam: CurriculumMilestoneExam | null = isMilestoneWeek
        ? {
            level,
            labelTr: `${level} Kur Bitirme Sınavı (%75+ Geçme Barajı)`,
            href: `/seviye-tespit?mode=exam&level=${level}`,
          }
        : null;

      weeks.push({
        weekNumber,
        level,
        levelWeekIndex: weekInLevel + 1,
        phaseTitleTr:
          LEVEL_PHASE_TITLES[level][weekInLevel] ||
          `${level} Kuru ${weekInLevel + 1}. Hafta`,
        focusSummaryTr,
        dialogues: dialogueChips,
        readings: readingChips,
        visualWordsQuota: visualQuotas[globalWeekIdx] ?? 41,
        sentencesQuota: sentenceQuotas[globalWeekIdx] ?? 46,
        proverbsQuota: proverbQuotas[globalWeekIdx] ?? 21,
        synonymsQuota: synonymQuotas[globalWeekIdx] ?? 16,
        videosQuota: videoQuotas[globalWeekIdx] ?? 2,
        kttTopics,
        milestoneExam,
      });
    }
  }

  cachedCurriculumWeeks = weeks;
  return weeks;
}

/**
 * Kullanıcının tamamladığı diyalog (`completedDialogues`) ve okuma metni (`completedReadings` / `metin_*`)
 * kayıtlarını 24 haftalık kur çizelgesiyle canlı eşleştirir.
 */
export function computeCurriculumProgress(
  weeks: CurriculumWeekPlan[],
  completedDialogues: string[] = [],
  completedReadings: string[] = [],
  completedLevelExams: Level[] = []
): CurriculumProgressSummary {
  const completedSet = new Set<string>();
  for (const id of completedDialogues || []) {
    if (typeof id === "string" && id.trim()) completedSet.add(id.trim());
  }
  for (const id of completedReadings || []) {
    if (typeof id === "string" && id.trim()) completedSet.add(id.trim());
  }

  const completedExamsSet = new Set<Level>(completedLevelExams || []);

  const byWeek: Record<number, CurriculumWeekProgress> = {};
  const byLevel = {} as Record<Level, CurriculumLevelSummary>;

  for (const lvl of CANONICAL_LEVELS) {
    const startW = CANONICAL_LEVELS.indexOf(lvl) * 6 + 1;
    byLevel[lvl] = {
      level: lvl,
      weeksRangeLabel: `${startW}–${startW + 5}. Hafta`,
      completedDialoguesCount: 0,
      totalDialoguesCount: 0,
      completedReadingsCount: 0,
      totalReadingsCount: 0,
      completedUnits: 0,
      totalUnits: 0,
      completedWeeksCount: 0,
      totalWeeksCount: 6,
      percent: 0,
      examCompleted: completedExamsSet.has(lvl),
    };
  }

  let completedDialoguesTotal = 0;
  let totalDialoguesTotal = 0;
  let completedReadingsTotal = 0;
  let totalReadingsTotal = 0;
  let completedWeeksTotal = 0;

  for (const week of weeks) {
    const completedDialogueIds = week.dialogues
      .filter((d) => completedSet.has(d.id))
      .map((d) => d.id);
    const completedReadingIds = week.readings
      .filter((r) => completedSet.has(r.id))
      .map((r) => r.id);

    const completedDialoguesCount = completedDialogueIds.length;
    const totalDialoguesCount = week.dialogues.length;
    const completedReadingsCount = completedReadingIds.length;
    const totalReadingsCount = week.readings.length;

    const completedUnits = completedDialoguesCount + completedReadingsCount;
    const totalUnits = totalDialoguesCount + totalReadingsCount;
    const percent =
      totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
    const isWeekCompleted = totalUnits > 0 && completedUnits === totalUnits;

    byWeek[week.weekNumber] = {
      weekNumber: week.weekNumber,
      level: week.level,
      completedDialogueIds,
      completedReadingIds,
      completedDialoguesCount,
      totalDialoguesCount,
      completedReadingsCount,
      totalReadingsCount,
      completedUnits,
      totalUnits,
      percent,
      isWeekCompleted,
    };

    const lvlBucket = byLevel[week.level];
    lvlBucket.completedDialoguesCount += completedDialoguesCount;
    lvlBucket.totalDialoguesCount += totalDialoguesCount;
    lvlBucket.completedReadingsCount += completedReadingsCount;
    lvlBucket.totalReadingsCount += totalReadingsCount;
    lvlBucket.completedUnits += completedUnits;
    lvlBucket.totalUnits += totalUnits;
    if (isWeekCompleted) {
      lvlBucket.completedWeeksCount += 1;
      completedWeeksTotal += 1;
    }

    completedDialoguesTotal += completedDialoguesCount;
    totalDialoguesTotal += totalDialoguesCount;
    completedReadingsTotal += completedReadingsCount;
    totalReadingsTotal += totalReadingsCount;
  }

  for (const lvl of CANONICAL_LEVELS) {
    const bucket = byLevel[lvl];
    bucket.percent =
      bucket.totalUnits > 0
        ? Math.round((bucket.completedUnits / bucket.totalUnits) * 100)
        : 0;
  }

  const completedUnitsTotal = completedDialoguesTotal + completedReadingsTotal;
  const totalUnitsTotal = totalDialoguesTotal + totalReadingsTotal;
  const overallPercent =
    totalUnitsTotal > 0
      ? Math.round((completedUnitsTotal / totalUnitsTotal) * 100)
      : 0;

  return {
    byWeek,
    byLevel,
    completedDialoguesTotal,
    totalDialoguesTotal,
    completedReadingsTotal,
    totalReadingsTotal,
    completedUnitsTotal,
    totalUnitsTotal,
    completedWeeksTotal,
    totalWeeksTotal: weeks.length,
    overallPercent,
  };
}
