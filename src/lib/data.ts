import diyaloglarJson from "@/data/tum_diyaloglar_120.json";
import diyalogGramerJson from "@/data/diyaloglar_gramer_hap_bilgi.json";
import metinlerJson from "@/data/tum_metinler_60.json";
import metinGramerJson from "@/data/metinler_gramer_hap_bilgi.json";
import ekGramerJson from "@/data/ek_gramer_hap_bilgi.json";
import cumlelerJson from "@/data/1111_cumle.json";
import atasozleriJson from "@/data/atasozleri.json";
import gorselKelimelerJson from "@/data/gorselKelimeler_guncel.json";
import { getCombinedIdiomsCatalog } from "@/lib/arabicIdioms";
import { unifiedDictionary } from "@/lib/dict";
import { formatTurkishCategory } from "@/lib/arabicTextUtils";
import {
  AnahtarCumle,
  AtasozuDeyim,
  Dialogue,
  DictionaryItem,
  GramerHapBilgi,
  Level,
  ReadingText,
  ResimliKelime,
} from "@/types/data";

const LEVEL_UNITE_MAP: Record<Level, string> = {
  A1: "Ünite 1: Temel İletişim",
  A2: "Ünite 2: Günlük Hayat ve Alışveriş",
  B1: "Ünite 3: Sosyal Hayat ve Seyahat",
  B2: "Ünite 4: İleri Düzey Müzakere",
};

const LEVEL_ZORLUK_MAP: Record<Level, 1 | 2 | 3 | 4> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
};

const CEFR_RANK: Record<Level, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
};

function normalizeCanonicalArabicLine(text: string): string {
  return (text || "")
    .replace(/\u0640+/g, "")
    .replace(/([\u064B-\u0650\u0652\u0670])\u0651/g, "\u0651$1");
}

