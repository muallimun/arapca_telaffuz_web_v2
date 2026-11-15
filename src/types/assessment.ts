// src/types/assessment.ts
// Seviye Tespit, Dinamik Konu Tarama (KTT) ve Kur Bitirme Merkezi Veri Tipleri ve Yardımcıları

import type { Level } from "@/types/data";

export type OptionLetter = "A" | "B" | "C" | "D";

export type AssessmentSkillArea =
  | "sarf_nahiv"
  | "kelime_baglam"
  | "diyalog_iletisim"
  | "okuma_anlama"
  | "hata_bulma";

export interface AssessmentOption {
  harf: OptionLetter;
  metin: string;
}

export interface PreparedAssessmentOption {
  displayHarf: OptionLetter;
  origHarf: OptionLetter;
  metin: string;
}

export interface AssessmentSolutionDetail {
  soru_cevirisi_tr: string;
  odak_kural: string;
  dogru_cevap_gerekcesi: string;
  celdirici_analizi: Partial<Record<OptionLetter, string>>;
}

export interface AssessmentQuestion {
  id: string;
  seviye: Level;
  zorluk_basamagi: 1 | 2 | 3;
  ust_konu: string;
  alt_grup?: string;
  beceri_alani: AssessmentSkillArea;
  soru_tipi: AssessmentSkillArea;
  kaynak_tipi: string;
  bagli_konu: string;
  soru_yonergesi_tr: string;
  soru_baglam_tr: string | null;
  soru_metni_ar: string;
  secenek_dili: "ar" | "tr";
  secenekler: AssessmentOption[];
  dogru_secenek: OptionLetter;
  cozum_detayi: AssessmentSolutionDetail;
}

export interface RuntimeAssessmentQuestion extends AssessmentQuestion {
  isListeningAudioItem?: boolean;
  audioTextAr?: string;
  audioSentenceId?: string;
  audioMaleUrl?: string;
  audioFemaleUrl?: string;
}

export interface AssessmentTopicMeta {
  ust_konu: string;
  icon: string;
  primaryLevel: Level;
  questionCount: number;
  levelRange: string;
  summaryTr: string;
  isGeneralSkill?: boolean;
}

/**
 * Pedagojik müfredat sırasına göre yapılandırılmış üst konular:
 * - Önce baskın CEFR kuru (A1 -> A2 -> B1 -> B2),
 * - Aynı kur içinde önce sarf_nahiv (dilbilgisi) konuları, en sonda genel beceri konuları
 *   ("Günlük Kelime ve Bağlam" -> A1 sonu, "Okuduğunu Anlama" -> A2 sonu).
 */
