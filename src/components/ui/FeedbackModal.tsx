"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { playClick } from "@/lib/sfxManager";

const FeedbackModalBody = dynamic(() => import("./FeedbackModalBody"), {
  ssr: false,
});

export function triggerFeedbackModal(initialDialogueRef?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("open-feedback-modal", {
        detail: { dialogueRef: initialDialogueRef },
      })
    );
  }
}

export function FooterFeedbackButton() {
  return (
    <button
      type="button"
      onClick={() => {
        playClick();
        triggerFeedbackModal();
      }}
      data-tooltip="Görüş, Öneri ve Hata Bildirim Formu"
      data-tooltip-pos="top"
      data-tooltip-align="right"
      aria-label="Görüş, Öneri ve Hata Bildirim Formu"
      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0"
    >
      <span>💬 İletişim</span>
    </button>
  );
}

export default function FeedbackModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogueRef, setDialogueRef] = useState<string | undefined>(undefined);
  const [openKey, setOpenKey] = useState(0);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const custom = e as CustomEvent<{ dialogueRef?: string }>;
      setDialogueRef(custom.detail?.dialogueRef);
      setOpenKey((k) => k + 1);
      setIsOpen(true);
    };
    window.addEventListener("open-feedback-modal", handleOpen);
    return () => window.removeEventListener("open-feedback-modal", handleOpen);
  }, []);

  if (!isOpen) return null;

  return (
    <FeedbackModalBody
      key={openKey}
      initialDialogueRef={dialogueRef}
      onClose={() => setIsOpen(false)}
    />
  );
}
