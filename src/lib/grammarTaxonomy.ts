import type {
  Dialogue,
  GramerHapBilgi,
  Level,
  ReadingText,
} from "../types/data";

export type GrammarDomainId =
  | "nouns_pronouns_reading"
  | "phrases_sentence_nahiv"
  | "verbs_conjugation_sarf"
  | "styles_conjunctions";

export type GrammarDomainFilter = "all" | GrammarDomainId;

export interface GrammarDomainMeta {
  id: GrammarDomainId;
  emoji: string;
  shortTitle: string;
  tabLabel: string;
  badgeClass: string;
  printAccentHex: string;
  printSoftBgHex: string;
  description: string;
}

export const GRAMMAR_DOMAINS: Record<GrammarDomainId, GrammarDomainMeta> = {
  nouns_pronouns_reading: {
    id: "nouns_pronouns_reading",
    emoji: "🔤",
    shortTitle: "İsimler, Zamirler & Okuma",
    tabLabel: "🔤 İsimler, Zamirler & Okuma",
    badgeClass:
      "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200",
    printAccentHex: "#087F5B",
    printSoftBgHex: "#ECFDF5",
    description:
      "Şemsî-Kamerî, Hemze, Zamirler, İşaret İsimleri, İsm-i Mevsûl, Müştaklar, Çoğullar ve Sayılar",
  },
  phrases_sentence_nahiv: {
    id: "phrases_sentence_nahiv",
    emoji: "📐",
    shortTitle: "Tamlamalar & Cümle (Nahiv)",
    tabLabel: "📐 Tamlamalar & Cümle (Nahiv)",
    badgeClass:
      "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200",
    printAccentHex: "#4F46E5",
    printSoftBgHex: "#EEF2FF",
    description:
      "İzâfet, Sıfat, İsim/Fiil Cümlesi, İnne/Kâne, Mef'ûller, Hâl, Temyiz, Zarflar ve İ'rab",
  },
  verbs_conjugation_sarf: {
    id: "verbs_conjugation_sarf",
    emoji: "⚡",
    shortTitle: "Fiiller & Çekim (Sarf)",
    tabLabel: "⚡ Fiiller & Çekim (Sarf)",
    badgeClass:
      "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200",
    printAccentHex: "#B45309",
    printSoftBgHex: "#FFFBEB",
    description:
      "Mâzî, Muzâri, Emir-Nehiy, Nasb-Cezm, Sahih-İlletli Fiiller, Mezîd Bablar ve Meçhul Fiil",
  },
  styles_conjunctions: {
    id: "styles_conjunctions",
    emoji: "🎯",
    shortTitle: "Üslûplar & Bağlaçlar",
    tabLabel: "🎯 Üslûplar & Bağlaçlar",
    badgeClass:
      "bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200",
    printAccentHex: "#6741D9",
    printSoftBgHex: "#F5F3FF",
    description:
      "Şart, İstisnâ, Nidâ, Kasem, Taaccüb, Medih-Zem, İhtisâs-Tahzîr, Soru ve Bağlaçlar",
  },
};

export const GRAMMAR_DOMAIN_ORDER: GrammarDomainId[] = [
  "nouns_pronouns_reading",
  "phrases_sentence_nahiv",
  "verbs_conjugation_sarf",
  "styles_conjunctions",
];