export const ASSESSMENT_TOPICS: AssessmentTopicMeta[] = [
  // ==================== A1 (9 Konu) ====================
  {
    ust_konu: "Şahıs ve İyelik Zamirleri",
    icon: "🪪",
    primaryLevel: "A1",
    questionCount: 14,
    levelRange: "A1",
    summaryTr: "Munfasıl (ayrı) şahıs zamirleri ve isme bitişen iyelik zamirleri",
  },
  {
    ust_konu: "İşaret İsimleri, Marife-Nekra ve Nisbet",
    icon: "👉",
    primaryLevel: "A1",
    questionCount: 14,
    levelRange: "A1",
    summaryTr: "هٰذَا/هٰذِهِ/ذٰلِكَ işaret isimleri, اَلْ belirlilik takısı ve nisbet yâ'sı",
  },
  {
    ust_konu: "İsim Cümlesi ve Var-Yok Kalıpları",
    icon: "🧱",
    primaryLevel: "A1",
    questionCount: 15,
    levelRange: "A1",
    summaryTr: "Mübteda-haber uyumu, şibih cümle haber ve هُنَاكَ/فِي/عِنْدَ var-yok yapıları",
  },
  {
    ust_konu: "İsim ve Sıfat Tamlaması (Temel)",
    icon: "🔗",
    primaryLevel: "A1",
    questionCount: 15,
    levelRange: "A1",
    summaryTr: "Muzâf-muzâfun ileyh (izâfet) kuralları ve sıfat-mevsûf dört yönlü uyum",
  },
  {
    ust_konu: "Temel Harf-i Cerler ve Zarflar",
    icon: "🧭",
    primaryLevel: "A1",
    questionCount: 18,
    levelRange: "A1",
    summaryTr: "فِي، إِلَى، مِنْ، عَلَى، عَنْ harf-i cerleri, mekân/zaman zarfları ve mecrûr i'rabı",
  },
  {
    ust_konu: "Soru Edatları ve Günlük İletişim",
    icon: "❓",
    primaryLevel: "A1",
    questionCount: 16,
    levelRange: "A1",
    summaryTr: "مَا، مَنْ، أَيْنَ، كَيْفَ، مَتَى، كَمْ، هَلْ soru edatları ve diyalog tepkileri",
  },
  {
    ust_konu: "Mâzî, Muzâri ve Emir Fiil (Temel)",
    icon: "⚡",
    primaryLevel: "A1",
    questionCount: 15,
    levelRange: "A1",
    summaryTr: "Geçmiş, şimdiki/geniş zaman ve emir kipi temel şahıs çekimleri",
  },
  {
    ust_konu: "Sayılar (1-10), Sıra Sayıları ve Saatler",
    icon: "🔢",
    primaryLevel: "A1",
    questionCount: 17,
    levelRange: "A1",
    summaryTr: "1–10 arası sayı-ma'dûd cinsiyet zıtlığı, sıra sayıları ve saat ifadeleri",
  },
  {
    ust_konu: "Günlük Kelime ve Bağlam",
    icon: "💬",
    primaryLevel: "A1",
    questionCount: 12,
    levelRange: "A1",
    summaryTr: "Günlük hayatta bağlama uygun kelime seçimi, eşdizimlilik ve kalıp ifadeler",
    isGeneralSkill: true,
  },

  // ==================== A2 (9 Konu) ====================
  {
    ust_konu: "Tesniye (İkil) İsimler, Zamirler ve Uyum",
    icon: "👥",
    primaryLevel: "A2",
    questionCount: 14,
    levelRange: "A2",
    summaryTr: "ـَانِ / ـَيْنِ ikil ekleri, tesniye zamirleri, izâfette nûn düşmesi ve cümle uyumu",
  },
  {
    ust_konu: "Cemî Türleri ve Akılsız Çoğul Uyumu",
    icon: "📚",
    primaryLevel: "A2",
    questionCount: 14,
    levelRange: "A2",
    summaryTr: "Cemî müzekker/müennes sâlim, mükesser çoğullar ve gayr-ı âkil müfred-müennes uyumu",
  },
  {
    ust_konu: "Fiil Cümlesi ve Bitişik Nesne Zamirleri",
    icon: "🎬",
    primaryLevel: "A2",
    questionCount: 13,
    levelRange: "A2",
    summaryTr: "Fiil-fâil başta tekillik kuralı, نُونُ الْوِقَايَةِ ve fiile bitişen mef'ûl zamirleri",
  },
  {
    ust_konu: "Zaman Ekleri ve Olumsuzluk Edatları",
    icon: "⏱️",
    primaryLevel: "A2",
    questionCount: 13,
    levelRange: "A2",
    summaryTr: "سَـ/سَوْفَ gelecek zaman, مَا/لَا/لَمْ/لَنْ/لَيْسَ zaman odaklı olumsuzluk ayrımları",
  },
  {
    ust_konu: "Zorunluluk, İstek ve Masdar Kullanımı",
    icon: "🎯",
    primaryLevel: "A2",
    questionCount: 13,
    levelRange: "A2",
    summaryTr: "يَجِبُ أَنْ، يُمْكِنُ أَنْ، أُرِيدُ أَنْ kalıpları ve أَنْ + mansûb muzâri / masdar dönüşümü",
  },
  {
    ust_konu: "Yaygın Harf-i Cerli Fiiller",
    icon: "🧲",
    primaryLevel: "A2",
    questionCount: 15,
    levelRange: "A2",
    summaryTr: "بَحَثَ عَنْ، حَصَلَ عَلَى، اِهْتَمَّ بِـ gibi harf-i cerle anlam kazanan temel fiiller",
  },
  {
    ust_konu: "Renk Sıfatları ve Karşılaştırma (İsm-i Tafdîl)",
    icon: "🎨",
    primaryLevel: "A2",
    questionCount: 13,
    levelRange: "A2",
    summaryTr: "أَفْعَلُ/فَعْلَاءُ renk-kusur sıfatları ve أَفْعَلُ مِنْ / الْأَفْعَلُ üstünlük yapıları",
  },
  {
    ust_konu: "Sayılar (11-99 ve 100-1000) ve Temyizi",
    icon: "🧮",
    primaryLevel: "A2",
    questionCount: 13,
    levelRange: "A2",
    summaryTr: "11–19 mebnî sayılar, ukûd (20–90), 100/1000 sayıları ve müfred mansûb/mecrûr temyiz",
  },
  {
    ust_konu: "Okuduğunu Anlama",
    icon: "📖",
    primaryLevel: "A2",
    questionCount: 12,
    levelRange: "A2",
    summaryTr: "Kısa metin ve paragraflarda ana fikir, detay yakalama, zamir referansı ve çıkarım",
    isGeneralSkill: true,
  },

  // ==================== B1 (8 Konu) ====================
  {
    ust_konu: "İnne ve Kardeşleri",
    icon: "📌",
    primaryLevel: "B1",
    questionCount: 13,
    levelRange: "B1",
    summaryTr: "إِنَّ، أَنَّ، لٰكِنَّ، كَأَنَّ، لَيْتَ، لَعَلَّ edatları ve ismin nasbı / haberin ref'i",
  },
  {
    ust_konu: "Kâne ve Kardeşleri (Nâkıs Fiiller)",
    icon: "⏳",
    primaryLevel: "B1",
    questionCount: 13,
    levelRange: "B1",
    summaryTr: "كَانَ، أَصْبَحَ، ظَلَّ، مَا زَالَ، لَيْسَ fiilleri ve mansûb/cümle haber uyumu",
  },
  {
    ust_konu: "İsm-i Mevsûller ve Sıfat Cümlesi",
    icon: "🌉",
    primaryLevel: "B1",
    questionCount: 14,
    levelRange: "B1",
    summaryTr: "الَّذِي، الَّتِي، الَّذِينَ، مَنْ/مَا bağlaçları, âid zamiri ve nekra sonrası sıfat cümlesi",
  },
  {
    ust_konu: "Muzâri Fiilin Nasbı, Cezmi ve Ef'âl-i Hamse",
    icon: "⚖️",
    primaryLevel: "B1",
    questionCount: 13,
    levelRange: "B1",
    summaryTr: "Nasb ve cezm edatları, beş fiilde (أَفْعَالُ الْخَمْسَةِ) nûn düşmesi ve emir/nehiy",
  },
  {
    ust_konu: "Sahih ve İlletli (Mu'tel) Fiiller",
    icon: "🧬",
    primaryLevel: "B1",
    questionCount: 13,
    levelRange: "B1",
    summaryTr: "Mehmûz, mudâaf, misâl, ecvef ve nâkıs fiillerin çekim ve illet harfi düşme kuralları",
  },
  {
    ust_konu: "Sülâsî Mezîd Bablar ve Masdarları",
    icon: "🏗️",
    primaryLevel: "B1",
    questionCount: 13,
    levelRange: "B1",
    summaryTr: "İf'âl, tef'îl, müfâale, infiâl, iftiâl, tefa'ul, tefâul ve istif'âl babları ile masdarları",
  },
  {
    ust_konu: "Müştak İsimler ve Esmâ-i Hamse",
    icon: "🛠️",
    primaryLevel: "B1",
    questionCount: 12,
    levelRange: "B1",
    summaryTr: "İsm-i fâil, ism-i mef'ûl, ism-i mekân/âlet ve أَبُو/أَخُو/ذُو beş ismin harfle i'rabı",
  },
  {
    ust_konu: "Meçhul Fiil ve Nâib-i Fâil",
    icon: "🔄",
    primaryLevel: "B1",
    questionCount: 13,
    levelRange: "B1",
    summaryTr: "Mâzî ve muzâri meçhul vezin dönüşümleri, illetli meçhul kalıplar ve merfû nâib-i fâil",
  },

  // ==================== B2 (3 Konu) ====================
  {
    ust_konu: "Mef'ûller, Hâl, Temyiz ve İ'rab",
    icon: "🎓",
    primaryLevel: "B2",
    questionCount: 14,
    levelRange: "B2",
    summaryTr: "Mef'ûlün bih/mutlak/li-eclih/fîh, hâl-sâhibü'l-hâl, temyiz ve ileri i'rab tahlili",
  },
  {
    ust_konu: "Şart ve İstisnâ Üslûpları",
    icon: "🏛️",
    primaryLevel: "B2",
    questionCount: 14,
    levelRange: "B2",
    summaryTr: "إِنْ/مَنْ/مَهْمَا cezmeden ve إِذَا/لَوْ/لَوْلَا cezmetmeyen şart cümleleri ile إِلَّا/غَيْرُ/سِوَى istisnâ",
  },
  {
    ust_konu: "Mukârebe-Şurû', Taaccüb ve İleri Bağlaçlar",
    icon: "✨",
    primaryLevel: "B2",
    questionCount: 12,
    levelRange: "B2",
    summaryTr: "كَادَ/أَوْشَكَ/بَدَأَ/أَخَذَ fiilleri, مَا أَفْعَلَهُ taaccüb kalıbı ve ileri akademik bağlaçlar",
  },
];

