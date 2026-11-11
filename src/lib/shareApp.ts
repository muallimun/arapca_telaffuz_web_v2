import { CONTENT_INVENTORY } from "@/lib/data";

export const SHARE_APP_TITLE =
  "Muallimun Arapça — İnteraktif Arapça Kütüphane, Sözlük, Oyun ve Sınav Platformu";

export const SHARE_APP_TEXT = `🎙️ Muallimun Arapça (İnteraktif Arapça Kütüphane, Sözlük, Oyun ve Sınav Platformu): ${CONTENT_INVENTORY.dialoguesCount} günlük konuşma diyaloğu, ${CONTENT_INVENTORY.readingsCount} okuma metni, 180 soruluk Seviye Tespit & Konu Tarama Sınavı, ${CONTENT_INVENTORY.sentencesCount} kalıp cümle, ${CONTENT_INVENTORY.visualWordsCount} görsel kelime ve ${CONTENT_INVENTORY.exerciseModulesCount} modüllü alıştırma merkeziyle ücretsiz Arapça çalışın!`;

export const SHARE_APP_URL = "https://app.muallimun.net/";

export function getWhatsAppShareUrl(): string {
  return `https://wa.me/?text=${encodeURIComponent(
    SHARE_APP_TEXT + "\n\n👉 " + SHARE_APP_URL
  )}`;
}

export function getTelegramShareUrl(): string {
  return `https://t.me/share/url?url=${encodeURIComponent(
    SHARE_APP_URL
  )}&text=${encodeURIComponent(SHARE_APP_TEXT)}`;
}

export function getClipboardShareText(): string {
  return `${SHARE_APP_TEXT}\n👉 ${SHARE_APP_URL}`;
}

export async function copyAppShareToClipboard(): Promise<boolean> {
  const fullText = getClipboardShareText();
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(fullText);
      return true;
    }
  } catch {
    // Fallback below
  }

  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = fullText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function canUseNativeWebShare(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.share === "function"
  );
}

export async function triggerNativeAppShare(): Promise<boolean> {
  if (!canUseNativeWebShare()) return false;
  try {
    await navigator.share({
      title: SHARE_APP_TITLE,
      text: SHARE_APP_TEXT,
      url: SHARE_APP_URL,
    });
    return true;
  } catch {
    return false;
  }
}

export function triggerShareAppModal(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-share-app-modal"));
  }
}
