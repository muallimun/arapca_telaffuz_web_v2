"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Columns2,
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
  ArrowLeft,
  ChevronDown,
  ChevronUp,
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
  ekGramerNotlari,
  diyaloglar,
  metinler,
} from "@/lib/data";
import {
  speakHybrid,
  playDualGenderAudio,
  stopAllAudio,
} from "@/lib/audio";
import { useSettings, GrammarDepthMode } from "@/store/settings";
import type { GrammarSplitSide } from "@/store/classroomToolsStore";
import { cleanArabicText } from "@/lib/dict";
import {
  fixArabicTypography,
  formatTurkishCategory,
  simplifyGrammarTerminology,
} from "@/lib/arabicTextUtils";
export { simplifyGrammarTerminology };
import { MixedText } from "@/components/ui/MixedText";
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
  ...ekGramerNotlari,
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
    if (targetId.startsWith("grm_")) {
      resolvedNote =
        ekGramerNotlari.find((g) => g.bagli_id === targetId) || null;
    } else if (targetId.startsWith("dlg_")) {
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
          g.ktt_ust_konu?.toLowerCase() === q ||
          g.konu_basligi.toLowerCase().includes(q) ||
          g.ktt_ust_konu?.toLowerCase().includes(q) ||
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

  if (finalId.startsWith("grm_")) {
    linkedLessonUrl = null;
    linkedLessonTitle = null;
    linkedLevel = resolvedNote?.seviye || "A1";
  } else if (finalId.startsWith("dlg_")) {
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
  } else if (resolvedNote?.seviye) {
    linkedLevel = resolvedNote.seviye;
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

export type IsolatedArabicSegment =
  | { kind: "text"; value: string }
  | { kind: "paren-arabic"; value: string }
  | {
      kind: "bound-arabic";
      lead: string;
      arabic: string;
      trail: string;
    }
  | { kind: "arabic"; value: string };

const ARABIC_CHAR_TEST_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const COMBINED_ISOLATED_ARABIC_TOKEN_RE =
  /(\([\s\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF/+\-،.؟!:؛«»'"]+\)|[(['"«]?[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:\s+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*[)'"»]?)/g;

/**
 * Türkçe metin içindeki:
 * 1) Parantezli saf Arapça ifadeleri — ör. `(زُرْتِ)`, `(زُرْتُهُ)`, `(عِنْدَ / يُوجَدُ)` — `paren-arabic`
 * 2) Açılış/kapanış parantezine bitişik karma Arapça parçaları — ör. `(أَفْعَلُ Kalıbı)` içindeki `(أَفْعَلُ` — `bound-arabic`
 * 3) Tekil Arapça kelimeleri — `arabic`
 * olarak ayrıştırır ki açılış parantezi asla üst satırda tek başına kalıp Arapça kelime alt satıra düşmesin!
 */
export function tokenizeTurkishWithParentheticalArabic(
  text: string
): IsolatedArabicSegment[] {
  if (!text) return [];
  if (!ARABIC_CHAR_TEST_RE.test(text)) {
    return [{ kind: "text", value: text }];
  }

  const rawParts = text.split(COMBINED_ISOLATED_ARABIC_TOKEN_RE);
  const segments: IsolatedArabicSegment[] = [];

  for (const part of rawParts) {
    if (!part) continue;
    if (!ARABIC_CHAR_TEST_RE.test(part)) {
      segments.push({ kind: "text", value: part });
      continue;
    }

    if (part.startsWith("(") && part.endsWith(")")) {
      segments.push({ kind: "paren-arabic", value: part });
      continue;
    }

    const boundMatch = part.match(
      /^([(['"«]?)([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:\s+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*)([)'"»]?)$/
    );
    if (boundMatch && (boundMatch[1] || boundMatch[3])) {
      segments.push({
        kind: "bound-arabic",
        lead: boundMatch[1] || "",
        arabic: boundMatch[2],
        trail: boundMatch[3] || "",
      });
      continue;
    }

    segments.push({ kind: "arabic", value: part });
  }

  return segments;
}

/**
 * Türkçe bir açıklama veya başlık metni içinde geçen Arapça kelimeleri ve
 * parantezli Arapça kalıpları `(زُرْتِ)`, `(عِنْدَ / يُوجَدُ)` satır sonu kırılmasına karşı korur.
 */
export function renderTurkishWithIsolatedArabic(
  text: string,
  arabicBadgeClass = "arabic font-arabic text-[1.18em] font-bold text-[#065F46] dark:text-emerald-400 mx-0.5 inline-block leading-normal"
): React.ReactNode {
  if (!text) return null;
  const segments = tokenizeTurkishWithParentheticalArabic(text);
  if (segments.length === 1 && segments[0].kind === "text") {
    return text;
  }

  return segments.map((seg, idx) => {
    if (seg.kind === "text") {
      return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
    }
    if (seg.kind === "paren-arabic") {
      return (
        <span
          key={idx}
          dir="rtl"
          lang="ar"
          className={`inline-block whitespace-nowrap font-arabic mx-0.5 ${arabicBadgeClass}`}
        >
          {seg.value}
        </span>
      );
    }
    if (seg.kind === "bound-arabic") {
      return (
        <span key={idx} className="inline-block whitespace-nowrap">
          {seg.lead}
          <bdi dir="rtl" lang="ar" className={arabicBadgeClass}>
            {seg.arabic}
          </bdi>
          {seg.trail}
        </span>
      );
    }
    return (
      <bdi key={idx} dir="rtl" lang="ar" className={arabicBadgeClass}>
        {seg.value}
      </bdi>
    );
  });
}

function GrammarDepthSegmentedBar({
  mode,
  onChange,
}: {
  mode: GrammarDepthMode;
  onChange: (next: GrammarDepthMode) => void;
}) {
  const isSimple = mode === "simple";
  return (
    <div
      role="group"
      aria-label="Gramer Anlatım Derinliği"
      className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-slate-800 border border-[#E6D7BE]/80 dark:border-slate-700 w-full"
    >
      <button
        type="button"
        onClick={() => {
          playClick();
          onChange("simple");
        }}
        title="Sade Anlatım: Klasik terimler yerine anlaşılır Türkçe açıklamalar"
        className={`w-full py-1.5 px-2 rounded-lg text-[11px] font-black inline-flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
          isSimple
            ? "bg-emerald-600 text-white shadow-2xs"
            : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/70 dark:hover:bg-slate-700/60"
        }`}
      >
        <span>🌱</span>
        <span>Sade Anlatım</span>
      </button>
      <button
        type="button"
        onClick={() => {
          playClick();
          onChange("academic");
        }}
        title="Akademik & İ'rab: Tam klasik sarf/nahiv terminolojisi ve açık i'rab tahlili"
        className={`w-full py-1.5 px-2 rounded-lg text-[11px] font-black inline-flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
          !isSimple
            ? "bg-[#6741D9] text-white shadow-2xs"
            : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/70 dark:hover:bg-slate-700/60"
        }`}
      >
        <span>🎓</span>
        <span>Akademik &amp; İ&apos;rab</span>
      </button>
    </div>
  );
}



function GrammarDepthSwitch({
  mode,
  onChange,
  variant = "light",
}: {
  mode: GrammarDepthMode;
  onChange: (next: GrammarDepthMode) => void;
  variant?: "light" | "headerDark";
}) {
  const isSimple = mode === "simple";
  const containerClass =
    variant === "headerDark"
      ? "inline-flex items-center rounded-xl bg-black/25 p-0.5 border border-white/25 shrink-0"
      : "inline-flex items-center rounded-xl bg-white dark:bg-[var(--background)] p-0.5 border-2 border-[#E6D7BE] dark:border-[var(--border)] shrink-0";

  return (
    <div
      role="group"
      aria-label="Gramer Anlatım Derinliği"
      className={containerClass}
    >
      <button
        type="button"
        onClick={() => {
          playClick();
          onChange("simple");
        }}
        title="Sade Anlatım: Klasik terimler yerine anlaşılır Türkçe açıklamalar"
        className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
          isSimple
            ? "bg-emerald-500 text-white shadow-2xs"
            : variant === "headerDark"
            ? "text-white/80 hover:text-white"
            : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
      >
        <span>🌱</span>
        <span>Sade Anlatım</span>
      </button>
      <button
        type="button"
        onClick={() => {
          playClick();
          onChange("academic");
        }}
        title="Akademik & İ'rab: Tam klasik sarf/nahiv terminolojisi ve açık i'rab tahlili"
        className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
          !isSimple
            ? "bg-[#6741D9] text-white shadow-2xs"
            : variant === "headerDark"
            ? "text-white/80 hover:text-white"
            : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
      >
        <span>🎓</span>
        <span>Akademik &amp; İ&apos;rab</span>
      </button>
    </div>
  );
}

/**
 * Tablo hücrelerinde:
 * - Sadece Arapça ise: dir="rtl" lang="ar" font-arabic
 * - Sadece Türkçe ise: dir="ltr" lang="tr" font-sans
 * - Karışık ise (örn. "أَنَا (Ben)", "دَفْتَرٍ (Mecrûr ــٍ)"): Arapça üstte/sağda kendi RTL bloğunda,
 *   Türkçe açıklama altta/yanda kendi LTR font-sans bloğunda!
 */
function renderSmartTableCell(
  cell: string,
  depthMode: GrammarDepthMode = "academic"
): React.ReactNode {
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
    const displayTr =
      depthMode === "simple" ? simplifyGrammarTerminology(trimmed) : trimmed;
    return (
      <div
        dir="ltr"
        lang="tr"
        className="font-sans text-xs sm:text-sm font-bold text-[var(--foreground)] text-left leading-snug"
      >
        {displayTr}
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
        {turkishNotes.map((trNote, idx) => {
          const displayNote =
            depthMode === "simple"
              ? simplifyGrammarTerminology(trNote)
              : trNote;
          return (
            <div
              key={idx}
              dir="ltr"
              lang="tr"
              className="font-sans text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 bg-[#F7EFE1]/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-[#E6D7BE]/80 dark:border-slate-700 text-left leading-snug"
            >
              {renderTurkishWithIsolatedArabic(
                displayNote,
                "arabic font-arabic text-sm font-bold text-[#087F5B] dark:text-emerald-400 px-0.5 inline-block"
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const fallbackTr =
    depthMode === "simple" ? simplifyGrammarTerminology(trimmed) : trimmed;
  return (
    <div
      dir="ltr"
      lang="tr"
      className="font-sans text-xs sm:text-sm font-bold text-[var(--foreground)] text-left leading-snug"
    >
      {renderTurkishWithIsolatedArabic(fallbackTr)}
    </div>
  );
}

export type FormulaOperatorKind = "plus" | "equals" | "arrow" | "slash";

export type FormulaSchemaNode =
  | {
      type: "block";
      order: number;
      label: string;
    }
  | {
      type: "operator";
      operator: FormulaOperatorKind;
    };

const FORMULA_BLOCK_THEMES = [
  {
    card: "border-emerald-500/85 dark:border-emerald-500/70 bg-emerald-50/60 dark:bg-emerald-950/35",
    badge: "bg-[#087F5B] text-white",
  },
  {
    card: "border-indigo-500/80 dark:border-indigo-400/70 bg-indigo-50/60 dark:bg-indigo-950/35",
    badge: "bg-[#6741D9] text-white",
  },
  {
    card: "border-amber-500/85 dark:border-amber-500/70 bg-amber-50/65 dark:bg-amber-950/35",
    badge: "bg-amber-600 text-white",
  },
  {
    card: "border-purple-500/80 dark:border-purple-400/70 bg-purple-50/60 dark:bg-purple-950/35",
    badge: "bg-purple-600 text-white",
  },
] as const;

function detectFormulaOperator(rawBetween: string): FormulaOperatorKind {
  const trimmed = rawBetween.trim();
  if (trimmed.includes("=")) return "equals";
  if (/->|→|➔|⟹|=>/.test(trimmed)) return "arrow";
  if (trimmed.includes("/") && !trimmed.includes("+")) return "slash";
  return "plus";
}

/**
 * JSON içindeki `[1. Öge] + [2. Öge] = [Sonuç]` biçimindeki sözdizimi formüllerini
 * köşeli parantez bloklarına ve aralarındaki operatörlere ayrıştırır.
 * Böylece dış kapsayıcı `dir="rtl"` olduğunda 1. öge en sağda, sonraki ögeler
 * sağdan sola doğru (١ ← ٢ ← ٣) doğal Arapça cümle dizilimiyle akar.
 */
export function parseFormulaSchema(rawFormula: string): FormulaSchemaNode[] {
  const raw = (rawFormula || "").trim();
  if (!raw) return [];

  const nodes: FormulaSchemaNode[] = [];
  let blockOrder = 0;

  if (raw.includes("[") && raw.includes("]")) {
    const bracketRegex = /\[([^\[\]]+)\]/g;
    let lastEnd = 0;
    let match: RegExpExecArray | null;

    while ((match = bracketRegex.exec(raw)) !== null) {
      const between = raw.slice(lastEnd, match.index).trim();
      if (nodes.length > 0) {
        nodes.push({
          type: "operator",
          operator: detectFormulaOperator(between),
        });
      } else if (between) {
        const leadingClean = between
          .replace(/^[\s+=➔→\-/>]+|[\s+=➔→\-/>]+$/g, "")
          .trim();
        if (leadingClean) {
          blockOrder += 1;
          nodes.push({
            type: "block",
            order: blockOrder,
            label: leadingClean,
          });
          nodes.push({
            type: "operator",
            operator: detectFormulaOperator(between),
          });
        }
      }

      const label = match[1].trim();
      if (label) {
        blockOrder += 1;
        nodes.push({
          type: "block",
          order: blockOrder,
          label,
        });
      }
      lastEnd = match.index + match[0].length;
    }

    const trailing = raw.slice(lastEnd).trim();
    if (trailing) {
      const opMatch = trailing.match(/^(\+|=|->|→|➔|\/)\s*(.+)$/);
      if (opMatch && opMatch[2].trim()) {
        if (nodes.length > 0) {
          nodes.push({
            type: "operator",
            operator: detectFormulaOperator(opMatch[1]),
          });
        }
        blockOrder += 1;
        nodes.push({
          type: "block",
          order: blockOrder,
          label: opMatch[2].replace(/^\[|\]$/g, "").trim(),
        });
      } else {
        const cleanedTrailing = trailing.replace(/^\[|\]$/g, "").trim();
        if (cleanedTrailing) {
          if (nodes.length > 0) {
            nodes.push({
              type: "operator",
              operator: detectFormulaOperator(trailing),
            });
          }
          blockOrder += 1;
          nodes.push({
            type: "block",
            order: blockOrder,
            label: cleanedTrailing,
          });
        }
      }
    }

    if (nodes.length > 0) {
      return nodes;
    }
  }

  // Köşeli parantez içermeyen sentetik formüller için yedek ayrıştırıcı
  const parts = raw.split(/\s*(\+|=|->|→|➔)\s*/).filter(Boolean);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^(\+|=|->|→|➔)$/.test(trimmed)) {
      if (nodes.length > 0) {
        nodes.push({
          type: "operator",
          operator: detectFormulaOperator(trimmed),
        });
      }
    } else {
      blockOrder += 1;
      nodes.push({
        type: "block",
        order: blockOrder,
        label: trimmed.replace(/^\[|\]$/g, "").trim(),
      });
    }
  }

  return nodes;
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

  const titleBlocks = title.includes("+")
    ? title
        .split("+")
        .map((part) => `[${part.trim()}]`)
        .join(" + ")
    : `[Odak Kalıp: ${title}]`;

  const formul_sema =
    explicit?.formul_sema ||
    `${titleBlocks} = [${exAr ? `Örnek Uygulama (${exAr})` : rule}]`;

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
  const {
    speechRate,
    arabicFont,
    grammarDepthMode,
    setGrammarDepthMode,
  } = useSettings();
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [showIrabInSimpleMode, setShowIrabInSimpleMode] = useState(false);
  const isSimpleMode = grammarDepthMode === "simple";
  const formatByDepth = (str: string) =>
    isSimpleMode ? simplifyGrammarTerminology(str) : str;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        stopAllAudio();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  const detailLayer = useMemo(
    () => buildSmartGrammarDetailLayer(grammarNote, matchingSentences),
    [grammarNote, matchingSentences]
  );

  const modelExample = useMemo(() => {
    if (grammarNote.metinden_ornek?.arapca?.trim()) {
      return {
        arapca: grammarNote.metinden_ornek.arapca.trim(),
        turkce: grammarNote.metinden_ornek.turkce?.trim() || "",
      };
    }
    if (
      grammarNote.ek_ornekler &&
      grammarNote.ek_ornekler.length > 0 &&
      grammarNote.ek_ornekler[0].arapca?.trim()
    ) {
      return {
        arapca: grammarNote.ek_ornekler[0].arapca.trim(),
        turkce: grammarNote.ek_ornekler[0].turkce?.trim() || "",
      };
    }
    if (matchingSentences.length > 0 && matchingSentences[0].arapca?.trim()) {
      return {
        arapca: matchingSentences[0].arapca.trim(),
        turkce: matchingSentences[0].turkce?.trim() || "",
      };
    }
    return null;
  }, [grammarNote, matchingSentences]);

  const formulaNodes = useMemo(
    () => parseFormulaSchema(detailLayer.formul_sema),
    [detailLayer.formul_sema]
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
      data-grammar-deep-dive-modal="true"
      className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      onClick={() => {
        stopAllAudio();
        onClose();
      }}
    >
      <div
        className="bg-[#FDFBF7] dark:bg-[var(--background)] rounded-none sm:rounded-3xl border-0 sm:border-2 border-[#E6D7BE] dark:border-[var(--border)] sm:border-b-4 w-screen max-w-[100vw] h-[100dvh] sm:w-[96vw] lg:w-[88vw] sm:max-w-5xl sm:h-auto sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ÜST SABİT BAŞLIK ÇUBUĞU */}
        <div className="px-3.5 sm:px-6 py-3 bg-gradient-to-r from-[#065F46] via-[#087F5B] to-teal-900 text-white flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                  {isSimpleMode
                    ? "Sade Konu Özeti & Şema"
                    : "Ayrıntılı Anlatım & İ'rab"}
                </span>
                {linkedLevel && (
                  <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-black">
                    Seviye {linkedLevel}
                  </span>
                )}
              </div>
              <h2
                dir="ltr"
                lang="tr"
                className="font-sans text-xs sm:text-lg font-black text-white text-left leading-snug break-words line-clamp-2"
              >
                {renderTurkishWithIsolatedArabic(
                  formatByDepth(grammarNote.konu_basligi),
                  "arabic font-arabic text-[1.15em] font-bold text-amber-200 mx-0.5 inline-block"
                )}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <GrammarDepthSwitch
              mode={grammarDepthMode}
              onChange={setGrammarDepthMode}
              variant="headerDark"
            />
            <button
              type="button"
              onClick={() => {
                playClick();
                stopAllAudio();
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border border-rose-400/50 font-black text-xs inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer shrink-0"
              title="Ayrıntılı Anlatımı Kapat (Esc)"
            >
              <X className="w-4 h-4 shrink-0" />
              <span>Kapat</span>
            </button>
          </div>
        </div>

        {/* KAYDIRILABİLİR 5 BÖLÜMLÜ PEDAGOJİK GÖVDE */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-4 sm:space-y-5">
          {/* KART 1: GÖRSEL FORMÜL & ŞEMA KUTUSU (Model Örnek Cümle + RTL formul_sema) */}
          <section className="w-full max-w-full min-w-0 box-border rounded-2xl sm:rounded-3xl border-2 border-[#6741D9]/40 bg-gradient-to-br from-[#F3F0FF] via-white to-[#F7EFE1] dark:from-indigo-950/60 dark:via-[var(--surface)] dark:to-[var(--background)] p-3.5 sm:p-6 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
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

            {/* ÜST MODEL ÖRNEK CÜMLE KARTI (GÖREV 1) */}
            {modelExample && (
              <div className="rounded-2xl bg-white/95 dark:bg-[var(--background)] border-2 border-emerald-500/45 dark:border-emerald-600/45 p-3.5 sm:p-4 shadow-2xs space-y-2.5">
                <div
                  dir="ltr"
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-[#065F46] dark:text-emerald-300 font-sans text-[11px] sm:text-xs font-black tracking-wide">
                    <span>📌 Model Örnek Cümle</span>
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      handleListen(
                        modelExample.arapca,
                        "formula-model-example"
                      )
                    }
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold border-2 inline-flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${
                      playingKey === "formula-model-example"
                        ? "bg-[#087F5B] text-white border-[#065F46]"
                        : "bg-[#F7EFE1]/80 dark:bg-[var(--surface)] text-[#065F46] dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:border-[#087F5B] hover:bg-emerald-50 dark:hover:bg-emerald-950/60"
                    }`}
                    title="Model örnek cümleyi sesli dinle"
                  >
                    <Volume2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {playingKey === "formula-model-example"
                        ? "Dinleniyor..."
                        : "🔊 Dinle"}
                    </span>
                  </button>
                </div>

                <p
                  dir="rtl"
                  lang="ar"
                  className="arabic font-arabic text-2xl sm:text-3xl font-bold text-emerald-950 dark:text-emerald-300 leading-loose text-right break-words"
                >
                  {fixArabicTypography(modelExample.arapca, arabicFont)}
                </p>

                {modelExample.turkce && (
                  <p
                    dir="ltr"
                    lang="tr"
                    className="font-sans text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 text-left leading-relaxed pt-2 border-t border-emerald-100 dark:border-emerald-900/50"
                  >
                    {renderTurkishWithIsolatedArabic(modelExample.turkce)}
                  </p>
                )}
              </div>
            )}

            {/* SAĞDAN SOLA (RTL) SÖZDİZİMİ ŞEMASI BLOKLARI (GÖREV 2) */}
            <div className="rounded-2xl bg-white/95 dark:bg-[var(--background)] border-2 border-[#6741D9]/30 dark:border-indigo-500/35 p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div
                dir="ltr"
                className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-dashed border-[#6741D9]/20 dark:border-indigo-500/25"
              >
                <span className="font-sans text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Sözdizimi Kalıbı &amp; Öge Sırası
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F3F0FF] dark:bg-indigo-950/80 border border-[#6741D9]/30 dark:border-indigo-500/40 text-[#4C28B5] dark:text-indigo-200 font-sans text-[11px] sm:text-xs font-black tracking-wide ml-auto">
                  <ArrowLeft className="w-3.5 h-3.5 text-[#6741D9] dark:text-indigo-300 shrink-0" />
                  <span>Sağdan Sola Arapça Cümle Dizilimi (١ ← ٢ ← ٣)</span>
                </span>
              </div>

              {formulaNodes.length > 0 ? (
                <div
                  dir="rtl"
                  className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-2.5 w-full"
                >
                  {formulaNodes.map((node, idx) => {
                    if (node.type === "operator") {
                      if (
                        node.operator === "equals" ||
                        node.operator === "arrow"
                      ) {
                        return (
                          <span
                            key={`op-${idx}`}
                            dir="ltr"
                            title="Sağdan Sola Türetim / Sonuç"
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/85 border-2 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200 font-sans text-xs sm:text-sm font-black shrink-0 shadow-2xs"
                          >
                            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.75] shrink-0" />
                            {node.operator === "equals" && <span>=</span>}
                          </span>
                        );
                      }

                      if (node.operator === "slash") {
                        return (
                          <span
                            key={`op-${idx}`}
                            dir="ltr"
                            className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-sans text-xs sm:text-sm font-black shrink-0"
                          >
                            /
                          </span>
                        );
                      }

                      return (
                        <span
                          key={`op-${idx}`}
                          dir="ltr"
                          className="w-7 h-7 rounded-full bg-[#F3F0FF] dark:bg-indigo-950/90 border border-[#6741D9]/35 dark:border-indigo-500/45 text-[#4C28B5] dark:text-indigo-200 font-sans text-sm sm:text-base font-black inline-flex items-center justify-center shrink-0 shadow-2xs"
                        >
                          +
                        </span>
                      );
                    }

                    const theme =
                      FORMULA_BLOCK_THEMES[
                        (node.order - 1) % FORMULA_BLOCK_THEMES.length
                      ];

                    return (
                      <div
                        key={`blk-${idx}`}
                        className={`inline-flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 shadow-2xs max-w-full ${theme.card}`}
                      >
                        <span
                          dir="ltr"
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg font-sans text-[11px] sm:text-xs font-black flex items-center justify-center shrink-0 shadow-2xs ${theme.badge}`}
                          title={`${node.order}. Sözdizimi Ögesi`}
                        >
                          {node.order}
                        </span>
                        <div
                          dir="ltr"
                          lang="tr"
                          className="font-sans text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 text-left leading-snug break-words min-w-0"
                        >
                          <MixedText
                            text={formatByDepth(node.label)}
                            arabicClassName="arabic font-arabic text-lg font-bold text-emerald-900 dark:text-emerald-300 mx-1 inline-block leading-normal"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div dir="ltr" lang="tr" className="text-center">
                  <p className="font-sans text-sm sm:text-base font-black text-[#4C28B5] dark:text-indigo-200 leading-relaxed break-words">
                    {renderTurkishWithIsolatedArabic(
                      formatByDepth(detailLayer.formul_sema),
                      "arabic font-arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 px-1 inline-block"
                    )}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* KART 2: ADIM ADIM AYRINTILI KONU ANLATIMI (adim_adim_anlatim) */}
          <section className="w-full max-w-full min-w-0 box-border rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-3.5 sm:p-6 shadow-xs space-y-3">
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
                  className="rounded-2xl bg-white/95 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3"
                >
                  <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-400 text-[#065F46] dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="font-sans text-xs sm:text-sm md:text-base font-bold text-[var(--foreground)] leading-relaxed break-words min-w-0 flex-1">
                    {renderTurkishWithIsolatedArabic(
                      formatByDepth(step.replace(/^\d+\.\s*/, ""))
                    )}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* KART 3: KARŞILAŞTIRMALI ÇEKİM & KURAL TABLOSU (ozet_tablo) */}
          {detailLayer.ozet_tablo &&
            detailLayer.ozet_tablo.satirlar.length > 0 && (
              <section className="w-full max-w-full min-w-0 box-border rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-3.5 sm:p-6 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-600 text-white font-black text-xs uppercase tracking-wider">
                    <Table2 className="w-4 h-4 shrink-0" />
                    <span>
                      3. {formatByDepth(detailLayer.ozet_tablo.tablo_basligi)}
                    </span>
                  </span>
                </div>

                <div className="w-full max-w-full overflow-x-auto rounded-xl sm:rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] bg-white dark:bg-[var(--background)]">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#EFE5D4] dark:bg-slate-800 border-b-2 border-[#E6D7BE] dark:border-slate-700">
                        {detailLayer.ozet_tablo.sutunlar.map((col, cIdx) => (
                          <th
                            key={cIdx}
                            dir="ltr"
                            lang="tr"
                            className="py-2 px-2.5 sm:py-2.5 sm:px-4 font-sans text-[11px] sm:text-xs font-black uppercase tracking-wider text-[var(--foreground)]"
                          >
                            {renderTurkishWithIsolatedArabic(formatByDepth(col))}
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
                              className="py-2.5 px-2.5 sm:py-3 sm:px-4 align-middle"
                            >
                              {renderSmartTableCell(cell, grammarDepthMode)}
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
            <section className="w-full max-w-full min-w-0 box-border rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-3.5 sm:p-6 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#6741D9] text-white font-black text-xs uppercase tracking-wider">
                  <Target className="w-4 h-4 shrink-0" />
                  <span>
                    4.{" "}
                    {isSimpleMode
                      ? "Kelime Kelime Cümle Görevleri (İsteğe Bağlı)"
                      : "Kelime Kelime İ'rab & Hareke Çözümlemesi"}
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {isSimpleMode && (
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setShowIrabInSimpleMode((v) => !v);
                      }}
                      className="px-3 py-1 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/80 border-2 border-[#6741D9]/45 text-[#4C28B5] dark:text-indigo-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      {showIrabInSimpleMode ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                          <span>İ&apos;rab Detayını Gizle</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            İ&apos;rab Detayını Göster (
                            {detailLayer.irab_tahlili.length} Kelime)
                          </span>
                        </>
                      )}
                    </button>
                  )}
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
              </div>

              {(!isSimpleMode || showIrabInSimpleMode) ? (
                <div
                  dir="rtl"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                >
                  {detailLayer.irab_tahlili.map((item, idx) => {
                    const wKey = `irab-w-${idx}`;
                    return (
                      <div
                        key={idx}
                        dir="ltr"
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
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              dir="rtl"
                              lang="ar"
                              className="arabic font-arabic text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-relaxed break-words"
                            >
                              {fixArabicTypography(item.kelime, arabicFont)}
                            </span>
                            <span
                              className="w-5 h-5 rounded-md bg-[#F3F0FF] dark:bg-indigo-950/80 border border-[#6741D9]/30 text-[#6741D9] dark:text-indigo-300 font-sans text-[10px] font-black flex items-center justify-center shrink-0"
                              title={`Cümledeki ${idx + 1}. kelime (Sağdan sola)`}
                            >
                              {idx + 1}
                            </span>
                          </div>
                        </div>
                        <div
                          dir="ltr"
                          lang="tr"
                          className="space-y-1 text-left font-sans"
                        >
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[#F3F0FF] dark:bg-indigo-950/70 text-[#6741D9] dark:text-indigo-300 font-sans text-[11px] font-black">
                            {renderTurkishWithIsolatedArabic(
                              formatByDepth(item.gorevi),
                              "arabic font-arabic text-xs font-bold text-[#6741D9] dark:text-indigo-200 px-0.5 inline-block"
                            )}
                          </span>
                          <p className="font-sans text-xs font-semibold text-[var(--muted)] leading-snug">
                            {renderTurkishWithIsolatedArabic(
                              formatByDepth(item.hareke_nedeni),
                              "arabic font-arabic text-sm font-bold text-[#065F46] dark:text-emerald-400 px-0.5 inline-block"
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  dir="ltr"
                  className="rounded-2xl bg-white/90 dark:bg-[var(--background)] border border-dashed border-[#6741D9]/35 p-3.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <p className="text-xs font-bold text-[var(--muted)]">
                    🌱 Sade Anlatım modunda odaklanmayı kolaylaştırmak için ayrıntılı i&apos;rab kartları daraltıldı.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setShowIrabInSimpleMode(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>İ&apos;rab Detayını Göster</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </section>
          )}

          {/* KART 5: SIK YAPILAN HATA & DOĞRUSU (dikkat_sik_hata) */}
          <section className="w-full max-w-full min-w-0 box-border rounded-2xl sm:rounded-3xl border-2 border-amber-300 dark:border-amber-700 border-b-4 bg-[#F7EFE1] dark:bg-[var(--surface)] p-3.5 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>5. Sık Yapılan Hata &amp; Doğrusu</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Sol Kutu: Yanlış Kullanım */}
              <div className="rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/40 p-3.5 sm:p-4 space-y-2 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-black text-xs uppercase tracking-wider">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>❌ Yanlış Kullanım</span>
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
                    className="font-sans text-xs text-slate-600 dark:text-rose-200 font-semibold text-left mt-1 pt-1.5 border-t border-rose-200/80 dark:border-rose-800/60"
                  >
                    {parsedYanlis.turkishNotes.map((note, idx) => (
                      <div key={idx}>
                        ({renderTurkishWithIsolatedArabic(
                          note,
                          "arabic font-arabic text-sm font-bold text-rose-900 dark:text-rose-200 mx-0.5 inline-block"
                        )})
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
                      <span>✅ Doğru Kullanım</span>
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
                    className="font-sans text-xs text-slate-600 dark:text-emerald-200 font-semibold text-left mt-1 pt-1.5 border-t border-emerald-200/80 dark:border-emerald-800/60"
                  >
                    {parsedDogru.turkishNotes.map((note, idx) => (
                      <div key={idx}>
                        ({renderTurkishWithIsolatedArabic(
                          note,
                          "arabic font-arabic text-sm font-bold text-[#065F46] dark:text-emerald-300 mx-0.5 inline-block"
                        )})
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
                  formatByDepth(detailLayer.dikkat_sik_hata.neden),
                  "arabic font-arabic text-base font-bold text-[#065F46] dark:text-emerald-400 px-1 inline-block"
                )}
              </div>
            </div>
          </section>
        </div>

        {/* ALT SABİT AKSİYON ÇUBUĞU */}
        <div className="px-3.5 sm:px-6 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3 bg-[#F7EFE1] dark:bg-[var(--surface)] border-t-2 border-[#E6D7BE] dark:border-[var(--border)] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial">
            {linkedLessonUrl && linkedLessonTitle && (
              <Link
                href={linkedLessonUrl}
                onClick={() => onClose()}
                className="px-3 py-2 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] hover:border-[#087F5B] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#087F5B] shrink-0" />
                <span className="truncate max-w-[160px] sm:max-w-none">
                  Derse Git ({linkedLessonTitle})
                </span>
              </Link>
            )}
            {grammarNote.ktt_ust_konu && (
              <Link
                href={`/seviye-tespit?mode=topic&topic=${encodeURIComponent(
                  grammarNote.ktt_ust_konu
                )}`}
                onClick={() => onClose()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white border-b-2 border-emerald-950 text-xs font-black inline-flex items-center gap-1.5"
              >
                <ListChecks className="w-4 h-4 shrink-0" />
                <span>Bu Konunun Tarama Testini Çöz</span>
              </Link>
            )}
            <Link
              href={`/alistirmalar?pool=sentences_1111${
                activeGrammarQuery
                  ? `&grammar=${encodeURIComponent(activeGrammarQuery)}`
                  : ""
              }`}
              onClick={() => onClose()}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-2 border-[#065F46] text-xs font-black inline-flex items-center gap-1.5"
            >
              <Gamepad2 className="w-4 h-4 shrink-0" />
              <span>Bu Kalıpla Alıştırma Yap</span>
            </Link>
            <Link
              href={`/alistirmalar?mode=error-hunter&grammar=${encodeURIComponent(
                grammarNote.konu_basligi || activeGrammarQuery || ""
              )}&autostart=1`}
              onClick={() => onClose()}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 border-b-2 border-amber-700 text-xs font-black inline-flex items-center gap-1.5"
            >
              <span>🕵️ Hata Avcısı</span>
            </Link>
            <Link
              href={`/alistirmalar?mode=irab-painter&grammar=${encodeURIComponent(
                grammarNote.konu_basligi || activeGrammarQuery || ""
              )}&autostart=1`}
              onClick={() => onClose()}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white border-b-2 border-[#4C28B5] text-xs font-black inline-flex items-center gap-1.5"
            >
              <span>🎨 İ&apos;rab Boyama</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => {
              playClick();
              stopAllAudio();
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-[var(--foreground)] text-xs font-black cursor-pointer shrink-0"
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
  hideInlineDepthToggle?: boolean;
  hideLessonSelfLink?: boolean;
  onOpenSplitView?: () => void;
}

export function GrammarHapBilgiPanel({
  grammarNote,
  grammarTopic,
  onOpenShadowing,
  isSmartboardLarge = false,
  isCompactDrawer = false,
  showMatchingSentences = true,
  hideInlineDepthToggle = false,
  hideLessonSelfLink = false,
  onOpenSplitView,
}: GrammarHapBilgiPanelProps) {
  const {
    speechRate,
    preferredVoiceGender,
    grammarDepthMode,
    setGrammarDepthMode,
  } = useSettings();
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [showAllSentences, setShowAllSentences] = useState(false);
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false);
  const isSimpleMode = grammarDepthMode === "simple";
  const formatByDepth = (str: string) =>
    isSimpleMode ? simplifyGrammarTerminology(str) : str;

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
    <div className="w-full max-w-full min-w-0 space-y-3.5 sm:space-y-5 animate-in fade-in duration-300 overflow-x-hidden">
      {/* 1. ÜST BAŞLIK VE TEMEL GRAMER KURALI (HAP KURAL) KARTI */}
      <div
        className={`w-full max-w-full min-w-0 box-border bg-gradient-to-br from-[#F7EFE1] to-[#EFE5D4] dark:from-[var(--surface)] dark:to-[var(--background)] rounded-2xl ${
          isCompactDrawer ? "p-3.5" : "sm:rounded-3xl p-3.5 sm:p-6"
        } border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-xs relative overflow-hidden`}
      >
        {/* Yan panel (isCompactDrawer) modunda üst rozet/seviye/ders bağlantısı kalabalığı gösterilmez */}
        {!isCompactDrawer && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 sm:mb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {activeNote.bagli_id.startsWith("grm_") ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#087F5B] text-white font-black text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>
                    {`Müstakil Gramer • ${
                      activeNote.seviye || linkedLevel || "A1"
                    }`}
                  </span>
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black text-[11px] uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Odak Gramer &amp; Hap Bilgi</span>
                  </span>
                  {linkedLevel && (
                    <span className="px-2.5 py-1 rounded-xl bg-[#087F5B] text-white font-black text-[11px]">
                      Seviye {linkedLevel}
                    </span>
                  )}
                </>
              )}
              {activeNote.ktt_ust_konu && (
                <span className="px-2.5 py-1 rounded-xl bg-white/90 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-[#065F46] dark:text-emerald-300 font-extrabold text-[11px]">
                  {activeNote.ktt_ust_konu}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {!hideInlineDepthToggle && (
                <GrammarDepthSwitch
                  mode={grammarDepthMode}
                  onChange={setGrammarDepthMode}
                />
              )}
              {onOpenSplitView && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    onOpenSplitView();
                  }}
                  title="Metin cümlelerini okurken gramer notunu yan panelde açık tut"
                  className="px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-2 border-[#064E3B] font-black text-[11px] sm:text-xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all shadow-2xs"
                >
                  <Columns2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Metinle Yan Yana Aç</span>
                </button>
              )}
              {!hideLessonSelfLink &&
                (linkedLessonTitle && linkedLessonUrl ? (
                  <Link
                    href={linkedLessonUrl}
                    className="max-w-full px-2.5 py-1 rounded-xl bg-white/90 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-[var(--foreground)] font-extrabold text-[11px] inline-flex items-center gap-1 transition-colors"
                  >
                    <BookOpen className="w-3 h-3 text-[#087F5B] shrink-0" />
                    <span className="truncate">Ders: {linkedLessonTitle}</span>
                    <ExternalLink className="w-3 h-3 text-[#087F5B] shrink-0" />
                  </Link>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl bg-white/85 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] font-extrabold text-[11px]">
                    İçerik: {activeNote.bagli_id.toUpperCase()}
                  </span>
                ))}
            </div>
          </div>
        )}

        {isCompactDrawer && activeNote.ktt_ust_konu && (
          <div className="text-[11px] font-bold text-[#065F46] dark:text-emerald-400 mb-1.5">
            {activeNote.ktt_ust_konu}
          </div>
        )}

        <h2
          dir="ltr"
          lang="tr"
          className={`font-sans text-left ${
            isSmartboardLarge
              ? "text-xl sm:text-3xl"
              : isCompactDrawer
              ? "text-base sm:text-lg"
              : "text-base sm:text-2xl"
          } font-black text-[var(--foreground)] tracking-tight mb-3 leading-snug break-words`}
        >
          {renderTurkishWithIsolatedArabic(
            formatByDepth(activeNote.konu_basligi),
            "arabic font-arabic text-[1.15em] font-bold text-[#065F46] dark:text-emerald-400 mx-0.5 inline-block"
          )}
        </h2>

        <div
          dir="ltr"
          lang="tr"
          className="w-full max-w-full min-w-0 box-border bg-white/95 dark:bg-[var(--background)] rounded-2xl p-3.5 sm:p-5 border-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-2xs space-y-1.5"
        >
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[#087F5B] dark:text-emerald-400 shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-widest text-[#087F5B] dark:text-emerald-400">
              {isSimpleMode
                ? "Sade Temel Kural & Cümle Mantığı"
                : "Temel Gramer Kuralı (Hap Kural & Formül)"}
            </span>
          </div>
          <p
            className={`${
              isSmartboardLarge
                ? "text-base sm:text-xl"
                : "text-sm sm:text-base"
            } font-sans font-bold text-[var(--foreground)] leading-relaxed break-words w-full`}
          >
            {renderTurkishWithIsolatedArabic(formatByDepth(activeNote.hap_kural))}
          </p>
        </div>
      </div>

      {/* 2. İÇERİKTEN ODAK ÖRNEK KARTI */}
      {activeNote.metinden_ornek && (
        <div className="w-full max-w-full min-w-0 box-border bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-3.5 sm:p-6 shadow-xs space-y-3">
          {/* Üst Bar: Sol tarafta rozet, sağ tarafta Dinle ve Telaffuz Et butonları */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/70 text-[#6741D9] dark:text-indigo-200 border border-[#6741D9]/35 font-black text-[11px] sm:text-xs uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span>ODAK ÖRNEK &amp; ÇÖZÜMLEME</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
                {isSimpleMode
                  ? "Cümle Açıklaması & Hareke İpucu:"
                  : "Gramer Analizi & İ'rab Notu:"}
              </span>
              {renderTurkishWithIsolatedArabic(
                formatByDepth(activeNote.metinden_ornek.aciklama)
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. PEKİŞTİRİCİ EK ÖRNEKLER */}
      {activeNote.ek_ornekler && activeNote.ek_ornekler.length > 0 && (
        <div className="w-full max-w-full min-w-0 box-border bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-3.5 sm:p-6 shadow-xs">
          <h3 className="text-sm sm:text-base font-black text-[var(--foreground)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#087F5B] dark:text-emerald-400 shrink-0" />
            <span>Pekiştirici Ek Örnekler</span>
          </h3>
          <div
            className={
              isCompactDrawer
                ? "grid grid-cols-1 gap-3"
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
          className="w-full max-w-full min-w-0 box-border bg-amber-50/90 dark:bg-amber-950/40 rounded-2xl sm:rounded-3xl border-2 border-amber-300 dark:border-amber-700 border-b-4 p-3.5 sm:p-5 shadow-xs space-y-1.5 text-left"
        >
          <div className="flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-amber-800 dark:text-amber-300 shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-300">
              Pratik Öğrenme İpucu
            </span>
          </div>
          <p
            className={`${
              isSmartboardLarge
                ? "text-sm sm:text-base"
                : "text-xs sm:text-sm"
            } font-sans font-bold text-amber-950 dark:text-amber-100 leading-relaxed break-words w-full`}
          >
            {renderTurkishWithIsolatedArabic(formatByDepth(activeNote.ipucu))}
          </p>
        </div>
      )}

      {/* 4B. 2. KATMAN AYRINTILI KONU ANLATIMI, ŞEMA & İ'RAB ÇÖZÜMLEMESİ TETİKLEYİCİ BUTON */}
      <button
        type="button"
        onClick={() => {
          playClick();
          setIsDeepDiveOpen(true);
        }}
        className="w-full max-w-full min-w-0 box-border group rounded-2xl sm:rounded-3xl border-2 border-[#6741D9] border-b-4 bg-gradient-to-r from-[#6741D9] via-[#5230B5] to-indigo-800 hover:from-[#5230B5] hover:to-[#422399] text-white p-3.5 sm:p-5 shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 cursor-pointer transition-all active:translate-y-[1px]"
      >
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 text-left min-w-0">
          <span className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 block leading-snug">
              Görsel Şema • Karşılaştırmalı Tablo • Kelime Kelime İ&apos;rab
            </span>
            <span className="text-xs sm:text-base font-black text-white block mt-0.5 leading-snug break-words">
              Ayrıntılı Konu Anlatımı &amp; İ&apos;rab Çözümlemesi İçin Tıklayınız
            </span>
          </div>
        </div>
        <span className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-amber-400 group-hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center justify-center gap-1.5 shrink-0 shadow-2xs transition-colors">
          <span>Detaylı İncele</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </button>

      {/* 5. 1111 CÜMLE HAVUZUNDAN BU KALIBA AİT SESLİ ÖRNEK CÜMLELER */}
      {showMatchingSentences && matchingSentences.length > 0 && (
        <div className="w-full max-w-full min-w-0 box-border bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-3.5 sm:p-6 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-[#065F46] dark:text-emerald-200 border border-emerald-400/60 font-black text-[11px] sm:text-xs uppercase tracking-wider">
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
                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                      {sent.odak_kalip && (
                        <span
                          dir="ltr"
                          lang="tr"
                          className="px-2 py-0.5 rounded-md bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300/70 dark:border-amber-700/70 text-amber-900 dark:text-amber-200 text-[11px] font-extrabold leading-snug break-words text-left"
                        >
                          <span className="mr-1">📌</span>
                          <MixedText text={sent.odak_kalip} />
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE]/80 dark:border-[var(--border)] text-[10px] font-black text-[var(--muted)] whitespace-nowrap shrink-0">
                        {sent.seviye || sent.cefr || "A1"}
                        {sent.tema
                          ? ` • ${formatTurkishCategory(sent.tema)}`
                          : ""}
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
                      {sent.baglam ? formatTurkishCategory(sent.baglam) : ""}
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
      <div className="w-full max-w-full min-w-0 box-border bg-gradient-to-r from-emerald-950 via-[#065F46] to-teal-950 text-white rounded-2xl border-2 border-emerald-500/50 border-b-4 p-3.5 sm:p-4 shadow-md flex flex-col gap-3">
        <p className="text-xs sm:text-sm font-bold text-emerald-50 leading-relaxed break-words">
          <strong className="text-emerald-300 font-black">
            💡 PEDAGOJİK PEKİŞTİRME:
          </strong>{" "}
          Bu gramer kuralını interaktif alıştırmalarla hemen test edin.
        </p>
        <div
          className={
            isCompactDrawer
              ? "grid grid-cols-1 gap-2 w-full"
              : "grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full"
          }
        >
          {!hideLessonSelfLink && linkedLessonUrl && (
            <Link
              href={linkedLessonUrl}
              className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs sm:text-sm font-semibold text-center whitespace-normal transition-all"
            >
              <span>📖 İlgili Derse Git</span>
            </Link>
          )}
          {activeNote.ktt_ust_konu && (
            <Link
              href={`/seviye-tespit?mode=topic&topic=${encodeURIComponent(
                activeNote.ktt_ust_konu
              )}`}
              className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white text-[#065F46] hover:bg-emerald-50 border-b-3 border-emerald-900/40 text-xs sm:text-sm font-black text-center whitespace-normal shadow-sm transition-all"
            >
              <ListChecks className="w-4 h-4 shrink-0" />
              <span>Bu Konunun Tarama Testini Çöz</span>
            </Link>
          )}
          <Link
            href={`/alistirmalar?pool=sentences_1111${
              activeGrammarQuery
                ? `&grammar=${encodeURIComponent(activeGrammarQuery)}`
                : ""
            }`}
            className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-b-3 border-amber-600 text-xs sm:text-sm font-bold text-center whitespace-normal shadow-sm transition-all"
          >
            <span>🎮 Bu Kalıpla Alıştırma Yap</span>
          </Link>
          <Link
            href={`/alistirmalar?mode=error-hunter&grammar=${encodeURIComponent(
              activeNote.konu_basligi || activeGrammarQuery || ""
            )}&autostart=1`}
            className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-amber-300/50 text-xs sm:text-sm font-bold text-center whitespace-normal transition-all"
          >
            <span>🕵️ Hata Avcısı (Bu Kural)</span>
          </Link>
          <Link
            href={`/alistirmalar?mode=irab-painter&grammar=${encodeURIComponent(
              activeNote.konu_basligi || activeGrammarQuery || ""
            )}&autostart=1`}
            className="min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-500/80 hover:bg-indigo-500 text-white border border-indigo-300/50 text-xs sm:text-sm font-bold text-center whitespace-normal transition-all"
          >
            <span>🎨 İ&apos;rab Renkleriyle Boya</span>
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

/**
 * Diyalog (`/diyalog/[id]`) ve Okuma Metni (`/metin/[id]`) sayfaları için
 * Üst Barı (`Header`) asla kapatmayan Yan Yana Gramer Paneli (Split-View) & Mobil Çekmece (`< 1024px`).
 */
export interface LessonGrammarSplitPanelProps {
  grammarNote: GramerHapBilgi;
  side: GrammarSplitSide;
  onToggleSide: () => void;
  onExpandToFullTab: () => void;
  onClose: () => void;
  onOpenShadowing?: (arabicText: string, turkishText?: string) => void;
  className?: string;
}

export function LessonGrammarSplitPanel({
  grammarNote,
  side,
  onToggleSide,
  onExpandToFullTab,
  onClose,
  onOpenShadowing,
  className = "",
}: LessonGrammarSplitPanelProps) {
  const { grammarDepthMode, setGrammarDepthMode } = useSettings();
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  const { resolvedNote, linkedLevel } = useMemo(
    () =>
      resolveGrammarNoteAndSentences({
        grammarNote,
      }),
    [grammarNote]
  );

  // Başka bir diyalog/metne geçildiğinde yan panel içeriğini en üste kaydır
  useEffect(() => {
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [grammarNote.bagli_id]);

  // ESC ile yan paneli kapat (Eğer 2. katman Ayrıntılı Anlatım modalı açıksa önce o kapanır)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (
        typeof document !== "undefined" &&
        document.querySelector("[data-grammar-deep-dive-modal='true']")
      ) {
        return;
      }
      e.stopPropagation();
      stopAllAudio();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const activeNote = resolvedNote || grammarNote;

  return (
    <>
      {/* Tablet ve Mobil (< 1024px) Arka Plan Karartması: Üst Header'ın (z-50) altından başlar */}
      <div
        aria-hidden="true"
        onClick={() => {
          playClick();
          stopAllAudio();
          onClose();
        }}
        className="lg:hidden fixed inset-0 top-[var(--header-height,48px)] z-[44] bg-black/45 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-150"
      />

      {/* Masaüstünde (lg+) Üst Barın Hemen Altında Sticky Grid Sütunu, < 1024px'de Alttan Açılan Çekmece (max-h-[82dvh]) */}
      <aside
        aria-label="Yan Yana Odak Gramer Paneli"
        className={`fixed inset-x-0 bottom-0 z-[45] w-full max-h-[82dvh] rounded-t-3xl border-t-2 border-[#087F5B] dark:border-emerald-500 shadow-[0_-12px_40px_rgba(0,0,0,0.28)] bg-[#FDFBF7] dark:bg-slate-900 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 lg:animate-none lg:sticky lg:inset-auto lg:top-[calc(var(--header-height,56px)+12px)] lg:z-20 lg:h-[calc(100dvh-var(--header-height,56px)-24px)] lg:max-h-[calc(100dvh-var(--header-height,56px)-24px)] lg:rounded-2xl lg:border-2 lg:border-b-4 lg:border-[#087F5B]/80 dark:lg:border-emerald-600/75 lg:shadow-lg lg:overflow-visible ${className}`}
      >
        {/* KOMPAKT 2 SATIRLI ÜST KONTROL ÇUBUĞU (Sıfır Buton Taşması) */}
        <div className="relative z-20 px-3.5 pt-2.5 pb-2.5 bg-[#FDFBF7]/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#E6D7BE] dark:border-slate-800 rounded-t-3xl lg:rounded-t-2xl space-y-2 shrink-0 overflow-visible">
          {/* Mobil Çekmece Tutamaç Çizgisi */}
          <div
            aria-hidden="true"
            className="lg:hidden w-10 h-1 rounded-full bg-stone-300 dark:bg-slate-700 mx-auto -mt-0.5 mb-1"
          />

          {/* 1. Satır: Sol (📌 Odak Gramer + Seviye) | Sağ (Yön Değiştir, Tam Ekran, Kapat) */}
          <div className="flex items-center justify-between gap-2 overflow-visible">
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-black whitespace-nowrap shrink-0">
                <span>📌</span>
                <span>Odak Gramer</span>
              </span>
              {linkedLevel && (
                <span className="px-2 py-0.5 rounded-lg bg-[#087F5B] text-white text-[11px] font-black shrink-0">
                  {linkedLevel}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0 overflow-visible">
              {/* Masaüstü Sol / Sağ Konum Değiştirici */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  onToggleSide();
                }}
                data-tooltip="Paneli Sola / Sağa Al"
                data-tooltip-pos="bottom"
                aria-label={
                  side === "right" ? "Paneli Sola Al" : "Paneli Sağa Al"
                }
                className="hidden lg:inline-flex w-8 h-8 rounded-lg border border-[#E6D7BE] dark:border-slate-700 bg-white dark:bg-slate-800 text-[var(--foreground)] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-[#087F5B] dark:hover:text-emerald-300 hover:border-[#087F5B]/50 items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                {side === "right" ? (
                  <PanelLeft className="w-4 h-4 shrink-0" />
                ) : (
                  <PanelRight className="w-4 h-4 shrink-0" />
                )}
              </button>

              {/* Tam Genişlik Sekmeye Geç */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  stopAllAudio();
                  onExpandToFullTab();
                }}
                data-tooltip="Tam Ekran Görünümüne Geç"
                data-tooltip-pos="bottom"
                aria-label="Tam Ekran Görünümüne Geç"
                className="w-8 h-8 rounded-lg border border-[#E6D7BE] dark:border-slate-700 bg-white dark:bg-slate-800 text-[var(--foreground)] hover:bg-[#F3F0FF] dark:hover:bg-indigo-950/60 hover:text-[#6741D9] dark:hover:text-indigo-300 hover:border-[#6741D9]/50 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <Maximize2 className="w-4 h-4 shrink-0" />
              </button>

              {/* Belirgin Kapat Butonu */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  stopAllAudio();
                  onClose();
                }}
                data-tooltip="Yan Paneli Kapat (ESC)"
                data-tooltip-pos="bottom"
                data-tooltip-align="right"
                aria-label="Yan Paneli Kapat"
                className="w-8 h-8 rounded-lg border border-[#E6D7BE] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>

          {/* 2. Satır: Tam Genişlik Dilimlenmiş Anlatım Seçici (Sıfır Taşma) */}
          <GrammarDepthSegmentedBar
            mode={grammarDepthMode}
            onChange={setGrammarDepthMode}
          />
        </div>

        {/* KAYDIRILABİLİR İÇERİK GÖVDESİ */}
        <div
          ref={scrollBodyRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-4 lg:rounded-b-2xl"
        >
          <GrammarHapBilgiPanel
            grammarNote={activeNote}
            isCompactDrawer={true}
            showMatchingSentences={true}
            hideInlineDepthToggle={true}
            hideLessonSelfLink={true}
            onOpenShadowing={(ar, tr) => {
              stopAllAudio();
              if (onOpenShadowing) onOpenShadowing(ar, tr);
            }}
          />
        </div>
      </aside>
    </>
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
  const { grammarDepthMode, setGrammarDepthMode } = useSettings();
  const [viewMode, setViewMode] =
    useState<GrammarWindowViewMode>(initialViewMode);
  const [drawerSide, setDrawerSide] = useState<"left" | "right">("right");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (
        typeof document !== "undefined" &&
        document.querySelector("[data-grammar-deep-dive-modal='true']")
      ) {
        return;
      }
      stopAllAudio();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const { resolvedNote, linkedLevel } = useMemo(
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
          ? "fixed inset-0 z-[90] bg-black/70 backdrop-blur-xs flex items-center justify-center p-0 lg:p-4 overflow-hidden animate-in fade-in duration-200"
          : `fixed inset-x-0 bottom-0 top-[var(--header-height,48px)] z-[45] lg:pointer-events-none flex items-end lg:items-stretch ${
              drawerSide === "left" ? "lg:justify-start" : "lg:justify-end"
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
      {/* Yan Panel (Drawer) modunda mobil/tablette (< 1024px) arka plan karartması */}
      {!isSmartboard && (
        <div
          aria-hidden="true"
          className="lg:hidden fixed inset-0 top-[var(--header-height,48px)] bg-black/45 backdrop-blur-[1px] pointer-events-auto transition-opacity"
          onClick={() => {
            playClick();
            stopAllAudio();
            onClose();
          }}
        />
      )}

      <div
        className={
          isSmartboard
            ? "pointer-events-auto bg-[#FDFBF7] dark:bg-[var(--background)] w-screen max-w-[100vw] h-[100dvh] rounded-none border-0 lg:rounded-3xl lg:border-2 border-[#E6D7BE] dark:border-[var(--border)] lg:border-b-4 lg:w-[85vw] lg:max-w-[1350px] lg:h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
            : `pointer-events-auto bg-[#FDFBF7] dark:bg-slate-900 w-full max-w-[100vw] max-h-[82dvh] rounded-t-3xl border-t-2 border-[#087F5B] dark:border-emerald-500 shadow-[0_-12px_40px_rgba(0,0,0,0.28)] lg:rounded-none lg:border-t-0 ${
                drawerSide === "left"
                  ? "lg:border-r-4 lg:border-[#087F5B] dark:lg:border-emerald-600 lg:shadow-[12px_0_35px_rgba(0,0,0,0.22)] lg:animate-in lg:slide-in-from-left"
                  : "lg:border-l-4 lg:border-[#087F5B] dark:lg:border-emerald-600 lg:shadow-[-12px_0_35px_rgba(0,0,0,0.22)] lg:animate-in lg:slide-in-from-right"
              } lg:w-[410px] lg:max-w-[410px] lg:h-[calc(100dvh-var(--header-height,56px))] lg:max-h-[calc(100dvh-var(--header-height,56px))] flex flex-col relative overflow-hidden duration-200`
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* KOMPAKT 2 SATIRLI ÜST KONTROL ÇUBUĞU */}
        <div className="sticky top-0 z-20 px-3.5 sm:px-4 py-2.5 bg-[#FDFBF7]/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#E6D7BE] dark:border-slate-800 w-full shrink-0 space-y-2 overflow-visible">
          {!isSmartboard && (
            <div
              aria-hidden="true"
              className="lg:hidden w-10 h-1 rounded-full bg-stone-300 dark:bg-slate-700 mx-auto -mt-0.5 mb-1"
            />
          )}

          <div className="flex items-center justify-between gap-2 overflow-visible">
            <div className="min-w-0 flex items-center gap-1.5">
              {resolvedNote.bagli_id.startsWith("grm_") ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#087F5B] text-white text-xs font-black whitespace-nowrap shrink-0">
                  <span>{`Müstakil Gramer • ${
                    resolvedNote.seviye || linkedLevel || "A1"
                  }`}</span>
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-black whitespace-nowrap shrink-0">
                    <span>📌</span>
                    <span>Odak Gramer</span>
                  </span>
                  {linkedLevel && (
                    <span className="px-2 py-0.5 rounded-lg bg-[#087F5B] text-white text-[11px] font-black shrink-0">
                      {linkedLevel}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-1 overflow-visible">
              {!isSmartboard && (
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setDrawerSide((s) => (s === "right" ? "left" : "right"));
                  }}
                  data-tooltip="Paneli Sola / Sağa Al"
                  data-tooltip-pos="bottom"
                  aria-label="Paneli Sola / Sağa Al"
                  className="hidden lg:inline-flex w-8 h-8 rounded-lg border border-[#E6D7BE] dark:border-slate-700 bg-white dark:bg-slate-800 text-[var(--foreground)] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-[#087F5B] items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  {drawerSide === "right" ? (
                    <PanelLeft className="w-4 h-4 shrink-0" />
                  ) : (
                    <PanelRight className="w-4 h-4 shrink-0" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  playClick();
                  setViewMode((m) =>
                    m === "smartboard" ? "drawer" : "smartboard"
                  );
                }}
                data-tooltip={
                  isSmartboard
                    ? "Yan Panel Görünümüne Dön"
                    : "Tam Ekran Görünümüne Geç"
                }
                data-tooltip-pos="bottom"
                aria-label={
                  isSmartboard
                    ? "Yan Panel Görünümüne Dön"
                    : "Tam Ekran Görünümüne Geç"
                }
                className="hidden lg:inline-flex w-8 h-8 rounded-lg border border-[#E6D7BE] dark:border-slate-700 bg-white dark:bg-slate-800 text-[var(--foreground)] hover:bg-[#F3F0FF] dark:hover:bg-indigo-950/60 hover:text-[#6741D9] items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                {isSmartboard ? (
                  <PanelRight className="w-4 h-4 shrink-0" />
                ) : (
                  <Maximize2 className="w-4 h-4 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  stopAllAudio();
                  onClose();
                }}
                data-tooltip="Yan Paneli Kapat (ESC)"
                data-tooltip-pos="bottom"
                data-tooltip-align="right"
                aria-label="Gramer Notunu Kapat"
                className="w-8 h-8 rounded-lg border border-[#E6D7BE] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>

          <GrammarDepthSegmentedBar
            mode={grammarDepthMode}
            onChange={setGrammarDepthMode}
          />
        </div>

        {/* KAYDIRILABİLİR İÇERİK GÖVDESİ */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <GrammarHapBilgiPanel
            grammarNote={resolvedNote}
            grammarTopic={grammarTopic}
            isSmartboardLarge={isSmartboard}
            isCompactDrawer={!isSmartboard}
            showMatchingSentences={true}
            hideInlineDepthToggle={true}
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
