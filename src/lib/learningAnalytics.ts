import {
  diyaloglar,
  metinler,
  gorselKelimeler,
  cumleler1111,
  atasozleri,
  esZitAnlamlilar,
  sozluk,
  tumGramerHapBilgiler,
} from "@/lib/data";
import { DictionaryItem, Level } from "@/types/data";
import {
  Arabic28Letter,
  ARABIC_28_LETTERS,
  PhonemeStatRecord,
  PronunciationHistoryItem,
  SkillKey,
  SkillStatRecord,
  SrsItemRecord,
  TopicMasteryRecord,
} from "@/store/userStore";
import {
  normalizeToCanonicalMistakeId,
  findGrammarNoteByMistakeId,
  grammarNoteToDictionaryItem,
  synonymEntryToDictionaryItem,
} from "@/lib/mistakeUtils";
import { getCombinedIdiomsCatalog, extractDialoguesIdioms } from "@/lib/arabicIdioms";
import { cleanArabicText } from "@/lib/dict";

export interface LearnerRankInfo {
  level: 1 | 2 | 3 | 4;
  title:
    | "Bronz Talebe (Seviye 1)"
    | "Gümüş Hatip (Seviye 2)"
    | "Altın Edip (Seviye 3)"
    | "Fasih Üstad (Seviye 4)";
  shortTitle: string;
  arabicBadge: string;
  minXp: number;
  nextXp: number | null;
  nextTitle: string | null;
  progressPercent: number;
}

export interface MilestoneBadgeItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unitLabel: string;
  progressPercent: number;
  unlocked: boolean;
  statusTag: "[☑️ KAZANILDI]" | "[🔒 KİLİTLİ]";
  actionHref: string;
  actionLabel: string;
}

export interface CefrProgressRow {
  level: Level;
  titleTr: string;
  completedItems: number;
  totalItems: number;
  percent: number;
  dialoguesDone: number;
  dialoguesTotal: number;
  readingsDone: number;
  readingsTotal: number;
  examPassed: boolean;
}

export interface ModuleProgressRow {
  id:
    | "diyaloglar"
    | "metinler"
    | "gorsel_kelime"
    | "cumleler"
    | "atasozleri"
    | "es_zit";
  title: string;
  arabicLabel: string;
  completed: number;
  total: number;
  percent: number;
  href: string;
}

export interface LastExerciseResultInfo {
  hasData: boolean;
  moduleName: string;
  solved: number;
  correct: number;
  wrong: number;
  accuracyPercent: number | null;
}

export interface FrequentMistakeRow {
  uid: string;
  kind: "word" | "sentence" | "phoneme";
  kindLabel: string;
  arabicText: string;
  turkishText: string;
  detailNote?: string;
  wrongCount: number;
  correctCount: number;
  accuracyPercent: number | null;
  // Ses çalma verileri
  dialogueId?: string;
  lineSira?: number;
  sesErkek?: string;
  sesKadin?: string;
  audioItemId?: string;
  audioCategory?: "kelime" | "cumle" | "atasozu";
  // Hemen tekrar aksiyonu
  practiceHref?: string;
  shadowingSampleAr?: string;
  phonemeLetter?: Arabic28Letter;
}

export interface LearningAnalyticsSnapshot {
  totalXp: number;
  rank: LearnerRankInfo;
  activeStreakDays: number;
  todayStudyMinutes: number;
  dailyGoalMinutes: number;
  lastExercise: LastExerciseResultInfo;
  badges: MilestoneBadgeItem[];
  unlockedBadgesCount: number;
  cefrProgress: CefrProgressRow[];
  moduleProgress: ModuleProgressRow[];
  frequentMistakes: FrequentMistakeRow[];
}

export interface LearningAnalyticsInput {
  completedDialogues: string[];
  learnedWords: string[];
  favoriteWords: DictionaryItem[];
  weakWords: DictionaryItem[];
  mistakeIds: string[];
  srsRecords: Record<string, SrsItemRecord>;
  pronunciationScores: number[];
  pronunciationHistory: PronunciationHistoryItem[];
  totalPronunciationAttempts: number;
  studyMinutes: number;
  activityXp: number;
  streakDays: number;
  lastStudyDate: string;
  todayStr: string;
  yesterdayStr: string;
  dailyGoalMinutes: number;
  topicMastery: Record<string, TopicMasteryRecord>;
  skillStats: Record<SkillKey, SkillStatRecord>;
  completedLevelExams: Level[];
  phonemeStats: Record<string, PhonemeStatRecord>;
  watchedVideos: string[];
  storedLastExercise?: Partial<LastExerciseResultInfo> | null;
}

export const LAST_EXERCISE_STORAGE_KEY = "muallimun_last_exercise_summary_v1";

