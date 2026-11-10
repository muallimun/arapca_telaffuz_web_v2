"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
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

export type ShareContentType =
  | "visual_word"
  | "proverb"
  | "dialogue"
  | "reading"
  | "sentence";

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

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const words = cleaned.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
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

  // 1. Öncelik: fetch -> blob -> ObjectURL (Canvas taint / SecurityError riskini %100 sıfırlar)
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

  // 2. Yedek: crossOrigin = "anonymous"
  return new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = resolved;
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

  // Yumuşak zümrüt-altın radyal arka plan
  const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, boxSize * 0.48);
  if (type === "proverb") {
    grad.addColorStop(0, "#FFFBEB");
    grad.addColorStop(0.65, "#FEF3C7");
    grad.addColorStop(1, "#FDE68A");
  } else {
    grad.addColorStop(0, "#ECFDF5");
    grad.addColorStop(0.65, "#D1FAE5");
    grad.addColorStop(1, "#A7F3D0");
  }

  drawRoundRect(ctx, boxX + 14, boxY + 14, boxSize - 28, boxSize - 28, 24);
  ctx.fillStyle = grad;
  ctx.fill();

  // 8 köşeli İslami geometrik yıldız (Rub el Hizb motifi)
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

  // İç altın halka
  ctx.beginPath();
  ctx.arc(0, 0, boxSize * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#D97706";
  ctx.stroke();

  // Merkez kaligrafik harf/sembol
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = type === "proverb" ? "#92400E" : "#065F46";
  ctx.font = `700 68px ${arabicFontFamily}`;
  ctx.fillText(arabicGlyph, 0, 6);
  ctx.restore();
}

