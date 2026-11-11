// src/types/assessment.ts
// 180 Soruluk Seviye Tespit, 13 Konu Tarama ve Kur Bitirme Merkezi Veri Tipleri ve Yardımcıları

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
  questionCount: number;
  levelRange: string;
  summaryTr: string;
}

export const ASSESSMENT_TOPICS: AssessmentTopicMeta[] = [
  {
    ust_konu: "Zamirler ve İsim Cümlesi",
    icon: "🪪",
    questionCount: 13,
    levelRange: "A1–B1",
    summaryTr: "Muttasıl/munfasıl zamirler, mübteda-haber uyumu ve haber türleri",
  },
  {
    ust_konu: "İzâfet ve Sıfat Tamlaması",
    icon: "🔗",
    questionCount: 15,
    levelRange: "A1–B2",
    summaryTr: "Muzâf-muzâfun ileyh, sıfat-mevsûf dört yönlü uyum ve tamlamalar",
  },
  {
    ust_konu: "Günlük Kelime ve Bağlam",
    icon: "💬",
    questionCount: 14,
    levelRange: "A1–B2",
    summaryTr: "Bağlama uygun kelime seçimi, eşdizimlilik ve günlük ifadeler",
  },
  {
    ust_konu: "Harf-i Cerler ve Zarflar",
    icon: "🧭",
    questionCount: 19,
    levelRange: "A1–B2",
    summaryTr: "Mekân/zaman zarfları, fiil + harf-i cer kalıpları ve mecrûr i'rabı",
  },
  {
    ust_konu: "Soru Edatları ve İletişim",
    icon: "❓",
    questionCount: 10,
    levelRange: "A1–A2",
    summaryTr: "İstifham edatları, diyalog tamamlama ve iletişimsel tepkiler",
  },
  {
    ust_konu: "Mâzî ve Muzâri Fiil",
    icon: "⚡",
    questionCount: 17,
    levelRange: "A1–B2",
    summaryTr: "Zaman çekimleri, nasb/cezm edatları (أَنْ، لَنْ، لَمْ) ve mezîd bâblar",
  },
  {
    ust_konu: "Sayılar ve Temyiz",
    icon: "🔢",
    questionCount: 13,
    levelRange: "A1–B2",
    summaryTr: "1–100+ sayılar, saatler, sıra sayıları ve sayı-ma'dûd cinsiyet uyumu",
  },
  {
    ust_konu: "Okuduğunu Anlama",
    icon: "📖",
    questionCount: 12,
    levelRange: "A1–B2",
    summaryTr: "Paragraftan ana fikir, çıkarım, zamir referansı ve bağlam analizi",
  },
  {
    ust_konu: "İnne ve Kardeşleri",
    icon: "📌",
    questionCount: 11,
    levelRange: "A2–B2",
    summaryTr: "إِنَّ، أَنَّ، لٰكِنَّ، لَعَلَّ، لَيْتَ ve isim-haber hareke dönüşümleri",
  },
  {
    ust_konu: "Kâne, Mukârebe ve Şurû' Fiilleri",
    icon: "⏳",
    questionCount: 14,
    levelRange: "A2–B2",
    summaryTr: "كَانَ، لَيْسَ، أَصْبَحَ، كَادَ، بَدَأَ ve haberin mansûb/fiil cümlesi gelişi",
  },
  {
    ust_konu: "İsm-i Mevsûl ve Sıla Cümlesi",
    icon: "🌉",
    questionCount: 10,
    levelRange: "A2–B2",
    summaryTr: "الَّذِي، الَّتِي، الَّذِينَ، مَا/مَنْ ve âid zamiri uyumu",
  },
  {
    ust_konu: "Mef'ûller, Hâl ve İ'rab",
    icon: "🎯",
    questionCount: 12,
    levelRange: "B1–B2",
    summaryTr: "Mef'ûlün bih, mef'ûlün li-eclih, mef'ûlün mutlak, hâl ve tesniye/cemî i'rabı",
  },
  {
    ust_konu: "Şart, İstisnâ ve İleri Üslûplar",
    icon: "🏛️",
    questionCount: 20,
    levelRange: "B1–B2",
    summaryTr: "إِنْ/مَنْ/إِذَا/لَوْ şart cümleleri, إِلَّا/غَيْرُ istisnâ, taaccüb ve meçhul yapı",
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
