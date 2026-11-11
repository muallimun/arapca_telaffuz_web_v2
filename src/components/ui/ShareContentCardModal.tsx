"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { useSettings } from "@/store/settings";
import { resolveImageUrl } from "@/lib/data";
import {
  formatArabicText,
  getArabicFontConfig,
  hasArabicCharacters,
} from "@/lib/arabicTextUtils";
import { generateQrMatrix } from "@/lib/qrCode";

export type ShareContentType =
  | "visual_word"
  | "proverb"
  | "dialogue"
  | "reading"
  | "sentence";

export type ShareAspectFormat = "auto" | "square" | "story";
export type ShareCardPackMode = "single" | "dual";

export interface ShareExcerptLine {
  speakerAr?: string;
  speakerTr?: string;
  arapca: string;
  turkce: string;
}

export interface ShareCardPayload {
  type: ShareContentType;
  arabicText: string;
  titleAr?: string;
  titleTr?: string;
  turkishText: string;
  excerptLines?: ShareExcerptLine[];
  subInfoAr?: string;
  subInfoTr?: string;
  level?: string;
  category?: string;
  imageUrl?: string;
  deepLink?: string;
  initialShowTranslation?: boolean;
  initialShowHareke?: boolean;
}

export interface ShareContentCardModalProps {
  payload: ShareCardPayload | null;
  onClose: () => void;
}

export const CANONICAL_APP_URL = "https://app.muallimun.net/";

const TYPE_META: Record<
  ShareContentType,
  {
    badgeTr: string;
    badgeAr: string;
    captionLabelTr: string;
    accentHex: string;
  }
> = {
  visual_word: {
    badgeTr: "🖼️ Görsel Kelime",
    badgeAr: "🖼️ مُفْرَدَةٌ مُصَوَّرَةٌ",
    captionLabelTr: "Görsel Kelime",
    accentHex: "#065F46",
  },
  proverb: {
    badgeTr: "📜 Arapça Atasözü",
    badgeAr: "📜 مَثَلٌ عَرَبِيٌّ",
    captionLabelTr: "Günün Atasözü",
    accentHex: "#92400E",
  },
  dialogue: {
    badgeTr: "💬 Günlük Diyalog",
    badgeAr: "💬 حِوَارٌ يَوْمِيٌّ",
    captionLabelTr: "Günlük Diyalog",
    accentHex: "#065F46",
  },
  reading: {
    badgeTr: "📖 Okuma Metni",
    badgeAr: "📖 نَصُّ قِرَاءَةٍ",
    captionLabelTr: "Okuma Metni",
    accentHex: "#1E3A8A",
  },
  sentence: {
    badgeTr: "🗣️ Günlük Kalıp Cümle",
    badgeAr: "🗣️ عِبَارَةٌ يَوْمِيَّةٌ",
    captionLabelTr: "Kalıp Cümle",
    accentHex: "#065F46",
  },
};

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Birleşik Arapça hareke/şedde kümelerini taban harften koparmadan güvenli alt dizgelere böler.
 */
function splitOversizedToken(
  ctx: CanvasRenderingContext2D,
  token: string,
  maxWidth: number
): string[] {
  if (ctx.measureText(token).width <= maxWidth) return [token];
  // Taban harf + hemen peşinden gelen hareke dizilerini tek birim (cluster) olarak grupla
  const clusters = token.match(/.[\u064B-\u065F\u0670]*/gu) || [token];
  const chunks: string[] = [];
  let buf = "";
  for (const cl of clusters) {
    const next = buf + cl;
    if (ctx.measureText(next).width <= maxWidth || !buf) {
      buf = next;
    } else {
      chunks.push(buf);
      buf = cl;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const rawWords = cleaned.split(" ");
  const safeTokens: string[] = [];
  for (const w of rawWords) {
    if (ctx.measureText(w).width > maxWidth) {
      safeTokens.push(...splitOversizedToken(ctx, w, maxWidth));
    } else {
      safeTokens.push(w);
    }
  }

  const lines: string[] = [];
  let current = "";

  for (const word of safeTokens) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Türkçe anlam kapalıyken (showTr === false) subInfoAr içindeki olası Türkçe etiketleri
 * saf Arapça karşılıklarına dönüştürür veya Latin karakterleri temizler.
 */
function sanitizeSubInfoArForMode(rawSubAr: string | undefined, showTr: boolean): string {
  if (!rawSubAr) return "";
  if (showTr) return rawSubAr.trim();

  const converted = rawSubAr
    .replace(/Kök\s*:/gi, "الجَذْرُ:")
    .replace(/Müfret\s*\/\s*Cem[iî]\s*:/gi, "المُفْرَدُ وَالجَمْعُ:")
    .replace(/M[aâ]z[iî]\s*\/\s*Muz[aâ]r[iî]\s*:/gi, "المَاضِي وَالمُضَارِعُ:")
    .replace(/Örnek\s*:/gi, "مِثَالٌ:")
    .replace(/[a-zA-ZçğıöşüÇĞİÖŞÜâîûÂÎÛ]+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s•|:—-]+|[\s•|:—-]+$/g, "")
    .trim();

  return hasArabicCharacters(converted) ? converted : "";
}

async function loadCorsSafeImage(rawUrl?: string): Promise<HTMLImageElement | null> {
  const resolved = resolveImageUrl(rawUrl);
  if (!resolved) return null;

  try {
    const res = await fetch(resolved, { mode: "cors", cache: "force-cache" });
    if (res.ok) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => resolve(null);
        el.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);
      if (img) return img;
    }
  } catch {
    // Fallback'e geç
  }

  return new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = resolved;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/png");
    } catch {
      resolve(null);
    }
  });
}

