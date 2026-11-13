"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getActiveAudio, stopAllAudio } from "@/lib/audio";
import { useAudioStore } from "@/store/audioStore";
import { useClassroomToolsStore } from "@/store/classroomToolsStore";
import { useUserStore } from "@/store/userStore";

const ACTIVE_INTERACTION_WINDOW_MS = 3 * 60 * 1000;

export default function AudioStopper() {
  const pathname = usePathname();
  const stopStoreAudio = useAudioStore((state) => state.stop);
  const clearShadowingTimer = useAudioStore((state) => state.clearShadowingTimer);
  const setGrammarSplitOpen = useClassroomToolsStore(
    (state) => state.setGrammarSplitOpen
  );

  // Uygulama genelinde aktif sekmede ve son 3 dakikada etkileşim/ses varsa çalışma süresini (60 sn aralıkla) say
  useEffect(() => {
    let lastInteractionAt = Date.now();

    const markInteraction = () => {
      lastInteractionAt = Date.now();
    };

    useUserStore.getState().syncDailyProgress();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        markInteraction();
        useUserStore.getState().syncDailyProgress();
      }
    };

    const isAudioCurrentlyPlaying = (): boolean => {
      const storeState = useAudioStore.getState();
      if (storeState.playingLineId !== null) return true;
      if (storeState.activeAudio && !storeState.activeAudio.paused) return true;
      const directAudio = getActiveAudio();
      if (directAudio && !directAudio.paused) return true;
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        window.speechSynthesis.speaking
      ) {
        return true;
      }
      return false;
    };

    const studyTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const recentlyInteracted =
        Date.now() - lastInteractionAt <= ACTIVE_INTERACTION_WINDOW_MS;
      if (recentlyInteracted || isAudioCurrentlyPlaying()) {
        useUserStore.getState().addStudyMinutes(1);
      }
    }, 60000);

    const interactionEvents: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
    ];
    for (const evt of interactionEvents) {
      window.addEventListener(evt, markInteraction, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      window.clearInterval(studyTimer);
      for (const evt of interactionEvents) {
        window.removeEventListener(evt, markInteraction);
      }
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