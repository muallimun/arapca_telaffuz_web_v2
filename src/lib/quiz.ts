import {
  DictionaryItem,
  DialogueLine,
  Level,
  ResimliKelime,
  SynonymAntonymEntry,
  SynonymAntonymWordTur,
} from "@/types/data";
import {
  diyaloglar,
  metinler,
  cumleler1111,
  atasozleri,
  gorselKelimeler,
  sozluk,
  esZitAnlamlilar,
  getMainVisualCategory,
} from "@/lib/data";
import {
  getDialogueVocabulary,
  getReadingTextVocabulary,
  isProperNounItem,
} from "@/lib/dict";
import { formatTurkishCategory } from "@/lib/arabicTextUtils";

export type VisualWordItem = ResimliKelime;

export interface SentenceSourceMeta {
  topBadge: string;
  promptQuestionTr: string;
  bottomMeta: string;
  shortTitle: string;
}

/**
 * Türkçe şıklarda parantez içinde geçen Arapça örnek cümleleri
 * (örn. "-e ihtiyacı olmak (بِحَاجَةٍ إِلَى الرَّاحَةِ: dinlenmeye ihtiyacım var.)")
 * cevap verilmeden önce temizleyerek hem kopya ipucunu hem BiDi kaymasını önler.
 */
export function stripParentheticalArabicExamples(trText: string): string {
  if (!trText) return "";
  const stripped = trText
    .replace(/\s*\([^()]*[\u0600-\u06FF][^()]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || trText.trim();
}

/**
 * Cümle kaynağının teknik ID'sini (#pool_1111 vb.) asla kullanıcıya göstermeden
 * kaynağa özel rozet, soru kökü ve alt meta açıklamasını üretir.
 */
export function resolveSentenceSourceMeta(
  dlgId: string,
  dlgTitle?: string,
  speakerOrCategory?: string
): SentenceSourceMeta {
  const id = (dlgId || "").trim();
  const cleanTitle = formatTurkishCategory((dlgTitle || "").trim());
  const cleanSpeaker = formatTurkishCategory((speakerOrCategory || "").trim());

  if (
    id === "pool_1111" ||
    id.startsWith("pool_1111") ||
    id.startsWith("cumle_") ||
    id.startsWith("c_")
  ) {
    const cat = cleanSpeaker || "Günlük Cümle";
    return {
      topBadge: "🗣️ Günlük Kalıp Cümle",
      promptQuestionTr:
        "Aşağıdaki Arapça kalıp cümlenin doğru Türkçe çevirisi hangisidir?",
      bottomMeta: `🗣️ Günlük Kalıp Cümle • ${cat}`,
      shortTitle: `🗣️ Günlük Kalıp Cümle • ${cat}`,
    };
  }

  if (
    id === "pool_proverbs" ||
    id.startsWith("pool_proverbs") ||
    id.startsWith("ata_")
  ) {
    const cat = cleanSpeaker || "Atasözü";
    return {
      topBadge: "📜 Atasözü & Hikmet",
      promptQuestionTr:
        "Aşağıdaki Arapça atasözünün doğru Türkçe karşılığı hangisidir?",
      bottomMeta: `📜 Arapça Atasözü • ${cat}`,
      shortTitle: `📜 Arapça Atasözü • ${cat}`,
    };
  }

  if (id.startsWith("metin_")) {
    const num = id.replace(/^metin_0*/, "") || id.replace("metin_", "");
    const titlePart = cleanTitle ? `: ${cleanTitle}` : "";
    return {
      topBadge: "📖 Okuma Metni Cümlesi",
      promptQuestionTr:
        "Aşağıdaki okuma metni cümlesinin doğru Türkçe çevirisi hangisidir?",
      bottomMeta: `📖 Okuma Metni #${num}${titlePart}`,
      shortTitle: `📖 Okuma Metni #${num}${titlePart}`,
    };
  }

  if (id === "pool_visual" || id.startsWith("pool_visual")) {
    const cat = cleanSpeaker || "Görsel Kelime";
    return {
      topBadge: "🖼️ Görsel Kelime Cümlesi",
      promptQuestionTr:
        "Aşağıdaki Arapça örnek cümlenin doğru Türkçe çevirisi hangisidir?",
      bottomMeta: `🖼️ Görsel Kelime • ${cat}`,
      shortTitle: `🖼️ Görsel Kelime • ${cat}`,
    };
  }

  if (id.startsWith("dlg_")) {
    const num = id.replace(/^dlg_0*/, "") || id.replace("dlg_", "");
    const speakerSuffix =
      cleanSpeaker && cleanSpeaker !== cleanTitle ? ` (${cleanSpeaker})` : "";
    const titlePart = cleanTitle ? `: ${cleanTitle}` : "";
    return {
      topBadge: "💬 Diyalog Cümlesi",
      promptQuestionTr:
        "Aşağıdaki Arapça diyalog cümlesinin doğru Türkçe çevirisi hangisidir?",
      bottomMeta: `💬 Diyalog #${num}${titlePart}${speakerSuffix}`,
      shortTitle: `💬 Diyalog #${num}${titlePart}`,
    };
  }

  // Herhangi bir özel/sentetik havuz ID'si gelirse ham kodu (#pool_...) asla basma
  const safeLabel = cleanTitle.replace(/#?pool_[a-z0-9_]+/gi, "").trim();
  const fallbackMeta = safeLabel
    ? `💬 ${safeLabel}${cleanSpeaker ? ` • ${cleanSpeaker}` : ""}`
    : `💬 Arapça Cümle${cleanSpeaker ? ` • ${cleanSpeaker}` : ""}`;
  return {
    topBadge: "💬 Arapça Cümle",
    promptQuestionTr:
      "Aşağıdaki Arapça cümlenin doğru Türkçe çevirisi hangisidir?",
    bottomMeta: fallbackMeta,
    shortTitle: safeLabel || "💬 Arapça Cümle",
  };
}

export interface WordItem {
  id: string;
  type: "word" | "sentence" | "idiom";
  arabic: string;
  turkish: string;
  level?: Level | string;
  category?: string;
  grammarTopic?: string;
  sourceId?: string;
  sourceTitle?: string;
  plural?: string;
  literal?: string;
  context?: string;
  exampleAr?: string;
  exampleTr?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioFemaleUrl?: string;
  partOfSpeech?: string;
  root?: string;
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CEFR_ORDER: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

export function normalizeWordPartOfSpeech(
  tur?: string
): "isim" | "fiil" | "edat" | "ifade" {
  const raw = (tur || "").trim().toLowerCase();
  if (raw.includes("fiil")) return "fiil";
  if (
    raw.includes("edat") ||
    raw.includes("harf") ||
    raw.includes("bağlaç") ||
    raw.includes("zarf")
  )
    return "edat";
  if (raw.includes("ifade") || raw.includes("kalıp")) return "ifade";
  return "isim";
}

function getWordPrimaryArabic(item: DictionaryItem): string {
  return (item.mufret || item.mazi || "").split("/")[0].trim();
}

// ============================================================================
// VERİ HAVUZU ÜRETİCİLERİ (TÜM EĞİTİM VERİ KAYNAKLARI)
// ============================================================================

/**
 * 1. Tüm Sözlük Havuzu (3.118 Kelime — özel isimler hariç)
 */
export function generateFullDictionaryPool(options?: {
  level?: Level | "all";
}): WordItem[] {
  const lvl = options?.level || "all";
  return sozluk
    .filter((w) => !isProperNounItem(w))
    .filter((w) => (lvl === "all" ? true : (w.cefr || "A1") === lvl))
    .map((w) => ({
      id: w.id,
      type: "word" as const,
      arabic: (w.mufret || w.mazi || "").trim(),
      turkish: w.anlam_tr,
      level: w.cefr || "A1",
      category: w.kategori_tr || w.tur,
      plural: w.cemi || w.muzari,
      exampleAr: w.ornek_ar,
      exampleTr: w.ornek_tr,
      imageUrl: w.gorsel,
      audioUrl: w.ses_erkek,
      audioFemaleUrl: w.ses_kadin,
      partOfSpeech: w.tur,
      root: w.kok,
    }))
    .filter((item) => item.arabic.length > 0 && item.turkish.length > 0);
}

/**
 * 2. 120 Diyalog Havuzu (Diyalog Cümleleri ve Kelimeleri)
 */
export function generatePoolFromDialogues(options?: {
  dialogueId?: string;
  level?: Level | "all";
  startNum?: number;
  endNum?: number;
}): WordItem[] {
  const lvl = options?.level || "all";
  const dialogueId = options?.dialogueId || "all";
  const startNum = options?.startNum ?? 1;
  const endNum = options?.endNum ?? diyaloglar.length;

  const targetDialogues = diyaloglar.filter((d) => {
    if (dialogueId !== "all" && !dialogueId.startsWith("range:")) {
      return d.id === dialogueId;
    }
    const num = parseInt(d.id.replace("dlg_", ""), 10);
    if (num < startNum || num > endNum) return false;
    if (lvl !== "all" && d.seviye !== lvl) return false;
    return true;
  });

  const pool: WordItem[] = [];
  const seenWordIds = new Set<string>();

  for (const dlg of targetDialogues) {
    for (const line of dlg.satirlar) {
      if (!line.arapca?.trim() || !line.turkce?.trim()) continue;
      pool.push({
        id: `dlg_line_${dlg.id}_${line.sira}`,
        type: "sentence",
        arabic: line.arapca.trim(),
        turkish: line.turkce.trim(),
        level: dlg.seviye,
        category: dlg.tema,
        grammarTopic: dlg.odak_gramer,
        sourceId: dlg.id,
        sourceTitle: dlg.baslik_tr,
        audioUrl: line.ses_dosyasi || line.audio,
      });
    }

    const vocabEntries = getDialogueVocabulary(dlg.id);
    for (const entry of vocabEntries) {
      const w = entry.item;
      if (isProperNounItem(w) || seenWordIds.has(w.id)) continue;
      if (lvl !== "all" && w.cefr && w.cefr !== lvl) continue;
      seenWordIds.add(w.id);
      pool.push({
        id: w.id,
        type: "word",
        arabic: (w.mufret || w.mazi || "").trim(),
        turkish: w.anlam_tr,
        level: w.cefr || dlg.seviye,
        sourceId: dlg.id,
        sourceTitle: dlg.baslik_tr,
        plural: w.cemi || w.muzari,
        exampleAr: entry.contextSentence,
        exampleTr: entry.contextTranslation,
        partOfSpeech: w.tur,
        root: w.kok,
      });
    }
  }

  return pool;
}

/**
 * 3. 60 Okuma Metni Havuzu (tum_metinler_60.json — Cümleler ve Metin Kelimeleri)
 */
export function generatePoolFromReadings(options?: {
  readingId?: string;
  level?: Level | "all";
}): WordItem[] {
  const lvl = options?.level || "all";
  const readingId = options?.readingId || "all";

  const targetReadings = metinler.filter((m) => {
    if (readingId !== "all" && m.id !== readingId) return false;
    if (lvl !== "all" && m.seviye !== lvl) return false;
    return true;
  });

  const pool: WordItem[] = [];
  const seenWordIds = new Set<string>();

  for (const metin of targetReadings) {
    for (const line of metin.satirlar) {
      if (!line.arapca?.trim() || !line.turkce?.trim()) continue;
      pool.push({
        id: `reading_line_${metin.id}_${line.sira}`,
        type: "sentence",
        arabic: line.arapca.trim(),
        turkish: line.turkce.trim(),
        level: metin.seviye,
        category: metin.tema,
        grammarTopic: metin.odak_gramer,
        sourceId: metin.id,
        sourceTitle: metin.baslik_tr,
        imageUrl: metin.gorsel,
        audioUrl: line.ses_dosyasi,
      });
    }

    const vocabEntries = getReadingTextVocabulary(metin.id);
    for (const entry of vocabEntries) {
      const w = entry.item;
      if (isProperNounItem(w) || seenWordIds.has(w.id)) continue;
      seenWordIds.add(w.id);
      pool.push({
        id: w.id,
        type: "word",
        arabic: (w.mufret || w.mazi || "").trim(),
        turkish: w.anlam_tr,
        level: w.cefr || metin.seviye,
        category: metin.tema,
        sourceId: metin.id,
        sourceTitle: metin.baslik_tr,
        plural: w.cemi || w.muzari,
        exampleAr: entry.contextSentence,
        exampleTr: entry.contextTranslation,
        partOfSpeech: w.tur,
        root: w.kok,
      });
    }
  }

  return pool;
}

/**
 * 4. 1111 Günlük Kalıp Cümle Havuzu (1111_cumle.json)
 */
export function generatePoolFrom1111Sentences(options?: {
  category?: string;
  level?: Level | "all";
  grammar?: string;
  targetCount?: number;
}): WordItem[] {
  const lvl = options?.level || "all";
  const category = options?.category || "all";
  const grammar = (options?.grammar || "all").trim();
  const targetCount = options?.targetCount ?? 10;

  const normalizeKey = (s: string) =>
    s
      .toLocaleLowerCase("tr-TR")
      .replace(/[âîû]/g, (m) => ({ â: "a", î: "i", û: "u" }[m] || m))
      .replace(/\s+/g, " ")
      .trim();

  const normGrammar = grammar !== "all" ? normalizeKey(grammar) : "";

  const baseCandidates = cumleler1111.filter((item) => {
    const itemLevel = item.seviye || item.cefr || "A1";
    if (lvl !== "all" && itemLevel !== lvl) return false;
    const itemCat = (item.tema || item.kategori || "").trim();
    if (category !== "all" && itemCat !== category) return false;
    return true;
  });

  let filtered = baseCandidates;

  if (grammar !== "all" && normGrammar) {
    // ADIM 1: Birebir aynı odak_kalip (veya tam kalıp ifadesini eksiksiz barındıran) cümleler
    const exactMatches = baseCandidates.filter((item) => {
      const itemGrammar = normalizeKey(item.odak_kalip || "");
      return itemGrammar.length > 0 && itemGrammar === normGrammar;
    });

    const phraseMatches =
      normGrammar.length >= 6
        ? baseCandidates.filter((item) => {
            const itemGrammar = normalizeKey(item.odak_kalip || "");
            return (
              itemGrammar.length > 0 &&
              itemGrammar !== normGrammar &&
              itemGrammar.includes(normGrammar)
            );
          })
        : [];

    const primarySet = [...exactMatches, ...phraseMatches];
    const pickedIds = new Set(primarySet.map((i) => i.id));

    if (primarySet.length >= targetCount) {
      filtered = primarySet;
    } else {
      // ADIM 2: Yalnızca tam eşleşmeler hedef soru sayısının (örn. 10) altındaysa,
      // "+" veya "(" öncesindeki ANA GRAMER BAŞLIĞI (örn. "Muzâri Fiil") ile başlayanlarla tamamla.
      // Asla "Fiil" gibi tek kelimelere bölüp yüzlerce alakasız cümleyi dahil etme!
      const primaryPrefix = normGrammar.split(/[+(/—–:]/)[0].trim();
      const genericSingleWords = new Set([
        "fiil",
        "isim",
        "harf",
        "edat",
        "cumle",
        "cümle",
        "kalip",
        "kalıp",
        "zamir",
      ]);
      const canUsePrefix =
        primaryPrefix.length >= 4 &&
        (!genericSingleWords.has(primaryPrefix) ||
          normGrammar === primaryPrefix);

      const familySupplement = canUsePrefix
        ? baseCandidates.filter((item) => {
            if (pickedIds.has(item.id)) return false;
            const itemGrammar = normalizeKey(item.odak_kalip || "");
            return (
              itemGrammar.length > 0 && itemGrammar.startsWith(primaryPrefix)
            );
          })
        : [];

      const needed = Math.max(0, targetCount - primarySet.length);
      const combined = [
        ...primarySet,
        ...familySupplement.slice(0, needed),
      ];

      // Eğer seviye/kategori daraltması yüzünden < 4 kaldıysa aynı kalıbı tüm seviyelerde ara
      if (combined.length < 4 && (lvl !== "all" || category !== "all")) {
        const allLevelExact = cumleler1111.filter((item) => {
          const itemGrammar = normalizeKey(item.odak_kalip || "");
          return (
            itemGrammar === normGrammar ||
            (normGrammar.length >= 6 && itemGrammar.includes(normGrammar)) ||
            (canUsePrefix && itemGrammar.startsWith(primaryPrefix))
          );
        });
        filtered =
          allLevelExact.length >= 4
            ? allLevelExact.slice(0, Math.max(targetCount, exactMatches.length))
            : combined.length > 0
            ? combined
            : baseCandidates;
      } else {
        filtered = combined.length > 0 ? combined : baseCandidates;
      }
    }
  }

  return filtered.map((item) => ({
    id: item.id,
    type: "sentence" as const,
    arabic: item.arapca,
    turkish: item.turkce,
    level: item.seviye || item.cefr || "A1",
    category: item.tema || item.kategori || "Genel",
    grammarTopic: item.odak_kalip,
    context: item.baglam || item.not_tr,
    audioUrl: item.ses_erkek || `/sesler/cumleler/${item.id}_m.mp3`,
    audioFemaleUrl: item.ses_kadin || `/sesler/cumleler/${item.id}_f.mp3`,
  }));
}

/**
 * 5. 508 Atasözü ve Hikmet Havuzu (atasozleri.json)
 */
export function generatePoolFromProverbs(options?: {
  category?: string;
  level?: Level | "all";
}): WordItem[] {
  const lvl = options?.level || "all";
  const category = options?.category || "all";

  return atasozleri
    .filter((item) => {
      const itemLevel = item.cefr || "B1";
      if (lvl !== "all" && itemLevel !== lvl) return false;
      const itemCat = (item.tema || "").trim();
      if (category !== "all" && itemCat !== category) return false;
      return true;
    })
    .map((item) => ({
      id: item.id,
      type: "idiom" as const,
      arabic: item.arapca,
      turkish: item.turkce,
      literal: item.lafzi_ceviri,
      context: item.kullanim_baglami,
      level: item.cefr || "B1",
      category: item.tema || "Atasözü",
      imageUrl: item.gorsel,
      audioUrl: item.ses_erkek || `/sesler/atasozleri/${item.id}_m.mp3`,
      audioFemaleUrl: item.ses_kadin || `/sesler/atasozleri/${item.id}_f.mp3`,
    }));
}

/**
 * 6. 998 Görsel Kelime Havuzu (gorselKelimeler_guncel.json)
 */
export function generatePoolFromVisualWords(options?: {
  category?: string;
  level?: Level | "all";
}): WordItem[] {
  const lvl = options?.level || "all";
  const category = options?.category || "all";
  const targetMainCat =
    category === "all" ? "all" : getMainVisualCategory(category);

  return gorselKelimeler
    .filter((item) => {
      const itemLevel = item.cefr || "A1";
      if (lvl !== "all" && itemLevel !== lvl) return false;
      const rawCat = (item.kategori_tr || item.kategori || "").trim();
      const itemMainCat = getMainVisualCategory(rawCat);
      if (
        targetMainCat !== "all" &&
        itemMainCat !== targetMainCat &&
        rawCat !== category
      ) {
        return false;
      }
      return true;
    })
    .map((item) => ({
      id: item.id,
      type: "word" as const,
      arabic: item.arapca,
      turkish: item.turkce,
      plural:
        item.ikincil_form && item.ikincil_form !== "-"
          ? item.ikincil_form
          : undefined,
      exampleAr: item.ornek_ar,
      exampleTr: item.ornek_tr,
      level: item.cefr || "A1",
      category:
        getMainVisualCategory(item.kategori_tr || item.kategori) || "Genel",
      imageUrl: item.gorsel,
      audioUrl: item.ses_erkek,
      audioFemaleUrl: item.ses_kadin,
      partOfSpeech: item.tur,
      root: item.kok,
    }));
}

/**
 * Modül Bazlı Kategori Listesi ve Sayıları
 */
export function getModuleCategoryList(
  moduleType: "sentences_1111" | "proverbs_508" | "visual_words",
  level: Level | "all" = "all"
): { category: string; label: string; count: number }[] {
  const counts = new Map<string, number>();

  if (moduleType === "sentences_1111") {
    for (const item of cumleler1111) {
      const itemLevel = item.seviye || item.cefr || "A1";
      if (level !== "all" && itemLevel !== level) continue;
      const cat = (item.tema || item.kategori || "").trim();
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
  } else if (moduleType === "proverbs_508") {
    for (const item of atasozleri) {
      const itemLevel = item.cefr || "B1";
      if (level !== "all" && itemLevel !== level) continue;
      const cat = (item.tema || "").trim();
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
  } else if (moduleType === "visual_words") {
    for (const item of gorselKelimeler) {
      const itemLevel = item.cefr || "A1";
      if (level !== "all" && itemLevel !== level) continue;
      const cat = getMainVisualCategory(item.kategori_tr || item.kategori || "");
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([category, count]) => ({
    category,
    label: formatTurkishCategory(category),
    count,
  }));
}

/**
 * Akıllı Çeldirici (Smart Distractor) Motoru:
 * KURAL 1 (Zorunlu İsim / Fiil Tür Uyumu): Hedef kelime fiil ise çeldiriciler kesinlikle fiil,
 * isim ise kesinlikle isim seçilir.
 * KURAL 2: Aynı sözcük türü içinde aynı CEFR seviyesi ve yakın uzunluk önceliklidir.
 * KURAL 3: Aynı Türkçe anlama veya Arapça yazılışa sahip mükerrer şıklar engellenir.
 */
export function selectSmartWordDistractors(
  correctItem: DictionaryItem,
  allVocabulary: DictionaryItem[],
  count = 3
): DictionaryItem[] {
  const targetTur = normalizeWordPartOfSpeech(correctItem.tur);
  const targetCefrNum = CEFR_ORDER[correctItem.cefr || "A1"] ?? 1;
  const targetArLen = getWordPrimaryArabic(correctItem).length || 4;
  const targetTrLen = (correctItem.anlam_tr || "").trim().length || 6;

  const normalizeMeaningKey = (raw?: string) =>
    stripParentheticalArabicExamples(raw || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

  const uniqueCandidates: DictionaryItem[] = [];
  const seenMeanings = new Set<string>([
    (correctItem.anlam_tr || "").trim().toLowerCase(),
    normalizeMeaningKey(correctItem.anlam_tr),
  ]);
  const seenArabic = new Set<string>([
    getWordPrimaryArabic(correctItem).toLowerCase(),
  ]);

  for (const item of allVocabulary) {
    if (!item || item.id === correctItem.id) continue;
    const rawMeaningKey = (item.anlam_tr || "").trim().toLowerCase();
    const strippedMeaningKey = normalizeMeaningKey(item.anlam_tr);
    const arKey = getWordPrimaryArabic(item).toLowerCase();
    if (
      !rawMeaningKey ||
      !strippedMeaningKey ||
      seenMeanings.has(rawMeaningKey) ||
      seenMeanings.has(strippedMeaningKey)
    ) {
      continue;
    }
    if (arKey && seenArabic.has(arKey)) continue;
    seenMeanings.add(rawMeaningKey);
    seenMeanings.add(strippedMeaningKey);
    if (arKey) seenArabic.add(arKey);
    uniqueCandidates.push(item);
  }

  // Sadece aynı sözcük türündeki (isim <-> isim, fiil <-> fiil) adaylar
  // Yakınlık + rastgelelik puanı .sort() dışında tek seferde hesaplanır
  const scoredSamePos = uniqueCandidates
    .filter((c) => normalizeWordPartOfSpeech(c.tur) === targetTur)
    .map((candidate) => {
      const arLen = getWordPrimaryArabic(candidate).length || 4;
      const trLen = (candidate.anlam_tr || "").trim().length || 6;
      const lenDiff =
        Math.abs(arLen - targetArLen) * 1.5 +
        Math.abs(trLen - targetTrLen) * 0.4;
      const cefrNum = CEFR_ORDER[candidate.cefr || "A1"] ?? 1;
      return {
        item: candidate,
        cefrNum,
        score: lenDiff + Math.random() * 2.2,
      };
    });

  // Katman 1: Aynı tür + aynı CEFR seviyesi
  const tier1 = scoredSamePos
    .filter((entry) => entry.cefrNum === targetCefrNum)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);

  // Katman 2: Aynı tür + komşu CEFR seviyesi (|fark| === 1)
  const tier2 = scoredSamePos
    .filter((entry) => Math.abs(entry.cefrNum - targetCefrNum) === 1)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);

  // Katman 3: Aynı tür + diğer CEFR seviyeleri
  const tier3 = scoredSamePos
    .filter((entry) => Math.abs(entry.cefrNum - targetCefrNum) > 1)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);

  // Katman 4: Yalnızca aynı türden toplam aday sayısı < count ise acil yedek
  const tier4 =
    scoredSamePos.length >= count
      ? []
      : shuffleArray(
          uniqueCandidates.filter(
            (c) => normalizeWordPartOfSpeech(c.tur) !== targetTur
          )
        );

  const selected: DictionaryItem[] = [];
  const pickedIds = new Set<string>();

  for (const tier of [tier1, tier2, tier3, tier4]) {
    for (const item of tier) {
      if (selected.length >= count) break;
      if (pickedIds.has(item.id)) continue;
      pickedIds.add(item.id);
      selected.push(item);
    }
    if (selected.length >= count) break;
  }

  return selected;
}

/**
 * Görsel & Sesli Eşleştirme Akıllı Çeldirici Motoru:
 * KURAL 1 (Zorunlu İsim/Fiil Uyumu): Hedef kelime fiil (tur === "fiil") ise çeldiricilerin tamamı fiil,
 * isim ise tamamı isim seçilir.
 * KURAL 2 (Kategori ve Seviye Yakınlığı): Aynı tur içinde önce aynı kategori_tr ve aynı cefr,
 * ardından aynı kategori_tr, ardından aynı cefr, ardından aynı tur içindeki diğer kategoriler seçilir.
 * KURAL 3: Aynı gorsel, aynı arapca veya aynı turkce değere sahip öğeler tekrar şıklara eklenmez.
 */
export function selectSmartVisualDistractors(
  target: VisualWordItem,
  pool: VisualWordItem[],
  count = 3
): VisualWordItem[] {
  const targetTur = normalizeWordPartOfSpeech(target.tur);
  const targetCefrNum = CEFR_ORDER[target.cefr || "A1"] ?? 1;
  const targetCategory = getMainVisualCategory(
    target.kategori_tr || target.kategori || ""
  );

  const seenImages = new Set<string>(
    target.gorsel ? [target.gorsel.trim().toLowerCase()] : []
  );
  const seenArabic = new Set<string>(
    target.arapca ? [target.arapca.trim().toLowerCase()] : []
  );
  const seenTurkish = new Set<string>(
    target.turkce ? [target.turkce.trim().toLowerCase()] : []
  );

  const uniqueCandidates: VisualWordItem[] = [];

  for (const item of pool) {
    if (!item || item.id === target.id) continue;
    const imgKey = (item.gorsel || "").trim().toLowerCase();
    const arKey = (item.arapca || "").trim().toLowerCase();
    const trKey = (item.turkce || "").trim().toLowerCase();

    if (!imgKey || seenImages.has(imgKey)) continue;
    if (!arKey || seenArabic.has(arKey)) continue;
    if (!trKey || seenTurkish.has(trKey)) continue;

    seenImages.add(imgKey);
    seenArabic.add(arKey);
    seenTurkish.add(trKey);
    uniqueCandidates.push(item);
  }

  // Kural 1: Kesinlikle aynı sözcük türü (fiil <-> fiil, isim <-> isim)
  const sameTurPool = uniqueCandidates.filter(
    (c) => normalizeWordPartOfSpeech(c.tur) === targetTur
  );

  // Katman 1: Aynı tür + aynı kategori + aynı CEFR
  const tier1 = shuffleArray(
    sameTurPool.filter(
      (c) =>
        getMainVisualCategory(c.kategori_tr || c.kategori || "") ===
          targetCategory &&
        (CEFR_ORDER[c.cefr || "A1"] ?? 1) === targetCefrNum
    )
  );

  // Katman 2: Aynı tür + aynı kategori (diğer CEFR seviyeleri)
  const tier2 = shuffleArray(
    sameTurPool.filter(
      (c) =>
        getMainVisualCategory(c.kategori_tr || c.kategori || "") ===
          targetCategory &&
        (CEFR_ORDER[c.cefr || "A1"] ?? 1) !== targetCefrNum
    )
  );

  // Katman 3: Aynı tür + aynı CEFR (diğer kategoriler)
  const tier3 = shuffleArray(
    sameTurPool.filter(
      (c) =>
        getMainVisualCategory(c.kategori_tr || c.kategori || "") !==
          targetCategory &&
        (CEFR_ORDER[c.cefr || "A1"] ?? 1) === targetCefrNum
    )
  );

  // Katman 4: Aynı tür + diğer tüm kategoriler/seviyeler
  const tier4 = shuffleArray(
    sameTurPool.filter(
      (c) =>
        getMainVisualCategory(c.kategori_tr || c.kategori || "") !==
          targetCategory &&
        (CEFR_ORDER[c.cefr || "A1"] ?? 1) !== targetCefrNum
    )
  );

  // Katman 5: Yalnızca havuzda aynı türden < count öğe varsa yedek
  const tier5 =
    sameTurPool.length >= count
      ? []
      : shuffleArray(
          uniqueCandidates.filter(
            (c) => normalizeWordPartOfSpeech(c.tur) !== targetTur
          )
        );

  const selected: VisualWordItem[] = [];
  const pickedIds = new Set<string>();

  for (const tier of [tier1, tier2, tier3, tier4, tier5]) {
    for (const item of tier) {
      if (selected.length >= count) break;
      if (pickedIds.has(item.id)) continue;
      pickedIds.add(item.id);
      selected.push(item);
    }
    if (selected.length >= count) break;
  }

  return selected;
}

// Çoktan seçmeli test için akıllı şıklar üret
export function generateMultipleChoiceOptions(
  correctItem: DictionaryItem,
  allVocabulary: DictionaryItem[]
): { text: string; isCorrect: boolean }[] {
  const correctText = correctItem.anlam_tr;
  const smartDistractors = selectSmartWordDistractors(
    correctItem,
    allVocabulary,
    3
  ).map((item) => item.anlam_tr);

  return shuffleArray([
    { text: correctText, isCorrect: true },
    ...smartDistractors.map((text) => ({ text, isCorrect: false })),
  ]);
}

function countBaseArabicLetters(word: string): number {
  return word
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[^\u0621-\u064A]/g, "").length;
}

// Boşluk Doldurma için cümle ve akıllı şıklar üret
export function generateFillInBlanks(
  lines: DialogueLine[],
  vocabulary: DictionaryItem[]
): {
  sentenceWithBlank: string;
  options: { text: string; isCorrect: boolean }[];
  originalWord: string;
}[] {
  const questions: {
    sentenceWithBlank: string;
    options: { text: string; isCorrect: boolean }[];
    originalWord: string;
  }[] = [];

  lines.forEach((line) => {
    const words = line.arapca.split(/\s+/).filter(Boolean);

    words.forEach((word, wordIndex) => {
      const m = word.match(
        /^([.,!?؟،؛:"'«»()[\]…]*)([\s\S]*?)([.,!?؟،؛:"'«»()[\]…]*)$/
      );
      const leadingPunct = m ? m[1] || "" : "";
      const cleanWord = (m ? m[2] || "" : word)
        .replace(/[.,!?؟،؛:"'«»()[\]…]/g, "")
        .trim();
      const trailingPunct = m ? m[3] || "" : "";

      if (countBaseArabicLetters(cleanWord) < 2) return;

      const vocabItem = vocabulary.find(
        (v) =>
          v.mufret?.includes(cleanWord) ||
          v.mazi?.includes(cleanWord) ||
          cleanWord.includes(v.mufret || "___")
      );

      if (vocabItem) {
        const sentenceWithBlank = words
          .map((tok, idx) =>
            idx === wordIndex ? `${leadingPunct}______${trailingPunct}` : tok
          )
          .join(" ");
        const correctText = cleanWord;
        const wrongOptions = selectSmartWordDistractors(
          vocabItem,
          vocabulary,
          3
        )
          .map((v) => getWordPrimaryArabic(v))
          .filter((w) => w !== "" && w !== correctText);

        if (wrongOptions.length === 3) {
          questions.push({
            sentenceWithBlank,
            originalWord: cleanWord,
            options: shuffleArray([
              { text: correctText, isCorrect: true },
              ...wrongOptions.map((text) => ({ text, isCorrect: false })),
            ]),
          });
        }
      }
    });
  });

  return shuffleArray(questions).slice(0, 5);
}

// ============================================================================
// 7. 400 EŞ & ZIT ANLAMLI KELİMELER HAVUZU VE AKILLI EGZERSİZ ÜRETİCİLERİ
// ============================================================================

export function getSynonymTurLabel(tur: SynonymAntonymWordTur | string): string {
  if (tur === "fiil") return "⚡ Fiil";
  if (tur === "sifat") return "🎨 Sıfat";
  if (tur === "zarf") return "⏱️ Zarf";
  return "📘 İsim";
}

function stripDiacriticsForQuiz(str: string): string {
  return (str || "")
    .normalize("NFC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[.,!?؟،؛:"'«»()[\]…]/g, "")
    .trim();
}

export function getFilteredSynonymAntonymEntries(options?: {
  level?: Level | "all";
  tur?: SynonymAntonymWordTur | "all";
}): SynonymAntonymEntry[] {
  const lvl = options?.level || "all";
  const tur = options?.tur || "all";
  return esZitAnlamlilar.filter((entry) => {
    if (lvl !== "all" && entry.cefr !== lvl) return false;
    if (tur !== "all" && entry.tur !== tur) return false;
    return true;
  });
}

export function generatePoolFromSynonymsAntonyms(options?: {
  level?: Level | "all";
  tur?: SynonymAntonymWordTur | "all";
}): WordItem[] {
  const entries = getFilteredSynonymAntonymEntries(options);
  return entries.map((entry) => {
    const synList = entry.es_anlamlilar.map((s) => `${s.ar} (${s.tr})`).join("، ");
    const antList = entry.zit_anlamlilar.map((z) => `${z.ar} (${z.tr})`).join("، ");
    const summaryParts = [entry.anlam_tr];
    if (synList) summaryParts.push(`Eş: ${synList}`);
    if (antList) summaryParts.push(`Zıt: ${antList}`);
    return {
      id: entry.id,
      type: "word" as const,
      arabic: entry.kelime_ar,
      turkish: summaryParts.join(" • "),
      level: entry.cefr,
      category: getSynonymTurLabel(entry.tur),
      plural: entry.zit_anlamlilar[0]?.ar || entry.es_anlamlilar[0]?.ar,
      exampleAr: entry.ornek_cumle_ar,
      exampleTr: entry.ornek_cumle_tr,
      partOfSpeech: entry.tur === "fiil" ? "fiil" : entry.tur === "zarf" ? "edat" : "isim",
    };
  });
}

export interface SynonymMcQuestionItem {
  id: string;
  kind: "word";
  wordId: string;
  topBadge: string;
  arabic: string;
  promptQuestionTr: string;
  turkish: string;
  metaLabel?: string;
  usageNote?: string;
  options: { text: string; isCorrect: boolean }[];
}

/**
 * Çoktan Seçmeli Eş & Zıt Anlam Sorusu Üreticisi:
 * «كَبِيرٌ» kelimesinin eş anlamlısı (مُرَادِف) / zıt anlamlısı (ضِدّ) aşağıdakilerden hangisidir?
 * Çeldiriciler aynı sözcük türü (isim/fiil/sifat/zarf) ve öncelikle aynı CEFR seviyesinden seçilir;
 * hedef kelimenin diğer eş/zıt anlamlıları kesinlikle çeldirici havuzundan dışlanır.
 */
export function generateSynonymAntonymMcQuestions(
  entries: SynonymAntonymEntry[],
  questionCount: number
): SynonymMcQuestionItem[] {
  const validEntries = entries.filter(
    (e) => e.es_anlamlilar.length > 0 || e.zit_anlamlilar.length > 0
  );
  if (validEntries.length === 0) return [];

  const shuffled = shuffleArray(validEntries).slice(
    0,
    Math.min(questionCount, validEntries.length)
  );

  return shuffled.map((entry, idx) => {
    const hasSyn = entry.es_anlamlilar.length > 0;
    const hasAnt = entry.zit_anlamlilar.length > 0;
    const askAntonym =
      hasSyn && hasAnt ? idx % 2 === 1 : hasAnt ? true : false;

    const targetPool = askAntonym ? entry.zit_anlamlilar : entry.es_anlamlilar;
    const chosenSub = targetPool[Math.floor(Math.random() * targetPool.length)];
    const correctAr = chosenSub.ar.trim();

    // Yasaklı kelimeler: ana kelime + tüm eş anlamlılar + tüm zıt anlamlılar
    const forbiddenBare = new Set<string>([
      stripDiacriticsForQuiz(entry.kelime_ar),
      stripDiacriticsForQuiz(entry.kelime_harekesiz),
      stripDiacriticsForQuiz(correctAr),
    ]);
    for (const s of entry.es_anlamlilar) {
      forbiddenBare.add(stripDiacriticsForQuiz(s.ar));
      forbiddenBare.add(stripDiacriticsForQuiz(s.harekesiz));
    }
    for (const z of entry.zit_anlamlilar) {
      forbiddenBare.add(stripDiacriticsForQuiz(z.ar));
      forbiddenBare.add(stripDiacriticsForQuiz(z.harekesiz));
    }

    const targetCefrNum = CEFR_ORDER[entry.cefr] ?? 1;
    const candidateByTier: { ar: string; tier: number }[] = [];
    const seenBare = new Set<string>(forbiddenBare);

    for (const other of shuffleArray(esZitAnlamlilar)) {
      if (other.id === entry.id) continue;
      const sameTur = other.tur === entry.tur;
      const cefrDiff = Math.abs((CEFR_ORDER[other.cefr] ?? 1) - targetCefrNum);
      const tier = sameTur
        ? cefrDiff === 0
          ? 1
          : cefrDiff === 1
          ? 2
          : 3
        : 4;

      const forms = [
        other.kelime_ar,
        ...other.es_anlamlilar.map((x) => x.ar),
        ...other.zit_anlamlilar.map((x) => x.ar),
      ];
      for (const f of forms) {
        const cleanF = f.trim();
        const bareF = stripDiacriticsForQuiz(cleanF);
        if (!cleanF || !bareF || seenBare.has(bareF)) continue;
        seenBare.add(bareF);
        candidateByTier.push({ ar: cleanF, tier });
        break;
      }
    }

    candidateByTier.sort((a, b) => a.tier - b.tier);
    const distractors = candidateByTier.slice(0, 3).map((c) => c.ar);

    const shortMeaning = entry.anlam_tr.split(",")[0].trim();
    const promptQuestionTr = askAntonym
      ? `«${entry.kelime_ar}» (${shortMeaning}) kelimesinin zıt anlamlısı (ضِدّ) aşağıdakilerden hangisidir?`
      : `«${entry.kelime_ar}» (${shortMeaning}) kelimesinin eş anlamlısı (مُرَادِف) aşağıdakilerden hangisidir?`;

    const nuancePart = chosenSub.nuans_tr
      ? `💡 الفروق اللغوية: ${chosenSub.nuans_tr} • `
      : "";
    const usageNote = `${nuancePart}Doğru Cevap: ${chosenSub.ar} (${chosenSub.tr}) | Örnek: ${entry.ornek_cumle_ar} (${entry.ornek_cumle_tr})`;

    return {
      id: `mc_${entry.id}`,
      kind: "word",
      wordId: entry.id,
      topBadge: askAntonym
        ? "⚡ Zıt Anlamlısı (الضد)"
        : "🔄 Eş Anlamlısı (المرادف)",
      arabic: entry.kelime_ar,
      promptQuestionTr,
      turkish: `${chosenSub.ar} — ${chosenSub.tr}`,
      metaLabel: `${getSynonymTurLabel(entry.tur)} • Seviye ${entry.cefr}`,
      usageNote,
      options: shuffleArray([
        { text: correctAr, isCorrect: true },
        ...distractors.map((text) => ({ text, isCorrect: false })),
      ]),
    };
  });
}

export interface SynonymMatchingPairItem {
  matchId: string;
  wordId: string;
  trText: string;
  arText: string;
}

/**
 * Eşleştirme Oyunu İçin Çakışmasız Eş / Zıt Anlam Çiftleri Üretir:
 * Aynı 5'li tahta üzerinde hiçbir kart diğer bir kartın eş/zıt anlamlısıyla çakışmaz.
 */
export function generateSynonymAntonymMatchingPairs(
  entries: SynonymAntonymEntry[],
  pairCount = 5
): SynonymMatchingPairItem[] {
  const candidates = shuffleArray(
    entries.filter(
      (e) => e.es_anlamlilar.length > 0 || e.zit_anlamlilar.length > 0
    )
  );

  const pairs: SynonymMatchingPairItem[] = [];
  const boardForbiddenBare = new Set<string>();

  for (const entry of candidates) {
    if (pairs.length >= pairCount) break;
    const hasSyn = entry.es_anlamlilar.length > 0;
    const hasAnt = entry.zit_anlamlilar.length > 0;
    const askAntonym =
      hasSyn && hasAnt ? pairs.length % 2 === 1 : hasAnt ? true : false;
    const subPool = askAntonym ? entry.zit_anlamlilar : entry.es_anlamlilar;
    const chosenSub = subPool[0];
    if (!chosenSub) continue;

    const entryRelatedBares = [
      stripDiacriticsForQuiz(entry.kelime_ar),
      ...entry.es_anlamlilar.map((s) => stripDiacriticsForQuiz(s.ar)),
      ...entry.zit_anlamlilar.map((z) => stripDiacriticsForQuiz(z.ar)),
    ].filter(Boolean);

    if (entryRelatedBares.some((b) => boardForbiddenBare.has(b))) {
      continue;
    }

    for (const b of entryRelatedBares) {
      boardForbiddenBare.add(b);
    }

    const shortMeaning = entry.anlam_tr.split(",")[0].trim();
    const relationBadge = askAntonym
      ? "⚡ Zıt (ضِدّ):"
      : "🔄 Eş (مُرَادِف):";

    pairs.push({
      matchId: `mg_${entry.id}`,
      wordId: entry.id,
      trText: `${relationBadge} ${entry.kelime_ar} (${shortMeaning})`,
      arText: chosenSub.ar.trim(),
    });
  }

  return pairs;
}

export interface SynonymFillQuestionItem {
  id: string;
  wordId: string;
  fullArabic: string;
  turkce: string;
  beforeBlank: string;
  afterBlank: string;
  correctWord: string;
  options: string[];
}

function normalizeStemForSentenceMatch(raw: string): string {
  let s = stripDiacriticsForQuiz(raw);
  // Başta وَ / فَ / بِ / لِ / كَ + ال varsa soyutla
  s = s.replace(/^(?:[وفبلك])?ال/, "");
  s = s.replace(/^[وفبل]/, "");
  // Sonda ة / ا (tenvin elifi) esnekliği
  s = s.replace(/(?:ة|ا)$/, "");
  return s;
}

/**
 * Boşluk Doldurma Egzersizi İçin Karşılaştırmalı Örnek Cümleden Soru Üretir:
 * `ornek_cumle_ar` içindeki hedef kelimeyi (veya zıt anlamlısını) bularak boşluk bırakır
 * ve aynı sözcük türü / CEFR seviyesinden 3 harekeli Arapça çeldirici üretir.
 */
export function generateSynonymAntonymFillQuestions(
  entries: SynonymAntonymEntry[],
  maxQuestions = 10
): SynonymFillQuestionItem[] {
  const shuffled = shuffleArray(entries);
  const results: SynonymFillQuestionItem[] = [];

  for (const entry of shuffled) {
    if (results.length >= maxQuestions) break;
    if (!entry.ornek_cumle_ar?.trim() || !entry.ornek_cumle_tr?.trim()) continue;

    const tokens = entry.ornek_cumle_ar.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 3) continue;

    const targetForms = [
      entry.kelime_ar,
      ...entry.zit_anlamlilar.map((z) => z.ar),
      ...entry.es_anlamlilar.map((s) => s.ar),
    ];
    const targetBares = new Set(
      targetForms.map((f) => stripDiacriticsForQuiz(f)).filter(Boolean)
    );
    const targetStems = new Set(
      targetForms
        .map((f) => normalizeStemForSentenceMatch(f))
        .filter((s) => s.length >= 2)
    );

    let matchedIdx = -1;
    let cleanToken = "";
    let leadPunct = "";
    let trailPunct = "";

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const m = tok.match(
        /^([.,!?؟،؛:"'«»()[\]…]*)([\s\S]*?)([.,!?؟،؛:"'«»()[\]…]*)$/
      );
      const lp = m ? m[1] || "" : "";
      const core = (m ? m[2] || "" : tok)
        .replace(/[.,!?؟،؛:"'«»()[\]…]/g, "")
        .trim();
      const tp = m ? m[3] || "" : "";
      const coreBare = stripDiacriticsForQuiz(core);
      const coreNoAl = coreBare.replace(/^(?:[وفبلك])?ال/, "");
      const coreStem = normalizeStemForSentenceMatch(core);

      if (
        targetBares.has(coreBare) ||
        targetBares.has(coreNoAl) ||
        (coreStem.length >= 2 && targetStems.has(coreStem))
      ) {
        matchedIdx = i;
        cleanToken = core;
        leadPunct = lp;
        trailPunct = tp;
        break;
      }
    }

    if (matchedIdx === -1 || !cleanToken) continue;

    const beforeParts = tokens.slice(0, matchedIdx);
    const afterParts = tokens.slice(matchedIdx + 1);
    const beforeBlank =
      (beforeParts.length > 0 ? beforeParts.join(" ") + " " : "") + leadPunct;
    const afterBlank =
      trailPunct + (afterParts.length > 0 ? " " + afterParts.join(" ") : "");

    const hasAlPrefix = /^ال/.test(stripDiacriticsForQuiz(cleanToken));

    const forbiddenBare = new Set<string>([
      stripDiacriticsForQuiz(cleanToken),
      stripDiacriticsForQuiz(entry.kelime_ar),
      ...entry.es_anlamlilar.map((s) => stripDiacriticsForQuiz(s.ar)),
      ...entry.zit_anlamlilar.map((z) => stripDiacriticsForQuiz(z.ar)),
      ...tokens.map((t) => stripDiacriticsForQuiz(t)),
    ]);

    const targetCefrNum = CEFR_ORDER[entry.cefr] ?? 1;
    const distractorCandidates: { word: string; tier: number }[] = [];

    for (const other of shuffleArray(esZitAnlamlilar)) {
      if (other.id === entry.id) continue;
      const sameTur = other.tur === entry.tur;
      const cefrDiff = Math.abs((CEFR_ORDER[other.cefr] ?? 1) - targetCefrNum);
      let candWord = other.kelime_ar.trim();
      const candBare = stripDiacriticsForQuiz(candWord);
      if (!candBare || forbiddenBare.has(candBare)) continue;

      // Eğer boşluktaki isim/sıfat ال ile başlıyorsa ve aday tenvinli yalın isimse uyumlu marife formunu kontrol et
      if (
        hasAlPrefix &&
        other.tur !== "fiil" &&
        other.tur !== "zarf" &&
        !/^ال/.test(candBare) &&
        other.ornek_cumle_ar
      ) {
        const otherTokens = other.ornek_cumle_ar.split(/\s+/);
        const defToken = otherTokens
          .map((t) => t.replace(/[.,!?؟،؛:"'«»()[\]…]/g, "").trim())
          .find(
            (t) =>
              /^ال/.test(stripDiacriticsForQuiz(t)) &&
              normalizeStemForSentenceMatch(t) ===
                normalizeStemForSentenceMatch(other.kelime_ar)
          );
        if (defToken) {
          candWord = defToken;
        }
      }

      const finalBare = stripDiacriticsForQuiz(candWord);
      if (forbiddenBare.has(finalBare)) continue;
      forbiddenBare.add(finalBare);

      const alMatchBonus =
        (/^ال/.test(finalBare) === hasAlPrefix ? 0 : 1);
      const tier =
        (sameTur ? 0 : 10) + cefrDiff * 2 + alMatchBonus;
      distractorCandidates.push({ word: candWord, tier });
    }

    distractorCandidates.sort((a, b) => a.tier - b.tier);
    const distractors = distractorCandidates.slice(0, 3).map((d) => d.word);
    if (distractors.length < 3) continue;

    results.push({
      id: `fill_${entry.id}`,
      wordId: entry.id,
      fullArabic: entry.ornek_cumle_ar.trim(),
      turkce: entry.ornek_cumle_tr.trim(),
      beforeBlank,
      afterBlank,
      correctWord: cleanToken,
      options: shuffleArray([cleanToken, ...distractors]),
    });
  }

  return results;
}