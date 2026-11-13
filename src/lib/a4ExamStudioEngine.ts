import {
  atasozleri,
  cumleler1111,
  diyaloglar,
  esZitAnlamlilar,
  getDialogueById,
  getDialogueCoverUrl,
  getDialogueGrammarNote,
  getProverbCoverUrl,
  getReadingTextById,
  getReadingTextCoverUrl,
  getReadingTextGrammarNote,
  getVisualWordCoverUrl,
  gorselKelimeler,
  metinler,
  sozluk,
} from "@/lib/data";
import {
  cleanArabicText,
  DialogueVocabularyEntry,
  extractDialogueVocabulary,
  getDialogueVocabulary,
  getReadingTextVocabulary,
  getWordCategory,
} from "@/lib/dict";
import { removeArabicHarakat } from "@/lib/arabicTextUtils";
import {
  allocateExam100PointsSixSections,
  hashStringSeed,
  mulberry32,
  seededShuffle,
  SixSectionPointsAllocation,
} from "@/lib/pdfDeterministicUtils";
import {
  Dialogue,
  DictionaryItem,
  GramerHapBilgi,
  Level,
  ReadingTextQuestion,
  SynonymAntonymWordTur,
} from "@/types/data";

export type StudioSourceId =
  | "diyaloglar"
  | "metinler"
  | "gorsel_kelimeler"
  | "cumleler_1111"
  | "atasozleri"
  | "es_zit_anlamlilar"
  | "defterim_custom";

export type StudioLevelFilter = "all" | Level;

export const STUDIO_DEFAULT_PAPER_TITLE =
  "Arapça Dersi Kelime, Sarf ve Anlama Yazılı Sınavı / Çalışma Yaprağı";

export const STUDIO_POOL_PACK_ID = "__POOL__";

export interface StudioSourceMeta {
  id: StudioSourceId;
  label: string;
  shortLabel: string;
}

export const STUDIO_MATERIAL_SOURCES: readonly StudioSourceMeta[] = [
  {
    id: "diyaloglar",
    label: `Günlük Diyaloglar (${diyaloglar.length})`,
    shortLabel: "Günlük Diyaloglar",
  },
  {
    id: "metinler",
    label: `Okuma Metinleri (${metinler.length})`,
    shortLabel: "Okuma Metinleri",
  },
  {
    id: "gorsel_kelimeler",
    label: `Görsel Kelimeler (${gorselKelimeler.length})`,
    shortLabel: "Görsel Kelimeler",
  },
  {
    id: "cumleler_1111",
    label: `${cumleler1111.length} Günlük Cümle`,
    shortLabel: "1111 Günlük Cümle",
  },
  {
    id: "atasozleri",
    label: `Atasözleri (${atasozleri.length})`,
    shortLabel: "Atasözleri",
  },
  {
    id: "es_zit_anlamlilar",
    label: `Eş & Zıt Anlamlılar (${esZitAnlamlilar.length})`,
    shortLabel: "Eş & Zıt Anlamlılar",
  },
];

export interface StudioPackOption {
  id: string;
  label: string;
  levelBadge: string;
}

export interface TopicSummaryRow {
  headingTr: string;
  detailTr: string;
  exampleAr?: string;
  exampleTr?: string;
}

export interface StudioTopicSummary {
  titleTr: string;
  titleAr: string;
  ruleSummaryTr: string;
  rows: TopicSummaryRow[];
}

export interface VocabPairCandidate {
  id: string;
  arabic: string;
  turkish: string;
  level: Level;
}

export interface SentenceBlankCandidate {
  id: string;
  fullArabic: string;
  blankArabic: string;
  targetWordAr: string;
  turkish: string;
  level: Level;
}

export interface MorphologyCandidate {
  id: string;
  wordKind: "isim" | "fiil";
  turkce: string;
  kokSpaced: string;
  form1Label: string;
  form1Ar: string;
  form2Label: string;
  form2Ar: string;
  level: Level;
}

export interface StudioMaterialBundle {
  sourceId: StudioSourceId;
  levelFilter: StudioLevelFilter;
  packId: string;
  dialogue: Dialogue;
  vocabEntries: DialogueVocabularyEntry[];
  imagePath: string;
  rawNum: number;
  readingQuestions: ReadingTextQuestion[];
  grammarNote?: GramerHapBilgi;
  sourceCodeBracket: string;
  sourceTitleTr: string;
  sourceTitleAr: string;
  sourceLevelLabel: string;
  topicSummary: StudioTopicSummary;
  vocabCandidates: VocabPairCandidate[];
  sentenceCandidates: SentenceBlankCandidate[];
  morphologyCandidates: MorphologyCandidate[];
}

export interface SixSectionExamCounts {
  sec1ArToTr: number; // 0-50
  sec2TrToAr: number; // 0-50
  sec3FillBlank: number; // 0-50
  sec4MultipleChoice: number; // 0-50
  sec5Matching: number; // 0-30
  sec6Morphology: number; // 0-30
}

export interface ExamSec1Item {
  num: number;
  points: number;
  arabic: string;
  correctTurkish: string;
}

export interface ExamSec2Item {
  num: number;
  points: number;
  turkish: string;
  correctArabic: string;
}

export interface ExamSec3Item {
  num: number;
  points: number;
  turkishMeaning: string;
  blankSentenceAr: string;
  fullSentenceAr: string;
  targetWordAr: string;
}

export interface ExamSec4Option {
  letter: "A" | "B" | "C" | "D";
  textTr: string;
}

export interface ExamSec4Item {
  num: number;
  points: number;
  arabicPrompt: string;
  questionStemTr: string;
  options: [ExamSec4Option, ExamSec4Option, ExamSec4Option, ExamSec4Option];
  correctLetter: "A" | "B" | "C" | "D";
  correctTurkish: string;
}

export interface ExamSec5MatchingRow {
  rowIndex: number;
  points: number;
  leftLetter: string;
  leftArabic: string;
  leftCorrectTr: string;
  rightNumber: number;
  rightShuffledTr: string;
  rightCorrectLetter: string;
  rightMatchedArabic: string;
}

export interface ExamSec6MorphRow {
  num: number;
  points: number;
  wordKind: "isim" | "fiil";
  turkce: string;
  kokSpaced: string;
  form1Label: string;
  form1Ar: string;
  form2Label: string;
  form2Ar: string;
  givenSlot: "form1" | "form2";
}

export interface SixSectionExamData {
  bookletGroup: "A" | "B";
  formCode: string;
  pointsAllocation: SixSectionPointsAllocation;
  sec1ArToTr: ExamSec1Item[];
  sec2TrToAr: ExamSec2Item[];
  sec3FillBlank: ExamSec3Item[];
  sec3WordBank: string[];
  sec4MultipleChoice: ExamSec4Item[];
  sec5Matching: ExamSec5MatchingRow[];
  sec6Morphology: ExamSec6MorphRow[];
}