const DISPLAY_LETTERS: OptionLetter[] = ["A", "B", "C", "D"];

/**
 * Şık Karıştırma ve `celdirici_analizi` Eşleşme Kilidi:
 * - `soru_tipi === "hata_bulma"` olan sorularda şık sırasını (A-B-C-D) sabit tutar.
 * - Diğer soru tiplerinde şıkları verilen RNG ile karıştırır; her şıkkın orijinal `origHarf`
 *   değerini korur ki `dogru_secenek` ve `cozum_detayi.celdirici_analizi[origHarf]` %100 doğru eşleşsin.
 */
export function prepareQuestionOptions(
  question: Pick<AssessmentQuestion, "soru_tipi" | "secenekler">,
  rng: () => number = Math.random
): PreparedAssessmentOption[] {
  const baseOptions = [...question.secenekler];

  if (question.soru_tipi === "hata_bulma") {
    return baseOptions.map((opt, idx) => ({
      displayHarf: DISPLAY_LETTERS[idx] || opt.harf,
      origHarf: opt.harf,
      metin: opt.metin,
    }));
  }

  for (let i = baseOptions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = baseOptions[i];
    baseOptions[i] = baseOptions[j];
    baseOptions[j] = tmp;
  }

  return baseOptions.map((opt, idx) => ({
    displayHarf: DISPLAY_LETTERS[idx] || opt.harf,
    origHarf: opt.harf,
    metin: opt.metin,
  }));
}

export function isSelectedOptionCorrect(
  question: Pick<AssessmentQuestion, "dogru_secenek">,
  selectedOrigHarf: OptionLetter | null | undefined
): boolean {
  if (!selectedOrigHarf) return false;
  return selectedOrigHarf === question.dogru_secenek;
}

export function getDistractorAnalysisForSelection(
  question: Pick<AssessmentQuestion, "dogru_secenek" | "cozum_detayi">,
  selectedOrigHarf: OptionLetter | null | undefined
): string | null {
  if (!selectedOrigHarf || selectedOrigHarf === question.dogru_secenek) {
    return null;
  }
  return question.cozum_detayi?.celdirici_analizi?.[selectedOrigHarf] || null;
}

export interface DynamicAssessmentTopicMeta extends AssessmentTopicMeta {
  primaryLevel: Level;
  isGeneralSkill: boolean;
  levels: Level[];
  levelCounts: Record<Level, number>;
  skillCounts: Record<AssessmentSkillArea, number>;
  searchKeywords: string;
}

const CANONICAL_LEVELS: Level[] = ["A1", "A2", "B1", "B2"];
const LEVEL_RANK: Record<Level, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
};

const GENERAL_SKILL_TOPIC_NAMES = new Set<string>([
  "Günlük Kelime ve Bağlam",
  "Okuduğunu Anlama",
]);

/**
 * Bir `ust_konu` grubunun tekil ana seviyesini (`primaryLevel` / `dominantLevel`) belirler:
 * - Soruların en çok bulunduğu (mod/baskın) CEFR seviyesini seçer.
 * - Eşitlik durumunda pedagojik sıraya göre tanımlı ana seviyeyi (ör. Günlük Kelime ve Bağlam -> A1,
 *   Okuduğunu Anlama -> A2), tanımsız yeni konularda ise eşit seviyeler arasındaki en düşük kuru baz alır.
 */
export function resolveDominantTopicLevel(
  ust_konu: string,
  levelCounts: Record<Level, number>,
  knownPrimaryLevel?: Level
): Level {
  const maxCount = Math.max(
    levelCounts.A1,
    levelCounts.A2,
    levelCounts.B1,
    levelCounts.B2
  );
  if (maxCount <= 0) {
    if (ust_konu === "Okuduğunu Anlama") return "A2";
    if (ust_konu === "Günlük Kelime ve Bağlam") return "A1";
    return knownPrimaryLevel || "A1";
  }

  const tiedLevels = CANONICAL_LEVELS.filter(
    (lvl) => levelCounts[lvl] === maxCount
  );
  if (tiedLevels.length === 1) {
    return tiedLevels[0];
  }

  if (ust_konu === "Okuduğunu Anlama" && tiedLevels.includes("A2")) {
    return "A2";
  }
  if (ust_konu === "Günlük Kelime ve Bağlam" && tiedLevels.includes("A1")) {
    return "A1";
  }
  if (knownPrimaryLevel && tiedLevels.includes(knownPrimaryLevel)) {
    return knownPrimaryLevel;
  }
  return tiedLevels[0];
}

