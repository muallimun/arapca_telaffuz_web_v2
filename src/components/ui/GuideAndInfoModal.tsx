"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

export type GuideTab = "quickstart" | "icons" | "pedagogy" | "about" | "apps";

const GuideAndInfoModalBody = dynamic(
  () => import("./GuideAndInfoModalBody"),
  { ssr: false }
);

export function triggerGuideModal(initialTab?: GuideTab) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("open-guide-modal", { detail: { tab: initialTab } })
    );
  }
}

export default function GuideAndInfoModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<GuideTab>("quickstart");

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: GuideTab }>;
      if (custom.detail?.tab) {
        setActiveTab(custom.detail.tab);
      }
      setIsOpen(true);
    };
    window.addEventListener("open-guide-modal", handleOpen);
    return () => window.removeEventListener("open-guide-modal", handleOpen);
  }, []);

  if (!isOpen) return null;

  return (
    <GuideAndInfoModalBody
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onClose={() => setIsOpen(false)}
    />
  );
}
