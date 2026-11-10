import {
  DictionaryItem,
  DialogueLine,
  Level,
  ResimliKelime,
} from "@/types/data";
import {
  diyaloglar,
  metinler,
  cumleler1111,
  atasozleri,
  gorselKelimeler,
  sozluk,
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
 * 6. 999 Görsel Kelime Havuzu (gorselKelimeler_guncel.json)
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

  const uniqueCandidates: DictionaryItem[] = [];
  const seenMeanings = new Set<string>([
    (correctItem.anlam_tr || "").trim().toLowerCase(),
  ]);
  const seenArabic = new Set<string>([
    getWordPrimaryArabic(correctItem).toLowerCase(),
  ]);

  for (const item of allVocabulary) {
    if (!item || item.id === correctItem.id) continue;
    const meaningKey = (item.anlam_tr || "").trim().toLowerCase();
    const arKey = getWordPrimaryArabic(item).toLowerCase();
    if (!meaningKey || seenMeanings.has(meaningKey)) continue;
    if (arKey && seenArabic.has(arKey)) continue;
    seenMeanings.add(meaningKey);
    if (arKey) seenArabic.add(arKey);
    uniqueCandidates.push(item);
  }

  const scoreProximity = (candidate: DictionaryItem): number => {
    const arLen = getWordPrimaryArabic(candidate).length || 4;
    const trLen = (candidate.anlam_tr || "").trim().length || 6;
    const lenDiff =
      Math.abs(arLen - targetArLen) * 1.5 + Math.abs(trLen - targetTrLen) * 0.4;
    return lenDiff + Math.random() * 2.2;
  };

  // Sadece aynı sözcük türündeki (isim <-> isim, fiil <-> fiil) adaylar
  const samePosCandidates = uniqueCandidates.filter(
    (c) => normalizeWordPartOfSpeech(c.tur) === targetTur
  );

  // Katman 1: Aynı tür + aynı CEFR seviyesi
  const tier1 = samePosCandidates
    .filter((c) => (CEFR_ORDER[c.cefr || "A1"] ?? 1) === targetCefrNum)
    .sort((a, b) => scoreProximity(a) - scoreProximity(b));

  // Katman 2: Aynı tür + komşu CEFR seviyesi (|fark| === 1)
  const tier2 = samePosCandidates
    .filter(
      (c) => Math.abs((CEFR_ORDER[c.cefr || "A1"] ?? 1) - targetCefrNum) === 1
    )
    .sort((a, b) => scoreProximity(a) - scoreProximity(b));

  // Katman 3: Aynı tür + diğer CEFR seviyeleri
  const tier3 = samePosCandidates
    .filter(
      (c) => Math.abs((CEFR_ORDER[c.cefr || "A1"] ?? 1) - targetCefrNum) > 1
    )
    .sort((a, b) => scoreProximity(a) - scoreProximity(b));

  // Katman 4: Yalnızca aynı türden toplam aday sayısı < count ise acil yedek
  const tier4 =
    samePosCandidates.length >= count
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
    const words = line.arapca.split(" ");

    words.forEach((word) => {
      const cleanWord = word.replace(/[.,!?؟،]/g, "");
      const vocabItem = vocabulary.find(
        (v) =>
          v.mufret?.includes(cleanWord) ||
          v.mazi?.includes(cleanWord) ||
          cleanWord.includes(v.mufret || "___")
      );

      if (vocabItem && cleanWord.length > 2) {
        const sentenceWithBlank = line.arapca.replace(word, "______");
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