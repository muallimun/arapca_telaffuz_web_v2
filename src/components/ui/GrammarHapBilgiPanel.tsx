"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Lightbulb,
  Mic,
  Sparkles,
  Volume2,
  Target,
  Layers,
  PanelRight,
  PanelLeft,
  Maximize2,
  X,
  ExternalLink,
  Gamepad2,
  Table2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Compass,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import {
  GramerHapBilgi,
  AnahtarCumle,
  Level,
  GrammarDetailLayer,
} from "@/types/data";
import {
  cumleler1111,
  diyalogGramerNotlari,
  metinGramerNotlari,
  diyaloglar,
  metinler,
} from "@/lib/data";
import {
  speakHybrid,
  playDualGenderAudio,
  stopAllAudio,
} from "@/lib/audio";
import { useSettings } from "@/store/settings";
import { cleanArabicText } from "@/lib/dict";
import WordTooltip from "@/components/ui/WordTooltip";
import { playClick } from "@/lib/sfxManager";

function extractArabicKeyTokens(text: string): string[] {
  const matches = text.match(/[\u0600-\u06FF]+/g) || [];
  return Array.from(
    new Set(
      matches
        .map((m) => cleanArabicText(m).trim())
        .filter((m) => m.length >= 2)
    )
  );
}

const TURKISH_GRAMMAR_KEYWORDS = [
  "mübteda",
  "haber",
  "fail",
  "meful",
  "mef'ûl",
  "harf-i cer",
  "izafet",
  "muzaf",
  "sıfat",
  "mevsuf",
  "mazi",
  "muzari",
  "emir",
  "nehiy",
  "inne",
  "kâne",
  "kanê",
  "kane",
  "tesniye",
  "ikil",
  "cemi",
  "çoğul",
  "müennes",
  "müzekker",
  "zamir",
  "işaret",
  "soru",
  "istifham",
  "şart",
  "istisna",
  "hal",
  "temyiz",
  "mefulün",
  "masdar",
  "ism-i fail",
  "ism-i meful",
  "ism-i tafdil",
  "gayr-ı munsarif",
  "meçhul",
  "edilgen",
  "naib",
  "atıf",
  "bedel",
  "tekit",
  "zarf",
  "sayı",
];

