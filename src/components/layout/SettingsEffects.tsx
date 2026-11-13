"use client";

import { useEffect } from "react";
import { useSettings } from "@/store/settings";
import { useClassroomToolsStore } from "@/store/classroomToolsStore";
import { applyGlobalTypographyCssVars } from "@/lib/arabicTextUtils";

export default function SettingsEffects() {
  const theme = useSettings((s) => s.theme);
  const arabicFont = useSettings((s) => s.arabicFont);
  const arabicFontSize = useSettings((s) => s.arabicFontSize);
  const arabicFontSizePreset = useSettings((s) => s.arabicFontSizePreset);
  const turkishFontSize = useSettings((s) => s.turkishFontSize);
  const isSmartboardOpen = useClassroomToolsStore((s) => s.isOpen);
  const isClassroomPresentationMode = useClassroomToolsStore(
    (s) => s.isClassroomPresentationMode
  );
  const isBoardModeActive = isSmartboardOpen || isClassroomPresentationMode;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    if (theme === "dark") {
      root.classList.remove("light");
    }
  }, [theme]);

  useEffect(() => {
    applyGlobalTypographyCssVars({
      arabicFont,
      arabicFontSize,
      arabicFontSizePreset,
      turkishFontSize,
    });
  }, [arabicFont, arabicFontSize, arabicFontSizePreset, turkishFontSize]);

  useEffect(() => {
    const syncBoardMode = () => {
      const shouldEnable =
        isBoardModeActive &&
        typeof window !== "undefined" &&
        window.innerWidth >= 768;
      document.documentElement.classList.toggle("board-mode", shouldEnable);
    };
    syncBoardMode();
    window.addEventListener("resize", syncBoardMode);
    return () => {
      window.removeEventListener("resize", syncBoardMode);
      document.documentElement.classList.remove("board-mode");
    };
  }, [isBoardModeActive]);

  return null;
}