function drawCornerArabesque(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  flipX: number,
  flipY: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(flipX, flipY);
  ctx.strokeStyle = "rgba(217, 119, 6, 0.32)";
  ctx.lineWidth = 2.2;

  ctx.beginPath();
  ctx.moveTo(0, 42);
  ctx.lineTo(0, 12);
  ctx.arcTo(0, 0, 12, 0, 12);
  ctx.lineTo(42, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(16, 16, 5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(217, 119, 6, 0.25)";
  ctx.fill();
  ctx.restore();
}

function drawGeometricMedallion(
  ctx: CanvasRenderingContext2D,
  boxX: number,
  boxY: number,
  boxSize: number,
  type: ShareContentType,
  arabicGlyph: string,
  arabicFontFamily: string
) {
  const cx = boxX + boxSize / 2;
  const cy = boxY + boxSize / 2;

  const grad = ctx.createRadialGradient(cx, cy, 16, cx, cy, boxSize * 0.48);
  if (type === "proverb") {
    grad.addColorStop(0, "#FFFBEB");
    grad.addColorStop(0.65, "#FEF3C7");
    grad.addColorStop(1, "#FDE68A");
  } else {
    grad.addColorStop(0, "#ECFDF5");
    grad.addColorStop(0.65, "#D1FAE5");
    grad.addColorStop(1, "#A7F3D0");
  }

  drawRoundRect(ctx, boxX + 12, boxY + 12, boxSize - 24, boxSize - 24, 22);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  const starSide = boxSize * 0.44;
  ctx.strokeStyle =
    type === "proverb" ? "rgba(180, 83, 9, 0.28)" : "rgba(6, 95, 70, 0.24)";
  ctx.lineWidth = 3;

  for (let rot = 0; rot < 2; rot++) {
    ctx.save();
    if (rot === 1) ctx.rotate(Math.PI / 4);
    drawRoundRect(
      ctx,
      -starSide / 2,
      -starSide / 2,
      starSide,
      starSide,
      14
    );
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, boxSize * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#D97706";
  ctx.stroke();

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = type === "proverb" ? "#92400E" : "#065F46";
  const glyphFontPx = Math.max(44, Math.round(boxSize * 0.18));
  ctx.font = `700 ${glyphFontPx}px ${arabicFontFamily}`;
  ctx.fillText(arabicGlyph, 0, 5);
  ctx.restore();
}

function drawMiniQrCode(
  ctx: CanvasRenderingContext2D,
  matrix: boolean[][],
  boxX: number,
  boxY: number,
  boxSize: number
) {
  if (!matrix || matrix.length === 0) return;
  ctx.save();
  drawRoundRect(ctx, boxX, boxY, boxSize, boxSize, 14);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#F59E0B";
  ctx.stroke();

  const quietPad = 7;
  const innerSize = boxSize - quietPad * 2;
  const n = matrix.length;
  const cell = innerSize / n;

  ctx.fillStyle = "#064E3B";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const rx = boxX + quietPad + c * cell;
        const ry = boxY + quietPad + r * cell;
        ctx.fillRect(
          Math.floor(rx),
          Math.floor(ry),
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }
  }
  ctx.restore();
}

type CardRenderVariant = "single" | "dual_question" | "dual_answer";

interface RenderCardParams {
  canvas: HTMLCanvasElement;
  payload: ShareCardPayload;
  loadedImg: HTMLImageElement | null;
  qrMatrix: boolean[][];
  aspectFormat: ShareAspectFormat;
  variant: CardRenderVariant;
  showTrInSingle: boolean;
  localShowHareke: boolean;
  arabicFont: string;
  formattedPrimaryAr: string;
}

function renderShareCardOnCanvas({
  canvas,
  payload,
  loadedImg,
  qrMatrix,
  aspectFormat,
  variant,
  showTrInSingle,
  localShowHareke,
  arabicFont,
  formattedPrimaryAr,
}: RenderCardParams) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const effectiveShowTr =
    variant === "dual_question"
      ? false
      : variant === "dual_answer"
      ? true
      : showTrInSingle;

  const W = 1080;
  const outerPad = 36;
  const contentMaxW = W - 168;
  const footerH = 114;

  const arabicFontCfg = getArabicFontConfig(arabicFont);
  const arabicCssFamily = arabicFontCfg.cssFamily;
  const turkishCssFamily =
    '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const hasExcerpts =
    Array.isArray(payload.excerptLines) && payload.excerptLines.length > 0;
  const excerptSlice = hasExcerpts
    ? payload.excerptLines!.slice(0, aspectFormat === "square" ? 2 : 3)
    : [];

  const titleArFormatted = payload.titleAr
    ? formatArabicText(payload.titleAr, localShowHareke, arabicFont)
    : "";
  const titleTrText =
    effectiveShowTr && payload.titleTr ? payload.titleTr.trim() : "";

  const primaryArText = !hasExcerpts ? formattedPrimaryAr : "";
  const cleanSubAr = sanitizeSubInfoArForMode(
    payload.subInfoAr,
    effectiveShowTr
  );
  const subArFormatted = cleanSubAr
    ? formatArabicText(cleanSubAr, localShowHareke, arabicFont)
    : "";

  const primaryTrText =
    effectiveShowTr && !hasExcerpts ? (payload.turkishText || "").trim() : "";
  const subTrText =
    effectiveShowTr && payload.subInfoTr ? payload.subInfoTr.trim() : "";

  const arWordCount = primaryArText.split(/\s+/).filter(Boolean).length;
  const basePrimaryArSize =
    payload.type === "visual_word" && arWordCount <= 3
      ? 80
      : primaryArText.length <= 42
      ? 58
      : primaryArText.length <= 90
      ? 50
      : 44;

  const targetFixedH =
    aspectFormat === "square" ? 1080 : aspectFormat === "story" ? 1920 : null;

  const candidateScales =
    aspectFormat === "square"
      ? [0.92, 0.84, 0.76, 0.68, 0.62, 0.56]
      : aspectFormat === "story"
      ? [1.06, 1.0, 0.92, 0.84, 0.76]
      : [1.0];

  interface LayoutPlan {
    scale: number;
    imageBoxSize: number;
    primaryArFontSize: number;
    primaryArLineH: number;
    titleArSize: number;
    titleArStep: number;
    titleTrSize: number;
    titleTrStep: number;
    subArSize: number;
    subArStep: number;
    trFontSize: number;
    trStep: number;
    subTrSize: number;
    subTrStep: number;
    excerptArSize: number;
    excerptArStep: number;
    excerptTrSize: number;
    excerptTrStep: number;
    wrappedTitleAr: string[];
    wrappedTitleTr: string[];
    measuredExcerpts: Array<{
      arLines: string[];
      trLines: string[];
      boxH: number;
    }>;
    wrappedPrimaryAr: string[];
    wrappedSubAr: string[];
    wrappedPrimaryTr: string[];
    wrappedSubTr: string[];
    bodyContentH: number;
  }

  let chosenPlan: LayoutPlan | null = null;

  for (const sc of candidateScales) {
    const imageBoxSize =
      aspectFormat === "square"
        ? Math.round((hasExcerpts ? 200 : 240) * Math.max(0.82, sc))
        : aspectFormat === "story"
        ? Math.round((hasExcerpts ? 360 : 420) * Math.min(1.04, sc))
        : hasExcerpts
        ? 340
        : 380;

    const primaryArFontSize = Math.max(32, Math.round(basePrimaryArSize * sc));
    const primaryArLineH = Math.round(primaryArFontSize * 1.86);
    const titleArSize = Math.max(28, Math.round((hasExcerpts ? 48 : 36) * sc));
    const titleArStep = Math.round(titleArSize * 1.78);
    const titleTrSize = Math.max(20, Math.round((hasExcerpts ? 28 : 24) * sc));
    const titleTrStep = Math.round(titleTrSize * 1.45);
    const subArSize = Math.max(26, Math.round(34 * sc));
    const subArStep = Math.round(subArSize * 1.85);
    const trFontSize = Math.max(
      22,
      Math.round((primaryTrText.length <= 70 ? 36 : 31) * sc)
    );
    const trStep = Math.round(trFontSize * 1.46);
    const subTrSize = Math.max(19, Math.round(24 * sc));
    const subTrStep = Math.round(subTrSize * 1.48);
    const excerptArSize = Math.max(28, Math.round(38 * sc));
    const excerptArStep = Math.round(excerptArSize * 1.84);
    const excerptTrSize = Math.max(19, Math.round(24 * sc));
    const excerptTrStep = Math.round(excerptTrSize * 1.45);

    let bodyH = imageBoxSize + (aspectFormat === "square" ? 26 : 38);

    let wrappedTitleAr: string[] = [];
    let wrappedTitleTr: string[] = [];
    if (titleArFormatted) {
      ctx.font = `700 ${titleArSize}px ${arabicCssFamily}`;
      wrappedTitleAr = wrapCanvasText(ctx, titleArFormatted, contentMaxW);
      bodyH += wrappedTitleAr.length * titleArStep + 6;
    }
    if (titleTrText) {
      ctx.font = `700 ${titleTrSize}px ${turkishCssFamily}`;
      wrappedTitleTr = wrapCanvasText(ctx, titleTrText, contentMaxW);
      bodyH += wrappedTitleTr.length * titleTrStep + 16;
    } else if (titleArFormatted) {
      bodyH += 12;
    }

    const measuredExcerpts: Array<{
      arLines: string[];
      trLines: string[];
      boxH: number;
    }> = [];

    if (hasExcerpts) {
      for (const ex of excerptSlice) {
        const speakerPrefixAr = ex.speakerAr
          ? `${formatArabicText(ex.speakerAr, localShowHareke, arabicFont)}: `
          : "";
        const lineAr = formatArabicText(
          `${speakerPrefixAr}${ex.arapca}`,
          localShowHareke,
          arabicFont
        );
        ctx.font = `700 ${excerptArSize}px ${arabicCssFamily}`;
        const arLines = wrapCanvasText(ctx, lineAr, contentMaxW - 56);

        let trLines: string[] = [];
        if (effectiveShowTr && ex.turkce) {
          const speakerPrefixTr = ex.speakerTr ? `${ex.speakerTr}: ` : "";
          ctx.font = `600 ${excerptTrSize}px ${turkishCssFamily}`;
          trLines = wrapCanvasText(
            ctx,
            `${speakerPrefixTr}${ex.turkce}`,
            contentMaxW - 56
          );
        }

        const boxH =
          28 +
          arLines.length * excerptArStep +
          (trLines.length > 0 ? 10 + trLines.length * excerptTrStep : 0);
        measuredExcerpts.push({ arLines, trLines, boxH });
        bodyH += boxH + 14;
      }
      bodyH += 10;
    }

    let wrappedPrimaryAr: string[] = [];
    if (primaryArText) {
      ctx.font = `700 ${primaryArFontSize}px ${arabicCssFamily}`;
      wrappedPrimaryAr = wrapCanvasText(ctx, primaryArText, contentMaxW - 36);
      bodyH += wrappedPrimaryAr.length * primaryArLineH + 14;
    }

    let wrappedSubAr: string[] = [];
    if (subArFormatted) {
      ctx.font = `600 ${subArSize}px ${arabicCssFamily}`;
      wrappedSubAr = wrapCanvasText(ctx, subArFormatted, contentMaxW - 64);
      bodyH += wrappedSubAr.length * subArStep + 26;
    }

    // Ayırıcı süsleme yüksekliği
    bodyH += aspectFormat === "square" ? 30 : 40;

    let wrappedPrimaryTr: string[] = [];
    let wrappedSubTr: string[] = [];
    if (effectiveShowTr) {
      if (variant === "dual_answer") {
        bodyH += 58; // "✅ Doğru Anlamı & Açıklaması" başlık rozeti
      }
      if (primaryTrText) {
        ctx.font = `700 ${trFontSize}px ${turkishCssFamily}`;
        wrappedPrimaryTr = wrapCanvasText(ctx, primaryTrText, contentMaxW - 56);
        bodyH += wrappedPrimaryTr.length * trStep + 14;
      }
      if (subTrText) {
        ctx.font = `500 ${subTrSize}px ${turkishCssFamily}`;
        wrappedSubTr = wrapCanvasText(ctx, subTrText, contentMaxW - 64);
        bodyH += wrappedSubTr.length * subTrStep + 14;
      }
      if (
        variant === "single" &&
        aspectFormat !== "square" &&
        (payload.type === "dialogue" || payload.type === "reading") &&
        hasExcerpts
      ) {
        bodyH += 58;
      }
      bodyH += 18;
    } else {
      bodyH += 88; // Soru / Quiz rozeti yüksekliği
    }

    const plan: LayoutPlan = {
      scale: sc,
      imageBoxSize,
      primaryArFontSize,
      primaryArLineH,
      titleArSize,
      titleArStep,
      titleTrSize,
      titleTrStep,
      subArSize,
      subArStep,
      trFontSize,
      trStep,
      subTrSize,
      subTrStep,
      excerptArSize,
      excerptArStep,
      excerptTrSize,
      excerptTrStep,
      wrappedTitleAr,
      wrappedTitleTr,
      measuredExcerpts,
      wrappedPrimaryAr,
      wrappedSubAr,
      wrappedPrimaryTr,
      wrappedSubTr,
      bodyContentH: bodyH,
    };

    chosenPlan = plan;
    if (!targetFixedH) break;
    const headerReserve = outerPad + 108;
    const footerReserve = footerH + outerPad + 24;
    if (headerReserve + bodyH + footerReserve <= targetFixedH) {
      break;
    }
  }

  const plan = chosenPlan!;
  const headerStart = outerPad + 108;
  const footerReserve = footerH + outerPad + 24;
  const computedAutoH = Math.max(
    1220,
    headerStart + plan.bodyContentH + footerReserve
  );
  const totalH = targetFixedH
    ? Math.max(targetFixedH, headerStart + plan.bodyContentH + footerReserve)
    : computedAutoH;

  canvas.width = W;
  canvas.height = totalH;

  // --- ARKA PLAN & ÇİFT KATMANLI ALTIN ÇERÇEVE ---
  const bgGrad = ctx.createLinearGradient(0, 0, W, totalH);
  bgGrad.addColorStop(0, "#FDFBF7");
  bgGrad.addColorStop(0.5, "#FAF6EE");
  bgGrad.addColorStop(1, "#F3ECE0");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, totalH);

  const glowGrad = ctx.createRadialGradient(W / 2, 260, 30, W / 2, 260, 520);
  glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  glowGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, 720);

  drawRoundRect(
    ctx,
    outerPad,
    outerPad,
    W - outerPad * 2,
    totalH - outerPad * 2,
    36
  );
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#D97706";
  ctx.stroke();

  drawRoundRect(
    ctx,
    outerPad + 12,
    outerPad + 12,
    W - (outerPad + 12) * 2,
    totalH - (outerPad + 12) * 2,
    28
  );
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#E6D7BE";
  ctx.stroke();

  drawCornerArabesque(ctx, outerPad + 24, outerPad + 24, 1, 1);
  drawCornerArabesque(ctx, W - outerPad - 24, outerPad + 24, -1, 1);
  drawCornerArabesque(
    ctx,
    outerPad + 24,
    totalH - outerPad - footerH - 18,
    1,
    -1
  );
  drawCornerArabesque(
    ctx,
    W - outerPad - 24,
    totalH - outerPad - footerH - 18,
    -1,
    -1
  );

  // --- ÜST BİLGİ ŞERİDİ ---
  const meta = TYPE_META[payload.type];
  const headerY = outerPad + 30;
  const showTrHeader = variant !== "single" ? true : effectiveShowTr;
  const badgeText = showTrHeader
    ? meta.badgeTr
    : formatArabicText(meta.badgeAr, localShowHareke, arabicFont);

  ctx.save();
  ctx.font = showTrHeader
    ? `800 23px ${turkishCssFamily}`
    : `700 27px ${arabicCssFamily}`;
  const badgeTextW = ctx.measureText(badgeText).width;
  const badgeW = Math.min(540, badgeTextW + 48);
  const badgeX = outerPad + 34;

  drawRoundRect(ctx, badgeX, headerY, badgeW, 54, 18);
  ctx.fillStyle = payload.type === "proverb" ? "#FEF3C7" : "#ECFDF5";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = payload.type === "proverb" ? "#F59E0B" : "#A7F3D0";
  ctx.stroke();

  ctx.fillStyle = meta.accentHex;
  ctx.direction = showTrHeader ? "ltr" : "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, badgeX + badgeW / 2, headerY + 28);
  ctx.restore();

  const rightBadgesXEnd = W - outerPad - 34;
  let currentRightX = rightBadgesXEnd;

  if (variant !== "single") {
    const stepLabel = variant === "dual_question" ? "1 / 2 • SORU" : "2 / 2 • CEVAP";
    ctx.save();
    ctx.font = `900 20px ${turkishCssFamily}`;
    const stepW = ctx.measureText(stepLabel).width + 36;
    currentRightX -= stepW;
    drawRoundRect(ctx, currentRightX, headerY, stepW, 54, 18);
    ctx.fillStyle = variant === "dual_question" ? "#FEF3C7" : "#D1FAE5";
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = variant === "dual_question" ? "#F59E0B" : "#10B981";
    ctx.stroke();
    ctx.fillStyle = variant === "dual_question" ? "#92400E" : "#065F46";
    ctx.direction = "ltr";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stepLabel, currentRightX + stepW / 2, headerY + 28);
    ctx.restore();
    currentRightX -= 12;
  }

  if (payload.level) {
    const lvlLabel = payload.level.toUpperCase();
    ctx.save();
    ctx.font = `900 23px ${turkishCssFamily}`;
    const lvlW = Math.max(84, ctx.measureText(lvlLabel).width + 40);
    currentRightX -= lvlW;

    drawRoundRect(ctx, currentRightX, headerY, lvlW, 54, 18);
    ctx.fillStyle = "#065F46";
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.direction = "ltr";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lvlLabel, currentRightX + lvlW / 2, headerY + 28);
    ctx.restore();
    currentRightX -= 12;
  }

  if (effectiveShowTr && payload.category && variant === "single") {
    const catTrimmed =
      payload.category.length > 22
        ? `${payload.category.slice(0, 20)}…`
        : payload.category;
    ctx.save();
    ctx.font = `700 20px ${turkishCssFamily}`;
    const catW = ctx.measureText(catTrimmed).width + 36;
    if (currentRightX - catW > badgeX + badgeW + 16) {
      currentRightX -= catW;
      drawRoundRect(ctx, currentRightX, headerY, catW, 54, 18);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#E2E8F0";
      ctx.stroke();

      ctx.fillStyle = "#475569";
      ctx.direction = "ltr";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(catTrimmed, currentRightX + catW / 2, headerY + 28);
    }
    ctx.restore();
  }

  // Sabit 1:1 veya 9:16 modlarında dikey boşluğu dengeli ortala
  const availableBodySpace = totalH - headerStart - footerReserve;
  const extraSlack = Math.max(0, availableBodySpace - plan.bodyContentH);
  let drawY = headerStart + Math.round(extraSlack * 0.42);

  // --- MERKEZ GÖRSEL ÇERÇEVESİ ---
  const imgBoxX = (W - plan.imageBoxSize) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.10)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  drawRoundRect(ctx, imgBoxX, drawY, plan.imageBoxSize, plan.imageBoxSize, 30);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.restore();

  drawRoundRect(ctx, imgBoxX, drawY, plan.imageBoxSize, plan.imageBoxSize, 30);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#E6D7BE";
  ctx.stroke();

  if (loadedImg && loadedImg.naturalWidth > 0 && loadedImg.naturalHeight > 0) {
    const innerPad = 12;
    const availW = plan.imageBoxSize - innerPad * 2;
    const availH = plan.imageBoxSize - innerPad * 2;
    const scale = Math.min(
      availW / loadedImg.naturalWidth,
      availH / loadedImg.naturalHeight
    );
    const renderW = loadedImg.naturalWidth * scale;
    const renderH = loadedImg.naturalHeight * scale;
    const renderX = imgBoxX + (plan.imageBoxSize - renderW) / 2;
    const renderY = drawY + (plan.imageBoxSize - renderH) / 2;

    ctx.save();
    drawRoundRect(
      ctx,
      imgBoxX + innerPad,
      drawY + innerPad,
      availW,
      availH,
      20
    );
    ctx.clip();
    ctx.drawImage(loadedImg, renderX, renderY, renderW, renderH);
    ctx.restore();
  } else {
    const glyph =
      payload.type === "proverb"
        ? "حِكْمَة"
        : payload.type === "dialogue"
        ? "حِوَار"
        : payload.type === "reading"
        ? "اقْرَأْ"
        : "عَرَبِيّ";
    drawGeometricMedallion(
      ctx,
      imgBoxX,
      drawY,
      plan.imageBoxSize,
      payload.type,
      formatArabicText(glyph, localShowHareke, arabicFont),
      arabicCssFamily
    );
  }

  drawY += plan.imageBoxSize + (aspectFormat === "square" ? 26 : 38);

  // --- OPSİYONEL BAŞLIKLAR ---
  if (plan.wrappedTitleAr.length > 0) {
    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = hasExcerpts ? "#064E3B" : "#047857";
    ctx.font = `700 ${plan.titleArSize}px ${arabicCssFamily}`;
    for (const line of plan.wrappedTitleAr) {
      ctx.fillText(line, W / 2, drawY);
      drawY += plan.titleArStep;
    }
    ctx.restore();
    drawY += 4;
  }

  if (plan.wrappedTitleTr.length > 0) {
    ctx.save();
    ctx.direction = "ltr";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#475569";
    ctx.font = `700 ${plan.titleTrSize}px ${turkishCssFamily}`;
    for (const line of plan.wrappedTitleTr) {
      ctx.fillText(line, W / 2, drawY);
      drawY += plan.titleTrStep;
    }
    ctx.restore();
    drawY += 14;
  } else if (plan.wrappedTitleAr.length > 0) {
    drawY += 10;
  }

  // --- ANA ARAPÇA İÇERİK VEYA DİYALOG/METİN KESİTİ ---
  if (hasExcerpts) {
    const boxX = (W - contentMaxW) / 2;
    for (const item of plan.measuredExcerpts) {
      drawRoundRect(ctx, boxX, drawY, contentMaxW, item.boxH, 22);
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#E2E8F0";
      ctx.stroke();

      let innerY = drawY + 14;
      ctx.save();
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#064E3B";
      ctx.font = `700 ${plan.excerptArSize}px ${arabicCssFamily}`;
      for (const arL of item.arLines) {
        ctx.fillText(arL, boxX + contentMaxW - 28, innerY);
        innerY += plan.excerptArStep;
      }
      ctx.restore();

      if (item.trLines.length > 0) {
        innerY += 6;
        ctx.save();
        ctx.direction = "ltr";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#334155";
        ctx.font = `600 ${plan.excerptTrSize}px ${turkishCssFamily}`;
        for (const trL of item.trLines) {
          ctx.fillText(trL, boxX + 28, innerY);
          innerY += plan.excerptTrStep;
        }
        ctx.restore();
      }

      drawY += item.boxH + 14;
    }
    drawY += 8;
  } else if (plan.wrappedPrimaryAr.length > 0) {
    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#064E3B";
    ctx.font = `700 ${plan.primaryArFontSize}px ${arabicCssFamily}`;
    for (const line of plan.wrappedPrimaryAr) {
      ctx.fillText(line, W / 2, drawY);
      drawY += plan.primaryArLineH;
    }
    ctx.restore();
    drawY += 12;
  }

  if (plan.wrappedSubAr.length > 0) {
    const subBoxW = contentMaxW - 24;
    const subBoxH = plan.wrappedSubAr.length * plan.subArStep + 20;
    const subBoxX = (W - subBoxW) / 2;

    drawRoundRect(ctx, subBoxX, drawY, subBoxW, subBoxH, 20);
    ctx.fillStyle = "#ECFDF5";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#A7F3D0";
    ctx.stroke();

    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#065F46";
    ctx.font = `600 ${plan.subArSize}px ${arabicCssFamily}`;
    let subY = drawY + 10;
    for (const line of plan.wrappedSubAr) {
      ctx.fillText(line, W / 2, subY);
      subY += plan.subArStep;
    }
    ctx.restore();

    drawY += subBoxH + 16;
  }

  // --- ALTIN AYIRICI ÇİZGİ ---
  const divY = drawY + 12;
  ctx.save();
  ctx.strokeStyle = "#D97706";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 190, divY);
  ctx.lineTo(W / 2 - 22, divY);
  ctx.moveTo(W / 2 + 22, divY);
  ctx.lineTo(W / 2 + 190, divY);
  ctx.stroke();

  ctx.translate(W / 2, divY);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#D97706";
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();

  drawY += aspectFormat === "square" ? 30 : 38;

  // --- TÜRKÇE ANLAM / ÇİFT KART CEVAP VEYA SORU ROZETİ ---
  if (effectiveShowTr) {
    if (variant === "dual_answer") {
      const ansHeader = "✅ Doğru Anlamı & Açıklaması";
      ctx.save();
      ctx.font = `800 23px ${turkishCssFamily}`;
      const pillW = Math.min(contentMaxW, ctx.measureText(ansHeader).width + 52);
      const pillX = (W - pillW) / 2;
      drawRoundRect(ctx, pillX, drawY, pillW, 46, 16);
      ctx.fillStyle = "#ECFDF5";
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#10B981";
      ctx.stroke();
      ctx.direction = "ltr";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#065F46";
      ctx.fillText(ansHeader, W / 2, drawY + 24);
      ctx.restore();
      drawY += 58;
    }

    if (plan.wrappedPrimaryTr.length > 0) {
      ctx.save();
      ctx.direction = "ltr";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#1E293B";
      ctx.font = `700 ${plan.trFontSize}px ${turkishCssFamily}`;
      for (const line of plan.wrappedPrimaryTr) {
        ctx.fillText(line, W / 2, drawY);
        drawY += plan.trStep;
      }
      ctx.restore();
      drawY += 12;
    }

    if (plan.wrappedSubTr.length > 0) {
      ctx.save();
      ctx.direction = "ltr";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#475569";
      ctx.font = `500 ${plan.subTrSize}px ${turkishCssFamily}`;
      for (const line of plan.wrappedSubTr) {
        ctx.fillText(line, W / 2, drawY);
        drawY += plan.subTrStep;
      }
      ctx.restore();
      drawY += 12;
    }

    if (
      variant === "single" &&
      aspectFormat !== "square" &&
      (payload.type === "dialogue" || payload.type === "reading") &&
      hasExcerpts
    ) {
      const calloutText = "🎧 Tamamını sesli dinlemek için: app.muallimun.net";
      ctx.save();
      ctx.font = `700 22px ${turkishCssFamily}`;
      const calloutW = Math.min(
        contentMaxW,
        ctx.measureText(calloutText).width + 52
      );
      const calloutX = (W - calloutW) / 2;
      drawRoundRect(ctx, calloutX, drawY + 2, calloutW, 48, 16);
      ctx.fillStyle = "#FEF3C7";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#F59E0B";
      ctx.stroke();

      ctx.direction = "ltr";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#92400E";
      ctx.fillText(calloutText, W / 2, drawY + 26);
      ctx.restore();
    }
  } else if (variant === "dual_question") {
    // Çift Kart 1. Soru Kartı Rozeti: "🤔 Anlamını Tahmin Et! • مَا مَعْنَاهُ؟"
    const qAr = formatArabicText("مَا مَعْنَاهُ؟", localShowHareke, arabicFont);
    const pillLabel = `🤔 Anlamını Tahmin Et!  •  ${qAr}`;
    ctx.save();
    ctx.font = `800 27px ${turkishCssFamily}`;
    const pillW = Math.min(contentMaxW, Math.max(540, ctx.measureText(pillLabel).width + 68));
    const pillH = 68;
    const pillX = (W - pillW) / 2;

    drawRoundRect(ctx, pillX, drawY + 4, pillW, pillH, 22);
    ctx.fillStyle = "#FEF3C7";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#F59E0B";
    ctx.stroke();

    ctx.direction = "ltr";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#92400E";
    ctx.fillText(pillLabel, W / 2, drawY + 39);
    ctx.restore();
  } else {
    // Tek Kart Sadece Arapça Modu — Sıfır Türkçe!
    const quizAr = formatArabicText(
      "مَا مَعْنَاهُ؟ 🤔",
      localShowHareke,
      arabicFont
    );
    const pillW = 390;
    const pillH = 70;
    const pillX = (W - pillW) / 2;

    drawRoundRect(ctx, pillX, drawY + 4, pillW, pillH, 24);
    ctx.fillStyle = "#FEF3C7";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#F59E0B";
    ctx.stroke();

    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#92400E";
    ctx.font = `700 38px ${arabicCssFamily}`;
    ctx.fillText(quizAr, W / 2, drawY + 40);
    ctx.restore();
  }

  // --- ALT KURUMSAL MARKA BANDI + MİNİ QR KODU ---
  const footerX = outerPad + 12;
  const footerW = W - (outerPad + 12) * 2;
  const footerY = totalH - outerPad - 12 - footerH;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(footerX, footerY);
  ctx.lineTo(footerX + footerW, footerY);
  ctx.lineTo(footerX + footerW, footerY + footerH - 26);
  ctx.arcTo(
    footerX + footerW,
    footerY + footerH,
    footerX + footerW - 26,
    footerY + footerH,
    26
  );
  ctx.lineTo(footerX + 26, footerY + footerH);
  ctx.arcTo(
    footerX,
    footerY + footerH,
    footerX,
    footerY + footerH - 26,
    26
  );
  ctx.closePath();
  ctx.fillStyle = "#065F46";
  ctx.fill();

  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 29px ${turkishCssFamily}`;
  ctx.fillText("Muallimun", footerX + 32, footerY + 22);

  if (showTrHeader) {
    ctx.fillStyle = "#A7F3D0";
    ctx.font = `600 19px ${turkishCssFamily}`;
    ctx.fillText(
      "Arapça Telaffuz & Diyalog Platformu",
      footerX + 32,
      footerY + 62
    );
  } else {
    ctx.direction = "rtl";
    ctx.textAlign = "left";
    ctx.fillStyle = "#A7F3D0";
    ctx.font = `600 23px ${arabicCssFamily}`;
    ctx.fillText(
      formatArabicText(
        "مِنَصَّةُ النُّطْقِ وَالحِوَارِ العَرَبِيِّ",
        localShowHareke,
        arabicFont
      ),
      footerX + 32,
      footerY + 58
    );
  }

  // Sağda Mini QR Kodu + Altın URL Rozeti
  const qrSize = 90;
  const qrX = footerX + footerW - qrSize - 20;
  const qrY = footerY + (footerH - qrSize) / 2;
  drawMiniQrCode(ctx, qrMatrix, qrX, qrY, qrSize);

  const urlBadgeW = 312;
  const urlBadgeH = 54;
  const urlBadgeX = qrX - urlBadgeW - 14;
  const urlBadgeY = footerY + (footerH - urlBadgeH) / 2;

  drawRoundRect(ctx, urlBadgeX, urlBadgeY, urlBadgeW, urlBadgeH, 16);
  ctx.fillStyle = "#FEF3C7";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#F59E0B";
  ctx.stroke();

  ctx.direction = "ltr";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#78350F";
  ctx.font = `800 21px ${turkishCssFamily}`;
  ctx.fillText(
    "🌐 app.muallimun.net",
    urlBadgeX + urlBadgeW / 2,
    urlBadgeY + urlBadgeH / 2 + 1
  );
  ctx.restore();
}

export function ShareContentCardModal({
  payload,
  onClose,
}: ShareContentCardModalProps) {
  if (!payload || typeof document === "undefined") return null;
  const modalKey = `${payload.type}:${payload.arabicText}:${payload.deepLink || ""}:${String(
    payload.initialShowTranslation
  )}:${String(payload.initialShowHareke)}`;
  return (
    <ShareContentCardModalBody
      key={modalKey}
      payload={payload}
      onClose={onClose}
    />
  );
}

function ShareContentCardModalBody({
  payload,
  onClose,
}: {
  payload: ShareCardPayload;
  onClose: () => void;
}) {
  const { viewMode, showHareke, arabicFont } = useSettings();

  const [showTr, setShowTr] = useState<boolean>(() =>
    typeof payload.initialShowTranslation === "boolean"
      ? payload.initialShowTranslation
      : viewMode !== "arabic-only" && viewMode !== "click-reveal"
  );
  const [localShowHareke, setLocalShowHareke] = useState<boolean>(() =>
    typeof payload.initialShowHareke === "boolean"
      ? payload.initialShowHareke
      : showHareke
  );
  const [aspectFormat, setAspectFormat] = useState<ShareAspectFormat>("auto");
  const [cardPackMode, setCardPackMode] = useState<ShareCardPackMode>("single");
  const [activeDualSlide, setActiveDualSlide] = useState<1 | 2>(1);

  const [isRendering, setIsRendering] = useState<boolean>(true);
  const [singlePreviewUrl, setSinglePreviewUrl] = useState<string | null>(null);
  const [singleBlob, setSingleBlob] = useState<Blob | null>(null);
  const [dualCard1Url, setDualCard1Url] = useState<string | null>(null);
  const [dualCard1Blob, setDualCard1Blob] = useState<Blob | null>(null);
  const [dualCard2Url, setDualCard2Url] = useState<string | null>(null);
  const [dualCard2Blob, setDualCard2Blob] = useState<Blob | null>(null);

  const [canShareFiles, setCanShareFiles] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "emerald" | "amber";
    text: string;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeObjectUrlsRef = useRef<string[]>([]);

  const revokeTrackedUrls = useCallback(() => {
    for (const u of activeObjectUrlsRef.current) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        // ignore
      }
    }
    activeObjectUrlsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      revokeTrackedUrls();
    };
  }, [revokeTrackedUrls]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const resolvedDeepLink = useMemo(() => {
    const candidate = payload.deepLink?.trim();
    if (candidate && /^https?:\/\//i.test(candidate)) {
      return candidate;
    }
    if (candidate && candidate.startsWith("/")) {
      return `https://app.muallimun.net${candidate}`;
    }
    return CANONICAL_APP_URL;
  }, [payload.deepLink]);

  const qrMatrix = useMemo(
    () => generateQrMatrix(resolvedDeepLink),
    [resolvedDeepLink]
  );

  const formattedPrimaryAr = useMemo(() => {
    const base =
      payload.arabicText ||
      payload.titleAr ||
      payload.excerptLines?.[0]?.arapca ||
      "";
    return formatArabicText(base, localShowHareke, arabicFont);
  }, [payload, localShowHareke, arabicFont]);

  const shareCaption = useMemo(() => {
    const meta = TYPE_META[payload.type];
    const arDisplay = formattedPrimaryAr;

    if (cardPackMode === "dual") {
      return `🤔 1. Kartta anlamını tahmin et, 2. karta kaydırıp doğru cevabı gör!\n✨ ${arDisplay}\n\n🎧 Sesli dinlemek ve telaffuzunu test etmek için:\n${resolvedDeepLink}`;
    }

    if (!showTr) {
      // KATI KURAL: Tek kartta Türkçe anlam kapalıyken açıklama metnine HİÇBİR Türkçe çeviri sızmaz!
      return `✨ ${arDisplay}\n\n🎧 Sesli dinlemek, anlamını görmek ve telaffuzunu test etmek için:\n${resolvedDeepLink}`;
    }

    const trSummary = (
      payload.turkishText ||
      payload.titleTr ||
      payload.excerptLines?.[0]?.turkce ||
      ""
    ).trim();

    return `✨ ${meta.captionLabelTr}: ${arDisplay}\n🇹🇷 Anlamı: ${trSummary}\n\n🎧 Sesli dinlemek ve telaffuzunu test etmek için:\n${resolvedDeepLink}`;
  }, [payload, showTr, cardPackMode, formattedPrimaryAr, resolvedDeepLink]);

  const whatsAppShareHref = useMemo(() => {
    return `https://wa.me/?text=${encodeURIComponent(shareCaption)}`;
  }, [shareCaption]);

  const telegramShareHref = useMemo(() => {
    const captionWithoutTrailingUrl = shareCaption
      .replace(resolvedDeepLink, "")
      .trim();
    return `https://t.me/share/url?url=${encodeURIComponent(
      resolvedDeepLink
    )}&text=${encodeURIComponent(captionWithoutTrailingUrl)}`;
  }, [shareCaption, resolvedDeepLink]);

  // Kanvas Kart Üretimi (Tek Kart veya Soru -> Cevap Çift Kart)
  useEffect(() => {
    let cancelled = false;

    const renderCards = async () => {
      setIsRendering(true);
      try {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await document.fonts.ready;
        }

        const loadedImg = await loadCorsSafeImage(payload.imageUrl);
        if (cancelled) return;

        const canvas = canvasRef.current || document.createElement("canvas");
        canvasRef.current = canvas;

        if (cardPackMode === "single") {
          renderShareCardOnCanvas({
            canvas,
            payload,
            loadedImg,
            qrMatrix,
            aspectFormat,
            variant: "single",
            showTrInSingle: showTr,
            localShowHareke,
            arabicFont,
            formattedPrimaryAr,
          });

          const blob = await canvasToPngBlob(canvas);
          if (cancelled || !blob) return;

          revokeTrackedUrls();
          const objUrl = URL.createObjectURL(blob);
          activeObjectUrlsRef.current = [objUrl];

          setSingleBlob(blob);
          setSinglePreviewUrl(objUrl);
          setDualCard1Blob(null);
          setDualCard1Url(null);
          setDualCard2Blob(null);
          setDualCard2Url(null);

          try {
            const testFile = new File([blob], "muallimun-kart.png", {
              type: "image/png",
            });
            setCanShareFiles(
              typeof navigator !== "undefined" &&
                typeof navigator.canShare === "function" &&
                navigator.canShare({ files: [testFile] })
            );
          } catch {
            setCanShareFiles(false);
          }
        } else {
          // 1. Soru Kartı
          renderShareCardOnCanvas({
            canvas,
            payload,
            loadedImg,
            qrMatrix,
            aspectFormat,
            variant: "dual_question",
            showTrInSingle: false,
            localShowHareke,
            arabicFont,
            formattedPrimaryAr,
          });
          const blob1 = await canvasToPngBlob(canvas);
          if (cancelled || !blob1) return;

          // 2. Cevap Kartı
          renderShareCardOnCanvas({
            canvas,
            payload,
            loadedImg,
            qrMatrix,
            aspectFormat,
            variant: "dual_answer",
            showTrInSingle: true,
            localShowHareke,
            arabicFont,
            formattedPrimaryAr,
          });
          const blob2 = await canvasToPngBlob(canvas);
          if (cancelled || !blob2) return;

          revokeTrackedUrls();
          const url1 = URL.createObjectURL(blob1);
          const url2 = URL.createObjectURL(blob2);
          activeObjectUrlsRef.current = [url1, url2];

          setDualCard1Blob(blob1);
          setDualCard1Url(url1);
          setDualCard2Blob(blob2);
          setDualCard2Url(url2);
          setSingleBlob(null);
          setSinglePreviewUrl(null);

          try {
            const f1 = new File([blob1], "muallimun-1-soru.png", {
              type: "image/png",
            });
            const f2 = new File([blob2], "muallimun-2-cevap.png", {
              type: "image/png",
            });
            setCanShareFiles(
              typeof navigator !== "undefined" &&
                typeof navigator.canShare === "function" &&
                navigator.canShare({ files: [f1, f2] })
            );
          } catch {
            setCanShareFiles(false);
          }
        }
      } catch {
        if (!cancelled) {
          setStatusMessage({
            tone: "amber",
            text: "Kart önizlemesi hazırlanırken bir sorun oluştu, tekrar deneyin.",
          });
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    };

    renderCards();
    return () => {
      cancelled = true;
    };
  }, [
    payload,
    showTr,
    localShowHareke,
    arabicFont,
    formattedPrimaryAr,
    aspectFormat,
    cardPackMode,
    qrMatrix,
    revokeTrackedUrls,
  ]);

  const activePreviewUrl =
    cardPackMode === "dual"
      ? activeDualSlide === 1
        ? dualCard1Url
        : dualCard2Url
      : singlePreviewUrl;

  const activeClipboardBlob =
    cardPackMode === "dual"
      ? activeDualSlide === 1
        ? dualCard1Blob
        : dualCard2Blob
      : singleBlob;

  const copyCardBlobToClipboard = useCallback(async (): Promise<boolean> => {
    if (!activeClipboardBlob) return false;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.write &&
        typeof ClipboardItem !== "undefined"
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": activeClipboardBlob }),
        ]);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }, [activeClipboardBlob]);

  const handleNativeShareWithImage = async () => {
    if (cardPackMode === "dual" && dualCard1Blob && dualCard2Blob) {
      try {
        const f1 = new File(
          [dualCard1Blob],
          `muallimun-${payload.type}-1-soru.png`,
          { type: "image/png" }
        );
        const f2 = new File(
          [dualCard2Blob],
          `muallimun-${payload.type}-2-cevap.png`,
          { type: "image/png" }
        );
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [f1, f2] })
        ) {
          await navigator.share({
            files: [f1, f2],
            title: "Muallimun Soru -> Cevap Arapça Kartları",
            text: shareCaption,
          });
          setStatusMessage({
            tone: "emerald",
            text: "Soru ve Cevap kartlarının ikisi birlikte başarıyla paylaşıldı!",
          });
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    } else if (singleBlob) {
      try {
        const fileName = `muallimun-${payload.type}-kart.png`;
        const file = new File([singleBlob], fileName, { type: "image/png" });
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({
            files: [file],
            title: "Muallimun Arapça Kartı",
            text: shareCaption,
          });
          setStatusMessage({
            tone: "emerald",
            text: "Görsel kart ve doğrudan içerik bağlantısı başarıyla paylaşıldı!",
          });
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    const copied = await copyCardBlobToClipboard();
    if (copied) {
      setStatusMessage({
        tone: "emerald",
        text: "Kart görseli panoya kopyalandı! WhatsApp veya Telegram butonuna tıklayıp Ctrl+V ile görseli yapıştırabilirsiniz.",
      });
    } else if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          title: "Muallimun Arapça Kartı",
          text: shareCaption,
          url: resolvedDeepLink,
        });
      } catch {
        // Kullanıcı iptal etti
      }
    }
  };

  const handleSocialLinkClick = async (platform: "WhatsApp" | "Telegram") => {
    const copied = await copyCardBlobToClipboard();
    if (copied) {
      setStatusMessage({
        tone: "emerald",
        text: `Kart görseli panoya kopyalandı! Açılan ${platform} ekranında Ctrl+V ile görseli doğrudan yapıştırabilirsiniz.`,
      });
    } else {
      setStatusMessage({
        tone: "amber",
        text: `${platform} paylaşım ekranı açıldı. Görseli de eklemek için indirme butonunu kullanabilirsiniz.`,
      });
    }
  };

  const handleCopyImageButton = async () => {
    const copied = await copyCardBlobToClipboard();
    if (copied) {
      setStatusMessage({
        tone: "emerald",
        text: "HD görsel kart panoya kopyalandı! İstediğiniz sohbete yapıştırabilirsiniz.",
      });
    } else {
      setStatusMessage({
        tone: "amber",
        text: "Tarayıcınız doğrudan görsel kopyalamayı desteklemiyor. İndirme butonunu kullanabilirsiniz.",
      });
    }
  };

  const handleCopyCaptionText = async () => {
    try {
      await navigator.clipboard.writeText(shareCaption);
      setStatusMessage({
        tone: "emerald",
        text: "Paylaşım metni ve doğrudan içerik bağlantısı kopyalandı!",
      });
    } catch {
      setStatusMessage({
        tone: "amber",
        text: "Metin kopyalanamadı.",
      });
    }
  };

  const triggerDownloadUrl = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPng = () => {
    if (cardPackMode === "dual") {
      if (!dualCard1Url || !dualCard2Url) return;
      triggerDownloadUrl(
        dualCard1Url,
        `muallimun-${payload.type}-1-soru.png`
      );
      setTimeout(() => {
        triggerDownloadUrl(
          dualCard2Url,
          `muallimun-${payload.type}-2-cevap.png`
        );
      }, 180);
      setStatusMessage({
        tone: "emerald",
        text: "1. Soru Kartı ve 2. Cevap Kartı yüksek çözünürlüklü PNG olarak indirildi.",
      });
      return;
    }

    if (!singlePreviewUrl) return;
    triggerDownloadUrl(singlePreviewUrl, `muallimun-${payload.type}-kart.png`);
    setStatusMessage({
      tone: "emerald",
      text: "Yüksek çözünürlüklü PNG kart cihazınıza indirildi.",
    });
  };

  const isActionReady =
    cardPackMode === "dual"
      ? Boolean(dualCard1Blob && dualCard2Blob)
      : Boolean(singleBlob);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Görsel Kart Paylaşım Penceresi"
    >
      <div
        className="relative w-full sm:max-w-xl max-h-[94dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Üst Başlık & Kapat */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-50/90 via-white to-amber-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Görsel Kart Olarak Paylaş
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                1:1 Kare, 9:16 Hikâye, Soru→Cevap Çift Kart ve QR Destekli
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Kontroller: Kart Modu, En-Boy Formatı, Türkçe Anlam & Hareke */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 space-y-2 shrink-0">
          {/* Satır 1: Tek Kart vs Soru -> Cevap Çift Kart + Format Seçici */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Kart Paketi Modu"
              className="inline-flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={cardPackMode === "single"}
                onClick={() => setCardPackMode("single")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                  cardPackMode === "single"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                🖼️ Tek Kart
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={cardPackMode === "dual"}
                onClick={() => {
                  setCardPackMode("dual");
                  setActiveDualSlide(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1 ${
                  cardPackMode === "dual"
                    ? "bg-[#6741D9] text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                <Layers className="w-3 h-3 shrink-0" />
                <span>🃏 Soru → Cevap Çift Kart</span>
              </button>
            </div>

            {/* 1:1 / 9:16 / Esnek Kart Format Seçici */}
            <div
              role="tablist"
              aria-label="Sosyal Medya Kart Boyutu"
              className="inline-flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={aspectFormat === "square"}
                onClick={() => setAspectFormat("square")}
                title="Kare (1:1 — 1080×1080)"
                className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                  aspectFormat === "square"
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                🟦 Kare (1:1)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={aspectFormat === "story"}
                onClick={() => setAspectFormat("story")}
                title="Hikâye / Durum (9:16 — 1080×1920)"
                className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                  aspectFormat === "story"
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                📱 Hikâye (9:16)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={aspectFormat === "auto"}
                onClick={() => setAspectFormat("auto")}
                title="Esnek Kart (1080×Otomatik)"
                className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                  aspectFormat === "auto"
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                📄 Esnek
              </button>
            </div>
          </div>

          {/* Satır 2: Türkçe Anlam (Tek Kartta) & Hareke Seçici */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {cardPackMode === "single" ? (
                <button
                  type="button"
                  onClick={() => setShowTr((prev) => !prev)}
                  className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    showTr
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                  }`}
                >
                  {showTr ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                  <span>🇹🇷 Türkçe Anlam: {showTr ? "Açık" : "Kapalı (Quiz)"}</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveDualSlide(1)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      activeDualSlide === 1
                        ? "bg-[#6741D9] text-white"
                        : "text-indigo-900 dark:text-indigo-200"
                    }`}
                  >
                    1. Soru Kartı
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDualSlide(2)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      activeDualSlide === 2
                        ? "bg-emerald-600 text-white"
                        : "text-indigo-900 dark:text-indigo-200"
                    }`}
                  >
                    2. Cevap Kartı
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setLocalShowHareke((prev) => !prev)}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  localShowHareke
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>✨ Hareke: {localShowHareke ? "Açık" : "Kapalı"}</span>
              </button>
            </div>

            {cardPackMode === "single" && !showTr && (
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Sadece Arapça • Sıfır Türkçe ipucu
              </span>
            )}
          </div>
        </div>

        {/* Kaydırılabilir İçerik: Canlı Kart Önizlemesi + Aksiyonlar */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {/* Kanvas Kart Önizleme Alanı */}
          <div className="relative rounded-2xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-center min-h-[260px]">
            {isRendering && (
              <div className="absolute inset-0 z-10 bg-white/70 dark:bg-slate-950/70 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  HD Görsel Kart Hazırlanıyor…
                </span>
              </div>
            )}

            {activePreviewUrl ? (
              <img
                src={activePreviewUrl}
                alt="Muallimun Paylaşım Kartı Önizlemesi"
                className="max-h-[40dvh] sm:max-h-[42dvh] w-auto rounded-xl shadow-md object-contain select-none"
              />
            ) : (
              <div className="py-16 text-xs font-semibold text-slate-400">
                Kart oluşturuluyor…
              </div>
            )}
          </div>

          {/* Geri Bildirim Bandı */}
          {statusMessage && (
            <div
              className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold border ${
                statusMessage.tone === "emerald"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800"
              }`}
            >
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* 1. Ana Mobil / Web Share Butonu */}
          <button
            type="button"
            onClick={handleNativeShareWithImage}
            disabled={isRendering || !isActionReady}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>
              {cardPackMode === "dual"
                ? canShareFiles
                  ? "📲 Paylaş (Soru + Cevap İki Kart Birlikte)"
                  : "📲 Soru & Cevap Kartını Paylaş"
                : canShareFiles
                ? "📲 Görsel Kart + Link Paylaş (WhatsApp / Telegram)"
                : "📲 Görsel Kartı Hazırla & Paylaş"}
            </span>
          </button>

          {/* 2. WhatsApp & Telegram Doğrudan Paylaşım Butonları */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={whatsAppShareHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleSocialLinkClick("WhatsApp")}
              className="py-2.5 px-3 rounded-xl bg-[#25D366]/12 hover:bg-[#25D366]/20 dark:bg-[#25D366]/15 dark:hover:bg-[#25D366]/25 border border-[#25D366]/40 text-emerald-900 dark:text-emerald-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-[#1da851] shrink-0" />
              <span>WhatsApp&apos;ta Paylaş</span>
            </a>

            <a
              href={telegramShareHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleSocialLinkClick("Telegram")}
              className="py-2.5 px-3 rounded-xl bg-sky-500/12 hover:bg-sky-500/20 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 border border-sky-500/40 text-sky-900 dark:text-sky-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>Telegram&apos;da Paylaş</span>
            </a>
          </div>

          {/* 3. Görseli Kopyala & HD PNG İndir */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyImageButton}
              disabled={isRendering || !activeClipboardBlob}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4 shrink-0" />
              <span>
                {cardPackMode === "dual"
                  ? `${activeDualSlide}. Kartı Kopyala`
                  : "Görseli Kopyala"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isRendering || !isActionReady}
              className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 disabled:opacity-50 text-amber-900 dark:text-amber-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>
                {cardPackMode === "dual"
                  ? "📥 İkisini İndir"
                  : "Kartı İndir (HD PNG)"}
              </span>
            </button>
          </div>

          {/* Paylaşım Açıklama Metni + Doğrudan İçerik Bağlantısı Önizlemesi */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Paylaşım Mesajı &amp; Doğrudan Bağlantı
              </span>
              <button
                type="button"
                onClick={handleCopyCaptionText}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Metni Kopyala</span>
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {shareCaption}
            </pre>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ShareContentCardModal;