function findMatching1111Sentences(
  note: GramerHapBilgi | null,
  explicitGrammarTopic?: string
): AnahtarCumle[] {
  const combinedSource = [
    explicitGrammarTopic || "",
    note?.konu_basligi || "",
    note?.hap_kural || "",
    note?.metinden_ornek?.aciklama || "",
  ]
    .join(" ")
    .toLowerCase();

  const arTokens = extractArabicKeyTokens(
    [
      explicitGrammarTopic || "",
      note?.konu_basligi || "",
      note?.hap_kural || "",
    ].join(" ")
  );

  const matchedTrKeywords = TURKISH_GRAMMAR_KEYWORDS.filter((kw) =>
    combinedSource.includes(kw)
  );

  const scored: { item: AnahtarCumle; score: number }[] = [];

  for (const c of cumleler1111) {
    const kalip = (c.odak_kalip || "").toLowerCase();
    const notTr = (c.not_tr || "").toLowerCase();
    let score = 0;

    if (
      explicitGrammarTopic &&
      kalip === explicitGrammarTopic.trim().toLowerCase()
    ) {
      score += 50;
    } else if (
      explicitGrammarTopic &&
      kalip.includes(explicitGrammarTopic.trim().toLowerCase())
    ) {
      score += 25;
    }

    for (const token of arTokens) {
      const cleanKalip = cleanArabicText(c.odak_kalip || "");
      const cleanAr = cleanArabicText(c.arapca || "");
      if (cleanKalip.includes(token)) {
        score += 12;
      } else if (cleanAr.includes(token)) {
        score += 4;
      }
    }

    for (const kw of matchedTrKeywords) {
      if (kalip.includes(kw)) score += 8;
      if (notTr.includes(kw)) score += 5;
    }

    if (score >= 8) {
      scored.push({ item: c, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 24).map((s) => s.item);
}

export interface ResolvedGrammarData {
  resolvedNote: GramerHapBilgi | null;
  matchingSentences: AnahtarCumle[];
  activeGrammarQuery: string;
  linkedLessonUrl: string | null;
  linkedLessonTitle: string | null;
  linkedLevel: Level | null;
}

const ALL_CANONICAL_GRAMMAR_NOTES: GramerHapBilgi[] = [
  ...diyalogGramerNotlari,
  ...metinGramerNotlari,
];

function enrichNoteWithCanonicalDetail(note: GramerHapBilgi): GramerHapBilgi {
  if (note.ayrintili_anlatim && note.ayrintili_anlatim.dikkat_sik_hata) {
    return note;
  }
  const canonical =
    ALL_CANONICAL_GRAMMAR_NOTES.find((g) => g.bagli_id === note.bagli_id) ||
    ALL_CANONICAL_GRAMMAR_NOTES.find(
      (g) =>
        g.konu_basligi.trim().toLowerCase() ===
        note.konu_basligi.trim().toLowerCase()
    );
  if (canonical?.ayrintili_anlatim) {
    return {
      ...canonical,
      ...note,
      ayrintili_anlatim: canonical.ayrintili_anlatim,
    };
  }
  return note;
}

export function resolveGrammarNoteAndSentences(params: {
  grammarNote?: GramerHapBilgi | null;
  dialogueId?: string;
  readingId?: string;
  sourceId?: string;
  grammarTopic?: string;
}): ResolvedGrammarData {
  const { grammarNote, dialogueId, readingId, sourceId, grammarTopic } = params;

  let resolvedNote: GramerHapBilgi | null = grammarNote
    ? enrichNoteWithCanonicalDetail(grammarNote)
    : null;
  const targetId = dialogueId || readingId || sourceId || grammarNote?.bagli_id;

  if (!resolvedNote && targetId) {
    if (targetId.startsWith("dlg_")) {
      resolvedNote =
        diyalogGramerNotlari.find((g) => g.bagli_id === targetId) || null;
    } else if (targetId.startsWith("metin_")) {
      resolvedNote =
        metinGramerNotlari.find((g) => g.bagli_id === targetId) || null;
    } else {
      resolvedNote =
        ALL_CANONICAL_GRAMMAR_NOTES.find((g) => g.bagli_id === targetId) ||
        null;
    }
  }

  if (!resolvedNote && grammarTopic) {
    const q = grammarTopic.trim().toLowerCase();
    resolvedNote =
      ALL_CANONICAL_GRAMMAR_NOTES.find(
        (g) =>
          g.konu_basligi.toLowerCase() === q ||
          g.konu_basligi.toLowerCase().includes(q) ||
          q.includes(g.konu_basligi.toLowerCase())
      ) || null;
  }

  const matchingSentences = findMatching1111Sentences(
    resolvedNote,
    grammarTopic
  );

  // Eğer sadece 1111_cumle odak_kalip etiketi ile açıldıysa ve 180 ana ders notunda birebir başlık yoksa sentetik bir GramerHapBilgi oluştur
  if (!resolvedNote && grammarTopic) {
    const firstSent = matchingSentences[0];
    const extraSents = matchingSentences.slice(1, 3);
    resolvedNote = {
      bagli_id: firstSent?.id || "cumle_kalip",
      konu_basligi: grammarTopic,
      hap_kural:
        firstSent?.not_tr ||
        `Bu gramer kalıbı (${grammarTopic}) Arapçada cümle kurarken kelimeler arasındaki görev, anlam ve hareke uyumunu belirleyen temel yapılardan biridir.`,
      metinden_ornek: firstSent
        ? {
            arapca: firstSent.arapca,
            turkce: firstSent.turkce,
            aciklama:
              firstSent.not_tr ||
              `Örnek cümlede "${firstSent.odak_kalip}" yapısı aktif olarak kullanılmıştır (${firstSent.baglam || "Günlük İletişim"}).`,
          }
        : {
            arapca: "العِلْمُ نُورٌ.",
            turkce: "İlim nurdur.",
            aciklama: "Temel Arapça cümle kalıbı örneği.",
          },
      ek_ornekler: extraSents.map((s) => ({
        arapca: s.arapca,
        turkce: s.turkce,
      })),
      ipucu:
        "Bu kalıpla oluşturulmuş tüm sesli cümleleri aşağıdan dinleyebilir ve 'Bu Kalıpla Alıştırma Yap' butonuyla pratik başlatabilirsiniz.",
    };
  }

  if (resolvedNote) {
    resolvedNote = enrichNoteWithCanonicalDetail(resolvedNote);
  }

  const finalId = resolvedNote?.bagli_id || targetId || "";
  let linkedLessonUrl: string | null = null;
  let linkedLessonTitle: string | null = null;
  let linkedLevel: Level | null = null;

  if (finalId.startsWith("dlg_")) {
    const dlg = diyaloglar.find((d) => d.id === finalId);
    linkedLessonUrl = `/diyalog/${finalId}`;
    linkedLessonTitle = dlg
      ? `Diyalog #${finalId.replace("dlg_", "")}: ${dlg.baslik_tr}`
      : `Diyalog #${finalId.replace("dlg_", "")}`;
    linkedLevel = dlg?.seviye || "A1";
  } else if (finalId.startsWith("metin_")) {
    const txt = metinler.find((m) => m.id === finalId);
    linkedLessonUrl = `/metin/${finalId}`;
    linkedLessonTitle = txt
      ? `Metin #${finalId.replace("metin_", "")}: ${txt.baslik_tr}`
      : `Okuma Metni #${finalId.replace("metin_", "")}`;
    linkedLevel = txt?.seviye || "A1";
  } else if (matchingSentences[0]) {
    linkedLevel =
      (matchingSentences[0].seviye as Level) ||
      (matchingSentences[0].cefr as Level) ||
      "A1";
  }

  const activeGrammarQuery =
    grammarTopic ||
    matchingSentences[0]?.odak_kalip ||
    resolvedNote?.konu_basligi ||
    "";

  return {
    resolvedNote,
    matchingSentences,
    activeGrammarQuery,
    linkedLessonUrl,
    linkedLessonTitle,
    linkedLevel,
  };
}

/**
 * Aynı metin içinde hem Arapça hem de Türkçe (veya parantez içi Türkçe açıklama)
 * bulunduğunda bunları birbirinden tamamen ayırır.
 * Böylece Türkçe açıklamalar asla `dir="rtl"` veya `font-arabic` içine girmez!
 */
export function splitArabicAndTurkish(rawText: string): {
  arabicPart: string;
  turkishNotes: string[];
} {
  if (!rawText) return { arabicPart: "", turkishNotes: [] };
  const turkishNotes: string[] = [];

  // Parantez içinde Latin/Türkçe harf barındıran tüm açıklamaları ayıkla
  const withoutParentheticalTr = rawText.replace(
    /\(([^)]*[a-zA-ZçğıöşüÇĞİÖŞÜâîûÂÎÛ][^)]*)\)/g,
    (_, inner: string) => {
      const cleaned = inner.trim();
      if (cleaned) turkishNotes.push(cleaned);
      return "";
    }
  );

  // Kalan metinde Arapça karakter var mı kontrol et
  const hasArabic = /[\u0600-\u06FF]/.test(withoutParentheticalTr);
  const hasLatin = /[a-zA-ZçğıöşüÇĞİÖŞÜâîûÂÎÛ]{2,}/.test(
    withoutParentheticalTr
  );

  if (hasArabic && !hasLatin) {
    const cleanedAr = withoutParentheticalTr
      .replace(/\s{2,}/g, " ")
      .replace(/\s+\./g, ".")
      .trim();
    return { arabicPart: cleanedAr, turkishNotes };
  }

  if (!hasArabic && hasLatin) {
    return {
      arabicPart: "",
      turkishNotes: [rawText.trim()],
    };
  }

  // Hem Arapça hem parantez dışı Türkçe kelimeler varsa satır/parça bazlı ayır
  const tokens = withoutParentheticalTr.split(/\s+/);
  const arWords: string[] = [];
  const trWords: string[] = [];
  for (const tok of tokens) {
    if (/[\u0600-\u06FF]/.test(tok) || /^[.،؟!/:؛\-]+$/.test(tok)) {
      arWords.push(tok);
    } else if (/[a-zA-ZçğıöşüÇĞİÖŞÜâîûÂÎÛ]/.test(tok)) {
      trWords.push(tok);
    }
  }
  if (trWords.length > 0) {
    turkishNotes.unshift(trWords.join(" "));
  }
  return {
    arabicPart: arWords.join(" ").trim(),
    turkishNotes,
  };
}

/**
 * Türkçe bir açıklama metni içinde geçen Arapça kelimeleri veya ekleri
 * otomatik olarak <bdi dir="rtl" lang="ar" className="arabic font-arabic ...">
 * içine alarak RTL/LTR karakter kaymasını %100 önler.
 */
function renderTurkishWithIsolatedArabic(
  text: string,
  arabicBadgeClass = "arabic font-arabic text-base sm:text-lg font-bold text-[#065F46] dark:text-emerald-400 px-1 inline-block"
): React.ReactNode {
  if (!text) return null;
  if (!/[\u0600-\u06FF]/.test(text)) {
    return text;
  }
  const parts = text.split(/([\u0600-\u06FF\u064B-\u065F\u0670\u0640]+(?:\s+[\u0600-\u06FF\u064B-\u065F\u0670\u0640]+)*)/g);
  return parts.map((part, idx) => {
    if (/[\u0600-\u06FF]/.test(part)) {
      return (
        <bdi key={idx} dir="rtl" lang="ar" className={arabicBadgeClass}>
          {part}
        </bdi>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Tablo hücrelerinde:
 * - Sadece Arapça ise: dir="rtl" lang="ar" font-arabic
 * - Sadece Türkçe ise: dir="ltr" lang="tr" font-sans
 * - Karışık ise (örn. "أَنَا (Ben)", "دَفْتَرٍ (Mecrûr ــٍ)"): Arapça üstte/sağda kendi RTL bloğunda,
 *   Türkçe açıklama altta/yanda kendi LTR font-sans bloğunda!
 */
function renderSmartTableCell(cell: string): React.ReactNode {
  const trimmed = (cell || "").trim();
  if (!trimmed || trimmed === "-") {
    return (
      <span className="text-slate-400 dark:text-slate-500 font-sans font-bold">
        —
      </span>
    );
  }

  const hasArabic = /[\u0600-\u06FF]/.test(trimmed);
  const hasLatin = /[a-zA-ZçğıöşüÇĞİÖŞÜâîûÂÎÛ]/.test(trimmed);

  // 1. Saf Arapça Hücre
  if (hasArabic && !hasLatin) {
    return (
      <div
        dir="rtl"
        lang="ar"
        className="arabic font-arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-relaxed"
      >
        {trimmed}
      </div>
    );
  }

  // 2. Saf Türkçe Hücre
  if (!hasArabic && hasLatin) {
    return (
      <div
        dir="ltr"
        lang="tr"
        className="font-sans text-xs sm:text-sm font-bold text-[var(--foreground)] text-left leading-snug"
      >
        {trimmed}
      </div>
    );
  }

  // 3. Karışık (Arapça + Parantez içi Türkçe Not) Hücre
  const { arabicPart, turkishNotes } = splitArabicAndTurkish(trimmed);
  if (arabicPart && turkishNotes.length > 0) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div
          dir="rtl"
          lang="ar"
          className="arabic font-arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 leading-relaxed self-stretch text-right"
        >
          {arabicPart}
        </div>
        {turkishNotes.map((trNote, idx) => (
          <div
            key={idx}
            dir="ltr"
            lang="tr"
            className="font-sans text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 bg-[#F7EFE1]/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-[#E6D7BE]/80 dark:border-slate-700 text-left leading-snug"
          >
            {renderTurkishWithIsolatedArabic(
              trNote,
              "arabic font-arabic text-sm font-bold text-[#087F5B] dark:text-emerald-400 px-0.5 inline-block"
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      dir="ltr"
      lang="tr"
      className="font-sans text-xs sm:text-sm font-bold text-[var(--foreground)] text-left leading-snug"
    >
      {renderTurkishWithIsolatedArabic(trimmed)}
    </div>
  );
}

/**
 * 180 Gramer Notu için JSON'da `ayrintili_anlatim` alanı varsa doğrudan onu döndürür;
 * yoksa (ör. 1111_cumle özel kalıbı) mevcut verilerden pedagojik olarak zenginleştirilmiş
 * 2. Katman (`GrammarDetailLayer`) üretir.
 */
export function buildSmartGrammarDetailLayer(
  note: GramerHapBilgi,
  matchingSentences: AnahtarCumle[]
): Required<GrammarDetailLayer> {
  const enriched = enrichNoteWithCanonicalDetail(note);
  const explicit = enriched.ayrintili_anlatim;

  if (
    explicit &&
    explicit.formul_sema &&
    explicit.adim_adim_anlatim &&
    explicit.adim_adim_anlatim.length > 0 &&
    explicit.ozet_tablo &&
    explicit.irab_tahlili &&
    explicit.irab_tahlili.length > 0 &&
    explicit.dikkat_sik_hata
  ) {
    return {
      formul_sema: explicit.formul_sema,
      adim_adim_anlatim: explicit.adim_adim_anlatim,
      ozet_tablo: explicit.ozet_tablo,
      irab_tahlili: explicit.irab_tahlili,
      dikkat_sik_hata: explicit.dikkat_sik_hata,
    };
  }

  const title = enriched.konu_basligi || "";
  const rule = enriched.hap_kural || "";
  const exAr = enriched.metinden_ornek?.arapca || "";
  const exTr = enriched.metinden_ornek?.turkce || "";
  const exAnalysis = enriched.metinden_ornek?.aciklama || "";
  const tip = enriched.ipucu || "";

  const formul_sema =
    explicit?.formul_sema ||
    `[${title}] ➔ ${exAr ? `${exAr} (${exTr})` : rule}`;

  let adim_adim_anlatim: string[] = explicit?.adim_adim_anlatim || [];
  if (adim_adim_anlatim.length === 0) {
    const ruleSentences = rule
      .split(/(?<=[.!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 4);

    adim_adim_anlatim = [
      `1. Temel Kural & Yapı: ${ruleSentences[0] || rule}`,
      ruleSentences.length > 1
        ? `2. Hareke (İ'rab) ve Uyum İlkesi: ${ruleSentences.slice(1).join(" ")}`
        : `2. Cümle İçi Uygulama: "${exAr}" cümlesinde (${exTr}) bu gramer kuralı doğrudan uygulanmıştır.`,
      exAnalysis
        ? `3. Örnek Cümle Çözümlemesi: ${exAnalysis}`
        : `3. Bağlamsal Kullanım: Bu kalıp günlük iletişimde ve metinlerde anlam bütünlüğünü kurmak için kullanılır.`,
      tip
        ? `4. Pratik Ayırt Etme İpucu: ${tip}`
        : `4. Pekiştirme Notu: Aşağıdaki karşılaştırmalı tabloyu ve kelime kelime i'rab analizini inceleyerek kalıbı pekiştirebilirsiniz.`,
    ];
  }

  let ozet_tablo = explicit?.ozet_tablo;
  if (!ozet_tablo) {
    const rows: string[][] = [];
    if (exAr) {
      rows.push([
        "Odak Ders Örneği",
        exAr,
        exTr,
        exAnalysis || "Ana kural uygulaması",
      ]);
    }
    for (const [idx, ek] of (enriched.ek_ornekler || []).entries()) {
      rows.push([
        `Pekiştirme Örneği #${idx + 1}`,
        ek.arapca,
        ek.turkce,
        "Aynı kalıpla kurulan paralel yapı",
      ]);
    }
    for (const sent of matchingSentences.slice(
      0,
      Math.max(0, 4 - rows.length)
    )) {
      rows.push([
        sent.odak_kalip || "Günlük Kalıp",
        sent.arapca,
        sent.turkce,
        sent.not_tr || sent.baglam || "Günlük kullanım örneği",
      ]);
    }

    ozet_tablo = {
      tablo_basligi: `${title} — Karşılaştırmalı Örnek ve Kalıp Tablosu`,
      sutunlar: [
        "Kalıp / Tür",
        "Arapça Yapı",
        "Türkçe Anlamı",
        "Gramer & Uyum Notu",
      ],
      satirlar: rows,
    };
  }

  let irab_tahlili = explicit?.irab_tahlili || [];
  if (irab_tahlili.length === 0 && exAr) {
    const rawWords = exAr
      .replace(/[،.؟!":؛«»]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean);

    const HARFI_CERLER = new Set([
      "فِي",
      "مِنْ",
      "مِنَ",
      "إِلَى",
      "عَلَى",
      "عَنْ",
      "مَعَ",
      "بَعْدَ",
      "قَبْلَ",
      "أَمَامَ",
      "خَلْفَ",
      "تَحْتَ",
      "فَوْقَ",
      "عِنْدَ",
    ]);

    irab_tahlili = rawWords.slice(0, 6).map((w, idx) => {
      const prevW = idx > 0 ? rawWords[idx - 1] : "";
      const lastChar = w.slice(-1);

      let gorevi = "Cümle Ögesi";
      let hareke_nedeni =
        exAnalysis ||
        "Cümle içindeki sözdizimsel konumuna göre harekelenmiştir.";

      if (HARFI_CERLER.has(w)) {
        gorevi = "Harf-i Cer / Zarf Edatı";
        hareke_nedeni =
          "Mebni edattır; kendisinden sonra gelen ismi mecrûr (esreli) yapar.";
      } else if (prevW && HARFI_CERLER.has(prevW)) {
        gorevi = "İsm-i Mecrûr / Muzafun İleyh";
        hareke_nedeni = `"${prevW}" edatından sonra geldiği için kesra (esre) ile mecrûrdur.`;
      } else if (lastChar === "\u064F" || lastChar === "\u064C") {
        gorevi =
          idx === 0
            ? "Mübteda (Özne) veya Muzari Fiil"
            : "Haber / Fâil (Merfû Öge)";
        hareke_nedeni =
          "Merfû konumda olduğu için son harekesi damme (ötre) olmuştur.";
      } else if (lastChar === "\u064E" || lastChar === "\u064B") {
        gorevi =
          idx === 0
            ? "Mâzî Fiil veya Edat"
            : "Mef'ûlün Bih (Nesne) / Zarf (Mansûb)";
        hareke_nedeni =
          idx === 0
            ? "Fetha üzere mebni fiil/edat yapısıdır."
            : "Mansûb konumda olduğu için fetha (üstün) harekesi almıştır.";
      } else if (lastChar === "\u0650" || lastChar === "\u064D") {
        gorevi = "Mecrûr İsim / Muzafun İleyh";
        hareke_nedeni =
          "Harf-i cer veya izafet (isim tamlaması) sebebiyle kesra (esre) almıştır.";
      } else if (lastChar === "\u0652") {
        gorevi = "Emir Fiili / Cezimli Öge veya Zamir";
        hareke_nedeni = "Sükûn (cezim) üzere mebni yapıdır.";
      }

      return {
        kelime: w,
        gorevi,
        hareke_nedeni,
      };
    });
  }

  let dikkat_sik_hata = explicit?.dikkat_sik_hata;
  if (!dikkat_sik_hata) {
    let wrongAr = "";
    if (exAr) {
      const words = exAr.trim().split(/\s+/);
      if (words.length > 0) {
        const lastIdx = words.length - 1;
        // Noktalama işaretini geçici olarak ayır ki son hareke doğru değiştirilebilsin
        const rawLastWord = words[lastIdx];
        const punctMatch = rawLastWord.match(/([.،؟!":؛«»]+)$/);
        const trailingPunct = punctMatch ? punctMatch[1] : "";
        const coreWord = trailingPunct
          ? rawLastWord.slice(0, -trailingPunct.length)
          : rawLastWord;

        let mutatedCore = coreWord;
        if (/\u064C$/.test(coreWord)) {
          mutatedCore = coreWord.replace(/\u064C$/, "\u064B");
        } else if (/\u064D$/.test(coreWord)) {
          mutatedCore = coreWord.replace(/\u064D$/, "\u064C");
        } else if (/\u064B$/.test(coreWord)) {
          mutatedCore = coreWord.replace(/\u064B$/, "\u064C");
        } else if (/\u064F$/.test(coreWord)) {
          mutatedCore = coreWord.replace(/\u064F$/, "\u064E");
        } else if (/\u0650$/.test(coreWord)) {
          mutatedCore = coreWord.replace(/\u0650$/, "\u064F");
        } else if (/\u064E$/.test(coreWord)) {
          mutatedCore = coreWord.replace(/\u064E$/, "\u0650");
        } else {
          mutatedCore = `${coreWord}\u064F`;
        }

        words[lastIdx] = `${mutatedCore}${trailingPunct}`;
        wrongAr = words.join(" ");
      }
    }

    if (!wrongAr || wrongAr === exAr) {
      wrongAr = `${exAr || "المِثَالُ"} (Son harekeyi yanlış okumak)`;
    }

    dikkat_sik_hata = {
      yanlis: wrongAr,
      dogru: exAr || rule,
      neden:
        tip ||
        exAnalysis ||
        rule ||
        "Kelimenin cümle içindeki görevi (özne, nesne veya harf-i cer sonrası) son harekeyi doğrudan belirler.",
    };
  }

  return {
    formul_sema,
    adim_adim_anlatim,
    ozet_tablo,
    irab_tahlili,
    dikkat_sik_hata,
  };
}

interface GrammarDeepDiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  grammarNote: GramerHapBilgi;
  matchingSentences: AnahtarCumle[];
  linkedLevel: Level | null;
  linkedLessonTitle: string | null;
  linkedLessonUrl: string | null;
  activeGrammarQuery: string;
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

  const parsedYanlis = useMemo(
    () => splitArabicAndTurkish(detailLayer.dikkat_sik_hata.yanlis),
    [detailLayer.dikkat_sik_hata.yanlis]
  );

  const parsedDogru = useMemo(
    () => splitArabicAndTurkish(detailLayer.dikkat_sik_hata.dogru),
    [detailLayer.dikkat_sik_hata.dogru]
  );

  if (!isOpen) return null;

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

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      onClick={() => {
        stopAllAudio();
        onClose();
      }}
    >
      <div
        className="bg-[#FDFBF7] dark:bg-[var(--background)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 w-[96vw] lg:w-[88vw] max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ÜST SABİT BAŞLIK ÇUBUĞU */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#065F46] via-[#087F5B] to-teal-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                  2. Katman • Ayrıntılı Konu Anlatımı &amp; İ&apos;rab Çözümlemesi
                </span>
                {linkedLevel && (
                  <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-black">
                    Seviye {linkedLevel}
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-lg font-black text-white leading-snug break-words">
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
            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-rose-600 text-white border border-white/25 font-black text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Ayrıntılı Anlatımı Kapat (Esc)"
          >
            <X className="w-4 h-4 shrink-0" />
            <span>Kapat (Esc)</span>
          </button>
        </div>

        {/* KAYDIRILABİLİR 5 BÖLÜMLÜ PEDAGOJİK GÖVDE */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5">
          {/* KART 1: GÖRSEL FORMÜL & ŞEMA KUTUSU (formul_sema) */}
          <section className="rounded-2xl sm:rounded-3xl border-2 border-[#6741D9]/40 bg-gradient-to-br from-[#F3F0FF] via-white to-[#F7EFE1] dark:from-indigo-950/60 dark:via-[var(--surface)] dark:to-[var(--background)] p-4 sm:p-6 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#6741D9] text-white font-black text-xs uppercase tracking-wider">
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <span>1. Görsel Formül &amp; Sözdizimi Şeması</span>
              </span>
              {linkedLessonTitle && linkedLessonUrl && (
                <Link
                  href={linkedLessonUrl}
                  onClick={() => onClose()}
                  className="text-xs font-extrabold text-[#6741D9] dark:text-indigo-300 hover:underline inline-flex items-center gap-1"
                >
                  <span>{linkedLessonTitle}</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            <div
              dir="ltr"
              lang="tr"
              className="rounded-2xl bg-white/95 dark:bg-[var(--background)] border-2 border-[#6741D9]/30 p-3.5 sm:p-4 text-center shadow-2xs"
            >
              <p className="font-sans text-sm sm:text-base md:text-lg font-black text-[#4C28B5] dark:text-indigo-200 leading-relaxed break-words">
                {renderTurkishWithIsolatedArabic(
                  detailLayer.formul_sema,
                  "arabic font-arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 px-1 inline-block"
                )}
              </p>
            </div>
          </section>

          {/* KART 2: ADIM ADIM AYRINTILI KONU ANLATIMI (adim_adim_anlatim) */}
          <section className="rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#087F5B] text-white font-black text-xs uppercase tracking-wider">
                <ListChecks className="w-4 h-4 shrink-0" />
                <span>2. Adım Adım Ayrıntılı Konu Anlatımı</span>
              </span>
            </div>

            <div className="space-y-2.5">
              {detailLayer.adim_adim_anlatim.map((step, idx) => (
                <div
                  key={idx}
                  dir="ltr"
                  lang="tr"
                  className="rounded-2xl bg-white/95 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 sm:p-4 flex items-start gap-3"
                >
                  <span className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-400 text-[#065F46] dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="font-sans text-xs sm:text-sm md:text-base font-bold text-[var(--foreground)] leading-relaxed break-words flex-1">
                    {renderTurkishWithIsolatedArabic(step.replace(/^\d+\.\s*/, ""))}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* KART 3: KARŞILAŞTIRMALI ÇEKİM & KURAL TABLOSU (ozet_tablo) */}
          {detailLayer.ozet_tablo &&
            detailLayer.ozet_tablo.satirlar.length > 0 && (
              <section className="rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-xs space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-600 text-white font-black text-xs uppercase tracking-wider">
                    <Table2 className="w-4 h-4 shrink-0" />
                    <span>3. {detailLayer.ozet_tablo.tablo_basligi}</span>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-white dark:bg-[var(--background)]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#EFE5D4] dark:bg-slate-800 border-b-2 border-[#E6D7BE] dark:border-slate-700">
                        {detailLayer.ozet_tablo.sutunlar.map((col, cIdx) => (
                          <th
                            key={cIdx}
                            dir="ltr"
                            lang="tr"
                            className="py-2.5 px-3 sm:px-4 font-sans text-[11px] sm:text-xs font-black uppercase tracking-wider text-[var(--foreground)]"
                          >
                            {renderTurkishWithIsolatedArabic(col)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D7BE]/70 dark:divide-slate-800">
                      {detailLayer.ozet_tablo.satirlar.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-[#F7EFE1]/50 dark:hover:bg-slate-900/50 transition-colors"
                        >
                          {row.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className="py-3 px-3 sm:px-4 align-middle"
                            >
                              {renderSmartTableCell(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

          {/* KART 4: KELİME KELİME İ'RAB & HAREKE ÇÖZÜMLEMESİ (irab_tahlili) */}
          {detailLayer.irab_tahlili && detailLayer.irab_tahlili.length > 0 && (
            <section className="rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-xs space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#6741D9] text-white font-black text-xs uppercase tracking-wider">
                  <Target className="w-4 h-4 shrink-0" />
                  <span>4. Kelime Kelime İ&apos;rab &amp; Hareke Çözümlemesi</span>
                </span>
                {grammarNote.metinden_ornek?.arapca && (
                  <button
                    type="button"
                    onClick={() =>
                      handleListen(
                        grammarNote.metinden_ornek.arapca,
                        "deep-dive-main"
                      )
                    }
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold border-2 inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                      playingKey === "deep-dive-main"
                        ? "bg-[#087F5B] text-white border-[#065F46]"
                        : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] hover:border-[#087F5B]"
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#087F5B] shrink-0" />
                    <span>
                      {playingKey === "deep-dive-main"
                        ? "Dinleniyor..."
                        : "Örnek Cümleyi Dinle"}
                    </span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {detailLayer.irab_tahlili.map((item, idx) => {
                  const wKey = `irab-w-${idx}`;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl bg-white/95 dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-2 hover:border-[#6741D9] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#E6D7BE] dark:border-slate-800 pb-2">
                        <button
                          type="button"
                          onClick={() => handleListen(item.kelime, wKey)}
                          className="w-7 h-7 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] flex items-center justify-center text-[#087F5B] hover:bg-emerald-50 cursor-pointer shrink-0"
                          title="Kelimeyi dinle"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <span
                          dir="rtl"
                          lang="ar"
                          className="arabic font-arabic text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-relaxed"
                        >
                          {item.kelime}
                        </span>
                      </div>
                      <div dir="ltr" lang="tr" className="space-y-1 text-left">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-[#F3F0FF] dark:bg-indigo-950/70 text-[#6741D9] dark:text-indigo-300 font-sans text-[11px] font-black">
                          {renderTurkishWithIsolatedArabic(
                            item.gorevi,
                            "arabic font-arabic text-xs font-bold text-[#6741D9] dark:text-indigo-200 px-0.5 inline-block"
                          )}
                        </span>
                        <p className="font-sans text-xs font-semibold text-[var(--muted)] leading-snug">
                          {renderTurkishWithIsolatedArabic(
                            item.hareke_nedeni,
                            "arabic font-arabic text-sm font-bold text-[#065F46] dark:text-emerald-400 px-0.5 inline-block"
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* KART 5: SIK YAPILAN HATA & DOĞRUSU (dikkat_sik_hata) */}
          <section className="rounded-2xl sm:rounded-3xl border-2 border-amber-300 dark:border-amber-700 border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-4 sm:p-6 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>5. Sık Yapılan Hata &amp; Doğrusu</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Sol Kutu: Yanlış Kullanım */}
              <div className="rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/40 p-4 space-y-2 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-black text-xs uppercase tracking-wider">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>Yanlış Kullanım</span>
                  </div>
                  {parsedYanlis.arabicPart && (
                    <div
                      dir="rtl"
                      lang="ar"
                      className="arabic font-arabic text-xl sm:text-2xl font-bold text-rose-900 dark:text-rose-200 text-right leading-relaxed break-words"
                    >
                      {parsedYanlis.arabicPart}
                    </div>
                  )}
                </div>
                {parsedYanlis.turkishNotes.length > 0 && (
                  <div
                    dir="ltr"
                    lang="tr"
                    className="font-sans text-xs sm:text-sm font-semibold text-rose-800 dark:text-rose-200 text-left pt-1.5 border-t border-rose-200/80 dark:border-rose-800/60"
                  >
                    {parsedYanlis.turkishNotes.map((note, idx) => (
                      <div key={idx}>
                        {renderTurkishWithIsolatedArabic(
                          note,
                          "arabic font-arabic text-sm font-bold text-rose-900 dark:text-rose-200 px-0.5 inline-block"
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sağ Kutu: Doğru Kullanım */}
              <div className="rounded-2xl border-2 border-emerald-400 dark:border-emerald-700 bg-emerald-50/90 dark:bg-emerald-950/40 p-4 space-y-2 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[#065F46] dark:text-emerald-300 font-black text-xs uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Doğru Kullanım</span>
                    </div>
                    {(parsedDogru.arabicPart ||
                      grammarNote.metinden_ornek?.arapca) && (
                      <button
                        type="button"
                        onClick={() =>
                          handleListen(
                            parsedDogru.arabicPart ||
                              grammarNote.metinden_ornek.arapca,
                            "correct-usage-audio"
                          )
                        }
                        className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-emerald-400 text-[11px] font-extrabold text-[#065F46] dark:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3 shrink-0" />
                        <span>Dinle</span>
                      </button>
                    )}
                  </div>
                  {parsedDogru.arabicPart && (
                    <div
                      dir="rtl"
                      lang="ar"
                      className="arabic font-arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-300 text-right leading-relaxed break-words"
                    >
                      {parsedDogru.arabicPart}
                    </div>
                  )}
                </div>
                {parsedDogru.turkishNotes.length > 0 && (
                  <div
                    dir="ltr"
                    lang="tr"
                    className="font-sans text-xs sm:text-sm font-semibold text-[#065F46] dark:text-emerald-200 text-left pt-1.5 border-t border-emerald-200/80 dark:border-emerald-800/60"
                  >
                    {parsedDogru.turkishNotes.map((note, idx) => (
                      <div key={idx}>
                        {renderTurkishWithIsolatedArabic(
                          note,
                          "arabic font-arabic text-sm font-bold text-[#065F46] dark:text-emerald-300 px-0.5 inline-block"
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Alt Kutu: Neden */}
            <div
              dir="ltr"
              lang="tr"
              className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/40 p-3.5 sm:p-4 flex items-start gap-3 text-left"
            >
              <Lightbulb className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
              <div className="font-sans text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100 leading-relaxed">
                <strong className="font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mr-1.5">
                  Neden:
                </strong>
                {renderTurkishWithIsolatedArabic(
                  detailLayer.dikkat_sik_hata.neden,
                  "arabic font-arabic text-base font-bold text-[#065F46] dark:text-emerald-400 px-1 inline-block"
                )}
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
                <BookOpen className="w-3.5 h-3.5 text-[#087F5B] shrink-0" />
                <span>Derse Git ({linkedLessonTitle})</span>
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
              <Gamepad2 className="w-4 h-4 shrink-0" />
              <span>Bu Kalıpla Alıştırma Yap</span>
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
  isCompactDrawer?: boolean;
  showMatchingSentences?: boolean;
}

export function GrammarHapBilgiPanel({
  grammarNote,
  grammarTopic,
  onOpenShadowing,
  isSmartboardLarge = false,
  isCompactDrawer = false,
  showMatchingSentences = true,
}: GrammarHapBilgiPanelProps) {
  const { speechRate, preferredVoiceGender } = useSettings();
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [showAllSentences, setShowAllSentences] = useState(false);
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false);

  const {
    resolvedNote,
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

  const activeNote = resolvedNote || enrichNoteWithCanonicalDetail(grammarNote);

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

  const handleListenSentence1111 = async (sent: AnahtarCumle, key: string) => {
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
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300 overflow-x-hidden">
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
                <BookOpen className="w-3 h-3 text-[#087F5B] shrink-0" />
                <span>Ders: {linkedLessonTitle}</span>
                <ExternalLink className="w-3 h-3 text-[#087F5B] shrink-0" />
              </Link>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-white/85 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] font-extrabold text-[11px]">
                İçerik: {activeNote.bagli_id.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <h2
          className={`${
            isSmartboardLarge
              ? "text-xl sm:text-3xl"
              : "text-lg sm:text-2xl"
          } font-black text-[var(--foreground)] tracking-tight mb-3.5 leading-snug break-words`}
        >
          {activeNote.konu_basligi}
        </h2>

        <div
          dir="ltr"
          lang="tr"
          className="bg-white/95 dark:bg-[var(--background)] rounded-2xl p-4 sm:p-5 border-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-2xs"
        >
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
                } font-sans font-bold text-[var(--foreground)] leading-relaxed break-words`}
              >
                {renderTurkishWithIsolatedArabic(activeNote.hap_kural)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. İÇERİKTEN ODAK ÖRNEK KARTI */}
      {activeNote.metinden_ornek && (
        <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 shadow-xs space-y-3.5">
          {/* Üst Bar: Sol tarafta rozet, sağ tarafta Dinle ve Telaffuz Et butonları */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/70 text-[#6741D9] dark:text-indigo-200 border border-[#6741D9]/35 font-black text-[11px] sm:text-xs uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span>ODAK ÖRNEK &amp; ÇÖZÜMLEME</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleListen(
                    activeNote.metinden_ornek.arapca,
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
                  {playingKey === "main-example" ? "Dinleniyor..." : "Dinle"}
                </span>
              </button>

              {onOpenShadowing && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenShadowing(
                      activeNote.metinden_ornek.arapca,
                      activeNote.metinden_ornek.turkce
                    )
                  }
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-900 dark:text-amber-200 border-2 border-amber-300 dark:border-amber-700 border-b-3 active:translate-y-[1px] font-extrabold text-xs transition-all cursor-pointer"
                  title="Telaffuz koçu ile dene"
                >
                  <Mic className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Telaffuz Et</span>
                </button>
              )}
            </div>
          </div>

          {/* Gövde Kutusu: Arapça Örnek Cümle + Türkçe Çevirisi */}
          <div className="bg-white/90 dark:bg-[var(--background)] rounded-2xl p-4 sm:p-5 border border-[#E6D7BE] dark:border-[var(--border)] space-y-3.5 overflow-hidden">
            {/* 1. Arapça Örnek Cümle */}
            <div
              dir="rtl"
              lang="ar"
              className={`arabic font-arabic ${
                isSmartboardLarge
                  ? "text-2xl sm:text-4xl"
                  : "text-xl sm:text-2xl md:text-3xl"
              } leading-[2.1] font-bold text-[#065F46] dark:text-emerald-400 text-right break-words`}
            >
              <WordTooltip
                text={activeNote.metinden_ornek.arapca}
                contextSentenceTr={activeNote.metinden_ornek.turkce}
              />
            </div>

            {/* 2. Türkçe Çevirisi */}
            <div
              dir="ltr"
              lang="tr"
              className="border-l-4 border-[#087F5B] pl-3 py-1 bg-[#F7EFE1]/55 dark:bg-[var(--surface)]/60 rounded-r-xl"
            >
              <p
                className={`${
                  isSmartboardLarge
                    ? "text-base sm:text-xl"
                    : "text-sm sm:text-base"
                } font-sans font-medium text-[var(--foreground)] leading-relaxed break-words text-left`}
              >
                “{activeNote.metinden_ornek.turkce}”
              </p>
            </div>
          </div>

          {/* Gramer Analizi Kutusu */}
          {activeNote.metinden_ornek.aciklama && (
            <div
              dir="ltr"
              lang="tr"
              className="bg-sky-50/90 dark:bg-sky-950/40 border-2 border-sky-200 dark:border-sky-800/70 rounded-xl p-3.5 sm:p-4 font-sans text-xs sm:text-sm font-bold text-sky-950 dark:text-sky-200 leading-relaxed break-words text-left"
            >
              <span className="font-black uppercase text-[11px] tracking-wider block text-sky-800 dark:text-sky-300 mb-1">
                Gramer Analizi &amp; İ&apos;rab Notu:
              </span>
              {renderTurkishWithIsolatedArabic(
                activeNote.metinden_ornek.aciklama
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. PEKİŞTİRİCİ EK ÖRNEKLER */}
      {activeNote.ek_ornekler && activeNote.ek_ornekler.length > 0 && (
        <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 shadow-xs">
          <h3 className="text-sm sm:text-base font-black text-[var(--foreground)] uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#087F5B] dark:text-emerald-400 shrink-0" />
            <span>Pekiştirici Ek Örnekler</span>
          </h3>
          <div
            className={
              isCompactDrawer
                ? "grid grid-cols-1 gap-3.5"
                : "grid grid-cols-1 md:grid-cols-2 gap-3.5"
            }
          >
            {activeNote.ek_ornekler.map((ex, i) => {
              const key = `extra-${i}`;
              return (
                <div
                  key={i}
                  className="bg-white/90 dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 flex flex-col justify-between gap-3 hover:border-[#087F5B] transition-colors overflow-hidden"
                >
                  <div className="space-y-2">
                    <div
                      dir="rtl"
                      lang="ar"
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
                    <p
                      dir="ltr"
                      lang="tr"
                      className="font-sans text-xs sm:text-sm font-bold text-[var(--foreground)] border-l-3 border-[#6741D9] pl-2.5 py-0.5 break-words text-left"
                    >
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
                      <span>{playingKey === key ? "Dinleniyor" : "Dinle"}</span>
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
      {activeNote.ipucu && (
        <div
          dir="ltr"
          lang="tr"
          className="bg-amber-50/90 dark:bg-amber-950/40 rounded-2xl sm:rounded-3xl border-2 border-amber-300 dark:border-amber-700 border-b-4 p-4 sm:p-5 shadow-xs flex items-start gap-3.5 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-200/80 dark:bg-amber-900/70 border border-amber-400 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-amber-800 dark:text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-300 block mb-1">
              Pratik Öğrenme İpucu
            </span>
            <p
              className={`${
                isSmartboardLarge
                  ? "text-sm sm:text-base"
                  : "text-xs sm:text-sm"
              } font-sans font-bold text-amber-950 dark:text-amber-100 leading-relaxed break-words`}
            >
              {renderTurkishWithIsolatedArabic(activeNote.ipucu)}
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
          <span className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-amber-300" />
          </span>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 block">
              Görsel Şema • Karşılaştırmalı Tablo • Kelime Kelime İ&apos;rab • Sık Hatalar
            </span>
            <span className="text-sm sm:text-base font-black text-white block mt-0.5">
              Ayrıntılı Konu Anlatımı, Şema &amp; İ&apos;rab Çözümlemesi İçin Tıklayınız →
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
                <span>Bu Gramer Kalıbına Ait Günlük Cümleler</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-black text-[#087F5B] dark:text-emerald-300">
                {matchingSentences.length} Cümle
              </span>
            </div>
          </div>

          <div
            className={
              isCompactDrawer
                ? "grid grid-cols-1 gap-3"
                : "grid grid-cols-1 md:grid-cols-2 gap-3"
            }
          >
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
                      lang="ar"
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
                    <p
                      dir="ltr"
                      lang="tr"
                      className="font-sans text-xs sm:text-sm font-bold text-[var(--foreground)] border-l-3 border-[#087F5B] pl-2.5 py-0.5 break-words text-left"
                    >
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
                        {playingKey === sKey ? "Dinleniyor..." : "Dinle"}
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
            Pedagojik Pekiştirme Adımı
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
              <span>İlgili Derse Git</span>
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
            <span>Bu Gramer Kalıbıyla Alıştırma Yap</span>
          </Link>
        </div>
      </div>

      {/* 2. KATMAN AYRINTILI KONU ANLATIMI PENCERESİ */}
      <GrammarDeepDiveModal
        isOpen={isDeepDiveOpen}
        onClose={() => setIsDeepDiveOpen(false)}
        grammarNote={activeNote}
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
  const [drawerSide, setDrawerSide] = useState<"left" | "right">("right");

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

  // Yan Panel (Split-View Drawer) açıkken masaüstünde (lg+) ana sayfa içeriğini
  // otomatik kaydırarak sağdaki veya soldaki Arapça/Türkçe metin kartlarının üstünün kapanmasını %100 önle
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isOpen || viewMode !== "drawer") {
      document.body.style.paddingRight = "";
      document.body.style.paddingLeft = "";
      document.body.style.transition = "";
      return;
    }

    const applySplitLayoutShift = () => {
      if (window.innerWidth >= 1024) {
        document.body.style.transition =
          "padding-left 200ms ease, padding-right 200ms ease";
        if (drawerSide === "right") {
          document.body.style.paddingRight = "480px";
          document.body.style.paddingLeft = "";
        } else {
          document.body.style.paddingLeft = "480px";
          document.body.style.paddingRight = "";
        }
      } else {
        document.body.style.paddingRight = "";
        document.body.style.paddingLeft = "";
      }
    };

    applySplitLayoutShift();
    window.addEventListener("resize", applySplitLayoutShift);
    return () => {
      window.removeEventListener("resize", applySplitLayoutShift);
      document.body.style.paddingRight = "";
      document.body.style.paddingLeft = "";
      document.body.style.transition = "";
    };
  }, [isOpen, viewMode, drawerSide]);

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
          : `fixed inset-0 z-[90] pointer-events-none flex ${
              drawerSide === "left" ? "justify-start" : "justify-end"
            } overflow-hidden`
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
      {/* Yan Panel (Drawer) modunda sadece mobilde (<1024px) arka plan karartması, masaüstünde sayfa ile yan yana (Split-View) */}
      {!isSmartboard && (
        <div
          className="fixed inset-0 bg-black/35 lg:bg-transparent pointer-events-auto lg:pointer-events-none transition-opacity"
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
            : `pointer-events-auto bg-[#FDFBF7] dark:bg-[var(--background)] ${
                drawerSide === "left"
                  ? "border-r-4 border-[#087F5B] dark:border-emerald-600 shadow-[12px_0_35px_rgba(0,0,0,0.22)] animate-in slide-in-from-left"
                  : "border-l-4 border-[#087F5B] dark:border-emerald-600 shadow-[-12px_0_35px_rgba(0,0,0,0.22)] animate-in slide-in-from-right"
              } w-full sm:w-[450px] lg:w-[480px] h-full flex flex-col relative overflow-hidden duration-200`
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* ÜST SABİT KONTROL ÇUBUĞU: Üst satırda kontrol butonları, hemen altında tam genişlikte kesilmeyen konu başlığı */}
        <div className="px-4 sm:px-5 py-3 bg-[#F7EFE1] dark:bg-[var(--surface)] border-b-2 border-[#E6D7BE] dark:border-[var(--border)] space-y-2 shrink-0">
          {/* 1. Satır: Rozet + Görünüm / Yön / Kapat Butonları */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/70 border border-amber-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#087F5B] dark:text-emerald-400">
                Gramer Hap Bilgi Penceresi
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {/* Yan Panel Konum Seçici: Sola Yasla / Sağa Yasla (Sadece Drawer Modunda) */}
              {!isSmartboard && (
                <div className="hidden sm:inline-flex items-center rounded-xl bg-white dark:bg-[var(--background)] p-0.5 border-2 border-[#E6D7BE] dark:border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setDrawerSide("left");
                    }}
                    title="Paneli Sola Yasla"
                    className={`px-2 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 transition-all cursor-pointer ${
                      drawerSide === "left"
                        ? "bg-amber-500 text-slate-950"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <PanelLeft className="w-3 h-3 shrink-0" />
                    <span>Sol</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setDrawerSide("right");
                    }}
                    title="Paneli Sağa Yasla"
                    className={`px-2 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 transition-all cursor-pointer ${
                      drawerSide === "right"
                        ? "bg-amber-500 text-slate-950"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <PanelRight className="w-3 h-3 shrink-0" />
                    <span>Sağ</span>
                  </button>
                </div>
              )}

              {/* Görünüm Modu Seçici: [Yan Panel | Geniş Pencere] */}
              <div className="inline-flex items-center rounded-xl bg-white dark:bg-[var(--background)] p-0.5 border-2 border-[#E6D7BE] dark:border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setViewMode("drawer");
                  }}
                  title="Yan Panel Modu (Metni okurken yan tarafta grameri inceleyin)"
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black inline-flex items-center gap-1 transition-all cursor-pointer ${
                    !isSmartboard
                      ? "bg-[#087F5B] text-white shadow-2xs"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <PanelRight className="w-3.5 h-3.5 shrink-0" />
                  <span>Yan Panel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setViewMode("smartboard");
                  }}
                  title="Akıllı Tahta / Geniş Pencere Modu (%85 Ekran)"
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black inline-flex items-center gap-1 transition-all cursor-pointer ${
                    isSmartboard
                      ? "bg-[#6741D9] text-white shadow-2xs"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Geniş Pencere</span>
                </button>
              </div>

              {/* Kapat Butonu */}
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
                <X className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Kapat</span>
              </button>
            </div>
          </div>

          {/* 2. Satır: Konu Başlığı (Tam Genişlikte, Kesilmeden) */}
          <h3 className="text-sm sm:text-base font-black text-[var(--foreground)] leading-snug break-words w-full">
            {resolvedNote.konu_basligi}
          </h3>
        </div>

        {/* KAYDIRILABİLİR İÇERİK GÖVDESİ (Yatay Kaydırma Tamamen Kapalı) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          <GrammarHapBilgiPanel
            grammarNote={resolvedNote}
            grammarTopic={grammarTopic}
            isSmartboardLarge={isSmartboard}
            isCompactDrawer={!isSmartboard}
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
