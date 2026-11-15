"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { playClick } from "@/lib/sfxManager";

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let rafId: number | null = null;
    const evaluateVisibility = () => {
      const scrollY = window.scrollY;
      const isAtFooter =
        window.innerHeight + scrollY >=
        document.documentElement.scrollHeight - 90;
      const isVirtualKeyboardOpen = Boolean(
        document.querySelector('[data-virtual-keyboard="true"]')
      );
      const isFullscreenOverlayOpen = Boolean(
        document.querySelector(
          '[data-fullscreen-exercise="true"], [role="dialog"][aria-modal="true"], .fixed.inset-0.z-\\[9999\\]'
        ) ||
          (window.innerWidth < 768 &&
            document.querySelector(".max-md\\:fixed.max-md\\:inset-0"))
      );
      setVisible(
        scrollY > 600 &&
          !isAtFooter &&
          !isVirtualKeyboardOpen &&
          !isFullscreenOverlayOpen
      );
    };
    const scheduleEvaluate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        evaluateVisibility();
      });
    };
    evaluateVisibility();
    window.addEventListener("scroll", evaluateVisibility, { passive: true });
    window.addEventListener("resize", evaluateVisibility, { passive: true });
    const observer = new MutationObserver(scheduleEvaluate);
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("scroll", evaluateVisibility);
      window.removeEventListener("resize", evaluateVisibility);
    };
  }, []);

  const scrollToTop = () => {
    playClick();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fixed right-3 bottom-20 md:bottom-6 md:right-6 z-30 print:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-0 pointer-events-none">
      <button
        type="button"
        onClick={scrollToTop}
        title="Yukarı Çık"
        aria-label="Sayfanın En Üstüne Kaydır"
        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white border-2 border-[#087F5B] border-b-4 shadow-lg flex items-center justify-center cursor-pointer active:border-b-2 active:translate-y-0.5 transition-all duration-300 ${
          visible
            ? "opacity-80 hover:opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 pointer-events-none translate-y-2"
        }`}
      >
        <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.75} />
      </button>
    </div>
  );
}