export function saveLastExerciseSummary(summary: {
  moduleName: string;
  solved: number;
  correct: number;
  wrong: number;
}): void {
  if (typeof window === "undefined") return;
  try {
    const solved = Math.max(0, Math.floor(summary.solved || 0));
    const correct = Math.max(0, Math.min(solved, Math.floor(summary.correct || 0)));
    const wrong = Math.max(0, Math.floor(summary.wrong ?? Math.max(0, solved - correct)));
    const accuracyPercent =
      solved > 0 ? Math.round((correct / solved) * 100) : null;
    localStorage.setItem(
      LAST_EXERCISE_STORAGE_KEY,
      JSON.stringify({
        hasData: solved > 0,
        moduleName: (summary.moduleName || "Alıştırma").slice(0, 80),
        solved,
        correct,
        wrong,
        accuracyPercent,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Depolama kotası aşımında sessiz geç
  }
}

export function readStoredLastExerciseSummary(): Partial<LastExerciseResultInfo> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_EXERCISE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const solved = Number(parsed.solved);
    const correct = Number(parsed.correct);
    const wrong = Number(parsed.wrong);
    if (!Number.isFinite(solved) || solved <= 0) return null;
    const safeSolved = Math.max(1, Math.floor(solved));
    const safeCorrect = Number.isFinite(correct)
      ? Math.max(0, Math.min(safeSolved, Math.floor(correct)))
      : 0;
    const safeWrong = Number.isFinite(wrong)
      ? Math.max(0, Math.floor(wrong))
      : Math.max(0, safeSolved - safeCorrect);
    return {
      hasData: true,
      moduleName:
        typeof parsed.moduleName === "string" && parsed.moduleName.trim()
          ? parsed.moduleName.trim()
          : "Son Alıştırma",
      solved: safeSolved,
      correct: safeCorrect,
      wrong: safeWrong,
      accuracyPercent: Math.round((safeCorrect / safeSolved) * 100),
    };
  } catch {
    return null;
  }
}

const PHONEME_SHORT_NAMES: Record<Arabic28Letter, { nameTr: string; sampleWordAr: string; sampleWordTr: string }> = {
  ا: { nameTr: "Elif / Hemze", sampleWordAr: "أُسْرَةٌ", sampleWordTr: "Aile" },
  ب: { nameTr: "Bâ", sampleWordAr: "بَيْتٌ", sampleWordTr: "Ev" },
  ت: { nameTr: "Tâ (İnce)", sampleWordAr: "تُفَّاحٌ", sampleWordTr: "Elma" },
  ث: { nameTr: "Sâ (Peltek-İnce)", sampleWordAr: "ثَلَاثَةٌ", sampleWordTr: "Üç" },
  ج: { nameTr: "Cîm", sampleWordAr: "جَمِيلٌ", sampleWordTr: "Güzel" },
  ح: { nameTr: "Hâ (Boğaz Ortası)", sampleWordAr: "حَدِيقَةٌ", sampleWordTr: "Bahçe" },
  خ: { nameTr: "Hı (Boğaz Üstü)", sampleWordAr: "خُبْزٌ", sampleWordTr: "Ekmek" },
  د: { nameTr: "Dâl (İnce)", sampleWordAr: "دَرْسٌ", sampleWordTr: "Ders" },
  ذ: { nameTr: "Zâl (Peltek-İnce)", sampleWordAr: "ذَهَبٌ", sampleWordTr: "Altın" },
  ر: { nameTr: "Râ", sampleWordAr: "رِسَالَةٌ", sampleWordTr: "Mektup" },
  ز: { nameTr: "Zây (Keskin)", sampleWordAr: "زَهْرَةٌ", sampleWordTr: "Çiçek" },
  س: { nameTr: "Sîn (Keskin)", sampleWordAr: "سَلَامٌ", sampleWordTr: "Selam" },
  ش: { nameTr: "Şîn", sampleWordAr: "شَمْسٌ", sampleWordTr: "Güneş" },
  ص: { nameTr: "Sâd (Kalın)", sampleWordAr: "صَبَاحٌ", sampleWordTr: "Sabah" },
  ض: { nameTr: "Dâd (Kalın)", sampleWordAr: "ضَيْفٌ", sampleWordTr: "Misafir" },
  ط: { nameTr: "Tâ (Kalın)", sampleWordAr: "طَالِبٌ", sampleWordTr: "Öğrenci" },
  ظ: { nameTr: "Zâ (Peltek-Kalın)", sampleWordAr: "ظُهْرٌ", sampleWordTr: "Öğle" },
  ع: { nameTr: "Ayn (Boğaz Ortası)", sampleWordAr: "عِلْمٌ", sampleWordTr: "İlim" },
  غ: { nameTr: "Ğayn (Boğaz Üstü)", sampleWordAr: "غُرْفَةٌ", sampleWordTr: "Oda" },
  ف: { nameTr: "Fâ", sampleWordAr: "فَجْرٌ", sampleWordTr: "Şafak" },
  ق: { nameTr: "Kâf (Dil Kökü-Kalın)", sampleWordAr: "قَلَمٌ", sampleWordTr: "Kalem" },
  ك: { nameTr: "Kêf (İnce)", sampleWordAr: "كِتَابٌ", sampleWordTr: "Kitap" },
  ل: { nameTr: "Lâm", sampleWordAr: "لُغَةٌ", sampleWordTr: "Dil" },
  م: { nameTr: "Mîm", sampleWordAr: "مَدْرَسَةٌ", sampleWordTr: "Okul" },
  ن: { nameTr: "Nûn", sampleWordAr: "نُورٌ", sampleWordTr: "Işık / Nur" },
  ه: { nameTr: "Hê (Göğüs Nefesi)", sampleWordAr: "هَدِيَّةٌ", sampleWordTr: "Hediye" },
  و: { nameTr: "Vâv", sampleWordAr: "وَرْدَةٌ", sampleWordTr: "Gül" },
  ي: { nameTr: "Yâ", sampleWordAr: "يَوْمٌ", sampleWordTr: "Gün" },
};

export function computeLearnerRank(
  totalXp: number,
  completedMilestoneCount = 0
): LearnerRankInfo {
  const safeXp = Math.max(0, Math.floor(totalXp || 0));
  const compositeScore = safeXp + completedMilestoneCount * 25;

  if (compositeScore >= 2000 || safeXp >= 2000) {
    return {
      level: 4,
      title: "Fasih Üstad (Seviye 4)",
      shortTitle: "Fasih Üstad",
      arabicBadge: "الأُسْتَاذُ الْفَصِيح",
      minXp: 2000,
      nextXp: null,
      nextTitle: null,
      progressPercent: 100,
    };
  }
  if (compositeScore >= 900 || safeXp >= 900) {
    const pct = Math.min(
      100,
      Math.max(0, Math.round(((Math.max(safeXp, compositeScore) - 900) / (2000 - 900)) * 100))
    );
    return {
      level: 3,
      title: "Altın Edip (Seviye 3)",
      shortTitle: "Altın Edip",
      arabicBadge: "الأَدِيبُ الذَّهَبِيّ",
      minXp: 900,
      nextXp: 2000,
      nextTitle: "Fasih Üstad (Seviye 4)",
      progressPercent: pct,
    };
  }
  if (compositeScore >= 300 || safeXp >= 300) {
    const pct = Math.min(
      100,
      Math.max(0, Math.round(((Math.max(safeXp, compositeScore) - 300) / (900 - 300)) * 100))
    );
    return {
      level: 2,
      title: "Gümüş Hatip (Seviye 2)",
      shortTitle: "Gümüş Hatip",
      arabicBadge: "الْخَطِيبُ الْفِضِّيّ",
      minXp: 300,
      nextXp: 900,
      nextTitle: "Altın Edip (Seviye 3)",
      progressPercent: pct,
    };
  }

  const pct = Math.min(
    100,
    Math.max(0, Math.round((Math.max(safeXp, compositeScore) / 300) * 100))
  );
  return {
    level: 1,
    title: "Bronz Talebe (Seviye 1)",
    shortTitle: "Bronz Talebe",
    arabicBadge: "الطَّالِبُ الْمُبْتَدِئ",
    minXp: 0,
    nextXp: 300,
    nextTitle: "Gümüş Hatip (Seviye 2)",
    progressPercent: pct,
  };
}

export function computeLearningAnalyticsSnapshot(
  input: LearningAnalyticsInput
): LearningAnalyticsSnapshot {
  const srsValues = Object.values(input.srsRecords || {});
  const isToday = input.lastStudyDate === input.todayStr;
  const isYesterday = input.lastStudyDate === input.yesterdayStr;

  const todayStudyMinutes = isToday ? Math.max(0, input.studyMinutes || 0) : 0;
  const activeStreakDays =
    isToday || isYesterday ? Math.max(0, input.streakDays || 0) : 0;
  const dailyGoalMinutes = Math.max(5, input.dailyGoalMinutes || 15);

  // Diyalog & Okuma metni kümeleri
  const dialogueById = new Map(diyaloglar.map((d) => [d.id, d]));
  const readingById = new Map(metinler.map((m) => [m.id, m]));
  const completedSet = new Set(input.completedDialogues || []);

  let completedDialoguesCount = 0;
  let completedDialogueLinesCount = 0;
  let completedReadingsCount = 0;
  let completedReadingLinesCount = 0;

  for (const cid of completedSet) {
    const dlg = dialogueById.get(cid);
    if (dlg) {
      completedDialoguesCount += 1;
      completedDialogueLinesCount += dlg.satirlar.length;
      continue;
    }
    const rdg = readingById.get(cid);
    if (rdg) {
      completedReadingsCount += 1;
      completedReadingLinesCount += rdg.satirlar.length;
    }
  }

  // Öğrenilen & Doğru cevaplanan kelime havuzu
  const uniquePositiveWordIds = new Set<string>();
  for (const lw of input.learnedWords || []) {
    if (lw && !lw.startsWith("sent_") && !lw.startsWith("idiom_") && !lw.startsWith("idm_")) {
      uniquePositiveWordIds.add(lw);
    }
  }
  for (const rec of srsValues) {
    if (rec.type === "word" && (rec.correctCount > 0 || rec.status === "mastered")) {
      uniquePositiveWordIds.add(rec.id);
    }
  }

  // Toplam XP hesabı: activityXp + doğrulanmış aktivite katkıları (hangisi büyükse)
  const totalSkillCorrect = Object.values(input.skillStats || {}).reduce(
    (sum, st) => sum + (st?.correct || 0),
    0
  );
  const totalPronCount = Math.max(
    input.totalPronunciationAttempts || 0,
    (input.pronunciationScores || []).length,
    (input.pronunciationHistory || []).length,
    input.skillStats?.telaffuz?.total || 0
  );
  const watchedCount = (input.watchedVideos || []).length;

  const derivedFloorXp =
    completedDialoguesCount * 50 +
    completedReadingsCount * 50 +
    uniquePositiveWordIds.size * 10 +
    totalPronCount * 5 +
    watchedCount * 20 +
    totalSkillCorrect * 3 +
    (input.completedLevelExams || []).length * 150;

  const totalXp = Math.max(input.activityXp || 0, derivedFloorXp);

  // Rütbe hesaplama
  const rank = computeLearnerRank(
    totalXp,
    completedDialoguesCount + completedReadingsCount
  );

  // Son Alıştırma Sonucu Bandı
  let lastExercise: LastExerciseResultInfo = {
    hasData: false,
    moduleName: "Alıştırma Merkezi",
    solved: 0,
    correct: 0,
    wrong: 0,
    accuracyPercent: null,
  };

  if (
    input.storedLastExercise &&
    typeof input.storedLastExercise.solved === "number" &&
    input.storedLastExercise.solved > 0
  ) {
    const solved = Math.max(1, Math.floor(input.storedLastExercise.solved));
    const correct = Math.max(
      0,
      Math.min(solved, Math.floor(input.storedLastExercise.correct || 0))
    );
    const wrong = Math.max(
      0,
      Math.floor(input.storedLastExercise.wrong ?? solved - correct)
    );
    lastExercise = {
      hasData: true,
      moduleName: input.storedLastExercise.moduleName || "Son Alıştırma",
      solved,
      correct,
      wrong,
      accuracyPercent: Math.round((correct / solved) * 100),
    };
  } else {
    // Gerçek skillStats veya srsRecords verisinden kümülatif son durum
    const skillTotals = Object.values(input.skillStats || {}).reduce(
      (acc, st) => ({
        solved: acc.solved + (st?.total || 0),
        correct: acc.correct + (st?.correct || 0),
      }),
      { solved: 0, correct: 0 }
    );
    if (skillTotals.solved > 0) {
      const wrong = Math.max(0, skillTotals.solved - skillTotals.correct);
      lastExercise = {
        hasData: true,
        moduleName: "Genel Alıştırma & Sınav Performansı",
        solved: skillTotals.solved,
        correct: skillTotals.correct,
        wrong,
        accuracyPercent: Math.round((skillTotals.correct / skillTotals.solved) * 100),
      };
    } else if (srsValues.length > 0) {
      const srsAgg = srsValues.reduce(
        (acc, r) => ({
          correct: acc.correct + (r.correctCount || 0),
          wrong: acc.wrong + (r.wrongCount || 0),
        }),
        { correct: 0, wrong: 0 }
      );
      const solved = srsAgg.correct + srsAgg.wrong;
      if (solved > 0) {
        lastExercise = {
          hasData: true,
          moduleName: "Kelime & SRS Tekrar Oturumu",
          solved,
          correct: srsAgg.correct,
          wrong: srsAgg.wrong,
          accuracyPercent: Math.round((srsAgg.correct / solved) * 100),
        };
      }
    }
  }

  // 8 Kilometre Taşı Rozeti (100% gerçek userStore verisi)
  const wordHunterCount = Math.max(
    uniquePositiveWordIds.size,
    input.skillStats?.kelime?.correct || 0
  );

  const srsDialogueSentencesPracticed = srsValues.filter((r) =>
    r.id.startsWith("sent_dlg_")
  ).length;
  const muhadeseCount =
    completedDialogueLinesCount +
    srsDialogueSentencesPracticed +
    (input.skillStats?.dinleme?.total || 0) +
    totalPronCount;

  const srsSentenceIdiomCorrect = srsValues
    .filter((r) => r.type === "sentence" || r.type === "idiom")
    .reduce((sum, r) => sum + (r.correctCount || 0), 0);
  const sentenceMasterCount =
    completedReadingLinesCount +
    srsSentenceIdiomCorrect +
    (input.skillStats?.okuma?.correct || 0) +
    (input.skillStats?.imla?.correct || 0);

  const topicMasteryCompletedCount = Object.values(input.topicMastery || {}).filter(
    (t) => t && t.total >= 1 && t.correct >= 1
  ).length;
  const grammarSrsIdsCount = srsValues.filter(
    (r) =>
      r.correctCount >= 1 &&
      (/^grm_\d+/i.test(r.id) || Boolean(findGrammarNoteByMistakeId(r.id)))
  ).length;
  const grammarLessonsDoneCount =
    completedDialoguesCount + completedReadingsCount;
  const grammarExplorerCount = Math.max(
    topicMasteryCompletedCount + grammarSrsIdsCount,
    Math.min(
      tumGramerHapBilgiler.length,
      topicMasteryCompletedCount +
        grammarSrsIdsCount +
        Math.floor((input.skillStats?.gramer?.correct || 0) / 3) +
        Math.floor(grammarLessonsDoneCount / 2)
    )
  );

  const makeBadge = (
    id: string,
    icon: string,
    title: string,
    description: string,
    current: number,
    target: number,
    unitLabel: string,
    actionHref: string,
    actionLabel: string
  ): MilestoneBadgeItem => {
    const safeCurrent = Math.max(0, Math.floor(current));
    const unlocked = safeCurrent >= target;
    const progressPercent = Math.min(
      100,
      Math.round((Math.min(safeCurrent, target) / Math.max(1, target)) * 100)
    );
    return {
      id,
      icon,
      title,
      description,
      current: safeCurrent,
      target,
      unitLabel,
      progressPercent,
      unlocked,
      statusTag: unlocked ? "[☑️ KAZANILDI]" : "[🔒 KİLİTLİ]",
      actionHref,
      actionLabel,
    };
  };

  const badges: MilestoneBadgeItem[] = [
    makeBadge(
      "first_spark",
      "🔥",
      "İlk Kıvılcım",
      "İlk sesli telaffuz veya gölgeleme pratiğini tamamla.",
      totalPronCount,
      1,
      "pratik",
      "/diyalog/dlg_001",
      "Gölgeleme Yap"
    ),
    makeBadge(
      "word_hunter",
      "🎯",
      "Kelime Avcısı",
      "En az 25 kelimeyi öğren / doğru cevapla.",
      wordHunterCount,
      25,
      "kelime",
      "/alistirmalar",
      "Kelime Çalış"
    ),
    makeBadge(
      "muhadese_star",
      "💬",
      "Muhâdese Yıldızı",
      "Diyaloglarda en az 30 cümleyi dinle veya seslendir.",
      muhadeseCount,
      30,
      "cümle",
      "/kutuphane?tab=diyaloglar",
      "Diyaloglara Git"
    ),
    makeBadge(
      "sentence_master",
      "📜",
      "Cümle Üstadı",
      "1111 Kalıp Cümle veya Okuma Metinlerinde 50 doğru pratiğe ulaş.",
      sentenceMasterCount,
      50,
      "pratik",
      "/kutuphane?tab=cumleler",
      "Cümlelere Git"
    ),
    makeBadge(
      "streak_monument",
      "⚡",
      "İstikrar Abidesi",
      "3 gün üst üste çalışma serisi (Streak) yap.",
      Math.max(activeStreakDays, input.streakDays || 0),
      3,
      "gün",
      "/alistirmalar?plan=daily",
      "Günlük Paket"
    ),
    makeBadge(
      "arabic_orator",
      "👑",
      "Arapça Hatibi",
      "Toplam 1000 başarı puanını (XP) geç.",
      totalXp,
      1000,
      "XP",
      "/alistirmalar",
      "Puan Topla"
    ),
    makeBadge(
      "grammar_explorer",
      "🧭",
      "Gramer Kaşifi",
      "Gramer Atlası'nda ve İ'rab/Hata Avcısı modüllerinde 15 konuyu tamamla.",
      grammarExplorerCount,
      15,
      "konu",
      "/alistirmalar?mode=error-hunter",
      "Gramer Pratiği"
    ),
    makeBadge(
      "listening_traveler",
      "🎬",
      "Dinleme Seyyahı",
      "Video & İzleme Rehberi'nde 5 fasih Arapça videoyu tamamla.",
      watchedCount,
      5,
      "video",
      "/kutuphane?tab=videolar",
      "Videolara Git"
    ),
  ];

  const unlockedBadgesCount = badges.filter((b) => b.unlocked).length;

  // Sekme 2: Modül ve CEFR Başarı Grafikleri
  const savedIdsSet = new Set((input.favoriteWords || []).map((w) => w.id));
  const srsPositiveIdsSet = new Set(
    srsValues.filter((r) => r.correctCount > 0 || r.status === "mastered").map((r) => r.id)
  );
  const learnedSet = new Set(input.learnedWords || []);

  // Görsel kelimeler eşleşmesi (id veya mufret/ar temelli)
  const positiveCleanArabicSet = new Set<string>();
  const sozlukById = new Map(sozluk.map((w) => [w.id, w]));
  for (const wid of uniquePositiveWordIds) {
    const found = sozlukById.get(wid);
    if (found) {
      const ar = cleanArabicText(found.mufret || found.mazi || "");
      if (ar) positiveCleanArabicSet.add(ar);
    }
  }
  for (const fw of input.favoriteWords || []) {
    const ar = cleanArabicText(fw.mufret || fw.mazi || "");
    if (ar) positiveCleanArabicSet.add(ar);
  }

  let visualDoneTotal = 0;
  const visualDoneByLevel: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  const visualTotalByLevel: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  for (const gk of gorselKelimeler) {
    const lvl: Level = gk.cefr || "A1";
    visualTotalByLevel[lvl] += 1;
    const arClean = cleanArabicText(
      gk.arapca || gk.kelime_ar || gk.mufret || ""
    );
    if (
      learnedSet.has(gk.id) ||
      srsPositiveIdsSet.has(gk.id) ||
      savedIdsSet.has(gk.id) ||
      (arClean && positiveCleanArabicSet.has(arClean))
    ) {
      visualDoneTotal += 1;
      visualDoneByLevel[lvl] += 1;
    }
  }

  let sentenceDoneTotal = 0;
  const sentenceDoneByLevel: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  const sentenceTotalByLevel: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  for (const c of cumleler1111) {
    const lvl: Level = (c.seviye || c.cefr || "A1") as Level;
    sentenceTotalByLevel[lvl] += 1;
    if (
      learnedSet.has(c.id) ||
      srsPositiveIdsSet.has(c.id) ||
      srsPositiveIdsSet.has(`sent_${c.id}`) ||
      savedIdsSet.has(c.id) ||
      savedIdsSet.has(`cumle_${c.id}`)
    ) {
      sentenceDoneTotal += 1;
      sentenceDoneByLevel[lvl] += 1;
    }
  }

  let proverbDoneTotal = 0;
  const proverbDoneByLevel: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  const proverbTotalByLevel: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  for (const p of atasozleri) {
    const lvl: Level = (p.cefr || "B1") as Level;
    proverbTotalByLevel[lvl] += 1;
    if (
      learnedSet.has(p.id) ||
      srsPositiveIdsSet.has(p.id) ||
      savedIdsSet.has(p.id) ||
      savedIdsSet.has(`atasozu_${p.id}`)
    ) {
      proverbDoneTotal += 1;
      proverbDoneByLevel[lvl] += 1;
    }
  }

  let synDoneTotal = 0;
  const synDoneByLevel: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  const synTotalByLevel: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  for (const ez of esZitAnlamlilar) {
    const lvl: Level = ez.cefr || "A1";
    synTotalByLevel[lvl] += 1;
    const arClean = cleanArabicText(ez.kelime_ar || "");
    if (
      learnedSet.has(ez.id) ||
      srsPositiveIdsSet.has(ez.id) ||
      savedIdsSet.has(ez.id) ||
      (arClean && positiveCleanArabicSet.has(arClean))
    ) {
      synDoneTotal += 1;
      synDoneByLevel[lvl] += 1;
    }
  }

  const levelTitles: Record<Level, string> = {
    A1: "A1 Başlangıç (Temel İletişim)",
    A2: "A2 Temel (Günlük Hayat)",
    B1: "B1 Orta (Bağlamsal Akıcılık)",
    B2: "B2 İleri (Akademik & Edebi)",
  };

  const cefrProgress: CefrProgressRow[] = (["A1", "A2", "B1", "B2"] as Level[]).map(
    (lvl) => {
      const dlgsInLvl = diyaloglar.filter((d) => d.seviye === lvl);
      const dlgsDone = dlgsInLvl.filter((d) => completedSet.has(d.id)).length;
      const rdgsInLvl = metinler.filter((m) => m.seviye === lvl);
      const rdgsDone = rdgsInLvl.filter((m) => completedSet.has(m.id)).length;

      // Ders odaklı ağırlıklı kur tamamlanma hesabı (Diyalog + Okuma Metni + Görsel Kelime + Eş-Zıt)
      const totalCore =
        dlgsInLvl.length +
        rdgsInLvl.length +
        visualTotalByLevel[lvl] +
        synTotalByLevel[lvl];
      const completedCore =
        dlgsDone +
        rdgsDone +
        visualDoneByLevel[lvl] +
        synDoneByLevel[lvl];

      const percent =
        totalCore > 0
          ? Math.min(100, Math.round((completedCore / totalCore) * 100))
          : 0;

      return {
        level: lvl,
        titleTr: levelTitles[lvl],
        completedItems: completedCore,
        totalItems: totalCore,
        percent,
        dialoguesDone: dlgsDone,
        dialoguesTotal: dlgsInLvl.length,
        readingsDone: rdgsDone,
        readingsTotal: rdgsInLvl.length,
        examPassed: (input.completedLevelExams || []).includes(lvl),
      };
    }
  );

  const moduleProgress: ModuleProgressRow[] = [
    {
      id: "diyaloglar",
      title: `${diyaloglar.length} Diyalog`,
      arabicLabel: "الْحِوَارَات",
      completed: completedDialoguesCount,
      total: diyaloglar.length,
      percent: Math.min(
        100,
        Math.round((completedDialoguesCount / Math.max(1, diyaloglar.length)) * 100)
      ),
      href: "/kutuphane?tab=diyaloglar",
    },
    {
      id: "metinler",
      title: `${metinler.length} Okuma Metni`,
      arabicLabel: "نُصُوصُ الْقِرَاءَة",
      completed: completedReadingsCount,
      total: metinler.length,
      percent: Math.min(
        100,
        Math.round((completedReadingsCount / Math.max(1, metinler.length)) * 100)
      ),
      href: "/kutuphane?tab=metinler",
    },
    {
      id: "gorsel_kelime",
      title: `${gorselKelimeler.length} Görsel Kelime`,
      arabicLabel: "الْمُفْرَدَاتُ الْمُصَوَّرَة",
      completed: visualDoneTotal,
      total: gorselKelimeler.length,
      percent: Math.min(
        100,
        Math.round((visualDoneTotal / Math.max(1, gorselKelimeler.length)) * 100)
      ),
      href: "/kutuphane?tab=gorsel_kelime",
    },
    {
      id: "cumleler",
      title: `${cumleler1111.length} Cümle`,
      arabicLabel: "الْجُمَلُ الْيَوْمِيَّة",
      completed: sentenceDoneTotal,
      total: cumleler1111.length,
      percent: Math.min(
        100,
        Math.round((sentenceDoneTotal / Math.max(1, cumleler1111.length)) * 100)
      ),
      href: "/kutuphane?tab=cumleler",
    },
    {
      id: "atasozleri",
      title: `${atasozleri.length} Atasözü`,
      arabicLabel: "الأَمْثَالُ وَالْحِكَم",
      completed: proverbDoneTotal,
      total: atasozleri.length,
      percent: Math.min(
        100,
        Math.round((proverbDoneTotal / Math.max(1, atasozleri.length)) * 100)
      ),
      href: "/kutuphane?tab=atasozleri",
    },
    {
      id: "es_zit",
      title: `${esZitAnlamlilar.length} Eş-Zıt Anlamlı`,
      arabicLabel: "الْمُرَادِفَاتُ وَالأَضْدَاد",
      completed: synDoneTotal,
      total: esZitAnlamlilar.length,
      percent: Math.min(
        100,
        Math.round((synDoneTotal / Math.max(1, esZitAnlamlilar.length)) * 100)
      ),
      href: "/kutuphane?tab=es_zit",
    },
  ];

  // Sekme 3: En Çok Hata Yapılan Kelimeler, Cümleler ve 28 Harf Mahreç Listesi
  const frequentMistakes: FrequentMistakeRow[] = [];
  const seenUids = new Set<string>();

  const candidateMistakeMap = new Map<
    string,
    { wrongCount: number; correctCount: number }
  >();

  for (const rawMistakeId of input.mistakeIds || []) {
    const canon = normalizeToCanonicalMistakeId(rawMistakeId) || rawMistakeId.trim();
    if (!canon) continue;
    const srs = input.srsRecords?.[canon] || input.srsRecords?.[rawMistakeId];
    candidateMistakeMap.set(canon, {
      wrongCount: Math.max(1, srs?.wrongCount || 1),
      correctCount: srs?.correctCount || 0,
    });
  }

  for (const rec of srsValues) {
    if ((rec.wrongCount || 0) > 0) {
      const canon = normalizeToCanonicalMistakeId(rec.id) || rec.id;
      const prev = candidateMistakeMap.get(canon);
      candidateMistakeMap.set(canon, {
        wrongCount: Math.max(prev?.wrongCount || 0, rec.wrongCount),
        correctCount: Math.max(prev?.correctCount || 0, rec.correctCount || 0),
      });
    }
  }

  for (const ww of input.weakWords || []) {
    if (!ww?.id) continue;
    if (!candidateMistakeMap.has(ww.id)) {
      candidateMistakeMap.set(ww.id, { wrongCount: 1, correctCount: 0 });
    }
  }

  const idiomsCatalog = getCombinedIdiomsCatalog();
  const extractedIdioms = extractDialoguesIdioms(diyaloglar);
  const ezMap = new Map(esZitAnlamlilar.map((e) => [e.id.toLowerCase(), e]));
  const gkMap = new Map(gorselKelimeler.map((g) => [g.id, g]));
  const sent1111Map = new Map(cumleler1111.map((c) => [c.id, c]));
  const provMap = new Map(atasozleri.map((a) => [a.id, a]));

  for (const [canonId, counts] of candidateMistakeMap.entries()) {
    if (seenUids.has(canonId)) continue;
    const totalTries = counts.wrongCount + counts.correctCount;
    const acc =
      totalTries > 0 ? Math.round((counts.correctCount / totalTries) * 100) : null;

    // 1) Diyalog satırı (sent_dlg_XX_Y)
    const sentMatch = canonId.match(/^sent_(dlg_\d+)[-_](\d+)$/);
    if (sentMatch) {
      const dlgId = sentMatch[1];
      const sira = parseInt(sentMatch[2], 10);
      const dlg = dialogueById.get(dlgId);
      const line = dlg?.satirlar.find((l) => l.sira === sira);
      if (dlg && line) {
        seenUids.add(canonId);
        frequentMistakes.push({
          uid: canonId,
          kind: "sentence",
          kindLabel: `Diyalog Cümlesi (${dlg.seviye})`,
          arabicText: line.arapca,
          turkishText: line.turkce,
          detailNote: `${dlg.baslik_tr} • Satır #${line.sira}`,
          wrongCount: counts.wrongCount,
          correctCount: counts.correctCount,
          accuracyPercent: acc,
          dialogueId: dlg.id,
          lineSira: line.sira,
          practiceHref: `/diyalog/${dlg.id}`,
          shadowingSampleAr: line.arapca,
        });
        continue;
      }
    }

    // 2) 1111 Cümle
    const strippedSentId = canonId.replace(/^sent_/, "");
    const foundSent1111 = sent1111Map.get(canonId) || sent1111Map.get(strippedSentId);
    if (foundSent1111) {
      seenUids.add(canonId);
      frequentMistakes.push({
        uid: canonId,
        kind: "sentence",
        kindLabel: `Günlük Cümle (${foundSent1111.seviye || foundSent1111.cefr || "A1"})`,
        arabicText: foundSent1111.arapca,
        turkishText: foundSent1111.turkce,
        wrongCount: counts.wrongCount,
        correctCount: counts.correctCount,
        accuracyPercent: acc,
        sesErkek: `/sesler/cumleler/erkek/${foundSent1111.id}.mp3`,
        sesKadin: `/sesler/cumleler/kadin/${foundSent1111.id}.mp3`,
        audioItemId: foundSent1111.id,
        audioCategory: "cumle",
        practiceHref: "/alistirmalar?pool=mistakes",
        shadowingSampleAr: foundSent1111.arapca,
      });
      continue;
    }

    // 3) Atasözü
    const foundProv = provMap.get(canonId);
    if (foundProv) {
      seenUids.add(canonId);
      frequentMistakes.push({
        uid: canonId,
        kind: "sentence",
        kindLabel: `Atasözü (${foundProv.cefr || "B1"})`,
        arabicText: foundProv.arapca || foundProv.kelime_ar || "",
        turkishText: foundProv.turkce || foundProv.anlam_tr || "",
        wrongCount: counts.wrongCount,
        correctCount: counts.correctCount,
        accuracyPercent: acc,
        sesErkek: foundProv.ses_erkek,
        sesKadin: foundProv.ses_kadin,
        audioItemId: foundProv.id,
        audioCategory: "atasozu",
        practiceHref: "/alistirmalar?pool=mistakes",
        shadowingSampleAr: foundProv.arapca,
      });
      continue;
    }

    // 4) Kalıp ifade
    const strippedIdm = canonId.replace(/^idiom_/, "");
    const foundIdm =
      idiomsCatalog.find((i) => i.id === strippedIdm || i.id === canonId) ||
      extractedIdioms.find((i) => i.id === strippedIdm || i.id === canonId);
    if (foundIdm) {
      seenUids.add(canonId);
      frequentMistakes.push({
        uid: canonId,
        kind: "sentence",
        kindLabel: `Kalıp İfade (${foundIdm.level})`,
        arabicText: foundIdm.arabic,
        turkishText: foundIdm.meaningTr,
        detailNote: foundIdm.usageNote,
        wrongCount: counts.wrongCount,
        correctCount: counts.correctCount,
        accuracyPercent: acc,
        practiceHref: "/alistirmalar?pool=mistakes",
        shadowingSampleAr: foundIdm.arabic,
      });
      continue;
    }

    // 5) Eş & Zıt Anlamlılar
    const foundEz = ezMap.get(canonId.toLowerCase());
    if (foundEz) {
      const asDict = synonymEntryToDictionaryItem(foundEz);
      seenUids.add(canonId);
      frequentMistakes.push({
        uid: canonId,
        kind: "word",
        kindLabel: `Eş & Zıt Anlamlı (${foundEz.cefr})`,
        arabicText: foundEz.kelime_ar,
        turkishText: asDict.anlam_tr,
        detailNote:
          foundEz.es_anlamlilar[0]?.ar
            ? `Eş: ${foundEz.es_anlamlilar[0].ar}${
                foundEz.zit_anlamlilar[0]?.ar ? ` · Zıt: ${foundEz.zit_anlamlilar[0].ar}` : ""
              }`
            : undefined,
        wrongCount: counts.wrongCount,
        correctCount: counts.correctCount,
        accuracyPercent: acc,
        practiceHref: "/alistirmalar?pool=mistakes",
        shadowingSampleAr: foundEz.kelime_ar,
      });
      continue;
    }

    // 6) Gramer Notu
    const foundGrammar = findGrammarNoteByMistakeId(canonId);
    if (foundGrammar) {
      const asDict = grammarNoteToDictionaryItem(foundGrammar);
      const arTxt = asDict.mufret || foundGrammar.metinden_ornek?.arapca || "";
      if (arTxt) {
        seenUids.add(canonId);
        frequentMistakes.push({
          uid: canonId,
          kind: "sentence",
          kindLabel: `Gramer Notu (${foundGrammar.seviye})`,
          arabicText: arTxt,
          turkishText: asDict.anlam_tr,
          detailNote: foundGrammar.konu_basligi,
          wrongCount: counts.wrongCount,
          correctCount: counts.correctCount,
          accuracyPercent: acc,
          practiceHref: "/alistirmalar?mode=error-hunter",
          shadowingSampleAr: arTxt,
        });
        continue;
      }
    }

    // 7) Görsel Kelime veya Sözlük Kelimesi
    const strippedW = canonId.replace(/^word_/, "");
    const foundGk = gkMap.get(canonId) || gkMap.get(strippedW);
    if (foundGk) {
      seenUids.add(canonId);
      frequentMistakes.push({
        uid: canonId,
        kind: "word",
        kindLabel: `Görsel Kelime (${foundGk.cefr || "A1"})`,
        arabicText: foundGk.arapca || foundGk.kelime_ar || foundGk.mufret || "",
        turkishText: foundGk.turkce || foundGk.anlam_tr || "",
        detailNote: foundGk.kategori_tr,
        wrongCount: counts.wrongCount,
        correctCount: counts.correctCount,
        accuracyPercent: acc,
        sesErkek: foundGk.ses_erkek,
        sesKadin: foundGk.ses_kadin,
        audioItemId: foundGk.id,
        audioCategory: "kelime",
        practiceHref: "/alistirmalar?pool=mistakes",
        shadowingSampleAr:
          foundGk.arapca || foundGk.kelime_ar || foundGk.mufret || "",
      });
      continue;
    }

    const foundWord =
      sozlukById.get(canonId) ||
      sozlukById.get(strippedW) ||
      (input.weakWords || []).find((w) => w.id === canonId || w.id === strippedW);
    if (foundWord) {
      const arTxt = foundWord.mufret || foundWord.mazi || "";
      if (arTxt) {
        seenUids.add(canonId);
        frequentMistakes.push({
          uid: canonId,
          kind: "word",
          kindLabel: `Kelime (${foundWord.cefr || "Sözlük"})`,
          arabicText: arTxt,
          turkishText: foundWord.anlam_tr,
          detailNote:
            foundWord.kok && foundWord.kok !== "-"
              ? `Kök: ${foundWord.kok}`
              : undefined,
          wrongCount: counts.wrongCount,
          correctCount: counts.correctCount,
          accuracyPercent: acc,
          sesErkek: foundWord.ses_erkek,
          sesKadin: foundWord.ses_kadin,
          audioItemId: foundWord.id,
          audioCategory: "kelime",
          practiceHref: "/alistirmalar?pool=mistakes",
          shadowingSampleAr: arTxt,
        });
      }
    }
  }

  // 8) 28 Harf Mahreç (phonemeStats) zorlanılan harfleri ekle
  for (const ltr of ARABIC_28_LETTERS) {
    const pStat = input.phonemeStats?.[ltr];
    if (!pStat || pStat.attempts <= 0) continue;
    const errorCount = Math.max(
      pStat.confusions || 0,
      Math.max(0, pStat.attempts - pStat.cleanHits)
    );
    if (errorCount <= 0) continue;
    const meta = PHONEME_SHORT_NAMES[ltr];
    const acc = Math.round((pStat.cleanHits / Math.max(1, pStat.attempts)) * 100);
    frequentMistakes.push({
      uid: `phoneme_${ltr}`,
      kind: "phoneme",
      kindLabel: "28 Harf Mahreç",
      arabicText: `${ltr} — ${meta.sampleWordAr}`,
      turkishText: `${meta.nameTr} Harfi (Örnek: ${meta.sampleWordTr})`,
      detailNote: pStat.lastConfusedWith
        ? `Son denemede "${pStat.lastConfusedWith}" harfiyle karıştırıldı`
        : `${pStat.attempts} denemede ${pStat.cleanHits} temiz mahreç`,
      wrongCount: errorCount,
      correctCount: pStat.cleanHits,
      accuracyPercent: acc,
      phonemeLetter: ltr,
      shadowingSampleAr: meta.sampleWordAr,
    });
  }

  // Hata sıklığına göre azalan sırala
  frequentMistakes.sort((a, b) => {
    if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
    return (a.accuracyPercent ?? 100) - (b.accuracyPercent ?? 100);
  });

  return {
    totalXp,
    rank,
    activeStreakDays,
    todayStudyMinutes,
    dailyGoalMinutes,
    lastExercise,
    badges,
    unlockedBadgesCount,
    cefrProgress,
    moduleProgress,
    frequentMistakes,
  };
}