const EXPLICIT_GRM_DOMAIN_MAP: Record<string, GrammarDomainId> = {
  grm_001: "nouns_pronouns_reading", // Şemsî ve Kamerî Harfler
  grm_002: "nouns_pronouns_reading", // Hemze-i Vasıl ve Hemze-i Kat'
  grm_003: "nouns_pronouns_reading", // Munfasıl ve Muttasıl Zamirler
  grm_004: "nouns_pronouns_reading", // İşaret İsimleri
  grm_005: "nouns_pronouns_reading", // Yüzlü, Binli Sayılar
  grm_006: "phrases_sentence_nahiv", // Takdîmü'l-Haber
  grm_007: "verbs_conjugation_sarf", // Lefîf Fiiller
  grm_008: "nouns_pronouns_reading", // İsm-i Tasgîr ve Kırık Çoğul
  grm_009: "styles_conjunctions", // Nidâ Üslûbu ve Münâdâ
  grm_010: "phrases_sentence_nahiv", // Mef'ûlün Fîh: Mu'rab ve Mebnî Zarflar
  grm_011: "phrases_sentence_nahiv", // Mebnî ve Mu'rab / İ'rab Sistemi
  grm_012: "styles_conjunctions", // Kasem Üslûbu ve Te'kid Nûnları
  grm_013: "styles_conjunctions", // İhtisâs, İğrâ ve Tahzîr Üslûpları
  grm_014: "verbs_conjugation_sarf", // Esmâü'l-Ef'âl (Fiil İsimleri)
  grm_015: "phrases_sentence_nahiv", // Merfûât, Mansûbât ve Mecrûrât Genel İ'rab
};

/**
 * 195 Gramer Hap Bilgi kartının her birini 4 temel dil bilimsel alandan birine tasnif eder.
 */
