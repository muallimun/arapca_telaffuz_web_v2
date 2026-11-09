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
} from "@/lib/data";
import {
  getDialogueVocabulary,
  getReadingTextVocabulary,
  isProperNounItem,
} from "@/lib/dict";

export type VisualWordItem = ResimliKelime;

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
}): WordItem[] {
  const lvl = options?.level || "all";
  const category = options?.category || "all";

  return cumleler1111
    .filter((item) => {
      const itemLevel = item.seviye || item.cefr || "A1";
      if (lvl !== "all" && itemLevel !== lvl) return false;
      const itemCat = (item.tema || item.kategori || "").trim();
      if (category !== "all" && itemCat !== category) return false;
      return true;
    })
    .map((item) => ({
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

  return gorselKelimeler
    .filter((item) => {
      const itemLevel = item.cefr || "A1";
      if (lvl !== "all" && itemLevel !== lvl) return false;
      const itemCat = (item.kategori_tr || item.kategori || "").trim();
      if (category !== "all" && itemCat !== category) return false;
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
      category: item.kategori_tr || item.kategori || "Genel",
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
      const cat = (item.kategori_tr || item.kategori || "").trim();
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([category, count]) => ({
    category,
    label: category.replace(/_/g, " "),
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
 * Rosetta Stone Usulü Görsel Kelime Akıllı Çeldirici Motoru:
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
  const targetCategory = (target.kategori_tr || target.kategori || "").trim();

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
        (c.kategori_tr || c.kategori || "").trim() === targetCategory &&
        (CEFR_ORDER[c.cefr || "A1"] ?? 1) === targetCefrNum
    )
  );

  // Katman 2: Aynı tür + aynı kategori (diğer CEFR seviyeleri)
  const tier2 = shuffleArray(
    sameTurPool.filter(
      (c) =>
        (c.kategori_tr || c.kategori || "").trim() === targetCategory &&
        (CEFR_ORDER[c.cefr || "A1"] ?? 1) !== targetCefrNum
    )
  );

  // Katman 3: Aynı tür + aynı CEFR (diğer kategoriler)
  const tier3 = shuffleArray(
    sameTurPool.filter(
      (c) =>
        (c.kategori_tr || c.kategori || "").trim() !== targetCategory &&
        (CEFR_ORDER[c.cefr || "A1"] ?? 1) === targetCefrNum
    )
  );

  // Katman 4: Aynı tür + diğer tüm kategoriler/seviyeler
  const tier4 = shuffleArray(
    sameTurPool.filter(
      (c) =>
        (c.kategori_tr || c.kategori || "").trim() !== targetCategory &&
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