function cleanMeaningTr(raw: string): string {
  const trimmed = (raw || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return trimmed;
}

function conciseMeaningTr(raw: string, maxLen = 70): string {
  const cleaned = cleanMeaningTr(raw);
  if (cleaned.length <= maxLen) return cleaned;
  const firstClause = cleaned.split(/[;•]/)[0]?.trim() || cleaned;
  if (firstClause.length <= maxLen) return firstClause;
  return `${firstClause.slice(0, maxLen - 1).trim()}…`;
}

function formatSpacedRoot(rawKok?: string): string {
  const clean = removeArabicHarakat(rawKok || "")
    .replace(/[-\s/،,()]/g, "")
    .trim();
  if (clean.length < 2) return "";
  return clean.split("").join(" - ");
}

function indexToAlphaCode(idx: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (idx < alphabet.length) return alphabet[idx];
  const hi = Math.floor(idx / alphabet.length) - 1;
  const lo = idx % alphabet.length;
  return `${alphabet[Math.max(0, hi)]}${alphabet[lo]}`;
}

function stripPunctuationToken(tok: string): string {
  return tok.replace(/[.,!?؟،؛:"'«»()[\]—\-]/g, "").trim();
}

function createSentenceBlankFromLine(
  id: string,
  fullArabic: string,
  turkish: string,
  level: Level,
  preferredTermsAr?: string[]
): SentenceBlankCandidate | null {
  const cleanFull = (fullArabic || "").trim();
  const cleanTr = cleanMeaningTr(turkish);
  if (!cleanFull || !cleanTr) return null;

  const tokens = cleanFull.split(/(\s+)/);
  const wordEntries = tokens
    .map((tok, idx) => {
      const stripped = stripPunctuationToken(tok);
      const norm = cleanArabicText(stripped);
      return { tok, idx, stripped, norm };
    })
    .filter((e) => !/^\s+$/.test(e.tok) && e.norm.length >= 2);

  if (wordEntries.length === 0) return null;

  let chosen = wordEntries.find((w) => {
    if (!preferredTermsAr || preferredTermsAr.length === 0) return false;
    return preferredTermsAr.some((pref) => {
      const pNorm = cleanArabicText(pref);
      return (
        pNorm.length >= 2 &&
        (w.norm === pNorm ||
          w.norm === `ال${pNorm}` ||
          (pNorm.length >= 3 &&
            (w.norm.startsWith(pNorm) || w.norm.endsWith(pNorm))))
      );
    });
  });

  if (!chosen) {
    chosen =
      wordEntries.find((w) => w.norm.length >= 4) ||
      wordEntries[Math.min(1, wordEntries.length - 1)];
  }

  const trailingPunct = chosen.tok.slice(chosen.stripped.length);
  const updated = [...tokens];
  updated[chosen.idx] = `................${trailingPunct}`;

  return {
    id,
    fullArabic: cleanFull,
    blankArabic: updated.join(""),
    targetWordAr: chosen.stripped,
    turkish: cleanTr,
    level,
  };
}

function extractMorphologyFromDictItem(
  item: DictionaryItem,
  fallbackLevel: Level
): MorphologyCandidate | null {
  const kokSpaced = formatSpacedRoot(item.kok);
  if (!kokSpaced) return null;
  const lvl: Level =
    item.cefr === "A1" ||
    item.cefr === "A2" ||
    item.cefr === "B1" ||
    item.cefr === "B2"
      ? item.cefr
      : fallbackLevel;
  const category = getWordCategory(item);

  if (category === "fiil") {
    const mazi = (item.mazi || item.mufret || "").split(/[،,/]/)[0]?.trim() || "";
    const muzari =
      (item.muzari || item.masdar || "").split(/[،,/]/)[0]?.trim() || "";
    if (mazi && mazi !== "-" && muzari && muzari !== "-") {
      return {
        id: `morph_v_${item.id}`,
        wordKind: "fiil",
        turkce: conciseMeaningTr(item.anlam_tr, 48),
        kokSpaced,
        form1Label: "Mâzî",
        form1Ar: mazi,
        form2Label: item.muzari && item.muzari !== "-" ? "Muzâri" : "Masdar",
        form2Ar: muzari,
        level: lvl,
      };
    }
  } else {
    const mufret = (item.mufret || "").split(/[،,/]/)[0]?.trim() || "";
    const cemi = (item.cemi || "").split(/[،,/]/)[0]?.trim() || "";
    if (mufret && mufret !== "-" && cemi && cemi !== "-") {
      return {
        id: `morph_n_${item.id}`,
        wordKind: "isim",
        turkce: conciseMeaningTr(item.anlam_tr, 48),
        kokSpaced,
        form1Label: "Müfret",
        form1Ar: mufret,
        form2Label: "Cemî",
        form2Ar: cemi,
        level: lvl,
      };
    }
  }
  return null;
}

const GLOBAL_MORPHOLOGY_POOL: MorphologyCandidate[] = (() => {
  const seenKeys = new Set<string>();
  const out: MorphologyCandidate[] = [];

  for (const item of sozluk) {
    const cand = extractMorphologyFromDictItem(item, "A1");
    if (!cand) continue;
    const dedupKey = `${cand.wordKind}_${cleanArabicText(cand.form1Ar)}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);
    out.push(cand);
  }

  for (const gk of gorselKelimeler) {
    const kokSpaced = formatSpacedRoot(gk.kok);
    if (!kokSpaced) continue;
    const f1 = (gk.arapca || "").split(/[،,/]/)[0]?.trim() || "";
    const f2 = (gk.ikincil_form || "").split(/[،,/]/)[0]?.trim() || "";
    if (!f1 || f1 === "-" || !f2 || f2 === "-") continue;
    const isVerb = gk.tur === "fiil";
    const dedupKey = `${isVerb ? "fiil" : "isim"}_${cleanArabicText(f1)}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);
    out.push({
      id: `morph_gk_${gk.id}`,
      wordKind: isVerb ? "fiil" : "isim",
      turkce: conciseMeaningTr(gk.turkce, 48),
      kokSpaced,
      form1Label: isVerb ? "Mâzî" : "Müfret",
      form1Ar: f1,
      form2Label: isVerb ? "Muzâri" : "Cemî",
      form2Ar: f2,
      level: gk.cefr || "A1",
    });
  }

  return out;
})();

const GLOBAL_VOCAB_POOL: VocabPairCandidate[] = (() => {
  const seen = new Set<string>();
  const out: VocabPairCandidate[] = [];
  for (const gk of gorselKelimeler) {
    const ar = (gk.arapca || "").trim();
    const tr = conciseMeaningTr(gk.turkce, 64);
    const key = cleanArabicText(ar);
    if (!ar || !tr || key.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `gv_${gk.id}`,
      arabic: ar,
      turkish: tr,
      level: gk.cefr || "A1",
    });
  }
  for (const ez of esZitAnlamlilar) {
    const ar = (ez.kelime_ar || "").trim();
    const tr = conciseMeaningTr(ez.anlam_tr, 64);
    const key = cleanArabicText(ar);
    if (!ar || !tr || key.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `ez_${ez.id}`,
      arabic: ar,
      turkish: tr,
      level: ez.cefr || "A1",
    });
  }
  for (const d of sozluk) {
    const ar = (d.mufret || d.mazi || "").split(/[،,/]/)[0]?.trim() || "";
    const tr = conciseMeaningTr(d.anlam_tr, 64);
    const key = cleanArabicText(ar);
    if (!ar || ar === "-" || !tr || key.length < 2 || seen.has(key)) continue;
    seen.add(key);
    const lvl: Level =
      d.cefr === "A1" || d.cefr === "A2" || d.cefr === "B1" || d.cefr === "B2"
        ? d.cefr
        : "A2";
    out.push({
      id: `sd_${d.id}`,
      arabic: ar,
      turkish: tr,
      level: lvl,
    });
  }
  return out;
})();

const GLOBAL_SENTENCE_POOL: SentenceBlankCandidate[] = (() => {
  const out: SentenceBlankCandidate[] = [];
  for (const c of cumleler1111) {
    const cand = createSentenceBlankFromLine(
      `cs_${c.id}`,
      c.arapca,
      c.turkce,
      c.seviye || "A1"
    );
    if (cand) out.push(cand);
  }
  return out;
})();

export function inferInitialStudioSelection(initialDialogue: Dialogue): {
  sourceId: StudioSourceId;
  levelFilter: StudioLevelFilter;
  packId: string;
} {
  const rawId = (initialDialogue.id || "").trim();

  if (rawId === "kutuphane_gorsel_kelimeler") {
    const hasSpecificLvl =
      !initialDialogue.baslik_tr.includes("Tüm Kurlar") &&
      Boolean(initialDialogue.seviye);
    return {
      sourceId: "gorsel_kelimeler",
      levelFilter: hasSpecificLvl ? initialDialogue.seviye : "all",
      packId: STUDIO_POOL_PACK_ID,
    };
  }
  if (rawId === "kutuphane_cumleler") {
    const hasSpecificLvl =
      !initialDialogue.baslik_tr.includes("Tüm Kurlar") &&
      Boolean(initialDialogue.seviye);
    return {
      sourceId: "cumleler_1111",
      levelFilter: hasSpecificLvl ? initialDialogue.seviye : "all",
      packId: STUDIO_POOL_PACK_ID,
    };
  }
  if (rawId === "kutuphane_atasozleri") {
    const hasSpecificLvl =
      !initialDialogue.baslik_tr.includes("Tüm Kurlar") &&
      Boolean(initialDialogue.seviye);
    return {
      sourceId: "atasozleri",
      levelFilter: hasSpecificLvl ? initialDialogue.seviye : "all",
      packId: STUDIO_POOL_PACK_ID,
    };
  }
  if (rawId === "kutuphane_es_zit") {
    const hasSpecificLvl =
      !initialDialogue.baslik_tr.includes("Tüm Kurlar") &&
      Boolean(initialDialogue.seviye);
    return {
      sourceId: "es_zit_anlamlilar",
      levelFilter: hasSpecificLvl ? initialDialogue.seviye : "all",
      packId: STUDIO_POOL_PACK_ID,
    };
  }
  if (rawId === "kutuphane_defterim") {
    return {
      sourceId: "defterim_custom",
      levelFilter: "all",
      packId: "kutuphane_defterim",
    };
  }
  if (rawId.startsWith("metin_")) {
    const found = getReadingTextById(rawId);
    return {
      sourceId: "metinler",
      levelFilter: "all",
      packId: found ? found.id : metinler[0]?.id || "metin_01",
    };
  }
  const foundDlg = getDialogueById(rawId);
  if (foundDlg) {
    return {
      sourceId: "diyaloglar",
      levelFilter: "all",
      packId: foundDlg.id,
    };
  }
  return {
    sourceId: "diyaloglar",
    levelFilter: "all",
    packId: diyaloglar[0]?.id || "dlg_001",
  };
}