export function classifyGrammarCardDomain(
  card: Pick<GramerHapBilgi, "bagli_id" | "konu_basligi" | "ktt_ust_konu">
): GrammarDomainId {
  if (EXPLICIT_GRM_DOMAIN_MAP[card.bagli_id]) {
    return EXPLICIT_GRM_DOMAIN_MAP[card.bagli_id];
  }

  const raw = `${card.konu_basligi || ""} ${card.ktt_ust_konu || ""}`
    .toLocaleLowerCase("tr-TR")
    .replace(/\u0307/g, "");

  // 1. ÜSLÛPLAR & BAĞLAÇLAR (Şart, İstisnâ, Nidâ, Kasem, Taaccüb, Medih-Zem, İhtisâs-Tahzîr, Bağlaçlar, Soru/Dua Üslûpları)
  if (
    raw.includes("şart") ||
    raw.includes("istisna") ||
    raw.includes("istisnâ") ||
    raw.includes("nida") ||
    raw.includes("nidâ") ||
    raw.includes("münada") ||
    raw.includes("münâdâ") ||
    raw.includes("kasem") ||
    raw.includes("yemin") ||
    raw.includes("taaccüb") ||
    raw.includes("medih") ||
    raw.includes("zem") ||
    raw.includes("ihtisas") ||
    raw.includes("ihtisâs") ||
    raw.includes("tahzir") ||
    raw.includes("tahzîr") ||
    raw.includes("iğra") ||
    raw.includes("iğrâ") ||
    raw.includes("bağlaç") ||
    raw.includes("kasr ve ileri atıf") ||
    raw.includes("karşıtlık atıf") ||
    raw.includes("karşıtlık kalıbı") ||
    raw.includes("sebep edatları") ||
    raw.includes("dua cümleleri") ||
    raw.includes("soru cümleleri")
  ) {
    return "styles_conjunctions";
  }

  // 2. FİİLLER & ÇEKİM (SARF) (Mâzî, Muzâri, Emir, Nehiy, Nasb-Cezm, Ef'âl-i Hamse, Sahih-İlletli, Mezîd Bablar, Meçhul Fiil)
  if (
    raw.includes("mezid") ||
    raw.includes("mezîd") ||
    raw.includes("rubai bab") ||
    raw.includes("rubâî bab") ||
    raw.includes("humasi") ||
    raw.includes("humâsî") ||
    raw.includes("infi'al") ||
    raw.includes("infi'âl") ||
    raw.includes("ifti'al") ||
    raw.includes("ifti'âl") ||
    raw.includes("sahih fiil") ||
    raw.includes("illetli fiil") ||
    raw.includes("lefif") ||
    raw.includes("lefîf") ||
    raw.includes("ef'al-i hamse") ||
    raw.includes("ef'âl-i hamse") ||
    raw.includes("meçhul") ||
    raw.includes("muzari fiilin cezm") ||
    raw.includes("muzari fiilin nasb") ||
    raw.includes("muzari fiili nasb") ||
    raw.includes("muzari fiil nasb") ||
    raw.includes("amaç edatları (كَيْ") ||
    raw.includes("nehiy") ||
    raw.includes("emir fiil") ||
    raw.includes("dişil emir") ||
    raw.includes("muhataba emir") ||
    raw.includes("teklif lâm") ||
    raw.includes("teşvik lâm") ||
    raw.includes("gelecek zaman") ||
    raw.includes("geçmiş zaman vurgusu") ||
    raw.includes("hikâye birleşik zaman") ||
    raw.includes("harf-i cerli fiil") ||
    raw.includes("fiil ve harf-i cer") ||
    raw.includes("mazi ve muzari fiil") ||
    raw.includes("mâzî ve muzâri fiil") ||
    raw.includes("mazi fiil") ||
    raw.includes("mâzî fiil") ||
    raw.includes("muzari fiil") ||
    raw.includes("muzâri fiil") ||
    raw.includes("muhataba muzâri") ||
    raw.includes("konum bildiren (يَقَعُ")
  ) {
    return "verbs_conjugation_sarf";
  }

  // 3. İSİMLER, ZAMİRLER & OKUMA (Şemsî-Kamerî, Hemze, Zamirler, İşaret İsimleri, İsm-i Mevsûl, Müştaklar, Sayılar, Çoğullar, Nisbet)
  if (
    raw.includes("şemsi") ||
    raw.includes("şemsî") ||
    raw.includes("hemze") ||
    raw.includes("ism-i mevsul") ||
    raw.includes("ism-i mevsûl") ||
    raw.includes("işaret isim") ||
    raw.includes("işaret zamir") ||
    raw.includes("uzak işaret") ||
    raw.includes("ism-i fail") ||
    raw.includes("ism-i fâil") ||
    raw.includes("ismi fâil") ||
    raw.includes("ism-i mef'ul") ||
    raw.includes("ism-i mef'ûl") ||
    raw.includes("ism-i maf'ûl") ||
    raw.includes("ismi mef'ul") ||
    raw.includes("ism-i tafdil") ||
    raw.includes("ism-i tafdîl") ||
    raw.includes("ism-i zaman") ||
    raw.includes("ism-i mekan") ||
    raw.includes("ism-i mekân") ||
    raw.includes("ism-i alet") ||
    raw.includes("ism-i tasgir") ||
    raw.includes("ism-i tasgîr") ||
    raw.includes("sıfat-ı müşebbehe") ||
    raw.includes("esma-i hamse") ||
    raw.includes("esmâ-i hamse") ||
    raw.includes("mankus") ||
    raw.includes("gayr-ı munsarif") ||
    raw.includes("gayri munsarif") ||
    raw.includes("renk sıfatları") ||
    raw.includes("nisbet") ||
    raw.includes("müntesib") ||
    raw.includes("cemi müzekker") ||
    raw.includes("cemi müennes") ||
    raw.includes("kırık çoğul") ||
    raw.includes("akılsız çoğul") ||
    raw.includes("sayılar") ||
    raw.includes("sayılarda") ||
    raw.includes("saat ifadeleri") ||
    raw.includes("miktar belirtme") ||
    raw.includes("kelime kökleri") ||
    (raw.includes("zamir") &&
      !raw.includes("inne ve kardeşleri") &&
      !raw.includes("isim cümlesi")) ||
    raw.includes("yiyecek-içecek isimleri") ||
    raw.includes("akrabalık isimleri") ||
    raw.includes("balık türleri") ||
    raw.includes("market eşyaları")
  ) {
    return "nouns_pronouns_reading";
  }

  // 4. TAMLAMALAR & CÜMLE (NAHİV) (İzâfet, Sıfat, İsim/Fiil Cümlesi, İnne/Kâne, Mef'ûller, Hâl, Temyiz, Zarflar, Tevâbi', İ'rab)
  return "phrases_sentence_nahiv";
}

