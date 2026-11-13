"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Gamepad2, Compass, BookA } from "lucide-react";
import { playClick } from "@/lib/sfxManager";

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isTextEntryElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") {
    return !(el as HTMLTextAreaElement).readOnly;
  }
  if (tag === "INPUT") {
    const input = el as HTMLInputElement;
    const type = (input.type || "text").toLowerCase();
    if (NON_TEXT_INPUT_TYPES.has(type)) return false;
    if (input.readOnly || input.inputMode === "none") return false;
    return true;
  }
  return (el as HTMLElement).isContentEditable === true;
}

export default function MobileNav() {
  const pathname = usePathname();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    let blurTimer: ReturnType<typeof setTimeout> | null = null;

    const handleFocusIn = (e: FocusEvent) => {
      if (typeof window !== "undefined" && window.innerWidth >= 768) return;
      if (isTextEntryElement(e.target as Element | null)) {
        if (blurTimer) {
          clearTimeout(blurTimer);
          blurTimer = null;
        }
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        const active =
          typeof document !== "undefined" ? document.activeElement : null;
        if (!isTextEntryElement(active)) {
          setIsKeyboardOpen(false);
        }
      }, 120);
    };

    const handleViewportResize = () => {
      if (typeof window === "undefined" || !window.visualViewport) return;
      if (window.innerWidth >= 768) {
        setIsKeyboardOpen(false);
        return;
      }
      const shrunk = window.visualViewport.height < window.innerHeight * 0.78;
      const active =
        typeof document !== "undefined" ? document.activeElement : null;
      setIsKeyboardOpen(shrunk || isTextEntryElement(active));
    };

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    window.visualViewport?.addEventListener("resize", handleViewportResize);

    return () => {
      if (blurTimer) clearTimeout(blurTimer);
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
    };
  }, []);

  const navItems = [
    { href: "/", label: "Ana Sayfa", icon: Home },
    { href: "/kutuphane", label: "Kütüphane", icon: Library },
    { href: "/alistirmalar", label: "Oyunlar", icon: Gamepad2 },
    { href: "/seviye-tespit", label: "Sınav", icon: Compass },
    { href: "/sozluk", label: "Sözlük", icon: BookA },
  ];

  return (
    <nav
      aria-label="Mobil Alt Navigasyon"
      aria-hidden={isKeyboardOpen || undefined}
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 pb-[max(0.25rem,env(safe-area-inset-bottom))] bg-[#FBF6EC]/95 dark:bg-[#1e1e1e]/95 backdrop-blur-md border-t-2 border-[#E6D7BE] dark:border-[var(--border)] transition-transform duration-200 ${
        isKeyboardOpen
          ? "translate-y-full pointer-events-none opacity-0"
          : "translate-y-0 opacity-100"
      }`}
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => playClick()}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-colors ${
                isActive
                  ? "text-[#087F5B] dark:text-emerald-400 font-extrabold"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] font-semibold"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#087F5B]/15 dark:bg-emerald-500/20 scale-105"
                    : ""
                }`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[11px] leading-none truncate max-w-full px-0.5">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}