"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { stopAllAudio } from "@/lib/audio";
import { useAudioStore } from "@/store/audioStore";
import { useClassroomToolsStore } from "@/store/classroomToolsStore";
import { useUserStore } from "@/store/userStore";

export default function AudioStopper() {
  const pathname = usePathname();
  const stopStoreAudio = useAudioStore((state) => state.stop);
  const clearShadowingTimer = useAudioStore((state) => state.clearShadowingTimer);
  const setGrammarSplitOpen = useClassroomToolsStore(
    (state) => state.setGrammarSplitOpen
  );

  // Uygulama genelinde aktif sekmede geçirilen çalışma süresini (60 sn aralıkla) say
  useEffect(() => {
    useUserStore.getState().syncDailyProgress();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        useUserStore.getState().syncDailyProgress();
      }
    };

    const studyTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        useUserStore.getState().addStudyMinutes(1);
      }
    }, 60000);

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      window.clearInterval(studyTimer);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, []);

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