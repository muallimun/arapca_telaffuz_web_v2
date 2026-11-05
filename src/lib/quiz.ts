import { DictionaryItem, DialogueLine, ResimliKelime } from "@/types/data";

export type VisualWordItem = ResimliKelime;

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