export function listStudioPackOptions(
  sourceId: StudioSourceId,
  levelFilter: StudioLevelFilter,
  customInitialDialogue?: Dialogue
): StudioPackOption[] {
  if (sourceId === "defterim_custom") {
    return [
      {
        id: "kutuphane_defterim",
        label: customInitialDialogue
          ? `[defterim] ${customInitialDialogue.baslik_tr} — ${customInitialDialogue.baslik_ar}`
          : "[defterim] Kişisel Çalışma Defterim",
        levelBadge: customInitialDialogue?.seviye || "A1",
      },
    ];
  }

  if (sourceId === "diyaloglar") {
    const filtered = diyaloglar.filter(
      (d) => levelFilter === "all" || d.seviye === levelFilter
    );
    const items: StudioPackOption[] = filtered.map((d) => ({
      id: d.id,
      label: `[${d.id}] ${d.baslik_tr} — ${d.baslik_ar} (${d.seviye})`,
      levelBadge: d.seviye,
    }));
    items.push({
      id: STUDIO_POOL_PACK_ID,
      label: `🎲 Seçili Seviye Karma Diyalog Havuzu (${filtered.length} Diyalog)`,
      levelBadge: levelFilter === "all" ? "A1–B2" : levelFilter,
    });
    return items;
  }

  if (sourceId === "metinler") {
    const filtered = metinler.filter(
      (m) => levelFilter === "all" || m.seviye === levelFilter
    );
    const items: StudioPackOption[] = filtered.map((m) => ({
      id: m.id,
      label: `[${m.id}] ${m.baslik_tr} — ${m.baslik_ar} (${m.seviye})`,
      levelBadge: m.seviye,
    }));
    items.push({
      id: STUDIO_POOL_PACK_ID,
      label: `🎲 Seçili Seviye Karma Okuma Metni Havuzu (${filtered.length} Metin)`,
      levelBadge: levelFilter === "all" ? "A1–B2" : levelFilter,
    });
    return items;
  }

  if (sourceId === "gorsel_kelimeler") {
    const filtered = gorselKelimeler.filter(
      (g) => levelFilter === "all" || g.cefr === levelFilter
    );
    const catCounts = new Map<string, number>();
    for (const g of filtered) {
      const cat = (g.kategori_tr || "").replace(/\s*\(\d+\)\s*$/, "").trim();
      if (!cat) continue;
      catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    }
    const options: StudioPackOption[] = [
      {
        id: STUDIO_POOL_PACK_ID,
        label: `[gorsel_havuz] Görsel Kelimeler Karma Havuzu (${filtered.length} Kelime)`,
        levelBadge: levelFilter === "all" ? "A1–B2" : levelFilter,
      },
    ];
    Array.from(catCounts.entries()).forEach(([cat, count], idx) => {
      const code = `gorsel_${String(idx + 1).padStart(2, "0")}`;
      options.push({
        id: `gk_cat::${cat}`,
        label: `[${code}] ${cat} (${count} Kelime)`,
        levelBadge: levelFilter === "all" ? "A1–B2" : levelFilter,
      });
    });
    return options;
  }

  if (sourceId === "cumleler_1111") {
    const filtered = cumleler1111.filter(
      (c) => levelFilter === "all" || (c.cefr || c.seviye) === levelFilter
    );
    const temaCounts = new Map<string, number>();
    for (const c of filtered) {
      const t = (c.tema || "Genel").trim();
      temaCounts.set(t, (temaCounts.get(t) || 0) + 1);
    }
    const options: StudioPackOption[] = [
      {
        id: STUDIO_POOL_PACK_ID,
        label: `[cumle_1111] Günlük Cümleler Karma Havuzu (${filtered.length} Cümle)`,
        levelBadge: levelFilter === "all" ? "A1–B2" : levelFilter,
      },
    ];
    Array.from(temaCounts.entries()).forEach(([tema, count], idx) => {
      const code = `cumle_${String(idx + 1).padStart(2, "0")}`;
      options.push({
        id: `cml_tema::${tema}`,
        label: `[${code}] ${tema} (${count} Cümle)`,
        levelBadge: levelFilter === "all" ? "A1–B2" : levelFilter,
      });
    });
    return options;
  }

  if (sourceId === "atasozleri") {
    const filtered = atasozleri.filter(
      (a) => levelFilter === "all" || a.cefr === levelFilter
    );
    const temaCounts = new Map<string, number>();
    for (const a of filtered) {
      const t = (a.tema || "Genel").trim();
      temaCounts.set(t, (temaCounts.get(t) || 0) + 1);
    }
    const options: StudioPackOption[] = [
      {
        id: STUDIO_POOL_PACK_ID,
        label: `[atasozu_508] Atasözleri ve Hikmetli Sözler Havuzu (${filtered.length} Kayıt)`,
        levelBadge: levelFilter === "all" ? "A1–B2" : levelFilter,
      },
    ];
    Array.from(temaCounts.entries()).forEach(([tema, count], idx) => {
      const code = `ata_paket_${String(idx + 1).padStart(2, "0")}`;
      options.push({
        id: `ata_tema::${tema}`,
        label: `[${code}] ${tema} (${count} Atasözü)`,
        levelBadge: levelFilter === "all" ? "A1–B2" : levelFilter,
      });
    });
    return options;
  }

  // es_zit_anlamlilar
  const filtered = esZitAnlamlilar.filter(
    (e) => levelFilter === "all" || e.cefr === levelFilter
  );
  const turLabels: Record<SynonymAntonymWordTur, string> = {
    isim: "İsimler (الأسماء)",
    fiil: "Fiiller (الأفعال)",
    sifat: "Sıfatlar (الصفات)",
    zarf: "Zarflar ve Edatlar (الظروف)",
  };
  const options: StudioPackOption[] = [
    {
      id: STUDIO_POOL_PACK_ID,
      label: `[es_zit_400] Eş & Zıt Anlamlılar Karma Havuzu (${filtered.length} Madde)`,
      levelBadge: levelFilter === "all" ? "A1–B2" : levelFilter,
    },
  ];
  (["isim", "fiil", "sifat", "zarf"] as SynonymAntonymWordTur[]).forEach(
    (tur) => {
      const count = filtered.filter((e) => e.tur === tur).length;
      if (count > 0) {
        options.push({
          id: `esz_tur::${tur}`,
          label: `[es_zit_${tur}] ${turLabels[tur]} (${count} Madde)`,
          levelBadge: levelFilter === "all" ? "A1–B2" : levelFilter,
        });
      }
    }
  );
  return options;
}

function buildTopicSummaryFromGrammarNote(
  grammarNote: GramerHapBilgi | undefined,
  fallbackTitleTr: string,
  fallbackTitleAr: string,
  vocabEntries: DialogueVocabularyEntry[]
): StudioTopicSummary {
  if (grammarNote) {
    const rows: TopicSummaryRow[] = [
      {
        headingTr: "Odak Dilbilgisi Konusu",
        detailTr: grammarNote.konu_basligi,
        exampleAr: grammarNote.metinden_ornek?.arapca,
        exampleTr: grammarNote.metinden_ornek?.turkce,
      },
      {
        headingTr: "Temel Kaide Özeti",
        detailTr: grammarNote.hap_kural,
      },
    ];
    if (grammarNote.ayrintili_anlatim?.formul_sema) {
      rows.push({
        headingTr: "Yapısal Formül / Şema",
        detailTr: grammarNote.ayrintili_anlatim.formul_sema,
      });
    } else if (grammarNote.ipucu) {
      rows.push({
        headingTr: "Uygulama İpucu",
        detailTr: grammarNote.ipucu,
        exampleAr: grammarNote.ek_ornekler?.[0]?.arapca,
        exampleTr: grammarNote.ek_ornekler?.[0]?.turkce,
      });
    }
    return {
      titleTr: grammarNote.konu_basligi,
      titleAr: fallbackTitleAr,
      ruleSummaryTr: grammarNote.hap_kural,
      rows,
    };
  }

  const nounCount = vocabEntries.filter(
    (v) => getWordCategory(v.item) === "isim"
  ).length;
  const verbCount = vocabEntries.filter(
    (v) => getWordCategory(v.item) === "fiil"
  ).length;
  return {
    titleTr: fallbackTitleTr,
    titleAr: fallbackTitleAr,
    ruleSummaryTr:
      "Bu çalışma kağıdı; seçili materyal paketindeki temel kelime hazinesini, cümle içi bağlamsal kullanım kalıplarını ve sarf (kök, müfret-cemî ve mâzî-muzâri) çekim ilişkilerini ölçmek üzere hazırlanmıştır.",
    rows: [
      {
        headingTr: "Kapsam ve Hedef Kazanım",
        detailTr: `${fallbackTitleTr} — Kelime anlamlandırma, Arapça imla, boşluk doldurma ve sarf analizi.`,
      },
      {
        headingTr: "Kelime Türü Dağılımı",
        detailTr: `Seçili pakette ${nounCount} isim/sıfat ve ${verbCount} fiil odaklı morfolojik birim yer almaktadır.`,
      },
    ],
  };
}

