"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { GramerHapBilgi, GrammarDetailLayer } from "@/types/data";
import WordTooltip from "@/components/ui/WordTooltip";
import {
  diyalogGramerNotlari,
  metinGramerNotlari,
  diyaloglar,
  metinler,
  cumleler1111,
} from "@/lib/data";
import { speakHybrid, playDualGenderAudio, stopAllAudio } from "@/lib/audio";
import { useSettings } from "@/store/settings";
import { playClick } from "@/lib/sfxManager";
import {
  BookOpen,
  Sparkles,
  Volume2,
  Mic,
  Lightbulb,
  Target,
  X,
  PanelRight,
  Maximize2,
  Gamepad2,
  ExternalLink,
  Layers,
  ArrowRight,
  Table2,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Compass,
} from "lucide-react";

export type { GrammarDetailLayer } from "@/types/data";

type Cumle1111Item = (typeof cumleler1111)[number];

/**
 * Türkçe ve Arapça gramer başlıklarını normalize ederek akıllı eşleştirme yapar.
 */
function normalizeTrKey(str?: string): string {
  if (!str) return "";
  return str
    .toLocaleLowerCase("tr-TR")
    .replace(/[âîû]/g, (m) => ({ â: "a", î: "i", û: "u" }[m] || m))
    .replace(/['’`´]/g, "")
    .trim();
}

function extractTurkishCoreTopic(title: string): string {
  const withoutArabic = title
    .replace(/\([^)]*[\u0600-\u06FF]+[^)]*\)/g, "")
    .trim();
  const afterColon = withoutArabic.includes(":")
    ? withoutArabic.split(":")[1].trim()
    : withoutArabic;
  return afterColon || withoutArabic || title;
}

function hasArabicScript(str?: string): boolean {
  if (!str) return false;
  return /[\u0600-\u06FF]/.test(str);
}

/**
 * Konu başlığı ve kural içeriğine göre otomatik Görsel Formül & Şema üretir.
 */
function inferFormulaSchema(note: GramerHapBilgi): string {
  const key = normalizeTrKey(`${note.konu_basligi} ${note.hap_kural}`);

  if (key.includes("mubteda") || key.includes("isim cumlesi")) {
    return "[Mübteda (المبتدأ): Marife (الـ) + Merfû (ـُ)]  +  [Haber (الخبر): Nekre + Merfû (ـٌ)]  ➔  İsim Cümlesi (الجملة الاسمية)";
  }
  if (key.includes("izafet") || key.includes("muzaf")) {
    return "[Muzâf (المضاف): الـ ve Tenvin Almaz]  +  [Muzâfun İleyh (المضاف إليه): Daima Mecrûr / Kesralı (ـِ / ـٍ)]  ➔  İzâfet Terkibi (الإضافة)";
  }
  if (key.includes("sifat") || key.includes("mevsuf")) {
    return "[Mevsûf / Nitelenen İsim]  +  [Sıfat (الصفة): Marifelik + Cinsiyet + Sayı + İ'rab Bakımından Birebir Uyum]  ➔  Sıfat Tamlaması";
  }
  if (key.includes("inne") || key.includes("إن")) {
    return "[İnne ve Kardeşleri (إِنَّ / أَنَّ / لَكِنَّ)]  +  [İnne'nin İsmi: Mansûb / Fethalı (ـَ)]  +  [İnne'nin Haberi: Merfû / Dammeli (ـٌ)]";
  }
  if (key.includes("kane") || key.includes("كان")) {
    return "[Kâne ve Kardeşleri (كَانَ / أَصْبَحَ / لَيْسَ)]  +  [Kâne'nin İsmi: Merfû / Dammeli (ـُ)]  +  [Kâne'nin Haberi: Mansûb / Fethalı (ـً)]";
  }
  if (key.includes("harf-i cer") || key.includes("cer") || key.includes("mecrur")) {
    return "[Harf-i Cer (فِي / مِنْ / إِلَى / عَلَى / بـِ / لـِ)]  +  [İsim: Daima Mecrûr / Sonu Kesralı (ـِ / ـٍ)]  ➔  Şibih Cümle (الجار والمجرور)";
  }
  if (key.includes("mazi") || key.includes("gecmis zaman")) {
    return "[Mâzî Fiil Kökü (فَعَلَ - Sonu Fetha Üzere Mebnî)]  +  [Fâil / Özne (الفاعل): Merfû (ـُ) veya Bitişik Zamir]  +  [Mef'ûlün Bih: Mansûb (ـَ)]";
  }
  if (key.includes("muzari") || key.includes("simdiki") || key.includes("genis zaman")) {
    return "[Muzâriikk Harfi (أَ / نَ / يَ / تَ)]  +  [Fiil Gövdesi (يَفْعَلُ - Merfû ـُ)]  +  [Fâil (Özne)]  +  [Mef'ûl / Tümleç]";
  }
  if (key.includes("emir") || key.includes("nehiy")) {
    return "[Emir / Nehiy Kalıbı (اِفْعَلْ / لَا تَفْعَلْ - Sonu Sükûn / Cezm Üzere)]  +  [Muhatap Zamiri (أَنْتَ / أَنْتِ / أَنْتُمْ)]  +  [Mef'ûlün Bih (ـَ)]";
  }
  if (key.includes("fiil cumlesi") || key.includes("fail") || key.includes("meful")) {
    return "[Fiil (الفعل)]  +  [Fâil / Özne (الفاعل): Merfû / Dammeli (ـُ)]  +  [Mef'ûlün Bih / Nesne (المفعول به): Mansûb / Fethalı (ـَ)]";
  }
  if (key.includes("soru") || key.includes("istifham")) {
    return "[Soru Edatı (هَلْ / مَا / مَنْ / أَيْنَ / كَيْفَ / مَتَى)]  +  [İsim veya Fiil Cümlesi]  ➔  [Cevap: نَعَمْ / لَا veya Doğrudan Bilgi]";
  }
  if (key.includes("isaret") || key.includes("هذا") || key.includes("هذه")) {
    return "[İşaret İsmi (هٰذَا / هٰذِهِ / هٰؤُلَاءِ - Cinsiyet & Sayı Uyumu)]  +  [Müşârun İleyh / Haber]  ➔  İşaret Cümlesi";
  }
  if (key.includes("mevsul") || key.includes("الذي") || key.includes("التي")) {
    return "[Marife İsim]  +  [İsm-i Mevsûl (الَّذِي / الَّتِي / الَّذِينَ)]  +  [Sıla Cümlesi (İçinde Âid Zamiri Bulunan Cümle)]";
  }
  if (key.includes("zamir") || key.includes("muttasil") || key.includes("munfasil")) {
    return "[İsim + Bitişik Zamir (ـهُ / ـهَا / ـكَ / ـي) ➔ Muzâfun İleyh]   veya   [Fiil + Bitişik Zamir ➔ Mef'ûlün Bih]";
  }
  if (key.includes("sart") || key.includes("إِنْ") || key.includes("إِذَا") || key.includes("لَوْ")) {
    return "[Şart Edatı (إِنْ / إِذَا / مَنْ / لَوْ)]  +  [1. Şart Cümlesi (فعل الشرط)]  ➔  [2. Cevap/Sonuç Cümlesi (جواب الشرط)]";
  }

  return `[Odak Kural: ${extractTurkishCoreTopic(note.konu_basligi)}]  +  [Kelime / İ'rab Uyumu]  ➔  [Örnek Kalıp: ${note.metinden_ornek?.arapca || ""}]`;
}

/**
 * Örnek cümlenin her bir kelimesini ve metinden_ornek.aciklama notunu kullanarak
 * Kelime Kelime İ'rab & Öge Tahlili üretir.
 */
