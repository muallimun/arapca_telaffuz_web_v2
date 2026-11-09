"use client";

import React from "react";
import {
  ARABIC_RUN_CAPTURE_REGEX,
  hasArabicCharacters,
  hasLatinCharacters,
  splitArabicSentenceWithTurkishNote,
} from "@/lib/arabicTextUtils";

export interface RenderMixedArTrOptions {
  arabicSpanClassName?: string;
  turkishNoteClassName?: string;
  arabicSentenceClassName?: string;
}

/**
 * Türkçe + Arapça karma metinlerde:
 * - Türkçe/Latin harfler varsa dış akışı LTR (`dir="ltr"`) tutar,
 * - İçindeki Arapça kelime/ibare gruplarını `<bdi dir="rtl" lang="ar" className="arabic font-arabic ...">`
 *   etiketiyle izole eder; böylece parantezler `(وَ)` ve kelime sırası ASLA ters dönmez
 *   ve Türkçe karakterler (`İ, ı, ğ, ü, ş, ö, ç, û, â`) bozuk Arapça font glifleriyle basılmaz.
 */
export function renderMixedArTrText(
  text?: string | null,
  options?: RenderMixedArTrOptions
): React.ReactNode {
  if (!text) return null;

  const defaultArabicClass =
    options?.arabicSpanClassName ||
    "arabic font-arabic text-[1.18em] font-bold text-emerald-950 dark:text-emerald-300 mx-0.5 inline-block leading-normal";

  const parts = text.split(ARABIC_RUN_CAPTURE_REGEX);

  return parts.map((part, idx) => {
    if (!part) return null;
    if (hasArabicCharacters(part)) {
      return (
        <bdi key={idx} dir="rtl" lang="ar" className={defaultArabicClass}>
          {part}
        </bdi>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export interface MixedTextProps {
  text?: string | null;
  className?: string;
  arabicClassName?: string;
  /**
   * "inline": Satır içi `<span dir="ltr">` olarak render eder (varsayılan: Türkçe + parantez içi Arapça).
   * "block": Blok `<div dir="ltr">` olarak render eder.
   * "sentence-with-note": Tamamen Arapça bir cümle + sonunda parantez içi Türkçe açıklama varsa
   *   üstte sağa yaslı Arapça cümle (`dir="rtl"`), altta sola yaslı Türkçe açıklama (`dir="ltr"`) olarak 2 satırda gösterir.
   */
  mode?: "inline" | "block" | "sentence-with-note";
  arabicSentenceClassName?: string;
  turkishNoteClassName?: string;
}

export function MixedText({
  text,
  className = "",
  arabicClassName,
  mode = "inline",
  arabicSentenceClassName = "arabic font-arabic text-xl font-bold text-right leading-relaxed",
  turkishNoteClassName = "font-sans text-xs text-slate-600 dark:text-slate-300 text-left mt-1",
}: MixedTextProps) {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const containsLatin = hasLatinCharacters(trimmed);
  const containsArabic = hasArabicCharacters(trimmed);

  // 1. "sentence-with-note" modu (ör: "فَحَصِي الطَّبِيبُ (Nûn harfini koymamak).")
  if (mode === "sentence-with-note") {
    const { arabicPart, turkishNotes } =
      splitArabicSentenceWithTurkishNote(trimmed);
    if (arabicPart && turkishNotes.length > 0) {
      return (
        <div className={className}>
          <div dir="rtl" lang="ar" className={arabicSentenceClassName}>
            {arabicPart}
          </div>
          {turkishNotes.map((note, idx) => (
            <div
              key={idx}
              dir="ltr"
              lang="tr"
              className={turkishNoteClassName}
            >
              ({renderMixedArTrText(note, { arabicSpanClassName: arabicClassName })})
            </div>
          ))}
        </div>
      );
    }
  }

  // 2. Sadece Arapça içeren ve hiç Türkçe/Latin karakter barındırmayan metin
  if (containsArabic && !containsLatin) {
    if (mode === "block") {
      return (
        <div
          dir="rtl"
          lang="ar"
          className={`arabic font-arabic text-right ${className}`}
        >
          {trimmed}
        </div>
      );
    }
    return (
      <bdi
        dir="rtl"
        lang="ar"
        className={`arabic font-arabic inline-block ${className}`}
      >
        {trimmed}
      </bdi>
    );
  }

  // 3. Türkçe/Latin harf içeren tüm metinler (içinde Arapça parantez/kelime olsa bile):
  // KURAL A: Ana kapsayıcı KESİNLİKLE dir="ltr" font-sans text-left
  // KURAL B: İçindeki Arapça parçalar <bdi dir="rtl" lang="ar"> ile izole edilir
  const content = renderMixedArTrText(trimmed, {
    arabicSpanClassName: arabicClassName,
  });

  if (mode === "block") {
    return (
      <div
        dir="ltr"
        lang="tr"
        className={`font-sans text-left ${className}`}
      >
        {content}
      </div>
    );
  }

  return (
    <span
      dir="ltr"
      lang="tr"
      className={`font-sans text-left ${className}`}
    >
      {content}
    </span>
  );
}

export default MixedText;