export function resolveStudioMaterialBundle(params: {
  sourceId: StudioSourceId;
  levelFilter: StudioLevelFilter;
  packId: string;
  initialProps?: {
    dialogue: Dialogue;
    vocabEntries: DialogueVocabularyEntry[];
    imagePath: string;
    rawNum: number;
    readingQuestions?: ReadingTextQuestion[];
  };
}): StudioMaterialBundle {
  const { sourceId, levelFilter, packId, initialProps } = params;
  const fallbackDlg = diyaloglar[0];
  const targetLvl: Level = levelFilter === "all" ? "A1" : levelFilter;
  const lvlText =
    levelFilter === "all" ? "Tüm Kurlar (A1–B2)" : `Seviye ${levelFilter}`;

  // 0. Özel Defterim Modu
  if (sourceId === "defterim_custom") {
    const dlg = initialProps?.dialogue || fallbackDlg;
    const vEntries = initialProps?.vocabEntries || [];
    const vCands: VocabPairCandidate[] = vEntries
      .map((v, i) => ({
        id: `def_v_${i}`,
        arabic: (v.item.mufret || v.item.mazi || v.contextWord || "").trim(),
        turkish: conciseMeaningTr(v.item.anlam_tr),
        level: dlg.seviye,
      }))
      .filter((x) => x.arabic.length > 0 && x.turkish.length > 0);
    const sCands: SentenceBlankCandidate[] = dlg.satirlar
      .map((ln, idx) =>
        createSentenceBlankFromLine(
          `def_s_${idx}`,
          ln.arapca,
          ln.turkce,
          dlg.seviye,
          vCands.map((c) => c.arabic)
        )
      )
      .filter((x): x is SentenceBlankCandidate => Boolean(x));
    const mCands = vEntries
      .map((v) => extractMorphologyFromDictItem(v.item, dlg.seviye))
      .filter((x): x is MorphologyCandidate => Boolean(x));

    return {
      sourceId,
      levelFilter,
      packId: "kutuphane_defterim",
      dialogue: dlg,
      vocabEntries: vEntries,
      imagePath: initialProps?.imagePath || "",
      rawNum: initialProps?.rawNum || 1,
      readingQuestions: [],
      sourceCodeBracket: "[defterim]",
      sourceTitleTr: dlg.baslik_tr,
      sourceTitleAr: dlg.baslik_ar,
      sourceLevelLabel: `Seviye ${dlg.seviye}`,
      topicSummary: buildTopicSummaryFromGrammarNote(
        undefined,
        dlg.baslik_tr,
        dlg.baslik_ar,
        vEntries
      ),
      vocabCandidates: vCands,
      sentenceCandidates: sCands,
      morphologyCandidates: mCands,
    };
  }

  // 1. Günlük Diyaloglar (120)
  if (sourceId === "diyaloglar") {
    const filteredDlgs = diyaloglar.filter(
      (d) => levelFilter === "all" || d.seviye === levelFilter
    );
    const safePool = filteredDlgs.length > 0 ? filteredDlgs : diyaloglar;

    if (packId !== STUDIO_POOL_PACK_ID) {
      const selectedDlg =
        safePool.find((d) => d.id === packId) ||
        getDialogueById(packId) ||
        safePool[0];
      const useInitialVocab =
        Boolean(initialProps) &&
        selectedDlg.id === initialProps?.dialogue.id &&
        (initialProps?.vocabEntries.length || 0) > 0;
      const vEntries = useInitialVocab && initialProps
        ? initialProps.vocabEntries
        : getDialogueVocabulary(selectedDlg.id);
      const rawNum =
        parseInt(selectedDlg.id.replace(/\D+/g, ""), 10) ||
        selectedDlg.sira ||
        1;
      const imgPath =
        initialProps &&
        selectedDlg.id === initialProps.dialogue.id &&
        initialProps.imagePath
          ? initialProps.imagePath
          : selectedDlg.gorsel || getDialogueCoverUrl(selectedDlg.id);
      const grammarNote = getDialogueGrammarNote(selectedDlg.id);

      const vCands: VocabPairCandidate[] = vEntries
        .map((v) => ({
          id: `dv_${v.item.id}`,
          arabic: (v.item.mufret || v.item.mazi || v.contextWord || "")
            .split(/[،,/]/)[0]
            .trim(),
          turkish: conciseMeaningTr(v.item.anlam_tr),
          level: selectedDlg.seviye,
        }))
        .filter((x) => x.arabic && x.arabic !== "-" && x.turkish);

      const prefTerms = vCands.map((v) => v.arabic);
      const sCands: SentenceBlankCandidate[] = selectedDlg.satirlar
        .map((ln) =>
          createSentenceBlankFromLine(
            `ds_${selectedDlg.id}_${ln.sira}`,
            ln.arapca,
            ln.turkce,
            selectedDlg.seviye,
            prefTerms
          )
        )
        .filter((x): x is SentenceBlankCandidate => Boolean(x));

      const mCands = vEntries
        .map((v) => extractMorphologyFromDictItem(v.item, selectedDlg.seviye))
        .filter((x): x is MorphologyCandidate => Boolean(x));

      return {
        sourceId,
        levelFilter,
        packId: selectedDlg.id,
        dialogue: selectedDlg,
        vocabEntries: vEntries,
        imagePath: imgPath,
        rawNum,
        readingQuestions: [],
        grammarNote,
        sourceCodeBracket: `[${selectedDlg.id}]`,
        sourceTitleTr: selectedDlg.baslik_tr,
        sourceTitleAr: selectedDlg.baslik_ar,
        sourceLevelLabel: `Seviye ${selectedDlg.seviye}`,
        topicSummary: buildTopicSummaryFromGrammarNote(
          grammarNote,
          selectedDlg.baslik_tr,
          selectedDlg.baslik_ar,
          vEntries
        ),
        vocabCandidates: vCands,
        sentenceCandidates: sCands,
        morphologyCandidates: mCands,
      };
    }

    // Karma Diyalog Havuzu
    const poolLines = safePool.flatMap((d) =>
      d.satirlar.slice(0, 3).map((ln, idx) => ({
        ...ln,
        sira: idx + 1,
        level: d.seviye,
      }))
    );
    const handoutLines = poolLines.slice(0, 18).map((ln, idx) => ({
      sira: idx + 1,
      konusmaci: ln.konusmaci,
      konusmaci_ar: ln.konusmaci_ar,
      cinsiyet: ln.cinsiyet,
      arapca: ln.arapca,
      turkce: ln.turkce,
    }));
    const extracted = extractDialogueVocabulary(
      handoutLines.map((l) => l.arapca)
    ).slice(0, 24);
    const vEntries: DialogueVocabularyEntry[] = extracted.map((it, idx) => ({
      item: it,
      contextWord: it.mufret || it.mazi || "",
      contextSentence: handoutLines[idx % handoutLines.length]?.arapca || "",
      contextTranslation: handoutLines[idx % handoutLines.length]?.turkce || "",
      morphologyNote: it.tur || "isim",
      lineNumber: idx + 1,
    }));
    const syntheticDlg: Dialogue = {
      id: "diyalog_havuzu",
      seviye: targetLvl,
      baslik_tr: `Günlük Diyaloglar Karma Seçkisi (${lvlText})`,
      baslik_ar: "مُخْتَارَاتٌ مِنَ الْحِوَارَاتِ الْيَوْمِيَّةِ",
      odak_gramer: "İletişimsel Diyalog Kalıpları",
      satirlar: handoutLines,
    };
    const sCands = poolLines
      .slice(0, 80)
      .map((ln, idx) =>
        createSentenceBlankFromLine(
          `dp_s_${idx}`,
          ln.arapca,
          ln.turkce,
          ln.level
        )
      )
      .filter((x): x is SentenceBlankCandidate => Boolean(x));
    const vCands: VocabPairCandidate[] = vEntries
      .map((v) => ({
        id: `dp_v_${v.item.id}`,
        arabic: (v.item.mufret || v.item.mazi || "").split(/[،,/]/)[0].trim(),
        turkish: conciseMeaningTr(v.item.anlam_tr),
        level: targetLvl,
      }))
      .filter((x) => x.arabic && x.turkish);
    const mCands = vEntries
      .map((v) => extractMorphologyFromDictItem(v.item, targetLvl))
      .filter((x): x is MorphologyCandidate => Boolean(x));

    return {
      sourceId,
      levelFilter,
      packId: STUDIO_POOL_PACK_ID,
      dialogue: syntheticDlg,
      vocabEntries: vEntries,
      imagePath: safePool[0]?.gorsel || getDialogueCoverUrl("dlg_001"),
      rawNum: 1,
      readingQuestions: [],
      sourceCodeBracket: "[dlg_havuz]",
      sourceTitleTr: "Günlük Diyaloglar Karma Seçkisi",
      sourceTitleAr: "الْحِوَارَاتُ الْيَوْمِيَّةُ",
      sourceLevelLabel: lvlText,
      topicSummary: buildTopicSummaryFromGrammarNote(
        undefined,
        syntheticDlg.baslik_tr,
        syntheticDlg.baslik_ar,
        vEntries
      ),
      vocabCandidates: vCands,
      sentenceCandidates: sCands,
      morphologyCandidates: mCands,
    };
  }

  // 2. Okuma Metinleri (60)
  if (sourceId === "metinler") {
    const filteredTexts = metinler.filter(
      (m) => levelFilter === "all" || m.seviye === levelFilter
    );
    const safePool = filteredTexts.length > 0 ? filteredTexts : metinler;

    if (packId !== STUDIO_POOL_PACK_ID) {
      const selectedTxt =
        safePool.find((m) => m.id === packId) ||
        getReadingTextById(packId) ||
        safePool[0];
      const rawNum =
        parseInt(selectedTxt.id.replace(/\D+/g, ""), 10) ||
        selectedTxt.sira ||
        1;
      const useInitialVocab =
        Boolean(initialProps) &&
        selectedTxt.id === initialProps?.dialogue.id &&
        (initialProps?.vocabEntries.length || 0) > 0;
      const vEntries = useInitialVocab && initialProps
        ? initialProps.vocabEntries
        : getReadingTextVocabulary(selectedTxt.id);
      const grammarNote = getReadingTextGrammarNote(selectedTxt.id);
      const imgPath =
        initialProps &&
        selectedTxt.id === initialProps.dialogue.id &&
        initialProps.imagePath
          ? initialProps.imagePath
          : selectedTxt.gorsel || getReadingTextCoverUrl(selectedTxt.id);

      const asDialogue: Dialogue = {
        id: selectedTxt.id,
        seviye: selectedTxt.seviye,
        tema: selectedTxt.tema,
        odak_gramer: selectedTxt.odak_gramer,
        baslik_tr: selectedTxt.baslik_tr,
        baslik_ar: selectedTxt.baslik_ar,
        gorsel: imgPath,
        satirlar: selectedTxt.satirlar.map((ln) => ({
          sira: ln.sira,
          konusmaci: `Cümle ${ln.sira}`,
          konusmaci_ar: `${ln.sira}`,
          cinsiyet: "E",
          arapca: ln.arapca,
          turkce: ln.turkce,
        })),
      };

      const vCands: VocabPairCandidate[] = vEntries
        .map((v) => ({
          id: `mv_${v.item.id}`,
          arabic: (v.item.mufret || v.item.mazi || v.contextWord || "")
            .split(/[،,/]/)[0]
            .trim(),
          turkish: conciseMeaningTr(v.item.anlam_tr),
          level: selectedTxt.seviye,
        }))
        .filter((x) => x.arabic && x.arabic !== "-" && x.turkish);

      const sCands = selectedTxt.satirlar
        .map((ln) =>
          createSentenceBlankFromLine(
            `ms_${selectedTxt.id}_${ln.sira}`,
            ln.arapca,
            ln.turkce,
            selectedTxt.seviye,
            vCands.map((v) => v.arabic)
          )
        )
        .filter((x): x is SentenceBlankCandidate => Boolean(x));

      const mCands = vEntries
        .map((v) => extractMorphologyFromDictItem(v.item, selectedTxt.seviye))
        .filter((x): x is MorphologyCandidate => Boolean(x));

      return {
        sourceId,
        levelFilter,
        packId: selectedTxt.id,
        dialogue: asDialogue,
        vocabEntries: vEntries,
        imagePath: imgPath,
        rawNum,
        readingQuestions: selectedTxt.sorular || [],
        grammarNote,
        sourceCodeBracket: `[${selectedTxt.id}]`,
        sourceTitleTr: selectedTxt.baslik_tr,
        sourceTitleAr: selectedTxt.baslik_ar,
        sourceLevelLabel: `Seviye ${selectedTxt.seviye}`,
        topicSummary: buildTopicSummaryFromGrammarNote(
          grammarNote,
          selectedTxt.baslik_tr,
          selectedTxt.baslik_ar,
          vEntries
        ),
        vocabCandidates: vCands,
        sentenceCandidates: sCands,
        morphologyCandidates: mCands,
      };
    }

    // Karma Okuma Metni Havuzu
    const poolSentences = safePool.flatMap((m) =>
      m.satirlar.slice(0, 3).map((ln) => ({
        arapca: ln.arapca,
        turkce: ln.turkce,
        level: m.seviye,
      }))
    );
    const handoutSlice = poolSentences.slice(0, 16);
    const extracted = extractDialogueVocabulary(
      handoutSlice.map((l) => l.arapca)
    ).slice(0, 24);
    const vEntries: DialogueVocabularyEntry[] = extracted.map((it, idx) => ({
      item: it,
      contextWord: it.mufret || it.mazi || "",
      contextSentence: handoutSlice[idx % handoutSlice.length]?.arapca || "",
      contextTranslation: handoutSlice[idx % handoutSlice.length]?.turkce || "",
      morphologyNote: it.tur || "isim",
      lineNumber: idx + 1,
    }));
    const syntheticDlg: Dialogue = {
      id: "metin_havuzu",
      seviye: targetLvl,
      baslik_tr: `Okuma Metinleri Karma Seçkisi (${lvlText})`,
      baslik_ar: "مُخْتَارَاتٌ مِنْ نُصُوصِ الْقِرَاءَةِ",
      odak_gramer: "Okuduğunu Anlama ve Metin Çözümleme",
      satirlar: handoutSlice.map((ln, idx) => ({
        sira: idx + 1,
        konusmaci: `Paragraf ${idx + 1}`,
        konusmaci_ar: `${idx + 1}`,
        cinsiyet: "E",
        arapca: ln.arapca,
        turkce: ln.turkce,
      })),
    };
    const sCands = poolSentences
      .slice(0, 80)
      .map((ln, idx) =>
        createSentenceBlankFromLine(
          `mp_s_${idx}`,
          ln.arapca,
          ln.turkce,
          ln.level
        )
      )
      .filter((x): x is SentenceBlankCandidate => Boolean(x));

    return {
      sourceId,
      levelFilter,
      packId: STUDIO_POOL_PACK_ID,
      dialogue: syntheticDlg,
      vocabEntries: vEntries,
      imagePath: safePool[0]?.gorsel || getReadingTextCoverUrl("metin_01"),
      rawNum: 1,
      readingQuestions: safePool.flatMap((m) => m.sorular || []).slice(0, 8),
      sourceCodeBracket: "[metin_havuz]",
      sourceTitleTr: "Okuma Metinleri Karma Seçkisi",
      sourceTitleAr: "نُصُوصُ الْقِرَاءَةِ",
      sourceLevelLabel: lvlText,
      topicSummary: buildTopicSummaryFromGrammarNote(
        undefined,
        syntheticDlg.baslik_tr,
        syntheticDlg.baslik_ar,
        vEntries
      ),
      vocabCandidates: vEntries.map((v) => ({
        id: `mp_v_${v.item.id}`,
        arabic: (v.item.mufret || v.item.mazi || "").split(/[،,/]/)[0].trim(),
        turkish: conciseMeaningTr(v.item.anlam_tr),
        level: targetLvl,
      })),
      sentenceCandidates: sCands,
      morphologyCandidates: vEntries
        .map((v) => extractMorphologyFromDictItem(v.item, targetLvl))
        .filter((x): x is MorphologyCandidate => Boolean(x)),
    };
  }

  // 3. Görsel Kelimeler (998)
  if (sourceId === "gorsel_kelimeler") {
    const byLevel = gorselKelimeler.filter(
      (g) => levelFilter === "all" || g.cefr === levelFilter
    );
    const catFilter = packId.startsWith("gk_cat::")
      ? packId.slice("gk_cat::".length)
      : null;
    const filtered = catFilter
      ? byLevel.filter(
          (g) =>
            (g.kategori_tr || "").replace(/\s*\(\d+\)\s*$/, "").trim() ===
            catFilter
        )
      : byLevel;
    const safeItems = filtered.length > 0 ? filtered : gorselKelimeler;
    const handoutSlice = safeItems.slice(0, 24);
    const titleTr = catFilter
      ? `Görsel Kelimeler: ${catFilter}`
      : `Görsel Kelimeler Seçkisi (${safeItems.length} Kelime)`;
    const titleAr = "الْمُفْرَدَاتُ الْمُصَوَّرَةُ وَالْأَمْثِلَةُ";

    const vEntries: DialogueVocabularyEntry[] = handoutSlice.map((gk, idx) => ({
      item: {
        id: gk.id,
        kok: gk.kok || "-",
        tur: gk.tur || "isim",
        mufret: gk.arapca,
        cemi:
          gk.tur !== "fiil" && gk.ikincil_form && gk.ikincil_form !== "-"
            ? gk.ikincil_form
            : undefined,
        mazi: gk.tur === "fiil" ? gk.arapca : undefined,
        muzari:
          gk.tur === "fiil" && gk.ikincil_form && gk.ikincil_form !== "-"
            ? gk.ikincil_form
            : undefined,
        masdar:
          gk.ucuncul_form && gk.ucuncul_form !== "-"
            ? gk.ucuncul_form
            : undefined,
        anlam_tr: gk.turkce,
        gorsel: gk.gorsel || getVisualWordCoverUrl(gk),
        cefr: gk.cefr,
      },
      contextWord: gk.arapca,
      contextSentence: gk.ornek_ar || gk.arapca,
      contextTranslation: gk.ornek_tr || gk.turkce,
      morphologyNote: gk.kategori_tr || "Görsel Kelime",
      lineNumber: idx + 1,
    }));

    const syntheticDlg: Dialogue = {
      id: "kutuphane_gorsel_kelimeler",
      seviye: targetLvl,
      baslik_tr: titleTr,
      baslik_ar: titleAr,
      odak_gramer: catFilter || "Görsel Sözlük ve Bağlamsal Cümleler",
      satirlar: handoutSlice.map((gk, idx) => ({
        sira: idx + 1,
        konusmaci: (gk.kategori_tr || "Kelime").replace(/\s*\(\d+\)\s*$/, ""),
        konusmaci_ar: gk.tur === "fiil" ? "فِعْل" : "اِسْم",
        cinsiyet: "E",
        arapca: gk.ornek_ar ? `${gk.arapca} — ${gk.ornek_ar}` : gk.arapca,
        turkce: gk.ornek_tr ? `${gk.turkce} (${gk.ornek_tr})` : gk.turkce,
      })),
    };

    const vCands: VocabPairCandidate[] = safeItems.slice(0, 120).map((gk) => ({
      id: `gkv_${gk.id}`,
      arabic: gk.arapca,
      turkish: conciseMeaningTr(gk.turkce),
      level: gk.cefr || "A1",
    }));

    const sCands: SentenceBlankCandidate[] = safeItems
      .slice(0, 120)
      .map((gk) =>
        gk.ornek_ar
          ? createSentenceBlankFromLine(
              `gks_${gk.id}`,
              gk.ornek_ar,
              gk.ornek_tr || gk.turkce,
              gk.cefr || "A1",
              [gk.arapca]
            )
          : null
      )
      .filter((x): x is SentenceBlankCandidate => Boolean(x));

    const mCands: MorphologyCandidate[] = safeItems
      .slice(0, 150)
      .map((gk): MorphologyCandidate | null => {
        const kokSpaced = formatSpacedRoot(gk.kok);
        const f1 = (gk.arapca || "").split(/[،,/]/)[0]?.trim() || "";
        const f2 = (gk.ikincil_form || "").split(/[،,/]/)[0]?.trim() || "";
        if (!kokSpaced || !f1 || f1 === "-" || !f2 || f2 === "-") return null;
        const isVerb = gk.tur === "fiil";
        return {
          id: `gkm_${gk.id}`,
          wordKind: isVerb ? "fiil" : "isim",
          turkce: conciseMeaningTr(gk.turkce, 48),
          kokSpaced,
          form1Label: isVerb ? "Mâzî" : "Müfret",
          form1Ar: f1,
          form2Label: isVerb ? "Muzâri" : "Cemî",
          form2Ar: f2,
          level: gk.cefr || "A1",
        };
      })
      .filter((x): x is MorphologyCandidate => Boolean(x));

    return {
      sourceId,
      levelFilter,
      packId,
      dialogue: syntheticDlg,
      vocabEntries: vEntries,
      imagePath:
        handoutSlice[0]?.gorsel ||
        (handoutSlice[0] ? getVisualWordCoverUrl(handoutSlice[0]) : "/gorseller/diyaloglar/001.webp"),
      rawNum: 1,
      readingQuestions: [],
      sourceCodeBracket: catFilter ? "[gorsel_kategori]" : "[gorsel_998]",
      sourceTitleTr: titleTr,
      sourceTitleAr: titleAr,
      sourceLevelLabel: lvlText,
      topicSummary: {
        titleTr,
        titleAr,
        ruleSummaryTr:
          "Görsel kelime kartları; her kelimenin üçlü kökünü (جذر), isimlerde müfret–cemî (tekil–çoğul), fiillerde mâzî–muzâri–masdar çekimlerini ve günlük örnek cümle kullanımını birlikte öğretir.",
        rows: [
          {
            headingTr: "Tematik Odak",
            detailTr: catFilter || "Tüm Görsel Sözlük Kategorileri",
            exampleAr: handoutSlice[0]?.ornek_ar,
            exampleTr: handoutSlice[0]?.ornek_tr,
          },
          {
            headingTr: "Sarf ve Kelime Bilgisi",
            detailTr: `${safeItems.length} resimli kelime üzerinden anlam, imla ve müfret–cemî / mâzî–muzâri eşleştirmesi.`,
          },
        ],
      },
      vocabCandidates: vCands,
      sentenceCandidates: sCands,
      morphologyCandidates: mCands,
    };
  }

  // 4. 1111 Günlük Cümle
  if (sourceId === "cumleler_1111") {
    const byLevel = cumleler1111.filter(
      (c) => levelFilter === "all" || (c.cefr || c.seviye) === levelFilter
    );
    const temaFilter = packId.startsWith("cml_tema::")
      ? packId.slice("cml_tema::".length)
      : null;
    const filtered = temaFilter
      ? byLevel.filter((c) => (c.tema || "").trim() === temaFilter)
      : byLevel;
    const safeItems = filtered.length > 0 ? filtered : cumleler1111;
    const handoutSlice = safeItems.slice(0, 24);
    const titleTr = temaFilter
      ? `1111 Günlük Cümle: ${temaFilter}`
      : `1111 Günlük Cümle Seçkisi (${safeItems.length} Cümle)`;
    const titleAr = "الْجُمَلُ الْيَوْمِيَّةُ وَالتَّعْبِيرَاتُ التَّطْبِيقِيَّةُ";

    const extracted = extractDialogueVocabulary(
      handoutSlice.map((s) => s.arapca)
    ).slice(0, 24);
    const vEntries: DialogueVocabularyEntry[] =
      extracted.length >= 6
        ? extracted.map((it, idx) => ({
            item: it,
            contextWord: it.mufret || it.mazi || "",
            contextSentence:
              handoutSlice[idx % handoutSlice.length]?.arapca || "",
            contextTranslation:
              handoutSlice[idx % handoutSlice.length]?.turkce || "",
            morphologyNote: it.tur || "isim",
            lineNumber: idx + 1,
          }))
        : handoutSlice.map((s, idx) => ({
            item: {
              id: s.id,
              kok: "-",
              tur: "isim",
              mufret: s.arapca,
              anlam_tr: s.turkce,
            },
            contextWord: s.arapca,
            contextSentence: s.arapca,
            contextTranslation: s.turkce,
            morphologyNote: s.odak_kalip || "Kalıp Cümle",
            lineNumber: idx + 1,
          }));

    const syntheticDlg: Dialogue = {
      id: "kutuphane_cumleler",
      seviye: targetLvl,
      baslik_tr: titleTr,
      baslik_ar: titleAr,
      odak_gramer:
        temaFilter || handoutSlice[0]?.odak_kalip || "Günlük İletişim Kalıpları",
      satirlar: handoutSlice.map((c, idx) => ({
        sira: idx + 1,
        konusmaci: c.tema || `Cümle ${idx + 1}`,
        konusmaci_ar: c.odak_kalip ? "قَالَب" : `${idx + 1}`,
        cinsiyet: "E",
        arapca: c.arapca,
        turkce: c.turkce,
      })),
    };

    const vCands: VocabPairCandidate[] = safeItems.slice(0, 100).map((c) => ({
      id: `cmv_${c.id}`,
      arabic: c.arapca,
      turkish: conciseMeaningTr(c.turkce, 76),
      level: c.seviye || "A1",
    }));

    const sCands = safeItems
      .slice(0, 100)
      .map((c) =>
        createSentenceBlankFromLine(
          `cms_${c.id}`,
          c.arapca,
          c.turkce,
          c.seviye || "A1"
        )
      )
      .filter((x): x is SentenceBlankCandidate => Boolean(x));

    const uniqueKalipList = Array.from(
      new Set(handoutSlice.map((c) => c.odak_kalip).filter(Boolean))
    ).slice(0, 4);

    return {
      sourceId,
      levelFilter,
      packId,
      dialogue: syntheticDlg,
      vocabEntries: vEntries,
      imagePath: getDialogueCoverUrl("dlg_001"),
      rawNum: 1,
      readingQuestions: [],
      sourceCodeBracket: temaFilter ? "[cumle_tema]" : "[cumle_1111]",
      sourceTitleTr: titleTr,
      sourceTitleAr: titleAr,
      sourceLevelLabel: lvlText,
      topicSummary: {
        titleTr,
        titleAr,
        ruleSummaryTr:
          "Günlük konuşma kalıpları; soru edatları, zaman zarfları, nezaket ifadeleri ve fiil–harf-i cer uyumu üzerinden doğrudan konuşma ve çeviri refleksi kazandırır.",
        rows: [
          {
            headingTr: "Seçili İletişim Teması",
            detailTr: temaFilter || "Tüm Günlük İletişim Temaları",
            exampleAr: handoutSlice[0]?.arapca,
            exampleTr: handoutSlice[0]?.turkce,
          },
          {
            headingTr: "Öne Çıkan Kalıp Yapılar",
            detailTr:
              uniqueKalipList.length > 0
                ? uniqueKalipList.join(" • ")
                : "Temel İsim ve Fiil Cümlesi Kalıpları",
          },
        ],
      },
      vocabCandidates: vCands,
      sentenceCandidates: sCands,
      morphologyCandidates: extracted
        .map((it) => extractMorphologyFromDictItem(it, targetLvl))
        .filter((x): x is MorphologyCandidate => Boolean(x)),
    };
  }

  // 5. Atasözleri (508)
  if (sourceId === "atasozleri") {
    const byLevel = atasozleri.filter(
      (a) => levelFilter === "all" || a.cefr === levelFilter
    );
    const temaFilter = packId.startsWith("ata_tema::")
      ? packId.slice("ata_tema::".length)
      : null;
    const filtered = temaFilter
      ? byLevel.filter((a) => (a.tema || "").trim() === temaFilter)
      : byLevel;
    const safeItems = filtered.length > 0 ? filtered : atasozleri;
    const handoutSlice = safeItems.slice(0, 22);
    const titleTr = temaFilter
      ? `Atasözleri: ${temaFilter}`
      : `Atasözleri ve Hikmetli Sözler (${safeItems.length} Kayıt)`;
    const titleAr = "الْأَمْثَالُ وَالْحِكَمُ الْعَرَبِيَّةُ";

    const extracted = extractDialogueVocabulary(
      handoutSlice.map((a) => a.arapca)
    ).slice(0, 22);

    const vEntries: DialogueVocabularyEntry[] = handoutSlice.map((a, idx) => ({
      item: {
        id: a.id,
        kok: "-",
        tur: "isim",
        mufret: a.arapca,
        anlam_tr: a.turkce,
        gorsel: a.gorsel || getProverbCoverUrl(a.id),
      },
      contextWord: a.arapca,
      contextSentence: a.arapca,
      contextTranslation: a.turkce,
      morphologyNote: a.tema || "Atasözü",
      lineNumber: idx + 1,
    }));

    const syntheticDlg: Dialogue = {
      id: "kutuphane_atasozleri",
      seviye: levelFilter === "all" ? "B1" : levelFilter,
      baslik_tr: titleTr,
      baslik_ar: titleAr,
      odak_gramer: temaFilter || "Edebî Hikmetler, Lafzî ve Mecazî Anlam",
      satirlar: handoutSlice.map((a, idx) => ({
        sira: idx + 1,
        konusmaci: a.tema || `Atasözü ${idx + 1}`,
        konusmaci_ar: "مَثَل",
        cinsiyet: "E",
        arapca: a.arapca,
        turkce: a.lafzi_ceviri
          ? `${a.turkce} (Lafzî: ${a.lafzi_ceviri})`
          : a.turkce,
      })),
    };

    const vCands: VocabPairCandidate[] = safeItems.slice(0, 100).map((a) => ({
      id: `atv_${a.id}`,
      arabic: a.arapca,
      turkish: conciseMeaningTr(a.turkce, 76),
      level: a.cefr || "B1",
    }));

    const sCands = safeItems
      .slice(0, 100)
      .map((a) =>
        createSentenceBlankFromLine(
          `ats_${a.id}`,
          a.arapca,
          a.turkce,
          a.cefr || "B1"
        )
      )
      .filter((x): x is SentenceBlankCandidate => Boolean(x));

    return {
      sourceId,
      levelFilter,
      packId,
      dialogue: syntheticDlg,
      vocabEntries: vEntries,
      imagePath:
        handoutSlice[0]?.gorsel ||
        getProverbCoverUrl(handoutSlice[0]?.id || "ata_001"),
      rawNum: 1,
      readingQuestions: [],
      sourceCodeBracket: temaFilter ? "[atasozu_tema]" : "[atasozu_508]",
      sourceTitleTr: titleTr,
      sourceTitleAr: titleAr,
      sourceLevelLabel: lvlText,
      topicSummary: {
        titleTr,
        titleAr,
        ruleSummaryTr:
          "Arapça atasözleri (الأمثال والحكم); veciz belâgat yapılarını, şart–cevap üsluplarını ve lafzî (kelimesi kelimesine) anlamdan mecazî hikmete geçişi öğretir.",
        rows: [
          {
            headingTr: "Tema ve Belâgat Odağı",
            detailTr: temaFilter || "Klasik ve Çağdaş Arap Atasözleri Seçkisi",
            exampleAr: handoutSlice[0]?.arapca,
            exampleTr: handoutSlice[0]?.turkce,
          },
          {
            headingTr: "Çözümleme Yöntemi",
            detailTr:
              "Önce anahtar kelimenin kök ve lafzî karşılığını belirleyin, ardından bağlamsal Türkçe karşılığıyla eşleştirin.",
          },
        ],
      },
      vocabCandidates: vCands,
      sentenceCandidates: sCands,
      morphologyCandidates: extracted
        .map((it) =>
          extractMorphologyFromDictItem(
            it,
            levelFilter === "all" ? "B1" : levelFilter
          )
        )
        .filter((x): x is MorphologyCandidate => Boolean(x)),
    };
  }

  // 6. Eş & Zıt Anlamlılar (400)
  const byLevel = esZitAnlamlilar.filter(
    (e) => levelFilter === "all" || e.cefr === levelFilter
  );
  const turFilter = packId.startsWith("esz_tur::")
    ? (packId.slice("esz_tur::".length) as SynonymAntonymWordTur)
    : null;
  const filtered = turFilter
    ? byLevel.filter((e) => e.tur === turFilter)
    : byLevel;
  const safeItems = filtered.length > 0 ? filtered : esZitAnlamlilar;
  const handoutSlice = safeItems.slice(0, 24);
  const turDisplayMap: Record<SynonymAntonymWordTur, string> = {
    isim: "İsimler",
    fiil: "Fiiller",
    sifat: "Sıfatlar",
    zarf: "Zarflar",
  };
  const titleTr = turFilter
    ? `Eş & Zıt Anlamlılar: ${turDisplayMap[turFilter]}`
    : `Eş & Zıt Anlamlılar Sözlüğü (${safeItems.length} Madde)`;
  const titleAr = "الْمُرَادِفَاتُ وَالْأَضْدَادُ وَالْفُرُوقُ اللُّغَوِيَّةُ";

  const vEntries: DialogueVocabularyEntry[] = handoutSlice.map((ez, idx) => {
    const synStr = ez.es_anlamlilar[0]?.ar
      ? `= ${ez.es_anlamlilar[0].ar}`
      : "";
    const antStr = ez.zit_anlamlilar[0]?.ar
      ? `≠ ${ez.zit_anlamlilar[0].ar}`
      : "";
    return {
      item: {
        id: ez.id,
        kok: [synStr, antStr].filter(Boolean).join(" "),
        tur: ez.tur,
        mufret: ez.kelime_ar,
        anlam_tr: ez.anlam_tr,
        cefr: ez.cefr,
      },
      contextWord: ez.kelime_ar,
      contextSentence: ez.ornek_cumle_ar || ez.kelime_ar,
      contextTranslation: ez.ornek_cumle_tr || ez.anlam_tr,
      morphologyNote: [synStr, antStr].filter(Boolean).join(" • ") || ez.tur,
      lineNumber: idx + 1,
    };
  });

  const syntheticDlg: Dialogue = {
    id: "kutuphane_es_zit",
    seviye: targetLvl,
    baslik_tr: titleTr,
    baslik_ar: titleAr,
    odak_gramer: "المرادفات والأضداد (Eş ve Zıt Anlam İlişkileri)",
    satirlar: handoutSlice.map((ez, idx) => {
      const synPart =
        ez.es_anlamlilar.length > 0
          ? ` [مرادف: ${ez.es_anlamlilar.map((s) => s.ar).join(" ، ")}]`
          : "";
      const antPart =
        ez.zit_anlamlilar.length > 0
          ? ` [ضد: ${ez.zit_anlamlilar.map((a) => a.ar).join(" ، ")}]`
          : "";
      return {
        sira: idx + 1,
        konusmaci: `${ez.anlam_tr} (${ez.cefr})`,
        konusmaci_ar: ez.kelime_ar,
        cinsiyet: "E",
        arapca: `${ez.kelime_ar}${synPart}${antPart} — ${ez.ornek_cumle_ar}`,
        turkce: `${ez.anlam_tr} — ${ez.ornek_cumle_tr}`,
      };
    }),
  };

  const vCands: VocabPairCandidate[] = [];
  for (const ez of safeItems.slice(0, 120)) {
    const synHint = ez.es_anlamlilar[0]
      ? ` (Eş: ${ez.es_anlamlilar[0].tr})`
      : "";
    vCands.push({
      id: `ezv_${ez.id}`,
      arabic: ez.kelime_ar,
      turkish: conciseMeaningTr(`${ez.anlam_tr}${synHint}`, 64),
      level: ez.cefr,
    });
  }

  const sCands = safeItems
    .slice(0, 120)
    .map((ez) =>
      createSentenceBlankFromLine(
        `ezs_${ez.id}`,
        ez.ornek_cumle_ar,
        ez.ornek_cumle_tr,
        ez.cefr,
        [ez.kelime_ar]
      )
    )
    .filter((x): x is SentenceBlankCandidate => Boolean(x));

  const extractedFromExamples = extractDialogueVocabulary(
    handoutSlice.map((e) => e.ornek_cumle_ar)
  );

  return {
    sourceId,
    levelFilter,
    packId,
    dialogue: syntheticDlg,
    vocabEntries: vEntries,
    imagePath: getDialogueCoverUrl("dlg_001"),
    rawNum: 1,
    readingQuestions: [],
    sourceCodeBracket: turFilter ? `[es_zit_${turFilter}]` : "[es_zit_400]",
    sourceTitleTr: titleTr,
    sourceTitleAr: titleAr,
    sourceLevelLabel: lvlText,
    topicSummary: {
      titleTr,
      titleAr,
      ruleSummaryTr:
        "Eş ve zıt anlamlı kelimeler (المرادفات والأضداد); yakın anlamlı kelimeler arasındaki ince bağlamsal farkları (الفروق اللغوية) ve karşıt kavram çiftlerini cümle içinde pekiştirir.",
      rows: [
        {
          headingTr: "Sözcük Türü ve Kur Kapsamı",
          detailTr: `${turFilter ? turDisplayMap[turFilter] : "İsim, Fiil, Sıfat ve Zarflar"} • ${lvlText}`,
          exampleAr: handoutSlice[0]?.ornek_cumle_ar,
          exampleTr: handoutSlice[0]?.ornek_cumle_tr,
        },
        {
          headingTr: "Örnek Eş / Zıt Çifti",
          detailTr: handoutSlice[0]
            ? `${handoutSlice[0].kelime_ar} (${handoutSlice[0].anlam_tr}) → Eş: ${
                handoutSlice[0].es_anlamlilar[0]?.ar || "-"
              } | Zıt: ${handoutSlice[0].zit_anlamlilar[0]?.ar || "-"}`
            : "Eş ve zıt anlam eşleştirmesi",
        },
      ],
    },
    vocabCandidates: vCands,
    sentenceCandidates: sCands,
    morphologyCandidates: extractedFromExamples
      .map((it) => extractMorphologyFromDictItem(it, targetLvl))
      .filter((x): x is MorphologyCandidate => Boolean(x)),
  };
}