export function ShareContentCardModal({
  payload,
  onClose,
}: ShareContentCardModalProps) {
  if (!payload || typeof document === "undefined") return null;
  const modalKey = `${payload.type}:${payload.arabicText}:${String(
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
  const [isRendering, setIsRendering] = useState<boolean>(true);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [canShareFiles, setCanShareFiles] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "emerald" | "amber";
    text: string;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ESC ile kapatma
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

  const formattedPrimaryAr = useMemo(() => {
    if (!payload) return "";
    const base =
      payload.arabicText ||
      payload.titleAr ||
      payload.excerptLines?.[0]?.arapca ||
      "";
    return formatArabicText(base, localShowHareke, arabicFont);
  }, [payload, localShowHareke, arabicFont]);

  const shareCaption = useMemo(() => {
    if (!payload) return "";
    const meta = TYPE_META[payload.type];
    const arDisplay = formattedPrimaryAr;

    if (!showTr) {
      // KATI KURAL: Türkçe anlam kapalıyken açıklama metnine HİÇBİR Türkçe çeviri sızmaz!
      return `✨ ${arDisplay}\n\n🎧 Sesli dinlemek, anlamını görmek ve telaffuzunu test etmek için:\n${CANONICAL_APP_URL}`;
    }

    const trSummary = (
      payload.turkishText ||
      payload.titleTr ||
      payload.excerptLines?.[0]?.turkce ||
      ""
    ).trim();

    return `✨ ${meta.captionLabelTr}: ${arDisplay}\n🇹🇷 Anlamı: ${trSummary}\n\n🎧 Sesli dinlemek ve telaffuzunu test etmek için:\n${CANONICAL_APP_URL}`;
  }, [payload, showTr, formattedPrimaryAr]);

  const whatsAppShareHref = useMemo(() => {
    return `https://wa.me/?text=${encodeURIComponent(shareCaption)}`;
  }, [shareCaption]);

  const telegramShareHref = useMemo(() => {
    const captionWithoutTrailingUrl = shareCaption
      .replace(CANONICAL_APP_URL, "")
      .trim();
    return `https://t.me/share/url?url=${encodeURIComponent(
      CANONICAL_APP_URL
    )}&text=${encodeURIComponent(captionWithoutTrailingUrl)}`;
  }, [shareCaption]);

  // Yüksek çözünürlüklü (1080px+) Kanvas Kart Üretimi
  useEffect(() => {
    let cancelled = false;

    const renderCard = async () => {
      setIsRendering(true);
      try {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await document.fonts.ready;
        }

        const loadedImg = await loadCorsSafeImage(payload.imageUrl);
        if (cancelled) return;

        const canvas = canvasRef.current || document.createElement("canvas");
        canvasRef.current = canvas;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const W = 1080;
        const outerPad = 40;
        const contentMaxW = W - 180; // 900px güvenli metin genişliği
        const arabicFontCfg = getArabicFontConfig(arabicFont);
        const arabicCssFamily = arabicFontCfg.cssFamily;
        const turkishCssFamily =
          '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

        const hasExcerpts =
          Array.isArray(payload.excerptLines) && payload.excerptLines.length > 0;
        const excerptSlice = hasExcerpts
          ? payload.excerptLines!.slice(0, 3)
          : [];

        const titleArFormatted = payload.titleAr
          ? formatArabicText(payload.titleAr, localShowHareke, arabicFont)
          : "";
        const titleTrText = showTr && payload.titleTr ? payload.titleTr.trim() : "";

        const primaryArText = !hasExcerpts ? formattedPrimaryAr : "";
        const cleanSubAr = sanitizeSubInfoArForMode(payload.subInfoAr, showTr);
        const subArFormatted = cleanSubAr
          ? formatArabicText(cleanSubAr, localShowHareke, arabicFont)
          : "";

        const primaryTrText =
          showTr && !hasExcerpts ? (payload.turkishText || "").trim() : "";
        const subTrText =
          showTr && payload.subInfoTr ? payload.subInfoTr.trim() : "";

        // Dinamik Arapça punto hesabı (Kelime vs Atasözü/Cümle)
        const arWordCount = primaryArText
          .split(/\s+/)
          .filter(Boolean).length;
        const primaryArFontSize =
          payload.type === "visual_word" && arWordCount <= 3
            ? 84
            : primaryArText.length <= 42
            ? 60
            : primaryArText.length <= 90
            ? 52
            : 45;
        const primaryArLineH = Math.round(primaryArFontSize * 1.88);

        // --- 1. ÖN ÖLÇÜM (HİÇBİR METNİN KESİLMEMESİ İÇİN DİNAMİK YÜKSEKLİK) ---
        const imageBoxSize = hasExcerpts ? 340 : 380;
        let cursorY = outerPad + 120; // Üst rozet şeridi sonrası
        cursorY += imageBoxSize + 44; // 1:1 Görsel kutusu sonrası

        let wrappedTitleAr: string[] = [];
        let wrappedTitleTr: string[] = [];
        if (titleArFormatted) {
          ctx.font = `700 ${hasExcerpts ? 50 : 38}px ${arabicCssFamily}`;
          wrappedTitleAr = wrapCanvasText(ctx, titleArFormatted, contentMaxW);
          cursorY += wrappedTitleAr.length * (hasExcerpts ? 88 : 68) + 8;
        }
        if (titleTrText) {
          ctx.font = `700 ${hasExcerpts ? 30 : 25}px ${turkishCssFamily}`;
          wrappedTitleTr = wrapCanvasText(ctx, titleTrText, contentMaxW);
          cursorY += wrappedTitleTr.length * 40 + 22;
        } else if (titleArFormatted) {
          cursorY += 16;
        }

        // Diyalog / Metin özet satırları ölçümü
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
            ctx.font = `700 40px ${arabicCssFamily}`;
            const arLines = wrapCanvasText(ctx, lineAr, contentMaxW - 64);

            let trLines: string[] = [];
            if (showTr && ex.turkce) {
              const speakerPrefixTr = ex.speakerTr ? `${ex.speakerTr}: ` : "";
              ctx.font = `600 25px ${turkishCssFamily}`;
              trLines = wrapCanvasText(
                ctx,
                `${speakerPrefixTr}${ex.turkce}`,
                contentMaxW - 64
              );
            }

            const boxH =
              36 +
              arLines.length * 74 +
              (trLines.length > 0 ? 12 + trLines.length * 36 : 0);
            measuredExcerpts.push({ arLines, trLines, boxH });
            cursorY += boxH + 18;
          }
          cursorY += 18;
        }

        // Ana Arapça kelime/cümle ölçümü
        let wrappedPrimaryAr: string[] = [];
        if (primaryArText) {
          ctx.font = `700 ${primaryArFontSize}px ${arabicCssFamily}`;
          wrappedPrimaryAr = wrapCanvasText(ctx, primaryArText, contentMaxW - 40);
          cursorY += wrappedPrimaryAr.length * primaryArLineH + 20;
        }

        // Alt Arapça bilgi (kök, müfret-cemî, örnek cümle)
        let wrappedSubAr: string[] = [];
        if (subArFormatted) {
          ctx.font = `600 35px ${arabicCssFamily}`;
          wrappedSubAr = wrapCanvasText(ctx, subArFormatted, contentMaxW - 72);
          cursorY += wrappedSubAr.length * 66 + 34;
        }

        // Ayırıcı süsleme
        cursorY += 44;

        // Türkçe anlam VEYA Arapça quiz rozeti ölçümü
        let wrappedPrimaryTr: string[] = [];
        let wrappedSubTr: string[] = [];
        if (showTr) {
          if (primaryTrText) {
            const trFontSize = primaryTrText.length <= 70 ? 37 : 32;
            ctx.font = `700 ${trFontSize}px ${turkishCssFamily}`;
            wrappedPrimaryTr = wrapCanvasText(
              ctx,
              primaryTrText,
              contentMaxW - 64
            );
            cursorY += wrappedPrimaryTr.length * Math.round(trFontSize * 1.48) + 20;
          }
          if (subTrText) {
            ctx.font = `500 25px ${turkishCssFamily}`;
            wrappedSubTr = wrapCanvasText(ctx, subTrText, contentMaxW - 72);
            cursorY += wrappedSubTr.length * 38 + 20;
          }
          if (
            (payload.type === "dialogue" || payload.type === "reading") &&
            hasExcerpts
          ) {
            cursorY += 66; // "Tamamını sesli dinlemek için..." notu
          }
          cursorY += 32;
        } else {
          // Türkçe kapalıyken Arapça soru rozeti ("مَا مَعْنَاهُ؟ 🤔")
          cursorY += 104;
        }

        const footerH = 112;
        const totalH = Math.max(1220, cursorY + footerH + outerPad + 24);

        canvas.width = W;
        canvas.height = totalH;

        // --- 2. ARKA PLAN & ÇİFT KATMANLI ALTIN ÇERÇEVE ---
        const bgGrad = ctx.createLinearGradient(0, 0, W, totalH);
        bgGrad.addColorStop(0, "#FDFBF7");
        bgGrad.addColorStop(0.5, "#FAF6EE");
        bgGrad.addColorStop(1, "#F3ECE0");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, totalH);

        // Hafif üst radyal aydınlatma
        const glowGrad = ctx.createRadialGradient(
          W / 2,
          260,
          30,
          W / 2,
          260,
          520
        );
        glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
        glowGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, W, 720);

        // Dış altın çerçeve
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

        // İç ince çerçeve
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

        // Köşe arabesk motifleri
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

        // --- 3. ÜST BİLGİ ŞERİDİ (TÜR ROZETİ + SEVİYE ROZETİ) ---
        const meta = TYPE_META[payload.type];
        const headerY = outerPad + 36;
        const badgeText = showTr
          ? meta.badgeTr
          : formatArabicText(meta.badgeAr, localShowHareke, arabicFont);

        ctx.save();
        ctx.font = showTr
          ? `800 24px ${turkishCssFamily}`
          : `700 28px ${arabicCssFamily}`;
        const badgeTextW = ctx.measureText(badgeText).width;
        const badgeW = Math.min(560, badgeTextW + 52);
        const badgeX = outerPad + 36;

        drawRoundRect(ctx, badgeX, headerY, badgeW, 56, 18);
        ctx.fillStyle = payload.type === "proverb" ? "#FEF3C7" : "#ECFDF5";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = payload.type === "proverb" ? "#F59E0B" : "#A7F3D0";
        ctx.stroke();

        ctx.fillStyle = meta.accentHex;
        ctx.direction = showTr ? "ltr" : "rtl";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(badgeText, badgeX + badgeW / 2, headerY + 29);
        ctx.restore();

        // Sağ üst CEFR Seviye (+ Türkçe açıksa kategori) rozeti
        const rightBadgesXEnd = W - outerPad - 36;
        let currentRightX = rightBadgesXEnd;

        if (payload.level) {
          const lvlLabel = payload.level.toUpperCase();
          ctx.save();
          ctx.font = `900 24px ${turkishCssFamily}`;
          const lvlW = Math.max(88, ctx.measureText(lvlLabel).width + 44);
          currentRightX -= lvlW;

          drawRoundRect(ctx, currentRightX, headerY, lvlW, 56, 18);
          ctx.fillStyle = "#065F46";
          ctx.fill();

          ctx.fillStyle = "#FFFFFF";
          ctx.direction = "ltr";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(lvlLabel, currentRightX + lvlW / 2, headerY + 29);
          ctx.restore();
          currentRightX -= 14;
        }

        if (showTr && payload.category) {
          const catTrimmed =
            payload.category.length > 24
              ? `${payload.category.slice(0, 22)}…`
              : payload.category;
          ctx.save();
          ctx.font = `700 21px ${turkishCssFamily}`;
          const catW = ctx.measureText(catTrimmed).width + 40;
          if (currentRightX - catW > badgeX + badgeW + 16) {
            currentRightX -= catW;
            drawRoundRect(ctx, currentRightX, headerY, catW, 56, 18);
            ctx.fillStyle = "#FFFFFF";
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#E2E8F0";
            ctx.stroke();

            ctx.fillStyle = "#475569";
            ctx.direction = "ltr";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(catTrimmed, currentRightX + catW / 2, headerY + 29);
          }
          ctx.restore();
        }

        // --- 4. MERKEZ 1:1 GÖRSEL ÇERÇEVESİ (KIRPILMADAN OBJECT-CONTAIN) ---
        let drawY = outerPad + 118;
        const imgBoxX = (W - imageBoxSize) / 2;

        ctx.save();
        ctx.shadowColor = "rgba(15, 23, 42, 0.10)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 10;
        drawRoundRect(ctx, imgBoxX, drawY, imageBoxSize, imageBoxSize, 32);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.restore();

        drawRoundRect(ctx, imgBoxX, drawY, imageBoxSize, imageBoxSize, 32);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#E6D7BE";
        ctx.stroke();

        if (loadedImg && loadedImg.naturalWidth > 0 && loadedImg.naturalHeight > 0) {
          const innerPad = 14;
          const availW = imageBoxSize - innerPad * 2;
          const availH = imageBoxSize - innerPad * 2;
          const scale = Math.min(
            availW / loadedImg.naturalWidth,
            availH / loadedImg.naturalHeight
          );
          const renderW = loadedImg.naturalWidth * scale;
          const renderH = loadedImg.naturalHeight * scale;
          const renderX = imgBoxX + (imageBoxSize - renderW) / 2;
          const renderY = drawY + (imageBoxSize - renderH) / 2;

          ctx.save();
          drawRoundRect(
            ctx,
            imgBoxX + innerPad,
            drawY + innerPad,
            availW,
            availH,
            22
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
            imageBoxSize,
            payload.type,
            formatArabicText(glyph, localShowHareke, arabicFont),
            arabicCssFamily
          );
        }

        drawY += imageBoxSize + 44;

        // --- 5. OPSİYONEL BAŞLIKLAR (DİYALOG / METİN / CÜMLE KAYNAĞI) ---
        if (wrappedTitleAr.length > 0) {
          ctx.save();
          ctx.direction = "rtl";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = hasExcerpts ? "#064E3B" : "#047857";
          const tArSize = hasExcerpts ? 50 : 38;
          const tArStep = hasExcerpts ? 88 : 68;
          ctx.font = `700 ${tArSize}px ${arabicCssFamily}`;
          for (const line of wrappedTitleAr) {
            ctx.fillText(line, W / 2, drawY);
            drawY += tArStep;
          }
          ctx.restore();
          drawY += 6;
        }

        if (wrappedTitleTr.length > 0) {
          ctx.save();
          ctx.direction = "ltr";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#475569";
          ctx.font = `700 ${hasExcerpts ? 30 : 25}px ${turkishCssFamily}`;
          for (const line of wrappedTitleTr) {
            ctx.fillText(line, W / 2, drawY);
            drawY += 40;
          }
          ctx.restore();
          drawY += 20;
        } else if (wrappedTitleAr.length > 0) {
          drawY += 14;
        }

        // --- 6. ANA ARAPÇA İÇERİK VEYA DİYALOG/METİN KESİTİ ---
        if (hasExcerpts) {
          const boxX = (W - contentMaxW) / 2;
          for (const item of measuredExcerpts) {
            drawRoundRect(ctx, boxX, drawY, contentMaxW, item.boxH, 24);
            ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#E2E8F0";
            ctx.stroke();

            let innerY = drawY + 18;
            ctx.save();
            ctx.direction = "rtl";
            ctx.textAlign = "right";
            ctx.textBaseline = "top";
            ctx.fillStyle = "#064E3B";
            ctx.font = `700 40px ${arabicCssFamily}`;
            for (const arL of item.arLines) {
              ctx.fillText(arL, boxX + contentMaxW - 32, innerY);
              innerY += 74;
            }
            ctx.restore();

            if (item.trLines.length > 0) {
              innerY += 8;
              ctx.save();
              ctx.direction = "ltr";
              ctx.textAlign = "left";
              ctx.textBaseline = "top";
              ctx.fillStyle = "#334155";
              ctx.font = `600 25px ${turkishCssFamily}`;
              for (const trL of item.trLines) {
                ctx.fillText(trL, boxX + 32, innerY);
                innerY += 36;
              }
              ctx.restore();
            }

            drawY += item.boxH + 18;
          }
          drawY += 10;
        } else if (wrappedPrimaryAr.length > 0) {
          ctx.save();
          ctx.direction = "rtl";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#064E3B";
          ctx.font = `700 ${primaryArFontSize}px ${arabicCssFamily}`;
          for (const line of wrappedPrimaryAr) {
            ctx.fillText(line, W / 2, drawY);
            drawY += primaryArLineH;
          }
          ctx.restore();
          drawY += 16;
        }

        // Alt Arapça ek bilgi (Kök / Müfret-Cemî / Örnek Cümle)
        if (wrappedSubAr.length > 0) {
          const subBoxW = contentMaxW - 24;
          const subBoxH = wrappedSubAr.length * 66 + 24;
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
          ctx.font = `600 35px ${arabicCssFamily}`;
          let subY = drawY + 12;
          for (const line of wrappedSubAr) {
            ctx.fillText(line, W / 2, subY);
            subY += 66;
          }
          ctx.restore();

          drawY += subBoxH + 20;
        }

        // --- 7. ZARİF ALTIN AYIRICI ÇİZGİ (─── ◆ ───) ---
        const divY = drawY + 14;
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
        ctx.fillRect(-7, -7, 14, 14);
        ctx.restore();

        drawY += 42;

        // --- 8. KOŞULLU TÜRKÇE ANLAM PANELİ VEYA ARAPÇA SORU ROZETİ ---
        if (showTr) {
          if (wrappedPrimaryTr.length > 0) {
            const trFontSize = primaryTrText.length <= 70 ? 37 : 32;
            const trStep = Math.round(trFontSize * 1.48);
            ctx.save();
            ctx.direction = "ltr";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = "#1E293B";
            ctx.font = `700 ${trFontSize}px ${turkishCssFamily}`;
            for (const line of wrappedPrimaryTr) {
              ctx.fillText(line, W / 2, drawY);
              drawY += trStep;
            }
            ctx.restore();
            drawY += 14;
          }

          if (wrappedSubTr.length > 0) {
            ctx.save();
            ctx.direction = "ltr";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = "#475569";
            ctx.font = `500 25px ${turkishCssFamily}`;
            for (const line of wrappedSubTr) {
              ctx.fillText(line, W / 2, drawY);
              drawY += 38;
            }
            ctx.restore();
            drawY += 14;
          }

          if (
            (payload.type === "dialogue" || payload.type === "reading") &&
            hasExcerpts
          ) {
            const calloutText =
              "🎧 Tamamını sesli dinlemek için: app.muallimun.net";
            ctx.save();
            ctx.font = `700 23px ${turkishCssFamily}`;
            const calloutW = Math.min(
              contentMaxW,
              ctx.measureText(calloutText).width + 56
            );
            const calloutX = (W - calloutW) / 2;
            drawRoundRect(ctx, calloutX, drawY + 4, calloutW, 50, 16);
            ctx.fillStyle = "#FEF3C7";
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#F59E0B";
            ctx.stroke();

            ctx.direction = "ltr";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#92400E";
            ctx.fillText(calloutText, W / 2, drawY + 29);
            ctx.restore();
          }
        } else {
          // SADECE ARAPÇA (QUIZ / MERAK UYANDIRICI PAYLAŞIM MODU) — Sıfır Türkçe!
          const quizAr = formatArabicText(
            "مَا مَعْنَاهُ؟ 🤔",
            localShowHareke,
            arabicFont
          );
          const pillW = 390;
          const pillH = 74;
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
          ctx.font = `700 40px ${arabicCssFamily}`;
          ctx.fillText(quizAr, W / 2, drawY + 42);
          ctx.restore();
        }

        // --- 9. ALT KURUMSAL MARKA BANDI (app.muallimun.net) ---
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

        // Sol marka yazısı
        ctx.direction = "ltr";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `900 30px ${turkishCssFamily}`;
        ctx.fillText("Muallimun", footerX + 36, footerY + 22);

        if (showTr) {
          ctx.fillStyle = "#A7F3D0";
          ctx.font = `600 20px ${turkishCssFamily}`;
          ctx.fillText(
            "Arapça Telaffuz & Diyalog Platformu",
            footerX + 36,
            footerY + 62
          );
        } else {
          ctx.direction = "rtl";
          ctx.textAlign = "left";
          ctx.fillStyle = "#A7F3D0";
          ctx.font = `600 24px ${arabicCssFamily}`;
          ctx.fillText(
            formatArabicText(
              "مِنَصَّةُ النُّطْقِ وَالحِوَارِ العَرَبِيِّ",
              localShowHareke,
              arabicFont
            ),
            footerX + 36,
            footerY + 58
          );
        }

        // Sağ altın URL rozeti: 🌐 app.muallimun.net
        const urlBadgeW = 344;
        const urlBadgeH = 58;
        const urlBadgeX = footerX + footerW - urlBadgeW - 32;
        const urlBadgeY = footerY + (footerH - urlBadgeH) / 2;

        drawRoundRect(ctx, urlBadgeX, urlBadgeY, urlBadgeW, urlBadgeH, 18);
        ctx.fillStyle = "#FEF3C7";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#F59E0B";
        ctx.stroke();

        ctx.direction = "ltr";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#78350F";
        ctx.font = `800 23px ${turkishCssFamily}`;
        ctx.fillText(
          "🌐 app.muallimun.net",
          urlBadgeX + urlBadgeW / 2,
          urlBadgeY + urlBadgeH / 2 + 1
        );
        ctx.restore();

        // PNG çıktı üretimi
        const dataUrl = canvas.toDataURL("image/png");
        if (cancelled) return;
        setPreviewDataUrl(dataUrl);

        canvas.toBlob((blob) => {
          if (cancelled || !blob) return;
          setPngBlob(blob);
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
        }, "image/png");
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

    renderCard();
    return () => {
      cancelled = true;
    };
  }, [payload, showTr, localShowHareke, arabicFont, formattedPrimaryAr]);

  const copyCardBlobToClipboard = useCallback(async (): Promise<boolean> => {
    if (!pngBlob) return false;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.write &&
        typeof ClipboardItem !== "undefined"
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }, [pngBlob]);

  const handleNativeShareWithImage = async () => {
    if (!payload) return;
    if (pngBlob) {
      try {
        const fileName = `muallimun-${payload.type}-kart.png`;
        const file = new File([pngBlob], fileName, { type: "image/png" });
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
            text: "Görsel kart ve tıklanabilir bağlantı başarıyla paylaşıldı!",
          });
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    // Masaüstü yedek akışı: Görseli panoya kopyala ve kullanıcıyı bilgilendir
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
          url: CANONICAL_APP_URL,
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
        text: `${platform} paylaşım ekranı açıldı. Görseli de eklemek için "Kartı İndir" butonunu kullanabilirsiniz.`,
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
        text: "Tarayıcınız doğrudan görsel kopyalamayı desteklemiyor. 'Kartı İndir' butonunu kullanabilirsiniz.",
      });
    }
  };

  const handleCopyCaptionText = async () => {
    try {
      await navigator.clipboard.writeText(shareCaption);
      setStatusMessage({
        tone: "emerald",
        text: "Paylaşım metni ve app.muallimun.net bağlantısı kopyalandı!",
      });
    } catch {
      setStatusMessage({
        tone: "amber",
        text: "Metin kopyalanamadı.",
      });
    }
  };

  const handleDownloadPng = () => {
    if (!previewDataUrl || !payload) return;
    const link = document.createElement("a");
    link.href = previewDataUrl;
    link.download = `muallimun-${payload.type}-kart.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage({
      tone: "emerald",
      text: "Yüksek çözünürlüklü PNG kart cihazınıza indirildi.",
    });
  };

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
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-50/90 via-white to-amber-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Görsel Kart Olarak Paylaş
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                WhatsApp, Telegram ve sosyal medya için HD kart
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shrink-0"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hızlı Mod Seçicileri: Türkçe Anlam & Hareke Senkronizasyonu */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowTr((prev) => !prev)}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                showTr
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
              }`}
              title="Kart üzerindeki ve mesajdaki Türkçe çeviriyi aç/kapat"
            >
              {showTr ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              <span>🇹🇷 Türkçe Anlam: {showTr ? "Açık" : "Kapalı (Quiz)"}</span>
            </button>

            <button
              type="button"
              onClick={() => setLocalShowHareke((prev) => !prev)}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                localShowHareke
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
              }`}
              title="Arapça harekeleri aç/kapat"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ Hareke: {localShowHareke ? "Açık" : "Kapalı"}</span>
            </button>
          </div>

          {!showTr && (
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              Sadece Arapça • Sıfır Türkçe ipucu
            </span>
          )}
        </div>

        {/* Kaydırılabilir İçerik: Canlı Kart Önizlemesi + Aksiyonlar */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {/* Kanvas Kart Önizleme Alanı */}
          <div className="relative rounded-2xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-center min-h-[280px]">
            {isRendering && (
              <div className="absolute inset-0 z-10 bg-white/70 dark:bg-slate-950/70 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  HD Görsel Kart Hazırlanıyor…
                </span>
              </div>
            )}

            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="Muallimun Paylaşım Kartı Önizlemesi"
                className="max-h-[42dvh] sm:max-h-[44dvh] w-auto rounded-xl shadow-md object-contain select-none"
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

          {/* 1. Ana Mobil / Web Share Butonu (Görsel Dosyası + Tıklanabilir Link Tek Seferde) */}
          <button
            type="button"
            onClick={handleNativeShareWithImage}
            disabled={isRendering || !pngBlob}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <Share2 className="w-4 h-4" />
            <span>
              {canShareFiles
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
              disabled={isRendering || !pngBlob}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Copy className="w-4 h-4 shrink-0" />
              <span>Görseli Kopyala</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isRendering || !previewDataUrl}
              className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 disabled:opacity-50 text-amber-900 dark:text-amber-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Kartı İndir (HD PNG)</span>
            </button>
          </div>

          {/* Paylaşım Açıklama Metni + Tıklanabilir Bağlantı Önizlemesi */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Paylaşım Mesajı &amp; Tıklanabilir Bağlantı
              </span>
              <button
                type="button"
                onClick={handleCopyCaptionText}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
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
