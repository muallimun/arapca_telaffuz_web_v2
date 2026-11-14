import { gorselKelimeler } from "@/lib/data";
import { removeArabicHarakat } from "@/lib/arabicTextUtils";

export const VISUAL_IMAGE_BY_ID = new Map<string, string>();
export const VISUAL_IMAGE_BY_ARABIC = new Map<string, string>();
export const VISUAL_IMAGE_BY_BARE_ARABIC = new Map<string, string>();
export const VISUAL_IMAGE_BY_EXAMPLE_AR = new Map<string, string>();

function normalizeBareLookupKey(raw?: string): string {
  if (!raw) return "";
  return removeArabicHarakat(raw)
    .replace(/\u0640/g, "")
    .replace(/[.,!?؟،؛:"'«»()[\]…]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripIdPrefix(rawId?: string): string {
  if (!rawId) return "";
  return rawId
    .trim()
    .replace(/^(?:word_|w-|w_|sent_pool_visual_|s-pool_visual-|fill_pool_visual_)/, "");
}

for (const gk of gorselKelimeler) {
  const gorsel = (gk.gorsel || "").trim();
  if (!gorsel) continue;

  if (gk.id) {
    VISUAL_IMAGE_BY_ID.set(gk.id, gorsel);
  }

  const arRaw = (gk.arapca || gk.kelime_ar || "").trim();
  if (arRaw) {
    if (!VISUAL_IMAGE_BY_ARABIC.has(arRaw)) {
      VISUAL_IMAGE_BY_ARABIC.set(arRaw, gorsel);
    }
    const primaryVariant = arRaw.split("/")[0]?.trim() || "";
    if (primaryVariant && !VISUAL_IMAGE_BY_ARABIC.has(primaryVariant)) {
      VISUAL_IMAGE_BY_ARABIC.set(primaryVariant, gorsel);
    }
    const bareKey = normalizeBareLookupKey(primaryVariant || arRaw);
    if (bareKey && !VISUAL_IMAGE_BY_BARE_ARABIC.has(bareKey)) {
      VISUAL_IMAGE_BY_BARE_ARABIC.set(bareKey, gorsel);
    }
    if (bareKey.startsWith("ال") && bareKey.length > 3) {
      const noAl = bareKey.slice(2);
      if (!VISUAL_IMAGE_BY_BARE_ARABIC.has(noAl)) {
        VISUAL_IMAGE_BY_BARE_ARABIC.set(noAl, gorsel);
      }
    }
  }

  const exRaw = (gk.ornek_ar || "").trim();
  if (exRaw) {
    if (!VISUAL_IMAGE_BY_EXAMPLE_AR.has(exRaw)) {
      VISUAL_IMAGE_BY_EXAMPLE_AR.set(exRaw, gorsel);
    }
    const bareEx = normalizeBareLookupKey(exRaw);
    if (bareEx && !VISUAL_IMAGE_BY_EXAMPLE_AR.has(bareEx)) {
      VISUAL_IMAGE_BY_EXAMPLE_AR.set(bareEx, gorsel);
    }
  }
}

export function lookupVisualWordGorsel(params: {
  id?: string;
  directGorsel?: string;
  arabic?: string;
  exampleAr?: string;
  allowBareMatch?: boolean;
}): string | undefined {
  const direct = (params.directGorsel || "").trim();
  if (direct) return direct;

  if (params.id) {
    const rawId = params.id.trim();
    const byExactId = VISUAL_IMAGE_BY_ID.get(rawId);
    if (byExactId) return byExactId;
    const strippedId = stripIdPrefix(rawId);
    if (strippedId) {
      const byStripped = VISUAL_IMAGE_BY_ID.get(strippedId);
      if (byStripped) return byStripped;
    }
  }

  if (params.exampleAr) {
    const exTrim = params.exampleAr.trim();
    const byEx = VISUAL_IMAGE_BY_EXAMPLE_AR.get(exTrim);
    if (byEx) return byEx;
    const bareEx = normalizeBareLookupKey(exTrim);
    if (bareEx) {
      const byBareEx = VISUAL_IMAGE_BY_EXAMPLE_AR.get(bareEx);
      if (byBareEx) return byBareEx;
    }
  }

  if (params.arabic) {
    const arTrim = params.arabic.trim();
    const firstPart = arTrim.split("/")[0]?.trim() || arTrim;
    const byExactAr =
      VISUAL_IMAGE_BY_ARABIC.get(arTrim) ||
      VISUAL_IMAGE_BY_ARABIC.get(firstPart);
    if (byExactAr) return byExactAr;

    if (params.allowBareMatch !== false) {
      const bareKey = normalizeBareLookupKey(firstPart);
      if (bareKey) {
        const byBare = VISUAL_IMAGE_BY_BARE_ARABIC.get(bareKey);
        if (byBare) return byBare;
        if (bareKey.startsWith("ال") && bareKey.length > 3) {
          const byNoAl = VISUAL_IMAGE_BY_BARE_ARABIC.get(bareKey.slice(2));
          if (byNoAl) return byNoAl;
        }
      }
    }
  }

  return undefined;
}