function buildDialogueTags(baslikTr: string, seviye: Level): string[] {
  const cleaned = (baslikTr || "")
    .replace(/[().,/#!$%^&*;:{}=\-_`~]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2 && w !== "ve" && w !== "ile");

  const baseTag =
    seviye === "A1"
      ? "temel-iletisim"
      : seviye === "A2"
      ? "gunluk-hayat"
      : seviye === "B1"
      ? "sosyal-hayat"
      : "ileri-duzey";

  return Array.from(new Set([seviye.toLowerCase(), baseTag, ...cleaned]));
}

export const MEDIA_CDN_PUBLIC_BASE =
  "https://raw.githubusercontent.com/muallimun/arapca_telaffuz_medya/main/public";

export function resolveImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  let cleanPath = path.replace(/^\/+/, "").replace(/^public\//, "");
  // gorselKelimeler_guncel.json icindeki "gorseller/kelimeler/0002_01_arap.webp" yolunu
  // GitHub medya deposundaki gercek dosya adina ("gorseller/kelimeler/gorsel_0002.webp") donustur
  cleanPath = cleanPath.replace(
    /^gorseller\/kelimeler\/(?:gorsel_)?(\d{4})(?:_[^/]*)?\.webp$/i,
    "gorseller/kelimeler/gorsel_$1.webp"
  );
  return `${MEDIA_CDN_PUBLIC_BASE}/${cleanPath}`;
}

export function resolveAudioUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.replace(/^\/+/, "").replace(/^public\//, "");
  return `${MEDIA_CDN_PUBLIC_BASE}/${cleanPath}`;
}

export const diyalogGramerNotlari: GramerHapBilgi[] =
  diyalogGramerJson as GramerHapBilgi[];

export const metinGramerNotlari: GramerHapBilgi[] =
  metinGramerJson as GramerHapBilgi[];

export const ekGramerNotlari: GramerHapBilgi[] =
  ekGramerJson as GramerHapBilgi[];

export const tumGramerHapBilgiler: GramerHapBilgi[] = [
  ...ekGramerNotlari,
  ...diyalogGramerNotlari,
  ...metinGramerNotlari,
];

// 1. 120 Diyalog (tum_diyaloglar_120.json)
export const diyaloglar: Dialogue[] = (diyaloglarJson as Dialogue[]).map(
  (d): Dialogue => {
    const lvl: Level = d.seviye || "A1";
    const num3 = String(
      parseInt((d.id || "").replace(/\D+/g, ""), 10) || 1
    ).padStart(3, "0");
    return {
      ...d,
      tema: d.tema ? formatTurkishCategory(d.tema) : d.tema,
      gorsel: resolveImageUrl(
        d.gorsel || `/gorseller/diyaloglar/dlg_${num3}.webp`
      ),
      cefr: d.cefr || lvl,
      zorluk: d.zorluk || LEVEL_ZORLUK_MAP[lvl] || 1,
      etiketler:
        Array.isArray(d.etiketler) && d.etiketler.length > 0
          ? d.etiketler
          : buildDialogueTags(d.baslik_tr, lvl),
      kaynak_unite: d.kaynak_unite || LEVEL_UNITE_MAP[lvl],
      satirlar: Array.isArray(d.satirlar)
        ? d.satirlar.map((line) => ({
            ...line,
            arapca: normalizeCanonicalArabicLine(line.arapca),
          }))
        : [],
    };
  }
);

// 2. 60 Okuma Metni (tum_metinler_60.json)
export const metinler: ReadingText[] = (metinlerJson as ReadingText[]).map(
  (m, idx): ReadingText => {
    const lvl: Level = m.seviye || "A1";
    const gramerNote = metinGramerNotlari.find((g) => g.bagli_id === m.id);
    const num2 = String(
      parseInt((m.id || "").replace(/\D+/g, ""), 10) || idx + 1
    ).padStart(2, "0");
    return {
      ...m,
      sira: m.sira || idx + 1,
      tema: formatTurkishCategory(m.tema),
      gorsel: resolveImageUrl(
        m.gorsel || `/gorseller/metinler/metin_${num2}.webp`
      ),
      odak_gramer: m.odak_gramer || gramerNote?.konu_basligi,
      cefr: m.cefr || lvl,
      zorluk: m.zorluk || LEVEL_ZORLUK_MAP[lvl] || 1,
      etiketler:
        Array.isArray(m.etiketler) && m.etiketler.length > 0
          ? m.etiketler
          : buildDialogueTags(m.baslik_tr, lvl),
      kaynak_unite: m.kaynak_unite || LEVEL_UNITE_MAP[lvl],
      satirlar: Array.isArray(m.satirlar)
        ? m.satirlar.map((line) => ({
            ...line,
            arapca: normalizeCanonicalArabicLine(line.arapca),
          }))
        : [],
      sorular: Array.isArray(m.sorular) ? m.sorular : [],
    };
  }
);

// 3. 1111 Cümle (1111_cumle.json)
export const cumleler1111: AnahtarCumle[] = (
  cumlelerJson as AnahtarCumle[]
).map((c) => ({
  ...c,
  tema: formatTurkishCategory(c.tema),
  kategori: c.kategori ? formatTurkishCategory(c.kategori) : c.kategori,
  cefr: c.cefr || c.seviye || "A1",
  arapca: normalizeCanonicalArabicLine(c.arapca),
}));

// 4. 508 Atasözü ve Hikmetli Söz (atasozleri.json)
export const atasozleri: AtasozuDeyim[] = (
  atasozleriJson as AtasozuDeyim[]
).map((a) => {
  const num4 = String(
    a.sira || parseInt(a.id.replace(/\D+/g, ""), 10) || 1
  ).padStart(4, "0");
  return {
    ...a,
    tema: formatTurkishCategory(a.tema),
    arapca: normalizeCanonicalArabicLine(a.arapca),
    gorsel: resolveImageUrl(
      a.gorsel || `/gorseller/atasozleri/ata_${num4}.webp`
    ),
    ses_erkek: a.ses_erkek || `/sesler/atasozleri/erkek/ata_${num4}.wav`,
    ses_kadin: a.ses_kadin || `/sesler/atasozleri/kadin/ata_${num4}.wav`,
  };
});

// 5. Görsel Kelimeler (gorselKelimeler_guncel.json)
export const gorselKelimeler: ResimliKelime[] = (
  gorselKelimelerJson as ResimliKelime[]
).map((gk, idx) => {
  const prefix = (gk.id || "").split("_")[0];
  const num4 = String(
    gk.sira || parseInt(prefix.replace(/\D+/g, ""), 10) || idx + 1
  ).padStart(4, "0");
  return {
    ...gk,
    kategori_tr: formatTurkishCategory(gk.kategori_tr || gk.kategori),
    arapca: normalizeCanonicalArabicLine(gk.arapca),
    ornek_ar: normalizeCanonicalArabicLine(gk.ornek_ar || ""),
    gorsel: resolveImageUrl(
      gk.gorsel || `/gorseller/kelimeler/gorsel_${num4}.webp`
    ),
  };
});

// 6. Birleştirilmiş Kapsamlı Sözlük
export const sozluk: DictionaryItem[] = unifiedDictionary;

// ============================================================================
// STANDART MEDYA YOLU YARDIMCILARI (/gorseller/... ve /sesler/...)
// ============================================================================

export function getDialogueCoverUrl(dialogueId: string): string {
  const num = parseInt((dialogueId || "").replace(/\D+/g, ""), 10) || 1;
  return resolveImageUrl(
    `/gorseller/diyaloglar/dlg_${String(num).padStart(3, "0")}.webp`
  );
}

export function getReadingTextCoverUrl(metinId: string): string {
  const num = parseInt((metinId || "").replace(/\D+/g, ""), 10) || 1;
  return resolveImageUrl(
    `/gorseller/metinler/metin_${String(num).padStart(2, "0")}.webp`
  );
}

export function getProverbCoverUrl(ataId: string): string {
  const num = parseInt((ataId || "").replace(/\D+/g, ""), 10) || 1;
  return resolveImageUrl(
    `/gorseller/atasozleri/ata_${String(num).padStart(4, "0")}.webp`
  );
}

export function getVisualWordCoverUrl(
  itemOrId: ResimliKelime | DictionaryItem | string
): string {
  if (typeof itemOrId !== "string" && itemOrId?.gorsel) {
    return resolveImageUrl(itemOrId.gorsel);
  }
  const rawId = typeof itemOrId === "string" ? itemOrId : itemOrId?.id || "";
  const prefix = rawId.split("_")[0];
  const num = parseInt(prefix.replace(/\D+/g, ""), 10) || 1;
  return resolveImageUrl(
    `/gorseller/kelimeler/gorsel_${String(num).padStart(4, "0")}.webp`
  );
}

// ============================================================================
// SORGULAMA VE SIRALAMA YARDIMCILARI
// ============================================================================

export function getDialoguesSortedPedagogically(): Dialogue[] {
  return [...diyaloglar].sort((a, b) => {
    const rankA = CEFR_RANK[a.seviye] ?? 99;
    const rankB = CEFR_RANK[b.seviye] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const numA = parseInt(a.id.replace(/\D+/g, ""), 10) || 0;
    const numB = parseInt(b.id.replace(/\D+/g, ""), 10) || 0;
    return numA - numB;
  });
}

export function getReadingTextsSortedPedagogically(): ReadingText[] {
  return [...metinler].sort((a, b) => {
    const rankA = CEFR_RANK[a.seviye] ?? 99;
    const rankB = CEFR_RANK[b.seviye] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const numA = parseInt(a.id.replace(/\D+/g, ""), 10) || 0;
    const numB = parseInt(b.id.replace(/\D+/g, ""), 10) || 0;
    return numA - numB;
  });
}

export function getDialogueById(id: string): Dialogue | undefined {
  const exact = diyaloglar.find((d) => d.id === id);
  if (exact) return exact;
  const targetNum = parseInt((id || "").replace(/\D+/g, ""), 10);
  if (!isNaN(targetNum) && targetNum > 0) {
    return diyaloglar.find(
      (d) => parseInt(d.id.replace(/\D+/g, ""), 10) === targetNum
    );
  }
  return undefined;
}

export function getReadingTextById(id: string): ReadingText | undefined {
  const exact = metinler.find((m) => m.id === id);
  if (exact) return exact;
  const targetNum = parseInt((id || "").replace(/\D+/g, ""), 10);
  if (!isNaN(targetNum) && targetNum > 0) {
    return metinler.find(
      (m) => parseInt(m.id.replace(/\D+/g, ""), 10) === targetNum
    );
  }
  return undefined;
}

export function getDialogueGrammarNote(
  dialogueId: string
): GramerHapBilgi | undefined {
  const exact = diyalogGramerNotlari.find((g) => g.bagli_id === dialogueId);
  if (exact) return exact;
  const targetNum = parseInt((dialogueId || "").replace(/\D+/g, ""), 10);
  if (!isNaN(targetNum) && targetNum > 0) {
    return diyalogGramerNotlari.find(
      (g) => parseInt(g.bagli_id.replace(/\D+/g, ""), 10) === targetNum
    );
  }
  return undefined;
}

export function getReadingTextGrammarNote(
  metinId: string
): GramerHapBilgi | undefined {
  const exact = metinGramerNotlari.find((g) => g.bagli_id === metinId);
  if (exact) return exact;
  const targetNum = parseInt((metinId || "").replace(/\D+/g, ""), 10);
  if (!isNaN(targetNum) && targetNum > 0) {
    return metinGramerNotlari.find(
      (g) => parseInt(g.bagli_id.replace(/\D+/g, ""), 10) === targetNum
    );
  }
  return undefined;
}

export function getStandaloneGrammarNote(
  grmId: string
): GramerHapBilgi | undefined {
  const exact = ekGramerNotlari.find((g) => g.bagli_id === grmId);
  if (exact) return exact;
  const targetNum = parseInt((grmId || "").replace(/\D+/g, ""), 10);
  if (!isNaN(targetNum) && targetNum > 0) {
    return ekGramerNotlari.find(
      (g) => parseInt(g.bagli_id.replace(/\D+/g, ""), 10) === targetNum
    );
  }
  return undefined;
}

export function getDialoguesByLevel(level: Level | "all"): Dialogue[] {
  if (level === "all") return diyaloglar;
  return diyaloglar.filter((d) => d.seviye === level);
}

export function getReadingTextsByLevel(level: Level | "all"): ReadingText[] {
  if (level === "all") return metinler;
  return metinler.filter((m) => m.seviye === level);
}

export interface ContentCatalogStats {
  totalDialogues: number;
  totalSentences: number;
  totalReadingTexts: number;
  totalSentences1111: number;
  totalProverbs: number;
  totalVisualWords: number;
  totalDictionaryWords: number;
  totalIdioms: number;
  byLevel: Record<Level, { dialogues: number; sentences: number }>;
}

export interface DynamicContentStats {
  dialogueCount: number;
  dialogueSentenceCount: number;
  readingCount: number;
  readingQuestionCount: number;
  sentenceCount: number;
  sentenceCategoryCount: number;
  sentenceGrammarCount: number;
  proverbCount: number;
  proverbCategoryCount: number;
  visualWordCount: number;
  visualWordCategoryCount: number;
  dictionaryWordCount: number;
  totalLibraryCards: number;
  standaloneGrammarCount: number;
  grammarNoteCount: number;
  totalGrammarAtlasCount: number;
}

export function getMainVisualCategory(rawCatTr?: string): string {
  return (rawCatTr || "").replace(/\s*\(\d+\)\s*$/, "").trim();
}

export function getVisualSubGroupNo(rawCatTr?: string): number | null {
  const match = (rawCatTr || "").match(/\((\d+)\)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

const DYNAMIC_CONTENT_STATS: DynamicContentStats = (() => {
  const dialogueCount = diyaloglar.length;
  const dialogueSentenceCount = diyaloglar.reduce(
    (acc, d) => acc + (Array.isArray(d.satirlar) ? d.satirlar.length : 0),
    0
  );
  const readingCount = metinler.length;
  const readingQuestionCount = metinler.reduce(
    (acc, m) => acc + (Array.isArray(m.sorular) ? m.sorular.length : 0),
    0
  );
  const sentenceCount = cumleler1111.length;
  const sentenceCategoryCount = new Set(
    cumleler1111.map((c) => c.tema).filter(Boolean)
  ).size;
  const sentenceGrammarCount = new Set(
    cumleler1111.map((c) => c.odak_kalip).filter(Boolean)
  ).size;
  const proverbCount = atasozleri.length;
  const proverbCategoryCount = new Set(
    atasozleri.map((a) => a.tema).filter(Boolean)
  ).size;
  const visualWordCount = gorselKelimeler.length;
  const visualWordCategoryCount = new Set(
    gorselKelimeler
      .map((g) =>
        getMainVisualCategory(
          g.kategori_tr ||
            (g as unknown as { kategori?: string }).kategori ||
            ""
        )
      )
      .filter(Boolean)
  ).size;
  const dictionaryWordCount = sozluk.length;
  const totalLibraryCards = sentenceCount + proverbCount + visualWordCount;
  const standaloneGrammarCount = ekGramerNotlari.length;
  const grammarNoteCount =
    ekGramerNotlari.length +
    diyalogGramerNotlari.length +
    metinGramerNotlari.length;
  const totalGrammarAtlasCount = grammarNoteCount + sentenceGrammarCount;

  return {
    dialogueCount,
    dialogueSentenceCount,
    readingCount,
    readingQuestionCount,
    sentenceCount,
    sentenceCategoryCount,
    sentenceGrammarCount,
    proverbCount,
    proverbCategoryCount,
    visualWordCount,
    visualWordCategoryCount,
    dictionaryWordCount,
    totalLibraryCards,
    standaloneGrammarCount,
    grammarNoteCount,
    totalGrammarAtlasCount,
  };
})();

export interface ContentInventory {
  dialoguesCount: number;
  readingsCount: number;
  sentencesCount: number;
  proverbsCount: number;
  visualWordsCount: number;
  grammarNotesCount: number;
  dictionaryWordsCount: number;
  exerciseModulesCount: number;
}

export const CONTENT_INVENTORY: ContentInventory = {
  dialoguesCount: DYNAMIC_CONTENT_STATS.dialogueCount,
  readingsCount: DYNAMIC_CONTENT_STATS.readingCount,
  sentencesCount: DYNAMIC_CONTENT_STATS.sentenceCount,
  proverbsCount: DYNAMIC_CONTENT_STATS.proverbCount,
  visualWordsCount: DYNAMIC_CONTENT_STATS.visualWordCount,
  grammarNotesCount: DYNAMIC_CONTENT_STATS.grammarNoteCount,
  dictionaryWordsCount: DYNAMIC_CONTENT_STATS.dictionaryWordCount,
  exerciseModulesCount: 14,
};

export function getDynamicContentStats(): DynamicContentStats {
  return DYNAMIC_CONTENT_STATS;
}

export function getContentCatalogStats(): ContentCatalogStats {
  const byLevel: Record<Level, { dialogues: number; sentences: number }> = {
    A1: { dialogues: 0, sentences: 0 },
    A2: { dialogues: 0, sentences: 0 },
    B1: { dialogues: 0, sentences: 0 },
    B2: { dialogues: 0, sentences: 0 },
  };

  let totalSentences = 0;

  for (const d of diyaloglar) {
    const lineCount = Array.isArray(d.satirlar) ? d.satirlar.length : 0;
    totalSentences += lineCount;
    if (byLevel[d.seviye]) {
      byLevel[d.seviye].dialogues += 1;
      byLevel[d.seviye].sentences += lineCount;
    }
  }

  return {
    totalDialogues: diyaloglar.length,
    totalSentences,
    totalReadingTexts: metinler.length,
    totalSentences1111: cumleler1111.length,
    totalProverbs: atasozleri.length,
    totalVisualWords: gorselKelimeler.length,
    totalDictionaryWords: sozluk.length,
    totalIdioms: getCombinedIdiomsCatalog().length,
    byLevel,
  };
}