export interface ResolvedGrammarCardCatalogItem {
  id: string;
  bagliId: string;
  level: Level;
  domainId: GrammarDomainId;
  domainMeta: GrammarDomainMeta;
  title: string;
  hapKural: string;
  formulSema: string;
  exampleAr: string;
  exampleTr: string;
  exampleAnalysis?: string;
  kttUstKonu?: string;
  linkedLessonUrl: string | null;
  linkedLessonShortLabel: string | null;
  linkedLessonFullTitle: string | null;
  grammarQuery: string;
  rawNote: GramerHapBilgi;
  dialogueId?: string;
  readingId?: string;
}

const LEVEL_RANK: Record<Level, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
};

function getSourceOrderWeight(bagliId: string): number {
  if (bagliId.startsWith("grm_")) return 1;
  if (bagliId.startsWith("dlg_")) return 2;
  if (bagliId.startsWith("metin_")) return 3;
  return 4;
}

function getNumericIndex(bagliId: string): number {
  return parseInt(bagliId.replace(/\D+/g, ""), 10) || 0;
}

/**
 * 195 Gramer Hap Bilgi kartının tamamını seviye, dil bilimsel alan ve ders bağlantılarıyla pedagojik sırada üretir.
 */
export function buildUnifiedGrammarAtlasCatalog(sources: {
  ekGramerNotlari: GramerHapBilgi[];
  diyalogGramerNotlari: GramerHapBilgi[];
  metinGramerNotlari: GramerHapBilgi[];
  diyaloglar: Dialogue[];
  metinler: ReadingText[];
}): ResolvedGrammarCardCatalogItem[] {
  const {
    ekGramerNotlari,
    diyalogGramerNotlari,
    metinGramerNotlari,
    diyaloglar,
    metinler,
  } = sources;
  const dlgMap = new Map(diyaloglar.map((d) => [d.id, d]));
  const txtMap = new Map(metinler.map((m) => [m.id, m]));

  const items: ResolvedGrammarCardCatalogItem[] = [];

  for (const card of ekGramerNotlari) {
    const level: Level = card.seviye || "A1";
    const domainId = classifyGrammarCardDomain(card);
    items.push({
      id: `atlas_${card.bagli_id}`,
      bagliId: card.bagli_id,
      level,
      domainId,
      domainMeta: GRAMMAR_DOMAINS[domainId],
      title: card.konu_basligi,
      hapKural: card.hap_kural,
      formulSema: card.ayrintili_anlatim?.formul_sema || "",
      exampleAr: card.metinden_ornek?.arapca || "",
      exampleTr: card.metinden_ornek?.turkce || "",
      exampleAnalysis: card.metinden_ornek?.aciklama,
      kttUstKonu: card.ktt_ust_konu,
      linkedLessonUrl: null,
      linkedLessonShortLabel: null,
      linkedLessonFullTitle: null,
      grammarQuery: card.konu_basligi,
      rawNote: card,
    });
  }

  for (const note of diyalogGramerNotlari) {
    const dlg = dlgMap.get(note.bagli_id);
    const dlgNo = note.bagli_id.replace("dlg_", "");
    const level: Level = note.seviye || dlg?.seviye || "A1";
    const domainId = classifyGrammarCardDomain(note);
    items.push({
      id: `atlas_${note.bagli_id}`,
      bagliId: note.bagli_id,
      level,
      domainId,
      domainMeta: GRAMMAR_DOMAINS[domainId],
      title: note.konu_basligi,
      hapKural: note.hap_kural,
      formulSema: note.ayrintili_anlatim?.formul_sema || "",
      exampleAr: note.metinden_ornek?.arapca || "",
      exampleTr: note.metinden_ornek?.turkce || "",
      exampleAnalysis: note.metinden_ornek?.aciklama,
      kttUstKonu: note.ktt_ust_konu,
      linkedLessonUrl: `/diyalog/${note.bagli_id}`,
      linkedLessonShortLabel: `Diyalog #${dlgNo}`,
      linkedLessonFullTitle: dlg
        ? `Diyalog #${dlgNo}: ${dlg.baslik_tr}`
        : `Diyalog #${dlgNo}`,
      grammarQuery: dlg?.odak_gramer || note.konu_basligi,
      rawNote: note,
      dialogueId: note.bagli_id,
    });
  }

  for (const note of metinGramerNotlari) {
    const txt = txtMap.get(note.bagli_id);
    const txtNo = note.bagli_id.replace("metin_", "");
    const level: Level = note.seviye || txt?.seviye || "A1";
    const domainId = classifyGrammarCardDomain(note);
    items.push({
      id: `atlas_${note.bagli_id}`,
      bagliId: note.bagli_id,
      level,
      domainId,
      domainMeta: GRAMMAR_DOMAINS[domainId],
      title: note.konu_basligi,
      hapKural: note.hap_kural,
      formulSema: note.ayrintili_anlatim?.formul_sema || "",
      exampleAr: note.metinden_ornek?.arapca || "",
      exampleTr: note.metinden_ornek?.turkce || "",
      exampleAnalysis: note.metinden_ornek?.aciklama,
      kttUstKonu: note.ktt_ust_konu,
      linkedLessonUrl: `/metin/${note.bagli_id}`,
      linkedLessonShortLabel: `Metin #${txtNo}`,
      linkedLessonFullTitle: txt
        ? `Metin #${txtNo}: ${txt.baslik_tr}`
        : `Metin #${txtNo}`,
      grammarQuery: txt?.odak_gramer || note.konu_basligi,
      rawNote: note,
      readingId: note.bagli_id,
    });
  }

  // Pedagojik sıra: A1 -> A2 -> B1 -> B2, kendi kurunda Müstakil -> Diyalog -> Metin ve sıra no
  items.sort((a, b) => {
    const rA = LEVEL_RANK[a.level] ?? 99;
    const rB = LEVEL_RANK[b.level] ?? 99;
    if (rA !== rB) return rA - rB;
    const wA = getSourceOrderWeight(a.bagliId);
    const wB = getSourceOrderWeight(b.bagliId);
    if (wA !== wB) return wA - wB;
    return getNumericIndex(a.bagliId) - getNumericIndex(b.bagliId);
  });

  return items;
}