function topUpVocabPool(
  primary: VocabPairCandidate[],
  targetLevel: StudioLevelFilter,
  needed: number,
  rng: () => number
): VocabPairCandidate[] {
  const seenAr = new Set<string>();
  const result: VocabPairCandidate[] = [];

  for (const item of primary) {
    const k = cleanArabicText(item.arabic);
    if (!k || seenAr.has(k)) continue;
    seenAr.add(k);
    result.push(item);
  }

  if (result.length >= needed) return result;

  const sameLevelGlobals = seededShuffle(
    GLOBAL_VOCAB_POOL.filter(
      (g) => targetLevel === "all" || g.level === targetLevel
    ),
    rng
  );
  for (const g of sameLevelGlobals) {
    if (result.length >= needed) break;
    const k = cleanArabicText(g.arabic);
    if (!k || seenAr.has(k)) continue;
    seenAr.add(k);
    result.push(g);
  }

  if (result.length < needed) {
    for (const g of GLOBAL_VOCAB_POOL) {
      if (result.length >= needed) break;
      const k = cleanArabicText(g.arabic);
      if (!k || seenAr.has(k)) continue;
      seenAr.add(k);
      result.push(g);
    }
  }

  return result;
}

function topUpSentencePool(
  primary: SentenceBlankCandidate[],
  targetLevel: StudioLevelFilter,
  needed: number,
  rng: () => number
): SentenceBlankCandidate[] {
  const seen = new Set<string>();
  const result: SentenceBlankCandidate[] = [];

  for (const s of primary) {
    const k = cleanArabicText(s.fullArabic);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    result.push(s);
  }

  if (result.length >= needed) return result;

  const levelPool = seededShuffle(
    GLOBAL_SENTENCE_POOL.filter(
      (s) => targetLevel === "all" || s.level === targetLevel
    ),
    rng
  );
  for (const s of levelPool) {
    if (result.length >= needed) break;
    const k = cleanArabicText(s.fullArabic);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    result.push(s);
  }

  if (result.length < needed) {
    for (const s of GLOBAL_SENTENCE_POOL) {
      if (result.length >= needed) break;
      const k = cleanArabicText(s.fullArabic);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      result.push(s);
    }
  }

  return result;
}

