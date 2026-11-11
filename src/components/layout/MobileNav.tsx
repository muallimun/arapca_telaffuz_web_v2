"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  Gamepad2,
  Compass,
  BookMarked,
} from "lucide-react";
import { playClick } from "@/lib/sfxManager";

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: Home, label: "Ana Sayfa" },
    { href: "/kutuphane", icon: BookOpen, label: "Kütüphane" },
    { href: "/alistirmalar", icon: Gamepad2, label: "Alıştırmalar" },
    { href: "/seviye-tespit", icon: Compass, label: "Sınav" },
    { href: "/sozluk", icon: BookMarked, label: "Sözlük" },
  ];

  return (
    <nav
      aria-label="Mobil Alt Navigasyon"
      className="lg:hidden print:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FDFBF7]/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-[#E6D7BE] dark:border-slate-800 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
    >
      <div className="max-w-lg mx-auto h-15 px-1.5 sm:px-2 grid grid-cols-5 items-center gap-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                playClick();
                if (
                  item.href === "/kutuphane" &&
                  typeof window !== "undefined"
                ) {
                  window.dispatchEvent(
                    new CustomEvent("muallimun:kutuphane-vitrin")
                  );
                }
              }}
              className={`relative min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-all ${
                isActive
                  ? "text-[#087F5B] dark:text-emerald-400 font-extrabold"
                  : "text-slate-500 dark:text-slate-400 hover:text-[var(--foreground)] font-semibold"
              }`}
            >
              <div
                className={`px-2.5 py-0.5 rounded-full transition-all flex items-center justify-center ${
                  isActive
                    ? "bg-[#087F5B]/14 dark:bg-emerald-500/20"
                    : "bg-transparent"
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] sm:text-[11px] tracking-tight whitespace-nowrap text-center leading-tight mt-0.5">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}