/**
 * Soru bankasındaki benzersiz `ust_konu` başlıklarını dinamik olarak tarar,
 * her konuya tek bir baskın kur (`primaryLevel`) atar ve kartları:
 * 1) `A1 -> A2 -> B1 -> B2` kur sırasıyla,
 * 2) Aynı kur içinde önce `sarf_nahiv` (dilbilgisi) konuları, en sonda genel beceri konuları
 *    (`Günlük Kelime ve Bağlam`, `Okuduğunu Anlama`) gelecek şekilde pedagojik olarak sıralar.
 */
export function buildDynamicAssessmentTopics(
  bank: AssessmentQuestion[]
): DynamicAssessmentTopicMeta[] {
  if (!bank || bank.length === 0) {
    return ASSESSMENT_TOPICS.map((t) => ({
      ...t,
      primaryLevel: t.primaryLevel,
      levelRange: t.primaryLevel,
      isGeneralSkill: Boolean(
        t.isGeneralSkill || GENERAL_SKILL_TOPIC_NAMES.has(t.ust_konu)
      ),
      levels: [t.primaryLevel],
      levelCounts: { A1: 0, A2: 0, B1: 0, B2: 0 },
      skillCounts: {
        sarf_nahiv: t.isGeneralSkill ? 0 : t.questionCount,
        kelime_baglam: 0,
        diyalog_iletisim: 0,
        okuma_anlama: 0,
        hata_bulma: 0,
      },
      searchKeywords: `${t.ust_konu} ${t.summaryTr}`.toLocaleLowerCase("tr-TR"),
    }));
  }

  const grouped = new Map<
    string,
    {
      count: number;
      levelCounts: Record<Level, number>;
      skillCounts: Record<AssessmentSkillArea, number>;
      subTopics: Set<string>;
      firstSeenIndex: number;
    }
  >();

  let seenCounter = 0;
  for (const q of bank) {
    const topicName = (q.ust_konu || "").trim();
    if (!topicName) continue;
    let entry = grouped.get(topicName);
    if (!entry) {
      entry = {
        count: 0,
        levelCounts: { A1: 0, A2: 0, B1: 0, B2: 0 },
        skillCounts: {
          sarf_nahiv: 0,
          kelime_baglam: 0,
          diyalog_iletisim: 0,
          okuma_anlama: 0,
          hata_bulma: 0,
        },
        subTopics: new Set<string>(),
        firstSeenIndex: seenCounter++,
      };
      grouped.set(topicName, entry);
    }
    entry.count += 1;
    if (CANONICAL_LEVELS.includes(q.seviye)) {
      entry.levelCounts[q.seviye] += 1;
    }
    if (q.beceri_alani && q.beceri_alani in entry.skillCounts) {
      entry.skillCounts[q.beceri_alani] += 1;
    }
    if (q.alt_grup) entry.subTopics.add(q.alt_grup.trim());
    if (q.bagli_konu) entry.subTopics.add(q.bagli_konu.trim());
  }

  const knownMetaMap = new Map<string, { meta: AssessmentTopicMeta; idx: number }>(
    ASSESSMENT_TOPICS.map((meta, idx) => [meta.ust_konu, { meta, idx }])
  );

  const builtWithOrder = Array.from(grouped.entries()).map(([ust_konu, stat]) => {
    const knownEntry = knownMetaMap.get(ust_konu);
    const known = knownEntry?.meta;
    const primaryLevel = resolveDominantTopicLevel(
      ust_konu,
      stat.levelCounts,
      known?.primaryLevel
    );
    const isGeneralSkill =
      GENERAL_SKILL_TOPIC_NAMES.has(ust_konu) ||
      Boolean(known?.isGeneralSkill) ||
      (stat.count > 0 && stat.skillCounts.sarf_nahiv === 0);

    const levels = CANONICAL_LEVELS.filter((lvl) => stat.levelCounts[lvl] > 0);
    const subList = Array.from(stat.subTopics);
    const summaryTr =
      known?.summaryTr ||
      (subList.length > 0
        ? subList.slice(0, 4).join(", ")
        : `${ust_konu} kapsamındaki dilbilgisi, bağlam ve anlama soruları`);

    const topicItem: DynamicAssessmentTopicMeta = {
      ust_konu,
      icon: known?.icon || "\u{1F3DB}\uFE0F",
      primaryLevel,
      questionCount: stat.count,
      levelRange: primaryLevel,
      summaryTr,
      isGeneralSkill,
      levels,
      levelCounts: stat.levelCounts,
      skillCounts: stat.skillCounts,
      searchKeywords: [ust_konu, summaryTr, primaryLevel, ...subList]
        .join(" ")
        .toLocaleLowerCase("tr-TR"),
    };

    const pedagogicalOrder =
      knownEntry !== undefined
        ? knownEntry.idx
        : 1000 + stat.firstSeenIndex;

    return { topicItem, pedagogicalOrder };
  });

  builtWithOrder.sort((a, b) => {
    const lvlDiff =
      LEVEL_RANK[a.topicItem.primaryLevel] -
      LEVEL_RANK[b.topicItem.primaryLevel];
    if (lvlDiff !== 0) return lvlDiff;

    const generalDiff =
      (a.topicItem.isGeneralSkill ? 1 : 0) -
      (b.topicItem.isGeneralSkill ? 1 : 0);
    if (generalDiff !== 0) return generalDiff;

    return a.pedagogicalOrder - b.pedagogicalOrder;
  });

  return builtWithOrder.map((x) => x.topicItem);
}

export interface ParsedArabicQuestionLine {
  speaker: string | null;
  utterance: string;
  isDialogueLine: boolean;
}

/**
 * Arapça kısaltmalardaki (ör. `د. حَسَنٌ`) noktanın RTL akışta harfle birleşmesini veya
 * komşu noktalama işaretlerine yapışmasını önlemek için nokta sonrasına RLM (`\u200F`) ekler.
 */
