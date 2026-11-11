"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { stopAllAudio } from "@/lib/audio";
import { useAudioStore } from "@/store/audioStore";
import { useClassroomToolsStore } from "@/store/classroomToolsStore";

export default function AudioStopper() {
  const pathname = usePathname();
  const stopStoreAudio = useAudioStore((state) => state.stop);
  const clearShadowingTimer = useAudioStore((state) => state.clearShadowingTimer);
  const setGrammarSplitOpen = useClassroomToolsStore(
    (state) => state.setGrammarSplitOpen
  );

  useEffect(() => {
    clearShadowingTimer();
    stopStoreAudio();
    stopAllAudio();

    const isLessonDetailRoute =
      pathname.startsWith("/diyalog/") || pathname.startsWith("/metin/");
    if (!isLessonDetailRoute) {
      setGrammarSplitOpen(false);
    }

    return () => {
      clearShadowingTimer();
      stopStoreAudio();
      stopAllAudio();
    };
  }, [pathname, stopStoreAudio, clearShadowingTimer, setGrammarSplitOpen]);

  return null;
}