function buildWordByWordIrabAnalysis(
  note: GramerHapBilgi
): Array<{ kelime: string; gorevi: string; hareke_nedeni: string }> {
  const arabicSentence = (note.metinden_ornek?.arapca || "").trim();
  const explanation = (note.metinden_ornek?.aciklama || "").trim();
  if (!arabicSentence) return [];

  const rawWords = arabicSentence
    .replace(/[،؛؟.!«»"()]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const prepositions = new Set([
    "فِي",
    "في",
    "مِنْ",
    "من",
    "مِنَ",
    "إِلَى",
    "إلى",
    "عَلَى",
    "على",
    "عَنْ",
    "عن",
    "مَعَ",
    "مع",
    "بَيْنَ",
    "بين",
    "أَمَامَ",
    "خَلْفَ",
    "فَوْقَ",
    "تَحْتَ",
    "بَعْدَ",
    "قَبْلَ",
    "عِنْدَ",
  ]);
  const questionParticles = new Set([
    "هَلْ",
    "هل",
    "أَيْنَ",
    "أين",
    "كَيْفَ",
    "كيف",
    "مَتَى",
    "متى",
    "مَاذَا",
    "ماذا",
    "لِمَاذَا",
    "لماذا",
    "كَمْ",
    "كم",
    "مَنْ",
    "مَا",
  ]);
  const inneGroup = new Set([
    "إِنَّ",
    "إنّ",
    "أَنَّ",
    "لَكِنَّ",
    "كَأَنَّ",
    "لَيْتَ",
    "لَعَلَّ",
  ]);
  const kaneGroup = new Set([
    "كَانَ",
    "كان",
    "كَانَتْ",
    "أَصْبَحَ",
    "لَيْسَ",
    "لَيْسَتْ",
    "صَارَ",
    "مَا زَالَ",
  ]);
  const pronouns = new Set([
    "أَنَا",
    "أنا",
    "أَنْتَ",
    "أنتَ",
    "أَنْتِ",
    "أنتِ",
    "هُوَ",
    "هو",
    "هِيَ",
    "هي",
    "نَحْنُ",
    "نحن",
    "هُمْ",
    "هم",
    "أَنْتُمْ",
    "هٰذَا",
    "هَذَا",
    "هذا",
    "هٰذِهِ",
    "هَذِهِ",
    "هذه",
    "ذٰلِكَ",
    "تِلْكَ",
  ]);

  // Açıklama içindeki cümlecikleri ayrıştır
  const expClauses = explanation
    .split(/[.;•]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return rawWords.map((word, idx) => {
    const prevWord = idx > 0 ? rawWords[idx - 1] : "";
    const matchingClause = expClauses.find((c) => c.includes(word));

    // Son harekeyi tespit et
    const lastChar = word.slice(-1);
    const endsWithDammatayn = /\u064C$/.test(word);
    const endsWithDamma = /\u064F$/.test(word);
    const endsWithFathatayn = /\u064B|\u064B[\u0627\u0649]$/.test(word);
    const endsWithFatha = /\u064E$/.test(word);
    const endsWithKasratayn = /\u064D$/.test(word);
    const endsWithKasra = /\u0650$/.test(word);
    const endsWithSukun = /\u0652$/.test(word);
    const startsWithAl = /^ال|^وَ?ال|^فَ?ال/.test(word);
    const startsWithBiLiKa = /^(بِ|لِ|كَ)/.test(word) && word.length > 3;

    let gorevi = "Cümle Ögesi";
    let hareke_nedeni = "";

    if (prepositions.has(word)) {
      gorevi = "Harf-i Cer / Zarf (حرف جر / ظرف)";
      hareke_nedeni =
        "Mebnî edattır; kendisinden sonra gelen ismi cer eder (sonunu kesralı ـِ / ـٍ yapar).";
    } else if (questionParticles.has(word)) {
      gorevi = "İstifham / Soru Edatı (أداة استفهام)";
      hareke_nedeni =
        "Cümleye soru anlamı katar; mebnî olduğu için son harekesi değişmez.";
    } else if (inneGroup.has(word)) {
      gorevi = "Te'kid / Nasb Edatı (حرف ناسخ - إنّ)";
      hareke_nedeni =
        "İsim cümlesinin başına gelerek mübtedayı nasb (fethalı ـَ), haberi ref (dammeli ـُ) yapar.";
    } else if (kaneGroup.has(word)) {
      gorevi = "Nâkıs Fiil (فعل ناسخ - كان)";
      hareke_nedeni =
        "İsim cümlesinin başına gelerek ismini merfû (dammeli ـُ), haberini mansûb (fethalı ـً) yapar.";
    } else if (pronouns.has(word)) {
      gorevi =
        idx === 0
          ? "Mübteda / Zamir veya İşaret İsmi (مبتدأ)"
          : "Zamir / İşaret İsmi (ضمير / اسم إشارة)";
      hareke_nedeni =
        "Mebnî (sonu değişmeyen) isimdir; cümledeki konumuna göre mahallen merfû/mansûb/mecrûr olur.";
    } else if (startsWithBiLiKa) {
      gorevi = "Harf-i Cer + Mecrûr İsim (جار ومجرور)";
      hareke_nedeni =
        "Başındaki harf-i cer (بِـ / لِـ / كَـ) sebebiyle mecrûrdur; cer alameti sonundaki kesradır (ـِ).";
    } else if (prepositions.has(prevWord)) {
      gorevi = "Mecrûr İsim / Muzâfun İleyh (اسم مجرور)";
      hareke_nedeni = `Öncesindeki "${prevWord}" edatı sebebiyle mecrûrdur; cer alameti kesradır (ـِ / ـٍ).`;
    } else if (inneGroup.has(prevWord)) {
      gorevi = "İnne'nin İsmi (اسم إنّ - Mansûb)";
      hareke_nedeni = `Öncesindeki "${prevWord}" edatı sebebiyle mansûbtur; nasb alameti fethadır (ـَ).`;
    } else if (endsWithDammatayn) {
      gorevi =
        idx === 0
          ? "Mübteda (مبتدأ مرفوع)"
          : "Haber veya Sıfat (خبر / صفة - Merfû)";
      hareke_nedeni =
        "Merfû konumundadır ve nekre (belirsiz) olduğu için sonunda tenvin ötre (ـٌ) bulunmaktadır.";
    } else if (endsWithDamma) {
      if (idx === 0 && startsWithAl) {
        gorevi = "Mübteda (مبتدأ مرفوع)";
        hareke_nedeni =
          "İsim cümlesinin öznesidir (mübteda); başında الـ takısı olduğu için tenvinsiz tek ötre (ـُ) ile merfûdur.";
      } else if (/^(يَ|تَ|أَ|نَ)/.test(word) && !startsWithAl) {
        gorevi = "Muzâri Fiil (فعل مضارع مرفوع)";
        hareke_nedeni =
          "Başında nasb veya cezm edatı bulunmadığı için merfûdur; ref alameti sonundaki dammedir (ـُ).";
      } else {
        gorevi = "Merfû Öge (Fâil / Mübteda / Haber)";
        hareke_nedeni =
          "Merfû konumundadır; ref alameti sonundaki ötre (damme ـُ) harekesidir.";
      }
    } else if (endsWithFathatayn || endsWithFatha) {
      if (idx === 0 && !startsWithAl) {
        gorevi = "Mâzî Fiil veya Edat (فعل ماضٍ / أداة)";
        hareke_nedeni =
          "Mâzî fiil veya edat olarak fetha (ـَ) üzere mebnîdir; cümleyi başlatır.";
      } else {
        gorevi = "Mansûb Öge (Mef'ûlün Bih / Zarf / Haber)";
        hareke_nedeni = endsWithFathatayn
          ? "Mansûb konumundadır; nekre olduğu için nasb alameti iki üstün (tenvin fetha ـً) harekesidir."
          : "Mansûb (fethalı ـَ) konumundadır veya fetha üzere mebnîdir.";
      }
    } else if (endsWithKasratayn || endsWithKasra) {
      gorevi = "Mecrûr İsim / Muzâfun İleyh (مجرور / مضاف إليه)";
      hareke_nedeni = endsWithKasratayn
        ? "Muzâfun ileyh veya harf-i cerden sonra geldiği için mecrûrdur; nekre olduğundan tenvin kesra (ـٍ) almıştır."
        : "Harf-i cer veya izâfet (tamlama) sebebiyle mecrûrdur; cer alameti sonundaki kesradır (ـِ).";
    } else if (endsWithSukun) {
      gorevi = "Meczûm / Sükûn Üzere Mebnî (مجزوم / مبني على السكون)";
      hareke_nedeni =
        "Sonu cezm (sükûn ـْ) harekesi üzeredir (emir fiil, meczûm muzâri veya sükûn üzere mebnî edat/zamir).";
    } else {
      gorevi =
        idx === 0
          ? "Başlangıç Ögesi (Mübteda / Fiil)"
          : `Cümle Ögesi (${lastChar})`;
      hareke_nedeni =
        "Cümle içindeki dizilimine ve odak gramer kuralına göre harekelenmiştir.";
    }

    if (matchingClause) {
      hareke_nedeni = `${matchingClause}. (${hareke_nedeni})`;
    }

    return {
      kelime: word,
      gorevi,
      hareke_nedeni,
    };
  });
}

/**
 * Herhangi bir GramerHapBilgi kaydı için (ayrintili_anlatim alanı olsun veya olmasın)
 * 5 bölümlü zengin GrammarDetailLayer verisini üretir.
 */
export function buildSmartGrammarDetailLayer(
  note: GramerHapBilgi,
  matchingSentences: Cumle1111Item[] = []
): Required<GrammarDetailLayer> {
  const custom = note.ayrintili_anlatim;

  // 1. Görsel Formül & Cümle Şeması
  const formul_sema =
    custom?.formul_sema && custom.formul_sema.trim().length > 0
      ? custom.formul_sema
      : inferFormulaSchema(note);

  // 2. Adım Adım Konu Özeti
  let adim_adim_anlatim: string[] = [];
  if (
    custom?.adim_adim_anlatim &&
    Array.isArray(custom.adim_adim_anlatim) &&
    custom.adim_adim_anlatim.length > 0
  ) {
    adim_adim_anlatim = custom.adim_adim_anlatim;
  } else {
    const ruleSentences = (note.hap_kural || "")
      .split(/(?<=[.!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    const analysisSentences = (note.metinden_ornek?.aciklama || "")
      .split(/(?<=[.!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);

    adim_adim_anlatim = [
      ...ruleSentences,
      ...analysisSentences,
      note.ipucu ? `Pratik İpucu: ${note.ipucu}` : "",
    ].filter(Boolean);

    if (adim_adim_anlatim.length < 3) {
      adim_adim_anlatim.push(
        `Örnek cümle olan "${note.metinden_ornek?.arapca || ""}" (${note.metinden_ornek?.turkce || ""}) yapısındaki kelime sonu harekelerine dikkat ediniz.`
      );
    }
  }

  // 3. Çekim ve Kural Tablosu
  const ozet_tablo =
    custom?.ozet_tablo &&
    custom.ozet_tablo.sutunlar?.length > 0 &&
    custom.ozet_tablo.satirlar?.length > 0
      ? custom.ozet_tablo
      : (() => {
          const rows: string[][] = [];
          if (note.metinden_ornek?.arapca) {
            rows.push([
              note.metinden_ornek.arapca,
              note.metinden_ornek.turkce,
              note.metinden_ornek.aciklama || "Ana odak örnek cümle",
            ]);
          }
          if (Array.isArray(note.ek_ornekler)) {
            for (const ex of note.ek_ornekler) {
              if (ex.arapca) {
                rows.push([
                  ex.arapca,
                  ex.turkce,
                  `Pekiştirici örnek (${extractTurkishCoreTopic(note.konu_basligi)})`,
                ]);
              }
            }
          }
          for (const sent of matchingSentences.slice(0, 3)) {
            if (
              sent.arapca &&
              !rows.some((r) => r[0].trim() === sent.arapca.trim())
            ) {
              rows.push([
                sent.arapca,
                sent.turkce,
                sent.not_tr || `Kalıp: ${sent.odak_kalip} (${sent.seviye || "A1"})`,
              ]);
            }
          }
          return {
            tablo_basligi: `${note.konu_basligi} — Karşılaştırmalı Örnek ve Kalıp Tablosu`,
            sutunlar: [
              "Arapça Örnek / Kalıp",
              "Türkçe Anlamı",
              "Gramer Özelliği & İ'rab Notu",
            ],
            satirlar: rows,
          };
        })();

  // 4. Kelime Kelime İ'rab & Öge Tahlili
  const irab_tahlili =
    custom?.irab_tahlili &&
    Array.isArray(custom.irab_tahlili) &&
    custom.irab_tahlili.length > 0
      ? custom.irab_tahlili
      : buildWordByWordIrabAnalysis(note);

  // 5. Sık Yapılan Hata & Doğrusu
  const dikkat_sik_hata =
    custom?.dikkat_sik_hata &&
    custom.dikkat_sik_hata.yanlis &&
    custom.dikkat_sik_hata.dogru
      ? custom.dikkat_sik_hata
      : (() => {
          const correctAr = note.metinden_ornek?.arapca || "";
          const words = correctAr.split(/\s+/).filter(Boolean);
          let wrongAr = correctAr;

          // Son kelimenin son harekesini değiştirerek öğrencilerin sık yaptığı hareke/marifelik hatasını simüle et
          if (words.length >= 2) {
            const lastIdx = words.length - 1;
            const lastW = words[lastIdx];
            if (/\u064C$/.test(lastW)) {
              // Tenvin dammeyi fethaya veya ال + tenvine çevir
              words[lastIdx] = lastW.replace(/\u064C$/, "\u064E");
            } else if (/\u0650$/.test(lastW)) {
              // Kesrayı dammeye çevir
              words[lastIdx] = lastW.replace(/\u0650$/, "\u064F");
            } else if (/\u064E$/.test(lastW)) {
              // Fethayı kesraya çevir
              words[lastIdx] = lastW.replace(/\u064E$/, "\u0650");
            } else if (/\u064F$/.test(lastW)) {
              words[lastIdx] = lastW.replace(/\u064F$/, "\u064E");
            } else {
              words[lastIdx] = `${lastW} (Hareke/Uyum Hatası)`;
            }
            wrongAr = words.join(" ");
          }

          return {
            yanlis: `${wrongAr}  (Hatalı hareke / uyum kullanımı)`,
            dogru: `${correctAr}  (“${note.metinden_ornek?.turkce || ""}”)`,
            neden:
              note.ipucu ||
              note.metinden_ornek?.aciklama ||
              `${note.konu_basligi} kuralında kelimelerin son harekesi (merfû/mansûb/mecrûr durumu) ve marifelik-nekrelik uyumu cümlenin anlamını doğrudan belirler.`,
          };
        })();

  return {
    formul_sema,
    adim_adim_anlatim,
    ozet_tablo,
    irab_tahlili,
    dikkat_sik_hata,
  };
}

export function resolveGrammarNoteAndSentences(params: {
  grammarNote?: GramerHapBilgi | null;
  dialogueId?: string;
  readingId?: string;
  sourceId?: string;
  grammarTopic?: string;
}): {
  resolvedNote: GramerHapBilgi | null;
  matchingSentences: Cumle1111Item[];
  activeGrammarQuery: string;
  linkedLessonUrl: string | null;
  linkedLessonTitle: string | null;
  linkedLevel: string | null;
} {
  const allGrammarNotes = [...diyalogGramerNotlari, ...metinGramerNotlari];
  let note: GramerHapBilgi | null = params.grammarNote || null;

  const targetId = (
    params.dialogueId ||
    params.readingId ||
    params.sourceId ||
    note?.bagli_id ||
    ""
  ).trim();

  if (!note && targetId) {
    note =
      allGrammarNotes.find(
        (g) => g.bagli_id.toLowerCase() === targetId.toLowerCase()
      ) || null;
  }

  const rawTopic = (params.grammarTopic || "").trim();
  const normTopic = normalizeTrKey(rawTopic);
  const topicCore = normalizeTrKey(
    rawTopic.replace(/\([^)]*\)/g, "").trim()
  );
  const topicWords = (topicCore || normTopic)
    .split(/[\s,()/\-–:+]+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !["ile", "icin", "olan", "veya", "cumlesi", "kalibi", "yapisi"].includes(w)
    );

  // Eğer doğrudan not verilmediyse ve grammarTopic varsa en uygun GramerHapBilgi notunu bul
  if (!note && normTopic) {
    let bestNote: GramerHapBilgi | null = null;
    let bestScore = 0;

    for (const candidate of allGrammarNotes) {
      const candTitle = normalizeTrKey(candidate.konu_basligi);
      const candRule = normalizeTrKey(candidate.hap_kural);
      let score = 0;

      if (candTitle === normTopic) score += 100;
      if (topicCore && candTitle.includes(topicCore)) score += 60;
      if (normTopic && candTitle.includes(normTopic)) score += 50;

      for (const kw of topicWords) {
        if (candTitle.includes(kw)) score += 18;
        else if (candRule.includes(kw)) score += 6;
      }

      if (score > bestScore) {
        bestScore = score;
        bestNote = candidate;
      }
    }

    if (bestNote && bestScore >= 15) {
      note = bestNote;
    }
  }

  // 1111 Cümle içinden bu gramer konusuyla (odak_kalip) eşleşen cümleleri bul
  const searchTopicForSentences =
    rawTopic ||
    (note ? extractTurkishCoreTopic(note.konu_basligi) : "");
  const normSearchSent = normalizeTrKey(searchTopicForSentences);
  const sentCore = normalizeTrKey(
    searchTopicForSentences.replace(/\([^)]*\)/g, "").trim()
  );
  const sentKeywords = (sentCore || normSearchSent)
    .split(/[\s,()/\-–:+]+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !["ile", "icin", "olan", "veya", "cumlesi", "kalibi", "yapisi", "fiil", "isim"].includes(w)
    );

  let matchingSentences = cumleler1111.filter((c) => {
    const kalip = normalizeTrKey(c.odak_kalip);
    if (!kalip) return false;
    if (normTopic && kalip === normTopic) return true;
    if (
      normSearchSent &&
      (kalip === normSearchSent ||
        kalip.includes(normSearchSent) ||
        normSearchSent.includes(kalip))
    ) {
      return true;
    }
    if (sentCore && sentCore.length >= 4 && kalip.includes(sentCore)) {
      return true;
    }
    return false;
  });

  if (matchingSentences.length === 0 && sentKeywords.length > 0) {
    matchingSentences = cumleler1111.filter((c) => {
      const kalip = normalizeTrKey(c.odak_kalip);
      return sentKeywords.some((kw) => kalip.includes(kw));
    });
  }

  // Eğer 180 ders notunda tam karşılığı yoksa ama 1111 cümlede varsa dinamik bir GramerHapBilgi oluştur
  if (!note && rawTopic) {
    const firstSent = matchingSentences[0];
    const secondSent = matchingSentences[1];
    const thirdSent = matchingSentences[2];
    note = {
      bagli_id: firstSent?.id || "1111_cumle",
      konu_basligi: rawTopic,
      hap_kural:
        firstSent?.not_tr ||
        `Bu gramer kalıbı (${rawTopic}), günlük ve akademik Arapçada cümle kurarken en sık başvurulan temel yapılardan biridir. Aşağıdaki sesli örnek cümleleri inceleyerek kalıbın cümle içindeki dizilimini ve hareke uyumunu kolayca kavrayabilirsiniz.`,
      metinden_ornek: firstSent
        ? {
            arapca: firstSent.arapca,
            turkce: firstSent.turkce,
            aciklama:
              firstSent.not_tr ||
              `Odak Kalıp: ${firstSent.odak_kalip} • Bağlam: ${firstSent.baglam || firstSent.tema}`,
          }
        : {
            arapca: "العِلْمُ نُورٌ",
            turkce: "İlim nurdur.",
            aciklama: `Odak Kalıp: ${rawTopic}`,
          },
      ek_ornekler: [secondSent, thirdSent]
        .filter((s): s is Cumle1111Item => Boolean(s))
        .map((s) => ({
          arapca: s.arapca,
          turkce: s.turkce,
        })),
      ipucu: `Bu kalıbı kalıcı olarak öğrenmek için aşağıdaki 1111 Cümle örneklerini sesli dinleyip tekrar edebilir ve "Bu Gramer Kalıbıyla Alıştırma Yap" butonuyla interaktif teste geçebilirsiniz.`,
    };
  }

  // İlgili Diyalog veya Metin ders bağlantısını çöz
  let linkedLessonUrl: string | null = null;
  let linkedLessonTitle: string | null = null;
  let linkedLevel: string | null = null;

  const bagliId = note?.bagli_id || targetId;
  if (bagliId) {
    const foundDialogue = diyaloglar.find(
      (d) => d.id.toLowerCase() === bagliId.toLowerCase()
    );
    if (foundDialogue) {
      linkedLessonUrl = `/diyalog/${foundDialogue.id}`;
      linkedLessonTitle = foundDialogue.baslik_tr;
      linkedLevel = foundDialogue.seviye;
    } else {
      const foundReading = metinler.find(
        (m) => m.id.toLowerCase() === bagliId.toLowerCase()
      );
      if (foundReading) {
        linkedLessonUrl = `/metin/${foundReading.id}`;
        linkedLessonTitle = foundReading.baslik_tr;
        linkedLevel = foundReading.seviye;
      }
    }
  }

  if (!linkedLevel && matchingSentences.length > 0) {
    linkedLevel = matchingSentences[0].seviye || matchingSentences[0].cefr || "A1";
  }

  const activeGrammarQuery =
    rawTopic ||
    matchingSentences[0]?.odak_kalip ||
    (note ? extractTurkishCoreTopic(note.konu_basligi) : "");

  return {
    resolvedNote: note,
    matchingSentences,
    activeGrammarQuery,
    linkedLessonUrl,
    linkedLessonTitle,
    linkedLevel,
  };
}

/**
 * 2. KATMAN: AYRINTILI GRAMER KONU ANLATIMI, ŞEMA, TABLO VE İ'RAB ÇÖZÜMLEMESİ PENCERESİ (Deep-Dive Modal)
 */
interface GrammarDeepDiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  grammarNote: GramerHapBilgi;
  matchingSentences: Cumle1111Item[];
  linkedLevel?: string | null;
  linkedLessonTitle?: string | null;
  linkedLessonUrl?: string | null;
  activeGrammarQuery?: string;
}

export function GrammarDeepDiveModal({
  isOpen,
  onClose,
  grammarNote,
  matchingSentences,
  linkedLevel,
  linkedLessonTitle,
  linkedLessonUrl,
  activeGrammarQuery,
}: GrammarDeepDiveModalProps) {
  const { speechRate } = useSettings();
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopAllAudio();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const detailLayer = useMemo(
    () => buildSmartGrammarDetailLayer(grammarNote, matchingSentences),
    [grammarNote, matchingSentences]
  );

  if (!isOpen) return null;

  const handleListen = async (text: string, key: string) => {
    const cleanText = text.replace(/\([^)]*\)/g, "").trim() || text;
    if (playingKey === key) {
      stopAllAudio();
      setPlayingKey(null);
      return;
    }
    setPlayingKey(key);
    try {
      await speakHybrid({ text: cleanText, rate: speechRate });
    } finally {
      setPlayingKey((prev) => (prev === key ? null : prev));
    }
  };

  const formulaParts = detailLayer.formul_sema
    .split(/\s*(?:\+|➔|->|→)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      onClick={() => {
        stopAllAudio();
        onClose();
      }}
    >
      <div
        className="bg-[#FDFBF7] dark:bg-[var(--background)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 w-[96vw] lg:w-[85vw] max-w-[1360px] h-[90vh] sm:h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ÜST SABİT BAŞLIK ÇUBUĞU */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#F7EFE1] via-amber-50/80 to-[#F7EFE1] dark:from-[var(--surface)] dark:via-slate-900 dark:to-[var(--surface)] border-b-2 border-[#E6D7BE] dark:border-[var(--border)] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-[#6741D9] text-white flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-950 text-amber-950 dark:text-amber-200 text-[10px] font-black uppercase tracking-wider">
                  📖 2. Katman • Ayrıntılı Konu Anlatımı &amp; İ&apos;rab Tahlili
                </span>
                {linkedLevel && (
                  <span className="px-2 py-0.5 rounded-md bg-[#087F5B] text-white text-[10px] font-black">
                    Seviye {linkedLevel}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-xl font-black text-[var(--foreground)] truncate mt-0.5">
                {grammarNote.konu_basligi}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playClick();
              stopAllAudio();
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border-b-2 border-rose-800 flex items-center gap-1.5 font-black text-xs cursor-pointer transition-all shrink-0"
            aria-label="Ayrıntılı Pencereyi Kapat"
          >
            <X className="w-4 h-4" />
            <span>✕ Kapat (Esc)</span>
          </button>
        </div>

        {/* KAYDIRILABİLİR 5 EĞİTİM KARTI GÖVDESİ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* KART 1: 📐 GÖRSEL FORMÜL & CÜMLE ŞEMASI (formul_sema) */}
          <section className="rounded-2xl sm:rounded-3xl border-2 border-[#6741D9]/45 dark:border-indigo-700/70 border-b-4 bg-gradient-to-br from-[#F3F0FF] via-white to-amber-50/70 dark:from-indigo-950/50 dark:via-[var(--surface)] dark:to-amber-950/30 p-4 sm:p-6 shadow-xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#6741D9] text-white font-black text-xs uppercase tracking-wider shadow-2xs">
                <Compass className="w-4 h-4 shrink-0" />
                <span>1. 📐 Görsel Formül &amp; Cümle Şeması</span>
              </span>
              <span className="text-[11px] font-extrabold text-[#6741D9] dark:text-indigo-300">
                Yapısal Dizilim Formülü
              </span>
            </div>

            {formulaParts.length > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-1">
                {formulaParts.map((part, idx) => {
                  const isLast = idx === formulaParts.length - 1;
                  return (
                    <React.Fragment key={idx}>
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl border-2 border-b-4 font-extrabold text-xs sm:text-sm text-center shadow-2xs ${
                          isLast
                            ? "bg-amber-100 dark:bg-amber-950/80 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100"
                            : "bg-white dark:bg-[var(--background)] border-[#6741D9]/50 text-[var(--foreground)]"
                        }`}
                      >
                        {part}
                      </div>
                      {!isLast && (
                        <span className="w-7 h-7 rounded-full bg-[#6741D9] text-white font-black text-xs flex items-center justify-center shrink-0">
                          {idx === formulaParts.length - 2 &&
                          detailLayer.formul_sema.includes("➔")
                            ? "➔"
                            : "+"}
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : null}

            <div className="bg-white/95 dark:bg-[var(--background)] rounded-2xl p-3.5 sm:p-4 border-2 border-amber-300 dark:border-amber-700/80 text-center">
              <p className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 leading-relaxed">
                {detailLayer.formul_sema}
              </p>
            </div>
          </section>

          {/* KART 2: 🪜 ADIM ADIM KONU ÖZETİ (adim_adim_anlatim) */}
          <section className="rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#087F5B] text-white font-black text-xs uppercase tracking-wider">
                <ListChecks className="w-4 h-4 shrink-0" />
                <span>2. 🪜 Adım Adım Konu Özeti</span>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {detailLayer.adim_adim_anlatim.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-white/95 dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] p-3.5 sm:p-4 flex items-start gap-3.5"
                >
                  <span className="w-8 h-8 rounded-xl bg-[#087F5B] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                    {idx + 1}
                  </span>
                  <p className="text-xs sm:text-base font-bold text-[var(--foreground)] leading-relaxed pt-0.5">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* KART 3: 📊 ÇEKİM VE KURAL TABLOSU (ozet_tablo) */}
          <section className="rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider">
                <Table2 className="w-4 h-4 shrink-0" />
                <span>3. 📊 {detailLayer.ozet_tablo.tablo_basligi}</span>
              </span>
              <span className="text-[11px] font-bold text-[var(--muted)]">
                🔊 Arapça ifadeleri dinlemek için hoparlör ikonuna tıklayın
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-white dark:bg-[var(--background)]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#EFE5D4] dark:bg-slate-800 border-b-2 border-[#E6D7BE] dark:border-slate-700">
                    {detailLayer.ozet_tablo.sutunlar.map((col, cIdx) => (
                      <th
                        key={cIdx}
                        className="py-3 px-3.5 text-xs sm:text-sm font-black uppercase tracking-wider text-[var(--foreground)]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailLayer.ozet_tablo.satirlar.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={`border-b border-[#E6D7BE]/70 dark:border-slate-800 transition-colors ${
                        rIdx % 2 === 0
                          ? "bg-white dark:bg-[var(--background)]"
                          : "bg-[#F7EFE1]/55 dark:bg-[var(--surface)]/60"
                      }`}
                    >
                      {row.map((cell, cIdx) => {
                        const cellHasAr = hasArabicScript(cell);
                        const audioKey = `tbl-${rIdx}-${cIdx}`;
                        return (
                          <td
                            key={cIdx}
                            className="py-3 px-3.5 align-middle text-xs sm:text-sm font-bold text-[var(--foreground)]"
                          >
                            {cellHasAr ? (
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleListen(cell, audioKey)}
                                  title="Arapça ifadeyi seslendir"
                                  className={`px-2.5 py-1 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-all ${
                                    playingKey === audioKey
                                      ? "bg-[#087F5B] text-white border-[#065F46]"
                                      : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[#087F5B] dark:text-emerald-300 border-[#E6D7BE] hover:border-[#087F5B]"
                                  }`}
                                >
                                  <Volume2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>🔊</span>
                                </button>
                                <div
                                  dir="rtl"
                                  className="arabic font-arabic text-lg sm:text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.9] flex-1"
                                >
                                  <WordTooltip text={cell} />
                                </div>
                              </div>
                            ) : (
                              <span>{cell}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* KART 4: 🔍 ÖRNEK CÜMLENİN KELİME KELİME İ'RAB & ÖGE TAHLİLİ (irab_tahlili) */}
          <section className="rounded-2xl sm:rounded-3xl border-2 border-sky-300 dark:border-sky-800 border-b-4 bg-sky-50/65 dark:bg-sky-950/25 p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-700 text-white font-black text-xs uppercase tracking-wider">
                <Target className="w-4 h-4 shrink-0" />
                <span>4. 🔍 Örnek Cümlenin Kelime Kelime İ&apos;rab &amp; Öge Tahlili</span>
              </span>
              {grammarNote.metinden_ornek?.arapca && (
                <button
                  type="button"
                  onClick={() =>
                    handleListen(
                      grammarNote.metinden_ornek.arapca,
                      "irab-full-sentence"
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-sky-300 dark:border-sky-700 hover:border-[#087F5B] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#087F5B]" />
                  <span>
                    {playingKey === "irab-full-sentence"
                      ? "Dinleniyor..."
                      : "🔊 Tüm Cümleyi Dinle"}
                  </span>
                </button>
              )}
            </div>

            {/* Odak Cümle Özet Başlığı */}
            {grammarNote.metinden_ornek && (
              <div className="bg-white dark:bg-[var(--background)] rounded-2xl p-3.5 sm:p-4 border-2 border-sky-200 dark:border-sky-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-200">
                  “{grammarNote.metinden_ornek.turkce}”
                </p>
                <div
                  dir="rtl"
                  className="arabic font-arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-right"
                >
                  {grammarNote.metinden_ornek.arapca}
                </div>
              </div>
            )}

            {/* Kelime Kelime İ'rab Kartları Izgarası */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {detailLayer.irab_tahlili.map((item, idx) => {
                const wKey = `irab-word-${idx}`;
                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-[var(--background)] rounded-2xl border-2 border-sky-200 dark:border-sky-800/80 p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-[#087F5B] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-sky-200 dark:border-sky-800 pb-2">
                      <button
                        type="button"
                        onClick={() => handleListen(item.kelime, wKey)}
                        title="Kelimeyi dinle"
                        className={`px-2.5 py-1 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition-all ${
                          playingKey === wKey
                            ? "bg-[#087F5B] text-white border-[#065F46]"
                            : "bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border-sky-200 dark:border-sky-700 hover:border-[#087F5B]"
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5 shrink-0" />
                        <span>🔊 #{idx + 1}</span>
                      </button>

                      <span
                        dir="rtl"
                        className="arabic font-arabic text-2xl sm:text-3xl font-bold text-[#065F46] dark:text-emerald-400 text-right"
                      >
                        {item.kelime}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-[#F3F0FF] dark:bg-indigo-950/80 border border-[#6741D9]/35 text-[#6741D9] dark:text-indigo-200 text-[11px] font-black">
                        📌 {item.gorevi}
                      </span>
                      <p className="text-xs font-bold text-[var(--foreground)] leading-relaxed">
                        {item.hareke_nedeni}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* KART 5: ⚠️ SIK YAPILAN HATA & DOĞRUSU (dikkat_sik_hata) */}
          <section className="rounded-2xl sm:rounded-3xl border-2 border-amber-300 dark:border-amber-700 border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>5. ⚠️ Sık Yapılan Hata &amp; Doğrusu</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Sol Kutu: ❌ Yanlış */}
              <div className="rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/40 p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-black text-xs uppercase tracking-wider">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>❌ Yanlış Kullanım</span>
                </div>
                <p
                  dir="rtl"
                  className="arabic font-arabic text-lg sm:text-xl font-bold text-rose-900 dark:text-rose-200 text-right leading-relaxed"
                >
                  {detailLayer.dikkat_sik_hata.yanlis}
                </p>
              </div>

              {/* Sağ Kutu: ✅ Doğru */}
              <div className="rounded-2xl border-2 border-emerald-400 dark:border-emerald-700 bg-emerald-50/90 dark:bg-emerald-950/40 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[#065F46] dark:text-emerald-300 font-black text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>✅ Doğru Kullanım</span>
                  </div>
                  {grammarNote.metinden_ornek?.arapca && (
                    <button
                      type="button"
                      onClick={() =>
                        handleListen(
                          grammarNote.metinden_ornek.arapca,
                          "correct-usage-audio"
                        )
                      }
                      className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-emerald-400 text-[11px] font-extrabold text-[#065F46] dark:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>🔊 Dinle</span>
                    </button>
                  )}
                </div>
                <p
                  dir="rtl"
                  className="arabic font-arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-300 text-right leading-relaxed"
                >
                  {detailLayer.dikkat_sik_hata.dogru}
                </p>
              </div>
            </div>

            {/* Alt Kutu: 💡 Neden */}
            <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/40 p-3.5 sm:p-4 flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100 leading-relaxed">
                <strong className="font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mr-1.5">
                  💡 Neden:
                </strong>
                {detailLayer.dikkat_sik_hata.neden}
              </div>
            </div>
          </section>
        </div>

        {/* ALT SABİT AKSİYON ÇUBUĞU */}
        <div className="px-4 sm:px-6 py-3 bg-[#F7EFE1] dark:bg-[var(--surface)] border-t-2 border-[#E6D7BE] dark:border-[var(--border)] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {linkedLessonUrl && linkedLessonTitle && (
              <Link
                href={linkedLessonUrl}
                onClick={() => onClose()}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] hover:border-[#087F5B] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#087F5B]" />
                <span>📖 Derse Git ({linkedLessonTitle})</span>
              </Link>
            )}
            <Link
              href={`/alistirmalar?pool=sentences_1111${
                activeGrammarQuery
                  ? `&grammar=${encodeURIComponent(activeGrammarQuery)}`
                  : ""
              }`}
              onClick={() => onClose()}
              className="px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-2 border-[#065F46] text-xs font-black inline-flex items-center gap-1.5"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>🎮 Bu Kalıpla Alıştırma Yap</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => {
              playClick();
              stopAllAudio();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-[var(--foreground)] text-xs font-black cursor-pointer"
          >
            Özete Dön
          </button>
        </div>
      </div>
    </div>
  );
}

interface GrammarHapBilgiPanelProps {
  grammarNote: GramerHapBilgi;
  grammarTopic?: string;
  onOpenShadowing?: (arabicText: string, turkishText?: string) => void;
  isSmartboardLarge?: boolean;
  showMatchingSentences?: boolean;
}

export function GrammarHapBilgiPanel({
  grammarNote,
  grammarTopic,
  onOpenShadowing,
  isSmartboardLarge = false,
  showMatchingSentences = true,
}: GrammarHapBilgiPanelProps) {
  const { speechRate, preferredVoiceGender } = useSettings();
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [showAllSentences, setShowAllSentences] = useState(false);
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false);

  const {
    matchingSentences,
    activeGrammarQuery,
    linkedLessonUrl,
    linkedLessonTitle,
    linkedLevel,
  } = useMemo(
    () =>
      resolveGrammarNoteAndSentences({
        grammarNote,
        grammarTopic,
      }),
    [grammarNote, grammarTopic]
  );

  const handleListen = async (text: string, key: string) => {
    if (playingKey === key) {
      stopAllAudio();
      setPlayingKey(null);
      return;
    }
    setPlayingKey(key);
    try {
      await speakHybrid({ text, rate: speechRate });
    } finally {
      setPlayingKey((prev) => (prev === key ? null : prev));
    }
  };

  const handleListenSentence1111 = async (sent: Cumle1111Item, key: string) => {
    if (playingKey === key) {
      stopAllAudio();
      setPlayingKey(null);
      return;
    }
    setPlayingKey(key);
    try {
      await playDualGenderAudio({
        text: sent.arapca,
        id: sent.id,
        ses_erkek: sent.ses_erkek || `/sesler/cumleler/${sent.id}_m.mp3`,
        ses_kadin: sent.ses_kadin || `/sesler/cumleler/${sent.id}_f.mp3`,
        gender: preferredVoiceGender,
        rate: speechRate,
      });
    } finally {
      setPlayingKey((prev) => (prev === key ? null : prev));
    }
  };

  const visibleSentences = showAllSentences
    ? matchingSentences.slice(0, 30)
    : matchingSentences.slice(0, 6);

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      {/* 1. ÜST BAŞLIK VE TEMEL GRAMER KURALI (HAP KURAL) KARTI */}
      <div className="bg-gradient-to-br from-[#F7EFE1] to-[#EFE5D4] dark:from-[var(--surface)] dark:to-[var(--background)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Odak Gramer &amp; Hap Bilgi</span>
            </span>
            {linkedLevel && (
              <span className="px-2.5 py-1 rounded-xl bg-[#087F5B] text-white font-black text-[11px]">
                Seviye {linkedLevel}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {linkedLessonTitle && linkedLessonUrl ? (
              <Link
                href={linkedLessonUrl}
                className="px-2.5 py-1 rounded-xl bg-white/90 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-[var(--foreground)] font-extrabold text-[11px] inline-flex items-center gap-1 transition-colors"
              >
                <span>📖 Ders: {linkedLessonTitle}</span>
                <ExternalLink className="w-3 h-3 text-[#087F5B]" />
              </Link>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-white/85 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] font-extrabold text-[11px]">
                İçerik: {grammarNote.bagli_id.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <h2
          className={`${
            isSmartboardLarge
              ? "text-xl sm:text-3xl"
              : "text-lg sm:text-2xl"
          } font-black text-[var(--foreground)] tracking-tight mb-3.5 leading-snug`}
        >
          {grammarNote.konu_basligi}
        </h2>

        <div className="bg-white/95 dark:bg-[var(--background)] rounded-2xl p-4 sm:p-5 border-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-400/70 flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4 text-[#087F5B] dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#087F5B] dark:text-emerald-400 block mb-1">
                Temel Gramer Kuralı (Hap Kural &amp; Formül)
              </span>
              <p
                className={`${
                  isSmartboardLarge
                    ? "text-base sm:text-xl"
                    : "text-sm sm:text-base"
                } font-bold text-[var(--foreground)] leading-relaxed break-words`}
              >
                {grammarNote.hap_kural}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. İÇERİKTEN ODAK ÖRNEK KARTI */}
      {grammarNote.metinden_ornek && (
        <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 shadow-xs space-y-3.5">
          {/* Üst Bar: Sol tarafta rozet, sağ tarafta Dinle ve Telaffuz Et butonları */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/70 text-[#6741D9] dark:text-indigo-200 border border-[#6741D9]/35 font-black text-[11px] sm:text-xs uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span>🎯 ODAK ÖRNEK &amp; ÇÖZÜMLEME</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleListen(
                    grammarNote.metinden_ornek.arapca,
                    "main-example"
                  )
                }
                className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-extrabold text-xs border-2 border-b-3 active:translate-y-[1px] transition-all cursor-pointer ${
                  playingKey === "main-example"
                    ? "bg-[#087F5B] text-white border-[#065F46]"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B]"
                }`}
                title="Örnek cümleyi dinle"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#087F5B] dark:text-emerald-400 shrink-0" />
                <span>
                  {playingKey === "main-example" ? "Dinleniyor..." : "🔊 Dinle"}
                </span>
              </button>

              {onOpenShadowing && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenShadowing(
                      grammarNote.metinden_ornek.arapca,
                      grammarNote.metinden_ornek.turkce
                    )
                  }
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-900 dark:text-amber-200 border-2 border-amber-300 dark:border-amber-700 border-b-3 active:translate-y-[1px] font-extrabold text-xs transition-all cursor-pointer"
                  title="Telaffuz koçu ile dene"
                >
                  <Mic className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>🎙️ Telaffuz Et</span>
                </button>
              )}
            </div>
          </div>

          {/* Gövde Kutusu: Arapça Örnek Cümle + Türkçe Çevirisi */}
          <div className="bg-white/90 dark:bg-[var(--background)] rounded-2xl p-4 sm:p-5 border border-[#E6D7BE] dark:border-[var(--border)] space-y-3.5 overflow-hidden">
            {/* 1. Arapça Örnek Cümle */}
            <div
              dir="rtl"
              className={`arabic font-arabic ${
                isSmartboardLarge
                  ? "text-2xl sm:text-4xl"
                  : "text-xl sm:text-2xl md:text-3xl"
              } leading-[2.1] font-bold text-[#065F46] dark:text-emerald-400 text-right break-words`}
            >
              <WordTooltip
                text={grammarNote.metinden_ornek.arapca}
                contextSentenceTr={grammarNote.metinden_ornek.turkce}
              />
            </div>

            {/* 2. Türkçe Çevirisi */}
            <div className="border-l-4 border-[#087F5B] pl-3 py-1 bg-[#F7EFE1]/55 dark:bg-[var(--surface)]/60 rounded-r-xl">
              <p
                className={`${
                  isSmartboardLarge
                    ? "text-base sm:text-xl"
                    : "text-sm sm:text-base"
                } font-medium text-[var(--foreground)] leading-relaxed break-words`}
              >
                “{grammarNote.metinden_ornek.turkce}”
              </p>
            </div>
          </div>

          {/* Gramer Analizi Kutusu */}
          {grammarNote.metinden_ornek.aciklama && (
            <div className="bg-sky-50/90 dark:bg-sky-950/40 border-2 border-sky-200 dark:border-sky-800/70 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm font-bold text-sky-950 dark:text-sky-200 leading-relaxed break-words">
              <span className="font-black uppercase text-[11px] tracking-wider block text-sky-800 dark:text-sky-300 mb-1">
                🔍 Gramer Analizi &amp; İrab Notu:
              </span>
              {grammarNote.metinden_ornek.aciklama}
            </div>
          )}
        </div>
      )}

      {/* 3. PEKİŞTİRİCİ EK ÖRNEKLER */}
      {grammarNote.ek_ornekler && grammarNote.ek_ornekler.length > 0 && (
        <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 shadow-xs">
          <h3 className="text-sm sm:text-base font-black text-[var(--foreground)] uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#087F5B] dark:text-emerald-400 shrink-0" />
            <span>Pekiştirici Ek Örnekler</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {grammarNote.ek_ornekler.map((ex, i) => {
              const key = `extra-${i}`;
              return (
                <div
                  key={i}
                  className="bg-white/90 dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 flex flex-col justify-between gap-3 hover:border-[#087F5B] transition-colors overflow-hidden"
                >
                  <div className="space-y-2">
                    <div
                      dir="rtl"
                      className={`arabic font-arabic ${
                        isSmartboardLarge
                          ? "text-2xl sm:text-3xl"
                          : "text-xl sm:text-2xl"
                      } font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[2.0] break-words`}
                    >
                      <WordTooltip
                        text={ex.arapca}
                        contextSentenceTr={ex.turkce}
                      />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[var(--foreground)] border-l-3 border-[#6741D9] pl-2.5 py-0.5 break-words">
                      {ex.turkce}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-dashed border-[#E6D7BE] dark:border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => handleListen(ex.arapca, key)}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs border-2 transition-all cursor-pointer ${
                        playingKey === key
                          ? "bg-[#087F5B] text-white border-[#065F46]"
                          : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B]"
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{playingKey === key ? "Dinleniyor" : "🔊 Dinle"}</span>
                    </button>
                    {onOpenShadowing && (
                      <button
                        type="button"
                        onClick={() => onOpenShadowing(ex.arapca, ex.turkce)}
                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-900 dark:text-amber-200 border-2 border-amber-300 dark:border-amber-700 font-extrabold text-xs transition-all cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Telaffuz</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. PRATİK ÖĞRENME İPUCU */}
      {grammarNote.ipucu && (
        <div className="bg-amber-50/90 dark:bg-amber-950/40 rounded-2xl sm:rounded-3xl border-2 border-amber-300 dark:border-amber-700 border-b-4 p-4 sm:p-5 shadow-xs flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-200/80 dark:bg-amber-900/70 border border-amber-400 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-amber-800 dark:text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-300 block mb-1">
              💡 Pratik Öğrenme İpucu
            </span>
            <p
              className={`${
                isSmartboardLarge
                  ? "text-sm sm:text-base"
                  : "text-xs sm:text-sm"
              } font-bold text-amber-950 dark:text-amber-100 leading-relaxed break-words`}
            >
              {grammarNote.ipucu}
            </p>
          </div>
        </div>
      )}

      {/* 4B. 2. KATMAN AYRINTILI KONU ANLATIMI, ŞEMA & İ'RAB ÇÖZÜMLEMESİ TETİKLEYİCİ BUTON */}
      <button
        type="button"
        onClick={() => {
          playClick();
          setIsDeepDiveOpen(true);
        }}
        className="w-full group rounded-2xl sm:rounded-3xl border-2 border-[#6741D9] border-b-4 bg-gradient-to-r from-[#6741D9] via-[#5230B5] to-indigo-800 hover:from-[#5230B5] hover:to-[#422399] text-white p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer transition-all active:translate-y-[1px]"
      >
        <div className="flex items-center gap-3 text-left">
          <span className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-xl shrink-0">
            📖
          </span>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 block">
              📐 Görsel Şema • 📊 Karşılaştırmalı Tablo • 🔍 Kelime Kelime İ&apos;rab • ⚠️ Sık Hatalar
            </span>
            <span className="text-sm sm:text-base font-black text-white block mt-0.5">
              📖 Ayrıntılı Konu Anlatımı, Şema &amp; İ&apos;rab Çözümlemesi İçin Tıklayınız →
            </span>
          </div>
        </div>
        <span className="px-3.5 py-2 rounded-xl bg-amber-400 group-hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 shrink-0 self-end sm:self-center shadow-2xs transition-colors">
          <span>Detaylı İncele</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </button>

      {/* 5. 1111 CÜMLE HAVUZUNDAN BU KALIBA AİT SESLİ ÖRNEK CÜMLELER */}
      {showMatchingSentences && matchingSentences.length > 0 && (
        <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 shadow-xs space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-[#065F46] dark:text-emerald-200 border border-emerald-400/60 font-black text-xs uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>🗣️ Bu Gramer Kalıbına Ait Günlük Cümleler</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-black text-[#087F5B] dark:text-emerald-300">
                {matchingSentences.length} Cümle
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleSentences.map((sent) => {
              const sKey = `sent1111-${sent.id}`;
              return (
                <div
                  key={sent.id}
                  className="bg-white/95 dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-2.5 hover:border-[#087F5B] transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-[10px] font-black truncate max-w-[210px]">
                        📌 {sent.odak_kalip}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-[#F7EFE1] dark:bg-[var(--surface)] text-[10px] font-black text-[var(--muted)]">
                        {sent.seviye || sent.cefr || "A1"} • {sent.tema}
                      </span>
                    </div>
                    <div
                      dir="rtl"
                      className={`arabic font-arabic ${
                        isSmartboardLarge
                          ? "text-xl sm:text-2xl"
                          : "text-lg sm:text-xl"
                      } font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.9] break-words`}
                    >
                      <WordTooltip
                        text={sent.arapca}
                        contextSentenceTr={sent.turkce}
                      />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[var(--foreground)] border-l-3 border-[#087F5B] pl-2.5 py-0.5 break-words">
                      “{sent.turkce}”
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-[#E6D7BE] dark:border-[var(--border)]">
                    <span className="text-[10px] font-bold text-[var(--muted)] truncate">
                      {sent.baglam || ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleListenSentence1111(sent, sKey)}
                      className={`min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-extrabold text-xs border transition-all cursor-pointer shrink-0 ${
                        playingKey === sKey
                          ? "bg-[#087F5B] text-white border-[#065F46]"
                          : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B]"
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[#087F5B] dark:text-emerald-400 shrink-0" />
                      <span>
                        {playingKey === sKey ? "Dinleniyor..." : "🔊 Dinle"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {matchingSentences.length > 6 && (
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllSentences((v) => !v)}
                className="px-4 py-2 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-xs font-black text-[var(--foreground)] cursor-pointer transition-colors"
              >
                {showAllSentences
                  ? "Daha Az Örnek Göster"
                  : `Tüm Örnek Cümleleri Göster (${matchingSentences.length} Cümle)`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 6. ALT HIZLI EYLEM ÇUBUĞU: BU GRAMER KALIBIYLA ALIŞTIRMA YAP & İLGİLİ DERSE GİT */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#065F46] to-teal-950 text-white rounded-2xl sm:rounded-3xl border-2 border-emerald-500/50 border-b-4 p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 block">
            🎯 Pedagojik Pekiştirme Adımı
          </span>
          <p className="text-xs sm:text-sm font-extrabold text-white">
            Bu gramer kuralını interaktif cümle ve kelime alıştırmalarıyla hemen test edin:
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {linkedLessonUrl && (
            <Link
              href={linkedLessonUrl}
              className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 font-black text-xs inline-flex items-center justify-center gap-1.5 transition-all"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>📖 İlgili Derse Git</span>
            </Link>
          )}
          <Link
            href={`/alistirmalar?pool=sentences_1111${
              activeGrammarQuery
                ? `&grammar=${encodeURIComponent(activeGrammarQuery)}`
                : ""
            }`}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-b-3 border-amber-600 font-black text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <Gamepad2 className="w-4 h-4 shrink-0" />
            <span>🎮 Bu Gramer Kalıbıyla Alıştırma Yap</span>
          </Link>
        </div>
      </div>

      {/* 2. KATMAN AYRINTILI KONU ANLATIMI PENCERESİ */}
      <GrammarDeepDiveModal
        isOpen={isDeepDiveOpen}
        onClose={() => setIsDeepDiveOpen(false)}
        grammarNote={grammarNote}
        matchingSentences={matchingSentences}
        linkedLevel={linkedLevel}
        linkedLessonTitle={linkedLessonTitle}
        linkedLessonUrl={linkedLessonUrl}
        activeGrammarQuery={activeGrammarQuery}
      />
    </div>
  );
}

export type GrammarWindowViewMode = "drawer" | "smartboard";

export interface GrammarHapBilgiModalProps {
  isOpen: boolean;
  onClose: () => void;
  grammarNote?: GramerHapBilgi | null;
  dialogueId?: string;
  readingId?: string;
  sourceId?: string;
  grammarTopic?: string;
  initialViewMode?: GrammarWindowViewMode;
  onOpenShadowing?: (arabicText: string, turkishText?: string) => void;
}

export function GrammarHapBilgiModal({
  isOpen,
  onClose,
  grammarNote,
  dialogueId,
  readingId,
  sourceId,
  grammarTopic,
  initialViewMode = "drawer",
  onOpenShadowing,
}: GrammarHapBilgiModalProps) {
  const [viewMode, setViewMode] =
    useState<GrammarWindowViewMode>(initialViewMode);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopAllAudio();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const { resolvedNote } = useMemo(
    () =>
      resolveGrammarNoteAndSentences({
        grammarNote,
        dialogueId,
        readingId,
        sourceId,
        grammarTopic,
      }),
    [grammarNote, dialogueId, readingId, sourceId, grammarTopic]
  );

  if (!isOpen || !resolvedNote) return null;

  const isSmartboard = viewMode === "smartboard";

  return (
    <div
      className={
        isSmartboard
          ? "fixed inset-0 z-[90] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200"
          : "fixed inset-0 z-[90] pointer-events-none flex justify-end overflow-hidden"
      }
      onClick={
        isSmartboard
          ? () => {
              stopAllAudio();
              onClose();
            }
          : undefined
      }
    >
      {/* Yan Panel (Drawer) modunda mobilde hafif karartma, masaüstünde sol tarafı kapatmayan split-view */}
      {!isSmartboard && (
        <div
          className="fixed inset-0 bg-black/35 sm:bg-black/15 pointer-events-auto sm:pointer-events-none transition-opacity"
          onClick={() => {
            stopAllAudio();
            onClose();
          }}
        />
      )}

      <div
        className={
          isSmartboard
            ? "pointer-events-auto bg-[#FDFBF7] dark:bg-[var(--background)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 w-[94vw] lg:w-[85vw] max-w-[1350px] h-[88vh] sm:h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
            : "pointer-events-auto bg-[#FDFBF7] dark:bg-[var(--background)] border-l-4 border-[#087F5B] dark:border-emerald-600 w-full sm:w-[460px] lg:w-[540px] h-full flex flex-col shadow-[-12px_0_35px_rgba(0,0,0,0.22)] relative overflow-hidden animate-in slide-in-from-right duration-200"
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* ÜST SABİT KONTROL ÇUBUĞU: Başlık + [📐 Yan Panel | 🖥️ Geniş Pencere] + [✕ Kapat] */}
        <div className="px-4 sm:px-5 py-3 bg-[#F7EFE1] dark:bg-[var(--surface)] border-b-2 border-[#E6D7BE] dark:border-[var(--border)] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/70 border border-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#087F5B] dark:text-emerald-400">
                  📌 Gramer Hap Bilgi Penceresi
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-[var(--foreground)] truncate">
                {resolvedNote.konu_basligi}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Görünüm Modu Seçici: [📐 Yan Panel | 🖥️ Geniş Pencere] */}
            <div className="inline-flex items-center rounded-xl bg-white dark:bg-[var(--background)] p-0.5 border-2 border-[#E6D7BE] dark:border-[var(--border)]">
              <button
                type="button"
                onClick={() => setViewMode("drawer")}
                title="Yan Panel Modu (Sol tarafta metni okurken sağda grameri inceleyin)"
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black inline-flex items-center gap-1 transition-all cursor-pointer ${
                  !isSmartboard
                    ? "bg-[#087F5B] text-white shadow-2xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <PanelRight className="w-3.5 h-3.5 shrink-0" />
                <span>📐 Yan Panel</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("smartboard")}
                title="Akıllı Tahta / Geniş Pencere Modu (%85 Ekran)"
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black inline-flex items-center gap-1 transition-all cursor-pointer ${
                  isSmartboard
                    ? "bg-[#6741D9] text-white shadow-2xs"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>🖥️ Geniş Pencere</span>
              </button>
            </div>

            {/* ✕ Kapat Butonu */}
            <button
              type="button"
              onClick={() => {
                stopAllAudio();
                onClose();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-200 dark:border-rose-800 hover:border-rose-500 flex items-center gap-1 text-rose-700 dark:text-rose-200 font-black text-xs transition-colors cursor-pointer shrink-0"
              aria-label="Kapat"
              title="Pencereyi Kapat (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kapat</span>
            </button>
          </div>
        </div>

        {/* KAYDIRILABİLİR İÇERİK GÖVDESİ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <GrammarHapBilgiPanel
            grammarNote={resolvedNote}
            grammarTopic={grammarTopic}
            isSmartboardLarge={isSmartboard}
            showMatchingSentences={true}
            onOpenShadowing={(ar, tr) => {
              stopAllAudio();
              onClose();
              if (onOpenShadowing) onOpenShadowing(ar, tr);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export const GrammarQuickModal = GrammarHapBilgiModal;