export function stabilizeArabicSpeakerPunctuation(text: string): string {
  if (!text) return "";
  return text.replace(
    /([\u0621-\u064A][\u064B-\u065F\u0670]*)\.(?=\s|$)/g,
    "$1.\u200F"
  );
}

/**
 * Diyalog sorularındaki `\n` satır sonlarını ayrıştırır; çok satırlı diyaloglarda
 * satır başındaki konuşmacı adını (`^([^:：]{2,28})[:：]\s*(.*)$`) ayıklar.
 * Tek satırlık düz cümlelerde (ör. `قَالَ الْمُدِيرُ: ...`) cümleyi bölmez.
 */
export function splitArabicDialogueLines(
  rawArabic: string
): ParsedArabicQuestionLine[] {
  if (!rawArabic) return [];
  const rawLines = rawArabic
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length <= 1) {
    const single = rawLines[0] || rawArabic.trim();
    return [
      {
        speaker: null,
        utterance: single,
        isDialogueLine: false,
      },
    ];
  }

  return rawLines.map((line) => {
    const match = line.match(/^([^:：]{2,28})[:：]\s*(.*)$/);
    if (match) {
      return {
        speaker: stabilizeArabicSpeakerPunctuation(match[1].trim()),
        utterance: match[2].trim(),
        isDialogueLine: true,
      };
    }
    return {
      speaker: null,
      utterance: line,
      isDialogueLine: true,
    };
  });
}

// ============================================================================
// KUR BİTİRME SINAVLARI İÇİN KATMANLI & HAFIZALI AKILLI 20 SORU SEÇİM ALGORİTMASI
// ============================================================================

export const SEEN_LEVEL_EXAM_STORAGE_PREFIX = "muallimun_seen_exam_q_";
export const WRONG_LEVEL_EXAM_STORAGE_PREFIX = "muallimun_wrong_exam_q_";
export const DEFAULT_LEVEL_EXAM_QUESTION_COUNT = 20;

export interface SimpleKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const ALL_SKILL_AREAS: AssessmentSkillArea[] = [
  "sarf_nahiv",
  "kelime_baglam",
  "diyalog_iletisim",
  "hata_bulma",
  "okuma_anlama",
];

/**
 * 20 soruluk Kur Bitirme Sınavı için hedef 5 beceri alanı dengesi:
 * - sarf_nahiv: ~8–9 soru (taban 8)
 * - kelime_baglam: ~4 soru
 * - diyalog_iletisim: ~3–4 soru (taban 4)
 * - hata_bulma: ~3 soru
 * - okuma_anlama: ~1–2 soru (taban 1, yumuşak tavan 2)
 */
export const LEVEL_EXAM_BASE_SKILL_QUOTAS: Record<AssessmentSkillArea, number> = {
  sarf_nahiv: 8,
  kelime_baglam: 4,
  diyalog_iletisim: 4,
  hata_bulma: 3,
  okuma_anlama: 1,
};

const SKILL_RARITY_PRIORITY: Record<AssessmentSkillArea, number> = {
  okuma_anlama: 5,
  hata_bulma: 4,
  diyalog_iletisim: 3,
  kelime_baglam: 2,
  sarf_nahiv: 1,
};

function resolveDefaultStorage(
  customStorage?: SimpleKeyValueStorage | null
): SimpleKeyValueStorage | null {
  if (customStorage !== undefined) return customStorage;
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function readIdListFromStorage(
  key: string,
  storage?: SimpleKeyValueStorage | null
): string[] {
  const store = resolveDefaultStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed.filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );
  } catch {
    return [];
  }
}

function writeIdListToStorage(
  key: string,
  ids: Iterable<string>,
  storage?: SimpleKeyValueStorage | null
): void {
  const store = resolveDefaultStorage(storage);
  if (!store) return;
  try {
    const unique = Array.from(new Set(ids)).filter(Boolean);
    store.setItem(key, JSON.stringify(unique));
  } catch {
    // Gizli sekme veya kota aşımında sessizce devam et
  }
}

export function getSeenLevelExamStorageKey(level: Level): string {
  return `${SEEN_LEVEL_EXAM_STORAGE_PREFIX}${level}`;
}

export function getWrongLevelExamStorageKey(level: Level): string {
  return `${WRONG_LEVEL_EXAM_STORAGE_PREFIX}${level}`;
}

export function readSeenLevelExamQuestionIds(
  level: Level,
  storage?: SimpleKeyValueStorage | null
): string[] {
  return readIdListFromStorage(getSeenLevelExamStorageKey(level), storage);
}

export function writeSeenLevelExamQuestionIds(
  level: Level,
  ids: Iterable<string>,
  storage?: SimpleKeyValueStorage | null
): void {
  writeIdListToStorage(getSeenLevelExamStorageKey(level), ids, storage);
}

export function recordLevelExamWrongQuestionIds(
  level: Level,
  wrongIds: Iterable<string>,
  correctIds: Iterable<string>,
  storage?: SimpleKeyValueStorage | null
): void {
  const existing = new Set(
    readIdListFromStorage(getWrongLevelExamStorageKey(level), storage)
  );
  for (const cId of correctIds) {
    existing.delete(cId);
  }
  for (const wId of wrongIds) {
    if (wId) existing.add(wId);
  }
  writeIdListToStorage(getWrongLevelExamStorageKey(level), existing, storage);
}

export interface LevelExamPoolSummary {
  level: Level;
  totalPoolCount: number;
  totalTopicCount: number;
  targetTopicCoverageCount: number;
  skillAreaCount: number;
  seenCount: number;
  unseenCount: number;
}

