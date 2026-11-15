"use client";

import { usePathname } from "next/navigation";
import VisitorCounterBadge from "@/components/ui/VisitorCounterBadge";
import { FooterFeedbackButton } from "@/components/ui/FeedbackModal";
import { FooterShareButton } from "@/components/ui/ShareAppModal";

interface ConditionalFooterProps {
  appSubtitle: string;
}

export default function ConditionalFooter({
  appSubtitle,
}: ConditionalFooterProps) {
  const pathname = usePathname();
  const cleanPath =
    pathname && pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname || "/";

  // Masaüstünde (lg:block) tüm sayfalarda korunur;
  // Mobilde (< 1024px) yalnızca Ana Sayfa ('/') ve Ayarlar ('/ayarlar') sayfalarında gösterilir.
  const showFooterOnMobile = cleanPath === "/" || cleanPath === "/ayarlar";

  return (
    <footer
      className={`${
        showFooterOnMobile ? "block" : "hidden lg:block"
      } print:hidden border-t-2 border-[#E6D7BE] dark:border-[var(--border)] bg-[#F7EFE1] dark:bg-[var(--surface)] mt-6 lg:mt-10 pb-20 lg:pb-0 max-w-7xl w-full mx-auto rounded-t-2xl`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex flex-col lg:flex-row items-center justify-between gap-2.5 lg:whitespace-nowrap">
        {/* Sol Grup: Logo + Telif + Ziyaretçi Sayacı Kapsülü */}
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center p-0.5 shrink-0">
            <img
              src="/icons/android-chrome-192x192.png"
              alt="Logo"
              className="w-6 h-6 object-contain rounded-md"
            />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-extrabold text-xs text-[var(--foreground)] whitespace-nowrap shrink-0">
              © 2026 Muallimun Arapça
            </span>
            <span
              aria-hidden="true"
              className="hidden xl:inline text-[var(--muted)]"
            >
              ·
            </span>
            <span className="hidden xl:inline font-semibold text-xs text-[var(--muted)] truncate">
              {appSubtitle}
            </span>
          </div>
          <VisitorCounterBadge variant="footer" />
        </div>

        {/* Sağ Grup: Sosyal Bağlantılar + Görüş/Hata Bildir + İkonik Paylaş */}
        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-1.5 shrink-0">
          <a
            href="https://t.me/muallimun"
            target="_blank"
            rel="noopener noreferrer"
            data-tooltip="Muallimun Resmi Telegram Kanalı"
            data-tooltip-pos="top"
            aria-label="Muallimun Resmi Telegram Kanalı"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full bg-white dark:bg-slate-800 border border-stone-200/80 dark:border-slate-700 font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:border-sky-300 transition-all shadow-xs"
          >
            <svg
              className="w-3.5 h-3.5 fill-current shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            <span>Telegram</span>
          </a>

          <a
            href="https://whatsapp.com/channel/0029VaAif947oQhgdaDMjK1Q"
            target="_blank"
            rel="noopener noreferrer"
            data-tooltip="Muallimun WhatsApp Duyuru Kanalı"
            data-tooltip-pos="top"
            aria-label="Muallimun WhatsApp Duyuru Kanalı"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full bg-white dark:bg-slate-800 border border-stone-200/80 dark:border-slate-700 font-semibold text-[#065F46] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 transition-all shadow-xs"
          >
            <svg
              className="w-3.5 h-3.5 fill-current shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.127.558 4.198 1.613 6.008L0 24l6.135-1.608A11.943 11.943 0 0 0 12.031 24c6.627 0 12-5.373 12-12s-5.373-12-12-12z" />
            </svg>
            <span>WhatsApp</span>
          </a>

          <a
            href="https://www.youtube.com/@MuallimunNet"
            target="_blank"
            rel="noopener noreferrer"
            data-tooltip="Muallimun YouTube Eğitim Kanalı"
            data-tooltip-pos="top"
            aria-label="Muallimun YouTube Eğitim Kanalı"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full bg-white dark:bg-slate-800 border border-stone-200/80 dark:border-slate-700 font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-300 transition-all shadow-xs"
          >
            <svg
              className="w-3.5 h-3.5 fill-current shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span>YouTube</span>
          </a>

          <a
            href="https://muallimun.net"
            target="_blank"
            rel="noopener noreferrer"
            data-tooltip="Muallimun Ana Eğitim Portalı"
            data-tooltip-pos="top"
            aria-label="Muallimun Ana Eğitim Portalı"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#065F46] dark:text-emerald-400 hover:text-[#065F46] transition-colors bg-white dark:bg-[var(--background)] rounded-full border border-[#E6D7BE] dark:border-[var(--border)] shadow-xs"
          >
            <span>muallimun.net</span>
          </a>

          <FooterFeedbackButton />

          <FooterShareButton />
        </div>
      </div>
    </footer>
  );
}
