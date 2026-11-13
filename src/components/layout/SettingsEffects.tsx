"use client";

import { useEffect } from "react";
import { useSettings } from "@/store/settings";
import { applyGlobalTypographyCssVars } from "@/lib/arabicTextUtils";

export default function SettingsEffects() {
  const theme = useSettings((s) => s.theme);
  const arabicFont = useSettings((s) => s.arabicFont);
  const arabicFontSize = useSettings((s) => s.arabicFontSize);
  const arabicFontSizePreset = useSettings((s) => s.arabicFontSizePreset);
  const turkishFontSize = useSettings((s) => s.turkishFontSize);

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

  return null;
}