export function getLevelExamPoolSummary(
  bank: AssessmentQuestion[],
  level: Level,
  options?: {
    readStorage?: boolean;
    storage?: SimpleKeyValueStorage | null;
    targetCount?: number;
  }
): LevelExamPoolSummary {
  const targetCount = options?.targetCount ?? DEFAULT_LEVEL_EXAM_QUESTION_COUNT;
  const levelPool = bank.filter((q) => q.seviye === level);
  const topics = new Set(levelPool.map((q) => q.ust_konu));
  const skills = new Set(levelPool.map((q) => q.beceri_alani));

  const validIds = new Set(levelPool.map((q) => q.id));
  const rawSeen =
    options?.readStorage === false
      ? []
      : readSeenLevelExamQuestionIds(level, options?.storage);
  const seenCount = rawSeen.filter((id) => validIds.has(id)).length;
  const unseenCount = Math.max(0, levelPool.length - seenCount);

  return {
    level,
    totalPoolCount: levelPool.length,
    totalTopicCount: topics.size,
    targetTopicCoverageCount: Math.min(targetCount, topics.size),
    skillAreaCount: skills.size,
    seenCount,
    unseenCount,
  };
}

export interface BuildBalancedLevelExamOptions {
  targetCount?: number;
  storage?: SimpleKeyValueStorage | null;
  persistSeen?: boolean;
  mistakeQuestionIds?: Iterable<string>;
  weakTopics?: Iterable<string>;
  rng?: () => number;
}

export interface BalancedLevelExamResult {
  questions: AssessmentQuestion[];
  level: Level;
  totalPoolCount: number;
  totalTopicCount: number;
  selectedTopicCount: number;
  selectedSkillAreaCount: number;
  freshUnseenSelectedCount: number;
  cycleResetOccurred: boolean;
  remainingUnseenAfterSelection: number;
  skillBreakdown: Record<AssessmentSkillArea, number>;
}

function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Kur Bitirme Sınavları için 4 katmanlı akıllı soru seçim motoru:
 * 1) Çözülmüş Soru Hafızası (`muallimun_seen_exam_q_${level}`): Daha önce sorulmamış sorulara 1. önceliği verir;
 *    havuzda < 20 çözülmemiş soru kaldığında kalan görülmemişlere + yanlış yapılanlara öncelik verip döngüyü sıfırlar.
 * 2) Üst Konu (`ust_konu`) Temsil Garantisi (Round-Robin): Kura ait tüm konuları homojen tarar, tek bir konudan 4-5 soru yığılmasını önler.
 * 3) 5 Beceri Alanı (`beceri_alani`) Dengesi: sarf_nahiv (~8-9), kelime_baglam (~4), diyalog_iletisim (~3-4), hata_bulma (~3), okuma_anlama (~1-2).
 * 4) Kademeli Zorluk Sıralaması: Seçilen 20 soruyu `zorluk_basamagi` (1 -> 2 -> 3) sırasıyla ve aynı konuları arka arkaya getirmeden dizer.
 */