function topUpMorphologyPool(
  primary: MorphologyCandidate[],
  targetLevel: StudioLevelFilter,
  needed: number,
  rng: () => number
): MorphologyCandidate[] {
  const seen = new Set<string>();
  const result: MorphologyCandidate[] = [];

  for (const m of primary) {
    const k = `${m.wordKind}_${cleanArabicText(m.form1Ar)}`;
    if (!k || seen.has(k)) continue;
    seen.add(k);
    result.push(m);
  }

  if (result.length >= needed) return result;

  const levelPool = seededShuffle(
    GLOBAL_MORPHOLOGY_POOL.filter(
      (m) => targetLevel === "all" || m.level === targetLevel
    ),
    rng
  );
  for (const m of levelPool) {
    if (result.length >= needed) break;
    const k = `${m.wordKind}_${cleanArabicText(m.form1Ar)}`;
    if (!k || seen.has(k)) continue;
    seen.add(k);
    result.push(m);
  }

  if (result.length < needed) {
    for (const m of GLOBAL_MORPHOLOGY_POOL) {
      if (result.length >= needed) break;
      const k = `${m.wordKind}_${cleanArabicText(m.form1Ar)}`;
      if (!k || seen.has(k)) continue;
      seen.add(k);
      result.push(m);
    }
  }

  return result;
}

