"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, X } from "lucide-react";

const IN_APP_BROWSER_REGEX = /WhatsApp|Instagram|FBAN|FBAV|Line\/|Telegram/i;

export function isInAppWebViewUserAgent(ua?: string): boolean {
  const target =
    ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return IN_APP_BROWSER_REGEX.test(target);
}

export default function InAppBrowserBanner() {
  const [browserState] = useState<{
    isWebView: boolean;
    isAndroid: boolean;
  }>(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return { isWebView: false, isAndroid: false };
    }
    const ua = navigator.userAgent || "";
    return {
      isWebView: IN_APP_BROWSER_REGEX.test(ua),
      isAndroid: /Android/i.test(ua),
    };
  });

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return (
        window.sessionStorage.getItem("muallimun_webview_banner_dismissed") ===
        "1"
      );
    } catch {
      return false;
    }
  });
  const [copied, setCopied] = useState(false);

  if (!browserState.isWebView || dismissed) {
    return null;
  }

  const currentHref =
    typeof window !== "undefined"
      ? window.location.href
      : "https://app.muallimun.net/";

  const androidIntentHref = (() => {
    try {
      const urlObj = new URL(currentHref);
      const scheme = urlObj.protocol.replace(":", "") || "https";
      const withoutProtocol = currentHref.replace(/^https?:\/\//i, "");
      return `intent://${withoutProtocol}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
        currentHref
      )};end`;
    } catch {
      return currentHref;
    }
  })();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentHref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem("muallimun_webview_banner_dismissed", "1");
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="region"
      aria-label="Tarayıcı Uyumluluk Bilgilendirmesi"
      className="print:hidden w-full bg-amber-50 dark:bg-amber-950/90 border-b-2 border-amber-400 dark:border-amber-700 px-3 py-2.5 text-amber-950 dark:text-amber-100 shadow-xs"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs font-extrabold leading-snug">
          🎙️ Mikrofon ve sesli telaffuzun sorunsuz çalışması için sağ üstteki (⋮)
          menüden &apos;Chrome / Safari tarayıcısında aç&apos; seçeneğini kullanın.
        </p>

        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-600 text-[11px] font-extrabold text-amber-950 dark:text-amber-100 hover:bg-amber-100/70 inline-flex items-center gap-1 cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-600" />
                <span>Bağlantı Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>📋 Bağlantıyı Kopyala</span>
              </>
            )}
          </button>

          {browserState.isAndroid && (
            <a
              href={androidIntentHref}
              className="px-2.5 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-[11px] font-extrabold inline-flex items-center gap-1"
            >
              <ExternalLink size={13} />
              <span>Chrome&apos;da Aç</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Uyarıyı kapat"
            className="w-7 h-7 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-900 dark:text-amber-200 hover:bg-white cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