export const GRAMMAR_SHARE_BASE_URL =
  "https://arapcatellaffuzwebv2.vercel.app/kutuphane?tab=gramer&card=";

export function buildGrammarCardDeepLink(bagliId: string): string {
  return `${GRAMMAR_SHARE_BASE_URL}${encodeURIComponent(bagliId.trim())}`;
}

/**
 * WhatsApp paylaşımı için istenen standart Muallimun Gramer Atlası metnini üretir.
 */
export function buildGrammarWhatsAppText(card: GramerHapBilgi): string {
  const formul =
    card.ayrintili_anlatim?.formul_sema?.trim() ||
    "Cümle bağlamına göre hareke ve görev uyumu";
  const ornekAr = card.metinden_ornek?.arapca?.trim() || "";
  const ornekTr = card.metinden_ornek?.turkce?.trim() || "";
  const ornekCombined =
    ornekAr && ornekTr
      ? `${ornekAr} — "${ornekTr}"`
      : ornekAr || ornekTr || "-";
  const deepLink = buildGrammarCardDeepLink(card.bagli_id);

  return [
    "📌 *Muallimun Arapça Gramer Atlası*",
    `*📚 Konu:* ${card.konu_basligi}`,
    `*💡 Hap Kural:* ${card.hap_kural}`,
    `*📐 Formül:* ${formul}`,
    `*🎯 Örnek:* ${ornekCombined}`,
    "",
    "👉 *Kartı ve Çözümlü Testini İncele:*",
    deepLink,
  ].join("\n");
}

export function buildGrammarWhatsAppShareUrl(card: GramerHapBilgi): string {
  const text = buildGrammarWhatsAppText(card);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}