export function buildBalancedLevelExamQuestions(
  bank: AssessmentQuestion[],
  level: Level,
  options?: BuildBalancedLevelExamOptions
): BalancedLevelExamResult {
  const rng = options?.rng ?? Math.random;
  const persistSeen = options?.persistSeen !== false;
  const levelPool = bank.filter((q) => q.seviye === level);
  const targetCount = Math.min(
    options?.targetCount ?? DEFAULT_LEVEL_EXAM_QUESTION_COUNT,
    levelPool.length
  );

  const emptySkills: Record<AssessmentSkillArea, number> = {
    sarf_nahiv: 0,
    kelime_baglam: 0,
    diyalog_iletisim: 0,
    hata_bulma: 0,
    okuma_anlama: 0,
  };

  if (targetCount <= 0) {
    return {
      questions: [],
      level,
      totalPoolCount: 0,
      totalTopicCount: 0,
      selectedTopicCount: 0,
      selectedSkillAreaCount: 0,
      freshUnseenSelectedCount: 0,
      cycleResetOccurred: false,
      remainingUnseenAfterSelection: 0,
      skillBreakdown: emptySkills,
    };
  }

  const validIdSet = new Set(levelPool.map((q) => q.id));
  const priorSeenIds = readSeenLevelExamQuestionIds(
    level,
    options?.storage
  ).filter((id) => validIdSet.has(id));
  const priorSeenSet = new Set(priorSeenIds);

  const storedWrongIds = readIdListFromStorage(
    getWrongLevelExamStorageKey(level),
    options?.storage
  );
  const mistakeSet = new Set<string>(storedWrongIds);
  if (options?.mistakeQuestionIds) {
    for (const mId of options.mistakeQuestionIds) {
      if (mId) mistakeSet.add(mId);
    }
  }
  const weakTopicSet = new Set<string>(options?.weakTopics ?? []);

  const unseenInPool = levelPool.filter((q) => !priorSeenSet.has(q.id));
  const cycleResetOccurred =
    levelPool.length >= targetCount && unseenInPool.length < targetCount;

  // Ölçeklenmiş hedef beceri kotaları (20 soru için 8 / 4 / 4 / 3 / 1)
  const scale = targetCount / DEFAULT_LEVEL_EXAM_QUESTION_COUNT;
  const targetSkillQuotas: Record<AssessmentSkillArea, number> = {
    sarf_nahiv: Math.max(1, Math.round(LEVEL_EXAM_BASE_SKILL_QUOTAS.sarf_nahiv * scale)),
    kelime_baglam: Math.max(
      1,
      Math.round(LEVEL_EXAM_BASE_SKILL_QUOTAS.kelime_baglam * scale)
    ),
    diyalog_iletisim: Math.max(
      1,
      Math.round(LEVEL_EXAM_BASE_SKILL_QUOTAS.diyalog_iletisim * scale)
    ),
    hata_bulma: Math.max(1, Math.round(LEVEL_EXAM_BASE_SKILL_QUOTAS.hata_bulma * scale)),
    okuma_anlama: Math.max(
      1,
      Math.round(LEVEL_EXAM_BASE_SKILL_QUOTAS.okuma_anlama * scale)
    ),
  };

  // Yumuşak üst tavanlar (tek beceri alanına aşırı yığılmayı önler)
  const softMaxSkillCaps: Record<AssessmentSkillArea, number> = {
    sarf_nahiv: Math.max(targetSkillQuotas.sarf_nahiv + 1, 9),
    kelime_baglam: Math.max(targetSkillQuotas.kelime_baglam + 1, 5),
    diyalog_iletisim: Math.max(targetSkillQuotas.diyalog_iletisim, 4),
    hata_bulma: Math.max(targetSkillQuotas.hata_bulma + 1, 4),
    okuma_anlama: Math.max(targetSkillQuotas.okuma_anlama + 1, 2),
  };

  // Konu gruplarını oluştur (her grup içi karıştırılmış)
  const byTopic = new Map<string, AssessmentQuestion[]>();
  for (const q of shuffleWithRng(levelPool, rng)) {
    const t = q.ust_konu;
    const arr = byTopic.get(t);
    if (arr) arr.push(q);
    else byTopic.set(t, [q]);
  }

  const allTopicNames = Array.from(byTopic.keys());
  const totalTopicCount = allTopicNames.length;

  // Konu başına azami soru sınırı:
  // - 16+ konu varsa (A1=16, A2=19, B1=21): konu başına en fazla 2 soru
  // - 10-15 konu varsa (B2=10): konu başına en fazla 3 soru
  // - Daha az konu varsa: Math.ceil(targetCount / totalTopicCount) + 1
  const strictMaxPerTopic =
    totalTopicCount >= 16
      ? 2
      : totalTopicCount >= 9
      ? 3
      : Math.ceil(targetCount / Math.max(1, totalTopicCount)) + 1;

  const selectedIds = new Set<string>();
  const selectedQuestions: AssessmentQuestion[] = [];
  const topicPickedCounts: Record<string, number> = {};
  const skillPickedCounts: Record<AssessmentSkillArea, number> = {
    ...emptySkills,
  };

  // Konu içinden mevcut beceri açığına ve hafıza önceliğine göre en uygun adayı puanla
  const pickBestCandidateFromTopic = (
    topicName: string,
    tierFilter: "unseen_only" | "mistake_or_unseen" | "any",
    respectSkillCap: boolean
  ): AssessmentQuestion | null => {
    const candidates = byTopic.get(topicName) || [];
    let bestQ: AssessmentQuestion | null = null;
    let bestScore = -Infinity;

    for (const q of candidates) {
      if (selectedIds.has(q.id)) continue;
      const isUnseen = !priorSeenSet.has(q.id);
      const isMistake = mistakeSet.has(q.id);

      if (tierFilter === "unseen_only" && !isUnseen) continue;
      if (tierFilter === "mistake_or_unseen" && !isUnseen && !isMistake) {
        continue;
      }

      const sk = q.beceri_alani;
      const pickedForSkill = skillPickedCounts[sk] || 0;
      if (respectSkillCap && pickedForSkill >= softMaxSkillCaps[sk]) {
        continue;
      }

      const deficit = targetSkillQuotas[sk] - pickedForSkill;
      let score = 0;

      // 1. Öncelik: Çözülmemiş soru -> Yanlış yapılmış soru -> Tekrar havuzu
      if (isUnseen) score += 1000;
      else if (isMistake) score += 500;

      // 2. Öncelik: Beceri kotası açığı (henüz dolmamış beceriler güçlü pozitif puan alır)
      if (deficit > 0) {
        score += 120 + deficit * 35 + SKILL_RARITY_PRIORITY[sk] * 12;
      } else if (pickedForSkill < softMaxSkillCaps[sk]) {
        score += 20 - (pickedForSkill - targetSkillQuotas[sk]) * 15;
      } else {
        score -= 80;
      }

      // Zayıf olunan üst konulara ikinci turda küçük pedagojik destek
      if (weakTopicSet.has(topicName)) {
        score += 8;
      }

      if (score > bestScore) {
        bestScore = score;
        bestQ = q;
      }
    }

    return bestQ;
  };

  const commitQuestion = (q: AssessmentQuestion) => {
    selectedIds.add(q.id);
    selectedQuestions.push(q);
    topicPickedCounts[q.ust_konu] = (topicPickedCounts[q.ust_konu] || 0) + 1;
    skillPickedCounts[q.beceri_alani] =
      (skillPickedCounts[q.beceri_alani] || 0) + 1;
  };

  // Konuları Round-Robin için sırala:
  // Nadir beceri (`okuma_anlama`) içeren veya tek beceriye kilitli konular önce ziyaret edilir ki
  // çok becerili konular kalan kotaları esnekçe tamamlasın (eşitlikte rastgele sıra korunur).
  const buildOrderedTopics = (
    tierFilter: "unseen_only" | "mistake_or_unseen" | "any"
  ): string[] => {
    const shuffledTopics = shuffleWithRng(allTopicNames, rng);
    return shuffledTopics.sort((tA, tB) => {
      const availA = (byTopic.get(tA) || []).filter((q) => {
        if (selectedIds.has(q.id)) return false;
        if (tierFilter === "unseen_only") return !priorSeenSet.has(q.id);
        if (tierFilter === "mistake_or_unseen") {
          return !priorSeenSet.has(q.id) || mistakeSet.has(q.id);
        }
        return true;
      });
      const availB = (byTopic.get(tB) || []).filter((q) => {
        if (selectedIds.has(q.id)) return false;
        if (tierFilter === "unseen_only") return !priorSeenSet.has(q.id);
        if (tierFilter === "mistake_or_unseen") {
          return !priorSeenSet.has(q.id) || mistakeSet.has(q.id);
        }
        return true;
      });

      const hasReadingA = availA.some((q) => q.beceri_alani === "okuma_anlama")
        ? 1
        : 0;
      const hasReadingB = availB.some((q) => q.beceri_alani === "okuma_anlama")
        ? 1
        : 0;
      if (hasReadingA !== hasReadingB) return hasReadingB - hasReadingA;

      const skillDiversityA = new Set(availA.map((q) => q.beceri_alani)).size;
      const skillDiversityB = new Set(availB.map((q) => q.beceri_alani)).size;
      if (skillDiversityA !== skillDiversityB) {
        return skillDiversityA - skillDiversityB;
      }
      return 0;
    });
  };

  const runRoundRobinPasses = (
    tierFilter: "unseen_only" | "mistake_or_unseen" | "any",
    maxPerTopicCap: number,
    respectSkillCap: boolean
  ) => {
    for (let round = 0; round < maxPerTopicCap; round++) {
      if (selectedQuestions.length >= targetCount) break;
      const orderedTopics = buildOrderedTopics(tierFilter);
      let addedInRound = false;

      for (const topicName of orderedTopics) {
        if (selectedQuestions.length >= targetCount) break;
        const currentTopicCount = topicPickedCounts[topicName] || 0;
        if (currentTopicCount > round || currentTopicCount >= maxPerTopicCap) {
          continue;
        }

        const chosen = pickBestCandidateFromTopic(
          topicName,
          tierFilter,
          respectSkillCap
        );
        if (chosen) {
          commitQuestion(chosen);
          addedInRound = true;
        }
      }

      // Eğer mevcut round sınırında ilerleme olmadıysa bir üst rounda geçebilmek için
      // halihazırda 1 soru almış konuların da 2. soruyu almasına izin ver
      if (!addedInRound) {
        for (const topicName of orderedTopics) {
          if (selectedQuestions.length >= targetCount) break;
          if ((topicPickedCounts[topicName] || 0) >= maxPerTopicCap) continue;
          const chosen = pickBestCandidateFromTopic(
            topicName,
            tierFilter,
            respectSkillCap
          );
          if (chosen) {
            commitQuestion(chosen);
          }
        }
      }
    }
  };

  // AŞAMA 1: Önce çözülmemiş sorulardan sıkı konu ve beceri dengesiyle Round-Robin
  runRoundRobinPasses("unseen_only", strictMaxPerTopic, true);
  if (selectedQuestions.length < targetCount) {
    runRoundRobinPasses("unseen_only", strictMaxPerTopic, false);
  }
  // Bazı az sorulu köprü konular tükendiğinde kalan çözülmemiş soruların hiçbirini geride bırakmamak için konu tavanını kademeli esnet
  if (selectedQuestions.length < targetCount) {
    runRoundRobinPasses("unseen_only", strictMaxPerTopic + 1, true);
    runRoundRobinPasses("unseen_only", strictMaxPerTopic + 2, false);
    runRoundRobinPasses("unseen_only", levelPool.length, false);
  }

  // AŞAMA 2: Döngü sıfırlama durumundaysa (< 20 çözülmemiş kaldıysa) önce yanlış yapılanları dahil et
  if (selectedQuestions.length < targetCount) {
    runRoundRobinPasses("mistake_or_unseen", strictMaxPerTopic, true);
    runRoundRobinPasses("mistake_or_unseen", strictMaxPerTopic, false);
    runRoundRobinPasses("mistake_or_unseen", strictMaxPerTopic + 2, false);
    runRoundRobinPasses("mistake_or_unseen", levelPool.length, false);
  }

  // AŞAMA 3: Tam havuzdan konu ve beceri dengesini koruyarak 20 soruya tamamla
  if (selectedQuestions.length < targetCount) {
    runRoundRobinPasses("any", strictMaxPerTopic, true);
    runRoundRobinPasses("any", strictMaxPerTopic, false);
    runRoundRobinPasses("any", levelPool.length, false);
  }

  const freshUnseenSelectedCount = selectedQuestions.filter(
    (q) => !priorSeenSet.has(q.id)
  ).length;

  // AŞAMA 4: Kademeli Zorluk Sıralaması (zorluk_basamagi: 1 -> 2 -> 3)
  // Aynı zorluk basamağı içinde aynı üst konunun peş peşe gelmemesini sağla
  const orderedFinal: AssessmentQuestion[] = [];
  for (const diffTier of [1, 2, 3] as const) {
    const bucket = shuffleWithRng(
      selectedQuestions.filter((q) => q.zorluk_basamagi === diffTier),
      rng
    );
    while (bucket.length > 0) {
      const prevTopic =
        orderedFinal.length > 0
          ? orderedFinal[orderedFinal.length - 1].ust_konu
          : null;
      const nonAdjacentIdx = prevTopic
        ? bucket.findIndex((q) => q.ust_konu !== prevTopic)
        : 0;
      const pickIdx = nonAdjacentIdx >= 0 ? nonAdjacentIdx : 0;
      orderedFinal.push(bucket[pickIdx]);
      bucket.splice(pickIdx, 1);
    }
  }
  // Olası farklı zorluk basamağı değerlerine karşı güvenlik
  if (orderedFinal.length < selectedQuestions.length) {
    const placed = new Set(orderedFinal.map((q) => q.id));
    for (const q of selectedQuestions) {
      if (!placed.has(q.id)) orderedFinal.push(q);
    }
    orderedFinal.sort((a, b) => a.zorluk_basamagi - b.zorluk_basamagi);
  }

  // Çözülmüş soru hafızasını güncelle
  const nextSeenIds = cycleResetOccurred
    ? orderedFinal.map((q) => q.id)
    : [...priorSeenIds, ...orderedFinal.map((q) => q.id)];

  if (persistSeen) {
    writeSeenLevelExamQuestionIds(level, nextSeenIds, options?.storage);
  }

  const uniqueNextSeenCount = new Set(
    nextSeenIds.filter((id) => validIdSet.has(id))
  ).size;
  const remainingUnseenAfterSelection = Math.max(
    0,
    levelPool.length - uniqueNextSeenCount
  );

  const selectedTopicsSet = new Set(orderedFinal.map((q) => q.ust_konu));
  const selectedSkillsSet = new Set(
    orderedFinal.map((q) => q.beceri_alani).filter((s) => ALL_SKILL_AREAS.includes(s))
  );

  return {
    questions: orderedFinal,
    level,
    totalPoolCount: levelPool.length,
    totalTopicCount,
    selectedTopicCount: selectedTopicsSet.size,
    selectedSkillAreaCount: selectedSkillsSet.size,
    freshUnseenSelectedCount,
    cycleResetOccurred,
    remainingUnseenAfterSelection,
    skillBreakdown: skillPickedCounts,
  };
}