export function clampExamCounts(counts: SixSectionExamCounts): SixSectionExamCounts {
  const clamp = (val: number, max: number) =>
    Math.max(0, Math.min(max, Math.floor(Number.isFinite(val) ? val : 0)));
  return {
    sec1ArToTr: clamp(counts.sec1ArToTr, 50),
    sec2TrToAr: clamp(counts.sec2TrToAr, 50),
    sec3FillBlank: clamp(counts.sec3FillBlank, 50),
    sec4MultipleChoice: clamp(counts.sec4MultipleChoice, 50),
    sec5Matching: clamp(counts.sec5Matching, 30),
    sec6Morphology: clamp(counts.sec6Morphology, 30),
  };
}

/**
 * 6 Özelleştirilebilir Bölümlü (ve A/B Kitapçık Tohumlu) A4 Yazılı Sınav ve Cevap Anahtarı Üreticisi
 */
export function buildSixSectionExamData(params: {
  bundle: StudioMaterialBundle;
  counts: SixSectionExamCounts;
  bookletGroup: "A" | "B";
}): SixSectionExamData {
  const { bundle, bookletGroup } = params;
  const safeCounts = clampExamCounts(params.counts);

  const seedStr = `${bundle.sourceId}::${bundle.packId}::${bundle.levelFilter}::BOOKLET_${bookletGroup}::v6`;
  const seedVal = hashStringSeed(seedStr);
  const rng = mulberry32(seedVal);
  const formCode = `${bookletGroup}-${seedVal
    .toString(16)
    .toUpperCase()
    .padStart(4, "0")
    .slice(-4)}`;

  const totalVocabNeeded = Math.max(
    24,
    safeCounts.sec1ArToTr +
      safeCounts.sec2TrToAr +
      safeCounts.sec4MultipleChoice +
      safeCounts.sec5Matching +
      16
  );

  const fullVocabPool = topUpVocabPool(
    seededShuffle(bundle.vocabCandidates, rng),
    bundle.levelFilter,
    totalVocabNeeded,
    rng
  );

  const pickSliceWithOffset = <T,>(
    pool: readonly T[],
    count: number,
    offset: number
  ): T[] => {
    if (count <= 0 || pool.length === 0) return [];
    const out: T[] = [];
    for (let i = 0; i < count; i++) {
      out.push(pool[(offset + i) % pool.length]);
    }
    return seededShuffle(out, rng);
  };

  let cursor = 0;
  const rawSec1 = pickSliceWithOffset(
    fullVocabPool,
    safeCounts.sec1ArToTr,
    cursor
  );
  cursor += safeCounts.sec1ArToTr;

  const rawSec2 = pickSliceWithOffset(
    fullVocabPool,
    safeCounts.sec2TrToAr,
    cursor
  );
  cursor += safeCounts.sec2TrToAr;

  const rawSec4 = pickSliceWithOffset(
    fullVocabPool,
    safeCounts.sec4MultipleChoice,
    cursor
  );
  cursor += safeCounts.sec4MultipleChoice;

  const rawSec5 = pickSliceWithOffset(
    fullVocabPool,
    safeCounts.sec5Matching,
    cursor
  );

  const fullSentencePool =
    safeCounts.sec3FillBlank > 0
      ? topUpSentencePool(
          seededShuffle(bundle.sentenceCandidates, rng),
          bundle.levelFilter,
          safeCounts.sec3FillBlank,
          rng
        )
      : [];
  const rawSec3 = seededShuffle(
    fullSentencePool.slice(0, safeCounts.sec3FillBlank),
    rng
  );

  const fullMorphPool =
    safeCounts.sec6Morphology > 0
      ? topUpMorphologyPool(
          seededShuffle(bundle.morphologyCandidates, rng),
          bundle.levelFilter,
          safeCounts.sec6Morphology,
          rng
        )
      : [];
  const rawSec6 = seededShuffle(
    fullMorphPool.slice(0, safeCounts.sec6Morphology),
    rng
  );

  const pointsAllocation = allocateExam100PointsSixSections([
    rawSec1.length,
    rawSec2.length,
    rawSec3.length,
    rawSec4.length,
    rawSec5.length,
    rawSec6.length,
  ]);

  // 1. Bölüm: Arapça -> Türkçe Anlam Yazma
  const sec1ArToTr: ExamSec1Item[] = rawSec1.map((item, idx) => ({
    num: idx + 1,
    points: pointsAllocation.perQuestion[0][idx] ?? 0,
    arabic: item.arabic,
    correctTurkish: item.turkish,
  }));

  // 2. Bölüm: Türkçe -> Arapça Yazma
  const sec2TrToAr: ExamSec2Item[] = rawSec2.map((item, idx) => ({
    num: idx + 1,
    points: pointsAllocation.perQuestion[1][idx] ?? 0,
    turkish: item.turkish,
    correctArabic: item.arabic,
  }));

  // 3. Bölüm: Boşluk Doldurma
  const sec3FillBlank: ExamSec3Item[] = rawSec3.map((s, idx) => ({
    num: idx + 1,
    points: pointsAllocation.perQuestion[2][idx] ?? 0,
    turkishMeaning: s.turkish,
    blankSentenceAr: s.blankArabic,
    fullSentenceAr: s.fullArabic,
    targetWordAr: s.targetWordAr,
  }));
  const sec3WordBank = seededShuffle(
    sec3FillBlank.map((s) => s.targetWordAr),
    rng
  );

  // 4. Bölüm: Çoktan Seçmeli (4 Şıklı 2x2)
  const distractorTrPool = Array.from(
    new Set(fullVocabPool.map((v) => v.turkish).filter(Boolean))
  );
  const optLetters: ["A", "B", "C", "D"] = ["A", "B", "C", "D"];

  const sec4MultipleChoice: ExamSec4Item[] = rawSec4.map((item, idx) => {
    const wrongCandidates = seededShuffle(
      distractorTrPool.filter(
        (tr) => tr.toLowerCase() !== item.turkish.toLowerCase()
      ),
      rng
    );
    const fallbackFallbacks = [
      "Yarın sabah erkenden görüşürüz",
      "Kütüphanede sessizce ders çalışmak",
      "Havaalanında uçuş kartını kontrol etmek",
      "Misafirlere sıcak çay ikram etmek",
    ];
    const distractors: string[] = [];
    for (const w of [...wrongCandidates, ...fallbackFallbacks]) {
      if (distractors.length >= 3) break;
      if (
        w.toLowerCase() !== item.turkish.toLowerCase() &&
        !distractors.some((d) => d.toLowerCase() === w.toLowerCase())
      ) {
        distractors.push(w);
      }
    }

    const shuffledFour = seededShuffle(
      [item.turkish, distractors[0], distractors[1], distractors[2]],
      rng
    );
    const correctIdx = Math.max(0, shuffledFour.indexOf(item.turkish));
    const options = optLetters.map((letter, oIdx) => ({
      letter,
      textTr: shuffledFour[oIdx] || item.turkish,
    })) as [ExamSec4Option, ExamSec4Option, ExamSec4Option, ExamSec4Option];

    return {
      num: idx + 1,
      points: pointsAllocation.perQuestion[3][idx] ?? 0,
      arabicPrompt: item.arabic,
      questionStemTr:
        "ifadesinin doğru Türkçe karşılığı aşağıdakilerden hangisidir?",
      options,
      correctLetter: optLetters[correctIdx],
      correctTurkish: item.turkish,
    };
  });

  // 5. Bölüm: Eşleştirme Alıştırması (Sol: Harfli Arapça İfade, Orta: [  ], Sağ: Numaralı Karışık Türkçe Karşılığı)
  let rightPerm = seededShuffle(
    rawSec5.map((_, idx) => idx),
    rng
  );
  if (
    rightPerm.length >= 2 &&
    rightPerm.every((mappedIdx, idx) => mappedIdx === idx)
  ) {
    rightPerm = [...rightPerm.slice(1), rightPerm[0]];
  }

  const sec5Matching: ExamSec5MatchingRow[] = rawSec5.map((leftItem, idx) => {
    const sourceIdxForRight = rightPerm[idx] ?? idx;
    const matchedLeftItem = rawSec5[sourceIdxForRight] || leftItem;
    const rightCorrectLetter = indexToAlphaCode(sourceIdxForRight);
    return {
      rowIndex: idx,
      points: pointsAllocation.perQuestion[4][idx] ?? 0,
      leftLetter: indexToAlphaCode(idx),
      leftArabic: leftItem.arabic,
      leftCorrectTr: leftItem.turkish,
      rightNumber: idx + 1,
      rightShuffledTr: matchedLeftItem.turkish,
      rightCorrectLetter,
      rightMatchedArabic: matchedLeftItem.arabic,
    };
  });

  // 6. Bölüm: Sarf (Kök & Müfret-Cemî / Fiil) Tablosu
  const sec6Morphology: ExamSec6MorphRow[] = rawSec6.map((m, idx) => ({
    num: idx + 1,
    points: pointsAllocation.perQuestion[5][idx] ?? 0,
    wordKind: m.wordKind,
    turkce: m.turkce,
    kokSpaced: m.kokSpaced,
    form1Label: m.form1Label,
    form1Ar: m.form1Ar,
    form2Label: m.form2Label,
    form2Ar: m.form2Ar,
    givenSlot: idx % 3 === 2 ? "form2" : "form1",
  }));

  return {
    bookletGroup,
    formCode,
    pointsAllocation,
    sec1ArToTr,
    sec2TrToAr,
    sec3FillBlank,
    sec3WordBank,
    sec4MultipleChoice,
    sec5Matching,
    sec6Morphology,
  };
}
